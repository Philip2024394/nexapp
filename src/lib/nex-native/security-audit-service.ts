// src/lib/nex-native/security-audit-service.ts
//
// NEX Security Programme · Item 5 · append-only security audit writer.
// Owner-sealed 2026-11-08.
// -----------------------------------------------------------------------------
// Doctrine
//   · Event allow-list · the writer rejects any event name not in the
//     sealed SECURITY_AUDIT_EVENTS catalog below. Programmer-error
//     fail-closed · a typo in the event name never silently creates
//     an un-categorised row.
//   · Metadata allow-list per event · the writer strips unknown keys
//     before INSERT. Safer than throwing · a drift between the catalog
//     and a caller's metadata should NOT block the audit path for a
//     sensitive action.
//   · Prohibition list enforced by sanitiser · certain keys are NEVER
//     allowed regardless of catalog: raw passwords, auth tokens, chat
//     content, attachment bytes, encryption keys, private keys, raw IPs.
//   · Outcome enum · attempted | denied | completed | failed. Matches
//     the CHECK constraint on nex_security_audit_log.
//   · Fail-loud vs fail-open policy per event CLASS · sensitive events
//     throw AuditWriteError when the INSERT fails · routine events
//     log-warn and return gracefully. Callers of sensitive events MUST
//     treat the throw as "action cannot proceed safely" (handler aborts).
//   · Never trust client-supplied identity · the service only accepts
//     actor_account_id from an authenticated server session or a
//     server-derived hashed IP. The caller passes these explicitly;
//     this service never reads cookies or headers.
//   · No client-side import · "server-only" import at the top.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";

// ─── Error types ─────────────────────────────────────────────────────

/** Thrown by sensitive-event writes when the DB INSERT fails. The
 *  caller MUST propagate this (not swallow) so the user does not see
 *  a success response for an action whose audit trail is incomplete. */
export class AuditWriteError extends Error {
  readonly event: string;
  readonly phase: "attempted" | "completion";
  constructor(event: string, phase: "attempted" | "completion", cause: string) {
    super(`security-audit: ${event} ${phase} write failed · ${cause}`);
    this.name = "AuditWriteError";
    this.event = event;
    this.phase = phase;
  }
}

export function isAuditWriteError(e: unknown): e is AuditWriteError {
  return e instanceof AuditWriteError;
}

// ─── Event catalog ───────────────────────────────────────────────────

export type AuditOutcome = "attempted" | "denied" | "completed" | "failed";

export type AuditFailPolicy = "fail-loud" | "fail-open";

interface AuditEventSpec {
  /** Allowed metadata keys · the writer strips anything not listed. */
  readonly allowedMetadataKeys: readonly string[];
  /** Behaviour when the DB INSERT fails. "fail-loud" throws · the
   *  caller must abort the surrounding action. "fail-open" logs-warn
   *  and returns gracefully. */
  readonly onWriteFailure: AuditFailPolicy;
  /** Target type for this event, if any · documentary only. */
  readonly targetType?: string;
  /** Short human-readable description of the event · used in HQ UI. */
  readonly description: string;
}

/** Sealed event allow-list. Unknown event names are rejected by the
 *  writer. Do NOT add events without updating this catalog AND the
 *  HQ audit viewer's rendering.
 *
 *  Keys follow the convention `<namespace>.<action>.<outcome-noun>`
 *  where `outcome-noun` disambiguates a split attempted/completed
 *  flow (e.g. password_change.attempted vs password_change.completed). */
