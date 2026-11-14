# NEX v1 · Release Audit · 2026-11-14

**Verdict: NOT READY**

**Tested commit:** `b382dd43` on branch `release-audit-v1-2026-11-14`
(branched from `30f259cf` on `ui-drawer-cleanup-plus-loading-2026-11-09`).

**Environment:** dev server on `localhost:3008` pointed at sandbox
Supabase `kdstoyyeygcopkogqsyv`, dev-impersonation locked to
`nex-99901`. Production Supabase `ijvqdvsvwtwxzcqmoqit` and any
production Vercel project were not touched.

---

## v1 scope (recorded assumptions, not asked)

In scope (verified present in code):
- Signup / sign-in (face + email) via `/nex-native/sign-in` with
  `?mode=signup` tab. `createNexAccountAction` + `signInAction`.
- Shop setup (7-step wizard) · templates · backgrounds · intro
  message · burger menu destinations.
- Product / menu / accommodation CRUD under `/nex-native/manage/*`.
- Public shop URL `/[businessSlug]` with product detail sheet.
- Shop Chat (business-scoped conversation) with product card
  attachments. Personal peer chat. Device-only E2E per sealed
  2026-11-09 doctrine.
- Vault (private file / chat room).
- Directory browsing.
- Cart → "payment on arrival" (NEX never handles money; cart
  surface lists the seller's accepted methods).

Out of v1 scope (sealed Scope Reduction 2026-11-06):
- Live, Music, Starter Pack, Power Tokens, Sponsorship, Trade
  Centre, Dev-Live.

**Payment:** Stripe EXISTS only on the seller-subscription side
(seven env vars for NEX_STRIPE_* prices and Checkout). Keys in
`.env.local` are TEST keys (`rk_test_…`). PayPal has webhook code
but with pre-existing TS errors. **Neither flow was exercised in
this audit** — no live charges, no sandbox charges attempted.

---

## What is implemented vs planned

| Journey | Implemented | Audit status |
|---|---|---|
| Account creation + login | Yes | VERIFIED (smoke + unit) |
| Account recovery | Partially (Supabase magic-link path) | UNVERIFIED |
| Seller subscription (Stripe) | Code present; TEST keys | UNVERIFIED |
| Shop setup + edit | Yes | VERIFIED (code trace, HTTP smoke) |
| Product upload / edit | Yes | VERIFIED (code trace) |
| Public shop link | Yes | VERIFIED (HTTP smoke + Playwright Stage 5) |
| Customer → Shop Chat | Yes | VERIFIED (vitest + Playwright) |
| Private vault | Yes | UNVERIFIED (not exercised this audit) |
| Buyer checkout (payment) | Deliberately not implemented | OUT OF SCOPE |
| Merchant payouts | Deliberately not implemented | OUT OF SCOPE |

---

## Baseline check results

### TypeScript (`npx tsc --noEmit`)

- **1,262 errors in `src/*` production code paths.**
- **5 errors in `scripts/*` scratch tools.**
- **279 errors in test infrastructure.**
- **BUILD POSTURE:** `next.config.mjs` sets
  `typescript: { ignoreBuildErrors: true }` — this is the owner's
  **accepted documented baseline exception** per CLAUDE.md ("~14
  known broken imports from missing deps — do not fix in bulk").
  `next build` therefore still succeeds. The 1,262 is a legacy-
  debt figure, not a v1 launch blocker by the owner's own config.

### Vitest (`npx vitest run --no-coverage`)

- **21,591 pass · 535 fail · 330 skipped · 9 todo** across **1,312
  test files** · 106 s wall clock.
- **Failures are PRE-EXISTING**, not caused by Stages 1-10. Many
  share the same mock-chain shape error
  (`nexSupabaseAdmin.from(...).select(...).eq(...).eq(...).maybeSingle
  is not a function`) which I observed throughout Stages 2-10.
- **97.6 % pass rate** is not 100 % and is NOT a documented baseline
  exception today. Owner acceptance of this as "nonblocking baseline"
  is required before the audit can call the test gate PASSED.

### Playwright (Stage 5 journeys · re-run this audit)

- Shop Chat journey (signed-in 99901): **7/7 pass**.
- Anon popup (impersonation off): **5/5 pass**.
- Rosa-side view (impersonation=99903): **3/3 pass**.
- **15/15 total · browser-verified at the sandbox.**

### Build

`next build` was NOT run in this audit (10+ minute operation, dev
server is active on 3008). The `ignoreBuildErrors: true` posture
means it would succeed; verified only by config inspection.
**Explicitly UNVERIFIED.**

---

## What was CHANGED this cycle (Stages 6-10 captured in commit `b382dd43`)

Full detail in the commit message. Summary:

- **P0 safety net:** 21 `loading.tsx`, 1 `error.tsx` on Shop Chat,
  rate-limit on `/api/attachment/standard`.
- **Anon UX consistency:** universal chat-controls contract fix
  (closes the one pre-existing failing test), shared Stage-4
  registration popup component reused at 3 entry points.
- **Owner inbox + ownership:** `sendEncryptedBusinessMessages`
  cross-checks shop owner identity; new `/manage/shop/inbox`
  route; `?preview=1` mode on `/[businessSlug]`; draft-persistence
  hook.
- **Performance:** new batched unread-count helper; 5 server
  components migrated from N+1 to batched reads.
- **Polish (6 of 9):** dynamic `ImageLightbox`, email-confirmation
  help, intro save pending state, menu empty-state CTA, invalid-
  product soft banner. (Items 12 HQ incident, 13 ISR, 15a/c/d
  toasts, 17 theme tint live preview, 19 isolation Playwright
  deferred to post-launch backlog.)

**Added tests this cycle: +58**
- participant-guard (9 → 12) · rate-limit (17 → 21) · universal-
  chat-controls (22/23 → 23/23 pass) · peer-unread-counts-batch
  (new, 6) · use-setup-draft (new, 7) · Stage-2-5 suites unchanged
  but re-verified green.

---

## Issue ledger (priority-ordered)

### Blockers (P0 / P1)

**P1-A · vitest baseline is 535-failing · not documented exception yet**
- Impact: The audit gate "Applicable test checks pass, or an
  explicitly documented nonblocking baseline exception is identified
  for my acceptance" is not met. The 535 are pre-existing, not new,
  but the owner has not formally accepted them as nonblocking.
- Reproduction: `npx vitest run --no-coverage` on commit `b382dd43`.
- Verification: either triage the top failure clusters (mock-chain,
  PayPal typing) OR owner marks this as accepted documented baseline.

**P1-B · payment sandbox paths never exercised in audit**
- Impact: Stripe seller-subscription + PayPal webhook signature
  validation + duplicate-event idempotency are the exact v1 money
  paths. Neither was driven in sandbox this cycle. The PayPal
  webhook route has pre-existing TS errors on its event-shape
  casts.
- Reproduction: not performed.
- Verification: run Stripe CLI sandbox events against
  `/api/stripe/webhook`; run PayPal sandbox events against
  `/api/nex-native/paypal/webhook`; confirm nex_business.tier +
  nex_billing_* state matches event stream.

**P1-C · real-browser two-session journey not driven on Stages 6-10**
- Impact: The anon popup, email-confirmation help block, inbox
  route, preview mode, and 5 N+1 refactors are code-verified + unit-
  verified only. A customer-and-owner real-browser flow has not
  been exercised on top of the Stages 6-10 work.
- Reproduction: no real-browser session driven this cycle.
- Verification: toggle `.env.local` impersonation off → anon flow;
  toggle to `nex-99903` → Rosa flow; drive each spec from the
  Stage-5 Playwright config set.

**P1-D · deployment prerequisites + rollback not documented**
- Impact: The audit's READY criterion requires a documented
  deployment prerequisite list and a rollback path. Neither exists
  in the repo today.
- Reproduction: `ls docs/release-*` returns nothing; no
  `ROLLBACK.md`.
- Verification: author those docs with the owner's actual Vercel
  project linkage + Supabase env map + backup strategy. **This is
  an owner-level infra task, not an engineering fix.**

**P1-E · multi-shop isolation reply-side has no browser verification**
- Impact: Service-level guard proved correct (12/12 participant-
  guard tests + ownership re-verify tests). Browser flow of "owner
  logs in to Shop A, cannot reply as Shop B" is not exercised.
- Verification: new Playwright spec with env toggle between two
  shop-owner personas, assert cross-shop reply is refused end-to-end.

### Known baseline exceptions (owner-accepted or long-standing)

- `next.config.mjs: typescript.ignoreBuildErrors = true` · owner-
  accepted per CLAUDE.md. 1,262 TS errors in `src/*` do not block
  `next build`.
- Pre-existing vitest failures (535 of 22,126 = 2.4 %) · mostly
  mock-chain shape issues from pre-stage-2 era. Not caused by
  Stages 1-10.
- Anon branch of `/[businessSlug]/chat` kept as live route even
  after Stage 7 rewired the Shop Cover FAB to open the Stage-4
  popup directly · owner confirmed `/<slug>/chat` stays available
  as a fallback.

### Nonblocking backlog (P2 / P3)

- **#12** HQ incident recording on `/api/chat/encrypted`,
  `/api/peer-message/encrypted`, biz-conversation creation, shop-
  create. Sealed 2026-11-08 doctrine · instrumentation task.
- **#13** ISR / cache config on `/terms`, `/privacy`. `/help` reads
  session (keep dynamic); `/pricing` reads Supabase (needs audit).
- **#15a** Stock-toggle confirmation toast (owner already sees row
  flip on re-render; UI polish).
- **#15c** Order-detail null-cart-snapshot fallback card.
- **#15d** Accommodation list error retry UI.
- **#17** Theme tint live-preview (save-reload cycle today).
- **#19** Multi-shop isolation reply-side Playwright test (P1-E
  above is the acceptance-test counterpart).
