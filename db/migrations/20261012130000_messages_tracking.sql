-- =============================================================================
-- BSR — contact messages, conversations and tracking
--
--   messages        what a visitor writes in the "send us a message" form
--   thread_entries  the conversation under a quote request or a message:
--                   follow-ups from the visitor ('in') and replies from the team ('out')
--   tracking        a visitor looks up a request or a message with its code
--                   (intake.track) and can add a follow-up (intake.add_visitor_message)
--
-- A tracking code is the reference with a random suffix, e.g. RQ-2026-00042-K7F3QX:
-- long enough that it cannot be guessed, short enough to copy. It is the visitor's only
-- key, so lookups are rate limited by the web server and return nothing about anyone else.
-- Everything here holds personal data and stays outside the append-only audit log.
-- =============================================================================

-- ---------------------------------------------------------------- random code
create or replace function private.random_code(p_length integer)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(p_length);
  v_code text := '';
  i integer;
begin
  for i in 0 .. p_length - 1 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

-- Appends the random suffix to every new reference.
create or replace function private.reference_with_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.reference := new.reference || '-' || private.random_code(6);
  return new;
end;
$$;

create trigger quote_requests_reference_code
  before insert on public.quote_requests
  for each row execute function private.reference_with_code();

alter table public.quote_requests add column needs_reply boolean not null default true;

-- ---------------------------------------------------------------- messages
create sequence public.message_seq;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status text not null default 'new' check (status in ('new', 'answered', 'closed')),
  needs_reply boolean not null default true,
  name text not null check (char_length(name) between 1 and 100),
  email text check (email is null or char_length(email) <= 100),
  phone text check (phone is null or char_length(phone) between 6 and 40),
  subject text check (subject is null or char_length(subject) <= 120),
  body text not null check (char_length(body) between 5 and 2000),
  note text check (note is null or char_length(note) <= 2000),
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name text generated always as (reference || ' · ' || name) stored,
  check (email is not null or phone is not null)
);
create index messages_status_idx on public.messages (status, created_at desc);

create trigger messages_reference_code
  before insert on public.messages
  for each row execute function private.reference_with_code();

