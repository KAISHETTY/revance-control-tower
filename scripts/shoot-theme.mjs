// Screenshot the app in the light theme (and optionally Nashville site view) for a visual check.
// Usage: node scripts/shoot-theme.mjs <baseUrl> <outFile>
import { chromium } from "@playwright/test";

const [base = "http://localhost:4173", out = "light.png"] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem("cct-theme", "light"));
const page = await ctx.newPage();
const problems = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && problems.push(m.text()));
await page.goto(`${base}/?speed=0&perf=off`);
await page.waitForTimeout(3000);
await page.getByRole("radio", { name: "Nashville" }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: out });
console.log(problems.length ? problems.join("\n") : "no console errors");
await browser.close();
