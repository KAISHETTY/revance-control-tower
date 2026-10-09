import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { distinctColors, expect, isPhone, openApp, projectObject, test, waitForScene } from "./fixtures";

test.describe("Revance Control Tower (unofficial prototype)", () => {
  test("1. loads cleanly with the synthetic-data banner", async ({ page }) => {
    await openApp(page);
    await expect(
      page.getByText("Unofficial prototype. Not affiliated with or endorsed by Revance. Synthetic data. Not connected to any real system."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Revance Control Tower" })).toBeVisible();
    await expect(page.getByTestId("headline")).toContainText("Across Nashville, Johnson City and Newark");
    await expect(page.getByTestId("kpi-risk-value")).toHaveText(/^\$[\d.]+[KM]?$/);
  });

  test("2. network view renders a non-blank 3D canvas", async ({ page }) => {
    await openApp(page);
    await waitForScene(page);
    await expect(page.getByTestId("render-mode")).toHaveText("3D");
    const shot = await page.getByTestId("scene-canvas").screenshot();
    expect(await distinctColors(page, shot)).toBeGreaterThan(40);
  });

  test("3. clicking an alert flies the camera and opens the right detail", async ({ page }) => {
    await openApp(page);
    await waitForScene(page);
    const before = await projectObject(page, "truck", "TRK-113");
    await page.locator('[data-alert-id="COLD_EXCURSION:TRK-113"]').click();
    await expect(page.getByTestId("detail-title")).toHaveText("TRK-113");
    await expect(page.getByTestId("breadcrumb-site")).toHaveText("Newark");
    await expect(page.getByTestId("explanation").first()).toContainText("likely");
    await page.waitForTimeout(1800);
    const after = await projectObject(page, "truck", "TRK-113");
    const box = (await page.getByTestId("scene-canvas").boundingBox())!;
    expect(after).not.toBeNull();
    expect(after!.x).toBeGreaterThan(box.x);
    expect(after!.x).toBeLessThan(box.x + box.width);
    expect(after!.y).toBeGreaterThan(box.y);
    expect(after!.y).toBeLessThan(box.y + box.height);
    expect(Math.hypot(after!.x - before!.x, after!.y - before!.y)).toBeGreaterThan(20);
  });

  test("4. clicking a reefer truck in 3D shows temperature and shipment", async ({ page }) => {
    await openApp(page);
    await waitForScene(page);
    await page.getByRole("radio", { name: "Newark" }).click();
    await page.waitForTimeout(1800);
    const p = await projectObject(page, "truck", "TRK-113");
    expect(p).not.toBeNull();
    await page.mouse.click(p!.x, p!.y);
    await expect(page.getByTestId("detail-title")).toHaveText("TRK-113");
    await expect(page.getByTestId("truck-temp")).toContainText("°C");
    await expect(page.getByTestId("truck-temp")).toContainText("Excursion");
    await expect(page.getByTestId("truck-shipment")).toContainText("SH-");
  });

  test("5. switching sites updates KPIs", async ({ page }) => {
    await openApp(page);
    const network = await page.getByTestId("kpi-risk-value").textContent();
    const seen = new Set([network]);
    for (const [name, crumb] of [
      ["Nashville", "Nashville"],
      ["Johnson City", "Johnson City"],
      ["Newark", "Newark"],
    ]) {
      await page.getByRole("radio", { name }).click();
      await expect(page.getByTestId("breadcrumb-site")).toHaveText(crumb);
      await expect(page.getByTestId("headline")).toContainText(`At ${crumb}`);
      seen.add(await page.getByTestId("kpi-risk-value").textContent());
    }
    expect(seen.size).toBe(4);
    await page.getByRole("radio", { name: "Network" }).click();
    await expect(page.getByTestId("kpi-risk-value")).toHaveText(network!);
  });

  test("6. speed controls move simulated time; same seed gives same state", async ({ page, browser }) => {
    await openApp(page);
    const clock = page.getByTestId("sim-clock");
    const t0 = await clock.textContent();
    await page.waitForTimeout(1200);
    expect(await clock.textContent()).toBe(t0);
    await page.getByTestId("speed-20").click();
    await expect(clock).not.toHaveText(t0!);
    await page.getByTestId("speed-0").click();
    const t1 = await clock.textContent();
    await page.waitForTimeout(1200);
    expect(await clock.textContent()).toBe(t1);
    await page.getByTestId("speed-1").click();
    await expect(clock).not.toHaveText(t1!);

    const snapshotAfter = async (seed: number) => {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await p.goto(`/?speed=0&perf=off&seed=${seed}&webgl=0`);
      await p.waitForFunction(() => !!window.__cct);
      const snap = await p.evaluate(() => {
        window.__cct!.advance(400);
        return window.__cct!.snapshot();
      });
      await ctx.close();
      return snap;
    };
    const a = await snapshotAfter(42);
    const b = await snapshotAfter(42);
    const c = await snapshotAfter(7);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  test("7. orders panel: filters, search, sort, drawer, CSV export", async ({ page }) => {
    await openApp(page, "webgl=0");
    await page.getByTestId("tab-orders").click();
    const rows = page.locator('[data-testid="order-row"]:visible, [data-testid="order-card"]:visible');
    await expect(rows.first()).toBeVisible();
    const total = await rows.count();
    expect(total).toBeGreaterThan(50);

    await page.getByTestId("filter-type").selectOption("PRICE_MISMATCH");
    await expect(rows.first()).toContainText("Price mismatch");
    const priceCount = await rows.count();
    expect(priceCount).toBeLessThan(total);
    await page.getByTestId("filter-type").selectOption("all");

    await page.getByTestId("filter-severity").selectOption("high");
    for (const r of await rows.all()) await expect(r).toContainText("High");
    await page.getByTestId("filter-severity").selectOption("all");

    await page.getByTestId("filter-min").fill("99999999");
    await expect(page.getByText("No exceptions match these filters.")).toBeVisible();
    await page.getByTestId("filter-min").fill("");

    const firstId = (await rows.first().locator(".font-mono").first().textContent())!.trim();
    await page.getByTestId("orders-search").fill(firstId);
    await expect(rows.first()).toContainText(firstId);
    expect(await rows.count()).toBeLessThanOrEqual(3);
    await page.getByTestId("orders-search").fill("");

    if (!isPhone(page)) {
      await page.getByTestId("sort-dollarImpact").click();
      const impacts = await page.getByTestId("row-impact").allTextContents();
      const toNum = (s: string) => {
        const n = parseFloat(s.replace(/[$,KM]/g, ""));
        return s.includes("M") ? n * 1e6 : s.includes("K") ? n * 1e3 : n;
      };
      expect(toNum(impacts[0])).toBeGreaterThanOrEqual(toNum(impacts[1]));
      expect(toNum(impacts[1])).toBeGreaterThanOrEqual(toNum(impacts[impacts.length - 1]));
    }

    await rows.first().click();
    const drawer = page.getByTestId("order-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("three-way")).toContainText("Sales side (Salesforce / field CRM)");
    await expect(drawer).toContainText("Next step");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-csv").click()]);
    const csv = readFileSync((await download.path())!, "utf8");
    const lines = csv.trim().split("\n");
    expect(lines[0]).toContain("order_id,exception_type");
    expect(lines.length).toBe(total + 1);
  });

  test("8. lots panel: clicking an expiring lot flies to its bay", async ({ page }) => {
    await openApp(page);
    await waitForScene(page);
    await page.getByTestId("tab-lots").click();
    const lot = page.locator('[data-testid="lot-row"][data-status="critical"]').first();
    const lotId = await lot.getAttribute("data-lot");
    await lot.click();
    await expect(page.getByTestId("detail-title")).toHaveText(`Lot ${lotId}`);
    const bayId = await page.evaluate((id) => {
      for (const s of window.__cct!.state().world.sites) for (const b of s.bays) if (b.lots.some((l) => l.lotId === id)) return b.id;
      return null;
    }, lotId);
    expect(bayId).not.toBeNull();
    await page.waitForTimeout(1800);
    const p = await projectObject(page, "bay", bayId!);
    const box = (await page.getByTestId("scene-canvas").boundingBox())!;
    expect(p!.x).toBeGreaterThan(box.x);
    expect(p!.x).toBeLessThan(box.x + box.width);
    expect(p!.y).toBeGreaterThan(box.y);
    expect(p!.y).toBeLessThan(box.y + box.height);
  });

  test("9. 3D/2D toggle, and automatic 2D fallback without WebGL", async ({ page }) => {
    await openApp(page);
    await waitForScene(page);
    await page.getByTestId("toggle-2d").click();
    await expect(page.getByTestId("fallback-2d")).toBeVisible();
    await expect(page.getByTestId("render-mode")).toHaveText("2D map");
    await page.getByTestId("obj-truck-TRK-113").click();
    await expect(page.getByTestId("detail-title")).toHaveText("TRK-113");
    await page.getByTestId("toggle-2d").click();
    await expect(page.getByTestId("scene-canvas")).toBeVisible();

    await page.goto("/?speed=0&perf=off&webgl=0");
    await expect(page.getByTestId("fallback-2d")).toBeVisible();
    await expect(page.getByTestId("scene-canvas")).toHaveCount(0);
    await expect(page.getByTestId("toggle-2d")).toBeDisabled();
    await page.getByTestId("obj-site-NWK").click();
    await expect(page.getByTestId("breadcrumb-site")).toHaveText("Newark");
    await page.getByTestId("obj-coldRoom-NWK-CR1").click();
    await expect(page.getByTestId("detail-title")).toHaveText("Temp-controlled room 1");
    await expect(page.getByTestId("room-temp")).toContainText("°C");
  });

  test("10. regenerating the world changes the data", async ({ page }) => {
    await openApp(page, "webgl=0");
    const seedBefore = await page.evaluate(() => window.__cct!.state().world.seed);
    const ordersBefore = await page.evaluate(() => JSON.stringify(window.__cct!.state().world.orders.slice(0, 5)));
    const headlineBefore = await page.getByTestId("headline").textContent();
    await page.getByTestId("regenerate").click();
    await expect.poll(() => page.evaluate(() => window.__cct!.state().world.seed)).toBe(seedBefore + 1);
    const ordersAfter = await page.evaluate(() => JSON.stringify(window.__cct!.state().world.orders.slice(0, 5)));
    expect(ordersAfter).not.toBe(ordersBefore);
    await expect(page.getByTestId("headline")).not.toHaveText(headlineBefore!);
  });

  test("11. command palette jumps to objects", async ({ page }) => {
    test.skip(isPhone(page), "Keyboard shortcut is a desktop feature; the button is covered on all sizes.");
    await openApp(page, "webgl=0");
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder(/Jump to a site/).fill("TRK-113");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("detail-title")).toHaveText("TRK-113");
  });

  test("12. accessibility: no serious or critical axe violations on any tab", async ({ page }) => {
    test.setTimeout(240_000);
    await openApp(page, "webgl=0");
    for (const tab of ["alerts", "orders", "lots", "why", "how"]) {
      await page.getByTestId(`tab-${tab}`).click();
      await page.waitForTimeout(300);
      const results = await new AxeBuilder({ page }).analyze();
      const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(
        bad.map((v) => `${tab}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(" ")}`),
        `axe on ${tab}`,
      ).toEqual([]);
    }
    await page.locator('[data-testid="tab-alerts"]').click();
    await page.locator('[data-testid="alert-row"]').first().click();
    const detail = await new AxeBuilder({ page }).include('[data-testid="detail-panel"]').analyze();
    expect(detail.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  });
});

test("13. unofficial labeling, public-source tags and the Why tab", async ({ page }) => {
  await openApp(page, "webgl=0");
  await expect(page.getByText("Unofficial prototype built from public information")).toBeVisible();
  await page.getByTestId("tab-why").click();
  const why = page.getByTestId("why-this");
  await expect(why).toContainText("What I read in your public priorities");
  await expect(why.getByText("From public sources")).toHaveCount(5);
  await expect(why).toContainText("Which of your products are actually temperature-controlled in transit?");
  await page.getByTestId("tab-orders").click();
  await expect(page.getByText(/System names reflect a public Revance job posting/).first()).toBeVisible();
});
