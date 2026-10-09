/** Calendar helpers. All dates are ISO "YYYY-MM-DD" strings handled in UTC to avoid timezone drift. */
const DAY_MS = 86_400_000;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Today's local calendar date as an ISO string. */
export function localTodayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isoToUtcMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcMsToIso(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(iso: string, days: number): string {
  return utcMsToIso(isoToUtcMs(iso) + days * DAY_MS);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((isoToUtcMs(to) - isoToUtcMs(from)) / DAY_MS);
}

/** "Oct 3" */
export function formatShortDate(iso: string): string {
  const d = new Date(isoToUtcMs(iso));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Oct 3, 2026" */
export function formatLongDate(iso: string): string {
  const d = new Date(isoToUtcMs(iso));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
