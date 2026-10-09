import { DEPART_MINUTES, chargerId, isChargerId, isDockId } from "../sim/tick";
import { physicalRef, resolveRef } from "../sim/lookup";
import { SITE_IDS, type Forklift, type ObjectRef, type Site, type SiteId, type Truck, type World } from "../sim/types";

/*
 * Pure spatial layout shared by the 3D scene and the 2D fallback.
 * World units are meters-ish; x is east, z is south, y is up.
 * Each site's building is centered on its origin with docks on the +z side.
 */

export interface Vec2 {
  x: number;
  z: number;
}

export interface Pose extends Vec2 {
  /** Rotation about y. 0 means the vehicle faces +z. */
  rot: number;
}

const SITE_ORIGINS: Record<SiteId, Vec2> = {
  NWK: { x: -108, z: 26 },
  NASH: { x: 0, z: 0 },
  JCTY: { x: 104, z: -36 },
};

const DOCK_SPACING = 4.2;
const BUILDING_DEPTH = 20;
export const WALL_HEIGHT = 3.2;
export const BAY_W = 2.8;
export const BAY_D = 1.3;
const COLD_ROOM_W = 8;
const COLD_ROOM_D = 9;
export const TRUCK_LENGTH = 8.6;

export interface DockLayout {
  /** Center of the door on the building wall. */
  door: Vec2;
  /** Colored pad outside the door. */
  pad: Vec2;
  /** Center of a truck backed into the dock. */
  truck: Vec2;
  /** Point inside the building where forklifts load. */
  inside: Vec2;
}

export interface SiteLayout {
  origin: Vec2;
  width: number;
  depth: number;
  /** Radius of the site "island" around the building. */
  radius: number;
  docks: Record<string, DockLayout>;
  bays: Record<string, { pos: Vec2; access: Vec2; inColdRoom: boolean }>;
  coldRooms: Record<string, { center: Vec2; w: number; d: number }>;
  charger: Vec2;
  yard: Vec2[];
  /** Road endpoint on this island toward another site, or toward the outside world. */
  gates: Record<SiteId | "EXT", Vec2>;
  /** Far end of the external spur road (suppliers and customers). */
  extFar: Vec2;
}

const add = (o: Vec2, x: number, z: number): Vec2 => ({ x: o.x + x, z: o.z + z });
const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });

const cache = new Map<string, SiteLayout>();

