import { nextColdStatus } from "../engine/coldchain";
import { createRng, type Rng } from "./prng";
import { SITE_IDS, type Forklift, type Site, type Truck, type World } from "./types";
import { travelMinutes } from "./world";

/** Simulated minutes per real second at 1x speed. */
export const MINUTES_PER_SECOND = 5;
const HISTORY_EVERY_MINUTES = 15;
const HISTORY_LENGTH = 48;
/** Minutes a truck takes to pull out of the dock and leave the yard. */
export const DEPART_MINUTES = 15;
/** Minutes per forklift move between two points. */
const FORKLIFT_LEG_MINUTES = 4;
const FORKLIFT_LOW_BATTERY = 12;
/** A reefer at a dock this long in a hot yard starts warming. */
const REEFER_HEAT_AFTER_MINUTES = 90;
const HOT_AMBIENT_C = 28;
const MAX_DOCK_VISITS = 200;

const round2 = (n: number) => Math.round(n * 100) / 100;

export const chargerId = (siteId: string) => `${siteId}-CHG`;
export const isDockId = (id: string) => /-D\d+$/.test(id);
export const isChargerId = (id: string) => id.endsWith("-CHG");

/**
 * Advance the world by whole simulated minutes. Pure: the input world is not
 * modified. Orders, shipments and invoices are immutable and shared by reference.
 * Stepping minute by minute makes tick(w, a + b) equal tick(tick(w, a), b).
 */
export function tick(world: World, minutes: number): World {
  const steps = Math.max(0, Math.floor(minutes));
  if (steps === 0) return world;
  const next: World = { ...world, sites: structuredClone(world.sites), dockVisits: world.dockVisits.slice() };
  const rng = createRng(world.rngState);
  for (let i = 0; i < steps; i++) step(next, rng);
  next.rngState = rng.state();
  if (next.dockVisits.length > MAX_DOCK_VISITS) next.dockVisits = next.dockVisits.slice(-MAX_DOCK_VISITS);
  return next;
}

function step(world: World, rng: Rng): void {
  world.clockMinutes += 1;
  for (const site of world.sites) stepColdRooms(site, rng, world.clockMinutes);
  stepTrucks(world, rng);
  for (const site of world.sites) stepForklifts(site, rng);
}

function stepColdRooms(site: Site, rng: Rng, clock: number): void {
  for (const room of site.coldRooms) {
    const target = room.setpointC + room.biasC;
    room.currentC = round2(room.currentC + (target - room.currentC) * 0.05 + rng.float(-0.04, 0.04));
    room.status = nextColdStatus(room.status, room.currentC, room.setpointC);
    if (clock % HISTORY_EVERY_MINUTES === 0) {
      room.history.push(room.currentC);
      if (room.history.length > HISTORY_LENGTH) room.history.shift();
    }
  }
}

function stepReefer(truck: Truck, site: Site, rng: Rng): void {
  if (truck.kind !== "reefer" || truck.tempC === undefined || truck.setpointC === undefined) return;
  const heat = truck.location === "dock" && site.ambientC >= HOT_AMBIENT_C && truck.tempHoldMinutes > REEFER_HEAT_AFTER_MINUTES;
  if (heat) {
    const headroom = Math.max(0, 1 - (truck.tempC - truck.setpointC) / 8);
    truck.tempC += 0.015 * headroom + rng.float(-0.004, 0.004);
  } else {
    truck.tempC += (truck.setpointC - truck.tempC) * 0.03 + rng.float(-0.03, 0.03);
  }
  truck.tempC = round2(truck.tempC);
  truck.tempStatus = nextColdStatus(truck.tempStatus, truck.tempC, truck.setpointC);
}

function stepTrucks(world: World, rng: Rng): void {
  const moves: { truck: Truck; from: Site }[] = [];
  for (const site of world.sites) {
    for (const truck of site.trucks) {
      if (truck.location === "road") {
        truck.etaMinutes = Math.max(0, truck.etaMinutes - 1);
        if (truck.status === "departed") {
          truck.taskMinutes -= 1;
          if (truck.taskMinutes <= 0) {
            truck.taskMinutes = 0;
            truck.lastDockId = undefined;
            truck.status = truck.delayMinutes > 0 ? "delayed" : "en_route";
          }
        }
        if (truck.etaMinutes <= 0 && truck.status !== "departed") {
          truck.location = "yard";
          truck.status = "arrived";
        }
      } else if (truck.location === "dock") {
        truck.dwellMinutes += 1;
        truck.tempHoldMinutes += 1;
        truck.taskMinutes -= 1;
        if (truck.taskMinutes <= 0) {
          depart(world, site, truck, rng);
          moves.push({ truck, from: site });
        }
      } else if (truck.status === "delayed") {
        truck.delayMinutes += 1;
      }
      stepReefer(truck, site, rng);
    }
    assignDocks(site, rng);
  }
  for (const { truck, from } of moves) {
    from.trucks = from.trucks.filter((t) => t !== truck);
    world.sites.find((s) => s.id === truck.siteId)!.trucks.push(truck);
  }
}

