# NEX Package Contract · DRAFT

**Status:** 📝 DRAFT · owner-recorded 2026-10-20 (DECISIONS only · implementation NOT authorised)
**Author:** Claude (recording owner-authored decisions)
**Date:** 2026-10-20
**Blocks:** Any public package copy change without separate authorisation
**Supersedes:** nothing (first package contract draft)

> **What this draft means:** The nine decisions below are the
> owner-recorded direction for how NEX packages describe themselves
> to customers. Future revisions require a new owner-authored
> change.
>
> **What this draft does NOT mean:** no implementation is scheduled
> or authorised. No W-item is unblocked. No public copy on
> `/packages`, `/settings/tier`, or `/admin/tier` is changed. The
> Vault Entitlements Policy stays LOCKED. Phase A1 release stays
> on hold. S1 / S2 / S3 await separate authorisation. W1–W12
> remain unscheduled. Migration 213 remains unauthorised.

---

## The company-wide operating rule (owner-sealed 2026-10-20)

> **Sell clear benefits. Enforce entitlements on the server.
> Verify the customer experience. Never promise a feature simply
> because it appears in a design or database.**

Every row below is subject to this rule. A decision to "offer X"
is not a decision to "advertise X today." Advertisement follows
server-side enforcement + verified customer experience, not the
other way around.

---

## Section 1 · Six core decisions

### D1 · Custom themes · Owner decision: C (Both routes)

**Decision:** Offer two routes for customers to use their own
theme:
- **Self-service upload** through a secure, validated process
  **once that capability exists**.
- **Bespoke design** · customers pay NEX to create a personalised
  theme.

**Follow-on obligations before launch:**
- Upload endpoint with validation, format allow-list, size
  limits, moderation gate · does not exist today (grep zero).
- Bespoke-design flow · aligns with the existing `/settings/tier`
  "Own Theme Request" tier (Rp 1,000,000). Workflow + handoff
  from customer request to designed theme must be defined.
- Pricing for self-service upload decision pending (bespoke
  pricing already present at Rp 1,000,000 in current ladder).

**Advertisement rule:** NEX advertises self-service upload only
after the capability exists AND passes security + moderation
review. Advertises bespoke immediately only if the existing
request flow is operational end-to-end; otherwise defer that
copy too.

### D2 · Theme updates · Owner decision: A (Automatic, with safeguards)

**Decision:** A customer buys a theme once and receives future
animation improvements **without paying again**. NEX must:
- Preserve the purchased theme (owner's original experience
  stays available).
- Test new versions before they ship to owners.
- Retain a way to recover the previous version if an update
  causes problems.

**Follow-on obligations before promising this publicly:**
- Theme-version concept in schema (not found today).
- Refresh-on-unlock or similar delivery mechanism.
- "New version available" prompt + rollback UI (if automatic
  updates include a user-visible transition).
- Ownership + update delivery verified before copy ships.

**Advertisement rule:** NEX advertises "future animation updates
included" only after ownership persistence AND update delivery
AND rollback path are implemented and verified.

### D3 · Theme purchase and directory exposure · Owner decision: A (Separate products)

**Decision:** Buying a theme buys the theme, not a Business
subscription or extra directory exposure.
- **Theme purchase:** personalisation only.
- **Business subscription:** business tools + applicable
  business visibility benefits.
- **Directory search:** remains free according to approved
  free-tier rules.

**Follow-on obligations:**
- Current enforcement at `src/lib/nex-native/directory/thumbnail-entitlement.ts:90`
  already matches this decision (`"buy"` grants no merchandising
  upgrade). **No code change required for the base rule.**
- Marketing copy and the Paid Chat Themes package definition
  must not imply any directory benefit from a theme purchase.

**Advertisement rule:** All three product descriptions must
make the separation unambiguous. "Buy a theme to look great"
is honest. "Buy a theme to be found" is not — that is the
Business subscription.

### D4 · Free chat appearance · Owner decision: C (Verify before promising)

**Decision:** First establish whether "chat bubbles" and "plain
on-screen text" are two separate display modes or merely
different theme appearances.

