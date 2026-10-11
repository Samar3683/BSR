-- =============================================================================
-- BSR admin backend — dispatch
--
--   driver_vehicle_assignments  which driver drives which vehicle, over time
--   order_assignments           driver + vehicle reserved for an order's window
--   order_status_history        every status change, with actor and note
--
-- Conflicts are prevented by exclusion constraints (race-safe: two concurrent
-- dispatchers cannot double-book a driver or a vehicle). The RPCs check first
-- to return a useful message, and the constraint remains the final guard.
-- Released rows are kept: assignment history is never deleted.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Driver ↔ vehicle pairings
-- -----------------------------------------------------------------------------
create table public.driver_vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete restrict,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  starts_at timestamptz not null default now(),
  -- null = open-ended (the current pairing)
  ends_at timestamptz,
  released_at timestamptz,
  released_by uuid references auth.users (id) on delete set null,
  note text,
  -- The period the pairing actually covers (released early → shortened;
  -- released before it started → empty, so it never conflicts).
  period tstzrange generated always as (
    tstzrange(starts_at, greatest(starts_at, coalesce(least(released_at, ends_at), 'infinity'::timestamptz)), '[)')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint dva_window_order check (ends_at is null or ends_at > starts_at),
  constraint dva_note_length check (note is null or char_length(note) <= 500),
  constraint dva_driver_no_overlap exclude using gist (driver_id with =, period with &&),
  constraint dva_vehicle_no_overlap exclude using gist (vehicle_id with =, period with &&)
);

create index dva_driver_idx on public.driver_vehicle_assignments (driver_id, starts_at desc);
create index dva_vehicle_idx on public.driver_vehicle_assignments (vehicle_id, starts_at desc);

-- -----------------------------------------------------------------------------
-- Order assignments
-- -----------------------------------------------------------------------------
create table public.order_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  driver_id uuid references public.drivers (id) on delete restrict,
  vehicle_id uuid references public.vehicles (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  released_at timestamptz,
  released_by uuid references auth.users (id) on delete set null,
  release_reason text,
  note text,
  period tstzrange generated always as (
    tstzrange(starts_at, greatest(starts_at, least(coalesce(released_at, ends_at), ends_at)), '[)')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint oa_window_order check (ends_at > starts_at),
  constraint oa_has_resource check (driver_id is not null or vehicle_id is not null),
  constraint oa_note_length check (note is null or char_length(note) <= 500),
  constraint oa_driver_no_overlap exclude using gist (driver_id with =, period with &&),
  constraint oa_vehicle_no_overlap exclude using gist (vehicle_id with =, period with &&)
);

-- One live assignment per order.
create unique index oa_one_active_per_order on public.order_assignments (order_id) where released_at is null;
create index oa_order_idx on public.order_assignments (order_id, created_at desc);
create index oa_driver_idx on public.order_assignments (driver_id, starts_at);
create index oa_vehicle_idx on public.order_assignments (vehicle_id, starts_at);
create index oa_period_idx on public.order_assignments using gist (period);

-- -----------------------------------------------------------------------------
-- Status history
-- -----------------------------------------------------------------------------
create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users (id) on delete set null,
  changed_by_label text,
  note text
);

create index order_status_history_order_idx on public.order_status_history (order_id, changed_at desc);
create index order_status_history_to_idx on public.order_status_history (to_status, changed_at);

-- -----------------------------------------------------------------------------
-- Stamps for the assignment tables
-- -----------------------------------------------------------------------------
create or replace function private.stamp_assignment_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := (select auth.uid());
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

create trigger dva_stamp before insert or update on public.driver_vehicle_assignments
  for each row execute function private.stamp_assignment_row();
create trigger oa_stamp before insert or update on public.order_assignments
  for each row execute function private.stamp_assignment_row();

-- Assignments reference usable resources only.
create or replace function private.check_assignment_resources()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  if tg_op = 'UPDATE' and new.released_at is not null and old.released_at is null then
    return new;  -- releasing never needs available resources
  end if;
  if new.driver_id is not null and (tg_op = 'INSERT' or new.driver_id is distinct from old.driver_id) then
    select archived_at is null and available into v_ok from public.drivers where id = new.driver_id;
    if not coalesce(v_ok, false) then
      perform private.raise_rule('The driver is archived or not available for dispatch');
    end if;
  end if;
  if new.vehicle_id is not null and (tg_op = 'INSERT' or new.vehicle_id is distinct from old.vehicle_id) then
    select archived_at is null and available into v_ok from public.vehicles where id = new.vehicle_id;
    if not coalesce(v_ok, false) then
      perform private.raise_rule('The vehicle is archived or not available for dispatch');
    end if;
  end if;
  return new;