/** Layout depends only on the site's structure, which never changes, so it is cached per site. */
export function siteLayout(site: Site): SiteLayout {
  const key = `${site.id}:${site.docks.length}:${site.bays.length}:${site.coldRooms.length}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const o = SITE_ORIGINS[site.id];
  const n = site.docks.length;
  const width = Math.max(n * DOCK_SPACING + 6, 26);
  const depth = BUILDING_DEPTH;
  const front = depth / 2;

  const docks: SiteLayout["docks"] = {};
  site.docks.forEach((d, i) => {
    const x = (i - (n - 1) / 2) * DOCK_SPACING;
    docks[d.id] = {
      door: add(o, x, front),
      pad: add(o, x, front + 1.2),
      truck: add(o, x, front + 0.6 + TRUCK_LENGTH / 2),
      inside: add(o, x, front - 2),
    };
  });

  // Cold rooms along the back-right wall.
  const coldRooms: SiteLayout["coldRooms"] = {};
  site.coldRooms.forEach((r, i) => {
    const cx = width / 2 - 1.5 - COLD_ROOM_W / 2 - i * (COLD_ROOM_W + 1);
    coldRooms[r.id] = { center: add(o, cx, -front + 1.5 + COLD_ROOM_D / 2), w: COLD_ROOM_W, d: COLD_ROOM_D };
  });
  const coldLeftEdge = width / 2 - 1.5 - site.coldRooms.length * (COLD_ROOM_W + 1);

  const bays: SiteLayout["bays"] = {};
  // Cold bays sit inside their cold room, two per row.
  const perRoom = new Map<string, number>();
  for (const b of site.bays.filter((x) => x.zone === "cold")) {
    const room = coldRooms[b.coldRoomId ?? site.coldRooms[0].id];
    const k = perRoom.get(b.coldRoomId ?? "") ?? 0;
    perRoom.set(b.coldRoomId ?? "", k + 1);
    const pos = add(room.center, (k % 2 === 0 ? -1 : 1) * 1.8, -2.2 + Math.floor(k / 2) * 3.6);
    bays[b.id] = { pos, access: add(pos, 0, 1.5), inColdRoom: true };
  }
  // Ambient and quarantine bays in a grid on the left side.
  const left = -width / 2 + 2.5;
  const usable = coldLeftEdge - 1 - left;
  const cols = Math.max(1, Math.floor(usable / 3.4));
  const others = site.bays.filter((x) => x.zone !== "cold");
  others.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const pos = add(o, left + BAY_W / 2 + col * 3.4, -front + 3 + row * 5);
    bays[b.id] = { pos, access: add(pos, 0, 1.6), inColdRoom: false };
  });

  const yard: Vec2[] = [];
  for (let k = 0; k < 6; k++) yard.push(add(o, -width / 2 + 3 + k * 4.4, front + 17));

  const radius = Math.hypot(width / 2 + 8, front + 26) + 3;
  // Road endpoints sit on the open apron in front of the docks (left or right corner toward the other
  // site, center for the outside world), so trucks never drive through the building.
  const gates = {} as SiteLayout["gates"];
  for (const other of SITE_IDS) {
    if (other === site.id) continue;
    const side = SITE_ORIGINS[other].x < o.x ? -1 : 1;
    gates[other] = add(o, side * (width / 2 + 9), front + 21);
  }
  gates.EXT = add(o, 0, front + 26);
  const extFar = add(o, 10, front + 70);

  const layout: SiteLayout = {
    origin: o,
    width,
    depth,
    radius,
    docks,
    bays,
    coldRooms,
    charger: add(o, -width / 2 + 1.6, front - 2.2),
    yard,
    gates,
    extFar,
  };
  cache.set(key, layout);
  return layout;
}

function heading(from: Vec2, to: Vec2, fallback = 0): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (Math.abs(dx) + Math.abs(dz) < 1e-6) return fallback;
  return Math.atan2(dx, dz);
}

/** Road endpoints for a trip into `site` from `origin` (undefined = outside the network). */
function roadFor(world: World, truck: Truck): [Vec2, Vec2] {
  const dest = siteLayout(siteById(world, truck.siteId));
  if (!truck.originSiteId) return [dest.extFar, dest.gates.EXT];
  const from = siteLayout(siteById(world, truck.originSiteId));
  return [from.gates[truck.siteId], dest.gates[truck.originSiteId]];
}

function siteById(world: World, id: SiteId): Site {
  return world.sites.find((s) => s.id === id)!;
}

export function truckPose(world: World, truck: Truck, site: Site): Pose {
  const lay = siteLayout(site);
  if (truck.location === "dock" && truck.dockId) {
    const d = lay.docks[truck.dockId];
    return { ...d.truck, rot: 0 };
  }
  if (truck.location === "yard") {
    const waiting = site.trucks.filter((t) => t.location === "yard").sort((a, b) => a.id.localeCompare(b.id));
    const k = Math.max(0, waiting.indexOf(truck));
    const p = lay.yard[k % lay.yard.length];
    return { ...p, rot: Math.PI };
  }
  const [a, b] = roadFor(world, truck);
  if (truck.status === "departed" && truck.originSiteId && truck.lastDockId) {
    const origin = siteLayout(siteById(world, truck.originSiteId));
    const dock = origin.docks[truck.lastDockId];
    if (dock) {
      const t = 1 - Math.max(0, truck.taskMinutes) / DEPART_MINUTES;
      const p = lerp(dock.truck, a, t);
      return { ...p, rot: heading(dock.truck, a) };
    }
  }
  const trip = Math.max(1, truck.tripMinutes);
  const t = Math.min(1, Math.max(0, 1 - truck.etaMinutes / trip));
  const p = lerp(a, b, t);
  return { ...p, rot: heading(a, b) };
}

/** Where a forklift's waypoint id is on the floor. */
function waypoint(site: Site, id: string | undefined): Vec2 {
  const lay = siteLayout(site);
  if (!id || isChargerId(id)) return lay.charger;
  if (isDockId(id)) return lay.docks[id]?.inside ?? lay.charger;
  return lay.bays[id]?.access ?? lay.charger;
}

export function forkliftPose(site: Site, f: Forklift): Pose {
  const from = waypoint(site, f.fromId ?? chargerId(site.id));
  if (f.status !== "moving" || !f.targetId) {
    return { ...from, rot: Math.PI };
  }
  const to = waypoint(site, f.targetId);
  return { ...lerp(from, to, Math.min(1, f.progress)), rot: heading(from, to, Math.PI) };
}

export interface Focus extends Vec2 {
  /** Suggested camera distance. */
  distance: number;
}

export function networkFocus(): Focus {
  return { x: -2, z: -2, distance: 300 };
}

export function siteFocus(site: Site): Focus {
  const lay = siteLayout(site);
  return { x: lay.origin.x, z: lay.origin.z + 6, distance: Math.max(58, lay.width * 1.55) };
}

/** Camera focus for any object reference; falls back to the object's site. */
export function focusFor(world: World, ref: ObjectRef): Focus | undefined {
  const phys = physicalRef(world, ref);
  if (!phys) return undefined;
  const r = resolveRef(world, phys);
  if (!r) return undefined;
  const lay = siteLayout(r.site);
  switch (r.kind) {
    case "site":
      return siteFocus(r.site);
    case "dock":
      return { ...lay.docks[r.dock.id].pad, distance: 36 };
    case "truck": {
      const p = truckPose(world, r.truck, r.site);
      return { x: p.x, z: p.z, distance: r.truck.location === "road" ? 60 : 36 };
    }
    case "forklift": {
      const p = forkliftPose(r.site, r.forklift);
      return { x: p.x, z: p.z, distance: 28 };
    }
    case "bay":
      return { ...lay.bays[r.bay.id].pos, distance: 30 };
    case "coldRoom":
      return { ...lay.coldRooms[r.room.id].center, distance: 34 };
    default:
      return siteFocus(r.site);
  }
}
