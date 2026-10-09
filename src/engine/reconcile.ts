import { daysBetween } from "../lib/dates";
import type { Channel, Invoice, LotRecord, Order, OrderLine, Shipment, SiteId } from "../sim/types";

export type ExceptionType =
  | "SHIPPED_NOT_INVOICED"
  | "PRICE_MISMATCH"
  | "QTY_MISMATCH"
  | "BILLED_MORE_THAN_SHIPPED"
  | "INVOICE_WITHOUT_SHIPMENT"
  | "NEVER_SHIPPED_AGED"
  | "EXPIRY_RISK_SHIPMENT"
  | "DUPLICATE_INVOICE";

export const EXCEPTION_TYPES: readonly ExceptionType[] = [
  "SHIPPED_NOT_INVOICED",
  "PRICE_MISMATCH",
  "QTY_MISMATCH",
  "BILLED_MORE_THAN_SHIPPED",
  "INVOICE_WITHOUT_SHIPMENT",
  "NEVER_SHIPPED_AGED",
  "EXPIRY_RISK_SHIPMENT",
  "DUPLICATE_INVOICE",
];

export const EXCEPTION_LABELS: Record<ExceptionType, string> = {
  SHIPPED_NOT_INVOICED: "Shipped, not invoiced",
  PRICE_MISMATCH: "Price mismatch",
  QTY_MISMATCH: "Under-billed quantity",
  BILLED_MORE_THAN_SHIPPED: "Billed more than shipped",
  INVOICE_WITHOUT_SHIPMENT: "Invoice without shipment",
  NEVER_SHIPPED_AGED: "Never shipped (aged)",
  EXPIRY_RISK_SHIPMENT: "Shipped near-expiry lot",
  DUPLICATE_INVOICE: "Duplicate invoice",
};

export type Severity = "high" | "medium" | "low";
export const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Orders older than this with nothing shipped are flagged. */
export const AGED_DAYS = 7;
/** Shipments get this many days to be invoiced before they are flagged. */
export const INVOICE_GRACE_DAYS = 2;
/** A shipped lot expiring within this many days of the ship date is a risk. */
export const EXPIRY_RISK_DAYS = 30;

export interface ReconException {
  id: string;
  orderId: string;
  type: ExceptionType;
  dollarImpact: number;
  severity: Severity;
  daysOpen: number;
  siteId: SiteId;
  channel: Channel;
  customer: string;
  skus: string[];
  detail: string;
}

export interface ReconInput {
  orders: readonly Order[];
  shipments: readonly Shipment[];
  invoices: readonly Invoice[];
  lotCatalog: Readonly<Record<string, LotRecord>>;
  today: string;
}

export function severityFor(dollarImpact: number, daysOpen: number): Severity {
  if (dollarImpact >= 5000 || daysOpen > 30) return "high";
  if (dollarImpact >= 1000 || daysOpen > 14) return "medium";
  return "low";
}

const cents = (n: number) => Math.round(n * 100) / 100;
const total = (lines: readonly OrderLine[]) => lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);

/** Canonical key for an invoice's lines, used to detect duplicates. */
function linesKey(lines: readonly OrderLine[]): string {
  return lines
    .map((l) => `${l.sku}:${l.qty}:${l.unitPrice.toFixed(2)}`)
    .sort()
    .join("|");
}

