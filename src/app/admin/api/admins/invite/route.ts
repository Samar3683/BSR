import type { NextRequest } from "next/server";

import { AuthFailure, inviteAdmin } from "@/admin/server/auth";
import { currentSession, isSameSite, json, siteOrigin } from "@/admin/server/http";

/** Invites a new administrator (active administrators only). */
export async function POST(request: NextRequest) {
  if (!isSameSite(request)) return json({ error: "Forbidden" }, 403);
  const session = await currentSession(request);
  if (!session) return json({ error: "Not authenticated" }, 401);

  let data: Record<string, unknown> = {};
  try {
    data = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const result = await inviteAdmin(session, data.email, data.display_name, siteOrigin(request));
    return json({ profile: result.profile }, 201);
  } catch (error) {
    if (error instanceof AuthFailure) {
      return json({ error: error.message, field_errors: error.fieldErrors }, error.status);
    }
    return json({ error: "The invitation could not be sent" }, 502);
  }
}
