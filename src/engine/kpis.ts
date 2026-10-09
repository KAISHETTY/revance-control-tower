import { daysBetween } from "../lib/dates";
import { productBySku } from "../sim/products";
import type { SiteId, World } from "../sim/types";
import type { Alert } from "./alerts";
import { classifyExpiry } from "./expiry";
import type { ReconException } from "./reconcile";

export interface Kpis {
  onTimeDelivery: number;
  deliveredShipments: number;
  avgDockDwellMinutes: number;
  dockUtilization: number;
  occupiedDocks: number;
  availableDocks: number;
  fillRate: number;
  stockValueBySite: Record<SiteId, number>;
  totalStockValue: number;
  dollarsAtRisk: number;
  ordersWithExceptions: number;
  orderCount: number;
  cleanOrderRate: number;
  lotsExpiring30: number;
  lotsExpiring90: number;
  expiredLots: number;
  coldChainAlerts: number;
}

/** Recent completed dock visits used for the dwell average. */
const DWELL_SAMPLE = 50;

/** Network KPIs, or one site's when `siteId` is given. */
export function computeKpis(world: World, exceptions: readonly ReconException[], alerts: readonly Alert[], siteId?: SiteId): Kpis {
  const inSite = (id: SiteId) => !siteId || id === siteId;
  const sites = world.sites.filter((s) => inSite(s.id));

  const delivered = world.shipments.filter((s) => s.deliveredOn && inSite(s.fromSite));
  const onTime = delivered.filter((s) => daysBetween(s.deliveredOn!, s.promisedBy) >= 0).length;

  const visits = world.dockVisits.filter((v) => inSite(v.siteId)).slice(-DWELL_SAMPLE);
  const avgDwell = visits.length ? visits.reduce((a, v) => a + v.dwellMinutes, 0) / visits.length : 0;

  let occupied = 0;
  let available = 0;
  for (const s of sites) {
    for (const d of s.docks) {
      if (d.status === "blocked") continue;
      available += 1;
      if (d.status === "occupied") occupied += 1;
    }
  }

  const orderIds = new Set(world.orders.filter((o) => inSite(o.fulfillmentSite)).map((o) => o.orderId));
  const ordered = new Map<string, number>();
  for (const o of world.orders) {
    if (!orderIds.has(o.orderId)) continue;
    for (const l of o.lines) ordered.set(`${o.orderId}|${l.sku}`, (ordered.get(`${o.orderId}|${l.sku}`) ?? 0) + l.qty);
  }
  const shippedOrders = new Set<string>();
  const shippedQty = new Map<string, number>();
  for (const s of world.shipments) {
    if (!s.shippedOn || !orderIds.has(s.orderId)) continue;
    shippedOrders.add(s.orderId);
    for (const l of s.lines) shippedQty.set(`${s.orderId}|${l.sku}`, (shippedQty.get(`${s.orderId}|${l.sku}`) ?? 0) + l.qty);
  }
  let fillNum = 0;
  let fillDen = 0;
  for (const [key, qty] of ordered) {
    if (!shippedOrders.has(key.split("|")[0])) continue;
    fillDen += qty;
    fillNum += Math.min(qty, shippedQty.get(key) ?? 0);
  }

  const stockValueBySite = { NASH: 0, JCTY: 0, NWK: 0 } as Record<SiteId, number>;
  let lots30 = 0;
  let lots90 = 0;
  let expired = 0;
  for (const s of sites) {
    for (const b of s.bays) {
      for (const lot of b.lots) {
        if (lot.qty <= 0) continue;
        stockValueBySite[s.id] += lot.qty * productBySku(lot.sku).unitPrice;
        const status = classifyExpiry(lot.expiresOn, world.today);
        if (status === "expired") expired += 1;
        if (status === "critical") lots30 += 1;
        if (status === "critical" || status === "warning") lots90 += 1;
      }
    }
  }

  const exc = exceptions.filter((e) => inSite(e.siteId));
  const badOrders = new Set(exc.map((e) => e.orderId));

  return {
    onTimeDelivery: delivered.length ? onTime / delivered.length : 1,
    deliveredShipments: delivered.length,
    avgDockDwellMinutes: avgDwell,
    dockUtilization: available ? occupied / available : 0,
    occupiedDocks: occupied,
    availableDocks: available,
    fillRate: fillDen ? fillNum / fillDen : 1,
    stockValueBySite,
    totalStockValue: Object.values(stockValueBySite).reduce((a, b) => a + b, 0),
    dollarsAtRisk: Math.round(exc.reduce((a, e) => a + e.dollarImpact, 0) * 100) / 100,
    ordersWithExceptions: badOrders.size,
    orderCount: orderIds.size,
    cleanOrderRate: orderIds.size ? (orderIds.size - badOrders.size) / orderIds.size : 1,
    lotsExpiring30: lots30,
    lotsExpiring90: lots90,
    expiredLots: expired,
    coldChainAlerts: alerts.filter((a) => a.category === "cold" && inSite(a.siteId)).length,
  };
}
