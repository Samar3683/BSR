-- =============================================================================
-- BSR admin backend — support for the panel's usability upgrade
--
--   * field sections (forms and record pages group fields by section)
--   * audit transaction id (one user action = one group in the audit log)
--   * list_records: status counts, pickup-day and selection filters
--   * global_search, nav_counts
--   * bulk status change and bulk archive (per-row results, partial success)
--   * dispatch requirements (vehicle option → acceptable driver options)
--   * dispatch_candidates: record attributes, usual pairings first
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Field sections
-- -----------------------------------------------------------------------------
alter table public.field_definitions add column section text;
alter table public.field_definitions
  add constraint field_definitions_section_length check (section is null or char_length(section) between 1 and 60);

create or replace function private.normalize_field_section()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.section := nullif(btrim(coalesce(new.section, '')), '');
  return new;
end;
$$;

create trigger field_definitions_normalize_section
  before insert or update of section on public.field_definitions
  for each row execute function private.normalize_field_section();

grant insert (section), update (section) on public.field_definitions to authenticated;

-- Starting sections for the seeded fields (administrators can rename or clear them).
update public.field_definitions f set section = s.section
from (values
  ('order', 'order_number', 'Order'), ('order', 'customer', 'Order'), ('order', 'service', 'Order'),
  ('order', 'customer_reference', 'Order'),
  ('order', 'pickup_at', 'Schedule'), ('order', 'delivery_at', 'Schedule'),
  ('order', 'pickup_address', 'Route'), ('order', 'delivery_address', 'Route'),
  ('order', 'cargo', 'Cargo'), ('order', 'weight_kg', 'Cargo'), ('order', 'pallets', 'Cargo'),
  ('order', 'notes', 'Notes'),
  ('vehicle', 'plate', 'Vehicle'), ('vehicle', 'vehicle_type', 'Vehicle'), ('vehicle', 'make_model', 'Vehicle'),
  ('vehicle', 'payload_kg', 'Vehicle'), ('vehicle', 'photo', 'Vehicle'), ('vehicle', 'notes', 'Notes'),
  ('driver', 'full_name', 'Driver'), ('driver', 'phone', 'Driver'), ('driver', 'email', 'Driver'),
  ('driver', 'license_categories', 'Licence'), ('driver', 'license_expiry', 'Licence'), ('driver', 'notes', 'Notes'),
  ('customer', 'company_name', 'Company'), ('customer', 'vat_number', 'Company'), ('customer', 'address', 'Company'),
  ('customer', 'contact_name', 'Contact'), ('customer', 'phone', 'Contact'), ('customer', 'email', 'Contact'),
  ('customer', 'notes', 'Notes')
) as s(entity_type, field_key, section)
where f.entity_type = s.entity_type and f.field_key = s.field_key and f.section is null;

-- -----------------------------------------------------------------------------
-- Audit: the transaction that produced each entry
-- -----------------------------------------------------------------------------
alter table public.audit_logs add column transaction_id bigint;
alter table public.audit_logs alter column transaction_id set default txid_current();
create index audit_logs_transaction_idx on public.audit_logs (transaction_id);

