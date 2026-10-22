# NEX Package Promises · P1/P2/P3 Honesty Review

**Status:** 📋 Read-only evidence report · owner-recorded 2026-10-20
**Author:** Claude (recording code + test evidence · no edits made)
**Date:** 2026-10-20
**Scope:** Three customer-facing claims identified in Package Contract DRAFT Section 2 — P1 verified badge · P2 20 boosted messages · P3 cancel any time

> **What this document is:** per-claim evidence table showing exact
> customer-facing wording, enforcement state, test coverage, and the
> smallest honest resolution available.
>
> **What this document is NOT:**
> - It does NOT edit code, tests, public copy, doctrine, or migrations.
> - It does NOT change package prices or infer commercial terms.
> - It does NOT treat UI display or test mocks as proof of backend
>   enforcement.
> - It does NOT authorise any remove-or-build decision — those remain
>   owner calls.
> - It does NOT touch Phase A1's release hold or any prior hold.

---

## Correction to Package Contract DRAFT Section 2

The DRAFT lists specific locations for each claim. The evidence pass
found the DRAFT's references are **incomplete**:

| Claim | DRAFT reference | Verified reality |
|---|---|---|
| P1 verified badge | `/packages:482-486` + `/settings/tier:482` | **3 locations on `/packages`** (line 255 AddonCard · line 430 Gratis-off benefit · line 482 Bisnis-on benefit) · **ZERO on `/settings/tier`** (no "verified" or "badge" string in that file) |
| P2 20 boosted messages | `/packages:506-509` | ✓ matches |
| P3 cancel any time | `/settings/tier:486` | `/settings/tier:486` TrustBlock + ALSO `/packages:284` FAQ with behavioural promise ("drops to Gratis on next billing cycle") |

The matrix below uses the verified real-world locations.

---

## P1 · Verified ✓ badge

### Exact wording currently shown to customers

**Location 1 · `/packages/page.tsx:255-260` · "NEX Verified" AddonCard** (positions verified as a seller-paid add-on):

> **NEX Verified** · *One-time · seller-paid*
> Business registration + address + ownership verification. Unlocks
> the ✓ badge on your shop and Directory listing. Buyers can also
> purchase a detailed Verification Report for a small fee if they
> want the specifics.

**Location 2 · `/packages/page.tsx:430-434` · Gratis tier benefit list (off/unlocked-by-Bisnis)**:

> **Verified ✓ badge** · Bisnis unlock
> Visible verified checkmark · NEX confirms your registration +
> identity so buyers see the trust signal at a glance.

**Location 3 · `/packages/page.tsx:482-485` · Bisnis tier benefit list (on)**:

> **Verified ✓ badge on shop + directory**
> Trust signal from NEX verification of your registration and
> business identity.

**Internal wording inconsistency:** Location 1 presents the badge as a
*one-time seller-paid add-on*. Locations 2+3 present the same badge as
an *included Bisnis-tier benefit*. A customer paying Rp 99k/mo for
Bisnis cannot tell from this page whether they ALSO need to pay the
"one-time seller-paid" NEX Verified fee. The two presentations are
not reconciled anywhere in the page copy.

### Implementation + enforcement evidence

| Check | Result |
|---|---|
| `nex_account.is_verified` column | **NOT PRESENT** · zero matches in `src/app/`, `src/lib/nex-native/`, `src/components/nex-native/` |
| `nex_account.verified_at` column | **NOT PRESENT** · same scope, zero matches |
| `VerifiedBadge` component | **NOT PRESENT** · zero component file renders a verified badge based on a nex_account signal |
| Bisnis-tier gate that unlocks a badge | **NOT PRESENT** · no code reads `effectiveTier(account)==='bisnis'` and surfaces a verified mark |
| `nex_business.verified_at` + `verified_note` (migration 083 Bridge 30 · APPLIED) | **PRESENT in DB but UNUSED in UI** · zero references in `/packages`, `/settings/tier`, `[businessSlug]/*`, `src/components/nex-native/*` surface |
| Backend verification workflow (NEX reviews registration + address + ownership) | **NOT PRESENT** · zero service, admin surface, or review queue |
| NEX Verified AddonCard checkout / payment path | **NOT PRESENT** · the AddonCard describes a one-time fee but no code accepts the payment or records the purchase |
| Buyer-paid "Verification Report" referenced in AddonCard | **NOT PRESENT** · zero code for report generation, delivery, or payment |

