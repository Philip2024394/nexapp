// Coverage Report (Philip 2026-08-01)
//
// Phase 1c Batch 8 · 2026-11-06: staircase-advisor removed as part of
// scope reduction. Stubbed to return empty state while preserving the
// exported types + function signature so callers continue to type-check.
// Re-wire when a new topic corpus is introduced post-launch.

import "server-only";

export type CoverageEntry = {
  topic:          string;
  section_count:  number;
  stars:          number;
};

export type CoverageReport = {
  entries:      CoverageEntry[];
  strongest:    { topic: string; count: number } | null;
  thinnest:     Array<{ topic: string; count: number }>;
  generated_at: string;
};

/** Compute topic coverage. Phase 1c Batch 8 stub · returns empty state. */
export function computeCoverageReport(): CoverageReport {
  return {
    entries:      [],
    strongest:    null,
    thinnest:     [],
    generated_at: new Date().toISOString(),
  };
}
