-- The relation breakdown grouped by an expression and then looked a label up
-- from the ungrouped column; group first, look the label up after.
create or replace function public.report_field_breakdown(
  p_entity text,
  p_field_key text,
  p_from date default null,
  p_to date default null,
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_def public.field_definitions;
  v_table text := private.entity_table(p_entity);
  v_base text;
  v_expr text;
  v_rows jsonb;
  v_stats jsonb;
  v_total bigint;
  v_kind text;
begin
  perform private.require_admin();
  select * into v_def from public.field_definitions f where f.entity_type = p_entity and f.field_key = p_field_key;
  if v_def.id is null or not v_def.reportable then
    perform private.raise_validation(jsonb_build_object('field', 'This field is not reportable'));
  end if;

  if p_entity = 'order' then
    perform private.check_report_range(p_from, p_to);
    v_base := format('select * from private.report_orders(%L::date, %L::date, %L::jsonb)', p_from, p_to,
      coalesce(p_filters, '{}'::jsonb)::text);
  else
    v_base := format('select * from public.%I where archived_at is null', v_table);
  end if;
  v_expr := private.field_sql_expr(v_def);

  execute format('select count(*) from (%s) t', v_base) into v_total;

  if v_def.field_type = 'single_select' then
    v_kind := 'categorical';
    execute format(
      'select coalesce(jsonb_agg(jsonb_build_object(''key'', x.key, ''label'', x.label, ''archived'', x.archived, ''count'', x.n)
                                 order by x.ord nulls last), ''[]''::jsonb)
         from (
           select o.id::text as key, o.label, o.archived_at is not null as archived, o.sort_order as ord,
             (select count(*) from (%1$s) t where %2$s = o.id::text) n
           from public.field_options o where o.field_id = %3$L
           union all
           select null, ''(empty)'', false, null, (select count(*) from (%1$s) t where %2$s is null)
         ) x
        where x.n > 0 or not x.archived',
      v_base, v_expr, v_def.id) into v_rows;
  elsif v_def.field_type = 'multi_select' then
    v_kind := 'categorical';
    execute format(
      'select coalesce(jsonb_agg(jsonb_build_object(''key'', x.key, ''label'', x.label, ''archived'', x.archived, ''count'', x.n)
                                 order by x.ord nulls last), ''[]''::jsonb)
         from (
           select o.id::text as key, o.label, o.archived_at is not null as archived, o.sort_order as ord,
             (select count(*) from (%1$s) t where coalesce(%2$s, ''[]''::jsonb) ? o.id::text) n
           from public.field_options o where o.field_id = %3$L
           union all
           select null, ''(empty)'', false, null,
             (select count(*) from (%1$s) t where %2$s is null or jsonb_array_length(%2$s) = 0)
         ) x
        where x.n > 0 or not x.archived',
      v_base, v_expr, v_def.id) into v_rows;
  elsif v_def.field_type = 'boolean' then
    v_kind := 'categorical';
    execute format(
      'select coalesce(jsonb_agg(jsonb_build_object(''key'', x.key, ''label'', x.label, ''count'', x.n) order by x.ord), ''[]''::jsonb)
         from (
           select ''true'' key, ''Yes'' label, 1 ord, (select count(*) from (%1$s) t where %2$s is true) n
           union all select ''false'', ''No'', 2, (select count(*) from (%1$s) t where %2$s is false)
           union all select null, ''(empty)'', 3, (select count(*) from (%1$s) t where %2$s is null)
         ) x',
      v_base, v_expr) into v_rows;
  elsif v_def.field_type = 'relation' then
    v_kind := 'categorical';
    execute format(
      'select coalesce(jsonb_agg(jsonb_build_object(''key'', x.key, ''label'', coalesce(x.label, ''(empty)''), ''count'', x.n)
                                 order by x.n desc, x.label), ''[]''::jsonb)
         from (
           select k.key, (select r.display_name from public.%3$I r where r.id::text = k.key) as label, k.n
           from (select %2$s::text as key, count(*) n from (%1$s) t group by 1 order by 2 desc limit 25) k
         ) x',
      v_base, v_expr, private.entity_table(v_def.relation_entity)) into v_rows;
  elsif v_def.field_type = 'short_text' then
    v_kind := 'categorical';
    execute format(
      'select coalesce(jsonb_agg(jsonb_build_object(''key'', x.key, ''label'', coalesce(x.label, ''(empty)''), ''count'', x.n)
                                 order by x.n desc, x.label), ''[]''::jsonb)
         from (
           select lower(%2$s) as key, min(%2$s) as label, count(*) n
           from (%1$s) t group by 1 order by 3 desc limit 25
         ) x',
      v_base, v_expr) into v_rows;
  elsif v_def.field_type in ('integer', 'decimal', 'currency', 'percentage') then
    v_kind := 'numeric';
    execute format(
      'select jsonb_build_object(''count'', count(%2$s), ''sum'', sum(%2$s), ''avg'', round(avg(%2$s), 2),
                                 ''min'', min(%2$s), ''max'', max(%2$s))
         from (%1$s) t',
      v_base, v_expr) into v_stats;
    v_rows := '[]'::jsonb;
  elsif v_def.field_type in ('date', 'datetime') then
    v_kind := 'timeline';
    execute format(
      'select coalesce(jsonb_agg(jsonb_build_object(''key'', x.key, ''label'', x.key, ''count'', x.n) order by x.key), ''[]''::jsonb)
         from (
           select to_char(date_trunc(''month'', %2$s), ''YYYY-MM'') as key, count(*) n
           from (%1$s) t where %2$s is not null group by 1
         ) x',
      v_base, v_expr) into v_rows;
  else
    perform private.raise_validation(jsonb_build_object('field', 'This field type cannot be reported'));
  end if;

  return jsonb_build_object(
    'field', jsonb_build_object('id', v_def.id, 'field_key', v_def.field_key, 'label', v_def.label,
                                'field_type', v_def.field_type, 'validation_rules', v_def.validation_rules),
    'kind', v_kind,
    'total_records', v_total,
    'rows', v_rows,
    'stats', v_stats
  );
end;
$$;