**Follow-on obligations before any package copy is finalised:**
- Targeted read-only verification pass against the chat renderer
  (likely `src/app/nex-native/chat-standard/_live-worlds.ts` +
  renderer components).
- Determine whether a toggle between a "bubbles" mode and a
  "text-on-screen" mode exists, OR whether both are theme
  variants.
- If distinct modes exist, confirm both are available to Gratis
  tier.
- If no distinct modes exist, the package copy must NOT promise
  "a choice between two display styles" · the Free NEX Chat
  description must be reworded.

**Advertisement rule:** No promise of two display modes until
verified. If verification shows the feature doesn't exist today,
building it is a separate authorisation decision.

### D5 · Seven-day trial · Owner decision: B (Full Business trial)

**Decision:** Keep the current full-Business trial model,
**provided NEX can afford the cost and the trial rules are
clear**. Customers can experience the whole Business package for
seven days, not just themes.

**Required operational discipline:**
- Trial start and end dates computed from a defined expiry
  timestamp (not "day 7" phrasing).
- One-trial-per-account rule enforced (currently via
  `themes_trial_used_at` at `account-service.ts`).
- What happens when the trial ends must be accurate and tested.
- Trial is treated as a **deliberate customer-acquisition
  investment**, not an accidental entitlement.

**Follow-on obligations:**
- Current implementation at `account-service.ts:328` already
  returns `tier = "bisnis"` during the trial window · matches
  decision B. **No code change required for the base
  mechanic.**
- Trial-end communication path must be verified (does the user
  know their trial expired? does the downgrade behave
  predictably?).
- Trial grants ALL Bisnis features (12 directory slots, featured
  placement, international visibility, etc.) · this hidden
  subsidy is now **explicitly intentional** rather than
  accidental.

**Advertisement rule:** Trial copy must state honestly that the
seven days unlock the full Business package. Must not imply
anything persists past day 7 without a paid subscription.

### D6 · Vault · Owner decision: A (Defer public promotion)

**Decision:** Vault remains a planned Business benefit, but is
**omitted from public package promises** until the required
safeguards and verification evidence per the LOCKED Vault
Entitlements Policy (2026-10-20) are complete.

