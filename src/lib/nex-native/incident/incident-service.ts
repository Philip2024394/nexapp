// src/lib/nex-native/incident/incident-service.ts
//
// NEX Security & Recovery · incident recorder + lifecycle service.
// Owner-sealed 2026-11-08.
// -----------------------------------------------------------------------------
// Server-only · writes go through the sealed nexSupabaseAdmin. All
// operator-facing text is REDACTED by the caller · this service
// trusts its inputs are already free of secrets / stack traces /
// chat body / PII (see migration 300 content-safety comment).
//
// Lifecycle enforcement
//   Legal transitions:
//     DETECTED      → INVESTIGATING | PROTECTING | RECOVERING | NEEDS_ADMIN | CLOSED
//     INVESTIGATING → PROTECTING | RECOVERING | NEEDS_ADMIN | CLOSED
//     PROTECTING    → RECOVERING | RECOVERED | NEEDS_ADMIN | CLOSED
//     RECOVERING    → RECOVERED | MONITORING | NEEDS_ADMIN | CLOSED
//     RECOVERED     → MONITORING | CLOSED
//     MONITORING    → RECOVERED | CLOSED | NEEDS_ADMIN
//     NEEDS_ADMIN   → INVESTIGATING | RECOVERING | CLOSED
//     CLOSED        → (terminal · can only reopen via a NEW incident)
//
// Pre-migration-300 compat
//   Same probe pattern as the audit writer · if nex_incident is
//   unavailable, record() returns { ok: false, skipped: "table_not_
//   available" } and does NOT throw · the callers of this service
//   are observability code paths · they MUST NOT turn an incident
//   write failure into a user-visible fault.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";

export type IncidentCategory =
  | "security"
  | "recovery"
  | "database"
  | "service"
  | "backend"
  | "storage"
  | "job"
  | "auth"
  | "rate_limit"
  | "attack"
  | "degraded";

// Owner directive 2026-11-08 (round 8) Priority 2 · 4-tier severity
// (migration 304). `high` sits between warn and critical.
export type IncidentSeverity = "info" | "warn" | "high" | "critical";

// Owner directive 2026-11-08 (round 8) Priority 2 · VERIFIED is a
// NEW distinct status (migration 304). It means an HQ operator has
// CONFIRMED a recovery claim. RECOVERED = auto-recovery claimed ·
// VERIFIED = operator-verified. Historical RECOVERED rows stay
// RECOVERED and are NEVER retroactively reinterpreted as VERIFIED.
export type IncidentStatus =
  | "DETECTED"
  | "INVESTIGATING"
  | "PROTECTING"
  | "RECOVERING"
  | "RECOVERED"
  | "MONITORING"
  | "VERIFIED"
  | "NEEDS_ADMIN"
  | "CLOSED";

/** How an incident was detected. Bounded enum enforced in DB CHECK. */
export type IncidentDetectionSource =
  | "section_boundary"
  | "section_probe"
  | "core_probe"
  | "security_signal"
  | "audit_reconciler"
  | "manual"
  | "external_webhook"
  | "unknown";

export type IncidentScope =
  | "chat"
  | "shops"
  | "feed"
  | "live"
  | "directory"
  | "food"
  | "fashion"
  | "accommodation"
  | "property"
  | "hq"
  | "infra"
  | "auth"
  | "storage"
  | "db"
  | "cron"
  // Owner-authorised 2026-11-08 (round 8) Priority 2 · migration 304
  // expands the DB CHECK to include these two values · the TS enum
  // + section-error endpoint LEGAL_SECTIONS + SegmentScope stay in
  // lock-step.
  | "settings"
  | "community";

export type IncidentCountry = "ireland" | "indonesia" | "worldwide" | "hq" | "global";

export interface CreateIncidentInput {
  readonly category: IncidentCategory;
  readonly severity: IncidentSeverity;
  readonly scope: IncidentScope;
  readonly country: IncidentCountry;
  readonly summary: string;
  readonly correlationId?: string | null;
  readonly usersAffectedCount?: number;
  readonly adminActionRequired?: boolean;
  // Owner directive 2026-11-08 (round 8) Priority 2 · migration 304
  // fields. All optional at the service layer · the DB enforces
  // shape constraints + defaults.
  readonly detectionSource?: IncidentDetectionSource;
  readonly service?: string | null;
  readonly dedupKey?: string | null;
}

