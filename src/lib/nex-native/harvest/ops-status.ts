// src/lib/nex-native/harvest/ops-status.ts
//
// Pure state resolver for NEX harvest operations.
// ------------------------------------------------
// Given a snapshot of (env config, programme config, nex.aof_cycle
// evidence, current time), returns ONE of seven possible statuses +
// a concrete reason + evidence pack the dashboard can display.
//
// Pure · no DB · no network · no server-only · importable from
// vitest. All inputs are passed in by the caller; the resolver
// never reads process.env or Date.now() itself so tests are
// deterministic.
//
// Secret safety:
//   · The snapshot only carries `cronSecretPresent: boolean` + a
//     parallel `customSecretPresent: boolean`. Actual secret values
//     NEVER enter this module. The result returned by the resolver
//     is also secret-free by construction.

export type HarvestOpsStatus =
  | "not_configured"
  | "waiting_for_run"
  | "running"
  | "succeeded"
  | "partial"
  | "failed"
  | "stale";

export interface HarvestTickCycle {
  readonly cycleId: string;
  readonly startedAt: string;         // ISO 8601
  readonly endedAt: string | null;    // ISO 8601 · null when still running
  readonly endedKind: string | null;  // 'completed' | 'failed' | 'aborted' | …
  readonly candidatesAdded: number | null;
  readonly evidenceAdded: number | null;
  readonly triggeredBy: string;       // 'nexapp-harvester-tick:<city-id>'
  readonly cityId: string | null;     // extracted from triggeredBy
  readonly sourcesAttempted: readonly string[];
  readonly sourcesSucceeded: readonly string[];
  readonly sourcesCooledDown: readonly string[];
  readonly durationMs: number | null;
}

export interface HarvestOpsSnapshot {
  // ─── Environment · presence only · NEVER the value ───
  readonly cronSecretPresent: boolean;
  readonly customSecretPresent: boolean;

  // ─── Programme config ───
  readonly programmeCountryCount: number;
  readonly programmeCountryIsos: readonly string[];

  // ─── Cycle evidence ─── (filtered to triggered_by nexapp-harvester-tick:…)
  readonly latestTickCycle: HarvestTickCycle | null;
  readonly latestSuccessfulTickCycle: HarvestTickCycle | null;
  readonly recentTickCycles: readonly HarvestTickCycle[];
  readonly totalTickCycles: number;

  // ─── Exact run-to-record verification ───
  // Count of nex.business_canonical rows whose metadata.cycle_id
  // matches `latestTickCycle.cycleId`. Compared against
  // aof_cycle.candidates_added to prove whether the writer's reported
  // insert count actually landed in the canonical table. Null when
  // (a) no latest cycle exists, (b) the cycle predates cycle_id
  // stamping, or (c) the verification query failed.
  readonly latestCycleVerifiedCount: number | null;

  // ─── Time ───
  readonly nowMs: number;
  readonly expectedScheduleIntervalMinutes: number; // 60 for hourly cron
  readonly maxExpectedRuntimeMinutes: number;        // 5 (300s Vercel ceiling + buffer)
}

export interface HarvestOpsEvidence {
  readonly cronSecretPresent: boolean;
  readonly programmeCountryCount: number;
  readonly totalTickCycles: number;
  readonly latestTickCycleId: string | null;
  readonly latestTickCycleStartedAt: string | null;
  readonly latestTickCycleEndedKind: string | null;
  readonly latestTickCycleCity: string | null;
  readonly latestTickCycleCandidates: number | null;
  readonly latestTickCycleSourcesCooledDown: readonly string[];
  readonly latestSuccessfulCycleEndedAt: string | null;
  readonly latestSuccessfulCycleAgeMs: number | null;
  readonly scheduleIntervalMinutes: number;
  readonly latestCycleClaimedCount: number | null;
  readonly latestCycleVerifiedCount: number | null;
  readonly latestCycleCountsMatch: boolean | null;
}

export interface HarvestOpsResult {
  readonly status: HarvestOpsStatus;
  readonly reason: string;
  readonly actionHint: string;
  readonly evidence: HarvestOpsEvidence;
}