create table public.thread_entries (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid references public.quote_requests (id) on delete cascade,
  message_id uuid references public.messages (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  body text not null check (char_length(body) between 1 and 2000),
  author_id uuid references auth.users (id) on delete set null,
  emailed boolean not null default false,
  created_at timestamptz not null default now(),
  check (num_nonnulls(quote_request_id, message_id) = 1)
);
create index thread_entries_request_idx on public.thread_entries (quote_request_id, created_at);
create index thread_entries_message_idx on public.thread_entries (message_id, created_at);

-- ---------------------------------------------------------------- access
alter table public.messages enable row level security;
alter table public.thread_entries enable row level security;

revoke all on public.messages, public.thread_entries from anon, authenticated, service_role;
revoke all on sequence public.message_seq from anon, authenticated, service_role;
grant select, delete on public.messages to authenticated;
grant update (status, note) on public.messages to authenticated;
grant select on public.thread_entries to authenticated;

create policy "messages: admins read" on public.messages
  for select to authenticated using ((select private.is_active_admin()));
create policy "messages: admins update" on public.messages
  for update to authenticated
  using ((select private.is_active_admin()))
  with check ((select private.is_active_admin()));
create policy "messages: admins delete" on public.messages
  for delete to authenticated using ((select private.is_active_admin()));
create policy "thread entries: admins read" on public.thread_entries
  for select to authenticated using ((select private.is_active_admin()));

create or replace function private.messages_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.handled_by := (select auth.uid());
    new.handled_at := now();
    if new.status in ('answered', 'closed') then new.needs_reply := false; end if;
  end if;
  return new;
end;
$$;

create trigger messages_before_update
  before update on public.messages
  for each row execute function private.messages_before_update();

-- A request leaves "waiting for a reply" when the team handles it.
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
    if new.status in ('contacted', 'converted', 'discarded') then new.needs_reply := false; end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------- intake: contact form

create or replace function intake.submit_message(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := intake.clean(p_payload, 'name', 100);
  v_email text := intake.clean(p_payload, 'email', 100);
  v_phone text := intake.clean(p_payload, 'phone', 40);
  v_subject text := intake.clean(p_payload, 'subject', 120);
  v_body text := nullif(btrim(left(coalesce(p_payload ->> 'message', ''), 2000)), '');
  v_ref text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then
    perform private.raise_rule('Invalid request');
  end if;
  if v_name is null then perform private.raise_rule('Name is required'); end if;
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    perform private.raise_rule('The email address is not valid');
  end if;
  if v_phone is not null and (length(regexp_replace(v_phone, '\D', '', 'g')) < 6 or v_phone !~ '^[0-9+ ().-]+$') then
    perform private.raise_rule('The phone number is not valid');
  end if;
  if v_email is null and v_phone is null then
    perform private.raise_rule('An email address or a phone number is required');
  end if;
  if v_body is null or char_length(v_body) < 5 then
    perform private.raise_rule('The message is too short');
  end if;
  if (select count(*) from public.messages where created_at > now() - interval '1 hour') >= 300 then
    perform private.raise_rule('Too many requests right now. Try again later.');
  end if;

  v_ref := 'MS-' || to_char(now() at time zone 'Europe/Rome', 'YYYY') || '-'
           || lpad(nextval('public.message_seq')::text, 5, '0');
  insert into public.messages (reference, name, email, phone, subject, body)
  values (v_ref, v_name, v_email, v_phone, v_subject, v_body)
  returning reference into v_ref;
  return v_ref;
end;
$$;

-- ---------------------------------------------------------------- intake: tracking

create or replace function intake.normalize_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9-]', '', 'g'))
$$;

-- What a visitor may see about their request or message: its status, the conversation
-- and, for a converted request, how the order is going. Never names, phones or emails.
create or replace function intake.track(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := intake.normalize_code(p_code);
  v_req public.quote_requests;
  v_msg public.messages;
  v_order public.orders;
  v_entries jsonb;
  v_order_json jsonb;
begin
  if length(v_code) < 12 then
    return null;
  end if;

  select * into v_req from public.quote_requests where reference = v_code;
  if found then
    select coalesce(jsonb_agg(jsonb_build_object('direction', e.direction, 'body', e.body, 'at', e.created_at)
                              order by e.created_at), '[]'::jsonb)
      into v_entries from public.thread_entries e where e.quote_request_id = v_req.id;
    if v_req.order_id is not null then
      select * into v_order from public.orders where id = v_req.order_id;
      if found then
        v_order_json := jsonb_build_object(
          'order_number', v_order.order_number,
          'status', v_order.status,
          'pickup_at', v_order.pickup_at,
          'delivery_at', v_order.delivery_at,
          'history', (select coalesce(jsonb_agg(jsonb_build_object('status', h.to_status, 'at', h.changed_at)
                                                order by h.changed_at, h.id), '[]'::jsonb)
                      from public.order_status_history h where h.order_id = v_order.id));
      end if;
    end if;
    return jsonb_build_object(
      'kind', 'quote',
      'reference', v_req.reference,
      'status', v_req.status,
      'received_at', v_req.created_at,
      'route', jsonb_build_object('from', v_req.pickup ->> 'city', 'to', v_req.delivery ->> 'city'),
      'entries', v_entries,
      'order', v_order_json);
  end if;

  select * into v_msg from public.messages where reference = v_code;
  if found then
    select coalesce(jsonb_agg(jsonb_build_object('direction', e.direction, 'body', e.body, 'at', e.created_at)
                              order by e.created_at), '[]'::jsonb)
      into v_entries from public.thread_entries e where e.message_id = v_msg.id;
    return jsonb_build_object(
      'kind', 'message',
      'reference', v_msg.reference,
      'status', v_msg.status,
      'received_at', v_msg.created_at,
      'subject', v_msg.subject,
      'first_message', v_msg.body,
      'entries', v_entries);
  end if;
  return null;
end;
$$;

-- A follow-up from the visitor: it re-opens the conversation for the team.
create or replace function intake.add_visitor_message(p_code text, p_body text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := intake.normalize_code(p_code);
  v_body text := nullif(btrim(left(coalesce(p_body, ''), 2000)), '');
  v_req_id uuid;
  v_msg_id uuid;
begin
  if v_body is null then
    perform private.raise_rule('The message is empty');
  end if;
  if length(v_code) < 12 then
    return false;
  end if;
  select id into v_req_id from public.quote_requests where reference = v_code;
  if found then
    insert into public.thread_entries (quote_request_id, direction, body) values (v_req_id, 'in', v_body);
    update public.quote_requests
       set needs_reply = true,
           status = case when status in ('contacted', 'discarded') then 'new' else status end
     where id = v_req_id;
    return true;
  end if;
  select id into v_msg_id from public.messages where reference = v_code;
  if found then
    insert into public.thread_entries (message_id, direction, body) values (v_msg_id, 'in', v_body);
    update public.messages set needs_reply = true, status = 'new' where id = v_msg_id;
    return true;
  end if;
  return false;
end;
$$;

revoke all on function intake.submit_message(jsonb), intake.track(text), intake.add_visitor_message(text, text),
  intake.normalize_code(text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- admin: reply

-- Records the team's reply (the server then emails it, when the visitor left an address).
create or replace function public.reply_to_thread(p_kind text, p_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text := nullif(btrim(left(coalesce(p_body, ''), 2000)), '');
  v_entry uuid;
  v_email text;
  v_name text;
  v_reference text;
begin
  perform private.require_admin();
  if v_body is null then
    perform private.raise_rule('Write a reply first');
  end if;
  if p_kind = 'quote' then
    select q.email, q.name, q.reference into v_email, v_name, v_reference
      from public.quote_requests q where q.id = p_id for update;
    if not found then perform private.raise_rule('The request was not found'); end if;
    insert into public.thread_entries (quote_request_id, direction, body, author_id)
      values (p_id, 'out', v_body, (select auth.uid())) returning id into v_entry;
    update public.quote_requests
       set needs_reply = false,
           status = case when status = 'new' then 'contacted' else status end
     where id = p_id;
  elsif p_kind = 'message' then
    select m.email, m.name, m.reference into v_email, v_name, v_reference
      from public.messages m where m.id = p_id for update;
    if not found then perform private.raise_rule('The message was not found'); end if;
    insert into public.thread_entries (message_id, direction, body, author_id)
      values (p_id, 'out', v_body, (select auth.uid())) returning id into v_entry;
    update public.messages set status = 'answered', needs_reply = false where id = p_id;
  else
    perform private.raise_rule('Unknown conversation');
  end if;
  return jsonb_build_object('entry_id', v_entry, 'email', v_email, 'name', v_name, 'reference', v_reference);
end;
$$;

create or replace function public.mark_thread_entry_emailed(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  update public.thread_entries set emailed = true where id = p_entry_id;
end;
$$;

revoke all on function public.reply_to_thread(text, uuid, text), public.mark_thread_entry_emailed(uuid)
  from public, anon;

-- ---------------------------------------------------------------- counters and live updates

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
    'new_requests', (select count(*) from public.quote_requests q where q.needs_reply and q.status <> 'discarded'),
    'new_messages', (select count(*) from public.messages m where m.needs_reply and m.status <> 'closed')
  );
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['messages', 'thread_entries'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each statement execute function private.notify_change()',
      t || '_notify', t);
  end loop;
end $$;
