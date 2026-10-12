import { describe, expect, it } from "vitest";

import { buildStatement, columnExpr, quoteIdent, RestError, type RestOp } from "./rest";

const select = (extra: Partial<RestOp> = {}): RestOp => ({
  table: "orders",
  action: "select",
  ...extra,
});

describe("identifier safety", () => {
  it("quotes plain names and rejects anything else", () => {
    expect(quoteIdent("orders")).toBe('"orders"');
    for (const bad of ['a"b', "a b", "a;drop", "1abc", "", "a-b"]) {
      expect(() => quoteIdent(bad), bad).toThrow(RestError);
    }
  });

  it("allows a text lookup inside a json column and nothing more", () => {
    expect(columnExpr("context->>order_id")).toBe(`"context"->>'order_id'`);
    expect(() => columnExpr("context->>a->>b")).toThrow(RestError);
    expect(() => columnExpr("context->>x'y")).toThrow(RestError);
  });
});

describe("select statements", () => {
  it("binds every value and keeps filters, order and range in order", () => {
    const built = buildStatement(
      select({
        columns: "id, status",
        filters: [
          { op: "eq", column: "status", value: "draft" },
          { op: "gte", column: "created_at", value: "2026-01-01" },
          { op: "in", column: "id", value: ["a", "b"] },
          { op: "is", column: "archived_at", value: null },
        ],
        order: [
          { column: "created_at", ascending: false },
          { column: "id", ascending: true },
        ],
        range: [10, 19],
      }),
    );
    expect(built.text).toBe(
      'select "id", "status" from public."orders" where "status" = $1 and "created_at" >= $2 and "id" = any($3) and "archived_at" is null order by "created_at" desc, "id" asc limit 10 offset 10',
    );
    expect(built.params).toEqual(["draft", "2026-01-01", ["a", "b"]]);
  });

  it("never puts user text in the statement", () => {
    const evil = "x'; drop table orders; --";
    const built = buildStatement(
      select({ filters: [{ op: "ilike", column: "display_name", value: evil }] }),
    );
    expect(built.text).not.toContain("drop table");
    expect(built.params).toEqual([evil]);
  });

  it("parses or() conditions, comparing as text with bound values", () => {
    const built = buildStatement(
      select({
        table: "audit_logs",
        filters: [
          {
            op: "or",
            expr: "entity_label.ilike.%rossi%,actor_label.ilike.%rossi%,entity_id.eq.abc",
          },
        ],
      }),
    );
    expect(built.text).toContain(
      `("entity_label"::text ilike $1 or "actor_label"::text ilike $2 or "entity_id"::text = $3)`,
    );
    expect(built.params).toEqual(["%rossi%", "%rossi%", "abc"]);
    expect(() => buildStatement(select({ filters: [{ op: "or", expr: "a.drop.b" }] }))).toThrow(
      RestError,
    );
  });

  it("adds an exact count query with the same filters", () => {
    const built = buildStatement(
      select({
        count: "exact",
        filters: [{ op: "eq", column: "status", value: "draft" }],
        range: [0, 24],
      }),
    );
    expect(built.countText).toBe(
      'select count(*) as count from public."orders" where "status" = $1',
    );
    expect(built.countParams).toEqual(["draft"]);
  });

  it("caps the number of rows", () => {
    expect(buildStatement(select({ limit: 99999999 })).text).toContain("limit 10000");
    expect(buildStatement(select()).text).toContain("limit 10000");
  });
});

describe("mutations", () => {
  const types = { attributes: { json: true, array: false } };

  it("serialises json columns and returns rows only when asked", () => {
    const insert = buildStatement(
      {
        table: "customers",
        action: "insert",
        values: { attributes: { a: 1 } },
        returning: true,
        columns: "id",
      },
      types,
    );
    expect(insert.text).toBe(
      'insert into public."customers" ("attributes") values ($1) returning "id"',
    );
    expect(insert.params).toEqual(['{"a":1}']);

    const quiet = buildStatement(
      { table: "customers", action: "insert", values: { attributes: {} } },
      types,
    );
    expect(quiet.text).not.toContain("returning");
  });

  it("updates with filters and refuses unfiltered deletes", () => {
    const update = buildStatement(
      {
        table: "customers",
        action: "update",
        values: { archived_at: null },
        filters: [{ op: "eq", column: "id", value: "x" }],
      },
      types,
    );
    expect(update.text).toBe('update public."customers" set "archived_at" = $1 where "id" = $2');
    expect(update.params).toEqual([null, "x"]);
    expect(() => buildStatement({ table: "customers", action: "delete" })).toThrow(RestError);
  });
});
