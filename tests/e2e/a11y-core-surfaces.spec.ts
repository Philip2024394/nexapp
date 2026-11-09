// tests/e2e/a11y-core-surfaces.spec.ts
//
// Automated WCAG 2.2 AA accessibility scans against NEX's public
// (unauthenticated) surfaces. Lives alongside the 62 existing Playwright
// specs; does not modify any founder-built UI. Adds the Accessibility
// grade gate from launch readiness audit § 2.5.
//
// Each test visits a public route in the sealed worldwide app, runs an
// axe-core scan, and fails on ANY critical/serious WCAG violation.
//
// Requires: `npm install` to pick up @axe-core/playwright (added to
// package.json devDependencies 2026-11-09).
//
// Invocation (dev-server-must-be-running on 3008 per existing convention):
//   npx playwright test tests/e2e/a11y-core-surfaces.spec.ts
//
// This file is intentionally NOT added to a playwright.config.ts project
// testMatch. That keeps the existing 62-spec test runs unchanged. Run
// this suite explicitly until the owner wires it into CI.

import { test } from "@playwright/test";
import { scanA11y } from "./_helpers/axe-scan";

const PUBLIC_ROUTES: Array<{ label: string; path: string }> = [
  { label: "root-splash", path: "/nex-native" },
  { label: "ireland-entry", path: "/nex-native/ireland-entry" },
  { label: "sign-in", path: "/nex-native/sign-in" },
  { label: "directory-landing", path: "/nex-native/directory" },
  { label: "chat-themes-library", path: "/nex-native/chat-themes-library" },
  { label: "privacy", path: "/nex-native/privacy" },
  { label: "terms", path: "/nex-native/terms" },
  { label: "help", path: "/nex-native/help" },
  { label: "support", path: "/nex-native/support" },
];

for (const { label, path } of PUBLIC_ROUTES) {
  test(`a11y · ${label} · ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    await scanA11y(page, { routeLabel: label });
  });
}
