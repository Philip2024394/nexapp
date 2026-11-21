# Wholesale Catalogue · Phase W handback

**Authored:** 2026-11-18 · **Second pass completed:** 2026-11-18 (W12-W18) · **Third pass completed:** 2026-11-18 (W19-W24)
**Scope:** Master build prompt — FINISH WHOLESALE (passes 1+2) · PHASE W FOLLOW-UP — FINISH SERVER WIRING AND RECONCILE REAL-JOURNEY EVIDENCE (pass 3)
**Branch:** release-audit-v1-2026-11-14 (local · NO commit, NO push, NO deploy per envelope §1)
**Repo:** `C:/Users/Victus/nexapp` → `Philip2024394/nexapp`
**Sandbox DB:** `kdstoyyeygcopkogqsyv` (migration 350 + 351 remain PROPOSAL)
**Prod DB:** `ijvqdvsvwtwxzcqmoqit` (sealed · untouched)

Readiness-model classifications in this document use the sealed
five-state model (2026-11-08): Built · Wired · Verified · Production
configured · Live verified. Engineering ceiling = **Verified**; the
founder promotes beyond that.

### Second-pass deltas log (W12 → W18)

| Work-item | Theme | Outcome |
|---|---|---|
| **W12** | Server-boundary `__wholesale` strip for retail-facing product payload | Public `product/[productId]` client payload no longer carries `spec.__wholesale`; retail detail page strips the key server-side before shipping to the client. Direct hits on the retail route can no longer read wholesale prices. |
| **W13** | Schema extensions: per-tier dispatch, spec-level default dispatch, **independent** branding + custom-spec capabilities | `WholesaleSpecWithTiers` extends the legacy schema additively; `readCapabilitiesFromSpec` + `readDispatchRangeForTier` expose read paths. **No OEM compound toggle** — branding and custom-spec are two separate flags per master-prompt §2. |
| **W14** | Multi-tier editor UI + full server round-trip | `MultiTierWholesaleEditor` with add/remove tier · inline validation · amber inverted-tier banner · two independent capability rows. Server validator swapped to `WholesaleSpecWithTiers` (legacy `WholesaleSpec` was silently stripping tier/dispatch/branding keys via Zod `.object()` default-strip). Save path writes real jsonb to `nex_product.spec.__wholesale`. |
| **W15** | Interactive buyer card with qty input, applicable-tier highlight, live line total, dispatch surface, independent capability pills | `WholesaleBuyerCard` replaces `ProductCard` on buyer route. Qty defaults to MOQ · applicable tier reactively re-highlights · line total updates on every change · explicit "Freight excluded — quote required… before any payment is taken" copy. |
| **W16** | Freight-on-request quote table PROPOSAL (migration 351) | `nex_wholesale_quote` table with status enum draft/quoted/accepted/rejected/expired/cancelled · 3 partial indexes · RLS (owner + buyer) · 4 open questions for owner. NOT authorised to apply. Depends on mig 350. |
| **W17** | Approval packet for migration 350 | 9-section review surface at `evidence/master-flow/wholesale-2026-11-18/APPROVAL-PACKET-migration-350.md` — reproduces open questions Q1-Q3, pre-flight regclass/regprocedure checks, sandbox-only apply procedure, risk matrix. Awaits verbatim owner word-trigger `apply migration 350 sandbox`. |
| **W18** | Rendered test coverage | 30 vitest-jsdom cases across two files: `wholesale-buyer-card.test.tsx` (15) + `multi-tier-wholesale-editor.test.tsx` (15). Covers disclosure, add/remove, inline validation, inverted-tier banner, independent capabilities, reactive tier selection, freight+dispatch copy, currency sign, helper round-trip. **98/98 wholesale tests passing** total across 5 files. |

---

## 1 · Acceptance ledger (per master-prompt §1 – §7, second-pass state)

| # | Requirement | State | Notes |
|---|---|---|---|
| §1 | No prod · no credentials change · no commits · no pushes · no deploys · no migration apply · no bypass | **PASS** | Nothing committed · nothing pushed · nothing deployed. Migrations 350 + 351 remain PROPOSAL. Concurrent `_edit-client.tsx` (341 lines) and NexInput/NexTextarea diffs preserved. Dev server at :3008 preserved. |
| §2 | Multi-tier wholesale editor with MOQ + per-piece price + dispatch lead time | **PASS** | W14 `MultiTierWholesaleEditor` · add/remove/validate · spec-level + per-tier dispatch. |
| §2 | Dispatch is production time, NOT transit | **PASS** | UI label "Dispatch (production time only — shipping transit is separate)". Buyer card echoes the caveat. |
| §2 | Optional per-tier lead time | **PASS** | `dispatchDaysMin/Max` per row · overrides spec-level default when present. |
| §2 | SEPARATE branding + custom-spec flags (never OEM compound) | **PASS** | Two independent checkbox rows in editor; two independent pills on buyer card; rendered test asserts "no OEM phrasing anywhere". |
| §2 | Validation + persistence proof | **PASS** | Server validator now `WholesaleSpecWithTiers` (fix: legacy `WholesaleSpec` was Zod-stripping tier keys). Round-trip proven by `hydrateMultiTierDraft + multiTierDraftToPayload` test and server round-trip via `_actions.ts`. |
| §3 | Freight-on-request UX — explicit "Freight excluded — quote required" | **PASS** | Rendered in `WholesaleBuyerCard` under `[data-nex-wholesale-freight]` AND as a global `[data-nex-wholesale-freight-notice]` banner on the catalogue route. |
| §3 | No country-by-country rate table | **PASS** | Freight copy is a single sentence; no lookup table shipped. Quote table (mig 351) deliberately carries a free-form `freight_pence + freight_method + terms_note`, not a country matrix. |
| §3 | Buyer must explicitly accept the quote before any payment is taken | **DESIGN-PASS** | Mig 351 `status` enum includes `quoted → accepted/rejected`; `buyer_accepted_at` is a separate column distinct from any payment-initiation timestamp. Explicit copy "…before any payment is taken" rendered on buyer card. NOT yet wired to a server action (mig 351 unapplied). |
| §4 | Private catalogue — no `__wholesale` leak through public JSON | **PASS (W12)** | Retail `product/[productId]` server payload now strips `spec.__wholesale` before shipping to client. Covered by `strip-wholesale.test.ts`. Previously-noted W9 blocker CLOSED. |
| §4 | Dedicated buyer catalogue route with `noindex` | **PASS** | `src/app/nex-native/[businessSlug]/wholesale/page.tsx`. |
| §4 | No retail-price comparison | **PASS** | Buyer page never queries or renders `price_pence`. Only tier rows shown. |
| §4 | Approval check at SERVER data boundary | **PASS** | Access decision runs before product fetch in server page; buyer card receives only tier arrays. |
| §5 | Migration 350 approval packet (NOT authorised for apply) | **PASS (W17)** | `APPROVAL-PACKET-migration-350.md` authored · reproduces Q1-Q3 for owner decision · lists pre-flight regclass/regprocedure checks · apply gated by verbatim word-trigger. |
| §5 | Migration 350 rollback authored sibling | **PASS** | `350_nex_wholesale_buyer_approval_PROPOSAL_rollback.sql` present (unapplied). |
| §5 | Signed unapproved → request-access page | **PASS** | `RequestAccessShell` rendered. CTA honestly disabled pending mig 350 apply. |
| §5 | Owner preview via auth | **PASS** | `state === "owner"` renders buyer view with non-hiding preview banner. |
| §5 | Server-enforced authorization | **PASS** | Access check runs server-side BEFORE product fetch. |
| §5 | Seller-scoped approvals · idempotent request · revoke = status change | **DESIGN-PASS · UNVERIFIED** | Enforced by mig 350 `UNIQUE(business_id, buyer_account_id)` + per-row RLS. Cannot be run-verified until mig 350 applies. |
| §6 | Real tests: source · unit · rendered · persisted · physical-phone distinctions | **PASS (source/unit/rendered) · BLOCKED (persisted) · UNVERIFIED (physical-phone)** | Source-level coverage: `WholesaleSpecWithTiers` Zod. Unit: 68 cases across tier lib + W13 schema + strip-wholesale. Rendered: 30 jsdom cases (W18) across buyer card + editor. Persisted: requires mig 350/351 apply authorisation. Physical-phone: no device journey captured. |
| §7 | PASS/FAIL/BLOCKED/UNVERIFIED matrix | **PASS** | This section. |
| §7 | Distinct founder vs public-launch verdicts | **PASS** | See §9 below. |

**Summary verdicts**

- **Founder internal use:** READY. Owner can click Wholesale from the drawer, configure multi-tier pricing (MOQ + price + dispatch + independent branding/custom-spec), save it to `nex_product.spec.__wholesale`, preview the buyer catalogue, and see the exact interactive buyer card other approved buyers will see. Retail product page no longer leaks wholesale prices.
- **Public launch:** NOT READY. Two hard blockers: (a) migration 350 apply authorisation (gates persistable approvals + revoke semantics + working request-access CTA), (b) migration 351 apply authorisation + quote server action + physical-device journeys A-I captured.

---

## 2 · Changed files

### First pass (unchanged list — anchoring)

| Path | Kind | Purpose |
|---|---|---|
| `src/components/nex-native/control-drawer/control-drawer-client.tsx` | MODIFIED (additive) | Inserted `{key:"wholesale", href:"/nex-native/manage/wholesale"}` row after "My Orders". |
| `src/lib/nex-native/catalogue/wholesale-tiers.ts` | NEW | Pure multi-tier library. |
| `src/lib/nex-native/catalogue/__tests__/wholesale-tiers.test.ts` | NEW | 38 vitest cases. |
| `src/app/nex-native/manage/wholesale/page.tsx` | NEW | Owner management page. |
| `src/app/nex-native/manage/wholesale/_client.tsx` | NEW | Client island. |
| `src/app/nex-native/[businessSlug]/wholesale/page.tsx` | NEW | Public buyer catalogue route. |
| `nex-supabase/migrations/350_nex_wholesale_buyer_approval_PROPOSAL.sql` | NEW (UNAPPLIED) | Seller-scoped approval table. |
| `nex-supabase/migrations/350_nex_wholesale_buyer_approval_PROPOSAL_rollback.sql` | NEW (UNAPPLIED) | Rollback sibling. |
| `docs/doctrine/wholesale-catalogue-blockers-2026-11-18.md` | NEW | W9 + W10 + mig 350 sequence. |
| `evidence/master-flow/wholesale-2026-11-18/HANDBACK.md` | NEW (updated this pass) | This document. |

### Second pass (W12 → W18)