-- -----------------------------------------------------------------------------
-- list_records (v2): status counts for orders, pickup-day and selection filters.
-- Unchanged otherwise; see 20261011090700_queries.sql for the rules.
-- -----------------------------------------------------------------------------
create or replace function public.list_records(
  p_entity text,
  p_search text default null,
  p_filters jsonb default '[]'::jsonb,
  p_sort jsonb default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_archived text default 'active'
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_table text := private.entity_table(p_entity);
  v_where text[] := array['true'];
  -- Status conditions are kept apart so the status counts ignore them.
  v_status_where text[] := array['true'];
  v_search text[] := '{}';
  v_pattern text;
  v_filter jsonb;
  v_field text;
  v_op text;
  v_def public.field_definitions;
  v_expr text;
  v_sort_field text;
  v_sort_dir text;
  v_order text;
  v_sql text;
  v_rows jsonb;
  v_total bigint;
  v_facets jsonb;
  v_errors jsonb := '{}'::jsonb;
begin
  perform private.require_admin();
  if v_table is null then
    perform private.raise_rule('Unknown entity');
  end if;
  p_limit := least(greatest(coalesce(p_limit, 25), 1), 500);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  v_where := v_where || case coalesce(p_archived, 'active')
    when 'archived' then 't.archived_at is not null'
    when 'all' then 'true'
    else 't.archived_at is null'
  end;

  if nullif(btrim(coalesce(p_search, '')), '') is not null then
    v_pattern := private.like_pattern(btrim(p_search));
    v_search := v_search || format('t.display_name ilike %L', v_pattern);
    if p_entity = 'order' then
      v_search := v_search || format('t.order_number ilike %L', v_pattern);
    end if;
    for v_def in
      select * from public.field_definitions f
      where f.entity_type = p_entity and f.searchable and f.active and f.archived_at is null
    loop
      v_expr := private.field_sql_expr(v_def);
      v_search := v_search || case
        when v_def.field_type = 'single_select' then
          format('%s in (select o.id::text from public.field_options o where o.field_id = %L and o.label ilike %L)',
            v_expr, v_def.id, v_pattern)
        when v_def.field_type = 'multi_select' then
          format('coalesce(%s, ''[]''::jsonb) ?| array(select o.id::text from public.field_options o where o.field_id = %L and o.label ilike %L)',
            v_expr, v_def.id, v_pattern)
        when v_def.field_type = 'relation' then
          format('%s::text in (select r.id::text from public.%I r where r.display_name ilike %L)',
            v_expr, private.entity_table(v_def.relation_entity), v_pattern)
        else format('%s::text ilike %L', v_expr, v_pattern)
      end;
    end loop;
    v_where := v_where || ('(' || array_to_string(v_search, ' or ') || ')');
  end if;

  if jsonb_typeof(coalesce(p_filters, '[]'::jsonb)) <> 'array' then
    perform private.raise_validation(jsonb_build_object('filters', 'Filters must be a list'));
  end if;
  for v_filter in select jsonb_array_elements(coalesce(p_filters, '[]'::jsonb)) loop
    v_field := v_filter ->> 'field';
    v_op := v_filter ->> 'op';
    begin
      if v_field in ('created_at', 'updated_at') then
        v_where := v_where || private.filter_condition(format('t.%I', v_field), 'timestamptz', 'system', v_op, v_filter -> 'value');
      elsif v_field = 'status' and p_entity = 'order' then
        v_status_where := v_status_where
          || private.filter_condition('t.status', 'public.order_status', 'status', v_op, v_filter -> 'value');
      elsif v_field = 'available' and p_entity in ('driver', 'vehicle') then
        v_where := v_where || private.filter_condition('t.available', 'boolean', 'system', v_op, v_filter -> 'value');
      elsif v_field in ('driver_id', 'vehicle_id') and p_entity = 'order' then
        v_where := v_where || format(
          'exists (select 1 from public.order_assignments a where a.order_id = t.id and a.released_at is null and a.%I = %L::uuid)',
          v_field, v_filter ->> 'value');
      elsif v_field = 'dispatch' and p_entity = 'order' then
        v_where := v_where || case v_filter ->> 'value'
          when 'unassigned' then 'not exists (select 1 from public.order_assignments a where a.order_id = t.id and a.released_at is null and a.driver_id is not null and a.vehicle_id is not null)'
          when 'assigned' then 'exists (select 1 from public.order_assignments a where a.order_id = t.id and a.released_at is null and a.driver_id is not null and a.vehicle_id is not null)'
          else 'true'
        end;
      elsif v_field = 'window' and p_entity = 'order' then
        v_where := v_where || format(
          'tstzrange(coalesce(t.pickup_at, t.delivery_at), coalesce(t.delivery_at, t.pickup_at), ''[]'') && tstzrange(%L::timestamptz, %L::timestamptz, ''[)'')',
          v_filter -> 'value' ->> 0, v_filter -> 'value' ->> 1);
      elsif v_field = 'pickup_between' and p_entity = 'order' then
        -- Quick date filters: pickup in [from, to)
        v_where := v_where || format('(t.pickup_at >= %L::timestamptz and t.pickup_at < %L::timestamptz)',
          v_filter -> 'value' ->> 0, v_filter -> 'value' ->> 1);
      elsif v_field = 'ids' then
        -- An explicit selection (bulk export).
        if jsonb_typeof(v_filter -> 'value') <> 'array' then
          raise exception 'invalid filter value';
        end if;
        v_where := v_where || format('t.id = any (array(select jsonb_array_elements_text(%L::jsonb))::uuid[])',
          (v_filter -> 'value')::text);
      else
        select * into v_def from public.field_definitions f
        where f.entity_type = p_entity and f.field_key = v_field;
        if not found or not v_def.filterable or v_def.archived_at is not null or not v_def.active then
          v_errors := v_errors || jsonb_build_object(coalesce(v_field, '_'), 'This field cannot be filtered');
          continue;
        end if;
        v_where := v_where || private.filter_condition(
          private.field_sql_expr(v_def), private.field_sql_type(v_def), v_def.field_type::text, v_op, v_filter -> 'value');
      end if;
    exception
      when raise_exception then
        v_errors := v_errors || jsonb_build_object(coalesce(v_field, '_'), 'Invalid filter');
    end;
  end loop;
  if v_errors <> '{}'::jsonb then
    perform private.raise_validation(v_errors);
  end if;

  v_sort_field := coalesce(p_sort ->> 'field', case when p_entity = 'order' then 'created_at' else 'display_name' end);
  v_sort_dir := case when lower(coalesce(p_sort ->> 'direction', case when p_entity = 'order' then 'desc' else 'asc' end)) = 'desc'
                     then 'desc nulls last' else 'asc nulls last' end;
  if v_sort_field in ('created_at', 'updated_at', 'display_name')
     or (p_entity = 'order' and v_sort_field in ('order_number', 'pickup_at', 'delivery_at')) then
    v_order := format('t.%I %s', v_sort_field, v_sort_dir);
  elsif v_sort_field = 'status' and p_entity = 'order' then
    v_order := format('t.status %s', v_sort_dir);
  else
    select * into v_def from public.field_definitions f
    where f.entity_type = p_entity and f.field_key = v_sort_field;
    if not found or not v_def.sortable or v_def.archived_at is not null or not v_def.active then
      perform private.raise_validation(jsonb_build_object('sort', 'This field cannot be sorted'));
    end if;
    v_expr := private.field_sql_expr(v_def);
    v_order := case
      when v_def.field_type = 'single_select' then
        format('(select o.sort_order from public.field_options o where o.id::text = %s) %s', v_expr, v_sort_dir)
      when v_def.field_type = 'relation' then
        format('(select lower(r.display_name) from public.%I r where r.id::text = %s::text) %s',
          private.entity_table(v_def.relation_entity), v_expr, v_sort_dir)
      when private.field_sql_type(v_def) = 'text' then format('lower(%s) %s', v_expr, v_sort_dir)
      else format('%s %s', v_expr, v_sort_dir)
    end;
  end if;
  v_order := v_order || ', t.id';

  v_sql := format(
    'select coalesce(jsonb_agg(r.row order by r.ord), ''[]''::jsonb), coalesce(max(r.total), 0)
       from (
         select %s as row, row_number() over (order by %s) as ord, count(*) over () as total
         from public.%I t
         where %s and %s
         order by %s
         limit %s offset %s
       ) r',
    private.record_row_sql(p_entity), v_order, v_table, array_to_string(v_where, ' and '),
    array_to_string(v_status_where, ' and '), v_order, p_limit, p_offset);

  begin
    execute v_sql into v_rows, v_total;
    if v_total = 0 and p_offset > 0 then
      execute format('select count(*) from public.%I t where %s and %s', v_table,
        array_to_string(v_where, ' and '), array_to_string(v_status_where, ' and ')) into v_total;
    end if;
    if p_entity = 'order' then
      execute format(
        'select coalesce(jsonb_object_agg(s.status, s.n), ''{}''::jsonb)
           from (select t.status, count(*) n from public.orders t where %s group by t.status) s',
        array_to_string(v_where, ' and ')) into v_facets;
    end if;
  exception
    when invalid_text_representation or invalid_datetime_format or datetime_field_overflow
         or numeric_value_out_of_range or invalid_parameter_value then
      perform private.raise_validation(jsonb_build_object('filters', 'A filter value is not valid for its field'));
  end;

  return jsonb_strip_nulls(jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'facets', case when v_facets is null then null else jsonb_build_object('status', v_facets) end
  ));