export const SECURITY_AUDIT_EVENTS: Record<string, AuditEventSpec> = {
  "security.account.sign_up.attempted": {
    allowedMetadataKeys: ["email_domain_hash", "has_claim_account_id", "country_code_hint"],
    onWriteFailure: "fail-loud",
    description: "Account signup initiated · before auth.admin.createUser",
  },
  "security.account.sign_up.completed": {
    allowedMetadataKeys: ["email_domain_hash"],
    onWriteFailure: "fail-loud",
    targetType: "nex_account",
    description: "Account signup succeeded · nex_account persisted",
  },
  "security.account.sign_up.failed": {
    allowedMetadataKeys: ["error_code", "error_class"],
    onWriteFailure: "fail-open",
    description: "Account signup failed · external createUser returned error",
  },
  "security.account.sign_up.denied": {
    allowedMetadataKeys: ["reason", "retry_after_seconds"],
    onWriteFailure: "fail-open",
    description: "Account signup refused · rate-limit or validation",
  },
  "security.account.sign_in.completed": {
    allowedMetadataKeys: ["session_id", "method"],
    onWriteFailure: "fail-open",
    targetType: "nex_session",
    description: "Sign-in succeeded",
  },
  "security.account.sign_in.failed": {
    allowedMetadataKeys: ["method", "error_code", "email_domain_hash"],
    onWriteFailure: "fail-open",
    description: "Sign-in failed · wrong credentials / verification error",
  },
  "security.account.sign_in.denied": {
    allowedMetadataKeys: ["reason", "retry_after_seconds"],
    onWriteFailure: "fail-open",
    description: "Sign-in refused · rate-limit",
  },
  "security.password_change.attempted": {
    allowedMetadataKeys: ["step_up_cleared", "has_vault"],
    onWriteFailure: "fail-loud",
    targetType: "nex_account",
    description: "Password change initiated · before auth.admin.updateUserById",
  },
  "security.password_change.completed": {
    allowedMetadataKeys: ["sessions_invalidated_at"],
    onWriteFailure: "fail-loud",
    targetType: "nex_account",
    description: "Password change succeeded · sessions invalidated",
  },
  "security.password_change.failed": {
    allowedMetadataKeys: ["error_code"],
    onWriteFailure: "fail-open",
    targetType: "nex_account",
    description: "Password change failed · admin updateUserById returned error",
  },
  "security.password_change.denied": {
    allowedMetadataKeys: ["reason"],
    onWriteFailure: "fail-open",
    description: "Password change refused · rate-limit / validation",
  },
  "security.session_revoke.completed": {
    allowedMetadataKeys: ["revoke_cause"],
    onWriteFailure: "fail-open",
    targetType: "nex_session",
    description: "Single-session revoke persisted",
  },
  "security.session_revoke.denied": {
    allowedMetadataKeys: ["reason"],
    onWriteFailure: "fail-open",
    targetType: "nex_session",
    description: "Single-session revoke refused · rate-limit",
  },
  "security.session_revoke_all.attempted": {
    allowedMetadataKeys: ["session_count_estimate"],
    onWriteFailure: "fail-loud",
    targetType: "nex_account",
    description: "Mass session invalidation initiated",
  },
  "security.session_revoke_all.completed": {
    allowedMetadataKeys: ["sessions_invalidated_at"],
    onWriteFailure: "fail-loud",
    targetType: "nex_account",
    description: "Mass session invalidation succeeded",
  },
  "security.session_revoke_all.failed": {
    allowedMetadataKeys: ["error_code"],
    onWriteFailure: "fail-loud",
    targetType: "nex_account",
    description: "Mass session invalidation failed · DB write error",
  },
  "security.session_revoke_all.denied": {
    allowedMetadataKeys: ["reason"],
    onWriteFailure: "fail-open",
    description: "Mass session invalidation refused · rate-limit",
  },
  "security.webauthn.enroll.attempted": {
    allowedMetadataKeys: ["credential_type", "rp_id"],
    onWriteFailure: "fail-loud",
    targetType: "nex_webauthn_credential",
    description: "WebAuthn enrollment initiated",
  },
  "security.webauthn.enroll.completed": {
    allowedMetadataKeys: ["credential_id", "transports", "aaguid"],
    onWriteFailure: "fail-loud",
    targetType: "nex_webauthn_credential",
    description: "WebAuthn enrollment succeeded",
  },
  "security.webauthn.enroll.failed": {
    allowedMetadataKeys: ["error_code"],
    onWriteFailure: "fail-open",
    description: "WebAuthn enrollment failed",
  },
  "security.webauthn.enroll.denied": {
    allowedMetadataKeys: ["reason"],
    onWriteFailure: "fail-open",
    description: "WebAuthn enrollment refused · rate-limit",
  },
  "security.webauthn.assert.completed": {
    allowedMetadataKeys: ["credential_id", "counter_delta", "method"],
    onWriteFailure: "fail-open",
    targetType: "nex_webauthn_credential",
    description: "WebAuthn assertion verified",
  },
  "security.webauthn.assert.failed": {
    allowedMetadataKeys: ["error_code", "counter_rollback_detected"],
    onWriteFailure: "fail-open",
    targetType: "nex_webauthn_credential",
    description: "WebAuthn assertion verification failed",
  },
  "security.webauthn.assert.denied": {
    allowedMetadataKeys: ["reason", "retry_after_seconds"],
    onWriteFailure: "fail-open",
    description: "WebAuthn assertion refused · rate-limit",
  },
  "security.hq.authz.denied": {
    allowedMetadataKeys: ["requested_path", "role_present", "reason"],
    onWriteFailure: "fail-open",
    description: "HQ gate refused non-admin caller",
  },
  "security.hq.authz.completed": {
    allowedMetadataKeys: ["requested_path"],
    onWriteFailure: "fail-open",
    description: "HQ gate passed",
  },
  "security.hq.pages.delete_queue.completed": {
    allowedMetadataKeys: ["page_path", "queue_size_after"],
    onWriteFailure: "fail-loud",
    description: "HQ queued a page file for deletion",
  },
  "security.hq.pages.delete_queue.failed": {
    allowedMetadataKeys: ["error_code"],
    onWriteFailure: "fail-open",
    description: "HQ page delete queue write failed",
  },
  "security.chat.message.denied": {
    allowedMetadataKeys: ["reason", "retry_after_seconds"],
    onWriteFailure: "fail-open",
    description: "Chat message refused · rate-limit",
  },
  "security.visitor.bootstrap.denied": {
    allowedMetadataKeys: ["reason", "retry_after_seconds"],
    onWriteFailure: "fail-open",
    description: "Visitor bootstrap refused · rate-limit",
  },
  "security.account.delete.attempted": {
    allowedMetadataKeys: ["initiator", "reason_code", "stage"],
    onWriteFailure: "fail-loud",
    targetType: "nex_account",
    description: "Account deletion initiated · before GDPR erasure",
  },
  "security.account.delete.completed": {
    allowedMetadataKeys: ["stage"],
    onWriteFailure: "fail-loud",
    targetType: "nex_account",
    description: "Account deletion succeeded · audit identity pseudonymised",
  },
  "security.account.delete.failed": {
    allowedMetadataKeys: ["error_code", "partial_state", "stage"],
    onWriteFailure: "fail-loud",
    targetType: "nex_account",
    description: "Account deletion failed · partial state possible",
  },
  "security.hq.direct_message.completed": {
    allowedMetadataKeys: ["target_account_id", "body_length"],
    onWriteFailure: "fail-open",
    targetType: "nex_account",
    description: "HQ direct message delivered via sealed Nex sentinel",
  },
  "security.hq.direct_message.failed": {
    allowedMetadataKeys: ["error_code", "target_account_id"],
    onWriteFailure: "fail-open",
    targetType: "nex_account",
    description: "HQ direct message delivery failed · no message persisted",
  },
};

