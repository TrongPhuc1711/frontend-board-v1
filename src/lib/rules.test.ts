import { describe, expect, it } from "vitest";
import { isValidRequest, isOverdue, getRevertedEventIds, getFirstResponse } from "./rules";
import type { HelpdeskRequest, RequestEvent } from "../types";

describe("Rule #1: isValidRequest", () => {
  const baseRequest: HelpdeskRequest = {
    id: 1,
    ref: "WO-001",
    title: "Test",
    location: "Lobby",
    site_id: 11,
    status: "pending",
    priority: "High",
    created_at: "2026-10-15T12:00:00Z",
    updated_at: "2026-10-15T12:00:00Z",
    due_on: "2026-10-20",
    assignee: { id: 10, name: "Old Name" },
    deleted_at: null,
    merged_into_id: null,
  };

  it("accepts valid requests within date range", () => {
    expect(isValidRequest(baseRequest, "2026-10-01", "2026-10-31", "Asia/Singapore")).toBe(true);
  });

  it("skips canceled requests", () => {
    expect(isValidRequest({ ...baseRequest, status: "canceled" }, "2026-10-01", "2026-10-31", "Asia/Singapore")).toBe(false);
  });

  it("skips deleted requests", () => {
    expect(isValidRequest({ ...baseRequest, deleted_at: "2026-10-16T00:00:00Z" }, "2026-10-01", "2026-10-31", "Asia/Singapore")).toBe(false);
  });

  it("skips merged requests", () => {
    expect(isValidRequest({ ...baseRequest, merged_into_id: 999 }, "2026-10-01", "2026-10-31", "Asia/Singapore")).toBe(false);
  });

  it("respects site timezone date boundaries", () => {
    // 2026-10-05 20:00 UTC is 2026-10-06 06:00:00 in Sydney (AEDT, UTC+11)
    const sydneyReq: HelpdeskRequest = {
      ...baseRequest,
      created_at: "2026-10-05T20:00:00Z",
    };
    // Should be in range for 2026-10-06 in Sydney
    expect(isValidRequest(sydneyReq, "2026-10-06", "2026-10-06", "Australia/Sydney")).toBe(true);
    // But NOT in range for 2026-10-05 in Sydney
    expect(isValidRequest(sydneyReq, "2026-10-05", "2026-10-05", "Australia/Sydney")).toBe(false);
  });
});

describe("Rule #2: isOverdue", () => {
  it("returns false if due_on is null", () => {
    expect(isOverdue("pending", null, "Asia/Singapore")).toBe(false);
    expect(isOverdue("processing", null, "Asia/Singapore")).toBe(false);
  });

  it("returns false for complete or canceled status", () => {
    expect(isOverdue("complete", "2020-01-01", "Asia/Singapore")).toBe(false);
    expect(isOverdue("canceled", "2020-01-01", "Asia/Singapore")).toBe(false);
  });

  it("returns true for pending/processing with past due_on", () => {
    expect(isOverdue("pending", "2020-01-01", "Asia/Singapore")).toBe(true);
    expect(isOverdue("processing", "2020-01-01", "Asia/Singapore")).toBe(true);
  });

  it("returns false for future due_on", () => {
    expect(isOverdue("pending", "2099-01-01", "Asia/Singapore")).toBe(false);
  });
});

describe("Rule #5: getRevertedEventIds", () => {
  it("collects both the revert event and the original reverted event", () => {
    const events = [
      { id: 101, reverts_id: null },
      { id: 102, reverts_id: null },
      { id: 103, reverts_id: 101 },
    ];
    const ids = getRevertedEventIds(events);
    expect(ids.has(101)).toBe(true);
    expect(ids.has(103)).toBe(true);
    expect(ids.has(102)).toBe(false);
  });
});

describe("Rule #6: getFirstResponse", () => {
  const events: RequestEvent[] = [
    {
      id: 1,
      status: "pending",
      at: 1000,
      actor_id: null,
      actor_name: "System",
      assignee_name: null,
      due_at: null,
      note: null,
      reverts_id: null,
    },
    {
      id: 2,
      status: "processing",
      at: 1200,
      actor_id: null, // System event, actor_id null
      actor_name: "System",
      assignee_name: null,
      due_at: null,
      note: null,
      reverts_id: null,
    },
    {
      id: 3,
      status: "processing",
      at: 1500,
      actor_id: 205,
      actor_name: "Stale Actor",
      assignee_name: null,
      due_at: null,
      note: "Accepted",
      reverts_id: null,
    },
    {
      id: 4,
      status: "complete",
      at: 2000,
      actor_id: 205,
      actor_name: "Stale Actor",
      assignee_name: null,
      due_at: null,
      note: "Done",
      reverts_id: null,
    },
  ];

  it("identifies earliest processing event with non-null actor_id", () => {
    const res = getFirstResponse(events);
    expect(res).not.toBeNull();
    expect(res?.id).toBe(3);
    expect(res?.actor_id).toBe(205);
  });

  it("skips reverted processing events", () => {
    const eventsWithRevert: RequestEvent[] = [
      {
        id: 10,
        status: "processing",
        at: 1100,
        actor_id: 301,
        actor_name: "Accidental Actor",
        assignee_name: null,
        due_at: null,
        note: null,
        reverts_id: null,
      },
      {
        id: 11,
        status: "pending",
        at: 1150,
        actor_id: 301,
        actor_name: "Accidental Actor",
        assignee_name: null,
        due_at: null,
        note: "Status changed in error",
        reverts_id: 10,
      },
      {
        id: 12,
        status: "processing",
        at: 1400,
        actor_id: 305,
        actor_name: "Real Actor",
        assignee_name: null,
        due_at: null,
        note: null,
        reverts_id: null,
      },
    ];

    const res = getFirstResponse(eventsWithRevert);
    expect(res).not.toBeNull();
    expect(res?.id).toBe(12);
    expect(res?.actor_id).toBe(305);
  });
});
