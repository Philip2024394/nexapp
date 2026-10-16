# Business Thumbnail Entitlement Architecture

Founder-sealed · 2026-10-13 · Decision 3 · Option 2B.

## Objective

A business listing's thumbnail strip count is tier-gated. The limit is one authoritative server-side value, derived from the business's current entitlement state.

## The sealed ladder

| Business state | Thumbnail slots | Extra entitlement |
|---|---|---|
| Unclaimed | 0 | Category illustration only |
| Claimed · Gratis | 3 | — |
| Ringan | 6 | — |
| Bisnis | 12 | Featured placement |
| Own Theme | 24 | Customisable layout |

## Why 5 levels when the authoritative tier model has 3

Audited existing data model:

- `nex_account.tier ∈ {gratis, bisnis, pro}` — **feature-gate axis** (migration 046; CHECK constraint). Only 3 legal values.
- `nex_account.subscription_plan ∈ {buy, ringan, bisnis, custom}` — **pricing-plan axis** (migration 090). Set by admin when payment confirmed (`/nex-native/admin/tier` server action).
- `business_canonical.lifecycle_state ∈ {ONBOARDING, UNVERIFIED, VERIFIED, OWNER_CLAIMED, OWNER_VERIFIED, DISCONTINUED, SUPERSEDED}` — **claim axis** (migration 167).
- `account-service.ts:249 · effectiveTier(account)` — the resolver that respects Bisnis lapse (`bisnis_expires_at`) and the one-shot 7-day themes trial.

The 5 ladder rungs are not inventing new values; they are a precedence-ordered combination of these three existing axes.

## Authoritative resolution (precedence-ordered)

```ts
function resolveThumbnailAllowance(business, owner): Allowance {
  // 1. Unclaimed · the business has no owner · no owner-curated slots.
  if (business.lifecycle_state !== "OWNER_CLAIMED" &&
      business.lifecycle_state !== "OWNER_VERIFIED") {
    return { slots: 0, featured: false, custom: false, tierLabel: "unclaimed" };
  }

  // 2. "Own Theme" bought · 24 slots + custom layout.
  //    Independent of tier · a Gratis account can buy a custom theme and
  //    gets the merchandising benefit regardless of tier axis.
  if (owner.subscription_plan === "custom") {
    return { slots: 24, featured: true, custom: true, tierLabel: "custom" };
  }

  // 3. Pro tier · reserved for phase 2 · same cap as Own Theme.
  const effTier = effectiveTier(owner);
  if (effTier === "pro") {
    return { slots: 24, featured: true, custom: true, tierLabel: "pro" };
  }

  // 4. Bisnis tier · 12 slots + featured placement.
  //    `effectiveTier` returns 'bisnis' when EITHER:
  //      (a) owner.tier='bisnis' AND bisnis_expires_at is in the future
  //      (b) owner.themes_trial_used_at + 7 days > now (trial active)
  if (effTier === "bisnis") {
    return { slots: 12, featured: true, custom: false, tierLabel: "bisnis" };
  }

  // 5. Ringan subscription · 6 slots.
  //    Theme-centric plan; the thumbnail bonus is a business merchandising
  //    sweetener that lives alongside the rotating-themes benefit.
  if (owner.subscription_plan === "ringan") {
    return { slots: 6, featured: false, custom: false, tierLabel: "ringan" };
  }

  // 6. Default · Claimed Gratis · 3 slots.
  //    This also covers subscription_plan='buy' (one-shot theme purchase ·
  //    doesn't change tier · stays on 3 slots).
  return { slots: 3, featured: false, custom: false, tierLabel: "gratis" };
}
```

## Where it lives

**Proposed file**: `src/lib/nex-native/directory/thumbnail-entitlement.ts`

**Not yet authored** (per Decision 3 · "First inspect the actual subscription_plan and effectiveTier() implementation. Reuse the existing entitlement machinery where possible").

**Reuses**:
- `effectiveTier(account)` from `src/lib/nex-native/account-service.ts:249` (sealed)
- `NexAccountTier` type from `src/lib/nex-native/types.ts:113`
- `NexSubscriptionPlan` type from `src/lib/nex-native/types.ts:134`
- `nex_business.owner_account_id` lookup pattern from `src/lib/nex-native/tier-gate.ts:60` (`getBusinessOwnerTier` helper · similar signature)

**Pattern to follow**: `tier-gate.ts` already uses `assertCan*` functions that throw `NexTierLimitError` on cap hit. The thumbnail entitlement follows the same shape:

```ts
export interface ThumbnailAllowance {
  readonly slots: number;
  readonly featured: boolean;
  readonly custom: boolean;
  readonly tierLabel: "unclaimed" | "gratis" | "ringan" | "bisnis" | "custom" | "pro";
}

export async function getThumbnailAllowance(
  canonicalBusinessId: NexUuid,
): Promise<ThumbnailAllowance>;

export async function assertCanAddThumbnail(
  canonicalBusinessId: NexUuid,
): Promise<void>;  // throws NexTierLimitError if currentCount >= slots
```

## Enforcement points (where to apply the limit)