**This decision does NOT authorise:**
- Reopening or amending the locked Vault Entitlements Policy.
- Creating the missing `vault_tier` database column.
- Scheduling or implementing W1–W12.
- Changing existing Vault copy on `vault/intro/page.tsx` (which
  carries the separately-flagged misleading claims about "100%
  PRIVATE" and "Always Available").
- Adding any Vault bullet to the Business package definition in
  §3 below.

**Advertisement rule:** The Business package in §3 lists Vault
as explicitly excluded from public promises. The policy §D
default stays in force: Business card OMITS Vault entirely.

---

## Section 2 · Three existing-promise corrections

The owner recorded that each of these follows the professional
operating rule: a benefit may be advertised only when NEX can
deliver it as described.

### P1 · Verified business badge · Owner decision: Defer

**Current state:** advertised on `/packages:482-486` and
`/settings/tier:482`. No `is_verified` / `verified_at` column
in `NexAccountRow`. No badge-render component. No tier gate.

**Decision:** Defer the promise until the verification process,
data model, display, and enforcement are proven.

**This decision does NOT authorise:**
- Editing the existing public pages or copy yet.
- Creating a verification schema or implementation.

**Separately needed:** an owner authorisation to EITHER remove
the claim from existing copy, OR to design and build the
verification system. Until then, the claim remains on the page
but under this recorded doctrine.

### P2 · 20 boosted messages per month · Owner decision: Defer

**Current state:** advertised on `/packages:506-509`. No
`boosted_message` table, no quota counter, no enforcement.

**Decision:** Defer the promise until the monthly allowance,
counting, reset rules, and enforcement work reliably.

**This decision does NOT authorise:**
- Editing the existing public pages or copy yet.
- Building a quota system.

**Separately needed:** same shape as P1 · either remove the
claim OR design and build the quota system.

### P3 · Cancel any time · Owner decision: Establish process + verify first

**Current state:** advertised on `/settings/tier:486`. Admin-only
cancellation path today via `adminSetAccountTierAction`. No
customer-facing cancel UI. Gratis users have nothing to cancel
yet the copy applies globally.

**Decision:** Establish a genuine customer cancellation process
and verify how cancellation, paid access, and expiry work
before making this promise.

**This decision does NOT authorise:**
- Editing the existing public pages or copy yet.
- Building a customer self-service cancel UI.

**Separately needed:** owner authorisation to design and build
the cancellation flow (customer-facing form + state machine for
cancel-with-grace-period vs cancel-immediately + email notifications)
AND to correct the copy to not promise it to Gratis users.

---

## Section 3 · Resulting package definitions

These are **package definitions**, not sales copy. They do not
confirm every listed feature is production-ready. Existing
prices are not changed by this draft.

### Free NEX Chat · Rp 0

**Headline:** Free communication and discovery.

**Includes:**
- Chat and confirmed free chat features (subject to D4
  verification of what "chat appearance" means).
- Search the NEX directory.
- Find businesses, services, and new friends.
- Connect and communicate through supported NEX features.
- Voice and video calling, **subject to final end-to-end
  verification** that no tier-gate, device restriction, or
  cost obligation applies.

**Must not promise:** anything that depends on paid tiers
(featured placement, 12 directory slots, verified badge, boosted
messages, CSV export tier-gating, Vault).

### Paid Chat Themes · One-time payment per theme

**Headline:** Personalisation without a recurring theme fee.

**Includes:**
- Choose from the available theme library.
- Keep purchased theme ownership under the confirmed ownership
  rules (D3 separation + migration 193–194 permanence).
- Receive future animation updates under the agreed update
  policy (D2 · subject to the follow-on obligations before
  that copy ships).
- Custom uploads and bespoke themes **once their respective
  processes are ready** (D1 · subject to self-service upload
  capability existing).
- Keep free NEX directory and connection features.

**Must not promise:** any Business tool, any directory visibility
upgrade, any extra listing slots, any Business subscription
benefit. Theme ownership and Business subscription are separate
products (D3).

### Business NEX Chat · Recurring Business subscription

**Headline:** Tools for businesses to present themselves and
connect with customers.

**Includes:**
- Business theme choice or approved custom theme (per D1 scope).
- Business shop page and cover (verified: migration 212 +
  `shop-cover-service.ts`).
- Free directory listing, with visibility benefits governed by
  Business entitlements (`thumbnail-entitlement.ts:173` · 12
  slots + featured placement).
- Shareable NEX bio link (`/nex-native/bio/[nex_handle]`).
- Customer chat and supported business features.

**Explicitly excluded from the Business package definition
until requirements met:**
- **Vault** · per D6 and the LOCKED Vault Entitlements Policy §D.
- **Verified ✓ badge** · per P1.
- **20 boosted messages / month** · per P2.
- **"Cancel any time"** · per P3 (until customer cancel process
  exists).
- **Tier-gated CSV export** · currently session-only, not
  tier-gated per audit; must either be gated in code AND
  advertised, or neither.

**Pricing:** existing Rp 99,000/month on `/packages` remains
unchanged by this draft. The regional-pricing proposal in the
pricing memory remains a PROPOSAL and is NOT activated.

---

## Section 3B · Safety-feature benefits · DRAFT · recorded 2026-10-20

> **Why this section exists:** the owner authorised recording the
> intended safety-feature benefits honestly (Family Safety +
> Emergency Help) so they are visible in the Package Contract DRAFT
> without being promised in public copy. All claims below declare
> their current implementation status · a benefit must advance to
> "VERIFIED LIVE" before public `/packages`, `/settings/tier`, or
> any marketing surface may reference it as a working feature.

### S1 · Family Safety · Phase 1 pilot · Free · owner-recorded 2026-10-20

**Benefit line (proposed · NOT in public copy):**
"Create a Family Safety link between a guardian and a child, with
consent on both sides. Either side can revoke at any time. The
child can privately raise a 'pressure signal' to NEX. SafeChat
classification is SIMULATED until a real-world launch is
separately authorised. New permissions default to OFF."

**Implementation status (verified 2026-10-20):**

| Area | State | Evidence |
|---|---|---|
| UI surfaces | Shipped | `/nex-native/family-safety` + 9 sub-routes (accept · age-transition · create-child · custody · dashboard · invite · link · manage) |
| Settings discoverability | Shipped w/ PILOT chip 2026-10-20 | `settings/page.tsx` HeroTileCard renders PILOT marker before tap |
| Pilot disclosure | Shipped | FamilySafetyShell renders "SIMULATED · PILOT" banner on home + explicit "What this does / doesn't do" lists on `page.tsx` |
| Discoverability feature-flag | ON by default | `isFamilySafetyEnabled()` defaults TRUE |
| Production feature-flag | OFF by default | `isFamilyProductionEnabled()` defaults FALSE · gates real-world writes (child-account activation, SafeChat logging, pressure-signal routing to HQ) |
| Service layer | Shipped | `src/lib/nex-native/family-safety/{home,dashboard,contact-visibility,feature-flag}-service.ts` + graceful `db_unavailable` branch |
| DB layer | **NOT MIGRATED** | Zero migrations in `nex-supabase/migrations/` for `nex.family_link` or `nex.account_age_attestation` · raw-SQL reads in `home-service.ts` reliably hit the graceful "temporarily unavailable" branch on live DB |
| Linking flow | NOT functional end-to-end | Blocked by DB layer absence |
| Location tracking | Not implemented · explicitly excluded by owner directive 2026-10-20 | n/a |

**Advertisement rule for S1:** NEX must NOT advertise Family
Safety as a working feature on any public tier page until (a) the
DB migrations for `nex.family_link` + `nex.account_age_attestation`
land in `nex-supabase/migrations/`, (b) a verified end-to-end
linking flow exists, (c) the PILOT marker is replaced with the
appropriate status, and (d) separate owner authorisation is given
to list it. Until all four conditions are met, S1 is recorded here
as a pilot/discoverable surface only.

**Package placement when authorised:** Free NEX Chat tier (all
users). Family Safety is a safety feature, not a tier upgrade ·
S1 remains free regardless of future pricing structure.

**Price history search (2026-10-20):** The owner noted a possible
Rp/USD "4.99" price for Safe Chat / Family Safety features. A full
git-history search was run against this repository:

- `git log --all --oneline --grep="4.99|4\.99"` → **zero commits**
- `git log --all -S "4.99" --oneline` → zero commits introducing
  the literal `4.99` at any Safe Chat or Family Safety file
  (matches found are unrelated: a Facebook SVG `9.878v-6.987h-2.54V12h2.54V9.797`,
  a Twitter SVG `4.99`, a `£14.99` placeholder in refacing-membership,
  a `£5,495` currency example in mutations/types.ts, and a `£29.99/month`
  active refacing price)
- `grep -r "4\.99|4,99" src/ docs/` current tree → zero
  Safe-Chat-pricing hits
- `git log -S "safe chat"` → no commits mentioning a Safe Chat
  pricing decision

**Conclusion:** no evidence a Rp/USD 4.99 price for Safe Chat
or Family Safety was ever introduced in this repository. Any
future pricing decision for S1 is a separate authorisation ·
S1 is recorded as **free · pilot** in this draft.

### S2 · Emergency Help · Phase 1 pilot · Free · owner-recorded 2026-10-20

**Benefit line (proposed · NOT in public copy):**
"Open Emergency Help with a two-tap confirmation. Simulated
delivery · nothing is broadcast and no real responders are paged
in this pilot build. Call local emergency services for a real
emergency. Trusted-contact and responder opt-in surfaces exist
so the shape of the feature is reviewable, not relied upon."

**Implementation status (verified 2026-10-20):**

| Area | State | Evidence |
|---|---|---|
| UI surfaces | Shipped · 6 routes | `/emergency-help` (confirm) · `/active` · `/history` · `/incident/[id]` · `/responder` · `/trusted-contacts` |
| Simulated badge | Shipped · universal | `SimulatedBadge` component (`SIMULATED · v1` chip) rendered at `EmergencyConfirmationScreen`×5 states · `ActiveIncidentView`×6 states · `/history` + `/incident/[id]` page-level · `ResponderOptInForm` · `TrustedContactsList` · `EmergencyHelpEntryCard` |
| Settings discoverability | Shipped | `settings/page.tsx` hero tile `/nex-native/emergency-help` with 🚨 danger tone |
| Drawer discoverability | Shipped 2026-10-20 | Control-drawer dark-red Emergency Help row rendered at top of drawer body · `EmergencyHelpRow` in `control-drawer-client.tsx` · subtitle reads "Simulated · pilot" |
| Delivery feature-flag | OFF by default | `isEmergencyLiveMode()` requires explicit `NEX_EMERGENCY_LIVE_MODE === "true"` · defaults FALSE · `incident-service.ts:100` short-circuits service-layer writes when not live |
| Server→client wiring of live-mode | **GAP** | Server shells (`/emergency-help/page.tsx` + `/active/page.tsx`) do not explicitly pass `simulated={!isEmergencyLiveMode()}` to the client views · views default `simulated = true` · in the current state both agree (both default to simulated) · if `isEmergencyLiveMode()` ever flips TRUE at the server, the UI would still display SIMULATED unless the server shell is updated to pass the resolved prop |
| Real-alert delivery | NOT implemented | Live-mode writes are short-circuited at the service layer · no SMS/push/responder-paging pipeline exists in the repo |
| Consent handling | Partial | Trusted-contacts opt-in UI exists · responder opt-in UI exists · both backed by `_mock-service.ts` loaders |

**Advertisement rule for S2:** NEX must NOT describe Emergency
Help as a live alert channel on any public page until (a) the
service-layer delivery pipeline is designed, implemented, and
reviewed (SMS/push/responder paging) · (b) consent and failure
handling are specified · (c) the server→client live-mode prop
wiring is corrected so UI honesty tracks service-layer state ·
(d) separate owner authorisation is given to flip live mode.
Until then, S2 is recorded here as a simulated pilot surface
only. The simulated badge language ("SIMULATED · v1") remains
load-bearing · do NOT translate or shrink without founder
decision (sealed in `SimulatedBadge.tsx` doctrine comment).

**Package placement when authorised:** Free NEX Chat tier (all
users). Emergency Help is a safety feature · S2 remains free
regardless of future pricing structure.

**Phase 2 proposal:** a separate Phase 2 implementation proposal
(delivery pipeline, consent, failure handling, responder paging,
PII handling, retention) remains pending owner authorisation per
the 2026-10-20 directive. Not drafted in this file.

### S3 · Shared operating rule for safety features

- Safety features ship behind clearly-labelled pilot/simulated
  markers until end-to-end functional AND separately authorised.
- Safety features default FREE · tier gating of safety features
  is not permitted without separate owner authorisation.
- Discoverability (hero tiles, drawer entries) carries its own
  honesty marker when the backing flow is not functional (per S1
  PILOT chip + S2 dark-red row with "Simulated · pilot" subtitle).
- Server→client live-mode wiring must be explicit on every
  safety surface so UI status tracks service-layer state ·
  implicit defaults are a honesty risk if a flag flips.
- No real alerts, no real linking, no real location tracking,
  no real responder paging without separate explicit owner
  authorisation per flow.

---

## Section 4 · Downstream work this draft implies (NOT authorised here)

Each item below would require separate owner authorisation. No
scheduling, no implementation, no code change is authorised by
recording the decisions above.

| Area | Work implied | Blocked by |
|---|---|---|
| D1 self-serve upload | New upload endpoint + validation + moderation gate + size/format limits | Scoping decision + separate implementation authorisation |
| D1 bespoke flow | Verify existing "Own Theme Request" workflow is operational end-to-end | Separate verification pass |
| D2 theme versioning | Schema version column + refresh mechanism + rollback | Separate implementation authorisation |
| D4 chat-appearance verify | Targeted read-only verification pass against renderer | Separate audit authorisation (lightweight) |
| D5 trial-end comms | Verify downgrade + user communication at trial end | Separate verification pass |
| D6 Vault | W1–W12 per the LOCKED Vault Policy | LOCKED Vault Policy §D + separate W-item authorisations |
| P1 Verified badge | Decide: remove claim OR build verification | Separate owner decision + implementation authorisation |
| P2 20 boosted messages | Decide: remove claim OR build quota system | Separate owner decision + implementation authorisation |
| P3 Cancel any time | Build customer cancel flow + correct copy for Gratis users | Separate owner decision + implementation authorisation |
| Package public copy | Rewrite `/packages` and `/settings/tier` to match this contract | Separate copy-change authorisation after D1–D6 + P1–P3 settled |
| S1 Family Safety DB | Author migrations for `nex.family_link` + `nex.account_age_attestation` (parent-child link, consent states, revocation, custody transition, age attestation) · verify SQL in service layer matches schema · DB apply via Safety Constitution §5 gate | Separate owner authorisation (DB migration + production-flag flip are two independent gates) |
| S1 Family Safety linking flow | Verify create-child → invite → accept → active state transitions end-to-end once DB lands · verify revocation + pressure-signal paths | Blocks on S1-DB · requires separate verification authorisation |
| S1 PILOT marker lifecycle | When S1 flow is verified end-to-end, decide: remove PILOT chip OR replace with "LIVE · beta" marker OR keep PILOT until a broader launch | Blocks on S1-DB + flow verification · owner decision |
| S2 Emergency delivery Phase 2 | Design + implement SMS/push/responder-paging delivery pipeline · consent capture · failure handling · PII handling · retention policy · live-mode flip proposal | Separate owner Phase 2 proposal + authorisation |
| S2 Emergency live-mode wiring | Correct server shells `/emergency-help/page.tsx` + `/emergency-help/active/page.tsx` to pass `simulated={!isEmergencyLiveMode()}` to client views so UI honesty tracks service-layer state | Small code change · owner can authorise independently of Phase 2 |

---

## Section 5 · What this draft does NOT do

- Does NOT change any file in `src/app/nex-native/packages/`.
- Does NOT change `/settings/tier` copy.
- Does NOT reopen the LOCKED Vault Entitlements Policy.
- Does NOT create the missing `vault_tier` column.
- Does NOT schedule or implement W1 through W12.
- Does NOT start S1, S2, or S3.
- Does NOT apply any migration (including 213).
- Does NOT change any price (existing Rp 99,000/month on
  `/packages`, existing 7-tier IDR ladder on `/settings/tier`
  remain as-is).
- Does NOT remove or alter the three advertised but
  unimplemented claims (verified badge, 20 boosted messages,
  cancel any time) · their removal/correction is a separate
  authorisation per P1–P3.
- Does NOT touch Phase A1 release hold.
- Does NOT add Family Safety or Emergency Help to any public
  package copy (per Section 3B advertisement rules S1 and S2).
- Does NOT change Family Safety discoverability behaviour (hero
  tile stays visible, PILOT chip added 2026-10-20 per sealed
  owner directive).
- Does NOT change the `isEmergencyLiveMode()` default (stays FALSE
  · all deliveries simulated).
- Does NOT author or apply any Family Safety DB migration
  (S1-DB downstream work remains blocked on separate owner
  authorisation per Safety Constitution §5).
- Does NOT change the "SIMULATED · v1" chip wording or shrink
  the badge (load-bearing per `SimulatedBadge.tsx` doctrine).
- Does NOT lock these decisions beyond "draft recorded for owner
  review." A final lock would require an owner-signed revision
  of this file.

---

## Section 6 · Approval checkpoint

The owner's words (verbatim): *"I recommend recording the six
decisions and three promise decisions as a draft for your review.
Implementation would still require separate approval, and all
existing holds remain unchanged."*

This file records those decisions. The next decision belongs to
the owner:
- Keep as DRAFT and move on to another topic.
- Promote to LOCKED with a separately signed authorisation
  (parallel to how the Vault policy was locked).
- Revise any D or P row before locking.
- Authorise one specific follow-on work item from Section 4.

No implementation downstream of this file without a separate
explicit authorisation per item.
