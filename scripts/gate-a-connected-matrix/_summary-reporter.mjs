// scripts/gate-a-connected-matrix/_summary-reporter.mjs
//
// Gate A §16.48.18 · Summary reporter helper (OFFLINE PURE).
//
// HARD INVARIANTS
// ───────────────
// · Pure function. No filesystem reads/writes. No process.env reads.
//   No network, no Supabase, no pg, no spawn.
// · Mutates the provided `results` object in place; no return value.
// · Walks `results.entries` which is an array of
//     { file, type, verdict, reason, ... }
//   objects previously produced by the runner's appendResult().
// · Re-classifies any entry whose `reason` STARTS WITH the exact string
//   "GATE_A_SKIP_CLEANUP=1" to verdict "SKIPPED_BY_DESIGN". These entries
//   do NOT count toward FAIL or BLOCKED.
// · Writes results.summary = {
//     counts_by_verdict: { PASS, FAIL, BLOCKED, SKIPPED_BY_DESIGN },
//     overall_verdict: "PASS" | "BLOCKED" | "FAIL",
//     cleanup_skipped_by_design: boolean,
//   }
// · All four counts keys are always present (zero when absent).
// · Idempotent: a second call produces an identical summary and does not
//   double-reclassify.
// · Safe when results.entries is undefined, null, or [].
//
// This module is loaded dynamically by _runner.mjs behind a try/catch.
// When absent, the runner proceeds silently. Do NOT make this module
// depend on anything the runner cannot provide offline.

const SKIP_CLEANUP_PREFIX = "GATE_A_SKIP_CLEANUP=1";

export function finaliseSummary(results) {
  if (results == null || typeof results !== "object") {
    return;
  }

  const entries = Array.isArray(results.entries) ? results.entries : [];

  const counts_by_verdict = {
    PASS: 0,
    FAIL: 0,
    BLOCKED: 0,
    SKIPPED_BY_DESIGN: 0,
  };

  let cleanup_skipped_by_design = false;

  for (const entry of entries) {
    if (entry == null || typeof entry !== "object") {
      continue;
    }

    const reason = typeof entry.reason === "string" ? entry.reason : "";
    const startsWithSkip = reason.startsWith(SKIP_CLEANUP_PREFIX);

    if (startsWithSkip) {
      // Reclassify in place. Idempotent because we always set to the
      // same target verdict regardless of prior state.
      entry.verdict = "SKIPPED_BY_DESIGN";
      cleanup_skipped_by_design = true;
    }

    const verdict = entry.verdict;
    if (verdict === "PASS") {
      counts_by_verdict.PASS += 1;
    } else if (verdict === "FAIL") {
      counts_by_verdict.FAIL += 1;
    } else if (verdict === "BLOCKED") {
      counts_by_verdict.BLOCKED += 1;
    } else if (verdict === "SKIPPED_BY_DESIGN") {
      counts_by_verdict.SKIPPED_BY_DESIGN += 1;
    }
    // Any other verdict value is intentionally ignored for counting
    // (defensive — the runner's appendResult should not emit others).
  }

  let overall_verdict;
  if (counts_by_verdict.FAIL === 0 && counts_by_verdict.BLOCKED === 0) {
    overall_verdict = "PASS";
  } else if (counts_by_verdict.FAIL === 0 && counts_by_verdict.BLOCKED > 0) {
    overall_verdict = "BLOCKED";
  } else {
    overall_verdict = "FAIL";
  }

  results.summary = {
    counts_by_verdict,
    overall_verdict,
    cleanup_skipped_by_design,
  };
}
