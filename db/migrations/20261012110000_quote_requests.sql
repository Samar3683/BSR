-- =============================================================================
-- BSR — quote requests and contact intents from the public site
--
--   quote_requests   what a visitor submits in the quote form. Written only by
--                    intake.submit_quote_request() (called by the web server's
--                    application role); administrators read, work on and delete them.
--                    Not part of the append-only audit log on purpose: it holds
--                    personal data that must stay erasable. Handling is recorded
--                    on the row itself (status, handled_by/at, note, order).
--   contact_events   anonymous counts of clicks on WhatsApp / phone / email
--                    links (channel + page only, no personal data).
-- =============================================================================

create schema if not exists intake;
revoke all on schema intake from public;

create sequence public.quote_request_seq;

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'discarded')),
  name text not null check (char_length(name) between 1 and 100),
  email text check (email is null or char_length(email) <= 100),
  phone text not null check (char_length(phone) between 6 and 40),
  pickup jsonb not null,
  delivery jsonb not null,
  context jsonb not null default '{}'::jsonb,
  source text not null default 'quote_form',
  note text check (note is null or char_length(note) <= 2000),
  customer_id uuid references public.customers (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name text generated always as (reference || ' · ' || name) stored
);
create index quote_requests_status_idx on public.quote_requests (status, created_at desc);

create table public.contact_events (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('whatsapp', 'phone', 'email')),
  page text not null check (page like '/%' and char_length(page) <= 200),
  created_at timestamptz not null default now()
);
create index contact_events_created_idx on public.contact_events (created_at desc);

-- ---------------------------------------------------------------- access
alter table public.quote_requests enable row level security;
alter table public.contact_events enable row level security;

revoke all on public.quote_requests, public.contact_events from anon, authenticated, service_role;
grant select, delete on public.quote_requests to authenticated;
grant update (status, note) on public.quote_requests to authenticated;
grant select on public.contact_events to authenticated;

create policy "quote requests: admins read" on public.quote_requests
  for select to authenticated using ((select private.is_active_admin()));
create policy "quote requests: admins update" on public.quote_requests
  for update to authenticated
  using ((select private.is_active_admin()))
  with check ((select private.is_active_admin()));
create policy "quote requests: admins delete" on public.quote_requests
  for delete to authenticated using ((select private.is_active_admin()));
create policy "contact events: admins read" on public.contact_events
  for select to authenticated using ((select private.is_active_admin()));

-- Who handled a request and when; converting is only possible through link_quote_request_order().
create or replace function private.quote_requests_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    if new.status = 'converted' and current_setting('bsr.converting', true) is distinct from 'on' then
      perform private.raise_rule('Use "Create order" to convert a request');
    end if;
    new.handled_by := (select auth.uid());
    new.handled_at := now();
  end if;
  return new;
end;
$$;

create trigger quote_requests_before_update
  before update on public.quote_requests
  for each row execute function private.quote_requests_before_update();

-- ---------------------------------------------------------------- intake (public site)

