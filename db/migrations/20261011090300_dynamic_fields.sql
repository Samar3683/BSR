-- =============================================================================
-- BSR admin backend — dynamic field engine
--
-- Everything the admin panel validates is validated again here, at the
-- database boundary, from the stored field definitions (never from metadata
-- sent by the client):
--   * entity writes: unknown / archived / hidden fields, types, rules, options,
--     relations, files, required and unique values;
--   * definition writes: keys, types, capabilities, rules, defaults, system
--     field protection, safe type changes;
--   * option writes: owning field type, deletion only while unused.
-- Validation failures raise SQLSTATE P0001 with hint 'validation_failed' and a
-- JSON object {field_key: message} in DETAIL, which the client maps to fields.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Small helpers
-- -----------------------------------------------------------------------------

create or replace function private.raise_validation(p_errors jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Validation failed'
    using errcode = 'P0001', detail = p_errors::text, hint = 'validation_failed';
end;
$$;

create or replace function private.raise_rule(p_message text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%', p_message using errcode = 'P0001', hint = 'business_rule';
end;
$$;

-- Empty means: SQL null, JSON null, blank string, empty array or object, or an
-- object whose values are all empty (an untouched address).
create or replace function private.field_value_is_empty(p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null then true
    when jsonb_typeof(p_value) = 'null' then true
    when jsonb_typeof(p_value) = 'string' then btrim(p_value #>> '{}') = ''
    when jsonb_typeof(p_value) = 'array' then jsonb_array_length(p_value) = 0
    when jsonb_typeof(p_value) = 'object' then not exists (
      select 1 from jsonb_each(p_value) e
      where not (jsonb_typeof(e.value) = 'null' or (jsonb_typeof(e.value) = 'string' and btrim(e.value #>> '{}') = ''))
    )
    else false
  end;
$$;

create or replace function private.is_uuid(p_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

-- 'missing' | 'archived' | 'active' for a record of an entity.
create or replace function private.record_state(p_entity text, p_id uuid)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_archived timestamptz;
  v_found boolean;
begin
  execute format('select true, archived_at from public.%I where id = $1', private.entity_table(p_entity))
    into v_found, v_archived
    using p_id;
  if v_found is null then
    return 'missing';
  end if;
  return case when v_archived is null then 'active' else 'archived' end;
end;
$$;

-- Storage metadata for an uploaded object. Size and type come from Storage,
-- never from the client. present = null when Storage is not installed (the flag is
-- not named "found": that is PL/pgSQL's FOUND variable). Runs as
-- the caller, so the administrators' storage policy decides visibility.
create or replace function private.storage_object_meta(
  p_bucket text,
  p_path text,
  out present boolean,
  out size_bytes bigint,
  out mime_type text
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if to_regclass('storage.objects') is null then
    present := null;
    return;
  end if;
  execute
    'select true, nullif(metadata ->> ''size'', '''')::bigint, metadata ->> ''mimetype''
       from storage.objects where bucket_id = $1 and name = $2'
    into present, size_bytes, mime_type
    using p_bucket, p_path;
  present := coalesce(present, false);
end;
$$;

revoke all on function private.storage_object_meta(text, text) from public;
grant execute on function private.storage_object_meta(text, text) to authenticated, service_role;

-- Default rules applied when a definition does not set them.
create or replace function private.default_allowed_types(p_type public.field_type)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_type
    when 'image' then '["image/jpeg","image/png","image/webp","image/gif"]'::jsonb
    else '["application/pdf","image/jpeg","image/png","image/webp","text/plain","text/csv",
           "application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document",
           "application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]'::jsonb
  end;
$$;

-- -----------------------------------------------------------------------------
-- Value validation + normalisation for one field.
-- Returns the normalised value (null = empty) or an error message.
-- p_old is the stored value: archived options / records stay valid only when
-- the value did not change.
-- -----------------------------------------------------------------------------
create or replace function private.check_field_value(
  p_def public.field_definitions,
  p_value jsonb,
  p_old jsonb,
  out value jsonb,
  out error text
)
language plpgsql
stable
set search_path = ''
as $$
declare
  r jsonb := coalesce(p_def.validation_rules, '{}'::jsonb);
  t text;
  n numeric;
  v_prec int;
  v_min numeric;
  v_max numeric;
  d date;
  ts timestamptz;
  tm time;
  v_len int;
  v_items jsonb;
  v_item text;
  v_count int;
  v_archived timestamptz;
  v_found boolean;
  v_state text;
  v_part text;
  v_obj jsonb;
  v_path text;
  v_meta record;
  v_size numeric;
  v_mime text;
  v_allowed jsonb;
begin
  value := null;
  error := null;
  if private.field_value_is_empty(p_value) then
    return;
  end if;

  case p_def.field_type
  -- ---------------------------------------------------------------- text
  when 'short_text', 'long_text' then
    if jsonb_typeof(p_value) not in ('string', 'number') then
      error := 'Must be text';
      return;
    end if;
    t := btrim(p_value #>> '{}');
    v_len := coalesce((r ->> 'max_length')::int, case when p_def.field_type = 'short_text' then 255 else 10000 end);
    if char_length(t) > v_len then
      error := format('Must be at most %s characters', v_len);
      return;
    end if;
    if char_length(t) < coalesce((r ->> 'min_length')::int, 0) then
      error := format('Must be at least %s characters', r ->> 'min_length');
      return;
    end if;
    if nullif(r ->> 'pattern', '') is not null and t !~ (r ->> 'pattern') then
      error := coalesce(nullif(r ->> 'pattern_message', ''), 'Has an invalid format');
      return;
    end if;
    value := to_jsonb(t);

  -- ---------------------------------------------------------------- numbers
  when 'integer', 'decimal', 'currency', 'percentage' then
    if jsonb_typeof(p_value) = 'number' then
      n := (p_value #>> '{}')::numeric;
    elsif jsonb_typeof(p_value) = 'string' and btrim(p_value #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then
      n := btrim(p_value #>> '{}')::numeric;
    else
      error := 'Must be a number';
      return;
    end if;
    if abs(n) >= 1e15 then
      error := 'Is too large';
      return;
    end if;
    if p_def.field_type = 'integer' then
      if n <> trunc(n) then
        error := 'Must be a whole number';
        return;
      end if;
    else
      v_prec := coalesce((r ->> 'precision')::int, case p_def.field_type when 'decimal' then 4 else 2 end);
      if scale(trim_scale(n)) > v_prec then
        error := format('Use at most %s decimal places', v_prec);
        return;
      end if;
    end if;
    v_min := coalesce((r ->> 'min')::numeric, case when p_def.field_type = 'percentage' then 0 end);
    v_max := coalesce((r ->> 'max')::numeric, case when p_def.field_type = 'percentage' then 100 end);
    if v_min is not null and n < v_min then
      error := format('Must be at least %s', v_min);
      return;
    end if;
    if v_max is not null and n > v_max then
      error := format('Must be at most %s', v_max);
      return;
    end if;
    value := to_jsonb(trim_scale(n));

  -- ---------------------------------------------------------------- date / time
  when 'date' then
    t := btrim(p_value #>> '{}');
    if jsonb_typeof(p_value) <> 'string' or t !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      error := 'Must be a date (YYYY-MM-DD)';
      return;
    end if;
    begin
      d := t::date;
    exception when others then
      error := 'Is not a valid date';
      return;
    end;
    if r ? 'min_date' and d < (r ->> 'min_date')::date then
      error := format('Must be on or after %s', r ->> 'min_date');
      return;
    end if;
    if r ? 'max_date' and d > (r ->> 'max_date')::date then
      error := format('Must be on or before %s', r ->> 'max_date');
      return;
    end if;
    value := to_jsonb(to_char(d, 'YYYY-MM-DD'));

  when 'time' then
    t := btrim(p_value #>> '{}');
    if jsonb_typeof(p_value) <> 'string' or t !~ '^[0-9]{2}:[0-9]{2}(:[0-9]{2})?$' then
      error := 'Must be a time (HH:MM)';
      return;
    end if;
    begin
      tm := t::time;
    exception when others then
      error := 'Is not a valid time';
      return;
    end;
    if r ? 'min_time' and tm < (r ->> 'min_time')::time then
      error := format('Must be at or after %s', r ->> 'min_time');
      return;
    end if;
    if r ? 'max_time' and tm > (r ->> 'max_time')::time then
      error := format('Must be at or before %s', r ->> 'max_time');
      return;
    end if;
    value := to_jsonb(to_char(tm, 'HH24:MI'));

  when 'datetime' then
    t := btrim(p_value #>> '{}');
    if jsonb_typeof(p_value) <> 'string' or t !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}' then
      error := 'Must be a date and time';
      return;
    end if;
    begin
      ts := t::timestamptz;
    exception when others then
      error := 'Is not a valid date and time';
      return;
    end;
    if r ? 'min_date' and ts < (r ->> 'min_date')::date then
      error := format('Must be on or after %s', r ->> 'min_date');
      return;
    end if;
    if r ? 'max_date' and ts >= (r ->> 'max_date')::date + 1 then
      error := format('Must be on or before %s', r ->> 'max_date');
      return;
    end if;
    value := to_jsonb(to_char(ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));

  -- ---------------------------------------------------------------- contact
  when 'email' then
    t := lower(btrim(p_value #>> '{}'));
    if jsonb_typeof(p_value) <> 'string' or char_length(t) > coalesce((r ->> 'max_length')::int, 254)
       or t !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      error := 'Must be a valid email address';
      return;
    end if;
    value := to_jsonb(t);

  when 'phone' then
    t := regexp_replace(btrim(p_value #>> '{}'), '\s+', ' ', 'g');
    if jsonb_typeof(p_value) not in ('string', 'number') or t !~ '^\+?[0-9 ()./-]+$'
       or char_length(regexp_replace(t, '[^0-9]', '', 'g')) not between 6 and 15 then
      error := 'Must be a valid phone number';
      return;
    end if;
    if char_length(t) > coalesce((r ->> 'max_length')::int, 32) then
      error := 'Is too long';
      return;
    end if;
    value := to_jsonb(t);

  when 'url' then
    t := btrim(p_value #>> '{}');
    if jsonb_typeof(p_value) <> 'string' or char_length(t) > coalesce((r ->> 'max_length')::int, 2048)
       or t !~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$' then
      error := 'Must be a valid URL (http:// or https://)';
      return;
    end if;
    value := to_jsonb(t);

  -- ---------------------------------------------------------------- boolean
  when 'boolean' then
    if jsonb_typeof(p_value) = 'boolean' then
      value := p_value;
    elsif jsonb_typeof(p_value) = 'string' and lower(p_value #>> '{}') in ('true', 'false') then
      value := to_jsonb(lower(p_value #>> '{}') = 'true');
    else
      error := 'Must be yes or no';
    end if;

  -- ---------------------------------------------------------------- options
  when 'single_select' then
    t := p_value #>> '{}';
    if jsonb_typeof(p_value) <> 'string' or not private.is_uuid(t) then
      error := 'Is not a valid option';
      return;
    end if;
    select true, o.archived_at into v_found, v_archived
    from public.field_options o
    where o.id = t::uuid and o.field_id = p_def.id;
    if v_found is null then
      error := 'Is not a valid option';
      return;
    end if;
    if v_archived is not null and p_value is distinct from p_old then
      error := 'This option is archived and can no longer be selected';
      return;
    end if;
    value := to_jsonb(t);

  when 'multi_select' then
    if jsonb_typeof(p_value) <> 'array' then
      error := 'Must be a list of options';
      return;
    end if;
    v_items := '[]'::jsonb;
    for v_item in select jsonb_array_elements_text(p_value) loop
      if not private.is_uuid(v_item) then
        error := 'Contains an invalid option';
        return;
      end if;
      v_found := null;
      v_archived := null;
      select true, o.archived_at into v_found, v_archived
      from public.field_options o
      where o.id = v_item::uuid and o.field_id = p_def.id;
      if v_found is null then
        error := 'Contains an invalid option';
        return;
      end if;
      if v_archived is not null and not (coalesce(p_old, '[]'::jsonb) ? v_item) then
        error := 'Contains an archived option';
        return;
      end if;
      if not v_items ? v_item then
        v_items := v_items || to_jsonb(v_item);
      end if;
    end loop;
    v_count := jsonb_array_length(v_items);
    if r ? 'min_items' and v_count < (r ->> 'min_items')::int then
      error := format('Select at least %s', r ->> 'min_items');
      return;
    end if;
    if r ? 'max_items' and v_count > (r ->> 'max_items')::int then
      error := format('Select at most %s', r ->> 'max_items');
      return;
    end if;
    value := v_items;

  -- ---------------------------------------------------------------- relation
  when 'relation' then
    t := p_value #>> '{}';
    if jsonb_typeof(p_value) <> 'string' or not private.is_uuid(t) then
      error := 'Is not a valid record';
      return;
    end if;
    v_state := private.record_state(p_def.relation_entity, t::uuid);
    if v_state = 'missing' then
      error := 'The selected record does not exist';
      return;
    end if;
    if v_state = 'archived' and p_value is distinct from p_old then
      error := 'Archived records cannot be selected';
      return;
    end if;
    value := to_jsonb(t);

  -- ---------------------------------------------------------------- address
  when 'address' then
    if jsonb_typeof(p_value) <> 'object' then
      error := 'Must be an address';
      return;
    end if;
    v_obj := '{}'::jsonb;
    for v_part, t in select e.key, btrim(e.value #>> '{}') from jsonb_each(p_value) e loop
      if v_part not in ('line1', 'line2', 'postal_code', 'city', 'province', 'country') then
        error := format('Unknown address part "%s"', v_part);
        return;
      end if;
      if t is not null and t <> '' then
        if char_length(t) > 200 then
          error := 'An address part is too long';
          return;
        end if;
        v_obj := v_obj || jsonb_build_object(v_part, t);
      end if;
    end loop;
    for v_part in select jsonb_array_elements_text(coalesce(r -> 'required_parts', '["line1","city"]'::jsonb)) loop
      if not v_obj ? v_part then
        error := format('Address: %s is required', replace(v_part, '_', ' '));
        return;
      end if;
    end loop;
    value := v_obj;

  -- ---------------------------------------------------------------- files
  when 'image', 'file' then
    if jsonb_typeof(p_value) <> 'object' or jsonb_typeof(p_value -> 'path') <> 'string' then
      error := 'Must be an uploaded file';
      return;
    end if;
    v_path := p_value ->> 'path';
    -- Unchanged files are not re-checked (rules may have tightened since).
    if p_old is not null and (p_old ->> 'path') = v_path then
      value := p_old;
      return;
    end if;
    if v_path !~ ('^' || p_def.entity_type || '/' || p_def.field_key || '/[A-Za-z0-9._-]+$') or v_path ~ '\.\.' then
      error := 'The file was not uploaded for this field';
      return;
    end if;
    select * into v_meta from private.storage_object_meta('entity-files', v_path);
    if v_meta.present is false then
      error := 'The uploaded file was not found';
      return;
    end if;
    v_size := v_meta.size_bytes;
    v_mime := lower(coalesce(v_meta.mime_type, ''));
    v_allowed := coalesce(r -> 'allowed_types', private.default_allowed_types(p_def.field_type));
    if v_meta.present and not exists (
      select 1 from jsonb_array_elements_text(v_allowed) a
      where a = v_mime or (a like '%/*' and v_mime like replace(a, '*', '%'))
    ) then
      error := 'This file type is not allowed';
      return;
    end if;
    if v_meta.present and v_size > coalesce((r ->> 'max_size_mb')::numeric, case when p_def.field_type = 'image' then 10 else 25 end) * 1024 * 1024 then
      error := format('The file is larger than %s MB', coalesce(r ->> 'max_size_mb', case when p_def.field_type = 'image' then '10' else '25' end));
      return;
    end if;
    value := jsonb_build_object(
      'path', v_path,
      'name', left(coalesce(nullif(btrim(p_value ->> 'name'), ''), regexp_replace(v_path, '^.*/', '')), 255),
      'size', v_size,
      'mime_type', nullif(v_mime, '')
    );
  end case;
end;
$$;

-- Text form of a value (display names, search, CSV on the server side).
create or replace function private.field_value_text(p_def public.field_definitions, p_value jsonb)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_text text;
begin
  if private.field_value_is_empty(p_value) then
    return null;
  end if;
  case p_def.field_type
  when 'single_select' then
    select o.label into v_text from public.field_options o where o.id::text = p_value #>> '{}';
  when 'multi_select' then
    select string_agg(o.label, ', ' order by o.sort_order) into v_text
    from public.field_options o
    where o.field_id = p_def.id and p_value ? o.id::text;
  when 'relation' then
    if private.is_uuid(p_value #>> '{}') then
      execute format('select display_name from public.%I where id = $1', private.entity_table(p_def.relation_entity))
        into v_text using (p_value #>> '{}')::uuid;
    end if;
  when 'boolean' then
    v_text := case when (p_value #>> '{}')::boolean then 'Yes' else 'No' end;
  when 'address' then
    select string_agg(p_value ->> k, ', ') into v_text
    from unnest(array['line1', 'line2', 'postal_code', 'city', 'province', 'country']) k
    where nullif(p_value ->> k, '') is not null;
  when 'image', 'file' then
    v_text := p_value ->> 'name';
  else
    v_text := p_value #>> '{}';
  end case;
  return v_text;
end;
$$;

-- Value of a field on a row (as jsonb), bound or attribute-stored.
create or replace function private.row_field_value(p_def public.field_definitions, p_row jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_def.binding_key is not null then p_row -> p_def.binding_key
    else p_row -> 'attributes' -> p_def.field_key
  end;
$$;

create or replace function private.compute_display_name(p_entity text, p_row jsonb)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_field text;
  v_def public.field_definitions;
  v_text text;
begin
  select c.primary_display_field into v_field from public.entity_configs c where c.entity_key = p_entity;
  if v_field is not null then
    select * into v_def from public.field_definitions f where f.entity_type = p_entity and f.field_key = v_field;
    if found then
      v_text := private.field_value_text(v_def, private.row_field_value(v_def, p_row));
    end if;
  end if;
  v_text := nullif(btrim(coalesce(v_text, '')), '');
  if v_text is null then
    v_text := case
      when p_entity = 'order' then p_row ->> 'order_number'
      else 'Untitled ' || p_entity || ' ' || left(p_row ->> 'id', 8)
    end;
  end if;
  return left(v_text, 300);
end;
$$;

-- Recompute derived display names without touching audit trails or stamps.
create or replace function private.recompute_display_names(p_entity text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('bsr.recompute', 'on', true);
  execute format(
    'update public.%I t set display_name = private.compute_display_name(%L, to_jsonb(t))
      where display_name is distinct from private.compute_display_name(%L, to_jsonb(t))',
    private.entity_table(p_entity), p_entity, p_entity);
  perform set_config('bsr.recompute', 'off', true);
end;
$$;

revoke all on function private.recompute_display_names(text) from public;

-- -----------------------------------------------------------------------------
-- Entity write trigger: stamps, dynamic field validation, display name.
-- TG_ARGV[0] = entity key.
-- -----------------------------------------------------------------------------
create or replace function private.entity_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_entity text := tg_argv[0];
  v_table text := tg_table_name;
  v_insert boolean := tg_op = 'INSERT';
  v_cfg public.entity_configs;
  v_def public.field_definitions;
  v_sent jsonb := coalesce(new.attributes, '{}'::jsonb);
  v_old_attrs jsonb := '{}'::jsonb;
  v_attrs jsonb;
  v_errors jsonb := '{}'::jsonb;
  v_key text;
  v_val jsonb;
  v_old_val jsonb;
  v_visible boolean;
  v_changed boolean;
  v_res record;
  v_dup boolean;
  v_new_row jsonb;
  v_old_row jsonb;
begin
  if current_setting('bsr.recompute', true) = 'on' then
    return new;
  end if;
  perform private.require_admin_or_system();

  if not v_insert then
    v_old_attrs := old.attributes;
    v_old_row := to_jsonb(old);
  end if;

  select * into v_cfg from public.entity_configs where entity_key = v_entity;
  if v_insert and not coalesce(v_cfg.active, false) then
    perform private.raise_rule(format('New %s cannot be created while this entity is disabled', lower(coalesce(v_cfg.plural_display_name, v_entity))));
  end if;

  -- System columns are owned by the database, whatever the client sent.
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  if v_insert then
    new.created_at := now();
    new.created_by := (select auth.uid());
  else
    new.id := old.id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;

  if jsonb_typeof(v_sent) <> 'object' then
    perform private.raise_validation(jsonb_build_object('_', 'Attributes must be an object'));
  end if;

  -- Workflow-only updates (status, archive, availability) leave field values
  -- untouched and are not re-validated against the current field rules.
  if not v_insert and v_sent = old.attributes and not exists (
    select 1 from public.field_definitions f
    where f.entity_type = v_entity and f.binding_key is not null
      and (to_jsonb(new) -> f.binding_key) is distinct from (v_old_row -> f.binding_key)
  ) then
    new.attributes := old.attributes;
    new.display_name := private.compute_display_name(v_entity, to_jsonb(new));
    return new;
  end if;

  -- Patch semantics: keys the client did not send keep their stored value;
  -- a JSON null clears a value.
  v_attrs := v_old_attrs || v_sent;

  -- 1. Keys the client sent must be known, current and editable here.
  for v_key in select jsonb_object_keys(v_sent) loop
    select * into v_def from public.field_definitions f where f.entity_type = v_entity and f.field_key = v_key;
    if not found or v_def.binding_key is not null then
      v_errors := v_errors || jsonb_build_object(v_key, 'Unknown field');
      continue;
    end if;
    v_val := v_sent -> v_key;
    v_old_val := v_old_attrs -> v_key;
    v_changed := not (
      v_val is not distinct from v_old_val
      or (private.field_value_is_empty(v_val) and private.field_value_is_empty(v_old_val))
    );
    if not v_changed then
      continue;
    end if;
    if v_def.archived_at is not null or not v_def.active then
      v_errors := v_errors || jsonb_build_object(v_key, 'This field is no longer in use');
    elsif v_def.read_only then
      v_errors := v_errors || jsonb_build_object(v_key, 'This field is read-only');
    elsif v_insert and not v_def.show_in_create then
      v_errors := v_errors || jsonb_build_object(v_key, 'This field cannot be set when creating');
    elsif not v_insert and not v_def.show_in_edit then
      v_errors := v_errors || jsonb_build_object(v_key, 'This field cannot be edited');
    end if;
  end loop;

  -- 2. Validate every current field.
  v_new_row := to_jsonb(new);
  for v_def in
    select * from public.field_definitions f
    where f.entity_type = v_entity and f.archived_at is null and f.active
    order by f.sort_order, f.created_at
  loop
    if v_errors ? v_def.field_key then
      continue;
    end if;
    v_visible := case when v_insert then v_def.show_in_create else v_def.show_in_edit end;

    if v_def.binding_key is not null then
      -- Bound to a column: types and references are enforced by the column;
      -- the definition adds the required rule and archived-target protection.
      v_val := v_new_row -> v_def.binding_key;
      if v_def.required and v_visible and not v_def.read_only and private.field_value_is_empty(v_val) then
        v_errors := v_errors || jsonb_build_object(v_def.field_key, 'Required');
      elsif v_def.field_type = 'relation' and not private.field_value_is_empty(v_val)
        and (v_insert or v_val is distinct from (v_old_row -> v_def.binding_key))
        and private.record_state(v_def.relation_entity, (v_val #>> '{}')::uuid) = 'archived' then
        v_errors := v_errors || jsonb_build_object(v_def.field_key, 'Archived records cannot be selected');
      end if;
      continue;
    end if;

    v_val := v_attrs -> v_def.field_key;
    v_old_val := v_old_attrs -> v_def.field_key;

    if v_insert and not (v_sent ? v_def.field_key) and v_def.default_value is not null then
      v_val := v_def.default_value;
    end if;

    -- Stored values are not re-validated against rules that tightened later;
    -- only the required rule applies to an unchanged value.
    if not v_insert and v_val is not distinct from v_old_val then
      if v_def.required and v_visible and private.field_value_is_empty(v_val) then
        v_errors := v_errors || jsonb_build_object(v_def.field_key, 'Required');
      end if;
      continue;
    end if;

    select * into v_res from private.check_field_value(v_def, v_val, v_old_val);
    if v_res.error is not null then
      v_errors := v_errors || jsonb_build_object(v_def.field_key, v_res.error);
      continue;
    end if;

    if v_res.value is null then
      if v_def.required and v_visible then
        v_errors := v_errors || jsonb_build_object(v_def.field_key, 'Required');
      end if;
      v_attrs := v_attrs - v_def.field_key;
      continue;
    end if;

    v_attrs := jsonb_set(v_attrs, array[v_def.field_key], v_res.value, true);

    if v_def.unique_value then
      -- Serialise concurrent writers of the same field before checking.
      perform pg_advisory_xact_lock(hashtext('bsr_unique:' || v_entity || ':' || v_def.field_key));
      execute format(
        'select exists (select 1 from public.%I where id <> $1 and lower(attributes ->> %L) = lower($2))',
        v_table, v_def.field_key)
        into v_dup
        using new.id, v_res.value #>> '{}';
      if v_dup then
        v_errors := v_errors || jsonb_build_object(v_def.field_key, 'Another record already uses this value');
      end if;
    end if;
  end loop;

  if v_errors <> '{}'::jsonb then
    perform private.raise_validation(v_errors);
  end if;

  -- Cleared values are removed; archived / disabled values are kept as stored.
  new.attributes := (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
                     from jsonb_each(v_attrs) e
                     where jsonb_typeof(e.value) <> 'null');
  new.display_name := private.compute_display_name(v_entity, to_jsonb(new));
  return new;
end;
$$;

create trigger customers_before_write
  before insert or update on public.customers
  for each row execute function private.entity_before_write('customer');
create trigger drivers_before_write
  before insert or update on public.drivers
  for each row execute function private.entity_before_write('driver');
create trigger vehicles_before_write
  before insert or update on public.vehicles
  for each row execute function private.entity_before_write('vehicle');
create trigger orders_before_write
  before insert or update on public.orders
  for each row execute function private.entity_before_write('order');

-- -----------------------------------------------------------------------------
-- Usage of a field / option across records.
-- -----------------------------------------------------------------------------
create or replace function private.field_value_count(p_def public.field_definitions)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_count bigint;
begin
  if p_def.binding_key is not null then
    execute format('select count(*) from public.%I where %I is not null',
      private.entity_table(p_def.entity_type), p_def.binding_key) into v_count;
  else
    execute format('select count(*) from public.%I where attributes ? %L',
      private.entity_table(p_def.entity_type), p_def.field_key) into v_count;
  end if;
  return v_count;
end;
$$;

create or replace function private.option_value_count(p_option_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_def public.field_definitions;
  v_count bigint;
begin
  select f.* into v_def
  from public.field_options o
  join public.field_definitions f on f.id = o.field_id
  where o.id = p_option_id;
  if not found then
    return 0;
  end if;
  if v_def.field_type = 'multi_select' then
    execute format('select count(*) from public.%I where attributes -> %L ? %L',
      private.entity_table(v_def.entity_type), v_def.field_key, p_option_id::text) into v_count;
  else
    execute format('select count(*) from public.%I where attributes ->> %L = %L',
      private.entity_table(v_def.entity_type), v_def.field_key, p_option_id::text) into v_count;
  end if;
  return v_count;
end;
$$;

revoke all on function private.field_value_count(public.field_definitions) from public;
revoke all on function private.option_value_count(uuid) from public;
grant execute on function private.field_value_count(public.field_definitions) to authenticated;
grant execute on function private.option_value_count(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Field definition rules
-- -----------------------------------------------------------------------------

-- Which behaviours make sense for which type.
create or replace function private.field_type_supports(p_type public.field_type, p_capability text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_capability
    when 'searchable' then p_type in ('short_text', 'long_text', 'email', 'phone', 'url', 'single_select',
                                      'multi_select', 'relation', 'address', 'integer', 'decimal')
    when 'filterable' then p_type not in ('long_text')
    when 'sortable' then p_type in ('short_text', 'integer', 'decimal', 'currency', 'percentage', 'date', 'time',
                                    'datetime', 'email', 'phone', 'url', 'boolean', 'single_select', 'relation')
    when 'reportable' then p_type in ('short_text', 'integer', 'decimal', 'currency', 'percentage', 'date',
                                      'datetime', 'boolean', 'single_select', 'multi_select', 'relation')
    when 'unique' then p_type in ('short_text', 'email', 'phone', 'url', 'integer', 'decimal')
    when 'default' then p_type not in ('relation', 'image', 'file', 'address')
    else false
  end;
$$;

create or replace function private.validate_rules(p_type public.field_type, p_rules jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_allowed text[];
  v_val jsonb;
  v_item text;
begin
  v_allowed := case
    when p_type in ('short_text', 'long_text') then array['min_length', 'max_length', 'pattern', 'pattern_message']
    when p_type = 'integer' then array['min', 'max']
    when p_type in ('decimal', 'percentage') then array['min', 'max', 'precision']
    when p_type = 'currency' then array['min', 'max', 'precision', 'currency']
    when p_type in ('date', 'datetime') then array['min_date', 'max_date']
    when p_type = 'time' then array['min_time', 'max_time']
    when p_type in ('email', 'phone', 'url') then array['max_length']
    when p_type = 'multi_select' then array['min_items', 'max_items']
    when p_type = 'address' then array['required_parts']
    when p_type in ('image', 'file') then array['max_size_mb', 'allowed_types']
    else array[]::text[]
  end;

  for v_key, v_val in select e.key, e.value from jsonb_each(p_rules) e loop
    if not v_key = any (v_allowed) then
      return format('Rule "%s" does not apply to this field type', v_key);
    end if;
    if jsonb_typeof(v_val) = 'null' then
      continue;
    end if;
    case v_key
    when 'min_length', 'max_length', 'min_items', 'max_items' then
      if jsonb_typeof(v_val) <> 'number' or (v_val #>> '{}')::numeric < 0
         or (v_val #>> '{}')::numeric <> trunc((v_val #>> '{}')::numeric) or (v_val #>> '{}')::numeric > 10000 then
        return format('Rule "%s" must be a whole number between 0 and 10000', v_key);
      end if;
    when 'min', 'max' then
      if jsonb_typeof(v_val) <> 'number' then
        return format('Rule "%s" must be a number', v_key);
      end if;
    when 'precision' then
      if jsonb_typeof(v_val) <> 'number' or (v_val #>> '{}')::numeric not between 0 and 6
         or (v_val #>> '{}')::numeric <> trunc((v_val #>> '{}')::numeric) then
        return 'Precision must be between 0 and 6 decimal places';
      end if;
    when 'currency' then
      if jsonb_typeof(v_val) <> 'string' or (v_val #>> '{}') !~ '^[A-Z]{3}$' then
        return 'Currency must be a 3-letter ISO code';
      end if;
    when 'pattern' then
      if jsonb_typeof(v_val) <> 'string' or char_length(v_val #>> '{}') > 500 then
        return 'Pattern must be text';
      end if;
      begin
        perform '' ~ (v_val #>> '{}');
      exception when others then
        return 'Pattern is not a valid regular expression';
      end;
    when 'pattern_message' then
      if jsonb_typeof(v_val) <> 'string' or char_length(v_val #>> '{}') > 200 then
        return 'Pattern message must be text (200 characters max)';
      end if;
    when 'min_date', 'max_date' then
      if jsonb_typeof(v_val) <> 'string' or (v_val #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        return format('Rule "%s" must be a date (YYYY-MM-DD)', v_key);
      end if;
      begin
        perform (v_val #>> '{}')::date;
      exception when others then
        return format('Rule "%s" is not a valid date', v_key);
      end;
    when 'min_time', 'max_time' then
      if jsonb_typeof(v_val) <> 'string' or (v_val #>> '{}') !~ '^[0-9]{2}:[0-9]{2}$' then
        return format('Rule "%s" must be a time (HH:MM)', v_key);
      end if;
      begin
        perform (v_val #>> '{}')::time;
      exception when others then
        return format('Rule "%s" is not a valid time', v_key);
      end;
    when 'required_parts' then
      if jsonb_typeof(v_val) <> 'array' then
        return 'Required parts must be a list';
      end if;
      for v_item in select jsonb_array_elements_text(v_val) loop
        if v_item not in ('line1', 'line2', 'postal_code', 'city', 'province', 'country') then
          return format('Unknown address part "%s"', v_item);
        end if;
      end loop;
    when 'max_size_mb' then
      if jsonb_typeof(v_val) <> 'number' or (v_val #>> '{}')::numeric <= 0 or (v_val #>> '{}')::numeric > 50 then
        return 'Maximum size must be between 0.1 and 50 MB';
      end if;
    when 'allowed_types' then
      if jsonb_typeof(v_val) <> 'array' or jsonb_array_length(v_val) = 0 then
        return 'Allowed types must be a non-empty list';
      end if;
      for v_item in select jsonb_array_elements_text(v_val) loop
        if v_item !~ '^[a-z]+/([a-z0-9.+-]+|\*)$' then
          return format('"%s" is not a valid file type', v_item);
        end if;
        if p_type = 'image' and (v_item not like 'image/%' or v_item = 'image/svg+xml') then
          return 'Image fields accept raster image types only';
        end if;
      end loop;
    end case;
  end loop;

  if p_rules ? 'min_length' and p_rules ? 'max_length'
     and (p_rules ->> 'min_length')::numeric > (p_rules ->> 'max_length')::numeric then
    return 'Minimum length is greater than maximum length';
  end if;
  if p_rules ? 'min' and p_rules ? 'max' and (p_rules ->> 'min')::numeric > (p_rules ->> 'max')::numeric then
    return 'Minimum is greater than maximum';
  end if;
  if p_rules ? 'min_items' and p_rules ? 'max_items'
     and (p_rules ->> 'min_items')::numeric > (p_rules ->> 'max_items')::numeric then
    return 'Minimum selections is greater than maximum';
  end if;
  if p_rules ? 'min_date' and p_rules ? 'max_date' and (p_rules ->> 'min_date')::date > (p_rules ->> 'max_date')::date then
    return 'Earliest date is after latest date';
  end if;
  if p_rules ? 'min_time' and p_rules ? 'max_time' and (p_rules ->> 'min_time')::time > (p_rules ->> 'max_time')::time then
    return 'Earliest time is after latest time';
  end if;
  if p_type = 'short_text' and coalesce((p_rules ->> 'max_length')::int, 0) > 1000 then
    return 'Short text is limited to 1000 characters; use long text';
  end if;
  return null;
end;
$$;

-- Types a field may change between while values exist (data stays valid).
create or replace function private.field_type_change_safe(p_from public.field_type, p_to public.field_type)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_from = p_to
    or (p_from = 'short_text' and p_to = 'long_text')
    or (p_from = 'integer' and p_to in ('decimal', 'currency'))
    or (p_from in ('decimal', 'currency') and p_to in ('decimal', 'currency'));
$$;

create or replace function private.validate_field_definition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client boolean := (select auth.uid()) is not null;
  v_errors jsonb := '{}'::jsonb;
  v_msg text;
  v_count bigint;
  v_cap text;
  v_res record;
  v_primary text;
  v_col_not_null boolean;
  v_dups bigint;
begin
  perform private.require_admin_or_system();
  new.label := btrim(new.label);
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.help_text := nullif(btrim(coalesce(new.help_text, '')), '');
  new.placeholder := nullif(btrim(coalesce(new.placeholder, '')), '');
  new.validation_rules := coalesce(new.validation_rules, '{}'::jsonb);
  -- Rules set to null are simply absent.
  new.validation_rules := (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
                           from jsonb_each(new.validation_rules) e where jsonb_typeof(e.value) <> 'null');

  if tg_op = 'INSERT' then
    if v_client and (new.is_system or new.binding_key is not null or new.read_only) then
      perform private.raise_rule('System fields are defined by the platform');
    end if;
    if exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = private.entity_table(new.entity_type)
        and c.column_name = new.field_key
    ) and new.binding_key is distinct from new.field_key then
      v_errors := v_errors || jsonb_build_object('field_key', 'This key is reserved by the system');
    end if;
    if new.field_key in ('id', 'status', 'search', 'attributes', 'display_name', 'assignment') then
      v_errors := v_errors || jsonb_build_object('field_key', 'This key is reserved by the system');
    end if;
    new.archived_at := null;
  else
    if new.entity_type is distinct from old.entity_type then
      perform private.raise_rule('A field cannot move to another entity');
    end if;
    if new.field_key is distinct from old.field_key then
      v_errors := v_errors || jsonb_build_object('field_key', 'The key of an existing field cannot change; create a new field instead');
    end if;
    if new.is_system is distinct from old.is_system or new.binding_key is distinct from old.binding_key
       or new.read_only is distinct from old.read_only then
      perform private.raise_rule('System bindings cannot change');
    end if;

    if old.is_system then
      if new.field_type is distinct from old.field_type or new.relation_entity is distinct from old.relation_entity then
        perform private.raise_rule('The type of a system field cannot change');
      end if;
      if new.archived_at is not null or not new.active then
        perform private.raise_rule('System fields cannot be disabled or archived');
      end if;
    end if;

    if new.field_type is distinct from old.field_type or new.relation_entity is distinct from old.relation_entity then
      v_count := private.field_value_count(old);
      if v_count > 0 and (new.relation_entity is distinct from old.relation_entity
                          or not private.field_type_change_safe(old.field_type, new.field_type)) then
        v_errors := v_errors || jsonb_build_object('field_type', format(
          '%s records hold values of the current type; create a new field instead', v_count));
      end if;
      if old.field_type in ('single_select', 'multi_select') and new.field_type not in ('single_select', 'multi_select')
         and exists (select 1 from public.field_options o where o.field_id = old.id) then
        v_errors := v_errors || jsonb_build_object('field_type', 'Delete the options before changing to a non-select type');
      end if;
      if old.field_type = 'multi_select' and new.field_type = 'single_select' and v_count > 0 then
        v_errors := v_errors || jsonb_build_object('field_type', 'Multi-select values cannot become single-select values');
      end if;
    end if;

    -- The primary display field must stay usable.
    select c.primary_display_field into v_primary from public.entity_configs c where c.entity_key = new.entity_type;
    if v_primary = new.field_key and (new.archived_at is not null or not new.active) then
      perform private.raise_rule('This field names the records; choose another primary display field first');
    end if;
  end if;

  -- Capabilities follow the type.
  foreach v_cap in array array['searchable', 'filterable', 'sortable', 'reportable'] loop
    if (to_jsonb(new) ->> v_cap)::boolean and not private.field_type_supports(new.field_type, v_cap) then
      v_errors := v_errors || jsonb_build_object(v_cap, format('Not available for %s fields', replace(new.field_type::text, '_', ' ')));
    end if;
  end loop;
  if new.unique_value and not private.field_type_supports(new.field_type, 'unique') then
    v_errors := v_errors || jsonb_build_object('unique_value', 'Unique values are not available for this type');
  end if;

  v_msg := private.validate_rules(new.field_type, new.validation_rules);
  if v_msg is not null then
    v_errors := v_errors || jsonb_build_object('validation_rules', v_msg);
  end if;

  -- Bound columns that are NOT NULL must stay required and creatable.
  if new.binding_key is not null and not new.read_only then
    select c.is_nullable = 'NO' into v_col_not_null
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = private.entity_table(new.entity_type)
      and c.column_name = new.binding_key;
    if v_col_not_null and (not new.required or not new.show_in_create) then
      v_errors := v_errors || jsonb_build_object('required', 'This system field is always required');
    end if;
  end if;
  if new.read_only then
    new.show_in_create := false;
    new.show_in_edit := false;
    new.required := false;
  end if;

  -- Default value must itself be valid.
  if new.default_value is not null and jsonb_typeof(new.default_value) <> 'null' then
    if not private.field_type_supports(new.field_type, 'default') then
      v_errors := v_errors || jsonb_build_object('default_value', 'Default values are not available for this type');
    elsif new.binding_key is not null then
      v_errors := v_errors || jsonb_build_object('default_value', 'System fields have no default value');
    else
      select * into v_res from private.check_field_value(new, new.default_value, null);
      if v_res.error is not null then
        v_errors := v_errors || jsonb_build_object('default_value', v_res.error);
      else
        new.default_value := v_res.value;
      end if;
    end if;
  else
    new.default_value := null;
  end if;

  -- Turning on uniqueness requires the stored values to be unique already.
  if tg_op = 'UPDATE' and new.unique_value and not old.unique_value and new.binding_key is null then
    execute format(
      'select count(*) from (select lower(attributes ->> %L) v from public.%I
         where attributes ? %L group by 1 having count(*) > 1) d',
      new.field_key, private.entity_table(new.entity_type), new.field_key) into v_dups;
    if v_dups > 0 then
      v_errors := v_errors || jsonb_build_object('unique_value',
        format('%s values are already used by more than one record', v_dups));
    end if;
  end if;

  if v_errors <> '{}'::jsonb then
    perform private.raise_validation(v_errors);
  end if;
  return new;
end;
$$;

create trigger field_definitions_validate
  before insert or update on public.field_definitions
  for each row execute function private.validate_field_definition();

create or replace function private.guard_field_definition_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count bigint;
begin
  if old.is_system then
    perform private.raise_rule('System fields cannot be deleted');
  end if;
  if exists (select 1 from public.entity_configs c
             where c.entity_key = old.entity_type and c.primary_display_field = old.field_key) then
    perform private.raise_rule('This field names the records; choose another primary display field first');
  end if;
  v_count := private.field_value_count(old);
  if v_count > 0 then
    perform private.raise_rule(format('%s records hold values for this field; archive it instead', v_count));
  end if;
  return old;
end;
$$;

create trigger field_definitions_guard_delete
  before delete on public.field_definitions
  for each row execute function private.guard_field_definition_delete();

-- -----------------------------------------------------------------------------
-- Option rules
-- -----------------------------------------------------------------------------
create or replace function private.validate_field_option()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_def public.field_definitions;
begin
  perform private.require_admin_or_system();
  new.label := btrim(new.label);
  select * into v_def from public.field_definitions f where f.id = new.field_id;
  if v_def.field_type not in ('single_select', 'multi_select') then
    perform private.raise_rule('Options belong to single or multi select fields only');
  end if;
  if tg_op = 'UPDATE' then
    if new.field_id is distinct from old.field_id then
      perform private.raise_rule('An option cannot move to another field');
    end if;
    if new.archived_at is not null and old.archived_at is null
       and (v_def.default_value = to_jsonb(new.id::text) or v_def.default_value @> to_jsonb(array[new.id::text])) then
      perform private.raise_rule('This option is the default value of the field; change the default first');
    end if;
  end if;
  if exists (
    select 1 from public.field_options o
    where o.field_id = new.field_id and o.id <> new.id and o.archived_at is null and new.archived_at is null
      and lower(o.label) = lower(new.label)
  ) then
    perform private.raise_validation(jsonb_build_object('label', 'Another option already has this label'));
  end if;
  return new;
end;
$$;

create trigger field_options_validate
  before insert or update on public.field_options
  for each row execute function private.validate_field_option();

create or replace function private.guard_field_option_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count bigint;
  v_default jsonb;
begin
  v_count := private.option_value_count(old.id);
  if v_count > 0 then
    perform private.raise_rule(format('%s records use this option; archive it instead', v_count));
  end if;
  select f.default_value into v_default from public.field_definitions f where f.id = old.field_id;
  if v_default is not null and (v_default = to_jsonb(old.id::text) or v_default @> to_jsonb(array[old.id::text])) then
    perform private.raise_rule('This option is the default value of the field; change the default first');
  end if;
  return old;
end;
$$;

create trigger field_options_guard_delete
  before delete on public.field_options
  for each row execute function private.guard_field_option_delete();

-- -----------------------------------------------------------------------------
-- Entity configuration rules + display-name maintenance
-- -----------------------------------------------------------------------------
create or replace function private.validate_entity_config()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_def public.field_definitions;
begin
  perform private.require_admin_or_system();
  if tg_op = 'UPDATE' and new.entity_key is distinct from old.entity_key then
    perform private.raise_rule('Entities are fixed');
  end if;
  new.display_name := btrim(new.display_name);
  new.plural_display_name := btrim(new.plural_display_name);
  if new.primary_display_field is not null then
    select * into v_def from public.field_definitions f
    where f.entity_type = new.entity_key and f.field_key = new.primary_display_field;
    if not found then
      perform private.raise_validation(jsonb_build_object('primary_display_field', 'Unknown field'));
    end if;
    if v_def.archived_at is not null or not v_def.active then
      perform private.raise_validation(jsonb_build_object('primary_display_field', 'The field is not in use'));
    end if;
    if v_def.field_type not in ('short_text', 'email', 'phone', 'url', 'integer', 'decimal', 'single_select',
                                'relation', 'date', 'datetime') then
      perform private.raise_validation(jsonb_build_object('primary_display_field', 'This type cannot name records'));
    end if;
  end if;
  return new;
end;
$$;

create trigger entity_configs_validate
  before insert or update on public.entity_configs
  for each row execute function private.validate_entity_config();

create or replace function private.entity_config_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.primary_display_field is distinct from old.primary_display_field then
    perform private.recompute_display_names(new.entity_key);
  end if;
  return null;
end;
$$;

create trigger entity_configs_after_update
  after update on public.entity_configs
  for each row execute function private.entity_config_after_update();

-- Option relabelled → records named by that select field are renamed.
create or replace function private.field_option_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity text;
begin
  if new.label is distinct from old.label then
    select c.entity_key into v_entity
    from public.field_definitions f
    join public.entity_configs c on c.entity_key = f.entity_type and c.primary_display_field = f.field_key
    where f.id = new.field_id;
    if v_entity is not null then
      perform private.recompute_display_names(v_entity);
    end if;
  end if;
  return null;
end;
$$;

create trigger field_options_after_update
  after update on public.field_options
  for each row execute function private.field_option_after_update();

-- A renamed record renames records whose primary display field points at it.
create or replace function private.entity_display_name_cascade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity text;
begin
  if new.display_name is distinct from old.display_name then
    for v_entity in
      select c.entity_key
      from public.entity_configs c
      join public.field_definitions f on f.entity_type = c.entity_key and f.field_key = c.primary_display_field
      where f.field_type = 'relation' and f.relation_entity = tg_argv[0]
    loop
      perform private.recompute_display_names(v_entity);
    end loop;
  end if;
  return null;
end;
$$;

create trigger customers_display_name_cascade
  after update of display_name on public.customers
  for each row execute function private.entity_display_name_cascade('customer');
create trigger drivers_display_name_cascade
  after update of display_name on public.drivers
  for each row execute function private.entity_display_name_cascade('driver');
create trigger vehicles_display_name_cascade
  after update of display_name on public.vehicles
  for each row execute function private.entity_display_name_cascade('vehicle');

-- -----------------------------------------------------------------------------
-- Public RPCs for the field builder
-- -----------------------------------------------------------------------------

-- Number of records holding a value for each field of an entity.
create or replace function public.field_usage(p_entity text)
returns table (field_id uuid, field_key text, record_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select f.id, f.field_key, private.field_value_count(f)
    from public.field_definitions f
    where f.entity_type = p_entity;
end;
$$;

-- Number of records using each option of a field.
create or replace function public.option_usage(p_field_id uuid)
returns table (option_id uuid, record_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select o.id, private.option_value_count(o.id)
    from public.field_options o
    where o.field_id = p_field_id;
end;
$$;

-- Atomic reorder: the given ids get sort_order 10, 20, 30, …
create or replace function public.reorder_fields(p_entity text, p_field_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if exists (
    select 1 from unnest(p_field_ids) i
    where not exists (select 1 from public.field_definitions f where f.id = i and f.entity_type = p_entity)
  ) then
    perform private.raise_rule('Every field must belong to the entity');
  end if;
  update public.field_definitions f
  set sort_order = o.ord * 10
  from unnest(p_field_ids) with ordinality as o(id, ord)
  where f.id = o.id and f.sort_order is distinct from o.ord * 10;
end;
$$;

create or replace function public.reorder_field_options(p_field_id uuid, p_option_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if exists (
    select 1 from unnest(p_option_ids) i
    where not exists (select 1 from public.field_options o where o.id = i and o.field_id = p_field_id)
  ) then
    perform private.raise_rule('Every option must belong to the field');
  end if;
  update public.field_options f
  set sort_order = o.ord * 10
  from unnest(p_option_ids) with ordinality as o(id, ord)
  where f.id = o.id and f.sort_order is distinct from o.ord * 10;
end;
$$;

revoke all on function public.field_usage(text) from public, anon;
revoke all on function public.option_usage(uuid) from public, anon;
revoke all on function public.reorder_fields(text, uuid[]) from public, anon;
revoke all on function public.reorder_field_options(uuid, uuid[]) from public, anon;
grant execute on function public.field_usage(text) to authenticated;
grant execute on function public.option_usage(uuid) to authenticated;
grant execute on function public.reorder_fields(text, uuid[]) to authenticated;
grant execute on function public.reorder_field_options(uuid, uuid[]) to authenticated;
