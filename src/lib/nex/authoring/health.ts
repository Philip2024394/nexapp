// Knowledge Health Dashboard (Philip 2026-08-01)
//
// Phase 1c Batch 8 · 2026-11-06: staircase-advisor removed as part of
// scope reduction. Stubbed to return empty state while preserving the
// exported type + function signature so callers continue to type-check.
// Re-wire when a new knowledge corpus is introduced post-launch.

import "server-only";

export type KnowledgeHealth = {
  total_files:              number;
  indexed_files:            number;
  excluded_files:           number;
  candidate_files:          number;
  total_lines:              number;
  indexed_lines:            number;
  total_sections:           number;
  indexed_sections:         number;
  empty_sections:           number;
  semantic_ready:           boolean;
  semantic_snippet_count:   number;
  semantic_built_at:        string | null;
  runtime_core_files:       number;
  candidates: string[];
  excluded_by_category: Record<string, number>;
};

export function computeKnowledgeHealth(): KnowledgeHealth {
  return {
    total_files:            0,
    indexed_files:          0,
    excluded_files:         0,
    candidate_files:        0,
    total_lines:            0,
    indexed_lines:          0,
    total_sections:         0,
    indexed_sections:       0,
    empty_sections:         0,
    semantic_ready:         false,
    semantic_snippet_count: 0,
    semantic_built_at:      null,
    runtime_core_files:     0,
    candidates:             [],
    excluded_by_category:   {},
  };
}
