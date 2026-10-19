// scripts/nex-themes/validate-theme.mjs
//
// NEX Theme Production · Phase A2 · validation report builder.
// --------------------------------------------------------------------------
// Owner-authorised 2026-10-19. Isolated from production rendering.
//
// Honesty invariants:
//   · This file does NOT certify a theme as production-ready. The real
//     quality gates (WCAG AA contrast, bubble legibility, wallpaper
//     conflict, intro-chat consistency, Playwright screenshots) are
//     Phase A3 work. In A2 these gates are explicitly labelled
//     "pending" so the generated report never lies about status.
//   · The report emits `productionReady: false` with an explicit reason
//     for every A2 run · a passing report in A2 is a design error, not
//     a legitimate outcome.
//
// Public API:
//   buildValidationReport({ inputs, extraction, tokens, generation })
//     → report object

export const PENDING_GATES = [
  {
    id: "contrastWCAG_AA",
    purpose: "WCAG AA contrast ratio check on bubble text, timestamps, composer text, send-glyph on accent",
  },
  {
    id: "bubbleLegibility",
    purpose: "Measure incoming + outgoing bubble legibility against wallpaper + background",
  },
  {
    id: "wallpaperConflict",
    purpose: "Detect wallpaper regions that visually conflict with bubble/composer placement",
  },
  {
    id: "introChatConsistency",
    purpose: "Check that intro palette matches derived chat palette (±tolerance) so the transition is cohesive",
  },
  {
    id: "playwrightScreenshot",
    purpose: "Render the theme at 390 / 768 / 1280 and compare to a reviewer-approved baseline",
  },
];

export function buildValidationReport({ inputs, extraction, tokens, generation, gateResults }) {
  // Phase A3 · when gateResults is supplied, mirror the real results.
  // When not supplied (older call sites), fall back to A2's all-pending shape.
  const validation = gateResults
    ? Object.fromEntries(
        Object.entries(gateResults.gates).map(([id, gate]) => [
          id,
          {
            status: gate.status,
            phase: "A3",
            reason: gate.reason,
            measurements: gate.measurements,
          },
        ]),
      )
    : Object.fromEntries(
        PENDING_GATES.map((g) => [
          g.id,
          { status: "pending", phase: "A3", purpose: g.purpose },
        ]),
      );

  // Human visual review is a REQUIRED gate that cannot be automated.
  // Mark it pending in A3 so the report never silently implies that
  // real-chrome legibility has been reviewed.
  validation.humanVisualReview = {
    status: "pending",
    phase: "human",
    reason: "Awaiting manual review of Playwright screenshots at tests/e2e-screenshots-themes/<slug>/*",
  };

  const summary = gateResults?.summary ?? null;

  return {
    version: gateResults ? "a3.0" : "a2.0",
    generatedAt: new Date().toISOString(),
    inputs,
    extraction,
    derivedTokens: tokens,
    generation,
    validation,
    summary,
    productionReady: false,
    productionReadyReason: gateResults
      ? "Automated gates run. Production readiness ALSO requires human visual review of the Playwright screenshots. Automated contrast/legibility math is necessary, not sufficient."
      : "Phase A2 generates a theme package but does not run quality gates. All validation gates are pending Phase A3 implementation. Do not deploy or register this theme until A3 passes.",
  };
}

/** Pretty-print a report to the console. Returns the printed lines so
 *  the orchestrator can also write them to the report file. */
// eslint-disable-next-line complexity -- single report formatter, intentional
export function formatReportForConsole(report) {
  const lines = [];
  lines.push("");
  lines.push("─────────────────────────────────────────────────────");
  lines.push(`NEX Theme Production · Phase ${report.version.startsWith("a3") ? "A3" : "A2"} · Report`);
  lines.push("─────────────────────────────────────────────────────");
  lines.push("");
  lines.push(`Theme name   · ${report.inputs.name}`);
  lines.push(`Slug         · ${report.generation.slug}`);
  lines.push(`Category     · ${report.inputs.category}`);
  lines.push(`Intro path   · ${report.inputs.introPath}`);
  lines.push(`Wallpaper    · ${report.inputs.wallpaperPath}`);
  lines.push(`Accent override · ${report.inputs.accentOverride ?? "(none)"}`);
  lines.push("");
  lines.push("Extraction:");
  lines.push(`  Algorithm       · ${report.extraction.algorithm}`);
  lines.push(`  Intro sampled   · ${report.extraction.introSampled ? "yes" : "no"}`);
  lines.push(`  Wallpaper sampled · ${report.extraction.wallpaperSampled ? "yes" : "no"}`);
  lines.push(`  Dominant colours · ${report.extraction.dominantColours.length} total`);
  for (const c of report.extraction.dominantColours.slice(0, 5)) {
    lines.push(`    ${c.hex} · weight ${c.weight}`);
  }
  lines.push("");
  lines.push("Derived tokens (18 fields · provenance: " + report.derivedTokens.source + "):");
  for (const [key, val] of Object.entries(report.derivedTokens)) {
    if (key === "source") continue;
    lines.push(`  ${key.padEnd(18)} · ${val}`);
  }
  lines.push("");
  lines.push("Package generation:");
  lines.push(`  Status  · ${report.generation.status}`);
  lines.push(`  Path    · ${report.generation.packagePath}`);
  lines.push(`  Size    · ${report.generation.bytes} bytes`);
  lines.push("");
  lines.push("Validation gates:");
  for (const [id, gate] of Object.entries(report.validation)) {
    const icon = gate.status === "pass" ? "✓" : gate.status === "warn" ? "⚠" : gate.status === "fail" ? "✗" : "·";
    lines.push(`  ${icon} ${id.padEnd(25)} · ${gate.status.toUpperCase()}${gate.reason ? "  (" + gate.reason + ")" : ""}`);
  }
  lines.push("");
  if (report.summary) {
    lines.push(`Summary · ${report.summary.pass ?? 0} pass · ${report.summary.warn ?? 0} warn · ${report.summary.fail ?? 0} fail`);
    lines.push("");
  }
  lines.push(`Production ready · ${report.productionReady ? "YES" : "NO"}`);
  lines.push(`Reason           · ${report.productionReadyReason}`);
  lines.push("");
  lines.push("─────────────────────────────────────────────────────");
  lines.push("");
  return lines.join("\n");
}
