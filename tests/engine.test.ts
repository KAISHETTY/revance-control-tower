import { describe, expect, it } from "vitest";
import { classifyExpiry } from "../src/engine/expiry";
import { classifyTemp, nextColdStatus } from "../src/engine/coldchain";
import { deriveAlerts } from "../src/engine/alerts";
import { computeKpis } from "../src/engine/kpis";
import { explainAlert, explainException } from "../src/engine/explain";
import { reconcile } from "../src/engine/reconcile";
import { resolveRef } from "../src/sim/lookup";
import { generateWorld } from "../src/sim/world";
import { tick } from "../src/sim/tick";
import { addDays } from "../src/lib/dates";

const TODAY = "2026-10-09";

describe("expiry classification", () => {
  it.each([
    [-1, "expired"],
    [0, "critical"],
    [1, "critical"],
    [30, "critical"],
    [31, "warning"],
    [90, "warning"],
    [91, "ok"],
  ] as const)("%d days from today is %s", (days, status) => {
    expect(classifyExpiry(addDays(TODAY, days), TODAY)).toBe(status);
  });
});

describe("cold chain classification", () => {
  it.each([
    [5 + 1.9, "ok"],
    [5 + 2, "warning"],
    [5 + 3.9, "warning"],
    [5 + 4, "excursion"],
    [5 - 2, "warning"],
    [5 - 4, "excursion"],
    [5, "ok"],
  ] as const)("%f C against a 5 C setpoint is %s", (temp, status) => {
    expect(classifyTemp(temp, 5)).toBe(status);
  });

  it("latches excursions", () => {
    expect(nextColdStatus("excursion", 5, 5)).toBe("excursion");
    expect(nextColdStatus("warning", 5, 5)).toBe("ok");
  });
});

describe("alerts", () => {
  it.each([42, 3, 77])("reference objects that exist in the world (seed %i)", (seed) => {
    let w = generateWorld(seed, TODAY);
    for (let i = 0; i < 5; i++) {
      const alerts = deriveAlerts(w);
      expect(alerts.length).toBeGreaterThan(0);
      for (const a of alerts) {
        expect(resolveRef(w, a.ref), `${a.id} -> ${a.ref.kind}:${a.ref.id}`).toBeDefined();
        expect(w.sites.some((s) => s.id === a.siteId)).toBe(true);
      }
      expect(new Set(alerts.map((a) => a.id)).size).toBe(alerts.length);
      w = tick(w, 120);
    }
  });

  it("covers the seeded problems and sorts high severity first", () => {
    const alerts = deriveAlerts(generateWorld(42, TODAY));
    const types = new Set(alerts.map((a) => a.type));
    for (const t of ["COLD_EXCURSION", "COLD_WARNING", "LOT_EXPIRED", "LOT_EXPIRING", "TRUCK_DELAYED", "DOCK_BLOCKED", "FORKLIFT_BATTERY"]) {
      expect(types.has(t as never), t).toBe(true);
    }
    const ranks = alerts.map((a) => ({ high: 0, medium: 1, low: 2 })[a.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("explains every alert in at most two hedged sentences", () => {
    const w = generateWorld(42, TODAY);
    for (const a of deriveAlerts(w)) {
      const { text, nextStep } = explainAlert(a, w);
      expect(text.split(/(?<=\.)\s+/).length).toBeLessThanOrEqual(2);
      expect(/likely|possibl/i.test(text)).toBe(true);
      expect(nextStep.length).toBeGreaterThan(0);
    }
    for (const e of reconcile(w)) {
      const { text } = explainException(e);
      expect(text.split(/(?<=\.)\s+/).length).toBeLessThanOrEqual(2);
      expect(/likely|possibl/i.test(text)).toBe(true);
    }
  });
});

describe("kpis", () => {
  it("computes network and site KPIs in sensible ranges", () => {
    const w = generateWorld(42, TODAY);
    const exc = reconcile(w);
    const alerts = deriveAlerts(w);
    const k = computeKpis(w, exc, alerts);
    expect(k.orderCount).toBe(300);
    expect(k.onTimeDelivery).toBeGreaterThan(0.7);
    expect(k.onTimeDelivery).toBeLessThanOrEqual(1);
    expect(k.fillRate).toBeGreaterThan(0.9);
    expect(k.dockUtilization).toBeGreaterThan(0);
    expect(k.dockUtilization).toBeLessThanOrEqual(1);
    expect(k.avgDockDwellMinutes).toBeGreaterThan(0);
    expect(k.coldChainAlerts).toBeGreaterThanOrEqual(2);
    expect(k.dollarsAtRisk).toBeCloseTo(exc.reduce((a, e) => a + e.dollarImpact, 0), 2);

    const sites = (["NASH", "JCTY", "WEST"] as const).map((id) => computeKpis(w, exc, alerts, id));
    expect(sites.reduce((a, s) => a + s.orderCount, 0)).toBe(300);
    expect(sites.reduce((a, s) => a + s.dollarsAtRisk, 0)).toBeCloseTo(k.dollarsAtRisk, 2);
    expect(sites.reduce((a, s) => a + s.lotsExpiring30, 0)).toBe(k.lotsExpiring30);
  });
});