### Test coverage

**Zero tests** verify any part of the P1 claim:
- No vitest file references `is_verified` on `nex_account`
- No test exercises a Bisnis-tier verification gate
- No test asserts the badge renders when a condition is met

The grep hits earlier in this cycle (`VerifiedBadge` wordspace) were false positives from legacy pre-NEX code (`compliance.ts`, `brains/`, `capability-runtime/`).

### Smallest honest resolution

Three distinct options. The owner must pick one.

| Option | What it means | Scope | Preserves customer trust? |
|---|---|---|---|
| **A · Remove the claim** | Delete all three /packages wordings. Keep the sealed Bridge-30 `verified_at` column on `nex_business` for future use. | Edit 3 locations in `/packages/page.tsx` · no backend work | Yes — honest. Removes a benefit customers may already associate with Bisnis. |
| **B · Reconcile to add-on only** | Keep the AddonCard (one-time seller-paid), remove the Bisnis-tier bundle wording from locations 2+3. Still requires the actual verification service to exist before launch. | Edit 2 locations · still need backend design before advertising | Partial — removes the Bisnis-bundles-it misread but still advertises an unbuilt add-on |
| **C · Build the verification system** | Design the verification workflow (what NEX actually reviews · who runs the review · how long it takes · what triggers the badge · what triggers revocation). Build data model (likely `nex_account.verified_at` + review state machine) · build UI (badge component + verification-request flow) · build admin review surface. | Multiple migrations · new admin surface · new review workflow · months of work | Yes — honest after built. Does nothing in the short term. |

### Dependencies and owner decision required

- **Dependency on NEX Verified AddonCard commercial model.** Location 1's "one-time seller-paid" implies NEX accepts money for verification. That contradicts the sealed "NEX never handles payments" doctrine on this very page. Needs reconciliation first.
- **Dependency on Bridge-30 unused columns.** `nex_business.verified_at` + `verified_note` already exist on live DB (migration 083 applied). Reusing them for the real workflow is cheaper than new columns.
- **Owner decision required:** pick one of A/B/C. If A or B, authorise the specific copy edit. If C, authorise the design pass as a separate workstream.

---

## P2 · 20 boosted messages per month

### Exact wording currently shown to customers

**Location · `/packages/page.tsx:506-509` · Bisnis tier benefit list**:

> **20 boosted messages per month**
> Highlighted messages that stand out in a buyer's inbox · use them
> for closing important orders.

### Implementation + enforcement evidence

| Check | Result |
|---|---|
| `boost_count`, `boosted_message_count`, `boost_quota` column anywhere | **NOT PRESENT** · zero matches in `src/lib/nex-native/`, `src/app/nex-native/` |
| `nex_boosted_message` table or migration | **NOT PRESENT** · zero file in `nex-supabase/migrations/*.sql` creates this |
| "Highlighted" message rendering in peer-chat composer / inbox | **NOT PRESENT** · zero component applies a boost-style render based on a per-message flag |
| Monthly quota reset logic | **NOT PRESENT** · no cron, no service, no reset function |
| Service that marks a message as boosted | **NOT PRESENT** · `nex_peer_message` schema has no boost column |

### Test coverage

**Zero tests** verify any part of the P2 claim. Earlier grep hits (`attention.test.ts`, `entity-reasoning.test.ts`, etc.) were false positives — those files use the English word "boost" in unrelated contexts (NEX brain reasoning, attention scores).

### Smallest honest resolution

| Option | What it means | Scope | Preserves customer trust? |
|---|---|---|---|
| **A · Remove the claim** | Delete the line + explain text at `/packages:506-509`. | Edit 1 location · no backend work | Yes — honest. Removes a benefit no customer currently gets. |
| **B · Reword to future-tense** | Change to "Highlighted-message quota · coming soon" or similar · reserve the feature without promising a quantity. | Edit 1 location · still needs backend work before launch | Partial — honest in form, still unbuilt |
| **C · Build the quota system** | Design: `nex_peer_message.boosted boolean` + `nex_account.boost_used_this_month integer` + reset-on-month-rollover + inbox render variant for boosted messages + composer "boost this message" toggle for Bisnis users. Multiple migrations · new UI · month-rollover job. | New migration + composer UI + inbox renderer + reset cron | Yes — honest after built. Nothing works short-term. |

### Dependencies and owner decision required

