-- =============================================================================
-- BSR admin backend — audit log
--
-- One row per mutation of an operational or configuration table, written by
-- triggers (so no write path can skip it): actor, action, entity, before and
-- after state, changed fields. The table is append-only for every role: no
-- grants to write, no policies to write, and triggers that reject UPDATE,
-- DELETE and TRUNCATE.
-- =============================================================================

create table public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_label text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  entity_label text,
  before_state jsonb,
  after_state jsonb,
  changed_fields text[] not null default '{}',
  context jsonb not null default '{}'::jsonb
);

create index audit_logs_occurred_idx on public.audit_logs (occurred_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, occurred_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, occurred_at desc);
create index audit_logs_action_idx on public.audit_logs (action, occurred_at desc);
create index audit_logs_order_ctx_idx on public.audit_logs ((context ->> 'order_id')) where context ? 'order_id';

comment on table public.audit_logs is 'Append-only audit trail. Written by triggers only; never updated or deleted.';

create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity text := tg_argv[0];
  v_before jsonb;
  v_after jsonb;
  v_row jsonb;
  v_changed text[] := '{}';
  v_override text := nullif(current_setting('bsr.audit_action', true), '');
  v_action text;
  v_label text;
  v_context jsonb := '{}'::jsonb;
begin
  if current_setting('bsr.recompute', true) = 'on' then
    return null;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    v_before := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_after := to_jsonb(new);
  end if;
  v_row := coalesce(v_after, v_before);

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(c.k order by c.k), '{}') into v_changed
    from (
      select e.key as k
      from jsonb_each(v_after) e
      where e.key not in ('updated_at', 'updated_by', 'attributes', 'period', 'display_name')
        and e.value is distinct from (v_before -> e.key)
      union all
      select 'attributes.' || a.key
      from (
        select jsonb_object_keys(coalesce(v_after -> 'attributes', '{}'::jsonb)) as key
        union
        select jsonb_object_keys(coalesce(v_before -> 'attributes', '{}'::jsonb))
      ) a
      where (v_after -> 'attributes' -> a.key) is distinct from (v_before -> 'attributes' -> a.key)
    ) c;
    if cardinality(v_changed) = 0 then
      return null;  -- nothing a person would call a change
    end if;
  end if;

  v_action := case
    when tg_op = 'DELETE' then 'delete'
    when tg_op = 'INSERT' and v_entity = 'driver_vehicle_assignment' then 'pair'
    when tg_op = 'INSERT' then coalesce(v_override, 'create')
    when (v_before ->> 'archived_at') is null and (v_after ->> 'archived_at') is not null then 'archive'
    when (v_before ->> 'archived_at') is not null and (v_after ->> 'archived_at') is null then 'restore'
    when v_entity = 'order' and (v_before ->> 'status') is distinct from (v_after ->> 'status') then 'status_change'
    when v_entity = 'driver_vehicle_assignment' and (v_before ->> 'released_at') is null
         and (v_after ->> 'released_at') is not null then 'unpair'
    when v_entity = 'order_assignment' and (v_before ->> 'released_at') is null
         and (v_after ->> 'released_at') is not null then coalesce(v_override, 'unassign')
    when (v_before ->> 'active') is distinct from (v_after ->> 'active') then
      case when (v_after ->> 'active')::boolean then 'enable' else 'disable' end
    else coalesce(v_override, 'update')
  end;

  v_label := case v_entity
    when 'field_definition' then (v_row ->> 'entity_type') || ' · ' || (v_row ->> 'label')
    when 'field_option' then (select f.label from public.field_definitions f where f.id = (v_row ->> 'field_id')::uuid)
                             || ' · ' || (v_row ->> 'label')
    when 'order_assignment' then (select o.order_number from public.orders o where o.id = (v_row ->> 'order_id')::uuid)
    when 'driver_vehicle_assignment' then
      (select d.display_name from public.drivers d where d.id = (v_row ->> 'driver_id')::uuid)
      || ' ↔ ' || (select v.display_name from public.vehicles v where v.id = (v_row ->> 'vehicle_id')::uuid)
    when 'order' then coalesce(v_row ->> 'order_number', v_row ->> 'display_name')
    else v_row ->> 'display_name'
  end;

  v_context := jsonb_strip_nulls(jsonb_build_object(
    'order_id', case when v_entity = 'order_assignment' then v_row ->> 'order_id' when v_entity = 'order' then v_row ->> 'id' end,
    'driver_id', case when v_entity in ('order_assignment', 'driver_vehicle_assignment') then v_row ->> 'driver_id' end,
    'vehicle_id', case when v_entity in ('order_assignment', 'driver_vehicle_assignment') then v_row ->> 'vehicle_id' end,
    'field_id', case when v_entity = 'field_option' then v_row ->> 'field_id' end,
    'entity', case when v_entity = 'field_definition' then v_row ->> 'entity_type' end,
    'note', nullif(current_setting('bsr.status_note', true), '')
  ));

  insert into public.audit_logs (
    actor_id, actor_label, action, entity_type, entity_id, entity_label,
    before_state, after_state, changed_fields, context
  ) values (
    (select auth.uid()), private.current_actor_label(), v_action, v_entity,
    coalesce(v_row ->> 'id', v_row ->> 'entity_key'), v_label,
    v_before, v_after, v_changed, v_context
  );
  return null;
end;
$$;

create or replace function private.audit_logs_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Audit records are immutable'
    using errcode = '42501', hint = 'forbidden';
end;
$$;

create trigger audit_logs_no_update_delete
  before update or delete on public.audit_logs
  for each row execute function private.audit_logs_immutable();
create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function private.audit_logs_immutable();

create trigger customers_audit after insert or update or delete on public.customers
  for each row execute function private.audit_row_change('customer');
create trigger drivers_audit after insert or update or delete on public.drivers
  for each row execute function private.audit_row_change('driver');
create trigger vehicles_audit after insert or update or delete on public.vehicles
  for each row execute function private.audit_row_change('vehicle');
create trigger orders_audit after insert or update or delete on public.orders
  for each row execute function private.audit_row_change('order');
create trigger order_assignments_audit after insert or update or delete on public.order_assignments
  for each row execute function private.audit_row_change('order_assignment');
create trigger driver_vehicle_assignments_audit after insert or update or delete on public.driver_vehicle_assignments
  for each row execute function private.audit_row_change('driver_vehicle_assignment');
create trigger entity_configs_audit after insert or update or delete on public.entity_configs
  for each row execute function private.audit_row_change('entity_config');
create trigger field_definitions_audit after insert or update or delete on public.field_definitions
  for each row execute function private.audit_row_change('field_definition');
create trigger field_options_audit after insert or update or delete on public.field_options
  for each row execute function private.audit_row_change('field_option');
create trigger admin_profiles_audit after insert or update or delete on public.admin_profiles
  for each row execute function private.audit_row_change('admin_profile');
