import { addDays, localTodayISO } from "../lib/dates";
import { COLD_SETPOINT_C } from "../engine/coldchain";
import { createRng, type Rng } from "./prng";
import { PRODUCTS, productBySku } from "./products";
import type {
  BayZone,
  Channel,
  ColdRoom,
  Dock,
  DockType,
  DockVisit,
  Forklift,
  Invoice,
  Lot,
  LotRecord,
  Order,
  OrderLine,
  Shipment,
  ShipmentLine,
  Site,
  SiteId,
  StockBay,
  Truck,
  World,
} from "./types";

export const DEFAULT_SEED = 42;
const ORDER_COUNT = 300;

interface SiteDef {
  id: SiteId;
  name: string;
  shortName: string;
  role: string;
  ambientC: number;
  inboundDocks: number;
  outboundDocks: number;
  ambientBays: number;
  coldBays: number;
  coldRooms: number;
  forklifts: number;
}

const SITE_DEFS: readonly SiteDef[] = [
  {
    id: "NASH",
    name: "Nashville Distribution Center",
    shortName: "Nashville",
    role: "Main outbound hub for practices and retail",
    ambientC: 24,
    inboundDocks: 3,
    outboundDocks: 5,
    ambientBays: 7,
    coldBays: 4,
    coldRooms: 2,
    forklifts: 3,
  },
  {
    id: "JCTY",
    name: "Johnson City Plant",
    shortName: "Johnson City",
    role: "Manufacturing and finished-goods warehouse",
    ambientC: 22,
    inboundDocks: 3,
    outboundDocks: 3,
    ambientBays: 5,
    coldBays: 3,
    coldRooms: 2,
    forklifts: 2,
  },
  {
    id: "WEST",
    name: "West Coast Hub",
    shortName: "West Coast",
    role: "Regional distribution and R&D samples",
    ambientC: 31,
    inboundDocks: 2,
    outboundDocks: 2,
    ambientBays: 3,
    coldBays: 2,
    coldRooms: 1,
    forklifts: 1,
  },
];

/** Road travel time between sites, compressed so trips finish within a demo. */
export function travelMinutes(a: SiteId, b: SiteId): number {
  const key = [a, b].sort().join("-");
  const table: Record<string, number> = { "JCTY-NASH": 180, "NASH-WEST": 420, "JCTY-WEST": 480 };
  return table[key] ?? 120;
}

const CARRIERS = [
  "Ridgeline Freight",
  "BlueArc Logistics",
  "Cumberland Express",
  "Polar Line Reefer",
  "Summit Carriers",
  "Harbor & Vale Transport",
] as const;

const PRACTICES = [
  "Bellmeade Aesthetics",
  "Riverbend Dermatology",
  "Lumen Skin Studio",
  "Oakhaven Med Spa",
  "Cedar & Sage Aesthetics",
  "Northshore Facial Plastics",
  "Harborview Dermatology",
  "Willow Creek Med Spa",
  "Summit Skin Institute",
  "Clearwater Aesthetic Clinic",
  "Parkside Cosmetic Surgery",
  "Magnolia Laser & Skin",
  "Silverline Med Aesthetics",
  "Brightwater Dermatology",
  "Juniper Aesthetics Group",
  "Ridgeway Skin Clinic",
];
const RETAILERS = [
  "Crescent Pharmacy Group",
  "Northgate Beauty Supply",
  "Prairie Drug Co.",
  "Bluebird Wellness Stores",
  "Harbor Health Mart",
  "Meridian Beauty Retail",
];

const round2 = (n: number) => Math.round(n * 100) / 100;

