# Product Page Checkpoint · 2026-11-16

Owner-authorised 2026-11-16 · bounded 60-minute checkpoint to
**replace the product-detail slider with a full product page**.
No commits, no pushes, no deploys, no migrations, no env changes.
The founder's running dev server at `localhost:3008` and signed-in
session were preserved end-to-end.

## Preflight

| Item | Value |
|---|---|
| Repo root | `C:/Users/Victus/nexapp` |
| Branch | `release-audit-v1-2026-11-14` |
| HEAD | `4f9f4ac0f46e04ff4f913d9a95af9823e122f50b` (unchanged) |
| Sandbox target | `kdstoyyeygcopkogqsyv` · confirmed · prod gated off |
| Hard-refusal in probe | `DATABASE_URL` must contain `kdstoyyeygcopkogqsyv`; must NOT contain `ijvqdvsvwtwxzcqmoqit` |
| Protected UUIDs | Hammerex `...111`, Rosa `...113`, 99901 `...199` — refused if resolved |
| Dev server | `:3008` returning `307` on `/` before + after probe (founder session untouched) |

## Slider inventory (before changes)

The product-detail slider was mounted in exactly these places.
Only the first two are changed; the drawers stay untouched per
owner directive.

| # | Component / path | Role | Action in this checkpoint |
|---|---|---|---|
| 1 | `src/app/nex-native/cover/_product-detail-sheet.tsx` | Slide-up sheet triggered by `?product=<id>` on shop surface | **Redirected** to `/nex-native/product/<id>` (sheet never paints) |
| 2 | `src/app/nex-native/cover/primitives.tsx` · `CoverProductCard` (grid + landscape + round variants) | Shop card tap handler · was `/nex-native/chat/peer/<ownerAccount>` | **Rewired** to `/nex-native/product/<id>` |
| 3 | `src/app/nex-native/[businessSlug]/page.tsx:556` | Shop surface mount of the cover sheet | Left intact · sheet now self-redirects |
| 4 | `src/components/nex-native/nex-feed/_seller-shop-drawer.tsx` (own embedded `ProductDetailSheet` at line 767) | Nex-feed seller drawer | **Untouched** (task: drawers stay separate) |
| 5 | `src/app/nex-native/chat/_shop-grid-modal.tsx` + `src/app/nex-native/chat/_product-detail-sheet.tsx` | Chat product-context shop drawer sheet | **Untouched** (task: drawers stay separate) |

## Files changed

| File | One-line reason |
|---|---|
| `src/app/nex-native/product/[productId]/_product-page-client.tsx` (NEW) | Full product page client · gallery (main + up to 4 real thumbs), title + price, Read more/less with real category specs, orange Ask Seller form, Add to Cart, floating round back FAB bottom-right. |
| `src/app/nex-native/product/[productId]/page.tsx` | Server component rewritten to feed the new client component with the existing `nex_product` fields (`image_url`, `gallery_urls`, `spec`, `dispatch_time`, `sample_request_time`). `CartHeaderButton` preserved. |
| `src/app/nex-native/cover/_product-detail-sheet.tsx` | Short-circuited: when the shop URL carries `?product=<id>`, redirect to `/nex-native/product/<id>` instead of rendering the slider. Sheet never paints anymore. |
| `src/app/nex-native/cover/primitives.tsx` | `CoverProductCard` `chatHref` now points at `/nex-native/product/<id>` (defensive fallback to `/chat/peer/<ownerAccount>` only when `product.id` is somehow missing). Grid + landscape + round variants share the same link. |
| `scripts/_tmp/product-page-probe.mjs` (NEW) | Sandbox-only Playwright probe · hard-refuses prod · 10 verification journeys · reuses CK5 A/B fixtures. |
| `evidence/product-page/` (NEW) | Report + 6 screenshots + probe summary JSON. |

Inherited work preserved — not touched this checkpoint:

- `src/app/nex-native/manage/page.tsx` (/manage badge fix · 12/1 lines)
- `src/app/nex-native/free-chat/page.tsx` (drawer work · 17/1 lines)
- All other previously staged evidence modifications.

## Does real rating data exist?

**No.** The `nex_product` row shape at
`src/lib/nex-native/types.ts:802–836` has **no** `rating`,
`review_count`, `star_average` or related columns, and no rating /
review table was found in `nex-supabase/migrations/`. The mock shows
"4.8 (1,245 reviews)" — the new page honestly **omits the star row**
and renders only real data. Building a fake rating or a new rating
system is out of scope for this checkpoint and was not done.

## Verification journeys

Probe: `scripts/_tmp/product-page-probe.mjs`. Signed-in buyer (CK5 B,
not Hammerex / Rosa / 99901). Sandbox Supabase
`kdstoyyeygcopkogqsyv`. Viewport 390×844 (iPhone phone-first).

| # | What was verified | Method | Status | Evidence |
|---|---|---|---|---|
| P1 | Full product page renders · main image, title, price, Ask Seller, Add to Cart, back FAB all present | real UI | **PASS** | `P1-product-page-rendered.png` |
| P2 | Single-image fixture → thumbnail strip is hidden | real UI | **PASS** | `P1-product-page-rendered.png` |
| P3 | Multi-image fixture → thumbnail strip with up to 4 real images | real UI | **BLOCKED** | CK5 Widget X has `gallery_urls = null` · no seeded multi-image product exists · not fabricating one per scope |
| P4 | Read more expands / Read less collapses + category-specific specs appear | real UI | **UNVERIFIED** | CK5 Widget X has 39-char description (no clamp) + empty `spec` jsonb + null dispatch_time · Read-more toggle is correctly suppressed · the code path is exercised by shape at `_product-page-client.tsx:117-121` but no fixture triggers it |
| P5 | Reloading `/nex-native/product/<id>` renders the same product | real UI | **PASS** | probe summary |
| P6 | Back FAB from the shop surface returns to the shop | real UI | **PASS** | `P6-back-fab-returned.png` |
| P7 | Shop URL carrying `?product=<id>` redirects to the full page (slider never paints) | real UI | **PASS** | `P7-shop-query-redirect.png` |
| P8 | Tapping a product card on the shop opens the full product page (not the slider, not the chat) | real UI | **PASS** | `P8-card-tap-opened-product-page.png` |
| P9 | Ask Seller lands at `/conversations/<id>?product=<id>` (existing product-context chat with the product attached) | real UI | **PASS** | `P9-ask-seller-landed.png` |
| P10 | Add to Cart writes to `NEX_CART_STORAGE_KEY` + dispatches `nex-cart-changed` so the header count pill bumps | real UI + storage read | **PASS** | `P10-added-to-cart.png` |

Totals: **8 PASS · 1 BLOCKED · 1 UNVERIFIED · 0 FAIL**.

### Back-from-product-drawer

Explicit task line: "or the chat if they came from the product
drawer". Verified by code inspection only — the two product
drawers (nex-feed `_seller-shop-drawer`, chat `_shop-grid-modal`)
were deliberately left **untouched** in this checkpoint, so their
own embedded `ProductDetailSheet` still handles the drawer flow.
The back FAB on the new page uses `router.back()` with a shop-URL
fallback, which naturally returns to whatever page was visited
immediately before (drawer or shop). Browser-level verification of
the drawer path is **UNVERIFIED** in this run because the CK5
drawer-to-product flow was not triggered.

## Tests & build

| Item | Result |
|---|---|
| `tsc --noEmit` on the three files I changed + the new file | **0 new errors** (verified by `git stash` A/B — the one pre-existing `_product-detail-sheet.tsx:179 added_at` error existed before this checkpoint) |
| Focused vitest | Not run · this checkpoint is UI-only; existing `npm run test` has 14 known broken imports per `CLAUDE.md` and is not required for UI changes |
| Production build | Not run — would restart the founder's dev server. The `/nex-native/product/<id>` route compiled on-demand under the running dev server and served all 10 probe journeys (confirms Next can build it) |

