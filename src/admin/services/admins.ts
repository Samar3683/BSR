import { AdminError, unwrap } from "../lib/errors";
import { getDb } from "../lib/db/client";

export interface AdminProfile {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
  active: boolean;
  email: string | null;
  last_sign_in_at: string | null;
  created_at: string;
}

export async function fetchAdmins(): Promise<AdminProfile[]> {
  return unwrap(await getDb().rpc("list_admins")) as AdminProfile[];
}

export async function setAdminActive(profileId: string, active: boolean): Promise<void> {
  unwrap(
    await getDb()
      .from("admin_profiles")
      .update({ active })
      .eq("id", profileId)
      .select("id")
      .single(),
  );
}

export async function renameAdmin(profileId: string, displayName: string): Promise<void> {
  unwrap(
    await getDb()
      .from("admin_profiles")
      .update({ display_name: displayName })
      .eq("id", profileId)
      .select("id")
      .single(),
  );
}

/**
 * Invites a new administrator through the panel's API: it creates the login,
 * the profile (audited as the inviting administrator) and emails a one-time
 * link to choose a password. Only active administrators may do this.
 */
export async function inviteAdmin(email: string, displayName: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/admin/api/admins/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, display_name: displayName }),
      credentials: "same-origin",
    });
  } catch {
    throw new AdminError("network", "The server could not be reached. Check the connection and try again.");
  }
  if (response.ok) return;
  let payload: { error?: string; field_errors?: Record<string, string> } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    // keep the generic message
  }
  if (response.status === 401) throw new AdminError("auth", "Your session has expired. Sign in again.");
  throw new AdminError(
    payload.field_errors ? "validation" : "rule",
    payload.error ?? "The invitation could not be sent",
    payload.field_errors,
  );
}