end;
$$;

create trigger dva_check_resources before insert or update on public.driver_vehicle_assignments
  for each row execute function private.check_assignment_resources();
create trigger oa_check_resources before insert or update on public.order_assignments
  for each row execute function private.check_assignment_resources();

-- -----------------------------------------------------------------------------
-- Status workflow
-- -----------------------------------------------------------------------------
create or replace function private.order_status_transition_allowed(p_from public.order_status, p_to public.order_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('draft'::public.order_status, 'confirmed'::public.order_status),
    ('draft', 'cancelled'),
    ('confirmed', 'draft'),
    ('confirmed', 'scheduled'),
    ('confirmed', 'cancelled'),
    ('scheduled', 'confirmed'),
    ('scheduled', 'in_transit'),
    ('scheduled', 'cancelled'),
    ('in_transit', 'scheduled'),
    ('in_transit', 'delivered'),
    ('in_transit', 'cancelled'),
    ('delivered', 'in_transit'),
    ('cancelled', 'confirmed')
  );
$$;

-- Validates status changes and window edits, whatever path the write takes.
create or replace function private.orders_workflow_before()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_assignment public.order_assignments;
begin
  if current_setting('bsr.recompute', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'confirmed') then
      perform private.raise_rule('New orders start as draft or confirmed');
    end if;
    return new;
  end if;

  if new.order_number is distinct from old.order_number then
    perform private.raise_rule('The order number cannot change');
  end if;

  select * into v_assignment from public.order_assignments a where a.order_id = new.id and a.released_at is null;

  if new.status is distinct from old.status then
    if not private.order_status_transition_allowed(old.status, new.status) then
      perform private.raise_rule(format('An order cannot go from %s to %s',
        replace(old.status::text, '_', ' '), replace(new.status::text, '_', ' ')));
    end if;
    if new.status in ('scheduled', 'in_transit')
       and (v_assignment.id is null or v_assignment.driver_id is null or v_assignment.vehicle_id is null) then
      perform private.raise_rule('Assign a driver and a vehicle first');
    end if;
    if new.status = 'confirmed' and old.status = 'scheduled' and v_assignment.id is not null
       and current_setting('bsr.releasing', true) is distinct from 'on' then
      perform private.raise_rule('Unassign the driver and vehicle to move the order back to confirmed');
    end if;
  end if;

  if new.archived_at is not null and old.archived_at is null then
    if new.status not in ('draft', 'delivered', 'cancelled') then
      perform private.raise_rule('Only draft, delivered or cancelled orders can be archived');
    end if;
  end if;

  if v_assignment.id is not null
     and (new.pickup_at is distinct from old.pickup_at or new.delivery_at is distinct from old.delivery_at)
     and (new.pickup_at is null or new.delivery_at is null) then
    perform private.raise_rule('A dispatched order needs both a pickup and a delivery time');
  end if;
  return new;
end;
$$;

create trigger orders_workflow_before
  before insert or update on public.orders
  for each row execute function private.orders_workflow_before();

-- After a status / window change: history, assignment side effects.
create or replace function private.orders_workflow_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.order_assignments;
  v_now timestamptz := now();
begin
  if current_setting('bsr.recompute', true) = 'on' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, changed_by_label, note)
    values (new.id, null, new.status, (select auth.uid()), private.current_actor_label(),
            nullif(current_setting('bsr.status_note', true), ''));
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, changed_by_label, note)
    values (new.id, old.status, new.status, (select auth.uid()), private.current_actor_label(),
            nullif(current_setting('bsr.status_note', true), ''));

    select * into v_assignment from public.order_assignments a where a.order_id = new.id and a.released_at is null;
    if v_assignment.id is not null then
      if new.status = 'cancelled' then
        -- Cancelling frees the driver and the vehicle.
        perform private.release_order_assignment(new.id, 'Order cancelled');
      elsif new.status = 'delivered' and v_now > v_assignment.starts_at and v_now < v_assignment.ends_at then
        -- Delivered early: the rest of the window is free again.
        update public.order_assignments set ends_at = v_now where id = v_assignment.id;
      end if;
    end if;
  end if;

  -- The reservation follows the order's window.
  if new.pickup_at is distinct from old.pickup_at or new.delivery_at is distinct from old.delivery_at then
    select * into v_assignment from public.order_assignments a where a.order_id = new.id and a.released_at is null;
    if v_assignment.id is not null then
      if v_assignment.starts_at <= v_now then
        update public.order_assignments set ends_at = greatest(new.delivery_at, starts_at + interval '1 minute')
        where id = v_assignment.id;
      else
        update public.order_assignments set starts_at = new.pickup_at, ends_at = new.delivery_at
        where id = v_assignment.id;
      end if;
    end if;
  end if;
  return null;
