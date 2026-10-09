import type { ReconException } from "../engine/reconcile";

export function toCsv(rows: readonly ReconException[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["order_id", "exception_type", "severity", "dollar_impact", "days_open", "site", "channel", "customer", "skus", "detail"];
  const lines = rows.map((r) =>
    [r.orderId, r.type, r.severity, r.dollarImpact.toFixed(2), r.daysOpen, r.siteId, r.channel, r.customer, r.skus.join(" "), r.detail]
      .map(esc)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
