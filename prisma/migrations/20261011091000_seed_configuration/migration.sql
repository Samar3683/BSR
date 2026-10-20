-- =============================================================================
-- BSR admin backend — initial configuration
--
-- The four entities and a starting set of fields. This is configuration, not
-- data: no customers, drivers, vehicles or orders are created. Administrators
-- can rename, reorder, hide, disable or archive every non-system field below
-- and add their own. System fields (bound to columns) keep the dispatch,
-- calendar and integrity rules working and cannot be removed.
-- Idempotent: re-running leaves existing configuration untouched.
-- =============================================================================

insert into public.entity_configs (entity_key, display_name, plural_display_name)
values
  ('order', 'Order', 'Orders'),
  ('vehicle', 'Vehicle', 'Vehicles'),
  ('driver', 'Driver', 'Drivers'),
  ('customer', 'Customer', 'Customers')
on conflict (entity_key) do nothing;

-- Helper for the seed only.
create or replace function private.seed_field(
  p_entity text,
  p_key text,
  p_label text,
  p_type public.field_type,
  p_sort integer,
  p_props jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.field_definitions where entity_type = p_entity and field_key = p_key;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.field_definitions (
    entity_type, field_key, label, field_type, sort_order,
    description, help_text, placeholder, required,
    show_in_list, show_in_detail, show_in_create, show_in_edit,
    searchable, filterable, sortable, reportable, unique_value,
    validation_rules, relation_entity, binding_key, is_system, read_only
  ) values (
    p_entity, p_key, p_label, p_type, p_sort,
    p_props ->> 'description', p_props ->> 'help_text', p_props ->> 'placeholder',
    coalesce((p_props ->> 'required')::boolean, false),
    coalesce((p_props ->> 'show_in_list')::boolean, true),
    coalesce((p_props ->> 'show_in_detail')::boolean, true),
    coalesce((p_props ->> 'show_in_create')::boolean, true),
    coalesce((p_props ->> 'show_in_edit')::boolean, true),
    coalesce((p_props ->> 'searchable')::boolean, false),
    coalesce((p_props ->> 'filterable')::boolean, false),
    coalesce((p_props ->> 'sortable')::boolean, false),
    coalesce((p_props ->> 'reportable')::boolean, false),
    coalesce((p_props ->> 'unique_value')::boolean, false),
    coalesce(p_props -> 'validation_rules', '{}'::jsonb),
    p_props ->> 'relation_entity',
    p_props ->> 'binding_key',
    p_props ->> 'binding_key' is not null,
    coalesce((p_props ->> 'read_only')::boolean, false)
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.seed_options(p_field_id uuid, p_labels text[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_label text;
  v_i integer := 0;
begin
  if exists (select 1 from public.field_options where field_id = p_field_id) then
    return;
  end if;
  foreach v_label in array p_labels loop
    v_i := v_i + 1;
    insert into public.field_options (field_id, label, sort_order) values (p_field_id, v_label, v_i * 10);
  end loop;
end;
$$;

do $$
begin
  -- ---------------------------------------------------------------- orders
  perform private.seed_field('order', 'order_number', 'Order number', 'short_text', 10, '{
    "binding_key": "order_number", "read_only": true, "searchable": true, "sortable": true,
    "description": "Generated when the order is created (BSR-YEAR-NNNNN)."}');
  perform private.seed_field('order', 'customer', 'Customer', 'relation', 20, '{
    "binding_key": "customer_id", "relation_entity": "customer", "required": true,
    "searchable": true, "filterable": true, "sortable": true, "reportable": true}');
  perform private.seed_field('order', 'pickup_at', 'Pickup', 'datetime', 30, '{
    "binding_key": "pickup_at", "required": true, "filterable": true, "sortable": true,
    "help_text": "Start of the planned window. Dispatch reserves the driver and vehicle from here."}');
  perform private.seed_field('order', 'delivery_at', 'Delivery', 'datetime', 40, '{
    "binding_key": "delivery_at", "required": true, "filterable": true, "sortable": true,
    "help_text": "End of the planned window. Must be after the pickup."}');
  perform private.seed_options(
    private.seed_field('order', 'service', 'Service', 'single_select', 50, '{
      "filterable": true, "sortable": true, "reportable": true, "searchable": true}'),
    array['Espresso', 'Dedicato']);
  perform private.seed_field('order', 'pickup_address', 'Pickup address', 'address', 60, '{
    "required": true, "searchable": true, "show_in_list": false}');
  perform private.seed_field('order', 'delivery_address', 'Delivery address', 'address', 70, '{
    "required": true, "searchable": true, "show_in_list": false}');
  perform private.seed_field('order', 'cargo', 'Cargo', 'long_text', 80, '{
    "show_in_list": false, "placeholder": "What is being transported",
    "validation_rules": {"max_length": 2000}}');
  perform private.seed_field('order', 'weight_kg', 'Weight (kg)', 'decimal', 90, '{
    "filterable": true, "sortable": true, "reportable": true,
    "validation_rules": {"min": 0, "precision": 1}}');
  perform private.seed_field('order', 'pallets', 'Pallets', 'integer', 100, '{
    "filterable": true, "sortable": true, "reportable": true, "show_in_list": false,
    "validation_rules": {"min": 0, "max": 100}}');
  perform private.seed_field('order', 'customer_reference', 'Customer reference', 'short_text', 110, '{
    "searchable": true, "show_in_list": false, "validation_rules": {"max_length": 80}}');
  perform private.seed_field('order', 'notes', 'Internal notes', 'long_text', 120, '{
    "show_in_list": false, "validation_rules": {"max_length": 4000}}');

  -- ---------------------------------------------------------------- vehicles
  perform private.seed_field('vehicle', 'plate', 'Plate', 'short_text', 10, '{
    "required": true, "unique_value": true, "searchable": true, "sortable": true, "filterable": true,
    "placeholder": "AB123CD", "validation_rules": {"max_length": 12}}');
  perform private.seed_options(
    private.seed_field('vehicle', 'vehicle_type', 'Vehicle type', 'single_select', 20, '{
      "required": true, "filterable": true, "sortable": true, "reportable": true, "searchable": true}'),
    array['Van', 'Motrice', 'Articolato', 'Other']);
  perform private.seed_field('vehicle', 'make_model', 'Make and model', 'short_text', 30, '{
    "searchable": true, "sortable": true, "validation_rules": {"max_length": 80}}');
  perform private.seed_field('vehicle', 'payload_kg', 'Payload (kg)', 'integer', 40, '{
    "filterable": true, "sortable": true, "reportable": true, "validation_rules": {"min": 0, "max": 100000}}');
  perform private.seed_field('vehicle', 'photo', 'Photo', 'image', 50, '{
    "show_in_list": false, "validation_rules": {"max_size_mb": 10}}');
  perform private.seed_field('vehicle', 'notes', 'Notes', 'long_text', 60, '{
    "show_in_list": false, "validation_rules": {"max_length": 4000}}');

  -- ---------------------------------------------------------------- drivers
  perform private.seed_field('driver', 'full_name', 'Full name', 'short_text', 10, '{
    "required": true, "searchable": true, "sortable": true, "validation_rules": {"max_length": 120}}');
  perform private.seed_field('driver', 'phone', 'Phone', 'phone', 20, '{
    "searchable": true}');
  perform private.seed_field('driver', 'email', 'Email', 'email', 30, '{
    "searchable": true, "show_in_list": false}');
  perform private.seed_options(
    private.seed_field('driver', 'license_categories', 'License categories', 'multi_select', 40, '{
      "filterable": true, "reportable": true, "searchable": true}'),
    array['B', 'C1', 'C', 'CE']);
  perform private.seed_field('driver', 'license_expiry', 'License expiry', 'date', 50, '{
    "filterable": true, "sortable": true}');
  perform private.seed_field('driver', 'notes', 'Notes', 'long_text', 60, '{
    "show_in_list": false, "validation_rules": {"max_length": 4000}}');

  -- ---------------------------------------------------------------- customers
  perform private.seed_field('customer', 'company_name', 'Company name', 'short_text', 10, '{
    "required": true, "searchable": true, "sortable": true, "validation_rules": {"max_length": 160}}');
  perform private.seed_field('customer', 'contact_name', 'Contact person', 'short_text', 20, '{
    "searchable": true, "validation_rules": {"max_length": 120}}');
  perform private.seed_field('customer', 'phone', 'Phone', 'phone', 30, '{
    "searchable": true}');
  perform private.seed_field('customer', 'email', 'Email', 'email', 40, '{
    "searchable": true, "filterable": true}');
  perform private.seed_field('customer', 'vat_number', 'VAT number', 'short_text', 50, '{
    "searchable": true, "unique_value": true, "show_in_list": false, "validation_rules": {"max_length": 20}}');
  perform private.seed_field('customer', 'address', 'Address', 'address', 60, '{
    "searchable": true, "show_in_list": false}');
  perform private.seed_field('customer', 'notes', 'Notes', 'long_text', 70, '{
    "show_in_list": false, "validation_rules": {"max_length": 4000}}');
end;
$$;

update public.entity_configs set primary_display_field = 'order_number' where entity_key = 'order' and primary_display_field is null;
update public.entity_configs set primary_display_field = 'plate' where entity_key = 'vehicle' and primary_display_field is null;
update public.entity_configs set primary_display_field = 'full_name' where entity_key = 'driver' and primary_display_field is null;
update public.entity_configs set primary_display_field = 'company_name' where entity_key = 'customer' and primary_display_field is null;

drop function private.seed_field(text, text, text, public.field_type, integer, jsonb);
drop function private.seed_options(uuid, text[]);
