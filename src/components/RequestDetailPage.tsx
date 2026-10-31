import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRequest, fetchAllEvents, ApiError } from "../api";
import { useData } from "../context/DataContext";
import {
  formatUtcInTz,
  formatUnixInTz,
  formatLocalDueAt,
  formatDateDisplay,
} from "../lib/dates";
import {
  isOverdue,
  getRevertedEventIds,
  getFirstResponse,
} from "../lib/rules";
import type { HelpdeskRequest, RequestEvent } from "../types";

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { siteMap, staffMap } = useData();

  const [request, setRequest] = useState<HelpdeskRequest | null>(null);
  const [events, setEvents] = useState<RequestEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReverted, setShowReverted] = useState(false);
  const requestId = Number(id);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [req, evts] = await Promise.all([
        getRequest(requestId),
        fetchAllEvents(requestId),
      ]);
      setRequest(req);
      setEvents(evts);
    } catch (e) {
      setError(
        e instanceof ApiError ? `${e.status}: ${e.message}` : String(e),
      );
    } finally {
      setLoading(false);
    }
  }, [id, requestId]);

  useEffect(() => {
    load();
  }, [load]);

  const site = request ? siteMap.get(request.site_id) : undefined;
  const timezone = site?.timezone ?? "UTC";

  // --- Rule #5: Filter reverted events ---
  const revertedIds = useMemo(() => getRevertedEventIds(events), [events]);

  const visibleEvents = useMemo(() => {
    let list = events;
    if (!showReverted) {
      list = list.filter((e) => !revertedIds.has(e.id));
    }
    // Sort oldest first for timeline
    return [...list].sort((a, b) => a.at - b.at);
  }, [events, showReverted, revertedIds]);

  // --- Rule #6: First response ---
  const firstResponse = useMemo(
    () => getFirstResponse(events, revertedIds),
    [events, revertedIds],
  );

  const getStaffName = useCallback(
    (actorId: number | null): string => {
      if (actorId == null) return "System";
      return staffMap.get(actorId) ?? "Unknown";
    },
    [staffMap],
  );

  // Overdue check (Rule #2)
  const isReqOverdue = useMemo(() => {
    if (!request) return false;
    return isOverdue(request.status, request.due_on, site?.timezone);
  }, [request, site]);

  // --- Render ---
  if (loading) {
    return (
      <main className="detail-page">
        <div className="loading-bar" role="status">
          <div className="loading-bar-track"><div className="loading-bar-fill" /></div>
          Loading request…
        </div>
      </main>
    );
  }

  if (error || !request) {
    return (
      <main className="detail-page">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div className="error-banner" role="alert">
          <span className="error-icon">⚠</span>
          <span>{error ?? "Request not found"}</span>
          <button className="retry-btn" onClick={() => load()}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="detail-page">
      <button
        className="back-btn"
        onClick={() => navigate(-1)}
        aria-label="Back to board"
      >
        ← Back to board
      </button>

      {/* Request header */}
      <header className="detail-header">
        <div className="detail-title-row">
          <h1>
            <span className="detail-ref">{request.ref}</span> {request.title}
          </h1>
          {isReqOverdue && (
            <span className="overdue-badge" aria-label="Overdue">
              🔴 Overdue
            </span>
          )}
        </div>

        <div className="detail-meta">
          <div className="meta-item">
            <span className="meta-label">Site</span>
            <span>{site?.name ?? `Site ${request.site_id}`}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Location</span>
            <span>{request.location}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Status</span>
            <span className={`badge status-${request.status}`}>
              {request.status}
            </span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Priority</span>
            <span
              className={`badge priority-${(request.priority ?? "none").toLowerCase()}`}
            >
              {request.priority ?? "None"}
            </span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Assignee</span>
            <span>{getStaffName(request.assignee?.id ?? null)}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Created</span>
            <span>{formatUtcInTz(request.created_at, timezone)}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Due</span>
            <span>
              {request.due_on ? formatDateDisplay(request.due_on) : "—"}
            </span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Last updated</span>
            <span>{formatUtcInTz(request.updated_at, timezone)}</span>
          </div>
        </div>

        {/* First response (Rule #6) */}
        {firstResponse && (
          <div className="first-response">
            <span className="meta-label">First response</span>
            <span>
              {getStaffName(firstResponse.actor_id)} —{" "}
              {formatUnixInTz(firstResponse.at, timezone)}
            </span>
          </div>
        )}
      </header>

      {/* Event timeline */}
      <section className="timeline-section" aria-label="Request timeline">
        <div className="timeline-header">
          <h2>
            Timeline ({visibleEvents.length} event
            {visibleEvents.length !== 1 ? "s" : ""})
          </h2>
          {revertedIds.size > 0 && (
            <label className="toggle-reverted">
              <input
                type="checkbox"
                checked={showReverted}
                onChange={(e) => setShowReverted(e.target.checked)}
              />
              Show undone events ({revertedIds.size / 2})
            </label>
          )}
        </div>

        {visibleEvents.length === 0 ? (
          <p className="muted">No events to show.</p>
        ) : (
          <ol className="timeline" aria-label="Events">
            {visibleEvents.map((evt) => {
              const isReverted = revertedIds.has(evt.id);
              return (
                <li
                  key={evt.id}
                  className={`timeline-event${isReverted ? " reverted" : ""}`}
                >
                  <div className="event-dot" />
                  <div className="event-content">
                    <div className="event-time">
                      {formatUnixInTz(evt.at, timezone)}
                    </div>
                    <div className="event-actor">
                      {getStaffName(evt.actor_id)}
                    </div>
                    <div className="event-details">
                      <span className={`badge status-${evt.status}`}>
                        {evt.status}
                      </span>
                      {evt.due_at && (
                        <span className="event-due">
                          Due: {formatLocalDueAt(evt.due_at, timezone)}
                        </span>
                      )}
                      {evt.note && (
                        <p className="event-note">{evt.note}</p>
                      )}
                      {isReverted && (
                        <span className="reverted-label">undone</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
