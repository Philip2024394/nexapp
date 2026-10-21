# NEX Theme Commerce · Three-Product Model (Theme · Intro · Shop) · DRAFT

**Status:** 📝 DRAFT · owner-recorded 2026-10-21 (RECOMMENDATIONS for owner review · NOT approved · NOT locked · NOT authorisation to implement)
**Author:** Claude (drafting owner-authored directions under explicit "draft go" authorisation 2026-10-21)
**Date:** 2026-10-21
**Supersedes:** `docs/doctrine/nex-theme-commerce-purchase-journey-draft-2026-10-20.md` (two-product scope · superseded by this three-product extension; D1–D5 from that draft are carried forward with the owner-recorded recommendations unchanged, and extended to Shop in sections below)
**Companion documents (verified present in the repo):**
- `docs/doctrine/nex-theme-commerce-vault-receipt-plan-2026-10-14.md` (DECISION RECORDED 2026-10-14 · receipt feature deferred to Stage 5)
- `docs/doctrine/nex-vault-entitlements-policy-sheet-2026-10-20.md` (LOCKED 2026-10-20 · Vault entitlements)
- `docs/doctrine/nex-package-contract-draft-2026-10-20.md` (DRAFT · owner-recorded package contract)
- `docs/doctrine/nex-service-principle-draft-2026-10-20.md` (DRAFT · owner-recorded service principle)

---

## 0 · What this document IS and IS NOT

### IS

A recording of the owner's directions for extending NEX chat-theme commerce from a two-product model (Theme + Intro, drafted 2026-10-20) to a **three-product model (Theme + Intro + Shop)**. Captures the SHAPE of the commerce surface, the eight-state ownership matrix, the compatibility rules, and the bundle policy, without committing to prices, currencies, payment-provider wiring, or implementation.

### IS NOT

- **NOT an approval or lock.** Owner review is required before sealing. Sealing follows the Vault Entitlements Policy pattern (2026-10-20).
- **NOT authorisation to implement** any slice.
- **NOT authorisation to apply** any migration proposed below. Every migration mentioned is a schema SKETCH only, requiring separate owner authorisation per Safety Constitution §5.
- **NOT a commitment** on any of: prices · currencies · taxes · discount percentage · payment provider · provider integration · release-posture for themes commerce · retirement of any existing surface.
- **NOT a change** to: LOCKED Vault Entitlements Policy · DRAFT Package Contract · DRAFT Service Principle · Phase A1 release hold (free-chat revocation unaffected) · PWA installation flow · the existing single free chat theme · the sealed `/nex-native/free-chat` surface built 2026-10-21.

---

## A · The three products (formal definitions)

### A1 · Theme

**Definition:** the chat appearance assets rendered inside the chat canvas:
- wallpaper (background image or gradient)
- bubble styling (incoming + outgoing shape, color, border, backdrop)
- composer chrome styling
- ambient effects (particle layers, overlays, visual atmosphere INSIDE the chat canvas)

**Scope boundary — Theme is NOT:**
- the entrance animation (that is Intro)
- the shop storefront chrome (that is Shop)
- the user's chat name, avatar, NEX ID, or any account identity

**Catalog source (verified):** `src/app/nex-native/chat-standard/packages/*.package.ts` + the sealed browser catalog loaded by `src/app/nex-native/chat-themes-library/_load-library-data.ts`.

### A2 · Intro

**Definition:** the animated opening experience that plays when a theme's chat is entered or launched. Previewable independently from the chat background.

**Scope boundary — Intro is NOT:**
- a chat-canvas visual effect (that is Theme)
- a video attached to a message (unrelated)
- the sealed `StandardIntroOverlay` behaviour on first-visit; that remains a Theme-level affordance

**Catalog source (requires verification before sealing):** the intro assets likely live alongside each theme package (`intro.mp4` or similar). The exact column, path, and manifest MUST be audited before Stage 1. **I cannot verify in this draft that every theme has an intro asset.** Mark as owner-decision gate.

### A3 · Shop

**Definition:** the themed storefront experience rendered on the public business face at `/nex-native/[businessSlug]`. The Shop SKU unlocks the right to apply a themed cover + storefront chrome on top of the sealed Cover-A render path.

