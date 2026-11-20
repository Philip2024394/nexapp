# CP4 — Centered cart modal & unpaid handoff

Date: 2026-11-15
Server target: `http://localhost:3008` (via `PLAYWRIGHT_TEST_BASE_URL`)
DB: sandbox `kdstoyyeygcopkogqsyv` (both specs hard-refuse prod ref)

## Specs run

1. `tests/e2e-p6-isolation/customer-to-seller-order.spec.ts` (Hammerex buyer · Rosa seller)
2. `tests/e2e-p6-isolation/cart-order-deterministic.spec.ts` (CK5 B buyer · CK5 A seller)

## Role note — conflict surfaced

The owner said (2026-11-15) "99901 id is seller · 99903 rosa is buyer". The sealed `customer-to-seller-order` spec encodes the OPPOSITE: Customer = Hammerex (99901), Seller = Rosa (99903), hard-coded in both config comment (playwright.p6-isolation.config.ts:113-114) and spec constants. CP4 was run as-sealed (not re-wired) because:

- CP4 scope is **cart flow mechanics** not role semantics.
- Rewriting the spec to swap actors would modify sealed test authority and conflict with the "no commits, no pushes" envelope.
- The `cart-order-deterministic` spec uses CK5 disposables, so the deterministic order-match contract is proven **without** any Hammerex/Rosa ambiguity.

**Flagged as REMAINING for owner reconciliation** — either the role assignment in spec needs to flip, or the "99901=seller" direction was contextual to a different checkpoint.

## Overall result — PARTIAL (one real finding, one green companion)

### `customer-to-seller-order.spec.ts` — 4 passed · 1 failed · 6 did not run (1.1m, retries consumed on the failing test's cascade)

| # | Test | Status | Duration |
|---|---|---|---|
| 1 | customer signs in · lands on /contacts | ✅ passed | 7.3s |
| 2 | customer visits Rosa's shop by slug | ✅ passed | 3.1s |
| 3 | customer adds seeded product via sealed localStorage · cart badge sees item | ✅ passed | 140ms |
| 4 | customer checks out via real UI · `sendCartOrderAction` submits · redirects to `/chat/peer/<rosa>?cart_sent=1` | ✅ passed | 14.9s |
| 5 | DB verifies cart handoff · `nex_peer_message cart_order` row from Hammerex · nex_order delta reported | ✅ passed | 3.2s |
| 6 | seller signs in 2nd context · `/manage/orders` page loads AND shows product-name text | ❌ **failed** | 17.9s |
| 7-11 | downstream reload / payment-wording / cross-account denial / residuals | ⏭ did not run (cascade) | — |

**Defect A (in-scope, honest finding)**: On this Hammerex→Rosa handoff, the seller's `/manage/orders` page does NOT contain the text `E2E Order Widget <stamp>` within 10s after cart send. Yet the DB verification in Test 5 confirmed the cart message row was written and the production code DID create a `nex_order` row (sandbox cleanup later found the `nex_order` + `nex_order_event` rows and FK-deleted them).

Candidate causes (not debugged — out of scope for CP4 Builder):
- Rosa's seller `/manage/orders` renders order list WITHOUT the linked product NAME text — only an order-id link / summary. The CK5 companion spec (below) passes because its assertion is on **order-id links**, not product-name text. This is the most likely cause: a spec-strictness mismatch against current UI copy, not a product gap.
- Alternative: Rosa's dashboard has a stale `since` / status filter hiding fresh orders.

**Recommendation**: either the Hammerex/Rosa spec's Test 6 assertion should match the deterministic spec's "order-id link visible" style, OR the seller orders list UI should render the product name. Owner call. Marking Defect A as **pending owner triage** rather than Builder-fix inside this pass.

**Test-infra follow-on (side-effect of Defect A, not a product bug)**: the spec's afterAll tried to delete `nex_product` before `nex_order` (FK violation), and then couldn't delete `nex_order` because `nex_order_event` references it (FK violation). This left one `E2E Order Widget` product + 1 nex_order + 1 nex_order_event row behind. Manually cleaned post-run (see "Sandbox cleanup" below).

### `cart-order-deterministic.spec.ts` — 8 passed (1.0m, zero retries)

