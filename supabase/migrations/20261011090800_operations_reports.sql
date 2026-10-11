-- =============================================================================
-- BSR admin backend — dashboard, calendar, dispatch board, reports
--
-- Read models computed from the operational tables at query time (no copies,
-- no cached figures). All SECURITY INVOKER: RLS applies to every row read.
-- Business days are evaluated in Europe/Rome.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Dashboard
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_summary()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_day_start timestamptz := (v_today::timestamp at time zone 'Europe/Rome');
  v_day_end timestamptz := ((v_today + 1)::timestamp at time zone 'Europe/Rome');
  v_result jsonb;
begin
  perform private.require_admin();

  with live as (
    select o.*,
      a.driver_id, a.vehicle_id,
      (a.driver_id is not null and a.vehicle_id is not null) as fully_assigned
    from public.orders o
    left join public.order_assignments a on a.order_id = o.id and a.released_at is null
    where o.archived_at is null
  ),
  busy_drivers as (
    select distinct a.driver_id from public.order_assignments a
    where a.driver_id is not null and a.period @> now()
  ),
  busy_vehicles as (
    select distinct a.vehicle_id from public.order_assignments a
    where a.vehicle_id is not null and a.period @> now()
  )
  select jsonb_build_object(
    'generated_at', now(),
    'counts', jsonb_build_object(
      'pickups_today', (select count(*) from live where pickup_at >= v_day_start and pickup_at < v_day_end
                          and status <> 'cancelled'),
      'in_transit', (select count(*) from live where status = 'in_transit'),
      'awaiting_dispatch', (select count(*) from live where status = 'confirmed' and not coalesce(fully_assigned, false)),
      'scheduled_next_7_days', (select count(*) from live where status = 'scheduled'
                                  and pickup_at >= now() and pickup_at < now() + interval '7 days'),
      'delivered_last_30_days', (select count(distinct h.order_id) from public.order_status_history h
                                   where h.to_status = 'delivered' and h.changed_at >= now() - interval '30 days'),
      'overdue', (select count(*) from live where status in ('confirmed', 'scheduled', 'in_transit')
                    and delivery_at < now()),
      'drivers_total', (select count(*) from public.drivers d where d.archived_at is null and d.available),
      'drivers_free_now', (select count(*) from public.drivers d where d.archived_at is null and d.available
                             and d.id not in (select driver_id from busy_drivers)),
      'vehicles_total', (select count(*) from public.vehicles v where v.archived_at is null and v.available),
      'vehicles_free_now', (select count(*) from public.vehicles v where v.archived_at is null and v.available
                              and v.id not in (select vehicle_id from busy_vehicles)),
      'customers_total', (select count(*) from public.customers c where c.archived_at is null)
    ),
    'status_distribution', (
      select coalesce(jsonb_agg(jsonb_build_object('status', s.status, 'count', s.n) order by s.status), '[]'::jsonb)
      from (select status, count(*) n from live group by status) s
    ),
    'upcoming', (
      select coalesce(jsonb_agg(u.row order by u.pickup_at), '[]'::jsonb)
      from (
        select l.pickup_at, jsonb_build_object(
          'id', l.id, 'order_number', l.order_number, 'display_name', l.display_name, 'status', l.status,
          'pickup_at', l.pickup_at, 'delivery_at', l.delivery_at,
          'customer_name', (select c.display_name from public.customers c where c.id = l.customer_id),
          'driver_name', (select d.display_name from public.drivers d where d.id = l.driver_id),
          'vehicle_name', (select v.display_name from public.vehicles v where v.id = l.vehicle_id)
        ) as row
        from live l
        where l.status in ('confirmed', 'scheduled') and l.pickup_at >= now()
        order by l.pickup_at
        limit 8
      ) u
    ),
    'attention', (
      select coalesce(jsonb_agg(x.row order by x.sort_at), '[]'::jsonb)
      from (
        select coalesce(l.pickup_at, l.delivery_at) as sort_at, jsonb_build_object(
          'id', l.id, 'order_number', l.order_number, 'status', l.status,
          'pickup_at', l.pickup_at, 'delivery_at', l.delivery_at,
          'customer_name', (select c.display_name from public.customers c where c.id = l.customer_id),
          'reason', case
            when l.status in ('confirmed', 'scheduled', 'in_transit') and l.delivery_at < now() then 'overdue'
            when l.status = 'confirmed' and (l.pickup_at is null or l.delivery_at is null) then 'missing_window'
            else 'unassigned_soon'
          end
        ) as row
        from live l
        where (l.status in ('confirmed', 'scheduled', 'in_transit') and l.delivery_at < now())
           or (l.status = 'confirmed' and not coalesce(l.fully_assigned, false)
               and l.pickup_at < now() + interval '48 hours')
           or (l.status = 'confirmed' and (l.pickup_at is null or l.delivery_at is null))
        order by 1 nulls last
        limit 10
      ) x
    ),
    'recent_activity', (
      select coalesce(jsonb_agg(h.row order by h.changed_at desc), '[]'::jsonb)
      from (
        select h.changed_at, jsonb_build_object(
          'order_id', h.order_id, 'order_number', o.order_number, 'from_status', h.from_status,
          'to_status', h.to_status, 'changed_at', h.changed_at, 'actor', h.changed_by_label, 'note', h.note
        ) as row
        from public.order_status_history h
        join public.orders o on o.id = h.order_id
        order by h.changed_at desc
        limit 8
      ) h
    )
  ) into v_result;
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Calendar: orders whose planned window overlaps [p_from, p_to).
-- Filters: {driver_id, vehicle_id, customer_id, status: [..], include_cancelled}
-- -----------------------------------------------------------------------------
create or replace function public.calendar_events(
  p_from timestamptz,
  p_to timestamptz,
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb);
  v_result jsonb;
