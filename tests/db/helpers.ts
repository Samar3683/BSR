import { randomUUID } from "node:crypto";

import pg from "pg";

/**
 * Database test harness. Connects as the migration owner (postgres) to a
 * Supabase database (local stack or `supabase start`), and runs every test
 * inside a transaction that is rolled back, so nothing persists.
 * Requests are simulated exactly as PostgREST makes them: SET LOCAL ROLE plus
 * the JWT claims in request.jwt.claims.
 */
export const DB_URL =
  process.env.DATABASE_ADMIN_URL ?? "postgresql://postgres@localhost:54320/bsr";

export type Db = pg.PoolClient;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: DB_URL, max: 2 });
  return pool;
}

export async function closePool() {
  await pool?.end();
  pool = null;
}

/** Runs fn in a transaction that is always rolled back. */
export async function inTransaction<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    return await fn(client);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}

export type Role = "anon" | "authenticated" | "service_role" | "postgres";

/** Switch the simulated request identity (transaction-local). */
export async function actAs(db: Db, role: Role, userId?: string, email?: string) {
  await db.query("reset role");
  if (role === "postgres") {
    await db.query("select set_config('request.jwt.claims', '', true)");
    return;
  }
  const claims = userId ? { sub: userId, role, email, aud: "authenticated" } : { role };
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
  await db.query(`set local role ${role}`);
}

export interface DbError {
  code?: string;
  message: string;
  detail?: string;
  hint?: string;
}

/** Expects a statement to fail; the transaction stays usable (savepoint). */
export async function expectFailure(db: Db, sql: string, params: unknown[] = []): Promise<DbError> {
  await db.query("savepoint expect_failure");
  try {
    await db.query(sql, params);
  } catch (error) {
    await db.query("rollback to savepoint expect_failure");
    return error as DbError;
  }
  await db.query("release savepoint expect_failure");
  throw new Error(`Expected failure, but it succeeded: ${sql}`);
}

export function fieldErrors(error: DbError): Record<string, string> {
  return error.detail ? (JSON.parse(error.detail) as Record<string, string>) : {};
}

export interface Fixtures {
  adminId: string;
  otherAdminId: string;
  inactiveAdminId: string;
  userId: string;
}

/** Auth users: two active admins, an inactive admin and a plain user. */
export async function createUsers(db: Db): Promise<Fixtures> {
  await actAs(db, "postgres");
  const ids = {
    adminId: randomUUID(),
    otherAdminId: randomUUID(),
    inactiveAdminId: randomUUID(),
    userId: randomUUID(),
  };
  for (const [key, id] of Object.entries(ids)) {
    await db.query(
      "insert into auth.users (id, email, aud, role) values ($1, $2, 'authenticated', 'authenticated')",
      [id, `${key.toLowerCase()}-${id.slice(0, 8)}@bsr.test`],
    );
  }
  await db.query(
    `insert into public.admin_profiles (user_id, display_name, active) values
       ($1, 'Admin One', true), ($2, 'Admin Two', true), ($3, 'Inactive Admin', false)`,
    [ids.adminId, ids.otherAdminId, ids.inactiveAdminId],
  );
  return ids;
}

export async function one<T = Record<string, unknown>>(
  db: Db,
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  const result = await db.query(sql, params);
  if (result.rowCount !== 1) throw new Error(`Expected one row, got ${result.rowCount}: ${sql}`);
  return result.rows[0] as T;
}

export async function optionId(
  db: Db,
  entity: string,
  fieldKey: string,
  label: string,
): Promise<string> {
  const row = await one<{ id: string }>(
    db,
    `select o.id from public.field_options o join public.field_definitions f on f.id = o.field_id
      where f.entity_type = $1 and f.field_key = $2 and o.label = $3`,
    [entity, fieldKey, label],
  );
  return row.id;
}

/** Inserts the minimal valid records of the seeded configuration (as the current role). */
export async function createCustomer(db: Db, name = "Rossi Srl"): Promise<string> {
  return (
    await one<{ id: string }>(
      db,
      "insert into public.customers (attributes) values ($1) returning id",
      [{ company_name: name }],
    )
  ).id;
}

export async function createDriver(db: Db, name: string): Promise<string> {
  return (
    await one<{ id: string }>(
      db,
      "insert into public.drivers (attributes) values ($1) returning id",
      [{ full_name: name }],
    )
  ).id;
}

export async function createVehicle(db: Db, plate: string): Promise<string> {
  const van = await optionId(db, "vehicle", "vehicle_type", "Van");
  return (
    await one<{ id: string }>(
      db,
      "insert into public.vehicles (attributes) values ($1) returning id",
      [{ plate, vehicle_type: van }],
    )
  ).id;
}

export async function createOrder(
  db: Db,
  customerId: string,
  pickup: string,
  delivery: string,
  status: "draft" | "confirmed" = "confirmed",
): Promise<string> {
  return (
    await one<{ id: string }>(
      db,
      `insert into public.orders (customer_id, status, pickup_at, delivery_at, attributes)
       values ($1, $2, $3, $4, $5) returning id`,
      [
        customerId,
        status,
        pickup,
        delivery,
        {
          pickup_address: { line1: "Via Roma 1", city: "Milano" },
          delivery_address: { line1: "Via Po 2", city: "Torino" },
        },
      ],
    )
  ).id;
}

/** ISO instant `hours` from now (relative to the transaction clock is fine for windows). */
export function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}