| # | Test | Status | Duration |
|---|---|---|---|
| 1 | buyer signs in | ✅ passed | 8.2s |
| 2 | buyer visits seller shop | ✅ passed | 3.1s |
| 3 | FIRST identical cart → real sendCartOrderAction submits · redirect | ✅ passed | 11.7s |
| 4 | SECOND identical cart (same product/qty/price/address, different note) | ✅ passed | 12.9s |
| 5 | production code path produced TWO `nex_order` rows · ids match embedded cart UUIDs · no fixtures inserted | ✅ passed | 1.4s |
| 6 | seller `/manage/orders` lists BOTH orders (links to each order id) | ✅ passed | 9.6s |
| 7 | order A detail · Tier 0 deterministic match · own note · not B's | ✅ passed | 3.5s |
| 8 | order B detail · Tier 0 deterministic match · own note · not A's | ✅ passed | 2.6s |

This spec proves the **centered cart modal → unpaid handoff → deterministic order routing** contract end-to-end:
- Two identical carts → two distinct `nex_order` rows (no double-match).
- Each order's detail page resolves 1:1 via `data-nex-order-cart-match-tier="deterministic_order_id"`.
- Each renders its own note (different distinguishing payload); no cross-leakage.
- No DB INSERT of nex_order by the test — the production `sendCartOrderAction → createOrder({ id, product_id })` path is what created them.

This is the strongest proof we have for CP4's core "unpaid handoff" claim.

## Method / independence disclosure (§1, §4)

- **Method (spec 1)**: real UI two-context Playwright. `sendCartOrderAction` driven via the sealed cart-page form. Admin service-role seed of ONE `E2E Order Widget <stamp>` product, cleaned (partly) in afterAll.
- **Method (spec 2)**: real UI two-context Playwright. NO admin inserts of orders — CK5 seller's seeded products X/Y reused from CP3, buyer carts them via real UI.
- **QA independence**: self-check only. Both specs pre-authored by prior Claude work.
- **Physical phone**: BLOCKED — N/A at cart-submit contract level. Mobile cart-page interaction still needs founder-operator test at `http://192.168.1.3:3008` for: tap-add-to-cart, cart modal centering on viewport ≤ 400px, iOS Safari localStorage persistence.
- **Sandbox proof**: both specs' prod-ref refusal guards fired-and-passed (specs ran to completion only against sandbox).

## Sandbox cleanup (manual, after spec-level cleanup FK failure)

Ran one-shot script against sandbox pooler to delete:
- 1 × `nex_product` id `71c0088c-f0a5-4e23-ab80-ee80365ba956` (`E2E Order Widget 1794806381932`)
- 1 × `nex_order` id `3dd260d1-9293-4d7a-aa5b-13715efccebb`
- 1 × `nex_order_event` row (child of the order above)
- 0 × leaked `cart_order` peer messages (none found)

Sandbox state matches pre-run baseline post-cleanup. No leftovers to pollute CP5+.

## Evidence artifacts

- `evidence/master-flow/CP4/playwright-output-customer-to-seller-order.txt` (includes full failure trace + screenshots list)
- `evidence/master-flow/CP4/playwright-output-cart-order-deterministic.txt`
- Playwright screenshots/trace on failed test 6: `test-results/customer-to-seller-order-C-6b07b--·-manage-orders-page-loads-customer-to-seller-order-390/` (test-failed-1.png, test-failed-2.png, trace.zip)
- Start HEAD: `132bc24daaaec90881ee9dbcdd7d2dbaa83c6f0b`
- End HEAD: unchanged
- No commits, no pushes, no DB migrations, no prod touch

## Protected baseline check

Hammerex sign-in only · Rosa sign-in only · neither Vault state mutated. Pre/post counts `nex_vault_setup` for both IDs preserved (the spec's own evidence log asserts MUST BE EQUAL and ran to completion of that assertion section).

## Remaining CP4 items

- **Owner decision needed**: role assignment (99901=seller OR 99901=customer).
- **Defect A triage**: Hammerex→Rosa spec's Test 6 assertion on product-name text vs. CK5 spec's Test 6 assertion on order-id links. Reconcile.
- **Real-phone**: cart modal centering, add-to-cart tap, cart-page submit on mobile Safari/Chrome → BLOCKED pending founder operator.
- CP4 CORE CONTRACT (unpaid handoff → deterministic seller order routing) = **PROVEN by cart-order-deterministic 8/8**.
- Builder: none in this pass (defect pending triage, not clear it's a product bug).
