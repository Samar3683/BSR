import { describe, expect, it } from "vitest";

import { instantToBusiness } from "../../lib/datetime";
import type { CalendarEvent } from "../../services/operations";
import { layoutDay, shiftInstant } from "./week-grid";

const event = (id: string, from: string, to: string) =>
  ({
    id,
    starts_at: new Date(from).toISOString(),
    ends_at: new Date(to).toISOString(),
  }) as CalendarEvent;

describe("layoutDay", () => {
  it("puts overlapping orders side by side and leaves others full width", () => {
    const segments = layoutDay(
      [
        event("a", "2026-10-14T08:00:00+02:00", "2026-10-14T10:00:00+02:00"),
        event("b", "2026-10-14T09:00:00+02:00", "2026-10-14T11:00:00+02:00"),
        event("c", "2026-10-14T13:00:00+02:00", "2026-10-14T14:00:00+02:00"),
      ],
      "2026-10-14",
    );
    const byId = Object.fromEntries(segments.map((s) => [s.event.id, s]));
    expect([byId.a!.col, byId.a!.cols]).toEqual([0, 2]);
    expect([byId.b!.col, byId.b!.cols]).toEqual([1, 2]);
    expect([byId.c!.col, byId.c!.cols]).toEqual([0, 1]);
  });

  it("clips an order that spans midnight to the day", () => {
    const [segment] = layoutDay(
      [event("x", "2026-10-14T22:00:00+02:00", "2026-10-15T02:00:00+02:00")],
      "2026-10-14",
    );
    expect(segment!.top + segment!.height).toBeCloseTo(1, 5);
  });
});

describe("shiftInstant", () => {
  it("snaps to quarter hours in business time", () => {
    const moved = shiftInstant("2026-10-14T08:00:00+02:00", 0, 38);
    expect(instantToBusiness(moved)).toEqual({ date: "2026-10-14", time: "08:45" });
  });

  it("carries over days, also backwards", () => {
    expect(instantToBusiness(shiftInstant("2026-10-14T23:30:00+02:00", 0, 60))).toEqual({
      date: "2026-10-15",
      time: "00:30",
    });
    expect(instantToBusiness(shiftInstant("2026-10-14T00:15:00+02:00", 1, -30))).toEqual({
      date: "2026-10-14",
      time: "23:45",
    });
  });
});
