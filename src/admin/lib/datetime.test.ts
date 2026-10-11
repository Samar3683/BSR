import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  businessToInstant,
  businessToday,
  endOfMonth,
  formatCalendarDate,
  formatDateTime,
  instantToBusiness,
  startOfWeek,
  weekdayIndex,
} from "./datetime";

describe("business time (Europe/Rome)", () => {
  it("converts wall-clock time to instants across DST", () => {
    // Winter: UTC+1
    expect(businessToInstant("2026-01-15", "08:00").toISOString()).toBe("2026-01-15T07:00:00.000Z");
    // Summer: UTC+2
    expect(businessToInstant("2026-07-15", "08:00").toISOString()).toBe("2026-07-15T06:00:00.000Z");
    // Day of the spring change (29 March 2026): 12:00 is already UTC+2
    expect(businessToInstant("2026-03-29", "12:00").toISOString()).toBe("2026-03-29T10:00:00.000Z");
    // Day of the autumn change (25 October 2026): 12:00 is UTC+1
    expect(businessToInstant("2026-10-25", "12:00").toISOString()).toBe("2026-10-25T11:00:00.000Z");
  });

  it("round-trips instants to wall-clock parts", () => {
    expect(instantToBusiness("2026-07-15T06:00:00.000Z")).toEqual({
      date: "2026-07-15",
      time: "08:00",
    });
    expect(instantToBusiness("2026-12-31T23:30:00.000Z")).toEqual({
      date: "2027-01-01",
      time: "00:30",
    });
    expect(businessToday(new Date("2026-12-31T23:30:00.000Z"))).toBe("2027-01-01");
  });

  it("does calendar arithmetic on dates", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(weekdayIndex("2026-10-12")).toBe(0); // Monday
    expect(startOfWeek("2026-10-18")).toBe("2026-10-12");
  });

  it("formats in the business zone", () => {
    expect(formatDateTime("2026-07-15T06:00:00.000Z")).toBe("15/07/2026, 08:00");
    expect(formatCalendarDate("2026-07-15")).toBe("15/07/2026");
    expect(formatDateTime(null)).toBe("");
  });
});
