-- =============================================================================
-- BSR admin backend — private storage for image / file fields
--
-- Bucket `entity-files` is private: objects are read through short-lived
-- signed URLs only. Paths are `<entity>/<field_key>/<unique file name>`.
-- Only active administrators can read or upload; nobody can overwrite or
-- delete through the API, so files referenced by history stay available.
-- The database re-checks type and size from Storage's own metadata when a
-- record references a file (private.check_field_value).
-- =============================================================================

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Storage is not installed; skipping the entity-files bucket';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'entity-files',
    'entity-files',
    false,
    52428800,
    array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf', 'text/plain', 'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute $p$
    create policy "entity files: admins read"
      on storage.objects for select to authenticated
      using (bucket_id = 'entity-files' and (select private.is_active_admin()))
  $p$;

  execute $p$
    create policy "entity files: admins upload"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'entity-files'
        and (select private.is_active_admin())
        and (storage.foldername(name))[1] in ('order', 'vehicle', 'driver', 'customer')
        and array_length(storage.foldername(name), 1) = 2
        and name ~ '^[a-z]+/[a-z][a-z0-9_]{1,62}/[A-Za-z0-9._-]+$'
      )
  $p$;
end;
$$;