**Scope boundary — Shop is NOT:**
- a parallel shop catalog (MUST align with existing `/nex-native/cover-themes-library`)
- the business owner's business account tier (that is handled by `nex_account.tier`, LOCKED Vault + Package Contract)
- a product/inventory system (that is unchanged)

**Catalog source (verified):** `src/app/nex-native/cover-themes-library/page.tsx` + the owner-override fields added by migration 212 (`shop_cover_image_url`, `shop_cover_tint_hex` on `nex_business`). Migration 212 is confirmed present in `nex-supabase/migrations/212_nex_business_shop_cover_overrides.sql` and is marked `FOUNDER AUTHORISATION PENDING` at the top of its own header — it has NOT been applied to production. **This doctrine does NOT change migration 212's authorisation state.**

### A4 · Why three independent SKUs

| Reason | Consequence |
|---|---|
| Different purchase intents | A business owner may want Shop without Intro; a social user may want Theme without Shop. |
| Different asset cost structures | Themes = CSS + wallpaper. Intros = video rendering. Shops = cover art + layout tuning. Separate pricing reflects separate production cost. |
| Different compatibility surfaces | Themes activate on account-level `chat_theme`. Intros activate on theme-entry hook. Shops activate on `nex_business` row. Three distinct activation targets ⇒ three distinct entitlements. |
| Doctrine honesty | "Server-side entitlement = one row per paid asset" is the only honest way to prevent accidental cross-grants. |

---

## B · SKU + entitlement model (schema sketch — authorisation required to migrate)

### B1 · Verified existing tables

Confirmed present in the repo:
- `nex-supabase/migrations/193_nex_theme_purchase.sql` (payment-side records)
- `nex-supabase/migrations/194_nex_theme_ownership.sql` (ownership-side records)

**These migrations' current content has NOT been audited in this draft.** Before Stage 1 the Theme-side schema must be read in full to confirm:
- Which columns exist on `nex_theme_purchase` + `nex_theme_ownership`
- Whether an existing `revoked_at` column supports the refund path (per Purchase-Journey DRAFT D5)
- Whether composite FK on ownership rows aligns with D2 (atomic purchase+ownership creation)

Mark as owner-decision gate: **"audit migrations 193 + 194 as read-only before authorising B2–B4."**

### B2 · Proposed Intro-side schema (DRAFT · requires authorisation)

Two new tables, mirroring the Theme-side pattern:

```
-- DRAFT · NOT applied · needs separate authorisation per §5
CREATE TABLE public.nex_intro_purchase (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.nex_account(id),
  intro_id text NOT NULL,
  -- compatible_theme_id text  (see §D compatibility · may live on the intro
  -- row directly or in a sibling `nex_intro_catalog` table · owner decides)
  payment_reference text NOT NULL,          -- Purchase-Journey D1 Option B
  payment_captured_at timestamptz NOT NULL,
  amount_minor_units bigint NOT NULL,       -- stored in minor units
  currency text NOT NULL,                   -- awaiting approved currency list
  idempotency_key uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.nex_intro_ownership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.nex_account(id),
  intro_id text NOT NULL,
  purchase_id uuid NOT NULL REFERENCES public.nex_intro_purchase(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  UNIQUE (account_id, intro_id)
);
```

### B3 · Proposed Shop-side schema (DRAFT · requires authorisation + alignment review)

