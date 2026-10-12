-- =============================================================================
-- BSR — change notifications for live screens
--
-- Every change to the tables the panel shows sends a small NOTIFY on channel
-- `bsr_changes` ({"t": table, "op": operation}) once per statement. No row data
-- travels with it: the web server forwards it to signed-in administrators, whose
-- screens then reload what they show through the normal, authorized queries.
-- =============================================================================

create or replace function private.notify_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_notify('bsr_changes', json_build_object('t', tg_table_name, 'op', tg_op)::text);
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'orders', 'customers', 'drivers', 'vehicles',
    'order_assignments', 'driver_vehicle_assignments', 'order_status_history',
    'quote_requests', 'contact_events',
    'entity_configs', 'field_definitions', 'field_options', 'dispatch_requirements',
    'admin_profiles'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each statement execute function private.notify_change()',
      t || '_notify', t);
  end loop;
end $$;
