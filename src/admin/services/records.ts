import { unwrap } from "../lib/errors";
import type { FilterOperator } from "../lib/fields/registry";
import type { EntityKey, EntityRecord } from "../lib/fields/types";
import { getDb } from "../lib/db/client";

export const ENTITY_TABLES: Record<EntityKey, string> = {
  order: "orders",
  vehicle: "vehicles",
  driver: "drivers",
  customer: "customers",
};

export const ENTITY_PATHS: Record<EntityKey, string> = {
  order: "/admin/orders",
  vehicle: "/admin/vehicles",
  driver: "/admin/drivers",
  customer: "/admin/customers",
};

export interface RecordFilter {
  field: string;
  op: FilterOperator;
  value?: unknown;
}

export interface RecordSort {
  field: string;
  direction: "asc" | "desc";
}

export type ArchiveScope = "active" | "archived" | "all";

export interface ListQuery {
  search?: string;
  filters?: RecordFilter[];
  sort?: RecordSort | null;
  limit?: number;
  offset?: number;
  archived?: ArchiveScope;
}

export interface OrderRow extends EntityRecord {
  order_number: string;
  status: OrderStatus;
  customer_id: string;
  pickup_at: string | null;
  delivery_at: string | null;
  customer?: { id: string; display_name: string; archived_at: string | null } | null;
  assignment?: {
    id: string;
    driver_id: string | null;
    vehicle_id: string | null;
    driver_name: string | null;
    vehicle_name: string | null;
    starts_at: string;
    ends_at: string;
  } | null;
}

export interface ResourceRow extends EntityRecord {
  available: boolean;
  pairing?: {
    id: string;
    vehicle_id?: string;
    vehicle_name?: string;
    driver_id?: string;
    driver_name?: string;
  } | null;
}

export type OrderStatus =
  "draft" | "confirmed" | "scheduled" | "in_transit" | "delivered" | "cancelled";

export interface ListResult<T = EntityRecord> {
  rows: T[];
  total: number;
  /** Orders: how many match each status (all other filters applied). */
  statusCounts?: Partial<Record<OrderStatus, number>>;
}

/** One page of an entity list: search, filters and sort are applied server-side. */
export async function listRecords<T = EntityRecord>(
  entity: EntityKey,
  query: ListQuery = {},
): Promise<ListResult<T>> {
  const result = unwrap(
    await getDb().rpc("list_records", {
      p_entity: entity,
      p_search: query.search?.trim() || null,
      p_filters: query.filters ?? [],
      p_sort: query.sort ?? null,
      p_limit: query.limit ?? 25,
      p_offset: query.offset ?? 0,
      p_archived: query.archived ?? "active",
    }),
  ) as { rows: T[]; total: number; facets?: { status?: Partial<Record<OrderStatus, number>> } };
  return {
    rows: result.rows ?? [],
    total: Number(result.total ?? 0),
    statusCounts: result.facets?.status,
  };
}

/** Every matching row, page by page (CSV exports). */
export async function listAllRecords<T = EntityRecord>(
  entity: EntityKey,
  query: Omit<ListQuery, "limit" | "offset">,
  max = 10_000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < max; offset += 500) {
    const page = await listRecords<T>(entity, { ...query, limit: 500, offset });
    rows.push(...page.rows);
    if (page.rows.length < 500 || rows.length >= page.total) break;
  }
  return rows;
}

export async function getRecord<T = EntityRecord>(entity: EntityKey, id: string): Promise<T> {
  return unwrap(
    await getDb().from(ENTITY_TABLES[entity]).select("*").eq("id", id).single(),
  ) as T;
}

export interface RecordWrite {
  attributes?: Record<string, unknown>;
  columns?: Record<string, unknown>;
}

export async function createRecord<T = EntityRecord>(
  entity: EntityKey,
  write: RecordWrite,
): Promise<T> {
  return unwrap(
    await getDb()
      .from(ENTITY_TABLES[entity])
      .insert({ ...(write.columns ?? {}), attributes: write.attributes ?? {} })
      .select()
      .single(),
  ) as T;
}

