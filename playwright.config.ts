import { defineConfig, devices } from "@playwright/test";

/*
 * End-to-end tests run against the production build (vite preview).
 * `npm run e2e` runs headed with slowMo so you can watch; `npm run e2e:ci` is headless.
 * SwiftShader flags make WebGL work on machines without a GPU.
 */
const slowMo = Number(process.env.PW_SLOWMO ?? 0);
const webgl = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { args: webgl, slowMo },
    reducedMotion: "no-preference",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
    { name: "tablet", use: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, hasTouch: true } },
    {
      name: "phone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 },
    },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD
      ? `npx vite preview --port ${PORT} --strictPort`
      : `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