// ─── Prohibition list · categorical no-log keys ──────────────────────

const PROHIBITED_METADATA_KEYS = new Set<string>([
  "password",
  "current_password",
  "new_password",
  "password_hash",
  "pin",
  "vault_pin",
  "access_token",
  "refresh_token",
  "bearer_token",
  "api_key",
  "service_role_key",
  "hashed_token",
  "otp",
  "otp_code",
  "magic_token",
  "challenge",
  "private_key",
  "secret_key",
  "nacl_key",
  "attachment_bytes",
  "message_body",
  "chat_body",
  "body_text",
  "message_text",
  "raw_ip",
  "ip_address",
  "client_ip",
]);

// ─── Identity + target shape validation ──────────────────────────────

const ACTOR_IDENTITY_SHAPE = /^(acct|ip|erased):[a-z0-9-]{10,128}$/;
const ACCOUNT_ID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TARGET_TYPE_SHAPE = /^[a-z][a-z0-9_]{2,63}$/;

// ─── Sanitiser ───────────────────────────────────────────────────────

function sanitiseMetadata(
  event: string,
  raw: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const spec = SECURITY_AUDIT_EVENTS[event];
  if (!spec) {
    throw new Error(`security-audit: unknown event '${event}'`);
  }
  const allow = new Set(spec.allowedMetadataKeys);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    // Categorical prohibition first · never log these keys regardless
    // of the per-event allow-list.
    if (PROHIBITED_METADATA_KEYS.has(k)) {
      // eslint-disable-next-line no-console
      console.warn(
        "[security-audit] PROHIBITED metadata key stripped",
        { event, key: k },
      );
      continue;
    }
    if (!allow.has(k)) {
      // Unknown key for this event · strip but do not throw. Helps
      // forward-compatibility when the catalog drifts behind a
      // caller that passes a new key.
      // eslint-disable-next-line no-console
      console.warn(
        "[security-audit] unknown metadata key for event · stripped",
        { event, key: k },
      );
      continue;
    }
    // Shallow-only · nested objects are passed through as-is. The
    // prohibition check does not recurse. Callers must not pass
    // sensitive values under permitted keys.
    out[k] = v;
  }
  return out;
}

