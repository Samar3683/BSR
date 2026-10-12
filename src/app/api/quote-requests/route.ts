import { NextResponse, type NextRequest } from "next/server";

import { isBackendConfigured, readConfig } from "@/server/config";
import { IntakeError, submitQuoteRequest } from "@/server/intake";
import { clientKey, rateLimited } from "@/server/limits";

const HEADERS = { "Cache-Control": "no-store" };
const fail = (message: string, status: number) =>
  NextResponse.json({ error: { message } }, { status, headers: HEADERS });

/** Same-site browser requests only (a server-side client has neither header). */
function sameSite(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === request.nextUrl.host;
    } catch {
      return false;
    }
  }
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}

/** The quote form's submission: stored for the dispatch team to answer. */
export async function POST(request: NextRequest) {
  if (!isBackendConfigured()) return fail("Il servizio non è disponibile.", 503);
  if (!sameSite(request)) return fail("Richiesta non valida.", 403);

  if (rateLimited(`quote:ip:${clientKey(request)}`, 5, 60 * 60_000)) {
    return fail("Troppe richieste. Riprova più tardi o scrivici su WhatsApp.", 429);
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 20_000) return fail("Richiesta non valida.", 413);
    body = JSON.parse(raw);
  } catch {
    return fail("Richiesta non valida.", 400);
  }
  // The form reports how long it was open: a "visitor" that submits within a second is a script.
  const elapsed = (body as { elapsed?: unknown } | null)?.elapsed;
  if (typeof elapsed === "number" && elapsed < 1500) {
    return NextResponse.json({ reference: "RQ-0000-00000" }, { headers: HEADERS });
  }

  try {
    const reference = await submitQuoteRequest(
      body,
      readConfig()?.appUrl ?? request.nextUrl.origin,
    );
    return NextResponse.json({ reference }, { status: 201, headers: HEADERS });
  } catch (error) {
    if (error instanceof IntakeError) return fail(error.message, error.status);
    console.error("quote request failed:", (error as Error).message);
    return fail("La richiesta non è stata registrata. Riprova o scrivici su WhatsApp.", 500);
  }
}
