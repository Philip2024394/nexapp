// src/lib/nex-native/harvest-dashboard.ts
//
// Server-only read layer for the NEX HQ harvest dashboard.
// --------------------------------------------------------
// Pure reads · zero writes · zero source-registry mutations. The
// dashboard surfaces real state across:
//
//   · nex.business_canonical       → per-country row counts
//   · nex.world_country            → list of configured countries
//   · nex.discovery_programme_country → which countries are opted in
//   · nex.harvest_source           → source connectors + enablement
//   · nex.aof_cycle                → recent harvest cycle runs
//   · nex.source_registry          → display + collection permissions
//
// Honest-null: every query falls back to an empty value when the
// table doesn't exist or the query errors, so the dashboard can
// render partial state truthfully rather than erroring.

import "server-only";
import { withClient } from "@/lib/nex/db";

export interface HarvestDashboardSummary {
  readonly countries: readonly CountryCoverage[];
  readonly sources: readonly SourceConnector[];
  readonly recentCycles: readonly CycleRun[];
  readonly sourceRegistry: readonly SourceRegistryRow[];
  readonly canonicalLifecycleCounts: readonly LifecycleCount[];
  readonly totalCanonical: number;
  readonly mediaApproved: number;
  readonly mediaTotal: number;
  // Email-qualification summary · sealed 2026-10-16 · migration 202.
  // Both fields fall back to [] when the migration is not yet applied,
  // so the dashboard renders truthful partial state before rollout.
  readonly canonicalQualificationCounts: readonly QualificationCount[];
  readonly emailStatusCounts: readonly EmailStatusCount[];
}

export interface CountryCoverage {
  readonly isoAlpha2: string;
  readonly name: string | null;
  readonly region: string | null;
  readonly includedInProgramme: boolean;
  readonly priority: number | null;
  readonly canonicalCount: number;
}

export interface SourceConnector {
  readonly sourceSlug: string;
  readonly sourceType: string;
  readonly host: string | null;
  readonly enabled: boolean;
}

export interface CycleRun {
  readonly startedAt: string;
  readonly endedKind: string | null;
  readonly candidatesAdded: number | null;
  readonly evidenceAdded: number | null;
  readonly triggeredBy: string | null;
}

export interface SourceRegistryRow {
  readonly sourceId: string;
  readonly displayName: string;
  readonly sourceType: string;
  readonly canCollect: boolean;
  readonly canStore: boolean;
  readonly canDisplay: boolean;
  readonly canDerive: boolean;
  readonly canRedistribute: boolean;
  readonly attributionRequired: boolean;
  readonly attributionTemplate: string | null;
}

export interface LifecycleCount {
  readonly lifecycleState: string;
  readonly n: number;
}

/** Qualification-status partition · sealed 2026-10-16 · migration 202. */
export interface QualificationCount {
  readonly qualificationStatus: string;
  readonly n: number;
}

/** Email-status partition · sealed 2026-10-16 · migration 202.
 *  NULL `emailStatus` is reported as the string 'NEVER_ATTEMPTED' so
 *  the dashboard can show it as a distinct cell. */
export interface EmailStatusCount {
  readonly emailStatus: string;
  readonly n: number;
}

type QueryResult<T> = { rows: T[] };