- **No existing partial implementation to repurpose.** Unlike P1 (which has Bridge-30 columns), P2 has nothing in-database to build on.
- **UI implication.** "Highlighted messages that stand out in a buyer's inbox" implies the inbox renderer differentiates. The current inbox treats all messages uniformly. Building P2 touches the chat inbox renderer which is in the sealed Chat Master Layout.
- **Owner decision required:** pick A/B/C.

---

## P3 · Cancel any time

### Exact wording currently shown to customers

**Location 1 · `/packages/page.tsx:284-285` · FAQ** (behavioural promise):

> **What happens if I cancel Bisnis?**
> Your account drops to Gratis on the next billing cycle. Your shop
> stays live, your products stay listed (subject to the 10-product
> cap), your chat history stays intact, and your NEX address
> (yourshop.nex) stays yours. Your reach automatically snaps back
> to local — international buyers won't see you in Directory search
> until you resubscribe.

**Location 2 · `/settings/tier/page.tsx:~486` · TrustBlock** (where-to-cancel promise):

> **Cancel any time**
> Every subscription can be paused or cancelled **from this page**.
> You keep access to what you paid for through the end of the
> current period.

### Implementation + enforcement evidence

| Check | Result |
|---|---|
| Customer-facing cancel UI on `/settings/tier` | **NOT PRESENT** · the page is a 1265-line pricing ladder · no cancel button, no "pause" button, no form POST that cancels or pauses |
| Customer self-service cancel server action | **NOT PRESENT** · zero `cancelTier` / `cancelSubscription` / `pauseSubscription` / `customerCancelAccountTier` in `src/app/nex-native/_actions.ts` |
| **Admin-only** cancel path · `adminSetAccountTierAction` | **PRESENT** at `src/app/nex-native/_actions.ts:6547`. Requires `nex_account.hq_role = 'admin'` via `requireHqAdmin()` sealed helper (added Phase 2.1). Gates on both the admin page AND independently (defence-in-depth · a forged form POST is rejected on its own merits) |
| State machine for cancel-with-grace-period vs cancel-immediately | **NOT PRESENT** · no "pending cancel" / "scheduled to downgrade on YYYY-MM-DD" state anywhere |
| Email notification on cancel | **NOT PRESENT** · zero template, zero sender, zero trigger |
| Gratis users (nothing to cancel) protection | **NOT PRESENT** · the TrustBlock says "every subscription" and would apply to Gratis users who have no subscription · copy is literally wrong for the Gratis case |
| Billing-cycle logic ("drops to Gratis on next billing cycle") | **NOT PRESENT at customer level** · the FAQ promise cannot be fulfilled because customer cannot initiate cancellation |
| **`nex_account.bisnis_expires_at` column** (migration 046 · APPLIED) | **PRESENT** · the admin-set `bisnis_expires_at` is the de facto expiry mechanism. If an admin sets it to a past date, the account effectively downgrades. But this is admin-only. |

### Test coverage

**Zero tests** verify a customer-facing cancel flow. The matching tests found earlier (`thumbnail-entitlement.test.ts`, `cooldown-service.test.ts`, etc.) were false positives — different "cancel" semantics (image upload cancel, cooldown bypass cancel).

The admin tier action has tests at `src/app/nex-native/__tests__/admin-action-role-gates.test.ts` but those verify authorisation, not customer cancel UX.

### Smallest honest resolution

Four options · P3 has the most layered copy.

| Option | What it means | Scope | Preserves customer trust? |
|---|---|---|---|
| **A · Remove both locations** | Delete the FAQ (packages:284) and the TrustBlock (settings/tier:486). | 2 locations · no backend work | Yes — honest. Removes two cancel-related promises that have no backing surface. |
| **B · Reword both to the current admin-only reality** | FAQ: "Message NEX1 support to cancel Bisnis" (routes to admin workflow). TrustBlock: remove `from this page`, replace with "Contact NEX support to cancel" + fix Gratis-user applicability. | 2 locations · no backend work · operations load on NEX support | Yes — honest. But adds support-ticket load every time a customer cancels. |
| **C · Build customer self-service cancel** | New customer-facing cancel UI on `/settings/tier` · new `cancelOwnBisnisAction` server action · state machine for "scheduled cancel at `bisnis_expires_at`" vs "immediate downgrade" · email on confirmation · correct copy for Gratis case · tests. | New server action · new UI · new email templates · 2 copy fixes | Yes — honest after built. Significant engineering effort. |
| **D · Build + grace-period handling** | Everything in C PLUS the "keep access through end of current period" promise. Requires billing-cycle logic (currently only `bisnis_expires_at` timestamp). Would need pro-rata handling if customer upgrades mid-cycle. | C + billing-cycle engineering | Yes — matches the current FAQ promise verbatim. Most work. |

