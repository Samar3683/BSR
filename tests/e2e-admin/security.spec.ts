import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { anonClient, login, serviceClient, stack, uid, userClient, waitForMail } from "./support";
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
];

function rest(path: string, token?: string, init: RequestInit = {}) {
  return fetch(`${stack.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: stack.anonKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

test.describe("security", () => {
  test("anonymous requests cannot read admin data", async () => {
    for (const table of TABLES) {
      const res = await rest(`${table}?select=*&limit=1`);
      expect(res.status, table).toBeGreaterThanOrEqual(400);
    }
    const rpc = await rest("rpc/list_records", undefined, {
      method: "POST",
      body: JSON.stringify({ p_entity: "order" }),
    });
    expect(rpc.status).toBeGreaterThanOrEqual(400);
  });

  test("non-admin and inactive-admin tokens see nothing; an active admin does", async () => {
    const service = serviceClient();
    const { error } = await service
      .from("customers")
      .insert({ attributes: { company_name: `Secret Customer ${uid()}` } });
    expect(error).toBeNull();
    for (const user of [USERS.user, USERS.inactive]) {
      const { token } = await userClient(user);
      for (const table of TABLES.filter((t) => t !== "admin_profiles")) {
        const res = await rest(`${table}?select=id&limit=5`, token);
        expect(res.status, `${table} for ${user.email}`).toBe(200);
        expect(await res.json(), `${table} for ${user.email}`).toEqual([]);
      }
      const write = await rest("customers", token, {
        method: "POST",
        body: JSON.stringify({ attributes: { company_name: "X" } }),
      });
      expect(write.status).toBeGreaterThanOrEqual(400);
    }
    const { token } = await userClient(USERS.admin);
    const res = await rest("customers?select=id&limit=5", token);
    expect((await res.json()).length).toBeGreaterThan(0);
  });

  test("the service-role key never reaches the browser bundle", async () => {
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
      expect(content.includes(stack.serviceKey), file).toBe(false);
      expect(content.includes("SUPABASE_SERVICE_ROLE_KEY"), file).toBe(false);
    }
  });

  test("private storage stays private", async () => {
    const { client } = await userClient(USERS.admin);
    const path = `vehicle/photo/${uid().toLowerCase()}-probe.png`;
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    const upload = await client.storage
      .from("entity-files")
      .upload(path, png, { contentType: "image/png" });
    expect(upload.error).toBeNull();
    // Paths outside the entity/field layout are refused by the storage policy.
    const stray = await client.storage
      .from("entity-files")
      .upload(`elsewhere/${uid()}.png`, png, { contentType: "image/png" });
    expect(stray.error).not.toBeNull();
    // Overwrites are refused (no update policy).
    const overwrite = await client.storage
      .from("entity-files")
      .upload(path, png, { contentType: "image/png", upsert: true });
    expect(overwrite.error).not.toBeNull();

    const publicUrl = await fetch(`${stack.url}/storage/v1/object/public/entity-files/${path}`);
    expect(publicUrl.status).toBeGreaterThanOrEqual(400);
    const anonymous = await anonClient().storage.from("entity-files").download(path);
    expect(anonymous.error).not.toBeNull();
    const nonAdmin = (await userClient(USERS.user)).client;
    expect((await nonAdmin.storage.from("entity-files").download(path)).error).not.toBeNull();
    expect(
      (
        await nonAdmin.storage
          .from("entity-files")
          .upload(`vehicle/photo/${uid()}.png`, png, { contentType: "image/png" })
      ).error,
    ).not.toBeNull();

    const signed = await client.storage.from("entity-files").createSignedUrl(path, 60);
    expect(signed.error).toBeNull();
    const file = await fetch(signed.data!.signedUrl);
    expect(file.status).toBe(200);
  });

  test("the admin-users edge function checks authorization before acting", async () => {
    const fn = `${stack.url}/functions/v1/admin-users`;
    const body = JSON.stringify({
      action: "invite",
      email: `invited-${uid().toLowerCase()}@bsr.test`,
      display_name: "Invited Admin",
    });
    const call = (token?: string) =>
      fetch(fn, {
        method: "POST",
        headers: {
          apikey: stack.anonKey,
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
      });
    expect((await call()).status).toBe(401);
    expect((await call(stack.anonKey)).status).toBe(401);
    expect((await call((await userClient(USERS.user)).token)).status).toBe(403);
    expect((await call((await userClient(USERS.inactive)).token)).status).toBe(403);
  });

  test("an administrator invites another administrator from Settings", async ({ page }) => {
    const email = `invitee-${uid().toLowerCase()}@bsr.test`;
    const since = Date.now();
    await login(page, USERS.admin, "/admin/settings/administrators");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Name").fill("Invited Colleague");
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
