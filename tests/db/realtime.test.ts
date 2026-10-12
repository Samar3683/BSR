import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { DB_URL, closePool, getPool } from "./helpers";

afterAll(closePool);

/** Resolves with the notifications that arrive on the channel within `ms`. */
async function listenFor(
  action: () => Promise<void>,
  ms = 1500,
): Promise<{ t: string; op: string }[]> {
  const listener = new pg.Client({ connectionString: DB_URL });
  await listener.connect();
  const received: { t: string; op: string }[] = [];
  listener.on("notification", (m) => received.push(JSON.parse(m.payload ?? "{}")));
  await listener.query("listen bsr_changes");
  try {
    await action();
    await new Promise((resolve) => setTimeout(resolve, ms));
  } finally {
    await listener.end();
  }
  return received;
}

describe("change notifications", () => {
  it("announce which table changed, once per statement and without any row data", async () => {
    const pool = getPool();
    const received = await listenFor(async () => {
      await pool.query(
        "insert into public.contact_events (channel, page) values ('phone', '/test-realtime'), ('email', '/test-realtime')",
      );
    });
    // Two rows in one statement: one message, naming the table and the operation only.
    const mine = received.filter((m) => m.t === "contact_events");
    expect(mine).toEqual([{ t: "contact_events", op: "INSERT" }]);
    expect(Object.keys(mine[0]!).sort()).toEqual(["op", "t"]);
    await pool.query("delete from public.contact_events where page = '/test-realtime'");
  });

  it("fire for the public intake as well, so the dashboard learns about new requests", async () => {
    const pool = getPool();
    let reference = "";
    const received = await listenFor(async () => {
      const { rows } = await pool.query<{ r: string }>(
        "select intake.submit_quote_request($1::jsonb) as r",
        [
          JSON.stringify({
            name: "Live Test",
            phone: "+39 333 1234567",
            pickup: { street: "a", zip: "1", city: "c", province: "p" },
            delivery: { street: "a", zip: "1", city: "c", province: "p" },
          }),
        ],
      );
      reference = rows[0]!.r;
    });
    expect(received).toContainEqual({ t: "quote_requests", op: "INSERT" });
    await pool.query("delete from public.quote_requests where reference = $1", [reference]);
  });
});