begin
  perform private.require_admin();
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '93 days' then
    perform private.raise_validation(jsonb_build_object('range', 'Choose a range of at most 93 days'));
  end if;

  select coalesce(jsonb_agg(e.row order by e.starts_at, e.order_number), '[]'::jsonb) into v_result
  from (
    select coalesce(o.pickup_at, o.delivery_at) as starts_at, o.order_number,
      jsonb_build_object(
        'id', o.id,
        'order_number', o.order_number,
        'display_name', o.display_name,
        'status', o.status,
        'starts_at', coalesce(o.pickup_at, o.delivery_at),
        'ends_at', coalesce(o.delivery_at, o.pickup_at),
        'customer_id', o.customer_id,
        'customer_name', c.display_name,
        'driver_id', a.driver_id,
        'driver_name', d.display_name,
        'vehicle_id', a.vehicle_id,
        'vehicle_name', v.display_name,
        'archived', o.archived_at is not null
      ) as row
    from public.orders o
    join public.customers c on c.id = o.customer_id
    left join public.order_assignments a on a.order_id = o.id and a.released_at is null
    left join public.drivers d on d.id = a.driver_id
    left join public.vehicles v on v.id = a.vehicle_id
    where (o.pickup_at is not null or o.delivery_at is not null)
      and tstzrange(coalesce(o.pickup_at, o.delivery_at), coalesce(o.delivery_at, o.pickup_at), '[]')
          && tstzrange(p_from, p_to, '[)')
      and (coalesce((v_filters ->> 'include_cancelled')::boolean, false) or o.status <> 'cancelled')
      and (v_filters ->> 'driver_id' is null or a.driver_id = (v_filters ->> 'driver_id')::uuid)
      and (v_filters ->> 'vehicle_id' is null or a.vehicle_id = (v_filters ->> 'vehicle_id')::uuid)
      and (v_filters ->> 'customer_id' is null or o.customer_id = (v_filters ->> 'customer_id')::uuid)
      and (jsonb_array_length(coalesce(v_filters -> 'status', '[]'::jsonb)) = 0
           or o.status::text in (select jsonb_array_elements_text(v_filters -> 'status')))
    order by 1
    limit 2000
  ) e;
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Dispatch: who can take this order, and why not.
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
      select coalesce(jsonb_agg(x.row order by x.busy, x.name), '[]'::jsonb)
      from (
        select lower(d.display_name) as name, (conf.order_number is not null) as busy,
          jsonb_build_object(
            'id', d.id, 'display_name', d.display_name,
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
      select coalesce(jsonb_agg(x.row order by x.busy, x.name), '[]'::jsonb)
      from (
        select lower(v.display_name) as name, (conf.order_number is not null) as busy,
          jsonb_build_object(
            'id', v.id, 'display_name', v.display_name,
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

-- -----------------------------------------------------------------------------
-- Reports
-- Orders are dated by their pickup (or creation, when no pickup is planned),
-- as a Europe/Rome calendar day. Archived orders are included: archiving
-- hides a record from working lists, it does not remove it from history.
-- Filters: {status: [..], customer_id, driver_id, vehicle_id}
-- -----------------------------------------------------------------------------
create or replace function private.report_orders(p_from date, p_to date, p_filters jsonb)
returns setof public.orders
language sql
stable
set search_path = ''
as $$
  select o.*
  from public.orders o
  where (coalesce(o.pickup_at, o.created_at) at time zone 'Europe/Rome')::date between p_from and p_to
    and (jsonb_array_length(coalesce(p_filters -> 'status', '[]'::jsonb)) = 0
         or o.status::text in (select jsonb_array_elements_text(p_filters -> 'status')))
    and (p_filters ->> 'customer_id' is null or o.customer_id = (p_filters ->> 'customer_id')::uuid)
    and (p_filters ->> 'driver_id' is null or exists (
          select 1 from public.order_assignments a
          where a.order_id = o.id and a.driver_id = (p_filters ->> 'driver_id')::uuid and not isempty(a.period)))
    and (p_filters ->> 'vehicle_id' is null or exists (
          select 1 from public.order_assignments a
          where a.order_id = o.id and a.vehicle_id = (p_filters ->> 'vehicle_id')::uuid and not isempty(a.period)));
$$;

create or replace function private.check_report_range(p_from date, p_to date)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to < p_from then
    perform private.raise_validation(jsonb_build_object('range', 'Choose a valid date range'));
  end if;
  if p_to - p_from > 1830 then
    perform private.raise_validation(jsonb_build_object('range', 'Choose a range of at most 5 years'));
  end if;
end;
$$;

create or replace function public.report_summary(p_from date, p_to date, p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb);
  v_bucket text;
  v_range tstzrange;
  v_range_hours numeric;
  v_result jsonb;
begin
  perform private.require_admin();
  perform private.check_report_range(p_from, p_to);
  v_bucket := case when p_to - p_from <= 62 then 'day' when p_to - p_from <= 370 then 'week' else 'month' end;
  v_range := tstzrange(p_from::timestamp at time zone 'Europe/Rome', (p_to + 1)::timestamp at time zone 'Europe/Rome', '[)');
  v_range_hours := extract(epoch from upper(v_range) - lower(v_range)) / 3600;

  with ro as (
    select * from private.report_orders(p_from, p_to, v_filters)
  ),
  delivered as (
    select h.order_id, max(h.changed_at) as delivered_at
    from public.order_status_history h
    where h.to_status = 'delivered' and h.order_id in (select id from ro)
    group by h.order_id
  ),
  asg as (
    -- Every non-empty assignment of a reported order (history included).
    select a.*, extract(epoch from (upper(a.period * v_range) - lower(a.period * v_range))) / 3600 as hours
    from public.order_assignments a
    where a.order_id in (select id from ro) and not isempty(a.period)
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'bucket', v_bucket),
    'totals', jsonb_build_object(
      'orders', (select count(*) from ro),
      'delivered', (select count(*) from ro where status = 'delivered'),
      'cancelled', (select count(*) from ro where status = 'cancelled'),
      'open', (select count(*) from ro where status in ('draft', 'confirmed', 'scheduled', 'in_transit')),
      'delivered_with_deadline', (select count(*) from ro join delivered d on d.order_id = ro.id
                                  where ro.status = 'delivered' and ro.delivery_at is not null),
      'delivered_on_time', (select count(*) from ro join delivered d on d.order_id = ro.id
                            where ro.status = 'delivered' and ro.delivery_at is not null and d.delivered_at <= ro.delivery_at)
    ),
    'by_status', (
      select coalesce(jsonb_agg(jsonb_build_object('status', s.status, 'count', s.n) order by s.status), '[]'::jsonb)
      from (select status, count(*) n from ro group by status) s
    ),
    'by_period', (
      select coalesce(jsonb_agg(jsonb_build_object('period', p.period, 'orders', p.n, 'delivered', p.delivered) order by p.period), '[]'::jsonb)
      from (
        select to_char(date_trunc(v_bucket, (coalesce(ro.pickup_at, ro.created_at) at time zone 'Europe/Rome')), 'YYYY-MM-DD') as period,
          count(*) n, count(*) filter (where ro.status = 'delivered') delivered
        from ro group by 1
      ) p
    ),
    'by_customer', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'customer_id', c.id, 'name', c.display_name, 'orders', x.n, 'delivered', x.delivered,
        'cancelled', x.cancelled, 'open', x.open) order by x.n desc, lower(c.display_name)), '[]'::jsonb)
      from (
        select customer_id, count(*) n,
          count(*) filter (where status = 'delivered') delivered,
          count(*) filter (where status = 'cancelled') cancelled,
          count(*) filter (where status in ('draft', 'confirmed', 'scheduled', 'in_transit')) open
        from ro group by customer_id
      ) x
      join public.customers c on c.id = x.customer_id
    ),
    'by_driver', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'driver_id', d.id, 'name', d.display_name, 'orders', x.orders, 'delivered', x.delivered,
        'hours', round(x.hours, 1)) order by x.orders desc, lower(d.display_name)), '[]'::jsonb)
      from (
        select asg.driver_id, count(distinct asg.order_id) orders,
          count(distinct asg.order_id) filter (where ro.status = 'delivered') delivered,
          coalesce(sum(asg.hours), 0) hours
        from asg join ro on ro.id = asg.order_id
        where asg.driver_id is not null
        group by asg.driver_id
      ) x
      join public.drivers d on d.id = x.driver_id
    ),
    'by_vehicle', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'vehicle_id', v.id, 'name', v.display_name, 'orders', x.orders, 'delivered', x.delivered,
        'hours', round(x.hours, 1),
        'utilization', case when v_range_hours > 0 then round(100 * x.hours / v_range_hours, 1) else 0 end
        ) order by x.orders desc, lower(v.display_name)), '[]'::jsonb)
      from (
        select asg.vehicle_id, count(distinct asg.order_id) orders,
          count(distinct asg.order_id) filter (where ro.status = 'delivered') delivered,
          coalesce(sum(asg.hours), 0) hours
        from asg join ro on ro.id = asg.order_id
        where asg.vehicle_id is not null
        group by asg.vehicle_id
      ) x
      join public.vehicles v on v.id = x.vehicle_id
    )
  ) into v_result;
  return v_result;
end;
$$;

-- Breakdown of one reportable field. For orders the report range and filters
-- apply; for vehicles, drivers and customers the current (non-archived)
-- records are counted.
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
           select %2$s::text as key, (select r.display_name from public.%3$I r where r.id::text = %2$s::text) as label, count(*) n
           from (%1$s) t group by 1 order by 3 desc limit 25
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

revoke all on function public.dashboard_summary() from public, anon;
revoke all on function public.calendar_events(timestamptz, timestamptz, jsonb) from public, anon;
revoke all on function public.dispatch_candidates(uuid) from public, anon;
revoke all on function public.report_summary(date, date, jsonb) from public, anon;
revoke all on function public.report_field_breakdown(text, text, date, date, jsonb) from public, anon;
grant execute on function public.dashboard_summary() to authenticated;
grant execute on function public.calendar_events(timestamptz, timestamptz, jsonb) to authenticated;
grant execute on function public.dispatch_candidates(uuid) to authenticated;
grant execute on function public.report_summary(date, date, jsonb) to authenticated;
grant execute on function public.report_field_breakdown(text, text, date, date, jsonb) to authenticated;
