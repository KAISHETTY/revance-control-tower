import { useMemo } from "react";
import { deriveAlerts, type Alert } from "../engine/alerts";
import { allLots, type LotView } from "../engine/expiry";
import { computeKpis, type Kpis } from "../engine/kpis";
import { reconcile, summarizeRecon, type ReconException, type ReconSummary } from "../engine/reconcile";
import type { SiteId, World } from "../sim/types";
import { useWorld } from "./useWorld";

/*
 * Heavy derived data, memoized on the inputs that actually change it.
 * Orders, shipments and invoices are shared by reference across ticks, so
 * reconcile runs once per generated world, not once per tick.
 */

let reconKey: readonly unknown[] = [];
let reconValue: ReconException[] = [];
export function getExceptions(world: World): ReconException[] {
  const key = [world.orders, world.shipments, world.invoices, world.lotCatalog, world.today];
  if (key.length !== reconKey.length || key.some((k, i) => k !== reconKey[i])) {
    reconKey = key;
    reconValue = reconcile(world);
  }
  return reconValue;
}

const alertCache = new WeakMap<World, Alert[]>();
export function getAlerts(world: World): Alert[] {
  let v = alertCache.get(world);
  if (!v) {
    v = deriveAlerts(world);
    alertCache.set(world, v);
  }
  return v;
}

const lotCache = new WeakMap<object, LotView[]>();
function getLots(world: World): LotView[] {
  let v = lotCache.get(world.sites);
  if (!v) {
    v = allLots(world);
    lotCache.set(world.sites, v);
  }
  return v;
}

export function useExceptions(): ReconException[] {
  return useWorld((s) => getExceptions(s.world));
}

export function useReconSummary(): ReconSummary {
  const exc = useExceptions();
  const n = useWorld((s) => s.world.orders.length);
  return useMemo(() => summarizeRecon(exc, n), [exc, n]);
}

export function useAlerts(): Alert[] {
  return useWorld((s) => getAlerts(s.world));
}

export function useLots(): LotView[] {
  return useWorld((s) => getLots(s.world));
}

const kpiCache = new WeakMap<World, Map<string, Kpis>>();
function getKpis(world: World, siteId?: SiteId): Kpis {
  let bySite = kpiCache.get(world);
  if (!bySite) {
    bySite = new Map();
    kpiCache.set(world, bySite);
  }
  const key = siteId ?? "*";
  let k = bySite.get(key);
  if (!k) {
    k = computeKpis(world, getExceptions(world), getAlerts(world), siteId);
    bySite.set(key, k);
  }
  return k;
}

export function useKpis(siteId?: SiteId): Kpis {
  return useWorld((s) => getKpis(s.world, siteId));
}

/** The site currently in focus, or undefined for the whole network. */
export function useFocusSite(): SiteId | undefined {
  return useWorld((s) => (s.view === "network" ? undefined : s.view));
}
