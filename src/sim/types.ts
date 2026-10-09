export type SiteId = "NASH" | "JCTY" | "WEST";
export const SITE_IDS: readonly SiteId[] = ["NASH", "JCTY", "WEST"];

export type DockType = "inbound" | "outbound";
export type DockStatus = "free" | "occupied" | "blocked";
export type ColdStatus = "ok" | "warning" | "excursion";

export interface Dock {
  id: string;
  siteId: SiteId;
  label: string;
  type: DockType;
  status: DockStatus;
  truckId?: string;
  /** Why a dock is blocked. */
  note?: string;
}

export type TruckStatus = "en_route" | "arrived" | "docked" | "loading" | "unloading" | "departed" | "delayed";

/** Where the truck physically is. Derived from status but stored for clarity. */
export type TruckLocation = "road" | "yard" | "dock";

export interface Truck {
  id: string;
  carrier: string;
  kind: "dry" | "reefer";
  status: TruckStatus;
  etaMinutes: number;
  dockId?: string;
  shipmentId?: string;
  /** Reefer box temperature. */
  tempC?: number;
  setpointC?: number;
  /** Latched: an excursion stays until resolved in the UI. */
  tempStatus?: ColdStatus;
  /** Destination site while on the road, current site once arrived. */
  siteId: SiteId;
  /** Origin site of the current trip; undefined means an external supplier or customer. */
  originSiteId?: SiteId;
  /** What the truck needs at the destination. */
  direction: DockType;
  location: TruckLocation;
  /** Total length of the current road trip, for interpolating position. */
  tripMinutes: number;
  /** Minutes behind schedule. */
  delayMinutes: number;
  /** Remaining minutes of the current task (loading, unloading, pulling out). */
  taskMinutes: number;
  /** Minutes spent at the current dock. */
  dwellMinutes: number;
  /** Minutes at the dock since arrival or the last temperature resolve (drives heat exposure). */
  tempHoldMinutes: number;
  /** Dock the truck just left, so the view can animate it pulling out. */
  lastDockId?: string;
}

export interface Forklift {
  id: string;
  siteId: SiteId;
  status: "idle" | "moving" | "loading" | "charging";
  battery: number;
  targetId?: string;
  /** Where the current move started (bay, dock or charger id). */
  fromId?: string;
  /** 0..1 progress of the current move. */
  progress: number;
  taskMinutes: number;
}

export interface ColdRoom {
  id: string;
  siteId: SiteId;
  label: string;
  setpointC: number;
  currentC: number;
  status: ColdStatus;
  /** Equipment bias the room drifts toward (0 = healthy, >0 = failing compressor). */
  biasC: number;
  /** Recent readings, oldest first, one every 15 simulated minutes. */
  history: number[];
}

export type BayZone = "ambient" | "cold" | "quarantine";

export interface StockBay {
  id: string;
  siteId: SiteId;
  label: string;
  zone: BayZone;
  lots: Lot[];
  /** Cold room that physically contains this bay, for cold-zone bays. */
  coldRoomId?: string;
}

export interface Site {
  id: SiteId;
  name: string;
  shortName: string;
  role: string;
  /** Typical outdoor temperature at the yard. */
  ambientC: number;
  docks: Dock[];
  bays: StockBay[];
  coldRooms: ColdRoom[];
  trucks: Truck[];
  forklifts: Forklift[];
}

export type ProductCategory = "Injectable" | "Device Kit" | "Skincare";

export interface Product {
  sku: string;
  name: string;
  category: ProductCategory;
  unitPrice: number;
  coldChain: boolean;
  shelfLifeDays: number;
}

export interface Lot {
  lotId: string;
  sku: string;
  qty: number;
  receivedOn: string;
  expiresOn: string;
  bayId: string;
}

/** Every lot ever produced, including fully consumed ones that shipments reference. */
export interface LotRecord {
  lotId: string;
  sku: string;
  receivedOn: string;
  expiresOn: string;
}

export type Channel = "Practice" | "Retail" | "Web";

export interface OrderLine {
  sku: string;
  qty: number;
  unitPrice: number;
}

export interface Order {
  orderId: string;
  customer: string;
  channel: Channel;
  orderDate: string;
  fulfillmentSite: SiteId;
  lines: OrderLine[];
}

export interface ShipmentLine {
  sku: string;
  qty: number;
  lotId: string;
}

export interface Shipment {
  shipmentId: string;
  orderId: string;
  fromSite: SiteId;
  truckId?: string;
  shippedOn?: string;
  promisedBy: string;
  deliveredOn?: string;
  lines: ShipmentLine[];
}

export interface Invoice {
  invoiceId: string;
  orderId: string;
  invoicedOn: string;
  lines: OrderLine[];
}

export interface DockVisit {
  dockId: string;
  truckId: string;
  siteId: SiteId;
  dwellMinutes: number;
  endedAtMinute: number;
}

export interface World {
  seed: number;
  /** Anchor date for orders, lots and invoices. */
  today: string;
  /** Simulated minutes since the start of the shift. */
  clockMinutes: number;
  /** Hour of day the shift starts at. */
  startHour: number;
  rngState: number;
  sites: Site[];
  products: Product[];
  orders: Order[];
  shipments: Shipment[];
  invoices: Invoice[];
  lotCatalog: Record<string, LotRecord>;
  dockVisits: DockVisit[];
}

/** A reference to any clickable object in the world. */
export type ObjectKind = "site" | "dock" | "truck" | "forklift" | "bay" | "coldRoom" | "lot" | "shipment" | "order";

export interface ObjectRef {
  kind: ObjectKind;
  id: string;
}
