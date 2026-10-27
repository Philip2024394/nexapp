// src/lib/nex-native/enrichment/dedupe-service.ts
//
// NEX Directory · Enrichment Pipeline · duplicate-CANDIDATE detector.
// Owner-authorised 2026-10-27 (Phase 2 · code only · no DB touch).
//
// Owner directive (verbatim): "Deduplicate safely and never overwrite
// better verified information with weaker evidence." + "No automatic
// duplicate merging."
//
// This module ONLY SURFACES candidates. It never merges rows, never
// marks any row as a duplicate in the DB, never calls Supabase.
// Humans or a future owner-approved review surface decide the merge
// outcome. The service here is pure analysis.

export interface DedupeInputRow {
  readonly canonical_business_id: string;
  readonly name_canonical: string;
  readonly name_norm: string;
  readonly city: string | null;
  readonly country: string;
  readonly lifecycle_state: string;
  readonly osm_id: string | null;
  readonly phone_e164: string | null;
  readonly website_apex: string | null;
}

/** One group of likely-same-business rows. The group preserves ALL
 *  members · never picks a "winner" automatically. */
export interface DuplicateCandidateGroup {
  readonly key: {
    readonly name_norm: string;
    readonly city: string | null;
    readonly country: string;
  };
  readonly members: readonly DedupeInputRow[];
  /** Why these rows are grouped · for human review. */
  readonly reason:
    | "same_name_same_city"
    | "same_name_same_city_same_phone"
    | "same_name_same_city_same_website";
  /** Confidence · higher = stronger match. Never used to merge
   *  automatically · surfaces to a reviewer. */
  readonly confidence: 0.4 | 0.6 | 0.8;
}

/** Build groups by exact (name_norm, city, country) match. This is
 *  the floor · a future amendment may add trigram-similarity groups
 *  via `pg_trgm` (already installed in Supabase) · that is a separate
 *  slice.
 *
 *  PURE · stable sort order · no side effects. */
export function groupExactMatches(
  rows: readonly DedupeInputRow[],
): readonly DuplicateCandidateGroup[] {
  const buckets = new Map<string, DedupeInputRow[]>();
  for (const row of rows) {
    const k = JSON.stringify([row.name_norm, row.city ?? "", row.country]);
    const bucket = buckets.get(k);
    if (bucket) bucket.push(row);
    else buckets.set(k, [row]);
  }
  const groups: DuplicateCandidateGroup[] = [];
  for (const [, members] of buckets) {
    if (members.length < 2) continue;
    // Sort for deterministic review order.
    members.sort((a, b) =>
      a.canonical_business_id.localeCompare(b.canonical_business_id),
    );
    const first = members[0]!;
    // Elevate confidence when all members share a phone or website ·
    // signal is strictly stronger than name+city alone.
    const samePhone = allShareNonEmpty(members, (m) => m.phone_e164);
    const sameWebsite = allShareNonEmpty(members, (m) => m.website_apex);
    const reason: DuplicateCandidateGroup["reason"] = samePhone
      ? "same_name_same_city_same_phone"
      : sameWebsite
        ? "same_name_same_city_same_website"
        : "same_name_same_city";
    const confidence: DuplicateCandidateGroup["confidence"] = samePhone
      ? 0.8
      : sameWebsite
        ? 0.6
        : 0.4;
    groups.push({
      key: {
        name_norm: first.name_norm,
        city: first.city,
        country: first.country,
      },
      members,
      reason,
      confidence,
    });
  }
  // Stable sort groups by key for review consistency.
  groups.sort((a, b) => {
    const an = `${a.key.name_norm}|${a.key.city ?? ""}|${a.key.country}`;
    const bn = `${b.key.name_norm}|${b.key.city ?? ""}|${b.key.country}`;
    return an.localeCompare(bn);
  });
  return groups;
}

function allShareNonEmpty<T>(
  members: readonly DedupeInputRow[],
  pick: (m: DedupeInputRow) => string | null,
): boolean {
  const first = pick(members[0]!);
  if (!first || first.trim().length === 0) return false;
  for (let i = 1; i < members.length; i++) {
    const v = pick(members[i]!);
    if (!v || v.trim() !== first.trim()) return false;
  }
  return true;
}

/** Pick the strongest member for review-order display · NEVER as an
 *  automatic merge target. The reviewer always makes the final call.
 *
 *  "Strongest" prefers OWNER_VERIFIED > OWNER_CLAIMED > VERIFIED >
 *  DISCOVERED, then prefers a row with any contact over a row with
 *  none. Pure. */
export function strongestMemberForReview(
  group: DuplicateCandidateGroup,
): DedupeInputRow {
  const order: Record<string, number> = {
    OWNER_VERIFIED: 4,
    OWNER_CLAIMED: 3,
    VERIFIED: 2,
    DISCOVERED: 1,
  };
  const scored = [...group.members].map((m) => {
    const lifecycleScore = order[m.lifecycle_state] ?? 0;
    const contactScore =
      (m.phone_e164 ? 1 : 0) + (m.website_apex ? 1 : 0);
    return { m, score: lifecycleScore * 10 + contactScore };
  });
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.m.canonical_business_id.localeCompare(b.m.canonical_business_id),
  );
  return scored[0]!.m;
}

/** Report shape · exported so the worker can surface review items
 *  without this module needing to know the batch id convention. */
export interface DedupeReport {
  readonly totalInspected: number;
  readonly groupsFound: number;
  readonly rowsInGroups: number;
  readonly groups: readonly DuplicateCandidateGroup[];
}

export function buildDedupeReport(
  rows: readonly DedupeInputRow[],
): DedupeReport {
  const groups = groupExactMatches(rows);
  const rowsInGroups = groups.reduce((acc, g) => acc + g.members.length, 0);
  return {
    totalInspected: rows.length,
    groupsFound: groups.length,
    rowsInGroups,
    groups,
  };
}
