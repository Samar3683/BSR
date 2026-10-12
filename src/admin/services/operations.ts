import { unwrap } from "../lib/errors";
import type { DispatchRequirement } from "../lib/requirements";
import { getSupabase } from "../lib/supabase/client";
import type { OrderStatus } from "./records";

// --------------------------------------------------------------------------
// Orders: status workflow and history
// --------------------------------------------------------------------------

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "draft",
  "confirmed",
  "scheduled",
  "in_transit",
  "delivered",
  "cancelled",
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  scheduled: "Scheduled",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Mirrors private.order_status_transition_allowed(). */
export const STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["draft", "scheduled", "cancelled"],
  scheduled: ["confirmed", "in_transit", "cancelled"],
  in_transit: ["scheduled", "delivered", "cancelled"],
  delivered: ["in_transit"],
  cancelled: ["confirmed"],
};

export async function changeOrderStatus(orderId: string, status: OrderStatus, note?: string) {
  return unwrap(
    await getSupabase().rpc("change_order_status", {
      p_order_id: orderId,
      p_status: status,
      p_note: note || null,
    }),
  );
}

export interface StatusHistoryEntry {
  id: number;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_at: string;
  changed_by_label: string | null;
  note: string | null;
}

export async function fetchStatusHistory(orderId: string): Promise<StatusHistoryEntry[]> {
  return unwrap(
    await getSupabase()
      .from("order_status_history")
      .select("*")
      .eq("order_id", orderId)
      .order("changed_at", { ascending: false })
      .order("id", { ascending: false }),
  ) as StatusHistoryEntry[];
}

// --------------------------------------------------------------------------
// Assignments
// --------------------------------------------------------------------------

export interface OrderAssignment {
  id: string;
  order_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  starts_at: string;
  ends_at: string;
  released_at: string | null;
  release_reason: string | null;
  note: string | null;
  created_at: string;
  driver?: { display_name: string } | null;
  vehicle?: { display_name: string } | null;
  order?: { order_number: string; status: OrderStatus; display_name: string } | null;
}

const ASSIGNMENT_SELECT =
  "*, driver:drivers(display_name), vehicle:vehicles(display_name), order:orders(order_number, status, display_name)";

export async function fetchOrderAssignments(orderId: string): Promise<OrderAssignment[]> {
  return unwrap(
    await getSupabase()
      .from("order_assignments")
      .select(ASSIGNMENT_SELECT)
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
  ) as OrderAssignment[];
}

/** Assignments of a driver or vehicle (history and upcoming). */
export async function fetchResourceAssignments(
  resource: "driver" | "vehicle",
  id: string,
  limit = 25,
): Promise<OrderAssignment[]> {
  return unwrap(
    await getSupabase()
      .from("order_assignments")
      .select(ASSIGNMENT_SELECT)
      .eq(resource === "driver" ? "driver_id" : "vehicle_id", id)
      .order("starts_at", { ascending: false })
      .limit(limit),
  ) as OrderAssignment[];
}

export async function assignOrder(
  orderId: string,
  driverId: string | null,
  vehicleId: string | null,
  note?: string,
) {
  return unwrap(
    await getSupabase().rpc("assign_order", {
      p_order_id: orderId,
      p_driver_id: driverId,
      p_vehicle_id: vehicleId,
      p_note: note || null,
    }),
  );
}

export async function unassignOrder(orderId: string, reason?: string) {
  return unwrap(
    await getSupabase().rpc("unassign_order", { p_order_id: orderId, p_reason: reason || null }),
  );
}

export interface DispatchCandidate {
  id: string;
  display_name: string;
  attributes: Record<string, unknown>;
  conflict: { order_id: string; order_number: string; starts_at: string; ends_at: string } | null;
  paired_vehicle_id?: string | null;
  paired_vehicle_name?: string | null;
  paired_driver_id?: string | null;
  paired_driver_name?: string | null;
}

export interface DispatchCandidates {
  order_id: string;
  window: { starts_at: string; ends_at: string } | null;
  current: { driver_id: string | null; vehicle_id: string | null; starts_at: string } | null;
  drivers: DispatchCandidate[];
  vehicles: DispatchCandidate[];
}

export async function fetchDispatchCandidates(orderId: string): Promise<DispatchCandidates> {
  return unwrap(
    await getSupabase().rpc("dispatch_candidates", { p_order_id: orderId }),
  ) as DispatchCandidates;
}

// --------------------------------------------------------------------------
// Driver ↔ vehicle pairings
// --------------------------------------------------------------------------

export interface Pairing {
  id: string;
  driver_id: string;
  vehicle_id: string;
  starts_at: string;
  ends_at: string | null;
  released_at: string | null;
  note: string | null;
  created_at: string;
  driver?: { display_name: string } | null;
  vehicle?: { display_name: string } | null;
}

const PAIRING_SELECT = "*, driver:drivers(display_name), vehicle:vehicles(display_name)";

