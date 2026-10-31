import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { listSites, listStaff, listStatuses } from "../api";
import type { Site, Staff, StatusInfo } from "../types";

interface DataContextValue {
  sites: Site[];
  siteMap: Map<number, Site>;
  staffMap: Map<number, string>;
  statuses: StatusInfo[];
  loading: boolean;
  error: string | null;
  /** Merge updated staff entries (from change feed). */
  updateStaff: (updated: Staff[]) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteMap, setSiteMap] = useState<Map<number, Site>>(new Map());
  const [staffMap, setStaffMap] = useState<Map<number, string>>(new Map());
  const [statuses, setStatuses] = useState<StatusInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const didFetch = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    async function load() {
      try {
        const [sitesRes, staffRes, statusesRes] = await Promise.all([
          listSites(),
          listStaff(),
          listStatuses(),
        ]);

        setSites(sitesRes.data);
        setSiteMap(new Map(sitesRes.data.map((s) => [s.id, s])));
        setStaffMap(new Map(staffRes.data.map((s) => [s.id, s.name])));
        setStatuses(statusesRes.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const updateStaff = useCallback((updated: Staff[]) => {
    setStaffMap((prev) => {
      const next = new Map(prev);
      for (const s of updated) next.set(s.id, s.name);
      return next;
    });
  }, []);

  return (
    <DataContext.Provider
      value={{ sites, siteMap, staffMap, statuses, loading, error, updateStaff }}
    >
      {children}
    </DataContext.Provider>
  );
}