**Alignment decision:** Shop ownership is a NEW schema; it is NOT written into `nex_business.shop_cover_*` columns from migration 212. Those two columns remain OWNER-override fields (they persist the owner's chosen image + tint); the ENTITLEMENT to tune them in a themed way comes from the Shop ownership row.

```
-- DRAFT · NOT applied · needs separate authorisation per §5
CREATE TABLE public.nex_shop_purchase (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.nex_account(id),
  shop_id text NOT NULL,                    -- maps to cover-themes-library id
  payment_reference text NOT NULL,
  payment_captured_at timestamptz NOT NULL,
  amount_minor_units bigint NOT NULL,
  currency text NOT NULL,
  idempotency_key uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.nex_shop_ownership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.nex_account(id),
  shop_id text NOT NULL,
  purchase_id uuid NOT NULL REFERENCES public.nex_shop_purchase(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  UNIQUE (account_id, shop_id)
);
```

**No parallel shop catalog.** The `shop_id` column references the sealed cover-themes-library catalog (currently in `_load-library-data.ts` for themes; the Shop-side counterpart must be identified and reused, not duplicated).

### B4 · Bundle (Complete Bundle · DRAFT)

**The Complete Bundle does NOT create a composite SKU with its own ownership row.** It is a *purchase mechanism* that opens three transactions atomically. The database remains the single source of truth: three separate ownership rows (Theme + Intro + Shop) linked to a single `bundle_purchase_id`.

```
-- DRAFT · NOT applied · needs separate authorisation per §5
CREATE TABLE public.nex_bundle_purchase (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.nex_account(id),
  theme_id text NOT NULL,
  intro_id text NOT NULL,
  shop_id text NOT NULL,
  payment_reference text NOT NULL,
  payment_captured_at timestamptz NOT NULL,
  amount_minor_units bigint NOT NULL,       -- total bundle price
  currency text NOT NULL,
  discount_minor_units bigint NOT NULL,     -- explicit discount off standalone sum
  idempotency_key uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Three ownership rows (theme_ownership + intro_ownership + shop_ownership) are created in the same transaction, each referencing `nex_bundle_purchase.id` via a `bundle_purchase_id` column on the ownership tables (DRAFT · requires authorisation).

**Why not a composite row:** separate ownership rows preserve the honest statement "the user owns Theme X, Intro Y and Shop Z". A composite row would create an opaque pseudo-grant that violates D4 (preserve financial history) when later refunding one component.

**Pair bundles (T+I, T+S, I+S) are explicitly deferred.** This doctrine ships Complete Bundle only. Revisit after seeing purchase mix.

---

## C · The eight-state ownership matrix

Every theme card renders one of eight states. The matrix is enumerated here so the UI contract is doctrine-aligned.

| # | T | I | S | Card display | Available actions | Remaining purchase options |
|---|---|---|---|---|---|---|
| 1 | — | — | — | Theme name · artwork · "Premium" badge where applicable | Preview Theme · Preview Intro · Preview Shop | Buy Theme · Buy Intro · Buy Shop · Buy Complete Bundle (if genuinely discounted) |
| 2 | ✓ | — | — | "Theme Owned ✓" | Use Theme · Preview Intro · Preview Shop | Buy Intro · Buy Shop · Bundle upgrade credit (future consideration) |
| 3 | — | ✓ | — | "Intro Owned ✓" | Preview Theme · Use Intro (where supported) · Preview Shop | Buy Theme · Buy Shop · Bundle upgrade credit (future consideration) |
| 4 | — | — | ✓ | "Shop Owned ✓" | Preview Theme · Preview Intro · Use Shop | Buy Theme · Buy Intro · Bundle upgrade credit (future consideration) |
| 5 | ✓ | ✓ | — | "Theme + Intro Owned ✓✓" | Use Theme · Use Intro | Buy Shop |
| 6 | ✓ | — | ✓ | "Theme + Shop Owned ✓✓" | Use Theme · Use Shop | Buy Intro |
| 7 | — | ✓ | ✓ | "Intro + Shop Owned ✓✓" | Use Intro · Use Shop | Buy Theme |
| 8 | ✓ | ✓ | ✓ | "All Owned ✓✓✓" | Use Theme · Use Intro · Use Shop | — |

**Doctrine rules on the matrix:**
- Owning one product MUST NOT visually hide the other two. Every state above shows the full three-slot card.
- Owned items render "Owned ✓" + a "Use …" affordance.
- Un-owned items render the preview + buy affordance.
- Bundle upgrade credit (states 2–7 → state 8) is deferred as a **future consideration**. First draft ships standalone-only once a user has partial ownership; the user re-enters single-SKU purchases. Owner may lift this later with pair-bundle doctrine.

---

## D · Compatibility (authoritative server-side)

### D1 · Why compatibility matters

An Intro produced for Theme A may be semantically or visually broken on Theme B. A Shop skin designed for a food business may be incoherent on a Joker-base chat theme. Allowing cross-combinations the designers never intended would:
- Confuse the user visually
- Appear in advertising screenshots as "all combinations work" (a promise the system can't honour per Service Principle)
- Create support load

### D2 · Compatibility declaration

Each Intro and Shop declares a **compatibility list** of Theme IDs it is approved to pair with. One Intro MAY be compatible with multiple Themes; one Shop MAY be compatible with multiple Themes. One Theme MAY have multiple compatible Intros and Shops.

**Storage sketch (DRAFT):**
```
-- Option 1 · array column on the catalog row:
-- intro_catalog.compatible_theme_ids  text[] NOT NULL
-- shop_catalog.compatible_theme_ids   text[] NOT NULL
--
-- Option 2 · join tables:
-- nex_intro_theme_compat (intro_id, theme_id)
-- nex_shop_theme_compat  (shop_id, theme_id)
--
-- Owner-decision gate: which pattern. Option 2 is tidier for
-- analytics; Option 1 is a one-liner read for the card.
```

### D3 · Server-side enforcement

The compatibility list is enforced at the API level for THREE operations:
1. **Preview:** the preview surface for an Intro reveals its compatibility; a user previewing on an incompatible Theme sees a label "Not compatible with your current Theme — compatible with: …". No API blocking (previews are always safe).
2. **Purchase:** `POST /api/.../intro-purchase` or `POST /api/.../shop-purchase` accepts the purchase REGARDLESS of the user's current active theme (users may buy for a future theme). Honesty surface: the UI must inform the user if their currently-active theme is incompatible, so the purchase is explicit.
3. **Activation:** `POST /api/.../activate-intro` or `POST /api/.../activate-shop` CHECKS that the user's currently-active chat theme is in the intro/shop's `compatible_theme_ids`. If not, the API returns `incompatible` and the UI shows "You own this Intro, but it only works with: ThemeA, ThemeB. Activate ThemeA first." No silent activation of an incompatible pair.

### D4 · Non-promise of compatibility

The system MUST NOT imply compatibility that has not been verified. If a Theme has NO compatible Intro, the Theme card shows "No Intro available for this Theme" (never a greyed Intro button that looks like it should work).

---

## E · Preview behaviour (always safe, never grants ownership)

### E1 · Preview Theme

Opens an interactive preview of the real chat canvas with the Theme applied: real wallpaper, real bubble shapes, real composer. User interactions in the preview are visual-only (typing cycles through a sample conversation; sending is simulated).

**Doctrine rule:** the preview MUST NOT touch `nex_account.chat_theme`, MUST NOT fire `onPickTheme` cookies, MUST NOT grant ownership, MUST NOT persist a selection. Preview exit returns the user to the library at their prior scroll position + filter state.

### E2 · Preview Intro

Plays the actual intro video/animation inside a preview sheet with Play / Replay / Close controls. Preview is bandwidth-aware: lazy-loaded, honours the user's `prefers-reduced-motion` setting.

**Doctrine rule:** same safety rules as E1 (never grants).

### E3 · Preview Shop

Opens an interactive preview of the public shop face (`/nex-native/[businessSlug]`-style surface) rendered with the Shop skin applied. If the user is a Bisnis account owner, the preview MAY render with their own `nex_business` row as the demo content; otherwise a sealed demo business is used.

**Doctrine rule:** same safety rules; preview NEVER writes to `nex_business.shop_cover_image_url` or `shop_cover_tint_hex` (those remain owner-authored fields per migration 212).

---

## F · Purchase flow (ownership-aware, idempotent)

### F1 · Pre-purchase server gate

Before accepting any purchase request:
1. Resolve the acting account id from the session (never trust client-supplied).
2. Resolve the SKU (theme_id | intro_id | shop_id | bundle components).
3. Check existing ownership rows for that account + SKU where `revoked_at IS NULL`.
4. If owned → return `already_owned` with the owned SKU details. UI shows "You already own this".
5. For an Intro/Shop purchase, OPTIONALLY check compatibility with the user's current active theme and surface a non-blocking honesty label. Compatibility is NOT a purchase gate.
6. Validate the price-source is `APPROVED` in `pricing-config.ts`. If `PROPOSAL` or `WITHDRAWN`, refuse the purchase with `unapproved_price`. (Pricing-config approval status is enforced per the existing `isPackageReadyForLive()` helper, confirmed in `src/lib/nex-native/pricing-config.ts`.)

### F2 · Atomic purchase + ownership creation

Carried forward unchanged from Purchase-Journey DRAFT D2: the admin-confirmation action creates both the purchase row and the ownership row in a single transaction. Explicit rollback on either failure.

### F3 · Payment states

| State | What it means | Entitlement effect |
|---|---|---|
| `pending` | Operator has recorded the request but not yet confirmed receipt | No ownership row created |
| `confirmed` | Operator has verified payment evidence | Ownership row created in the same transaction |
| `failed` | Payment evidence rejected (wrong amount, duplicate reference, etc.) | No ownership row created |
| `refunded` | Ownership previously granted, now revoked | `revoked_at` set on the ownership row (D5 of Purchase-Journey DRAFT) |

**No ownership MAY be granted on `pending` or `failed`.** Enforced by the atomic transaction (purchase row is written with the state inline; ownership row is only inserted when the state is `confirmed`).

### F4 · Idempotency

Each purchase attempt carries an `idempotency_key` (UUID). Duplicate submissions with the same key return the original purchase row without creating a second one. Enforced by the `UNIQUE` constraint on `idempotency_key` in each of `nex_theme_purchase`, `nex_intro_purchase`, `nex_shop_purchase`, `nex_bundle_purchase`.

### F5 · Bundle atomicity

A Complete Bundle purchase inserts ONE `nex_bundle_purchase` row and THREE ownership rows (theme + intro + shop) inside a single transaction. If ANY of the four inserts fails, ALL roll back. The user sees `bundle_purchase_failed` and no partial ownership is granted.

---

## G · Bundle discount policy

### G1 · Discount floor

The Complete Bundle price MUST be strictly less than the sum of the three standalone APPROVED prices. If any of the three standalone prices is not APPROVED, the Complete Bundle MUST NOT be offered.

### G2 · Discount surface

The discount is explicitly surfaced on the card: "Complete Bundle — Save {discount_amount}". No hidden savings; no "limited time" framing without an actual expiry mechanism.

### G3 · No misleading bundles

If a Theme has no Intro OR no Shop, the Complete Bundle does NOT appear on that card. The user sees only the available products (Theme + Intro OR Theme + Shop OR Theme-alone), with no implied third slot.

### G4 · Partial-ownership bundle upgrades (DEFERRED)

A user in states 2–7 (partial ownership) who wants the remaining items via a discount is NOT catered to in this doctrine. The remaining items are offered at standalone APPROVED prices. Pair-bundles + upgrade credits are deferred as a future consideration.

---

## H · Shop alignment with existing infrastructure

### H1 · The two authoritative references

1. **`/nex-native/cover-themes-library/page.tsx`** (verified present) — the existing surface where Shop cover themes are browsed. **The Shop SKU in this doctrine extends this surface with purchase + ownership · it does NOT replace the surface or create a parallel.**
2. **Migration 212 (`nex_business_shop_cover_overrides.sql`)** (verified present, FOUNDER AUTHORISATION PENDING per the migration's own header) — adds `shop_cover_image_url` + `shop_cover_tint_hex` nullable columns on `nex_business` for owner-authored overrides.

### H2 · Owner-override vs Shop ownership (separation of concerns)

| Column / Table | Purpose | Does Shop ownership grant this? |
|---|---|---|
| `nex_business.shop_cover_image_url` | Owner-uploaded background image | **No.** This is a per-business owner-authored field. Shop ownership unlocks the ability to apply a *themed* skin; the override columns are the user's own art. |
| `nex_business.shop_cover_tint_hex` | Owner-selected accent hex | **No.** Same as above. |
| `nex_shop_ownership` (PROPOSED) | Entitles the account to render a Shop skin from the cover-themes-library catalog | **Yes.** This is the paid entitlement. |

### H3 · Shop activation path

When a Bisnis account activates a Shop they own:
- The sealed Cover-A render path reads `nex_business.chat_theme` (unchanged behaviour).
- The themed skin is applied ONLY IF `nex_shop_ownership` exists for the active shop + account AND `revoked_at IS NULL` AND the shop_id is compatible with the active theme (per section D).
- Owner-override columns (`shop_cover_image_url`, `shop_cover_tint_hex`) continue to compose as per migration 212 header: `shop_cover_image_url > theme.hero_image_url > moody-gradient fallback`.

### H4 · Non-business accounts

Shop SKU is purchasable by any account, but activation requires the account to own a `nex_business` row. Non-business owners who purchase a Shop can preview but cannot activate until they create a business.

**Honesty surface:** the Shop card for a non-business viewer shows a note "Requires a NEX business account to activate" so the purchase is explicit.

---

## I · Restore & cross-device

### I1 · Server-authoritative

On every session resolution (per `src/lib/nex-native/app/session.ts`), the user's ownership is reconstructed from the three ownership tables. No client-side cache is treated as authoritative.

### I2 · Device migration

A user signing in on a new device sees their full ownership state immediately after session resolution. No "restore purchases" button is needed; the server IS the restore.

### I3 · Revocation visibility

A revoked ownership row (via refund per Purchase-Journey DRAFT D5) is visible to the user as `revoked` with the refund reference, so there's no mystery about why a product disappeared.

---

## J · Doctrine boundaries (what this draft does NOT decide)

Awaiting owner explicit decision, each marked here so no implementation moves without a signed-off answer:

| Decision | Status | Who decides |
|---|---|---|
| Standalone Theme price per currency | **Awaiting owner** | Owner |
| Standalone Intro price per currency | **Awaiting owner** | Owner |
| Standalone Shop price per currency | **Awaiting owner** | Owner |
| Complete Bundle discount formula / amount | **Awaiting owner** | Owner |
| Currencies supported at launch | **Awaiting owner** | Owner |
| Tax / VAT handling | **Awaiting owner** | Owner |
| Payment provider | **Awaiting owner** — Purchase-Journey DRAFT D1 Option B (manual confirmation) stands unless explicitly superseded | Owner |
| Themes-commerce release approval | **Awaiting owner** — Phase A1 release-hold revocation only covers free-chat (per 2026-10-21 directive) | Owner |
| Audit of migrations 193 + 194 | **Pending** — this draft has NOT read 193/194 line-by-line | Author of implementation PR, reviewed by owner |
| Compatibility storage pattern (array vs join table) | **Awaiting owner** | Owner |
| Intro asset manifest + per-theme audit | **Awaiting owner** | Owner |
| Preview-sheet UX details (sheet height, close affordance, replay controls) | **Deferred to UI design slice** | Design + owner review |
| Preview Shop demo-business when viewer is a non-business account | **Awaiting owner** — synthetic demo vs none | Owner |

---

## K · Migration implications (schema DRAFTS only · authorisation required)

The following migrations are IMPLIED by this doctrine. None are authored, none are applied. Each requires separate owner authorisation per Safety Constitution §5.

| # | Purpose | Status |
|---|---|---|
| DRAFT-M1 | `nex_intro_purchase` + `nex_intro_ownership` tables | Not authored |
| DRAFT-M2 | `nex_shop_purchase` + `nex_shop_ownership` tables | Not authored |
| DRAFT-M3 | `nex_bundle_purchase` table + `bundle_purchase_id` column on each of the three ownership tables | Not authored |
| DRAFT-M4 | Compatibility storage (`compatible_theme_ids` columns OR join tables — owner decides pattern) | Not authored |
| DRAFT-M5 | Intro catalog table (or extension of an existing table — audit required) | Not authored |
| DRAFT-M6 | Shop catalog alignment confirmation (whether cover-themes-library already has a sealed catalog table or lives purely in TypeScript — audit required) | Not authored |

**Migration 212 is NOT modified by this doctrine.** It retains its FOUNDER-AUTHORISATION-PENDING status. The Shop SKU work does NOT require 212 to be applied first; the two are independent concerns (212 handles owner overrides, this doctrine handles paid entitlement).

---

## L · Acceptance criteria for sealing this doctrine

Before this doctrine can be LOCKED (upgraded from DRAFT to sealed, in the pattern of the Vault Entitlements Policy lock of 2026-10-20), the following owner decisions MUST be recorded:

1. ✅ Three-product model agreed (**recorded 2026-10-21 by owner, "draft go"**)
2. ⬜ Prices approved for Theme / Intro / Shop per currency
3. ⬜ Complete Bundle discount formula approved
4. ⬜ Payment-provider decision (keep manual-confirmation Option B OR authorise provider)
5. ⬜ Compatibility storage pattern selected (array column vs join table)
6. ⬜ Intro catalog audit complete (confirm every intended intro has an asset)
7. ⬜ Shop catalog alignment confirmed (no parallel catalog)
8. ⬜ Themes-commerce release approval (separate from free-chat release approval)
9. ⬜ Migrations 193 + 194 audited line-by-line to confirm Theme-side alignment with this draft
10. ⬜ Service Principle compatibility statement — this commerce surface MUST pass the "never promise what isn't delivered" test before launch

Once items 2–10 are all recorded, the doctrine becomes LOCKED and references in code may reference it as authoritative.

---

## M · Explicitly out of scope

The following remain explicitly OUT OF SCOPE for this doctrine:

| Item | Reason |
|---|---|
| Pair bundles (T+I, T+S, I+S) | Deferred — revisit after launch purchase mix |
| Partial-ownership upgrade credits | Deferred — same reason |
| Gifting Themes / Intros / Shops | Deferred |
| International price localisation beyond currency selection | Deferred |
| Receipt feature for commerce purchases | DEFERRED to Stage 5 per 2026-10-14 vault-receipt doctrine |
| "My Themes" interface | Deferred — out of scope per Purchase-Journey DRAFT |
| PWA "Add NEX to your home screen" | **Permanently out of commerce scope.** This is an install affordance, not a SKU. It renders separately per existing conventions (see free-chat `_canvas-client.tsx` + the owner's recorded 2026-10-21 directive). |
| Changes to the existing single free chat theme | Preserved. Free-chat behaviour and free-chat first-visit flow are UNAFFECTED by this doctrine. |
| Changes to migration 212 | Preserved. Migration 212 retains its FOUNDER-AUTHORISATION-PENDING status; this doctrine does not modify it. |

---

## N · Verifiability of this draft

Statements in this draft that are **verified** against the repo:
- Existence of `docs/doctrine/nex-theme-commerce-purchase-journey-draft-2026-10-20.md` ✓
- Existence of `docs/doctrine/nex-theme-commerce-vault-receipt-plan-2026-10-14.md` ✓
- Existence of `docs/doctrine/nex-vault-entitlements-policy-sheet-2026-10-20.md` ✓
- Existence of `docs/doctrine/nex-package-contract-draft-2026-10-20.md` ✓
- Existence of `nex-supabase/migrations/212_nex_business_shop_cover_overrides.sql` ✓
- Content of migration 212 header (FOUNDER AUTHORISATION PENDING) ✓
- Existence of `nex-supabase/migrations/193_nex_theme_purchase.sql` ✓
- Existence of `nex-supabase/migrations/194_nex_theme_ownership.sql` ✓
- Existence of `src/app/nex-native/cover-themes-library/page.tsx` ✓
- `pricing-config.ts` approval-status model (`PROPOSAL / APPROVED / WITHDRAWN` + `isPackageReadyForLive()` helper) ✓

Statements in this draft that are **NOT verified** and must be audited before sealing:
- Line-by-line schema of migrations 193 + 194 (NOT read in full by this draft; schemas sketched in §B are implied, not confirmed)
- Existence or absence of an existing intro catalog
- Whether cover-themes-library has a sealed catalog table on the Supabase side or lives purely in TypeScript
- Whether the sealed render path at `/nex-native/{businessSlug}` has a hook for themed Shop skinning or whether that hook is also pending

The owner should treat all §B schema sketches and §K migration implications as **candidate** schemas; the implementing PR must audit the Theme-side authoritative schemas first and align this doctrine's wording to match.

---

## O · Summary of what the draft decides vs defers

**Decides (recommendation to lock):**
- Theme + Intro + Shop are three independent products.
- Eight-state ownership matrix is the UI contract.
- Shop aligns with `/nex-native/cover-themes-library` and migration 212 (does NOT create a parallel catalog or modify 212).
- Compatibility is server-enforced at the activation API, surfaced in UI, non-blocking at purchase.
- Complete Bundle only (pair bundles deferred).
- Idempotency keys on every purchase + separate ownership rows preserve financial history (Purchase-Journey DRAFT D4 carried forward).
- Preview surfaces are always safe (never grant ownership).
- PWA install stays separate (not a SKU).
- Free-chat behaviour and the single free theme are UNAFFECTED.

**Defers to explicit owner decision:**
- All prices, currencies, taxes, discount amount
- Payment provider / integration state
- Compatibility storage pattern
- Themes-commerce release-posture approval
- Audit of migrations 193 + 194
- Intro catalog manifest audit
- Shop catalog alignment confirmation (TypeScript vs DB-table)

**Status at end of this draft:** 📝 **DRAFT** · pending owner review · NO implementation authorised · NO code written · NO migrations applied.
