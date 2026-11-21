# NEX Trial System · DRAFT

**Status:** 📝 DRAFT · owner-recorded 2026-10-22 · implementation NOT authorised
**Author:** Claude (recording owner-corrected plan)
**Date:** 2026-10-22
**Scope:** Backend architecture, data retention policy, payment integration constraints, and launch-gate requirements for the "7-day free trial" of NEX Business tier.

---

## A · Why this doctrine exists

The project memory records a specific trust-gap concern:

> *Pricing page says "7-day free trial" → the trial-auto-fire code was never written → user signs up, trial never starts, they get charged day 1 → feels cheated.*

Three advertised-but-unimplemented Business-tier claims (verified badge · 20 boosted messages · cancel-any-time) have already been deferred to the Package Contract DRAFT (P1 · P2 · P3). The trial system is the next most-visible promise where backend reality must land before any UI copy ships.

This doctrine captures the owner-approved **direction** for the trial system. It does **not** authorise migrations, payment integration, cron jobs, or public trial copy. Each implementation phase requires separate explicit authorisation per Section J.

---

## B · Related sealed and DRAFT doctrines (preserved · not reopened)

The following remain in force exactly as previously sealed. Nothing in this document loosens, reopens, or renegotiates them:

- **LOCKED Vault Entitlements Policy (2026-10-20).** `vault_tier` creation unauthorised · W1–W12 unscheduled · W10 audit-scope limitation · fail-safe 6-pre-condition deletion gate · OMIT Vault from public packages.
- **Theme Commerce Purchase Journey DRAFT (2026-10-20).** Theme ownership persists per purchase · one-time payment · ownership separate from Business/directory · retention/privacy investigation required before any theme-related deletion.
- **Three-Product DRAFT (2026-10-21).** Chat Themes · Chat Intro · Shop are three independent SKUs. A user may own themes without owning Business.
- **Package Contract DRAFT (2026-10-20).** D1-D6 · P1-P3 (verified badge · 20 boosted · cancel-any-time all DEFERRED).
- **Pricing GTM DRAFT (2026-10-22).** Per-market pricing matrix · prices remain PROPOSAL until validated with real customers before hard-coding.
- **Supabase Persistence · Data Loss Protection DRAFT (2026-10-22).** 13 open decisions · 12 M-minimums. Trial-expiry data handling must honour these minimums.
- **Service Principle DRAFT (2026-10-20).** "Best effort is INSUFFICIENT where harm from failure is non-recoverable." Shop data deletion is non-recoverable; trial system therefore operates under stricter-than-best-effort obligations for the deletion path.
- **"NEX never handles payments"** · stands. All card tokens live at Midtrans/Stripe · NEX never holds raw payment data.
- **"Sell clear benefits. Enforce entitlements on the server. Verify the customer experience. Never promise a feature simply because it appears in a design or database."** · stands as the operating rule.

---

## C · Four owner corrections (incorporated into this draft)

### D1 · Free accounts and purchased themes are untouchable

A failed trial-to-paid conversion must **never** delete:

- The `nex_account` row itself (free tier persists forever)
- Chat messages (core to free plan)
- Purchased chat themes (one-time ownership per Theme Commerce DRAFT)
- Intro-related state on `nex_account` (customization columns from migrations 209/211) and in the `nex-user-intros` / `nex-user-wallpapers` Supabase Storage buckets (migration 210). Paid intro ownership protection will be re-added once the Three-Product DRAFT seals `nex_intro_ownership`. *(X8-D1 revision approved 2026-10-22 · see Section N · does not weaken the promise that trial expiry does not delete users' intro-related data; D2's hard rule remains operative.)*
- Vault content (governed by sealed Vault policy · not touched by this doctrine)
- Portrait photo · basic profile · handle · NEX ID

Only **Business-tier content** uploaded during the trial is in scope for sunset: shop template, menu items, product images, store info, live status, delivery settings. Nothing else.

### D2 · Shop data deletion is NOT automatic at a fixed timer

The previously-proposed "37-day automatic deletion" is **withdrawn**. Shop data deletion is a significant, customer-impacting, non-recoverable action and requires:

- **Read-only mode on expiry** · at the end of the trial, shop data goes read-only. Seller can still view and export; buyers can no longer order. This state has no automatic expiry.
- **Verified export** · deletion may only proceed after `export_downloaded_at IS NOT NULL`. If the export has only been *offered* and not confirmed-downloaded, deletion does not proceed. A missed email or failed export must not destroy a seller's work.
- **Clear notifications** · at least 3 separate notifications across at least 30 days before any deletion. Each must be delivered through at least two channels (in-app + email). Delivery must be verified (bounced email → extend grace, do not delete).
- **Recovery safeguards** · a soft-delete + undo window must exist. Any user action to pay or resume cancels pending deletion automatically. Human-reviewable queue before hard deletion.
- **Successful dry run** · the deletion-dry-run must pass without errors on this specific account's data before destructive action is permitted.
- **Minimum grace of 90 days read-only before any deletion is considered**, not 30 days. Shorter is unsafe.

The practical consequence: in the first launch cycle, there may be **no automatic deletion at all**. Deletion of abandoned shop data becomes an operator-reviewed activity, not a timer. This is acceptable. Storage cost of 30-day of inactive shop data on Supabase is modest; trust cost of accidentally destroying a seller's work is permanent.

### D3 · Trial conversion must be explicit and honest · no silent auto-charge

A user does **not** get charged merely because their trial started. Specifically:

- **No credit card is collected at trial start.** Trial is Model B · zero-friction signup, no payment token on file.
- **Explicit opt-in to recurring billing at day 6.** The upsell flow must display, in the user's chosen local currency:
  - The actual price (per Pricing GTM DRAFT · per-market)
  - The renewal cadence (monthly) and the exact date of the first renewal charge
  - The cancellation path (one-tap · no modal gauntlet · no retention offer required to click through)
  - A clear "add payment method to continue" affirmative action — never pre-checked, never styled to look like dismissal
- **Payment method is verified before saving.** The provider's zero-dollar authorisation (Stripe `SetupIntent`, Midtrans `Pay-and-tokenize`) must succeed before the account's `payment_provider_customer_id` is written.
- **Only Midtrans methods that genuinely support recurring in Indonesia qualify** for silent renewal:
  - BCA Direct Debit · GoPay Recurring · DANA Recurring · ShopeePay Recurring · Credit Card tokenized
  - **QRIS is one-time only** · a user who paid once with QRIS at day 6 does NOT auto-renew. They must re-authorise each cycle. Honest UI copy must reflect this.
- **Cancellation is one-tap · zero friction.** User who cancels during trial = immediate downgrade on day 7, no charge, no retention wall. User who cancels mid-paid-month = continues until end of billing period, no auto-renewal.
- **Grace handling of failed renewal charges.** 3 retries over 48 hours. If all fail, downgrade to free tier + shop goes read-only (per D2). No service interruption without notification.

### D4 · Trial entitlement contract · what Business unlocks (and what it does NOT)

