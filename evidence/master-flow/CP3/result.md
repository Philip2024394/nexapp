# CP3 — Product questions & ordinary storefront chat

Date: 2026-11-15
Spec: `tests/e2e-p6-isolation/product-linked-inquiry.spec.ts`
Config: `playwright.p6-isolation.config.ts` (project `product-linked-inquiry-390`, viewport 390×844, deviceScaleFactor 2, timeout 360s)
Server target: `http://localhost:3008` (via `PLAYWRIGHT_TEST_BASE_URL`; dev :3008 already running)
Two-context actors: Context A = CK5 B buyer (`PLAYWRIGHT_CK5_B_*`), Context B = CK5 A seller (`PLAYWRIGHT_CK5_A_*`)
DB: sandbox `kdstoyyeygcopkogqsyv` (spec lines 76-80 refuse prod ref)

## Fixture seeding (fixture-assisted, disclosed)

Ran `node scripts/_tmp/seed-disposable-product-inquiry.mjs` before spec. It:
- Reused existing CK5 A disposable seller business `e2e-ck5-seller-shop-mwhyjc0c`
- Inserted two active `nex_product` rows:
  - X = `47bdf78e-84a9-4ca5-b33f-0676981df65b`
  - Y = `681024eb-0c2e-41f6-b123-aee41c354cd1`
- Appended `PLAYWRIGHT_CK5_PRODUCT_X_ID` / `PLAYWRIGHT_CK5_PRODUCT_Y_ID` to `.env.playwright.vault-ck5`
- Seed script has hard guards: refuses if `DATABASE_URL` resolves to prod ref, requires sandbox ref, blocks Hammerex/Rosa UUIDs.

Spec inserts product-inquiry message rows **using the exact sealed `sendProductInquiryAction` shape** (attachment_type='product' + attachment_meta.product snapshot). Disclosed as a replay of the sealed write contract, not a parallel system.

## Result — PASS (desktop, Playwright)

| # | Test | Status | Duration |
|---|---|---|---|
| 1 | buyer signs in | ✅ passed | 7.3s |
| 2 | buyer opens an inquiry about Product X · sealed write shape | ✅ passed | 1.4s |
| 3 | buyer opens peer chat · sees Product X pinned at top | ✅ passed | 9.1s |
| 4 | pin survives buyer reload · still anchored to Product X | ✅ passed | 5.9s |
| 5 | pin survives buyer navigate-away-and-back | ✅ passed | 8.4s |
| 6 | seller signs in second context · sees SAME Product X pinned | ✅ passed | 8.5s |
| 7 | buyer opens a SECOND inquiry about Product Y · same conversation | ✅ passed | 1.4s |
| 8 | after Y · pin UPDATES to Y (latest anchor) · X stays visible inline | ✅ passed | 5.4s |
| 9 | pin survives buyer reload after second inquiry · still Y | ✅ passed | 5.1s |
| 10 | seller reloads same conversation · also sees Y pinned | ✅ passed | 6.1s |
| 11 | third peer chat with a DIFFERENT seller (no inquiry) renders NO pin | ✅ passed | 4.9s |

Total: **11 passed (1.3m)**. Zero retries consumed. Cleanup: `[cp2 cleanup] deleted peer messages=2`.

## In-scope findings

Behaviour verified:
- Product inquiry pins to top of peer conversation for **both** participants (buyer context + seller context).
- Pin survives reload AND navigate-away-and-back on buyer side.
- Second inquiry (Y) updates the pin to the latest anchor; X stays inline in the message stream (does not disappear).
- Pin reload-persistence survives on seller side too (Test 10).
- **Ordinary peer chat with no product context = no pin** (Test 11). This is the "ordinary storefront chat" half of CP3.

No defects discovered. No Builder work triggered.

## Method / independence disclosure (§1, §4)

- **Method**: two isolated Playwright `browser.newContext()` instances against :3008. Parallel sign-ins → independent Supabase auth sessions. Peer messages read via sealed `peerMessageService.listPeerMessages` path (not a parallel read).
- **Fixture assistance**: spec INSERTS product-inquiry rows directly rather than driving the UI "Ask about this product" button, because the inquiry-sender UI flow is covered by other specs; CP3 scope is the **chat-side rendering** contract. Disclosed in spec header lines 18-24. This is the intended scope boundary, not a shortcut.
- **QA independence**: self-check only — spec pre-authored by prior Claude work. **Not** independent §1-strong QA.
- **Physical phone**: BLOCKED — N/A at render-contract level (same server actions, same message rows, same component tree regardless of viewport). Mobile camera/paste upload-path still needs founder-operator test against `http://192.168.1.3:3008`.
- **Sandbox proof**: spec's hard refusal on prod ref fired-and-passed (spec ran to completion, which only the guard permits against sandbox).

## Evidence artifacts

- Spec output: `evidence/master-flow/CP3/playwright-output.txt`
- Start HEAD: `132bc24daaaec90881ee9dbcdd7d2dbaa83c6f0b`
- End HEAD: unchanged
- No commits, no pushes, no DB migrations, no prod touch
- Seed: `scripts/_tmp/seed-disposable-product-inquiry.mjs` (ran once, sandbox-only, idempotent re-run safe per script design)

## Protected baseline check

Hammerex/Rosa not touched. Seed and spec hard-refuse their UUIDs. Only CK5 disposables exercised.

## Remaining CP3 items

- Real-phone render check of pinned product card still BLOCKED pending founder operator.
- `.env.playwright.vault-ck5` now carries two new env lines (`PLAYWRIGHT_CK5_PRODUCT_X_ID/Y_ID`) — this is expected seed output, tracked here for transparency.
- No in-scope defects → no Builder work for CP3.