/** Resolve the single current ops status for the harvester, given a
 *  complete snapshot. Pure · deterministic. */
export function resolveHarvestOpsStatus(
  snapshot: HarvestOpsSnapshot,
): HarvestOpsResult {
  const evidence = buildEvidence(snapshot);

  // ─── 1. not_configured ───────────────────────────────────────────
  if (!snapshot.cronSecretPresent && !snapshot.customSecretPresent) {
    return {
      status: "not_configured",
      reason:
        "Neither CRON_SECRET nor NEX_HARVEST_CRON_SECRET is set. Scheduled cron requests cannot authenticate.",
      actionHint:
        "Set CRON_SECRET (opaque 32+ char string) in the Vercel project env vars for the production deployment, then redeploy.",
      evidence,
    };
  }
  if (snapshot.programmeCountryCount === 0) {
    return {
      status: "not_configured",
      reason:
        "No countries are opted into the discovery programme. The tick route would exit before picking a city.",
      actionHint:
        "Apply migration 187 (seeds US + AU) and verify existing opt-ins in nex.discovery_programme_country.",
      evidence,
    };
  }

  // ─── 2. waiting_for_run ──────────────────────────────────────────
  if (!snapshot.latestTickCycle) {
    return {
      status: "waiting_for_run",
      reason:
        "No harvester-tick cycle rows have been recorded. The scheduled cron has not yet produced evidence of a run.",
      actionHint:
        "Wait for the next hourly cron fire, OR POST /api/nex-native/harvest/tick with a matching bearer to trigger one manually.",
      evidence,
    };
  }

  const latest = snapshot.latestTickCycle;

  // ─── 3. running ──────────────────────────────────────────────────
  if (!latest.endedAt) {
    const startedMs = parseIsoMs(latest.startedAt);
    if (startedMs === null) {
      // Malformed started_at · treat as failed, we can't verify running state honestly.
      return {
        status: "failed",
        reason:
          "Latest cycle row has a malformed started_at timestamp; cannot determine run state.",
        actionHint:
          "Inspect the row directly in nex.aof_cycle and re-record with a valid timestamp.",
        evidence,
      };
    }
    const ageMs = snapshot.nowMs - startedMs;
    const maxRuntimeMs =
      snapshot.maxExpectedRuntimeMinutes * 60 * 1000;
    if (ageMs >= 0 && ageMs < maxRuntimeMs) {
      return {
        status: "running",
        reason: `Latest run started ${formatAgeShort(ageMs)} ago and has not yet recorded an end time.`,
        actionHint:
          "Wait for the run to complete. The Vercel function ceiling is 300s; if the row never gets an end_time, it timed out silently.",
        evidence,
      };
    }
    // Started longer ago than the max runtime without ending · silent timeout.
    return {
      status: "failed",
      reason: `Latest run started ${formatAgeShort(ageMs)} ago but never recorded an end-time (max expected runtime ${snapshot.maxExpectedRuntimeMinutes} min).`,
      actionHint:
        "Likely a Vercel function timeout. Inspect function logs around the start timestamp and check Overpass host latency.",
      evidence,
    };
  }

  // ─── 4. failed · ended_kind explicitly says failed/aborted ──────
  if (latest.endedKind === "failed" || latest.endedKind === "aborted") {
    return {
      status: "failed",
      reason: `Latest run ended with ended_kind='${latest.endedKind}'. Sources attempted: [${latest.sourcesAttempted.join(", ")}]; succeeded: [${latest.sourcesSucceeded.join(", ") || "none"}].`,
      actionHint:
        "Check function logs. Common causes: all Overpass hosts rate-limited, DNS failure, or malformed bbox.",
      evidence,
    };
  }

  // ─── 5. partial · completed but with cooled-down signals ────────
  if (latest.endedKind === "completed" && latest.sourcesCooledDown.length > 0) {
    return {
      status: "partial",
      reason: `Latest run completed but some stages flagged (cooled_down: [${latest.sourcesCooledDown.join(", ")}]).`,
      actionHint:
        "Check function logs for canonical_writer errors (per-row INSERT failures) or Overpass partial responses.",
      evidence,
    };
  }

  // ─── 6. stale · latest succeeded but was long ago ───────────────
  if (snapshot.latestSuccessfulTickCycle?.endedAt) {
    const successMs = parseIsoMs(snapshot.latestSuccessfulTickCycle.endedAt);
    if (successMs !== null) {
      const ageMs = snapshot.nowMs - successMs;
      const staleThresholdMs =
        snapshot.expectedScheduleIntervalMinutes * 60 * 1000 * 2;
      if (ageMs > staleThresholdMs) {
        return {
          status: "stale",
          reason: `Last successful run was ${formatAgeShort(ageMs)} ago. Schedule expects a run every ${snapshot.expectedScheduleIntervalMinutes} minutes; stale threshold is 2× that.`,
          actionHint:
            "Verify Vercel cron is still enabled for this deployment, and that no middleware is blocking /api/nex-native/harvest/tick.",
          evidence,
        };
      }
    }
  }

  // ─── 7. succeeded ────────────────────────────────────────────────
  if (latest.endedKind === "completed") {
    return {
      status: "succeeded",
      reason: `Latest run completed with ${latest.candidatesAdded ?? 0} candidate(s) added for city ${latest.cityId ?? "(unknown)"}.`,
      actionHint:
        "No action required. Keep publication gates (source_registry.can_display + business_media.approved) in place.",
      evidence,
    };
  }

  // ─── 8. unknown ended_kind · treat as failed, honestly ──────────
  return {
    status: "failed",
    reason: `Latest run has an unrecognised ended_kind='${latest.endedKind ?? "null"}'. Cannot classify as succeeded.`,
    actionHint:
      "Inspect the aof_cycle row directly. Expected values are 'completed', 'failed', 'aborted'.",
    evidence,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function buildEvidence(snapshot: HarvestOpsSnapshot): HarvestOpsEvidence {
  const latest = snapshot.latestTickCycle;
  const success = snapshot.latestSuccessfulTickCycle;
  const successAgeMs =
    success?.endedAt && parseIsoMs(success.endedAt) !== null
      ? snapshot.nowMs - (parseIsoMs(success.endedAt) as number)
      : null;
  const claimed = latest?.candidatesAdded ?? null;
  const verified = snapshot.latestCycleVerifiedCount;
  const countsMatch =
    claimed !== null && verified !== null ? claimed === verified : null;
  return {
    cronSecretPresent:
      snapshot.cronSecretPresent || snapshot.customSecretPresent,
    programmeCountryCount: snapshot.programmeCountryCount,
    totalTickCycles: snapshot.totalTickCycles,
    latestTickCycleId: latest?.cycleId ?? null,
    latestTickCycleStartedAt: latest?.startedAt ?? null,
    latestTickCycleEndedKind: latest?.endedKind ?? null,
    latestTickCycleCity: latest?.cityId ?? null,
    latestTickCycleCandidates: latest?.candidatesAdded ?? null,
    latestTickCycleSourcesCooledDown: latest?.sourcesCooledDown ?? [],
    latestSuccessfulCycleEndedAt: success?.endedAt ?? null,
    latestSuccessfulCycleAgeMs: successAgeMs,
    scheduleIntervalMinutes: snapshot.expectedScheduleIntervalMinutes,
    latestCycleClaimedCount: claimed,
    latestCycleVerifiedCount: verified,
    latestCycleCountsMatch: countsMatch,
  };
}

function parseIsoMs(iso: string | null | undefined): number | null {
  if (typeof iso !== "string") return null;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : null;
}

/** Extract the city_id from a triggered_by that follows the
 *  convention `nexapp-harvester-tick:<city-id>`. Returns null for
 *  anything else · the resolver treats null as unknown-city. */
export function cityIdFromTriggeredBy(triggeredBy: string | null): string | null {
  if (typeof triggeredBy !== "string") return null;
  const m = /^nexapp-harvester-tick:(.+)$/.exec(triggeredBy);
  return m ? m[1] : null;
}

/** Format a positive ms duration into a short human string.
 *  "3s", "47s", "2m 15s", "4h 20m", "3d" · deterministic. */
export function formatAgeShort(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "unknown";
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  if (min < 60) return `${min}m ${totalSec % 60}s`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}
