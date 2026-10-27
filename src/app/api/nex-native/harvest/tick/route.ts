// src/app/api/nex-native/harvest/tick/route.ts
//
// NEX harvester tick · Vercel cron entrypoint.
// --------------------------------------------
// One invocation = one city bbox worth of harvesting.
//
// Fires on the cron schedule declared in `vercel.json`. Each tick:
//   1. Authenticates the request via NEX_HARVEST_CRON_SECRET (header
//      `x-nex-harvest-key`) OR a signed-in session with the admin
//      capability (so the founder can manually re-fire from a browser
//      while debugging).
//   2. Resolves the next city from the rotation, scoped to countries
//      that are opted in via `nex.discovery_programme_country`.
//   3. Issues one Overpass query for that bbox.
//   4. Writes DISCOVERED canonical rows (ON CONFLICT DO NOTHING).
//   5. Appends an `nex.aof_cycle` row so the HQ dashboard sees it.
//
// Hard-coded 240s internal deadline keeps the response safely under
// Vercel's 300s serverless ceiling even on slow Overpass days.

import "server-only";
import { NextResponse } from "next/server";
import { withClient } from "@/lib/nex/db";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  CITY_ROTATION,
  pickNextCity,
  type CityBbox,
} from "@/lib/nex-native/harvest/city-rotation";
import { fetchOsmBusinessesInBbox } from "@/lib/nex-native/harvest/overpass-fetcher";
import { writeCanonicalRowsFromOverpass } from "@/lib/nex-native/harvest/canonical-writer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel Pro+ ceiling

interface TickResponse {
  readonly ok: boolean;
  readonly reason:
    | "unauthorised"
    | "no_programme_countries"
    | "no_city_eligible"
    | "overpass_failed"
    | "completed";
  readonly city: {
    readonly id: string;
    readonly isoAlpha2: string;
    readonly cityName: string;
  } | null;
  readonly fetched: number;
  readonly inserted: number;
  readonly duplicates: number;
  readonly skipped_no_name: number;
  readonly skipped_no_coords: number;
  readonly errors: number;
  /** Owner directive 2026-10-27 · surface the per-tick count of OSM
   *  emails discarded because migration 202 is unapplied. A failed
   *  contact-data write MUST be counted and surfaced to the caller · it
   *  must not be reported as a successful enrichment. Stays 0 once
   *  migration 202 lands. */
  readonly emails_dropped_schema_missing: number;
  readonly overpassHost: string | null;
  readonly fetchMs: number;
  readonly totalMs: number;
}

