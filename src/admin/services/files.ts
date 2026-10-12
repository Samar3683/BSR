import { AdminError } from "../lib/errors";
import { allowedFileTypes, maxFileSizeMb } from "../lib/fields/registry";
import type { FieldDefinition, FileValue } from "../lib/fields/types";
import { mimeAllowed } from "../lib/fields/validate";

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
 * Uploads a file for an image / file field to the private store. The path is
 * `<entity>/<field_key>/<random>-<name>`; the server accepts uploads from
 * active administrators only, and the database re-checks type and size when
 * the record is saved.
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
  const form = new FormData();
  form.set("path", path);
  form.set("file", file, file.name);
  let response: Response;
  try {
    response = await fetch("/admin/api/files", { method: "POST", body: form, credentials: "same-origin" });
  } catch {
    throw new AdminError("network", "The server could not be reached. Check the connection and try again.");
  }
  if (!response.ok) {
    let message = "The file could not be uploaded.";
    try {
      message = ((await response.json()) as { error?: { message?: string } }).error?.message ?? message;
    } catch {
      // keep the generic message
    }
    throw new AdminError(response.status === 401 ? "auth" : "rule", message);
  }
  return { path, name: file.name.slice(0, 255), size: file.size, mime_type: type };
}

/** The URL of a private file; the session cookie authorizes the request. */
export async function signedFileUrl(path: string): Promise<string> {
  return `/admin/api/files?path=${encodeURIComponent(path)}`;
}
