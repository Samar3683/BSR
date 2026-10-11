-- Local Supabase bootstrap: roles, schemas, extensions and grants.
--
-- Mirrors the final state of the official supabase/postgres image
-- (migrations/db/init-scripts/* + migrations/db/migrations/*) closely enough for
-- GoTrue, PostgREST and storage-api to behave as on hosted Supabase. GoTrue and
-- storage-api create their own tables via their own migrations on start.
--
-- Idempotent. Run as the cluster superuser `postgres` against database `postgres`:
--   psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 \
--        -v jwt_secret=... -v jwt_exp=3600 -f bootstrap.sql
--
-- Known differences from the image (see README): `postgres` stays a real superuser
-- (the bootstrap superuser of an existing cluster cannot be demoted), and the
-- safeupdate/supautils/pg_net/pg_graphql/vault/pgsodium extensions are not available.

\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- ---------------------------------------------------------------- roles (cluster-wide)
do $$
declare
  r text;
begin
  foreach r in array array[
    'supabase_admin', 'anon', 'authenticated', 'service_role', 'authenticator',
    'supabase_auth_admin', 'supabase_storage_admin', 'supabase_functions_admin',
    'supabase_replication_admin', 'supabase_read_only_user', 'dashboard_user',
    'supabase_privileged_role'
  ] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I', r);
    end if;
  end loop;
end $$;

alter role supabase_admin             with superuser createdb createrole replication bypassrls login;
-- API roles: created NOINHERIT, switched to INHERIT by 20230529180330_alter_api_roles_for_inherit.
alter role anon                       with nosuperuser inherit nocreaterole nocreatedb nologin noreplication nobypassrls;
alter role authenticated              with nosuperuser inherit nocreaterole nocreatedb nologin noreplication nobypassrls;
alter role service_role               with nosuperuser inherit nocreaterole nocreatedb nologin noreplication bypassrls;
alter role authenticator              with nosuperuser noinherit nocreaterole nocreatedb login noreplication nobypassrls;
alter role supabase_auth_admin        with nosuperuser noinherit createrole nocreatedb login noreplication nobypassrls;
alter role supabase_storage_admin     with nosuperuser noinherit createrole nocreatedb login noreplication nobypassrls;
alter role supabase_functions_admin   with nosuperuser noinherit createrole nocreatedb login noreplication nobypassrls;
alter role supabase_replication_admin with nosuperuser inherit nocreaterole nocreatedb login replication nobypassrls;
alter role supabase_read_only_user    with nosuperuser inherit nocreaterole nocreatedb login noreplication bypassrls;
alter role dashboard_user             with nosuperuser inherit createrole createdb nologin replication nobypassrls;
alter role supabase_privileged_role   with nologin;

-- Role memberships (final state of the image's migrations).
grant anon, authenticated, service_role to authenticator;
grant authenticator to supabase_storage_admin;
grant anon, authenticated, service_role, authenticator to postgres with admin option;
grant pg_monitor, pg_read_all_data, pg_signal_backend to postgres with admin option;
grant pg_read_all_data, pg_monitor to supabase_read_only_user;
grant supabase_privileged_role to postgres;

-- Per-role settings.
alter role anon                     set statement_timeout = '3s';
alter role authenticated            set statement_timeout = '8s';
alter role authenticator            set statement_timeout = '8s';
alter role authenticator            set lock_timeout = '8s';
alter role supabase_auth_admin      set search_path = auth;
alter role supabase_auth_admin      set idle_in_transaction_session_timeout = 60000;
alter role supabase_storage_admin   set search_path = storage;
alter role supabase_functions_admin set search_path = supabase_functions;
alter role supabase_admin           set search_path = "$user", public, auth, extensions;
alter role postgres                 set search_path = "$user", public, extensions;
alter role supabase_read_only_user  set default_transaction_read_only = on;

-- ---------------------------------------------------------------- database-level settings
select format('alter database %I set search_path = "$user", public, extensions', current_database()) \gexec
-- Hosted projects run in UTC.
select format('alter database %I set timezone = %L', current_database(), 'UTC') \gexec
\if :{?jwt_secret}
select format('alter database %I set "app.settings.jwt_secret" = %L', current_database(), :'jwt_secret') \gexec
\endif
\if :{?jwt_exp}
select format('alter database %I set "app.settings.jwt_exp" = %L', current_database(), :'jwt_exp') \gexec
\endif
select format('grant create on database %I to supabase_storage_admin', current_database()) \gexec
select format('grant all on database %I to dashboard_user', current_database()) \gexec

-- ---------------------------------------------------------------- extensions schema
create schema if not exists extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to postgres, anon, authenticated, service_role;
grant all on schema extensions to dashboard_user;
grant all privileges on all tables in schema extensions to postgres with grant option;
grant all privileges on all routines in schema extensions to postgres with grant option;
grant all privileges on all sequences in schema extensions to postgres with grant option;
alter default privileges in schema extensions grant all on tables to postgres with grant option;
alter default privileges in schema extensions grant all on routines to postgres with grant option;
alter default privileges in schema extensions grant all on sequences to postgres with grant option;

-- PostgREST schema-cache reload on DDL (20260923021047_update_pgrst_watch_triggers).
create or replace function extensions.pgrst_ddl_watch() returns event_trigger
language plpgsql as $$
declare
  cmd record;
  obj_schema text;
begin
  for cmd in select * from pg_event_trigger_ddl_commands()
  loop
    obj_schema := case
      when cmd.object_type in ('trigger', 'rule')
        then (pg_identify_object_as_address(cmd.classid, cmd.objid, cmd.objsubid)).object_names[1]
      else cmd.schema_name
    end;
    if cmd.command_tag in (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    and coalesce(obj_schema, '') not in ('pg_temp', 'auth', 'realtime', '_realtime', 'storage')
    then
      notify pgrst, 'reload schema';
    end if;
  end loop;
end; $$;

create or replace function extensions.pgrst_drop_watch() returns event_trigger
language plpgsql as $$
declare
  obj record;
  obj_schema text;
begin
  for obj in select * from pg_event_trigger_dropped_objects()
  loop
    obj_schema := case
      when obj.object_type in ('trigger', 'rule') then obj.address_names[1]
      else obj.schema_name
    end;
    if obj.object_type in (
      'schema', 'table', 'foreign table', 'view', 'materialized view',
      'function', 'trigger', 'type', 'rule'
    )
    and obj.is_temporary is false
    and coalesce(obj_schema, '') not in ('pg_temp', 'auth', 'realtime', '_realtime', 'storage')
    then
      notify pgrst, 'reload schema';
    end if;
  end loop;
end; $$;

do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'pgrst_ddl_watch') then
    create event trigger pgrst_ddl_watch on ddl_command_end execute procedure extensions.pgrst_ddl_watch();
  end if;
  if not exists (select 1 from pg_event_trigger where evtname = 'pgrst_drop_watch') then
    create event trigger pgrst_drop_watch on sql_drop execute procedure extensions.pgrst_drop_watch();
  end if;
end $$;

-- ---------------------------------------------------------------- public schema
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres;
-- Supabase's defaults: new objects in public are granted to the API roles, so RLS is the real guard.
alter default privileges for role postgres in schema public grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on sequences to postgres, anon, authenticated, service_role;

-- ---------------------------------------------------------------- graphql_public (exposed by PostgREST like the CLI; pg_graphql itself is unavailable)
create schema if not exists graphql_public;
grant usage on schema graphql_public to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema graphql_public grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema graphql_public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema graphql_public grant all on sequences to postgres, anon, authenticated, service_role;

-- ---------------------------------------------------------------- auth schema (tables come from GoTrue's own migrations)
create schema if not exists auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role, postgres;
grant all on schema auth to supabase_auth_admin, dashboard_user;
alter default privileges for role supabase_auth_admin in schema auth grant all on tables    to postgres, dashboard_user;
alter default privileges for role supabase_auth_admin in schema auth grant all on sequences to postgres, dashboard_user;
alter default privileges for role supabase_auth_admin in schema auth grant all on routines  to postgres, dashboard_user;

-- ---------------------------------------------------------------- storage schema (tables/functions come from storage-api's migrations)
create schema if not exists storage authorization supabase_storage_admin;
grant usage on schema storage to postgres with grant option;
grant usage on schema storage to anon, authenticated, service_role;
grant all on schema storage to supabase_storage_admin with grant option;
grant all on schema storage to dashboard_user;
alter default privileges for role supabase_storage_admin in schema storage grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges for role supabase_storage_admin in schema storage grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges for role supabase_storage_admin in schema storage grant all on sequences to postgres, anon, authenticated, service_role;

-- ---------------------------------------------------------------- realtime publication (so `alter publication supabase_realtime add table ...` works)
-- (Realtime itself is not part of this stack; wal_level stays 'replica', hence the silenced warning.)
set client_min_messages = error;
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

notify pgrst, 'reload schema';
