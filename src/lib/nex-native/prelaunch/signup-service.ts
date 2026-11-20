// src/lib/nex-native/prelaunch/signup-service.ts
//
// NEX prelaunch · launch-notification signup wrapper (server-only).
// Authored 2026-11-18 for the Nexcorner prelaunch landing.
//
// Behaviour contract (all documented, all tested):
//
//   recordPrelaunchSignup(normalisedEmail, source)
//     INSERT into `nex_prelaunch_signup` (migration 352 PROPOSAL).
//     Returns a discriminated envelope:
//       { ok: true, state: "new" }               — fresh insert
//       { ok: true, state: "already_registered" } — unique conflict, hidden
//                                                    from caller so we
//                                                    never leak list
//                                                    membership.
//       { ok: false, reason: "migration_not_applied" } — 42P01, table
//                                                        does not exist
//                                                        yet. Fail-closed.
//       { ok: false, reason: "transient" } — any other DB error. Fail-closed.
//       { ok: false, reason: "invalid_source" } — guard against bad caller.
//
// Rules this function obeys:
//   · Does NOT log the raw email. Hashes locally for diagnostic only.
//   · Does NOT reveal whether another person's email is registered — the
//     "new" and "already_registered" states are both successful from the
//     caller's perspective.
//   · Does NOT send any email. (Resend adapter exists but delivery is not
//     verified · see handback.)
//   · Does NOT bypass RLS intent — the table is designed for service-role
//     INSERT only; the admin client is used here deliberately so RLS can
//     stay strict.
//
// This module imports `nexSupabaseAdmin` which is `server-only`. It MUST
// NOT be imported from middleware (Edge) or a Client Component.

import "server-only";
import { createHash } from "node:crypto";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

export type PrelaunchSignupSource = "nexcorner_landing_v1";

const VALID_SOURCES: ReadonlySet<PrelaunchSignupSource> = new Set([
  "nexcorner_landing_v1",
]);

export type PrelaunchSignupResult =
  | { ok: true; state: "new" | "already_registered" }
  | {
      ok: false;
      reason:
        | "migration_not_applied"
        | "transient"
        | "invalid_source";
    };

export interface RecordPrelaunchSignupInput {
  readonly normalisedEmail: string;
  readonly source: PrelaunchSignupSource;
  readonly userAgentOptional?: string | null;
  readonly ipHashOptional?: string | null;
}

export async function recordPrelaunchSignup(
  input: RecordPrelaunchSignupInput,
): Promise<PrelaunchSignupResult> {
  if (!VALID_SOURCES.has(input.source)) {
    return { ok: false, reason: "invalid_source" };
  }

  const row = {
    email_normalised: input.normalisedEmail,
    email_hash: hashEmail(input.normalisedEmail),
    source: input.source,
    consent_version: "nexcorner_launch_notify_v1",
    user_agent: truncateOrNull(input.userAgentOptional, 512),
    ip_hash: truncateOrNull(input.ipHashOptional, 128),
  };

  const { error } = await nexSupabaseAdmin
    .from("nex_prelaunch_signup")
    .insert(row);

  if (error) {
    // 42P01: undefined_table. Mig 352 is PROPOSAL, not applied.
    if (error.code === "42P01") {
      return { ok: false, reason: "migration_not_applied" };
    }
    // 23505: unique_violation on (email_normalised). Idempotent re-submit;
    // treat as already-registered without revealing status.
    if (error.code === "23505") {
      return { ok: true, state: "already_registered" };
    }
    return { ok: false, reason: "transient" };
  }

  return { ok: true, state: "new" };
}

/** SHA-256 hex of the normalised email. Used for diagnostics / dedup
 *  logging without persisting or echoing the raw address. */
export function hashEmail(normalisedEmail: string): string {
  return createHash("sha256").update(normalisedEmail).digest("hex");
}

function truncateOrNull(
  value: string | null | undefined,
  max: number,
): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (value.length <= max) return value;
  return value.slice(0, max);
}