function buildSite(def: SiteDef, rng: Rng): Site {
  const docks: Dock[] = [];
  const total = def.inboundDocks + def.outboundDocks;
  for (let i = 1; i <= total; i++) {
    const type: DockType = i <= def.inboundDocks ? "inbound" : "outbound";
    docks.push({ id: `${def.id}-D${i}`, siteId: def.id, label: `Dock ${i}`, type, status: "free" });
  }
  const coldRooms: ColdRoom[] = [];
  for (let i = 1; i <= def.coldRooms; i++) {
    coldRooms.push({
      id: `${def.id}-CR${i}`,
      siteId: def.id,
      label: `Cold Room ${i}`,
      setpointC: COLD_SETPOINT_C,
      currentC: round2(COLD_SETPOINT_C + rng.float(-0.4, 0.4)),
      status: "ok",
      biasC: 0,
      history: [],
    });
  }
  const bays: StockBay[] = [];
  const addBays = (zone: BayZone, count: number, prefix: string) => {
    for (let i = 1; i <= count; i++) {
      const num = String(i).padStart(2, "0");
      bays.push({
        id: `${def.id}-${prefix}${num}`,
        siteId: def.id,
        label: `${prefix}-${num}`,
        zone,
        lots: [],
        coldRoomId: zone === "cold" ? coldRooms[(i - 1) % coldRooms.length].id : undefined,
      });
    }
  };
  addBays("ambient", def.ambientBays, "A");
  addBays("cold", def.coldBays, "C");
  addBays("quarantine", 1, "Q");
  const forklifts: Forklift[] = [];
  for (let i = 1; i <= def.forklifts; i++) {
    forklifts.push({
      id: `${def.id}-FL${i}`,
      siteId: def.id,
      status: "idle",
      battery: rng.int(45, 95),
      fromId: `${def.id}-CHG`,
      progress: 0,
      taskMinutes: 0,
    });
  }
  return {
    id: def.id,
    name: def.name,
    shortName: def.shortName,
    role: def.role,
    ambientC: def.ambientC,
    docks,
    bays,
    coldRooms,
    trucks: [],
    forklifts,
  };
}

function coldRoomHistory(room: ColdRoom, rng: Rng): number[] {
  const out: number[] = [];
  for (let k = 0; k < 48; k++) {
    const f = k / 47;
    const ramp = f * f * (3 - 2 * f);
    out.push(round2(room.setpointC + room.biasC * ramp + rng.float(-0.25, 0.25)));
  }
  out[out.length - 1] = room.currentC;
  return out;
}

// ---------------------------------------------------------------------------
// Inventory

type PlannedExpiry = "expired" | "critical" | "warning" | "ok";

