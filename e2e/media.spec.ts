import { mkdirSync, renameSync } from "node:fs";
import { expect, openApp, test, waitForScene } from "./fixtures";

/**
 * Generates docs/screenshots and docs/demo.webm. Only runs with MEDIA=1
 * (npm run e2e:media), so the normal suite stays fast.
 */
test.skip(!process.env.MEDIA, "Set MEDIA=1 to regenerate screenshots and the demo video.");
test.describe.configure({ mode: "serial" });

const dir = "docs/screenshots";

test("screenshots", async ({ page }, info) => {
  mkdirSync(dir, { recursive: true });
  const tag = info.project.name;
  await openApp(page, "speed=1");
  await page.getByTestId("speed-1").click();
  await waitForScene(page);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${dir}/${tag}-network.png` });

  await page.getByRole("radio", { name: "Nashville" }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${dir}/${tag}-site.png` });

  await page.locator('[data-alert-id="COLD_EXCURSION:TRK-113"]').click();
  await expect(page.getByTestId("detail-title")).toHaveText("TRK-113");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${dir}/${tag}-alert-detail.png` });
  await page.getByTestId("detail-close").click();

  await page.getByTestId("tab-orders").click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/${tag}-orders.png`, fullPage: tag === "phone" });
  await page.locator('[data-testid="order-row"]:visible, [data-testid="order-card"]:visible').first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/${tag}-order-drawer.png` });
  await page.keyboard.press("Escape");

  await page.getByTestId("tab-lots").click();
  await page.locator('[data-testid="lot-row"][data-status="critical"]').first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${dir}/${tag}-lots.png`, fullPage: tag === "phone" });
});

test("demo video", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "One demo video, recorded at desktop size.");
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: "test-results/video", size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  await page.goto("/?perf=off");
  await expect(page.getByTestId("headline")).toBeVisible();
  await page.waitForTimeout(4000);
  await page.locator('[data-alert-id="COLD_EXCURSION:TRK-113"]').click();
  await page.waitForTimeout(4500);
  await page.getByTestId("detail-close").click();
  await page.getByTestId("tab-lots").click();
  await page.waitForTimeout(800);
  await page.locator('[data-testid="lot-row"][data-status="critical"]').first().click();
  await page.waitForTimeout(4500);
  await page.getByTestId("tab-orders").click();
  await page.waitForTimeout(1200);
  await page.locator('[data-testid="order-row"]').first().click();
  await page.waitForTimeout(4500);
  await page.keyboard.press("Escape");
  await page.getByRole("radio", { name: "Network" }).click();
  await page.waitForTimeout(3000);
  const video = page.video();
  await context.close();
  mkdirSync("docs", { recursive: true });
  const path = await video!.path();
  renameSync(path, "docs/demo.webm");
});