end;
$$;

-- -----------------------------------------------------------------------------
-- Global search: a few matches per entity, with the configured search rules.
-- -----------------------------------------------------------------------------
create or replace function public.global_search(p_query text, p_limit integer default 5)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_entity text;
  v_rows jsonb;
  v_result jsonb := '[]'::jsonb;
begin
  perform private.require_admin();
  if char_length(btrim(coalesce(p_query, ''))) < 2 then
    return v_result;
  end if;
  foreach v_entity in array array['order', 'customer', 'vehicle', 'driver'] loop
    v_rows := public.list_records(v_entity, btrim(p_query), '[]'::jsonb, null, least(greatest(p_limit, 1), 20), 0, 'all') -> 'rows';
    select v_result || coalesce(jsonb_agg(jsonb_build_object(
             'entity', v_entity,
             'id', r ->> 'id',
             'title', case when v_entity = 'order' then r ->> 'order_number' else r ->> 'display_name' end,
             'subtitle', case when v_entity = 'order' then r -> 'customer' ->> 'display_name' end,
             'status', r ->> 'status',
             'archived', (r ->> 'archived_at') is not null
           ) order by (r ->> 'archived_at') is not null), '[]'::jsonb)
      into v_result
    from jsonb_array_elements(v_rows) r;
  end loop;
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Sidebar counters (cheap; polled by the panel).
-- -----------------------------------------------------------------------------
create or replace function public.nav_counts()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'awaiting_dispatch', (
      select count(*) from public.orders o
      where o.archived_at is null and o.status = 'confirmed'
        and not exists (select 1 from public.order_assignments a where a.order_id = o.id and a.released_at is null
                          and a.driver_id is not null and a.vehicle_id is not null)),
    'overdue', (
      select count(*) from public.orders o
      where o.archived_at is null and o.status in ('confirmed', 'scheduled', 'in_transit') and o.delivery_at < now()),
    'in_transit', (select count(*) from public.orders o where o.archived_at is null and o.status = 'in_transit')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Bulk actions: each row in its own subtransaction, results reported per row.