## Non-regression guarantees

- **Ordinary chat without a product still works.** No files under
  `src/app/nex-native/chat/` (peer chat) were edited. The
  `/chat/peer/<accountId>` path remains the destination when a product
  card's `product.id` is missing (defensive fallback).
- **Templates' product cards (tall, landscape, round, square)
  unchanged.** Only the single `chatHref` variable inside
  `CoverProductCard` was redirected. All visual styling, layouts,
  and card variants kept their original JSX and CSS.
- **Shared code not deleted.** The slider component file is still in
  place (and could be revived) — it just redirects now. The embedded
  `ProductDetailSheet`s inside the nex-feed drawer and the chat shop
  modal are entirely separate code paths and were not modified.
- **Navigation / notifications / product drawers stay separate and
  untouched.** No edits under `nex-feed/` or `chat/_shop-grid-modal`.
- **Cart stays centered popup + header count pill.** No edits under
  `cart/` or `cart-header-button/`. New page uses the sealed
  `AddToCartButton` primitive + `CartHeaderButton` component as-is.

## Safety receipt

| Check | Result |
|---|---|
| Commits | **None** · HEAD still `4f9f4ac0` |
| Push | **None** |
| Deploy | **None** |
| Env changes | **None** · `.env.local` not modified |
| Migrations / RLS | **None** |
| Account creation / auth bypass | **None** · used existing CK5 B buyer only |
| Live charges | **None** |
| Hammerex / Rosa / 99901 access | **None** · hard-refused in probe preflight |
| Secrets printed | **None** · `.env.local` only read for `DATABASE_URL` substring match |
| Founder session / dev server | **Preserved** · `:3008` returned `307` before and after probe |

## Git status (receipt)

```
Branch: release-audit-v1-2026-11-14
HEAD:   4f9f4ac0f46e04ff4f913d9a95af9823e122f50b   (unchanged)

Modified under src/:
  M src/app/nex-native/cover/_product-detail-sheet.tsx       (short-circuit redirect)
  M src/app/nex-native/cover/primitives.tsx                   (card href → product page)
  M src/app/nex-native/free-chat/page.tsx                     (inherited · untouched)
  M src/app/nex-native/manage/page.tsx                        (inherited · untouched)
  M src/app/nex-native/product/[productId]/page.tsx           (new layout feeder)

New under src/ (untracked):
  src/app/nex-native/product/[productId]/_product-page-client.tsx

New under scripts/ · evidence/:
  scripts/_tmp/product-page-probe.mjs
  evidence/product-page/
```

No unrelated files touched.

## What's still open at the 60-minute mark

- **P3 (multi-image gallery)** — remains BLOCKED until a product
  with ≥ 2 images is seeded in sandbox. The code renders up to 4
  real thumbnails and swaps the main image on tap (see
  `_product-page-client.tsx:75-96` and the thumb button render at
  `:195-236`), so this is a fixture gap, not a code gap.
- **P4 (Read more + specs with real data)** — remains UNVERIFIED
  until a product has either `>160`-char description OR a non-empty
  `spec` jsonb OR `dispatch_time` set. The spec-flattener at
  `_product-page-client.tsx:462-547` consumes the universal keys
  documented in `types.ts:842-891` plus the freeform `additional`
  map — no hard-coding.
- **Back-from-product-drawer path** — code-inspection only. No CK5
  flow was triggered that opens the nex-feed drawer or the chat
  shop drawer with a product sheet. `router.back()` fallback is
  architecturally correct but was not sampled with that drawer in
  the history stack.
- **Rating / review data** — intentionally not built. Owner would
  need to authorise a rating schema + backend separately.
