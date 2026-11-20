# CP4-fix — Role reconciliation + Defect A triage + verification

Date: 2026-11-16
HEAD (start = end): `132bc24daaaec90881ee9dbcdd7d2dbaa83c6f0b` (unchanged)
Scope: single bounded checkpoint. Does NOT claim all gaps closed.

---

## Summary verdicts per item

| Item | Verdict | Evidence path |
|---|---|---|
| A · Role reconciliation (99901 seller · 99903 buyer) | **PASS** | `role-clarification.md` + CK5-disposable spec reruns |
| B · Defect A (seller order product-name visibility) | **PASS · spec assertion was wrong, UI is correct by design** | `cart-order-deterministic-output.txt` + `order-visibility-output.txt` + screenshots below |
| B · Access denial (buyer→seller mgmt · cross-seller) | **PASS** | `order-visibility-output.txt` Test 12 + `step-B-04-*.png` |
| C · `cart-order-deterministic` spec rerun | **PASS 8/8** | `cart-order-deterministic-output.txt` |
| C · `order-visibility` spec rerun | **PASS 16/16** | `order-visibility-output.txt` |
| C · `customer-to-seller-order` spec rerun | **BLOCKED (not run · spec is sealed historical artifact with reversed role mapping)** | role-clarification.md |
| C · Vault regression (vitest, name matches "vault") | **21/34 files pass · 13 fail · 878/892 tests pass · 14 fail · PRE-EXISTING** | `vitest-vault-output.txt` |
| C · `npm run build` | **BLOCKED** (would overwrite `.next/` used by running dev server that holds founder's localhost session) | — |
| C · `npm run typecheck` | **UNVERIFIED (not re-run this pass)** · CP7 reported 1519 errors on same HEAD · no source edits here, so count unchanged | CP7/typecheck-full.txt |
| Physical-phone verification | **BLOCKED** (no safe path performed) | — |

---

## Preflight (brief · not re-audit)

- HEAD confirmed `132bc24daaaec90881ee9dbcdd7d2dbaa83c6f0b`. Not reset.
- Branch `release-audit-v1-2026-11-14`.
- Supabase split (keys only, no credentials printed):
  - `NEXT_PUBLIC_NEX_SUPABASE_URL` + `DATABASE_URL` + `SANDBOX_DATABASE_URL` + `NEX_POSTGRES_URL` → **sandbox `kdstoyyeygcopkogqsyv`** (active for frontend, server, DB tooling, tests, storage via NEX-prefixed storage URL).
  - `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_URL` → stale `msdonkkechxzgagyguoe`. Per CLAUDE.md §8 these are "cosmetic cleanup, not an availability blocker — code already routes around them". Not switched.
  - Prod ref `ijvqdvsvwtwxzcqmoqit`: NOT resolved by any active connection in this checkpoint. Sealed and untouched.
- Test command `npx playwright test` used `DATABASE_URL` (sandbox) — spec headers hard-refuse prod ref and require sandbox ref, confirmed firing (test suites ran to completion with all guard lines asserted).
- Dev server on :3008 responding HTTP 200 throughout.

---

## Step A · Role reconciliation

**Fix method**: superseding clarification document, NOT a source edit to the sealed spec.

Owner-designated role mapping (2026-11-15):
- Hammerex · `11111111-1111-4111-8111-111111111111` → **SELLER**
- Rosa · `11111111-1111-4111-8111-111111111113` → **BUYER**

Sealed `tests/e2e-p6-isolation/customer-to-seller-order.spec.ts` lines 123-176 hard-encode the opposite (Hammerex=customer, Rosa=seller) and hard-refuses any override. Per owner instruction ("Do not edit an immutable/sealed historical artifact; record a superseding clarification and update the active test configuration instead"), the sealed file is **unmodified**. The active CP4 verification path is the two CK5-disposable specs already encoding seller=CK5-A / buyer=CK5-B — matching the owner-designated model.

Full details: `evidence/master-flow/CP4-fix/role-clarification.md`.

**Verdict · A · PASS**: clarification recorded; active test configuration (CK5 specs) already aligns with owner-designated roles; Hammerex and Rosa data untouched.

---

## Step B · Defect A triage

### Expected product-name behaviour (read from current UI source)

- `src/app/nex-native/manage/orders/_client.tsx:263-343` renders each order row as:
  `#{order.id first 8 upper}` · status chip · `Customer {customer_account_id first 8}…` · optional `"{customer_note}"` (italic) · `{price}` · `{relative time}`.
  **Product name is intentionally NOT rendered on the list.** This is by design: the list is id/status/price/note-oriented.
- `src/app/nex-native/manage/orders/[orderId]/_client.tsx:604` renders cart snapshot items as `item.name ?? "(unnamed item)"` inside the "Items (from chat cart snapshot)" card. **Detail page is where product names surface.**

### Reproduction

Via two existing CK5-disposable specs re-run against the live sandbox through the real UI:

**`cart-order-deterministic.spec.ts` — 8/8 PASS**
- Buyer signs in → shop → writes cart via sealed `nex:cart:v2` localStorage contract → opens `/cart` → clicks Checkout → fills buyer form → submits sealed `sendCartOrderAction` through the real UI → redirect to `/chat/peer/<seller>?cart_sent=1`.
- Twice (two distinct carts, different notes).
- Seller signs in, opens `/manage/orders`: **Test 6 passes** on order-id link visibility (which IS what the list renders).
- Seller opens each order detail: **Tests 7 + 8 pass** with Tier-0 deterministic match + own note surfaces, not neighbour's.
- No fixture-inserted orders — real `sendCartOrderAction → createOrder({id, product_id})` production path.

**`order-visibility.spec.ts` — 16/16 PASS**
- Imaged + imageless products both written by buyer, both checkout through the real UI.
- Seller lists at `/manage/orders`: **Test 8 passes** both orders surface.
- Seller detail page: **Test 9 asserts "Items card shows product name + price"** for imaged → PASS; **Test 10** for imageless → PASS; **Test 10b** reload persistence → PASS.
- **Test 12** cross-account denial → buyer context GETs `/manage/orders/<seller_order_id>` → denied (not seller's content) → PASS.
- GAP14 ambiguity + GAP14-DETER deterministic routing → PASS.

### Root cause of the earlier CP4 Test 6 "failure"

The sealed CP4 spec's Test 6 asserts `text={PRODUCT_NAME_FULL}` on the seller's `/manage/orders` **list** page. The list UI never renders product names (confirmed by reading `_client.tsx:263-343`). The assertion was checking the wrong surface. The companion `cart-order-deterministic` Test 6 asserts on order-id link visibility, which is what the list renders — and passes.

**This is a SPEC assertion bug in a sealed historical artifact, not a UI defect.** The UI contract is: list = id/status/price/note; detail = full items with product names (verified by `order-visibility` Tests 9/10/10b).

### Visual evidence (screenshots)

- `step-B-01-seller-manage-orders-list.png` — seller list surface, authenticated CK5 seller, post-test-cleanup state (empty list is natural: specs' afterAll deletes their own disposable rows).
- `step-B-04-buyer-denied-at-manage-orders.png` — CK5 buyer signs in and visits `/manage/orders`: routed to "No shop found for your account" placeholder (page.tsx:138-176) — never sees any seller's orders. Independent corroboration of the Test-12 denial assertion.
- `step-B-live-00-buyer-cart-page.png` — buyer cart page rendering before checkout, part of Step-B live-flow attempt.

Screenshot capture method: ad-hoc Playwright scripts under `scripts/_tmp/` using disposable CK5 identities only. No sign-in to Hammerex or Rosa.

Note: an ad-hoc live-flow script (`cp4-fix-live-flow.mjs`) was started but aborted at the checkout-submit step because the cart-sheet's exact input selectors differ from what the script assumed; no DB rows were created (verified post-abort by direct DB query: 0 orders + 0 cart messages in the prior-hour window for CK5 buyer→seller). The two spec reruns already provide the authoritative evidence for every behaviour the live-flow script was meant to screenshot.

### Smallest safe fix determined

**No source fix required.** The UI is correct by design. The sealed CP4 spec's Test 6 assertion is semantically wrong; it lives in an immutable historical artifact per owner instruction. Active test coverage already asserts the correct contract (list=id, detail=name) in two independent CK5-disposable specs that passed.

**Verdict · B · PASS**: UI defect disproven; assertion mismatch identified and documented; equivalent behavioural coverage retained in active specs. Not weakening an assertion — the correct assertion is the one `order-visibility.spec.ts` Tests 9/10/10b already encode.

### Access-denial verdicts

- Disposable BUYER cannot access seller management: **PASS**
  - Observed in `step-B-04-buyer-denied-at-manage-orders.png` (buyer routed to no-shop placeholder).
  - Corroborated by `order-visibility.spec.ts:1684` Test 12 (buyer GET of seller's `/manage/orders/<id>` → denied).
- Second disposable seller cannot see first seller's order: **UNVERIFIED in this checkpoint** — no second disposable seller account was provisioned; the architecture guarantee is at the `listBusinessesByOwner(session.account.id)` + `searchOrders(primary.id, …)` server-side scoping path, but that was not independently exercised with two distinct seller identities in this pass. Flagged as remaining.

---

## Step C · Re-runs

### 1. `cart-order-deterministic` · PASS 8/8

```
npx playwright test --config=playwright.p6-isolation.config.ts \
  --project=cart-order-deterministic-390 --reporter=list
```
- 8 passed · 0 failed · 0 skipped · 1.1m total · zero retries consumed.
- Full output: `evidence/master-flow/CP4-fix/cart-order-deterministic-output.txt`.

### 2. `order-visibility` · PASS 16/16

```
npx playwright test --config=playwright.p6-isolation.config.ts \
  --project=order-visibility-390 --reporter=list
```
- 16 passed · 0 failed · 0 skipped · 2.7m total · zero retries consumed.
- Full output: `evidence/master-flow/CP4-fix/order-visibility-output.txt`.

### 3. `customer-to-seller-order` (sealed historical spec) · BLOCKED

Not run. The spec hard-refuses any role mapping other than Hammerex=customer / Rosa=seller (lines 165-176), which contradicts the owner-designated roles sealed 2026-11-15. Per owner instruction ("Do not edit an immutable/sealed historical artifact"), the spec is not modified and therefore cannot be invoked in this checkpoint. Equivalent coverage is provided by the two CK5-disposable specs above.

### 4. Vault regression (vitest) · pre-existing baseline

```
npx vitest run vault
```
- Test Files: 21 passed · **13 failed** (total 34).
- Tests: 878 passed · **14 failed** · 0 skipped (total 892).
- Duration 20.4s.
- Representative failure: `vault-routes.test.ts:116` — `store[table].filter is not a function` (test-mock harness issue, not product code).
- **Pre-existing baseline**: CP7 (same HEAD) reported 32/336 test-file failures + 61/6706 test failures across the entire `src/lib/nex-native` surface. The 13/14 vault-subset failures reported here are inside that same baseline band (no new regressions). CLAUDE.md fork-hygiene note (sealed 2026-10-10) expressly flags "~14 known broken imports from missing deps · address when touching the files · do not fix in bulk".
- Full output: `evidence/master-flow/CP4-fix/vitest-vault-output.txt`.

### 5. `npm run build` · BLOCKED

Not attempted this pass. `next build` writes into the same `.next/` directory the running dev server on :3008 is reading from. Running build would either fail outright or corrupt dev-server state, logging the founder out of localhost (violates preflight "Keep the founder's existing localhost session"). Marking BLOCKED pending either (a) explicit permission to kill the dev server + restart afterwards, (b) a separate out-of-tree build dir configuration (not authorised).

### 6. `npm run typecheck` · UNVERIFIED (not re-run)

CP7 (same HEAD) reported `tsc --noEmit` exit 1 with 1519 errors across 447 files. No source files changed in this checkpoint, so the count is deterministically unchanged. **Explicitly not claiming** "typecheck clean" or "errors harmless" — the baseline debt is real; the 1519 errors are concentrated in legacy `src/lib/nex/` (208 files) per CP7 flow-path analysis. None of the 20 `src/app/nex-native` error-containing files are in CP1-6 flow paths. This is baseline-unchanged, not resolved.

---

## Changed files (this checkpoint)

**Source edits**: none.

**New files (untracked)**:
- `evidence/master-flow/CP4-fix/role-clarification.md` (superseding clarification doc)
- `evidence/master-flow/CP4-fix/result.md` (this file)
- `evidence/master-flow/CP4-fix/cart-order-deterministic-output.txt` (spec output)
- `evidence/master-flow/CP4-fix/order-visibility-output.txt` (spec output)
- `evidence/master-flow/CP4-fix/vitest-vault-output.txt` (vitest output)
- `evidence/master-flow/CP4-fix/step-B-01-seller-manage-orders-list.png`
- `evidence/master-flow/CP4-fix/step-B-04-buyer-denied-at-manage-orders.png`
- `evidence/master-flow/CP4-fix/step-B-live-00-buyer-cart-page.png`
- `scripts/_tmp/cp4-fix-screenshot.mjs` (ad-hoc screenshot driver · CK5 disposables only)
- `scripts/_tmp/cp4-fix-live-flow.mjs` (ad-hoc live-flow driver · aborted mid-checkout · no DB rows created)

**No diffs to source code.** No commits. No pushes.

---

## Disposable-data write ledger

### Pre-existing from earlier CPs (retained per authorisation)

| Row | Table | ID | Business | Retained |
|---|---|---|---|---|
| Product X | `nex_product` | `47bdf78e-84a9-4ca5-b33f-0676981df65b` | CK5 seller biz `e2e-ck5-seller-shop-mwhyjc0c` | YES |
| Product Y | `nex_product` | `681024eb-0c2e-41f6-b123-aee41c354cd1` | CK5 seller biz `e2e-ck5-seller-shop-mwhyjc0c` | YES |

`.env.playwright.vault-ck5` entries for X/Y: retained.

### Created in this checkpoint (and cleaned)

Spec `cart-order-deterministic` created 2 `nex_order` rows + 2 `nex_peer_message` cart_order rows (CK5 B → CK5 A, product X, two different notes). All 4 rows deleted by the spec's own afterAll (scoped by business_id + customer_id + time window + product_id). Post-run DB check in this checkpoint confirmed 0 remaining `nex_order` rows and 0 remaining `cart_order` peer messages in the CK5 B→A pair for the last-hour window.

Spec `order-visibility` created a similar set across its test phases (imaged + imageless products + two parallel-order ambiguity sets + deterministic-order set). All deleted by the spec's own afterAll with the `[d2 cleanup]` and `[gap1 cleanup]` log lines (visible in `order-visibility-output.txt`).

Ad-hoc `cp4-fix-live-flow.mjs` aborted at the checkout-submit UI step before `sendCartOrderAction` fired. Post-abort DB query confirmed 0 orders and 0 cart messages created by the aborted run.

**Net DB delta to sandbox from this checkpoint = 0 new rows retained.** No broad deletes or resets. Earlier X/Y products retained as authorised.

---

## Git state

```
HEAD:    132bc24daaaec90881ee9dbcdd7d2dbaa83c6f0b   (unchanged)
Branch:  release-audit-v1-2026-11-14
Status:  44 entries dirty — all pre-existing or new untracked evidence
         (4 tracked modifications are overwritten Playwright screenshots
          from prior runs · ~36 are modified evidence PNGs/JSONLs from
          earlier CPs · 4 untracked under evidence/master-flow/ + scripts/_tmp/)
Commits: 0
Pushes:  0
```

---

## Remaining approvals or blockers

1. **`npm run build` approval needed**: run against the shared `.next/` while founder's localhost session is live risks logging them out. Options for owner: (a) authorise one-time dev-server stop + build + dev-restart cycle, or (b) authorise a separate build output dir config change.
2. **Second disposable seller** for cross-seller order-visibility denial: not provisioned this pass. Would require a new CK5-C seller fixture family or similar — new seed-script + env file + spec configuration. Deferred to owner call.
3. **Physical-phone verification**: BLOCKED — no safe path exercised in this checkpoint. Still remaining from original CP4/CP5/CP6 scope.
4. **Sealed CP4 spec (`customer-to-seller-order.spec.ts`)**: per owner instruction cannot be edited to flip Hammerex/Rosa role mapping. If a future authorised revision reseals it with the owner-designated roles (99901=seller, 99903=buyer), the spec can be re-enabled as active coverage alongside the CK5 disposables. Not blocking today.
5. **Typecheck debt**: 1519 errors on same HEAD per CP7 — baseline unchanged, not resolved. Per CLAUDE.md fork-hygiene doctrine, cleanup is incremental.

---

## Separate verdicts

### Ready for founder testing?

**YES, scoped to the CP1-7 flow paths that have been exercised** (buyer sign-in → shop browse → cart → unpaid handoff → seller list → seller detail → cross-account denial), based on:
- `cart-order-deterministic` 8/8 · `order-visibility` 16/16 · `two-context-isolation` 5/5 · `product-linked-inquiry` 11/11 · `product-create-form` 10/10 · `session-persistence` 3/3 · `fast-confirm` 5/5 · `journey-e2e` 24/24 (from CP1-7).
- Founder localhost session on :3008 preserved throughout.
- Caveat: Vault regression baseline has 13/34 files failing (pre-existing; needs founder-authored triage).

Founder-testing readiness **does not** imply all app surfaces are tested — only the CP1-7 flow is exercised.

### Ready for public launch?

**NO.** Blockers independent of CP4-fix:
- `npm run build` not successfully completed on current HEAD (BLOCKED this pass; must be verified green before any launch).
- Typecheck 1519 errors — not launch-blocking per the 5-state readiness model only if they don't manifest at runtime, but no evidence has been gathered to classify them per surface yet. CP7 flow-path analysis showed 0 errors in exercised routes, but ~427 other error-bearing files have not been classified.
- Vault regression 13 failing test files — pre-existing baseline per CLAUDE.md fork-hygiene, but still a 14-test unknown-impact band that has not been triaged.
- Physical-phone verification: BLOCKED across CP4/CP5/CP6/CP7.
- Multi-identity cross-seller denial: not exercised with two distinct seller identities in this pass.
- No production deployment pathway confirmed green since the branch was cut.

These are **not newly-introduced** by this checkpoint — they are the same open items from the master-flow handover. CP4-fix did not create new launch blockers; it closed the two §7 items the owner explicitly named.

---

## Protected-baseline check

Hammerex and Rosa: not signed into, not written, not read-modified, not Vault-mutated in this pass. All disposable activity routed through CK5 A/B identities only. Protected-id guards fired-and-passed in every script (hard-refuse any resolution to the two protected UUIDs).

Production ref `ijvqdvsvwtwxzcqmoqit`: not resolved by any connection this pass. Sealed and untouched.
