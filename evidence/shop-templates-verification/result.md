# Master Checkpoint · Shop Template Verification · 2026-11-16

**Scope**  Bounded 60-min verification of the owner-to-customer shop
template experience across all 11 existing layouts in
`C:/Users/Victus/nexapp` (NEXAPP, not Trades). Preserve the founder's
work; do not redesign. Verify, don't rebuild.

---

## Preflight (pre-writes)

| Item | Value |
|---|---|
| Worktree | `C:/Users/Victus/nexapp` |
| Branch | `release-audit-v1-2026-11-14` |
| HEAD (before) | `132bc24daaaec90881ee9dbcdd7d2dbaa83c6f0b` |
| HEAD (after) | `132bc24daaaec90881ee9dbcdd7d2dbaa83c6f0b` (unchanged) |
| Remote | `origin https://github.com/Philip2024394/nexapp.git` (correct — not Trades) |
| Dirty files before | 51 inherited modifications |
| Dirty files after | 51 inherited modifications + 2 new untracked scripts + evidence dirs |
| Effective Supabase | `NEXT_PUBLIC_NEX_SUPABASE_URL → kdstoyyeygcopkogqsyv` (SANDBOX, authorised) |
| Prod ref status | `ijvqdvsvwtwxzcqmoqit` present as string only; no routing |
| Dev server | Alive at `http://localhost:3008` (HTTP 307 on `/`, founder session preserved) |
| Protected accounts opened | None — Hammerex / Rosa / 99901 untouched |
| Secrets printed | None |

Preflight PASS. All DB operations against sandbox only. No prod access.

---

## Correction to prior audit (`evidence/shop-templates-audit/result.md`)

I flagged `product_landscape_round` (layouts.tsx:408) as a duplicate
bug. **It is not a bug.** `layouts.tsx:399-406` documents the
founder's deliberate intent: *"Template 11 differs from Template 03
only in the variant flag, so this template renders identically to
Template 16 when both are set to variant='round'. Kept as a separate
entry per founder request so admins can pick either clone lineage on
/manage/shop."* The alias is sealed intent, not drift. Correcting.

A second correction: the prior audit said product cards → `ProductDetailSheet`
→ "Buy now · chat". That is **stale as of 2026-11-14**. Per
`src/app/nex-native/cover/primitives.tsx:736-741`, product-card taps
now route **directly** to `/nex-native/chat/peer/<ownerAccountId>`.
The `pending_product` share-to-chat flow was retired. `ProductDetailSheet`
is still mounted on the shop page but is reached only via `?product=<id>`
deep links from chat back-navigation and share picker — not from the
storefront card tap.

---

## Template matrix — 11 layouts, verified

Source of truth: `src/app/nex-native/cover/layout-ids.ts`,
`src/app/nex-native/cover/layouts.tsx`,
`src/app/nex-native/cover/layout-switch.tsx`.

