import type { NextRequest } from "next/server";

import { isBackendConfigured } from "@/server/config";
import { IntakeError, submitQuoteRequest } from "@/server/intake";
import { clientKey, rateLimited } from "@/server/limits";
import { baseUrl, fail, ok, readJson } from "@/server/public-api";
import { isSameSite } from "@/server/request";

/** The quote form's submission: stored for the dispatch team to answer. */
export async function POST(request: NextRequest) {
  if (!isBackendConfigured()) return fail("Il servizio non è disponibile.", 503);
  if (!isSameSite(request)) return fail("Richiesta non valida.", 403);

  if (rateLimited(`quote:ip:${clientKey(request)}`, 5, 60 * 60_000)) {
    return fail("Troppe richieste. Riprova più tardi o scrivici su WhatsApp.", 429);
  }

  const body = await readJson(request);
  if (body === null) return fail("Richiesta non valida.", 400);
  // The form reports how long it was open: a "visitor" that submits within a second is a script.
  const elapsed = (body as { elapsed?: unknown }).elapsed;
  if (typeof elapsed === "number" && elapsed < 1500) return ok({ reference: "RQ-0000-00000" });

  try {
    const reference = await submitQuoteRequest(body, baseUrl(request));
    return ok({ reference }, 201);
  } catch (error) {
    if (error instanceof IntakeError) return fail(error.message, error.status);
    console.error("quote request failed:", (error as Error).message);
    return fail("La richiesta non è stata registrata. Riprova o scrivici su WhatsApp.", 500);
  }
}
