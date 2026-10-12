-- =============================================================================
-- BSR — helper for the application's sign-in flows
--
-- The app server connects as a limited login role that cannot read
-- admin_profiles (row-level security). Password-reset requests must only be
-- honoured for people with an active administrator profile, so that lookup is a
-- SECURITY DEFINER function in the auth schema, callable by the app role only.
-- =============================================================================

create or replace function auth.active_admin_user_id(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
    from auth.users u
    join public.admin_profiles p on p.user_id = u.id and p.active
   where lower(u.email) = lower(p_email)
   limit 1
$$;

revoke all on function auth.active_admin_user_id(text) from public, anon, authenticated, service_role;
