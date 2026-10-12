import type { NextRequest } from "next/server";

import { isBackendConfigured } from "@/server/config";
import { recordContactEvent } from "@/server/intake";
import { clientKey, rateLimited } from "@/server/limits";

/**
 * Anonymous count of a click on a WhatsApp / phone / email link: the channel and
 * the page path, nothing about the visitor. Sent with sendBeacon, so it never
 * delays the click; always answers 204.
 */
export async function POST(request: NextRequest) {
  const empty = new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  if (!isBackendConfigured()) return empty;
  if (rateLimited(`contact:ip:${clientKey(request)}`, 60, 60 * 60_000)) return empty;
  try {
    const raw = await request.text();
    if (raw.length > 1_000) return empty;
    const body = JSON.parse(raw) as { channel?: unknown; page?: unknown };
    await recordContactEvent(body.channel, body.page);
  } catch {
    // Counting is best effort.
  }
  return empty;
}
