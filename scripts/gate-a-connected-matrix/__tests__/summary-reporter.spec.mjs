// scripts/gate-a-connected-matrix/__tests__/summary-reporter.spec.mjs
//
// Gate A §16.48.18 · Offline unit tests for _summary-reporter.mjs.
// Pure in-memory fixtures. No filesystem, no network, no env reads.

import { describe, it, expect } from "vitest";
import { finaliseSummary } from "../_summary-reporter.mjs";

function mkEntry(verdict, reason = "") {
  return { file: "x.mjs", type: "verifier", verdict, reason };
}

describe("finaliseSummary — happy paths", () => {
  it("counts all-PASS entries and reports overall PASS", () => {
    const results = {
      entries: [mkEntry("PASS"), mkEntry("PASS"), mkEntry("PASS")],
    };
    finaliseSummary(results);
    expect(results.summary.counts_by_verdict).toEqual({
      PASS: 3,
      FAIL: 0,
      BLOCKED: 0,
      SKIPPED_BY_DESIGN: 0,
    });
    expect(results.summary.overall_verdict).toBe("PASS");
    expect(results.summary.cleanup_skipped_by_design).toBe(false);
  });

  it("classifies mixed PASS + BLOCKED (no skip) as overall BLOCKED", () => {
    const results = {
      entries: [
        mkEntry("PASS"),
        mkEntry("BLOCKED", "pg client not available"),
        mkEntry("PASS"),
      ],
    };
    finaliseSummary(results);
    expect(results.summary.counts_by_verdict.PASS).toBe(2);
    expect(results.summary.counts_by_verdict.BLOCKED).toBe(1);
    expect(results.summary.counts_by_verdict.FAIL).toBe(0);
    expect(results.summary.overall_verdict).toBe("BLOCKED");
    expect(results.summary.cleanup_skipped_by_design).toBe(false);
  });

  it("classifies mixed PASS + FAIL as overall FAIL", () => {
    const results = {
      entries: [
        mkEntry("PASS"),
        mkEntry("FAIL", "assertion mismatch"),
        mkEntry("PASS"),
      ],
    };
    finaliseSummary(results);
    expect(results.summary.counts_by_verdict.FAIL).toBe(1);
    expect(results.summary.overall_verdict).toBe("FAIL");
  });
});

