import type pg from "pg";

/**
 * Table and function access for the admin panel.
 *
 * The browser describes a query (table, filters, ordering, values) as JSON;
 * this module turns it into one parameterised SQL statement against the
 * `public` schema and runs it as the signed-in user, so row-level security and
 * column grants decide what is visible and writable. Identifiers are
 * validated, values are always bound parameters.
 */

export type RestFilter =
  | {
      op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is" | "in";
      column: string;
      value: unknown;
    }
  | { op: "or"; expr: string };

export interface RestOp {
  table: string;
  action: "select" | "insert" | "update" | "delete";
  /** Columns to return: "*" or a comma-separated list. */
  columns?: string;
  /** Mutations return rows only when select() was chained. */
  returning?: boolean;
  values?: Record<string, unknown> | Record<string, unknown>[];
  filters?: RestFilter[];
  order?: { column: string; ascending: boolean }[];
  range?: [number, number];
  limit?: number;
  single?: boolean;
  count?: "exact";
}

export class RestError extends Error {
  constructor(
    message: string,
    readonly code = "PGRST100",
    readonly status = 400,
    readonly details: string | null = null,
  ) {
    super(message);
  }
}

export interface ColumnTypes {
  [column: string]: { json: boolean; array: boolean };
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const MAX_ROWS = 10_000;

export function quoteIdent(name: string): string {
  if (!IDENT.test(name)) throw new RestError(`Invalid identifier "${name}"`);
  return `"${name}"`;
}

/** A column, or a text lookup inside a json column ("context->>order_id"). */
export function columnExpr(expr: string): string {
  const [column, key, ...rest] = expr.split("->>");
  if (rest.length || !column) throw new RestError(`Invalid column "${expr}"`);
  if (key === undefined) return quoteIdent(column);
  if (!IDENT.test(key)) throw new RestError(`Invalid json key "${key}"`);
  return `${quoteIdent(column)}->>'${key}'`;
}

const OPERATORS = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "like",
  ilike: "ilike",
} as const;

type Params = unknown[];

function bind(params: Params, value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}

/** Splits an or() expression on top-level commas (not inside parentheses). */
function splitOr(expr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of expr) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  if (current) parts.push(current);
  return parts;
}

function orCondition(expr: string, params: Params): string {
  const conditions = splitOr(expr).map((part) => {
    const first = part.indexOf(".");
    const second = part.indexOf(".", first + 1);
    if (first < 1 || second < 0) throw new RestError(`Invalid or() condition "${part}"`);
    const column = part.slice(0, first);
    const op = part.slice(first + 1, second) as keyof typeof OPERATORS | "is";
    const value = part.slice(second + 1);
    if (op === "is") {
      return `${columnExpr(column)} is ${value === "null" ? "null" : value === "true" ? "true" : "false"}`;
    }
    if (!(op in OPERATORS)) throw new RestError(`Unsupported operator "${op}"`);
    // Compare as text so a mismatched value cannot fail the cast (like PostgREST's text search).
    return `${columnExpr(column)}::text ${OPERATORS[op]} ${bind(params, value)}`;
  });
  if (!conditions.length) throw new RestError("Empty or() expression");
  return `(${conditions.join(" or ")})`;
}

export function buildWhere(filters: RestFilter[] | undefined, params: Params): string {
  if (!filters?.length) return "";
  const conditions = filters.map((filter) => {
    if (filter.op === "or") return orCondition(filter.expr, params);
    const column = columnExpr(filter.column);
    switch (filter.op) {
      case "is":
        if (filter.value === null) return `${column} is null`;
        if (filter.value === true) return `${column} is true`;
        if (filter.value === false) return `${column} is false`;
        throw new RestError("is() accepts null, true or false");
      case "in":
        if (!Array.isArray(filter.value)) throw new RestError("in() needs a list");
        return `${column} = any(${bind(params, filter.value)})`;
      default:
        return `${column} ${OPERATORS[filter.op]} ${bind(params, filter.value)}`;
    }
  });
  return ` where ${conditions.join(" and ")}`;
}

