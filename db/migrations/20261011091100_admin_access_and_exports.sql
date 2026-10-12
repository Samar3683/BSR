-- =============================================================================
-- BSR admin backend — administrator management, report export
-- =============================================================================

-- Administrators with their login email and last sign-in (auth.users is not
-- exposed through the Data API, so this reads it on the caller's behalf).
create or replace function public.list_admins()
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  role text,
  active boolean,
  email text,
  last_sign_in_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select p.id, p.user_id, p.display_name, p.role, p.active, u.email::text, u.last_sign_in_at, p.created_at
    from public.admin_profiles p
    join auth.users u on u.id = p.user_id
    order by p.active desc, lower(p.display_name);
end;
$$;

-- Grants panel access to an existing Supabase Auth user. Called by the
-- `admin-users` Edge Function after it invites the user with the service
-- role, so the audit log records the inviting administrator as the actor.
create or replace function public.create_admin_profile(p_user_id uuid, p_display_name text)
returns public.admin_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.admin_profiles;
begin
  perform private.require_admin();
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    perform private.raise_rule('User not found');
  end if;
  if exists (select 1 from public.admin_profiles p where p.user_id = p_user_id) then
    perform private.raise_rule('This user already has an administrator profile');
  end if;
  if char_length(btrim(coalesce(p_display_name, ''))) not between 1 and 120 then
    perform private.raise_validation(jsonb_build_object('display_name', 'Enter a name (120 characters max)'));
  end if;
  insert into public.admin_profiles (user_id, display_name, role, active)
  values (p_user_id, btrim(p_display_name), 'admin', true)
  returning * into v_profile;
  return v_profile;
end;
$$;

-- Orders of a report (same dating and filters as report_summary), with the
-- names a CSV needs. Capped at 10 000 rows per export.
create or replace function public.report_orders_export(p_from date, p_to date, p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  perform private.require_admin();
  perform private.check_report_range(p_from, p_to);
  select coalesce(jsonb_agg(x.row order by x.sort_at, x.order_number), '[]'::jsonb) into v_rows
  from (
    select coalesce(o.pickup_at, o.created_at) as sort_at, o.order_number,
      to_jsonb(o) || jsonb_build_object(
        'customer_name', c.display_name,
        'driver_name', d.display_name,
        'vehicle_name', v.display_name
      ) as row
    from private.report_orders(p_from, p_to, coalesce(p_filters, '{}'::jsonb)) o
    join public.customers c on c.id = o.customer_id
    left join public.order_assignments a on a.order_id = o.id and a.released_at is null
    left join public.drivers d on d.id = a.driver_id
    left join public.vehicles v on v.id = a.vehicle_id
    order by 1, 2
    limit 10000
  ) x;
  return v_rows;
end;
$$;

revoke all on function public.list_admins() from public, anon;
revoke all on function public.create_admin_profile(uuid, text) from public, anon;
revoke all on function public.report_orders_export(date, date, jsonb) from public, anon;
grant execute on function public.list_admins() to authenticated;
grant execute on function public.create_admin_profile(uuid, text) to authenticated;
grant execute on function public.report_orders_export(date, date, jsonb) to authenticated;