function generateLots(sites: Site[], today: string, rng: Rng, catalog: Record<string, LotRecord>): void {
  const used = new Set<string>();
  const newLotId = (receivedOn: string) => {
    let id: string;
    do {
      const letter = String.fromCharCode(65 + rng.int(0, 25));
      id = `L${receivedOn.slice(2, 4)}${letter}${rng.int(100, 999)}`;
    } while (used.has(id));
    used.add(id);
    return id;
  };

  const total = rng.int(46, 54);
  const expired = rng.int(1, 2);
  const critical = rng.int(3, 4);
  const warning = rng.int(8, 10) - critical;
  const plan: PlannedExpiry[] = [];
  for (let i = 0; i < expired; i++) plan.push("expired");
  for (let i = 0; i < critical; i++) plan.push("critical");
  for (let i = 0; i < warning; i++) plan.push("warning");
  while (plan.length < total - sites.length) plan.push("ok");

  const injectables = PRODUCTS.filter((p) => p.category === "Injectable");
  const siteWeights: [number, number][] = [
    [0, 0.45],
    [1, 0.35],
    [2, 0.2],
  ];
  const pickSite = (): Site => {
    let r = rng.next();
    for (const [index, w] of siteWeights) {
      if (r < w) return sites[index];
      r -= w;
    }
    return sites[0];
  };

  const makeLot = (status: PlannedExpiry, bay: StockBay, sku: string): Lot => {
    const p = productBySku(sku);
    const daysLeft =
      status === "expired"
        ? -rng.int(2, 25)
        : status === "critical"
          ? rng.int(3, 28)
          : status === "warning"
            ? rng.int(35, 85)
            : rng.int(120, p.shelfLifeDays - 30);
    const expiresOn = addDays(today, daysLeft);
    const receivedOn = addDays(expiresOn, -p.shelfLifeDays);
    const qty =
      p.category === "Injectable" ? rng.int(4, 36) * 10 : p.category === "Device Kit" ? rng.int(2, 24) * 10 : rng.int(20, 200) * 12;
    const lot: Lot = { lotId: newLotId(receivedOn), sku, qty, receivedOn, expiresOn, bayId: bay.id };
    catalog[lot.lotId] = { lotId: lot.lotId, sku, receivedOn, expiresOn };
    return lot;
  };

  for (const status of rng.shuffle(plan)) {
    const preferInjectable = status !== "ok" && rng.chance(0.6);
    const product = preferInjectable ? rng.pick(injectables) : rng.pick(PRODUCTS);
    const site = pickSite();
    const zone: BayZone = product.coldChain ? "cold" : "ambient";
    const candidates = site.bays.filter((b) => b.zone === zone);
    const minLots = Math.min(...candidates.map((b) => b.lots.length));
    const bay = rng.pick(candidates.filter((b) => b.lots.length === minLots));
    bay.lots.push(makeLot(status, bay, product.sku));
  }
  // One lot on quality hold per site.
  for (const site of sites) {
    const bay = site.bays.find((b) => b.zone === "quarantine")!;
    bay.lots.push(makeLot("ok", bay, rng.pick(PRODUCTS).sku));
  }
}

// ---------------------------------------------------------------------------
// Orders, shipments, invoices

/** Seeded order-to-cash problems. QTY_* split the "quantity mismatch" share into under- and over-billing. */
type OrderKind =
  | "CLEAN"
  | "SHIPPED_NOT_INVOICED"
  | "PRICE_MISMATCH"
  | "QTY_UNDER"
  | "QTY_OVER"
  | "INVOICE_WITHOUT_SHIPMENT"
  | "NEVER_SHIPPED_AGED"
  | "EXPIRY_RISK_SHIPMENT"
  | "DUPLICATE_INVOICE";

function orderKindPlan(n: number, rng: Rng): OrderKind[] {
  const counts: [OrderKind, number][] = [
    ["SHIPPED_NOT_INVOICED", Math.round(n * 0.09)],
    ["PRICE_MISMATCH", Math.round(n * 0.07)],
    ["QTY_UNDER", Math.round(n * 0.04)],
    ["QTY_OVER", Math.round(n * 0.03)],
    ["INVOICE_WITHOUT_SHIPMENT", Math.round(n * 0.04)],
    ["NEVER_SHIPPED_AGED", Math.round(n * 0.04)],
    ["EXPIRY_RISK_SHIPMENT", Math.round(n * 0.03)],
    ["DUPLICATE_INVOICE", Math.max(1, Math.round(n * 0.01))],
  ];
  const plan: OrderKind[] = [];
  for (const [kind, c] of counts) for (let i = 0; i < c; i++) plan.push(kind);
  while (plan.length < n) plan.push("CLEAN");
  return rng.shuffle(plan);
}

function orderLines(channel: Channel, rng: Rng): OrderLine[] {
  const pool =
    channel === "Practice"
      ? ["NT-100", "NT-050", "DF-100", "DFL-100", "MN-001", "MN-010"]
      : channel === "Retail"
        ? ["AG-006", "AT-002", "SS-050", "AS-008", "BR-030", "AN-050"]
        : ["AG-006", "AT-002", "SS-050", "AS-008", "BR-030", "AN-050", "MN-001"];
  const skus = rng.shuffle(pool).slice(0, rng.int(1, 3));
  return skus.map((sku) => {
    const p = productBySku(sku);
    let qty: number;
    if (channel === "Practice") {
      if (sku.startsWith("NT")) qty = rng.int(2, 12);
      else if (sku.startsWith("DF")) qty = rng.int(4, 20);
      else if (sku === "MN-010") qty = rng.int(1, 3);
      else qty = rng.int(2, 10);
    } else if (channel === "Retail") {
      qty = rng.int(2, 12) * 12;
    } else {
      qty = rng.int(1, 4);
    }
    const unitPrice = channel === "Web" ? round2(p.unitPrice * 1.6) : p.unitPrice;
    return { sku, qty, unitPrice };
  });
}