// ─── Table-availability probe · pre-migration-292 behaviour ─────────
//
// Owner directive 2026-11-08 (correction) · do NOT treat missing
// audit table as a successful write. Previously the probe returned
// { ok: false, skipped: "table_not_available" } for every event
// including fail-loud ones · callers that only checked for
// AuditWriteError silently proceeded, creating a security-sensitive
// action with no audit trail reported as success. That is the
// bug the owner called out · "we need a clearly reported unavailable
// state and the agreed fail-loud behaviour, not a silent success".
//
// Corrected behaviour
//   · Fail-loud events (password_change.attempted/completed etc.) ·
//     when the table is unavailable, THROW AuditWriteError. Caller's
//     existing fail-loud catch kicks in · user sees a 503 inconclusive
//     response · the sensitive mutation is NOT performed.
//   · Fail-open events (denied / routine logs) · still return
//     { ok: false, skipped: "table_not_available" } · the deny/log
//     surface was never critical enough to block the user response on.
//   · One-shot probe caches the "table missing" state for the process
//     lifetime · one loud warn on first discovery, then the
//     fail-loud-per-event decision runs synchronously after.
//
// Honest effect · until migration 292 is applied, every sensitive
// security operation (password change, mass session invalidation,
// WebAuthn enrollment, HQ page-delete, account deletion) returns
// 503 instead of proceeding. This is the correct security posture ·
// an uncounted sensitive action is strictly worse than a blocked one.

let AUDIT_TABLE_READY: boolean | null = null;

async function ensureAuditTableReady(): Promise<boolean> {
  if (AUDIT_TABLE_READY !== null) return AUDIT_TABLE_READY;
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_security_audit_log")
      .select("id")
      .limit(0);
    AUDIT_TABLE_READY = !error;
    if (!AUDIT_TABLE_READY) {
      // eslint-disable-next-line no-console
      console.warn(
        "[security-audit] nex_security_audit_log unavailable · all audit " +
          "writes will no-op until migration 292 is applied. This DISABLES " +
          "the fail-loud contract during the pre-apply window.",
        { error: error?.message ?? null },
      );
    }
    return AUDIT_TABLE_READY;
  } catch {
    AUDIT_TABLE_READY = false;
    return false;
  }
}

