// Quick visual check: screenshots of a URL at phone, tablet and desktop sizes, plus console errors.
// Usage: node scripts/shoot.mjs <url> <outDir> [--headless] [--wait=ms] [--click=selector]
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [url = "http://localhost:5173/", outDir = "shots"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flag = (name) => process.argv.find((a) => a.startsWith(`--${name}`));
const wait = Number(flag("wait")?.split("=")[1] ?? 2500);
const clicks = process.argv.filter((a) => a.startsWith("--click=")).map((a) => a.slice(8));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: !!flag("headless"),
  slowMo: flag("headless") ? 0 : 50,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const targets = [
  ["phone", { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }],
  ["tablet", { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, hasTouch: true }],
  ["desktop", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
];
const only = flag("only")?.split("=")[1];
for (const [name, opts] of targets) {
  if (only && !only.split(",").includes(name)) continue;
  const ctx = await browser.newContext({ ...opts, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && logs.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(wait);
  for (const sel of clicks) {
    await page.locator(sel).first().click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: name === "phone" });
  console.log(`${name}: ${logs.length ? logs.join("\n  ") : "no console errors"}`);
  await ctx.close();
}
await browser.close();
