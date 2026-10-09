import type { ReactNode } from "react";
import { EXCEPTION_LABELS, EXCEPTION_TYPES } from "../engine/reconcile";
import { PRODUCTS } from "../sim/products";
import { QUESTIONS } from "./content";
import { PublicTag } from "./PublicTag";
import { SYSTEMS, SYSTEMS_NOTE } from "./systems";

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

const CATEGORIES = ["Aesthetics", "Device", "Consumer skincare"] as const;

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
        An unofficial prototype of a control tower across three sites, built from public information and running on synthetic data. It
        connects sites, stock, orders, shipments and invoices in one view.
      </p>

      <H>What comes from public sources, and what is made up</H>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <b className="text-fg">Sites:</b> Nashville (headquarters, distribution), Johnson City, Tennessee (manufacturing and operations)
          and Newark, California (R&amp;D and regional). <PublicTag /> Layouts, docks, equipment and every number are invented.
        </li>
        <li>
          <b className="text-fg">Products:</b> plain-text brand names only. <PublicTag /> SKUs, pack variants, prices, lots and shelf lives
          are synthetic, and nothing here makes any claim about the products themselves.
          <ul className="mt-1 list-[circle] space-y-0.5 pl-5">
            {CATEGORIES.map((c) => (
              <li key={c}>
                {c}: {[...new Set(PRODUCTS.filter((p) => p.category === c).map((p) => p.name.replace(/ \(.*\)$/, "")))].join(", ")}
                {c === "Aesthetics" ? " (RHA Collection: distributed in the US via a partner)" : ""}
              </li>
            ))}
          </ul>
        </li>
        <li>
          <b className="text-fg">Systems:</b> {SYSTEMS.sales}, {SYSTEMS.shipment}, {SYSTEMS.finance}. {SYSTEMS_NOTE} <PublicTag />
        </li>
        <li>
          <b className="text-fg">Temperature monitoring</b> is a generic, synthetic scenario: some trucks run a
          &ldquo;temperature-controlled lane&rdquo; and some rooms are temperature-controlled. Lots are placed in those zones at random.
          Which products actually need temperature control is not known here.
        </li>
      </ul>

      <H>The data model</H>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <b className="text-fg">Sites</b> have <b className="text-fg">docks</b> (inbound or outbound),{" "}
          <b className="text-fg">stock bays</b> (ambient, temperature-controlled or quarantine),{" "}
          <b className="text-fg">temperature-controlled rooms</b> and <b className="text-fg">forklifts</b>.
        </li>
        <li>
          <b className="text-fg">Trucks</b> are dry vans or temperature-controlled lanes. They drive between sites, wait in the yard, dock,
          load or unload, and leave.
        </li>
        <li>
          <b className="text-fg">Lots</b> are batches of one product with a received and an expiry date, stored in a bay.
        </li>
        <li>
          <b className="text-fg">Orders</b> ({SYSTEMS.sales}) become <b className="text-fg">shipments</b> ({SYSTEMS.shipment}: which lots
          went out, and when) and <b className="text-fg">invoices</b> ({SYSTEMS.finance}: what was billed). The 3D scene is just a view on
          top of these tables; the 2D map shows exactly the same data.
        </li>
      </ul>

      <H>What is simulated</H>
      <p>
        A seeded random generator builds the world, so the same seed always gives the same world. A clock then advances it: each real second
        is 5 simulated minutes at 1x. Trucks count down their ETA, take a free dock or queue in the yard, load and leave. Forklifts shuttle
        between bays and docks and recharge. Temperature readings drift with sensor noise, and a temperature-controlled truck left at a dock
        too long in a hot yard warms up. Orders, lots and invoices are anchored to today&apos;s date and cover the last 90 days.
      </p>

      <H>What the alerts mean</H>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <b className="text-fg">Temperature excursion</b>: 4°C or more off a synthetic setpoint. It stays open until someone logs a
          corrective action. A warning starts at 2°C.
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
        <li>
          It is unofficial, and not affiliated with or endorsed by Revance. It is not connected to any real system, and every figure is
          synthetic. None of it is Revance&apos;s data.
        </li>
        <li>
          It does not know your real workflows, pricing rules, carriers or quality procedures. The rules here are reasonable defaults.
        </li>
        <li>The explanations are rules-based templates, not an AI, and they are deliberately hedged.</li>
      </ul>

      <H>Questions I would ask before building this for real</H>
      <ol className="list-decimal space-y-1 pl-5">
        {QUESTIONS.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ol>
    </div>
  );
}
