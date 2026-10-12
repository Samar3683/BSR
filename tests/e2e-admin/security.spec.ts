import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { adminQuery, api, BASE_URL, login, stack, uid, userClient, waitForMail } from "./support";
import { USERS } from "./users";

/** Master prompt §36: the security model, verified against the real backend. */

const TABLES = [
  "customers",
  "drivers",
  "vehicles",
  "orders",
  "field_definitions",
  "order_assignments",
  "audit_logs",
  "admin_profiles",
  "quote_requests",
  "contact_events",
];

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

function upload(path: string, cookie?: string) {
  const form = new FormData();
  form.set("path", path);
  form.set("file", new Blob([PNG], { type: "image/png" }), "probe.png");
  return fetch(`${BASE_URL}/admin/api/files`, {
    method: "POST",
    headers: cookie ? { Cookie: cookie } : {},
    body: form,
  });
}

test.describe("security", () => {
  test("anonymous requests cannot read admin data", async () => {
    for (const table of TABLES) {
      const res = await api("/admin/api/rest", undefined, {
        method: "POST",
        body: JSON.stringify({ table, action: "select", filters: [], order: [], limit: 1 }),
      });
      expect(res.status, table).toBe(401);
    }
    const rpc = await api("/admin/api/rpc/list_records", undefined, {
      method: "POST",
      body: JSON.stringify({ p_entity: "order" }),
    });
    expect(rpc.status).toBe(401);
    // The database itself grants the anonymous role no access either.
    for (const table of TABLES) {
      const rows = await adminQuery<{ ok: boolean }>(
        "select has_table_privilege('anon', $1, 'select') as ok",
        [`public.${table}`],
      );
      expect(rows[0]?.ok, table).toBe(false);
    }
  });

  test("non-admin and inactive-admin sessions see nothing; an active admin does", async () => {
    await adminQuery(`insert into public.customers (attributes) values ($1::jsonb)`, [
      JSON.stringify({ company_name: `Secret Customer ${uid()}` }),
    ]);
    for (const user of [USERS.user, USERS.inactive]) {
      const { client } = await userClient(user);
      for (const table of TABLES.filter((t) => t !== "admin_profiles")) {
        const { data, error } = await client.from(table).select("id").limit(5);
        expect(error, `${table} for ${user.email}`).toBeNull();
        expect(data, `${table} for ${user.email}`).toEqual([]);
      }
      const write = await client.from("customers").insert({ attributes: { company_name: "X" } });
      expect(write.error).not.toBeNull();
    }
    const { client } = await userClient(USERS.admin);
    const { data } = await client.from("customers").select("id").limit(5);
    expect((data as unknown[]).length).toBeGreaterThan(0);
  });

  test("secrets never reach the browser bundle", async () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(js|css|html|json)$/.test(entry)) files.push(path);
      }
    };
    walk(".next/static");
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content.includes(stack.sessionSecret), file).toBe(false);
      expect(content.includes(stack.databaseUrl), file).toBe(false);
      expect(/postgres(ql)?:\/\/[^\s"']*@/.test(content), file).toBe(false);
    }
  });

  test("private files stay private", async () => {
    const { cookie } = await userClient(USERS.admin);
    const path = `vehicle/photo/${uid().toLowerCase()}-probe.png`;
    expect((await upload(path, cookie)).status).toBe(200);
    // Paths outside the entity/field layout are refused by the storage policy.
    expect((await upload(`elsewhere/${uid()}.png`, cookie)).status).toBe(403);
    // Overwrites are refused (no update policy).
    expect((await upload(path, cookie)).status).toBeGreaterThanOrEqual(400);
    // Anonymous users cannot upload or read.
    expect((await upload(`vehicle/photo/${uid()}.png`)).status).toBe(401);
    const url = `${BASE_URL}/admin/api/files?path=${encodeURIComponent(path)}`;
    expect((await fetch(url)).status).toBe(401);
    // A signed-in user who is not an administrator sees nothing.
    const outsider = (await userClient(USERS.user)).cookie;
    expect((await fetch(url, { headers: { Cookie: outsider } })).status).toBe(404);
    expect((await upload(`vehicle/photo/${uid()}.png`, outsider)).status).toBe(403);
    // The administrator can read it, as an image, never sniffed.
    const file = await fetch(url, { headers: { Cookie: cookie } });
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("image/png");
    expect(file.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await file.arrayBuffer()).equals(PNG)).toBe(true);
  });

  test("the invitation endpoint checks authorization before acting", async () => {
    const body = JSON.stringify({
      email: `invited-${uid().toLowerCase()}@bsr.test`,
      display_name: "Invited Admin",
    });
    const call = (cookie?: string) =>
      api("/admin/api/admins/invite", cookie, { method: "POST", body });
    expect((await call()).status).toBe(401);
    expect((await call((await userClient(USERS.user)).cookie)).status).toBe(403);
    expect((await call((await userClient(USERS.inactive)).cookie)).status).toBe(403);
  });

  test("the session cookie is httpOnly, scoped to /admin and signed", async ({ page, context }) => {
    await login(page, USERS.admin);
    const cookie = (await context.cookies()).find((c) => c.name === "bsr-admin-session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe("/admin");
    expect(cookie?.sameSite).toBe("Lax");
    // A forged or tampered cookie is rejected.
    const forged = `bsr-admin-session=${cookie!.value.slice(0, -3)}abc`;
    expect((await api("/admin/api/auth/session", forged)).status).toBe(401);
    // Cross-site writes are refused even with a valid cookie.
    const crossSite = await api("/admin/api/rest", `bsr-admin-session=${cookie!.value}`, {
      method: "POST",
      headers: { Origin: "https://evil.example" },
      body: JSON.stringify({ table: "customers", action: "select", filters: [], order: [] }),
    });
    expect(crossSite.status).toBe(403);
  });

  test("an administrator invites another administrator from Settings", async ({ page }) => {
    const email = `invitee-${uid().toLowerCase()}@bsr.test`;
    const since = Date.now();
    await login(page, USERS.admin, "/admin/settings/administrators");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel(/^Name/).fill("Invited Colleague");
    await page.getByRole("button", { name: "Send invitation" }).click();
    await expect(page.getByText(`Invitation sent to ${email}.`)).toBeVisible();
    await expect(page.getByRole("row", { name: /Invited Colleague/ })).toContainText(email);
    const mail = await waitForMail(email, since);
    expect(mail.subject).toBe("Your BSR Trasporti admin access");

    // Self-deactivation is impossible; deactivating someone else works and is effective.
    await expect(
      page.getByRole("row", { name: new RegExp(USERS.admin.name) }).getByRole("switch"),
    ).toBeDisabled();
    // Controlled switch: its state follows the server, so click and wait for the result.
    await page
      .getByRole("row", { name: /Invited Colleague/ })
      .getByRole("switch")
      .click();
    await expect(page.getByText("Administrator deactivated.")).toBeVisible();
    await expect(
      page.getByRole("row", { name: /Invited Colleague/ }).getByRole("switch"),
    ).not.toBeChecked();
  });
});