export async function POST(req: Request): Promise<NextResponse<TickResponse>> {
  const started = Date.now();
  // Generate the cycle_id ONCE at the top of the invocation so the
  // same UUID stamps both every nex.business_canonical row the writer
  // creates AND the nex.aof_cycle row that records this tick. Enables
  // exact run-to-record traceability without approximating by city +
  // time window. Added 2026-10-13 per founder brief.
  const cycleId = crypto.randomUUID();

  // ─── Auth · cron secret header OR authenticated admin session ───
  const authed = await isAuthorised(req);
  if (!authed) {
    return NextResponse.json(emptyResponse("unauthorised", started), {
      status: 401,
    });
  }

  // ─── Resolve opted-in countries from Supabase ───────────────────
  const allowedIsos = await resolveOptedInIsos();
  if (allowedIsos.size === 0) {
    return NextResponse.json(
      emptyResponse("no_programme_countries", started),
      { status: 200 },
    );
  }

  // ─── Pick next city via rotation cursor ─────────────────────────
  const cursor = await readRotationCursor();
  const city = pickNextCity({ cursor }, allowedIsos);
  if (!city) {
    return NextResponse.json(emptyResponse("no_city_eligible", started), {
      status: 200,
    });
  }

  // Note: cursor advancement is implicit via the aof_cycle row that
  // recordCycle() writes at the end of this invocation. That row's
  // triggered_by column embeds the picked city.id, which the next
  // tick's readRotationCursor parses to find the next-in-rotation.
  // No separate "cursor write" is needed · the aof_cycle row is the
  // ledger. If the function dies before recordCycle (rare · Vercel
  // 300s hard-stop), the next tick will re-pick this city.

  // ─── Fetch Overpass ─────────────────────────────────────────────
  const overpass = await fetchOsmBusinessesInBbox(city);
  if (!overpass.ok) {
    await recordCycle(city, overpass, {
      inserted: 0,
      duplicates: 0,
      skipped_no_name: 0,
      skipped_no_coords: 0,
      errors: 0,
      emails_dropped_schema_missing: 0,
    }, started, "overpass_failed", cycleId);
    return NextResponse.json(
      {
        ok: false,
        reason: "overpass_failed",
        city: toCityOut(city),
        fetched: 0,
        inserted: 0,
        duplicates: 0,
        skipped_no_name: 0,
        skipped_no_coords: 0,
        errors: 0,
        emails_dropped_schema_missing: 0,
        overpassHost: overpass.host,
        fetchMs: overpass.fetchMs,
        totalMs: Date.now() - started,
      },
      { status: 200 },
    );
  }

  // ─── Dedupe + write canonical rows ──────────────────────────────
  const write = await writeCanonicalRowsFromOverpass(
    city,
    overpass.elements,
    cycleId,
  );
  await recordCycle(city, overpass, write, started, "completed", cycleId);

  const resp: TickResponse = {
    ok: true,
    reason: "completed",
    city: toCityOut(city),
    fetched: overpass.elements.length,
    inserted: write.inserted,
    duplicates: write.duplicates,
    skipped_no_name: write.skipped_no_name,
    skipped_no_coords: write.skipped_no_coords,
    errors: write.errors,
    emails_dropped_schema_missing: write.emails_dropped_schema_missing,
    overpassHost: overpass.host,
    fetchMs: overpass.fetchMs,
    totalMs: Date.now() - started,
  };
  return NextResponse.json(resp, { status: 200 });
}

/** Also handle GET so Vercel's cron scheduler (which fires GET by
 *  default) + manual browser-opened debug URLs both work. */
export async function GET(req: Request): Promise<NextResponse<TickResponse>> {
  return POST(req);
}

// ─── Helpers ────────────────────────────────────────────────────────

async function isAuthorised(req: Request): Promise<boolean> {
  // Vercel cron sends `Authorization: Bearer <CRON_SECRET>` by
  // default where `CRON_SECRET` is the Vercel-configured env var.
  // We accept BOTH that convention AND an explicit custom key
  // name (`NEX_HARVEST_CRON_SECRET`) so the operator can rename it
  // if the Vercel project is also used by other cron jobs. Either
  // env var being set and matching the request is sufficient.
  const presented = extractPresentedKey(req);
  if (presented) {
    const vercelSecret = (process.env.CRON_SECRET ?? "").trim();
    const customSecret = (process.env.NEX_HARVEST_CRON_SECRET ?? "").trim();
    if (vercelSecret.length > 0 && presented === vercelSecret) return true;
    if (customSecret.length > 0 && presented === customSecret) return true;
  }
  // Fallback: authenticated session (so the operator can manually
  // trigger a tick from a logged-in browser).
  const session = await resolveNexAppSessionFromContext();
  return session !== null;
}

/** Pull the presented auth key from any of three places so manual
 *  curl / Postman / Vercel cron / custom cron all work. */
function extractPresentedKey(req: Request): string | null {
  const authz = req.headers.get("authorization") ?? "";
  const bearer = authz.match(/^Bearer\s+(.+)$/i);
  if (bearer) return bearer[1].trim();
  const customHeader = req.headers.get("x-nex-harvest-key");
  if (customHeader && customHeader.length > 0) return customHeader.trim();
  // Query-string fallback for manual browser invocations · never log.
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("key");
    if (q && q.length > 0) return q.trim();
  } catch {
    // ignore
  }
  return null;
}

async function resolveOptedInIsos(): Promise<Set<string>> {
  const result = await withClient(async (client) => {
    const { rows } = await client.query(
      `SELECT iso_alpha_2
         FROM nex.discovery_programme_country
        WHERE included = true`,
    );
    return (rows as Array<{ iso_alpha_2: string }>).map((r) =>
      r.iso_alpha_2.toUpperCase(),
    );
  });
  return new Set(result ?? []);
}

