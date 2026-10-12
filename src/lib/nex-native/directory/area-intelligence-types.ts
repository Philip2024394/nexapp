// src/lib/nex-native/directory/area-intelligence-types.ts
//
// Pure types for the "Discover this area" feature. No DB, no clock.
//
// Honesty contract:
//   · Every rendered claim carries its own source URL + access
//     timestamp. The UI never shows a claim without those breadcrumbs.
//   · Unknown areas resolve to null · the caller renders "Area
//     information not yet researched" rather than fabricating.
//   · Category buckets are optional and can be empty. An empty bucket
//     means the research pass found no reliable sources for that
//     category · the UI does NOT show the category heading.

export type AreaIntelCategory =
  | "food"
  | "shopping"
  | "attractions"
  | "transport";

export const AREA_INTEL_CATEGORIES: readonly AreaIntelCategory[] = [
  "food",
  "shopping",
  "attractions",
  "transport",
];

export interface AreaIntelClaim {
  /** The claim text itself (10-25 words typically). */
  readonly claim: string;
  /** Source URL · must be a real page the researcher cited. */
  readonly sourceUrl: string;
  /** ISO-8601 timestamp of when the researcher accessed the source. */
  readonly accessedAt: string;
}

export interface AreaIntelKnownFor {
  readonly food: readonly AreaIntelClaim[];
  readonly shopping: readonly AreaIntelClaim[];
  readonly attractions: readonly AreaIntelClaim[];
  readonly transport: readonly AreaIntelClaim[];
}

export interface AreaIntelligence {
  /** The matched area_id from nex.meaningful_area. */
  readonly areaId: string;
  /** Human-readable area name (usually the city). */
  readonly areaName: string;
  /** Country ISO 3166-1 alpha-2. */
  readonly country: string;
  /** City the area belongs to (may equal areaName for city-level
   *  entries, or be the parent city for neighbourhoods). */
  readonly city: string;
  /** Short area summary (one sentence · 15-25 words). Null when the
   *  Wikidata/Wikipedia pass has not populated it yet · the OSM
   *  landmark collector writes null and the UI omits the summary
   *  paragraph when this is null (see DiscoverThisArea component). */
  readonly shortSummary: string | null;
  /** Research method used · surfaced in UI as the "evidence badge". */
  readonly method: string;
  /** Optional note about the research method (e.g. "WebSearch only ·
   *  WebFetch unavailable"). Shown in the attribution footer. */
  readonly methodNote: string | null;
  /** ISO-8601 of when the research was done. The UI shows the date
   *  so visitors can judge freshness. */
  readonly researchedAt: string;
  readonly knownFor: AreaIntelKnownFor;
}

/**
 * Parse the `provenance.nex_directory_area_intelligence` payload into
 * the AreaIntelligence VM. Returns null when the payload is missing
 * or malformed · the UI then renders the honest "no area intel"
 * fallback. Pure · no network, no clock, no randomness.
 */
export function parseAreaIntelligence(
  args: {
    readonly areaId: string;
    readonly areaName: string;
    readonly country: string;
    readonly city: string;
    readonly provenance: unknown;
  },
): AreaIntelligence | null {
  const { areaId, areaName, country, city, provenance } = args;
  if (provenance === null || typeof provenance !== "object") return null;
  const payload = (provenance as Record<string, unknown>)[
    "nex_directory_area_intelligence"
  ];
  if (payload === null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;

  // short_summary is now OPTIONAL · honest-null support. The OSM
  // landmark collector writes short_summary=null until the Wikidata/
  // Wikipedia pass lands (see history-source-plan.md). The panel is
  // still useful without it · the known_for buckets carry the main
  // content. If the parser bailed here, Phase 1 OSM-only coverage
  // couldn't render at all · relaxing this is a straight bug fix.
  const shortSummary =
    typeof p.short_summary === "string" && p.short_summary.trim().length > 0
      ? p.short_summary.trim()
      : null;

  const method = typeof p.method === "string" ? p.method : "unknown";
  const methodNote = typeof p.method_note === "string" ? p.method_note : null;
  const researchedAt =
    typeof p.researched_at === "string" ? p.researched_at : new Date(0).toISOString();

  const knownForRaw = (p.known_for ?? {}) as Record<string, unknown>;
  const knownFor: AreaIntelKnownFor = {
    food: parseClaims(knownForRaw.food),
    shopping: parseClaims(knownForRaw.shopping),
    attractions: parseClaims(knownForRaw.attractions),
    transport: parseClaims(knownForRaw.transport),
  };

  return {
    areaId,
    areaName,
    country,
    city,
    shortSummary,
    method,
    methodNote,
    researchedAt,
    knownFor,
  };
}

function parseClaims(raw: unknown): readonly AreaIntelClaim[] {
  if (!Array.isArray(raw)) return [];
  const out: AreaIntelClaim[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    const claim =
      typeof r.claim === "string" && r.claim.trim().length > 0
        ? r.claim.trim()
        : null;
    const sourceUrl =
      typeof r.source_url === "string" && /^https?:\/\//.test(r.source_url)
        ? r.source_url
        : null;
    const accessedAt =
      typeof r.accessed_at === "string" ? r.accessed_at : null;
    if (claim === null || sourceUrl === null || accessedAt === null) continue;
    out.push({ claim, sourceUrl, accessedAt });
  }
  return out;
}

/** Convenience · total number of claims across all four categories. */
export function totalClaimCount(intel: AreaIntelligence): number {
  return (
    intel.knownFor.food.length +
    intel.knownFor.shopping.length +
    intel.knownFor.attractions.length +
    intel.knownFor.transport.length
  );
}

/** Convenience · categories that actually have ≥1 claim. */
export function nonEmptyCategories(
  intel: AreaIntelligence,
): readonly AreaIntelCategory[] {
  const out: AreaIntelCategory[] = [];
  if (intel.knownFor.food.length > 0) out.push("food");
  if (intel.knownFor.shopping.length > 0) out.push("shopping");
  if (intel.knownFor.attractions.length > 0) out.push("attractions");
  if (intel.knownFor.transport.length > 0) out.push("transport");
  return out;
}