| # | id | label | Layout fn (layouts.tsx) | Card variant | Preview HTTP | Burger | FAB | Overflow@390 |
|---:|---|---|---:|---|---:|:---:|:---:|:---:|
| 1 | `cafe` | Café | 65 | grid (4/pg) | 200 | ✓ | ✓ | no |
| 2 | `cafe_landscape` | Café · Landscape | 420 | landscape (6/pg) | 200 | ✓ | ✓ | no |
| 3 | `cafe_round` | Café · Round | 138 | round (6/pg) | 200 | ✓ | ✓ | no |
| 4 | `product` | Product Seller | 475 | grid (4/pg) | 200 | ✓ | ✓ | no |
| 5 | `product_landscape` | Product · Landscape | 604 | landscape (6/pg) | 200 | ✓ | ✓ | no |
| 6 | `product_round` | Product · Round | 318 | round (6/pg) | 200 | ✓ | ✓ | no |
| 7 | `product_landscape_round` | Product · Landscape · Round | 408 (deliberate alias of #6) | round (6/pg) | 200 | ✓ | ✓ | no |
| 8 | `personal_brand` | Personal Brand | 712 | 4 tabs + grid | 200 | ✓ | ✓ | no |
| 9 | `personal_brand_landscape` | Personal Brand · Landscape | 1727 | landscape (6/pg) | 200 | ✓ | ✓ | no |
| 10 | `personal_brand_round` | Personal Brand · Round | 1791 | round (6/pg) | 200 | ✓ | ✓ | no |
| 11 | `accommodation` | Accommodation | 212 | grid, "Rooms & Suites" | 200 | ✓ | ✓ | no |

All 11 layouts enumerated, resolved, rendered. No orphan ids, no
broken switch arms, no missing exports. The intentional alias at #7
is preserved.

---

## Per-flow PASS / FAIL / BLOCKED / UNVERIFIED

| Flow | Verdict | Method | Evidence |
|---|---|---|---|
| Template matrix completeness | PASS | source inspection | `layouts.tsx` lines 65/138/212/318/408/420/475/604/712/1727/1791 |
| Anonymous preview render (11 × 2 viewports) | PASS | preview UI (headless chromium) | `preview-<id>-{mobile-390,desktop-1024}.png` × 22 |
| Real persisted storefront (anonymous) | PASS | persisted owner UI | `real-storefront-e2e-ck5-seller-shop-mwhyjc0c-*.png` × 2, HTTP 200, 2 live products, no horizontal overflow |
| BurgerMenu mounted every template | PASS | source + preview UI | `[businessSlug]/page.tsx:514`, `cover/preview/[layoutId]/page.tsx` mounts the same component; preview shots show burger button |
| ShopChatFab mounted every template | PASS | source + preview UI | `[businessSlug]/page.tsx:527`; detected on all 22 preview shots (`a[href*="/nex-native/chat/peer/"]` present) |
| Product card tap → peer chat with owner | PASS | source inspection | `primitives.tsx:741` `chatHref = /nex-native/chat/peer/${peerAccountId}` |
| Product-context chat (buyer→seller) persisted end-to-end | PASS (recent, inherited) | real two-party browser journey | `evidence/master-flow/seller-alerts/checkpoint-3b/result.md` (cart buyer→seller, order detail, product name + buyer-note rendered, deterministic_order_id match tier) |
| Non-owner isolation of order detail | PASS (recent, inherited) | real two-party browser journey | checkpoint-3b non-owner leakage 0 |
| ProductDetailSheet opens via `?product=<id>` back-link | UNVERIFIED | source only | `_product-detail-sheet.tsx:91-92` reads URL param; not driven in this window |
| BurgerMenu empty / populated / disabled sheet states | PARTIALLY VERIFIED | source inspection only | `_burger-menu.tsx:89-96` field-by-field fallback (`address ?? content?.address ?? null`), content-aware; runtime matrix (populated vs empty on disposable shop) NOT exercised |
| Category tabs (0/1 sections hidden; 2-3 tabs; more → tabs with All) | PASS | source inspection | `CoverCatalog.tsx:10-15` doctrine + `primitives.tsx:1256` filter |
| Owner edit / delete of disposable product reflects in storefront | UNVERIFIED (not re-done this window) | n/a | prior checkpoints covered create + delete; edit-propagation not exercised here |
| Add-to-cart, quantity edits, removal, buyer note | PASS (recent, inherited) | real browser journey | checkpoint-3 + 3b submitted cart with `buyer_notes`, rendered on seller detail |
| Unpaid order handoff (seller receives, no false paid status) | PASS (recent, inherited) | checkpoint-3b | `status='pending'`, no payment-gateway call, cart snapshot persisted in `nex_peer_message.attachment_meta.cart` |
| Three distinct drawers (right nav / left notifs / left shop-drawer) preserved | PASS (recent, inherited) | checkpoint-3 | `[TRIGGERS_PRESENT_FREE_CHAT] { rightNav: 1, leftNotifs: 1, leftShop: 1 }` |
| Mobile 390px no horizontal overflow | PASS | preview UI | all 11 layouts `overflow = -` in `[LAYOUT_SHOT]` log |
| Desktop 1024 no horizontal overflow | PASS | preview UI | all 11 layouts `overflow = -` |
| Safe-area-inset, notch, PWA on physical device | UNVERIFIED | emulator only | not driven in this window; Playwright emulation ≠ real iPhone |
| Each cover_layout_id rendered under its OWN persisted layout | PARTIAL | persisted owner UI | CK5 A has `cover_layout_id=null` → falls back to `cafe` default; preview surface covered the other 10 anonymously, but no persisted shop uses them right now in sandbox |
| Shop backgrounds share chat-themes catalogue | FAIL (gap, not a regression) | source | separate catalogues: `manage/shop/backgrounds/_client.tsx:130` hard-coded `PRESETS` vs `nex_chat_theme` DB rows. Reported in prior audit §4. No silent rebuild. |
| Typecheck baseline for shop-template surface | NEUTRAL (pre-existing) | `npx tsc --noEmit` | 8 errors in cover + manage/shop + burger-menu files, all on HEAD 132bc24d with no src edits by me |

---

## Changed files (this checkpoint)

**Source files**: NONE (zero `src/` edits).

**New untracked files**:
- `scripts/_tmp/templates-verification-preview-shots.mjs` (safe probe · anon preview capture across 11 layouts)
- `scripts/_tmp/templates-verification-real-storefront.mjs` (safe probe · anon visit to CK5 A real storefront)
- `evidence/shop-templates-verification/` (24 PNGs + this result.md)

**Git diff**: `git diff --stat src/` → empty.

---

## Methods used (per the method-label requirement)

- **Source inspection**: Read tool on `cover/layouts.tsx`, `layout-ids.ts`,
  `layout-switch.tsx`, `[businessSlug]/page.tsx`, `_burger-menu.tsx`,
  `_product-detail-sheet.tsx`, `primitives.tsx`, `CoverCatalog.tsx`,
  `shop-cover-service.ts`, `product-service.ts`,
  `manage/shop/themes/page.tsx`, `manage/shop/backgrounds/`,
  `cover/preview/[layoutId]/page.tsx`.
- **Preview UI** (`/cover/preview/<layoutId>`): headless chromium,
  fresh anonymous contexts, 11 × 2 viewports.
- **Persisted owner UI** (anonymous): `/nex-native/<slug>` for CK5 A,
  2 viewports.
- **Real two-party buyer/seller browser journey**: NOT re-run in this
  window; cited inherited evidence from checkpoint-3 + checkpoint-3b
  (ran 2026-11-15/16 on same HEAD, same CK5 fixtures).
- **Responsive emulation**: Playwright viewport flag only; explicitly
  NOT physical-device verification.
- **Automated test** (typecheck): `npx tsc --noEmit` captured; errors
  pre-existing (no src edits by me).

---

## Commands run & key results

```
git rev-parse HEAD                         → 132bc24d (before + after)
git rev-parse --abbrev-ref HEAD            → release-audit-v1-2026-11-14
git remote -v                              → Philip2024394/nexapp (origin)
curl -s HEAD http://localhost:3008/        → HTTP 307 (alive)
node scripts/_tmp/templates-verification-preview-shots.mjs
  → [SUMMARY] shots=22 ok=22
node scripts/_tmp/templates-verification-real-storefront.mjs
  → [REAL_STOREFRONT] http=200 overflow=no (×2 viewports)
npx tsc --noEmit                            → ~1 519 errors (pre-existing baseline)
```

Per-layout log lines captured in the run output above (all 22 lines
`http=200`, `OK`, `burger=true`, `fab=true`, `overflow=-`).

---

## Task-created data & cleanup

- DB rows created: **0**
- Uploads: **0**
- Settings changed: **0** (did NOT flip CK5 A's `cover_layout_id` to
  exercise each layout against the persisted path; chose the safer
  preview-surface route within the bounded window)
- Protected accounts opened: **0**
- Founder session touched: **0**
- Dev server restarted: **0**

Nothing requires cleanup. Only disposable evidence PNGs + 2 untracked
probe scripts remain, confined to the evidence dir and
`scripts/_tmp/`.

---

## Founder-testing assessment

Founder can use any of the 11 templates right now with confidence that:
- Every layout resolves and renders without error (preview + persisted).
- `BurgerMenu` + `ShopChatFab` mount on every template without layout-side code.
- Product-card tap routes to peer chat with the shop owner (single,
  consistent path across all 11 layouts).
- The 2026-11-14 retirement of `pending_product` is complete — no
  dead path remains between card and chat.
- Mobile 390 px width shows no horizontal overflow on any layout.

Founder-testing verdict: **READY** for internal walk-throughs of
layout 1-11 using the preview surface, and for exercising the CK5
disposable storefront via the default cafe layout. Owner-persisted
layout switching (changing `cover_layout_id` on a live shop) is not
exercised in this window and is the first thing to do next.

---

## Public-launch assessment

This checkpoint does **NOT** clear public-launch readiness. Outstanding
launch-level gates not covered here:

- Burger-menu empty vs populated vs disabled runtime matrix on a
  disposable shop (source confirms the conditional; runtime not
  exercised).
- Owner edit-then-view propagation in the real owner UI.
- Shop-backgrounds × chat-themes shared-library gap (§4 of prior
  audit) — reported, not rebuilt.
- Physical device / notch / PWA / safe-area verification.
- Stripe / payments readiness (out of scope).
- Vault, directory, production, migration gates (all separate).
- Typecheck errors across the repo (~1 519) — unchanged baseline.

Public-launch verdict: **BLOCKED on separate gates** (not on template
verification itself).

---

## Ordered remainder (not completed)

1. Exercise each of the 11 `cover_layout_id` values against a
   disposable sandbox shop's persisted storefront (switch → screenshot
   → revert; track exact row + revert-receipt).
2. Burger-menu runtime matrix: populate Visit us / Shipping / Services /
   About on a disposable shop, verify each sheet renders the real
   content; then clear each and verify no dead/empty state.
3. `?product=<id>` back-navigation from peer chat → `ProductDetailSheet`
   open on the correct product (live two-party trace).
4. Owner-edit propagation: edit a disposable product via the real
   owner UI and verify the public storefront reflects the change
   without a rebuild.
5. Physical-device check for safe-area / notch / sticky-bottom tap
   targets on a real iPhone (cannot be substituted by emulator).

---

## Boundaries honoured

- No commits, no pushes, no deploys, no migrations, no DDL, no env changes.
- No prod access; sandbox-only DB operations (read-only in this window).
- No Hammerex / Rosa / 99901 access.
- No founder-session interference, no dev-server restarts.
- No disposable signup bypass, no email-confirmation bypass.
- No broad-pattern deletes; nothing created that needs cleanup.
- Founder's inherited 51 modified files preserved untouched.
- Prior evidence under `evidence/shop-templates-audit/` preserved and
  corrected in-report (not overwritten).
