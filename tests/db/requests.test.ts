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

const payload = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    name: "  Mario   Rossi ",
    email: "mario@example.it",
    phone: "+39 333 1234567",
    pickup: { street: "Via Roma 10", zip: "41012", city: "Carpi", province: "MO" },
    delivery: { street: "5 Rue de la Gare", zip: "69001", city: "Lione", province: "Rhône" },
    context: { service: "Espresso", vehicle: "Furgone" },
    ...over,
  });

async function submit(db: Db, body = payload()) {
  return (
    await one<{ reference: string }>(
      db,
      "select intake.submit_quote_request($1::jsonb) as reference",
      [body],
    )
  ).reference;
}

describe("quote requests from the public site", () => {
  it("stores a cleaned request with a reference and keeps it away from the public", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      const reference = await submit(db);
      expect(reference).toMatch(/^RQ-\d{4}-\d{5}-[A-Z2-9]{6}$/);

      const stored = await one<{
        name: string;
        status: string;
        display_name: string;
        context: unknown;
      }>(
        db,
        "select name, status, display_name, context from public.quote_requests where reference = $1",
        [reference],
      );
      expect(stored.name).toBe("Mario Rossi");
      expect(stored.status).toBe("new");
      expect(stored.display_name).toBe(`${reference} · Mario Rossi`);
      expect(stored.context).toEqual({ service: "Espresso", vehicle: "Furgone" });

      // Anonymous and signed-in non-administrators see nothing and can write nothing.
      await actAs(db, "anon");
      const denied = await expectFailure(db, "select * from public.quote_requests");
      expect(denied.code).toBe("42501");
      await actAs(db, "authenticated", users.userId);
      expect((await db.query("select 1 from public.quote_requests")).rowCount).toBe(0);
      const insert = await expectFailure(
        db,
        `insert into public.quote_requests (reference, name, phone, pickup, delivery)
         values ('RQ-X', 'x', '123456', '{}', '{}')`,
      );
      expect(insert.code).toBe("42501");

      // Administrators read them, and can only change the status and the note.
      await actAs(db, "authenticated", users.adminId);
      expect(
        (await db.query("select 1 from public.quote_requests where reference = $1", [reference]))
          .rowCount,
      ).toBe(1);
      await db.query(
        "update public.quote_requests set status = 'contacted', note = 'Called' where reference = $1",
        [reference],
      );
      const handled = await one<{ status: string; handled_by: string; handled_at: string | null }>(
        db,
        "select status, handled_by, handled_at from public.quote_requests where reference = $1",
        [reference],
      );
      expect(handled.status).toBe("contacted");
      expect(handled.handled_by).toBe(users.adminId);
      expect(handled.handled_at).not.toBeNull();
      const tamper = await expectFailure(
        db,
        "update public.quote_requests set name = 'x' where reference = $1",
        [reference],
      );
      expect(tamper.code).toBe("42501");
      const fake = await expectFailure(
        db,
        "update public.quote_requests set status = 'converted' where reference = $1",
        [reference],
      );
      expect(fake.hint).toBe("business_rule");
    });
  });

  it("validates what it receives", async () => {
    await inTransaction(async (db) => {
      for (const [body, message] of [
        [payload({ name: "" }), /Name is required/],
        [payload({ phone: "12" }), /phone number/],
        [payload({ phone: "call me" }), /phone number/],
        [payload({ email: "nope" }), /email address/],
        [payload({ pickup: { street: "Via Roma 10" } }), /pickup address is incomplete/],
        [payload({ delivery: null }), /delivery address is required/],
      ] as const) {
        const failure = await expectFailure(db, "select intake.submit_quote_request($1::jsonb)", [
          body,
        ]);
        expect(failure.hint).toBe("business_rule");
        expect(failure.message).toMatch(message);
      }
      // The email may be left out; free text is capped.
      expect(await submit(db, payload({ email: null, name: "x".repeat(300) }))).toMatch(/^RQ-/);
      const stored = await one<{ name: string }>(
        db,
        "select name from public.quote_requests order by created_at desc limit 1",
      );
      expect(stored.name).toHaveLength(100);
    });
  });

  it("prepares the customer, then links the order, once", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      const reference = await submit(db);
      const id = (
        await one<{ id: string }>(db, "select id from public.quote_requests where reference = $1", [
          reference,
        ])
      ).id;

      await actAs(db, "authenticated", users.userId);
      const outsider = await expectFailure(db, "select public.start_quote_request_order($1)", [id]);
      expect(outsider.hint).toBe("forbidden");

      await actAs(db, "authenticated", users.adminId);
      const started = await one<{ r: { customer_id: string } }>(
        db,
        "select public.start_quote_request_order($1) as r",
        [id],
      );
      const customer = await one<{ attributes: { company_name: string; email: string } }>(
        db,
        "select attributes from public.customers where id = $1",
        [started.r.customer_id],
      );
      expect(customer.attributes.company_name).toBe("Mario Rossi");
      expect(customer.attributes.email).toBe("mario@example.it");
      const contacted = await one<{ status: string; customer_id: string }>(
        db,
        "select status, customer_id from public.quote_requests where id = $1",
        [id],
      );
      expect(contacted).toEqual({ status: "contacted", customer_id: started.r.customer_id });

      // Running it again reuses the customer.
      const again = await one<{ r: { customer_id: string } }>(
        db,
        "select public.start_quote_request_order($1) as r",
        [id],
      );
      expect(again.r.customer_id).toBe(started.r.customer_id);

      // The order is created through the normal order form; then it is linked.
      const order = await one<{ id: string }>(
        db,
        `insert into public.orders (customer_id, status, pickup_at, delivery_at, attributes)
         values ($1, 'draft', now() + interval '2 days', now() + interval '2 days 4 hours', $2) returning id`,
        [
          started.r.customer_id,
          {
            pickup_address: { line1: "Via Roma 10", city: "Carpi" },
            delivery_address: { line1: "5 Rue de la Gare", city: "Lione" },
          },
        ],
      );
      await db.query("select public.link_quote_request_order($1, $2)", [id, order.id]);
      const converted = await one<{ status: string; order_id: string }>(
        db,
        "select status, order_id from public.quote_requests where id = $1",
        [id],
      );
      expect(converted).toEqual({ status: "converted", order_id: order.id });
      const twice = await expectFailure(db, "select public.link_quote_request_order($1, $2)", [
        id,
        order.id,
      ]);
      expect(twice.message).toMatch(/already been converted/);
      const unknown = await expectFailure(db, "select public.start_quote_request_order($1)", [
        "00000000-0000-4000-8000-000000000000",
      ]);
      expect(unknown.message).toMatch(/not found/);

      // A second request from the same email finds the same customer.
      await actAs(db, "postgres");
      const second = await submit(db);
      const secondId = (
        await one<{ id: string }>(db, "select id from public.quote_requests where reference = $1", [
          second,
        ])
      ).id;
      await actAs(db, "authenticated", users.adminId);
      const reused = await one<{ r: { customer_id: string } }>(
        db,
        "select public.start_quote_request_order($1) as r",
        [secondId],
      );
      expect(reused.r.customer_id).toBe(started.r.customer_id);
    });
  });

  it("counts new requests for the sidebar and erases on delete", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      const before = (
        await one<{ c: { new_requests: number } }>(db, "select public.nav_counts() as c")
      ).c.new_requests;
      await actAs(db, "postgres");
      const reference = await submit(db);
      await actAs(db, "authenticated", users.adminId);
      const after = (
        await one<{ c: { new_requests: number } }>(db, "select public.nav_counts() as c")
      ).c.new_requests;
      expect(after).toBe(before + 1);

      await db.query("delete from public.quote_requests where reference = $1", [reference]);
      expect(
        (await db.query("select 1 from public.quote_requests where reference = $1", [reference]))
          .rowCount,
      ).toBe(0);
      // No trace of the personal data in the append-only audit log.
      const audit = await db.query(
        "select 1 from public.audit_logs where after_state::text like '%Mario%' and entity_type = 'quote_request'",
      );
      expect(audit.rowCount).toBe(0);
    });
  });
});

describe("contact events", () => {
  it("records only known channels and reports them to administrators", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await db.query("select intake.record_contact_event('whatsapp', '/preventivo')");
      await db.query("select intake.record_contact_event('whatsapp', '/')");
      await db.query("select intake.record_contact_event('phone', '/')");
      // Ignored: unknown channel, bad page.
      await db.query("select intake.record_contact_event('fax', '/')");
      await db.query("select intake.record_contact_event('email', 'javascript:alert(1)')");

      await actAs(db, "authenticated", users.userId);
      const outsider = await expectFailure(db, "select public.contact_event_summary(30)");
      expect(outsider.hint).toBe("forbidden");
      expect((await db.query("select 1 from public.contact_events")).rowCount).toBe(0);

      await actAs(db, "authenticated", users.adminId);
      const summary = (
        await one<{ s: Record<string, number> }>(db, "select public.contact_event_summary(30) as s")
      ).s;
      expect(summary.whatsapp).toBeGreaterThanOrEqual(2);
      expect(summary.phone).toBeGreaterThanOrEqual(1);
      expect(summary.fax).toBeUndefined();
    });
  });
});