function fulfillmentSiteFor(channel: Channel, rng: Rng): SiteId {
  const r = rng.next();
  if (channel === "Practice") return r < 0.7 ? "NASH" : "WEST";
  if (channel === "Retail") return r < 0.6 ? "NASH" : "JCTY";
  return r < 0.5 ? "WEST" : "NASH";
}

function historicalLot(sku: string, shipDate: string, rng: Rng, catalog: Record<string, LotRecord>): string {
  const p = productBySku(sku);
  const received = addDays(shipDate, -rng.int(2, 8) * 30);
  const receivedOn = `${received.slice(0, 8)}01`;
  const lotId = `L${receivedOn.slice(2, 4)}${receivedOn.slice(5, 7)}-${sku.replace("-", "")}`;
  if (!catalog[lotId]) catalog[lotId] = { lotId, sku, receivedOn, expiresOn: addDays(receivedOn, p.shelfLifeDays) };
  return lotId;
}

function riskLot(sku: string, shipDate: string, rng: Rng, catalog: Record<string, LotRecord>): string {
  const p = productBySku(sku);
  const expiresOn = addDays(shipDate, rng.int(-8, 24));
  const receivedOn = addDays(expiresOn, -p.shelfLifeDays);
  const lotId = `L${receivedOn.slice(2, 4)}${receivedOn.slice(5, 7)}X-${sku.replace("-", "")}`;
  catalog[lotId] = { lotId, sku, receivedOn, expiresOn };
  return lotId;
}

interface OrderBundle {
  order: Order;
  shipment?: Shipment;
  invoices: Invoice[];
}

function orderAge(kind: OrderKind, rng: Rng): number {
  switch (kind) {
    case "NEVER_SHIPPED_AGED":
      return rng.int(10, 75);
    case "SHIPPED_NOT_INVOICED":
      return rng.int(6, 70);
    case "INVOICE_WITHOUT_SHIPMENT":
      return rng.int(5, 60);
    case "CLEAN":
      return rng.int(0, 89);
    default:
      return rng.int(5, 88);
  }
}

