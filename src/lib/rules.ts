import { localDate, todayInTimezone } from "./dates";
import type { HelpdeskRequest, RequestEvent, Status } from "../types";

/**
 * Rule #1: Which requests count
 * - created_at in site local date is within [from, to] inclusive
 * - Skip canceled, deleted_at, merged_into_id
 */
export function isValidRequest(
  r: HelpdeskRequest,
  from: string,
  to: string,
  siteTimezone: string | undefined,
): boolean {
  if (r.status === "canceled") return false;
  if (r.deleted_at) return false;
  if (r.merged_into_id) return false;

  if (siteTimezone) {
    const createdLocal = localDate(new Date(r.created_at), siteTimezone);
    if (createdLocal < from || createdLocal > to) return false;
  }

  return true;
}

/**
 * Rule #2: Overdue
 * - Status is pending or processing
 * - due_on (site local date) is before today in site's timezone
 * - due_on: null is never overdue
 */
export function isOverdue(
  status: Status,
  dueOn: string | null,
  siteTimezone: string | undefined,
): boolean {
  if (!dueOn) return false;
  if (status !== "pending" && status !== "processing") return false;
  if (!siteTimezone) return false;
  const today = todayInTimezone(siteTimezone);
  return dueOn < today;
}

/**
 * Rule #5: Undone events
 * - Event with reverts_id undoes the event it points at
 * - Returns a Set containing both the reverting and reverted event IDs
 */
export function getRevertedEventIds(
  events: Array<{ id: number; reverts_id: number | null }>,
): Set<number> {
  const ids = new Set<number>();
  for (const evt of events) {
    if (evt.reverts_id != null) {
      ids.add(evt.reverts_id);
      ids.add(evt.id);
    }
  }
  return ids;
}

/**
 * Rule #6: First response
 * - The earliest event (by `at`) with status `processing` and an `actor_id`
 * - Undone events (Rule #5) are excluded
 */
export function getFirstResponse(
  events: RequestEvent[],
  revertedIds?: Set<number>,
): RequestEvent | null {
  const rev = revertedIds ?? getRevertedEventIds(events);
  const sorted = [...events].sort((a, b) => a.at - b.at);
  return (
    sorted.find(
      (e) =>
        e.status === "processing" && e.actor_id != null && !rev.has(e.id),
    ) ?? null
  );
}