### Dependencies and owner decision required

- **The TrustBlock promise says "from this page."** No matter which option is chosen, the current wording is literally false. Even B (route through support) requires editing the TrustBlock.
- **Gratis-user copy error.** The TrustBlock applies "Cancel any time" to "every subscription" including Gratis which has no subscription. This is independent of the enforcement question — the copy itself is wrong on day one for free users.
- **Admin HQ role gating.** Any migration to self-service cancel must preserve the HQ admin gate on `adminSetAccountTierAction` (migration 206 not yet applied, but the TypeScript gate `requireHqAdmin` is in place today).
- **"Refund within 7 days" sibling claim.** The /settings/tier TrustBlock cluster also contains a 7-day refund promise. Not in the P1/P2/P3 scope but adjacent · worth owner awareness that resolving P3 may surface the same honesty question for the refund TrustBlock.
- **Owner decision required:** pick A/B/C/D. C/D are new workstreams.

---

## Decision table · summary

| Claim | Current state | Resolution options | Smallest honest route | Owner decision needed |
|---|---|---|---|---|
| **P1 · Verified ✓ badge** | 3 locations on `/packages` · wording inconsistent (add-on vs Bisnis bundle) · 0 enforcement · Bridge-30 unused columns exist on business table | A remove · B reconcile to add-on · C build | **A** removes the fastest honesty gap · **B** requires backend design before launch · **C** is a multi-month workstream | Pick A/B/C · if A, authorise 3 copy deletes · if C, authorise design pass |
| **P2 · 20 boosted messages/month** | 1 location on `/packages` · 0 enforcement · nothing in DB to reuse · touches sealed Chat Master Layout | A remove · B reword to coming-soon · C build quota system | **A** · smallest and most honest · nothing to reuse means C is pure new build | Pick A/B/C · if A, authorise 1 copy delete · if C, authorise design pass |
| **P3 · Cancel any time** | 2 locations · FAQ promise + TrustBlock promise · "from this page" literally false · Gratis-user copy error · admin-only cancel today | A remove both · B reword to support-ticket · C self-service · D self-service + grace-period | **A** or **B** · both close the honesty gap without new engineering · B adds support-ticket load | Pick A/B/C/D · if A, authorise 2 copy deletes · if B, authorise reword + Gratis-case fix · if C/D, authorise new workstream |

---

## Remaining uncertainty

1. **The DRAFT's line references were partially stale.** The matrix above uses verified real-world evidence. If the DRAFT is edited again, the location references should be updated.
2. **The AddonCard "NEX Verified" has its own commercial status I did not scope.** The AddonCard promises verification as a "one-time seller-paid" service. This contradicts the sealed "NEX never handles payments" doctrine from the same page. Resolving P1 may require also resolving this contradiction. **Not in scope of this report** · surfaced for owner awareness.
3. **The 7-day refund TrustBlock sibling.** Same pattern as P3. Not in this report's scope · surfaced for owner awareness. If owner picks A/B for P3, the refund TrustBlock becomes the next natural honesty check.
4. **The `nex_business.verified_at` column (migration 083)** is unused in all pricing UI but is applied in live DB. Future P1-build work could reuse it OR deprecate it. The reuse decision depends on whether "verification" is at account level or business level.
5. **Phase A1 Accommodation release hold** remains independent of this report. Phase A1 does not advertise P1/P2/P3.

---

## Boundaries honoured

- No code, test, public copy, doctrine, or migration edited
- No DB connection made
- No feature flag changed · `isFamilyProductionEnabled` FALSE · `isEmergencyLiveMode` FALSE · `isFamilySafetyEnabled` TRUE unchanged
- No price change
- No commercial-term inference beyond what the copy already says
- Phase A1 release hold intact · all prior holds intact
- Package Contract DRAFT not promoted to LOCKED
- Family Safety proposal not touched
- Family Safety readiness checklist not touched
- Migration reconciliation matrix not touched
- No unrelated uncommitted work altered

Stopping here per directive. Owner picks A/B/C(/D) for each claim.
