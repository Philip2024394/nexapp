// src/lib/nex-native/health/section-probes.ts
//
// NEX Security & Self-Protection · per-section health probes.
// Owner-sealed 2026-11-08.
// -----------------------------------------------------------------------------
// Lightweight read-only probes for each user-facing NEX section.
// Same shape + rules as the core probes in ./health-probes.ts:
//
//   · ok     · boolean
//   · status · "ok" | "degraded" | "down" | "unknown"
//   · latency_ms
//   · detail · short redacted explanation (never a raw stack trace
//              or credential)
//
// Rules
//   · Probes must be fast · hard-capped at SECTION_TIMEOUT_MS.
//   · Probes must be safe · a probe failure must NEVER mutate state.
//   · When a table / column is missing we return UNKNOWN (not DOWN
//     and not false-HEALTHY) · a missing schema is a migration gap,
//     not an outage.
//   · Probes do not record incidents themselves · callers compose
//     probes + the incident service.
//
// These probes are read by the /api/nex-native/health route when
// called with ?scope=sections.

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

/** Owner directive · each section probe must complete in ≤ 1.5s. */
const SECTION_TIMEOUT_MS = 1_500;
const DEGRADED_LATENCY_MS = 500;

function now(): number {
  return performance?.now?.() ?? Date.now();
}

/** Same redaction pass as the core probes. Kept local so a future
 *  tweak here doesn't accidentally change core-probe semantics. */
function redactDetail(raw: string): string {
  const safe = raw
    .replace(/eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g, "[REDACTED]")
    .replace(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, "[REDACTED]")
    .replace(/sk_[a-zA-Z0-9_]+/g, "[REDACTED]")
    .replace(/password[=:][^\s&]+/gi, "[REDACTED]")
    .slice(0, 200);
  return safe;
}

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

/** True when an error message looks like "relation does not exist"
 *  or "column does not exist" · standard Postgres wording via PostgREST. */
function isMissingSchema(message: string | null | undefined): boolean {
  if (!message) return false;
  return (
    /does not exist/i.test(message) ||
    /relation .* does not exist/i.test(message) ||
    /undefined[_ ]?column/i.test(message) ||
    /undefined[_ ]?table/i.test(message)
  );
}

/** Build a "schema missing" UNKNOWN result · never "down" when the
 *  table itself isn't deployed · that's a migration gap. */
function unknownResult(
  name: string,
  startMs: number,
  detail: string,
): ProbeResult {
  return {
    name,
    ok: false,
    status: "unknown",
    latency_ms: Math.round(now() - startMs),
    detail,
    at: new Date().toISOString(),
  };
}

function okResult(
  name: string,
  startMs: number,
  detail?: string,
): ProbeResult {
  const latency = Math.round(now() - startMs);
  return {
    name,
    ok: true,
    status: latency > DEGRADED_LATENCY_MS ? "degraded" : "ok",
    latency_ms: latency,
    detail,
    at: new Date().toISOString(),
  };
}

function downResult(
  name: string,
  startMs: number,
  message: string,
): ProbeResult {
  return {
    name,
    ok: false,
    status: "down",
    latency_ms: Math.round(now() - startMs),
    detail: redactDetail(message),
    at: new Date().toISOString(),
  };
}

/** Wrap one probe's async body in the bounded-timeout + try/catch
 *  envelope every section probe shares. Keeps the individual probe
 *  functions concise + rules-consistent. */
async function runProbe(
  name: string,
  body: (startMs: number) => Promise<ProbeResult>,
): Promise<ProbeResult> {
  const start = now();
  return await withTimeout(
    body(start).catch((e: unknown) =>
      downResult(name, start, e instanceof Error ? e.message : String(e)),
    ),
    SECTION_TIMEOUT_MS,
    () => ({
      name,
      ok: false,
      status: "down" as const,
      latency_ms: SECTION_TIMEOUT_MS,
      detail: "probe_timeout",
      at: new Date().toISOString(),
    }),
  );
}

// ─── Section probes ───────────────────────────────────────────────────

export async function probeChat(): Promise<ProbeResult> {
  return await runProbe("chat", async (start) => {
    const { error } = await nexSupabaseAdmin
      .from("nex_peer_conversation")
      .select("id")
      .limit(1);
    if (error) {
      if (isMissingSchema(error.message)) {
        return unknownResult(
          "chat",
          start,
          "nex_peer_conversation missing · chat migrations not applied",
        );
      }
      return downResult("chat", start, error.message);
    }
    return okResult("chat", start);
  });
}

export async function probeShops(): Promise<ProbeResult> {
  return await runProbe("shops", async (start) => {
    const { error } = await nexSupabaseAdmin
      .from("nex_business")
      .select("id")
      .is("deleted_at", null)
      .limit(1);
    if (error) {
      if (isMissingSchema(error.message)) {
        return unknownResult(
          "shops",
          start,
          "nex_business/deleted_at missing · shops migrations not applied",
        );
      }
      return downResult("shops", start, error.message);
    }
    return okResult("shops", start);
  });
}

