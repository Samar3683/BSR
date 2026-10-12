import { unwrap } from "../lib/errors";
import { getDb } from "../lib/db/client";

export interface AuditEntry {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  actor_label: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  changed_fields: string[];
  context: Record<string, unknown>;
  /** Entries written by the same database transaction belong to one action. */
  transaction_id: number | null;
}

export interface AuditQuery {
  entityType?: string;
  action?: string;
  actorId?: string;
  entityId?: string;
  /** Entries about an order, including its assignments. */
  orderId?: string;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  order: "Order",
  vehicle: "Vehicle",
  driver: "Driver",
  customer: "Customer",
  order_assignment: "Order assignment",
  driver_vehicle_assignment: "Driver–vehicle pairing",
  field_definition: "Field",
  field_option: "Field option",
  entity_config: "Entity settings",
  admin_profile: "Administrator",
  dispatch_requirement: "Dispatch rule",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  archive: "Archived",
  restore: "Restored",
  status_change: "Status changed",
  assign: "Assigned",
  reassign: "Reassigned",
  unassign: "Unassigned",
  pair: "Paired",
  unpair: "Pairing ended",
  enable: "Enabled",
  disable: "Disabled",
};

/** Read-only: the audit log has no write path for any client. */
export async function fetchAuditLog(
  query: AuditQuery,
): Promise<{ rows: AuditEntry[]; total: number }> {
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  let request = getDb()
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (query.entityType) request = request.eq("entity_type", query.entityType);
  if (query.action) request = request.eq("action", query.action);
  if (query.actorId) request = request.eq("actor_id", query.actorId);
  if (query.entityId) request = request.eq("entity_id", query.entityId);
  if (query.orderId) request = request.eq("context->>order_id", query.orderId);
  if (query.from) request = request.gte("occurred_at", query.from);
  if (query.to) request = request.lt("occurred_at", query.to);
  if (query.search?.trim()) {
    const term = query.search.trim().replace(/[%_\\,()]/g, " ");
    request = request.or(
      `entity_label.ilike.%${term}%,actor_label.ilike.%${term}%,entity_id.eq.${term}`,
    );
  }
  const result = await request;
  const rows = unwrap(result) as AuditEntry[];
  return { rows, total: result.count ?? rows.length };
}
