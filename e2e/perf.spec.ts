import { expect, openApp, test, waitForScene } from "./fixtures";

// Use the real GPU when there is one (PERF_GPU=1); otherwise the default SwiftShader args apply.
if (process.env.PERF_GPU) test.use({ launchOptions: { args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"] } });

/**
 * Frame-time sampling for the network and site views. Logged, not asserted
 * tightly: in CI this runs on SwiftShader (CPU rendering), far slower than a phone GPU.
 */
test("3D frame time: network and site views", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Measured once, on the desktop project.");
  await openApp(page);
  await waitForScene(page);
  await page.getByTestId("speed-1").click();

  const measure = async (label: string) => {
    await page.evaluate(() => (window.__cctPerf = { samples: [] }));
    await page.waitForTimeout(6000);
    const s = await page.evaluate(() => window.__cctPerf?.samples.slice(5) ?? []);
    const calls = await page.evaluate(() => window.__cctPerf?.calls ?? 0);
    const sorted = [...s].sort((a, b) => a - b);
    const avg = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const line = `${label}: ${s.length} frames, avg ${avg.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, ${calls} draw calls`;
    info.annotations.push({ type: "frame-time", description: line });
    console.log(line);
    expect(s.length).toBeGreaterThan(2);
    return { avg, p95 };
  };

  await measure("network view");
  await page.getByRole("radio", { name: "Nashville" }).click();
  await page.waitForTimeout(1500);
  await measure("site view (Nashville)");
  await page.getByRole("button", { name: "Low graphics" }).click();
  await page.waitForTimeout(1000);
  await measure("site view, low graphics");
  await page.getByRole("radio", { name: "Network" }).click();
  await page.waitForTimeout(1500);
  await measure("network view, low graphics");
});
