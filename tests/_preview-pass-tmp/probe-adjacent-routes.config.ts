import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./",
  testMatch: /probe-adjacent-routes\.spec\.ts$/,
  timeout: 60000,
  retries: 0,
  workers: 1,
  reporter: [["line"]],
  use: {
    ...devices["Desktop Chrome"],
    headless: true,
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
});