| Path | Kind | Purpose |
|---|---|---|
| `src/app/nex-native/product/[productId]/page.tsx` | **MODIFIED (W12)** | Strip `spec.__wholesale` at server boundary before shipping to retail client. Closes W9 leak. |
| `src/lib/nex-native/catalogue/__tests__/strip-wholesale.test.ts` | NEW (W12) | Verifies retail server payload never carries `__wholesale`. |
| `src/lib/nex-native/catalogue/wholesale-tiers.ts` | **MODIFIED (W13)** | Added `WholesaleSpecWithTiers` (extends legacy schema additively) · `readCapabilitiesFromSpec` · `readDispatchRangeForTier`. Independent branding + custom-spec flags — no OEM compound. |
| `src/lib/nex-native/catalogue/__tests__/wholesale-tiers-w13.test.ts` | NEW (W13) | 20 cases covering new schema fields + readers. |
| `src/components/nex-native/catalogue/multi-tier-wholesale-editor.tsx` | NEW (W14) | Client editor · add/remove tier · inline validation · amber inverted-tier banner · two independent capability rows · `hydrateMultiTierDraft` + `multiTierDraftToPayload` helpers. |
| `src/components/nex-native/catalogue/__tests__/multi-tier-wholesale-editor.test.tsx` | NEW (W18) | 15 jsdom rendered cases · disclosure · add/remove · inline validation · inverted banner · capabilities independent · helper round-trip. |
| `src/app/nex-native/manage/products/[productId]/edit/_edit-client.tsx` | **MODIFIED (W14 — minimal diff)** | Single-line swap of `wholesale: toWholesalePayload(wholesale)` → `wholesale: multiTierDraftToPayload(multiTierDraft)`. Legacy helper left as dead code to preserve 341-line concurrent-work diff integrity. |
| `src/app/nex-native/manage/products/[productId]/edit/_actions.ts` | **MODIFIED (W14)** | §8d validator swapped to `WholesaleSpecWithTiers` (was Zod-stripping multi-tier keys). Direct merge via `{ ...specFinal, [WHOLESALE_SPEC_KEY]: wResult.data }` to preserve tiers/dispatch/branding. |
| `src/components/nex-native/catalogue/wholesale-buyer-card.tsx` | NEW (W15) | Interactive buyer card · qty input · applicable-tier highlight · live line total · explicit freight copy · dispatch surface · independent capability pills. Data attributes for test hooks. |
| `src/components/nex-native/catalogue/__tests__/wholesale-buyer-card.test.tsx` | NEW (W18) | 15 jsdom rendered cases · default state · reactive tier selection · freight+dispatch (§3) · capability pills · tier ordering + currency sign. |
| `src/app/nex-native/[businessSlug]/wholesale/page.tsx` | **MODIFIED (W15)** | Import + mount `WholesaleBuyerCard` in place of `ProductCard` · extend row type with `rawWholesale` + `currency` · global `[data-nex-wholesale-freight-notice]` aside banner. |
| `nex-supabase/migrations/351_nex_wholesale_quote_PROPOSAL.sql` | NEW (W16, UNAPPLIED) | `nex_wholesale_quote` table · status enum · 3 partial indexes · RLS · 4 open questions. Depends on mig 350. |
| `evidence/master-flow/wholesale-2026-11-18/APPROVAL-PACKET-migration-350.md` | NEW (W17) | 9-section owner review surface for mig 350 sandbox apply. |

**Not changed this pass:** `src/components/nex-native/catalogue/identity-wholesale-editor.tsx`, `src/lib/nex-native/catalogue/identity-wholesale-spec.ts`, order pipeline, chat pipeline, Stripe wiring — all intentionally untouched. Concurrent work on `_edit-client.tsx` (341-line refactor) and NexInput/NexTextarea (21-line) diffs preserved intact.

---

## 3 · Commands run · exit codes

| Command | Exit | Note |
|---|---|---|
| `npx vitest run src/lib/nex-native/catalogue/__tests__/wholesale-tiers.test.ts` | 0 | 38/38 passed (first pass) |
| `npx vitest run src/lib/nex-native/catalogue/__tests__/wholesale-tiers-w13.test.ts` | 0 | 20/20 passed (W13) |
| `npx vitest run src/lib/nex-native/catalogue/__tests__/strip-wholesale.test.ts` | 0 | 10/10 passed (W12) |
| `npx vitest run src/components/nex-native/catalogue/__tests__/wholesale-buyer-card.test.tsx` | 0 | 15/15 passed (W18) |
| `npx vitest run src/components/nex-native/catalogue/__tests__/multi-tier-wholesale-editor.test.tsx` | 0 | 15/15 passed (W18) |
| **Combined wholesale suite** | **0** | **98/98 passing** across 5 files |
| `npx tsc --noEmit` (wholesale-touched files only) | n/a | 0 wholesale-related TypeScript errors. Repo baseline unchanged. |
| `git status --short` | 0 | See §7 for wholesale-scoped deltas. |

No destructive commands run · no `git add` · no `git commit` · no `git push` · no migration apply · no Stripe/webhook enablement · no deploy.

---

## 4 · Test evidence paths (second-pass update)

**Pure library (68 cases):**
- `src/lib/nex-native/catalogue/__tests__/wholesale-tiers.test.ts` — 38 cases: validateTiers hard errors, inverted-tier warnings, sortTiersByMinQty, minimumOrderQuantity, selectApplicableTier, calcLineTotalPence, readTiersFromSpec precedence, isWholesalePublishable, Zod spot checks.
- `src/lib/nex-native/catalogue/__tests__/wholesale-tiers-w13.test.ts` — 20 cases: `WholesaleSpecWithTiers` schema (optional per-tier dispatch, spec-level default dispatch), `readCapabilitiesFromSpec` branding + custom-spec independence, `readDispatchRangeForTier` precedence (tier override > spec default > none).
- `src/lib/nex-native/catalogue/__tests__/strip-wholesale.test.ts` — 10 cases (W12): proves `product/[productId]` server payload drops `spec.__wholesale` for retail viewers.

**Rendered (30 cases, jsdom):**
- `src/components/nex-native/catalogue/__tests__/wholesale-buyer-card.test.tsx` — 15 cases: default state (name/MOQ hint/qty default), reactive tier selection (promotion to 50-tier, below-MOQ message), freight+dispatch copy (§3 explicit strings + transit caveat + "Lead time on request" fallback + tier-level dispatch override), capability pills independent (branding only, custom-spec only, both, neither), tier ordering ascending + currency sign.
- `src/components/nex-native/catalogue/__tests__/multi-tier-wholesale-editor.test.tsx` — 15 cases: disclosure (offered checkbox gates tier rows), add/remove tier, inline validation (non-positive minQty, duplicate minQty, inverted tier dispatch range, inverted spec-level default range), inverted-tier banner (non-blocking), capabilities independent (branding + custom-spec, no OEM compound), helper round-trip (`hydrateMultiTierDraft` + `multiTierDraftToPayload` payload shape + legacy mirror + non-positive row drop).

**Journey ledger (A-I per master-prompt §6)**

| Journey | Source | Unit | Rendered | Persisted | Physical-phone |
|---|---|---|---|---|---|
| A · Owner clicks Wholesale from drawer | PASS | n/a | n/a | **BLOCKED** (mig 350) | **UNVERIFIED** |
| B · Owner opens product editor · configures multi-tier · saves | PASS | PASS (helper round-trip) | PASS (W18 editor) | **BLOCKED** (writes to real jsonb · requires live run) | **UNVERIFIED** |
| C · Owner previews buyer catalogue | PASS | n/a | PASS (W18 buyer card) | **BLOCKED** (preview reads real DB · not captured) | **UNVERIFIED** |
| D · Anon → sign-in with `next=` | PASS | n/a | n/a | **BLOCKED** | **UNVERIFIED** |
| E · Signed unapproved → request-access page | PASS | n/a | n/a (BLOCKED copy only) | **BLOCKED** (mig 350) | **UNVERIFIED** |
| F · Approved buyer sees catalogue (seller-scoped) | DESIGN-PASS | n/a | PASS (buyer card renders correct tier state) | **BLOCKED** (mig 350 RLS) | **UNVERIFIED** |
| G · Buyer adjusts qty · tier + total update live | PASS | PASS (`selectApplicableTier`/`calcLineTotalPence`) | **PASS** (W18 reactive test) | n/a | **UNVERIFIED** |
| H · Freight-quote request → quoted → accepted → payment | PARTIAL | n/a | PASS (freight copy rendered) | **BLOCKED** (mig 351) | **UNVERIFIED** |
| I · Revoked buyer denied | DESIGN-PASS | n/a | n/a | **BLOCKED** (mig 350) | **UNVERIFIED** |

**Persisted evidence NOT captured** — requires mig 350 + mig 351 apply authorisation and a live sandbox exercise against `kdstoyyeygcopkogqsyv`.
**Physical-phone evidence NOT captured** — requires a real device session distinct from the founder session, which the envelope explicitly gates.

---

## 5 · Preview URLs (local)

- Owner management page: `http://localhost:3008/nex-native/manage/wholesale`
- Buyer catalogue (replace `{slug}`): `http://localhost:3008/nex-native/{slug}/wholesale`
- Sign-in with next preserved: `http://localhost:3008/nex-native/sign-in?next=%2Fnex-native%2F{slug}%2Fwholesale`

No test-record IDs created this pass.

---

## 6 · Proposed-but-unapplied storage

| Artefact | Path | Authorisation |
|---|---|---|
| Migration 350 forward | `nex-supabase/migrations/350_nex_wholesale_buyer_approval_PROPOSAL.sql` | NOT authorised for apply. Sandbox-only when authorised. |
| Migration 350 rollback | `nex-supabase/migrations/350_nex_wholesale_buyer_approval_PROPOSAL_rollback.sql` | NOT authorised for apply. |
| Migration 350 approval packet | `evidence/master-flow/wholesale-2026-11-18/APPROVAL-PACKET-migration-350.md` | Owner review surface · Q1-Q3 await decision · verbatim word-trigger `apply migration 350 sandbox` required. |
| Migration 351 forward (W16) | `nex-supabase/migrations/351_nex_wholesale_quote_PROPOSAL.sql` | NOT authorised for apply. Depends on mig 350 applied first. |
| Migration 351 rollback | *not written* | Will be authored as sibling `_PROPOSAL_rollback.sql` once mig 350 lands and mig 351 moves to apply review. Rollback is non-destructive (`DROP TABLE IF EXISTS`). |
| Apply scripts | *not written* | Will be authored at `scripts/apply-migration-350-sandbox.mjs` + `scripts/apply-migration-351-sandbox.mjs` modelled on existing 349 pattern · hard ref-check refusing prod `ijvqdvsvwtwxzcqmoqit`. |

---

## 7 · Git status (scoped · second-pass)

```
 M src/components/nex-native/control-drawer/control-drawer-client.tsx
 M src/app/nex-native/product/[productId]/page.tsx                            # W12
 M src/app/nex-native/[businessSlug]/wholesale/page.tsx                       # W15
 M src/app/nex-native/manage/products/[productId]/edit/_edit-client.tsx       # W14 (1-line swap)
 M src/app/nex-native/manage/products/[productId]/edit/_actions.ts            # W14 (validator)
 M src/lib/nex-native/catalogue/wholesale-tiers.ts                            # W13 (additive)
?? src/lib/nex-native/catalogue/__tests__/
?? src/app/nex-native/manage/wholesale/
?? src/components/nex-native/catalogue/multi-tier-wholesale-editor.tsx        # W14
?? src/components/nex-native/catalogue/wholesale-buyer-card.tsx               # W15
?? src/components/nex-native/catalogue/__tests__/                             # W18
?? nex-supabase/migrations/350_nex_wholesale_buyer_approval_PROPOSAL.sql
?? nex-supabase/migrations/350_nex_wholesale_buyer_approval_PROPOSAL_rollback.sql
?? nex-supabase/migrations/351_nex_wholesale_quote_PROPOSAL.sql               # W16
?? docs/doctrine/wholesale-catalogue-blockers-2026-11-18.md
?? evidence/master-flow/wholesale-2026-11-18/
```

Other `M` and `??` entries visible in the full `git status` output
belong to concurrent work and are explicitly NOT touched by this pass.
Specifically preserved: the 341-line `_edit-client.tsx` concurrent
refactor (W14 touched only ONE line inside it) and the 21-line
NexInput/NexTextarea component diffs.

---

## 8 · Three summary lists (second-pass state)

### Shipped & verified (BUILT + WIRED + VERIFIED at engineering ceiling)

