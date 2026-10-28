// src/lib/nex-native/watches/watch-listing-dev-mock-guard.ts
//
// R2 · Production mock-payment guard · pure · test-safe.
// -----------------------------------------------------------------------------
// Enforces that `grantWatchListingEntitlementMockAction` cannot execute
// a mock entitlement grant in a production build, regardless of UI
// visibility, browser input, or client-supplied payment status.
//
// Invariants
//   1. NODE_ENV === 'production' · ALWAYS reject · no feature-flag override.
//   2. NODE_ENV !== 'production' · reject by default · require explicit
//      opt-in via NEX_WATCHES_DEV_MOCK_PAYMENT_ALLOWED === '1'.
//   3. 'test' and undefined NODE_ENV are treated as non-production so
//      vitest can exercise the allowed branch when the opt-in flag is
//      set in-test.
//   4. The flag value must be EXACTLY '1'. Any other value (empty,
//      "true", "yes", "allow", "0", …) is treated as "not opted in"
//      (fail-closed).
//
// Doctrine
//   · R2 remediation 2026-10-26 · closes the mock-payment bypass flagged
//     in the P2 audit (an authenticated owner could trigger a 30-day
//     entitlement from the browser without any real payment).
//   · Production entitlement grants require a real signed-webhook path
//     (not yet built · separately gated as a follow-on remediation).
//   · The sealed §2.4 clause ("NEX never handles payments") is unaffected
//     · NEX collects its own listing fee per the §2.4a amendment
//     through an approved provider · never a client-triggered mock.
//
// Deliberately pure
//   · No "server-only" guard · this module is also imported from
//     __tests__ to prove the invariants without a full server runtime.
//   · No process.env reads at module load · the pure function takes an
//     injected env record. `isDevMockPaymentAllowed()` is a thin
//     convenience that reads `process.env` at call time only.

import { z } from "zod";

// ─── Guard · pure ───────────────────────────────────────────────────────────

export type DevMockDenialReason =
  | "production_disallowed"
  | "env_flag_missing";

export type DevMockGuardResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: DevMockDenialReason };

/** Pure · deterministic · test-friendly. Pass in a plain env record.
 *  No side effects, no process reads, no DB touch. */
export function evaluateDevMockPaymentGuard(
  env: Record<string, string | undefined>,
): DevMockGuardResult {
  if (env.NODE_ENV === "production") {
    return { allowed: false, reason: "production_disallowed" };
  }
  if (env.NEX_WATCHES_DEV_MOCK_PAYMENT_ALLOWED !== "1") {
    return { allowed: false, reason: "env_flag_missing" };
  }
  return { allowed: true };
}

/** Convenience wrapper · reads from the current process environment.
 *  Server-side only when called at runtime · tests should prefer
 *  `evaluateDevMockPaymentGuard(env)` with an injected env for pure
 *  verification. */
export function isDevMockPaymentAllowed(): boolean {
  return evaluateDevMockPaymentGuard(
    process.env as Record<string, string | undefined>,
  ).allowed;
}

/** Map a denial reason to a stable action-layer result code. Keeping
 *  the mapping centralised means the action's exported codes are
 *  pinned and the test file can assert on them directly. */
export function denialToResultCode(reason: DevMockDenialReason): string {
  switch (reason) {
    case "production_disallowed":
      return "mock_payment_production_disallowed";
    case "env_flag_missing":
      return "mock_payment_env_disabled";
  }
}

// ─── Strict input schema for the mock action ────────────────────────────────
//
// Exported here (not inside the "use server" action file) so the test
// suite can import and verify it without touching the Next.js server-
// action runtime. The action file imports this schema and uses it as
// the single authoritative input validator for the mock-grant path.

/** Strict schema for `grantWatchListingEntitlementMockAction` input.
 *  `.strict()` rejects ANY unknown key, so a hand-crafted POST that
 *  tries to slip `provider`, `paymentReference`, `amountPence`,
 *  `durationDays`, or any other payment metadata into the request
 *  body is refused outright · the ledger row's economics come
 *  exclusively from server-side constants. */
export const mockGrantInputSchema = z
  .object({
    listingId: z.string().uuid(),
  })
  .strict();

export type MockGrantInput = z.infer<typeof mockGrantInputSchema>;
