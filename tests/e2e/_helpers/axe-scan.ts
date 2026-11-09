// tests/e2e/_helpers/axe-scan.ts
//
// Shared axe-core scan helper for Playwright. Wraps @axe-core/playwright so
// the assertion contract is the same across the a11y spec suite.
//
// Usage:
//   await scanA11y(page, {
//     routeLabel: "directory-landing",
//     allowList: [], // rule IDs to tolerate (none by default)
//   });
//
// Blocking rule set: WCAG 2.2 Level AA. Includes 'wcag2a', 'wcag2aa',
// 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice' when
// `strict:true`.

import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export interface A11yScanOptions {
  /** Label used in assertion error messages for triage. */
  routeLabel: string;
  /** Axe rule IDs to treat as warnings only · default empty. */
  allowList?: readonly string[];
  /** When true · include best-practice rules. Default false (AA only). */
  strict?: boolean;
}

export async function scanA11y(
  page: Page,
  options: A11yScanOptions,
): Promise<void> {
  const tags = options.strict
    ? ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]
    : ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

  const builder = new AxeBuilder({ page }).withTags(tags);
  if (options.allowList && options.allowList.length > 0) {
    builder.disableRules([...options.allowList]);
  }

  const results = await builder.analyze();

  const critical = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );

  const summary = critical
    .map((v) => `  · [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`)
    .join("\n");

  expect(
    critical,
    `Accessibility · ${options.routeLabel} · ${critical.length} critical/serious WCAG violation${critical.length === 1 ? "" : "s"}:\n${summary}`,
  ).toHaveLength(0);
}
