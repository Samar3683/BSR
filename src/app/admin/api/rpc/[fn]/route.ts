import type { NextRequest } from "next/server";

import { withIdentity } from "@/server/db";
import { currentSession, errorResponse, isSameSite, json, unauthorized } from "@/admin/server/http";
import { executeRpc } from "@/admin/server/rest";

/** Calls a function of the public schema as the signed-in user. */
export async function POST(request: NextRequest, context: { params: Promise<{ fn: string }> }) {
  if (!isSameSite(request)) return json({ data: null, error: { message: "Forbidden" } }, 403);
  const session = await currentSession(request);
  if (!session) return unauthorized();
  const { fn } = await context.params;

  let args: Record<string, unknown> = {};
  try {
    const body = (await request.json()) as unknown;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      args = body as Record<string, unknown>;
    }
  } catch {
    // No body: a call without arguments.
  }

  try {
    const data = await withIdentity({ userId: session.userId, email: session.email }, (client) =>
      executeRpc(client, fn, args),
    );
    return json({ data, error: null });
  } catch (error) {
    return errorResponse(error);
  }
}
