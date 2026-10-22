// src/lib/nex-native/business-trial/audit-pepper.ts
//
// G1 Final Readiness · Production-safe pepper resolver.
// =======================================================
//
// NEX_AUDIT_HASH_PEPPER is used by:
//   · logging.ts         · hashAccountId() for structured server logs
//   · idempotency.ts     · scope prefix for account+route composite keys
//
// Owner directive 2026-10-22 (final readiness review):
//   "Verify that this fallback cannot be used in a real deployment or when
//    the trial is enabled. Production activation must fail closed if the
//    required secret is absent or weak."
//
// Policy enforced here:
//   1. If NEX_AUDIT_HASH_PEPPER is set AND >= 16 chars → use it unchanged.
//   2. Else if a test context is detected (NODE_ENV=test OR VITEST set) →
//      allow a sentinel fallback value for test-only use.
//   3. Else (any non-test context: dev · preview · production) → **throw**.
//
// This is a FAIL-CLOSED guard. Any real deployment (including a developer's
// local Next.js dev server unless they explicitly set NODE_ENV=test) MUST
// supply NEX_AUDIT_HASH_PEPPER. Missing or weak secret → explicit error at
// first use.
//
// The flag `NEX_BUSINESS_TRIAL_ENABLED` is NOT consulted here · the pepper
// is required even when the flag is disabled because the status endpoint
// still emits hashed-account logs regardless of flag state. Separation of
// concerns: this file guards the SECRET · the flag guards the FEATURE.

import "server-only";

export const AUDIT_PEPPER_ENV = "NEX_AUDIT_HASH_PEPPER";
export const MIN_PEPPER_LENGTH = 16;
const TEST_SENTINEL_PEPPER = "nex-test-only-pepper-do-not-use";

/** Error thrown when a non-test context lacks a valid pepper.
 *  Callers must not catch this · a missing production secret is a
 *  deploy-time configuration bug that should surface loudly. */
export class NexAuditPepperMissingError extends Error {
  readonly code = "audit_pepper_missing" as const;
  constructor(reason: "absent" | "too_short") {
    super(
      reason === "absent"
        ? `nex-business-trial: ${AUDIT_PEPPER_ENV} is REQUIRED in non-test contexts. ` +
            `Set this env var to a ${MIN_PEPPER_LENGTH}+ char random secret before enabling ` +
            `the trial feature. The pepper anonymises account IDs in audit logs and idempotency ` +
            `scope keys. Fail-closed guard · deliberate.`
        : `nex-business-trial: ${AUDIT_PEPPER_ENV} is too short (minimum ${MIN_PEPPER_LENGTH} chars). ` +
            `Regenerate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" ` +
            `or an equivalent secure random source.`,
    );
    this.name = "NexAuditPepperMissingError";
  }
}

/** Detects a vitest / jest / unit-test context. The sentinel fallback is
 *  permitted ONLY when one of these flags is set. Any environment that
 *  does not explicitly declare itself a test context must supply the
 *  real pepper. */
function isTestContext(): boolean {
  if (process.env.NODE_ENV === "test") return true;
  if (process.env.VITEST === "true") return true;
  // JEST sets this too but we're vitest-only
  return false;
}

/** Resolves the audit pepper per the fail-closed policy above.
 *  Called by hashAccountId() and the idempotency scope prefix.
 *  Throws NexAuditPepperMissingError in any non-test context where
 *  the env var is absent or too short. */
export function resolveAuditPepper(): string {
  const explicit = process.env[AUDIT_PEPPER_ENV];
  if (explicit && explicit.length >= MIN_PEPPER_LENGTH) {
    return explicit;
  }
  if (explicit && explicit.length > 0 && explicit.length < MIN_PEPPER_LENGTH) {
    if (!isTestContext()) {
      throw new NexAuditPepperMissingError("too_short");
    }
    // In tests, accept the short value as-is (tests may deliberately use
    // short values to assert hash determinism · see logging.test.ts).
    return explicit;
  }
  // Env var absent (undefined or empty string)
  if (isTestContext()) {
    return TEST_SENTINEL_PEPPER;
  }
  throw new NexAuditPepperMissingError("absent");
}
