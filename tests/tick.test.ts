import { describe, expect, it } from "vitest";
import { generateWorld } from "../src/sim/world";
import { tick } from "../src/sim/tick";
import type { World } from "../src/sim/types";

const TODAY = "2026-10-09";

function checkInvariants(w: World) {
  const truckDocks = new Map<string, string>();
  for (const site of w.sites) {
    for (const dock of site.docks) {
      if (dock.status === "occupied") {
        expect(dock.truckId, `${dock.id} occupied without truck`).toBeDefined();
        const truck = site.trucks.find((t) => t.id === dock.truckId);
        expect(truck, `${dock.id} occupied by missing truck ${dock.truckId}`).toBeDefined();
        expect(truck!.status).not.toBe("departed");
        expect(truck!.location).toBe("dock");
        expect(truck!.dockId).toBe(dock.id);
        expect(truckDocks.has(truck!.id), `${truck!.id} docked at two docks`).toBe(false);
        truckDocks.set(truck!.id, dock.id);
      } else {
        expect(dock.truckId).toBeUndefined();
      }
    }
    for (const truck of site.trucks) {
      if (truck.location === "dock") {
        expect(truckDocks.get(truck.id)).toBe(truck.dockId);
      } else {
        expect(truck.dockId).toBeUndefined();
      }
      if (truck.status === "departed") expect(truck.location).toBe("road");
    }
    for (const f of site.forklifts) {
      expect(f.battery).toBeGreaterThanOrEqual(0);
      expect(f.battery).toBeLessThanOrEqual(100);
    }
  }
  const ids = w.sites.flatMap((s) => s.trucks.map((t) => t.id));
  expect(new Set(ids).size).toBe(ids.length);
}

describe("tick", () => {
  it("is deterministic", () => {
    const a = tick(generateWorld(42, TODAY), 500);
    const b = tick(generateWorld(42, TODAY), 500);
    expect(a).toEqual(b);
  });

  it("does not modify its input", () => {
    const w = generateWorld(42, TODAY);
    const before = JSON.stringify(w);
    tick(w, 120);
    expect(JSON.stringify(w)).toBe(before);
  });

  it("composes: tick(w, a + b) equals tick(tick(w, a), b)", () => {
    const w = generateWorld(42, TODAY);
    expect(tick(tick(w, 37), 63)).toEqual(tick(w, 100));
  });

  it("advances the clock and is a no-op for zero minutes", () => {
    const w = generateWorld(42, TODAY);
    expect(tick(w, 0)).toBe(w);
    expect(tick(w, 25).clockMinutes).toBe(25);
  });

  it.each([42, 7, 1234])("never leaves a dock held by a departed truck or a truck at two docks (seed %i)", (seed) => {
    let w = generateWorld(seed, TODAY);
    checkInvariants(w);
    for (let i = 0; i < 300; i++) {
      w = tick(w, 10);
      checkInvariants(w);
    }
  });

  it("moves trucks through the full lifecycle", () => {
    let w = generateWorld(42, TODAY);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      w = tick(w, 5);
      for (const s of w.sites) for (const t of s.trucks) seen.add(t.status);
    }
    for (const s of ["en_route", "loading", "unloading", "departed", "delayed"]) expect(seen.has(s), s).toBe(true);
    expect(w.dockVisits.some((v) => v.endedAtMinute > 0)).toBe(true);
  });

  it("keeps a cold-chain excursion latched until resolved", () => {
    let w = generateWorld(42, TODAY);
    for (let i = 0; i < 20; i++) w = tick(w, 30);
    const truck = w.sites.flatMap((s) => s.trucks).find((t) => t.id === "TRK-113")!;
    expect(truck.tempStatus).toBe("excursion");
  });

  it("records cold room history every 15 minutes, capped", () => {
    const w = generateWorld(42, TODAY);
    const before = w.sites[0].coldRooms[0].history.length;
    const after = tick(w, 15).sites[0].coldRooms[0].history;
    expect(after.length).toBe(Math.min(48, before + 1));
  });
});
