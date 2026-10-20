-- =============================================================================
-- BSR admin backend — list queries
--
-- list_records() serves every entity list: free-text search over the fields
-- configured as searchable, filters over filterable fields, sorting over
-- sortable fields, pagination and a total count. The field configuration is
-- enforced here, server-side. Keys are validated against the definitions and
-- every value is quoted with format(%L), so the dynamic SQL is not injectable.
-- SECURITY INVOKER: RLS applies to everything it reads.
-- =============================================================================

-- SQL expression (on alias t) of a field, typed for comparison and sorting.
create or replace function private.field_sql_expr(p_def public.field_definitions)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_def.binding_key is not null then format('t.%I', p_def.binding_key)
    when p_def.field_type in ('integer', 'decimal', 'currency', 'percentage') then format('(t.attributes ->> %L)::numeric', p_def.field_key)
    when p_def.field_type = 'date' then format('(t.attributes ->> %L)::date', p_def.field_key)
    when p_def.field_type = 'datetime' then format('(t.attributes ->> %L)::timestamptz', p_def.field_key)
    when p_def.field_type = 'time' then format('(t.attributes ->> %L)::time', p_def.field_key)
    when p_def.field_type = 'boolean' then format('(t.attributes ->> %L)::boolean', p_def.field_key)
    when p_def.field_type in ('multi_select', 'address', 'image', 'file') then format('(t.attributes -> %L)', p_def.field_key)
    else format('(t.attributes ->> %L)', p_def.field_key)
  end;
$$;

-- Postgres type to cast filter values to.
create or replace function private.field_sql_type(p_def public.field_definitions)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_def.field_type in ('integer', 'decimal', 'currency', 'percentage') then 'numeric'
    when p_def.field_type = 'date' then 'date'
    when p_def.field_type = 'datetime' then 'timestamptz'
    when p_def.field_type = 'time' then 'time'
    when p_def.field_type = 'boolean' then 'boolean'
    when p_def.binding_key is not null and p_def.field_type = 'relation' then 'uuid'
    else 'text'
  end;
$$;

