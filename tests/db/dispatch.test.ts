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
} from "./helpers";

afterAll(closePool);

describe("dispatch", () => {
  it("assigns, detects conflicts, unassigns with history, and follows the status workflow", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      const customer = await createCustomer(db);
      const mario = await createDriver(db, "Mario Bianchi");
      const luca = await createDriver(db, "Luca Verdi");
      const van = await createVehicle(db, "AB123CD");
      const truck = await createVehicle(db, "XY999ZZ");

      // Driver ↔ vehicle pairing and its conflict.
      await db.query("select public.pair_driver_vehicle($1, $2)", [mario, van]);
      const pairingConflict = await expectFailure(db, "select public.pair_driver_vehicle($1, $2)", [
        luca,
        van,
      ]);
      expect(pairingConflict.hint).toBe("assignment_conflict");
      expect(pairingConflict.message).toMatch(
        /AB123CD is already paired with driver Mario Bianchi/,
      );

      const first = await createOrder(db, customer, hoursFromNow(24), hoursFromNow(30));
      const overlapping = await createOrder(db, customer, hoursFromNow(26), hoursFromNow(32));
      await db.query("select public.assign_order($1, $2, $3, 'First run')", [first, mario, van]);
      expect(
        (
          await one<{ status: string }>(db, "select status from public.orders where id = $1", [
            first,
          ])
        ).status,
      ).toBe("scheduled");

      // The backend refuses double bookings with a useful message.
      const driverConflict = await expectFailure(db, "select public.assign_order($1, $2, $3)", [
        overlapping,
        mario,
        truck,
      ]);
      expect(driverConflict.hint).toBe("assignment_conflict");
      expect(driverConflict.message).toMatch(
        /Driver Mario Bianchi is already assigned to order BSR-\d{4}-\d{5}/,
      );
      const vehicleConflict = await expectFailure(db, "select public.assign_order($1, $2, $3)", [
        overlapping,
        luca,
        van,
      ]);
      expect(vehicleConflict.message).toMatch(/Vehicle AB123CD is already assigned/);

      // Partial assignment keeps the order confirmed; completing it schedules it.
      await db.query("select public.assign_order($1, $2, null)", [overlapping, luca]);
      expect(
        (
          await one<{ status: string }>(db, "select status from public.orders where id = $1", [
            overlapping,
          ])
        ).status,
      ).toBe("confirmed");
      await db.query("select public.assign_order($1, $2, $3)", [overlapping, luca, truck]);
      expect(
        (
          await one<{ status: string }>(db, "select status from public.orders where id = $1", [
            overlapping,
          ])
        ).status,
      ).toBe("scheduled");

      // Unassign: the order returns to confirmed, the history row stays (released).
      await db.query("select public.unassign_order($1, 'Customer postponed')", [overlapping]);
      const history = await db.query(
        "select driver_id, vehicle_id, released_at is not null as released, release_reason from public.order_assignments where order_id = $1 order by created_at",
        [overlapping],
      );
      expect(history.rows).toHaveLength(2);
      expect(history.rows.every((r) => r.released)).toBe(true);
      expect(history.rows.map((r) => r.release_reason).sort()).toEqual([
        "Customer postponed",
        "Reassigned",
      ]);
      expect(
        (
          await one<{ status: string }>(db, "select status from public.orders where id = $1", [
            overlapping,
          ])
        ).status,
      ).toBe("confirmed");
      // Released, never-started assignments free the resources entirely.
      await db.query("select public.assign_order($1, $2, $3)", [overlapping, luca, truck]);

      // Status workflow with history and rules.
      expect(
        (await expectFailure(db, "select public.change_order_status($1, 'delivered')", [first]))
          .message,
      ).toMatch(/cannot go from scheduled to delivered/);
      await db.query("select public.change_order_status($1, 'in_transit', 'Left the depot')", [
        first,
      ]);
      expect(
        (await expectFailure(db, "select public.unassign_order($1)", [first])).message,
      ).toMatch(/in transit/);
      await db.query("select public.change_order_status($1, 'delivered')", [first]);
      const statuses = await db.query(
        "select from_status, to_status, note, changed_by_label from public.order_status_history where order_id = $1 order by id",
        [first],
      );
      expect(statuses.rows.map((r) => `${r.from_status ?? "∅"}→${r.to_status}`)).toEqual([
        "∅→confirmed",
        "confirmed→scheduled",
        "scheduled→in_transit",
        "in_transit→delivered",
      ]);
      expect(statuses.rows[2]).toMatchObject({
        note: "Left the depot",
        changed_by_label: "Admin One",
      });

      // Scheduling requires an assignment; drafts cannot be dispatched.
      const draft = await createOrder(db, customer, hoursFromNow(48), hoursFromNow(50), "draft");
      expect(
        (await expectFailure(db, "select public.assign_order($1, $2, $3)", [draft, mario, van]))
          .message,
      ).toMatch(/Confirm the order/);
      await db.query("select public.change_order_status($1, 'confirmed')", [draft]);
      expect(
        (await expectFailure(db, "select public.change_order_status($1, 'scheduled')", [draft]))
          .message,
      ).toMatch(/Assign a driver and a vehicle first/);

      // Cancelling releases the driver and vehicle.
      await db.query("select public.change_order_status($1, 'cancelled', 'Customer cancelled')", [
        overlapping,
      ]);
      const live = await db.query(
        "select 1 from public.order_assignments where order_id = $1 and released_at is null",
        [overlapping],
      );
      expect(live.rowCount).toBe(0);
    });
  });

  it("reassigns an order in transit from now on, keeping both assignments", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      const customer = await createCustomer(db);
      const a = await createDriver(db, "Driver A");
      const b = await createDriver(db, "Driver B");
      const v = await createVehicle(db, "RE123AS");
      const order = await createOrder(db, customer, hoursFromNow(-2), hoursFromNow(6));
      await db.query("select public.assign_order($1, $2, $3)", [order, a, v]);
      await db.query("select public.change_order_status($1, 'in_transit')", [order]);
      await db.query("select public.assign_order($1, $2, $3)", [order, b, v]);
      const rows = await db.query(
        "select driver_id, released_at is null as live, lower(period) as starts, upper(period) as ends from public.order_assignments where order_id = $1 order by created_at",
        [order],
      );
      expect(rows.rows).toHaveLength(2);
      const before = rows.rows.find((r) => r.driver_id === a);
      const after = rows.rows.find((r) => r.driver_id === b);
      expect(before).toMatchObject({ live: false });
      expect(after).toMatchObject({ live: true });
      // The replacement takes over exactly where the first assignment stopped.
      expect(new Date(after.starts).getTime()).toBe(new Date(before.ends).getTime());
    });
  });

  it("moves reservations with the order window and refuses windows that would collide", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      const customer = await createCustomer(db);
      const d = await createDriver(db, "Window Driver");
      const v1 = await createVehicle(db, "WI111ND");
      const v2 = await createVehicle(db, "WI222ND");
      const early = await createOrder(db, customer, hoursFromNow(10), hoursFromNow(12));
      const late = await createOrder(db, customer, hoursFromNow(20), hoursFromNow(22));
      await db.query("select public.assign_order($1, $2, $3)", [early, d, v1]);
      await db.query("select public.assign_order($1, $2, $3)", [late, d, v2]);
      await db.query("update public.orders set pickup_at = $2, delivery_at = $3 where id = $1", [
        early,
        hoursFromNow(11),
        hoursFromNow(13),
      ]);
      const moved = await one<{ same: boolean }>(
        db,
        `select a.starts_at = o.pickup_at and a.ends_at = o.delivery_at as same
           from public.order_assignments a join public.orders o on o.id = a.order_id
          where a.order_id = $1 and a.released_at is null`,
        [early],
      );
      expect(moved.same).toBe(true);
      // Stretching into the other booking of the same driver is refused by the exclusion constraint.
      const collision = await expectFailure(
        db,
        "update public.orders set delivery_at = $2 where id = $1",
        [early, hoursFromNow(21)],
      );
      expect(collision.code).toBe("23P01");
      // A dispatched order keeps both times, even when the field is optional in the form.
      await db.query(
        "update public.field_definitions set required = false where entity_type = 'order' and field_key = 'delivery_at'",
      );
      expect(
        (
          await expectFailure(db, "update public.orders set delivery_at = null where id = $1", [
            late,
          ])
        ).message,
      ).toMatch(/needs both/);
    });
  });

  it("protects resources with upcoming work and refuses unusable ones", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      const customer = await createCustomer(db);
      const d = await createDriver(db, "Busy Driver");
      const idle = await createDriver(db, "Idle Driver");
      const v = await createVehicle(db, "BU123SY");
      const order = await createOrder(db, customer, hoursFromNow(5), hoursFromNow(9));
      await db.query("select public.assign_order($1, $2, $3)", [order, d, v]);
      expect(
        (
          await expectFailure(db, "update public.drivers set archived_at = now() where id = $1", [
            d,
          ])
        ).message,
      ).toMatch(/upcoming order assignments/);
      expect(
        (await expectFailure(db, "update public.vehicles set available = false where id = $1", [v]))
          .message,
      ).toMatch(/upcoming order assignments/);
      await db.query("update public.drivers set available = false where id = $1", [idle]);
      const other = await createOrder(db, customer, hoursFromNow(30), hoursFromNow(34));
      expect(
        (await expectFailure(db, "select public.assign_order($1, $2, null)", [other, idle]))
          .message,
      ).toMatch(/not available for dispatch/);
      // History is protected: assigned drivers cannot be deleted; drafts can.
      expect(
        (await expectFailure(db, "delete from public.drivers where id = $1", [d])).message,
      ).toMatch(/archive the driver instead/);
      expect(
        (await expectFailure(db, "delete from public.orders where id = $1", [order])).message,
      ).toMatch(/Only draft orders/);
      const draft = await createOrder(db, customer, hoursFromNow(40), hoursFromNow(41), "draft");
      await db.query("delete from public.orders where id = $1", [draft]);
    });
  });

  it("serves dispatch candidates with availability and pairings", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      const customer = await createCustomer(db);
      const busy = await createDriver(db, "Candidate Busy");
      const free = await createDriver(db, "Candidate Free");
      const v = await createVehicle(db, "CA123ND");
      const v2 = await createVehicle(db, "CA456ND");
      await db.query("select public.pair_driver_vehicle($1, $2)", [free, v2]);
      const taken = await createOrder(db, customer, hoursFromNow(3), hoursFromNow(8));
      await db.query("select public.assign_order($1, $2, $3)", [taken, busy, v]);
      const order = await createOrder(db, customer, hoursFromNow(4), hoursFromNow(6));
      const { c } = await one<{
        c: { drivers: { id: string; conflict: unknown; paired_vehicle_id: string | null }[] };
      }>(db, "select public.dispatch_candidates($1) as c", [order]);
      const busyRow = c.drivers.find((x) => x.id === busy)!;
      const freeRow = c.drivers.find((x) => x.id === free)!;
      expect(busyRow.conflict).toMatchObject({ order_id: taken });
      expect(freeRow.conflict).toBeNull();
      expect(freeRow.paired_vehicle_id).toBe(v2);
    });
  });
});