Three distinct enforcement surfaces. All server-side. UI never computes the limit itself.

### 1 · Ingestion gate (owner uploads a new image)

- `assertCanAddThumbnail(businessId)` is called BEFORE any INSERT into `business_media` with `media_kind='owner_image'` or `media_kind='verified_real'`.
- Count = current approved `business_media` rows for the business (excluding `category_fallback`).
- Over the cap → throw `NexTierLimitError('thumbnail_cap_reached')`.
- Server action catches and surfaces the upgrade CTA.

### 2 · Display cap (resolver read)

- When `fetchDirectoryMediaByCanonicalId` returns rows for a listing's thumbnail strip, apply `LIMIT N` where `N = allowance.slots`.
- This handles the **downgrade preservation rule** (founder's words): "A downgrade must not delete previously uploaded media. Keep excess media stored and mark or treat it as inactive for display until the tier allows it."
- If a business was Bisnis (12 slots), uploaded 12, then lapsed to Gratis (3 slots), the business_media rows remain approved=true but only the top 3 (by `media_kind` precedence then `updated_at DESC`) surface in the resolver output.
- No row deletion happens on downgrade. The LIMIT is purely a read-side cap.

### 3 · Primary image (unchanged from Phase 1)

- The main hero image for a listing is still "the first approved display-eligible row by precedence" — this is Phase 1 behaviour. Thumbnail entitlement does NOT affect which image is the hero; it affects **how many additional thumbnails** can appear.
- Current media-resolver.ts returns one `primaryImage` per business. The thumbnail strip (Phase 2) will be a separate fetch returning N thumbnails where N = allowance.slots. The two paths share the same approval + source gates but have different LIMIT behaviour.

## Downgrade and upgrade behaviour

| Transition | Effect on existing rows | Effect on display |
|---|---|---|
| Gratis → Ringan | None (3 approved rows remain approved) | Up to 6 of them now surface |
| Ringan → Bisnis | None | Up to 12 surface; featured placement enabled |
| Bisnis → Own Theme | None | Up to 24 surface; custom layout enabled |
| Bisnis → Gratis (lapse) | None (rows stay in DB, stay approved) | Only top 3 surface · others "stored, inactive for display" |
| Any → Unclaimed (admin revokes claim) | None (rows stay) | Zero surface · the listing falls back to category illustration |
| Any → Claim re-verified | None | Allowance recalculated instantly |

Downgrade behaviour is enforced by the LIMIT in the resolver. No separate "activate / deactivate" flag is needed because `allowance.slots` is the single truth.

## Billing separation (Decision 3 reinforcement)

**Keep billing tier and business-feature entitlements logically distinct.**

- `nex_account.tier` is a **feature-gate** (what the user can do). It's set by admin via `admin/tier` after payment confirmation.
- `nex_account.subscription_plan` is a **pricing/billing** record (what the user bought). It's set by admin via the same action.
- `bisnis_expires_at` is a **lapse timer** (when the paid access ends). It's set by admin as part of a Bisnis sale.

The thumbnail entitlement function reads all three but treats them as inputs. It does NOT write to any of them. Billing changes go through the existing admin tier action; the thumbnail entitlement reflects the result.

## Non-goals (deferred)

- **No new DB migration.** The thumbnail entitlement is pure computation over existing columns.
- **No new source_registry row.** The 5 ladder rungs don't need a new source_id.
- **No cron or scheduled recomputation.** The entitlement is read on demand per request.
- **No per-category different limits.** All verticals (food, accommodation, service, products) share the same ladder.
- **No per-user override.** Admin-granted exceptions would need a separate `business.thumbnail_override_slots` column; not in scope.

## Testing plan (when implementation lands)

- Unit test `resolveThumbnailAllowance()` across every ladder rung (6 cases: unclaimed, gratis, ringan, bisnis-active, bisnis-lapsed-returning-gratis, own-theme-custom).
- Regression test that a lapsed Bisnis owner falls back to Gratis slots (3), not stuck at Bisnis (12).
- Regression test that `subscription_plan='buy'` (one-shot theme purchase) does NOT upgrade the slot count (stays at 3).
- Integration test that over-limit INSERT into business_media throws `NexTierLimitError`.
- Integration test that resolver LIMIT caps display at `allowance.slots` even when the DB holds more approved rows.
- Preservation test: downgrade an owner from Bisnis to Gratis; count DB rows (unchanged) + displayed thumbnails (3) + verify the hidden-from-display rows still exist with `approved=true`.

## Open questions for later phases

1. **Where does `subscription_plan='custom'` get set?** Today it's manually set by admin. The "Own Theme Rp 1jt" product doesn't have a self-serve purchase flow in the nexapp fork. The thumbnail entitlement will work when it does; until then only admin-granted custom plans exist.
2. **Is `custom` really 24 slots, or is it configurable per-business?** Founder's build brief said "24 slots + customisable layout." Keeping it fixed at 24 for now.
3. **Should Pro tier differ from Own Theme?** They currently resolve to identical allowance (24 slots, featured, custom). Pro is phase 2 deferred. Could diverge later.