The Three-Product DRAFT sealed that Chat Themes, Chat Intros, and Shop are three independent SKUs. A Business trial must not silently change the user's SKU ownership, grant unintended Vault access, or create conflicting entitlements.

**Business trial unlocks ONLY the Shop surface:**

- Shop template with product uploads (My Shop admin)
- Menu items · product images · store info · delivery settings
- Live status posts (if backend wired)
- Promo badges + discount badges per item (if backend wired)
- Buyer-side ordering flow against the shop (if backend wired)

**Business trial does NOT touch:**

- **Vault.** Access to Vault is governed exclusively by the sealed Vault Entitlements Policy. A Business trial grants zero Vault entitlement. This must be enforced server-side; the Business middleware must not have Vault in its allowlist.
- **Chat Themes ownership.** Themes are one-time purchases per the Theme Commerce doctrine. A trial that ends does not strip theme ownership. A trial that converts does not grant any free theme.
- **Chat Intro purchases.** Separate SKU · unaffected by trial state.
- **Free chat features.** Always available regardless of trial state.
- **"Verified badge" · "20 boosted messages" · "cancel-any-time"** · all three are P1/P2/P3 DEFERRED in the Package Contract DRAFT and remain so. The trial does not grant any of these.

If and when additional Business features are built and backed by server-side enforcement, this doctrine must be amended to list them explicitly before they appear in the trial unlock set. Default = not in the trial.

---

## D · State machine (direction · not yet authorised)

```
signup → tier=free · trial_status=null
    ↓ user clicks "Try Business free · no card required"
trial_active · trial_start_at=now · trial_end_at=now+7d
    ↓ day 6 · 24h before expiry
trial_warning · in-app banner + email + optional push
    ↓ day 6 or earlier · user chooses "Convert to paid"
    ├─ provides verified payment method (per D3)
    ├─ Reviews price + renewal terms + cancellation path
    ├─ Confirms with explicit affirmative action
    └─ On confirm: tier=business · tier_activated_at=now · tier_expires_at=now+30d
       ↓ monthly recurrence
       recurring charge via provider's auto-renewal (recurring-capable methods only)
    ↓ day 7 at 00:00 UTC · user did NOT convert
trial_expired · tier=free · shop goes READ-ONLY
    ↓ (indefinite · no automatic timer per D2)
read-only state continues until:
    ├─ user converts to paid → shop re-opens
    ├─ user explicitly chooses "delete my shop" + export verified → sunset scheduled
    └─ operator-reviewed abandonment flag + 90d min grace + all D2 preconditions → sunset scheduled
```

Note: there is **no automatic transition from "read-only" to "deletion"** without the full D2 gate.

---

## E · Database schema (direction · migration NOT authorised)

The schema outlined in the pre-correction build plan is retained conceptually, with the following corrections per D1-D4:

- `nex_account.tier` · `trial_status` · `trial_start_at` · `trial_end_at` · `tier_activated_at` · `tier_expires_at` · `payment_provider` · `payment_provider_customer_id` (opaque token only · NEX never stores raw card data).
- `nex_billing_attempt` · audit trail of charge attempts · retained for compliance even after account closure.
- `nex_data_sunset_schedule` · with D2's expanded preconditions encoded as columns: `read_only_entered_at`, `export_offered_at`, `export_downloaded_at` (must be set before deletion), `notification_count` (must be ≥ 3), `operator_review_passed_at`, `dry_run_passed_at`, `grace_period_min_90d_at`.
- No `trial_period_days` column · default = 7 is a server constant, not a per-account field.

Migration SQL will be drafted when Phase 1 is authorised, not before. The Supabase project remains `ijvqdvsvwtwxzcqmoqit`.

---

## F · Payment integration (direction · integration NOT authorised)

Per the sealed "NEX never handles payments" doctrine:

- **Indonesia · Midtrans** · Core API for tokenization + Subscriptions API for recurring charges on recurring-capable methods only (D3).
- **International · Stripe** · `Subscription` with `trial_period_days: 7` + `payment_behavior: 'default_incomplete'` for Model B.
- Webhook endpoints (`/api/webhooks/midtrans` and `/api/webhooks/stripe`) must verify HMAC/signing-secret before trusting any payload.
- All `provider_customer_id` and `provider_charge_id` values stored in Supabase are opaque strings · NEX code never parses them beyond identity equality.

A dedicated **payment-method coverage matrix** must be maintained (per market · per method · "recurring: yes/no") and surfaced in the UI at day 6 so users understand whether their chosen method auto-renews. This matrix lives in a configuration file reviewed by the owner before each market launch.

---

## G · Data retention policy (direction · tightened per D2)

| Data category | On trial expiry (no payment) |
|---|---|
| `nex_account` row | KEEP forever · free tier |
| Chat messages | KEEP · chat is core to free |
| Purchased Chat Themes | KEEP · Theme Commerce ownership persists |
| Purchased Chat Intros | KEEP · Three-Product DRAFT |
| Portrait photo · profile basic | KEEP |
| Shop template · menu items · product images | **READ-ONLY indefinitely** · deletion gated on D2's full precondition stack · minimum 90d grace · no automatic timer |
| Live status posts | FOLLOWS the shop (read-only together · deleted together under D2 gate) |
| Business delivery settings · hours · address | FOLLOWS the shop |
| **Vault content** | **GOVERNED BY SEALED VAULT POLICY** · this doctrine does NOT touch Vault retention |
| `nex_billing_attempt` rows | KEEP for compliance · minimum 7-year retention |
| `nex_data_sunset_schedule` rows | KEEP for compliance · audit trail of every scheduled or executed sunset |

**Hard rule:** no account, chat message, theme, intro, or Vault item is ever deleted as a consequence of trial expiry. Only Business-tier uploads are in scope, and only under the full D2 gate.

---

## H · UI constraints · what the pricing page may claim

**Current state (nothing built):** pricing page must say "Business tier · Rp 99k/month" (price only) and NO "7-day free trial" copy.

**After Section I's launch gate passes · pricing page is PERMITTED to say:**

- "7-day free trial · no credit card to start"
- "On day 6 we'll ask you to add payment to continue"
- "Cancel anytime before day 7 · zero charge"
- "If you don't continue, your Business features pause · your account stays free"
- "Chat themes you've purchased stay yours forever"

**Pricing page is NOT PERMITTED to say** (under this doctrine):

- "Auto-renews" without naming which payment methods actually do (D3)
- "Cancel anytime" as a bare phrase (P3 is DEFERRED · requires its own process)
- "Shop data stored safely forever" (not promised; D2 governs)
- "Includes Vault" (never · Vault is omitted from Business package per Package Contract DRAFT D6)
- Any mention of verified badge, 20 boosted messages, or any P1/P2/P3 feature

---

## I · Launch gate · 11 preconditions (expanded from 10 per D2 and D4)

Pricing page "7-day free trial" copy may go live publicly ONLY when ALL 11 preconditions are true. Each must be verified and documented in a launch-gate review document before copy flips.

