import type { NextRequest } from "next/server";

import { isBackendConfigured } from "@/server/config";
import { addVisitorMessage, IntakeError } from "@/server/intake";
import { clientKey, rateLimited } from "@/server/limits";
import { fail, ok, readJson, sameSite } from "@/server/public-api";

/** A follow-up written by the visitor under their request or message. */
export async function POST(request: NextRequest) {
  if (!isBackendConfigured()) return fail("Il servizio non è disponibile.", 503);
  if (!sameSite(request)) return fail("Richiesta non valida.", 403);
  if (rateLimited(`reply:ip:${clientKey(request)}`, 10, 60 * 60_000)) {
    return fail("Troppi messaggi. Riprova più tardi o chiamaci.", 429);
  }
  const body = (await readJson(request, 6_000)) as { code?: unknown; message?: unknown } | null;
  if (!body) return fail("Richiesta non valida.", 400);
  try {
    const stored = await addVisitorMessage(body.code, body.message);
    return stored ? ok({ ok: true }, 201) : fail("Codice non trovato.", 404);
  } catch (error) {
    if (error instanceof IntakeError) return fail("Scrivi un messaggio.", 422);
    console.error("follow-up failed:", (error as Error).message);
    return fail("Il messaggio non è stato inviato. Riprova più tardi.", 500);
  }
}
