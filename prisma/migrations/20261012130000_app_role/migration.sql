-- =============================================================================
-- BSR — the application's login role
--
-- The web server connects as `bsr_app` (DATABASE_URL). It switches into the
-- request roles (SET ROLE) and manages the auth tables; it does not inherit
-- table privileges, owns nothing and has no DDL rights. Created here without a
-- password (the local Docker database trusts loopback connections); anywhere
-- else set one: alter role bsr_app password '…'.
--
-- A later migration that adds a function the server calls as itself (outside
-- a request role) grants it to bsr_app there.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'bsr_app') then
    create role bsr_app login noinherit;
  end if;
end $$;

alter role bsr_app noinherit;
grant anon, authenticated, service_role to bsr_app;
grant usage on schema public, auth, storage to bsr_app;
grant select, insert, update, delete on auth.users, auth.sessions, auth.one_time_tokens to bsr_app;

-- Password-reset requests are only sent to people with an active administrator profile.
grant execute on function auth.active_admin_user_id(text) to bsr_app;

-- Public-site intake: the only way the web server writes visitor submissions.
grant usage on schema intake to bsr_app;
grant execute on function intake.submit_quote_request(jsonb), intake.record_contact_event(text, text) to bsr_app;

-- Prisma's migration history is not part of the Data API.
do $$
begin
  if to_regclass('public._prisma_migrations') is not null then
    revoke all on table public._prisma_migrations from public, anon, authenticated, service_role;
  end if;
end $$;