1. Migration applied to Supabase (`ijvqdvsvwtwxzcqmoqit`) · schema from Section E present · types regenerated · code builds.
2. `POST /api/nex-native/trial/start` endpoint deployed · idempotent per account · end-to-end test green.
3. `GET /api/nex-native/trial/status` endpoint returns correct state transitions · verified with test accounts at each state boundary.
4. Server-side entitlement middleware blocks Business features for expired-trial accounts AND for free-tier accounts · manually verified with real accounts.
5. **D4 entitlement contract verified** · trial middleware allowlist excludes Vault, Themes, and Intros · tested with a Business-trial account attempting to access each.
6. Day-6 "24h remaining" warning banner renders in-app · delivery verified for both in-app and email channels · bounced-email handling tested.
7. Day-7 paywall renders for expired accounts · shop goes read-only (D2) · export link visible · tested manually.
8. `POST /api/nex-native/account/export` endpoint ships · export ZIP contains all Business-tier content · manually downloaded and inspected end-to-end for at least one real test account.
9. Midtrans sandbox transaction completes end-to-end: trial → day 6 opt-in → tokenize payment method → day 7 charge via subscription → tier=business → feature access resumed. Payment-method coverage matrix (D3) is checked-in and the UI reflects which methods auto-renew.
10. **D2 sunset-gate preconditions verified** · dry-run cron finds no false positives · test account with partial preconditions is correctly SKIPPED (not deleted) · operator-review queue exists and routes correctly.
11. **D4 cross-doctrine verification** · a Business trial that expires does NOT touch Theme ownership · intro customization columns + storage buckets · Vault state. Verified with a test account that owns one theme and has recorded one intro video before trial start · all unchanged after trial expiry. **Note:** paid intro ownership verification is deferred until the Three-Product DRAFT seals `nex_intro_ownership`; a cross-doctrine addendum will add that verification at that time. *(X8-launch-gate-11 revision approved 2026-10-22 · see Section N.)*

Only after all 11 pass → pricing page copy goes live. **This is the trust gate from the memory. It is the launch condition, not an aspiration.**

---

## J · Approval gates · nothing is authorised yet

Each of the following requires its own explicit owner authorisation. One authorisation does **not** cascade into the next.

| Gate | Scope | Status |
|---|---|---|
| G0 · Draft review | This document reviewed by owner, corrections applied | **Pending owner review** |
| G1 · Schema + endpoints | Section E migration + Section D state machine endpoints | NOT authorised |
| G2 · Entitlement middleware | Server-side Business-tier gate · D4 allowlist | NOT authorised |
| G3 · Payment integration | Midtrans sandbox · Stripe sandbox · webhook handlers | NOT authorised |
| G4 · Cron jobs | 5 scheduled handlers · fake-clock test harness | NOT authorised |
| G5 · Data export + read-only mode | Export endpoint · soft read-only state · no deletion yet | NOT authorised |
| G6 · UI integration | Day-6 banner · day-7 paywall · settings/billing · export UI | NOT authorised |
| G7 · Launch-gate verification | Run all 11 preconditions from Section I | NOT authorised |
| G8 · Public pricing copy | Flip "7-day free trial" live on pricing page | NOT authorised |

**Nothing above G0 proceeds until G0 is passed. G8 proceeds only after G7 passes.** No cascading authorisation.

The 21-29 engineering-day estimate in the pre-correction build plan was a planning estimate, not a verified delivery commitment. Actual phase durations will depend on scope decisions still pending in this doctrine (operator-review queue scope, payment-method coverage matrix completeness, export format decisions, legal counsel review for retention copy).

---

## K · Decision Register · K1-K14

The following are blocking decisions that must be resolved before implementation gates G1 onward can be authorised. **Every entry below is marked UNDECIDED until explicit owner approval is recorded in Section M.** Recommended directions are owner-authored proposals from the 2026-10-22 decision-resolution directive, not approved decisions.

K1-K8 were recorded in the initial draft. K9-K14 were surfaced by the G0 Implementation-Readiness Audit of 2026-10-22 and are added here with the same structure.

---

### K1 · Trial-abuse prevention

- **Decision:** How many trials may one real person obtain?
- **Options:**
  - (a) One trial per `nex_account` lifetime
  - (b) One trial per device/IP
  - (c) No limit
- **Recommended direction (per owner guidance 2026-10-22):** (a) · one trial per account lifetime, subject to abuse review
- **Rationale:** Industry standard · prevents trial abuse · a wired precedent already exists in `startThemesTrial` at `src/lib/nex-native/account-service.ts:384` via atomic `.is("themes_trial_used_at", null)` conditional update
- **Dependencies:** None
- **Consequences:** Requires an explicit `trial_status` column (schema) · simple one-shot flag · abuse-review path for edge cases
- **Gate:** Prerequisite to **G1** (schema design)
- **Status:** UNDECIDED

### K2 · Operator-review queue for abandoned-shop deletion

- **Decision:** Who is "the operator" authorised to approve Business-tier deletion?
- **Options:**
  - (a) Founder-only during pilot (no role column needed)
  - (b) Defined operator role in `nex_account.hq_role` (migration 206 already authored for `reviewer\|admin`)
  - (c) Separate admin surface not yet designed
- **Recommended direction (per owner guidance 2026-10-22):** Founder/operator-only access with explicit server-side authorisation · architecturally (b), with pilot restricted to founder as the only admin member
- **Rationale:** Migration 206 is AUTHORED but NOT YET APPLIED · reuses existing fail-closed pattern in `src/lib/nex-native/hq-authorization.ts` · no new role concept needed
- **Dependencies:** Migration 206 must be applied before this gate operationally functions
- **Consequences:** Deletion review routes gate on `requireHqAdmin()` · founder is seeded as initial admin via server-side action
- **Gate:** Prerequisite to **G5** (deletion safeguards)
- **Status:** UNDECIDED

### K3 · Export format

- **Decision:** What does the user-initiated data export contain?
- **Options:**
  - (a) ZIP containing JSON of structured data + `media/` folder of original image blobs
  - (b) Human-browseable HTML archive (printable receipt-style)
  - (c) Both
- **Recommended direction (per owner guidance 2026-10-22):** (a) · ZIP containing JSON and associated media
- **Rationale:** Simplest to implement · machine-parseable for migration to competitor services · honest about contents · aligns with Privacy Policy §19 commitment to data portability
- **Dependencies:** None
- **Consequences:** ZIP generation library · signed URL distribution · expiry (per ADR 2026-10-15 blueprint)
- **Gate:** Prerequisite to **G5**
- **Status:** UNDECIDED

### K4 · Notification channels

- **Decision:** Which notification channels are mandatory for the 3+ notifications D2 requires?
- **Options:**
  - (a) In-app + email mandatory · push/SMS optional
  - (b) Add SMS mandatory (Twilio/Vonage cost per account · adds regulatory load)
  - (c) Add push mandatory (current Web Push infrastructure has in-memory subscription store · would need hardening)
- **Recommended direction (per owner guidance 2026-10-22):** (a) · in-app and email, with verified delivery and bounce handling
- **Rationale:** Resend email adapter exists but is unwired to any nex-native user flow · must be hardened · bounce classification is required so a missed email cannot destroy data (per D2)
- **Dependencies:** Email infrastructure wired to nex-native user flows · bounce classification · retry logic
- **Consequences:** Dispatcher service with multi-channel fallback · verified-delivery column on `nex_data_sunset_schedule`
- **Gate:** Prerequisite to **G5**
- **Status:** UNDECIDED