- Dimension sweeps NOT run: accessibility (WCAG, screen-reader,
  keyboard), i18n completeness (hard-coded English), real-latency
  performance, offline resilience, GDPR data-export response.

---

## Flows verified in this audit (with evidence)

| Flow | Evidence | Status |
|---|---|---|
| Shop discovery | HTTP smoke on `/nex-native/handbags-direct` returns 200; Playwright Step 1 pass. | VERIFIED (sandbox) |
| Product detail sheet | Playwright Step 2 pass; `data-nex-product-detail-sheet`, `data-nex-product-sheet-buy-now`, `data-nex-product-sheet-more-details` all rendered. | VERIFIED (sandbox) |
| More Details → Shop Chat with product chip | Playwright Step 3 pass; chip renders with `data-nex-biz-conv-pending-product=<id>`. | VERIFIED (sandbox) |
| Encrypted product-card send | Playwright Step 4 branches on cooldown state; DB probe confirms prior product-share row exists with `attachment_type='product'` + `attachment_meta.product_id`. Crypto round-trip unit test 7/7. | VERIFIED (sandbox) |
| Refresh preserves history | Playwright Step 5 pass (muted-placeholder render survives reload). | VERIFIED (sandbox) |
| Cross-shop product isolation | Playwright Step 6 pass; foreign product id returns 0 chip markers. | VERIFIED (sandbox) |
| Anon popup | Playwright anon-popup spec 5/5 pass (impersonation off). | VERIFIED (sandbox) |
| Rosa (owner) access | Playwright Rosa-side spec 3/3 pass. | VERIFIED (sandbox) |
| Owner ownership re-verify | Vitest 12/12 (3 new ownership tests + 9 original participant-guard). | VERIFIED (service) |
| Rate-limit on attachment upload | Vitest 21/21 (4 new rate-limit paths). | VERIFIED (service) |
| Universal chat-controls contract | Vitest 23/23 (was 22/23 before Stage 7). | VERIFIED |
| Unread-count N+1 collapse | Vitest 6/6 on batched helper; /free-chat migrated. | VERIFIED |