/** Yard trucks take the first free dock of the right type, longest-waiting first. */
function assignDocks(site: Site, rng: Rng): void {
  const waiting = site.trucks
    .filter((t) => t.location === "yard")
    .sort((a, b) => b.delayMinutes - a.delayMinutes || a.id.localeCompare(b.id));
  for (const truck of waiting) {
    const dock = site.docks.find((d) => d.type === truck.direction && d.status === "free");
    if (!dock) {
      truck.status = "delayed";
      continue;
    }
    dock.status = "occupied";
    dock.truckId = truck.id;
    truck.dockId = dock.id;
    truck.location = "dock";
    truck.status = truck.direction === "inbound" ? "unloading" : "loading";
    truck.taskMinutes = rng.int(40, 110);
    truck.dwellMinutes = 0;
    truck.tempHoldMinutes = 0;
    truck.delayMinutes = 0;
  }
}

/** Least-loaded other site (trucks assigned per usable dock); ties broken by the seeded RNG. */
function pickDestination(world: World, from: Site["id"], rng: Rng): Site["id"] {
  let best: Site["id"][] = [];
  let bestLoad = Infinity;
  for (const s of world.sites) {
    if (s.id === from) continue;
    const docks = s.docks.filter((d) => d.status !== "blocked").length || 1;
    const load = Math.round((s.trucks.length / docks) * 100) / 100;
    if (load < bestLoad) {
      bestLoad = load;
      best = [s.id];
    } else if (load === bestLoad) best.push(s.id);
  }
  return best.length ? rng.pick(best) : rng.pick(SITE_IDS.filter((id) => id !== from));
}

function depart(world: World, site: Site, truck: Truck, rng: Rng): void {
  const dock = site.docks.find((d) => d.id === truck.dockId);
  if (dock) {
    dock.status = "free";
    dock.truckId = undefined;
    world.dockVisits.push({
      dockId: dock.id,
      truckId: truck.id,
      siteId: site.id,
      dwellMinutes: truck.dwellMinutes,
      endedAtMinute: world.clockMinutes,
    });
  }
  const dest = pickDestination(world, site.id, rng);
  truck.lastDockId = truck.dockId;
  truck.dockId = undefined;
  truck.status = "departed";
  truck.location = "road";
  truck.originSiteId = site.id;
  truck.siteId = dest;
  truck.direction = rng.chance(0.5) ? "inbound" : "outbound";
  truck.tripMinutes = travelMinutes(site.id, dest);
  truck.etaMinutes = truck.tripMinutes;
  truck.taskMinutes = DEPART_MINUTES;
  truck.dwellMinutes = 0;
  truck.tempHoldMinutes = 0;
  truck.delayMinutes = 0;
  if (rng.chance(0.12)) {
    const delay = rng.int(40, 150);
    truck.etaMinutes += delay;
    truck.tripMinutes += delay;
    truck.delayMinutes = delay;
  }
}

function stepForklifts(site: Site, rng: Rng): void {
  const activeDocks = site.docks.filter((d) => {
    if (d.status !== "occupied") return false;
    const t = site.trucks.find((x) => x.id === d.truckId);
    return t?.status === "loading" || t?.status === "unloading";
  });
  const bays = site.bays.filter((b) => b.zone !== "quarantine");

  const chooseNext = (f: Forklift) => {
    f.progress = 0;
    if (f.battery <= FORKLIFT_LOW_BATTERY) {
      if (f.fromId === chargerId(site.id)) {
        f.status = "charging";
        f.targetId = undefined;
      } else {
        f.status = "moving";
        f.targetId = chargerId(site.id);
      }
      return;
    }
    if (activeDocks.length === 0) {
      f.status = "idle";
      f.targetId = undefined;
      return;
    }
    f.status = "moving";
    f.targetId = f.fromId && isDockId(f.fromId) ? rng.pick(bays).id : rng.pick(activeDocks).id;
  };

  for (const f of site.forklifts) {
    switch (f.status) {
      case "charging":
        f.battery = Math.min(100, f.battery + 1);
        if (f.battery >= 95) f.status = "idle";
        break;
      case "moving":
        f.battery -= 0.08;
        f.progress += 1 / FORKLIFT_LEG_MINUTES;
        if (f.progress >= 1) {
          f.fromId = f.targetId;
          f.targetId = undefined;
          f.progress = 0;
          if (f.fromId && isChargerId(f.fromId)) f.status = "charging";
          else {
            f.status = "loading";
            f.taskMinutes = 3;
          }
        }
        break;
      case "loading":
        f.battery -= 0.05;
        f.taskMinutes -= 1;
        if (f.taskMinutes <= 0) chooseNext(f);
        break;
      case "idle":
        f.battery -= 0.01;
        if (activeDocks.length > 0 || f.battery <= FORKLIFT_LOW_BATTERY) chooseNext(f);
        break;
    }
    f.battery = round2(Math.max(0, f.battery));
  }
}
