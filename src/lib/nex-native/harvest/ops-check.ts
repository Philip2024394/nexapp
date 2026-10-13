// src/lib/nex-native/harvest/ops-check.ts
//
// Server-only snapshot builder for the harvest ops status.
// --------------------------------------------------------
// Reads:
//   · env var PRESENCE (never the value) for CRON_SECRET +
//     NEX_HARVEST_CRON_SECRET
//   · nex.discovery_programme_country row count + ISO list
//   · nex.aof_cycle filtered to triggered_by LIKE
//     'nexapp-harvester-tick:%' · last 20 rows + the latest
//     successful one
//
// Does NOT:
//   · call Overpass or any external HTTP
//   · insert / update any row
//   · apply migrations
//   · touch nex.source_registry, nex.business_media, or lifecycle
//     state on business_canonical
//
// Returns null when the database is unreachable so the UI can show
// "unavailable" rather than falsely claiming a healthy state.

import "server-only";
import { withClient } from "@/lib/nex/db";
import {
  cityIdFromTriggeredBy,
  type HarvestOpsSnapshot,
  type HarvestTickCycle,
} from "./ops-status";

interface AofCycleRow {
  cycle_id: string;
  started_at: string | null;
  ended_at: string | null;
  ended_kind: string | null;
  candidates_added: number | null;
  evidence_added: number | null;
  triggered_by: string | null;
  sources_attempted: string[] | null;
  sources_succeeded: string[] | null;
  sources_cooled_down: string[] | null;
}

const SCHEDULE_INTERVAL_MINUTES = 60;
const MAX_EXPECTED_RUNTIME_MINUTES = 5;
const TRIGGER_PREFIX = "nexapp-harvester-tick:";

