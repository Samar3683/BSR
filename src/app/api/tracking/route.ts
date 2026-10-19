import type { NextRequest } from "next/server";

import { isBackendConfigured } from "@/server/config";
import { trackCode } from "@/server/intake";
import { clientKey, rateLimited } from "@/server/limits";
import { fail, ok, readJson, sameSite } from "@/server/public-api";

/**
 * Looks up a request or a message by its tracking code. The code is the only
 * key, so lookups are limited per visitor (and wrong codes count double).
 */
export async function POST(request: NextRequest) {
  if (!isBackendConfigured()) return fail("Il servizio non è disponibile.", 503);
  if (!sameSite(request)) return fail("Richiesta non valida.", 403);
  const key = clientKey(request);
  if (rateLimited(`track:ip:${key}`, 60, 60 * 60_000)) {
    return fail("Troppi tentativi. Riprova più tardi.", 429);
  }
  const body = (await readJson(request, 1_000)) as { code?: unknown } | null;
  if (!body) return fail("Richiesta non valida.", 400);

  try {
    const result = await trackCode(body.code);
    if (!result) {
      // Guessing codes is the only abuse: make it expensive.
      if (rateLimited(`track:miss:${key}`, 12, 60 * 60_000)) {
        return fail("Troppi tentativi. Riprova più tardi.", 429);
      }
      return fail("Codice non trovato. Controlla di averlo scritto correttamente.", 404);
    }
    return ok(result);
  } catch (error) {
    console.error("tracking failed:", (error as Error).message);
    return fail("Non riusciamo a controllare il codice. Riprova più tardi.", 500);
  }
}
