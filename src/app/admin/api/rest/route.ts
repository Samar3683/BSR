import type { NextRequest } from "next/server";

import { withIdentity } from "@/server/db";
import { currentSession, errorResponse, isSameSite, json, unauthorized } from "@/admin/server/http";
import { executeRest, RestError, type RestOp } from "@/admin/server/rest";

const ACTIONS = ["select", "insert", "update", "delete"];

/** Table access for the admin panel: runs as the signed-in user under row-level security. */
export async function POST(request: NextRequest) {
  if (!isSameSite(request)) return json({ data: null, error: { message: "Forbidden" } }, 403);
  const session = await currentSession(request);
  if (!session) return unauthorized();

  let op: RestOp;
  try {
    op = (await request.json()) as RestOp;
    if (!op || typeof op.table !== "string" || !ACTIONS.includes(op.action)) {
      throw new RestError("Invalid request");
    }
  } catch (error) {
    return errorResponse(error instanceof RestError ? error : new RestError("Invalid request"));
  }

  try {
    const result = await withIdentity({ userId: session.userId, email: session.email }, (client) =>
      executeRest(client, op),
    );
    return json({ data: result.data, error: null, count: result.count ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}