export async function buildHarvestOpsSnapshot(): Promise<HarvestOpsSnapshot | null> {
  const cronSecretPresent = typeof process.env.CRON_SECRET === "string" && process.env.CRON_SECRET.trim().length > 0;
  const customSecretPresent =
    typeof process.env.NEX_HARVEST_CRON_SECRET === "string" &&
    process.env.NEX_HARVEST_CRON_SECRET.trim().length > 0;

  const result = await withClient(async (client): Promise<Omit<HarvestOpsSnapshot, "cronSecretPresent" | "customSecretPresent" | "nowMs" | "expectedScheduleIntervalMinutes" | "maxExpectedRuntimeMinutes">> => {
    // ─── programme opt-in ─────────────────────────────────────────
    const programme = (await client
      .query(
        `SELECT iso_alpha_2
           FROM nex.discovery_programme_country
          WHERE included = true
       ORDER BY iso_alpha_2`,
      )
      .catch(() => ({ rows: [] as Array<{ iso_alpha_2: string }> }))) as {
      rows: Array<{ iso_alpha_2: string }>;
    };
    const programmeCountryIsos = programme.rows.map((r) =>
      r.iso_alpha_2.toUpperCase(),
    );

    // ─── latest N nexapp-harvester-tick cycles ────────────────────
    // Important · filter server-side so we read only our own rows and
    // not the standalone-daemon rows (triggered_by starts with
    // different prefixes for those).
    const recent = (await client
      .query(
        `SELECT cycle_id::text, started_at::text, ended_at::text,
                ended_kind, candidates_added, evidence_added,
                triggered_by, sources_attempted, sources_succeeded,
                sources_cooled_down
           FROM nex.aof_cycle
          WHERE triggered_by LIKE $1
       ORDER BY started_at DESC
          LIMIT 20`,
        [`${TRIGGER_PREFIX}%`],
      )
      .catch(() => ({ rows: [] as AofCycleRow[] }))) as { rows: AofCycleRow[] };

    const recentTickCycles: HarvestTickCycle[] = recent.rows.map(toTickCycle);
    const latestTickCycle = recentTickCycles[0] ?? null;

    // ─── latest SUCCESSFUL cycle · for stale check ────────────────
    const success = (await client
      .query(
        `SELECT cycle_id::text, started_at::text, ended_at::text,
                ended_kind, candidates_added, evidence_added,
                triggered_by, sources_attempted, sources_succeeded,
                sources_cooled_down
           FROM nex.aof_cycle
          WHERE triggered_by LIKE $1
            AND ended_kind = 'completed'
            AND (sources_cooled_down IS NULL OR array_length(sources_cooled_down, 1) IS NULL)
       ORDER BY ended_at DESC NULLS LAST
          LIMIT 1`,
        [`${TRIGGER_PREFIX}%`],
      )
      .catch(() => ({ rows: [] as AofCycleRow[] }))) as { rows: AofCycleRow[] };
    const latestSuccessfulTickCycle =
      success.rows[0] ? toTickCycle(success.rows[0]) : null;

    // ─── total count of nexapp-harvester-tick cycles ──────────────
    const total = (await client
      .query(
        `SELECT COUNT(*)::text AS n
           FROM nex.aof_cycle
          WHERE triggered_by LIKE $1`,
        [`${TRIGGER_PREFIX}%`],
      )
      .catch(() => ({ rows: [{ n: "0" }] }))) as {
      rows: Array<{ n: string }>;
    };
    const totalTickCycles = Number(total.rows[0]?.n ?? "0") || 0;

    // ─── EXACT run-to-record verification for the latest cycle ────
    // Count canonical rows whose metadata.cycle_id matches the latest
    // tick's own cycle_id. Compared against aof_cycle.candidates_added
    // this gives the dashboard honest "claimed vs verified" numbers.
    // Returns null when the latest row predates the cycle_id-stamping
    // change (no match found).
    let latestCycleVerifiedCount: number | null = null;
    if (latestTickCycle) {
      const verify = (await client
        .query(
          `SELECT COUNT(*)::text AS n
             FROM nex.business_canonical
            WHERE metadata->>'cycle_id' = $1`,
          [latestTickCycle.cycleId],
        )
        .catch(() => null)) as { rows: Array<{ n: string }> } | null;
      if (verify) {
        const n = Number(verify.rows[0]?.n ?? "0");
        latestCycleVerifiedCount = Number.isFinite(n) ? n : null;
      }
    }

    return {
      programmeCountryCount: programmeCountryIsos.length,
      programmeCountryIsos,
      latestTickCycle,
      latestSuccessfulTickCycle,
      recentTickCycles,
      totalTickCycles,
      latestCycleVerifiedCount,
    };
  });

  if (result === null) return null;

  return {
    cronSecretPresent,
    customSecretPresent,
    programmeCountryCount: result.programmeCountryCount,
    programmeCountryIsos: result.programmeCountryIsos,
    latestTickCycle: result.latestTickCycle,
    latestSuccessfulTickCycle: result.latestSuccessfulTickCycle,
    recentTickCycles: result.recentTickCycles,
    totalTickCycles: result.totalTickCycles,
    latestCycleVerifiedCount: result.latestCycleVerifiedCount,
    nowMs: Date.now(),
    expectedScheduleIntervalMinutes: SCHEDULE_INTERVAL_MINUTES,
    maxExpectedRuntimeMinutes: MAX_EXPECTED_RUNTIME_MINUTES,
  };
}

function toTickCycle(r: AofCycleRow): HarvestTickCycle {
  const started = r.started_at ?? "";
  const ended = r.ended_at ?? null;
  const triggered = r.triggered_by ?? "";
  const sa = Array.isArray(r.sources_attempted) ? r.sources_attempted : [];
  const ss = Array.isArray(r.sources_succeeded) ? r.sources_succeeded : [];
  const sc = Array.isArray(r.sources_cooled_down) ? r.sources_cooled_down : [];
  let durationMs: number | null = null;
  if (ended) {
    const s = Date.parse(started);
    const e = Date.parse(ended);
    if (Number.isFinite(s) && Number.isFinite(e) && e >= s) {
      durationMs = e - s;
    }
  }
  return {
    cycleId: r.cycle_id,
    startedAt: started,
    endedAt: ended,
    endedKind: r.ended_kind,
    candidatesAdded: r.candidates_added,
    evidenceAdded: r.evidence_added,
    triggeredBy: triggered,
    cityId: cityIdFromTriggeredBy(triggered),
    sourcesAttempted: sa,
    sourcesSucceeded: ss,
    sourcesCooledDown: sc,
    durationMs,
  };
}