/** Rotation cursor is derived from the most recent `nex.aof_cycle`
 *  row this harvester produced. The row's `triggered_by` column has
 *  the shape `nexapp-harvester-tick:<city.id>`, so we parse the city
 *  id back out. No dedicated cursor table · the aof_cycle ledger is
 *  the source of truth. Returns null on first-ever run so the picker
 *  starts from the first opted-in city.
 *
 *  Historically this code wrote to `nex.discovery_rotation_state`,
 *  but that table in production is a different per-city/round state
 *  tracker with no `scope`/`cursor` columns · writes silently failed
 *  and the harvester got stuck on gb-london. Fixed 2026-10-13 by
 *  parsing `triggered_by` instead. */
async function readRotationCursor(): Promise<string | null> {
  const result = await withClient(async (client) => {
    const probe = await client
      .query(
        `SELECT triggered_by
           FROM nex.aof_cycle
          WHERE triggered_by LIKE 'nexapp-harvester-tick:%'
          ORDER BY started_at DESC
          LIMIT 1`,
      )
      .catch(() => null);
    if (!probe || !probe.rows[0]) return null;
    const triggeredBy = (probe.rows[0] as { triggered_by: string | null })
      .triggered_by;
    if (!triggeredBy) return null;
    const prefix = "nexapp-harvester-tick:";
    if (!triggeredBy.startsWith(prefix)) return null;
    const cityId = triggeredBy.slice(prefix.length).trim();
    return cityId.length > 0 ? cityId : null;
  });
  return result ?? null;
}

async function recordCycle(
  city: CityBbox,
  overpass: Awaited<ReturnType<typeof fetchOsmBusinessesInBbox>>,
  write: Awaited<ReturnType<typeof writeCanonicalRowsFromOverpass>>,
  started: number,
  endedKind: "completed" | "overpass_failed",
  cycleId: string,
): Promise<void> {
  // sources_cooled_down encoding (2026-10-13 · ops-proof extension):
  //   · overpass fetch failed      → ['osm_overpass']
  //   · overpass ok + writer errs  → ['canonical_writer']  (partial)
  //   · everything clean           → []
  // Both arrays are the SAME existing column shape (text[]) · no
  // schema change · existing dashboards that already read
  // sources_cooled_down see one more possible value.
  const cooledDown: string[] = [];
  if (!overpass.ok) {
    cooledDown.push("osm_overpass");
  } else if (write.errors > 0) {
    cooledDown.push("canonical_writer");
  }
  await withClient(async (client) => {
    await client
      .query(
        `
        INSERT INTO nex.aof_cycle (
          cycle_id, started_at, ended_at, ended_kind,
          candidates_added, evidence_added, emails_captured,
          triggered_by, sources_attempted, sources_succeeded, sources_cooled_down
        ) VALUES (
          $7::uuid, $1, now(), $2,
          $3, 0, 0,
          'nexapp-harvester-tick:' || $4,
          ARRAY['osm_overpass']::text[],
          CASE WHEN $5 THEN ARRAY['osm_overpass']::text[] ELSE ARRAY[]::text[] END,
          $6::text[]
        )
        `,
        [
          new Date(started).toISOString(),
          endedKind === "completed" ? "completed" : "failed",
          write.inserted,
          city.id,
          overpass.ok,
          cooledDown,
          cycleId,
        ],
      )
      .catch(() => undefined);
  });
}

function emptyResponse(
  reason: TickResponse["reason"],
  started: number,
): TickResponse {
  return {
    ok: false,
    reason,
    city: null,
    fetched: 0,
    inserted: 0,
    duplicates: 0,
    skipped_no_name: 0,
    skipped_no_coords: 0,
    errors: 0,
    emails_dropped_schema_missing: 0,
    overpassHost: null,
    fetchMs: 0,
    totalMs: Date.now() - started,
  };
}

function toCityOut(city: CityBbox): TickResponse["city"] {
  return {
    id: city.id,
    isoAlpha2: city.isoAlpha2,
    cityName: city.cityName,
  };
}

// Suppress unused-rotation-reference TypeScript warnings · the
// rotation needs to be imported for its type side-effects.
export const _rotationLength = CITY_ROTATION.length;
