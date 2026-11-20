# CP2 — Seller setup & public shop

Date: 2026-11-15
Spec: `tests/e2e-p6-isolation/product-create-form.spec.ts`
Config: `playwright.p6-isolation.config.ts` (project `product-create-form-390`, viewport 390×844, deviceScaleFactor 2)
Server target: `http://localhost:3008` (via `PLAYWRIGHT_TEST_BASE_URL` override of config default `:3010`; founder's dev server already on :3008, Next 16 single-server-per-dir)
Actor: CK5 A (disposable seller, `PLAYWRIGHT_CK5_A_*` from `.env.playwright.vault-ck5`) — spec header: "disposables only (NOT Hammerex/Rosa)"
DB: sandbox `kdstoyyeygcopkogqsyv` (spec has hard-refusal if `DATABASE_URL` ref = prod `ijvqdvsvwtwxzcqmoqit` — lines 68-73)

## Role note

CP2 exercises a **disposable** seller (CK5 A), not Hammerex. Owner's "99901 id is seller" direction applies to flows requiring the persistent protected-baseline seller; CP2 category-picker + create-product UI is isolated from Hammerex's shop so running it through CK5 keeps Hammerex's shop unmodified (per §2 preservation invariant) and avoids ambiguity around the role swap vs existing spec encoding.

## Result — PASS (desktop, Playwright)

| # | Test | Status | Duration |
|---|---|---|---|
| 1 | CK5 seller signs in through real form | ✅ passed | 8.4s |
| 2 | navigate to `/create/product/category?business=<id>` | ✅ passed | 3.6s |
| 3 | drill fashion_clothing → womens via real tile clicks | ✅ passed | 6.9s |
| 4 | form renders expected sections (name, price, spec, market, images) | ✅ passed | 43ms |
| 5 | upload image via real file-input · preview renders | ✅ passed | 3.4s |
| 6 | variant-seeding gap observation (honest finding) | ✅ passed | 221ms |
| 7 | submit with EMPTY name shows error · stays on form | ✅ passed | 295ms |
| 8 | fill required fields + spec + submit as draft · redirect to `/manage/products/<id>` | ✅ passed | 11.1s |
| 9 | DB persists · product row has selected dept+cat + spec | ✅ passed | 1.2s |
| 10 | navigate to public storefront `/<slug>` · product status filter note | ✅ passed | 2.9s |

Total: **10 passed (47.5s)**. Zero retries consumed.

## In-scope findings

- **Test 6 — variant-seeding gap**: spec logs this as an honest observation, not a failure. The create-product form does not auto-seed a default variant row; variant creation happens post-create. Not in-scope for CP2 fix (no Builder work triggered).
- **Test 10 — product status filter note**: the newly-created draft product appears at `/<slug>` only when the storefront's status filter includes drafts. Public-visible flow for buyers requires `status='active'`; draft→active transition is covered by CP4/CP6 order/publish flows.

## Method / independence disclosure (§1, §4)

- **Method**: Playwright driving real UI via Chromium (390×844 @ DSR 2) against `localhost:3008`, same dev server the founder is using. No founder-cookie reuse; parallel sign-in using CK5 A credentials created an independent Supabase auth session.
- **QA independence**: self-check only. The spec (`product-create-form.spec.ts`) was pre-authored by prior Claude work. **Not** independent §1-strong QA.
- **Physical phone**: **BLOCKED — N/A at form-interaction level**; DOM-driven create-product flow exercises the same server actions regardless of device viewport. Mobile browser upload-path still needs a founder-operated phone test against `http://192.168.1.3:3008` for camera-capture/paste image flows per §4.
- **Sandbox proof**: spec lines 68-73 enforce hard refusal if `DATABASE_URL` resolves to prod ref. Verified fired-and-passed (spec ran to completion, which the guard only permits against sandbox).

## Evidence artifacts

- Spec output: `evidence/master-flow/CP2/playwright-output.txt`
- Playwright-generated artifacts: per-project under `test-results/product-create-form-390/*` (10 passed = none kept by default)
- Start HEAD: `132bc24daaaec90881ee9dbcdd7d2dbaa83c6f0b`
- End HEAD: unchanged
- No commits, no pushes, no DB migrations, no prod touch

## Protected baseline check

Hammerex (99901) shop surface NOT touched by this CP (CK5 seller only). Hammerex Vault, contacts, sign-in all preserved — CP1 verified Hammerex session survival separately and that evidence stands.

## Cleanup

Spec contains in-test cleanup for `name LIKE 'E2E Product %'` rows against CK5 A's business. Spec exited cleanly (exit 0) → cleanup ran. Row count of lingering synthetic products in CK5 A's business should be 0 (verified by the final cleanup step of the spec; a re-verify query is not re-run here to keep this evidence file engineering-ceiling VERIFIED, not a fresh-moment live-DB assertion).

## Remaining CP2 items

- Real-phone upload path check still BLOCKED pending founder operator.
- No in-scope defects → no Builder work for CP2.
