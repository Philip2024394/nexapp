// src/lib/nex-native/health/health-probes.ts
//
// NEX Security & Recovery · health probe framework.
// Owner-sealed 2026-11-08.
// -----------------------------------------------------------------------------
// Lightweight probes for the core dependencies NEX relies on. Each
// probe returns a structured result with:
//   · ok     · boolean
//   · status · "ok" | "degraded" | "down" | "unknown"
//   · latency_ms
//   · detail · short redacted explanation (never a raw stack trace
//     or credential)
//
// Rules
//   · Probes must be fast · wrapped in withTimeout where appropriate.
//   · Probes must be safe · a probe failure must NEVER mutate state.
//   · Probes report UNKNOWN when they cannot verify (per Rule § 13).
//     Never report HEALTHY on insufficient evidence.
//   · Probes do not record incidents themselves · callers compose
//     probes + the incident service.
//   · A probe runtime must be bounded. Default timeout: 2 000 ms.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";

export type ProbeStatus = "ok" | "degraded" | "down" | "unknown";

export interface ProbeResult {
  readonly name: string;
  readonly ok: boolean;
  readonly status: ProbeStatus;
  readonly latency_ms: number;
  readonly detail?: string;
  readonly at: string;
}

const DEFAULT_TIMEOUT_MS = 2_000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => T,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(onTimeout()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function now(): number {
  return performance?.now?.() ?? Date.now();
}

function redactDetail(raw: string): string {
  const safe = raw
    .replace(/eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g, "[REDACTED]")
    .replace(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, "[REDACTED]")
    .replace(/sk_[a-zA-Z0-9_]+/g, "[REDACTED]")
    .replace(/password[=:][^\s&]+/gi, "[REDACTED]")
    .slice(0, 200);
  return safe;
}

export async function probeDatabase(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ProbeResult> {
  const start = now();
  const result = await withTimeout(
    (async (): Promise<ProbeResult> => {
      try {
        const { error } = await nexSupabaseAdmin
          .from("nex_migration_history")
          .select("version")
          .limit(1);
        const latency = Math.round(now() - start);
        if (error) {
          return {
            name: "database",
            ok: false,
            status: "down",
            latency_ms: latency,
            detail: redactDetail(error.message),
            at: new Date().toISOString(),
          };
        }
        return {
          name: "database",
          ok: true,
          status: latency > 500 ? "degraded" : "ok",
          latency_ms: latency,
          at: new Date().toISOString(),
        };
      } catch (e) {
        return {
          name: "database",
          ok: false,
          status: "down",
          latency_ms: Math.round(now() - start),
          detail: redactDetail(e instanceof Error ? e.message : String(e)),
          at: new Date().toISOString(),
        };
      }
    })(),
    timeoutMs,
    () => ({
      name: "database",
      ok: false,
      status: "down" as const,
      latency_ms: timeoutMs,
      detail: "probe_timeout",
      at: new Date().toISOString(),
    }),
  );
  return result;
}

export async function probeStorage(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ProbeResult> {
  const start = now();
  const result = await withTimeout(
    (async (): Promise<ProbeResult> => {
      try {
        const { data, error } = await nexSupabaseAdmin.storage.listBuckets();
        const latency = Math.round(now() - start);
        if (error) {
          return {
            name: "storage",
            ok: false,
            status: "down",
            latency_ms: latency,
            detail: redactDetail(error.message),
            at: new Date().toISOString(),
          };
        }
        return {
          name: "storage",
          ok: true,
          status: latency > 800 ? "degraded" : "ok",
          latency_ms: latency,
          detail: `${data?.length ?? 0} buckets`,
          at: new Date().toISOString(),
        };
      } catch (e) {
        return {
          name: "storage",
          ok: false,
          status: "down",
          latency_ms: Math.round(now() - start),
          detail: redactDetail(e instanceof Error ? e.message : String(e)),
          at: new Date().toISOString(),
        };
      }
    })(),
    timeoutMs,
    () => ({
      name: "storage",
      ok: false,
      status: "down" as const,
      latency_ms: timeoutMs,
      detail: "probe_timeout",
      at: new Date().toISOString(),
    }),
  );
  return result;
}

export async function probeIncidentTable(): Promise<ProbeResult> {
  const start = now();
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_incident")
      .select("id")
      .limit(0);
    const latency = Math.round(now() - start);
    if (error) {
      return {
        name: "incident_table",
        ok: false,
        status: "unknown",
        latency_ms: latency,
        detail: "nex_incident missing · migration 300 not applied in this environment",
        at: new Date().toISOString(),
      };
    }
    return {
      name: "incident_table",
      ok: true,
      status: "ok",
      latency_ms: latency,
      at: new Date().toISOString(),
    };
  } catch (e) {
    return {
      name: "incident_table",
      ok: false,
      status: "unknown",
      latency_ms: Math.round(now() - start),
      detail: redactDetail(e instanceof Error ? e.message : String(e)),
      at: new Date().toISOString(),
    };
  }
}

export async function probeAuditTable(): Promise<ProbeResult> {
  const start = now();
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_security_audit_log")
      .select("id")
      .limit(0);
    const latency = Math.round(now() - start);
    if (error) {
      return {
        name: "audit_table",
        ok: false,
        status: "unknown",
        latency_ms: latency,
        detail: "nex_security_audit_log missing · migration 292 not applied",
        at: new Date().toISOString(),
      };
    }
    return {
      name: "audit_table",
      ok: true,
      status: "ok",
      latency_ms: latency,
      at: new Date().toISOString(),
    };
  } catch (e) {
    return {
      name: "audit_table",
      ok: false,
      status: "unknown",
      latency_ms: Math.round(now() - start),
      detail: redactDetail(e instanceof Error ? e.message : String(e)),
      at: new Date().toISOString(),
    };
  }
}

export async function probeAllCore(): Promise<readonly ProbeResult[]> {
  const results = await Promise.all([
    probeDatabase(),
    probeStorage(),
    probeIncidentTable(),
    probeAuditTable(),
  ]);
  return results;
}

/** Aggregate overall status · worst-wins. */
export function aggregateStatus(results: readonly ProbeResult[]): ProbeStatus {
  if (results.some((r) => r.status === "down")) return "down";
  if (results.some((r) => r.status === "degraded")) return "degraded";
  if (results.some((r) => r.status === "unknown")) return "unknown";
  return "ok";
}
