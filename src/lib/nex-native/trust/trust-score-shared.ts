// src/lib/nex-native/trust/trust-score-shared.ts
//
// Pure Trust Score function + types · safe to import from client
// AND server AND tests. The DB resolver lives in trust-score-service.ts
// behind the server-only guard.

export type TrustTier = "high" | "medium" | "low" | "unknown";

export interface TrustScoreInput {
  readonly isClaimed: boolean;
  readonly claimedSinceDays: number | null;
  readonly distinctSourceCount: number;
  readonly freshestObservationDays: number | null;
  readonly hasOwnerUploadSource: boolean;
}

export interface TrustScoreResult {
  readonly score: number;
  readonly tier: TrustTier;
  readonly reasons: readonly TrustReason[];
  readonly inputs: TrustScoreInput;
}

/** Short reason tokens the UI maps to localisable copy · stable
 *  identifiers · never change these without updating the EvidencePanel
 *  copy map. */
export type TrustReason =
  | "owner_claimed"
  | "owner_verified"
  | "sources_1"
  | "sources_2"
  | "sources_3_plus"
  | "fresh"
  | "aging"
  | "stale"
  | "no_evidence";

const EMPTY_INPUT: TrustScoreInput = {
  isClaimed: false,
  claimedSinceDays: null,
  distinctSourceCount: 0,
  freshestObservationDays: null,
  hasOwnerUploadSource: false,
};

const UNKNOWN_RESULT: TrustScoreResult = {
  score: 0,
  tier: "unknown",
  reasons: ["no_evidence"],
  inputs: EMPTY_INPUT,
};

/** Pure · deterministic · never throws · the scoring algorithm.
 *
 *  Tier bands:
 *    70..100  → high    (green shield)
 *    40..69   → medium  (yellow shield)
 *     1..39   → low     (grey shield)
 *     0       → unknown (shield hidden per owner directive 2026-10-20)
 *
 *  Point allocation (sealed · sums to 100 by construction):
 *    owner_claimed              +30
 *    owner_verified             +20
 *    distinct sources (max 4)   +10 per source · cap +40
 *    freshness fresh (<90d)     +10
 *    freshness aging (<365d)    +5
 *    freshness stale            +0
 */
export function computeTrustScore(input: TrustScoreInput): TrustScoreResult {
  if (
    !input.isClaimed &&
    input.distinctSourceCount === 0 &&
    input.freshestObservationDays === null
  ) {
    return { ...UNKNOWN_RESULT, inputs: input };
  }

  let score = 0;
  const reasons: TrustReason[] = [];

  if (input.isClaimed) {
    score += 30;
    reasons.push("owner_claimed");
  }

  if (input.hasOwnerUploadSource) {
    score += 20;
    reasons.push("owner_verified");
  }

  const cappedSources = Math.min(input.distinctSourceCount, 4);
  if (cappedSources > 0) {
    score += cappedSources * 10;
    if (cappedSources === 1) {
      reasons.push("sources_1");
    } else if (cappedSources === 2) {
      reasons.push("sources_2");
    } else {
      reasons.push("sources_3_plus");
    }
  }

  if (input.freshestObservationDays !== null) {
    if (input.freshestObservationDays < 90) {
      score += 10;
      reasons.push("fresh");
    } else if (input.freshestObservationDays < 365) {
      score += 5;
      reasons.push("aging");
    } else {
      reasons.push("stale");
    }
  }

  const clamped = Math.max(0, Math.min(100, score));
  const tier: TrustTier =
    clamped >= 70 ? "high" : clamped >= 40 ? "medium" : clamped >= 1 ? "low" : "unknown";

  return {
    score: clamped,
    tier,
    reasons,
    inputs: input,
  };
}