---

## What was NOT tested

- **Real Supabase signup** (would create permanent sandbox
  `auth.users` row) → UNVERIFIED.
- **Email confirmation link click** → UNVERIFIED.
- **First device-key publication on first sign-in** → UNVERIFIED
  (existing keys confirmed in sandbox but not exercised through
  the flow).
- **Stripe sandbox checkout** → UNVERIFIED.
- **PayPal webhook signature + duplicate-event idempotency** →
  UNVERIFIED.
- **Vault unlock flow** → UNVERIFIED this cycle.
- **Account recovery (magic link / password reset)** → UNVERIFIED.
- **`next build`** → UNVERIFIED (config says `ignoreBuildErrors`).
- **Accessibility, i18n, latency, offline** → NOT scanned.
- **Production env config, backup/restore, rollback** → NOT scanned
  (owner-level infra).

---

## Shortest remaining manual launch checklist

1. **Decide the vitest baseline**: owner accepts 535 pre-existing
   failures as a documented nonblocking exception, OR triage the
   top failure clusters.
2. **Exercise Stripe sandbox** on the seller-subscription path:
   test subscribe, cancel, renewal, webhook signature valid,
   duplicate event. Record evidence in `docs/release-audit-stripe-
   sandbox-YYYY-MM-DD.md`.
3. **Exercise PayPal sandbox** webhook similarly (OR confirm
   PayPal is deferred from v1; its route has TS errors).
4. **Drive Stages 6-10 in a real browser** using the three
   Playwright configs this audit shipped (`playwright.stage5-shop-
   chat-journey.config.ts`, `playwright.stage5-anon-popup.config.
   ts`, `playwright.stage5-rosa-side.config.ts`).
5. **Verify vault unlock + account recovery** end-to-end.
6. **Author `docs/ROLLBACK.md`** with the Vercel project redeploy
   path + Supabase backup pin.
7. **Push `release-audit-v1-2026-11-14` branch** (requires owner
   explicit authorisation). Verify Vercel preview build.
8. When all above are checked, revisit this audit with new
   evidence and re-run `npx vitest run` + the three Playwright
   configs on the final commit.

---

## Explicit statement

**The agreed v1 launch checks did NOT all pass in the tested
environment.** Five blockers (P1-A through P1-E) remain. The code
delivered across Stages 1-10 meets engineering VERIFIED status for
its scope, but the release-level criteria (baseline exception
acceptance, payment-path verification, two-session browser
verification, rollback documentation) are not met.

This is not a certification. This is an honest audit record.
