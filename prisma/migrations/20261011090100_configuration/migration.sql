-- =============================================================================
-- BSR admin backend — dynamic entity / field configuration
--
-- The four business entities are fixed (orders, vehicles, drivers, customers);
-- their business fields are metadata. Field values live in each record's
-- `attributes` jsonb, keyed by the field's stable `field_key`. A few fields are
-- *bound* to real columns (`binding_key`) because dispatch, the calendar and
-- integrity rules depend on them; those are system fields and cannot be removed.
-- =============================================================================

create type public.field_type as enum (
  'short_text',
  'long_text',
  'integer',
  'decimal',
  'currency',
  'percentage',
  'date',
  'time',
  'datetime',
  'email',
  'phone',
  'url',
  'boolean',
  'single_select',
  'multi_select',
  'relation',
  'address',
  'image',
  'file'
);

-- -----------------------------------------------------------------------------
-- Entity configuration
-- -----------------------------------------------------------------------------
create table public.entity_configs (
  entity_key text primary key,
  display_name text not null,
  plural_display_name text not null,
  active boolean not null default true,
  -- field_key (of this entity) whose value names a record in lists, pickers,
  -- the calendar and reports. Validated by trigger.
  primary_display_field text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint entity_configs_known_entity check (entity_key in ('order', 'vehicle', 'driver', 'customer')),
  constraint entity_configs_display_name_length check (char_length(btrim(display_name)) between 1 and 60),
  constraint entity_configs_plural_length check (char_length(btrim(plural_display_name)) between 1 and 60)
);

comment on table public.entity_configs is
  'The four configurable business entities. Rows are fixed; administrators edit names, state and the primary display field.';

-- Entity key → table name. The only place this mapping exists in SQL.
create or replace function private.entity_table(p_entity text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_entity
    when 'order' then 'orders'
    when 'vehicle' then 'vehicles'
    when 'driver' then 'drivers'
    when 'customer' then 'customers'
  end;
$$;

-- -----------------------------------------------------------------------------
-- Field definitions
-- -----------------------------------------------------------------------------
create table public.field_definitions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null references public.entity_configs (entity_key) on delete restrict,
  field_key text not null,
  label text not null,
  field_type public.field_type not null,
  description text,
  help_text text,
  placeholder text,
  required boolean not null default false,
  -- Disabled fields keep their data but leave forms and lists until re-enabled.
  active boolean not null default true,
  -- Archived fields are retired: kept for historical records only.
  archived_at timestamptz,
  sort_order integer not null default 0,
  show_in_list boolean not null default true,
  show_in_detail boolean not null default true,
  show_in_create boolean not null default true,
  show_in_edit boolean not null default true,
  searchable boolean not null default false,
  filterable boolean not null default false,
  sortable boolean not null default false,
  reportable boolean not null default false,
  unique_value boolean not null default false,
  default_value jsonb,
  validation_rules jsonb not null default '{}'::jsonb,
  relation_entity text references public.entity_configs (entity_key) on delete restrict,
  -- Column of the entity table holding the value (system fields only).
  binding_key text,
  is_system boolean not null default false,
  -- Generated values (e.g. the order number) are never edited in forms.
  read_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint field_definitions_key_unique unique (entity_type, field_key),
  constraint field_definitions_key_format check (field_key ~ '^[a-z][a-z0-9_]{1,62}$'),
  constraint field_definitions_label_length check (char_length(btrim(label)) between 1 and 120),
  constraint field_definitions_description_length check (description is null or char_length(description) <= 1000),
  constraint field_definitions_help_length check (help_text is null or char_length(help_text) <= 500),
  constraint field_definitions_placeholder_length check (placeholder is null or char_length(placeholder) <= 200),
  constraint field_definitions_relation_target check ((field_type = 'relation') = (relation_entity is not null)),
  constraint field_definitions_binding_is_system check (binding_key is null or is_system),
  constraint field_definitions_rules_object check (jsonb_typeof(validation_rules) = 'object')
);

create index field_definitions_entity_order_idx on public.field_definitions (entity_type, sort_order);

comment on column public.field_definitions.field_key is
  'Stable internal key. Labels can change freely; the key never does.';
comment on column public.field_definitions.binding_key is
  'For system fields: the entity-table column holding the value. Null for attribute-stored fields.';

-- -----------------------------------------------------------------------------
-- Dropdown options (single / multi select)
-- Records store option ids, so labels can change without touching data.
-- -----------------------------------------------------------------------------
create table public.field_options (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.field_definitions (id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  -- Archived options stay readable on existing records but cannot be chosen.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint field_options_label_length check (char_length(btrim(label)) between 1 and 120)
);

create index field_options_field_order_idx on public.field_options (field_id, sort_order);
create unique index field_options_label_unique_live
  on public.field_options (field_id, lower(btrim(label)))
  where archived_at is null;

-- -----------------------------------------------------------------------------
-- Actor / timestamp stamping for configuration tables
-- -----------------------------------------------------------------------------
create or replace function private.stamp_config_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if to_jsonb(new) ? 'updated_by' then
    new := jsonb_populate_record(new, jsonb_build_object('updated_by', (select auth.uid())));
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
    if to_jsonb(new) ? 'created_by' then
      new := jsonb_populate_record(new, jsonb_build_object('created_by', (select auth.uid())));
    end if;
  end if;
  return new;
end;
$$;

create trigger entity_configs_stamp
  before insert or update on public.entity_configs
  for each row execute function private.stamp_config_row();
create trigger field_definitions_stamp
  before insert or update on public.field_definitions
  for each row execute function private.stamp_config_row();
create trigger field_options_stamp
  before insert or update on public.field_options
  for each row execute function private.stamp_config_row();
