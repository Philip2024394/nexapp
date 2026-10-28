import { defineConfig, devices } from "@playwright/test";
export default defineConfig({ testDir: "./", testMatch: /footer-width-avatar\.spec\.ts$/, timeout: 30000, retries: 0, workers: 1, reporter: [["line"]], use: { ...devices["Desktop Chrome"], headless: true, actionTimeout: 10000, navigationTimeout: 30000 } });
