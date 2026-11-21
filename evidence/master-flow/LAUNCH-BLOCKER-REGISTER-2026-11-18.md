# Launch-Blocker Register · 2026-11-18

**Scope:** consolidated register across the three concurrent flows
(wholesale · delivery · nexcorner) + the core retail/account paths, as
produced by the Request-B "COMPLETE THE CONNECTED FLOWS / USE AVAILABLE
SUBAGENTS" pass. Replaces no prior ledger; those stand. This file
reconciles current engineering state vs. what is actually required for
each class of launch. Six distinct verdicts are stated below.

Produced by:
- Four parallel read-only Explore subagents (payment-gate trace ·
  `__wholesale` leak scan · G9 forbidden-copy locate · core
  evidence reconciliation).
- One main-thread engineering change — migration 351 PROPOSAL buyer
  column-guard trigger added (unapplied).

**No commit · push · deploy · migration · live charge · env mutation
· `:3008` restart was performed this pass.**

---

## Addendum · Request-C engineering increments (same session, 2026-11-18)

Three authorised engineering changes landed on top of this register,
all additive and all behind unapplied migrations / explicit feature
precedence. No prior row above is invalidated.

1. **G9 forbidden copy removed** — `src/app/nex-native/manage/shop/page.tsx:515`
   now reads *"More orders → bigger discount for buyers · NEX charges
   no sales commission on direct orders"*. The prior "you still net
   more than on GoFood" comparative claim is gone. The new copy is
   evidence-backed by the sealed 0%-commission doctrine (scope
   reduction 2026-11-06) and invents no courier rate or savings
   guarantee. Delivery G9 clears; delivery G1/G2/G3/G4/G7/G10 remain
   open as recorded in §3 below.
2. **Wholesale payment gate wired** — new
   `evaluateWholesalePaymentGateAction` added to
   `src/lib/nex-native/wholesale/actions.ts`. Enforces, server-side,
   against a freshly re-read quote row: (a) authenticated session,
   (b) `buyer_account_id = viewer` ownership — the wholesale/retail
   discriminator is the row's existence in `nex_wholesale_quote`,
   not a caller boolean, (c) approval still active via
   `resolveWholesaleApproval`, (d) `isPaymentEligible` (status=
   accepted + non-null `buyer_accepted_at` + freight known + not
   expired), (e) material-snapshot consistency via
   `hasSameMaterialTerms`. Fail-closed on 42P01 to
   `migration_not_applied`. 19 unit tests at
   `src/lib/nex-native/wholesale/__tests__/payment-gate.test.ts`
   cover happy path · auth · ownership · fail-closed (table-missing
   + transient) · approval (pending/revoked/missing) · freshness
   (price/method/product-id tamper) · payment-eligibility (quoted /
   freight-missing / expired / cancelled). Previous §1.1 state
   "WIRED-AS-SPEC, UNWIRED-INTO-PAYMENT" **flips to WIRED-AS-SPEC +
   GATE-AVAILABLE**. The downstream payment-initiation code path
   that calls this gate is still unwritten — any Stripe or order-
   row creation must now go through this action; the register still
   records that as open until the dependent code lands.
3. **Localization foundation extended** — `narrowBrowserPreference`
   + new precedence slot in `resolveClientLang()` at
   `src/lib/nex/i18n/lang.ts`. Order is now URL `?lang=` →
   `localStorage.nex_user_lang` → `navigator.languages[]` /
   `navigator.language` primary subtag → `DEFAULT_LANG` (`"id"`).
   Country remains decoupled from language per 2026-10-07 seal;
   this adds no DB change, no translation-pack change, and no new
   locale (Malay `"ms"` stays absent per the Explore agent's
   inventory). Seven new tests on
   `src/lib/nex/i18n/i18n.test.ts` cover: empty URL + empty
   localStorage → navigator match · unsupported navigator →
   fallback · preference-order honoured · URL wins over navigator
   · localStorage wins over navigator · absent navigator → null ·
   all-unsupported navigator → null. Existing i18n precedence
   tests updated to stub `navigator` explicitly to preserve the
   original semantics.

