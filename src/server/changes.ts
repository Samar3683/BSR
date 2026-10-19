import pg from "pg";

import { requireConfig } from "./config";

/**
 * One database connection per server process listens on the `bsr_changes`
 * channel (see the realtime migration) and hands every notification to the
 * open event streams. Only a table name and an operation travel this way; no
 * row data. If the connection drops it is re-established with a growing delay.
 */

export interface Change {
  /** Table that changed. */
  t: string;
  /** INSERT, UPDATE or DELETE. */
  op: string;
}

type Listener = (change: Change) => void;

interface Hub {
  clock: ReturnType<typeof setInterval> | null;
  listeners: Set<Listener>;
  client: pg.Client | null;
  connecting: boolean;
  retryMs: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
}

const globalHub = globalThis as typeof globalThis & { __bsrChanges?: Hub };

function hub(): Hub {
  globalHub.__bsrChanges ??= {
    clock: null,
    listeners: new Set(),
    client: null,
    connecting: false,
    retryMs: 1000,
    retryTimer: null,
  };
  return globalHub.__bsrChanges;
}

function scheduleReconnect(h: Hub) {
  if (h.retryTimer || h.listeners.size === 0) return;
  h.retryTimer = setTimeout(() => {
    h.retryTimer = null;
    void connect(h);
  }, h.retryMs);
  h.retryMs = Math.min(h.retryMs * 2, 15_000);
}

async function connect(h: Hub): Promise<void> {
  if (h.client || h.connecting) return;
  h.connecting = true;
  const client = new pg.Client({ connectionString: requireConfig().databaseUrl });
  const lost = () => {
    if (h.client === client) h.client = null;
    client.removeAllListeners();
    client.on("error", () => undefined);
    void client.end().catch(() => undefined);
    scheduleReconnect(h);
  };
  client.on("error", lost);
  client.on("end", lost);
  client.on("notification", (message) => {
    try {
      const change = JSON.parse(message.payload ?? "") as Change;
      if (typeof change.t === "string") for (const listener of h.listeners) listener(change);
    } catch {
      // Ignore a payload that is not ours.
    }
  });
  try {
    await client.connect();
    await client.query("listen bsr_changes");
    h.client = client;
    h.retryMs = 1000;
  } catch {
    lost();
  } finally {
    h.connecting = false;
  }
}

/** Calls `listener` for every database change until the returned function is called. */
export function subscribeToChanges(listener: Listener): () => void {
  const h = hub();
  h.listeners.add(listener);
  void connect(h);
  // Figures that depend on the time of day (overdue, due soon, free now) change
  // without any edit: one shared tick a minute tells every open screen, instead
  // of every screen polling on its own. It only runs while someone is listening.
  h.clock ??= setInterval(() => {
    for (const each of h.listeners) each({ t: "clock", op: "TICK" });
  }, 60_000);
  return () => {
    h.listeners.delete(listener);
    if (h.listeners.size === 0 && h.clock) {
      clearInterval(h.clock);
      h.clock = null;
    }
  };
}
