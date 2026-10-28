// src/lib/nex-native/emergency/_feature-flags.ts
//
// NEX Emergency Help · feature flags.
// Owner-authorised 2026-10-25 (Phase A of the continuous-build plan).
//
// Each flag defaults OFF. A flag ON requires its backend prerequisite
// to be live AND covered by its own passing tests (sealed Service
// Principle doctrine · "never promise what isn't delivered").
//
// Flags are env-driven so production and preview deployments can
// disable any capability without a redeploy. In tests + dev the
// defaults stay OFF unless the test explicitly flips a flag via the
// override.

/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Reads a boolean from an env var. Returns `false` unless the var is
 * exactly `"1"` or `"true"` (case-insensitive). Any other value — or
 * absence — reads as `false`. This gives a secure default and makes
 * accidental "yes"/"on"/"enabled" strings into no-ops instead of
 * silent partial activations.
 */
function readEnvBool(name: string): boolean {
  const raw =
    typeof process !== "undefined" && process.env
      ? process.env[name]
      : undefined;
  if (!raw) return false;
  const normalised = String(raw).trim().toLowerCase();
  return normalised === "1" || normalised === "true";
}

/**
 * Live-flag registry. Each key corresponds to a specific capability
 * whose implementation must be in place AND tested before the flag
 * is turned on in production. The default for every flag is `false`.
 *
 * Honest-copy gate implications:
 *   · When a flag is `false`, the UI MUST NOT render the claim the
 *     flag protects. The honest-copy test suite enforces this.
 *   · When a flag is `true`, the capability's implementation + tests
 *     must be present in the diff that flipped it.
 */
export const EMERGENCY_FLAGS = {
  /**
   * `✓ ID` chip on responder posts in the Emergency Group.
   * Requires: Emergency Profile backend live + Persona (or chosen
   * provider) verification result stored on the responder's account.
   */
  responderIdVerifiedLive: () =>
    readEnvBool("NEX_EMERGENCY_RESPONDER_ID_VERIFIED_LIVE"),

  /**
   * `Verified` state on the Emergency Profile VerificationStatusCard.
   * Requires: provider verification result + webhook + state machine.
   */
  profileVerificationLive: () =>
    readEnvBool("NEX_EMERGENCY_PROFILE_VERIFICATION_LIVE"),

  /**
   * Encryption at rest for Emergency Profile fields.
   * Requires: encryption module + KMS + key rotation job.
   */
  profileEncryptionLive: () =>
    readEnvBool("NEX_EMERGENCY_PROFILE_ENCRYPTION_LIVE"),

  /**
   * Scoped-release disclosure gate.
   * Requires: disclosure-gate server function + atomic audit insert
   * + rate limit + security tests.
   */
  disclosureGateLive: () =>
    readEnvBool("NEX_EMERGENCY_DISCLOSURE_GATE_LIVE"),

  /**
   * Live Emergency alert fan-out (push / SMS / email).
   * Requires: notification-provider adapter + fallback paths +
   * delivery audit log.
   */
  notificationFanoutLive: () =>
    readEnvBool("NEX_EMERGENCY_NOTIFICATION_FANOUT_LIVE"),

  /**
   * Real responder resolver (geo + opt-in).
   * Requires: PostGIS or equivalent spatial index + applied migration.
   */
  responderResolverLive: () =>
    readEnvBool("NEX_EMERGENCY_RESPONDER_RESOLVER_LIVE"),

  /**
   * Real retention / deletion job.
   * Requires: pg_cron (or equivalent) schedule + idempotent purge +
   * tested grace-period behavior.
   */
  retentionJobLive: () =>
    readEnvBool("NEX_EMERGENCY_RETENTION_JOB_LIVE"),
} as const;

export type EmergencyFlagKey = keyof typeof EMERGENCY_FLAGS;

/** Test-time override · overrides the env check for a single key.
 *  The override map is read first; falling through to the env-var
 *  check. Call `__setEmergencyFlagOverride(key, undefined)` to clear.
 */
const overrides: Partial<Record<EmergencyFlagKey, boolean>> = {};

export function __setEmergencyFlagOverride(
  key: EmergencyFlagKey,
  value: boolean | undefined,
): void {
  if (value === undefined) {
    delete overrides[key];
  } else {
    overrides[key] = value;
  }
}

/** Read a flag with the override + env chain applied. */
export function isEmergencyFlagOn(key: EmergencyFlagKey): boolean {
  if (key in overrides) return overrides[key] === true;
  return EMERGENCY_FLAGS[key]();
}
