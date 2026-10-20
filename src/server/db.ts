import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { requireConfig } from "./config";

/**
 * Database access through Prisma Client (prisma/schema.prisma). The server
 * connects as DATABASE_URL, a role that owns nothing; the database enforces
 * the rules itself — row-level security, column grants and SECURITY DEFINER
 * functions, all defined by the SQL migrations in prisma/migrations.
 */

const globalDb = globalThis as typeof globalThis & { __bsrPrisma?: PrismaClient };

/** The shared client: one connection pool per server process. */
export function db(): PrismaClient {
  if (!globalDb.__bsrPrisma) {
    const adapter = new PrismaPg({
      connectionString: requireConfig().databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    });
    globalDb.__bsrPrisma = new PrismaClient({ adapter });
  }
  return globalDb.__bsrPrisma;
}

/** The transaction client handed to withIdentity() callbacks. */
export type Tx = Prisma.TransactionClient;

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
 *
 * Use raw SQL inside (tx.$queryRaw): Prisma's model queries read every column
 * of a table, and the request roles may only see some of them.
 */
export async function withIdentity<T>(
  identity: RequestIdentity,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const role = identity.userId ? "authenticated" : "anon";
  const claims = identity.userId
    ? { sub: identity.userId, role, email: identity.email ?? undefined, aud: "authenticated" }
    : { role };
  try {
    return await db().$transaction(
      async (tx) => {
        // set_config(…, true) is SET LOCAL: it ends with the transaction.
        await tx.$executeRaw`select set_config('role', ${role}, true),
                                    set_config('request.jwt.claims', ${JSON.stringify(claims)}, true),
                                    set_config('statement_timeout', '20s', true)`;
        return fn(tx);
      },
      { maxWait: 8_000, timeout: 30_000 },
    );
  } catch (error) {
    throw databaseError(error) ?? error;
  }
}

/** An error as PostgreSQL reported it. */
export class DatabaseError extends Error {
  constructor(
    message: string,
    /** SQLSTATE, e.g. 42501 (not allowed) or 23505 (duplicate). */
    readonly code: string | null,
    readonly detail: string | null,
    readonly hint: string | null,
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

interface AdapterCause {
  originalCode?: string;
  originalMessage?: string;
  code?: string;
  message?: string;
  detail?: string;
  hint?: string;
}

/**
 * The PostgreSQL error inside an error thrown by Prisma, or null when there is
 * none (a connection failure, or an error of our own).
 */
export function databaseError(error: unknown): DatabaseError | null {
  if (error instanceof DatabaseError) return error;
  const e = error as {
    name?: string;
    cause?: AdapterCause;
    meta?: { driverAdapterError?: { cause?: AdapterCause } };
  } | null;
  const cause =
    e?.meta?.driverAdapterError?.cause ?? (e?.name === "DriverAdapterError" ? e.cause : undefined);
  const message = cause?.originalMessage ?? cause?.message;
  if (!cause || !message) return null;
  const code = cause.originalCode ?? cause.code;
  return new DatabaseError(
    message,
    code && code !== "N/A" ? code : null,
    cause.detail ?? null,
    cause.hint ?? null,
  );
}

export interface DbErrorBody {
  message: string;
  details: string | null;
  hint: string | null;
  code: string | null;
}

/** The error shape the panel's services understand. */
export function toErrorBody(error: unknown): DbErrorBody {
  const e = databaseError(error);
  if (e) return { message: e.message, details: e.detail, hint: e.hint, code: e.code };
  return {
    message: (error as { message?: string } | null)?.message ?? "Database error",
    details: null,
    hint: null,
    code: null,
  };
}