export interface CreateIncidentResult {
  readonly ok: boolean;
  readonly incidentId?: string;
  readonly skipped?: "table_not_available";
  readonly error?: string;
}

// Owner directive 2026-11-08 · incident-metadata-leak-review-2026-11-08.md
// AMBER → GREEN closure. Patterns expanded to cover the gaps surfaced
// by the leak audit · email, IPv6, phone, OpenAI, AWS, GitHub PAT/
// OAuth, PEM private key blocks, Stripe restricted-keys, api_key=.
// Order matters · PEM block (multi-line) comes BEFORE generic patterns
// so a nested bearer/jwt inside a PEM pastes gets fully stripped first.
const REDACTION_PATTERNS: readonly RegExp[] = [
  // PEM private / certificate blocks · multi-line · strip first so
  // anything inside the block (bearer tokens in a dump etc.) is gone
  // before the per-pattern passes run.
  /-----BEGIN [A-Z0-9 ]+?-----[\s\S]*?-----END [A-Z0-9 ]+?-----/g,
  // Stripe
  /sk_live_[a-zA-Z0-9]+/g,
  /sk_test_[a-zA-Z0-9]+/g,
  /rk_live_[a-zA-Z0-9]+/g,
  /rk_test_[a-zA-Z0-9]+/g,
  // OpenAI (sk-proj-, sk-, sk-ant-)
  /sk-(?:proj|ant)-[A-Za-z0-9_\-]+/g,
  // Anthropic API key prefix
  /sk-ant-api[0-9]{2}-[A-Za-z0-9_\-]+/g,
  // AWS access key id
  /\bAKIA[A-Z0-9]{16}\b/g,
  // GitHub tokens · PAT / OAuth / user / server / refresh
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  // GitHub fine-grained PAT
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  // Supabase service-role / anon JWTs (eyJ... three-part) · same shape
  // as all JWTs so the next pattern catches them · listed here as a
  // documentary reminder not a separate pattern.
  /eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g,
  // Raw IPv4
  /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
  // Raw IPv6 · at least 3 colons to avoid matching host:port
  /\b(?:[0-9a-fA-F]{1,4}:){3,7}[0-9a-fA-F]{1,4}\b/g,
  // E.164 phone number · +<1-15 digits> with a minimum of 7 to avoid
  // matching country-code-only hints
  /\+[1-9]\d{6,14}\b/g,
  // Email address
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  // Named inline credentials
  /password[=:][^\s&]+/gi,
  /token[=:][^\s&]+/gi,
  /api[_-]?key[=:][^\s&]+/gi,
  /secret[=:][^\s&]+/gi,
  /authorization:\s*bearer\s+[^\s]+/gi,
];

/** Apply the pattern-redaction pass only · used by metadata-value
 *  scrubs where we do not want the 400-char truncation. */
export function redactPatterns(input: string): string {
  let out = input;
  for (const re of REDACTION_PATTERNS) {
    out = out.replace(re, "[REDACTED]");
  }
  return out;
}

export function redactSummary(input: string): string {
  return redactPatterns(input.slice(0, 400));
}

// Pre-migration-300 probe cache
let INCIDENT_TABLE_READY: boolean | null = null;

async function ensureIncidentTableReady(): Promise<boolean> {
  if (INCIDENT_TABLE_READY !== null) return INCIDENT_TABLE_READY;
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_incident")
      .select("id")
      .limit(0);
    INCIDENT_TABLE_READY = !error;
    if (!INCIDENT_TABLE_READY) {
      // eslint-disable-next-line no-console
      console.warn(
        "[incident-service] nex_incident unavailable · writes will no-op until migration 300 is applied.",
        { error: error?.message ?? null },
      );
    }
    return INCIDENT_TABLE_READY;
  } catch {
    INCIDENT_TABLE_READY = false;
    return false;
  }
}

/** Exposed so tests can reset the probe between isolated runs. */
export function _resetIncidentProbeForTests(): void {
  INCIDENT_TABLE_READY = null;
}

