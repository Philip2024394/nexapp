// src/lib/nex-native/security-monitor/security-monitor.ts
//
// NEX Security & Recovery · security-signal → incident monitor.
// Owner-sealed 2026-11-08.
// -----------------------------------------------------------------------------
// Converts domain-specific security signals (rate-limit escalations,
// authentication anomalies, audit-table unavailability, degraded
// dependencies) into incidents via the incident service.
//
// This module is a THIN ADAPTOR. It does NOT:
//   · catch generic exceptions (callers do that at the surface)
//   · decide user-visible responses (callers do that)
//   · retry anything (that is the recovery library's job)
//
// It DOES:
//   · dedupe signals that arrive in bursts (per-signature cooldown)
//   · classify severity based on signal + optional override
//   · emit incidents with redacted summaries
//   · fail-safe · a monitor write failure NEVER propagates to the
//     user flow that triggered the signal
//
// Country awareness
//   The monitor reads NEX_APP_IDENTITY / NEX_APP_COUNTRY from the
//   environment and tags incidents accordingly. A fault scoped to
//   Ireland shows up as country=ireland · HQ gets visibility without
//   fragmenting the model into parallel per-country tables.

import "server-only";
import {
  createIncident,
  type IncidentCategory,
  type IncidentCountry,
  type IncidentScope,
  type IncidentSeverity,
} from "../incident/incident-service";

// Per-signature dedup cooldown · suppresses incident creation for
// the same signature within the window. Default 60s. Caller may
// override but may NOT disable.
const DEDUP_WINDOW_MS = 60_000;
const DEDUP_MAX_ENTRIES = 1024;
const DEDUP = new Map<string, number>();

function dedupKeyBase(scope: IncidentScope, category: IncidentCategory, extra?: string): string {
  return `${scope}|${category}|${extra ?? ""}`;
}

function markSignalFresh(key: string): boolean {
  const now = Date.now();
  const prev = DEDUP.get(key);
  if (prev && now - prev < DEDUP_WINDOW_MS) return false;
  // Bound the map · drop oldest half when at capacity.
  if (DEDUP.size >= DEDUP_MAX_ENTRIES) {
    const cutoff = now - DEDUP_WINDOW_MS;
    for (const [k, v] of DEDUP) {
      if (v < cutoff) DEDUP.delete(k);
      if (DEDUP.size < DEDUP_MAX_ENTRIES / 2) break;
    }
  }
  DEDUP.set(key, now);
  return true;
}

/** Exposed for tests. */
export function _resetMonitorDedupForTests(): void {
  DEDUP.clear();
}

function resolveCountry(): IncidentCountry {
  const raw = (process.env.NEX_APP_COUNTRY ?? "").toLowerCase();
  if (raw === "ireland" || raw === "indonesia" || raw === "worldwide" || raw === "hq") {
    return raw as IncidentCountry;
  }
  return "global";
}

// ─── Signal → incident adaptors ─────────────────────────────────────

export interface RateLimitEscalationSignal {
  readonly action: string;
  readonly scope: IncidentScope;
  readonly affectedCount: number;
  readonly thresholdCrossed: number;
  readonly windowSeconds: number;
}

/** Called when the rate-limiter escalates to a 503 (owner-defined
 *  attack / sustained-fault signal). Emits a critical attack
 *  incident · dedupe key includes the action. */
export async function reportRateLimitEscalation(
  signal: RateLimitEscalationSignal,
): Promise<{ created: boolean; incidentId?: string; skipped?: string }> {
  const key = dedupKeyBase("auth", "attack", signal.action);
  if (!markSignalFresh(key)) return { created: false, skipped: "dedup_suppressed" };
  const res = await createIncident({
    category: "attack",
    severity: "critical",
    scope: signal.scope,
    country: resolveCountry(),
    summary: `rate-limit escalation · action=${signal.action} · threshold=${signal.thresholdCrossed} crossed in ${signal.windowSeconds}s · affected=${signal.affectedCount}`,
    adminActionRequired: true,
    usersAffectedCount: Math.max(0, signal.affectedCount),
  });
  if (!res.ok) return { created: false, skipped: res.skipped ?? "incident_write_failed" };
  return { created: true, incidentId: res.incidentId };
}

