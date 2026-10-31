import { useCallback, useEffect, useRef, useState } from "react";
import { getChanges, ApiError } from "../api";
import type { ChangeFeedItem, HelpdeskRequest, Staff } from "../types";

interface UseChangeFeedOptions {
  /** Called for every request.created / request.updated item. */
  onRequestChange?: (request: HelpdeskRequest) => void;
  /** Called when staff data changes. */
  onStaffChange?: (staff: Staff) => void;
  /** Polling interval in ms (default 30 000). */
  intervalMs?: number;
  /** Whether polling is enabled. */
  enabled?: boolean;
}

interface UseChangeFeedResult {
  lastUpdated: Date | null;
  polling: boolean;
  error: string | null;
}

const CURSOR_STORAGE_KEY = "helpdesk_changes_cursor";

export function useChangeFeed({
  onRequestChange,
  onStaffChange,
  intervalMs = 30_000,
  enabled = true,
}: UseChangeFeedOptions): UseChangeFeedResult {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cursorRef = useRef<string | undefined>(
    (typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(CURSOR_STORAGE_KEY)
      : null) || undefined,
  );
  const activeRef = useRef(false);

  // Store callbacks in refs so interval doesn't go stale
  const onReqRef = useRef(onRequestChange);
  onReqRef.current = onRequestChange;
  const onStaffRef = useRef(onStaffChange);
  onStaffRef.current = onStaffChange;

  const poll = useCallback(async () => {
    if (activeRef.current) return; // skip if a poll is already in-flight
    activeRef.current = true;
    setPolling(true);

    try {
      let hasMore = true;
      let pages = 0;
      const MAX_PAGES_PER_POLL = 20;

      while (hasMore && pages < MAX_PAGES_PER_POLL) {
        pages++;
        const res = await getChanges(cursorRef.current, 500);

        for (const item of res.data) {
          processItem(item, onReqRef.current, onStaffRef.current);
        }

        if (res.next_cursor) {
          cursorRef.current = res.next_cursor;
          try {
            sessionStorage.setItem(CURSOR_STORAGE_KEY, res.next_cursor);
          } catch {}
        }
        hasMore = res.has_more;

        if (hasMore && pages < MAX_PAGES_PER_POLL) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 410) {
        // Cursor expired — reset and try again next interval
        cursorRef.current = undefined;
        try {
          sessionStorage.removeItem(CURSOR_STORAGE_KEY);
        } catch {}
        setError(null); // not a user-facing error
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      activeRef.current = false;
      setPolling(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Initial poll
    poll();

    const id = setInterval(poll, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, poll]);

  return { lastUpdated, polling, error };
}

function processItem(
  item: ChangeFeedItem,
  onReq?: (r: HelpdeskRequest) => void,
  onStaff?: (s: Staff) => void,
) {
  switch (item.type) {
    case "request.created":
    case "request.updated":
      if (item.request && onReq) onReq(item.request);
      break;
    case "staff.updated":
      if (item.staff && onStaff) onStaff(item.staff);
      break;
    default:
      break;
  }
}