/** Exposed so tests can reset the probe between isolated runs. */
export function _resetAuditTableProbeForTests(): void {
  AUDIT_TABLE_READY = null;
}

// ─── Writer input ────────────────────────────────────────────────────

export interface AuditWriteInput {
  readonly event: string;
  readonly outcome: AuditOutcome;
  readonly actorAccountId?: string | null;
  readonly actorIdentity?: string | null;
  readonly targetType?: string | null;
  readonly targetId?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AuditWriteResult {
  readonly ok: boolean;
  readonly logId?: number;
  readonly skipped?:
    | "catalog_miss"
    | "write_failed_fail_open"
    | "table_not_available";
}

// ─── Writer ──────────────────────────────────────────────────────────

/** Record one security-audit event. Returns a structured result · the
 *  caller can observe `ok` + `logId` for sensitive-action chaining.
 *
 *  Fail-loud events (see SECURITY_AUDIT_EVENTS[event].onWriteFailure)
 *  throw AuditWriteError on DB failure · caller MUST catch + abort the
 *  surrounding action · never report user-visible success when audit
 *  state is uncertain.
 *
 *  Fail-open events log-warn and return { ok: false, skipped:
 *  "write_failed_fail_open" }. The caller can treat this as a
 *  best-effort log with no action-blocking consequence. */
export async function recordAuditEvent(
  input: AuditWriteInput,
): Promise<AuditWriteResult> {
  const spec = SECURITY_AUDIT_EVENTS[input.event];
  if (!spec) {
    // Programmer-error · unknown event name. Log loudly and skip.
    // Throwing would turn a typo into a security-action abort which
    // is worse than a missed audit row for a nonexistent event.
    // eslint-disable-next-line no-console
    console.error(
      "[security-audit] unknown event · catalog miss · skipping write",
      { event: input.event },
    );
    return { ok: false, skipped: "catalog_miss" };
  }

  // Validate outcome against the enum.
  if (
    input.outcome !== "attempted" &&
    input.outcome !== "denied" &&
    input.outcome !== "completed" &&
    input.outcome !== "failed"
  ) {
    throw new Error(
      `security-audit: invalid outcome '${String(input.outcome)}'`,
    );
  }

  // Validate actor_account_id shape if provided.
  if (input.actorAccountId != null && input.actorAccountId !== "") {
    if (!ACCOUNT_ID_SHAPE.test(input.actorAccountId)) {
      throw new Error(
        `security-audit: actorAccountId must be a UUID · got '${input.actorAccountId}'`,
      );
    }
  }

  // Validate actor_identity shape if provided.
  if (input.actorIdentity != null && input.actorIdentity !== "") {
    if (!ACTOR_IDENTITY_SHAPE.test(input.actorIdentity)) {
      throw new Error(
        `security-audit: actorIdentity must match ^(acct|ip|erased):[a-z0-9-]{10,128}$`,
      );
    }
  }

  // Validate target_type if provided.
  if (input.targetType != null && input.targetType !== "") {
    if (!TARGET_TYPE_SHAPE.test(input.targetType)) {
      throw new Error(
        `security-audit: targetType must be snake_case · got '${input.targetType}'`,
      );
    }
  }

  // Sanitise metadata · strips prohibited + unknown keys.
  const metadata = input.metadata
    ? sanitiseMetadata(input.event, input.metadata)
    : {};

  // Pre-migration-292 behaviour · owner-corrected 2026-11-08 · for
  // fail-loud events we THROW AuditWriteError so the caller's existing
  // sensitive-action abort path runs. For fail-open events we return
  // skipped=table_not_available (same as before) · fail-open callers
  // explicitly accept missing audit records.
  const tableReady = await ensureAuditTableReady();
  if (!tableReady) {
    if (spec.onWriteFailure === "fail-loud") {
      const phase: "attempted" | "completion" =
        input.outcome === "attempted" ? "attempted" : "completion";
      throw new AuditWriteError(input.event, phase, "table_not_available");
    }
    return { ok: false, skipped: "table_not_available" };
  }

  const row = {
    event: input.event,
    outcome: input.outcome,
    actor_account_id: input.actorAccountId ?? null,
    actor_identity: input.actorIdentity ?? null,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    metadata,
  };

  const { data, error } = await nexSupabaseAdmin
    .from("nex_security_audit_log")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error) {
    const cause = error.message ?? "unknown";
    if (spec.onWriteFailure === "fail-loud") {
      // eslint-disable-next-line no-console
      console.error(
        "[security-audit] fail-loud write failed · surrounding action must abort",
        { event: input.event, cause },
      );
      const phase: "attempted" | "completion" =
        input.outcome === "attempted" ? "attempted" : "completion";
      throw new AuditWriteError(input.event, phase, cause);
    }
    // fail-open · log loudly and return gracefully.
    // eslint-disable-next-line no-console
    console.warn(
      "[security-audit] fail-open write failed · continuing",
      { event: input.event, cause },
    );
    return { ok: false, skipped: "write_failed_fail_open" };
  }

