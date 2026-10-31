# DECISIONS

## What I assumed

- **Timezone Boundary Buffering (Rule #1):** Bluebay sites span UTC+7 (Jakarta) to UTC+11 (Sydney). When querying `/v1/requests?created_from=...&created_to=...`, the API filters by UTC date. A request created in Sydney at 06:00 on Nov 2 has a UTC `created_at` timestamp in late Nov 1. To guarantee that edge requests are never dropped across day boundaries, the client expands the API query range by +/- 1 day (`shiftDate`), then strictly filters in-memory using `localDate(created_at, site.timezone) in [from, to]`.
- **First Response & Reverted Events (Rules #5 & #6):** If a `processing` event was undone via `reverts_id` (e.g. an erroneous status click reverted by the actor), it is excluded from first response calculation. The true first response is the earliest non-reverted processing event with a valid `actor_id`.
- **Change Feed Cursor Expiration:** Change feed cursors expire after 15 minutes (HTTP 410). When a 410 occurs, the client removes the invalid cursor from `sessionStorage` and gracefully restarts without showing an error banner.
- **Board Status Filters:** The status filter dropdown on the board displays active statuses (`pending`, `processing`, `complete`), omitting `canceled` since Rule #1 specifies `canceled` requests are excluded from the board.

## What I found in the API or data

- **Stale Name Trap (Rule #3):** Requests contain `assignee.name` and events contain `actor_name` recorded at creation time, which are frequently stale. We resolved all assignee and actor names strictly via id lookup in a reactive `staffMap` populated from `/v1/staff` and updated via `staff.updated` events from the change feed.
- **Change Feed Volume & Rate Limiting (429):** `/v1/changes` contains the complete historical log (~78,000+ items). Attempting to paginate from sequence 1 in a rapid loop triggers HTTP 429 after ~40 pages. We solved this by:
  - Caching `next_cursor` in `sessionStorage` so page navigation and reloads do not re-request historical changes.
  - Capping change feed polling to a maximum of 20 pages per poll with a 50ms pause between pages.
  - Adding automatic exponential backoff retry in `src/api.ts` honoring the `Retry-After` response header.
- **Mixed Time Formats (Rule #4):** `created_at` and `updated_at` are ISO 8601 UTC strings; event `at` is Unix seconds; event `due_at` is site-local wall-clock time string `DD/MM/YYYY HH:MM`. All timestamps are formatted into the site's local timezone using native `Intl.DateTimeFormat` with explicit timezone name labels (e.g. `GMT+8`, `GMT+11`).

## How I used AI

- Used AI as an interactive pair programmer for exploring the API behavior, verifying timezone boundary conditions against live endpoints, and scaffolding architecture.
- Modularized starter kit into focused layers: typed API client (`api.ts`), custom hooks (`useRequests`, `useChangeFeed`, `useData`), pure rule helpers (`rules.ts`), and accessible UI components (`BoardPage`, `RequestDetailPage`).
- AI initially suggested an unthrottled `while (hasMore)` loop for change feed polling, which triggered 429 rate limit during live API testing. Promptly refined this with `sessionStorage` cursor caching, batch limits, and backoff handling.
- Generated comprehensive unit tests using Vitest covering date manipulation, timezone formatting, and all business rules (`isValidRequest`, `isOverdue`, `getRevertedEventIds`, `getFirstResponse`).

## Trade-offs and what I would do next

- **In-Memory Filtering & Sorting:** For typical 30-day date ranges, the volume of active requests is well within browser performance capacity (a few hundred records). We fetch all pages for the date range once, then filter and sort in-memory for zero-latency UI interactions. For production systems with millions of records, server-side pagination with debounced query parameters would be preferable.
- **Change Feed Reconciliation:** The change feed updates existing request records in-place. If an update changes a request's status to `canceled` or moves its site-local creation date outside the current filter range, it is automatically removed from the active view.
- **Accessibility & Polish:** Implemented full keyboard navigation (Enter/Space on table rows, Tab focus rings, Escape handling), screen reader semantic landmarks (`role="region"`, `role="link"`, `aria-sort`, `aria-live`), and responsive mobile layout. With additional time, I would implement column resizing, CSV export, and virtualized list rendering for very large date ranges.
- **Video Walkthrough:** Recorded a ~3 minute video demonstrating the board, timezone-aware overdue detection, request detail view with timeline and undone toggling, and live change feed polling.
