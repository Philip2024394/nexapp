// src/lib/nex-native/directory/thumbnail-entitlement.ts
//
// Server-side thumbnail entitlement resolver.
// Founder-sealed 2026-10-13 · Priority 2 of the implementation checkpoint.
//
// Separation of concerns (founder rule):
//   · Theme customisation (chat themes · intro video · bubble shape · etc.)
//     and listing merchandising (how many product/service thumbnails appear
//     on the public directory listing) are DIFFERENT concerns.
//   · They may happen to share a billing plan today, but the resolver
//     must not SILENTLY couple them. The couplings are made EXPLICIT in
//     LISTING_MERCHANDISING_RULES below so a future product change can
//     disaggregate them without the resolver silently misbehaving.
//
// Precedence (highest-first, SEALED):
//   1. Unclaimed listing (lifecycle_state ∉ {OWNER_CLAIMED, OWNER_VERIFIED})
//      → 0 slots · category illustration only
//   2. effectiveTier = 'pro'                → 24 slots + featured + custom
//      (RESERVED · Pro benefits not yet launched · same shape as 'custom'
//      until Pro differentiation ships)
//   3. subscription_plan = 'custom'         → 24 slots + featured + custom
//      (explicit product rule · "Own Theme" merchandising extras)
//   4. effectiveTier = 'bisnis'             → 12 slots + featured
//   5. subscription_plan = 'ringan'         → 6 slots
//      (explicit product rule · documented coupling; otherwise theme-only)
//   6. default (Claimed Gratis)             → 3 slots
//      · also covers subscription_plan = 'buy' (one-shot theme purchase ·
//        does NOT upgrade merchandising)
//
// Downgrade preservation:
//   This resolver returns the CURRENT allowance. The caller enforces
//   the limit on display via LIMIT N in the resolver query (not here).
//   business_media rows previously approved REMAIN approved after
//   downgrade · they're just not surfaced beyond the current slot count.
//   No DELETE happens on downgrade.
//
// Trust boundary:
//   This resolver READS from DB only. It does not grant any image
//   display rights. Media gating lives in media-resolver.ts (which
//   enforces approved=true AND source_registry.can_display=true OR
//   the owner-upload bypass). Thumbnail entitlement bounds the COUNT
//   of displayed media; media-resolver.ts bounds WHICH media displays.

import "server-only";
import { withClient } from "@/lib/nex/db";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { effectiveTier } from "@/lib/nex-native/account-service";
import { NexTierLimitError } from "@/lib/nex-native/tier-gate";
import type {
  NexAccountRow,
  NexAccountTier,
  NexSubscriptionPlan,
  NexUuid,
} from "@/lib/nex-native/types";

// ─── public types ──────────────────────────────────────────────────

export type ThumbnailTierLabel =
  | "unclaimed"
  | "gratis"
  | "ringan"
  | "bisnis"
  | "custom"
  | "pro";

export interface ThumbnailAllowance {
  readonly slots: number;
  readonly featured: boolean;
  readonly custom: boolean;
  readonly tierLabel: ThumbnailTierLabel;
}

// ─── sealed product rules ──────────────────────────────────────────

/**
 * Explicit couplings between subscription_plan and listing-merchandising
 * benefits. ONLY the entries listed here grant merchandising extras.
 * Any other subscription_plan value falls back to the tier axis.
 *
 * Keeping this as a module constant means: (a) a future product
 * change that decouples themes from merchandising edits ONE place,
 * (b) a code review surfaces every merchandising coupling at a glance.
 */
export const LISTING_MERCHANDISING_RULES: Readonly<
  Partial<Record<NexSubscriptionPlan, ThumbnailAllowance>>
> = {
  ringan: { slots: 6, featured: false, custom: false, tierLabel: "ringan" },
  custom: { slots: 24, featured: true, custom: true, tierLabel: "custom" },
  // 'buy' and 'bisnis' intentionally OMITTED:
  //   'buy'    = one-shot theme purchase · no merchandising upgrade.
  //   'bisnis' = tier-level; handled via effectiveTier, not plan lookup.
} as const;

export const UNCLAIMED_ALLOWANCE: ThumbnailAllowance = {
  slots: 0,
  featured: false,
  custom: false,
  tierLabel: "unclaimed",
} as const;

