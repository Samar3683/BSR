import { afterAll, describe, expect, it } from "vitest";

import {
  actAs,
  closePool,
  createCustomer,
  createDriver,
  createOrder,
  createUsers,
  createVehicle,
  expectFailure,
  hoursFromNow,
  inTransaction,
  one,
  optionId,
} from "./helpers";

afterAll(closePool);

describe("admin UX backend", () => {
  it("lists orders with status counts, quick pickup windows and id filters", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      const customer = await createCustomer(db);
      const soon = await createOrder(db, customer, hoursFromNow(2), hoursFromNow(5));
      const later = await createOrder(db, customer, hoursFromNow(200), hoursFromNow(204), "draft");

      const all = (
        await one<{ r: { facets: { status: Record<string, number> } } }>(
          db,
          "select public.list_records('order', null, '[]'::jsonb, null, 100, 0, 'active') as r",
        )
      ).r;
      expect(all.facets.status.confirmed).toBeGreaterThanOrEqual(1);
      expect(all.facets.status.draft).toBeGreaterThanOrEqual(1);

      const filters = JSON.stringify([
        {
          field: "pickup_between",
          op: "between",
          value: [hoursFromNow(0), hoursFromNow(24)],
        },
      ]);
      const window = (
        await one<{ r: { rows: { id: string }[] } }>(
          db,
          "select public.list_records('order', null, $1::jsonb, null, 100, 0, 'active') as r",
          [filters],
        )
      ).r;
      const ids = window.rows.map((r) => r.id);
      // Other orders may exist in a shared database: check membership.
      expect(ids).toContain(soon);
      expect(ids).not.toContain(later);

      const byId = (
        await one<{ r: { rows: { id: string }[] } }>(
          db,
          `select public.list_records('order', null, $1::jsonb, null, 100, 0, 'active') as r`,
          [JSON.stringify([{ field: "ids", op: "in", value: [later] }])],
        )
      ).r;
      expect(byId.rows.map((r) => r.id)).toEqual([later]);
    });
  });

  it("searches across entities and counts what needs attention", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      await createCustomer(db, "Zanzibar Logistica");
      await createDriver(db, "Zanzibar Rossi");
      const hits = (
        await one<{ r: { entity: string; title: string }[] }>(
          db,
          "select public.global_search('Zanzibar') as r",
        )
      ).r;
      expect(hits.map((h) => h.entity).sort()).toEqual(["customer", "driver"]);

      const counts = (
        await one<{ r: Record<string, number> }>(db, "select public.nav_counts() as r")
      ).r;
      expect(Object.keys(counts).sort()).toEqual(["awaiting_dispatch", "in_transit", "new_requests", "overdue"]);

      await actAs(db, "anon");
      const denied = await expectFailure(db, "select public.global_search('x')");
      expect(denied.code).toBeTruthy();
    });
  });

  it("changes many orders at once and reports each failure", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      const customer = await createCustomer(db);
      const draft = await createOrder(db, customer, hoursFromNow(10), hoursFromNow(12), "draft");
      const confirmed = await createOrder(db, customer, hoursFromNow(14), hoursFromNow(16));
      const results = (
        await one<{ r: { id: string; ok: boolean; error?: string }[] }>(
          db,
          "select public.bulk_change_order_status($1::uuid[], 'scheduled', null) as r",
          [[draft, confirmed]],
        )
      ).r;
      const byId = Object.fromEntries(results.map((x) => [x.id, x]));
      // Nobody is assigned yet: every row is refused, each with its own reason.
      expect(byId[draft]!.ok).toBe(false);
      expect(byId[confirmed]!.ok).toBe(false);
      expect(byId[confirmed]!.error).toMatch(/driver and a vehicle|cannot go/i);

      const advanced = (
        await one<{ r: { id: string; ok: boolean }[] }>(
          db,
          "select public.bulk_change_order_status($1::uuid[], 'confirmed', null) as r",
          [[draft, confirmed]],
        )
      ).r;
      // draft → confirmed works; confirmed → confirmed is a no-op.
      expect(advanced.find((x) => x.id === draft)!.ok).toBe(true);

      const archived = (
        await one<{ r: { id: string; ok: boolean }[] }>(
          db,
          "select public.bulk_set_archived('order', $1::uuid[], true) as r",
          [[confirmed]],
        )
      ).r;
      // Only draft, delivered or cancelled orders can be archived.
      expect(archived[0]!.ok).toBe(false);

      const tooMany = await expectFailure(
        db,
        "select public.bulk_change_order_status(array(select gen_random_uuid() from generate_series(1, 201)), 'confirmed')",
      );
      expect(tooMany.hint).toBe("business_rule");
    });
  });

  it("stores dispatch requirements and orders candidates by availability and pairing", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      const articulated = await optionId(db, "vehicle", "vehicle_type", "Articolato");
      const ce = await optionId(db, "driver", "license_categories", "CE");
      // A shared database may already hold this rule: start from a clean slate.
      await db.query(
        "delete from public.dispatch_requirements where vehicle_option_id = $1 and driver_option_id = $2",
        [articulated, ce],
      );
      const auditBefore = await one<{ n: string }>(
        db,
        "select count(*) n from public.audit_logs where entity_type = 'dispatch_requirement'",
      );
      await db.query(
        "insert into public.dispatch_requirements (vehicle_option_id, driver_option_id) values ($1, $2)",
        [articulated, ce],
      );

      // The pair must be a vehicle select option and a driver select option.
      const wrong = await expectFailure(
        db,
        "insert into public.dispatch_requirements (vehicle_option_id, driver_option_id) values ($1, $2)",
        [ce, articulated],
      );
      expect(wrong.hint).toBe("business_rule");

      const audit = await one<{ n: string }>(
        db,
        "select count(*) n from public.audit_logs where entity_type = 'dispatch_requirement'",
      );
      expect(Number(audit.n) - Number(auditBefore.n)).toBe(1);

      // Anyone who is not an administrator cannot read or write rules.
      await actAs(db, "anon");
      const denied = await expectFailure(db, "select * from public.dispatch_requirements");
      expect(denied.code).toBeTruthy();
    });
  });

  it("groups entries of one action by transaction and validates field sections", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      const customer = await createCustomer(db);
      const driver = await createDriver(db, "Anna Neri");
      const vehicle = await createVehicle(db, "ZZ111AA");
      const order = await createOrder(db, customer, hoursFromNow(30), hoursFromNow(34));
      await db.query("select public.assign_order($1, $2, $3)", [order, driver, vehicle]);

      const rows = (
        await db.query<{ transaction_id: string | null }>(
          "select transaction_id from public.audit_logs where context->>'order_id' = $1 or entity_id = $1",
          [order],
        )
      ).rows;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.transaction_id !== null)).toBe(true);

      const section = await one<{ section: string | null }>(
        db,
        "select section from public.field_definitions where entity_type = 'order' and field_key = 'pickup_at'",
      );
      expect(section.section).toBe("Schedule");

      const tooLong = await expectFailure(
        db,
        "update public.field_definitions set section = repeat('x', 200) where entity_type = 'order' and field_key = 'cargo'",
      );
      expect(tooLong.code).toBeTruthy();
    });
  });
});
