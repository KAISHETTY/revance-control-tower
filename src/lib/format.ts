/** "$38.2K", "$950", "$1.24M" */
export function formatMoney(value: number): string {
  const sign = value < 0 ? "-" : "";
  const v = Math.abs(value);
  if (v >= 1_000_000) return `${sign}$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1000) return `${sign}$${(v / 1000).toFixed(1)}K`;
  return `${sign}$${Math.round(v).toLocaleString("en-US")}`;
}

/** "$1,234.50" for tables and drawers where exact cents matter. */
export function formatMoneyExact(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatPct(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "–";
  return `${(value * 100).toFixed(digits)}%`;
}

/** "1h 25m", "45m" */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

export function formatTemp(c: number): string {
  return `${c.toFixed(1)}°C`;
}

export function formatInt(n: number): string {
  return n.toLocaleString("en-US");
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatInt(n)} ${n === 1 ? one : many}`;
}
