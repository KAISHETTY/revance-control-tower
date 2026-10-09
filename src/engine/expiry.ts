import { daysBetween } from "../lib/dates";
import { productBySku } from "../sim/products";
import type { Lot, SiteId, World } from "../sim/types";

export type ExpiryStatus = "expired" | "critical" | "warning" | "ok";
export const EXPIRY_ORDER: readonly ExpiryStatus[] = ["expired", "critical", "warning", "ok"];

export const CRITICAL_DAYS = 30;
export const WARNING_DAYS = 90;

export function daysToExpiry(expiresOn: string, today: string): number {
  return daysBetween(today, expiresOn);
}

/** A lot is usable through its expiry date; it is expired from the next day. */
export function classifyExpiry(expiresOn: string, today: string): ExpiryStatus {
  const d = daysToExpiry(expiresOn, today);
  if (d < 0) return "expired";
  if (d <= CRITICAL_DAYS) return "critical";
  if (d <= WARNING_DAYS) return "warning";
  return "ok";
}

/** Worst status among a set of lots (used for bay color). */
export function worstExpiry(lots: readonly Lot[], today: string): ExpiryStatus {
  let worst = 3;
  for (const lot of lots) {
    if (lot.qty <= 0) continue;
    worst = Math.min(worst, EXPIRY_ORDER.indexOf(classifyExpiry(lot.expiresOn, today)));
  }
  return EXPIRY_ORDER[worst];
}

export interface LotView extends Lot {
  siteId: SiteId;
  bayLabel: string;
  zone: string;
  productName: string;
  value: number;
  daysLeft: number;
  status: ExpiryStatus;
}

export function allLots(world: World): LotView[] {
  const out: LotView[] = [];
  for (const site of world.sites) {
    for (const bay of site.bays) {
      for (const lot of bay.lots) {
        const p = productBySku(lot.sku);
        out.push({
          ...lot,
          siteId: site.id,
          bayLabel: bay.label,
          zone: bay.zone,
          productName: p.name,
          value: lot.qty * p.unitPrice,
          daysLeft: daysToExpiry(lot.expiresOn, world.today),
          status: classifyExpiry(lot.expiresOn, world.today),
        });
      }
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export type ExpiryBuckets = Record<ExpiryStatus, { lots: number; value: number }>;

export function expiryBuckets(lots: readonly LotView[]): ExpiryBuckets {
  const b: ExpiryBuckets = {
    expired: { lots: 0, value: 0 },
    critical: { lots: 0, value: 0 },
    warning: { lots: 0, value: 0 },
    ok: { lots: 0, value: 0 },
  };
  for (const lot of lots) {
    if (lot.qty <= 0) continue;
    b[lot.status].lots += 1;
    b[lot.status].value += lot.value;
  }
  return b;
}
