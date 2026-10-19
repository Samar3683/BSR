import { getDb } from "../lib/db/client";
import { AdminError, toAdminError, unwrap } from "../lib/errors";

export type MessageStatus = "new" | "answered" | "closed";

export const MESSAGE_STATUSES: readonly MessageStatus[] = ["new", "answered", "closed"];

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  new: "New",
  answered: "Answered",
  closed: "Closed",
};

/** A message sent with the "send us a message" form on the public site. */
export interface ContactMessage {
  id: string;
  reference: string;
  status: MessageStatus;
  needs_reply: boolean;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  body: string;
  note: string | null;
  handled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThreadEntry {
  id: string;
  direction: "in" | "out";
  body: string;
  emailed: boolean;
  created_at: string;
}

export async function fetchMessages(status: MessageStatus | "all", limit = 200) {
  let query = getDb()
    .from("messages")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status !== "all") query = query.eq("status", status);
  const result = await query;
  return { rows: unwrap(result) as ContactMessage[], total: Number(result.count ?? 0) };
}

export async function fetchMessageCounts(): Promise<Record<MessageStatus | "all", number>> {
  const rows = unwrap(await getDb().from("messages").select("status")) as {
    status: MessageStatus;
  }[];
  const counts = { all: rows.length, new: 0, answered: 0, closed: 0 };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

export async function getMessage(id: string): Promise<ContactMessage> {
  return unwrap(await getDb().from("messages").select("*").eq("id", id).single()) as ContactMessage;
}

export async function updateMessage(
  id: string,
  patch: { status?: MessageStatus; note?: string | null },
): Promise<ContactMessage> {
  return unwrap(
    await getDb().from("messages").update(patch).eq("id", id).select().single(),
  ) as ContactMessage;
}

export async function deleteMessage(id: string): Promise<void> {
  unwrap(await getDb().from("messages").delete().eq("id", id).select("id"));
}

/** The conversation under a quote request or a message, oldest first. */
export async function fetchThread(kind: "quote" | "message", id: string): Promise<ThreadEntry[]> {
  return unwrap(
    await getDb()
      .from("thread_entries")
      .select("id, direction, body, emailed, created_at")
      .eq(kind === "quote" ? "quote_request_id" : "message_id", id)
      .order("created_at", { ascending: true }),
  ) as ThreadEntry[];
}

/** Saves a reply in the conversation and emails it when the visitor left an address. */
export async function sendReply(
  kind: "quote" | "message",
  id: string,
  body: string,
): Promise<{ emailed: boolean }> {
  let response: Response;
  try {
    response = await fetch("/admin/api/threads/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, body }),
      credentials: "same-origin",
    });
  } catch (error) {
    throw toAdminError(error instanceof TypeError ? error : new TypeError("Failed to fetch"));
  }
  const payload = (await response.json().catch(() => ({}))) as {
    data?: { emailed: boolean };
    error?: { message: string; hint?: string; code?: string; details?: string | null };
  };
  if (!response.ok || payload.error) {
    if (response.status === 401)
      throw new AdminError("auth", "Your session has expired. Sign in again.");
    throw toAdminError(payload.error ?? new Error("The reply could not be sent."));
  }
  return { emailed: Boolean(payload.data?.emailed) };
}
