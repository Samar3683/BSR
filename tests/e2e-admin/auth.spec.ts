import { expect, test } from "@playwright/test";

import { adminQuery, api, login, openAccountMenu, panelLink, waitForMail } from "./support";
import { USERS } from "./users";

test.describe("admin authentication", () => {
  test("redirects signed-out visitors to the login page, keeping the destination", async ({
    page,
  }) => {
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Forders$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    // No registration anywhere.
    await expect(page.getByText(/create account|sign up|register/i)).toHaveCount(0);
    for (const path of [
      "/admin",
      "/admin/settings/fields",
      "/admin/audit",
      "/admin/reset-password",
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login/);
    }
  });

  test("rejects a wrong password without revealing which part is wrong", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(USERS.admin.email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator(".a-auth-card").getByRole("alert")).toHaveText(
      "The email or password is not correct.",
    );
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("refuses users without an active administrator profile", async ({ page }) => {
    for (const [user, message] of [
      [USERS.user, "This account does not have access to the admin panel."],
      [USERS.inactive, /inactive/i],
    ] as const) {
      await page.goto("/admin/login");
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password").fill(user.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.locator(".a-auth-card").getByRole("alert")).toHaveText(message);
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/admin\/login/);
    }
  });

  test("signs in, keeps the session, and signs out", async ({ page }) => {
    await login(page, USERS.admin, "/admin/customers");
    await expect(page.getByRole("heading", { name: "Customers", level: 1 })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Customers", level: 1 })).toBeVisible();
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/admin$/);
    // The session cookie is scoped to /admin.
    const cookies = await page.context().cookies();
    const auth = cookies.filter((c) => c.name === "bsr-admin-session");
    expect(auth.length).toBeGreaterThan(0);
    for (const cookie of auth) expect(cookie.path).toBe("/admin");
    await openAccountMenu(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("resets a forgotten password through the emailed link", async ({ page, baseURL }) => {
    const since = Date.now();
    await page.goto("/admin/login");
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    // Client-side navigation: the sign-in form (with its own Email field) is still on screen.
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    await page.getByLabel("Email").fill(USERS.recovery.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/an email with a reset link is on its way/)).toBeVisible();

    const mail = await waitForMail(USERS.recovery.email, since);
    expect(mail.subject).toMatch(/Reimposta la password del pannello BSR Trasporti/);
    await page.goto(panelLink(mail, baseURL!));
    await expect(page).toHaveURL(/\/admin\/reset-password$/);
    const password = "Recovered-pass-2026";
    await page.getByLabel("New password").fill(password);
    await page.getByLabel("Repeat the password").fill(password);
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await openAccountMenu(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await login(page, { ...USERS.recovery, password });
    // A used link cannot be replayed.
    await openAccountMenu(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    // Let the sign-out finish its redirect before replaying the link.
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto(panelLink(mail, baseURL!));
    await expect(page).toHaveURL(/\/admin\/login\?error=link/);
    await expect(page.locator(".a-auth-card").getByRole("alert")).toHaveText(
      /invalid or has expired/,
    );
  });

  test("does not allow public sign-up", async () => {
    // There is no registration endpoint, and a login for an unknown address fails the same way.
    const signup = await api("/admin/api/auth/signup", undefined, {
      method: "POST",
      body: JSON.stringify({ email: "intruder@bsr.test", password: "Intruder-2026-x" }),
    });
    expect(signup.status).toBe(404);
    const attempt = await api("/admin/api/auth/login", undefined, {
      method: "POST",
      body: JSON.stringify({ email: "intruder@bsr.test", password: "Intruder-2026-x" }),
    });
    expect(attempt.status).toBe(401);
    const rows = await adminQuery("select 1 from auth.users where email = 'intruder@bsr.test'");
    expect(rows).toEqual([]);
  });
});
