import { AdminError, toAdminError, unwrap } from "../lib/errors";
import { getSupabase } from "../lib/supabase/client";

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
  return unwrap(await getSupabase().rpc("list_admins")) as AdminProfile[];
}

export async function setAdminActive(profileId: string, active: boolean): Promise<void> {
  unwrap(
    await getSupabase()
      .from("admin_profiles")
      .update({ active })
      .eq("id", profileId)
      .select("id")
      .single(),
  );
}

export async function renameAdmin(profileId: string, displayName: string): Promise<void> {
  unwrap(
    await getSupabase()
      .from("admin_profiles")
      .update({ display_name: displayName })
      .eq("id", profileId)
      .select("id")
      .single(),
  );
}

/**
 * Invites a new administrator through the `admin-users` Edge Function: the
 * only operation that needs the service role (creating an Auth user). The
 * function verifies that the caller is an active administrator.
 */
export async function inviteAdmin(email: string, displayName: string): Promise<void> {
  const { data, error } = await getSupabase().functions.invoke("admin-users", {
    body: { action: "invite", email, display_name: displayName },
  });
  if (error) {
    type FunctionError = { error?: string; field_errors?: Record<string, string> };
    let payload: FunctionError | null = null;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        payload = (await context.json()) as FunctionError;
      } catch {
        payload = null;
      }
    }
    if (payload?.error)
      throw new AdminError(
        payload.field_errors ? "validation" : "rule",
        payload.error,
        payload.field_errors,
      );
    throw toAdminError(error);
  }
  if (data && typeof data === "object" && "error" in data) {
    throw new AdminError("rule", String((data as { error: unknown }).error));
  }
}
