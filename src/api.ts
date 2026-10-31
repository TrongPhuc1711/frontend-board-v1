
import type {
  HelpdeskRequest,
  Page,
  RequestEvent,
  Site,
  Staff,
  StatusInfo,
  ChangeFeedResponse,
} from "./types";

const BASE = (import.meta.env.HELPDESK_URL ?? "").replace(/\/$/, "");
const TOKEN = import.meta.env.HELPDESK_TOKEN ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }
}

export function configured(): boolean {
  return Boolean(BASE && TOKEN);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function get<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const waitSeconds = retryAfter
        ? Number(retryAfter)
        : Math.min(2 ** attempt, 10);
      if (attempt < maxRetries) {
        await delay(waitSeconds * 1000);
        continue;
      }
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      const retryAfter = response.headers.get("Retry-After");
      throw new ApiError(
        response.status,
        body.error ?? response.statusText,
        retryAfter ? Number(retryAfter) : null,
      );
    }

    return (await response.json()) as T;
  }

  throw new ApiError(429, "Rate-limited after multiple retries");
}


export async function fetchAllPages<T>(
  fetcher: (page: number) => Promise<Page<T>>,
): Promise<T[]> {
  const first = await fetcher(1);
  const all = [...first.data];
  const totalPages = first.total_pages ?? 1;

  if (totalPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) => fetcher(i + 2)),
    );
    for (const page of rest) all.push(...page.data);
  }

  return all;
}

export async function fetchAllEvents(
  requestId: number,
): Promise<RequestEvent[]> {
  const all: RequestEvent[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await listEvents(requestId, page);
    all.push(...result.data);
    hasMore = result.has_more ?? false;
    page++;
  }

  return all;
}

export const listRequests = (params: {
  page?: number;
  per_page?: number;
  created_from?: string;
  created_to?: string;
  status?: string;
}) => get<Page<HelpdeskRequest>>("/v1/requests", params);

export const getRequest = (id: number) =>
  get<HelpdeskRequest>(`/v1/requests/${id}`);

export const listEvents = (id: number, page = 1) =>
  get<Page<RequestEvent>>(`/v1/requests/${id}/events`, { page });

export const listSites = () => get<{ data: Site[] }>("/v1/sites");

export const listStaff = () => get<{ data: Staff[] }>("/v1/staff");

export const listStatuses = () => get<{ data: StatusInfo[] }>("/v1/statuses");

export const getChanges = (cursor?: string, limit = 500) =>
  get<ChangeFeedResponse>("/v1/changes", {
    cursor,
    limit,
  } as Record<string, string | number | undefined>);