### K5 · Late reactivation of trial-stage shop data

- **Decision:** If a user converts to paid after trial expiry (e.g. 60 days later), what happens to their shop?
- **Options:**
  - (a) Re-open with original content (friendlier · uses more storage)
  - (b) Start fresh (cleaner · loses their work)
  - (c) Ask the user at reactivation
- **Recommended direction (per owner guidance 2026-10-22):** (c) · ask the user before restoring the original Shop
- **Rationale:** Explicit choice is honest · neither "always restore" nor "always wipe" is universally right · owner retains agency
- **Dependencies:** Shop data must still exist in read-only state at reactivation time (per D2 90-day minimum grace)
- **Consequences:** Reactivation UI needs a 2-choice modal · shop state is restored OR cleared based on user choice
- **Gate:** Prerequisite to **G6** (UI integration)
- **Status:** UNDECIDED

### K6 · Pricing

- **Decision:** What price does the trial system commit to publicly?
- **Options:**
  - (a) Hard-code the proposed Rp 99k/month from `/packages`
  - (b) Hard-code the Rp 39k/month from `/settings/tier`
  - (c) Reconcile the two surfaces first · validate one authoritative price with real customers (per Pricing GTM DRAFT) · THEN wire trial copy
- **Audit-surfaced consideration:** `/packages/page.tsx` publishes **Rp 99,000/month** and `/settings/tier/page.tsx` publishes **Rp 39,000/month** today · the two public surfaces disagree on price REGARDLESS of trial scope
- **Recommended direction (per owner guidance 2026-10-22):** (c) · resolve Rp 99k vs Rp 39k and validate one authoritative price
- **Rationale:** Pricing GTM DRAFT 2026-10-22 says prices remain PROPOSAL until validated with real customers · launching a trial that promises an un-validated or contradicted price creates exactly the trust gap the whole doctrine exists to prevent · reconciliation is a prerequisite to any trial copy
- **Dependencies:** Price reconciliation across `/packages`, `/settings/tier`, `src/lib/nex-native/pricing-config.ts`
- **Consequences:** Trial copy cannot ship until this is settled · the mismatch also independently blocks any accurate public pricing today, even without a trial
- **Gate:** Prerequisite to **G7** (launch gate) · and independently to any `/packages` + `/settings/tier` consistency fix
- **Status:** UNDECIDED

### K7 · Payment-method coverage matrix accuracy

- **Decision:** Who verifies which Midtrans methods actually support recurring charges in production (not sandbox)?
- **Options:**
  - (a) Owner contacts Midtrans merchant-account support directly
  - (b) Engineering team runs sandbox + production test transactions
  - (c) Both (recommended for ground-truth)
- **Recommended direction (per owner guidance 2026-10-22):** Verify each recurring method against actual production merchant capability · ground-truth matrix per method, per currency, per merchant account
- **Rationale:** Sandbox behaviour differs from production · merchant-account specifics affect which methods are enabled · BCA Direct Debit may require corporate account · QRIS is confirmed one-time only · UI copy at day 6 must reflect reality
- **Dependencies:** Active Midtrans merchant account for the pilot country
- **Consequences:** Payment-method matrix is a config file reviewed line-by-line by owner before each market launch · must honestly label which methods auto-renew and which don't
- **Gate:** Prerequisite to **G3** (payment integration) · and to any public claim about auto-renewal
- **Status:** UNDECIDED

### K8 · Legal counsel on recurring-billing disclosure

- **Decision:** Does the pilot ship Indonesia-only, or broader?
- **Options:**
  - (a) Indonesia-only pilot (one legal regime · tractable)
  - (b) Indonesia + one other market (which?)
  - (c) Multi-regime at launch (Indonesia + EU + US · complex)
- **Recommended direction (per owner guidance 2026-10-22):** (a) · Indonesia-first scope and obtain appropriate legal review
- **Rationale:** Indonesian PDP (UU PDP 2022) is a single tractable regime · multi-regime adds GDPR + CCPA + UK DPA + national tax-law complexity · validate pilot in Indonesia before expanding
- **Dependencies:** Indonesian legal counsel review of recurring-billing disclosure requirements
- **Consequences:** `/packages`, `/settings/tier`, trial UI must be Indonesia-targeted (locale, currency, legal language) at pilot launch · multi-regime copy is deferred to post-pilot
- **Gate:** Prerequisite to **G6** (UI integration) · and to **G8** (public pricing copy)
- **Status:** UNDECIDED

### K9 · Expiry instant definition · NEW (audit-surfaced)

- **Decision:** When exactly does the trial expire?
- **Options:**
  - (a) Exactly 168 hours after `trial_start_at`, stored UTC (precise, user-fair)
  - (b) Day 7 at 00:00 UTC regardless of start time (truncates on start day)
  - (c) Day 7 at user-local midnight (locale-sensitive, more complex)
- **Recommended direction (per owner guidance 2026-10-22):** (a) · exactly 168 hours after trial start, stored in UTC
- **Rationale:** Precise · no truncation if user starts late in the day · display in user locale on the warning banner at `trial_end_at - 24h` · the current doctrine phrasing "day 7 at 00:00 UTC" is imprecise and must be made exact
- **Dependencies:** None
- **Consequences:** `trial_end_at = trial_start_at + interval '7 days'` in SQL · warning cron fires on `trial_end_at - 24h <= now`
- **Gate:** Prerequisite to **G1** (schema)
- **Status:** UNDECIDED

### K10 · Provider sequencing · NEW (audit-surfaced)

- **Decision:** Which payment provider ships first for the pilot?
- **Options:**
  - (a) Stripe-first (international pilot · native 7-day trial support)
  - (b) Midtrans-first (Indonesia pilot · requires app-side state machine)
  - (c) Both in parallel (doubles implementation scope)
- **Recommended direction (per owner guidance 2026-10-22):** Select one provider for the pilot after market and payment capability verification · depends on K8
- **Rationale:** Stripe has native `trial_period_days: 7` and faster integration · Midtrans has no native trial concept and requires app-side state machine · market choice (K8) drives this · the two provider flows are NOT symmetric and must be designed per-provider
- **Dependencies:** K8 (legal scope) determines market · K7 (recurring-method coverage) determines Midtrans feasibility
- **Consequences:** G3 scope depends on choice · one provider = roughly half the integration work of parallel both · webhook endpoints · tokenisation · retry logic all differ
- **Gate:** Prerequisite to **G3** (payment integration)
- **Status:** UNDECIDED

### K11 · Export-retention proof · NEW (audit-surfaced)

- **Decision:** What constitutes proof that the user retained the export?
- **Options:**
  - (a) `export_downloaded_at` alone (HTTP 200 proves bytes left server · does NOT prove retention)
  - (b) `export_downloaded_at + 14-day waiting window` (gives time to discover failed save)
  - (c) Explicit `export_user_confirmed_at` (user actively ticks "I have saved this · you may proceed")
  - (d) Both waiting window AND explicit confirmation