**Verification run:** 118/118 tests green across
`src/lib/nex/i18n/` and `src/lib/nex-native/wholesale/`.
`npx tsc --noEmit` reports **no new errors** in any touched file
(pre-existing truth-engine / vision / e2e typecheck warnings
remain unrelated).

**Still NOT performed in this pass:** apply migrations 350 · 351 ·
352 · commit · push · deploy · env mutation · live charge · external
email send · `:3008` restart · touch `_actions.ts` (concurrent-work
blocked for G3/G4/G7 delivery wiring).

---

## Addendum · Round-4 engineering increments (same session, 2026-11-18)

Three further authorised engineering increments landed on top of the
Request-C addendum. All additive; no prior row is invalidated; the
safety envelope above still holds.

1. **`initiateWholesaleOrderAction` authored** — new single wholesale
   order-initiation entry point at
   `src/lib/nex-native/wholesale/actions.ts`. Thin orchestration over
   `evaluateWholesalePaymentGateAction` that returns an order-draft
   envelope `{ idempotencyKey, gate }` with the deterministic key
   `nex-wholesale-<quoteId>-<buyer_accepted_at>`. **No DB write** (mig
   350/351 unapplied). **No Stripe / PayPal call.** The wholesale/
   retail discriminator remains server-persisted (row's existence in
   `nex_wholesale_quote`, never a caller boolean). Nine unit tests at
   `src/lib/nex-native/wholesale/__tests__/initiate-order.test.ts`
   cover: happy-path envelope · key stability across repeats · key
   change on re-accept · fail-closed propagation (not_authenticated /
   not_your_quote / migration_not_applied / db_unavailable /
   not_approved_buyer / stale_snapshot / freight_missing /
   wrong_status). Previous §1.1 state **flips from WIRED-AS-SPEC +
   GATE-AVAILABLE** to **WIRED-AS-SPEC + GATE-AVAILABLE + WHOLESALE-
   ENTRY-POINT-AVAILABLE**. Downstream payment-initiation (Stripe
   session mint · PayPal order create · bank-transfer page) remains
   unwritten; the register still records that as open.

2. **G3/G4/G7 delivery handoff packet authored** — concrete-targets
   handoff at `evidence/master-flow/delivery-2026-11-18/HANDOFF-G3-G4-G7-2026-11-18.md`
   specifying: exact `_actions.ts` insertion points (lines 2755-2801
   for G3+G4 cart-path wiring · `features/[slug]/page.tsx` + cart-
   action defence for G7), exact ready-to-apply edit snippets, three
   new vitest files to add with explicit test matrices, verification
   checklist, concurrent-edit re-check protocol, and safety envelope.
   The G3/G4/G7 **library primitives are already shipped** (delivery
   handback §15). This packet closes the coordination gap only — no
   code is applied this pass. Downstream engineer resumes from §8 of
   the handoff.