  return { ok: true, logId: (data as { id: number } | null)?.id };
}

// ─── Pseudonymisation helper for GDPR erasure ────────────────────────

/** Produce an "erased:<random>" identity that preserves the ability
 *  to group an account's audit events after deletion without carrying
 *  the original UUID. The caller stores no mapping · the random value
 *  is generated fresh and used to update every audit row owned by the
 *  deleted account in a single UPDATE (via nex_security_audit_erase_actor
 *  · see migration 294). */
export function generateErasedActorIdentity(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `erased:${hex}`;
}

/** Call the sealed SECURITY DEFINER function to pseudonymise every
 *  audit row owned by a deleted account. The erased identity is
 *  generated via generateErasedActorIdentity in the caller · this
 *  function validates shape + returns the row count.
 *
 *  Compatibility · if migration 294 is not applied, returns ok=false
 *  with skipped="function_not_available" and NO throw. The account-
 *  deletion workflow treats this as "pseudonymisation not available
 *  yet" and must decide whether to proceed with the deletion anyway
 *  (owner decision · default should be to BLOCK deletion until the
 *  pseudonymisation path is live).
 *
 *  Intended usage · this wrapper is called from within the same
 *  logical transaction as the deletion mutation. Supabase client
 *  does not expose a transaction API across RPCs, so the account-
 *  deletion workflow should either (a) use a single SECURITY DEFINER
 *  function that performs the DELETE + pseudonymisation in one SQL
 *  statement, or (b) accept the risk of partial failure + retry
 *  on failure to pseudonymise. Design to be decided when the real
 *  deletion workflow is authored. */
export async function eraseActorIdentityInAudit(
  accountId: string,
  erasedIdentity: string,
): Promise<{
  readonly ok: boolean;
  readonly rowsUpdated?: number;
  readonly skipped?: "function_not_available";
  readonly error?: string;
}> {
  if (!/^erased:[a-z0-9]{16,64}$/.test(erasedIdentity)) {
    throw new Error(
      "security-audit: erasedIdentity must match ^erased:[a-z0-9]{16,64}$",
    );
  }
  const { data, error } = await nexSupabaseAdmin.rpc(
    "nex_security_audit_erase_actor",
    { _account_id: accountId, _erased_identity: erasedIdentity },
  );
  if (error) {
    const code = (error as { code?: string }).code ?? "";
    const msg = error.message ?? "";
    if (
      code === "42883" ||
      /does not exist|undefined function/i.test(msg)
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        "[security-audit] nex_security_audit_erase_actor not available · " +
          "migration 294 may be unapplied. Audit rows NOT pseudonymised.",
      );
      return { ok: false, skipped: "function_not_available" };
    }
    return { ok: false, error: msg };
  }
  const rowsUpdated =
    typeof data === "number" ? data : Array.isArray(data) ? Number(data[0] ?? 0) : 0;
  return { ok: true, rowsUpdated };
}