/** A pairing is current when it has started and has not ended. */
export function isCurrentPairing(p: Pairing, now = Date.now()): boolean {
  const end = Math.min(
    p.ends_at ? Date.parse(p.ends_at) : Infinity,
    p.released_at ? Date.parse(p.released_at) : Infinity,
  );
  return Date.parse(p.starts_at) <= now && end > now;
}

/** A pairing is open when it has not ended yet (current or upcoming). */
export function isOpenPairing(p: Pairing, now = Date.now()): boolean {
  const end = Math.min(
    p.ends_at ? Date.parse(p.ends_at) : Infinity,
    p.released_at ? Date.parse(p.released_at) : Infinity,
  );
  return end > now && end > Date.parse(p.starts_at);
}

export async function fetchPairings(
  filter: { driverId?: string; vehicleId?: string; limit?: number } = {},
) {
  let query = getSupabase()
    .from("driver_vehicle_assignments")
    .select(PAIRING_SELECT)
    .order("starts_at", { ascending: false })
    .limit(filter.limit ?? 200);
  if (filter.driverId) query = query.eq("driver_id", filter.driverId);
  if (filter.vehicleId) query = query.eq("vehicle_id", filter.vehicleId);
  return unwrap(await query) as Pairing[];
}

export async function pairDriverVehicle(input: {
  driverId: string;
  vehicleId: string;
  startsAt?: string | null;
  endsAt?: string | null;
  note?: string;
}) {
  return unwrap(
    await getSupabase().rpc("pair_driver_vehicle", {
      p_driver_id: input.driverId,
      p_vehicle_id: input.vehicleId,
      p_starts_at: input.startsAt ?? null,
      p_ends_at: input.endsAt ?? null,
      p_note: input.note || null,
    }),
  );
}

export async function endPairing(id: string) {
  return unwrap(await getSupabase().rpc("end_driver_vehicle_pairing", { p_assignment_id: id }));
}

// --------------------------------------------------------------------------
// Dashboard and calendar
// --------------------------------------------------------------------------

export interface DashboardSummary {
  generated_at: string;
  counts: {
    pickups_today: number;
    in_transit: number;
    awaiting_dispatch: number;
    scheduled_next_7_days: number;
    delivered_last_30_days: number;
    overdue: number;
    drivers_total: number;
    drivers_free_now: number;
    vehicles_total: number;
    vehicles_free_now: number;
    customers_total: number;
  };
  status_distribution: { status: OrderStatus; count: number }[];
  upcoming: {
    id: string;
    order_number: string;
    display_name: string;
    status: OrderStatus;
    pickup_at: string;
    delivery_at: string | null;
    customer_name: string | null;
    driver_name: string | null;
    vehicle_name: string | null;
  }[];
  attention: {
    id: string;
    order_number: string;
    status: OrderStatus;
    pickup_at: string | null;
    delivery_at: string | null;
    customer_name: string | null;
    reason: "overdue" | "missing_window" | "unassigned_soon";
  }[];
  recent_activity: {
    order_id: string;
    order_number: string;
    from_status: OrderStatus | null;
    to_status: OrderStatus;
    changed_at: string;
    actor: string | null;
    note: string | null;
  }[];
}

export async function fetchDashboard(): Promise<DashboardSummary> {
  return unwrap(await getSupabase().rpc("dashboard_summary")) as DashboardSummary;
}

export interface CalendarEvent {
  id: string;
  order_number: string;
  display_name: string;
  status: OrderStatus;
  starts_at: string;
  ends_at: string;
  customer_id: string;
  customer_name: string;
  driver_id: string | null;
  driver_name: string | null;
  vehicle_id: string | null;
  vehicle_name: string | null;
  archived: boolean;
}

export interface CalendarFilters {
  driver_id?: string;
  vehicle_id?: string;
  customer_id?: string;
  status?: OrderStatus[];
  include_cancelled?: boolean;
}

export async function fetchCalendarEvents(
  from: Date,
  to: Date,
  filters: CalendarFilters,
): Promise<CalendarEvent[]> {
  return unwrap(
    await getSupabase().rpc("calendar_events", {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
      p_filters: filters,
    }),
  ) as CalendarEvent[];
}

// --------------------------------------------------------------------------
// Dispatch requirements (vehicle option → acceptable driver options)
// --------------------------------------------------------------------------

export async function fetchRequirements(): Promise<DispatchRequirement[]> {
  return unwrap(
    await getSupabase().from("dispatch_requirements").select("id, vehicle_option_id, driver_option_id"),
  ) as DispatchRequirement[];
}

export async function addRequirement(vehicleOptionId: string, driverOptionId: string) {
  unwrap(
    await getSupabase()
      .from("dispatch_requirements")
      .insert({ vehicle_option_id: vehicleOptionId, driver_option_id: driverOptionId }),
  );
}

export async function removeRequirement(vehicleOptionId: string, driverOptionId: string) {
  unwrap(
    await getSupabase()
      .from("dispatch_requirements")
      .delete()
      .eq("vehicle_option_id", vehicleOptionId)
      .eq("driver_option_id", driverOptionId),
  );
}