- **Recommended direction (per owner guidance 2026-10-22):** (d) · explicit user confirmation after export, plus a waiting period
- **Rationale:** HTTP 200 only proves bytes were delivered to a browser · not that the user retained them · explicit confirmation is unambiguous · waiting window gives time to discover file issues · belt-and-braces for a non-recoverable action
- **Dependencies:** K3 (export format)
- **Consequences:** `nex_data_sunset_schedule` needs both `export_downloaded_at` and `export_user_confirmed_at` columns · UI needs confirmation modal · deletion-dry-run checks both
- **Gate:** Prerequisite to **G5**
- **Status:** UNDECIDED

### K12 · Deletion schedule · NEW (audit-surfaced)

- **Decision:** What is the exact sequence of notifications, grace period, and undo window?
- **Options:**
  - (a) Day 0 (expiry) · Day 30 · Day 60 notices · Day 90 earliest deletion review · Day 97 earliest hard-delete (7-day undo on soft-delete)
  - (b) Day 0 · Day 15 · Day 30 notices · Day 60 earliest review · Day 65 earliest hard-delete (faster · less safe)
  - (c) Owner-defined bespoke schedule
- **Recommended direction (per owner guidance 2026-10-22):** (a) · Day 0, 30 and 60 notices; earliest deletion review at day 90; seven-day undo before hard deletion
- **Rationale:** 90-day minimum per D2 · three notices spread across 60 days gives adequate warning · 7-day undo on soft-delete prevents accidental loss · consistent with Vault policy's fail-safe pattern
- **Dependencies:** K4 (notification channels for the notice sequence)
- **Consequences:** Cron sequence · state machine transitions · UI undo surface · precondition logic in sunset-execute cron
- **Gate:** Prerequisite to **G4** (scheduled jobs) and **G5** (deletion safeguards)
- **Status:** UNDECIDED

### K13 · Billing-record retention · NEW (audit-surfaced)

- **Decision:** How long must `nex_billing_attempt` rows be retained?
- **Options:**
  - (a) Universal 7 years (initial draft assumption · not accurate)
  - (b) Per-market legal minimum (varies 2-10 years by jurisdiction)
  - (c) Fixed single period with legal review (e.g. 10 years to cover all markets)
