import { describe, expect, it, vi } from "vitest";

import {
  handleAdminUsers,
  type CallerClient,
  type HandlerDeps,
  type ServiceClient,
} from "./handler.ts";

const env = {
  url: "http://supabase.test",
  anonKey: "anon",
  serviceKey: "service",
  siteUrl: "https://bsr.test",
};

function setup(options: {
  user?: { id: string } | null;
  admin?: { active: boolean; role: string } | null;
  inviteError?: string;
  profileError?: string;
}) {
  const rpc = vi.fn(async (fn: string) => {
    if (fn === "current_admin") return { data: options.admin ? [options.admin] : [], error: null };
    if (fn === "create_admin_profile") {
      return options.profileError
        ? { data: null, error: { message: options.profileError } }
        : { data: { id: "p2" }, error: null };
    }
    return { data: null, error: { message: "unknown" } };
  });
  const caller: CallerClient = {
    auth: {
      getUser: vi.fn(async () =>
        options.user === null
          ? { data: { user: null }, error: { message: "invalid" } }
          : { data: { user: options.user ?? { id: "u1" } }, error: null },
      ),
    },
    rpc,
  };
  const inviteUserByEmail = vi.fn(async () =>
    options.inviteError
      ? { data: { user: null }, error: { message: options.inviteError } }
      : { data: { user: { id: "new-user" } }, error: null },
  );
  const deleteUser = vi.fn(async () => ({ error: null }));
  const service: ServiceClient = { auth: { admin: { inviteUserByEmail, deleteUser } } };
  const serviceClient = vi.fn(() => service);
  const deps: HandlerDeps = { env, callerClient: () => caller, serviceClient };
  return { deps, rpc, inviteUserByEmail, deleteUser, serviceClient };
}

const request = (body: unknown, token: string | null = "token") =>
  new Request("http://fn.test/admin-users", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

const invite = { action: "invite", email: "New.Admin@BSR.test", display_name: "New Admin" };

describe("admin-users edge function", () => {
  it("answers CORS preflight", async () => {
    const res = await handleAdminUsers(
      new Request("http://fn.test", { method: "OPTIONS" }),
      setup({}).deps,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("rejects calls without a token or with an invalid token, before using the service role", async () => {
    const missing = setup({});
    expect((await handleAdminUsers(request(invite, null), missing.deps)).status).toBe(401);
    const invalid = setup({ user: null });
    expect((await handleAdminUsers(request(invite), invalid.deps)).status).toBe(401);
    expect(missing.serviceClient).not.toHaveBeenCalled();
    expect(invalid.serviceClient).not.toHaveBeenCalled();
  });

  it("rejects users without an active administrator profile", async () => {
    for (const admin of [null, { active: false, role: "admin" }]) {
      const s = setup({ admin });
      const res = await handleAdminUsers(request(invite), s.deps);
      expect(res.status).toBe(403);
      expect(s.inviteUserByEmail).not.toHaveBeenCalled();
    }
  });

  it("validates the payload", async () => {
    const s = setup({ admin: { active: true, role: "admin" } });
    const res = await handleAdminUsers(
      request({ action: "invite", email: "nope", display_name: "" }),
      s.deps,
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { field_errors: Record<string, string> };
    expect(Object.keys(body.field_errors).sort()).toEqual(["display_name", "email"]);
    expect((await handleAdminUsers(request({ action: "delete" }), s.deps)).status).toBe(400);
  });

  it("invites the user and creates the profile with the caller's token", async () => {
    const s = setup({ admin: { active: true, role: "admin" } });
    const res = await handleAdminUsers(request(invite), s.deps);
    expect(res.status).toBe(201);
    expect(s.inviteUserByEmail).toHaveBeenCalledWith("new.admin@bsr.test", {
      data: { display_name: "New Admin" },
      redirectTo: "https://bsr.test/admin/auth/confirm?next=/admin/reset-password",
    });
    expect(s.rpc).toHaveBeenCalledWith("create_admin_profile", {
      p_user_id: "new-user",
      p_display_name: "New Admin",
    });
  });

  it("reports existing users and rolls back the Auth user when the profile fails", async () => {
    const exists = setup({
      admin: { active: true, role: "admin" },
      inviteError: "A user with this email address has already been registered",
    });
    expect((await handleAdminUsers(request(invite), exists.deps)).status).toBe(409);
    const failing = setup({ admin: { active: true, role: "admin" }, profileError: "boom" });
    expect((await handleAdminUsers(request(invite), failing.deps)).status).toBe(400);
    expect(failing.deleteUser).toHaveBeenCalledWith("new-user");
  });
});
