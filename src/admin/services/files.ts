import { AdminError, toAdminError } from "../lib/errors";
import { allowedFileTypes, maxFileSizeMb } from "../lib/fields/registry";
import type { FieldDefinition, FileValue } from "../lib/fields/types";
import { mimeAllowed } from "../lib/fields/validate";
import { getSupabase } from "../lib/supabase/client";

export const FILES_BUCKET = "entity-files";

function safeName(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(-80);
  return cleaned || "file";
}

/**
 * Uploads a file for an image / file field to the private bucket. The path
 * is `<entity>/<field_key>/<random>-<name>`; Storage policies accept uploads
 * from active administrators only, and the database re-checks type and size
 * from Storage metadata when the record is saved.
 */
export async function uploadFieldFile(def: FieldDefinition, file: File): Promise<FileValue> {
  const type = file.type || "application/octet-stream";
  if (!mimeAllowed(type, allowedFileTypes(def))) {
    throw new AdminError("validation", "This file type is not allowed for this field.");
  }
  if (file.size > maxFileSizeMb(def) * 1024 * 1024) {
    throw new AdminError("validation", `The file is larger than ${maxFileSizeMb(def)} MB.`);
  }
  const path = `${def.entity_type}/${def.field_key}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await getSupabase().storage.from(FILES_BUCKET).upload(path, file, {
    contentType: type,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw toAdminError(error);
  return { path, name: file.name.slice(0, 255), size: file.size, mime_type: type };
}

/** A short-lived URL for a private file (the bucket is never public). */
export async function signedFileUrl(path: string, expiresIn = 300): Promise<string> {
  const { data, error } = await getSupabase()
    .storage.from(FILES_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) throw toAdminError(error);
  return data.signedUrl;
}
