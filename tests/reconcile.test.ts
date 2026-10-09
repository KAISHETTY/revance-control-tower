import { describe, expect, it } from "vitest";
import { reconcile, severityFor, summarizeRecon, type ExceptionType, type ReconInput } from "../src/engine/reconcile";
import type { Invoice, LotRecord, Order, Shipment } from "../src/sim/types";

const TODAY = "2026-10-09";

const LOTS: Record<string, LotRecord> = {
  GOOD: { lotId: "GOOD", sku: "A", receivedOn: "2026-01-01", expiresOn: "2027-06-01" },
  GOOD_B: { lotId: "GOOD_B", sku: "B", receivedOn: "2026-01-01", expiresOn: "2027-06-01" },
  NEAR: { lotId: "NEAR", sku: "A", receivedOn: "2025-10-01", expiresOn: "2026-10-01" },
};

function order(id: string, date: string, lines: Order["lines"]): Order {
  return { orderId: id, customer: "Test Practice", channel: "Practice", orderDate: date, fulfillmentSite: "NASH", lines };
}
function shipment(orderId: string, shippedOn: string | undefined, lines: Shipment["lines"]): Shipment {
  return { shipmentId: `SH-${orderId}`, orderId, fromSite: "NASH", shippedOn, promisedBy: "2026-09-30", lines };
}
function invoice(id: string, orderId: string, on: string, lines: Invoice["lines"]): Invoice {
  return { invoiceId: id, orderId, invoicedOn: on, lines };
}
function run(orders: Order[], shipments: Shipment[], invoices: Invoice[]) {
  const input: ReconInput = { orders, shipments, invoices, lotCatalog: LOTS, today: TODAY };
  return reconcile(input);
}

/** A clean order: 10 × A at $100, shipped and invoiced exactly. */
function clean(id = "O1") {
  return {
    o: order(id, "2026-09-25", [{ sku: "A", qty: 10, unitPrice: 100 }]),
    s: shipment(id, "2026-09-26", [{ sku: "A", qty: 10, lotId: "GOOD" }]),
    i: invoice(`INV-${id}`, id, "2026-09-26", [{ sku: "A", qty: 10, unitPrice: 100 }]),
  };
}

describe("reconcile: detection", () => {
  it("returns zero exceptions for a clean order", () => {
    const { o, s, i } = clean();
    expect(run([o], [s], [i])).toEqual([]);
  });

  const cases: [ExceptionType, () => ReturnType<typeof run>, number][] = [
    [
      "SHIPPED_NOT_INVOICED",
      () => {
        const { o, s } = clean();
        return run([o], [s], []);
      },
      1000,
    ],
    [
      "PRICE_MISMATCH",
      () => {
        const { o, s } = clean();
        return run([o], [s], [invoice("I", "O1", "2026-09-26", [{ sku: "A", qty: 10, unitPrice: 112.5 }])]);
      },
      125,
    ],
    [
      "QTY_MISMATCH",
      () => {
        const { o, s } = clean();
        return run([o], [s], [invoice("I", "O1", "2026-09-26", [{ sku: "A", qty: 7, unitPrice: 100 }])]);
      },
      300,
    ],
    [
      "BILLED_MORE_THAN_SHIPPED",
      () => {
        const { o, s } = clean();
        return run([o], [s], [invoice("I", "O1", "2026-09-26", [{ sku: "A", qty: 13, unitPrice: 100 }])]);
      },
      300,
    ],
    [
      "INVOICE_WITHOUT_SHIPMENT",
      () => {
        const { o, i } = clean();
        return run([o], [shipment("O1", undefined, [{ sku: "A", qty: 10, lotId: "GOOD" }])], [i]);
      },
      1000,
    ],
    [
      "NEVER_SHIPPED_AGED",
      () => {
        const { o } = clean();
        return run([o], [], []);
      },
      1000,
    ],
    [
      "EXPIRY_RISK_SHIPMENT",
      () => {
        const { o, i } = clean();
        return run([o], [shipment("O1", "2026-09-26", [{ sku: "A", qty: 10, lotId: "NEAR" }])], [i]);
      },
      1000,
    ],
    [
      "DUPLICATE_INVOICE",
      () => {
        const { o, s, i } = clean();
        return run([o], [s], [i, invoice("INV-DUP", "O1", "2026-10-02", [{ sku: "A", qty: 10, unitPrice: 100 }])]);
      },
      1000,
    ],
  ];

  it.each(cases)("detects %s with the defined dollar impact", (type, fn, dollars) => {
    const out = fn();
    expect(out.map((e) => e.type)).toEqual([type]);
    expect(out[0].dollarImpact).toBe(dollars);
    expect(out[0].orderId).toBe("O1");
  });

  it("allows a grace period before flagging shipped-not-invoiced", () => {
    const o = order("O1", "2026-10-07", [{ sku: "A", qty: 10, unitPrice: 100 }]);
    const s = shipment("O1", "2026-10-08", [{ sku: "A", qty: 10, lotId: "GOOD" }]);
    expect(run([o], [s], [])).toEqual([]);
  });

  it("does not flag a young unshipped order", () => {
    const o = order("O1", "2026-10-05", [{ sku: "A", qty: 10, unitPrice: 100 }]);
    expect(run([o], [], [])).toEqual([]);
  });

  it("flags an expired lot shipped after its expiry date", () => {
    const lots = { ...LOTS, OLD: { lotId: "OLD", sku: "A", receivedOn: "2025-01-01", expiresOn: "2026-09-01" } };
    const { o, i } = clean();
    const out = reconcile({ orders: [o], shipments: [shipment("O1", "2026-09-26", [{ sku: "A", qty: 10, lotId: "OLD" }])], invoices: [i], lotCatalog: lots, today: TODAY });
    expect(out.map((e) => e.type)).toEqual(["EXPIRY_RISK_SHIPMENT"]);
  });
});