create or replace function intake.clean(p_value jsonb, p_key text, p_max integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(left(btrim(regexp_replace(coalesce(p_value ->> p_key, ''), '\s+', ' ', 'g')), p_max), '')
$$;

-- Validates and stores one request; returns its reference. Raises a business rule
-- error (SQLSTATE P0001, hint business_rule) for bad input.
create or replace function intake.submit_quote_request(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := intake.clean(p_payload, 'name', 100);
  v_email text := intake.clean(p_payload, 'email', 100);
  v_phone text := intake.clean(p_payload, 'phone', 40);
  v_pickup jsonb;
  v_delivery jsonb;
  v_context jsonb;
  v_ref text;
  v_kind text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then
    perform private.raise_rule('Invalid request');
  end if;
  if v_name is null then perform private.raise_rule('Name is required'); end if;
  if v_phone is null or length(regexp_replace(v_phone, '\D', '', 'g')) < 6
     or v_phone !~ '^[0-9+ ().-]+$' then
    perform private.raise_rule('A valid phone number is required');
  end if;
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    perform private.raise_rule('The email address is not valid');
  end if;

  foreach v_kind in array array['pickup', 'delivery'] loop
    if jsonb_typeof(p_payload -> v_kind) is distinct from 'object' then
      perform private.raise_rule('The ' || v_kind || ' address is required');
    end if;
    if intake.clean(p_payload -> v_kind, 'street', 100) is null
       or intake.clean(p_payload -> v_kind, 'zip', 12) is null
       or intake.clean(p_payload -> v_kind, 'city', 80) is null
       or intake.clean(p_payload -> v_kind, 'province', 40) is null then
      perform private.raise_rule('The ' || v_kind || ' address is incomplete');
    end if;
  end loop;
  v_pickup := jsonb_build_object(
    'street', intake.clean(p_payload -> 'pickup', 'street', 100),
    'zip', intake.clean(p_payload -> 'pickup', 'zip', 12),
    'city', intake.clean(p_payload -> 'pickup', 'city', 80),
    'province', intake.clean(p_payload -> 'pickup', 'province', 40));
  v_delivery := jsonb_build_object(
    'street', intake.clean(p_payload -> 'delivery', 'street', 100),
    'zip', intake.clean(p_payload -> 'delivery', 'zip', 12),
    'city', intake.clean(p_payload -> 'delivery', 'city', 80),
    'province', intake.clean(p_payload -> 'delivery', 'province', 40));
  v_context := jsonb_strip_nulls(jsonb_build_object(
    'service', intake.clean(p_payload -> 'context', 'service', 80),
    'sector', intake.clean(p_payload -> 'context', 'sector', 80),
    'vehicle', intake.clean(p_payload -> 'context', 'vehicle', 80)));

  -- Flood guard on top of the web server's per-visitor limits.
  if (select count(*) from public.quote_requests where created_at > now() - interval '1 hour') >= 300 then
    perform private.raise_rule('Too many requests right now. Try again later.');
  end if;

  v_ref := 'RQ-' || to_char(now() at time zone 'Europe/Rome', 'YYYY') || '-'
           || lpad(nextval('public.quote_request_seq')::text, 5, '0');
  insert into public.quote_requests (reference, name, email, phone, pickup, delivery, context)
  values (v_ref, v_name, v_email, v_phone, v_pickup, v_delivery, v_context);
  return v_ref;
end;
$$;

create or replace function intake.record_contact_event(p_channel text, p_page text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_channel not in ('whatsapp', 'phone', 'email') or p_page is null
     or p_page !~ '^/[A-Za-z0-9/_\-.]{0,150}$' then
    return;
  end if;
  insert into public.contact_events (channel, page) values (p_channel, p_page);
end;
$$;

revoke all on function intake.clean(jsonb, text, integer) from public;
revoke all on function intake.submit_quote_request(jsonb) from public, anon, authenticated, service_role;
revoke all on function intake.record_contact_event(text, text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- admin RPCs

-- Contact intents of the last N days, per channel.
create or replace function public.contact_event_summary(p_days integer default 30)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  perform private.require_admin();
  return coalesce((
    select jsonb_object_agg(channel, n)
    from (
      select channel, count(*) as n
      from public.contact_events
      where created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
      group by channel
    ) t
  ), '{}'::jsonb);
end;
$$;

-- Step 1 of "Create order": finds the customer with the request's email, or creates one
-- from its contact details, and attaches it to the request (which becomes "contacted").
create or replace function public.start_quote_request_order(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.quote_requests;
  v_customer uuid;
begin
  perform private.require_admin();
  select * into v_req from public.quote_requests where id = p_request_id for update;
  if not found then
    perform private.raise_rule('The request was not found');
  end if;
  if v_req.status = 'converted' then
    perform private.raise_rule('This request has already been converted');
  end if;

  v_customer := v_req.customer_id;
  if v_customer is null and v_req.email is not null then
    select c.id into v_customer from public.customers c
    where lower(c.attributes ->> 'email') = lower(v_req.email) and c.archived_at is null
    limit 1;
  end if;
  if v_customer is null then
    insert into public.customers (attributes) values (jsonb_strip_nulls(jsonb_build_object(
      'company_name', v_req.name,
      'contact_name', v_req.name,
      'phone', v_req.phone,
      'email', v_req.email,
      'address', jsonb_build_object(
        'line1', v_req.pickup ->> 'street',
        'postal_code', v_req.pickup ->> 'zip',
        'city', v_req.pickup ->> 'city',
        'province', v_req.pickup ->> 'province',
        'country', 'Italia')
    ))) returning id into v_customer;
  end if;

  update public.quote_requests
     set customer_id = v_customer,
         status = case when status = 'new' then 'contacted' else status end
   where id = v_req.id;
  return jsonb_build_object('customer_id', v_customer);
end;
$$;

-- Step 2: once the order exists, the request points to it and is converted.
create or replace function public.link_quote_request_order(p_request_id uuid, p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.quote_requests;
begin
  perform private.require_admin();
  select * into v_req from public.quote_requests where id = p_request_id for update;
  if not found then
    perform private.raise_rule('The request was not found');
  end if;
  if v_req.status = 'converted' then
    perform private.raise_rule('This request has already been converted');
  end if;
  if not exists (select 1 from public.orders where id = p_order_id) then
    perform private.raise_rule('The order was not found');
  end if;
  perform set_config('bsr.converting', 'on', true);
  update public.quote_requests set status = 'converted', order_id = p_order_id where id = p_request_id;
  perform set_config('bsr.converting', 'off', true);
end;
$$;

revoke all on function public.contact_event_summary(integer) from public, anon;
revoke all on function public.start_quote_request_order(uuid) from public, anon;
revoke all on function public.link_quote_request_order(uuid, uuid) from public, anon;

-- Sidebar counters gain the number of new requests.
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
    'in_transit', (select count(*) from public.orders o where o.archived_at is null and o.status = 'in_transit'),
    'new_requests', (select count(*) from public.quote_requests q where q.status = 'new')
  );
end;
$$;
