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

interface Summary {
  totals: Record<string, number>;
  by_customer: { name: string; orders: number }[];
  by_driver: { name: string; orders: number; delivered: number }[];
  by_vehicle: { name: string }[];
}
interface Breakdown {
  rows: { label: string; count: number }[];
  stats: { sum: number | string } | null;
}

const today = () => new Date().toISOString().slice(0, 10);
// A window no other data uses, so exact counts hold in a shared database.
const FROM = "2099-03-01";
const TO = "2099-03-31";
const at = (day: number, hour: number) =>
  `2099-03-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00Z`;

describe("reports, dashboard and calendar", () => {
  it("computes figures from operational data with date, status and entity filters", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      const rossi = await createCustomer(db, "Rossi Srl");
      const verdi = await createCustomer(db, "Verdi Spa");
      const driver = await createDriver(db, "Report Driver");
      const vehicle = await createVehicle(db, "RE123PO");
      const espresso = await optionId(db, "order", "service", "Espresso");

      const delivered = await createOrder(db, rossi, at(10, 8), at(10, 12));
      await db.query(
        "update public.orders set attributes = attributes || jsonb_build_object('service', $2::text, 'weight_kg', 1200) where id = $1",
        [delivered, espresso],
      );
      await db.query("select public.assign_order($1, $2, $3)", [delivered, driver, vehicle]);
      await db.query("select public.change_order_status($1, 'in_transit')", [delivered]);
      await db.query("select public.change_order_status($1, 'delivered')", [delivered]);
      const cancelled = await createOrder(db, verdi, at(11, 8), at(11, 10));
      await db.query("select public.change_order_status($1, 'cancelled')", [cancelled]);
      await createOrder(db, verdi, at(12, 8), at(12, 10));

      const { r } = await one<{ r: Summary }>(
        db,
        "select public.report_summary($1::date, $2::date) as r",
        [FROM, TO],
      );
      expect(r.totals).toMatchObject({
        orders: 3,
        delivered: 1,
        cancelled: 1,
        open: 1,
        delivered_with_deadline: 1,
        delivered_on_time: 1,
      });
      expect(r.by_customer.map((c) => [c.name, c.orders])).toEqual([
        ["Verdi Spa", 2],
        ["Rossi Srl", 1],
      ]);
      expect(r.by_driver).toHaveLength(1);
      expect(r.by_driver[0]).toMatchObject({ name: "Report Driver", orders: 1, delivered: 1 });
      expect(r.by_vehicle[0]?.name).toBe("RE123PO");

      const filtered = await one<{ r: Summary }>(
        db,
        "select public.report_summary($1::date, $2::date, $3::jsonb) as r",
        [FROM, TO, JSON.stringify({ status: ["cancelled"] })],
      );
      expect(filtered.r.totals.orders).toBe(1);
      const byCustomer = await one<{ r: Summary }>(
        db,
        "select public.report_summary($1::date, $2::date, $3::jsonb) as r",
        [FROM, TO, JSON.stringify({ customer_id: rossi })],
      );
      expect(byCustomer.r.totals.orders).toBe(1);
      const byDriver = await one<{ r: Summary }>(
        db,
        "select public.report_summary($1::date, $2::date, $3::jsonb) as r",
        [FROM, TO, JSON.stringify({ driver_id: driver })],
      );
      expect(byDriver.r.totals.orders).toBe(1);

      const service = await one<{ b: Breakdown }>(
        db,
        "select public.report_field_breakdown('order', 'service', $1::date, $2::date) as b",
        [FROM, TO],
      );
      expect(service.b.rows.find((x) => x.label === "Espresso")?.count).toBe(1);
      expect(service.b.rows.find((x) => x.label === "(empty)")?.count).toBe(2);
      const weight = await one<{ b: Breakdown }>(
        db,
        "select public.report_field_breakdown('order', 'weight_kg', $1::date, $2::date) as b",
        [FROM, TO],
      );
      expect(Number(weight.b.stats?.sum)).toBe(1200);
      expect(
        (
          await expectFailure(
            db,
            "select public.report_field_breakdown('order', 'notes', $1::date, $2::date)",
            [today(), today()],
          )
        ).hint,
      ).toBe("validation_failed");

      const exported = await one<{ e: { id: string; customer_name: string; status: string }[] }>(
        db,
        "select public.report_orders_export($1::date, $2::date) as e",
        [FROM, TO],
      );
      expect(exported.e).toHaveLength(3);
      expect(exported.e.find((x) => x.id === delivered)).toMatchObject({
        customer_name: "Rossi Srl",
        status: "delivered",
      });

      const { d } = await one<{ d: { counts: Record<string, number> } }>(
        db,
        "select public.dashboard_summary() as d",
      );
      expect(d.counts.delivered_last_30_days).toBeGreaterThanOrEqual(1);
      expect(d.counts.customers_total).toBeGreaterThanOrEqual(2);

      const { c } = await one<{ c: { id: string }[] }>(
        db,
        "select public.calendar_events('2099-03-09'::timestamptz, '2099-03-13'::timestamptz) as c",
      );
      const ids = c.map((e) => e.id);
      expect(ids).toContain(delivered);
      expect(ids).not.toContain(cancelled);
      const withCancelled = await one<{ c: { id: string }[] }>(
        db,
        "select public.calendar_events('2099-03-09'::timestamptz, '2099-03-13'::timestamptz, '{\"include_cancelled\": true}') as c",
      );
      expect(withCancelled.c.map((e) => e.id)).toContain(cancelled);
    });
  });
});

