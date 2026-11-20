# CP5 — Seller alert, LEFT drawer, exact-order routing

Date: 2026-11-15
Spec: `tests/e2e-p6-isolation/order-visibility.spec.ts`
Config: `playwright.p6-isolation.config.ts` (project `order-visibility-390`, viewport 390×844, deviceScaleFactor 2, timeout 360s)
Server target: `http://localhost:3008` (via `PLAYWRIGHT_TEST_BASE_URL`)
Two-context actors: Context A = CK5 B buyer, Context B = CK5 A seller
DB: sandbox `kdstoyyeygcopkogqsyv` (hard-refuses prod ref at spec lines 70-75)

## Scope note

CP5's master-flow charter names three concerns: (a) seller alert, (b) LEFT drawer, (c) exact-order routing. `order-visibility.spec.ts` is the strongest coverage this suite has for (c) and (b)'s "dashboard reaches the exact order detail". It does NOT drive the real-time seller alert UI (socket/push surfacing). That alert surface is **not in the e2e-p6-isolation harness**; it needs either a separate Playwright harness or founder-operator mobile observation. Flagged as REMAINING.

## Result — PASS (desktop, Playwright)

| # | Test | Status | Duration |
|---|---|---|---|
| 1 | buyer signs in · lands outside sign-in | ✅ passed | 8.2s |
| 2 | buyer visits seller's public shop by slug | ✅ passed | 4.4s |
| 3 | buyer writes BOTH cart items via sealed localStorage contract | ✅ passed | 13ms |
| 4 | buyer checks out IMAGED cart · redirect to `/chat/peer/<seller>?cart_sent=1` | ✅ passed | 12.7s |
| 5 | buyer writes + checks out IMAGELESS cart | ✅ passed | 12.4s |
| 6 | DB confirms D2 write shape · `attachment_type NULL` + `meta.cart` populated for BOTH carts | ✅ passed | 1.2s |
| 7 | fixture-insert two `nex_order` rows · DISCLOSED · `source_conversation_id SET NULL` | ✅ passed | 1.3s |
| 8 | seller signs in · `/manage/orders` page shows BOTH orders (not just one) | ✅ passed | 6.0s |
| 9 | open IMAGED order detail · Items card shows product name + price | ✅ passed | 4.3s |
| 10 | open IMAGELESS order detail · Items card shows product name + price | ✅ passed | 2.4s |
| 10b | reload IMAGED order detail · Items card content persists | ✅ passed | 5.0s |
| 11 | reload `/manage/orders` LIST · shell persists | ✅ passed | 3.4s |
| GAP1 | repeat same-product orders retain their own snapshots | ✅ passed | 28.9s |
| GAP14 | ambiguous identical-cart orders render explicit unavailable state (never another order's items) | ✅ passed | 19.0s |
| GAP14-DETER | deterministic link proves identical-cart orders retain their own snapshots | ✅ passed | 38.5s |
| 12 | cross-account denial · buyer context cannot see seller's `/manage/orders/<id>` | ✅ passed | 1.9s |

Total: **16 passed (2.7m)**. Zero retries consumed.

## Behaviour verified

**Exact-order routing (core CP5 contract)**:
- `/manage/orders` lists BOTH buyer's orders (not collapsed) — Test 8.
- `/manage/orders/<id>` opens the exact matching order: imaged → own items, imageless → own items — Tests 9 + 10.
- Reload persistence on detail page AND list page — Tests 10b + 11.
- Repeat same-product orders retain their OWN snapshot (not merged) — GAP1.
- **Identical carts (same product, qty, price, address) are disambiguated by deterministic `order_id`** — GAP14-DETER. Rather than collapsing into one or showing neighbour's items, each resolves to Tier 0 match on `data-nex-order-cart-match-tier="deterministic_order_id"`.
- **Ambiguous legacy state** (orders whose link can't be resolved) renders explicit "unavailable" state, never another order's items — GAP14. This is the honest failure mode.

**Cross-account denial**:
- Buyer context visiting `/manage/orders/<seller_order_id>` denied — Test 12.

**Visibility across image state**:
- Imaged + imageless products both route correctly (no regressions tied to missing `image_url`).

## Fixture-assist disclosures

- CK5 accounts + business seeded by `scripts/_tmp/seed-disposable-vault-accounts.mjs` + `seed-disposable-business.mjs` (reused from earlier CPs).
- Spec seeds TWO additional live `nex_product` rows (one imaged, one imageless) per the spec header lines 16-19.
- Test 7 explicitly fixture-inserts two `nex_order` rows with `source_conversation_id SET NULL` — **disclosed** because the sealed Path A chat/order separation (memory 2026-11-09) does NOT auto-insert `nex_order` from the historical cart flow. GAP14-DETER (Test 15) then proves the current production path DOES create nex_order deterministically in the real UI flow.
- Cleanup scoped by `(business_id, prefix)` and `(sender_account_id, business_id, prefix)` — refuses anything outside those filters.

## Not covered by this spec (REMAINING for CP5)

- **Real-time seller alert** (push notification / toast / unseen-counter badge) when a new cart arrives: not in `order-visibility.spec.ts`. Would need either (a) a separate harness driving two live-connected contexts and asserting the alert surface updates without reload, OR (b) founder-operator mobile observation of the alert on a phone paired to the sandbox.
- **LEFT drawer UX** (seller nav drawer showing order counts / jumping to detail): not directly asserted. The spec checks `/manage/orders` + detail, not the hamburger/drawer open/close affordance.
- **Mobile viewport interaction** of the alert + drawer: BLOCKED — phone operator needed.

## Method / independence disclosure (§1, §4)

- **Method**: real-UI two-context Playwright. Buyer: sealed localStorage cart write + real checkout UI + real `sendCartOrderAction`. Seller: real sign-in + real `/manage/orders` page + real detail page.
- **QA independence**: self-check only — spec pre-authored.
- **Physical phone**: BLOCKED — N/A for the DOM-level order visibility contract tested here. Alert/drawer UX needs phone operator.
- **Sandbox proof**: prod-ref refusal fired-and-passed (spec ran to completion against sandbox).

## Evidence artifacts

- `evidence/master-flow/CP5/playwright-output.txt`
- Start HEAD: `132bc24daaaec90881ee9dbcdd7d2dbaa83c6f0b`
- End HEAD: unchanged
- No commits, no pushes, no DB migrations, no prod touch

## Protected baseline check

Hammerex/Rosa not touched. Seeds and spec hard-refuse their UUIDs. Only CK5 disposables exercised.

## Remaining CP5 items

- **Real-time seller alert surface**: no coverage in this harness. Needs separate work or founder-operator phone observation.
- **LEFT drawer order-count badge**: not asserted. Needs separate spec or visual inspection.
- **Mobile phone verification**: BLOCKED pending founder operator.
- **CP5 CORE CONTRACT (exact-order routing from list → detail, no cross-order leakage, cross-account denial)** = **PROVEN by order-visibility 16/16 incl. GAP14 ambiguity + GAP14-DETER deterministic path**.
- Builder: none (no in-scope defects discovered).
