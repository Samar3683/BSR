-- =============================================================================
-- BSR admin backend — business entities
--
-- Each entity table holds only system columns plus `attributes` (dynamic field
-- values keyed by field_key). `display_name` is derived from the entity's
-- primary display field by trigger and is never written by clients.
-- Records are archived, not deleted, once they carry operational history.
-- =============================================================================

create type public.order_status as enum (
  'draft',
  'confirmed',
  'scheduled',
  'in_transit',
  'delivered',
  'cancelled'
);

comment on type public.order_status is
  'draft → confirmed → scheduled (driver + vehicle assigned) → in_transit → delivered; cancelled from any open state.';

-- -----------------------------------------------------------------------------
-- Customers
-- -----------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null default '',
  attributes jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint customers_attributes_object check (jsonb_typeof(attributes) = 'object')
);

-- -----------------------------------------------------------------------------
-- Drivers
-- -----------------------------------------------------------------------------
create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null default '',
  -- Dispatch only offers available, non-archived drivers.
  available boolean not null default true,
  attributes jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint drivers_attributes_object check (jsonb_typeof(attributes) = 'object')
);

-- -----------------------------------------------------------------------------
-- Vehicles
-- -----------------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null default '',
  available boolean not null default true,
  attributes jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint vehicles_attributes_object check (jsonb_typeof(attributes) = 'object')
);

-- -----------------------------------------------------------------------------
-- Orders
-- -----------------------------------------------------------------------------
create sequence public.order_number_seq as bigint start with 1;

create or replace function private.next_order_number()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select 'BSR-' || to_char(now() at time zone 'Europe/Rome', 'YYYY') || '-'
    || lpad(nextval('public.order_number_seq')::text, 5, '0');
$$;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null default private.next_order_number(),
  display_name text not null default '',
  customer_id uuid not null references public.customers (id) on delete restrict,
  status public.order_status not null default 'confirmed',
  -- The planned window. Dispatch reserves the driver and vehicle for it.
  pickup_at timestamptz,
  delivery_at timestamptz,
  attributes jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint orders_number_unique unique (order_number),
  constraint orders_attributes_object check (jsonb_typeof(attributes) = 'object'),
  constraint orders_window_order check (pickup_at is null or delivery_at is null or delivery_at > pickup_at)
);

create index orders_customer_idx on public.orders (customer_id);
create index orders_status_idx on public.orders (status);
create index orders_pickup_idx on public.orders (pickup_at);
create index orders_delivery_idx on public.orders (delivery_at);
create index orders_created_idx on public.orders (created_at desc);

-- Attribute lookups (filters, uniqueness, usage checks).
create index customers_attributes_gin on public.customers using gin (attributes);
create index drivers_attributes_gin on public.drivers using gin (attributes);
create index vehicles_attributes_gin on public.vehicles using gin (attributes);
create index orders_attributes_gin on public.orders using gin (attributes);

create index customers_display_name_idx on public.customers (lower(display_name));
create index drivers_display_name_idx on public.drivers (lower(display_name));
create index vehicles_display_name_idx on public.vehicles (lower(display_name));
