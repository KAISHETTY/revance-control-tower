import type { ReactNode } from "react";
import { EXCEPTION_LABELS, EXCEPTION_TYPES } from "../engine/reconcile";

function H({ children }: { children: ReactNode }) {
  return <h3 className="mt-5 mb-1.5 text-sm font-semibold first:mt-0">{children}</h3>;
}

const EXCEPTION_HELP: Record<(typeof EXCEPTION_TYPES)[number], string> = {
  SHIPPED_NOT_INVOICED: "goods left, no invoice after 2 days (shipped qty × order price).",
  PRICE_MISMATCH: "invoice price differs from order price (|difference| × invoiced qty).",
  QTY_MISMATCH: "fewer units invoiced than shipped (shortfall × order price).",
  BILLED_MORE_THAN_SHIPPED: "more units invoiced than shipped (excess × invoice price).",
  INVOICE_WITHOUT_SHIPMENT: "an invoice exists but nothing shipped (invoice total).",
  NEVER_SHIPPED_AGED: "order older than 7 days, nothing shipped or billed (order total).",
  EXPIRY_RISK_SHIPMENT: "a lot shipped expired or within 30 days of expiry (shipped qty × order price).",
  DUPLICATE_INVOICE: "a second invoice repeats an earlier one line for line (duplicate total).",
};

export function HowItWorks() {
  return (
    <div
      className="scrollbar-thin h-full overflow-y-auto px-4 py-3 text-sm leading-relaxed text-muted"
      data-testid="how-it-works"
      tabIndex={0}
      role="region"
      aria-label="How it works"
    >
      <p className="text-fg">
        This is a working prototype of a supply-chain control tower for a cold-chain business: injectables that must stay at 2–8°C, device
        kits and skincare, moving through three sites to practices, retailers and web customers.
      </p>

      <H>The data model</H>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <b className="text-fg">Sites</b> have <b className="text-fg">docks</b> (inbound or outbound),{" "}
          <b className="text-fg">stock bays</b> (ambient, cold or quarantine), <b className="text-fg">cold rooms</b> and{" "}
          <b className="text-fg">forklifts</b>.
        </li>
        <li>
          <b className="text-fg">Trucks</b> are dry vans or reefers. They drive between sites, wait in the yard, dock, load or unload, and
          leave.
        </li>
        <li>
          <b className="text-fg">Lots</b> are batches of one product with a received and an expiry date, stored in a bay.
        </li>
        <li>
          <b className="text-fg">Orders</b> become <b className="text-fg">shipments</b> (which lots went out, and when) and{" "}
          <b className="text-fg">invoices</b> (what was billed). The 3D scene is just a view on top of these tables; the 2D map shows
          exactly the same data.
        </li>
      </ul>

      <H>What is simulated</H>
      <p>
        A seeded random generator builds the world, so the same seed always gives the same world. A clock then advances it: each real second
        is 5 simulated minutes at 1x. Trucks count down their ETA, take a free dock or queue in the yard, load and leave. Forklifts shuttle
        between bays and docks and recharge. Cold rooms and reefers drift with sensor noise. A reefer left at a dock too long in a hot yard
        warms up. Orders, lots and invoices are anchored to today&apos;s date and cover the last 90 days.
      </p>

      <H>What the alerts mean</H>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <b className="text-fg">Cold-chain excursion</b>: 4°C or more off setpoint. It stays open until someone logs a corrective action. A
          warning starts at 2°C.
        </li>
        <li>
          <b className="text-fg">Expired / expiring lot</b>: stock on hand that is past expiry, or within 30 days of it.
        </li>
        <li>
          <b className="text-fg">Truck delayed</b>: more than 60 minutes late or waiting for a dock. <b className="text-fg">Dock blocked</b>
          : out of service.
        </li>
        <li>
          <b className="text-fg">Forklift battery</b>: below 15%. <b className="text-fg">Shipment late</b>: past its promise date without
          delivery (last 14 days; older ones live in the Orders tab).
        </li>
      </ul>

      <H>Order-to-cash exceptions</H>
      <ul className="list-disc space-y-1 pl-5">
        {EXCEPTION_TYPES.map((t) => (
          <li key={t}>
            <b className="text-fg">{EXCEPTION_LABELS[t]}</b>: {EXCEPTION_HELP[t]}
          </li>
        ))}
      </ul>
      <p className="mt-2">
        Severity is high at $5,000 or more or over 30 days open, medium at $1,000 or more or over 14 days, otherwise low. Each order and
        exception type is counted once, so dollars are never double counted.
      </p>

      <H>What this is not</H>
      <ul className="list-disc space-y-1 pl-5">
        <li>It is not connected to any real system. Every site detail, truck, lot, order, customer and dollar figure is synthetic.</li>
        <li>
          It does not know your real workflows, pricing rules, carriers or quality procedures. The rules here are reasonable defaults.
        </li>
        <li>The explanations are rules-based templates, not an AI, and they are deliberately hedged.</li>
      </ul>

      <H>Questions I would ask before building this for real</H>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Which systems hold orders, shipments, invoices and inventory today (ERP, WMS, TMS), and how fresh is each feed?</li>
        <li>What is the source of truth for pricing: contract, price list, or the order line? Who can override it?</li>
        <li>How is invoicing triggered: on ship confirm, on proof of delivery, or manually? What happens when it fails?</li>
        <li>How are lot numbers, expiry dates and temperatures captured, at what interval, and are loggers reconciled per shipment?</li>
        <li>What validation and SOX controls apply, and what audit trail would a tool like this need before anyone acts on it?</li>
        <li>Who owns each exception type day to day, and what is their target time to close?</li>
      </ol>
    </div>
  );
}
