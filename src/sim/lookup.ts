import type { ColdRoom, Dock, Forklift, Lot, ObjectRef, Order, Shipment, Site, SiteId, StockBay, Truck, World } from "./types";

export type Resolved =
  | { kind: "site"; site: Site }
  | { kind: "dock"; site: Site; dock: Dock }
  | { kind: "truck"; site: Site; truck: Truck }
  | { kind: "forklift"; site: Site; forklift: Forklift }
  | { kind: "bay"; site: Site; bay: StockBay }
  | { kind: "coldRoom"; site: Site; room: ColdRoom }
  | { kind: "lot"; site: Site; bay: StockBay; lot: Lot }
  | { kind: "shipment"; site: Site; shipment: Shipment }
  | { kind: "order"; site: Site; order: Order };

export function siteName(world: World, id: SiteId): string {
  return world.sites.find((s) => s.id === id)?.shortName ?? id;
}

export function findTruck(world: World, id: string): { truck: Truck; site: Site } | undefined {
  for (const site of world.sites) {
    const truck = site.trucks.find((t) => t.id === id);
    if (truck) return { truck, site };
  }
  return undefined;
}

/** Resolve any object reference to the live object and its site. Undefined if it no longer exists. */
export function resolveRef(world: World, ref: ObjectRef): Resolved | undefined {
  for (const site of world.sites) {
    switch (ref.kind) {
      case "site":
        if (site.id === ref.id) return { kind: "site", site };
        break;
      case "dock": {
        const dock = site.docks.find((d) => d.id === ref.id);
        if (dock) return { kind: "dock", site, dock };
        break;
      }
      case "truck": {
        const truck = site.trucks.find((t) => t.id === ref.id);
        if (truck) return { kind: "truck", site, truck };
        break;
      }
      case "forklift": {
        const forklift = site.forklifts.find((f) => f.id === ref.id);
        if (forklift) return { kind: "forklift", site, forklift };
        break;
      }
      case "bay": {
        const bay = site.bays.find((b) => b.id === ref.id);
        if (bay) return { kind: "bay", site, bay };
        break;
      }
      case "coldRoom": {
        const room = site.coldRooms.find((r) => r.id === ref.id);
        if (room) return { kind: "coldRoom", site, room };
        break;
      }
      case "lot":
        for (const bay of site.bays) {
          const lot = bay.lots.find((l) => l.lotId === ref.id);
          if (lot) return { kind: "lot", site, bay, lot };
        }
        break;
      case "shipment": {
        const shipment = world.shipments.find((s) => s.shipmentId === ref.id);
        if (shipment && shipment.fromSite === site.id) return { kind: "shipment", site, shipment };
        break;
      }
      case "order": {
        const order = world.orders.find((o) => o.orderId === ref.id);
        if (order && order.fulfillmentSite === site.id) return { kind: "order", site, order };
        break;
      }
    }
  }
  return undefined;
}

/** The physical object to fly the camera to for a reference (lots live in bays, shipments at the site). */
export function physicalRef(world: World, ref: ObjectRef): ObjectRef | undefined {
  const r = resolveRef(world, ref);
  if (!r) return undefined;
  if (r.kind === "lot") return { kind: "bay", id: r.bay.id };
  if (r.kind === "shipment") {
    if (r.shipment.truckId && findTruck(world, r.shipment.truckId)) return { kind: "truck", id: r.shipment.truckId };
    return { kind: "site", id: r.site.id };
  }
  if (r.kind === "order") return { kind: "site", id: r.site.id };
  return ref;
}