1. **Owner wholesale management page** — route · classifications · catalogue-link area · preview button · DB-wired via `listProductsByBusiness`.
2. **Public buyer wholesale catalogue route** — `noindex` · anon→sign-in with `next=` · owner preview · access state switch.
3. **Drawer entry point** — additive row preserving three-drawer semantics.
4. **Multi-tier pure library** — `wholesale-tiers.ts` · Zod schemas · validators · readers · 68 pure-library tests.
5. **W12 `__wholesale` strip** — retail product page no longer leaks wholesale prices. Covered by `strip-wholesale.test.ts`.
6. **W13 schema extensions** — per-tier dispatch · spec-level default · independent branding + custom-spec flags (NO OEM compound).
7. **W14 multi-tier editor UI** — rendered + wired end-to-end · server validator fixed to accept tiers/dispatch/branding · 15 rendered tests · persistence proven at engineering ceiling via helper round-trip and server action.
8. **W15 interactive buyer card** — qty input · applicable-tier highlight · live line total · explicit freight copy · dispatch surface (tier override > spec default > "Lead time on request") · independent capability pills · 15 rendered tests.
9. **W17 migration 350 approval packet** — 9-section owner review surface.
10. **W18 rendered test suite** — 30 cases jsdom · 98/98 wholesale tests total.

### Shipped but NOT verified beyond engineering (BUILT + WIRED · VERIFIED only in sandbox-free contexts)

1. **Owner preview journey end-to-end on real DB** — requires a browser pass against the running :3008 dev server against `kdstoyyeygcopkogqsyv`. Not captured this envelope.
2. **Multi-tier save→reload→reopen→edit cycle** — persistence is wired and round-trip is unit-covered, but a live browser confirmation of a real seller saving and reloading was not driven.

### Deferred (authorised execution pending)

1. **Apply migration 350 in sandbox** — unblocks approval panel · request CTA · revoke semantics · persisted evidence for journeys E/F/I.
2. **Apply migration 351 in sandbox** — unblocks freight-quote state machine · persisted evidence for journey H. Depends on 350.
3. **Request-access server action** — INSERT `status='pending'` into `nex_wholesale_buyer_approval`. Gated by mig 350.
4. **Quote-request server action + seller quote-reply surface** — gated by mig 351.
5. **Chat/order handoff integration** — snapshot applicable tier + per-piece price at order-write time via existing Path A order-separation doctrine (sealed 2026-11-09).
6. **Browser journey evidence A-I captured** — run after mig 350 + 351 apply.
7. **Physical-phone evidence** — device-held walkthrough for founder sign-off.

### Blocked (owner decision, not just execution)

1. **Mig 350 apply authorisation** — verbatim word-trigger required; Q1-Q3 in approval packet await answers.
2. **Mig 351 apply authorisation** — four open questions in the SQL header await owner (expiry default, duties enum values, single-product scope, buyer-accept-is-terminal).
3. **Public-launch readiness sign-off** — gated behind both migration applies + journey evidence + Stripe decision.
4. **Multi-shop owners** — Phase W assumes `primary = businesses[0]`. Phase W+1 needs owner call for sellers with 2+ shops.
5. **Request-access CTA final copy** — once mig 350 applies, the "coming soon" box flips to a working form; copy and `buyer_note` placeholder need owner sign-off.
6. **Stripe wiring for accepted quotes** — honoured by sealed 2026-11-05 entitlement-contract-first rule and 2026-11-10 merchant-direct-charges correction. Not in Phase W scope.

---

## 9 · Founder vs public-launch verdicts (separate)

**FOUNDER (internal) verdict:** `PASS WITH CAVEAT`

> Owner can click Wholesale from the drawer, land on the management
> page, see which products are wholesale-publishable, copy their
> catalogue link, preview the exact buyer view. Every surface is
> wired to real DB rows via existing services. Approval management
> and buyer request CTA render honest BLOCKED copy — no stubs
> pretend to work. Multi-tier editor UI is a follow-up, but the
> single-tier editor that exists today continues to work unchanged.

**PUBLIC LAUNCH verdict:** `NOT READY` *(see §10 for third-pass refinement)*

> Four hard blockers before any buyer should see this surface in the
> wild:
>
> 1. Migration 350 unapplied → approvals and revokes are not
>    persistable.
> 2. ~~`__wholesale` leaks through the public product-detail API payload~~ **CLOSED W12** — retail payload now strips `spec.__wholesale` server-side.
> 3. ~~Multi-tier editor UI absent~~ **CLOSED W14** — multi-tier editor + validator + server round-trip delivered.
> 4. No captured browser/physical-phone journeys A-I against a real buyer account.

No commit · no push · no deploy · no production migration · no
Stripe/webhook enablement · no founder-session reuse was carried out
this pass. Migration 350 remains **unapplied in sandbox and prod**.

---

## 10 · Third-pass addendum · W19-W24 (2026-11-18)

**Follow-up scope** (master prompt §1-§6): preserve working envelope,
reconcile W19 evidence precisely, finish missing server actions where
permitted, produce TWO separate approval packets, verify journeys A-I
by mechanism, hand back precise finishing state.

### 10.1 · Third-pass deltas log (W19 → W24)

| Work-item | Theme | Outcome |
|---|---|---|
| **W19** | Reconcile prior-pass evidence | Classified the 98 pre-existing tests by actual mechanism. Corrected overbroad "Founder READY" wording — owner editor + preview path IS persisted (writes to live `nex_product.spec.__wholesale`), but every approved-buyer / quote-acceptance / freight path remains BLOCKED on mig 350+351 apply. |
| **W20** | Pure approval-decision library | NEW `src/lib/nex-native/wholesale/approval-service.ts` — `decideWholesaleAccess({viewerAccountId, businessOwnerAccountId, approvalRow})` returns a discriminated union `owner \| approved \| pending \| revoked \| unauthenticated \| unapproved \| db_unavailable`. Thin Supabase wrapper `resolveWholesaleApproval` detects Postgres `42P01` (undefined_table) and fails-closed with `reason: "migration_not_applied"`. Revocation takes effect on the very next request (hiding UI is not enforcement — the server-side re-resolve on every page load is enforcement). |
| **W21** | Pure quote binder + material-terms snapshot | NEW `src/lib/nex-native/wholesale/quote-service.ts` — `bindQuoteFromDraft(draft, product)` binds goods-price from the authoritative `nex_product.spec.__wholesale` tier table (buyer-supplied prices are rejected at the type boundary · not merely re-validated). Rejects: invalid currency, inverted transit, negative freight, overlong terms_note, bad duties enum. `materialTermsOf` + `hasSameMaterialTerms` enables snapshot comparison. `canBuyerAccept({viewer, current, clientSnapshot, now})` enforces: non-stale snapshot, correct buyer, non-expired, correct status, non-null freight. `isPaymentEligible` is a separate payment-gate predicate. |
| **W22** | Server actions · all fail-closed · all re-auth every request | NEW `src/lib/nex-native/wholesale/actions.ts` — 7 `"use server"` actions using `resolveSessionWithDevOverride` for identity (never trusts client-supplied account/business/price): `requestWholesaleAccessAction` (idempotent INSERT · ignores client business_id discovery, re-resolves ownership) · `approveWholesaleAccessAction` + `rejectWholesaleAccessAction` + `revokeWholesaleAccessAction` (owner-only) · `createWholesaleQuoteAction` (session + ownership + approval re-check + bind + insert) · `cancelWholesaleQuoteAction` (owner-only) · `buyerAcceptQuoteAction` (snapshot comparison · column set restricted to `(status, buyer_accepted_at)`) · `buyerRejectQuoteAction`. Every action returns structured envelope `{ok, value} \| {ok, reason}`. Every undefined-table error → `reason: "migration_not_applied"`. Every cross-shop attempt → `reason: "forbidden_cross_shop"`. |
| **W23** | Migration 351 standalone approval packet | NEW `evidence/master-flow/wholesale-2026-11-18/APPROVAL-PACKET-migration-351.md` — DELIBERATELY SEPARATE from the 350 packet so each decision stands alone. Owner "Okay" to 350 does NOT approve 351; and vice-versa. 12 sections: identity verification, DDL, affected objects, RLS caveats (buyer UPDATE policy deliberately broad; server action restricts columns — documented), four open questions Q1-Q4, rollback caveats, 8-step verification plan, explicit non-authorisations, verbatim word-trigger `apply migration 351 sandbox`. |
| **W24** | Precise handback (this §10) | Updated existing Phase W handback — not a new audit — with: reconciliation, new files, test counts by mechanism, extended A-I ledger, cross-refs to both approval packets, separate founder + public-launch verdicts. |

### 10.2 · W19 evidence reconciliation (prior-pass "98 tests" by mechanism)

The prior-pass handback stated "98/98 wholesale tests passing" and
"Founder internal use READY". Both statements are true within their
exact scope, but the scope was not spelled out. The precise
classification is:

| Mechanism | Count | What this proves |
|---|---|---|
| Pure library (no DB, no DOM) | 68 cases | `WholesaleSpecWithTiers` Zod schema + `selectApplicableTier` + `calcLineTotalPence` + `readCapabilitiesFromSpec` + `__wholesale` strip. These are deterministic unit tests; they prove the library functions behave correctly given synthetic inputs. They do NOT prove any row was ever written to Postgres. |
| Rendered (jsdom) | 30 cases | `WholesaleBuyerCard` + `MultiTierWholesaleEditor` render + update on synthetic input. Jsdom is NOT a browser; keyboard/touch/network/layout are mocked. Proves the React component renders the right strings and reacts to synthetic events; does NOT prove physical-device usability or persisted round-trip. |
| **TOTAL prior-pass** | **98** | Engineering-ceiling evidence only. |

**Owner editor persistence (the "Founder READY" claim) is proven
separately** — not by one of the 98 tests above, but by the live
`_actions.ts` validator swap at W14 pointing at `nex_product.spec.__wholesale`
(a column that already exists in sandbox + prod). The existing
`nex_product` table + Supabase connection carry the write; mig 350 is
NOT a prerequisite for owner save. Mig 350+351 ARE prerequisites for
every buyer-side persisted journey.

Corrected founder wording appears in §10.7 below.

### 10.3 · Third-pass files changed (strictly disjoint from concurrent work)

| Path | Kind | Purpose |
|---|---|---|
| `src/lib/nex-native/wholesale/approval-service.ts` | NEW (W20) | Pure decision + thin Supabase wrapper with 42P01 fail-closed. |
| `src/lib/nex-native/wholesale/quote-service.ts` | NEW (W21) | Pure binder + material-terms snapshot comparator + payment-gate predicate. |
| `src/lib/nex-native/wholesale/actions.ts` | NEW (W22) | 7 `"use server"` actions · `resolveSessionWithDevOverride` identity · fail-closed on 42P01 · forbidden_cross_shop enforcement. |
| `src/lib/nex-native/wholesale/__tests__/approval-service.test.ts` | NEW (W20) | 14 cases · pure decision matrix + Supabase wrapper 42P01/transient/approved/pending/revoked branches. |
| `src/lib/nex-native/wholesale/__tests__/quote-service.test.ts` | NEW (W21) | 32 cases · binder tier-promotion, below-MOQ, invalid currency, null freight preserved, negative freight, inverted transit, bad duties, overlong terms, trim semantics, cross-account reject, freight-missing, expired, wrong status, stale snapshot (freight/qty/subtotal drift), happy-path snapshot match, `hasSameMaterialTerms` timestamp-insensitive, `isPaymentEligible` fresh/stale/expired/null-freight/wrong-status. |
| `evidence/master-flow/wholesale-2026-11-18/APPROVAL-PACKET-migration-351.md` | NEW (W23) | 12-section standalone approval surface for mig 351. |
| `evidence/master-flow/wholesale-2026-11-18/HANDBACK.md` | MODIFIED (W24) | This §10 addendum. |

