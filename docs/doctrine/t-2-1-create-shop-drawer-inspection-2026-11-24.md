# T-2.1 · Create Shop drawer — inspection report (pre-implementation)

**Status:** INSPECTION ONLY · no UI change authorised
**Date:** 2026-11-24
**Scope:** Owner-requested check per Stage A Conditional Approval §2.
**Companion:** `nex-founder-foundation-to-near-live-master-plan-2026-11-24.md` §12A.3 row 2.1 · GAP-NAV-001.

The owner required, before any customer-facing UI change: (a) inspect the sealed drawer contract, (b) confirm exact placement and visibility conditions, (c) confirm destination for accounts with vs without a shop, (d) confirm no existing drawer behaviour is displaced. This document reports those findings and the honest implications.

---

## 1 · Primary finding

**The "Create Shop" journey is already wired to the drawer.** The mapping audit's GAP-NAV-001 ("missing Create Shop drawer row") is based on an earlier state of the drawer that predates the sealed 2026-11-12 refactor. The destination currently reachable from the drawer resolves cleanly for both user states (has business / no business).

What is NOT wired is a **label** that reads clearly to a new user. The current label is `Shop Settings` with subtitle `Edit shop · products · theme`, which does not communicate "start here to create your shop" to a first-time seller.

This changes the nature of T-2.1 from "add a missing drawer row" to a label/subtitle/visibility decision the Founder must choose between.

---

## 2 · Evidence — sealed drawer contract

### 2.1 · Component file
`src/components/nex-native/control-drawer/control-drawer-client.tsx` (2,266 lines). Test: `src/components/nex-native/control-drawer/__tests__/control-drawer-client.test.tsx` (420 lines).

### 2.2 · Sealed removal of the YOUR BUSINESS section (2026-11-04/05)

```
// Owner directive 2026-11-05 · YOUR_BUSINESS_ROWS, BUSINESS_VAULT_ROW,
// buildBusinessSectionRows all REMOVED. The drawer renders exactly one
// row set globally (see YOUR_NEX_ROWS + PREFERENCES_ROWS). My shop,
// Creator, Payments, Membership + billing, Business Vault destinations
// remain reachable by direct URL · they are no longer surfaced through
// this drawer.
```
(`control-drawer-client.tsx:442-447`)

```
// Owner-authorised 2026-11-04 later-same-day · NEX Ireland drawer
//  trim · YOUR BUSINESS section removed from the drawer surface.
//  My shop · Business Vault · Creator · Payments · Membership +
//  billing destinations remain reachable via direct URL + the
//  dedicated /manage + /settings pages.
```
(`control-drawer-client.tsx:1109-1114`)

### 2.3 · Sealed addition of the Shop Settings row (2026-11-12 / renamed 2026-11-13)

```
// Owner directive 2026-11-12 · dedicated "Shop Settings" row routes
// to the sealed /nex-native/manage landing · three tiles (Edit Shop,
// Edit Products, Edit Shop Theme) that each reuse their existing
// surface. Sellers with no business row yet are redirected by the
// landing to the sealed shop-setup dispatcher · no broken state.
// Renamed from "Manage Shop" to "Shop Settings" 2026-11-13 so the
// drawer reads as a pair with Chat Settings · both are the hub
// entry for their domain.
{
  key: "manage-shop",
  label: "Shop Settings",
  subtitle: "Edit shop · products · theme",
  href: "/nex-native/manage",
  locked: false,
},
```
(`control-drawer-client.tsx:314-328`)

### 2.4 · Destination behaviour — verified from source

Starting from `/nex-native/manage` (`src/app/nex-native/manage/page.tsx:62-72`):

| User state | Behaviour |
|---|---|
| Signed-out | `redirect("/nex-native/sign-in?next=/nex-native/manage")` |
| Signed-in · NO business row | `redirect("/nex-native/manage/shop/setup")` |
| Signed-in · HAS business row | Renders Shop Management Centre |

Setup dispatcher (`src/app/nex-native/manage/shop/setup/page.tsx:44-80`):

| Partial state | Redirects to |
|---|---|
| Signed-out | `/nex-native/sign-in?next=/nex-native/manage/shop/setup` |
| No business row / no display_name / no city / no category | `/manage/shop/setup/business-details` ← **this is the Create Shop entry** |
| No `shop_cover_image_url` | `/manage/shop/setup/appearance` |
| No products | `/manage/shop/setup/first-product` |
| All above complete | `/manage/shop/setup/review` |

The alternative `/manage/shop/start` landing (`src/app/nex-native/manage/shop/start/page.tsx:12-16`) exists as a long-form welcome variant but is not currently wired from the drawer — it's reached from the `?from=signup` return path.