function buildBundle(kind: OrderKind, today: string, rng: Rng, catalog: Record<string, LotRecord>, webIds: Set<number>): OrderBundle {
  const channelRoll = rng.next();
  const channel: Channel = channelRoll < 0.5 ? "Practice" : channelRoll < 0.75 ? "Retail" : "Web";
  let customer: string;
  if (channel === "Practice") customer = rng.pick(PRACTICES);
  else if (channel === "Retail") customer = rng.pick(RETAILERS);
  else {
    let id = rng.int(10000, 99999);
    while (webIds.has(id)) id = rng.int(10000, 99999);
    webIds.add(id);
    customer = `Web customer #${id}`;
  }
  const age = orderAge(kind, rng);
  const orderDate = addDays(today, -age);
  const lines = orderLines(channel, rng);
  if (kind === "QTY_UNDER") for (const l of lines) l.qty = Math.max(l.qty, 2);
  const order: Order = { orderId: "", customer, channel, orderDate, fulfillmentSite: fulfillmentSiteFor(channel, rng), lines };
  const promisedBy = addDays(orderDate, 5);
  const shipDate = addDays(orderDate, rng.int(1, 3));
  const unshipped = (): Shipment => ({
    shipmentId: "",
    orderId: "",
    fromSite: order.fulfillmentSite,
    promisedBy,
    lines: lines.map((l) => ({ sku: l.sku, qty: l.qty, lotId: historicalLot(l.sku, today, rng, catalog) })),
  });

  if (kind === "NEVER_SHIPPED_AGED") return { order, shipment: unshipped(), invoices: [] };
  if (kind === "INVOICE_WITHOUT_SHIPMENT") {
    const inv: Invoice = { invoiceId: "", orderId: "", invoicedOn: addDays(orderDate, rng.int(1, 3)), lines: lines.map((l) => ({ ...l })) };
    return { order, shipment: unshipped(), invoices: [inv] };
  }
  if (kind === "CLEAN" && shipDate > today) return { order, shipment: unshipped(), invoices: [] };

  const sLines: ShipmentLine[] = lines.map((l) => ({ sku: l.sku, qty: l.qty, lotId: historicalLot(l.sku, shipDate, rng, catalog) }));
  if (kind === "CLEAN" && age > 3 && rng.chance(0.06)) {
    // Short shipment (backorder): reduces fill rate but is billed correctly.
    const l = sLines.find((x) => x.qty >= 3);
    if (l) l.qty -= rng.int(1, Math.floor(l.qty / 3));
  }
  if (kind === "EXPIRY_RISK_SHIPMENT") {
    const l = rng.pick(sLines);
    l.lotId = riskLot(l.sku, shipDate, rng, catalog);
  }
  const transit = rng.chance(0.1) ? rng.int(4, 7) : rng.int(1, 3);
  const delivered = addDays(shipDate, transit);
  const shipment: Shipment = {
    shipmentId: "",
    orderId: "",
    fromSite: order.fulfillmentSite,
    shippedOn: shipDate,
    promisedBy,
    deliveredOn: delivered <= today ? delivered : undefined,
    lines: sLines,
  };
  if (kind === "SHIPPED_NOT_INVOICED") return { order, shipment, invoices: [] };

  const invoicedOn = addDays(shipDate, rng.int(0, 1));
  if (kind === "CLEAN" && invoicedOn > today) return { order, shipment, invoices: [] };
  const invLines: OrderLine[] = sLines.map((s) => ({
    sku: s.sku,
    qty: s.qty,
    unitPrice: lines.find((l) => l.sku === s.sku)!.unitPrice,
  }));
  if (kind === "PRICE_MISMATCH") {
    const l = rng.pick(invLines);
    const factor = rng.chance(0.5) ? 1 + rng.float(0.05, 0.18) : 1 - rng.float(0.05, 0.18);
    l.unitPrice = round2(l.unitPrice * factor);
  }
  if (kind === "QTY_UNDER") {
    const l = invLines.reduce((a, b) => (b.qty > a.qty ? b : a));
    l.qty -= rng.int(1, Math.max(1, Math.floor(l.qty * 0.3)));
  }
  if (kind === "QTY_OVER") {
    const l = rng.pick(invLines);
    l.qty += rng.int(1, Math.max(1, Math.ceil(l.qty * 0.25)));
  }
  const invoices: Invoice[] = [{ invoiceId: "", orderId: "", invoicedOn, lines: invLines }];
  if (kind === "DUPLICATE_INVOICE") {
    const dupOn = addDays(invoicedOn, rng.int(3, 15));
    invoices.push({ invoiceId: "", orderId: "", invoicedOn: dupOn > today ? today : dupOn, lines: invLines.map((l) => ({ ...l })) });
  }
  return { order, shipment, invoices };
}

