import { describe, expect, it } from "vitest";
import {
  daysAgo,
  localDate,
  toApiDate,
  shiftDate,
  formatUtcInTz,
  formatUnixInTz,
  formatLocalDueAt,
} from "./dates";

describe("toApiDate", () => {
  it("turns an ISO date into the API's DD/MM/YYYY", () => {
    expect(toApiDate("2026-10-06")).toBe("06/10/2026");
  });

  it("refuses anything else", () => {
    expect(() => toApiDate("06/10/2026")).toThrow();
  });
});

describe("localDate", () => {
  it("is the next day in Sydney when it is still evening in UTC", () => {
    const instant = new Date("2026-10-06T15:30:00Z");
    expect(localDate(instant, "Australia/Sydney")).toBe("2026-10-07");
    expect(localDate(instant, "Asia/Singapore")).toBe("2026-10-06");
  });
});

describe("daysAgo", () => {
  it("counts back across a month boundary", () => {
    expect(daysAgo(30, new Date("2026-10-15T00:00:00Z"))).toBe("2026-09-15");
  });
});

describe("shiftDate", () => {
  it("adds days forward and backward across month boundaries", () => {
    expect(shiftDate("2026-10-01", -1)).toBe("2026-09-30");
    expect(shiftDate("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("Rule #4: timezone formatting", () => {
  it("formats UTC ISO string in site timezone with zone name", () => {
    const formatted = formatUtcInTz("2026-10-06T02:15:07Z", "Asia/Singapore");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("10:15");
    // Zone name should be present (either GMT+8 or SGT)
    expect(formatted).toMatch(/GMT\+8|SGT/);
  });

  it("formats Unix seconds in site timezone with zone name", () => {
    const unixSeconds = 1791252907; // 2026-10-06T02:15:07Z
    const formatted = formatUnixInTz(unixSeconds, "Asia/Singapore");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("10:15");
    expect(formatted).toMatch(/GMT\+8|SGT/);
  });

  it("formats local due_at and appends timezone abbreviation", () => {
    const due = formatLocalDueAt("07/10/2026 10:00", "Asia/Singapore");
    expect(due).toContain("07/10/2026 10:00");
    expect(due).toMatch(/GMT\+8|SGT/);
  });
});