export async function loadHarvestDashboard(): Promise<HarvestDashboardSummary | null> {
  return withClient(async (client): Promise<HarvestDashboardSummary> => {
    // Country coverage · world_country ⋈ discovery_programme_country
    // ⋈ canonical counts. LEFT JOINs so missing tables don't zero out
    // the entire query.
    const countryResult = (await client
      .query(
        `
        SELECT wc.iso_alpha_2,
               wc.name,
               wc.region,
               COALESCE(dpc.included, false)  AS included,
               dpc.priority                   AS priority,
               COALESCE(bc.n, 0)::int         AS canonical_count
          FROM nex.world_country wc
          LEFT JOIN nex.discovery_programme_country dpc
            ON dpc.iso_alpha_2 = wc.iso_alpha_2
          LEFT JOIN (
            SELECT country, COUNT(*)::int AS n
              FROM nex.business_canonical
             WHERE superseded_by_business_id IS NULL
          GROUP BY country
          ) bc ON bc.country = wc.iso_alpha_2
         ORDER BY wc.region, wc.iso_alpha_2
        `,
      )
      .catch(() => ({ rows: [] }))) as QueryResult<{
      iso_alpha_2: string;
      name: string | null;
      region: string | null;
      included: boolean;
      priority: number | null;
      canonical_count: number;
    }>;

    // Also pull countries that have canonical rows but are NOT in
    // world_country (e.g. Indonesia · populated by the standalone
    // OSM harvester outside the discovery programme). Union them in
    // so the dashboard is honest about every ISO with real data.
    const orphanResult = (await client
      .query(
        `
        SELECT country AS iso_alpha_2, COUNT(*)::int AS n
          FROM nex.business_canonical
         WHERE superseded_by_business_id IS NULL
           AND country NOT IN (SELECT iso_alpha_2 FROM nex.world_country)
      GROUP BY country
      ORDER BY country
        `,
      )
      .catch(() => ({ rows: [] }))) as QueryResult<{
      iso_alpha_2: string;
      n: number;
    }>;

    const countries: CountryCoverage[] = countryResult.rows.map((r) => ({
      isoAlpha2: r.iso_alpha_2,
      name: r.name,
      region: r.region,
      includedInProgramme: r.included,
      priority: r.priority,
      canonicalCount: r.canonical_count,
    }));
    for (const o of orphanResult.rows) {
      countries.push({
        isoAlpha2: o.iso_alpha_2,
        name: isoName(o.iso_alpha_2),
        region: null,
        includedInProgramme: false,
        priority: null,
        canonicalCount: o.n,
      });
    }

    // Source connectors (what the harvester is wired to call).
    const sourceResult = (await client
      .query(
        `SELECT source_slug, source_type, host, enabled
           FROM nex.harvest_source
          ORDER BY source_slug`,
      )
      .catch(() => ({ rows: [] }))) as QueryResult<{
      source_slug: string;
      source_type: string;
      host: string | null;
      enabled: boolean;
    }>;
    const sources: SourceConnector[] = sourceResult.rows.map((r) => ({
      sourceSlug: r.source_slug,
      sourceType: r.source_type,
      host: r.host,
      enabled: r.enabled,
    }));

    // Recent harvest cycles.
    const cycleResult = (await client
      .query(
        `SELECT started_at::text AS started_at,
                ended_kind,
                candidates_added,
                evidence_added,
                triggered_by
           FROM nex.aof_cycle
          ORDER BY started_at DESC
          LIMIT 20`,
      )
      .catch(() => ({ rows: [] }))) as QueryResult<{
      started_at: string;
      ended_kind: string | null;
      candidates_added: number | null;
      evidence_added: number | null;
      triggered_by: string | null;
    }>;
    const recentCycles: CycleRun[] = cycleResult.rows.map((r) => ({
      startedAt: r.started_at,
      endedKind: r.ended_kind,
      candidatesAdded: r.candidates_added,
      evidenceAdded: r.evidence_added,
      triggeredBy: r.triggered_by,
    }));

    // Source governance registry.
    const srResult = (await client
      .query(
        `SELECT source_id, display_name, source_type, can_collect, can_store,
                can_display, can_derive, can_redistribute,
                attribution_required, attribution_template
           FROM nex.source_registry
          ORDER BY source_id`,
      )
      .catch(() => ({ rows: [] }))) as QueryResult<{
      source_id: string;
      display_name: string;
      source_type: string;
      can_collect: boolean;
      can_store: boolean;
      can_display: boolean;
      can_derive: boolean;
      can_redistribute: boolean;
      attribution_required: boolean;
      attribution_template: string | null;
    }>;
    const sourceRegistry: SourceRegistryRow[] = srResult.rows.map((r) => ({
      sourceId: r.source_id,
      displayName: r.display_name,
      sourceType: r.source_type,
      canCollect: r.can_collect,
      canStore: r.can_store,
      canDisplay: r.can_display,
      canDerive: r.can_derive,
      canRedistribute: r.can_redistribute,
      attributionRequired: r.attribution_required,
      attributionTemplate: r.attribution_template,
    }));

    // Canonical by lifecycle_state.
    const lsResult = (await client
      .query(
        `SELECT lifecycle_state, COUNT(*)::int AS n
           FROM nex.business_canonical
          WHERE superseded_by_business_id IS NULL
       GROUP BY lifecycle_state
       ORDER BY n DESC`,
      )
      .catch(() => ({ rows: [] }))) as QueryResult<{
      lifecycle_state: string;
      n: number;
    }>;
    const canonicalLifecycleCounts: LifecycleCount[] = lsResult.rows.map((r) => ({
      lifecycleState: r.lifecycle_state,
      n: r.n,
    }));

    // Canonical by qualification_status (migration 202 · falls back to []
    // when the column has not yet been added · dashboard renders truthful
    // partial state in that case).
    const qsResult = (await client
      .query(
        `SELECT qualification_status, COUNT(*)::int AS n
           FROM nex.business_canonical
          WHERE superseded_by_business_id IS NULL
       GROUP BY qualification_status
       ORDER BY n DESC`,
      )
      .catch(() => ({ rows: [] }))) as QueryResult<{
      qualification_status: string;
      n: number;
    }>;
    const canonicalQualificationCounts: QualificationCount[] = qsResult.rows.map(
      (r) => ({
        qualificationStatus: r.qualification_status,
        n: r.n,
      }),
    );

    // Email status partition (migration 202 · same fallback shape).
    // NULL email_status is reported as 'NEVER_ATTEMPTED' so the UI can
    // distinguish never-walked from walked-and-not-found rows.
    const esResult = (await client
      .query(
        `SELECT COALESCE(email_status, 'NEVER_ATTEMPTED') AS email_status,
                COUNT(*)::int AS n
           FROM nex.business_canonical
          WHERE superseded_by_business_id IS NULL
       GROUP BY COALESCE(email_status, 'NEVER_ATTEMPTED')
       ORDER BY n DESC`,
      )
      .catch(() => ({ rows: [] }))) as QueryResult<{
      email_status: string;
      n: number;
    }>;
    const emailStatusCounts: EmailStatusCount[] = esResult.rows.map((r) => ({
      emailStatus: r.email_status,
      n: r.n,
    }));

    // Totals.
    const totResult = (await client
      .query(
        `SELECT COUNT(*)::int AS n
           FROM nex.business_canonical
          WHERE superseded_by_business_id IS NULL`,
      )
      .catch(() => ({ rows: [{ n: 0 }] }))) as QueryResult<{ n: number }>;
    const totalCanonical = totResult.rows[0]?.n ?? 0;

    const mediaResult = (await client
      .query(
        `SELECT COUNT(*) FILTER (WHERE approved = true)::int AS approved,
                COUNT(*)::int                              AS total
           FROM nex.business_media`,
      )
      .catch(() => ({ rows: [{ approved: 0, total: 0 }] }))) as QueryResult<{
      approved: number;
      total: number;
    }>;
    const mediaApproved = mediaResult.rows[0]?.approved ?? 0;
    const mediaTotal = mediaResult.rows[0]?.total ?? 0;

    return {
      countries,
      sources,
      recentCycles,
      sourceRegistry,
      canonicalLifecycleCounts,
      totalCanonical,
      mediaApproved,
      mediaTotal,
      canonicalQualificationCounts,
      emailStatusCounts,
    };
  });
}

// ─── ISO → name fallback for countries not in nex.world_country ─────

const ISO_NAMES: Record<string, string> = {
  ID: "Indonesia",
  US: "United States",
  AU: "Australia",
  NZ: "New Zealand",
  CA: "Canada",
  SG: "Singapore",
  MY: "Malaysia",
  TH: "Thailand",
  VN: "Vietnam",
  PH: "Philippines",
  IN: "India",
  AE: "United Arab Emirates",
};
function isoName(iso: string): string | null {
  return ISO_NAMES[iso.toUpperCase()] ?? null;
}