function selectList(columns: string | undefined): string {
  if (!columns || columns.trim() === "*") return "*";
  return columns
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => (c === "*" ? "*" : quoteIdent(c)))
    .join(", ");
}

function prepare(value: unknown, type: ColumnTypes[string] | undefined): unknown {
  if (value === undefined || value === null) return null;
  if (type?.json) return JSON.stringify(value);
  if (type?.array && Array.isArray(value)) return value;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

export interface BuiltStatement {
  text: string;
  params: Params;
  /** A matching count query when the caller asked for an exact count. */
  countText?: string;
  countParams?: Params;
}

export function buildStatement(op: RestOp, types: ColumnTypes = {}): BuiltStatement {
  const table = `public.${quoteIdent(op.table)}`;
  const params: Params = [];
  const returning = op.returning ? ` returning ${selectList(op.columns)}` : "";

  if (op.action === "select") {
    const where = buildWhere(op.filters, params);
    const order = op.order?.length
      ? ` order by ${op.order.map((o) => `${columnExpr(o.column)} ${o.ascending ? "asc" : "desc"}`).join(", ")}`
      : "";
    let limit = "";
    if (op.range) {
      const [from, to] = op.range;
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from)
        throw new RestError("Invalid range");
      limit = ` limit ${Math.min(to - from + 1, MAX_ROWS)} offset ${from}`;
    } else if (op.limit !== undefined) {
      if (!Number.isInteger(op.limit) || op.limit < 0) throw new RestError("Invalid limit");
      limit = ` limit ${Math.min(op.limit, MAX_ROWS)}`;
    } else {
      limit = ` limit ${MAX_ROWS}`;
    }
    const built: BuiltStatement = {
      text: `select ${selectList(op.columns)} from ${table}${where}${order}${limit}`,
      params,
    };
    if (op.count === "exact") {
      const countParams: Params = [];
      built.countText = `select count(*) as count from ${table}${buildWhere(op.filters, countParams)}`;
      built.countParams = countParams;
    }
    return built;
  }

  if (op.action === "insert") {
    const rows = Array.isArray(op.values) ? op.values : op.values ? [op.values] : [];
    if (!rows.length) throw new RestError("Nothing to insert");
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    if (!columns.length) {
      return { text: `insert into ${table} default values${returning}`, params };
    }
    const tuples = rows.map(
      (row) =>
        `(${columns
          .map((c) => (c in row ? bind(params, prepare(row[c], types[c])) : "default"))
          .join(", ")})`,
    );
    return {
      text: `insert into ${table} (${columns.map(quoteIdent).join(", ")}) values ${tuples.join(", ")}${returning}`,
      params,
    };
  }

  if (op.action === "update") {
    const values = (Array.isArray(op.values) ? op.values[0] : op.values) ?? {};
    const keys = Object.keys(values);
    if (!keys.length) throw new RestError("Nothing to update");
    const sets = keys.map(
      (k) => `${quoteIdent(k)} = ${bind(params, prepare(values[k], types[k]))}`,
    );
    return {
      text: `update ${table} set ${sets.join(", ")}${buildWhere(op.filters, params)}${returning}`,
      params,
    };
  }

  if (!op.filters?.length) throw new RestError("delete() needs a filter");
  return {
    text: `delete from ${table}${buildWhere(op.filters, params)}${returning}`,
    params,
  };
}

// ----------------------------------------------------------------- execution

const typeCache = new Map<string, { at: number; types: ColumnTypes }>();

async function columnTypes(client: pg.PoolClient, table: string): Promise<ColumnTypes> {
  const cached = typeCache.get(table);
  if (cached && Date.now() - cached.at < 60_000) return cached.types;
  const { rows } = await client.query<{ attname: string; typname: string }>(
    `select a.attname, t.typname
       from pg_attribute a
       join pg_type t on t.oid = a.atttypid
      where a.attrelid = to_regclass($1) and a.attnum > 0 and not a.attisdropped`,
    [`public.${quoteIdent(table)}`],
  );
  const types: ColumnTypes = {};
  for (const row of rows) {
    types[row.attname] = {
      json: row.typname === "json" || row.typname === "jsonb",
      array: row.typname.startsWith("_"),
    };
  }
  typeCache.set(table, { at: Date.now(), types });
  return types;
}

