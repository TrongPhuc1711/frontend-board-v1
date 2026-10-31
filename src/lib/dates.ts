export function toApiDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`Not a YYYY-MM-DD date: ${isoDate}`);
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** The YYYY-MM-DD date of an instant in a given IANA timezone. */
export function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const g = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

/** Today's date, as YYYY-MM-DD, minus `days` days (UTC arithmetic on the calendar date). */
export function daysAgo(days: number, today = new Date()): string {
  const date = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() - days,
    ),
  );
  return date.toISOString().slice(0, 10);
}

/** Today's date (YYYY-MM-DD) in a specific IANA timezone. */
export function todayInTimezone(timezone: string): string {
  return localDate(new Date(), timezone);
}

/** Add or subtract days from an ISO YYYY-MM-DD date. */
export function shiftDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Format a UTC ISO-8601 datetime in the site's timezone.
 *  Example: "6 Oct 2026, 10:15 SGT" */
export function formatUtcInTz(isoUtc: string, timezone: string): string {
  const date = new Date(isoUtc);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

/** Format Unix seconds in the site's timezone.
 *  Example: "6 Oct 2026, 10:15 SGT" */
export function formatUnixInTz(
  unixSeconds: number,
  timezone: string,
): string {
  const date = new Date(unixSeconds * 1000);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

/** Format a site-local "DD/MM/YYYY HH:MM" string for display (pass-through with zone label). */
export function formatLocalDueAt(
  dueAt: string,
  timezone: string,
): string {
  const abbr = getTimezoneAbbr(timezone);
  return `${dueAt} ${abbr}`;
}

/** Get the short timezone abbreviation for display. */
export function getTimezoneAbbr(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    timeZoneName: "short",
  }).formatToParts(new Date());
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timezone;
}

/** Format a YYYY-MM-DD date for display (human friendly). */
export function formatDateDisplay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