describe("reconcile: dollar definitions", () => {
  it("price mismatch = |invoice price - order price| x invoiced qty", () => {
    const o = order("O1", "2026-09-25", [{ sku: "A", qty: 10, unitPrice: 100 }]);
    const s = shipment("O1", "2026-09-26", [{ sku: "A", qty: 10, lotId: "GOOD" }]);
    const out = run([o], [s], [invoice("I", "O1", "2026-09-26", [{ sku: "A", qty: 8, unitPrice: 90 }])]);
    const byType = Object.fromEntries(out.map((e) => [e.type, e.dollarImpact]));
    expect(byType.PRICE_MISMATCH).toBe(80); // |90-100| x 8
    expect(byType.QTY_MISMATCH).toBe(200); // |8-10| x order price 100
  });

  it("billed-more-than-shipped uses the invoice price", () => {
    const o = order("O1", "2026-09-25", [{ sku: "A", qty: 10, unitPrice: 100 }]);
    const s = shipment("O1", "2026-09-26", [{ sku: "A", qty: 10, lotId: "GOOD" }]);
    const out = run([o], [s], [invoice("I", "O1", "2026-09-26", [{ sku: "A", qty: 12, unitPrice: 110 }])]);
    const byType = Object.fromEntries(out.map((e) => [e.type, e.dollarImpact]));
    expect(byType.BILLED_MORE_THAN_SHIPPED).toBe(220); // (12-10) x 110
    expect(byType.PRICE_MISMATCH).toBe(120); // |110-100| x 12
  });

  it("shipped-not-invoiced = shipped qty x order price (not ordered qty)", () => {
    const o = order("O1", "2026-09-25", [{ sku: "A", qty: 10, unitPrice: 100 }]);
    const s = shipment("O1", "2026-09-26", [{ sku: "A", qty: 6, lotId: "GOOD" }]);
    expect(run([o], [s], [])[0].dollarImpact).toBe(600);
  });

  it("never-shipped-aged = order total; invoice-without-shipment = invoice total", () => {
    const o = order("O1", "2026-09-01", [
      { sku: "A", qty: 2, unitPrice: 100 },
      { sku: "B", qty: 3, unitPrice: 50 },
    ]);
    expect(run([o], [], [])[0].dollarImpact).toBe(350);
    const inv = invoice("I", "O1", "2026-09-05", [{ sku: "A", qty: 2, unitPrice: 105 }]);
    expect(run([o], [], [inv])[0].dollarImpact).toBe(210);
  });
});

describe("reconcile: no double counting", () => {
  it("sums line impacts into one exception per order and type", () => {
    const o = order("O1", "2026-09-25", [
      { sku: "A", qty: 10, unitPrice: 100 },
      { sku: "B", qty: 4, unitPrice: 50 },
    ]);
    const s = shipment("O1", "2026-09-26", [
      { sku: "A", qty: 10, lotId: "GOOD" },
      { sku: "B", qty: 4, lotId: "GOOD_B" },
    ]);
    const inv = invoice("I", "O1", "2026-09-26", [
      { sku: "A", qty: 10, unitPrice: 101 },
      { sku: "B", qty: 4, unitPrice: 48 },
    ]);
    const out = run([o], [s], [inv]);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("PRICE_MISMATCH");
    expect(out[0].dollarImpact).toBe(18); // 1 x 10 + 2 x 4
  });

  it("counts a duplicated invoice once in dollars and does not re-flag its lines", () => {
    const { o, s, i } = clean();
    const dup = invoice("INV-DUP", "O1", "2026-10-02", i.lines);
    const out = run([o], [s], [i, dup]);
    expect(out).toHaveLength(1);
    const summary = summarizeRecon(out, 1);
    expect(summary.dollarsAtRisk).toBe(1000);
    expect(summary.ordersWithExceptions).toBe(1);
    expect(summary.cleanOrderRate).toBe(0);
  });

  it("produces unique (order, type) ids", () => {
    const { o, s } = clean();
    const out = run([o, { ...o, orderId: "O2" }], [s, { ...s, orderId: "O2" }], []);
    expect(new Set(out.map((e) => e.id)).size).toBe(out.length);
  });
});

describe("severity thresholds", () => {
  it.each([
    [999, 0, "low"],
    [1000, 0, "medium"],
    [4999, 0, "medium"],
    [5000, 0, "high"],
    [10, 14, "low"],
    [10, 15, "medium"],
    [10, 30, "medium"],
    [10, 31, "high"],
  ] as const)("$%d open %d days is %s", (dollars, days, sev) => {
    expect(severityFor(dollars, days)).toBe(sev);
  });

  it("applies severity to detected exceptions", () => {
    // Shipped 14 days before today, $999 → low; 15 days → medium.
    const mk = (shippedOn: string) =>
      run([order("O1", "2026-09-01", [{ sku: "A", qty: 9, unitPrice: 111 }])], [shipment("O1", shippedOn, [{ sku: "A", qty: 9, lotId: "GOOD" }])], []);
    expect(mk("2026-09-25")[0]).toMatchObject({ dollarImpact: 999, daysOpen: 14, severity: "low" });
    expect(mk("2026-09-24")[0]).toMatchObject({ daysOpen: 15, severity: "medium" });
    expect(mk("2026-09-08")[0]).toMatchObject({ daysOpen: 31, severity: "high" });
  });
});