describe("audit log", () => {
  it("records actor, action, entity, before and after state for every mutation", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      const customer = await createCustomer(db, "Audit Srl");
      await db.query(
        'update public.customers set attributes = \'{"email": "audit@example.it"}\' where id = $1',
        [customer],
      );
      await db.query("update public.customers set archived_at = now() where id = $1", [customer]);
      await db.query("update public.customers set archived_at = null where id = $1", [customer]);
      const driver = await createDriver(db, "Audit Driver");
      const vehicle = await createVehicle(db, "AU123DT");
      const order = await createOrder(db, customer, hoursFromNow(5), hoursFromNow(8));
      await db.query("select public.assign_order($1, $2, $3)", [order, driver, vehicle]);
      await db.query("select public.change_order_status($1, 'in_transit', 'Audited move')", [
        order,
      ]);
      await db.query(
        "update public.field_definitions set label = 'Company' where entity_type = 'customer' and field_key = 'company_name'",
      );

      const { rows } = await db.query(
        "select actor_id, actor_label, action, entity_type, entity_id, before_state, after_state, changed_fields, context from public.audit_logs where actor_id = $1 order by id",
        [users.adminId],
      );
      const forCustomer = rows.filter((r) => r.entity_id === customer);
      expect(forCustomer.map((r) => r.action)).toEqual(["create", "update", "archive", "restore"]);
      const update = forCustomer[1];
      expect(update).toMatchObject({
        actor_id: users.adminId,
        actor_label: "Admin One",
        entity_type: "customer",
      });
      expect(update.changed_fields).toEqual(["attributes.email"]);
      expect(update.before_state.attributes.email).toBeUndefined();
      expect(update.after_state.attributes.email).toBe("audit@example.it");
      expect(rows.find((r) => r.entity_type === "order_assignment")).toMatchObject({
        action: "assign",
        context: { order_id: order },
      });
      const status = rows.find(
        (r) =>
          r.entity_id === order &&
          r.action === "status_change" &&
          r.after_state.status === "in_transit",
      );
      expect(status?.context.note).toBe("Audited move");
      expect(rows.find((r) => r.entity_type === "field_definition")?.changed_fields).toEqual([
        "label",
      ]);
      for (const row of rows) expect(row.actor_label).toBeTruthy();
    });
  });
});
