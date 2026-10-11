import { afterAll, describe, expect, it } from "vitest";

import { FIELD_TYPE_KEYS } from "@/admin/lib/fields/types";
import { FIELD_TYPES, type Capability } from "@/admin/lib/fields/registry";

import {
  actAs,
  closePool,
  createCustomer,
  createUsers,
  createVehicle,
  expectFailure,
  fieldErrors,
  inTransaction,
  one,
  optionId,
} from "./helpers";

afterAll(closePool);

async function createField(db: Parameters<typeof one>[0], values: Record<string, unknown>) {
  const columns = Object.keys(values);
  return one<{ id: string }>(
    db,
    `insert into public.field_definitions (${columns.join(", ")}) values (${columns.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    Object.values(values).map((v) => (typeof v === "object" && v !== null ? JSON.stringify(v) : v)),
  );
}

describe("dynamic field engine", () => {
  it("mirrors the panel's type capabilities exactly (contract with src/admin/lib/fields/registry.ts)", async () => {
    await inTransaction(async (db) => {
      const capabilities: Capability[] = [
        "searchable",
        "filterable",
        "sortable",
        "reportable",
        "unique",
        "default",
      ];
      for (const type of FIELD_TYPE_KEYS) {
        for (const cap of capabilities) {
          const { supported } = await one<{ supported: boolean }>(
            db,
            "select private.field_type_supports($1::public.field_type, $2) as supported",
            [type, cap],
          );
          expect(supported, `${type}.${cap}`).toBe(FIELD_TYPES[type].capabilities[cap]);
        }
        // Every rule the panel offers is accepted by the server for the type.
        for (const rule of FIELD_TYPES[type].rules) {
          const sample: Record<string, unknown> = {
            min_length: 1,
            max_length: 10,
            pattern: "^a",
            pattern_message: "x",
            min: 0,
            max: 5,
            precision: 2,
            currency: "EUR",
            min_date: "2026-01-01",
            max_date: "2026-12-31",
            min_time: "08:00",
            max_time: "18:00",
            min_items: 1,
            max_items: 2,
            required_parts: ["city"],
            max_size_mb: 5,
            allowed_types: type === "image" ? ["image/png"] : ["application/pdf"],
          };
          const { problem } = await one<{ problem: string | null }>(
            db,
            "select private.validate_rules($1::public.field_type, $2::jsonb) as problem",
            [type, JSON.stringify({ [rule]: sample[rule] })],
          );
          expect(problem, `${type}.${rule}`).toBeNull();
        }
      }
      expect(FIELD_TYPE_KEYS).toHaveLength(19);
    });
  });

  it("runs the complete field lifecycle against real records", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);

      // Create a select field with options, validation and behaviour flags.
      const field = await createField(db, {
        entity_type: "vehicle",
        field_key: "fuel",
        label: "Fuel",
        field_type: "single_select",
        required: false,
        searchable: true,
        filterable: true,
        sortable: true,
        reportable: true,
        sort_order: 15,
      });
      for (const [label, order] of [
        ["Diesel", 10],
        ["LNG", 20],
        ["Electric", 30],
      ] as const) {
        await db.query(
          "insert into public.field_options (field_id, label, sort_order) values ($1, $2, $3)",
          [field.id, label, order],
        );
      }
      const diesel = await optionId(db, "vehicle", "fuel", "Diesel");
      const lng = await optionId(db, "vehicle", "fuel", "LNG");

      // Reorder fields and options atomically.
      const ids = (
        await db.query(
          "select id from public.field_definitions where entity_type = 'vehicle' order by sort_order",
        )
      ).rows.map((r) => r.id);
      const reordered = [field.id, ...ids.filter((id) => id !== field.id)];
      await db.query("select public.reorder_fields('vehicle', $1::uuid[])", [reordered]);
      expect(
        (
          await one<{ sort_order: number }>(
            db,
            "select sort_order from public.field_definitions where id = $1",
            [field.id],
          )
        ).sort_order,
      ).toBe(10);
      await db.query("select public.reorder_field_options($1, $2::uuid[])", [
        field.id,
        [lng, diesel],
      ]);
      expect(
        (
          await one<{ label: string }>(
            db,
            "select label from public.field_options where field_id = $1 order by sort_order limit 1",
            [field.id],
          )
        ).label,
      ).toBe("LNG");

      // Edit an option label: records keep the option id.
      const vehicle = await createVehicle(db, "FU123EL");
      await db.query(
        "update public.vehicles set attributes = jsonb_build_object('fuel', $2::text) where id = $1",
        [vehicle, diesel],
      );
      await db.query("update public.field_options set label = 'Diesel B7' where id = $1", [diesel]);
      const listed = await one<{
        list: { rows: { attributes: Record<string, string> }[]; total: number };
      }>(db, "select public.list_records('vehicle', 'B7') as list");
      expect(listed.list.total).toBe(1);
      expect(listed.list.rows[0]!.attributes.fuel).toBe(diesel);

      // Filter and sort through the configured flags.
      const filtered = await one<{ list: { total: number } }>(
        db,
        'select public.list_records(\'vehicle\', null, $1::jsonb, \'{"field":"fuel","direction":"asc"}\'::jsonb) as list',
        [JSON.stringify([{ field: "fuel", op: "in", value: [diesel] }])],
      );
      expect(filtered.list.total).toBe(1);

      // Report on it.
      const report = await one<{ r: { rows: { label: string; count: number }[] } }>(
        db,
        "select public.report_field_breakdown('vehicle', 'fuel') as r",
      );
      expect(report.r.rows.find((row) => row.label === "Diesel B7")?.count).toBe(1);

      // A used option cannot be deleted, only archived; it stays readable but not selectable.
      expect(
        (await expectFailure(db, "delete from public.field_options where id = $1", [diesel]))
          .message,
      ).toMatch(/archive it instead/);
      await db.query("update public.field_options set archived_at = now() where id = $1", [diesel]);
      await db.query(
        "update public.vehicles set attributes = attributes || '{\"payload_kg\": 900}' where id = $1",
        [vehicle],
      );
      const other = await createVehicle(db, "AR123CH");
      const archivedChoice = await expectFailure(
        db,
        "update public.vehicles set attributes = jsonb_build_object('fuel', $2::text) where id = $1",
        [other, diesel],
      );
      expect(fieldErrors(archivedChoice).fuel).toMatch(/archived/);
      // An unused option can be deleted.
      const electric = await optionId(db, "vehicle", "fuel", "Electric");
      await db.query("delete from public.field_options where id = $1", [electric]);

      // A field holding data cannot be deleted; archiving keeps the values.
      expect(
        (await expectFailure(db, "delete from public.field_definitions where id = $1", [field.id]))
          .message,
      ).toMatch(/archive it instead/);
      await db.query("update public.field_definitions set archived_at = now() where id = $1", [
        field.id,
      ]);
      const kept = await one<{ attributes: Record<string, unknown> }>(
        db,
        "select attributes from public.vehicles where id = $1",
        [vehicle],
      );
      expect(kept.attributes.fuel).toBe(diesel);
      // Archived fields leave forms: new values are refused, unrelated edits still work.
      expect(
        fieldErrors(
          await expectFailure(
            db,
            "update public.vehicles set attributes = jsonb_build_object('fuel', $2::text) where id = $1",
            [vehicle, lng],
          ),
        ).fuel,
      ).toMatch(/no longer in use/);
      await db.query(
        "update public.vehicles set attributes = '{\"payload_kg\": 1000}' where id = $1",
        [vehicle],
      );
      expect(
        (
          await one<{ attributes: Record<string, unknown> }>(
            db,
            "select attributes from public.vehicles where id = $1",
            [vehicle],
          )
        ).attributes,
      ).toMatchObject({
        fuel: diesel,
        payload_kg: 1000,
      });
      // ... and they can no longer be filtered or sorted.
      expect(
        (
          await expectFailure(
            db,
            'select public.list_records(\'vehicle\', null, \'[{"field":"fuel","op":"is_empty"}]\'::jsonb)',
          )
        ).hint,
      ).toBe("validation_failed");
    });
  });

  it("validates values by type, rule, requirement and uniqueness", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      const error = await expectFailure(
        db,
        `insert into public.vehicles (attributes) values ('{"plate":"AA111AA","payload_kg":"heavy","unknown":1}')`,
      );
      expect(error.hint).toBe("validation_failed");
      expect(fieldErrors(error)).toMatchObject({
        payload_kg: "Must be a number",
        unknown: "Unknown field",
        vehicle_type: "Required",
      });

      await createVehicle(db, "AB123CD");
      const van = await optionId(db, "vehicle", "vehicle_type", "Van");
      const duplicate = await expectFailure(
        db,
        "insert into public.vehicles (attributes) values ($1)",
        [{ plate: "ab123cd", vehicle_type: van }],
      );
      expect(fieldErrors(duplicate).plate).toBe("Another record already uses this value");

      const customer = await createCustomer(db);
      const normalised = await one<{ attributes: Record<string, unknown> }>(
        db,
        "update public.customers set attributes = $2 where id = $1 returning attributes",
        [
          customer,
          {
            email: " INFO@ROSSI.IT ",
            phone: "+39 333  1234567",
            address: { line1: "Via Roma 1", city: "Milano", country: " " },
          },
        ],
      );
      expect(normalised.attributes).toMatchObject({
        email: "info@rossi.it",
        phone: "+39 333 1234567",
        address: { line1: "Via Roma 1", city: "Milano" },
      });
      // A JSON null clears a value; omitted keys keep theirs (patch semantics).
      const cleared = await one<{ attributes: Record<string, unknown> }>(
        db,
        "update public.customers set attributes = '{\"phone\": null}' where id = $1 returning attributes",
        [customer],
      );
      expect(cleared.attributes.phone).toBeUndefined();
      expect(cleared.attributes.email).toBe("info@rossi.it");
    });
  });

  it("guards field definitions: keys, types, capabilities, rules and system fields", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      expect(
        (
          await expectFailure(
            db,
            "insert into public.field_definitions (entity_type, field_key, label, field_type) values ('vehicle','Bad Key','X','short_text')",
          )
        ).code,
      ).toBe("23514");
      expect(
        fieldErrors(
          await expectFailure(
            db,
            "insert into public.field_definitions (entity_type, field_key, label, field_type) values ('vehicle','available','X','boolean')",
          ),
        ).field_key,
      ).toMatch(/reserved/);
      expect(
        fieldErrors(
          await expectFailure(
            db,
            "insert into public.field_definitions (entity_type, field_key, label, field_type, sortable) values ('vehicle','bio','Bio','long_text', true)",
          ),
        ).sortable,
      ).toMatch(/Not available/);
      expect(
        fieldErrors(
          await expectFailure(
            db,
            `insert into public.field_definitions (entity_type, field_key, label, field_type, validation_rules) values ('vehicle','code','Code','short_text','{"pattern":"[a-"}')`,
          ),
        ).validation_rules,
      ).toMatch(/regular expression/);
      expect(
        fieldErrors(
          await expectFailure(
            db,
            `insert into public.field_definitions (entity_type, field_key, label, field_type, default_value) values ('vehicle','seats','Seats','integer','"many"')`,
          ),
        ).default_value,
      ).toBe("Must be a number");

      // System fields: renameable, but never archived, disabled, retyped or deleted.
      await db.query(
        "update public.field_definitions set label = 'Collection' where entity_type = 'order' and field_key = 'pickup_at'",
      );
      for (const sql of [
        "update public.field_definitions set archived_at = now() where entity_type = 'order' and field_key = 'pickup_at'",
        "update public.field_definitions set active = false where entity_type = 'order' and field_key = 'customer'",
        "update public.field_definitions set field_type = 'date' where entity_type = 'order' and field_key = 'pickup_at'",
        "delete from public.field_definitions where entity_type = 'order' and field_key = 'customer'",
      ]) {
        expect((await expectFailure(db, sql)).hint, sql).toBe("business_rule");
      }
      expect(
        fieldErrors(
          await expectFailure(
            db,
            "update public.field_definitions set required = false where entity_type = 'order' and field_key = 'customer'",
          ),
        ).required,
      ).toMatch(/always required/);

      // Type changes are refused once values exist (unless data-preserving).
      const vehicle = await createVehicle(db, "TY123PE");
      await db.query(
        "update public.vehicles set attributes = '{\"payload_kg\": 900}' where id = $1",
        [vehicle],
      );
      await db.query(
        "update public.field_definitions set field_type = 'decimal' where entity_type = 'vehicle' and field_key = 'payload_kg'",
      );
      expect(
        fieldErrors(
          await expectFailure(
            db,
            "update public.field_definitions set field_type = 'date' where entity_type = 'vehicle' and field_key = 'payload_kg'",
          ),
        ).field_type,
      ).toMatch(/create a new field/);

      // Turning on uniqueness requires unique stored values.
      await createVehicle(db, "DU111PL");
      const van = await optionId(db, "vehicle", "vehicle_type", "Van");
      await db.query(
        "update public.vehicles set attributes = jsonb_build_object('make_model', 'Iveco Daily') where attributes ->> 'plate' in ('TY123PE', 'DU111PL')",
      );
      void van;
      expect(
        fieldErrors(
          await expectFailure(
            db,
            "update public.field_definitions set unique_value = true where entity_type = 'vehicle' and field_key = 'make_model'",
          ),
        ).unique_value,
      ).toMatch(/more than one record/);
    });
  });

  it("derives display names from the primary display field and follows relabels", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      const vehicle = await createVehicle(db, "DN123AM");
      expect(
        (
          await one<{ display_name: string }>(
            db,
            "select display_name from public.vehicles where id = $1",
            [vehicle],
          )
        ).display_name,
      ).toBe("DN123AM");
      await db.query(
        "update public.entity_configs set primary_display_field = 'vehicle_type' where entity_key = 'vehicle'",
      );
      expect(
        (
          await one<{ display_name: string }>(
            db,
            "select display_name from public.vehicles where id = $1",
            [vehicle],
          )
        ).display_name,
      ).toBe("Van");
      await db.query("update public.field_options set label = 'Furgone' where id = $1", [
        await optionId(db, "vehicle", "vehicle_type", "Van"),
      ]);
      expect(
        (
          await one<{ display_name: string }>(
            db,
            "select display_name from public.vehicles where id = $1",
            [vehicle],
          )
        ).display_name,
      ).toBe("Furgone");
      expect(
        fieldErrors(
          await expectFailure(
            db,
            "update public.entity_configs set primary_display_field = 'notes' where entity_key = 'vehicle'",
          ),
        ).primary_display_field,
      ).toMatch(/cannot name records/);
      // Renaming happened without polluting the audit log with one entry per record.
      const recomputes = await one<{ n: string }>(
        db,
        "select count(*) n from public.audit_logs where entity_id = $1 and action = 'update'",
        [vehicle],
      );
      expect(Number(recomputes.n)).toBe(0);
    });
  });

  it("blocks new records of a disabled entity", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "authenticated", users.adminId);
      await db.query(
        "update public.entity_configs set active = false where entity_key = 'customer'",
      );
      expect(
        (
          await expectFailure(
            db,
            'insert into public.customers (attributes) values (\'{"company_name":"X"}\')',
          )
        ).message,
      ).toMatch(/cannot be created while this entity is disabled/);
    });
  });

  it("checks uploaded files against Storage metadata", async () => {
    await inTransaction(async (db) => {
      const users = await createUsers(db);
      await actAs(db, "postgres");
      if (!(await db.query("select 1 from storage.buckets where id = 'entity-files'")).rowCount)
        return;
      await db.query(
        `insert into storage.objects (bucket_id, name, metadata) values
           ('entity-files', 'vehicle/photo/ok.png', '{"size": 2048, "mimetype": "image/png"}'),
           ('entity-files', 'vehicle/photo/big.png', '{"size": 20971520, "mimetype": "image/png"}'),
           ('entity-files', 'vehicle/photo/doc.pdf', '{"size": 2048, "mimetype": "application/pdf"}')`,
      );
      await actAs(db, "authenticated", users.adminId);
      const vehicle = await createVehicle(db, "PH123TO");
      const set = (path: string, extra: Record<string, unknown> = {}) =>
        `update public.vehicles set attributes = jsonb_build_object('photo', jsonb_build_object('path', '${path}', 'name', 'x', 'size', 1, 'mime_type', 'image/png'${Object.entries(
          extra,
        )
          .map(([k, v]) => `, '${k}', '${v}'`)
          .join("")})) where id = '${vehicle}' returning attributes`;
      const saved = await one<{ attributes: { photo: { size: number; mime_type: string } } }>(
        db,
        set("vehicle/photo/ok.png"),
      );
      expect(saved.attributes.photo).toMatchObject({ size: 2048, mime_type: "image/png" });
      expect(fieldErrors(await expectFailure(db, set("vehicle/photo/big.png"))).photo).toMatch(
        /larger than 10 MB/,
      );
      expect(fieldErrors(await expectFailure(db, set("vehicle/photo/doc.pdf"))).photo).toMatch(
        /type is not allowed/,
      );
      expect(fieldErrors(await expectFailure(db, set("vehicle/photo/missing.png"))).photo).toMatch(
        /not found/,
      );
      expect(fieldErrors(await expectFailure(db, set("order/notes/ok.png"))).photo).toMatch(
        /not uploaded for this field/,
      );
    });
  });
});
