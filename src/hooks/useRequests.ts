import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAllPages, listRequests, ApiError } from "../api";
import { toApiDate, shiftDate } from "../lib/dates";
import { isValidRequest } from "../lib/rules";
import type { HelpdeskRequest } from "../types";

interface UseRequestsParams {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  siteMap: Map<number, { timezone: string }>;
}

interface UseRequestsResult {
  requests: HelpdeskRequest[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  applyUpdate: (updated: HelpdeskRequest) => void;
  applyCreate: (created: HelpdeskRequest) => void;
}

export function useRequests({
  from,
  to,
  siteMap,
}: UseRequestsParams): UseRequestsResult {
  const [requests, setRequests] = useState<HelpdeskRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const filterValid = useCallback(
    (list: HelpdeskRequest[]): HelpdeskRequest[] => {
      return list.filter((r) =>
        isValidRequest(r, from, to, siteMap.get(r.site_id)?.timezone),
      );
    },
    [from, to, siteMap],
  );

  const fetch_ = useCallback(async () => {
    if (siteMap.size === 0) return; // wait for sites to load

    const id = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    try {
      // Shift 1 day on both ends for API query to guarantee timezone boundary coverage (UTC+7 to UTC+11)
      const apiFrom = toApiDate(shiftDate(from, -1));
      const apiTo = toApiDate(shiftDate(to, 1));

      const all = await fetchAllPages<HelpdeskRequest>((page) =>
        listRequests({
          page,
          per_page: 100,
          created_from: apiFrom,
          created_to: apiTo,
        }),
      );

      if (id !== fetchIdRef.current) return; // stale
      setRequests(filterValid(all));
    } catch (e) {
      if (id !== fetchIdRef.current) return;
      setError(
        e instanceof ApiError ? `${e.status}: ${e.message}` : String(e),
      );
    } finally {
      if (id === fetchIdRef.current) setLoading(false);
    }
  }, [from, to, siteMap, filterValid]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  const applyUpdate = useCallback(
    (updated: HelpdeskRequest) => {
      setRequests((prev) => {
        const shouldInclude = isValidRequest(
          updated,
          from,
          to,
          siteMap.get(updated.site_id)?.timezone,
        );

        const idx = prev.findIndex((r) => r.id === updated.id);
        if (idx >= 0) {
          if (!shouldInclude) {
            return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
          }
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        if (shouldInclude) {
          return [...prev, updated];
        }
        return prev;
      });
    },
    [from, to, siteMap],
  );

  const applyCreate = useCallback(
    (created: HelpdeskRequest) => {
      applyUpdate(created); 
    },
    [applyUpdate],
  );

  return {
    requests,
    loading,
    error,
    refetch: fetch_,
    applyUpdate,
    applyCreate,
  };
}