-- -----------------------------------------------------------------------------
create or replace function public.bulk_change_order_status(
  p_order_ids uuid[],
  p_status public.order_status,
  p_note text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_results jsonb := '[]'::jsonb;
begin
  perform private.require_admin();
  if cardinality(p_order_ids) > 200 then
    perform private.raise_rule('Select at most 200 orders at a time');
  end if;
  foreach v_id in array p_order_ids loop
    begin
      perform public.change_order_status(v_id, p_status, p_note);
      v_results := v_results || jsonb_build_object('id', v_id, 'ok', true);
    exception when others then
      v_results := v_results || jsonb_build_object('id', v_id, 'ok', false, 'error', sqlerrm);
    end;
  end loop;
  return v_results;
end;
$$;

create or replace function public.bulk_set_archived(p_entity text, p_ids uuid[], p_archived boolean)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_table text := private.entity_table(p_entity);
  v_id uuid;
  v_count integer;
  v_results jsonb := '[]'::jsonb;
begin
  perform private.require_admin();
  if v_table is null then
    perform private.raise_rule('Unknown entity');
  end if;
  if cardinality(p_ids) > 200 then
    perform private.raise_rule('Select at most 200 records at a time');
  end if;
  foreach v_id in array p_ids loop
    begin
      execute format('update public.%I set archived_at = %s where id = $1 and (archived_at is null) = %L',
        v_table, case when p_archived then 'now()' else 'null' end, p_archived)
        using v_id;
      get diagnostics v_count = row_count;
      v_results := v_results || jsonb_build_object('id', v_id, 'ok', true, 'changed', v_count > 0);
    exception when others then
      v_results := v_results || jsonb_build_object('id', v_id, 'ok', false, 'error', sqlerrm);
    end;
  end loop;
  return v_results;
end;
$$;

-- -----------------------------------------------------------------------------
-- Dispatch requirements: a vehicle with option X needs a driver with one of
-- the listed options (e.g. vehicle type "Articolato" → licence "CE").
-- The panel warns when a pairing does not meet them; it does not block.
-- -----------------------------------------------------------------------------
create table public.dispatch_requirements (
  id uuid primary key default gen_random_uuid(),
  vehicle_option_id uuid not null references public.field_options (id) on delete cascade,
  driver_option_id uuid not null references public.field_options (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint dispatch_requirements_unique unique (vehicle_option_id, driver_option_id)
);

create or replace function private.validate_dispatch_requirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle_field public.field_definitions;
  v_driver_field public.field_definitions;
  v_other_driver_field uuid;
begin
  perform private.require_admin_or_system();
  new.created_at := now();
  new.created_by := (select auth.uid());
  select f.* into v_vehicle_field from public.field_options o join public.field_definitions f on f.id = o.field_id
  where o.id = new.vehicle_option_id;
  select f.* into v_driver_field from public.field_options o join public.field_definitions f on f.id = o.field_id
  where o.id = new.driver_option_id;
  if v_vehicle_field.entity_type is distinct from 'vehicle' or v_vehicle_field.field_type not in ('single_select', 'multi_select') then
    perform private.raise_rule('The requirement must start from an option of a vehicle select field');
  end if;
  if v_driver_field.entity_type is distinct from 'driver' or v_driver_field.field_type not in ('single_select', 'multi_select') then
    perform private.raise_rule('The required option must belong to a driver select field');
  end if;
  -- All accepted driver options of one vehicle option come from the same driver field.
  select fo.field_id into v_other_driver_field
  from public.dispatch_requirements r join public.field_options fo on fo.id = r.driver_option_id
  where r.vehicle_option_id = new.vehicle_option_id and fo.field_id <> v_driver_field.id
  limit 1;
  if v_other_driver_field is not null then
    perform private.raise_rule('Accepted driver options for one vehicle option must come from the same driver field');
  end if;
  return new;
end;
$$;

create trigger dispatch_requirements_validate
  before insert on public.dispatch_requirements
  for each row execute function private.validate_dispatch_requirement();

create trigger dispatch_requirements_audit after insert or update or delete on public.dispatch_requirements
  for each row execute function private.audit_row_change('dispatch_requirement');

alter table public.dispatch_requirements enable row level security;
revoke all on public.dispatch_requirements from anon, authenticated;
grant select, delete on public.dispatch_requirements to authenticated;
grant insert (vehicle_option_id, driver_option_id) on public.dispatch_requirements to authenticated;
create policy dispatch_requirements_select on public.dispatch_requirements
  for select to authenticated using ((select private.is_active_admin()));
create policy dispatch_requirements_insert on public.dispatch_requirements
  for insert to authenticated with check ((select private.is_active_admin()));
create policy dispatch_requirements_delete on public.dispatch_requirements
  for delete to authenticated using ((select private.is_active_admin()));

-- -----------------------------------------------------------------------------
-- dispatch_candidates (v2): attributes for requirement checks; free first,
-- then resources with a pairing in the window (the usual crews), then by name.
-- -----------------------------------------------------------------------------
create or replace function public.dispatch_candidates(p_order_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_order public.orders;
  v_from timestamptz;
  v_range tstzrange;
  v_current public.order_assignments;
begin
  perform private.require_admin();
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    perform private.raise_rule('Order not found');
  end if;
  select * into v_current from public.order_assignments a where a.order_id = p_order_id and a.released_at is null;

  if v_order.pickup_at is null or v_order.delivery_at is null then
    return jsonb_build_object('order_id', v_order.id, 'window', null, 'drivers', '[]'::jsonb, 'vehicles', '[]'::jsonb,
      'current', case when v_current.id is null then null else to_jsonb(v_current) end);
  end if;

  v_from := v_order.pickup_at;
  if v_current.id is not null and v_current.starts_at < now() then
    v_from := greatest(v_order.pickup_at, now());
  end if;
  v_range := tstzrange(v_from, greatest(v_from, v_order.delivery_at), '[)');

  return jsonb_build_object(
    'order_id', v_order.id,
    'window', jsonb_build_object('starts_at', v_from, 'ends_at', v_order.delivery_at),
    'current', case when v_current.id is null then null else to_jsonb(v_current) end,
    'drivers', (
      select coalesce(jsonb_agg(x.row order by x.busy, x.unpaired, x.name), '[]'::jsonb)
      from (
        select lower(d.display_name) as name, (conf.order_number is not null) as busy, (pv.vehicle_id is null) as unpaired,
          jsonb_build_object(
            'id', d.id, 'display_name', d.display_name, 'attributes', d.attributes,
            'conflict', case when conf.order_number is null then null
              else jsonb_build_object('order_id', conf.order_id, 'order_number', conf.order_number,
                                      'starts_at', lower(conf.period), 'ends_at', upper(conf.period)) end,
            'paired_vehicle_id', pv.vehicle_id, 'paired_vehicle_name', pv.vehicle_name
          ) as row
        from public.drivers d
        left join lateral (
          select a.order_id, o.order_number, a.period from public.order_assignments a
          join public.orders o on o.id = a.order_id
          where a.driver_id = d.id and a.order_id <> v_order.id and a.period && v_range
          order by lower(a.period) limit 1
        ) conf on true
        left join lateral (
          select p.vehicle_id, v.display_name as vehicle_name from public.driver_vehicle_assignments p
          join public.vehicles v on v.id = p.vehicle_id
          where p.driver_id = d.id and p.period && v_range
          order by lower(p.period) limit 1
        ) pv on true
        where d.archived_at is null and d.available
      ) x
    ),
    'vehicles', (
      select coalesce(jsonb_agg(x.row order by x.busy, x.unpaired, x.name), '[]'::jsonb)
      from (
        select lower(v.display_name) as name, (conf.order_number is not null) as busy, (pd.driver_id is null) as unpaired,
          jsonb_build_object(
            'id', v.id, 'display_name', v.display_name, 'attributes', v.attributes,
            'conflict', case when conf.order_number is null then null
              else jsonb_build_object('order_id', conf.order_id, 'order_number', conf.order_number,
                                      'starts_at', lower(conf.period), 'ends_at', upper(conf.period)) end,
            'paired_driver_id', pd.driver_id, 'paired_driver_name', pd.driver_name
          ) as row
        from public.vehicles v
        left join lateral (
          select a.order_id, o.order_number, a.period from public.order_assignments a
          join public.orders o on o.id = a.order_id
          where a.vehicle_id = v.id and a.order_id <> v_order.id and a.period && v_range
          order by lower(a.period) limit 1
        ) conf on true
        left join lateral (
          select p.driver_id, d.display_name as driver_name from public.driver_vehicle_assignments p
          join public.drivers d on d.id = p.driver_id
          where p.vehicle_id = v.id and p.period && v_range
          order by lower(p.period) limit 1
        ) pd on true
        where v.archived_at is null and v.available
      ) x
    )
  );
end;
$$;

revoke all on function public.global_search(text, integer) from public, anon;
revoke all on function public.nav_counts() from public, anon;
revoke all on function public.bulk_change_order_status(uuid[], public.order_status, text) from public, anon;
revoke all on function public.bulk_set_archived(text, uuid[], boolean) from public, anon;
grant execute on function public.global_search(text, integer) to authenticated;
grant execute on function public.nav_counts() to authenticated;
grant execute on function public.bulk_change_order_status(uuid[], public.order_status, text) to authenticated;
grant execute on function public.bulk_set_archived(text, uuid[], boolean) to authenticated;
