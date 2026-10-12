import type { NextRequest } from "next/server";

import { withIdentity } from "@/server/db";
import { currentSession, isSameSite, json, unauthorized } from "@/admin/server/http";

const BUCKET = "entity-files";
const NO_STORE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
/** Types a browser can show inline; everything else downloads. */
const INLINE = /^(image\/(jpeg|png|webp|gif)|application\/pdf|text\/plain)$/;

/**
 * Uploads a file for an image / file field. Row-level security on
 * storage.objects decides who may upload and which paths are valid; the
 * bucket's size and type limits are enforced here.
 */
export async function POST(request: NextRequest) {
  if (!isSameSite(request)) return json({ error: { message: "Forbidden" } }, 403);
  const session = await currentSession(request);
  if (!session) return unauthorized();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: { message: "Invalid upload" } }, 400);
  }
  const path = form.get("path");
  const file = form.get("file");
  if (typeof path !== "string" || !(file instanceof File)) {
    return json({ error: { message: "Invalid upload" } }, 400);
  }
  const mime = file.type || "application/octet-stream";

  try {
    await withIdentity({ userId: session.userId, email: session.email }, async (client) => {
      const { rows } = await client.query<{
        file_size_limit: number | null;
        allowed_mime_types: string[] | null;
      }>("select file_size_limit, allowed_mime_types from storage.buckets where id = $1", [BUCKET]);
      const bucket = rows[0];
      if (!bucket) throw Object.assign(new Error("Storage is not available"), { status: 503 });
      if (bucket.file_size_limit && file.size > Number(bucket.file_size_limit)) {
        throw Object.assign(new Error("The file is too large."), { status: 413 });
      }
      if (bucket.allowed_mime_types && !bucket.allowed_mime_types.includes(mime)) {
        throw Object.assign(new Error("This file type is not allowed."), { status: 415 });
      }
      await client.query(
        `insert into storage.objects (bucket_id, name, owner, metadata, content)
         values ($1, $2, auth.uid(), $3::jsonb, $4)`,
        [
          BUCKET,
          path,
          JSON.stringify({ size: file.size, mimetype: mime }),
          Buffer.from(await file.arrayBuffer()),
        ],
      );
    });
    return json({ ok: true, path });
  } catch (error) {
    const e = error as { status?: number; code?: string; message: string };
    if (e.code === "42501") return json({ error: { message: "This upload is not allowed." } }, 403);
    if (e.code === "23505") return json({ error: { message: "This file already exists." } }, 409);
    return json({ error: { message: e.message } }, e.status ?? 400);
  }
}

/** Streams a private file to a signed-in administrator. */
export async function GET(request: NextRequest) {
  const session = await currentSession(request);
  if (!session) return unauthorized();
  const path = request.nextUrl.searchParams.get("path") ?? "";
  if (!path || path.length > 300) return json({ error: { message: "Not found" } }, 404);

  const row = await withIdentity(
    { userId: session.userId, email: session.email },
    async (client) => {
      const { rows } = await client.query<{ content: Buffer; metadata: { mimetype?: string } }>(
        "select content, metadata from storage.objects where bucket_id = $1 and name = $2",
        [BUCKET, path],
      );
      return rows[0] ?? null;
    },
  ).catch(() => null);
  if (!row) return json({ error: { message: "Not found" } }, 404);

  const mime = row.metadata?.mimetype ?? "application/octet-stream";
  const filename =
    path
      .split("/")
      .pop()
      ?.replace(/^[0-9a-f-]{36}-/, "") ?? "file";
  return new Response(new Uint8Array(row.content), {
    headers: {
      ...NO_STORE,
      "Content-Type": mime,
      "Content-Length": String(row.content.length),
      "Content-Disposition": `${INLINE.test(mime) ? "inline" : "attachment"}; filename="${filename.replace(/"/g, "")}"`,
    },
  });
}
