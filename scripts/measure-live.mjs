// Headed performance probe for a deployed or local build.
// Usage: node scripts/measure-live.mjs <url> <outDir>
// Measures rAF frame intervals and main-thread long tasks in several scenarios,
// on desktop (real GPU) and a phone profile (390x844, 4x CPU throttle), and saves screenshots.
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [url = "https://revancecontroltower.netlify.app/", out = "live-shots"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: false, args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"] });

async function probe(page, label, ms = 5000) {
  const r = await page.evaluate(async (dur) => {
    const frames = [];
    const longTasks = [];
    const po = new PerformanceObserver((l) => l.getEntries().forEach((e) => longTasks.push(e.duration)));
    po.observe({ type: "longtask", buffered: false });
    let last = performance.now();
    const end = last + dur;
    await new Promise((res) => {
      const f = (t) => {
        frames.push(t - last);
        last = t;
        if (t < end) requestAnimationFrame(f);
        else res();
      };
      requestAnimationFrame(f);
    });
    po.disconnect();
    frames.shift();
    const s = [...frames].sort((a, b) => a - b);
    return {
      fps: frames.length / (dur / 1000),
      avg: frames.reduce((a, b) => a + b, 0) / frames.length,
      p95: s[Math.floor(s.length * 0.95)],
      max: s[s.length - 1],
      longTasks: longTasks.length,
      longTaskMs: Math.round(longTasks.reduce((a, b) => a + b, 0)),
    };
  }, ms);
  console.log(
    `${label.padEnd(42)} fps ${r.fps.toFixed(0).padStart(3)} | avg ${r.avg.toFixed(1).padStart(5)} ms | p95 ${r.p95.toFixed(1).padStart(6)} | max ${r.max.toFixed(0).padStart(5)} | long tasks ${r.longTasks} (${r.longTaskMs} ms)`,
  );
  return r;
}

async function run(name, ctxOpts, throttle) {
  console.log(`\n=== ${name} ===`);
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  if (throttle) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  }
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "load" });
  await page.getByTestId("headline").waitFor();
  const shell = Date.now() - t0;
  await page.locator("canvas").first().waitFor({ timeout: 30000 }).catch(() => {});
  console.log(`shell visible ${shell} ms, 3D canvas ${Date.now() - t0} ms`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/${name}-network.png` });

  await probe(page, "network, 1x");
  await page.getByTestId("speed-20").click();
  await probe(page, "network, 20x");
  await page.getByTestId("speed-1").click();

  const t1 = Date.now();
  await page.locator('[data-alert-id^="COLD_EXCURSION"]').first().click();
  await page.getByTestId("detail-title").waitFor();
  console.log(`alert click -> detail visible ${Date.now() - t1} ms`);
  await probe(page, "flying to alert + site view, 1x", 3000);
  await page.screenshot({ path: `${out}/${name}-alert.png` });
  await page.getByTestId("detail-close").click();
  await page.getByRole("radio", { name: "Nashville" }).click();
  await page.waitForTimeout(1500);
  await probe(page, "Nashville site view, 1x");
  await page.getByTestId("speed-20").click();
  await probe(page, "Nashville site view, 20x");
  await page.screenshot({ path: `${out}/${name}-site.png` });
  const low = page.getByRole("button", { name: "Low graphics" });
  if (await low.isVisible()) {
    await low.click();
    await page.waitForTimeout(800);
    await probe(page, "Nashville site view, 20x, low graphics");
    await low.click();
  }
  await page.getByTestId("tab-orders").click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/${name}-orders.png`, fullPage: name === "phone" });
  await page.getByTestId("tab-why").click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/${name}-why.png`, fullPage: name === "phone" });
  console.log(errors.length ? `console: ${errors.slice(0, 5).join(" | ")}` : "console: clean");
  await ctx.close();
}

await run("desktop", { viewport: { width: 1440, height: 900 } });
await run("phone", { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }, 4);
await browser.close();
