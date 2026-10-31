import { useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useData } from "../context/DataContext";
import { useRequests } from "../hooks/useRequests";
import { useChangeFeed } from "../hooks/useChangeFeed";
import {
  daysAgo,
  formatUtcInTz,
  formatDateDisplay,
} from "../lib/dates";
import { isOverdue } from "../lib/rules";
import type { HelpdeskRequest, Status } from "../types";

type SortField = "created" | "due";
type SortOrder = "asc" | "desc";

export default function BoardPage() {
  const { sites, siteMap, staffMap, statuses, loading: metaLoading, error: metaError, updateStaff } = useData();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  // --- URL state ---
  const from = params.get("from") || daysAgo(30);
  const to = params.get("to") || daysAgo(0);
  const siteFilter = params.get("site") || "";
  const statusFilter = params.get("status") || "";
  const sortField = (params.get("sort") as SortField) || "created";
  const sortOrder = (params.get("order") as SortOrder) || "desc";

  const setParam = useCallback(
    (key: string, value: string) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      });
    },
    [setParams],
  );

  //Data fetching
  const {
    requests,
    loading: reqLoading,
    error: reqError,
    refetch,
    applyUpdate,
  } = useRequests({ from, to, siteMap });

  //Live updates 
  const onRequestChange = useCallback(
    (r: HelpdeskRequest) => {
      applyUpdate(r);
    },
    [applyUpdate],
  );

  const onStaffChange = useCallback(
    (s: { id: number; name: string }) => updateStaff([s]),
    [updateStaff],
  );

  const { lastUpdated } = useChangeFeed({
    onRequestChange,
    onStaffChange,
    enabled: !metaLoading,
  });

  // --- Client-side filter & sort ---
  const filtered = useMemo(() => {
    let list = requests;

    // Filter by site
    if (siteFilter) {
      const siteId = Number(siteFilter);
      list = list.filter((r) => r.site_id === siteId);
    }

    // Filter by status
    if (statusFilter) {
      const allowed = statusFilter.split(",") as Status[];
      list = list.filter((r) => allowed.includes(r.status));
    }

    // Sort
    list = [...list].sort((a, b) => {
      let cmp: number;
      if (sortField === "due") {
        const aVal = a.due_on ?? "";
        const bVal = b.due_on ?? "";
        cmp = aVal.localeCompare(bVal);
      } else {
        cmp = a.created_at.localeCompare(b.created_at);
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return list;
  }, [requests, siteFilter, statusFilter, sortField, sortOrder]);

  // --- Overdue check (Rule #2) ---
  const checkOverdue = useCallback(
    (r: HelpdeskRequest): boolean => {
      const site = siteMap.get(r.site_id);
      return isOverdue(r.status, r.due_on, site?.timezone);
    },
    [siteMap],
  );

  // --- Helpers ---
  const getStaffName = useCallback(
    (id: number | null | undefined): string => {
      if (id == null) return "—";
      return staffMap.get(id) ?? "Unknown";
    },
    [staffMap],
  );

  const getSiteName = useCallback(
    (siteId: number): string => siteMap.get(siteId)?.name ?? `Site ${siteId}`,
    [siteMap],
  );

  const getSiteTimezone = useCallback(
    (siteId: number): string => siteMap.get(siteId)?.timezone ?? "UTC",
    [siteMap],
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setParam("order", sortOrder === "asc" ? "desc" : "asc");
    } else {
      setParam("sort", field);
      setParam("order", "desc");
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return "";
    return sortOrder === "asc" ? " ↑" : " ↓";
  };

  // --- Loading / Error ---
  const loading = metaLoading || reqLoading;
  const error = metaError || reqError;

  if (!metaLoading && metaError) {
    return (
      <main className="board-page">
        <div className="error-banner" role="alert">
          <span className="error-icon">⚠</span>
          <span>Failed to load: {metaError}</span>
        </div>
      </main>
    );
  }

  // Active status options (exclude canceled per Rule #1)
  const activeStatuses = statuses.filter((s) => s.value !== "canceled");

  return (
    <main className="board-page">
      {/* Header */}
      <header className="board-header">
        <div className="board-title-row">
          <h1>Requests Board</h1>
          {lastUpdated && (
            <span className="last-updated" role="status" aria-live="polite">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="filters-bar" role="search" aria-label="Filter requests">
          <div className="filter-group">
            <label htmlFor="filter-from">From</label>
            <input
              id="filter-from"
              type="date"
              value={from}
              onChange={(e) => setParam("from", e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="filter-to">To</label>
            <input
              id="filter-to"
              type="date"
              value={to}
              onChange={(e) => setParam("to", e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="filter-site">Site</label>
            <select
              id="filter-site"
              value={siteFilter}
              onChange={(e) => setParam("site", e.target.value)}
            >
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setParam("status", e.target.value)}
            >
              <option value="">All statuses</option>
              {activeStatuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="error-banner" role="alert">
          <span className="error-icon">⚠</span>
          <span>{error}</span>
          <button
            className="retry-btn"
            onClick={() => refetch()}
            aria-label="Retry loading requests"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading-bar" aria-live="polite" role="status">
          <div className="loading-bar-track">
            <div className="loading-bar-fill" />
          </div>
          Loading requests…
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state" role="status">
          <div className="empty-icon">📋</div>
          <h2>No requests found</h2>
          <p>Try adjusting the date range or filters.</p>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <>
          <p className="results-count muted">
            {filtered.length} request{filtered.length !== 1 ? "s" : ""}
            {" "}from {formatDateDisplay(from)} to {formatDateDisplay(to)}
          </p>
          <div className="table-scroll" role="region" aria-label="Requests table" tabIndex={0}>
            <table aria-label="Helpdesk requests">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Ref</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>
                    <button
                      className="sort-btn"
                      onClick={() => toggleSort("created")}
                      aria-sort={sortField === "created" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
                    >
                      Created{sortIndicator("created")}
                    </button>
                  </th>
                  <th>
                    <button
                      className="sort-btn"
                      onClick={() => toggleSort("due")}
                      aria-sort={sortField === "due" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
                    >
                      Due{sortIndicator("due")}
                    </button>
                  </th>
                  <th aria-label="Overdue status">⏰</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const overdue = checkOverdue(r);
                  return (
                    <tr
                      key={r.id}
                      className={`request-row${overdue ? " overdue-row" : ""}`}
                      onClick={() => navigate(`/request/${r.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/request/${r.id}`);
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`Request ${r.ref}: ${r.title}`}
                    >
                      <td className="cell-site">{getSiteName(r.site_id)}</td>
                      <td className="cell-ref">{r.ref}</td>
                      <td className="cell-title">{r.title}</td>
                      <td>
                        <span className={`badge priority-${(r.priority ?? "none").toLowerCase()}`}>
                          {r.priority ?? "—"}
                        </span>
                      </td>
                      <td>
                        <span className={`badge status-${r.status}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>{getStaffName(r.assignee?.id)}</td>
                      <td className="cell-date">
                        {formatUtcInTz(r.created_at, getSiteTimezone(r.site_id))}
                      </td>
                      <td className="cell-date">
                        {r.due_on ? formatDateDisplay(r.due_on) : "—"}
                      </td>
                      <td className="cell-overdue">
                        {overdue && (
                          <span className="overdue-dot" title="Overdue" aria-label="Overdue">
                            🔴
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