export interface AuthAnomalySignal {
  readonly kind:
    | "repeated_wrong_password"
    | "unknown_credential"
    | "counter_rollback_detected"
    | "session_reuse_after_revoke";
  readonly affectedAccountId?: string | null;
  readonly correlationId?: string | null;
}

export async function reportAuthAnomaly(
  signal: AuthAnomalySignal,
): Promise<{ created: boolean; incidentId?: string; skipped?: string }> {
  const key = dedupKeyBase("auth", "security", signal.kind);
  if (!markSignalFresh(key)) return { created: false, skipped: "dedup_suppressed" };
  const severity: IncidentSeverity =
    signal.kind === "counter_rollback_detected" ? "critical" : "warn";
  const res = await createIncident({
    category: "auth",
    severity,
    scope: "auth",
    country: resolveCountry(),
    summary: `auth anomaly · ${signal.kind}`,
    correlationId: signal.correlationId ?? null,
    adminActionRequired: severity === "critical",
  });
  if (!res.ok) return { created: false, skipped: res.skipped ?? "incident_write_failed" };
  return { created: true, incidentId: res.incidentId };
}

export interface DependencyDegradationSignal {
  readonly dependency: "database" | "storage" | "auth" | "audit" | "incident";
  readonly reason: "down" | "degraded" | "unknown" | "unavailable";
  readonly scope: IncidentScope;
  readonly latency_ms?: number;
}

export async function reportDependencyDegradation(
  signal: DependencyDegradationSignal,
): Promise<{ created: boolean; incidentId?: string; skipped?: string }> {
  const key = dedupKeyBase(signal.scope, "degraded", `${signal.dependency}:${signal.reason}`);
  if (!markSignalFresh(key)) return { created: false, skipped: "dedup_suppressed" };
  const severity: IncidentSeverity = signal.reason === "down" ? "critical" : "warn";
  const res = await createIncident({
    category: "degraded",
    severity,
    scope: signal.scope,
    country: resolveCountry(),
    summary: `dependency ${signal.dependency} · ${signal.reason}${
      signal.latency_ms !== undefined ? ` · latency=${signal.latency_ms}ms` : ""
    }`,
    adminActionRequired: severity === "critical",
  });
  if (!res.ok) return { created: false, skipped: res.skipped ?? "incident_write_failed" };
  return { created: true, incidentId: res.incidentId };
}

export interface AuditPersistenceFailureSignal {
  readonly event: string;
  readonly stage: "attempted" | "completion";
}

export async function reportAuditPersistenceFailure(
  signal: AuditPersistenceFailureSignal,
): Promise<{ created: boolean; incidentId?: string; skipped?: string }> {
  const key = dedupKeyBase("auth", "security", `audit_fail:${signal.event}:${signal.stage}`);
  if (!markSignalFresh(key)) return { created: false, skipped: "dedup_suppressed" };
  const res = await createIncident({
    category: "security",
    severity: "critical",
    scope: "auth",
    country: resolveCountry(),
    summary: `audit persistence failure · ${signal.event} ${signal.stage}`,
    adminActionRequired: true,
  });
  if (!res.ok) return { created: false, skipped: res.skipped ?? "incident_write_failed" };
  return { created: true, incidentId: res.incidentId };
}

export interface RecoveryAttemptSignal {
  readonly scope: IncidentScope;
  readonly category: IncidentCategory;
  readonly success: boolean;
  readonly action: string;
  readonly summary: string;
}

/** Record a recovery event · not necessarily a critical incident ·
 *  used by the recovery primitives (retry, circuit-breaker) to leave
 *  a trail when they engage. */
export async function reportRecoveryAttempt(
  signal: RecoveryAttemptSignal,
): Promise<{ created: boolean; incidentId?: string; skipped?: string }> {
  const key = dedupKeyBase(signal.scope, signal.category, `recovery:${signal.action}`);
  if (!markSignalFresh(key)) return { created: false, skipped: "dedup_suppressed" };
  const res = await createIncident({
    category: signal.success ? "recovery" : signal.category,
    severity: signal.success ? "info" : "warn",
    scope: signal.scope,
    country: resolveCountry(),
    summary: signal.summary,
    adminActionRequired: !signal.success,
  });
  if (!res.ok) return { created: false, skipped: res.skipped ?? "incident_write_failed" };
  return { created: true, incidentId: res.incidentId };
}