- **Audit finding:** The initial doctrine said "minimum 7-year retention" as a universal · this is NOT accurate · Indonesian PDP generally requires 2-5 years for financial records · EU GDPR + tax law typically 5-10 years · US SOX 7 years for public companies
- **Recommended direction (per owner guidance 2026-10-22):** (b) · market-specific legal retention rules, confirmed by counsel
- **Rationale:** Not a universal 7 · varies by jurisdiction · pessimistic over-retention has privacy cost · under-retention has legal cost · counsel review is the honest resolution
- **Dependencies:** K8 (legal scope · determines which markets' retention rules apply)
- **Consequences:** Retention logic in `nex_data_sunset_schedule` distinguishes `nex_billing_attempt` retention by `country_code` on the account · may need per-market partitioning
- **Gate:** Prerequisite to **G7** (launch gate) · delayable past G1-G4
- **Status:** UNDECIDED

### K14 · Trial entitlement architecture · NEW (audit-surfaced)

- **Decision:** How does the trial grant entitlements without accidentally unlocking Vault / Themes / Intros / P1-P3 (verified badge, 20 boosted, cancel-anytime)?
- **Options:**
  - (α) Add new `effective_tier` enum value `bisnis_trial` with explicit allowlist per `assertCan*` function
  - (β) Keep `effectiveTier()` binary · add parallel `effectiveTrialEntitlements()` helper returning `{ shop: true, vault: false, themes_premium: false, intros_premium: false, p1_verified: false, p2_boosted: false, p3_cancel: false }`
  - (γ) Separate `nex_trial_entitlement` table with explicit rows per feature per account
- **Recommended direction (per owner guidance 2026-10-22):** (β) · separate, explicit trial-entitlement model so `effectiveTier()` cannot grant the entire Business package
- **Rationale:** Honours D4 strictly · current `effectiveTier()` is a single enum that cascades to EVERYTHING tier-gated · the themes-trial (migration 089) grants full `effectiveTier()==='bisnis'` which is exactly what D4 forbids for the Business trial · the Business trial must NOT inherit this cascading pattern · explicit entitlement shape is auditable and testable with negative-access tests
- **Dependencies:** None (architectural choice)
- **Consequences:** `src/lib/nex-native/tier-gate.ts` 6 `assertCan*` functions updated to consume both `effectiveTier()` AND `effectiveTrialEntitlements()` · new integration tests prove negative access · the entitlement helper becomes the single server-side source of truth for "can this account do X right now"
- **Gate:** Prerequisite to **G1** (schema design) · and **G2** (middleware)
- **Status:** UNDECIDED · **critical** · particularly load-bearing per owner guidance 2026-10-22: *"the architecture must make it impossible for a Shop trial to inherit unrelated Business privileges by accident"*

---

## L · Conflict Register · X1-X10

The G0 Implementation-Readiness Audit of 2026-10-22 identified ten verified conflicts and anomalies in the current repository state. Each must be resolved at or before the gate indicated. All entries below are verified repository facts; recommended directions remain UNDECIDED until explicit owner approval is recorded in Section M.

### X1 · Themes-trial vs D4 clash

- **Verified fact:** `startThemesTrial` at `src/lib/nex-native/account-service.ts:384-428` grants `effectiveTier()==='bisnis'` for 7 days from a themes-shop entry point (migration 089). This is the ONLY wired trial activation path in the codebase today, and it elevates the account to full Business tier — not Shop-only.
- **D4 requirement:** Business trial unlocks Shop only · must not touch Vault, Themes premium, Intros, P1/P2/P3.
- **Resolution options:**
  - (a) Retire themes-trial · replace with the new Shop-only trial
  - (b) Keep themes-trial as a distinct "Themes Trial" product · build a separate "Business Trial" product with explicit scope
  - (c) Amend D4 to allow themes-trial's current scope to continue (would weaken the correction)
- **Recommended direction (per owner guidance 2026-10-22):** (b) · do not silently retire or modify the existing Themes trial · resolve the clash by building a SEPARATE Business trial with its own entitlement helper (K14 Option β)
- **Resolution required before:** **G2** (entitlement middleware)
- **Status:** UNDECIDED

### X2 · `/packages` Rp 99k vs `/settings/tier` Rp 39k

- **Verified fact:** `/packages/page.tsx` hard-codes **Rp 99,000/month** for Bisnis · `/settings/tier/page.tsx` hard-codes **Rp 39,000/month** for the same tier · two public surfaces publish different prices today, independent of trial scope.
- **Resolution options:**
  - (a) Reconcile to one authoritative price · update both surfaces
  - (b) Determine which surface is correct · remove or deprecate the other
  - (c) Mark one as deprecated · migrate affected users
- **Recommended direction (per owner guidance 2026-10-22):** Resolve to one authoritative price AND validate with real customers per Pricing GTM DRAFT (K6)
- **Resolution required before:** **G7** (launch gate) · AND independently before any accurate public pricing can be claimed
- **Status:** UNDECIDED

### X3 · Migration 207 UNAPPLIED and policy-blocked

- **Verified fact:** `nex-supabase/migrations/207_nex_onboarding_and_vault_trial.sql` adds `nex_account.vault_trial_used_at` · the sealed Vault Entitlements Policy LOCKED is in force · the migration-reconciliation matrix at `docs/doctrine/nex-migration-reconciliation-matrix-188-212-2026-10-20.md` flags 207 as policy-blocked.
- **Resolution options:**
  - (a) Keep 207 unapplied · do NOT batch it into any trial migration
  - (b) Apply 207 as part of Vault-trial support (requires sealed Vault policy to be unlocked · NOT authorised)
  - (c) Remove 207 from the migration queue
- **Recommended direction (per audit 2026-10-22):** (a) · 207 remains unapplied · new trial migration MUST NOT include Vault columns · must NOT awaken the `vault_tier` reference (see X7)
- **Resolution required before:** **G1** (schema migration must not batch 207)
- **Status:** VERIFIED CONSTRAINT · G1 must honour this · not a decision point so much as a required safeguard

### X4 · Welcome page primed to leak trial copy

- **Verified fact:** `src/app/nex-native/welcome/page.tsx` imports `pricing-config.ts` and renders a chip via `welcomeCardChipFor(pkg)` · the chip currently renders FREE for free pkg and suppresses "See all plans" for `chat_themes_premium` + `nex_business` because `autoFiresOnSignup` and `manualStartAvailable` are both false · flipping either boolean to true would render "7 days free, then {price}/month" copy without any launch-gate check.
- **Resolution options:**
  - (a) Add a server-side gate that verifies launch-gate state before pricing-config boolean flips take effect (defensive wiring)
  - (b) Lock pricing-config boolean edits behind an admin override that logs who flipped what
  - (c) Remove the trial-chip rendering from the welcome page entirely until G7 passes
- **Recommended direction (per audit 2026-10-22):** (a) · pricing-config edits must route through a launch-gate check · a flat config edit must not release trial copy
- **Resolution required before:** **G6** (UI integration)
- **Status:** UNDECIDED

### X5 · Privacy Policy §19 vs reality

- **Verified fact:** `src/app/nex-native/about/privacy/page.tsx:626-649` publicly commits to data portability · no backing implementation exists · the trial doctrine's D2 "verified export" precondition compounds this gap because deletion safety now depends on an export system that NEX has already publicly promised but not delivered.
- **Resolution options:**
  - (a) Build the export system (G5 scope) · honours the existing public promise
  - (b) Amend Privacy Policy to describe current state honestly (soft rollback of the public promise)
  - (c) Both · build the export AND ensure Privacy Policy wording matches reality rather than aspiration
- **Recommended direction (per audit 2026-10-22):** (c) · build the export properly AND align Privacy Policy wording with reality
- **Resolution required before:** **G5** (export + read-only) · and arguably independent of trial scope entirely (the public promise exists today)
- **Status:** UNDECIDED · exists independent of trial scope

### X6 · Live Stripe keys in `.env.local`

- **Resolution options:**
  - (a) Rotate immediately · regardless of trial authorisation
  - (b) Rotate when payment work begins
  - (c) Leave in place (NOT recommended)
- **Recommended direction (per audit 2026-10-22):** (a) · independent security hygiene action · rotation does not require trial authorisation and should not wait for it
- **Resolution required before:** **G3** (payment integration) · AND independently as standalone security remediation
- **Status:** UNDECIDED · independent of trial scope

### X7 · `vault_tier` referenced without column

- **Verified fact:** `src/lib/nex-native/vault/vault-service.ts:17-25` (function `effectiveVaultAccess`) reads `account.vault_tier` · no migration creates this column · this is a dormant runtime bug · any trial code that touches Vault paths will awaken it.
- **Resolution options:**
  - (a) Guard with `?? null` fallback in `effectiveVaultAccess()`
  - (b) Remove the reference until the sealed Vault policy authorises the column
  - (c) Both (guard immediately · remove on next Vault policy review)
- **Recommended direction (per audit 2026-10-22):** (c) · fix the dormant bug independent of trial work · do NOT propose creation of `vault_tier` (sealed Vault policy)
- **Resolution required before:** **G2** (entitlement middleware · which must not awaken the bug)
- **Status:** UNDECIDED · dormant bug · fix independent of trial scope

### X8 · Intro ownership has no schema

- **Verified fact:** Migrations 209/210/211 add intro customization columns to `nex_account` itself · no `nex_intro_ownership` or `nex_intro_purchase` table exists · D1 claim "purchased chat intros must not be deleted" has no schema to protect today.
- **Resolution options:**
  - (a) Add `nex_intro_ownership` schema in G1 (expands trial scope)
  - (b) Revise D1 to say "intros are account-attached customization · not transferable SKU"
  - (c) Defer intro-commerce schema to a separate doctrine · update D1 to reflect current state
- **Recommended direction (per audit 2026-10-22):** Owner decision pending · likely (c) · intro-commerce is a separate SKU per Three-Product DRAFT and its schema should be designed in that doctrine, not folded into the trial system
- **Resolution required before:** **G1** (schema) · OR D1 scope revision in Section C
- **Status:** UNDECIDED

### X9 · `NexWorkspaceWallet.tsx` calls non-existent routes

- **Resolution options:**
  - (a) Remove the component
  - (b) Build the routes it expects (expands scope significantly · unrelated to trial)
  - (c) Stub the component with "coming soon" state
- **Recommended direction (per audit 2026-10-22):** Flag only · out of trial scope · pre-existing issue requiring separate owner decision
- **Resolution required before:** NOT a trial-system blocker · logged here for owner visibility
- **Status:** PRE-EXISTING · NOT BLOCKING TRIAL · flagged for owner awareness

### X10 · Family-safety payment adapter vs Business trial

- **Verified fact:** `src/lib/nex-native/family-safety/subscription/*` has a parallel `PaymentAdapter` pattern with `test_mode`, `stripe_tbd`, `xendit_tbd` stubs · it was built for child-account subscriptions and is not currently wired to any real payment path.
- **Resolution options:**
  - (a) Reuse family-safety `PaymentAdapter` registry pattern for Business trial
  - (b) Build a separate Business-trial payment layer in parallel
  - (c) Converge both into one shared payment layer (reduces drift · requires refactor)
- **Recommended direction (per audit 2026-10-22):** (c) if feasible · one payment layer, two consumers · reduces drift · to be assessed during G3 scoping
- **Resolution required before:** **G3** (payment integration · architectural decision)
- **Status:** UNDECIDED

---

## M · Honest discipline statements

- **This document is a draft.** No code change, migration, or copy change may be made on its basis alone.
- **The trust gap in the memory remains open until G8 passes.** The pricing page must not advertise "7-day free trial" until Section I's 11 preconditions are all green.
- **Vault is untouched by this doctrine.** Vault retention, deletion, and audit remain exclusively under the sealed Vault Entitlements Policy. This doctrine does not reopen that policy.
- **"Best effort" is insufficient for Business-tier deletion.** Per the Service Principle DRAFT, where the harm from failure is non-recoverable, "best effort" is not the appropriate standard. D2's expanded preconditions reflect this.
- **The 21-29 engineering-day estimate is a planning estimate · not a verified delivery commitment.** Actual durations depend on open decisions in Section K and on verification work in Section I.
- **NEX never handles payments.** All card tokens live at the provider. This doctrine does not propose any change to that boundary.

---

## N · Change log

- **2026-10-22 · Draft recorded by Claude.** Incorporates four owner-authored corrections to the pre-correction build plan: (1) free accounts + themes safe · (2) no automatic shop-data deletion at 37 days · require full D2 gate · (3) explicit opt-in to recurring billing · verified payment method · recurring-capable methods only · (4) explicit entitlement contract separating Business trial from Vault, Themes, Intros. Launch-gate preconditions expanded from 10 to 11.

- **2026-10-22 (same day · revision) · G0 Implementation-Readiness Audit completed by Claude.** Five read-only audit threads returned findings on account/entitlement state, Shop/Business features, payment infrastructure, export/notification/retention, migrations/tests. Working-tree state preserved (120 modified · 2 deleted · 3+ untracked). One test executed: `welcome-trial-copy.test.ts` passed 5/5 in 1.59s. No code modified · no migrations drafted · no commits · no cleanup. Audit findings integrated into this doctrine as:
  - **Section K expanded** from K1-K8 to K1-K14 with full decision-register format (decision · options · recommended direction · rationale · dependencies · consequences · gate · UNDECIDED status). K9-K14 are audit-surfaced additions covering expiry-instant precision (K9), provider sequencing (K10), export-retention proof (K11), deletion schedule (K12), billing-record retention (K13), and trial-entitlement architecture (K14 · load-bearing).
  - **Section L added** with Conflict Register X1-X10. Verified repository conflicts and anomalies: X1 themes-trial vs D4 clash · X2 `/packages` Rp 99k vs `/settings/tier` Rp 39k · X3 migration 207 UNAPPLIED and policy-blocked · X4 welcome page primed to leak trial copy via pricing-config boolean · X5 Privacy Policy §19 publicly promises data portability without implementation · X6 live Stripe keys in `.env.local` unread by code · X7 `vault_tier` referenced in `vault-service.ts` without column · X8 intro ownership has no schema · X9 `NexWorkspaceWallet.tsx` pre-existing dead wiring (not trial-blocking) · X10 family-safety payment adapter vs Business trial consolidation question.
  - **Recommended directions recorded** per 2026-10-22 owner decision-resolution directive. Every K1-K14 and every X1-X10 remains **UNDECIDED** until explicit owner approval. No decision has been converted to approved status by this revision.
  - **G0 remains open.** G1-G8 remain unauthorised. The 21-29 engineering-day planning estimate is unchanged and remains a planning estimate, not a delivery commitment.

- **2026-10-22 (same day · consolidated authorisation) · G1 preconditions and safeguards sealed by owner.** Owner issued a single consolidated authorisation approving the following items. Each is now AUTHORITATIVE despite any "UNDECIDED" label still appearing in Sections K or L for the body-level register entries · **this change-log entry supersedes.** No implementation gate is authorised by this entry. G1 implementation drafting (migration SQL · endpoint route handlers · regression tests) remains unauthorised and requires a separate explicit authorisation after the G1 design package is reviewed. G2-G8 remain unauthorised.

  **A · Core decisions APPROVED:**

  - **K1 APPROVED** · One Business trial per `nex_account` lifetime. The existing Themes trial (migration 089 · `themes_trial_used_at`) remains separate and unchanged. Admin reset functionality is deferred to a later gate · see Q1 clarification below.

  - **K9 APPROVED** · Business trial expires exactly 168 hours after `business_trial_start_at`. Stored and compared in UTC. Deadline displayed to users in their local timezone. No rounding to UTC midnight.

  - **K14 APPROVED · load-bearing** · Option β · separate explicit Shop-only trial entitlements. Business trial does NOT elevate `effectiveTier()` to `'bisnis'`. A new server-side helper `effectiveTrialEntitlements(account)` returns a per-feature shape where `shop: true` and every other field (`vault`, `themes_premium`, `intros_premium`, `p1_verified`, `p2_boosted`, `p3_cancel`) is explicitly `false` while `business_trial_status === 'active'`. `tier-gate.ts` `assertCan*` functions consume both `effectiveTier()` and `effectiveTrialEntitlements()`.

  - **X3 APPROVED** · `nex-supabase/migrations/207_nex_onboarding_and_vault_trial.sql` remains unapplied and is explicitly excluded from any G1 trial migration. The sealed Vault Entitlements Policy LOCKED stands untouched. The unrelated `vault_tier` reference at `src/lib/nex-native/vault/vault-service.ts:17-25` is tracked separately as X7 for independent remediation.

  **B · Intro-protection wording APPROVED:**

  - **X8-D1 APPROVED** · Section C's D1 clause "Purchased chat intros (one-time ownership per Three-Product DRAFT)" replaced in the body with the approved wording (see Section C · the replacement cites this entry). **Owner clarification: the wording change does NOT weaken the existing promise that trial expiry does not delete users' intro-related data.** D2's hard rule at Section G (*"no account, chat message, theme, intro, or Vault item is ever deleted as a consequence of trial expiry"*) remains the operative protection for current intro reality.

  - **X8-launch-gate-11 APPROVED** · Section I's precondition 11 replaced in the body with the approved wording (see Section I · the replacement cites this entry). Verification tests existing Intro customization and stored media alongside Theme ownership and Vault state. Paid Intro ownership verification is deferred until the separate Three-Product doctrine establishes the actual ownership schema; a cross-doctrine addendum will add it at that time.

  **C · G1 engineering decisions APPROVED:**

  - **Q1 APPROVED** · Migration 206 (`hq_role`) application and admin override endpoint deferred to a later gate. **Owner clarification: manual SQL operations needed during pilot abuse-review require a documented audit mechanism available at that time.** Reliance on `nex_billing_attempt` as the audit trail is NOT acceptable because that table does not ship until G3. The G1 design package must define an alternative pilot audit mechanism (e.g. structured server-log trail of operator SQL sessions, or a dedicated `nex_pilot_operator_audit` table authored under this doctrine) before any implementation.

  - **Q2 APPROVED · with concurrency safeguard** · Themes-trial coexistence rule approved as mutually-exclusive-activation (see D1 approvals below). **Owner required addition: enforcement must be concurrency-safe (atomic at DB level).** Checking for an active trial and writing the new state in separate unprotected operations could allow two concurrent requests to start overlapping trials. The G1 design must present a database-level or transactional safeguard (candidates: unique partial index · advisory lock · single-statement UPDATE with WHERE preconditions · SELECT FOR UPDATE within a transaction) and test simultaneous activation attempts before implementation.

  - **Q3 APPROVED** · G1 code ships behind a feature flag (default disabled). Trial activation stays disabled until G2 entitlement enforcement is ready and tested. G1 and G2 may be drafted together but neither reaches users until G2 ships. The G1 design must name the feature-flag mechanism (env var · pricing-config field · dedicated flag module) and demonstrate that no code path can activate the trial while the flag is false.

  - **Q4 APPROVED** · Historical `tier_activated_at` values stay NULL for pre-existing bisnis accounts. No backfill from `bisnis_expires_at - 30 days` or any other approximation. Downstream analytics must handle NULL for pre-existing accounts.

  - **Q5 APPROVED** · Idempotency reuses existing primitives at `src/lib/nex/idempotency/*`. Regression tests must cover retries AND concurrent requests. All three G1 endpoints (`/start`, `/status`, `/cancel`) accept an optional `Idempotency-Key` header.

  - **Q6 APPROVED** · Structured server-side logs for every state transition with hashed account identifiers and request IDs. No new metrics platform introduced by G1.

  - **Q7 APPROVED** · Rate limiting reuses existing infrastructure. The G1 design must first verify what rate-limiting primitives already exist (middleware · edge · session-table-based) before designing any fallback.

  **D · Critical design decisions APPROVED:**

  - **D1 APPROVED · themes-trial coexistence · mutually-exclusive-activation** ·
    - An active Themes trial blocks starting a Business trial.
    - An active Business trial blocks starting a Themes trial.
    - Once the existing Themes trial is no longer active (expired or converted), a Business trial may be started if the account is otherwise eligible.
    - The rule MUST NOT silently alter the existing Themes trial's tier-elevation behaviour · `startThemesTrial` and `effectiveTier()` are not modified · only the activation precondition is added.
    - UI messaging ("themes trial active · business trial available after themes trial ends" and vice versa) belongs to G6, not G1.
    - Enforcement is concurrency-safe per Q2 (see safeguard S1 below).

  - **D2 APPROVED · two-action design with Action 1 only in pilot** ·
    - **Action 1 · "Finish my trial without paying" · PILOT** · opts out of paid conversion without ending the trial. Shop access continues for the full 168 hours and becomes read-only at expiry unless a valid paid conversion occurs. **Must not end the trial early. Must not cause any charge, including under retry or recovery paths.**
    - **Action 2 · "End my trial now" · DEFERRED** · not included in the pilot UI. Not implemented in G1. If needed later, requires its own explicit design and approval.

  - **D2-a APPROVED** · Action 1 reversibility · reversible until 24 hours before `business_trial_end_at`. After that cutoff, the user can still use the trial until expiry but cannot reverse the opt-out through the trial flow. A reversal endpoint (`POST /api/nex-native/trial/resume-conversion-interest`) sets `business_trial_conversion_opt_out = false` when the precondition `(business_trial_end_at - now()) > interval '24 hours'` holds. Idempotent.

  - **D2-b APPROVED** · Action 2 reversibility · N/A · Action 2 is deferred from pilot.

  - **D2-c APPROVED** · Action 2 pilot inclusion · deferred. Action 2 and its endpoint are NOT added to G1 merely because they appeared in the original proposal.

  - **Schema addition PROPOSED (not applied by this entry)** · `nex_account.business_trial_conversion_opt_out boolean NOT NULL DEFAULT false`. This column is added via the G1 migration when that migration is separately authorised. No migration is applied by this change-log entry.

  **E · Required safeguards for the G1 design package (owner-mandated · S1-S4):**

  - **S1 · Atomic trial transitions** · the one-trial-per-lifetime rule (K1), themes-trial exclusion (D1), and expiry handling (K9) must remain correct under concurrent requests and retries. The G1 design must present a database-level or transactional safeguard and prove correctness with simultaneous-activation regression tests.

  - **S2 · No premature read-only state** · the earlier G1 proposal's "cancellation → immediate expired → immediate read-only" behaviour is retired. Approved behaviour is Action 1 (opt out, trial continues to full 168 hours, read-only at expiry) only. Shop read-only enforcement must be coordinated with G2 and the expiry lifecycle · G1 must NOT assume read-only enforcement exists.

  - **S3 · Payment-at-expiry interactions** · the G1 design must define exactly how `business_trial_conversion_opt_out` interacts with payment attempts, retries, and conversion at expiry. **Opting out must never produce a charge under any retry or recovery path.** G3 payment integration must honour the opt-out flag before any charge attempt.

  - **S4 · Pilot audit mechanism** · if manual SQL operations are required during the pilot (e.g. founder-level trial reset for abuse review per Q1), the G1 design must define a documented audit mechanism available at that time. Reliance on `nex_billing_attempt` is NOT acceptable (that table ships at G3). Pilot audit mechanism is a G1 design deliverable and must be reviewed before G1 implementation is authorised.

  **F · Deliverable required before G1 implementation drafting:**

  A G1 design package containing: proposed migration SQL (text only · not applied) · endpoint contract specifications · state-transition table · regression-test plan · S1-S4 safeguard designs · must be presented as a reviewable deliverable. The owner reviews this package as a separate gate before authorising any application-code or migration-file changes.

  **G · Status after this entry:**

  - **G0 remains open.** The register and all approvals are now sealed into the doctrine · G0 review itself has not been formally closed by owner declaration.
  - **G1 implementation drafting NOT authorised.** Requires separate explicit authorisation after the G1 design package is produced and reviewed.
  - **G2-G8 NOT authorised.**
  - **Approved items:** K1 · K9 · K14 · X3 · X8-D1 · X8-11 · Q1 · Q2 · Q3 · Q4 · Q5 · Q6 · Q7 · D1-coexistence · D2-two-action · D2-a-reversible-until-24h · D2-b-no-Action-2-in-pilot · D2-c-defer-Action-2 · Schema addition `business_trial_conversion_opt_out` PROPOSED (not applied) · Safeguards S1 · S2 · S3 · S4 mandated.
  - **Remaining UNDECIDED (not blocking G1):** K2 · K3 · K4 · K5 · K6 · K7 · K8 · K10 · K11 · K12 · K13.
  - **Conflicts tracked per original gate assignments:** X1 (resolved in principle by D1 approvals · G2 implementation verifies) · X2 · X4 · X5 · X6 · X7 · X9 · X10.

  **Working tree:** preserved · 123 changes identical to session start · no application code modified · no migration file created or applied · no commits · no cleanup. The only files touched by this authorisation are the Section C D1 line, the Section I precondition 11 line, and this Section N entry.

---

## Nothing is built from this document

To move forward, owner authorisation is required at each gate in Section J. The sequence is:

1. **Owner reviews this document · flags any corrections · approves G0.**
2. Open decisions in Section K are each resolved by owner choice.
3. G1 is authorised separately · schema migration drafted + reviewed · then applied.
4. Subsequent gates each require their own authorisation.
5. G8 (public pricing copy) does not fire until G7 (all 11 preconditions in Section I) passes.

**No build begins from this draft.** The owner's correction instruction is explicit: *"Do not authorise Phase 1, migrations, payment integration, cron jobs or public trial copy yet."*
