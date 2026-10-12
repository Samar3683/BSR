import { getDb } from "../lib/db/client";
import { unwrap } from "../lib/errors";

export type RequestStatus = "new" | "contacted" | "converted" | "discarded";

export const REQUEST_STATUSES: readonly RequestStatus[] = [
  "new",
  "contacted",
  "converted",
  "discarded",
];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  discarded: "Discarded",
};

export interface RequestAddress {
  street?: string;
  zip?: string;
  city?: string;
  province?: string;
}

/** A quote request submitted on the public site. */
export interface QuoteRequest {
  id: string;
  reference: string;
  status: RequestStatus;
  name: string;
  email: string | null;
  phone: string;
  pickup: RequestAddress;
  delivery: RequestAddress;
  context: { service?: string; sector?: string; vehicle?: string };
  source: string;
  note: string | null;
  customer_id: string | null;
  order_id: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchRequests(status: RequestStatus | "all", limit = 200) {
  let query = getDb()
    .from("quote_requests")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status !== "all") query = query.eq("status", status);
  const result = await query;
  return {
    rows: unwrap(result) as QuoteRequest[],
    total: Number(result.count ?? 0),
  };
}

/** How many requests each status holds (for the filter chips). */
export async function fetchRequestCounts(): Promise<Record<RequestStatus | "all", number>> {
  const rows = unwrap(await getDb().from("quote_requests").select("status")) as {
    status: RequestStatus;
  }[];
  const counts = { all: rows.length, new: 0, contacted: 0, converted: 0, discarded: 0 };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

export async function getRequest(id: string): Promise<QuoteRequest> {
  return unwrap(
    await getDb().from("quote_requests").select("*").eq("id", id).single(),
  ) as QuoteRequest;
}

export async function updateRequest(
  id: string,
  patch: { status?: Exclude<RequestStatus, "converted">; note?: string | null },
): Promise<QuoteRequest> {
  return unwrap(
    await getDb().from("quote_requests").update(patch).eq("id", id).select().single(),
  ) as QuoteRequest;
}

export async function deleteRequest(id: string): Promise<void> {
  unwrap(await getDb().from("quote_requests").delete().eq("id", id).select("id"));
}

/**
 * Step 1 of "Create order": finds (or creates) the customer of a request. The
 * order itself is then entered in the normal order form, prefilled.
 */
export async function startRequestOrder(id: string): Promise<{ customer_id: string }> {
  return unwrap(await getDb().rpc("start_quote_request_order", { p_request_id: id })) as {
    customer_id: string;
  };
}

/** Step 2: the order exists; the request points to it and counts as converted. */
export async function linkRequestOrder(id: string, orderId: string): Promise<void> {
  unwrap(await getDb().rpc("link_quote_request_order", { p_request_id: id, p_order_id: orderId }));
}

/** Anonymous clicks on WhatsApp / phone / email links, per channel. */
export async function fetchContactSummary(
  days = 30,
): Promise<Partial<Record<"whatsapp" | "phone" | "email", number>>> {
  return unwrap(await getDb().rpc("contact_event_summary", { p_days: days })) as Partial<
    Record<"whatsapp" | "phone" | "email", number>
  >;
}
