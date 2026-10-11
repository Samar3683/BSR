import { afterAll, describe, expect, it } from "vitest";

import {
  actAs,
  closePool,
  createCustomer,
  createUsers,
  expectFailure,
  inTransaction,
  one,
} from "./helpers";

const TABLES = [
  "admin_profiles",
  "entity_configs",
  "field_definitions",
  "field_options",
  "customers",
  "drivers",
  "vehicles",
  "orders",
  "driver_vehicle_assignments",
  "order_assignments",
  "order_status_history",
  "audit_logs",
];

afterAll(closePool);

describe("row level security and privileges", () => {
  it("enables RLS on every application table", async () => {
    await inTransaction(async (db) => {
      const { rows } = await db.query(
        "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname = any($1)",
        [TABLES],
      );
      expect(rows).toHaveLength(TABLES.length);
      for (const row of rows) expect(row.relrowsecurity, row.relname).toBe(true);
    });
  });

  it("gives anonymous requests no access to any table or RPC", async () => {
    await inTransaction(async (db) => {
      await actAs(db, "anon");
      for (const table of TABLES) {
        const error = await expectFailure(db, `select * from public.${table} limit 1`);
        expect(error.code, table).toBe("42501");
      }
      for (const call of [
        "select public.list_records('order')",
        "select public.dashboard_summary()",
        "select * from public.current_admin()",
        "select public.assign_order(gen_random_uuid(), null, null)",
      ]) {
        expect((await expectFailure(db, call)).code, call).toBe("42501");
      }
    });
  });

  it("hides all data from signed-in users without an active admin profile", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await createCustomer(db, "Visible Only To Admins");
      for (const userId of [users.userId, users.inactiveAdminId]) {
        await actAs(db, "authenticated", userId);
        for (const table of TABLES.filter((t) => t !== "admin_profiles")) {
          const { rowCount } = await db.query(`select 1 from public.${table}`);
          expect(rowCount, `${table} as ${userId}`).toBe(0);
        }
        // Own profile only (so the panel can explain "inactive").
        const profiles = await db.query("select user_id from public.admin_profiles");
        expect(profiles.rows.every((r) => r.user_id === userId)).toBe(true);
        expect((await expectFailure(db, "select public.list_records('customer')")).hint).toBe(
          "forbidden",
        );
        expect(
          (
            await expectFailure(
              db,
              'insert into public.customers (attributes) values (\'{"company_name":"X"}\')',
            )
          ).code,
        ).toBe("42501");
        expect((await expectFailure(db, "select public.dashboard_summary()")).hint).toBe(
          "forbidden",
        );
      }
    });
  });

  it("lets active administrators read and write business data", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      const id = await createCustomer(db, "Bianchi Spa");
      const row = await one<{ display_name: string; created_by: string }>(
        db,
        "select display_name, created_by from public.customers where id = $1",
        [id],
      );
      expect(row).toEqual({ display_name: "Bianchi Spa", created_by: users.adminId });
      const admin = await one<{ display_name: string }>(db, "select * from public.current_admin()");
      expect(admin.display_name).toBe("Admin One");
    });
  });

  it("owns system columns: clients cannot set ids, stamps, names, numbers or statuses", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      const customer = await createCustomer(db);
      expect(
        (
          await expectFailure(
            db,
            "insert into public.customers (attributes, display_name) values ('{}', 'x')",
          )
        ).code,
      ).toBe("42501");
      expect(
        (
          await expectFailure(db, "update public.customers set created_by = null where id = $1", [
            customer,
          ])
        ).code,
      ).toBe("42501");
      expect((await expectFailure(db, "update public.orders set status = 'delivered'")).code).toBe(
        "42501",
      );
      expect((await expectFailure(db, "update public.orders set order_number = 'X'")).code).toBe(
        "42501",
      );
      expect(
        (
          await expectFailure(
            db,
            "insert into public.field_definitions (entity_type, field_key, label, field_type, is_system) values ('vehicle','x_sys','X','short_text', true)",
          )
        ).code,
      ).toBe("42501");
      expect(
        (
          await expectFailure(
            db,
            "insert into public.order_assignments (order_id, starts_at, ends_at) values (gen_random_uuid(), now(), now() + interval '1h')",
          )
        ).code,
      ).toBe("42501");
      expect(
        (
          await expectFailure(
            db,
            "insert into public.order_status_history (order_id, to_status) values (gen_random_uuid(), 'draft')",
          )
        ).code,
      ).toBe("42501");
    });
  });

  it("protects administrator access", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      expect(
        (
          await expectFailure(
            db,
            "update public.admin_profiles set active = false where user_id = $1",
            [users.adminId],
          )
        ).hint,
      ).toBe("business_rule");
      expect(
        (
          await expectFailure(
            db,
            "update public.admin_profiles set role = 'owner' where user_id = $1",
            [users.otherAdminId],
          )
        ).code,
      ).toBe("42501");
      expect(
        (
          await expectFailure(
            db,
            "insert into public.admin_profiles (user_id, display_name) values ($1, 'X')",
            [users.userId],
          )
        ).code,
      ).toBe("42501");
      await db.query("update public.admin_profiles set active = false where user_id = $1", [
        users.otherAdminId,
      ]);
      // The deactivated administrator loses access immediately.
      await actAs(db, "authenticated", users.otherAdminId);
      expect((await db.query("select 1 from public.customers")).rowCount).toBe(0);
      expect((await expectFailure(db, "select public.list_admins()")).hint).toBe("forbidden");
    });
  });

  it("keeps the audit log append-only for every role", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      await createCustomer(db);
      expect(
        Number((await one<{ n: string }>(db, "select count(*) n from public.audit_logs")).n),
      ).toBeGreaterThan(0);
      for (const sql of [
        "update public.audit_logs set action = 'tampered'",
        "delete from public.audit_logs",
        "insert into public.audit_logs (actor_label, action, entity_type, entity_id) values ('x','x','x','x')",
        "truncate public.audit_logs",
      ]) {
        expect((await expectFailure(db, sql)).code, sql).toBe("42501");
      }
      await actAs(db, "service_role");
      expect(
        (await expectFailure(db, "update public.audit_logs set action = 'tampered'")).code,
      ).toBe("42501");
      expect((await expectFailure(db, "delete from public.audit_logs")).code).toBe("42501");
      // Even the table owner is stopped by the immutability triggers.
      await actAs(db, "postgres");
      expect(
        (await expectFailure(db, "update public.audit_logs set action = 'tampered'")).message,
      ).toMatch(/immutable/);
      expect((await expectFailure(db, "delete from public.audit_logs")).message).toMatch(
        /immutable/,
      );
      expect((await expectFailure(db, "truncate public.audit_logs")).message).toMatch(/immutable/);
    });
  });

  it("keeps helper functions out of the API and storage private", async () => {
    await inTransaction(async (db) => {
      await actAs(db, "anon");
      expect((await expectFailure(db, "select private.is_active_admin()")).code).toBe("42501");
      await actAs(db, "postgres");
      const bucket = await db.query("select public from storage.buckets where id = 'entity-files'");
      if (bucket.rowCount) {
        expect(bucket.rows[0].public).toBe(false);
        const { rows } = await db.query(
          "select policyname, cmd, roles from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'entity files%'",
        );
        expect(rows.map((r) => r.cmd).sort()).toEqual(["INSERT", "SELECT"]);
        await actAs(db, "anon");
        expect(
          (await db.query("select 1 from storage.objects where bucket_id = 'entity-files'"))
            .rowCount,
        ).toBe(0);
      }
    });
  });
});