export const CLAIMED_GRATIS_ALLOWANCE: ThumbnailAllowance = {
  slots: 3,
  featured: false,
  custom: false,
  tierLabel: "gratis",
} as const;

export const BISNIS_ALLOWANCE: ThumbnailAllowance = {
  slots: 12,
  featured: true,
  custom: false,
  tierLabel: "bisnis",
} as const;

export const PRO_ALLOWANCE: ThumbnailAllowance = {
  slots: 24,
  featured: true,
  custom: true,
  tierLabel: "pro",
} as const;

// ─── pure resolver (unit-testable, no I/O) ─────────────────────────

export interface ThumbnailAllowanceRawInput {
  /** The canonical row's lifecycle_state (nex.business_canonical). */
  readonly lifecycleState: string | null;
  /**
   * The owner account's resolved tier (output of effectiveTier()).
   * null when no VERIFIED claim exists OR the account could not be loaded.
   */
  readonly effectiveTier: NexAccountTier | null;
  /** The owner account's subscription_plan. Null for gratis. */
  readonly subscriptionPlan: NexSubscriptionPlan | null;
}

/**
 * Pure precedence resolver. Takes already-looked-up inputs; returns the
 * allowance. No I/O. Deterministic. The DB-adapter `getThumbnailAllowance`
 * wraps this by loading the inputs.
 */
export function resolveThumbnailAllowanceFromRaw(
  input: ThumbnailAllowanceRawInput,
): ThumbnailAllowance {
  // Precedence step 1 · lifecycle gate
  if (
    input.lifecycleState !== "OWNER_CLAIMED" &&
    input.lifecycleState !== "OWNER_VERIFIED"
  ) {
    return UNCLAIMED_ALLOWANCE;
  }

  // From here on the business is claimed. If the owner lookup failed
  // (effectiveTier is null) we HONESTLY fall back to Claimed Gratis
  // rather than guessing bisnis. Fail-closed on the merchandising axis.
  if (input.effectiveTier === null) {
    return CLAIMED_GRATIS_ALLOWANCE;
  }

  // Precedence step 2 · Pro tier · reserved · same shape as 'custom' for now.
  if (input.effectiveTier === "pro") {
    return PRO_ALLOWANCE;
  }

  // Precedence step 3 · 'custom' subscription plan · explicit merchandising rule.
  //   (checked BEFORE tier=bisnis because a Gratis account with
  //    subscription_plan='custom' still gets 24 slots per the sealed ladder.)
  if (input.subscriptionPlan === "custom") {
    return LISTING_MERCHANDISING_RULES.custom!;
  }

  // Precedence step 4 · Bisnis tier.
  if (input.effectiveTier === "bisnis") {
    return BISNIS_ALLOWANCE;
  }

  // Precedence step 5 · 'ringan' subscription plan · explicit merchandising rule.
  if (input.subscriptionPlan === "ringan") {
    return LISTING_MERCHANDISING_RULES.ringan!;
  }

  // Precedence step 6 · default · Claimed Gratis.
  //   covers subscription_plan ∈ {null, 'buy'}
  return CLAIMED_GRATIS_ALLOWANCE;
}

// ─── DB adapter (uses two separate databases) ──────────────────────

interface OwnerFacts {
  readonly tier: NexAccountTier;
  readonly bisnis_expires_at: string | null;
  readonly themes_trial_used_at: string | null;
  readonly subscription_plan: NexSubscriptionPlan | null;
}

/**
 * Load the owner facts for a canonical business. Returns null when:
 *   · No VERIFIED business_claim row exists, OR
 *   · The claimed_by_account_id does not resolve to a nex_account row.
 *
 * This mirrors the cross-DB pattern already used in tier-gate.ts and
 * documented in the pending cross-DB owner-link ADR: nex.business_claim
 * holds `claimed_by_account_id` as text (not FK) because nex_account
 * lives in Supabase while nex.business_claim lives in NEX Postgres.
 */