create or replace function private.like_pattern(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select '%' || replace(replace(replace(p_text, '\', '\\'), '%', '\%'), '_', '\_') || '%';
$$;

-- One filter → SQL condition. p_expr / p_type describe the field.
create or replace function private.filter_condition(
  p_expr text,
  p_type text,
  p_kind text,      -- field type name, or 'status' / 'system'
  p_op text,
  p_value jsonb
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text := p_value #>> '{}';
begin
  case p_op
  when 'is_empty' then
    if p_kind = 'multi_select' then
      return format('(%s is null or jsonb_array_length(%s) = 0)', p_expr, p_expr);
    end if;
    return format('%s is null', p_expr);
  when 'is_not_empty' then
    return format('%s is not null', p_expr);
  when 'eq', 'neq' then
    if p_value is null or jsonb_typeof(p_value) in ('null', 'array', 'object') then
      raise exception 'invalid filter value';
    end if;
    if p_kind = 'multi_select' then
      return format('%s(coalesce(%s, ''[]''::jsonb) ? %L)', case when p_op = 'neq' then 'not ' else '' end, p_expr, v_text);
    end if;
    if p_type = 'text' and p_kind in ('short_text', 'email', 'phone', 'url') then
      return format('lower(%s) %s lower(%L)', p_expr, case when p_op = 'eq' then '=' else 'is distinct from' end, v_text);
    end if;
    return format('%s %s %L::%s', p_expr, case when p_op = 'eq' then '=' else 'is distinct from' end, v_text, p_type);
  when 'in' then
    if jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) = 0 then
      raise exception 'invalid filter value';
    end if;
    if p_kind = 'multi_select' then
      return format('(coalesce(%s, ''[]''::jsonb) ?| array(select jsonb_array_elements_text(%L::jsonb)))', p_expr, p_value::text);
    end if;
    return format('%s::text = any (array(select jsonb_array_elements_text(%L::jsonb)))', p_expr, p_value::text);
  when 'contains' then
    if v_text is null or btrim(v_text) = '' then
      raise exception 'invalid filter value';
    end if;
    return format('%s::text ilike %L', p_expr, private.like_pattern(btrim(v_text)));
  when 'gt', 'gte', 'lt', 'lte' then
    if p_type not in ('numeric', 'date', 'timestamptz', 'time') or v_text is null then
      raise exception 'invalid filter operator';
    end if;
    return format('%s %s %L::%s', p_expr,
      case p_op when 'gt' then '>' when 'gte' then '>=' when 'lt' then '<' else '<=' end, v_text, p_type);
  when 'between' then
    if p_type not in ('numeric', 'date', 'timestamptz', 'time') or jsonb_typeof(p_value) <> 'array'
       or jsonb_array_length(p_value) <> 2 then
      raise exception 'invalid filter value';
    end if;
    return format('(%s >= %L::%s and %s <= %L::%s)', p_expr, p_value ->> 0, p_type, p_expr, p_value ->> 1, p_type);
  else
    raise exception 'invalid filter operator';
  end case;
end;
$$;

-- Shared JSON shape of a record in lists (adds the relations dispatch needs).
create or replace function private.record_row_sql(p_entity text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_entity
    when 'order' then
      $q$to_jsonb(t) || jsonb_build_object(
        'customer', (select jsonb_build_object('id', c.id, 'display_name', c.display_name, 'archived_at', c.archived_at)
                     from public.customers c where c.id = t.customer_id),
        'assignment', (select jsonb_build_object('id', a.id, 'driver_id', a.driver_id, 'vehicle_id', a.vehicle_id,
                         'driver_name', d.display_name, 'vehicle_name', v.display_name,
                         'starts_at', a.starts_at, 'ends_at', a.ends_at)
                       from public.order_assignments a
                       left join public.drivers d on d.id = a.driver_id
                       left join public.vehicles v on v.id = a.vehicle_id
                       where a.order_id = t.id and a.released_at is null))$q$
    when 'driver' then
      $q$to_jsonb(t) || jsonb_build_object(
        'pairing', (select jsonb_build_object('id', p.id, 'vehicle_id', p.vehicle_id, 'vehicle_name', v.display_name)
                    from public.driver_vehicle_assignments p join public.vehicles v on v.id = p.vehicle_id
                    where p.driver_id = t.id and p.period @> now() limit 1))$q$
    when 'vehicle' then
      $q$to_jsonb(t) || jsonb_build_object(
        'pairing', (select jsonb_build_object('id', p.id, 'driver_id', p.driver_id, 'driver_name', d.display_name)
                    from public.driver_vehicle_assignments p join public.drivers d on d.id = p.driver_id
                    where p.vehicle_id = t.id and p.period @> now() limit 1))$q$
    else 'to_jsonb(t)'
  end;
$$;

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
  v_errors jsonb := '{}'::jsonb;
begin
  perform private.require_admin();
  if v_table is null then
    perform private.raise_rule('Unknown entity');
  end if;
  p_limit := least(greatest(coalesce(p_limit, 25), 1), 500);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  -- Archive scope
  v_where := v_where || case coalesce(p_archived, 'active')
    when 'archived' then 't.archived_at is not null'
    when 'all' then 'true'
    else 't.archived_at is null'
  end;

  -- Free-text search over searchable fields (+ the record name).
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

  -- Filters: [{field, op, value}]
  if jsonb_typeof(coalesce(p_filters, '[]'::jsonb)) <> 'array' then
    perform private.raise_validation(jsonb_build_object('filters', 'Filters must be a list'));
  end if;
  for v_filter in select jsonb_array_elements(coalesce(p_filters, '[]'::jsonb)) loop
    v_field := v_filter ->> 'field';
    v_op := v_filter ->> 'op';
    begin
      -- System filters available on every list
      if v_field in ('created_at', 'updated_at') then
        v_where := v_where || private.filter_condition(format('t.%I', v_field), 'timestamptz', 'system', v_op, v_filter -> 'value');
      elsif v_field = 'status' and p_entity = 'order' then
        v_where := v_where || private.filter_condition('t.status', 'public.order_status', 'status', v_op, v_filter -> 'value');
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
        -- Orders whose planned window overlaps [from, to)
        v_where := v_where || format(
          'tstzrange(coalesce(t.pickup_at, t.delivery_at), coalesce(t.delivery_at, t.pickup_at), ''[]'') && tstzrange(%L::timestamptz, %L::timestamptz, ''[)'')',
          v_filter -> 'value' ->> 0, v_filter -> 'value' ->> 1);
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

  -- Sorting
  v_sort_field := coalesce(p_sort ->> 'field', case when p_entity = 'order' then 'created_at' else 'display_name' end);
  v_sort_dir := case when lower(coalesce(p_sort ->> 'direction', case when p_entity = 'order' then 'desc' else 'asc' end)) = 'desc'
                     then 'desc nulls last' else 'asc nulls last' end;
  if v_sort_field in ('created_at', 'updated_at', 'display_name')
     or (p_entity = 'order' and v_sort_field in ('order_number', 'pickup_at', 'delivery_at')) then
    -- System columns: always sortable (dispatch orders its queue by pickup).
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
         where %s
         order by %s
         limit %s offset %s
       ) r',
    private.record_row_sql(p_entity), v_order, v_table, array_to_string(v_where, ' and '), v_order, p_limit, p_offset);

  begin
    execute v_sql into v_rows, v_total;
  exception
    when invalid_text_representation or invalid_datetime_format or datetime_field_overflow
         or numeric_value_out_of_range or invalid_parameter_value then
      perform private.raise_validation(jsonb_build_object('filters', 'A filter value is not valid for its field'));
  end;

  -- An offset past the end still reports the total.
  if v_total = 0 and p_offset > 0 then
    execute format('select count(*) from public.%I t where %s', v_table, array_to_string(v_where, ' and ')) into v_total;
  end if;

  return jsonb_build_object('rows', v_rows, 'total', v_total);
end;
$$;

revoke all on function public.list_records(text, text, jsonb, jsonb, integer, integer, text) from public, anon;
grant execute on function public.list_records(text, text, jsonb, jsonb, integer, integer, text) to authenticated;
