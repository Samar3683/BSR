-- =============================================================================
-- BSR admin backend — foundation
--
-- Extensions, the private helper schema (never exposed through the Data API),
-- administrator profiles and the authorization helpers every RLS policy uses.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
-- Exclusion constraints on (uuid, tstzrange) for assignment conflict detection.
create extension if not exists btree_gist with schema extensions;

-- Helpers live in `private`: PostgREST only exposes `public`, so nothing here is
-- callable over HTTP. Policies and triggers call these functions.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Administrator profiles
-- -----------------------------------------------------------------------------
create table public.admin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null,
  -- V1 has one role. The check is the single place to extend when roles grow.
  role text not null default 'admin',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 120),
  constraint admin_profiles_role_known check (role in ('admin'))
);

comment on table public.admin_profiles is
  'Administrators of the BSR admin panel. A Supabase Auth user without an active profile has no access to any admin data.';

-- -----------------------------------------------------------------------------
-- Authorization helpers
-- -----------------------------------------------------------------------------

-- True when the caller is an authenticated, active administrator. SECURITY
-- DEFINER so policies on admin_profiles itself can call it without recursion.
create or replace function private.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles p
    where p.user_id = (select auth.uid())
      and p.active
      and p.role = 'admin'
  );
$$;

-- Raises unless the caller is an active administrator. Used at the top of
-- every SECURITY DEFINER function, which bypasses RLS by design.
create or replace function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_active_admin() then
    raise exception 'Not authorized'
      using errcode = '42501', hint = 'forbidden';
  end if;
end;
$$;

-- For write triggers: requests carrying a user must come from an active
-- administrator. Requests without a user (migrations, the service role) pass.
-- INSERT triggers run before RLS WITH CHECK, so they call this first to never
-- evaluate business rules for an unauthorized caller.
create or replace function private.require_admin_or_system()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.is_active_admin() then
    raise exception 'Not authorized'
      using errcode = '42501', hint = 'forbidden';
  end if;
end;
$$;

-- Human-readable actor for audit records: profile name, else JWT email, else
-- the database role (migrations, service tasks).
create or replace function private.current_actor_label()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.display_name from public.admin_profiles p where p.user_id = (select auth.uid())),
    nullif((select auth.jwt()) ->> 'email', ''),
    'system:' || current_user
  );
$$;

revoke all on function private.is_active_admin() from public;
revoke all on function private.require_admin() from public;
revoke all on function private.current_actor_label() from public;
revoke all on function private.require_admin_or_system() from public;
grant execute on function private.require_admin_or_system() to authenticated, service_role;
grant execute on function private.is_active_admin() to authenticated, service_role;
grant execute on function private.require_admin() to authenticated, service_role;
grant execute on function private.current_actor_label() to authenticated, service_role;

-- Generic timestamps for tables without the dynamic-entity trigger.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger admin_profiles_touch_updated_at
  before update on public.admin_profiles
  for each row execute function private.touch_updated_at();

-- An administrator may rename profiles and (de)activate others, never change
-- the user binding or the role from the panel, and never lock themselves out.
create or replace function private.guard_admin_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Service-role / migration maintenance is not restricted here.
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'The user of an administrator profile cannot change'
      using errcode = 'P0001', hint = 'business_rule';
  end if;
  if new.role is distinct from old.role then
    raise exception 'Roles are managed outside the admin panel'
      using errcode = 'P0001', hint = 'business_rule';
  end if;
  if old.user_id = (select auth.uid()) and new.active is distinct from old.active then
    raise exception 'You cannot change your own access'
      using errcode = 'P0001', hint = 'business_rule';
  end if;
  return new;
end;
$$;

create trigger admin_profiles_guard_update
  before update on public.admin_profiles
  for each row execute function private.guard_admin_profile_update();

-- -----------------------------------------------------------------------------
-- The caller's own profile (null when the user has none). The admin UI uses it
-- to decide between the panel and "no access"; RLS still guards every table.
-- -----------------------------------------------------------------------------
create or replace function public.current_admin()
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  role text,
  active boolean,
  email text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.user_id, p.display_name, p.role, p.active, u.email::text
  from public.admin_profiles p
  join auth.users u on u.id = p.user_id
  where p.user_id = (select auth.uid());
$$;

revoke all on function public.current_admin() from public, anon;
grant execute on function public.current_admin() to authenticated;