// Owner directive 2026-11-08 (round 8) Priority 2 · VERIFIED split.
// RECOVERED means auto-recovery CLAIMED. VERIFIED means an HQ operator
// has CONFIRMED the recovery. The only path INTO VERIFIED is from
// RECOVERED or MONITORING. VERIFIED → CLOSED is the only exit forward.
// If a problem returns after VERIFIED, create a NEW incident · the
// VERIFIED state is a terminal "done" claim and must not be reopened.
const LEGAL_TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  DETECTED: ["INVESTIGATING", "PROTECTING", "RECOVERING", "NEEDS_ADMIN", "CLOSED"],
  INVESTIGATING: ["PROTECTING", "RECOVERING", "NEEDS_ADMIN", "CLOSED"],
  PROTECTING: ["RECOVERING", "RECOVERED", "NEEDS_ADMIN", "CLOSED"],
  RECOVERING: ["RECOVERED", "MONITORING", "NEEDS_ADMIN", "CLOSED"],
  RECOVERED: ["MONITORING", "VERIFIED", "CLOSED"],
  MONITORING: ["RECOVERED", "VERIFIED", "CLOSED", "NEEDS_ADMIN"],
  VERIFIED: ["CLOSED"],
  NEEDS_ADMIN: ["INVESTIGATING", "RECOVERING", "CLOSED"],
  CLOSED: [],
};

export function isLegalTransition(
  from: IncidentStatus,
  to: IncidentStatus,
): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

/** Create a new incident. Idempotency is NOT provided here · if the
 *  caller wants dedup, it must check for an existing open incident
 *  with the same (scope, category, correlationId) first. */