function generateOrders(today: string, rng: Rng, catalog: Record<string, LotRecord>) {
  const webIds = new Set<number>();
  const bundles = orderKindPlan(ORDER_COUNT, rng).map((kind) => buildBundle(kind, today, rng, catalog, webIds));
  bundles.sort((a, b) => a.order.orderDate.localeCompare(b.order.orderDate));
  const orders: Order[] = [];
  const shipments: Shipment[] = [];
  const invoices: Invoice[] = [];
  let invNo = 50310;
  bundles.forEach((b, i) => {
    const orderId = `SO-${104201 + i}`;
    b.order.orderId = orderId;
    orders.push(b.order);
    if (b.shipment) {
      b.shipment.shipmentId = `SH-${80450 + i}`;
      b.shipment.orderId = orderId;
      shipments.push(b.shipment);
    }
    for (const inv of b.invoices) {
      inv.invoiceId = `INV-${invNo++}`;
      inv.orderId = orderId;
      invoices.push(inv);
    }
  });
  return { orders, shipments, invoices };
}

// ---------------------------------------------------------------------------
// Trucks

interface TruckPlan {
  n: number;
  site: SiteId;
  kind: "dry" | "reefer";
  direction: DockType;
  origin?: SiteId;
  dock?: number;
  task?: number;
  dwell?: number;
  eta?: number;
  delay?: number;
  yard?: boolean;
}

/** Starting positions chosen so every demo opens with a busy, slightly troubled network. */
const TRUCK_PLAN: readonly TruckPlan[] = [
  { n: 101, site: "NASH", kind: "reefer", direction: "inbound", origin: "JCTY", dock: 1, task: 60, dwell: 40 },
  { n: 102, site: "NASH", kind: "dry", direction: "inbound", dock: 2, task: 25, dwell: 70 },
  { n: 103, site: "NASH", kind: "dry", direction: "inbound", dock: 3, task: 90, dwell: 15 },
  { n: 104, site: "NASH", kind: "dry", direction: "outbound", dock: 4, task: 45, dwell: 30 },
  { n: 105, site: "NASH", kind: "reefer", direction: "outbound", dock: 5, task: 70, dwell: 20 },
  { n: 106, site: "NASH", kind: "dry", direction: "inbound", yard: true, delay: 30 },
  { n: 107, site: "NASH", kind: "reefer", direction: "inbound", origin: "JCTY", eta: 70, delay: 95 },
  { n: 108, site: "NASH", kind: "dry", direction: "outbound", eta: 55 },
  { n: 109, site: "JCTY", kind: "dry", direction: "inbound", dock: 1, task: 80, dwell: 25 },
  { n: 110, site: "JCTY", kind: "reefer", direction: "outbound", dock: 4, task: 40, dwell: 35 },
  { n: 111, site: "JCTY", kind: "dry", direction: "inbound", eta: 35 },
  { n: 112, site: "JCTY", kind: "reefer", direction: "outbound", origin: "NASH", eta: 150 },
  { n: 113, site: "WEST", kind: "reefer", direction: "inbound", origin: "NASH", dock: 1, task: 900, dwell: 165 },
  { n: 114, site: "WEST", kind: "dry", direction: "outbound", dock: 3, task: 55, dwell: 25 },
  { n: 115, site: "WEST", kind: "dry", direction: "inbound", origin: "NASH", eta: 40, delay: 135 },
];

