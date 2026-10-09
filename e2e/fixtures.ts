import { test as base, expect, type Page } from "@playwright/test";

/** Every test fails if the page logs a console error or warning, or throws. */
export const test = base.extend<{ consoleProblems: string[] }>({
  consoleProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
      });
      page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
      await use(problems);
      expect(problems, "console errors or warnings").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Open the app paused (deterministic) with the slow-device check disabled for software GPUs. */
export async function openApp(page: Page, params = "") {
  await page.goto(`/?speed=0&perf=off${params ? `&${params}` : ""}`);
  await expect(page.getByTestId("headline")).toBeVisible();
}

export async function waitForScene(page: Page) {
  await expect(page.getByTestId("scene-canvas").locator("canvas")).toBeVisible();
  await page.waitForFunction(() => !!window.__cctScene);
  // Let the first frames render and the camera settle.
  await page.waitForTimeout(1500);
}

/** Count distinct colors in an element screenshot, decoded in the browser (no extra deps). */
export async function distinctColors(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set<number>();
    for (let i = 0; i < data.length; i += 4 * 37) seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    return seen.size;
  }, png.toString("base64"));
}

export async function projectObject(page: Page, kind: string, id: string) {
  return page.evaluate(([k, i]) => window.__cctScene?.project(k as never, i) ?? null, [kind, id] as const);
}

export function isPhone(page: Page) {
  return (page.viewportSize()?.width ?? 1440) < 640;
}

export function isDesktop(page: Page) {
  return (page.viewportSize()?.width ?? 1440) >= 1024;
}
