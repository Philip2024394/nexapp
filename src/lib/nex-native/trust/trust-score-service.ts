// src/lib/nex-native/trust/trust-score-service.ts
//
// NEX · Trust Score · server-only DB resolver.
// Owner-authorised 2026-10-20 · Phase 1 of the Verified-Directory
// wedge.
// ----------------------------------------------------------------
// Pure function + types live in `trust-score-shared.ts` (safe to
// import from client, server, or tests). This file is the thin
// server-only layer that loads evidence from Supabase.
//
// Why direct `pg` instead of @supabase/supabase-js:
//   The directory primitives live in the `nex` schema. Supabase's
//   PostgREST only exposes `public` out of the box (verified via
//   `scripts/probe-trust-state-pg.mjs` 2026-10-20). Direct pg
//   via DATABASE_URL reads any schema. The DATABASE_URL already
//   points at the sealed pooler for project `ijvqdvsvwtwxzcqmoqit`.

import "server-only";
import { Pool } from "pg";
import {
  computeTrustScore,
  type TrustScoreResult,
} from "./trust-score-shared";

export type {
  TrustTier,
  TrustScoreInput,
  TrustScoreResult,
  TrustReason,
} from "./trust-score-shared";
export { computeTrustScore } from "./trust-score-shared";

// Lazy singleton pool · created on first use so vitest + edge
// environments that import this module without ever calling the
// resolver don't open a Postgres connection they don't need.
let _pool: Pool | null = null;
function pool(): Pool {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL not set · Trust Score resolver cannot query");
  }
  _pool = new Pool({
    connectionString: url,
    // Supabase pooler terminates TLS; we trust the cert chain Supabase
    // provides. Same pattern as other scripts in this repo.
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
  return _pool;
}

/** Load evidence rows for a canonical business id + compute the
 *  Trust Score. Fail-soft · returns an unknown-tier result on any
 *  error so a DB hiccup never breaks a profile render.
 *
 *  When `canonicalBusinessId` is null the resolver tries a
 *  display-name fallback (`name_canonical ILIKE :name`) which is the
 *  pragmatic bridge until migration 999 adds `nex_business.
 *  canonical_business_id`. Fallback is case-insensitive, exact-match
 *  (no fuzzy) · a false positive on a shared name is tolerable
 *  because a wrong-but-neighbour evidence trail only reduces trust
 *  signal (not safety · Safe Trade enforces its own four-state gate). */
export async function resolveTrustScoreByCanonicalId(
  canonicalBusinessId: string | null | undefined,
  options: {
    readonly isClaimed?: boolean;
    readonly claimedAt?: string | null;
    /** Fallback · when canonical id is unknown, resolver tries this
     *  display name against `nex.business_canonical.name_canonical`. */
    readonly displayNameFallback?: string | null;
  } = {},
): Promise<TrustScoreResult> {
  const isClaimed = options.isClaimed ?? false;
  const claimedSinceDays = options.claimedAt
    ? daysBetween(options.claimedAt, new Date().toISOString())
    : null;

  const baseInput = {
    isClaimed,
    claimedSinceDays,
    distinctSourceCount: 0,
    freshestObservationDays: null as number | null,
    hasOwnerUploadSource: false,
  };

  let effectiveCanonicalId: string | null = canonicalBusinessId ?? null;

  // Display-name fallback · pragmatic bridge until migration 999
  // links `nex_business.canonical_business_id` directly.
  if (!effectiveCanonicalId && options.displayNameFallback) {
    try {
      const { rows } = await pool().query<{ canonical_business_id: string }>(
        `
          SELECT canonical_business_id
          FROM nex.business_canonical
          WHERE name_canonical ILIKE $1
          LIMIT 1
        `,
        [options.displayNameFallback.trim()],
      );
      effectiveCanonicalId = rows[0]?.canonical_business_id ?? null;
    } catch {
      // Fall through · nothing to resolve.
    }
  }

  if (!effectiveCanonicalId) {
    return computeTrustScore(baseInput);
  }

  try {
    const { rows } = await pool().query<{
      source_id: string | null;
      observation_generated_at: string | Date | null;
    }>(
      `
        SELECT source_id, observation_generated_at
        FROM nex.business_evidence
        WHERE canonical_business_id = $1
      `,
      [effectiveCanonicalId],
    );

    const sources = new Set<string>();
    let freshestMs: number | null = null;
    let hasOwnerUpload = false;
    for (const row of rows) {
      const sid = row.source_id;
      if (typeof sid === "string" && sid.length > 0) {
        sources.add(sid);
        if (/owner.?upload|owner.?claim|owner.?attest/i.test(sid)) {
          hasOwnerUpload = true;
        }
      }
      const observed = row.observation_generated_at;
      let ms: number | null = null;
      if (observed instanceof Date) {
        ms = observed.getTime();
      } else if (typeof observed === "string") {
        const parsed = Date.parse(observed);
        if (Number.isFinite(parsed)) ms = parsed;
      }
      if (ms !== null) {
        if (freshestMs === null || ms > freshestMs) freshestMs = ms;
      }
    }

    const freshestObservationDays =
      freshestMs === null ? null : Math.max(0, (Date.now() - freshestMs) / 86_400_000);

    return computeTrustScore({
      isClaimed,
      claimedSinceDays,
      distinctSourceCount: sources.size,
      freshestObservationDays,
      hasOwnerUploadSource: hasOwnerUpload,
    });
  } catch {
    return computeTrustScore(baseInput);
  }
}

function daysBetween(fromIso: string, toIso: string): number | null {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, (b - a) / 86_400_000);
}