async function loadOwnerFactsForCanonical(
  canonicalBusinessId: NexUuid,
): Promise<OwnerFacts | null> {
  // Step 1 · load the VERIFIED claim from NEX Postgres.
  const claimResult = await withClient(async (client) =>
    client.query(
      `SELECT claimed_by_account_id
         FROM nex.business_claim
        WHERE canonical_business_id = $1
          AND state = 'VERIFIED'
          AND claimed_by_account_id IS NOT NULL
        ORDER BY updated_at DESC
        LIMIT 1`,
      [canonicalBusinessId],
    ),
  );
  if (claimResult === null || claimResult.rows.length === 0) return null;
  const firstRow = claimResult.rows[0] as { claimed_by_account_id?: unknown };
  const ownerAccountId =
    typeof firstRow.claimed_by_account_id === "string"
      ? firstRow.claimed_by_account_id
      : null;
  if (!ownerAccountId || ownerAccountId.length === 0) return null;

  // Step 2 · load the owner account from Supabase.
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select("tier, bisnis_expires_at, themes_trial_used_at, subscription_plan")
    .eq("id", ownerAccountId)
    .maybeSingle();
  if (error || !data) return null;
  return data as OwnerFacts;
}

async function loadLifecycleForCanonical(
  canonicalBusinessId: NexUuid,
): Promise<string | null> {
  const result = await withClient(async (client) =>
    client.query(
      `SELECT lifecycle_state FROM nex.business_canonical
        WHERE canonical_business_id = $1 LIMIT 1`,
      [canonicalBusinessId],
    ),
  );
  if (result === null || result.rows.length === 0) return null;
  const row = result.rows[0] as { lifecycle_state?: unknown };
  return typeof row.lifecycle_state === "string" ? row.lifecycle_state : null;
}

/**
 * Load the business + owner, resolve the effective tier, apply the
 * precedence rules, return the allowance.
 *
 * Honest-null behaviour: on any DB failure the return value is
 * UNCLAIMED_ALLOWANCE. Callers never get an exception.
 */
export async function getThumbnailAllowance(
  canonicalBusinessId: NexUuid,
): Promise<ThumbnailAllowance> {
  try {
    const [lifecycleState, owner] = await Promise.all([
      loadLifecycleForCanonical(canonicalBusinessId),
      loadOwnerFactsForCanonical(canonicalBusinessId),
    ]);

    const effTier = owner
      ? effectiveTier(owner as Pick<NexAccountRow, "tier" | "bisnis_expires_at" | "themes_trial_used_at">)
      : null;

    return resolveThumbnailAllowanceFromRaw({
      lifecycleState,
      effectiveTier: effTier,
      subscriptionPlan: owner?.subscription_plan ?? null,
    });
  } catch {
    // Fail-closed · never block the render path with a thrown error.
    return UNCLAIMED_ALLOWANCE;
  }
}

// ─── enforcement at ingestion ──────────────────────────────────────

/**
 * Assert the owner can add another thumbnail. Called BEFORE any
 * INSERT into business_media for `media_kind IN ('owner_image',
 * 'verified_real')`. Throws NexTierLimitError on cap breach.
 *
 * Current count = approved business_media rows for this business,
 * excluding category_fallback (which is a library pointer, not an
 * owner slot).
 *
 * CRITICAL: this guard is at the WRITE boundary. It cannot be
 * bypassed by direct SQL (which stays an admin-only privilege) but
 * ANY future owner-upload API MUST call this function before
 * inserting.
 */
export async function assertCanAddThumbnail(
  canonicalBusinessId: NexUuid,
): Promise<void> {
  const allowance = await getThumbnailAllowance(canonicalBusinessId);
  if (allowance.slots === 0) {
    throw new NexTierLimitError(
      "thumbnail_unclaimed",
      "This listing is unclaimed; no owner-managed thumbnails allowed. Claim the listing first.",
    );
  }
  const countResult = await withClient(async (client) =>
    client.query(
      `SELECT count(*)::text AS n
         FROM nex.business_media
        WHERE canonical_business_id = $1
          AND media_kind IN ('owner_image', 'verified_real')
          AND approved = true`,
      [canonicalBusinessId],
    ),
  );
  const countRow = countResult?.rows[0] as { n?: unknown } | undefined;
  const current = typeof countRow?.n === "string" ? Number(countRow.n) : 0;
  if (current >= allowance.slots) {
    throw new NexTierLimitError(
      "thumbnail_cap_reached",
      `This listing has reached its ${allowance.slots} thumbnail limit (${allowance.tierLabel}). ` +
        "Existing media remains stored; upgrading the plan increases the visible count.",
    );
  }
}
