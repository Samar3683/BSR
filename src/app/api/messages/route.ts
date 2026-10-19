import type { NextRequest } from "next/server";

import { isBackendConfigured } from "@/server/config";
import { IntakeError, submitContactMessage } from "@/server/intake";
import { clientKey, rateLimited } from "@/server/limits";
import { baseUrl, fail, ok, readJson, sameSite } from "@/server/public-api";

/** The "send us a message" form: stored for the team to answer from the panel. */
export async function POST(request: NextRequest) {
  if (!isBackendConfigured()) return fail("Il servizio non è disponibile.", 503);
  if (!sameSite(request)) return fail("Richiesta non valida.", 403);
  if (rateLimited(`message:ip:${clientKey(request)}`, 5, 60 * 60_000)) {
    return fail("Troppe richieste. Riprova più tardi o chiamaci.", 429);
  }
  const body = await readJson(request);
  if (body === null) return fail("Richiesta non valida.", 400);
  // A script that submits within a second is not a person.
  const elapsed = (body as { elapsed?: unknown }).elapsed;
  if (typeof elapsed === "number" && elapsed < 1500) return ok({ reference: "MS-0000-00000" });

  try {
    const reference = await submitContactMessage(body, baseUrl(request));
    return ok({ reference }, 201);
  } catch (error) {
    if (error instanceof IntakeError) return fail(error.message, error.status);
    console.error("message failed:", (error as Error).message);
    return fail("Il messaggio non è stato inviato. Riprova o chiamaci.", 500);
  }
}
