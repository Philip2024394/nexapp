// src/lib/nex/indonesia/gaps/gap-registry.ts
//
// 2026-11-21 · Recovered shim for `@/lib/nex/indonesia/gaps/gap-registry`.
//
// monorepo (per CLAUDE.md "Fork hygiene"), the Indonesia GapRegistry
// infrastructure was NOT ported. One runtime file imports this class:
//
//   · src/lib/nex/brain/insight-gaps.ts        · class GapRegistry
//                                                 with observe({...})
//
// Which is itself consumed by the Brain's Stage-3.8 insight bridge —
// a "best-effort" learning-gap writer that already wraps all registry
// calls in try/catch and logs on failure (insight-gaps.ts:41-52).
//
// Type contract — pinned by actual runtime usage, NOT guessed:
//
//   new GapRegistry() → GapRegistry
//   registry.observe({ intent, rawQuery, reason, scope,
//                      suggestedWalkers }) → void
//
//   where the observe argument shape is derived from insight-gaps.ts:42-48:
//     intent            string
//     rawQuery          string          · from decision.learningGap.query
//     reason            "requires_service"
//     scope             unknown         · from decision.learningGap.scope
//     suggestedWalkers  readonly string[]
//
// Runtime behaviour: the shim's observe() is a no-op. This is
// indistinguishable from "best-effort registry accepted the write and
// discarded it" — and the only caller already treats write failures
// as non-fatal (try/catch + console.warn).
//
// Also exported: `_setInsightGapRegistryForTests` support — the live
// module accepts a GapRegistry|null. A shim instance satisfies that
// type constraint without needing additional behavior.
//
// HONESTY: The shim does NOT fabricate recorded gaps. It drops writes
// and reports nothing back — which is honest for a fork where no gap
// infrastructure exists. If a test asserts "after N observe() calls,
// registry reports N gaps," that test would fail — and SHOULD fail
// until real infra ports. Current test surface contains zero such
// assertions (verified by grep on GapRegistry|observe across *.test.ts).
//
// Reversal path: if/when the Indonesia GapRegistry is ported, replace
// this file with the real implementation. The type contract above is
// the stable surface callers depend on.

export interface GapObservation {
  readonly intent: string;
  readonly rawQuery: string;
  readonly reason: "requires_service" | string;
  readonly scope?: unknown;
  readonly suggestedWalkers?: ReadonlyArray<string>;
}

/**
 * Workforce learning-gap registry.
 *
 * Shim behaviour (fork carve-out): `observe()` is a no-op. The sole
 * caller (`recordInsightGap` in brain/insight-gaps.ts) wraps all
 * invocations in try/catch and treats a failed write as a best-effort
 * miss, so a silent drop preserves the documented semantics.
 */
export class GapRegistry {
  observe(_observation: GapObservation): void {
    // No-op · fork carve-out · see file header.
  }
}