export async function createIncident(
  input: CreateIncidentInput,
): Promise<CreateIncidentResult> {
  const ready = await ensureIncidentTableReady();
  if (!ready) {
    return { ok: false, skipped: "table_not_available" };
  }

  const redactedSummary = redactSummary(input.summary);

  const { data, error } = await nexSupabaseAdmin
    .from("nex_incident")
    .insert({
      category: input.category,
      severity: input.severity,
      scope: input.scope,
      country: input.country,
      summary: redactedSummary,
      correlation_id: input.correlationId ?? null,
      users_affected_count: Math.max(0, input.usersAffectedCount ?? 0),
      admin_action_required: input.adminActionRequired ?? false,
      // Owner directive 2026-11-08 (round 8) Priority 2 · populate the
      // migration-304 columns when the caller provides them. The DB
      // supplies safe defaults (last_seen_at=now, source='unknown')
      // when absent.
      detection_source: input.detectionSource ?? undefined,
      service: input.service ?? undefined,
      dedup_key: input.dedupKey ?? undefined,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.warn("[incident-service] insert failed · observability-only · no user impact", {
      error: error?.message ?? "no data",
    });
    return { ok: false, error: error?.message ?? "no data returned" };
  }

  const row = data as { id: string };
  // Companion event · creation marker.
  await nexSupabaseAdmin.from("nex_incident_event").insert({
    incident_id: row.id,
    kind: "created",
    to_status: "DETECTED",
    note: `${input.category}/${input.scope}`,
  });

  return { ok: true, incidentId: row.id };
}

export interface TransitionInput {
  readonly incidentId: string;
  readonly toStatus: IncidentStatus;
  readonly actorAccountId?: string | null;
  readonly note?: string | null;
  readonly recoveryActionTaken?: string | null;
}

export interface TransitionResult {
  readonly ok: boolean;
  readonly error?:
    | "not_found"
    | "illegal_transition"
    | "write_failed"
    | "table_not_available"
    | "verifier_required";
  readonly fromStatus?: IncidentStatus;
}

export async function transitionIncident(
  input: TransitionInput,
): Promise<TransitionResult> {
  const ready = await ensureIncidentTableReady();
  if (!ready) return { ok: false, error: "table_not_available" };

  const current = await nexSupabaseAdmin
    .from("nex_incident")
    .select("id, status")
    .eq("id", input.incidentId)
    .maybeSingle();
  if (current.error || !current.data) return { ok: false, error: "not_found" };

  const fromStatus = (current.data as { status: IncidentStatus }).status;
  if (!isLegalTransition(fromStatus, input.toStatus)) {
    return { ok: false, error: "illegal_transition", fromStatus };
  }

  // Owner directive 2026-11-08 (round 8) Priority 2 · VERIFIED is
  // reserved for operator-verified resolution. Reject generic
  // transitionIncident attempts to VERIFIED · callers MUST use
  // verifyIncidentRecovery() which carries the verifier account id.
  if (input.toStatus === "VERIFIED") {
    return { ok: false, error: "verifier_required", fromStatus };
  }

  const patch: Record<string, unknown> = {
    status: input.toStatus,
    updated_at: new Date().toISOString(),
    // Every write updates last_seen_at so readers can bucket by
    // recency without re-joining events.
    last_seen_at: new Date().toISOString(),
  };
  if (input.recoveryActionTaken) {
    // Owner directive 2026-11-08 · leak review found this field was
    // written without redaction. Route through redactSummary so the
    // same patterns that scrub `summary` also scrub this field.
    patch.recovery_action_taken = redactSummary(input.recoveryActionTaken);
  }
  // Owner directive 2026-11-08 (round 8) Priority 2 · RECOVERED no
  // longer sets resolved_at. Only VERIFIED and CLOSED do · they are
  // the genuine terminal "done" states.
  if (input.toStatus === "CLOSED") {
    patch.resolved_at = new Date().toISOString();
  }

  const upd = await nexSupabaseAdmin
    .from("nex_incident")
    .update(patch)
    .eq("id", input.incidentId)
    .eq("status", fromStatus); // Optimistic concurrency guard
  if (upd.error) return { ok: false, error: "write_failed", fromStatus };

  await nexSupabaseAdmin.from("nex_incident_event").insert({
    incident_id: input.incidentId,
    kind: "status_transition",
    actor_account_id: input.actorAccountId ?? null,
    from_status: fromStatus,
    to_status: input.toStatus,
    note: input.note ? redactSummary(input.note) : null,
  });

  return { ok: true, fromStatus };
}

// ─── Country-aware dedup (owner directive 2026-11-08 round 8) ────
//
// For a signal that fires repeatedly (e.g. "rate limit tripped on
// auth"), callers compute a stable dedup_key (scope|category|extra)
// and ALSO carry the country. We look up an open-same-signature
// incident · if one exists, we BUMP its last_seen_at instead of
// inserting a new row. This keeps HQ Alerts from storming during
// a repeated signal AND is country-aware · an identical signature
// in `ireland` vs `indonesia` creates TWO incidents, not one.

export interface BumpDedupInput {
  readonly dedupKey: string;
  readonly country: IncidentCountry;
}

export interface BumpDedupResult {
  readonly bumped: boolean;
  readonly incidentId?: string;
  readonly skipped?: "table_not_available";
}

/** Return the id of an open same-signature incident for the given
 *  country, or null if none exists. Readers call this before a
 *  createIncident to decide dedup-vs-insert. */
export async function findOpenIncidentByDedupKey(
  input: BumpDedupInput,
): Promise<{ incidentId: string | null; skipped?: "table_not_available" }> {
  const ready = await ensureIncidentTableReady();
  if (!ready) return { incidentId: null, skipped: "table_not_available" };
  const { data, error } = await nexSupabaseAdmin
    .from("nex_incident")
    .select("id")
    .eq("dedup_key", input.dedupKey)
    .eq("country", input.country)
    .not("status", "in", "(CLOSED,VERIFIED)")
    .order("detected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { incidentId: null };
  return { incidentId: (data as { id: string } | null)?.id ?? null };
}

/** Bump last_seen_at on an existing incident matching the dedup key
 *  + country. Returns bumped=true + the incident id when one was
 *  updated. Used by monitor signals that would otherwise storm the
 *  table with identical rows. */
export async function bumpIncidentLastSeen(
  input: BumpDedupInput,
): Promise<BumpDedupResult> {
  const lookup = await findOpenIncidentByDedupKey(input);
  if (lookup.skipped) return { bumped: false, skipped: "table_not_available" };
  if (!lookup.incidentId) return { bumped: false };
  const nowIso = new Date().toISOString();
  const { error } = await nexSupabaseAdmin
    .from("nex_incident")
    .update({ last_seen_at: nowIso, updated_at: nowIso })
    .eq("id", lookup.incidentId);
  if (error) return { bumped: false };
  return { bumped: true, incidentId: lookup.incidentId };
}

// ─── VERIFIED · operator verification (owner directive 2026-11-08 round 8) ───
//
// RECOVERED means auto-recovery CLAIMED. VERIFIED means an HQ operator
// has independently CONFIRMED the recovery. This function is the ONLY
// path into VERIFIED · it requires a real HQ-admin account id so the
// audit trail carries the verifier identity. The caller MUST have
// already re-checked requireHqAdmin at the server-action boundary.

export interface VerifyRecoveryInput {
  readonly incidentId: string;
  readonly verifierAccountId: string;
  readonly note?: string | null;
}

export async function verifyIncidentRecovery(
  input: VerifyRecoveryInput,
): Promise<TransitionResult> {
  const ready = await ensureIncidentTableReady();
  if (!ready) return { ok: false, error: "table_not_available" };

  const current = await nexSupabaseAdmin
    .from("nex_incident")
    .select("id, status")
    .eq("id", input.incidentId)
    .maybeSingle();
  if (current.error || !current.data) return { ok: false, error: "not_found" };

  const fromStatus = (current.data as { status: IncidentStatus }).status;
  if (!isLegalTransition(fromStatus, "VERIFIED")) {
    return { ok: false, error: "illegal_transition", fromStatus };
  }

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: "VERIFIED",
    verified_by_admin: input.verifierAccountId,
    verified_at: nowIso,
    resolved_at: nowIso,
    updated_at: nowIso,
    last_seen_at: nowIso,
  };

  const upd = await nexSupabaseAdmin
    .from("nex_incident")
    .update(patch)
    .eq("id", input.incidentId)
    .eq("status", fromStatus);
  if (upd.error) return { ok: false, error: "write_failed", fromStatus };

  await nexSupabaseAdmin.from("nex_incident_event").insert({
    incident_id: input.incidentId,
    kind: "verified",
    actor_account_id: input.verifierAccountId,
    from_status: fromStatus,
    to_status: "VERIFIED",
    note: input.note ? redactSummary(input.note) : null,
  });

  return { ok: true, fromStatus };
}

export interface RecoveryAttemptInput {
  readonly incidentId: string;
  readonly success: boolean;
  readonly note?: string | null;
  readonly actorAccountId?: string | null;
}

export async function recordRecoveryAttempt(
  input: RecoveryAttemptInput,
): Promise<{ ok: boolean; error?: string }> {
  const ready = await ensureIncidentTableReady();
  if (!ready) return { ok: false, error: "table_not_available" };
  const { error } = await nexSupabaseAdmin.from("nex_incident_event").insert({
    incident_id: input.incidentId,
    kind: input.success ? "recovery_success" : "recovery_failure",
    actor_account_id: input.actorAccountId ?? null,
    note: input.note ? redactSummary(input.note) : null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function acknowledgeIncident(
  incidentId: string,
  byAccountId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ready = await ensureIncidentTableReady();
  if (!ready) return { ok: false, error: "table_not_available" };
  const { error } = await nexSupabaseAdmin
    .from("nex_incident")
    .update({
      acknowledged_by: byAccountId,
      acknowledged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", incidentId);
  if (error) return { ok: false, error: error.message };
  await nexSupabaseAdmin.from("nex_incident_event").insert({
    incident_id: incidentId,
    kind: "acknowledged",
    actor_account_id: byAccountId,
  });
  return { ok: true };
}

// ─── Readers for HQ dashboard ────────────────────────────────────────

export interface IncidentRow {
  readonly id: string;
  readonly category: IncidentCategory;
  readonly severity: IncidentSeverity;
  readonly scope: IncidentScope;
  readonly country: IncidentCountry;
  readonly status: IncidentStatus;
  readonly summary: string | null;
  readonly recovery_action_taken: string | null;
  readonly users_affected_count: number;
  readonly admin_action_required: boolean;
  readonly detected_at: string;
  readonly resolved_at: string | null;
  readonly correlation_id: string | null;
  // Owner directive 2026-11-08 (round 8) Priority 2 · migration 304
  // fields exposed to readers. `verified_by_admin` + `verified_at`
  // populated only when status=VERIFIED. `last_seen_at` is always
  // populated. `detection_source` + `service` + `dedup_key` populated
  // for new rows; nullable for historical rows.
  readonly last_seen_at: string;
  readonly detection_source: IncidentDetectionSource;
  readonly service: string | null;
  readonly verified_by_admin: string | null;
  readonly verified_at: string | null;
  readonly dedup_key: string | null;
}

export interface IncidentSummaryCounts {
  readonly open: number;
  readonly open_critical: number;
  readonly open_high: number;
  readonly needs_admin: number;
  readonly awaiting_verification: number;
  readonly verified_last_24h: number;
  readonly recovered_last_24h: number;
  readonly closed_last_24h: number;
  readonly reopened_now: number;
  readonly by_country: Readonly<Record<IncidentCountry, number>>;
  readonly by_scope: Readonly<Record<string, number>>;
}

export async function fetchRecentIncidents(limit = 100): Promise<readonly IncidentRow[]> {
  const ready = await ensureIncidentTableReady();
  if (!ready) return [];
  const { data, error } = await nexSupabaseAdmin
    .from("nex_incident")
    .select(
      "id, category, severity, scope, country, status, summary, recovery_action_taken, users_affected_count, admin_action_required, detected_at, resolved_at, correlation_id, last_seen_at, detection_source, service, verified_by_admin, verified_at, dedup_key",
    )
    .order("detected_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as IncidentRow[];
}

// ─── Priority 3 · 5-state fetchers (owner directive 2026-11-08 round 9) ──
//
// HQ Alerts must distinguish 5 operator-meaningful states:
//   1. Needs action           · open incidents (not RECOVERED/VERIFIED/CLOSED)
//   2. Awaiting verification  · RECOVERED without a verifier stamp
//   3. Verified resolved      · VERIFIED
//   4. Recently closed        · CLOSED in the last 24h (reference only)
//   5. Reopened               · a NEW incident whose correlation_id matches
//                               a prior VERIFIED incident (regression signal)
//
// These are READ paths · bounded limits · no writes · no mutations.

/** Open incidents · not RECOVERED/VERIFIED/CLOSED. Operator-actionable. */
export async function fetchOpenIncidents(limit = 50): Promise<readonly IncidentRow[]> {
  const ready = await ensureIncidentTableReady();
  if (!ready) return [];
  const { data, error } = await nexSupabaseAdmin
    .from("nex_incident")
    .select(
      "id, category, severity, scope, country, status, summary, recovery_action_taken, users_affected_count, admin_action_required, detected_at, resolved_at, correlation_id, last_seen_at, detection_source, service, verified_by_admin, verified_at, dedup_key",
    )
    .not("status", "in", "(RECOVERED,VERIFIED,CLOSED)")
    .order("detected_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 200)));
  if (error) return [];
  return (data ?? []) as IncidentRow[];
}

/** RECOVERED without a verifier stamp · awaiting operator verification.
 *  Owner directive · RECOVERED is NOT a terminal success claim · it
 *  is a recovery ATTEMPT that still needs operator confirmation. */
export async function fetchAwaitingVerification(limit = 50): Promise<readonly IncidentRow[]> {
  const ready = await ensureIncidentTableReady();
  if (!ready) return [];
  const { data, error } = await nexSupabaseAdmin
    .from("nex_incident")
    .select(
      "id, category, severity, scope, country, status, summary, recovery_action_taken, users_affected_count, admin_action_required, detected_at, resolved_at, correlation_id, last_seen_at, detection_source, service, verified_by_admin, verified_at, dedup_key",
    )
    .eq("status", "RECOVERED")
    .is("verified_at", null)
    .order("last_seen_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 200)));
  if (error) return [];
  return (data ?? []) as IncidentRow[];
}

/** VERIFIED · operator has confirmed resolution. Carries verifier id. */
export async function fetchVerifiedIncidents(limit = 25): Promise<readonly IncidentRow[]> {
  const ready = await ensureIncidentTableReady();
  if (!ready) return [];
  const { data, error } = await nexSupabaseAdmin
    .from("nex_incident")
    .select(
      "id, category, severity, scope, country, status, summary, recovery_action_taken, users_affected_count, admin_action_required, detected_at, resolved_at, correlation_id, last_seen_at, detection_source, service, verified_by_admin, verified_at, dedup_key",
    )
    .eq("status", "VERIFIED")
    .order("verified_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 200)));
  if (error) return [];
  return (data ?? []) as IncidentRow[];
}

/** CLOSED in the last 24h · reference-only. */
export async function fetchRecentlyClosed(limit = 25): Promise<readonly IncidentRow[]> {
  const ready = await ensureIncidentTableReady();
  if (!ready) return [];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_incident")
    .select(
      "id, category, severity, scope, country, status, summary, recovery_action_taken, users_affected_count, admin_action_required, detected_at, resolved_at, correlation_id, last_seen_at, detection_source, service, verified_by_admin, verified_at, dedup_key",
    )
    .eq("status", "CLOSED")
    .gte("resolved_at", since)
    .order("resolved_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 200)));
  if (error) return [];
  return (data ?? []) as IncidentRow[];
}

/** Reopened · a NEW incident that shares a correlation_id with a prior
 *  VERIFIED incident. Signals a regression after an operator-confirmed
 *  resolution · highest-attention class.
 *
 *  Owner directive 2026-11-08 (round 8) was explicit: VERIFIED is a
 *  terminal "done" claim. We do NOT reopen the same row. We DO
 *  surface the correlation here so the operator sees the regression.
 */
export async function fetchReopened(limit = 25): Promise<readonly IncidentRow[]> {
  const ready = await ensureIncidentTableReady();
  if (!ready) return [];
  // Two-step: (1) find correlation_ids that have a VERIFIED row AND a
  // later open row. (2) return the later open rows.
  // A single query via not-exists-join isn't exposed by Supabase JS ·
  // we do two bounded reads and merge in-process.
  const verified = await nexSupabaseAdmin
    .from("nex_incident")
    .select("correlation_id, verified_at")
    .eq("status", "VERIFIED")
    .not("correlation_id", "is", null)
    .order("verified_at", { ascending: false })
    .limit(200);
  if (verified.error) return [];
  const verifiedCorr = new Map<string, string>();
  for (const r of (verified.data ?? []) as Array<{
    correlation_id: string | null;
    verified_at: string | null;
  }>) {
    if (r.correlation_id && r.verified_at) {
      // Keep the latest verified_at for each correlation_id.
      const existing = verifiedCorr.get(r.correlation_id);
      if (!existing || existing < r.verified_at) {
        verifiedCorr.set(r.correlation_id, r.verified_at);
      }
    }
  }
  if (verifiedCorr.size === 0) return [];
  const correlations = Array.from(verifiedCorr.keys());
  const open = await nexSupabaseAdmin
    .from("nex_incident")
    .select(
      "id, category, severity, scope, country, status, summary, recovery_action_taken, users_affected_count, admin_action_required, detected_at, resolved_at, correlation_id, last_seen_at, detection_source, service, verified_by_admin, verified_at, dedup_key",
    )
    .in("correlation_id", correlations)
    .not("status", "in", "(VERIFIED,CLOSED)")
    .order("detected_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 200)));
  if (open.error) return [];
  // Keep only incidents newer than the VERIFIED they correlate with.
  return ((open.data ?? []) as IncidentRow[]).filter((r) => {
    const verifiedAt = r.correlation_id ? verifiedCorr.get(r.correlation_id) : null;
    if (!verifiedAt) return false;
    return r.detected_at > verifiedAt;
  });
}

export async function fetchIncidentSummary(): Promise<IncidentSummaryCounts> {
  const ready = await ensureIncidentTableReady();
  const empty: IncidentSummaryCounts = {
    open: 0,
    open_critical: 0,
    open_high: 0,
    needs_admin: 0,
    awaiting_verification: 0,
    verified_last_24h: 0,
    recovered_last_24h: 0,
    closed_last_24h: 0,
    reopened_now: 0,
    by_country: { ireland: 0, indonesia: 0, worldwide: 0, hq: 0, global: 0 },
    by_scope: {},
  };
  if (!ready) return empty;
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // Owner directive 2026-11-08 (round 9) Priority 3 · VERIFIED is a
  // DISTINCT terminal state. "Open" now excludes it the same way it
  // excludes CLOSED. Awaiting-verification is its own count (RECOVERED
  // without a verifier stamp).
  const open = await nexSupabaseAdmin
    .from("nex_incident")
    .select("id", { count: "exact", head: true })
    .not("status", "in", "(RECOVERED,VERIFIED,CLOSED)");
  const openCrit = await nexSupabaseAdmin
    .from("nex_incident")
    .select("id", { count: "exact", head: true })
    .not("status", "in", "(RECOVERED,VERIFIED,CLOSED)")
    .eq("severity", "critical");
  const openHigh = await nexSupabaseAdmin
    .from("nex_incident")
    .select("id", { count: "exact", head: true })
    .not("status", "in", "(RECOVERED,VERIFIED,CLOSED)")
    .eq("severity", "high");
  const needsAdmin = await nexSupabaseAdmin
    .from("nex_incident")
    .select("id", { count: "exact", head: true })
    .eq("status", "NEEDS_ADMIN");
  const awaitingVerification = await nexSupabaseAdmin
    .from("nex_incident")
    .select("id", { count: "exact", head: true })
    .eq("status", "RECOVERED")
    .is("verified_at", null);
  const verified24 = await nexSupabaseAdmin
    .from("nex_incident")
    .select("id", { count: "exact", head: true })
    .eq("status", "VERIFIED")
    .gte("verified_at", yesterday);
  const rec = await nexSupabaseAdmin
    .from("nex_incident")
    .select("id", { count: "exact", head: true })
    .eq("status", "RECOVERED")
    .gte("last_seen_at", yesterday);
  const closed24 = await nexSupabaseAdmin
    .from("nex_incident")
    .select("id", { count: "exact", head: true })
    .eq("status", "CLOSED")
    .gte("resolved_at", yesterday);

  // Reopened · derive from the dedicated reader (bounded fetch).
  // Readers are cheap on sandbox volume · acceptable to call here.
  const reopened = await fetchReopened(25);

  // Country + scope breakdowns via list query (open only)
  const openList = await nexSupabaseAdmin
    .from("nex_incident")
    .select("country, scope")
    .not("status", "in", "(RECOVERED,VERIFIED,CLOSED)");
  const by_country: Record<IncidentCountry, number> = {
    ireland: 0,
    indonesia: 0,
    worldwide: 0,
    hq: 0,
    global: 0,
  };
  const by_scope: Record<string, number> = {};
  for (const row of (openList.data ?? []) as Array<{ country: IncidentCountry; scope: string }>) {
    by_country[row.country] = (by_country[row.country] ?? 0) + 1;
    by_scope[row.scope] = (by_scope[row.scope] ?? 0) + 1;
  }
  return {
    open: open.count ?? 0,
    open_critical: openCrit.count ?? 0,
    open_high: openHigh.count ?? 0,
    needs_admin: needsAdmin.count ?? 0,
    awaiting_verification: awaitingVerification.count ?? 0,
    verified_last_24h: verified24.count ?? 0,
    recovered_last_24h: rec.count ?? 0,
    closed_last_24h: closed24.count ?? 0,
    reopened_now: reopened.length,
    by_country,
    by_scope,
  };
}

export interface IncidentEventRow {
  readonly id: number;
  readonly kind: string;
  readonly at: string;
  readonly actor_account_id: string | null;
  readonly from_status: string | null;
  readonly to_status: string | null;
  readonly note: string | null;
}

export async function fetchIncidentEvents(
  incidentId: string,
): Promise<readonly IncidentEventRow[]> {
  const ready = await ensureIncidentTableReady();
  if (!ready) return [];
  const { data, error } = await nexSupabaseAdmin
    .from("nex_incident_event")
    .select("id, kind, at, actor_account_id, from_status, to_status, note")
    .eq("incident_id", incidentId)
    .order("at", { ascending: true });
  if (error) return [];
  return (data ?? []) as IncidentEventRow[];
}
