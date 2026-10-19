import type { NextRequest } from "next/server";

import { subscribeToChanges } from "@/server/changes";
import { isBackendConfigured } from "@/server/config";
import { withIdentity } from "@/server/db";
import { currentSession, json, unauthorized } from "@/admin/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 20_000;
/** Open streams per signed-in user: more tabs than this close the oldest one. */
const MAX_STREAMS_PER_USER = 4;
const streams = new Map<string, Set<() => void>>();
/** Administrators who lose access (sign out, deactivation) are cut off within this time. */
const RECHECK_MS = 60_000;

async function isActiveAdmin(userId: string, email: string | null): Promise<boolean> {
  try {
    return await withIdentity({ userId, email }, async (client) => {
      const { rows } = await client.query<{ active: boolean; role: string }>(
        "select active, role from public.current_admin()",
      );
      return Boolean(rows[0]?.active && rows[0].role === "admin");
    });
  } catch {
    return false;
  }
}

/**
 * Live changes for the panel (Server-Sent Events): one small message per
 * changed table. No data is sent; screens reload through the authorized API.
 */
export async function GET(request: NextRequest) {
  if (!isBackendConfigured()) return json({ error: "Not configured" }, 503);
  const session = await currentSession(request);
  if (!session) return unauthorized();
  if (!(await isActiveAdmin(session.userId, session.email))) {
    return json({ error: "Not authorized" }, 403);
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup();
        }
      };
      send("retry: 3000\nevent: ready\ndata: {}\n\n");

      // Changes arrive in bursts (one action touches several tables): merge them.
      let pending = new Map<string, string>();
      let flush: ReturnType<typeof setTimeout> | null = null;
      const unsubscribe = subscribeToChanges((change) => {
        pending.set(change.t, change.op);
        flush ??= setTimeout(() => {
          flush = null;
          const batch = [...pending].map(([t, op]) => ({ t, op }));
          pending = new Map();
          send(`event: change\ndata: ${JSON.stringify(batch)}\n\n`);
        }, 150);
      });
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      const recheck = setInterval(async () => {
        const stillThere =
          (await currentSession(request)) && (await isActiveAdmin(session.userId, session.email));
        if (!stillThere) {
          cleanup();
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }, RECHECK_MS);

      const close = () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      const mine = streams.get(session.userId) ?? new Set<() => void>();
      streams.set(session.userId, mine);
      mine.add(close);
      while (mine.size > MAX_STREAMS_PER_USER) {
        const oldest = mine.values().next().value as () => void;
        mine.delete(oldest);
        oldest();
      }

      cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
        clearInterval(recheck);
        if (flush) clearTimeout(flush);
        mine.delete(close);
        if (mine.size === 0) streams.delete(session.userId);
        cleanup = () => {};
      };
      request.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