function buildTrucks(sites: Site[], shipments: Shipment[], today: string, rng: Rng): void {
  const recent = shipments.filter((s) => s.shippedOn && s.shippedOn >= addDays(today, -14));
  for (const plan of TRUCK_PLAN) {
    const site = sites.find((s) => s.id === plan.site)!;
    const id = `TRK-${plan.n}`;
    const reefer = plan.kind === "reefer";
    const truck: Truck = {
      id,
      carrier: reefer ? rng.pick(["Polar Line Reefer", "BlueArc Logistics", "Cumberland Express"]) : rng.pick(CARRIERS),
      kind: plan.kind,
      status: "en_route",
      etaMinutes: 0,
      siteId: plan.site,
      originSiteId: plan.origin,
      direction: plan.direction,
      location: "road",
      tripMinutes: 0,
      delayMinutes: plan.delay ?? 0,
      taskMinutes: plan.task ?? 0,
      dwellMinutes: plan.dwell ?? 0,
      tempHoldMinutes: plan.dwell ?? 0,
    };
    if (reefer) {
      truck.setpointC = COLD_SETPOINT_C;
      truck.tempC = round2(COLD_SETPOINT_C + rng.float(-0.6, 0.8));
      truck.tempStatus = "ok";
    }
    if (plan.dock !== undefined) {
      const dock = site.docks[plan.dock - 1];
      dock.status = "occupied";
      dock.truckId = id;
      truck.dockId = dock.id;
      truck.location = "dock";
      truck.status = plan.direction === "inbound" ? "unloading" : "loading";
    } else if (plan.yard) {
      truck.location = "yard";
      truck.status = "delayed";
    } else {
      truck.etaMinutes = plan.eta ?? 60;
      truck.tripMinutes = plan.origin
        ? Math.max(travelMinutes(plan.origin, plan.site), truck.etaMinutes + 30)
        : truck.etaMinutes + rng.int(90, 240);
      truck.status = (plan.delay ?? 0) > 0 ? "delayed" : "en_route";
    }
    // Attach a recent shipment so the detail panel has contents to show.
    const fromSite = plan.origin ?? plan.site;
    const pool = recent.filter(
      (s) => s.fromSite === fromSite && !s.truckId && s.lines.some((l) => productBySku(l.sku).coldChain === reefer),
    );
    const fallback = recent.filter((s) => !s.truckId);
    const shipment = pool.length ? rng.pick(pool) : fallback.length ? rng.pick(fallback) : undefined;
    if (shipment) {
      shipment.truckId = id;
      truck.shipmentId = shipment.shipmentId;
    }
    site.trucks.push(truck);
  }
}

// ---------------------------------------------------------------------------

export function generateWorld(seed: number = DEFAULT_SEED, today: string = localTodayISO()): World {
  const rng = createRng(seed);
  const sites = SITE_DEFS.map((def) => buildSite(def, rng));
  const catalog: Record<string, LotRecord> = {};
  generateLots(sites, today, rng, catalog);
  const { orders, shipments, invoices } = generateOrders(today, rng, catalog);
  buildTrucks(sites, shipments, today, rng);

  // Seeded operational problems so every demo has something to find.
  const [nash, , west] = sites;
  const blocked = nash.docks[6];
  blocked.status = "blocked";
  blocked.note = "Dock leveler fault reported; maintenance ticket open.";

  const warm = nash.coldRooms[1];
  warm.biasC = 2.9;
  warm.currentC = round2(warm.setpointC + 2.9);
  warm.status = "warning";

  const hot = west.trucks.find((t) => t.id === "TRK-113")!;
  hot.tempC = 10.4;
  hot.tempStatus = "excursion";

  const tired = nash.forklifts[2];
  tired.battery = 11;
  tired.status = "moving";
  tired.targetId = nash.bays[0].id;
  tired.progress = 0.3;

  for (const site of sites) for (const room of site.coldRooms) room.history = coldRoomHistory(room, rng);

  const dockVisits: DockVisit[] = [];
  for (const site of sites) {
    const usable = site.docks.filter((d) => d.status !== "blocked");
    for (let i = 0; i < 14; i++) {
      dockVisits.push({
        dockId: rng.pick(usable).id,
        truckId: `TRK-${rng.int(201, 260)}`,
        siteId: site.id,
        dwellMinutes: rng.int(35, 150),
        endedAtMinute: -rng.int(10, 1440),
      });
    }
  }
  dockVisits.sort((a, b) => a.endedAtMinute - b.endedAtMinute);

  return {
    seed,
    today,
    clockMinutes: 0,
    startHour: 8,
    rngState: rng.state(),
    sites,
    products: PRODUCTS.slice(),
    orders,
    shipments,
    invoices,
    lotCatalog: catalog,
    dockVisits,
  };
}
