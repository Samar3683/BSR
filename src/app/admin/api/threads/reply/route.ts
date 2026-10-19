import type { NextRequest } from "next/server";

import {
  currentSession,
  errorResponse,
  isSameSite,
  json,
  siteOrigin,
  unauthorized,
} from "@/admin/server/http";
import { readConfig } from "@/server/config";
import { withIdentity } from "@/server/db";
import { replyMail, sendMail } from "@/server/mail";

/**
 * A reply from the panel to a visitor's quote request or message. It is stored
 * in the conversation (the visitor reads it on the tracking page) and emailed
 * when the visitor left an address and mail is configured.
 */
export async function POST(request: NextRequest) {
  if (!isSameSite(request)) return json({ data: null, error: { message: "Forbidden" } }, 403);
  const session = await currentSession(request);
  if (!session) return unauthorized();

  let body: { kind?: unknown; id?: unknown; body?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ data: null, error: { message: "Invalid request" } }, 400);
  }
  if (
    typeof body.kind !== "string" ||
    typeof body.id !== "string" ||
    typeof body.body !== "string"
  ) {
    return json({ data: null, error: { message: "Invalid request" } }, 400);
  }

  let stored: { entry_id: string; email: string | null; reference: string };
  try {
    stored = await withIdentity(
      { userId: session.userId, email: session.email },
      async (client) => {
        const { rows } = await client.query<{ result: typeof stored }>(
          "select public.reply_to_thread($1, $2, $3) as result",
          [body.kind, body.id, body.body],
        );
        return rows[0]!.result;
      },
    );
  } catch (error) {
    return errorResponse(error);
  }

  // The reply is saved either way; the email is a bonus that may not be possible.
  let emailed = false;
  if (stored.email && readConfig()?.smtpUrl) {
    try {
      await sendMail(replyMail(stored.email, stored.reference, body.body, siteOrigin(request)));
      await withIdentity({ userId: session.userId, email: session.email }, (client) =>
        client.query("select public.mark_thread_entry_emailed($1)", [stored.entry_id]),
      );
      emailed = true;
    } catch (error) {
      console.error("reply email failed:", (error as Error).message);
    }
  }
  return json({ data: { entry_id: stored.entry_id, emailed }, error: null });
}
