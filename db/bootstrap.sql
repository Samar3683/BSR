-- =============================================================================
-- BSR — PostgreSQL bootstrap (plain PostgreSQL 15+, no Supabase services)
--
-- Idempotent. Run as a role that may create roles, schemas and extensions
-- (`pnpm db:migrate` does it). It provides what the migrations rely on:
--
--   * request roles   anon / authenticated / service_role (NOLOGIN). The app
--                     server switches into `authenticated` per request and
--                     passes the signed-in user in `request.jwt.claims`, so
--                     row-level security and column grants apply to every query.
--   * auth schema     users, sessions and one-time tokens owned by the app,
--                     plus auth.uid() / auth.jwt() reading the request claims.
--   * storage schema  private file objects (bytes in bytea) with RLS.
--   * extensions      pgcrypto, btree_gist (in schema `extensions`).
-- =============================================================================

set client_min_messages = warning;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    begin
      create role service_role nologin noinherit bypassrls;
    exception when insufficient_privilege then
      create role service_role nologin noinherit;
    end;
  end if;
end $$;

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- ------------------------------------------------------------------ auth schema
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  aud text not null default 'authenticated',
  role text not null default 'authenticated',
  email text not null,
  encrypted_password text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);
create unique index if not exists users_email_lower_key on auth.users (lower(email));

-- Server-side login sessions. Only a SHA-256 hash of the cookie token is stored.
create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash bytea not null unique,
  via text not null default 'password' check (via in ('password', 'link')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  user_agent text
);
create index if not exists sessions_user_idx on auth.sessions (user_id);

-- Emailed links: password recovery and administrator invitations.
create table if not exists auth.one_time_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('recovery', 'invite')),
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists one_time_tokens_user_idx on auth.one_time_tokens (user_id);

-- Claims of the current request (set by the app server in each transaction).
create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;
-- Request roles never read the tables themselves; SECURITY DEFINER functions do.
revoke all on auth.users, auth.sessions, auth.one_time_tokens from anon, authenticated, service_role;

-- ---------------------------------------------------------------- storage schema
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null unique,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets (id),
  name text not null,
  owner uuid,
  metadata jsonb not null default '{}'::jsonb,
  content bytea not null default ''::bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1:array_length(parts, 1) - 1];
end;
$$;

grant usage on schema storage to anon, authenticated, service_role;
grant select on storage.objects to anon;
grant select, insert on storage.objects to authenticated;
grant select on storage.buckets to anon, authenticated;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------- extensions
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- Objects created later by this role (the migrations) are usable by the request
-- roles unless a migration revokes them; the security migration narrows that to
-- column-level grants and row-level security.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
