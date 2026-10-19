import { afterAll, describe, expect, it } from "vitest";

import {
  actAs,
  closePool,
  createUsers,
  expectFailure,
  inTransaction,
  one,
  type Db,
} from "./helpers";

afterAll(closePool);

const message = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    name: "Anna Bianchi",
    email: "anna@example.it",
    subject: "Orari",
    message: "Fate ritiri il sabato?",
    ...over,
  });

const send = async (db: Db, body = message()) =>
  (await one<{ code: string }>(db, "select intake.submit_message($1::jsonb) as code", [body])).code;

describe("messages from the public site", () => {
  it("stores a message with a unique tracking code the admin can read", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      const code = await send(db);
      expect(code).toMatch(/^MS-\d{4}-\d{5}-[A-Z2-9]{6}$/);

      await actAs(db, "anon");
      expect((await expectFailure(db, "select * from public.messages")).code).toBe("42501");

      await actAs(db, "authenticated", users.adminId);
      const stored = await one<{ name: string; status: string }>(
        db,
        "select name, status from public.messages where reference = $1",
        [code],
      );
      expect(stored).toEqual({ name: "Anna Bianchi", status: "new" });
    });
  });

  it("needs a name, a message and some way to answer", async () => {
    await inTransaction(async (db) => {
      for (const body of [
        message({ name: "" }),
        message({ message: "  " }),
        message({ email: "", phone: "" }),
        message({ email: "nope" }),
      ]) {
        const failure = await expectFailure(db, "select intake.submit_message($1::jsonb)", [body]);
        expect(failure.message).toBeTruthy();
      }
    });
  });
});

describe("tracking and replies", () => {
  it("shows a visitor their request without personal data and accepts a follow-up", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      const code = await send(db);

      const tracked = await one<{ t: Record<string, unknown> }>(
        db,
        "select intake.track($1) as t",
        [code.toLowerCase()],
      );
      expect(tracked.t.kind).toBe("message");
      expect(JSON.stringify(tracked.t)).not.toContain("anna@example.it");

      expect(
        (
          await one<{ ok: boolean }>(db, "select intake.add_visitor_message($1, $2) as ok", [
            code,
            "Grazie!",
          ])
        ).ok,
      ).toBe(true);
      expect(
        (
          await one<{ ok: boolean }>(db, "select intake.add_visitor_message($1, $2) as ok", [
            "MS-2026-99999-AAAAAA",
            "x",
          ])
        ).ok,
      ).toBe(false);

      // Only administrators reply; the message becomes answered.
      await actAs(db, "authenticated", users.userId);
      const denied = await expectFailure(
        db,
        "select public.reply_to_thread('message', gen_random_uuid(), 'hi')",
      );
      expect(denied.code).toBeTruthy();
    });
  });

  it("exposes counters for the panel", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await send(db);
      await actAs(db, "authenticated", users.adminId);
      const counts = await one<{ c: Record<string, number> }>(
        db,
        "select public.nav_counts() as c",
      );
      expect(counts.c.new_messages).toBeGreaterThanOrEqual(1);
    });
  });
});
