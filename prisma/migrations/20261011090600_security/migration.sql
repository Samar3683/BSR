-- =============================================================================
-- BSR admin backend — Row Level Security and privileges
--
-- Model: every table is reachable only by an authenticated user with an active
-- administrator profile (private.is_active_admin()). Anonymous users get no
-- privileges at all. On top of RLS, column privileges restrict what clients
-- may write: system columns (ids, stamps, display names, order numbers,
-- statuses, system-field bindings) are owned by the database, and assignment,
-- history and audit tables are written only by triggers and SECURITY DEFINER
-- functions that check the caller first.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Reset Supabase's default broad grants on our tables, then grant precisely.
-- -----------------------------------------------------------------------------
revoke all on table
  public.admin_profiles,
  public.entity_configs,
  public.field_definitions,
  public.field_options,
  public.customers,
  public.drivers,
  public.vehicles,
  public.orders,
  public.driver_vehicle_assignments,
  public.order_assignments,
  public.order_status_history,
  public.audit_logs
from anon, authenticated;

revoke all on sequence public.order_number_seq from anon, authenticated;

-- The service role (server-side only: Edge Functions, maintenance scripts)
-- keeps full access except to rewrite history.
revoke insert, update, delete, truncate on table public.audit_logs from service_role;
revoke update, delete, truncate on table public.order_status_history from service_role;

-- Configuration
grant select on public.admin_profiles to authenticated;
grant update (display_name, active) on public.admin_profiles to authenticated;

grant select on public.entity_configs to authenticated;
grant update (display_name, plural_display_name, active, primary_display_field) on public.entity_configs to authenticated;

grant select, delete on public.field_definitions to authenticated;
grant insert (
  entity_type, field_key, label, field_type, description, help_text, placeholder, required, active, sort_order,
  show_in_list, show_in_detail, show_in_create, show_in_edit, searchable, filterable, sortable, reportable,
  unique_value, default_value, validation_rules, relation_entity
) on public.field_definitions to authenticated;
grant update (
  label, field_type, description, help_text, placeholder, required, active, archived_at, sort_order,
  show_in_list, show_in_detail, show_in_create, show_in_edit, searchable, filterable, sortable, reportable,
  unique_value, default_value, validation_rules, relation_entity
) on public.field_definitions to authenticated;

grant select, delete on public.field_options to authenticated;
grant insert (field_id, label, sort_order) on public.field_options to authenticated;
grant update (label, sort_order, archived_at) on public.field_options to authenticated;

-- Business records
grant select, delete on public.customers, public.drivers, public.vehicles, public.orders to authenticated;
grant insert (attributes) on public.customers to authenticated;
grant update (attributes, archived_at) on public.customers to authenticated;
grant insert (attributes, available) on public.drivers, public.vehicles to authenticated;
grant update (attributes, available, archived_at) on public.drivers, public.vehicles to authenticated;
grant insert (customer_id, status, pickup_at, delivery_at, attributes) on public.orders to authenticated;
grant update (customer_id, pickup_at, delivery_at, attributes, archived_at) on public.orders to authenticated;

-- Read-only to clients (written by RPCs / triggers)
grant select on public.driver_vehicle_assignments, public.order_assignments, public.order_status_history,
  public.audit_logs to authenticated;

grant execute on function private.next_order_number() to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.admin_profiles enable row level security;
alter table public.entity_configs enable row level security;
alter table public.field_definitions enable row level security;
alter table public.field_options enable row level security;
alter table public.customers enable row level security;
alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;
alter table public.orders enable row level security;
alter table public.driver_vehicle_assignments enable row level security;
alter table public.order_assignments enable row level security;
alter table public.order_status_history enable row level security;
alter table public.audit_logs enable row level security;

-- Administrators read every profile; any signed-in user reads only their own
-- (so the panel can tell "no access" from "inactive").
create policy admin_profiles_select on public.admin_profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_active_admin()));
create policy admin_profiles_update on public.admin_profiles
  for update to authenticated
  using ((select private.is_active_admin()))
  with check ((select private.is_active_admin()));

create policy entity_configs_select on public.entity_configs
  for select to authenticated using ((select private.is_active_admin()));
create policy entity_configs_update on public.entity_configs
  for update to authenticated
  using ((select private.is_active_admin())) with check ((select private.is_active_admin()));

-- Full CRUD for administrators on configuration and business tables.
do $$
declare
  t text;
begin
  foreach t in array array['field_definitions', 'field_options', 'customers', 'drivers', 'vehicles', 'orders'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_active_admin()))',
      t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_active_admin()))',
      t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_active_admin())) with check ((select private.is_active_admin()))',
      t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_active_admin()))',
      t || '_delete', t);
  end loop;
  foreach t in array array['driver_vehicle_assignments', 'order_assignments', 'order_status_history', 'audit_logs'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_active_admin()))',
      t || '_select', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Deletion guards: operational history is archived, never destroyed.
-- -----------------------------------------------------------------------------
create or replace function private.guard_record_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity text := tg_argv[0];
  v_def record;
  v_used boolean;
begin
  if v_entity = 'order' and (to_jsonb(old) ->> 'status') <> 'draft' then
    perform private.raise_rule('Only draft orders can be deleted; cancel or archive the order instead');
  end if;
  if v_entity = 'customer' and exists (select 1 from public.orders o where o.customer_id = old.id) then
    perform private.raise_rule('This customer has orders; archive the customer instead');
  end if;
  if v_entity = 'driver' and (
    exists (select 1 from public.order_assignments a where a.driver_id = old.id)
    or exists (select 1 from public.driver_vehicle_assignments a where a.driver_id = old.id)
  ) then
    perform private.raise_rule('This driver has assignment history; archive the driver instead');
  end if;
  if v_entity = 'vehicle' and (
    exists (select 1 from public.order_assignments a where a.vehicle_id = old.id)
    or exists (select 1 from public.driver_vehicle_assignments a where a.vehicle_id = old.id)
  ) then
    perform private.raise_rule('This vehicle has assignment history; archive the vehicle instead');
  end if;
  for v_def in
    select f.entity_type, f.field_key, f.label
    from public.field_definitions f
    where f.field_type = 'relation' and f.relation_entity = v_entity and f.binding_key is null
  loop
    execute format('select exists (select 1 from public.%I where attributes ->> %L = $1)',
      private.entity_table(v_def.entity_type), v_def.field_key)
      into v_used using old.id::text;
    if v_used then
      perform private.raise_rule(format('Other records reference this record in "%s"; archive it instead', v_def.label));
    end if;
  end loop;
  return old;
end;
$$;

create trigger customers_guard_delete before delete on public.customers
  for each row execute function private.guard_record_delete('customer');
create trigger drivers_guard_delete before delete on public.drivers
  for each row execute function private.guard_record_delete('driver');
create trigger vehicles_guard_delete before delete on public.vehicles
  for each row execute function private.guard_record_delete('vehicle');
create trigger orders_guard_delete before delete on public.orders
  for each row execute function private.guard_record_delete('order');