3. **Phase 2B spec clarified via Agent-A read** — targeted repo
   search proved Phase 2B is NOT a chat spec. Two authoritative file
   references found: `docs/doctrine/nex-7-migrations-risk-assessment-2026-10-31.md:122`
   ("Phase 2B snapshots to `nex_country_rollback_244`" · migration-
   rollback procedure) and `docs/audit/rls-classification-2026-11-10.md:142`
   ("Community (phase 2b+ schema-add via 245 country-RLS):
   `nex_community_zone`" · country-RLS waves). Phase 2B therefore
   denotes a DB-level label for migration 244 rollback snapshot +
   migration 245 country-RLS batch · NOT device-only chat · NOT
   translation · NOT message encryption. Consequence for this
   session: **no chat edits warranted**. The pure-P2P chat
   architecture sealed 2026-11-09 (Interp 1 + 6 invariants) is the
   actual chat doctrine; it remains design-authorised but
   implementation-not-authorised per its own seal. §1.1 wording
   "Phase 2B sealed 2026-11-09 Interp 1 pure P2P" has conflated two
   separate labels — the Interp 1 pure-P2P seal stands independently
   and is not the "Phase 2B" referenced by migration doctrine.

**Verification run (Round-4):** 75/75 wholesale unit tests green
(up from 66 pre-Round-4 · 9 new in `initiate-order.test.ts`). No
regressions in 32 delivery library tests. `npx tsc --noEmit` clean
in all touched wholesale files. No `_actions.ts` edit this pass —
G3/G4/G7 remain coordinated-but-unwritten per the handoff packet.

**Still NOT performed in Round-4:** apply migrations 350 · 351 · 352
· commit · push · deploy · env mutation · live charge · external
email send · `:3008` restart · touch `_actions.ts` · edit any file
`initiateWholesaleOrderAction` · edit chat code (Phase 2B finding
makes this unnecessary this pass) · wire G3/G4/G7 (handoff packet
only).

---

## 1 · Cross-flow findings (rolled up from subagents)

### 1.1 · Payment gate — WIRED-AS-SPEC, UNWIRED-INTO-PAYMENT

`isPaymentEligible` from `src/lib/nex-native/wholesale/quote-service.ts`
is defined, unit-tested, and semantically complete (requires
`status='accepted'` + `buyer_accepted_at` set + freight known +
non-expired + material terms unchanged). It is **not referenced from any
server action, API route, or Stripe entry point** · verified by
grep.

Retail payment entry points (`sendCartOrderAction`, `/api/.../billing/
checkout/buyer`, `placeOrderAction`) do NOT distinguish retail from
wholesale. Today this is safe only because no wholesale order flow is
operational — mig 350/351 are PROPOSAL and the buyer catalogue page
fails-closed on `migration_not_applied`. Once either migration lands, a
future payment-wiring task MUST gate the wholesale path on
`isPaymentEligible(...)` AND re-derive material terms against a fresh
quote-row read (not the client snapshot) before any Stripe call.

### 1.2 · `__wholesale` leak scan — ZERO LEAK

Full re-audit (see Request-B pass): every surface that reads
`nex_product.spec` either strips `__wholesale` at the server boundary
(`src/app/nex-native/product/[productId]/page.tsx:110` via
`stripWholesaleFromSpec`) or is intentionally gated to owner / approved
buyer (`[businessSlug]/wholesale/page.tsx`, `manage/wholesale/page.tsx`,
`manage/products/[productId]/edit/*`). Public SEO surfaces (sitemap,
JSON-LD, cover content) never touch `spec`. Billing checkout reads only
`price_pence` + `currency`. **No action required.**

### 1.3 · G9 forbidden-copy — one active public comparative claim

Exactly one live public comparative-earnings claim:

- `src/app/nex-native/manage/shop/page.tsx:515` ·
  `"More orders → bigger discount for buyers · you still net more than on GoFood"`

Cannot be edited this pass — the file is under concurrent worker edit
(222 pre-existing modifications noted in the delivery handback). Flagged
to owner as coordination item.

Internal-only hits (no public impact, no action needed):

- `src/lib/nex-native/types.ts:645` — schema comment
- `src/lib/nex-native/bike-delivery-service.ts:17-22` — competitor
  benchmarking comment (sealed Bridge 25c internal)

Defence-in-depth already active:

- `src/lib/nex/merchant-assistant/guardrails.ts:51-52` blocks
  "cheaper than" / "better than" at the LLM-prompt layer. This prevents
  merchant-generated comparative claims from being synthesised.

Sealed-allowed FACTUAL claims (no change):

- "0 % commission · ever" (sealed 2026-10-27 constitution)
- Safe-trade-strings on NEX commission + money-touch doctrine.

### 1.4 · Core retail/account paths — evidence state

Reconciled from existing handbacks + doctrine:

| # | Area | State | Why | Owner / Engineer | Next action |
|---|------|------|-----|------------------|-------------|
| 1 | Signup / login / password reset / recovery email | WIRED · UNVERIFIED | Server action wired; `RESEND_API_KEY` empty per 2026-11-16 audit | Owner | Populate Resend key in `.env.local` + Vercel prod env · run end-to-end reset · confirm inbox delivery |
| 2 | Shop setup · product upload/edit · multi-tier editor | WIRED · VERIFIED (unit) | 68 + 30 tests green · persists to sandbox | Engineer | No action — ready for owner internal use |
| 3 | Product-specific chat · device keys · participant isolation | DESIGNED · NOT BUILT | Phase 2B sealed 2026-11-09 Interp 1 pure P2P · 7 ciphertext persistence paths remain | Owner decision + major Engineer build | Owner authorises Phase 2B removal path · Engineer then removes `sendEncryptedPeerMessages` etc. · 3-6 months |
| 4 | Vault lock / recovery / fingerprint + 6-digit PIN | BUILT · VERIFIED | Sealed 2026-11-06; reducer tested; escrow route built | Engineer | No action |
| 5 | Retail cart / orders · seller visibility / notifications | WIRED · BLOCKED | `sendCartOrderAction` validates shape only; G4 unlit | Engineer (concurrent-work-blocked) | After concurrent-worker hand-off, wire `isSubmittedLocalQuoteAuthentic` / `isSubmittedExportQuoteAuthentic` into `sendCartOrderAction` |
| 6 | Subscription activation · Stripe webhooks | BUILT · UNVERIFIED | Webhook handler written; `STRIPE_WEBHOOK_SECRET` + publishable key EMPTY | Owner | Execute founder-checklist §1 (Stripe onboarding) · 6 sub-steps |
| 7 | Production config · Vercel linkage · prod env vars | UNVERIFIED | Checklist authored 2026-11-16; no Vercel inspection occurred | Owner | Execute `launch-vercel-linkage-verification-2026-11-16.md` steps 1-4 |

## 2 · Wholesale-flow findings (this pass)

### 2.1 · Buyer catalogue connection

`src/app/nex-native/[businessSlug]/wholesale/page.tsx` now imports
`resolveWholesaleApproval` and the function's return value drives the
rendered state. Confirmed in-boundary properties:

- Runs on `nodejs` runtime + `force-dynamic` (see file header). Not
  Edge.
- Uses `resolveSessionWithDevOverride` (Node-only, env-gated,
  prod-refused per the W19 audit).
- Reads via `nexSupabaseAdmin` **server-only** import (`import
  "server-only"` sits at the head of `approval-service.ts`) — the
  privileged client never crosses to the client bundle.
- On 42P01 returns `{ kind: "db_unavailable", reason: "migration_not_applied" }`
  which maps to `"unapproved"` → `RequestAccessShell`.
- On transient / connectivity failure returns `{ kind: "db_unavailable",
  reason: "transient" }` which also maps to `"unapproved"` today.

#### 2.1.a · Honesty-gap note (ENGINEER, deferred)

The current three-value `ApprovalState` folds BOTH `migration_not_applied`
AND `transient` AND `pending` AND `revoked` into `"unapproved"`. That
renders the SAME `RequestAccessShell` — a form inviting the buyer to
"request access". If mig 350 has not applied, submitting that form
fails closed in the server action (also 42P01 → `migration_not_applied`)
so no data is lost, but the UI does NOT yet distinguish:

1. "Table not available — try again shortly" (recoverable, retry later)
2. "Access pending — seller will review" (pending)
3. "Access revoked — contact seller" (revoked)
4. "Not approved yet — request access" (unapproved · the correct case for the request form)

**Next action (Engineer, when mig 350 applies and the three sub-states
become meaningful):** extend `ApprovalState` to carry the five
informative outcomes, and add a dedicated `RequestAccessShell` variant
that distinguishes "db unavailable · try again" from "request access".
Not actionable now — nothing distinguishes the sub-states at the data
layer until the table exists. Documented here so the follow-up is
visible.

### 2.2 · Mig 351 buyer-column DB-direct gap — FIXED in proposal

Added a `nex_wholesale_quote_buyer_column_guard_t` BEFORE UPDATE trigger
to the migration 351 PROPOSAL SQL. Short-circuits for service-role and
for owner-of-record callers; for any other authenticated caller, RAISES
on any divergence of 17 seller-controlled / identity-anchoring /
lifecycle-timestamp columns between OLD and NEW, and enforces status
transitions `quoted → accepted` or `quoted → rejected` only.

**Still unapplied. No migration run.** Approval packet updated (§6, §7,
§10) so the new trigger is reviewed before the apply word-trigger fires.

This closes the Request-B directive: "RLS row checks do not by themselves
restrict columns. Correct the unapplied proposal using the smallest
appropriate column grants, policies, guarded functions or transition
constraints consistent with the existing architecture." A trigger is
the smallest-feasible change — column-level `GRANT UPDATE (col1, ...)`
would require revoking general UPDATE which would break the seller-side
owner UPDATE path, and column-WITH-CHECK cannot reference OLD.

Enforcement is now **distinct** between application (server action
discipline) and DB (trigger). The packet §7 explicitly states this.

### 2.3 · Nine prerequisites · carryforward

`evidence/master-flow/wholesale-2026-11-18/HANDBACK.md` §10.7 ledger
still stands. Status refresh from this pass:

- **#3** (buyer-page swap) · Built + Wired (unchanged from last pass).
  Honesty-gap note at §2.1.a above.
- **#10 (new)** · Mig 351 buyer column discipline · ENGINEER-CLOSED at
  proposal level this pass. BLOCKED on actual apply (owner-owned).

## 3 · Delivery-flow findings (this pass)

G1-G10 ledger status unchanged by this pass. Rationale:

- G1, G5, G6, G8 · owner architectural decisions. No engineering action
  is possible without the decision; proposing one would violate "Do not
  invent owner decisions."
- G2, G10 · owner authorisations. Same.
- G3, G4, G7 · engineering-ownable but **concurrent-work-blocked**.
  The cart/action/export files are held by concurrent worker. The G9
  copy finding at `manage/shop/page.tsx:515` is in the SAME concurrent
  file and cannot be amended independently without collision.
- G9 · engineering-ownable but **concurrent-work-blocked** (see 1.3).

**Next action (Owner):** direct the concurrent worker to settle G3/G4/
G7/G9, or signal completion so a bounded engineering slice can land.
Until then the delivery library is READY at pure-function level
(32/32 tests) but NOT CONNECTED through the cart.

## 4 · Nexcorner-flow findings (this pass)

No file under `src/app/nexcorner/*` or the prelaunch feature-flag /
allowlist / robots / sitemap / middleware was touched this pass. The
flow is Built + Wired + Verified-at-unit level. BLOCKED for public
launch on six owner legal facts (enumerated in
`evidence/master-flow/nexcorner-2026-11-18/HANDBACK.md` §8.2) + mig 352
apply + Resend provider verification + `NEX_PRELAUNCH_MODE` + founder
UID list population.

## 5 · Six verdicts (Request-B §7 asked for distinct statements)

Scope-bound to the five-state readiness model (sealed 2026-11-08).

### V1 · Limited prelaunch publication — **BUILT · WIRED · VERIFIED (unit) · BLOCKED for public**
- Prelaunch landing + narrow allowlist + narrow sitemap + robots + middleware gate are all code-complete and unit-verified (39 cases).
- BLOCKED on: mig 352 apply · `NEX_PRELAUNCH_MODE=true` set · founder UID list populated · Resend provider verified end-to-end · six legal facts decided · durable rate-limit store.
- Not Production-configured. Not Live-verified.

### V2 · Owner editor — **BUILT · WIRED · VERIFIED (unit) · READY for owner internal use only**
- Owner preview + wholesale editor + shop setup flows are complete.
- 98 wholesale tests green. 32 delivery library tests green.
- BLOCKED only on prod seal / Vercel linkage / mig applies for prod. Sandbox internal use is live-ready on sandbox envelopes.

### V3 · Complete wholesale (buyer-ordering end-to-end) — **BLOCKED**
- Mig 350 + 351 unapplied. Buyer catalogue returns honest `RequestAccessShell` on every non-owner view.
- Payment gate not wired into any payment entry point (correct for current state — no order flow is operational).
- `isPaymentEligible` + `hasSameMaterialTerms` + `canBuyerAccept` all exist and are unit-tested, ready to be invoked once migrations apply.
- Honesty-gap note §2.1.a not yet closed (pending mig 350 apply).

### V4 · Connected delivery — **WIRED (library) · VERIFIED (32 tests) · BLOCKED on G3/G4/G7**
- Pure libraries `local-delivery-quote` + `export-shipping-quote` complete.
- G3 (cart wiring), G4 (`sendCartOrderAction` tamper rejection), G7 (multi-unit export) remain concurrent-work-blocked.
- G9 copy finding (1 line) also concurrent-work-blocked.

### V5 · Whole-app founder testing — **UNVERIFIED (not run this pass)**
- Would require: `NEX_PRELAUNCH_FOUNDER_UIDS` populated with the founder UID and a founder browser session.
- Browser verification was deliberately NOT attempted this pass to preserve the active `:3008` dev server and concurrent-worker browser sessions.
- Technical prerequisite to unblock (stated per Request-B §6 instruction): an isolated dev configuration (separate port + separate `.env.local`) OR an authorised disposable sandbox browser session that does not share cookies / local storage with the running founder sessions. The current single-dev-server setup provides neither.

### V6 · Public commerce launch — **NOT READY**
- All of V1-V5 must close first, plus:
- Stripe onboarding (founder-checklist §1 · 6 sub-steps).
- Vercel linkage verification (checklist 2026-11-16 · 4 steps).
- Six owner legal facts.
- Mig 350 / 351 / 352 all applied to prod via separate per-migration owner authorisations.
- Phase 2B chat architecture decision (sealed 2026-11-09 Interp 1).
- Seven missing legal pages (A13 task).
- A ratification review of the `manage/shop/page.tsx:515` GoFood comparative claim.

## 6 · Owner questions this pass surfaces (and asks)

The Request-B prompt says "Ask only those necessary questions; do not
return 'optional follow-ups'". These are the indispensable items:

1. **Six Nexcorner legal facts** · legal entity · registered address ·
   DPO contact · retention policy · basis for contact · right-to-be-
   forgotten path. None are invented; all UNDECIDED. See
   `nexcorner-2026-11-18/HANDBACK.md` §8.2.
2. **GoFood comparative claim · ratify or reword** ·
   `manage/shop/page.tsx:515`. Doctrine review required before launch.
3. **Delivery owner architectural decisions** · G1 (per-ring vs
   per-km), G5 / G6 (per-product-only defaults), G8 (pickup/local/
   domestic/export separation). No engineering can proceed without
   these.
4. **Delivery owner authorisations** · G2 (straight-line vs routed
   road labelling), G10 (bike rate hardcode).
5. **Phase 2B chat architecture** · authorise removal of the 7
   server-persisted ciphertext paths or re-open the question.
6. **Concurrent-worker hand-off** on `manage/shop/page.tsx` + cart
   action files so G3/G4/G7/G9 can land.
7. **Three migration apply word-triggers** — not solicited now; owner
   decides when to issue them, by themselves, after reading the
   packets.

## 7 · Safety attestation

- Files edited this pass:
  - `nex-supabase/migrations/351_nex_wholesale_quote_PROPOSAL.sql` · added buyer-column-guard trigger function + trigger. **Unapplied.**
  - `evidence/master-flow/wholesale-2026-11-18/APPROVAL-PACKET-migration-351.md` · §6 added rows, §7 rewritten, §10 extended.
  - `evidence/master-flow/LAUNCH-BLOCKER-REGISTER-2026-11-18.md` (this file) · new.
- No other code change. No handback was rewritten; the next pass will
  add brief pointer lines from the three handbacks to this register.
- No commit. No push. No deploy. No migration applied. No Stripe call.
  No Resend call. No `:3008` restart. No env mutation. No credential
  change. No Vault edit. No Hammerex / Rosa touch.
- Subagents (four) were launched as **read-only Explore agents** —
  they cannot write files. Their findings inform §1 above.
- Supabase prod `ijvqdvsvwtwxzcqmoqit` untouched.
- Supabase sandbox `kdstoyyeygcopkogqsyv` untouched (no connection
  opened).
