import { describe, expect, it } from "vitest";
import { generateWorld } from "../src/sim/world";
import { createRng } from "../src/sim/prng";
import { reconcile, summarizeRecon } from "../src/engine/reconcile";
import { allLots, expiryBuckets } from "../src/engine/expiry";

const TODAY = "2026-10-09";

describe("prng", () => {
  it("is reproducible and resumable from its state", () => {
    const a = createRng(7);
    const seq = [a.next(), a.next(), a.next()];
    const b = createRng(7);
    expect([b.next(), b.next(), b.next()]).toEqual(seq);
    const resumed = createRng(a.state());
    const c = createRng(7);
    c.next();
    c.next();
    c.next();
    expect(resumed.next()).toBe(c.next());
  });
});

describe("generateWorld", () => {
  it("gives an identical world for the same seed", () => {
    expect(generateWorld(42, TODAY)).toEqual(generateWorld(42, TODAY));
  });

  it("gives a different world for a different seed", () => {
    const a = generateWorld(42, TODAY);
    const b = generateWorld(43, TODAY);
    expect(JSON.stringify(a.sites)).not.toEqual(JSON.stringify(b.sites));
    expect(JSON.stringify(a.orders)).not.toEqual(JSON.stringify(b.orders));
  });

  it("builds the three-site network with the requested sizes", () => {
    const w = generateWorld(42, TODAY);
    expect(w.sites.map((s) => [s.id, s.docks.length])).toEqual([
      ["NASH", 8],
      ["JCTY", 6],
      ["NWK", 4],
    ]);
    const trucks = w.sites.flatMap((s) => s.trucks);
    expect(trucks.length).toBeGreaterThanOrEqual(12);
    expect(trucks.length).toBeLessThanOrEqual(16);
    expect(trucks.some((t) => t.kind === "reefer")).toBe(true);
    expect(w.sites.flatMap((s) => s.forklifts)).toHaveLength(6);
    expect(w.orders).toHaveLength(300);
  });

  it.each([1, 42, 99, 2024])("seeds the demo problems for seed %i", (seed) => {
    const w = generateWorld(seed, TODAY);
    const lots = allLots(w);
    expect(lots.length).toBeGreaterThanOrEqual(40);
    expect(lots.length).toBeLessThanOrEqual(60);
    const b = expiryBuckets(lots);
    expect(b.critical.lots).toBeGreaterThanOrEqual(3);
    expect(b.critical.lots).toBeLessThanOrEqual(4);
    expect(b.critical.lots + b.warning.lots).toBeGreaterThanOrEqual(8);
    expect(b.critical.lots + b.warning.lots).toBeLessThanOrEqual(10);
    expect(b.expired.lots).toBeGreaterThanOrEqual(1);
    expect(b.expired.lots).toBeLessThanOrEqual(2);

    const rooms = w.sites.flatMap((s) => s.coldRooms);
    expect(rooms.filter((r) => r.status === "warning")).toHaveLength(1);
    const trucks = w.sites.flatMap((s) => s.trucks);
    expect(trucks.filter((t) => t.tempStatus === "excursion")).toHaveLength(1);
    expect(trucks.filter((t) => t.status === "delayed" && t.location === "road")).toHaveLength(2);
    expect(w.sites.flatMap((s) => s.docks).filter((d) => d.status === "blocked")).toHaveLength(1);

    const exceptions = reconcile({ ...w });
    const types = new Set(exceptions.map((e) => e.type));
    expect(types.size).toBe(8);
    const summary = summarizeRecon(exceptions, w.orders.length);
    expect(summary.cleanOrderRate).toBeGreaterThan(0.55);
    expect(summary.cleanOrderRate).toBeLessThan(0.75);
  });

  it("keeps every date relative to today", () => {
    const w = generateWorld(42, TODAY);
    for (const o of w.orders) {
      expect(o.orderDate <= TODAY).toBe(true);
      expect(o.orderDate >= "2026-07-11").toBe(true);
    }
    for (const i of w.invoices) expect(i.invoicedOn <= TODAY).toBe(true);
  });
});
