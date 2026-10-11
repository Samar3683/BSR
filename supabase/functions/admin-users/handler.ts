import { corsHeaders, json } from "../_shared/http.ts";

/**
 * admin-users — invites a new administrator.
 *
 * Creating a Supabase Auth user needs the service role, so this is the one
 * operation that runs server-side. Authorization is checked on every call:
 *   1. a bearer token must be present and valid (Auth server, not decoded locally);
 *   2. its user must have an active administrator profile (read with the
 *      caller's own token, so RLS applies);
 * only then is the service-role client used. The profile itself is created
 * through the create_admin_profile RPC with the caller's token, so the audit
 * log records the inviting administrator.
 *
 * The handler takes its dependencies as arguments so it can be unit-tested.
 */

interface QueryResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

export interface CallerClient {
  auth: {
    getUser(jwt: string): Promise<QueryResult<{ user: { id: string; email?: string } | null }>>;
  };
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<QueryResult<unknown>>;
}

export interface ServiceClient {
  auth: {
    admin: {
      inviteUserByEmail(
        email: string,
        options: { data?: Record<string, unknown>; redirectTo?: string },
      ): Promise<QueryResult<{ user: { id: string } | null }>>;
      deleteUser(id: string): Promise<{ error: { message: string } | null }>;
    };
  };
}

export interface HandlerDeps {
  env: { url?: string; anonKey?: string; serviceKey?: string; siteUrl?: string };
  callerClient: (token: string) => CallerClient;
  serviceClient: () => ServiceClient;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleAdminUsers(req: Request, deps: HandlerDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { url, anonKey, serviceKey } = deps.env;
  if (!url || !anonKey || !serviceKey)
    return json({ error: "The function is not configured" }, 500);

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return json({ error: "Not authenticated" }, 401);

  const caller = deps.callerClient(token);
  const { data: userData, error: userError } = await caller.auth.getUser(token);
  if (userError || !userData?.user) return json({ error: "Not authenticated" }, 401);

  const { data: me, error: meError } = await caller.rpc("current_admin");
  const profile = Array.isArray(me)
    ? (me[0] as { active?: boolean; role?: string } | undefined)
    : undefined;
  if (meError || !profile || !profile.active || profile.role !== "admin") {
    return json({ error: "Not authorized" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (body.action !== "invite") return json({ error: "Unknown action" }, 400);

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
  const fieldErrors: Record<string, string> = {};
  if (!EMAIL.test(email) || email.length > 254) fieldErrors.email = "Enter a valid email address";
  if (!displayName || displayName.length > 120)
    fieldErrors.display_name = "Enter a name (120 characters max)";
  if (Object.keys(fieldErrors).length) {
    return json({ error: "Some fields need attention", field_errors: fieldErrors }, 422);
  }

  const siteUrl = (deps.env.siteUrl || req.headers.get("origin") || "").replace(/\/+$/, "");
  const service = deps.serviceClient();
  const { data: invited, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
    data: { display_name: displayName },
    redirectTo: siteUrl ? `${siteUrl}/admin/auth/confirm?next=/admin/reset-password` : undefined,
  });
  if (inviteError || !invited?.user) {
    const exists = /already|registered|exists/i.test(inviteError?.message ?? "");
    return json(
      exists
        ? {
            error: "A user with this email already exists",
            field_errors: { email: "A user with this email already exists" },
          }
        : { error: "The invitation could not be sent" },
      exists ? 409 : 502,
    );
  }

  const { data: created, error: profileError } = await caller.rpc("create_admin_profile", {
    p_user_id: invited.user.id,
    p_display_name: displayName,
  });
  if (profileError) {
    // Do not leave an Auth user without the profile it was invited for.
    await service.auth.admin.deleteUser(invited.user.id);
    return json(
      { error: profileError.message || "The administrator profile could not be created" },
      400,
    );
  }
  return json({ profile: created }, 201);
}