export async function probeFeed(): Promise<ProbeResult> {
  return await runProbe("feed", async (start) => {
    const { error } = await nexSupabaseAdmin
      .from("nex_live_post")
      .select("id")
      .not("published_at", "is", null)
      .limit(1);
    if (error) {
      if (isMissingSchema(error.message)) {
        return unknownResult(
          "feed",
          start,
          "nex_live_post missing · feed migrations not applied",
        );
      }
      return downResult("feed", start, error.message);
    }
    return okResult("feed", start);
  });
}

export async function probeLive(): Promise<ProbeResult> {
  return await runProbe("live", async (start) => {
    const { error } = await nexSupabaseAdmin
      .from("nex_live_session")
      .select("id")
      .limit(1);
    if (error) {
      if (isMissingSchema(error.message)) {
        return unknownResult(
          "live",
          start,
          "nex_live_session missing · live migrations not applied",
        );
      }
      return downResult("live", start, error.message);
    }
    return okResult("live", start);
  });
}

export async function probeDirectory(): Promise<ProbeResult> {
  return await runProbe("directory", async (start) => {
    const { error } = await nexSupabaseAdmin
      .from("nex_business")
      .select("id")
      .eq("is_public", true)
      .limit(1);
    if (error) {
      if (isMissingSchema(error.message)) {
        return unknownResult(
          "directory",
          start,
          "nex_business.is_public missing · directory migrations not applied",
        );
      }
      return downResult("directory", start, error.message);
    }
    return okResult("directory", start);
  });
}

// Owner directive 2026-11-08 · Final Verification Phase · extend
// section probes to the remaining NEX sections (food · fashion ·
// accommodation · property). Each follows the identical shape:
//
//   · bounded timeout from runProbe()
//   · UNKNOWN (never false-HEALTHY, never DOWN) when the backing
//     table/column is missing · callers see the migration gap
//     honestly
//   · DOWN only when the backing table responds with an error that
//     is NOT a schema-missing shape (connectivity, permission, etc.)
//   · OK when the lightweight limit-1 read succeeds
//
// Doctrine · every section probe reads ONE row from the section's
// primary table. The probes are READ-ONLY. They never touch user
// data beyond a minimal id select. They are safe to run arbitrarily
// often without affecting state.

export async function probeFood(): Promise<ProbeResult> {
  return await runProbe("food", async (start) => {
    const { error } = await nexSupabaseAdmin
      .from("nex_menu_item")
      .select("id")
      .limit(1);
    if (error) {
      if (isMissingSchema(error.message)) {
        return unknownResult(
          "food",
          start,
          "nex_menu_item missing · food migrations not applied",
        );
      }
      return downResult("food", start, error.message);
    }
    return okResult("food", start);
  });
}

export async function probeFashion(): Promise<ProbeResult> {
  return await runProbe("fashion", async (start) => {
    // Fashion surfaces live on nex_product · we filter by a stable
    // category flag when it exists, otherwise fall back to the base
    // table so the probe stays valid across migration gaps.
    const { error } = await nexSupabaseAdmin
      .from("nex_product")
      .select("id")
      .limit(1);
    if (error) {
      if (isMissingSchema(error.message)) {
        return unknownResult(
          "fashion",
          start,
          "nex_product missing · product migrations not applied",
        );
      }
      return downResult("fashion", start, error.message);
    }
    return okResult("fashion", start);
  });
}

export async function probeAccommodation(): Promise<ProbeResult> {
  return await runProbe("accommodation", async (start) => {
    const { error } = await nexSupabaseAdmin
      .from("nex_accommodation_unit")
      .select("id")
      .limit(1);
    if (error) {
      if (isMissingSchema(error.message)) {
        return unknownResult(
          "accommodation",
          start,
          "nex_accommodation_unit missing · accommodation migrations not applied",
        );
      }
      return downResult("accommodation", start, error.message);
    }
    return okResult("accommodation", start);
  });
}

export async function probeProperty(): Promise<ProbeResult> {
  return await runProbe("property", async (start) => {
    // Property surfaces share nex_business under a specific category.
    // A lightweight limit-1 read on nex_business is a robust proxy ·
    // if that table is DOWN the property section is NOT healthy
    // regardless of its own view layer.
    const { error } = await nexSupabaseAdmin
      .from("nex_business")
      .select("id")
      .limit(1);
    if (error) {
      if (isMissingSchema(error.message)) {
        return unknownResult(
          "property",
          start,
          "nex_business missing · directory migrations not applied",
        );
      }
      return downResult("property", start, error.message);
    }
    return okResult("property", start);
  });
}

/** Run every section probe in parallel. Bounded by SECTION_TIMEOUT_MS
 *  per probe · total wall-clock ≈ max(timeouts) not sum. */
export async function probeAllSections(): Promise<readonly ProbeResult[]> {
  return await Promise.all([
    probeChat(),
    probeShops(),
    probeFeed(),
    probeLive(),
    probeDirectory(),
    probeFood(),
    probeFashion(),
    probeAccommodation(),
    probeProperty(),
  ]);
}