function groupBy<T>(items: readonly T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

/**
 * Three-way match of orders, shipments and invoices. Produces at most one
 * exception per (order, type): line-level impacts are summed into it, so no
 * dollar is counted twice within an order and type.
 */
export function reconcile(input: ReconInput): ReconException[] {
  const { today, lotCatalog } = input;
  const shipmentsByOrder = groupBy(input.shipments, (s) => s.orderId);
  const invoicesByOrder = groupBy(input.invoices, (i) => i.orderId);
  const out: ReconException[] = [];

  for (const order of input.orders) {
    const shipped = (shipmentsByOrder.get(order.orderId) ?? []).filter((s) => s.shippedOn);
    const invoices = (invoicesByOrder.get(order.orderId) ?? []).slice().sort((a, b) => a.invoicedOn.localeCompare(b.invoicedOn));
    const orderPrice = new Map(order.lines.map((l) => [l.sku, l.unitPrice]));
    const found = new Map<ExceptionType, { impact: number; daysOpen: number; skus: Set<string>; detail: string }>();
    const add = (type: ExceptionType, impact: number, daysOpen: number, skus: string[], detail: string) => {
      const cur = found.get(type);
      if (cur) {
        cur.impact += impact;
        cur.daysOpen = Math.max(cur.daysOpen, daysOpen);
        skus.forEach((s) => cur.skus.add(s));
      } else {
        found.set(type, { impact, daysOpen, skus: new Set(skus), detail });
      }
    };

    if (shipped.length === 0) {
      if (invoices.length > 0) {
        const inv = invoices[0];
        add(
          "INVOICE_WITHOUT_SHIPMENT",
          total(inv.lines),
          daysBetween(inv.invoicedOn, today),
          inv.lines.map((l) => l.sku),
          `${inv.invoiceId} billed but no shipment has left the building.`,
        );
      } else {
        const age = daysBetween(order.orderDate, today);
        if (age > AGED_DAYS) {
          add(
            "NEVER_SHIPPED_AGED",
            total(order.lines),
            age,
            order.lines.map((l) => l.sku),
            `Ordered ${age} days ago and nothing has shipped.`,
          );
        }
      }
    } else {
      const firstShip = shipped.map((s) => s.shippedOn!).sort()[0];
      const shippedQty = new Map<string, number>();
      for (const s of shipped) for (const l of s.lines) shippedQty.set(l.sku, (shippedQty.get(l.sku) ?? 0) + l.qty);

      if (invoices.length === 0) {
        const daysSince = daysBetween(firstShip, today);
        if (daysSince >= INVOICE_GRACE_DAYS) {
          let impact = 0;
          for (const [sku, qty] of shippedQty) impact += qty * (orderPrice.get(sku) ?? 0);
          add("SHIPPED_NOT_INVOICED", impact, daysSince, [...shippedQty.keys()], `Shipped ${daysSince} days ago with no invoice raised.`);
        }
      } else {
        const primary = invoices[0];
        const daysOpen = daysBetween(primary.invoicedOn, today);
        const invoiced = new Map<string, { qty: number; price: number }>();
        for (const l of primary.lines) {
          const cur = invoiced.get(l.sku);
          invoiced.set(l.sku, { qty: (cur?.qty ?? 0) + l.qty, price: l.unitPrice });
        }
        const skus = new Set([...shippedQty.keys(), ...invoiced.keys()]);
        for (const sku of skus) {
          const sQty = shippedQty.get(sku) ?? 0;
          const inv = invoiced.get(sku);
          const iQty = inv?.qty ?? 0;
          const oPrice = orderPrice.get(sku);
          if (inv && oPrice !== undefined && Math.abs(inv.price - oPrice) > 0.005) {
            add(
              "PRICE_MISMATCH",
              Math.abs(inv.price - oPrice) * iQty,
              daysOpen,
              [sku],
              `Invoice price differs from the order price on ${primary.invoiceId}.`,
            );
          }
          if (iQty < sQty) {
            add("QTY_MISMATCH", (sQty - iQty) * (oPrice ?? 0), daysOpen, [sku], `Invoiced fewer units than were shipped.`);
          } else if (inv && iQty > sQty) {
            add("BILLED_MORE_THAN_SHIPPED", (iQty - sQty) * inv.price, daysOpen, [sku], `Invoiced more units than were shipped.`);
          }
        }
      }

      for (const s of shipped) {
        for (const l of s.lines) {
          const lot = lotCatalog[l.lotId];
          if (!lot) continue;
          const lifeLeft = daysBetween(s.shippedOn!, lot.expiresOn);
          if (lifeLeft <= EXPIRY_RISK_DAYS) {
            const when = lifeLeft < 0 ? `${-lifeLeft} days after it expired` : `${lifeLeft} days before expiry`;
            add(
              "EXPIRY_RISK_SHIPMENT",
              l.qty * (orderPrice.get(l.sku) ?? 0),
              daysBetween(s.shippedOn!, today),
              [l.sku],
              `Lot ${l.lotId} shipped ${when}.`,
            );
          }
        }
      }
    }

    if (invoices.length > 1) {
      const seen = new Set<string>();
      for (const inv of invoices) {
        const key = linesKey(inv.lines);
        if (seen.has(key)) {
          add(
            "DUPLICATE_INVOICE",
            total(inv.lines),
            daysBetween(inv.invoicedOn, today),
            inv.lines.map((l) => l.sku),
            `${inv.invoiceId} repeats an earlier invoice line for line.`,
          );
        }
        seen.add(key);
      }
    }

    for (const [type, f] of found) {
      const dollarImpact = cents(f.impact);
      out.push({
        id: `${order.orderId}:${type}`,
        orderId: order.orderId,
        type,
        dollarImpact,
        severity: severityFor(dollarImpact, f.daysOpen),
        daysOpen: f.daysOpen,
        siteId: order.fulfillmentSite,
        channel: order.channel,
        customer: order.customer,
        skus: [...f.skus],
        detail: f.detail,
      });
    }
  }

  return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.dollarImpact - a.dollarImpact);
}

export interface ReconSummary {
  exceptions: number;
  ordersWithExceptions: number;
  dollarsAtRisk: number;
  cleanOrderRate: number;
  byType: Record<ExceptionType, { count: number; dollars: number }>;
}

export function summarizeRecon(exceptions: readonly ReconException[], orderCount: number): ReconSummary {
  const byType = Object.fromEntries(EXCEPTION_TYPES.map((t) => [t, { count: 0, dollars: 0 }])) as ReconSummary["byType"];
  const orders = new Set<string>();
  let dollars = 0;
  for (const e of exceptions) {
    byType[e.type].count += 1;
    byType[e.type].dollars += e.dollarImpact;
    dollars += e.dollarImpact;
    orders.add(e.orderId);
  }
  return {
    exceptions: exceptions.length,
    ordersWithExceptions: orders.size,
    dollarsAtRisk: cents(dollars),
    cleanOrderRate: orderCount === 0 ? 1 : (orderCount - orders.size) / orderCount,
    byType,
  };
}