### 2.5 · No existing drawer behaviour is displaced by what is already in place

The Shop Settings row is a single existing row serving both audiences via server-side routing. No other row depends on the "has business" state. Chat Settings (`:353`), Payment Providers (`:363`), My Orders (`:371`), Wholesale (`:386`), FAQ (`:337`) are all visible to every signed-in user; each page gates ownership server-side.

---

## 3 · What GAP-NAV-001 actually represents

Re-reading the mapping audit claim against this evidence:

- The row exists.
- The route exists.
- Both user-state branches are wired.
- Setup wizard runs end-to-end (business-details → appearance → first-product → review).

What a new seller sees when they tap "Shop Settings · Edit shop · products · theme":

- They go to `/manage` → redirected to `/manage/shop/setup` → redirected to `/manage/shop/setup/business-details` — all seamless, no broken state.
- They land on a page that lets them create their shop.

**The gap is discoverability-by-label, not wiring.** A first-time seller does not know that "Shop Settings" is where they create their shop. A returning seller does.

---

## 4 · Options for the owner

Each option preserves the sealed 2026-11-04/05 "no YOUR BUSINESS section" doctrine and the sealed 2026-11-12 single-row pattern. Each is a bounded sandbox UI change.

### Option A · **No change** (close GAP-NAV-001 as mis-identified)

- Drawer stays exactly as sealed 2026-11-12.
- Mapping Audit GAP-NAV-001 reclassified as **closed-by-existing-wiring** rather than an open gap.
- Discoverability relies on the user realising Shop Settings is also the create-shop entry.
- Zero UI risk.

### Option B · **Conditional subtitle** (smallest change that fixes the discoverability gap)

- Keep the single row, keep `key: "manage-shop"`, keep `href: "/nex-native/manage"`.
- Render the subtitle conditionally based on whether the signed-in viewer has a business row:
  - No business → subtitle `Create your shop in 4 steps`
  - Has business → subtitle `Edit shop · products · theme` (current)
- The label `Shop Settings` stays unchanged to preserve the 2026-11-13 pairing with Chat Settings.
- Requires drawer client to receive a `hasBusiness` prop (resolved server-side at the same point the drawer entitlements are computed).

### Option C · **Conditional label + subtitle** (stronger discoverability)

- Same mechanism as Option B but flip both label and subtitle:
  - No business → label `Create Your Shop` · subtitle `4 steps · around 5 minutes`
  - Has business → label `Shop Settings` · subtitle `Edit shop · products · theme`
- Breaks the sealed label-pairing with Chat Settings only for the no-business state. Owner must approve or reject this trade-off.

### Option D · **Add a separate `Create Shop` row** (reversal of sealed 2026-11-04/05)

- Add a second drawer row conditional on no-business that routes directly to `/manage/shop/start`.
- The existing Shop Settings row stays for users who already have a business (visibility flipped to hasBusiness-only).
- **This is the option the master plan originally proposed. It is NOT the smallest change and it partially reverses the sealed 2026-11-04/05 YOUR BUSINESS section removal.** The owner should accept or reject it explicitly before any work on this path begins.

---

## 5 · Dependencies for whichever option is chosen

- **Server-side resolution of `hasBusiness`:** `listBusinessesByOwner(session.account.id)` already runs on multiple surfaces; the drawer can either call it server-side in the host layout and pass a prop, or expose a lightweight helper. No new DB column, no migration.
- **Regression test update** `control-drawer-client.test.tsx` must assert both branches (no-business and has-business render the correct label/subtitle). Same PR.
- **No bucket touch · no migration · no payment · no privacy surface.**

---

## 6 · Recommendation

**Option B** is the smallest change that fixes the actual user-visible gap without reversing any sealed decision. It needs one prop passed through the drawer host and a conditional subtitle. It respects the 2026-11-04/05 removal of the YOUR BUSINESS section and the 2026-11-12 single-row pattern. The regression test grows from one assertion to two.

Option A is also defensible if the owner judges the label-discoverability concern over-stated.

Option D (adding a second row) should only be chosen if the owner now considers the 2026-11-04 removal to have been wrong — which is a Founder decision, not an engineering one.

---

## 7 · What this report does NOT do

- No source file has been edited.
- No test file has been edited.
- No drawer behaviour has been changed.
- No new row has been added.
- No subtitle has been flipped.
- No DB has been touched.
- `listBusinessesByOwner` has not been wired into the drawer host.
- No commit / push / deploy has occurred.
- GAP-NAV-001 has not been silently reclassified — that reclassification requires owner acceptance of this report.

Awaiting owner selection of Option A / B / C / D before any T-2.1 UI change proceeds.