describe("finaliseSummary — SKIPPED_BY_DESIGN reclassification", () => {
  it("reclassifies a BLOCKED entry whose reason starts with GATE_A_SKIP_CLEANUP=1", () => {
    const skipEntry = mkEntry(
      "BLOCKED",
      "GATE_A_SKIP_CLEANUP=1 — cleanup refused in this run",
    );
    const results = {
      entries: [mkEntry("PASS"), mkEntry("PASS"), skipEntry],
    };
    finaliseSummary(results);
    expect(skipEntry.verdict).toBe("SKIPPED_BY_DESIGN");
    expect(results.summary.counts_by_verdict.SKIPPED_BY_DESIGN).toBe(1);
    expect(results.summary.counts_by_verdict.BLOCKED).toBe(0);
    expect(results.summary.overall_verdict).toBe("PASS");
    expect(results.summary.cleanup_skipped_by_design).toBe(true);
  });

  it("reclassifies even when reason has only the prefix with extra text", () => {
    const skipEntry = mkEntry(
      "BLOCKED",
      "GATE_A_SKIP_CLEANUP=1 and some trailing operator notes here",
    );
    const results = { entries: [skipEntry] };
    finaliseSummary(results);
    expect(skipEntry.verdict).toBe("SKIPPED_BY_DESIGN");
    expect(results.summary.cleanup_skipped_by_design).toBe(true);
  });

  it("does NOT reclassify when prefix appears mid-string", () => {
    const notSkip = mkEntry(
      "BLOCKED",
      "operator says GATE_A_SKIP_CLEANUP=1 was set but reason is other",
    );
    const results = { entries: [notSkip] };
    finaliseSummary(results);
    expect(notSkip.verdict).toBe("BLOCKED");
    expect(results.summary.counts_by_verdict.BLOCKED).toBe(1);
    expect(results.summary.counts_by_verdict.SKIPPED_BY_DESIGN).toBe(0);
    expect(results.summary.cleanup_skipped_by_design).toBe(false);
    expect(results.summary.overall_verdict).toBe("BLOCKED");
  });

  it("counts multiple SKIPPED_BY_DESIGN entries correctly", () => {
    const results = {
      entries: [
        mkEntry("BLOCKED", "GATE_A_SKIP_CLEANUP=1 run A"),
        mkEntry("BLOCKED", "GATE_A_SKIP_CLEANUP=1 run B"),
        mkEntry("BLOCKED", "GATE_A_SKIP_CLEANUP=1 run C"),
        mkEntry("PASS"),
      ],
    };
    finaliseSummary(results);
    expect(results.summary.counts_by_verdict.SKIPPED_BY_DESIGN).toBe(3);
    expect(results.summary.counts_by_verdict.BLOCKED).toBe(0);
    expect(results.summary.counts_by_verdict.PASS).toBe(1);
    expect(results.summary.overall_verdict).toBe("PASS");
    expect(results.summary.cleanup_skipped_by_design).toBe(true);
  });

  it("SKIPPED_BY_DESIGN does NOT lower an otherwise-PASS verdict", () => {
    const results = {
      entries: [
        mkEntry("PASS"),
        mkEntry("BLOCKED", "GATE_A_SKIP_CLEANUP=1"),
        mkEntry("PASS"),
      ],
    };
    finaliseSummary(results);
    expect(results.summary.overall_verdict).toBe("PASS");
  });

  it("FAIL entries mixed with SKIPPED_BY_DESIGN → overall FAIL", () => {
    const results = {
      entries: [
        mkEntry("PASS"),
        mkEntry("FAIL", "got 500 expected 200"),
        mkEntry("BLOCKED", "GATE_A_SKIP_CLEANUP=1"),
      ],
    };
    finaliseSummary(results);
    expect(results.summary.counts_by_verdict.FAIL).toBe(1);
    expect(results.summary.counts_by_verdict.SKIPPED_BY_DESIGN).toBe(1);
    expect(results.summary.overall_verdict).toBe("FAIL");
    expect(results.summary.cleanup_skipped_by_design).toBe(true);
  });
});

describe("finaliseSummary — idempotency", () => {
  it("calling twice produces a structurally equal summary", () => {
    const results = {
      entries: [
        mkEntry("PASS"),
        mkEntry("BLOCKED", "GATE_A_SKIP_CLEANUP=1"),
        mkEntry("FAIL", "bad"),
      ],
    };
    finaliseSummary(results);
    const firstSummary = JSON.parse(JSON.stringify(results.summary));
    finaliseSummary(results);
    const secondSummary = JSON.parse(JSON.stringify(results.summary));
    expect(secondSummary).toEqual(firstSummary);
    // Also confirm no entries were double-mutated weirdly.
    expect(
      results.entries.filter((e) => e.verdict === "SKIPPED_BY_DESIGN").length,
    ).toBe(1);
  });
});

describe("finaliseSummary — defensive inputs", () => {
  it("handles undefined results.entries with zero counts and PASS", () => {
    const results = {};
    finaliseSummary(results);
    expect(results.summary.counts_by_verdict).toEqual({
      PASS: 0,
      FAIL: 0,
      BLOCKED: 0,
      SKIPPED_BY_DESIGN: 0,
    });
    expect(results.summary.overall_verdict).toBe("PASS");
    expect(results.summary.cleanup_skipped_by_design).toBe(false);
  });

  it("handles empty results.entries array", () => {
    const results = { entries: [] };
    finaliseSummary(results);
    expect(results.summary.counts_by_verdict.PASS).toBe(0);
    expect(results.summary.overall_verdict).toBe("PASS");
  });
});