export interface RestResult {
  data: unknown;
  count?: number;
}

export async function executeRest(client: pg.PoolClient, op: RestOp): Promise<RestResult> {
  const types =
    op.action === "insert" || op.action === "update" ? await columnTypes(client, op.table) : {};
  const built = buildStatement(op, types);
  const result = await client.query(built.text, built.params);

  let count: number | undefined;
  if (built.countText) {
    const counted = await client.query<{ count: number }>(built.countText, built.countParams);
    count = Number(counted.rows[0]?.count ?? 0);
  }

  const returnsRows = op.action === "select" || op.returning;
  if (!returnsRows) return { data: null };
  if (op.single) {
    if (result.rows.length !== 1) {
      throw new RestError(
        "JSON object requested, multiple (or no) rows returned",
        "PGRST116",
        406,
        `The result contains ${result.rows.length} rows`,
      );
    }
    return { data: result.rows[0], count };
  }
  return { data: result.rows, count };
}

// -------------------------------------------------------------------- functions

const fnCache = new Map<string, { at: number; info: FunctionInfo | null }>();

interface FunctionInfo {
  names: string[];
  types: string[];
  returnsSet: boolean;
  returnType: string;
}

const FUNCTION_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

async function functionInfo(client: pg.PoolClient, name: string): Promise<FunctionInfo | null> {
  const cached = fnCache.get(name);
  if (cached && Date.now() - cached.at < 60_000) return cached.info;
  const { rows } = await client.query<{
    argnames: string[] | null;
    argtypes: string[];
    proretset: boolean;
    rettype: string;
  }>(
    `select p.proargnames as argnames,
            array(select format_type(t, null) from unnest(string_to_array(p.proargtypes::text, ' ')::oid[]) t) as argtypes,
            p.proretset,
            format_type(p.prorettype, null) as rettype
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = $1 and p.prokind = 'f'
        and p.prorettype <> 'trigger'::regtype
      limit 1`,
    [name],
  );
  const row = rows[0];
  const info = row
    ? {
        names: (row.argnames ?? []).slice(0, row.argtypes.length),
        types: row.argtypes,
        returnsSet: row.proretset,
        returnType: row.rettype,
      }
    : null;
  fnCache.set(name, { at: Date.now(), info });
  return info;
}

/** Calls a function of the public schema with named arguments. */
export async function executeRpc(
  client: pg.PoolClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (!FUNCTION_NAME.test(name)) throw new RestError("Invalid function name", "PGRST202", 404);
  const info = await functionInfo(client, name);
  if (!info) throw new RestError(`Could not find the function public.${name}`, "PGRST202", 404);

  const params: Params = [];
  const named: string[] = [];
  for (const [key, value] of Object.entries(args ?? {})) {
    const index = info.names.indexOf(key);
    if (index < 0) {
      throw new RestError(`Unknown argument "${key}" for public.${name}`, "PGRST202", 404);
    }
    const type = info.types[index] ?? "";
    let bound: unknown = value;
    if (value === undefined) continue;
    if (value === null) bound = null;
    else if (type === "jsonb" || type === "json") bound = JSON.stringify(value);
    else if (type.endsWith("[]")) bound = Array.isArray(value) ? value : [value];
    else if (typeof value === "object") bound = JSON.stringify(value);
    named.push(`${quoteIdent(key)} => ${bind(params, bound)}::${type}`);
  }

  const call = `public.${quoteIdent(name)}(${named.join(", ")})`;
  if (info.returnType === "void") {
    await client.query(`select ${call}`, params);
    return null;
  }
  if (info.returnsSet) {
    const result = await client.query(`select * from ${call}`, params);
    const only = result.fields.length === 1 ? result.fields[0]?.name : null;
    return only === name ? result.rows.map((r) => r[only]) : result.rows;
  }
  const result = await client.query(`select ${call} as value`, params);
  return result.rows[0]?.value ?? null;
}