export async function updateRecord<T = EntityRecord>(
  entity: EntityKey,
  id: string,
  write: RecordWrite,
): Promise<T> {
  const patch: Record<string, unknown> = { ...(write.columns ?? {}) };
  if (write.attributes) patch.attributes = write.attributes;
  return unwrap(
    await getDb().from(ENTITY_TABLES[entity]).update(patch).eq("id", id).select().single(),
  ) as T;
}

export async function setRecordArchived(
  entity: EntityKey,
  id: string,
  archived: boolean,
): Promise<void> {
  unwrap(
    await getDb()
      .from(ENTITY_TABLES[entity])
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id)
      .select("id")
      .single(),
  );
}

export async function setResourceAvailable(
  entity: "driver" | "vehicle",
  id: string,
  available: boolean,
) {
  unwrap(
    await getDb()
      .from(ENTITY_TABLES[entity])
      .update({ available })
      .eq("id", id)
      .select("id")
      .single(),
  );
}

export async function deleteRecord(entity: EntityKey, id: string): Promise<void> {
  const result = await getDb().from(ENTITY_TABLES[entity]).delete().eq("id", id).select("id");
  const rows = unwrap(result) as { id: string }[];
  if (!rows.length) throw new Error("The record could not be deleted.");
}

export interface RecordName {
  id: string;
  display_name: string;
  archived_at: string | null;
}

/** Records for relation pickers: name search over current records. */
export async function searchRecordNames(
  entity: EntityKey,
  search: string,
  limit = 20,
): Promise<RecordName[]> {
  let query = getDb()
    .from(ENTITY_TABLES[entity])
    .select("id, display_name, archived_at")
    .is("archived_at", null)
    .order("display_name")
    .limit(limit);
  const term = search.trim();
  if (term) query = query.ilike("display_name", `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  return unwrap(await query) as RecordName[];
}

/** Names of specific records (archived included), for displaying relations. */
export async function fetchRecordNames(
  entity: EntityKey,
  ids: readonly string[],
): Promise<RecordName[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return [];
  return unwrap(
    await getDb()
      .from(ENTITY_TABLES[entity])
      .select("id, display_name, archived_at")
      .in("id", unique),
  ) as RecordName[];
}

/** Most recent orders of a customer (the system relation, independent of list filters). */
export async function fetchCustomerOrders(customerId: string, limit = 10): Promise<OrderRow[]> {
  return unwrap(
    await getDb()
      .from("orders")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ) as OrderRow[];
}

export interface BulkResult {
  id: string;
  ok: boolean;
  changed?: boolean;
  error?: string;
}

/** Changes the status of many orders; each succeeds or fails on its own. */
export async function bulkChangeOrderStatus(
  ids: string[],
  status: OrderStatus,
  note?: string,
): Promise<BulkResult[]> {
  return unwrap(
    await getDb().rpc("bulk_change_order_status", {
      p_order_ids: ids,
      p_status: status,
      p_note: note || null,
    }),
  ) as BulkResult[];
}

/** Archives or restores many records; each succeeds or fails on its own. */
export async function bulkSetArchived(
  entity: EntityKey,
  ids: string[],
  archived: boolean,
): Promise<BulkResult[]> {
  return unwrap(
    await getDb().rpc("bulk_set_archived", { p_entity: entity, p_ids: ids, p_archived: archived }),
  ) as BulkResult[];
}

export interface SearchHit {
  entity: EntityKey;
  id: string;
  title: string;
  subtitle: string | null;
  status: OrderStatus | null;
  archived: boolean;
}

/** A few matches per entity, using each entity's searchable fields. */
export async function globalSearch(query: string, limit = 5): Promise<SearchHit[]> {
  return unwrap(await getDb().rpc("global_search", { p_query: query, p_limit: limit })) as SearchHit[];
}

export interface NavCounts {
  awaiting_dispatch: number;
  overdue: number;
  in_transit: number;
}

export async function fetchNavCounts(): Promise<NavCounts> {
  return unwrap(await getDb().rpc("nav_counts")) as NavCounts;
}
