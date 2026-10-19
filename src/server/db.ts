import pg from "pg";

import { requireConfig } from "./config";

/**
 * Value parsing for JSON responses: bigint counts become numbers, dates stay
 * plain "YYYY-MM-DD" strings (no timezone shifts), timestamps become ISO strings.
 */
const typeParsers = {
  getTypeParser(oid: number, format?: "text" | "binary") {
    switch (oid) {
      case 20: // int8
        return (value: string) => {
          const n = Number(value);
          return Number.isSafeInteger(n) ? n : value;
        };
      case 1082: // date
      case 1114: // timestamp without time zone
        return (value: string) => value;
      case 1184: // timestamptz
        return (value: string) => {
          const date = new Date(value);
          return Number.isNaN(date.getTime()) ? value : date.toISOString();
        };
      default:
        return pg.types.getTypeParser(oid, format as "text");
    }
  },
};

const globalPool = globalThis as typeof globalThis & { __bsrPool?: pg.Pool };

export function pool(): pg.Pool {
  if (!globalPool.__bsrPool) {
    const config = requireConfig();
    globalPool.__bsrPool = new pg.Pool({
      connectionString: config.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg's `types` option
      types: typeParsers as any,
    });
    globalPool.__bsrPool.on("error", () => {
      // An idle client failed; the pool replaces it on next use.
    });
  }
  return globalPool.__bsrPool;
}

export interface RequestIdentity {
  /** The signed-in user; null for an anonymous request. */
  userId: string | null;
  email?: string | null;
}

/**
 * Runs `fn` in a transaction that behaves like one API request of a signed-in
 * user: the connection switches to the `authenticated` (or `anon`) role and
 * carries the user in `request.jwt.claims`, so row-level security, column
 * grants and auth.uid() all apply exactly as in the database design.
 */
export async function withIdentity<T>(
  identity: RequestIdentity,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool().connect();
  try {
    const role = identity.userId ? "authenticated" : "anon";
    const claims = identity.userId
      ? { sub: identity.userId, role, email: identity.email ?? undefined, aud: "authenticated" }
      : { role };
    // One round trip: transaction, request role, claims and timeout together.
    await client.query(
      `begin; set local role ${role}; ` +
        `select set_config('request.jwt.claims', ${client.escapeLiteral(JSON.stringify(claims))}, true); ` +
        "set local statement_timeout = '20s'",
    );
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** The application's own connection, for the auth tables (no request role). */
export async function withApp<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export interface DbErrorBody {
  message: string;
  details: string | null;
  hint: string | null;
  code: string | null;
}

/** The error shape the panel's services understand. */
export function toErrorBody(error: unknown): DbErrorBody {
  const e = (error ?? {}) as { message?: string; detail?: string; hint?: string; code?: string };
  return {
    message: e.message ?? "Database error",
    details: e.detail ?? null,
    hint: e.hint ?? null,
    code: e.code ?? null,
  };
}
