// src/lib/nex-native/manage-orders/dispatch-feature-flag.ts
//
// Dispatch / tracking feature flag · PROPOSAL ARTIFACT · 2026-11-17
// -----------------------------------------------------------------------------
// Scope guard: even after migration 349 lands in sandbox, the dispatch UI
// and server action STAY DISABLED by default until the owner explicitly
// opts in via env. This mirrors the sealed NEX convention: every risky
// surface has an opt-in env flag with strict-string-match ("true"), never
// Boolean coercion.
//
// Related:
//   · Migration file: nex-supabase/migrations/349_nex_order_dispatch_PROPOSAL.sql
//   · Pattern source: src/lib/nex-native/business-trial/service.ts
//
// NEVER call dispatch-touching DB code without checking isDispatchEnabled().
// If disabled, the server action must return a typed `{ ok: false; reason:
// "feature_disabled" }` result WITHOUT touching nex_order columns that may
// not yet exist (schema-safe under disabled state).

export function isDispatchFeatureEnabled(): boolean {
  return process.env.NEX_DISPATCH_TRACKING_ENABLED === "true";
}

/**
 * Human-readable label for logs/evidence. Never ship this to a user.
 */
export function dispatchFeatureState(): "enabled" | "disabled" {
  return isDispatchFeatureEnabled() ? "enabled" : "disabled";
}