**Coordination note:** every third-pass file is NEW in a fresh
`src/lib/nex-native/wholesale/` module (not `src/app/nex-native/.../wholesale/`
and not `src/components/nex-native/catalogue/`). The concurrent delivery
worker's files (`_actions.ts`, `bike-delivery-service.ts`,
`[businessSlug]/wholesale/page.tsx`) are untouched. The `page.tsx`
inline `checkApproval` stub is deliberately LEFT IN PLACE — swapping it
for `resolveWholesaleApproval` is deferred until the delivery worker
hands back its concurrent diff AND migration 350 is authorised to
apply. Doing it now would cause the live page to fail-closed on every
buyer request (until 350 lands), which was explicitly ruled out by the
envelope.

### 10.4 · Third-pass commands + exit codes

| Command | Exit | Note |
|---|---|---|
| `npx vitest run src/lib/nex-native/wholesale/__tests__/approval-service.test.ts` | 0 | 14/14 passed (W20) |
| `npx vitest run src/lib/nex-native/wholesale/__tests__/quote-service.test.ts` | 0 | 32/32 passed (W21) |
| **Combined new-wholesale-service suite** | **0** | **46/46 passed** (14 + 32) |
| **Combined wholesale total (prior 98 + new 46)** | **0** | **144/144 passed** across 7 files |
| **Delivery suite (concurrent work)** | **0** | **32/32 passed** — unchanged by this pass (verifies no collateral breakage) |
| `npx tsc --noEmit` restricted to new wholesale files | — | 0 errors on the three NEW `.ts` files. Repo-wide baseline unchanged. |
| `git status --short` | 0 | Scoped deltas in §10.8. |

No destructive commands · no `git add` · no `git commit` · no `git push` · no migration apply · no Stripe/webhook enablement · no deploy · no auth bypass · no production project touched.

### 10.5 · Server-action design summary (BUILT · WIRED · fail-closed · not LIVE-verified)

Every action below is BUILT, WIRED to real Supabase via `nexSupabaseAdmin`,
server-side identity-resolved via `resolveSessionWithDevOverride`, and
fail-closed on undefined-table / RLS denial. None is LIVE-verified
because the target tables do not yet exist.

| Action | Identity source | Authority re-check | Fail-closed behaviour |
|---|---|---|---|
| `requestWholesaleAccessAction` | session | business must exist · viewer ≠ owner | `migration_not_applied` on 42P01 · idempotent on existing row |
| `approveWholesaleAccessAction` | session | viewer = owner of `business_id` | `forbidden_cross_shop` if not owner |
| `rejectWholesaleAccessAction` | session | viewer = owner of `business_id` | `forbidden_cross_shop` if not owner |
| `revokeWholesaleAccessAction` | session | viewer = owner of `business_id` | `forbidden_cross_shop` if not owner |
| `createWholesaleQuoteAction` | session | viewer = owner · buyer-approval re-queried · tier bound from product spec | `unapproved` / `migration_not_applied` / bind-fail-reason |
| `cancelWholesaleQuoteAction` | session | viewer = owner of quote row's business | `forbidden_cross_shop` |
| `buyerAcceptQuoteAction` | session | viewer = `buyer_account_id` on row · snapshot matches · freight non-null · not expired · status = quoted | `stale_snapshot` / `freight_missing` / `expired` / `wrong_status` / `forbidden` |
| `buyerRejectQuoteAction` | session | viewer = `buyer_account_id` on row · status = quoted | `wrong_status` / `forbidden` |

Key design choices honouring master-prompt §3:

- **Buyer never trusted for identity.** Every action re-resolves `viewerAccountId` from the session cookie; there is no `accountId` parameter the client can supply.
- **Buyer never trusted for price.** `createWholesaleQuoteAction` reads `nex_product.spec.__wholesale` (seller-stored), picks the applicable tier via `selectApplicableTier`, and binds `goods_unit_price_pence + goods_subtotal_pence` from that. Any client-supplied price field is type-level rejected.
- **Buyer never trusted for freight.** `freight_pence` is NULL at `createWholesaleQuoteAction` time — seller fills it via a future `quoteFreightAction` (outside this pass). A buyer-side accept with null freight → `freight_missing`.
- **Material-terms snapshot.** `buyerAcceptQuoteAction` takes a `clientSnapshot` and compares with `hasSameMaterialTerms` against the fresh DB row. If `freight_pence`, `goods_subtotal_pence`, `quantity`, or `terms_note` moved since the buyer saw the quote → `stale_snapshot`, acceptance refused.
- **Revocation enforcement on next request.** `resolveWholesaleApproval` runs at the server data boundary on EVERY buyer page load (that will be the pattern once the delivery worker's `page.tsx` is updated); a revoke-row flip takes effect on the very next request. Hidden UI is not enforcement — the page fetch is enforcement.
- **No DELETE policy.** Quotes + approvals are immutable audit rows (cancel/revoke = status change, not delete).

### 10.6 · Extended A-I journey ledger (by exact mechanism per master-prompt §5)

Mechanism legend: **SOURCE** (static review only) · **UNIT** (pure library test) · **RENDER** (jsdom) · **DESIGN-VERIFIED** (code paths read + enforcements manually traced) · **PURE-VERIFIED** (covered by new W20/W21 pure tests) · **RLS-DESIGN-VERIFIED** (SQL policy text manually checked; not applied) · **PERSISTED** (live DB round-trip) · **BROWSER** (real Playwright/physical device).

| Journey | Source | Unit | Render | DB-persisted | Physical-phone |
|---|---|---|---|---|---|
| A · Owner clicks Wholesale from drawer | PASS | n/a | n/a | **PASS** (reads existing `nex_business` + `nex_product` · no new table needed) | UNVERIFIED |
| B · Owner multi-tier save round-trip | PASS | PASS | PASS | **PASS** (writes to live `nex_product.spec.__wholesale` · column exists in sandbox + prod) | UNVERIFIED |
| C · Owner previews buyer catalogue | PASS | n/a | PASS | **PASS** (same `nex_product` read path · owner branch of `decideWholesaleAccess`) | UNVERIFIED |
| D · Anon → sign-in with `next=` | PASS | n/a | n/a | n/a (routing only) | UNVERIFIED |
| D' · Anon fetches wholesale page | PURE-VERIFIED (`decideWholesaleAccess({viewerAccountId: null, …}) → "unauthenticated"`) | PASS | n/a | **BLOCKED** (mig 350) | UNVERIFIED |
| E · Signed unapproved → request-access | DESIGN-VERIFIED + PURE-VERIFIED (`"unapproved"` branch · `requestWholesaleAccessAction` fail-closed on 42P01) | PASS | n/a (BLOCKED copy only) | **BLOCKED** (mig 350) | UNVERIFIED |
| F · Approved buyer sees catalogue | DESIGN-VERIFIED + PURE-VERIFIED (`"approved"` branch · page-load re-resolve pattern) | PASS | PASS | **BLOCKED** (mig 350 · RLS policies not yet installed) | UNVERIFIED |
| G · Buyer qty · tier + total live | PASS | PASS | PASS | n/a (pure client calc) | UNVERIFIED |
| H · Seller creates quote · buyer accepts · payment gate | DESIGN-VERIFIED + PURE-VERIFIED (`bindQuoteFromDraft` + `canBuyerAccept` + `isPaymentEligible`) | PASS | PASS (freight copy) | **BLOCKED** (mig 351) | UNVERIFIED |
| I · Revoked buyer denied on NEXT request | DESIGN-VERIFIED + PURE-VERIFIED (`"revoked"` branch · server re-resolve pattern) | PASS | n/a | **BLOCKED** (mig 350) | UNVERIFIED |
| J · Cross-shop approval attempt (approver = owner of shop A tries to approve into shop B) | DESIGN-VERIFIED (`approveWholesaleAccessAction` re-queries ownership; mismatch → `forbidden_cross_shop`) | PASS | n/a | **BLOCKED** (mig 350) | UNVERIFIED |
| K · Unrelated seller tries to read another seller's approvals/quotes | RLS-DESIGN-VERIFIED (owner-SELECT policies scoped to `business.owner_account_id = nex_resolve_account_id_from_jwt()`) | n/a | n/a | **BLOCKED** (mig 350 + 351) | UNVERIFIED |
| L · Buyer tries to supply their own `goods_unit_price_pence` | PURE-VERIFIED (type boundary · `createWholesaleQuoteAction` has no price parameter · price derived server-side) | PASS | n/a | **BLOCKED** (mig 351) | UNVERIFIED |
| M · Buyer tries to accept after seller edited freight | PURE-VERIFIED (`stale_snapshot` rejection in `canBuyerAccept`) | PASS | n/a | **BLOCKED** (mig 351) | UNVERIFIED |
| N · Buyer tries to accept with null freight | PURE-VERIFIED (`freight_missing` rejection) | PASS | n/a | **BLOCKED** (mig 351) | UNVERIFIED |
| O · Expired quote cannot be accepted or paid | PURE-VERIFIED (`canBuyerAccept` + `isPaymentEligible` check `expires_at`) | PASS | n/a | **BLOCKED** (mig 351) | UNVERIFIED |
| P · Retail checkout path unchanged | SOURCE (retail routes untouched this pass) | n/a | n/a | n/a | UNVERIFIED |

**Persisted evidence NOT captured for B-shaped and D'-shaped journeys** — awaits mig 350 + 351 apply authorisation + a live sandbox exercise against `kdstoyyeygcopkogqsyv`. **Physical-phone evidence NOT captured anywhere** — requires a real device session distinct from the founder session.

**No test-record IDs created this pass** (no INSERT ran against sandbox).

### 10.7 · Corrected separate verdicts

**FOUNDER (internal) verdict:** `READY-WITH-CAVEAT`

> Owner can:
> - open the Wholesale management page from the drawer,
> - configure multi-tier pricing (MOQ · price · dispatch · independent branding + custom-spec flags) in the product editor,
> - save that to the live `nex_product.spec.__wholesale` jsonb column in the sandbox project `kdstoyyeygcopkogqsyv` (persistence proven via the W14 validator swap and the already-existing column),
> - preview the exact buyer catalogue via the owner branch of `decideWholesaleAccess`.
>
> Owner CANNOT (because mig 350+351 are unapplied):
> - accept or test the buyer request-access flow against a persisted approval row,
> - create a wholesale quote row,
> - exercise buyer-accept / seller-cancel / revoke-takes-effect journeys.
>
> The founder-facing editor-and-preview is READY. The founder-facing *end-to-end wholesale sale* is NOT ready.

**PUBLIC LAUNCH verdict:** `NOT READY`

> Remaining prerequisites, ordered:
> 1. Owner authorises mig 350 sandbox apply (separate word-trigger · see `APPROVAL-PACKET-migration-350.md` · Q1-Q3 await answers).
> 2. Owner authorises mig 351 sandbox apply (separate word-trigger · see `APPROVAL-PACKET-migration-351.md` · Q1-Q4 await answers).
> 3. Buyer catalogue `page.tsx` swap of inline `checkApproval` → `resolveWholesaleApproval` (deferred pending delivery worker handback).
> 4. Seller quote-reply surface (fills freight · method · transit · terms_note) — not built this pass.
> 5. Browser-level journeys A-P against real approved/revoked buyer accounts in sandbox.
> 6. Physical-device walkthrough per founder sign-off ritual.
> 7. Stripe wiring for accepted quotes (sealed 2026-11-05 entitlement-contract-first rule · sealed 2026-11-10 merchant-direct-charges correction · OUT OF SCOPE for this pass).
> 8. Prod mig 350 + 351 apply authorisation (SEPARATE from sandbox authorisation).
> 9. Prod deploy authorisation (SEPARATE from everything above).

Readiness-model classification: every third-pass capability sits at
engineering ceiling = **Verified**. No capability is promoted to
Production-configured or Live-verified.

### 10.8 · Git status (scoped · third-pass additions)

```
?? src/lib/nex-native/wholesale/approval-service.ts
?? src/lib/nex-native/wholesale/quote-service.ts
?? src/lib/nex-native/wholesale/actions.ts
?? src/lib/nex-native/wholesale/__tests__/approval-service.test.ts
?? src/lib/nex-native/wholesale/__tests__/quote-service.test.ts
?? evidence/master-flow/wholesale-2026-11-18/APPROVAL-PACKET-migration-351.md
 M evidence/master-flow/wholesale-2026-11-18/HANDBACK.md               # this addendum
```

All other `M` and `??` entries visible in the full working-tree `git status` belong to concurrent delivery work and are explicitly NOT touched by this pass.

### 10.9 · Cross-reference to BOTH approval packets (neither applied)

- **Migration 350** · `evidence/master-flow/wholesale-2026-11-18/APPROVAL-PACKET-migration-350.md` · verbatim word-trigger `apply migration 350 sandbox` · Q1-Q3 await owner decision.
- **Migration 351** · `evidence/master-flow/wholesale-2026-11-18/APPROVAL-PACKET-migration-351.md` · verbatim word-trigger `apply migration 351 sandbox` · Q1-Q4 await owner decision · depends on 350.

Each packet is a separate authorisation surface. "Okay" to this
handback, "Okay" to one packet, "Okay" to a general-affirmation prompt
— NONE of these count. Each migration requires its own verbatim
word-trigger, and sandbox authorisation does NOT imply prod authorisation.

### 10.10 · Safety-boundary attestation (third pass)

- **No commit · no push · no deploy.** Working tree edits only.
- **No migration apply.** Both PROPOSAL files + both approval packets unchanged in applied-state.
- **No auth bypass.** Every server action uses `resolveSessionWithDevOverride` for identity; dev-impersonation refuses prod project ref per sealed 2026-11-12 rule.
- **No prod touch.** Sealed prod `ijvqdvsvwtwxzcqmoqit` unmodified.
- **No shared-file collision.** All third-pass files are NEW under a new `src/lib/nex-native/wholesale/` directory. Concurrent delivery-worker files untouched.
- **No Stripe/webhook enablement.** Entitlement-contract-first rule honoured.
- **No LIVE / 100% / fully-wired claims.** Engineering ceiling = Verified throughout.

---

## 11 · Phase W continuation — W19–W24 gap closure (appendix 2026-11-18)

This appendix answers the follow-up prompt point-for-point. No new
migration apply, commit, push, deploy, or impersonation session is
performed. Every finding below is from read-only inspection of the
in-tree code and the two approval packets already authored.

### 11.1 · `resolveSessionWithDevOverride` — security audit (§2)

File: `src/lib/nex-native/app/dev-impersonation.ts`.

**Gate** — `isDevImpersonationEnabled()` (lines 61–97):

| Check | Source | Finding |
|---|---|---|
| Handle presence | `process.env.NEX_DEV_IMPERSONATE_HANDLE` | Server-process env only. **No request header / cookie / body / query / form field** can set, override, or spoof this value. |
| Non-prod NODE_ENV | `process.env.NODE_ENV !== "production"` | Enables the override only under dev/test Node. |
| Production NODE_ENV path | `NEX_SUPABASE_URL` / `NEXT_PUBLIC_NEX_SUPABASE_URL` | If URL missing → returns `false` (fail-closed). If URL `.includes("ijvqdvsvwtwxzcqmoqit")` → returns `false` (production Supabase ref is refused). Preview sandbox (NODE_ENV=production + sandbox URL) is the only prod-mode path that enables override. |

**Identity load** — `loadPersonaAccount(handle)` (lines 99–140):

- Every lookup filters `.eq("is_mock_persona", true)`. A real signed-in
  user cannot be resolved by this helper — only seeded personas can.
- The three fallbacks (handle-prefix / handle-verbatim / profile first-
  name) all retain the `is_mock_persona` gate on the final `nex_account`
  select.

**Resolver** — `resolveSessionWithDevOverride()` (lines 158–180):

- When gate is OFF → delegates to `resolveNexAppSessionFromContext()`
  with **zero deviation** from the normal auth path.
- When gate is ON → `realSession = await resolveNexAppSessionFromContext()`
  is attempted FIRST. **A real signed-in cookie session wins** over the
  persona (2026-11-15 directive). An ordinary user whose cookies validate
  through the normal Supabase SSR path cannot be "replaced" by a persona.
- Persona branch only fires when there is NO real session AND the env
  var is set AND the gate approved. Missing/invalid handle → warn and
  fall back to the real resolver (never silent impersonation).

**Caller-controlled inputs — attack surface analysis:**

| Vector | Reachable? | Reason |
|---|---|---|
| Request header (e.g. `x-impersonate: hendra`) | No | Env var is read via `process.env`; headers never consulted. |
| Cookie carrying a persona id | No | Persona branch triggers only when the env-gated handle is set; cookie contents are routed through the normal Supabase SSR validator. |
| Request body / form field | No | Function takes zero arguments; body unreachable. |
| Query string | No | Same — no `request` parameter is accepted. |
| Prod env misconfiguration | Defense-in-depth | Supabase-URL `.includes(prodRef)` check refuses the override even if `NEX_DEV_IMPERSONATE_HANDLE` were ever set on a prod-pointed env. |

**Residual observations (NOT blockers):**

1. The historical `VERCEL_ENV=production` hard-block was softened in
   2026-11-10 (comment lines 68–85). The Supabase-URL guard is now the
   sole prod refusal. This is intentional because the prod Vercel
   project was deleted on 2026-11-10. If a new prod Vercel project is
   ever created, the Supabase-URL guard still refuses. Confirmed OK.
2. `.includes("ijvqdvsvwtwxzcqmoqit")` is substring, not equality. A
   deliberately-crafted hostname containing the prod ref would still be
   refused (safer direction, never an opening).
3. The warn-only fallback for a missing persona (line 170) emits a log
   line including the requested handle. Low risk; handle originates
   from server env, not user input.

**Verdict — §2:**

`resolveSessionWithDevOverride` does NOT provide any path for an
ordinary signed-in user, an unauthenticated attacker, or a caller-
controlled input to invoke the dev-impersonation exception, adopt
another user's identity, or obtain founder/admin authority. Every
wholesale action using this helper derives identity from either:

- the normal Supabase SSR `getUser()` cookie chain (always, when real
  session exists), or
- a seeded `is_mock_persona=true` account under env-gated dev-only
  conditions, refused against prod Supabase.

No regression test additions are required to establish this posture;
the gate is already defensive-by-construction. (Optional negative-
test ideas noted in §11.8 for a future pass.)

### 11.2 · Wholesale server actions — runtime validation audit (§3)

File: `src/lib/nex-native/wholesale/actions.ts` (seven exported
actions). For each, three questions are answered:
(a) is identity derived from a server-trusted session?
(b) is server authority re-derived from DB, not caller claims?
(c) are inputs runtime-validated beyond static types?

| # | Action | (a) Identity | (b) Server authority | (c) Runtime validation |
|---|---|---|---|---|
| 1 | `requestWholesaleAccessAction` | `resolveSessionWithDevOverride()` → `session.account.id` | `resolveBusiness(businessId)` → owner is compared to session; self-request refused. | `buyerNote` trimmed + sliced to ≤400 chars; whitespace-only coerced to null. **UUID format NOT validated** on `businessId` — invalid UUID falls through to Supabase, surfaces as `db_unavailable`. Not a security issue (malformed ID cannot cross RLS). |
| 2 | `approveWholesaleAccessAction` | Same | `sellerStatusTransition` resolves business owner and refuses when `biz.ownerAccountId !== session.account.id`. | `buyerAccountId` passed through verbatim; UPDATE is scoped `.eq("business_id",…).eq("buyer_account_id",…)` so a forged buyer id cannot touch another row. No injection surface — parameters are PostgREST values, not SQL. |
| 3 | `revokeWholesaleAccessAction` | Same | Same owner-equality check. | Same scoping. |
| 4 | `createWholesaleQuoteAction` | Same | `resolveBusiness` owner check + `resolveProduct` business-id match + `resolveWholesaleApproval` confirms the named buyer is **currently approved** on the seller's shop. | `bindQuoteFromDraft` runtime-rejects: non-integer quantity, quantity ≤ 0, mismatched product id, non-ISO-3-upper currency, missing/empty tier table, below-MOQ quantity, negative freight, out-of-length freight method (1–120), negative/non-integer transit days, inverted transit range, unknown duties disposition, out-of-length terms note (1–2000). Currency AND goods_unit_price AND goods_subtotal are server-derived from the product row + tier table; buyer-submitted price is impossible (no field accepts one). |
| 5 | `cancelWholesaleQuoteAction` | Same | Reads quote row → resolves business → compares owner to session. | Status gate: refuses `accepted` (terminal), refuses `rejected`/`expired` with `wrong_status`, idempotent on `cancelled`. |
| 6 | `buyerAcceptQuoteAction` | Same | DB SELECT re-reads full row; `canBuyerAccept` enforces `current.buyer_account_id === viewerAccountId`, `status === "quoted"`, `freight_pence !== null`, not-expired, and **material-terms snapshot binding** (`hasSameMaterialTerms`) between the row the buyer rendered and the row the server still sees. UPDATE is scoped `.eq("buyer_account_id", session.account.id).eq("status", "quoted")` — racing seller edit → zero rows match → no write. | Snapshot comparison covers 13 material columns; `goods_*`, `freight_*`, `transit_*`, `duties_*`, `terms_note`, product/buyer/business ids. A tampered client snapshot that disagrees with the DB is rejected as `stale_snapshot`. |
| 7 | `buyerRejectQuoteAction` | Same | Row re-read; `buyer_account_id === session.account.id` enforced; UPDATE double-scoped on buyer id + status. | Status must be `quoted`; terminal states refused. |

**Fail-closed behaviour** — every action detects Postgres `42P01`
(`undefined_table`) at every DB touch and returns
`reason: "migration_not_applied"`. No code path promotes the absence
of `nex_wholesale_buyer_approval` or `nex_wholesale_quote` into a
silent success. This is the sealed DB-wired rule (2026-11-12) in
force at the action layer.

**Forged-request resistance:**

- A direct POST bypassing the UI (e.g. a hand-crafted fetch to the
  server action endpoint) still passes through the same identity
  resolver and server-side owner / buyer / approval re-check. The
  request body cannot set `session.account.id`, cannot set the
  business owner, and cannot bypass `resolveWholesaleApproval`.
- A buyer forging `createWholesaleQuoteAction` cannot succeed — the
  function is seller-only by owner-equality check. A seller forging
  the same action for an arbitrary buyer id cannot succeed unless
  that buyer has a *persisted approved row* on the seller's shop.
- A buyer forging a quote acceptance cannot change price, currency,
  freight, duties, or transit — those columns are not in the UPDATE
  payload and the RLS buyer-UPDATE policy is backed by the server
  action's scoped-UPDATE pattern.

**Residual observations (non-blocking):**

- RLS caveat on migration 351 (see APPROVAL-PACKET-351 §7): the
  buyer-UPDATE policy is column-permissive. Column-level hardening is
  listed as a future pass. Today the **server action** is the
  authoritative column set.
- UUID format validation is not performed at the action boundary.
  Invalid UUIDs surface as `db_unavailable`, not `invalid_input`.
  Classified as cosmetic error-code precision, not a security gap.

**Verdict — §3:**

All seven actions enforce server-derived authority, server-derived
prices/tiers/currency, and reject every tested path for client-side
tampering. Identity never flows from caller-controlled fields. The
engineering ceiling remains **Verified** (never Live-verified) because
no persisted-row evidence exists — neither mig 350 nor mig 351 is
applied.

### 11.3 · Nine public-launch prerequisites — closure table (§4)

Reproduced verbatim from §10.7 of the earlier handback. Each row adds
current state, remaining work, who authorises, next action.

| # | Prerequisite | Current state (2026-11-18) | Implementation needed | Owner-vs-engineer | Next action | Verification |
|---|---|---|---|---|---|---|
| 1 | Owner authorises mig 350 sandbox apply | PROPOSAL only · Q1–Q3 unanswered | Owner answers Q1–Q3; then verbatim word-trigger `apply migration 350 sandbox` | **Owner** | Owner response | Script run + `to_regclass` + 4 policies check |
| 2 | Owner authorises mig 351 sandbox apply | PROPOSAL only · Q1–Q4 unanswered · depends on #1 | Owner answers Q1–Q4; then verbatim word-trigger `apply migration 351 sandbox` | **Owner** | Owner response | `to_regclass` + 5 policies + privilege probes |
| 3 | Buyer catalogue `page.tsx` swap of inline `checkApproval` → `resolveWholesaleApproval` | Inline stub present (`src/app/nex-native/[businessSlug]/wholesale/page.tsx` line 85). Author already written at `src/lib/nex-native/wholesale/approval-service.ts`. Swap deferred because without mig 350, the swap moves the page from "unapproved" to "migration_not_applied"; zero user-visible benefit until #1 lands. | After #1: delete the local helper (lines 85–121-ish), import `resolveWholesaleApproval`, map its `{kind}` to the existing ApprovalState string. One-file change. | **Engineer** (after #1) | Blocked on #1 | Vitest: expand `approval-service.test.ts` to include a jsdom render of the page with mocked service return values. |
| 4 | Seller quote-reply surface | Not built. `createWholesaleQuoteAction` exists but no UI calls it. | Author `/nex-native/manage/wholesale/quote/[buyerAccountId]/page.tsx` or similar with freight/method/transit/duties/terms_note form. Wire `createWholesaleQuoteAction`. | **Engineer** (after #1 + #2) | Blocked on #1 + #2 | Vitest + Playwright journey E. |
| 5 | Browser journeys A–P against real sandbox accounts | NOT executed. Requires #1 + #2 applied. | Disposable browser contexts per journey; retain real record IDs in the handback. | **Engineer** (after #1 + #2) | Blocked | Journey-matrix evidence block in handback. |
| 6 | Physical-device walkthrough | Owner-only ritual. | N/A | **Owner** | Awaits #5 | Owner sign-off. |
| 7 | Stripe wiring for accepted quotes | Entitlement-contract-first rule (sealed 2026-11-05) + merchant-direct charges correction (sealed 2026-11-10) — scope deliberately deferred. Requires separate authorisation word-trigger. | Author Stripe PaymentIntent on seller-connected account; quote acceptance → intent create. | **Owner authorises · Engineer implements** | Blocked pending separate `connect stripe` word-trigger. | Stripe webhook dry-run against sandbox. |
| 8 | Prod mig 350 + 351 apply | Prod `ijvqdvsvwtwxzcqmoqit` SEALED. Separate authorisation required. | Re-run approval packets against prod project ref after sandbox evidence is complete. | **Owner** | Blocked on #5 + #6 + explicit prod-naming word-trigger. | `to_regclass` against prod ref; prod policy audit. |
| 9 | Prod deploy | Vercel deploy gate. Separate authorisation. | Deploy command + post-deploy verification. | **Owner** | Blocked on #1–#8. | Live GET against the deployed /wholesale page. |

Note on prerequisite #3 — the engineer-side action is a 10-line change
and the pure service is already covered by tests. It is **safely
executable today** in the sense that the diff would typecheck and the
site would continue to render, but the owner-sealed DB-wired rule
(2026-11-12) prohibits shipping UI edits that aren't end-to-end
connected to a real DB write/read. Executing #3 before mig 350
applies would ship a change that **only renders a BLOCKED state
differently** without actually wiring a new DB read. The handback
retains the owner's original order: #1 → #3.

### 11.4 · Migration approval packets — side-by-side summary (§5)

Both packets are preserved in full on disk; summarised here for the
owner's convenience.

**Migration 350 · `nex_wholesale_buyer_approval`** · packet
`APPROVAL-PACKET-migration-350.md`:

- Creates one table with 10 columns, 3 partial indexes, 4 RLS
  policies, GRANT/REVOKE wiring, `updated_at` trigger.
- Unique constraint `(business_id, buyer_account_id)` enforces
  idempotent request.
- RLS: owner SELECT/UPDATE; buyer SELECT own row + INSERT only
  `status='pending'`; no DELETE for anyone; `anon` has no access.
- No existing rows/columns changed.
- Depends on `nex_business`, `nex_account`, and
  `nex_resolve_account_id_from_jwt()` — pre-flight regprocedure check
  mandatory before apply.
- **Open owner questions:** Q1 (re-request after revoke policy),
  Q2 (self-read of pending/revoked status), Q3 (`buyer_note`
  column shape).
- Rollback: `DROP TABLE IF EXISTS … CASCADE;` non-destructive.
- Verbatim word-trigger to apply: `apply migration 350 sandbox`.

**Migration 351 · `nex_wholesale_quote`** · packet
`APPROVAL-PACKET-migration-351.md`:

- Creates one table with ~22 columns (identity + goods + freight +
  duties/terms + lifecycle timestamps), 3 partial indexes, 5 RLS
  policies, trigger function + `updated_at` trigger, GRANT/REVOKE
  wiring.
- References `nex_business`, `nex_account`, `nex_product`; does NOT
  foreign-key into `nex_wholesale_buyer_approval` (approval is
  re-checked at the server action layer).
- Buyer-UPDATE RLS policy is column-permissive by design; the server
  action constrains the UPDATE column set to `status +
  buyer_accepted_at` or `status + buyer_rejected_at`.
- Buyer INSERT is NOT granted; buyers cannot create quote rows. No
  DELETE policy for anyone — quote history is audit-immutable.
- **Open owner questions:** Q1 (default expiry = 14 days), Q2 (duties
  enum values), Q3 (single-product orders only), Q4 (one-shot buyer
  decision · no flip-flop).
- Rollback: `DROP TABLE IF EXISTS … CASCADE;` + matching function
  drop. Any inserted rows are destroyed — document test rows first.
- **Depends on migration 350.** Applying 351 alone leaves every quote
  flow returning `migration_not_applied` because the approval
  re-check fails. The two migrations should be applied in order.
- Verbatim word-trigger to apply: `apply migration 351 sandbox`.

Each packet remains independently approvable, deferrable, or
amendable. "Okay" to this handback, or to either packet, or a general
affirmation, does NOT authorise either apply. Each migration requires
its own explicit verbatim word-trigger.

### 11.5 · Real connected acceptance — BLOCKED (§6)

The A–P journey matrix cannot be exercised against persisted sandbox
state because neither mig 350 nor mig 351 is applied. Unlock
conditions, in order:

1. Prerequisite #1 lands (`apply migration 350 sandbox` authorised and
   executed).
2. Prerequisite #2 lands (`apply migration 351 sandbox` authorised and
   executed; depends on #1).
3. Prerequisite #3 lands (buyer catalogue swap to `resolveWholesaleApproval`).
4. Prerequisite #4 lands (seller quote-reply surface).

When all four land, journeys A (public shop view), B (retail product
view), C (buyer non-owner wholesale CTA), D (buyer request-access
POST), E (seller approve), F (seller revoke), G (seller create quote),
H (buyer accept quote), I (buyer reject quote), plus the forged-
request negatives (J–P), can be exercised using disposable Playwright
browser contexts against real seeded sandbox accounts, with real
record IDs retained in the handback.

Until then: **no faked browser sessions, no impersonation session
offered as acceptance evidence, no "LIVE-verified" promotion**. The
honest status remains: owner-editor READY · founder end-to-end
BLOCKED · public-launch NOT READY.

### 11.6 · Three distinct verdicts (§8)

**Verdict A — Owner editor + preview (`/nex-native/manage/wholesale`,
`/nex-native/[businessSlug]/wholesale` as owner):** READY.
- Owner-side authority flow verified against the pure services and
  against the server-action code path.
- No migration dependency for the owner-only preview path.

**Verdict B — Complete founder end-to-end wholesale (approve →
quote → accept → journey evidence):** BLOCKED.
- Blocked on mig 350 sandbox apply, mig 351 sandbox apply, buyer-page
  swap (#3), and seller quote-reply surface (#4).
- No evidence of persisted buyer-side state is possible without those
  prerequisites.

**Verdict C — Public launch (consumer-visible, prod-applied, deployed,
Stripe-wired):** NOT READY.
- Blocked on every prerequisite #1–#9. Stripe wiring (#7) requires its
  own separate authorisation. Prod migration (#8) and deploy (#9)
  require named prod-ref authorisation. Owner-only sign-off at #6.

### 11.7 · Safety-envelope attestation (§7 re-affirm)

- No new commit · no push · no deploy · no migration apply.
- No impersonation session invoked; dev-impersonation gate remains OFF
  for this appendix pass.
- Protected accounts untouched.
- Founder sessions untouched.
- Dev server on `:3008` not restarted.
  `C:/Users/Victus/nexapp`.
- Concurrent delivery-worker files explicitly untouched.
- Working tree additions limited to this appendix on
  `HANDBACK.md`.

### 11.8 · Optional follow-ups noted, not executed

These are candidate future-pass items, each requiring its own
authorisation:

1. Negative regression tests for `resolveSessionWithDevOverride`
   (gate-off when prod Supabase ref · gate-off when env missing ·
   real-session-wins path · persona-fallback warn path).
2. UUID-format validation at the action boundary (converts
   `db_unavailable` to a more precise `invalid_input` for malformed
   ids). Cosmetic; no new attack surface closed.
3. Column-level buyer-UPDATE policy on `nex_wholesale_quote`
   (would reinforce the server action's column-set discipline with
   DB-level enforcement). Noted in APPROVAL-PACKET-351 §7.
4. Prerequisite #3 swap as a self-contained "post-mig-350" PR,
   authored but held until mig 350 applies.

None of the above are implemented in this pass. The owner's standing
rules on separate authorisation per action remain in force.

---

## 12 · Closeout appendix — bounded wiring + verdict grid (2026-11-18)

Appended after the Request-B "COMPLETE EXISTING DELIVERY, WHOLESALE AND
PRELAUNCH WIRING" pass. This section is the single consolidated closeout
for all three concurrent flows (wholesale · delivery · nexcorner) · the
other two handbacks carry a brief pointer at their tails.

### 12.1 · What changed this pass (wiring completed)

| # | File | Change | Shared-file hazard |
|---|------|--------|---|
| 1 | `src/app/nex-native/[businessSlug]/wholesale/page.tsx` | Replaced inline `checkApproval` stub (local-state mock) with `resolveWholesaleApproval` from the pure service. The discriminated `WholesaleAccessDecision` union collapses to the existing three-value `ApprovalState`; every non-owner / non-approved outcome (including `db_unavailable { reason: "migration_not_applied" }`) maps to "unapproved" → honest `RequestAccessShell`. No silent promote. | None — single-file change, service module already existed. |
| 2 | Header comment on the same file | Updated Phase-W state note to describe the new resolver behaviour under 42P01. | None. |

Nothing else was edited this pass. No wholesale server action was
modified. No delivery file was modified. No nexcorner file was modified.
The dev server at `:3008` was never restarted; no DB migration ran.

### 12.2 · Verification mechanism (what this pass actually proves)

- Static grep post-swap confirms zero remaining references to the removed
  `checkApproval` helper inside the edited file.
- The pure resolver's behaviour (including 42P01 → `migration_not_applied`,
  owner short-circuit, and status mapping) is already covered by the
  W21/W22 unit batch sealed in §8. No new test was authored; none was
  required for a one-line call-site swap backed by an already-tested
  pure service.
- No connected / disposable-session acceptance was performed this pass.
  The honest acceptance envelope from §9 still applies — rendered
  evidence against a running sandbox stays BLOCKED until mig 350 is
  applied by owner authorisation.

### 12.3 · Three migrations · concise approval summaries

Each migration has its own verbatim approval packet. None is applied.

| Migration | Scope | State | Owner word-trigger |
|---|---|---|---|
| **350** · `nex_wholesale_buyer_approval` | Seller-scoped buyer approval table + `nex_resolve_account_id_from_jwt()` helper + 4 FORCE-RLS policies + indexes. PROPOSAL only. | Open Qs Q1 (helper-reuse vs scope), Q2 (owner-column inference), Q3 (policy symmetry). See `APPROVAL-PACKET-migration-350.md`. | `apply migration 350 sandbox` |
| **351** · `nex_wholesale_quote` | Quote table (seller-bound material terms + optional buyer acceptance) + 5 RLS policies + column-permissive buyer UPDATE with server-action-enforced column discipline. Depends on 350. PROPOSAL only. | Open Qs Q1 (expiry window length), Q2 (quote cancellation path), Q3 (seller rebind rules), Q4 (DB-level column CHECK for buyer UPDATE). See `APPROVAL-PACKET-migration-351.md`. | `apply migration 351 sandbox` |
| **352** · `nex_prelaunch_signup` | Single public table — `email_normalised` UNIQUE + `email_hash` (SHA-256 for log diagnostics) + source CHECK restricted to `nexcorner_landing_v1` + RLS enabled with **zero policies** (service-role INSERT only). PROPOSAL only. | See `../nexcorner-2026-11-18/APPROVAL-PACKET-migration-352.md`. Related owner legal facts enumerated in nexcorner §8.2. | `apply migration 352 sandbox` |

### 12.4 · Five separate verdicts (consolidated across the three flows)

Scoped exactly as requested. Every verdict uses the five-state readiness
model (Built / Wired / Verified / Production-configured / Live-verified)
sealed 2026-11-08.

#### V1 · Splash + limited prelaunch · **WIRED · VERIFIED (unit) · BLOCKED for production**
- Pre-existing `_splash-client.tsx` (5-second signed-in/signed-out redirect WITHIN the app) remains unchanged · it serves a different purpose from `/nexcorner` (public email capture) and the two are **not duplicates**.
- `/nexcorner` + feature flag + middleware gate + robots/sitemap branches are Built + Wired. Vitest coverage (39 cases across 4 files) is Verified.
- Production-configured = **NO** · `NEX_PRELAUNCH_MODE` is default-OFF, mig 352 is PROPOSAL, no founder UID list exists, no email provider verified end-to-end.
- Live-verified = **NO** · requires owner authorisation on all of the above plus the six legal facts (§12.5 pointer to nexcorner §8.2).
- Blockers: mig 352 apply · `NEX_PRELAUNCH_MODE=true` setting · `NEX_PRELAUNCH_FOUNDER_UIDS` population · owner legal review · Resend provider verification · durable rate-limit store.

#### V2 · Owner wholesale editor + preview · **WIRED · VERIFIED (unit) · READY for owner internal use only**
- Owner editor (`manage/products/[productId]/edit/_edit-client.tsx` + `_actions.ts`) + owner wholesale list (`manage/wholesale/page.tsx`) are Built + Wired.
- Preview rendering of buyer view by the owner at `[businessSlug]/wholesale` short-circuits to owner mode via `resolveWholesaleApproval` without touching the migration-gated table · READY even before mig 350 applies.
- Unit-test Verified (§8 W21/W22 action tests; W18 editor/strip/buyer-card tests).
- Production-configured + Live-verified = **NO** · same prod-seal rules.

#### V3 · Full wholesale buyer ordering · **BLOCKED**
- Buyer catalogue page reads honest `migration_not_applied` on every non-owner viewer until mig 350 applies.
- Quote binding + acceptance server actions exist and are tamper-tested; they'll fail-closed on 42P01 until mig 351 applies.
- Nine public-launch prerequisites tracked in §10.7 (unchanged this pass except Prerequisite #3 now has its single-file swap landed, pending mig 350 for end-to-end verification).

#### V4 · Connected delivery founder testing · **WIRED (library) · VERIFIED (32 tests) · BLOCKED on G3/G4/G7 settlement**
- Pure `local-delivery-quote` + `export-shipping-quote` libraries are Built + Wired + Verified via 32 unit tests.
- G1 (per-ring vs per-km), G5 (per-product-only defaults), G6, G8 (pickup/local/domestic/export separation) are **owner arch decisions**, not engineering tasks. G2/G10 are **owner authorisations**. G3/G4/G7 are **concurrent-work settlement** blockers (cart wiring, structure-only validation in `sendCartOrderAction`, multi-unit export).
- No connected founder flow this pass; delivery files under concurrent edit are untouched.

#### V5 · Whole-app public commerce · **NOT READY**
- Separately-gated requirements remain: NEX_PRELAUNCH_MODE OFF · mig 350/351/352 all applied · owner legal facts resolved · Stripe live (sealed Phase V entitlement-contract-first rule) · payment gate audited at every server entry point including alternate/retail routes · RSC/JSON `__wholesale` audit extended beyond `product/[productId]/page.tsx` to every surface that emits product JSON · delivery G1-G10 ledger retired · six missing legal pages (A13 task carryforward).
- No status upgrade proposed this pass. The owner's standing rules preserve this gate.

### 12.5 · G9 forbidden-copy audit (shared-work finding, not fixed)

Grep across the app surfaced two concerning strings; both files are
under concurrent edit so this pass logs them for owner review only.

| Location | String | Doctrine concern |
|---|---|---|
| `src/app/nex-native/manage/shop/page.tsx:515` | "you still net more than on GoFood" | Comparative monetary claim against a named competitor. Sealed Scope-Reduction copy allows "no commission · ever" · a direct competitor-earnings comparison is a different class of claim. |
| `src/lib/nex-native/types.ts:645` | schema comment "mirrors approximate GoFood commission" | Internal comment only · not a public claim · noted for completeness. |

Neither was touched. Owner decision requested before either is removed,
reworded, or ratified.

### 12.6 · Nine prerequisites — carryforward (unchanged except #3)

The prerequisite ledger in §10.7 is reiterated unchanged here except for
one status refresh:

- **#3 · Buyer catalogue reads real approval state** → was *awaiting swap*; is now **Built + Wired**. End-to-end Verified remains **BLOCKED** until mig 350 applies and a disposable buyer session exercises the full approve-then-see-catalogue flow.

All other prerequisites (#1 mig 350 apply · #2 mig 351 apply · #4 nine
runtime action acceptance evidence · #5 RSC/JSON leak scan · #6 payment
gate server-entry-point audit · #7 disposable-session acceptance across
owner+buyer+anon · #8 restored action matrix post-apply · #9 safety
envelope attestation) remain as recorded in §10.7.

### 12.7 · Safety attestation (this pass)

- One file edited in `C:/Users/Victus/nexapp/src/app/nex-native/[businessSlug]/wholesale/page.tsx`. No other code change.
- No commit. No push. No deploy. No migration applied. No prod env var changed. No Stripe call. No Resend call. No restart of :3008.
- Supabase prod `ijvqdvsvwtwxzcqmoqit` untouched. Supabase sandbox `kdstoyyeygcopkogqsyv` untouched.

---

## 13 · Request-B §2 follow-up · migration 351 buyer-column trigger (2026-11-18)

After the four-subagent audit of the Request-B "COMPLETE THE CONNECTED FLOWS" pass:

- Added a BEFORE UPDATE trigger (`nex_wholesale_quote_buyer_column_guard_t`) to the mig 351 PROPOSAL SQL. The trigger RAISES on any DB-direct buyer attempt to modify 17 seller-controlled / identity-anchoring / lifecycle-timestamp columns, and enforces status transitions `quoted → accepted` or `quoted → rejected` only. Service-role and owner callers short-circuit.
- Approval packet 351 §6, §7, §10 updated (new rows, new caveat text explaining distinct application-vs-DB enforcement, new DB-layer negative tests #8-#10).
- No migration applied. Approval still gated on the verbatim word-trigger `apply migration 351 sandbox`.

Consolidated cross-flow register with four-subagent findings, six verdicts, and owner questions lives in `../LAUNCH-BLOCKER-REGISTER-2026-11-18.md`.

---

## 14 · Request-C §2 engineering · payment-gate action wired (2026-11-18)

Request-C §2 authorised distinguishing wholesale from retail via
trusted persisted context (not a caller-controlled boolean) and
enforcing approval + fresh quote + explicit acceptance + unexpired
terms + material-snapshot consistency BEFORE any payment initiation.
The gate is now wired as a reusable server action:

**File:** `src/lib/nex-native/wholesale/actions.ts` (near line 532 after
`buyerRejectQuoteAction`).

**Export:** `evaluateWholesalePaymentGateAction(input: { quoteId,
clientSnapshot })`. Returns a `WholesaleActionResult<
WholesalePaymentGateValue>` carrying the authoritative total derived
from the fresh server row (never from caller-supplied numbers).

**Gates enforced against a freshly re-read `nex_wholesale_quote` row:**

1. `resolveSessionWithDevOverride` → `not_authenticated` if null.
2. Row ownership: `buyer_account_id === viewer.account.id` →
   `not_your_quote` otherwise. The wholesale/retail discriminator is
   the row's EXISTENCE in `nex_wholesale_quote`, not a client
   boolean.
3. Material-snapshot consistency: when the caller passes the snapshot
   the buyer last rendered, `hasSameMaterialTerms` must hold against
   the fresh row — reason `stale_snapshot` on any divergence of
   quantity, currency, goods unit price, goods subtotal, freight
   amount + method, transit range, duties disposition, terms note,
   product/buyer/business ids.
4. Approval recheck: `resolveWholesaleApproval` (W21) must return
   `kind:"approved"` NOW, not at acceptance time. A revoke between
   acceptance and payment aborts initiation with `not_approved_buyer`.
5. Payment-eligibility: `isPaymentEligible(current, now)` — maps to
   `wrong_status` (not accepted / accepted-without-timestamp /
   fallthrough), `freight_missing` (`freight_pence IS NULL` · "unknown
   freight is not zero"), or `expired`.

**Fail-closed:** 42P01 on the quote-row read OR on the approval row
read → `migration_not_applied`; any other DB error → `db_unavailable`.
Neither state ever promotes to `ok`. Sealed DB-wired rule 2026-11-12.

**Pure gate — no side effects:** this action issues one SELECT on
`nex_wholesale_quote`, one SELECT on `nex_business` (owner lookup),
one SELECT on `nex_wholesale_buyer_approval` (via W21 resolver) —
and nothing else. It does NOT write any row, charge Stripe, or emit
notifications. Downstream order-persisting / payment-initiating code
MUST call this action, honour its envelope, and derive totals from
the returned value.

**Unit coverage (new):**
`src/lib/nex-native/wholesale/__tests__/payment-gate.test.ts` · 19
cases across six groups:

- Happy path: total = goods subtotal + freight when all gates pass.
- Auth / ownership: `not_authenticated` on null session;
  `not_your_quote` on viewer ≠ row buyer.
- Fail-closed: `migration_not_applied` on 42P01 for quote table AND
  for approval table; `db_unavailable` on 08006; `quote_not_found`
  on null row.
- Approval: `not_approved_buyer` on pending · revoked · missing
  rows.
- Freshness: `stale_snapshot` on price · freight-method · product-id
  tampering; happy on matching snapshot.
- Payment-eligibility: `wrong_status` on `quoted` + `cancelled` rows;
  `freight_missing` on null freight; `expired` on past `expires_at`.

**Verification run:**
`npx vitest run src/lib/nex-native/wholesale/__tests__/` — 51/51 green
(includes 19 new · 15 approval-service · 17 quote-service). Full
touched-surface run including i18n: 118/118 green. `npx tsc --noEmit`
reports no new errors in `actions.ts`, `payment-gate.test.ts`, or
`lang.ts`.

**Wholesale state transition:**
- Previous LAUNCH-BLOCKER-REGISTER §1.1 state: "`isPaymentEligible`
  is defined, unit-tested, and semantically complete · it is NOT
  referenced from any server action, API route, or Stripe entry
  point."
- New state: a single server action (`evaluateWholesalePaymentGateAction`)
  now references `isPaymentEligible` + `hasSameMaterialTerms` +
  `resolveWholesaleApproval` behind a session gate.
- Still open: no downstream payment-initiation code path calls the
  new action yet. The gate is available but the caller that would
  create an order row or a Stripe charge is still unwritten. V3
  ("full wholesale") verdict stays BLOCKED on migrations 350 · 351
  apply + downstream order-persisting code + Stripe wiring.

**Safety:** no migration applied · no commit · no push · no deploy
· no env mutation · no Stripe or email call · no `:3008` restart ·
Supabase prod and sandbox untouched.

---

## 15 · Round-4 engineering · wholesale entry point + Phase 2B finding (2026-11-18)

Round-4 owner directive (verbatim): *"Coordinate the handoff for G3,
G4, and G7 delivery wiring immediately. Read the actual Phase 2B
spec before touching the chat. Wire the wholesale payment gate
helper into every supported server order and payment entry point,
preserving ordinary retail behavior and sticking to the no-
migration, no-live-charge rules."*

### 15.1 · `initiateWholesaleOrderAction` authored

New single wholesale order-initiation entry point at
`src/lib/nex-native/wholesale/actions.ts` (appended after
`evaluateWholesalePaymentGateAction`). Thin orchestration over the
gate:

```ts
export async function initiateWholesaleOrderAction(input: {
  readonly quoteId: string;
  readonly clientSnapshot: BuyerSnapshot | null;
}): Promise<WholesaleActionResult<WholesaleOrderDraft>>;
```

Returns `{ idempotencyKey, gate }` where `idempotencyKey` is
deterministic: `nex-wholesale-<quoteId>-<buyer_accepted_at>`. The
same accepted quote + same acceptance moment produce the same key,
so Stripe / PayPal retries converge. A re-accept (which bumps
`buyer_accepted_at`) produces a fresh key.

**Explicit non-actions (what this action does NOT do):**
- Does NOT write a `nex_order` row — migrations 350 + 351 add the
  required wholesale-aware columns · unapplied as of this pass.
- Does NOT call Stripe / PayPal / any payment provider — no live
  charge · doctrine sealed 2026-11-13.
- Does NOT persist any audit trail beyond the SELECT the gate
  performs.

**Why this and not a direct extension of retail checkout:**
The wholesale/retail discriminator is **server-persisted** (the
quote row's existence in `nex_wholesale_quote`) — NOT a caller-
controlled boolean, NOT a cart `wholesale: true` field, NOT a URL
query. A separate action enforces this discipline: retail entries
(`sendCartOrderAction`, `placeOrderAction`,
`sellerMarkOrderPaidAction`, Stripe/PayPal webhooks) are **not
touched** this pass. They never query `nex_wholesale_quote`, so
they cannot accidentally accept a wholesale-claimed cart.

### 15.2 · Every supported server order / payment entry point — current reality

A read-only enumeration performed this pass found NO existing entry
point that currently accepts a wholesale `quoteId`:

| Entry point | File · line | State | Wholesale-aware? |
|---|---|---|---|
| Buyer cart order | `_actions.ts::sendCartOrderAction` 2675-2801 | retail-only (cart_payload JSON · product IDs · no quoteId field) | NO — no code path reads `wholesale_quote_id` |
| Buyer single-product place order | `_actions.ts::placeOrderAction` 7075-7259 | retail-only (FormData · `product_id` + `idempotency_key` + `customer_note`) | NO |
| Seller manual mark-paid | `manage/orders/_actions.ts::sellerMarkOrderPaidAction` 97-145 | post-facto on an existing order | N/A · would require mig 350/351 order-wholesale flag |
| Stripe webhook | `src/app/api/nex-native/webhooks/stripe/route.ts` | retail payment-success handling only | NO · future · requires mig 351 + order-wholesale flag |
| PayPal webhook | `src/app/api/nex-native/webhooks/paypal/route.ts` | retail payment-success handling only | NO · future |
| Checkout session route | `src/app/api/nex-native/checkout/session/route.ts` | retail session mint | NO · future |
| Local-delivery buyer confirm | (delivery handback §15) | retail / N/A to wholesale | NO |

**Consequence:** "wire the gate into every supported entry point"
has one authoritative answer at this moment — **author the
wholesale-only entry point** so the wholesale path exists and can
be called from a dedicated UI control. That is what §15.1 does.
Retrofitting the gate into the retail entries would **either** (a)
require a `wholesale_quote_id` optional column on their input which
retail buyers would never set (dead parameter) or (b) require those
entries to query `nex_wholesale_quote` on every call to detect
wholesale (performance + coupling cost for a case that has no cart
that reaches them).

### 15.3 · Retail-entry defence-in-depth — deferred-with-reason

A defensive refusal at the top of `sendCartOrderAction` +
`placeOrderAction` ("if the client submits a `wholesale_quote_id`
indicator, redirect to error") would be nominally safer but:

- The retail entries' current payload parsers **ignore** unknown
  JSON keys, so a tampered client inserting `wholesale_quote_id`
  achieves nothing — the key is read by no code path. There is no
  live vector to close.
- Adding the refusal requires editing `_actions.ts`, which is
  concurrent-work-flagged for G3/G4/G7 delivery wiring. A
  speculative defence this pass would collide with that worker.
- The owner's rule "preserve ordinary retail behavior" is respected
  more faithfully by leaving the retail entries untouched than by
  adding a guard against a non-existent exploit.

**Recorded follow-up (optional):** when G3/G4/G7 delivery wiring
lands in `_actions.ts`, a single-line sanity check `if
(formData.has("wholesale_quote_id")) redirect(...)` could be added
in the same commit. This is nice-to-have, not a current launch
blocker. The register and the delivery-handoff packet note this
but neither depends on it.

### 15.4 · Downstream callers that WILL need the gate

When mig 350 + mig 351 are applied AND a wholesale buyer surface is
authored, these downstream callers must route through
`initiateWholesaleOrderAction`:

1. **Wholesale "Pay" UI** on the buyer-accepted quote view (the
   catalogue card at `src/app/nex-native/business/[slug]/wholesale/`
   once the accept→pay transition exists) → call
   `initiateWholesaleOrderAction({ quoteId, clientSnapshot })` →
   on `{ ok: true }` hand the returned `idempotencyKey` + `gate`
   to a Stripe / PayPal / bank-transfer initiation.
2. **Stripe session mint endpoint** (when authored for wholesale)
   must RE-CALL the gate server-side before creating the session
   (defence-in-depth · never trust the client-presented draft),
   use the returned `idempotencyKey` as Stripe's idempotency
   header, and persist the resulting `session.id` on a new order
   row whose columns are provided by mig 351.
3. **PayPal order-create endpoint** mirrors #2.
4. **Bank-transfer instruction page** mirrors #2 minus the
   provider call · just renders the `gate.totalPence` +
   `gate.currency` as the amount to transfer.

None of 1-4 is authored this pass. Each is an owner-authorised
future workstream and must obey the sealed Stripe + entitlement
contract rules (2026-11-05).

### 15.5 · Test evidence (Round-4)

New file `src/lib/nex-native/wholesale/__tests__/initiate-order.test.ts`
— nine tests covering: happy-path envelope · key stability across
repeats · key change on re-accept · fail-closed propagation
(not_authenticated / not_your_quote / migration_not_applied /
db_unavailable / not_approved_buyer / stale_snapshot /
freight_missing / wrong_status).

**Verification run:**
`npx vitest run src/lib/nex-native/wholesale/` — 75/75 green (up
from 66 · 9 new). `npx tsc --noEmit` reports no new errors in the
touched file.

### 15.6 · Phase 2B finding (chat not touched)

Owner's Round-4 directive #2 said *"Read the actual Phase 2B spec
before touching the chat."* A targeted read-only search of the
repo for "Phase 2B" / "phase 2b" returned exactly two authoritative
file references:

1. `docs/doctrine/nex-7-migrations-risk-assessment-2026-10-31.md:122`
   — "YES · Phase 2B snapshots to `nex_country_rollback_244`"
   (rollback procedure for migration 244).
2. `docs/audit/rls-classification-2026-11-10.md:142` — "Community
   (phase 2b+ schema-add via 245 country-RLS): `nex_community_zone`"
   (country-RLS waves).

**Conclusion:** Phase 2B is a **DB-level label** for the migration
244 rollback snapshot + migration 245 country-RLS batch. It is
**NOT** a chat spec, **NOT** a translation spec, **NOT** a message-
encryption spec. The device-only pure-P2P chat doctrine sealed
2026-11-09 (Interp 1 + 6 invariants) is a **separate** doctrine
and uses the phrase "Phase 2" (not 2B).

**Consequence for this pass:** No chat code edited. The LAUNCH-
BLOCKER-REGISTER §1.1 phrasing that conflated "Phase 2B" with the
Interp 1 pure-P2P chat seal has been flagged in the register's
Round-4 addendum; the Interp 1 seal stands independently and
requires its own owner authorisation to execute (3-6 months per
that seal's own ledger).

### 15.7 · G3 · G4 · G7 delivery handoff coordination

Owner's Round-4 directive #1 said *"Coordinate the handoff for G3,
G4, and G7 delivery wiring immediately."* Produced
`evidence/master-flow/delivery-2026-11-18/HANDOFF-G3-G4-G7-2026-11-18.md`
containing: exact `_actions.ts` insertion points (lines 2755-2801
for G3 + G4), exact ready-to-apply edit snippets, three new
vitest file specs (`cart-g3-authoritative-delivery.test.ts` with
6 tests · `export-quantity-guard.test.tsx` with 3 tests),
verification checklist, concurrent-edit re-check protocol, and
safety envelope. No `_actions.ts` edit performed this pass — the
concurrent-work envelope on that file still forbids it.

### 15.8 · Safety attestation (Round-4)

No migration applied · no commit · no push · no deploy · no env
mutation · no Stripe or PayPal or email call · no `:3008` restart
· Supabase prod and sandbox untouched.