end;
$$;

create trigger orders_workflow_after
  after insert or update on public.orders
  for each row execute function private.orders_workflow_after();

-- Drivers / vehicles with live or upcoming work cannot be archived or made
-- unavailable silently.
create or replace function private.guard_resource_retirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_column text := case tg_table_name when 'drivers' then 'driver_id' else 'vehicle_id' end;
  v_busy boolean;
begin
  if (new.archived_at is not null and old.archived_at is null) or (not new.available and old.available) then
    execute format(
      'select exists (select 1 from public.order_assignments a join public.orders o on o.id = a.order_id
         where a.%I = $1 and a.released_at is null and a.ends_at > now()
           and o.status in (''confirmed'', ''scheduled'', ''in_transit''))', v_column)
      into v_busy using new.id;
    if v_busy then
      perform private.raise_rule('This resource has current or upcoming order assignments; reassign them first');
    end if;
  end if;
  if new.archived_at is not null and old.archived_at is null then
    -- An archived resource leaves its open pairing.
    execute format(
      'update public.driver_vehicle_assignments set released_at = now(), released_by = $2
        where %I = $1 and released_at is null and (ends_at is null or ends_at > now())', v_column)
      using new.id, (select auth.uid());
  end if;
  return new;
end;
$$;

create trigger drivers_guard_retirement before update of archived_at, available on public.drivers
  for each row execute function private.guard_resource_retirement();
create trigger vehicles_guard_retirement before update of archived_at, available on public.vehicles
  for each row execute function private.guard_resource_retirement();

-- -----------------------------------------------------------------------------
-- Dispatch RPCs (SECURITY DEFINER: the assignment tables are not writable by
-- clients; every function checks the caller first).
-- -----------------------------------------------------------------------------

-- Friendly description of the first conflicting booking, or null.
create or replace function private.find_assignment_conflict(
  p_driver_id uuid,
  p_vehicle_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_exclude_order uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  select a.driver_id, a.vehicle_id, o.order_number, lower(a.period) as s, upper(a.period) as e,
         d.display_name as driver_name, v.display_name as vehicle_name
  into v_row
  from public.order_assignments a
  join public.orders o on o.id = a.order_id
  left join public.drivers d on d.id = a.driver_id
  left join public.vehicles v on v.id = a.vehicle_id
  where a.order_id is distinct from p_exclude_order
    and a.period && tstzrange(p_from, p_to, '[)')
    and ((p_driver_id is not null and a.driver_id = p_driver_id)
         or (p_vehicle_id is not null and a.vehicle_id = p_vehicle_id))
  order by lower(a.period)
  limit 1;
  if not found then
    return null;
  end if;
  if p_driver_id is not null and v_row.driver_id = p_driver_id then
    return format('Driver %s is already assigned to order %s from %s to %s',
      v_row.driver_name, v_row.order_number,
      to_char(v_row.s at time zone 'Europe/Rome', 'DD/MM/YYYY HH24:MI'),
      to_char(v_row.e at time zone 'Europe/Rome', 'DD/MM/YYYY HH24:MI'));
  end if;
  return format('Vehicle %s is already assigned to order %s from %s to %s',
    v_row.vehicle_name, v_row.order_number,
    to_char(v_row.s at time zone 'Europe/Rome', 'DD/MM/YYYY HH24:MI'),
    to_char(v_row.e at time zone 'Europe/Rome', 'DD/MM/YYYY HH24:MI'));
end;
$$;

create or replace function private.raise_conflict(p_message text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%', p_message using errcode = 'P0001', hint = 'assignment_conflict';
end;
$$;

-- Releases an order's live assignment as of now (empty period when it had not
-- started yet). Returns the release time.
create or replace function private.release_order_assignment(p_order_id uuid, p_reason text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.order_assignments;
  v_at timestamptz;
begin
  select * into v_assignment from public.order_assignments a
  where a.order_id = p_order_id and a.released_at is null
  for update;
  if v_assignment.id is null then
    return null;
  end if;
  v_at := least(greatest(now(), v_assignment.starts_at), v_assignment.ends_at);
  update public.order_assignments
  set released_at = v_at, released_by = (select auth.uid()), release_reason = p_reason
  where id = v_assignment.id;
  return v_at;
end;
$$;

-- Assign (or reassign) a driver and/or a vehicle to an order for its window.
create or replace function public.assign_order(
  p_order_id uuid,
  p_driver_id uuid,
  p_vehicle_id uuid,
  p_note text default null
)
returns public.order_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_current public.order_assignments;
  v_start timestamptz;
  v_conflict text;
  v_result public.order_assignments;
begin
  perform private.require_admin();

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    perform private.raise_rule('Order not found');
  end if;
  if v_order.archived_at is not null then
    perform private.raise_rule('Archived orders cannot be dispatched');
  end if;
  if v_order.status = 'draft' then
    perform private.raise_rule('Confirm the order before dispatching it');
  end if;
  if v_order.status in ('delivered', 'cancelled') then
    perform private.raise_rule(format('A %s order cannot be dispatched', v_order.status));
  end if;
  if v_order.pickup_at is null or v_order.delivery_at is null then
    perform private.raise_rule('Set the pickup and delivery times before dispatching');
  end if;
  if p_driver_id is null and p_vehicle_id is null then
    perform private.raise_rule('Choose a driver, a vehicle or both');
  end if;
  if v_order.delivery_at <= now() then
    perform private.raise_rule('The order window has already ended');
  end if;
  if v_order.status = 'in_transit' and (p_driver_id is null or p_vehicle_id is null) then
    perform private.raise_rule('An order in transit needs both a driver and a vehicle');
  end if;

  select * into v_current from public.order_assignments a
  where a.order_id = p_order_id and a.released_at is null
  for update;

  if v_current.id is not null
     and v_current.driver_id is not distinct from p_driver_id
     and v_current.vehicle_id is not distinct from p_vehicle_id then
    return v_current;  -- nothing changes
  end if;

  -- A replacement takes over from now if the current one already started.
  v_start := v_order.pickup_at;
  if v_current.id is not null and v_current.starts_at < now() then
    v_start := greatest(v_order.pickup_at, now());
  end if;

  v_conflict := private.find_assignment_conflict(p_driver_id, p_vehicle_id, v_start, v_order.delivery_at, p_order_id);
  if v_conflict is not null then
    perform private.raise_conflict(v_conflict);
  end if;

  perform set_config('bsr.audit_action', case when v_current.id is null then 'assign' else 'reassign' end, true);
  if v_current.id is not null then
    perform private.release_order_assignment(p_order_id, 'Reassigned');
  end if;

  begin
    insert into public.order_assignments (order_id, driver_id, vehicle_id, starts_at, ends_at, note)
    values (p_order_id, p_driver_id, p_vehicle_id, v_start, v_order.delivery_at, nullif(btrim(coalesce(p_note, '')), ''))
    returning * into v_result;
  exception when exclusion_violation then
    perform private.raise_conflict('The driver or vehicle was just booked for an overlapping time. Refresh and try again.');
  end;
  perform set_config('bsr.audit_action', '', true);

  -- Fully assigned confirmed orders become scheduled; a partial assignment
  -- moves a scheduled order back to confirmed.
  perform set_config('bsr.status_note', 'Dispatch', true);
  if v_order.status = 'confirmed' and p_driver_id is not null and p_vehicle_id is not null then
    update public.orders set status = 'scheduled' where id = p_order_id;
  elsif v_order.status = 'scheduled' and (p_driver_id is null or p_vehicle_id is null) then
    perform set_config('bsr.releasing', 'on', true);
    update public.orders set status = 'confirmed' where id = p_order_id;
    perform set_config('bsr.releasing', 'off', true);
  end if;
  perform set_config('bsr.status_note', '', true);
  return v_result;
end;
$$;

-- Remove the driver and vehicle from an order. History is kept.
create or replace function public.unassign_order(p_order_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  perform private.require_admin();
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    perform private.raise_rule('Order not found');
  end if;
  if v_order.status = 'in_transit' then
    perform private.raise_rule('An order in transit cannot be left without a driver and vehicle; reassign it instead');
  end if;
  if v_order.status in ('delivered', 'cancelled') then
    perform private.raise_rule('Completed or cancelled orders keep their assignment history');
  end if;
  perform set_config('bsr.audit_action', 'unassign', true);
  if private.release_order_assignment(p_order_id, coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Unassigned')) is null then
    perform private.raise_rule('The order has no driver or vehicle assigned');
  end if;
  perform set_config('bsr.audit_action', '', true);
  if v_order.status = 'scheduled' then
    perform set_config('bsr.releasing', 'on', true);
    perform set_config('bsr.status_note', 'Unassigned', true);
    update public.orders set status = 'confirmed' where id = p_order_id;
    perform set_config('bsr.status_note', '', true);
    perform set_config('bsr.releasing', 'off', true);
  end if;
end;
$$;

-- Change an order's status (with an optional note recorded in the history).
create or replace function public.change_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  perform private.require_admin();
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    perform private.raise_rule('Order not found');
  end if;
  if v_order.status = p_status then
    return v_order;
  end if;
  if char_length(coalesce(p_note, '')) > 500 then
    perform private.raise_validation(jsonb_build_object('note', 'Must be at most 500 characters'));
  end if;
  perform set_config('bsr.status_note', coalesce(btrim(p_note), ''), true);
  if p_status = 'confirmed' and v_order.status = 'scheduled' then
    -- Moving back to confirmed releases the reservation.
    perform set_config('bsr.audit_action', 'unassign', true);
    perform private.release_order_assignment(p_order_id, 'Order moved back to confirmed');
    perform set_config('bsr.audit_action', '', true);
    perform set_config('bsr.releasing', 'on', true);
  end if;
  update public.orders set status = p_status where id = p_order_id returning * into v_order;
  perform set_config('bsr.releasing', 'off', true);
  perform set_config('bsr.status_note', '', true);
  return v_order;
end;
$$;

-- Pair a driver with a vehicle from a moment on (default: now, open-ended).
create or replace function public.pair_driver_vehicle(
  p_driver_id uuid,
  p_vehicle_id uuid,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_note text default null
)
returns public.driver_vehicle_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz := coalesce(p_starts_at, now());
  v_row record;
  v_result public.driver_vehicle_assignments;
begin
  perform private.require_admin();
  if p_ends_at is not null and p_ends_at <= v_start then
    perform private.raise_validation(jsonb_build_object('ends_at', 'Must be after the start'));
  end if;

  select a.*, d.display_name as driver_name, v.display_name as vehicle_name into v_row
  from public.driver_vehicle_assignments a
  join public.drivers d on d.id = a.driver_id
  join public.vehicles v on v.id = a.vehicle_id
  where (a.driver_id = p_driver_id or a.vehicle_id = p_vehicle_id)
    and a.period && tstzrange(v_start, coalesce(p_ends_at, 'infinity'::timestamptz), '[)')
  order by lower(a.period)
  limit 1;
  if found then
    if v_row.driver_id = p_driver_id then
      perform private.raise_conflict(format('Driver %s is already paired with vehicle %s in this period; end that pairing first',
        v_row.driver_name, v_row.vehicle_name));
    end if;
    perform private.raise_conflict(format('Vehicle %s is already paired with driver %s in this period; end that pairing first',
      v_row.vehicle_name, v_row.driver_name));
  end if;

  begin
    insert into public.driver_vehicle_assignments (driver_id, vehicle_id, starts_at, ends_at, note)
    values (p_driver_id, p_vehicle_id, v_start, p_ends_at, nullif(btrim(coalesce(p_note, '')), ''))
    returning * into v_result;
  exception when exclusion_violation then
    perform private.raise_conflict('The driver or vehicle was just paired for an overlapping period. Refresh and try again.');
  end;
  return v_result;
end;
$$;

-- End a pairing now (or cancel it if it had not started). History is kept.
create or replace function public.end_driver_vehicle_pairing(p_assignment_id uuid)
returns public.driver_vehicle_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.driver_vehicle_assignments;
begin
  perform private.require_admin();
  select * into v_row from public.driver_vehicle_assignments where id = p_assignment_id for update;
  if v_row.id is null then
    perform private.raise_rule('Pairing not found');
  end if;
  if v_row.released_at is not null or (v_row.ends_at is not null and v_row.ends_at <= now()) then
    perform private.raise_rule('This pairing has already ended');
  end if;
  update public.driver_vehicle_assignments
  set released_at = greatest(now(), starts_at), released_by = (select auth.uid())
  where id = p_assignment_id
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.assign_order(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.unassign_order(uuid, text) from public, anon;
revoke all on function public.change_order_status(uuid, public.order_status, text) from public, anon;
revoke all on function public.pair_driver_vehicle(uuid, uuid, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.end_driver_vehicle_pairing(uuid) from public, anon;
grant execute on function public.assign_order(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.unassign_order(uuid, text) to authenticated;
grant execute on function public.change_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.pair_driver_vehicle(uuid, uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.end_driver_vehicle_pairing(uuid) to authenticated;
revoke all on function private.find_assignment_conflict(uuid, uuid, timestamptz, timestamptz, uuid) from public;
revoke all on function private.release_order_assignment(uuid, text) from public;
