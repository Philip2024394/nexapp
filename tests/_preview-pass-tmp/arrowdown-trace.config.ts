import { defineConfig, devices } from "@playwright/test";
export default defineConfig({ testDir: "./", testMatch: /arrowdown-trace\.spec\.ts$/, timeout: 30000, retries: 0, workers: 1, reporter: [["line"]], use: { ...devices["Pixel 7"], baseURL: "http://localhost:3008", headless: true, actionTimeout: 10000, navigationTimeout: 30000 } });
