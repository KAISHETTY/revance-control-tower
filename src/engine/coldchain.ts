import type { ColdStatus, World, SiteId } from "../sim/types";

/** Acceptable storage range for cold-chain product. Setpoint sits mid-range. */
export const COLD_RANGE_C = { min: 2, max: 8 } as const;
export const COLD_SETPOINT_C = 5;
export const WARNING_DELTA_C = 2;
export const EXCURSION_DELTA_C = 4;

/**
 * Classify a reading against its setpoint. Deviation in either direction counts
 * (freezing damages injectables as much as heat). Rounded to 0.01 C so
 * floating-point noise never flips a boundary.
 */
export function classifyTemp(currentC: number, setpointC: number): ColdStatus {
  const deviation = Math.round(Math.abs(currentC - setpointC) * 100) / 100;
  if (deviation >= EXCURSION_DELTA_C) return "excursion";
  if (deviation >= WARNING_DELTA_C) return "warning";
  return "ok";
}

/** Keep an excursion latched until someone resolves it; otherwise reclassify. */
export function nextColdStatus(prev: ColdStatus | undefined, currentC: number, setpointC: number): ColdStatus {
  if (prev === "excursion") return "excursion";
  return classifyTemp(currentC, setpointC);
}

export interface ColdChainReading {
  kind: "coldRoom" | "truck";
  id: string;
  label: string;
  siteId: SiteId;
  currentC: number;
  setpointC: number;
  status: ColdStatus;
}

export function coldChainReadings(world: World): ColdChainReading[] {
  const out: ColdChainReading[] = [];
  for (const site of world.sites) {
    for (const r of site.coldRooms) {
      out.push({ kind: "coldRoom", id: r.id, label: r.label, siteId: site.id, currentC: r.currentC, setpointC: r.setpointC, status: r.status });
    }
    for (const t of site.trucks) {
      if (t.kind !== "reefer" || t.tempC === undefined || t.setpointC === undefined) continue;
      out.push({ kind: "truck", id: t.id, label: t.id, siteId: site.id, currentC: t.tempC, setpointC: t.setpointC, status: t.tempStatus ?? "ok" });
    }
  }
  return out;
}
