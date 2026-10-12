/**
 * The panel's data client.
 *
 * It keeps the small query-builder surface the services use (from / select /
 * insert / update / delete / filters / rpc) and sends each call to the panel's
 * own API (`/admin/api/rest`, `/admin/api/rpc/<function>`), which runs it
 * in PostgreSQL as the signed-in user. The browser never sees a database
 * credential: the only secret is the httpOnly session cookie.
 */

export interface DbError {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
  name?: string;
  status?: number;
}

export interface DbResult<T = unknown> {
  data: T;
  error: DbError | null;
  count?: number | null;
}

export const UNAUTHORIZED_EVENT = "bsr-admin-unauthorized";

type Filter =
  | {
      op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is" | "in";
      column: string;
      value: unknown;
    }
  | { op: "or"; expr: string };

interface Op {
  table: string;
  action: "select" | "insert" | "update" | "delete";
  columns?: string;
  returning?: boolean;
  values?: unknown;
  filters: Filter[];
  order: { column: string; ascending: boolean }[];
  range?: [number, number];
  limit?: number;
  single?: boolean;
  count?: "exact";
}

export interface ClientOptions {
  /** Base URL; empty in the browser (same origin). */
  baseUrl?: string;
  /** Extra headers, e.g. a Cookie header for server-side callers such as tests. */
  headers?: Record<string, string>;
}

async function post(
  options: ClientOptions,
  path: string,
  body: unknown,
): Promise<DbResult<unknown>> {
  let response: Response;
  try {
    response = await fetch(`${options.baseUrl ?? ""}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...options.headers },
      body: JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : "Failed to fetch" },
    };
  }
  let payload: { data?: unknown; error?: DbError | null; count?: number | null } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    payload = { error: { message: `Unexpected response (${response.status})` } };
  }
  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  if (!response.ok && !payload.error) {
    payload.error = { message: `Request failed (${response.status})`, status: response.status };
  }
  return { data: payload.data ?? null, error: payload.error ?? null, count: payload.count };
}

/** Rows are untyped here; each service casts what it reads. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

class QueryBuilder implements PromiseLike<DbResult<Loose>> {
  private readonly op: Op;

  constructor(
    private readonly options: ClientOptions,
    table: string,
  ) {
    this.op = { table, action: "select", filters: [], order: [] };
  }

  select(columns = "*", options?: { count?: "exact" }) {
    if (this.op.action === "select") this.op.columns = columns;
    else {
      this.op.returning = true;
      this.op.columns = columns;
    }
    if (options?.count) this.op.count = options.count;
    return this;
  }

  insert(values: unknown) {
    this.op.action = "insert";
    this.op.values = values;
    return this;
  }

  update(values: unknown) {
    this.op.action = "update";
    this.op.values = values;
    return this;
  }

  delete() {
    this.op.action = "delete";
    return this;
  }

  private add(op: Filter["op"], column: string, value: unknown) {
    this.op.filters.push({ op, column, value } as Filter);
    return this;
  }

  eq(column: string, value: unknown) {
    return this.add("eq", column, value);
  }
  neq(column: string, value: unknown) {
    return this.add("neq", column, value);
  }
  gt(column: string, value: unknown) {
    return this.add("gt", column, value);
  }
  gte(column: string, value: unknown) {
    return this.add("gte", column, value);
  }
  lt(column: string, value: unknown) {
    return this.add("lt", column, value);
  }
  lte(column: string, value: unknown) {
    return this.add("lte", column, value);
  }
  like(column: string, value: string) {
    return this.add("like", column, value);
  }
  ilike(column: string, value: string) {
    return this.add("ilike", column, value);
  }
  is(column: string, value: null | boolean) {
    return this.add("is", column, value);
  }
  in(column: string, values: readonly unknown[]) {
    return this.add("in", column, [...values]);
  }

  /** `column.op.value` conditions joined by commas, any of which may match. */
  or(expr: string) {
    this.op.filters.push({ op: "or", expr });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.op.order.push({ column, ascending: options.ascending ?? true });
    return this;
  }

  range(from: number, to: number) {
    this.op.range = [from, to];
    return this;
  }

  limit(count: number) {
    this.op.limit = count;
    return this;
  }

  single() {
    this.op.single = true;
    return this;
  }

  then<TResult1 = DbResult<Loose>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<Loose>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return post(this.options, "/admin/api/rest", this.op).then(onfulfilled, onrejected);
  }
}

class RpcBuilder implements PromiseLike<DbResult<Loose>> {
  constructor(
    private readonly options: ClientOptions,
    private readonly name: string,
    private readonly args: Record<string, unknown>,
  ) {}

  then<TResult1 = DbResult<Loose>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<Loose>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return post(this.options, `/admin/api/rpc/${encodeURIComponent(this.name)}`, this.args).then(
      onfulfilled,
      onrejected,
    );
  }
}

export interface DbClient {
  from(table: string): QueryBuilder;
  rpc(name: string, args?: Record<string, unknown>): RpcBuilder;
}

export function createDbClient(options: ClientOptions = {}): DbClient {
  return {
    from: (table) => new QueryBuilder(options, table),
    rpc: (name, args = {}) => new RpcBuilder(options, name, args),
  };
}

let browserClient: DbClient | null = null;

/** The panel's browser client (same origin; the session cookie authenticates). */
export function getDb(): DbClient {
  browserClient ??= createDbClient();
  return browserClient;
}
