# NEX Founder Engineer — Foundation-to-Near-Live Master Plan

**Pass:** 2 of N — **PLANNING + RECONCILIATION (owner challenges applied in-place)**
**Authorised:** Owner, 2026-11-24 (planning task; no implementation permission)

> **Pass 2 — owner reconciliation 2026-11-24.** Owner reviewed Pass 1 and did
> NOT approve Gate 1. Five corrections applied in this pass, in place:
>
> 1. Launch pillars are **NEX Chat · NEX Shop · Chat Themes**. Vault (NEX-013) is **OPTIONAL — NEX Store add-on** and not a launch blocker. GAP-NAV-002 (Vault drawer row) is reclassified OPTIONAL.
> 2. Emergency Help (NEX-020) is **DEFERRED — SANDBOX-ONLY · intentional.** Live-activation gates are owner-closed (sealed 2026-11-09 + 2026-11-23 Option C). It does NOT auto-block launch. Splash SOS decision screen stays launch-critical only for users who have already opted in.
> 3. Chat-privacy bucket finding is **reconciled against the actual upload routes.** See new §4A. Verdict is NOT "privacy claim false" — new uploads are refused unless the private bucket is provisioned (fail-safe 503) and plaintext uploads are default-frozen (410 Gone). Residual concern is legacy historical rows + sandbox mig 295 application state.
> 4. §11 split into **(A) genuine Founder decisions** (commercial · privacy · launch scope · irreversible prod · legal) and **(B) engineering decisions the autonomous team resolves** inside approved scope.
> 5. §4 now carries **fully-populated launch-pillar journey cards** for Chat · Shop · Chat Themes (every axis the owner required). 10 LAUNCH-CRITICAL journey cards remain to populate at full depth — tracked in §15 REMAINING.
>
> The report required by the owner — BUILT · RECONCILED · VERIFIED · REMAINING · BLOCKED · FOUNDER DECISIONS REQUIRED — is in **§15** at the end of this document.
**Companion docs:**
- `docs/doctrine/nex-founder-mapping-audit-2026-11-24.md` — Mapping Audit (structure / data / integrations)
- `docs/doctrine/nex-navigation-transition-audit-2026-11-24.md` — Navigation & Transition Audit Pass 1 (85 NAV rows)
- `docs/product/nex-blueprint.md` — 6 user states, 11 sealed decisions, 6 gaps G-1..G-6, 23 feature IDs
- `docs/product/feature-ledger.md` — 23 NEX-* entries with current state
- `docs/engineering/session-handoff.md` — branch `release-audit-v1-2026-11-14`, HEAD `bdd2bf97`

**Freeze (restated):** no `src/` edits · no migrations · no DB writes · no ledger/blueprint changes · no HQ viewer changes · no commits · no push · no deploy · no agent spawn in this pass. Return the complete plan for Founder review before any implementation begins.

> **Doctrine seal — owner 2026-11-24.** Agents work to a Founder-approved product
> standard. Owner sets product direction, priorities, commercial logic and
> approval boundaries. Claude's job is to discover, research, design, challenge,
> implement approved work, test it, and keep documentation synchronised. QA must
> **independently** test the implementation — it does not accept the implementer's
> report. Human approval remains at: product strategy, money, privacy, security,
> irreversible data changes, production release.

---

## 1 · Actual current state

A reconciled snapshot across the two audits + feature ledger + blueprint.

### 1.1 · What is built (evidence present)

| Area | Evidence | Status |
|---|---|---|
| Six user states A–F | Blueprint §2 | DECIDED; state B still conflated with C (Gap G-1) |
| Splash + SOS decision | `src/app/nex-native/page.tsx`, `_splash-decision-screen.tsx` | SEALED 2026-11-23 |
| Three-way splash branch (G-2 fix) | `known-device-cookie.ts` + middleware | **MAPPED** · 12/12 unit tests · Playwright NOT RUN |
| Device-only E2E chat doctrine | Blueprint §9, sealed 2026-11-09 | DOCTRINE SEALED; schema-correction debt open (NEX-017) |
| Merchant-owned payments doctrine | Sealed 2026-11-10 | DOCTRINE SEALED; code present (NEX-016) |
| Side drawer inventory | `control-drawer-client.tsx:282` sealed by regression test | SEALED but **incomplete** — missing Create Shop and Activate Vault rows |
| HQ viewer · Mapping Audit | Built this cycle | MAPPED |
| Themes+ entitlement + pricing | Sealed 2026-11-13 | DECIDED; Stripe writer not authorised |
| Emergency Help personal-contacts-only + device-local location | Sealed 2026-11-09 | DOCTRINE SEALED; migrations 224/225 NOT APPLIED |
| Full-viewport + PWA install + location timing rules | Sealed 2026-11-24 | NEX-021/022/023 SEALED NOT VERIFIED |

### 1.2 · What is discovered but incomplete

From the Navigation Audit (Pass 1):

- **85 of ?** transitions numbered. True denominator unknown.
- **14 of 85 VERIFIED** (Playwright evidence); **4 BROKEN** (migration dependencies); **4 BLOCKED**; rest DISCOVERED.
- **0 of 85** fully MAPPED (all six outcome branches + reverse-direction card + state-before/after).
- **1 of ~180 routes** has a reverse-direction card.
- **8 of 85 transitions** have passing tests (9.4%).

From the Mapping Audit (Pass 1):

- 18 clean ledger entries, 2 medium drift (NEX-015 missing Stripe route; NEX-022 drawer row added despite "NOT STARTED"), 5 orphan feature zones, 13 dead server actions, 7 migration dependency risks.

From the Feature Ledger (23 entries):

- `NOT STARTED`: NEX-002, NEX-003, NEX-014
- `BLOCKED`: NEX-001 (B1–B5 unresolved)
- `PARTIAL`: NEX-005, NEX-009, NEX-011
- `CODE PRESENT (NOT VERIFIED)`: NEX-006, NEX-007, NEX-010, NEX-015, NEX-016, NEX-017, NEX-018, NEX-019, NEX-020, NEX-021, NEX-022, NEX-023
- `IMPLEMENTED (not verified this session)`: NEX-004, NEX-013
- `CODE PRESENT (merged)`: NEX-008
- `FOUNDER-ONLY PILOT`: NEX-012

### 1.3 · The seven critical gaps (owner-visible)

| ID | Gap | Impact |
|---|---|---|
| GAP-NAV-001 | **Create Shop drawer row missing** | Shop creation reachable only by direct-URL discovery — new customer cannot start selling |
| GAP-NAV-002 | **Activate Vault drawer row missing** | Vault reachable only via account menu — storage upgrades invisible |
| GAP-NAV-003 | NEX LIVE feature zone orphaned | Code present, no entry point |
| GAP-NAV-004 | Music feature zone orphaned | Code present, no entry point |
| GAP-NAV-005 | Group Calls feature zone orphaned | Code present, no entry point |
| GAP-NAV-006 | Family Safety feature zone orphaned | Code present, no entry point |
| GAP-NAV-007 | Notifications surface partial | Drawer entry partial, binding to events incomplete |

### 1.4 · The six blueprint gaps (G-1 … G-6)

| ID | Status | Needed |
|---|---|---|
| G-1 State B vs State C | OPEN | Owner approves `onboarding_complete` column |
| G-2 State D/E routing | **FIXED 2026-11-23** | Playwright journey test queued (Owner Proof #2) |
| G-3 State F key establishment | BLOCKED | Phase 4 §3 — commerce arch fork pending |
| G-4 Theme persistence pre-auth → auth | OPEN | Targeted read + Playwright journey |
| G-5 Shop offer screen unverified | OPEN | Verify checkout in sandbox first (NEX-015 gated) |
| G-6 Invite Friends / Share NEX ID discoverability | OPEN | Targeted reads to confirm mount |

### 1.5 · Honest denominators

- Routes: `≈180 discovered / exact N pending Pass 2`
- NAV transitions: `85 / ?`
- Mapped NAV (all branches + reverse card): `0 / 85`
- Verified NAV (test evidence): `14 / 85`
- Features from ledger VERIFIED to work end-to-end: `0 / 23` (no feature has evidence meeting the full near-live bar in §7)

---

## 2 · Intended launch product

**Classification framework (owner-approved doctrine):**

- **LAUNCH-CRITICAL** — required for first public user to succeed at the primary jobs (chat, create account, add contact; find and buy; create shop and sell; use Emergency Help).
- **LAUNCH-INFRA** — not user-visible but required for launch to function (session, auth, migrations, backups, deploy chain, observability).
- **LAUNCH-QUALITY** — important for launch perception (full-viewport, PWA install, perf budgets).
- **OPTIONAL** — present but not required for launch.
- **DEFERRED** — code exists, explicitly post-launch.
- **OUT-OF-SCOPE** — delete or archive.
- **NEEDS DECISION** — owner must choose before classification.

### 2.1 · Classification (Pass 2 · owner-reconciled 2026-11-24)

**Launch pillars (owner-stated):** NEX Chat · NEX Shop · Chat Themes.

Everything else is support infrastructure, launch quality, optional, deferred, or needs decision. Vault is reclassified OPTIONAL (NEX Store add-on). Emergency Help is reclassified DEFERRED-SANDBOX (intentional).

| ID / Gap | Classification | Rationale |
|---|---|---|
| NEX-017 Device-only E2E chat | **LAUNCH-CRITICAL · PILLAR** | Primary product — NEX Chat |
| NEX-015 Monthly shop billing | **LAUNCH-CRITICAL · PILLAR** | NEX Shop monetisation |
| NEX-016 Merchant-direct payments | **LAUNCH-CRITICAL · PILLAR** | Sealed commercial model for NEX Shop |
| NEX-008 Product sharing → checkout | **LAUNCH-CRITICAL · PILLAR** | Buyer side of NEX Shop |
| NEX-010 Shop templates + customisation | **LAUNCH-CRITICAL · PILLAR** | Shop must look non-broken + carries Chat Themes surface |
| GAP-NAV-001 Create Shop drawer | **LAUNCH-CRITICAL** | Entry point to NEX Shop |
| Chat Themes (Themes+ 2026-11-13 seal) | **LAUNCH-CRITICAL · PILLAR** | Owner-stated third launch pillar — entitlement + first-free + pricing + apply |
| NEX-004 Device-local outbox | LAUNCH-INFRA | Chat reliability |
| NEX-021 Full-viewport rule | LAUNCH-QUALITY | Sealed 2026-11-24 |
| NEX-022 PWA install promotion | LAUNCH-QUALITY | Sealed 2026-11-24 |
| NEX-023 Location permission timing | LAUNCH-QUALITY (only becomes LAUNCH-CRITICAL if location ever requested at launch — currently Option A gated per NEX-022 rule) | Sealed 2026-11-24 |
| NEX-006 Why NEX page | LAUNCH-QUALITY | Public marketing surface |
| NEX-007 Switch savings calculator | LAUNCH-QUALITY | Public marketing |
| NEX-014 Side-drawer Why NEX link | LAUNCH-QUALITY | Blueprint §6 asked |
| NEX-018 HQ incident/alerts | LAUNCH-INFRA | Operational — not user-visible |
| NEX-019 Support tickets | LAUNCH-INFRA | Operational — may defer |
| NEX-013 Vault preservation | **OPTIONAL — NEX Store add-on** (owner correction Pass 2) | Not a launch pillar; code remains present; optional for v1 users |
| GAP-NAV-002 Vault drawer row | **OPTIONAL** (owner correction Pass 2) | Entry only matters if Vault is promoted; keep in NEX Store rather than main drawer |
| NEX-020 Emergency Help | **DEFERRED — SANDBOX-ONLY · intentional** (owner correction Pass 2) | Sealed 2026-11-09 + 2026-11-23 Option C — live-activation gates deliberately closed; splash SOS decision screen remains gated for already-opted-in users only |
| NEX-009 Chat Teams | OPTIONAL | Multi-member shop inbox is a v1.1 |
| NEX-005 P2P fallback | OPTIONAL | Non-messaging only today |
| NEX-012 Chat translation | DEFERRED | Founder-only pilot; do NOT publicise |
| NEX-002 Product import | OPTIONAL | CSV/JSON — v1.1 |
| NEX-003 Account appeals | OPTIONAL | Needed if launch bans occur; otherwise v1.1 |
| NEX-011 Flippable chat cards | **NEEDS DECISION** | Scope unclear |
| NEX-001 Merchant data export | **NEEDS DECISION** (B1–B5 open) | Privacy Policy §19 obligation |
| GAP-NAV-003..007 Orphan zones (NEX LIVE / Music / Group Calls / Family Safety / Notifications) | **NEEDS DECISION** | Keep + wire, or delete |

**Effect of Pass 2 reclassification on the launch bar:**

- Launch no longer blocked by Vault activation nor by Emergency Help live-mode.
- Launch IS blocked by: NEX Chat device-only E2E functioning end-to-end · NEX Shop create+subscribe+connect-merchant-Stripe + buyer checkout · Chat Themes entitlement + first-free apply write + pricing path (Stripe writer may remain unauthorised at launch if the first-free unlock is the launch surface; owner call in §11.A).

### 2.2 · What this classification does NOT do

It does **not** silently remove existing functionality. It does **not** expand scope. Items marked DEFERRED or OPTIONAL remain in the codebase; the plan only changes **what blocks launch**.

---

## 3 · Recommended navigation structure

This is a **proposal** — not a commitment. Owner must approve or revise before any drawer change is implemented. The existing drawer is sealed by regression test (`__tests__/control-drawer-client.test.tsx:278-298`); any edit requires owner-dated directive AND test update.

### 3.1 · Decision framework (owner-sealed 2026-11-24 doctrine)

Per-feature scoring across seven measures, with separate scores per user role (never averaged):

1. **Findability** — can the user find the feature?
2. **First-click accuracy** — do they choose the right link first?
3. **Completion** — can they finish the task?
4. **Navigation effort** — how many unnecessary steps?
5. **Recovery** — can they recover from a wrong turn?
6. **State preservation** — do they lose information when moving back?
7. **Clarity** — do they understand what the link will do?

Roles scored separately: first-time user · returning customer · shop owner · admin.

**Simulated scores are NOT real user research.** Tree-testing with actual human participants (Nielsen Norman Group methodology) is required before treating navigation as proven.

### 3.2 · Proposed Option X — "Backbone with context" (one of two credible alternatives)

Primary side drawer, ordered by task frequency × criticality, with role-gated reveal:

**`YOUR_NEX` (always-present)**
1. Chats and contacts *(current)*
2. My profile *(current)*
3. Shop — **conditional:** if no shop → `Create a shop` (**FIXES GAP-NAV-001**); if active shop → `Shop settings` (current `manage-shop`)
4. My orders *(current, role-gated)*
5. Wholesale *(current, shop-sub gated)*
6. NEX Store *(current)*
7. **Vault** — `Vault & backups` (**FIXES GAP-NAV-002**). Label picked for clarity over "Activate".
8. Discovery *(current)*
9. Payment providers *(current)*

**`PREFERENCES`**
10. Settings *(current — 7-group hub)*
11. Buying Guides *(current)*
12. NEX 1 *(current help + support chat)*
13. **Why NEX** — fixes NEX-014 (owner-requested)
14. **Install NEX** — conditional per NEX-022 install-promotion rule

**Not placed in drawer** (resolved per blueprint §6.3 preference):
- Invite Friends → stays as Contacts page action (per owner 2026-11-23)
- Share NEX ID → stays on Profile page
- Add Contact / Enter NEX ID → stays in Contacts flow

**Orphan zones (GAP-NAV-003..007)** are **NOT placed** in this option pending owner decision on keep-or-delete. If kept, "NEX LIVE" and "Notifications" are drawer candidates; Music, Group Calls, Family Safety are feature-page candidates.

### 3.3 · Proposed Option Y — "Command-palette first" (alternative)

Linear-style Cmd+K / long-press action search surfaces every feature without drawer pressure; drawer shrinks to the top-4 most-visited rows per role. Lower drawer weight, higher keyboard-shortcut dependency. More complex to implement; may not fit mobile-first primary.

### 3.4 · Recommendation

**Option X** for v1. It is additive to the existing sealed drawer (no row removed); each new row is conditional and role-gated; fixes the two owner-flagged gaps. Option Y is a v1.1 enhancement.

**Confidence: medium.** No tree-testing has been done. The scores above are agent-simulated, not measured. Human validation is required before this becomes a seal.

---

## 4 · Complete journey and dependency plan

For each LAUNCH-CRITICAL feature a journey card with the owner-specified field set:

**Journey card shape** (template, not every row populated at full depth in Pass 1):

```
Requirement → Feature ID → User journey → Numbered actions (NAV-nnnn)
→ Route(s) → Component(s) → Service/action → API → Database/storage → Security → Test

Outcome branches: success · failure · retry · cancel · back · interrupted
State before/after: user input · written to server · device-local · back-preserved · refresh-preserved · cross-device
Reverse direction (per destination): entry · exit · return · direct-URL · refresh · alt-entry
Role axes: guest · signed-in · shop-owner · admin
Device axes: desktop · mobile · PWA-standalone
```

### 4.1 · JRN-NEX-017 · NEX Chat — Device-only E2E (launch pillar · fully populated)

**Starting user states that enter this journey:**
- State A first-time user after registration + Contacts seeded with ≥1 contact
- State C signed-in returning user
- State B mid-onboarding user who skipped Contacts step (edge case — chat opens but empty)
- State F new device (same account) — starts fresh key establishment; no history imported

**Entry points:**
- Primary: `Chats and contacts` drawer row (top row, current)
- Secondary: tap a contact from `My profile` → their profile → `Message`
- Secondary: tap a product-share card in-thread (buyer side; see §4.3 Shop)
- Secondary: tap a push-notification (per NEX-018 notification binding)
- Secondary: direct URL `/nex-native/chat/<peer_id>` (role-gated; redirects to sign-in if State D/E)

**Screen+transition walk (every action):**
1. Drawer row tap → NAV to `/nex-native/chat` (contact list screen)
2. Contact row tap → NAV to `/nex-native/chat/<peer_id>` (thread screen)
3. Composer tap → keyboard rises + input receives focus
4. Attach button tap → sheet with (Photo · Video · Document · Cancel)
5. Attachment pick → encrypted upload (per §4A route evidence) → preview inlines above composer
6. Send button tap → ciphertext encrypted locally (nacl.secretbox) → POST `/api/nex-native/peer-message/encrypted` → server stores envelope (no plaintext) → thread appends message in "sending" state → server ack → "sent" → recipient online receipt → "delivered"
7. Recipient-read receipt (only if that user has read-receipts ON) → "read"
8. Long-press a message → sheet with (Copy · Delete-for-me · Retract · Translate [NEX-012 pilot off by default])

**Success:** ciphertext envelope accepted by server · recipient receives within push/poll SLA · UI shows delivered.
**Failure (network loss mid-send):** outbox NEX-004 holds the message device-locally · UI shows "pending" · auto-retries on reconnect · user can `Delete pending` to drop.
**Failure (session expired):** 401 bounces to `/sign-in` with return-to; message remains in outbox.
**Failure (recipient key unavailable, State F fresh device):** UI shows "Can't verify this contact yet" and offers key re-establishment flow (owner-sealed 2026-11-09 doctrine — pure P2P; no server-stashed ciphertext).
**Retry:** outbox auto-retries 3× with backoff · user can force-retry.
**Cancel:** cancel pending message = drops from outbox; no server retraction needed (never posted).
**Back:** returns to contact list; scroll position preserved; typing draft preserved device-local.
**Refresh:** reloads envelope metadata from server (participant IDs · timestamps · read receipts) · ciphertext bodies decrypt device-locally; if device-local key missing → messages render as "Encrypted (unavailable on this device)".
**Interrupted recovery (phone killed mid-type):** draft recovered from device-local storage on next open.
**Interrupted recovery (phone killed mid-send after POST started):** server dedup on client-generated `envelope_id`; retry safe.

**Data persistence / ownership:**
- **Device:** full plaintext + draft + key material.
- **Server:** envelope metadata only (participant IDs · envelope_id · created_at · delivery/read receipts). Ciphertext body present only for ≤7 days post-delivery then purged (mig 097).
- **Cross-device sync:** NONE — owner-sealed 2026-11-09 Interp 1. Fresh device = fresh history.
- **Back-preserved:** draft + scroll position per thread.
- **Refresh-preserved:** metadata; ciphertext decrypts from device key store.

**Notifications / external hand-offs:**
- Push notification (recipient online or offline) — no plaintext preview per sealed doctrine; preview is "You have a new message".
- No Brevo email trigger from chat send.
- No cross-posting to other channels.

**Returning-user behaviour:**
- State C: `Chats and contacts` opens on last-viewed list position.
- State F: fresh device = empty list on first open; must re-add contact or receive from them.

**Mobile / desktop / PWA-standalone axes:**
- Mobile browser: composer anchored above keyboard; full-viewport rule NEX-021 must hold.
- PWA standalone: same as mobile browser; no URL bar present; NEX-022 install promotion offered once per cooldown.
- Desktop: list + thread two-pane; keyboard shortcuts post-launch (v1.1).

**Role axes:**
- Guest (State D/E): cannot reach `/nex-native/chat` without signing in. NEX auth-gate (sealed 2026-11-21) handles.
- Signed-in: full journey.
- Shop owner: additional "View shop" sheet on long-press of own messages that reference a product.
- Admin: cannot see message plaintext — doctrine invariant I-1 / I-3.

**Dependencies:**
- mig 055 bucket `nex-peer-chat-attachments` is `public:true` — LEGACY posture only; **NEW uploads route to private bucket per §4A** (encrypted route + standard route both private-bucket-only, fail-safe 503). Legacy historical rows may still reference public-bucket URLs via `attachment_url` column → data-correction task (§4A).
- mig 097 ciphertext purge job — verify runs in sandbox.
- mig 279 chat-edit — NOT APPLIED → chat-edit path BROKEN.

**Test:**
- `journey-chat-send-e2e.spec.ts` (required · not yet written) — A-to-C new conversation, state F fresh-device onboarding, offline-outbox persistence, session-expired bounce-and-return, retract, delete-for-me.

**Status:** CODE PRESENT · doctrine SEALED · schema-debt open (NEX-017 `nex_peer_message.body` sentinel) · bucket legacy posture noted · **LAUNCH-CRITICAL / PILLAR — not near-live ready until schema debt closed and purge job verified.**

### 4.2 · JRN-NEX-015+016+008+010 · NEX Shop — Create, subscribe, connect Stripe, sell, buy (launch pillar · fully populated)

**Starting user states that enter this journey:**
- Seller side: State C signed-in user without a shop → wants to open shop.
- Buyer side: State A/C user browsing `/directory` or receiving an in-chat product share.

**Entry points (seller):**
- Primary: Side drawer `Create a shop` row (GAP-NAV-001 fix) when `nex_business` row absent for account.
- Secondary: `My profile` → `Open a shop` CTA.
- Secondary: in-chat prompt (if peer shares a buy card and you have no shop) — "Sellers like you use NEX Shop" (soft upsell; deferrable).

**Entry points (buyer):**
- Primary: `/directory` directory browse.
- Primary: `Shop` tab on a peer's profile.
- Primary: in-chat product card → `Buy now`.
- Primary: direct URL `/nex-native/business/<slug>/product/<id>`.

**Screen+transition walk — seller side (every action):**
1. Drawer `Create a shop` tap → NAV to `/nex-native/manage/shop/setup/template`
2. Template pick (NEX-010) → NAV `.../setup/details`
3. Shop details form (name · bio · category · logo upload) → Save → writes `nex_business` row
4. NAV `.../setup/subscription` → shows NEX-015 pricing (£4.99/€4.99/$4.99/Rp 89,000 monthly, 7-day trial)
5. Trial honesty disclosure card (sealed 2026-11-08) BEFORE card entry — "trial ends day 7, first charge day 8, 1-click cancel preserves access to day 7"
6. Stripe Checkout mount → user enters card → returns to `.../setup/subscription/callback?session_id=…`
7. Webhook (not yet authorised to write) writes `nex_business.subscription_status = trial`
8. NAV `.../setup/stripe-connect` — merchant-direct Stripe Connect OAuth (sealed 2026-11-10 architectural condition #7) → seller authorises their own Stripe account → returns with `stripe_connect_account_id` on `nex_business`
9. NAV `.../manage/shop` — shop dashboard; add products, publish
10. `Add product` → writes `nex_product` row; attaches media via the private attachment bucket path

**Screen+transition walk — buyer side (every action):**
1. Browse `/directory` → tap shop → NAV `/nex-native/business/<slug>`
2. Tap product → NAV `/nex-native/business/<slug>/product/<id>`
3. `Message seller` → NAV `/nex-native/chat/<seller_peer_id>` with product-share composer prefilled
4. Seller sends inline buy card (Path A separation sealed 2026-11-09)
5. Buyer tap `Buy now` → NAV in-chat checkout form OR `/nex-native/checkout/<order_id>` (route path TBD per release-audit P1-A)
6. Address + payment sheet → **server-side price validation** (release-audit P1-A P0-GATE)
7. Stripe payment intent on **seller's** Stripe account (0% app fee; owner-sealed 2026-11-10)
8. Order writes `nex_order` row with JSONB cart snapshot (architectural condition #5 — NO `nex_order_item` table)
9. Confirmation screen + notification to seller + buyer order row visible in `My orders`

**Success:** `nex_order.status = paid` · seller sees order · buyer sees receipt · merchant-direct Stripe charge visible on seller's dashboard.
**Failure (card decline):** inline error; buyer stays on checkout; cart preserved.
**Failure (Stripe outage):** 503 with "Try again" CTA; cart preserved device-local.
**Failure (seller's Stripe account not connected):** checkout refuses; buyer sees "This shop can't accept payment yet"; seller sees "Finish Stripe Connect to receive orders".
**Retry:** buyer retries payment; order row stays `pending_payment` until success or cancel.
**Cancel (buyer):** order row → `cancelled`; no refund needed because never charged.
**Cancel (seller trial):** 1-click cancel from `Shop settings`; access preserved to day 7; no charge; subscription row → `cancelled`.
**Back:** returns up the setup stack; previous form fields preserved; shop-draft `nex_business` row preserved in `draft` status.
**Refresh:** server-side rehydrate from `nex_business` + `nex_product`; local uploads in progress cancelled with toast.
**Interrupted recovery (phone killed mid-setup):** next open resumes at the last completed step via `nex_business.setup_step` cursor.

**Data persistence / ownership:**
- **Shop + products:** server-persisted (`nex_business`, `nex_product`).
- **Orders:** server-persisted (`nex_order`) with JSONB cart snapshot; no line-item table.
- **Chat messages carrying product cards:** per NEX-017 — envelope metadata on server, plaintext device-only; **product/menu/order snapshots in `attachment_meta` are structured NOT plaintext** (device-only chat doctrine 2026-11-09 Path A).
- **Stripe customer data:** on seller's Stripe account, not NEX.
- **Device:** draft shop forms; buyer cart; checkout form state.

**Notifications / external hand-offs:**
- Trial day-5 reminder (NEX-015 sealed 2026-11-08).
- Order placed → push to seller + optional Brevo email.
- Stripe webhook (seller-direct) → NEX webhook endpoint updates order status.
- Merchant dashboard (Stripe-hosted) = external hand-off; seller manages refunds there.

**Returning-user behaviour:**
- Seller State C: drawer `Create a shop` row flips to `Shop settings` when shop exists (conditional per §3.2 Option X).
- Seller with expired trial + no payment: shop status `suspended_billing`; dashboard shows reactivation prompt.
- Buyer State C: `My orders` row in drawer (role-gated: has at least one order).

**Mobile / desktop / PWA-standalone axes:**
- Mobile: setup flow fits mobile; Stripe Checkout renders mobile-full-page.
- PWA: same as mobile browser.
- Desktop: setup flow still mobile-width; shop dashboard adapts.

**Role axes:**
- Guest: cannot enter setup; auth-gate.
- Signed-in no-shop: sees Create a shop row.
- Signed-in has-shop: sees Shop settings row.
- Admin: HQ viewer can inspect but not modify (owner-sealed HQ viewer freeze).

**Dependencies:**
- mig 311 `stripe_connect_account_id` — present but sandbox apply state UNVERIFIED.
- mig 354/365 commerce payloads — verify applied state.
- Stripe writer + webhook → NOT YET AUTHORISED (requires named Founder approval — §11.A).

**Test:**
- `journey-create-shop.spec.ts` (required · not yet written)
- `journey-shop-trial-day-5-day-8.spec.ts` (required)
- `journey-merchant-stripe-connect.spec.ts` (required)
- `journey-buyer-checkout.spec.ts` (required)
- `journey-stripe-outage-degraded.spec.ts` (required)

**Status:** CODE PRESENT · payment path NEVER EXERCISED (release-audit P1-B) · merchant-direct architectural condition #7 CORRECT in doctrine but UNVERIFIED in sandbox · **LAUNCH-CRITICAL / PILLAR — blocked on Stripe sandbox exercise authorisation + P1-A price validation close.**

### 4.3 · JRN-Themes+ · Chat Themes — Entitlement, first-free, pay-to-unlock, apply (launch pillar · fully populated)

Reference seal: `project_nex_themes_plus_sealed_2026_11_13.md` — monthly entitlement unlocks ALL paid chat themes; first paid theme FREE permanently per account; no free trial; unsupported regions = WAITLIST not USD fallback.

**Starting user states that enter this journey:**
- State A/C user viewing a chat thread who wants to customise look.
- State C user visiting the Themes catalogue directly.

**Entry points:**
- Primary: Thread header `⋮` → `Change theme` → NAV `/nex-native/themes` (or similar).
- Primary: `Settings` → `Chat theme` row → catalogue.
- Secondary: Marketing deep-link (pre-sign-in or in-chat announcement).

**Screen+transition walk (every action):**
1. Enter catalogue → catalogue reads `nex_theme_catalogue` + per-user `nex_theme_ownership` to badge owned vs locked themes.
2. Tap a free theme → applies immediately · writes/updates account theme preference → thread rerenders with new theme.
3. Tap a paid theme WHILE no Themes+ subscription AND no `source='first_free'` row:
   - If owner's region is supported → present 3 options: **(a) Apply as first-free (permanent)** · **(b) Subscribe Themes+ monthly** · **(c) Back**
   - If region unsupported → present WAITLIST form (no USD fallback — owner-sealed)
4. Choose (a) first-free → writes `nex_theme_ownership` row (`account_id`, `theme_id`, `source='first_free'`, `granted_at`) → applies theme → irreversible for this theme (no take-backs; one-free-per-account).
5. Choose (b) subscribe → Stripe Checkout (NEX-managed subscription, NOT merchant-direct — distinct from NEX Shop) → on return `nex_account.themes_plus_until` written → ALL paid themes unlock.
6. Tap any already-owned theme → applies instantly; no payment path.

**Success (free theme):** applied · preference row updated · thread visual confirms.
**Success (first-free paid theme):** ownership row written · applied · catalogue shows "This was your first-free; unlock more with Themes+".
**Success (Themes+ subscribe):** `themes_plus_until` populated · all paid themes marked owned-via-subscription.
**Failure (Stripe decline):** error inline; preference unchanged; user may retry.
**Failure (region unsupported but user tries paid path):** UI refuses and routes to WAITLIST.
**Retry:** Stripe retry; no double-charge.
**Cancel (during purchase):** theme stays locked; no ownership row written.
**Cancel (Themes+ subscription):** access remains until `themes_plus_until` date; after that date paid themes re-lock BUT first-free ownership row is permanent and theme remains applied even if it was first-free.
**Back:** returns to thread; preference unchanged if cancel mid-flow.
**Refresh:** catalogue reads fresh from server; local pending-apply dropped.
**Interrupted (mid-Stripe flow):** webhook writes ownership regardless of UI state; next open reflects correct state.

**Data persistence / ownership:**
- **Account-level:** `nex_theme_ownership` rows (first-free + per-theme) and `nex_account.themes_plus_until` are account-scoped, cross-device.
- **Device:** no local-only theme state; preference is server-sourced.
- **Cross-device:** ownership follows account.

**Notifications:**
- Themes+ renewal reminder (per subscription sealed rules).
- No push for free-theme apply.

**Returning-user behaviour:**
- Catalogue always reflects current ownership (badges).
- First-free is one-shot per account — subsequent paid-theme taps always go to pay/subscribe path.

**Mobile / desktop / PWA-standalone axes:**
- Mobile primary; previews must render at thread width.
- PWA: same path; Stripe Checkout hosted-mode compatible.
- Desktop: catalogue adapts; thread preview on same screen if wide enough.

**Role axes:**
- Guest: auth-gate (sign in to buy/apply).
- Signed-in: full journey.
- Shop owner: no special path; Themes+ is personal, not shop-wide.
- Admin: HQ cannot modify ownership rows (viewer freeze).

**Dependencies:**
- Themes+ Stripe writer + webhook → NOT YET AUTHORISED (Phase A sealed 2026-11-13: UI gating + routing + first-free apply write authorised; Stripe + `themes_plus_until` writer NOT authorised yet).
- Theme-apply write path → verify.
- Regional pricing table → sealed per `project_nex_themes_plus_sealed_2026_11_13`.
- mig 341/343 (themes + bubble colours) → NOT APPLIED · causes silent-save failure NAV-0019/0021 if apply writes those tables.

**Test:**
- `journey-chat-theme-apply-free.spec.ts` (required)
- `journey-chat-theme-first-free-apply.spec.ts` (required)
- `journey-chat-theme-subscribe-themes-plus.spec.ts` (required)
- `journey-chat-theme-region-unsupported-waitlist.spec.ts` (required)
- `journey-chat-theme-cancel-subscription-retains-first-free.spec.ts` (required)

**Status:** PARTIAL · UI gating + first-free apply authorised (Phase A) · Stripe writer + webhook NOT authorised · mig 341/343 unapplied · **LAUNCH-CRITICAL / PILLAR — not near-live ready; Phase B authorisation required + mig 341/343 apply.**

### 4.4 · JRN-FIRST-ENTRY · Account creation + first-time entry (launch-critical · fully populated)

Owner-stated required journey. Determines whether a brand-new user reaches the first useful screen without friction.

**Starting user states:** State A first-time user. Unknown device. No cookies.

**Entry points:**
- Primary: `https://nexcorner.com` → root `/nex-native/page.tsx` (splash decision screen) → `Enter NEX` button → routing.
- Secondary: Marketing deep-link to `/nex-native/why-nex` or `/nex-native/pricing` → `Get Started` CTA.
- Secondary (iOS/Android PWA install prompt skipped at this step per NEX-022 rule — cadence requires post-register, post-Contacts, meaningful-interaction).

**Screen+transition walk (every action):**
1. Visitor hits root → splash renders full-viewport per NEX-021 (sealed 2026-11-24).
2. **G-2 three-way splash branch** (sealed 2026-11-23, verified via `known-device-cookie.ts` unit tests): unknown-device + no session → NAV to sign-in **or** register surface (owner choice).
3. Register entry (`/nex-native/welcome` or similar) → form (name, email or phone, date of birth, accept terms).
4. Submit → writes `nex_account` row · session cookie issued · `nex_known_device` cookie written.
5. NAV to onboarding — add name/avatar/profile.
6. NAV to Contacts seed — "Find friends on NEX" screen · add first contact OR skip.
7. NAV to Chats landing OR the first contact's thread.

**Success:** account row persisted · session + known-device cookies set · contacts list has ≥0 rows · user lands on `/nex-native/chat`.
**Failure (duplicate email/phone):** inline error; form state preserved; offer sign-in path instead.
**Failure (migration gap or RLS):** registration BLOCKED with "We can't create an account right now" — must NEVER silently claim success. Per 2026-11-12 UI-must-be-DB-wired rule.
**Failure (terms not accepted):** submit button disabled; no POST.
**Failure (network loss mid-register):** form state preserved device-local; retry picks up.
**Retry:** idempotent server action keyed on form submission id; no duplicate rows.
**Cancel:** back to splash; no partial row written.
**Back from Contacts seed:** returns to profile step; profile preserved.
**Refresh mid-onboarding:** G-1 gap: no `onboarding_complete` column today — refresh may drop the user to the wrong step (State B vs State C ambiguity). Blocked on F-9.
**Interrupted recovery (phone killed mid-register):** no draft recovery; must restart form (acceptable — minimal fields).
**Interrupted recovery (phone killed mid-onboarding after account created):** on next open, user lands at correct step only after G-1 is resolved.

**Data persistence / ownership:**
- Server: `nex_account` row · session row · optional `nex_account_profile` (Bridge 2 fdec9f69).
- Device: `nex_known_device` cookie, local onboarding draft before submit.
- Cross-device: account state syncs; chat/key material does NOT per NEX-017 doctrine.

**Notifications / external hand-offs:**
- Brevo API: welcome email (optional at launch; owner call).
- Push: subscription registered post-onboarding (not during).

**Returning-user behaviour:**
- Known device + no session (State D): splash → sign-in bias, remember last email.
- Known device + session (State C): splash → `Enter NEX` → routes to last-active surface.

**Mobile / desktop / PWA-standalone:**
- Mobile browser: full-viewport; keyboard rises on form inputs; splash sized via 100dvh per NEX-021.
- PWA standalone: no URL bar; same flow; install-promotion postponed per NEX-022.
- Desktop: register form centred; otherwise same.

**Role axes:** Guest-only journey — becomes signed-in on success.

**Dependencies:** `nex_account` migration state (confirmed applied in prod · see blueprint §9). `nex_known_device` cookie per G-2 fix. Brevo email path · Supabase auth flow.

**Test:**
- `journey-first-user-A-to-contacts.spec.ts` (required · Owner Proof #1/#4; shares with G-4/G-6)
- `journey-register-duplicate-email.spec.ts`
- `journey-register-network-loss-resume.spec.ts`

**Status:** CODE PRESENT · G-1 (`onboarding_complete`) open · G-2 fixed 2026-11-23 · **LAUNCH-CRITICAL — not ready until G-1 resolution + end-to-end Playwright pass.**

### 4.5 · JRN-CHAT-ATTACHMENT · Chat attachment send + receive (launch-critical · fully populated)

Sub-journey of §4.1 NEX Chat. Full evidence for the data-ownership + retrieval paths is in **§4A** below.

**Starting user state:** State C signed-in user in a chat thread with ≥1 message history.

**Entry points:**
- Primary: Thread composer `Attach` button → sheet (Photo · Video · Voice · Document · Cancel).
- Secondary: Paste image from clipboard (desktop).
- Secondary: Share-to-NEX from OS share sheet (PWA-standalone or device integration).

**Screen+transition walk — SEND (every action):**
1. Pick file → preview inlines above composer.
2. On Send: client calls `encryptFileBytes()` (`src/lib/nex-native/crypto/attachment-envelope.ts`) → `wrapContentKey()` per recipient device → POST `/api/nex-native/attachment/encrypted` → `storage_path` returned.
3. Client builds envelope with `storage_path` + `wrapped_keys[]` + `content_nonce` → POSTs encrypted peer-message with envelope embedded in `attachment_meta.envelope`.
4. Thread appends message in "sending" state; outbox NEX-004 covers network loss.
5. Server stores envelope JSONB; no plaintext bytes; no public URL.

**Screen+transition walk — RECEIVE (every action):**
1. Recipient fetches new message · envelope present in `attachment_meta.envelope`.
2. UI shows a placeholder (blurhash or neutral tile) until user taps.
3. On render/tap: client calls `resolveCiphertextFetchUrl(envelope)` (`src/lib/nex-native/crypto/attachment-url-resolver.ts`) → GET `/api/nex-native/attachment/encrypted/signed?path=<storage_path>` → server does participant-check via `verifyParticipantForCiphertext()` → signed URL (TTL 900s) returned.
4. Client fetches signed URL → `decryptFileBytes()` → blob URL → rendered in `<img>`/`<video>`/`<audio>` or triggered as download via `_encrypted-document-chip.tsx`.

**Success:** sender sees "delivered" when server ack received; recipient decrypts and renders.
**Failure (upload refused · 503 private bucket unavailable):** composer shows "Attachments are offline right now"; message NOT sent; user can retry. NO silent write to public bucket (fail-safe 2026-11-08).
**Failure (upload refused · 410 plaintext-freeze):** standard-send route refuses · UI prompts the user to re-enable encrypted send (default path).
**Failure (upload 413 too_large):** inline "File too big (25 MB max)" — composer retains the message draft without the file.
**Failure (upload 429 rate-limited):** standard-send only; retry timer surfaces.
**Failure (recipient non-participant tries signed URL):** 404 (not 403) by design — non-leaking.
**Failure (signed URL expired):** client re-mints transparently; 1 retry max.
**Failure (recipient device missing key — State F):** envelope `wrapped_keys[]` contains no entry for this device; UI shows "Encrypted (unavailable on this device)".
**Retry:** outbox re-sends encrypted message with same envelope; dedup on envelope_id.
**Cancel:** cancel from composer discards local file; no server bytes written (upload POST not issued yet) OR if upload completed but message not sent, bucket object orphans — garbage-collect via mig 097 purge.
**Back:** returns to thread list; selected attachment discarded; draft preserved if composer draft-save is on.
**Refresh:** re-pulls envelope metadata; placeholder shown until user re-taps attachment.
**Interrupted (mid-upload):** client cancels; partial upload rejected by Supabase; no envelope written.
**Interrupted (mid-send after upload success):** envelope stored in device outbox; on resume server-side dedup prevents double-write.

**Data persistence / ownership:**
- **Device:** plaintext file bytes ONLY. Content key + wrapped keys local.
- **Server:** envelope JSONB (participant IDs, storage_path, nonce, wrapped keys, size, content_type) · ciphertext in `nex-peer-chat-ciphertext` bucket · subject to mig 097 purge.
- **Public bucket legacy:** `nex-peer-chat-attachments` holds pre-cutoff ciphertext (Bridge 81+ envelopes carry `storage_url` not `storage_path`) OR legacy plaintext from pre-encrypted era. See §4A.
- **Cross-device:** none (device-only doctrine 2026-11-09).

**Notifications:** push "You have a new message" only; no attachment preview in notification.

**Returning-user behaviour:**
- Returning to thread: `wrapped_keys[]` for this device must still be valid (key rotation = fresh send required).
- Fresh device: cannot decrypt old attachments — matches NEX-017 doctrine.

**Mobile / desktop / PWA-standalone:**
- Mobile: native file picker; camera/gallery/document sheet.
- PWA: file picker available; receive-to-NEX via OS share sheet (platform-dependent).
- Desktop: drag-and-drop + paste-from-clipboard variants.

**Role axes:**
- Guest: cannot reach chat (auth-gate per §4.1).
- Participant-only: non-participants cannot mint signed URL (404 by design).
- Admin: HQ viewer must not see attachment plaintext (doctrine invariant).

**Dependencies:**
- Private bucket `nex-peer-chat-ciphertext` provisioned (not creatable by migration — see §4A).
- Mig 295 applied (RLS policies) · currently AUTHORED NOT APPLIED.
- `wrapped_keys[]` schema path · envelope builder in `attachment-envelope.ts`.
- Signed-URL mint at `/api/nex-native/attachment/encrypted/signed` · verified by agent as participant-gated with 900s TTL and non-leaking 404s.

**Test:**
- `journey-chat-attachment-encrypted-image.spec.ts` (required)
- `journey-chat-attachment-encrypted-document.spec.ts` (required)
- `journey-chat-attachment-upload-fail-safe-503.spec.ts` (required · simulates private bucket unavailable)
- `journey-chat-attachment-signed-url-non-participant-404.spec.ts` (required)
- `journey-chat-attachment-legacy-public-envelope-resolve.spec.ts` (required · validates `attachment-url-resolver` fallback does NOT resolve to plaintext)

**Status:** CODE PATH VERIFIED (agent trace §4A) · sandbox mig 295 apply state UNVERIFIED · bucket provisioning UNVERIFIED · **LAUNCH-CRITICAL — blocked on sandbox verification, NOT on code gap.**

### 4.6 · JRN-FIND-SHOP · Buyer shop discovery (launch-critical · fully populated)

Owner-stated required journey. The first interaction most buyers have with NEX Shop.

**Starting user states:** State A first-time visitor, State C signed-in buyer, State D signed-out returning user.

**Entry points:**
- Primary: Drawer `Discovery` row → NAV `/nex-native/directory`.
- Primary: Direct URL `/nex-native/directory?category=...`.
- Primary: Shared link from WhatsApp/SMS → `/nex-native/[businessSlug]` (shop profile direct).
- Secondary: Search `/nex-native/search` → shop results.
- Secondary: Peer shares a product card in chat → tap card → shop/product.

**Screen+transition walk (every action):**
1. Enter directory → list of shops rendered (by category · by proximity · by recent activity).
2. Filter/search → debounced query → server returns matches.
3. Tap a shop tile → NAV `/nex-native/[businessSlug]` (shop profile with products + bio + hours).
4. Tap product → NAV `/nex-native/product/<id>` or `/nex-native/[businessSlug]/product/<id>`.
5. From product: `Message seller` or `Add to cart` or `Buy now`.

**Success:** user reaches a product page and can act (message or buy).
**Failure (no results):** empty-state with "Try a different category" + popular-near-you suggestions.
**Failure (shop suspended):** `/[businessSlug]` returns a "This shop is paused" view · never a 404 unless the slug has never existed.
**Failure (product unavailable):** product page shows "Out of stock" with `Message seller` still available.
**Retry:** search is idempotent; cached last query preserved on back.
**Cancel:** no cancel — passive browse.
**Back:** returns up the stack; scroll position + filter state preserved.
**Refresh:** fresh server read; filter state preserved in URL.
**Interrupted recovery:** URL params carry filter state; re-open restores.

**Data persistence / ownership:**
- Server: `nex_business`, `nex_product` rows.
- Device: filter preferences, recent-viewed cache (optional).
- Guest: no account rows yet; search still works.

**Notifications:** none from discovery itself.

**Returning-user behaviour:**
- State D: directory works without sign-in; buy requires sign-in (auth-gate per 2026-11-21 seal).
- Recent-viewed list surfaced on return.

**Mobile / desktop / PWA-standalone:** all paths mobile-first; list virtualised.

**Role axes:** Guest, buyer, shop owner (sees own shop with "Edit" overlay in some views), admin (HQ viewer read-only).

**Dependencies:**
- `/directory` route verified in app tree.
- `[businessSlug]` route verified.
- Search service (likely in `src/lib/nex-native/directory-service.ts` or similar — Pass-3 verification).
- Ranking logic per category (sealed? or implementation detail — E-6).

**Test:**
- `journey-directory-browse-and-filter.spec.ts` (required)
- `journey-direct-businessslug-landing.spec.ts` (required)
- `journey-search-empty-state.spec.ts` (required)
- `journey-signed-out-browse-buy-auth-gate.spec.ts` (required · NEX auth-gate standard)

**Status:** ROUTES PRESENT in tree · test coverage unknown · **LAUNCH-CRITICAL — needs Pass-3 route-handler + ranking verification.**

### 4.7 · JRN-RETURNING-RECOVERY · Returning-user + interrupted recovery (launch-critical · fully populated · cross-cutting)

Owner-stated required cross-cutting journey. Any pillar can be interrupted mid-flow; recovery must leave the user in a correct state.

**Six concrete interruption scenarios covered:**

1. **Mid-register interruption.** Row written for account + `nex_known_device` cookie set but onboarding not complete. On return (State B): must land at correct step. **BLOCKED on G-1 `onboarding_complete` column (F-9).** Today the user may be mis-routed as State C.

2. **Mid-chat-send interruption.** Encrypted message queued in outbox NEX-004. On reopen: outbox retries 3× with backoff; user sees "pending" indicator; may force-retry or delete pending. **Verified pattern · NEX-004 LAUNCH-INFRA.**

3. **Mid-attachment-upload interruption.** Private-bucket upload cancelled; partial object rejected by Supabase; envelope NOT written; message never sent. On reopen: file no longer in composer; user re-picks. **Covered by §4.5 fail-safe.**

4. **Mid-shop-setup interruption.** `nex_business.setup_step` cursor (per §4.2) records last completed step. On reopen: user resumes at that step; draft preserved. **Requires schema check — Pass-3 verifies cursor column exists.**

5. **Mid-checkout interruption.** `nex_order.status = pending_payment` after cart finalise. Buyer reopens → either auto-resume Stripe flow OR see order in `My orders` with "Finish payment" CTA. Stripe session expires in 24h — handle gracefully.

6. **Mid-theme-subscribe interruption.** Stripe Checkout webhook writes `themes_plus_until` regardless of UI return path. On reopen: catalogue reflects current entitlement from server read. Webhook auth required · F-6.

**State preservation contract (applies across pillars):**
- Back: preserves scroll + form state within the session.
- Refresh: re-reads server state; drops uncommitted local drafts with warning.
- Phone kill: device-local drafts + outbox persist; keys stay on device.
- Session expire mid-flow: auth-gate banner (sealed 2026-11-21) · return-to URL preserved · no data loss.
- Fresh device (State F): chat history empty by doctrine; account + shop + orders data syncs from server; themes entitlement syncs from server.

**Test:**
- `journey-returning-signed-out-D-to-signin.spec.ts` (required · G-2 verify Owner Proof #2)
- `journey-mid-register-interrupt-resume.spec.ts` (required · blocked on F-9)
- `journey-mid-shop-setup-interrupt-resume.spec.ts` (required)
- `journey-mid-checkout-session-expired.spec.ts` (required)
- `journey-mid-theme-subscribe-webhook-reconciles.spec.ts` (required · blocked on F-6)
- `journey-fresh-device-F-no-chat-history.spec.ts` (required)

**Status:** PATTERN-VERIFIED for chat outbox + auth-gate · UNVERIFIED for shop setup cursor · BLOCKED on G-1 for register · **LAUNCH-CRITICAL — mostly engineering verification, one Founder dependency (G-1).**

### 4.8 · JRN-NEX-020+023 · Emergency Help SOS (DEFERRED-SANDBOX · intentional)

Owner-reclassified Pass 2: DOES NOT block launch.

- **Entry:** Splash SOS decision screen (sealed 2026-11-23) — **only reachable for users whose persisted account config shows ≥1 valid recipient AND SOS feature-gate ON**. Users without SOS set up → existing auto-divert unchanged.
- **Doctrine (sealed 2026-11-09):** personal-contacts-only, pure device-local location, no server-side coordinate persistence.
- **Option C sealed 2026-11-23:** implement UI, do NOT claim delivery, do NOT invent provider, do NOT write coords to incident record.
- **Current state:** migrations 224/225 AUTHORED FOR REVIEW ONLY · NOT APPLIED. Contacts UI, SOS activation, cancel/resolve all remain sandbox-only until owner opens live-mode.
- **Status:** DOCTRINE SEALED · live-activation gates owner-closed INTENTIONALLY · **NOT a launch blocker.** Splash screen remains launch-critical only for the no-SOS-configured fallback behaviour (which routes users to existing branded auto-divert).

### 4.9 · JRN-NEX-013 · Vault — Activate & upload (OPTIONAL · NEX Store add-on)

Owner-reclassified Pass 2: OPTIONAL — Vault is a NEX Store add-on, not a launch pillar. The journey card here is retained for future work; it does not block launch.

- **Entry (if promoted):** from NEX Store (`/nex-native/store` or similar) — NOT from main drawer.
- **First action:** tap activate → `/nex-native/vault` route.
- **Doctrine:** per device-only 2026-11-09, Vault content must not be stored server-side as plaintext; attachment bucket evidence in §4A applies.
- **Status:** CODE PRESENT (NOT VERIFIED) · **OPTIONAL · not a launch blocker.**

### 4.10 · Other launch-touching journeys

- JRN-NEX-004 outbox (LAUNCH-INFRA — chat reliability; evidence captured in §4.1 journey card).
- JRN-NEX-021/022/023 full-viewport + PWA install + location timing (LAUNCH-QUALITY; sealed; verification tests queued).
- JRN-NEX-006/007/014 Why NEX page + savings calculator + drawer row (LAUNCH-QUALITY; marketing surfaces).
- JRN-NEX-018/019 HQ alerts + Support tickets (LAUNCH-INFRA; operational, owner may defer).

**Remaining journey cards to fully populate at the same depth as 4.1–4.7:** perf-regression journeys, full-viewport journey, PWA install cadence journey, location permission explanation card journey, GAP-NAV-001 drawer-row conditional journey, dead-link crawl. Tracked in §16 REMAINING. The owner-required seven pillar journeys (NEX Chat · NEX Shop · Chat Themes · Account creation + first-entry · Attachment send/receive · Buyer shop discovery · Returning-user interrupted recovery) are populated above at full axis depth.

---

## 4A · Chat-privacy attachment architecture — full trace evidence (Pass 3)

Pass 3 answers owner Priority 1 end-to-end with file:line evidence. All findings are static code + migration reads; **no DB access · no bucket inspection · no user data read · no modification.**

### 4A.1 · Every attachment upload path (owner Q1)

| # | Route / caller | Bucket | Path shape | Gating | Evidence |
|---|---|---|---|---|---|
| U-1 | `POST /api/nex-native/attachment/encrypted` | **PRIVATE** `nex-peer-chat-ciphertext` | `enc/<sender_id>/<ts>-<rand>.<ext>` | Session required · **private-bucket fail-safe 503** (fallback to public REMOVED 2026-11-08) · 25 MB cap · ext whitelist | `src/app/api/nex-native/attachment/encrypted/route.ts:37-117` |
| U-2 | `POST /api/nex-native/attachment/standard` (opt-in plaintext) | **PRIVATE** `nex-peer-chat-ciphertext` | `std/<sender_id>/<ts>-<rand>.<ext>` | Session · **410 Gone default** under `NEX_CHAT_PLAINTEXT_FREEZE` ON · rate-limit account+IP 60/hr · MIME allowlist · 25 MB cap · private-bucket fail-safe 503 | `src/app/api/nex-native/attachment/standard/route.ts:112-264` |
| U-3 | `business-service.uploadOnboardingLogo()` | **PUBLIC** `nex-business-assets` (relocated 2026-11-13 away from legacy chat bucket) | `business-logo/onboarding/<accountId>/...` | Caller auth-checks · 8 MB cap · image MIME whitelist | `src/lib/nex-native/business-service.ts:1393-1438` |
| U-4 | `business-service.uploadVenuePhoto()` | **PUBLIC** `nex-business-assets` | `venue/<businessId>/...` | Caller auth-checks · 25 MB cap · image MIME | `src/lib/nex-native/business-service.ts:1440-1495` |
| U-5 | `vault-persistence-service.moveConversationToVault()` (fetch-then-upload copy) | **PRIVATE** `nex-vault-files` | per vault entry layout | Account session + conversation-participation asserted by caller | `src/lib/nex-native/vault-persistence-service.ts:103-150` |

**No new uploads land in the legacy public `nex-peer-chat-attachments` bucket.** Business assets were relocated to `nex-business-assets` 2026-11-13. Vault copies to `nex-vault-files`. Chat ciphertext + standard-send to `nex-peer-chat-ciphertext`.

### 4A.2 · Every attachment retrieval path (owner Q2)

| # | Caller | How it builds the URL | Auth check | Evidence |
|---|---|---|---|---|
| R-1 | `resolveCiphertextFetchUrl(envelope)` | If `envelope.storage_path` present → GET `/api/nex-native/attachment/encrypted/signed?path=...` → extract `signed_url` | **Server does participant check** | `src/lib/nex-native/crypto/attachment-url-resolver.ts:59-97` |
| R-2 | Same, **legacy fallback** | If only `envelope.storage_url` present (pre-cutoff) → return public URL as-is | **NONE at retrieval**; relies on ciphertext secrecy | `src/lib/nex-native/crypto/attachment-url-resolver.ts:89-94` — comment "NEVER silently falls back to a plaintext URL" |
| R-3 | `fetchAndDecryptAttachment()` image/video/audio | Unwrap key → R-1 → fetch → `decryptFileBytes()` | Inherits R-1 | `src/lib/nex-native/crypto/attachment-envelope.ts:193-225` |
| R-4 | `fetchAndDecryptDocument()` documents | Unwrap key → R-1 → fetch → decrypt bytes + filename | Inherits R-1 | `src/lib/nex-native/crypto/encrypted-document-download.ts:46-130` |
| R-5 | Vault re-fetch for backup copy | Reads legacy `attachment_url` → copies into `nex-vault-files` | Account participation asserted | `src/lib/nex-native/vault-persistence-service.ts:117-150` |

### 4A.3 · Legacy public-bucket references (owner Q3)

Audit of 16 `src/` + 7 `nex-supabase/migrations/` files referencing `nex-peer-chat-attachments`:

| Class | Count | Examples |
|---|---|---|
| (a) Upload target by NEW code | **0** | None. All new uploads moved away. |
| (b) Retrieval / URL construction by NEW code | **0** | None. |
| (c) Legacy-only reader for pre-cutoff rows | **3** | `attachment-url-resolver.ts:89-94` (fallback) · `vault-persistence-service.ts:117-150` (Vault copy-source) · `business-service.ts:1420-1426,1446` (historical logo URL reads) |
| (d) Migration / bucket config | **4** | `migrations/055`, `144`, `295` (comment), `bucket-config.ts` constant declaration |
| (e) Test / fixture / doc | **6** | `__tests__/stage-a-two-identity-integration.test.ts`, `p3-plaintext-remediation.test.ts`, `vault-persistence.test.ts`, `business-service-asset-upload-bucket.test.ts`, `crypto/__tests__/attachment-url-resolver.test.ts`, inline comments in services |

**Summary:** no new write paths; three legacy read paths; everything else is migration/test/comment. Legacy readers are needed only until historical rows are retired (§4A.6).

### 4A.4 · Signed-URL mint audit (owner Q4)

**Endpoint:** `GET /api/nex-native/attachment/encrypted/signed?path=<storage_path>` · `src/app/api/nex-native/attachment/encrypted/signed/route.ts:51-119`.

- **Participant check:** `verifyParticipantForCiphertext(accountId, storagePath)` at `src/lib/nex-native/attachment/attachment-participant.ts:61-126`. Three-part lookup:
  1. `nex_peer_message WHERE attachment_meta->'envelope'->>'storage_path' = ?` (new encrypted);
  2. `nex_peer_message WHERE attachment_meta->'private_attachment'->>'storage_path' = ?` (standard-send P1.T06);
  3. `nex_peer_chat_envelope_overlay WHERE storage_path = ?` (legacy overlay compat, mig 298).
  Returns `participant` / `not-found` / `not-participant`.
- **Non-leak:** 404 for BOTH "not-found" and "not-participant" (route.ts:76-82). Comment line 22–23 documents the intent.
- **TTL:** 900 s via `SIGNED_URL_TTL_SECONDS = 900` (bucket-config.ts:35 · signed/route.ts:98). `expires_at` ISO returned.
- **Path validation:** `isValidPrivateAttachmentPath()` regex restricts to `enc/` or `std/` shape.
- **Bucket:** always `PRIVATE_CIPHERTEXT_BUCKET` — does not derive bucket from client.
- **Failure modes:** 401 no session · 404 malformed/not-found/not-participant · 503 private bucket unavailable · 500 sign op failure.

**Verdict:** signed-URL mint IS participant-gated end-to-end. No legacy public fallback from this endpoint (it only mints against the private bucket; legacy envelopes don't reach this endpoint — their URLs are returned by `resolveCiphertextFetchUrl` directly from `storage_url`).

### 4A.5 · End-to-end encrypted flow (owner Q5) — complete, no gaps

Sender → Recipient, every step with evidence:

1. `encryptFileBytes(bytes)` → `src/lib/nex-native/crypto/attachment-envelope.ts:93-98` — nacl.secretbox + random 32-byte key + 24-byte nonce.
2. `wrapContentKey(contentKey, self, targetAccountId, targetDeviceId, targetPublicKeyB64)` → `attachment-envelope.ts:102-122` — Curve25519 DH `nacl.box.after`.
3. POST `/api/nex-native/attachment/encrypted` → U-1 above. Returns `storage_path`.
4. `buildEnvelope(opts)` → `attachment-envelope.ts:230-267` — includes `storage_path`, `content_nonce_b64`, `wrapped_keys[]`, sender public key, content_type, size, optional encrypted filename for documents.
5. POST `/api/nex-native/peer-message/encrypted` (referenced from encrypted/route.ts:15) — stores envelope JSONB in `nex_peer_message.attachment_meta.envelope`.
6. Recipient fetches message row → envelope present.
7. Recipient calls `resolveCiphertextFetchUrl(envelope)` → R-1 above → `signed_url` returned (participant-gated, 900 s).
8. Image/video/audio path: `fetchAndDecryptAttachment(envelope, self, senderAccountId)` → R-3. Document path: `fetchAndDecryptDocument(...)` → R-4. Each unwraps content key, fetches ciphertext, `decryptFileBytes()` or `decryptSmallBytes()` for filename, returns `{bytes, [filename], contentType}` or null (no plaintext fallback).

**No gaps.** Every function is exported, every route handler exists, participant check is wired, and no silent plaintext fallback was found.

### 4A.6 · Sandbox verification steps for mig 295 + bucket provisioning (owner Q6)

Owner-authorised verification checklist. **Do NOT run yet** — this is documentation. Prod `ijvqdvsvwtwxzcqmoqit` stays sealed; sandbox `kdstoyyeygcopkogqsyv` only when owner names authorisation.

**V-1 Bucket provisioned (prerequisite — migrations cannot create buckets).**
```
POST https://<sandbox-ref>.supabase.co/storage/v1/bucket
  { id: "nex-peer-chat-ciphertext", name: "...", public: false,
    file_size_limit: 27262976, allowed_mime_types: ["application/octet-stream"] }
```
(Expected config per mig 295 header comment lines 15–25.)

**V-2 Bucket config correct.**
```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'nex-peer-chat-ciphertext';
-- Expect: public=false · file_size_limit=27262976 · allowed_mime_types contains 'application/octet-stream'
```

**V-3 Mig 295 RLS policies attached.**
```sql
SELECT policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
  AND policyname LIKE '%nex_peer_chat_ciphertext%'
ORDER BY policyname;
-- Expect 3: _service_role_all (permissive, service_role)
--           _anon_deny (restrictive, anon)
--           _authenticated_deny (restrictive, authenticated)
```

**V-4 Mig 295 recorded in history.**
```sql
SELECT version, description FROM nex_migration_history WHERE version = '295';
```

**V-5 Proof: anon + authenticated DENIED direct SELECT on `storage.objects` for this bucket.** (Role-impersonation test; sandbox only.)

**V-6 Proof: service_role CAN SELECT.** (Server-side upload path depends on this.)

**V-7 Legacy row count against public bucket.**
```sql
SELECT COUNT(*) FROM nex_peer_message
WHERE attachment_url LIKE '%nex-peer-chat-attachments%'
   OR attachment_meta::text LIKE '%nex-peer-chat-attachments%';
```
(Owner-decision input for §4A.7.)

### 4A.7 · Legacy-data retirement options (owner Q7)

Three strategies the Founder chooses between (F-16):

**Strategy A — "Leave legacy readable; retire public bucket post-launch."**
- Pros: zero backfill · fastest to launch · reversible.
- Cons: public bucket stays online; legacy plaintext (pre-encrypted era) remains world-readable with URL; long-tail tech debt.
- Fit: acceptable if the Founder is OK saying "legacy messages pre-cutoff are not covered by the new privacy guarantee."

**Strategy B — "Backfill to private + rewrite `attachment_url` rows."**
- Pros: fully sealed · can decommission public bucket.
- Cons: one-off backfill job · idempotency + retry engineering · schema change on `attachment_url` nullability · must handle Vault re-fetch paths that depend on legacy URLs.
- Fit: required if launch messaging promises retroactive privacy.

**Strategy C — "Hybrid: migrate chat only; keep public bucket for business assets."**
- Pros: smaller backfill scope · leverages existing `nex-business-assets` relocation · clearer separation of concerns.
- Cons: still needs a chat-attachment backfill · public bucket persists but only for business assets.
- Fit: most consistent with the already-executed 2026-11-13 split; recommended if the Founder wants fully-sealed private chat without disturbing business-asset flows.

**Recommendation for the Founder (engineering proposal · not a seal):** Strategy C. It matches the existing architectural split, keeps the backfill scope bounded to chat messages, and allows a clean statement that "all new chat content is private; all legacy chat attachments have been migrated to the private bucket; business assets remain public by design." Requires F-16 to seal.

### 4A.8 · Reconciled verdict (Pass 3 · revised)

- Chat-privacy claim is **NOT** provably false. New upload paths are private-bucket-only with fail-safe 503; the plaintext path is default 410-frozen; the signed-URL mint is participant-gated; the retrieval helper never silently falls back to a plaintext URL.
- The P0-GATE items that would make the claim false if the Founder publicly asserts "private chat" at launch are:
  1. Private bucket provisioned in production (manual Storage API call).
  2. Mig 295 applied in production.
  3. Legacy chat attachments reconciled per §4A.7 Strategy chosen by Founder (F-16).
- Audit scope boundaries: no production data read, no sandbox data read, no bucket API call, no user content exposed. Pure static-evidence audit.

---

## 5 · Feature and dependency map

### 5.1 · Dependency chain for launch (critical path)

```
NEX-017 doctrine (device-only chat)
  ├─ depends on P2 remediation P0 chat-privacy close (bucket private, schema debt)
  └─ blocks launch claim of "private chat"

NEX-015 + NEX-016 (shop payments)
  ├─ depends on Stripe sandbox exercise (gated by owner)
  ├─ depends on mig 311 sandbox application verification
  └─ blocks GAP-NAV-001 "Create Shop" meaningful destination

NEX-020 + NEX-023 (Emergency Help)
  ├─ depends on mig 224/225 application (gated by owner)
  ├─ depends on explanation-card UI (NEX-023 per 2026-11-24 seal)
  └─ blocks launch claim of "SOS works"

NEX-013 (Vault)
  ├─ depends on `nex_vault_*` mig state verification
  ├─ depends on unlock-flow Playwright
  └─ blocks GAP-NAV-002 "Activate Vault" meaningful destination

NEX-008 (Buyer checkout)
  ├─ depends on P1-A price-validation audit close
  └─ blocks launch claim of "buying works"
```

### 5.2 · Migrations with launch impact

| Migration | Feature | State | Launch risk |
|---|---|---|---|
| 055 | peer-chat-attachments bucket | **Public** (P0) | Must become private before any launch claim of privacy |
| 097 | ciphertext purge job | Present | Verify runs in sandbox |
| 103 | outbox | Present | Verify behaviour |
| 224 / 225 | Emergency Help | AUTHORED NOT APPLIED | Blocks NEX-020 |
| 258 | billing | Owner-sealed (P0-GATE) | Would block only on apply |
| 279 | chat message edit | NOT APPLIED | Chat-edit path BROKEN until applied |
| 300 | HQ alerts (prod) | AUTHORED NOT APPLIED | Blocks NEX-018 prod |
| 304 | HQ alerts (sandbox) | APPLIED SANDBOX ONLY | OK for sandbox phase |
| 311 | stripe_connect_account_id | Present but state TBD | Blocks NEX-016 verification |
| 315 / 316 / 317 | Support tickets | Sealed sandbox-only | Prod sealed intentionally |
| 341 / 343 | Themes + bubble colours | NOT APPLIED | Causes silent-save failure NAV-0019/0021 |
| 354 / 365 | Commerce payloads | Present | Verify applied state |

### 5.3 · Six tables with deferred RLS

Per Mapping Audit §7. Each is a launch-gate item: ship-stopping if a table holds user data without RLS.

---

## 6 · Launch engineering backlog (P0 … P3)

Each item: `Feature/Gap ID · User impact · Dependencies · Implementation summary · DB · Acceptance · Test · Approval · Complexity · Predecessor`.

### 6.1 · P0 (blocks fundamental operation / security / data)

| # | ID | Why P0 |
|---|---|---|
| P0-1 | Phase 2 chat-privacy close (bucket → private + attachment migration) | Launch claim of privacy is false until this closes |
| P0-2 | mig 258 billing RLS audit close | P0-GATE: becomes P0-CURRENT the day a billing row is written |
| P0-3 | NEX-008 buyer-checkout price-validation (P1-A audit close) | Monetary correctness |
| P0-4 | NEX-017 schema-debt reconciliation (ADR-0002 file + reconcile `nex_peer_message.body`) | Doctrine conformance |
| P0-5 | NEX-023 location explanation card BEFORE browser prompt | Sealed 2026-11-24; privacy risk if wrong |

### 6.2 · P1 (blocks essential customer or business-owner journey)

| # | ID | Why P1 |
|---|---|---|
| P1-1 | **GAP-NAV-001 Create Shop drawer row + conditional logic** | Owner explicitly flagged |
| P1-2 | **GAP-NAV-002 Vault & backups drawer row** | Owner explicitly flagged |
| P1-3 | NEX-015 Shop subscription path exercised in sandbox | Monetisation unverified |
| P1-4 | NEX-016 merchant-direct Stripe connect sandbox exercise | Monetisation unverified |
| P1-5 | NEX-020 Emergency Help migrations 224/225 applied in sandbox + SOS contact UI | Sealed product value blocked today |
| P1-6 | NEX-013 Vault unlock + upload Playwright close | Entry point exists, verification open |
| P1-7 | mig 341/343 apply to kill NAV-0019/0021 silent-save | "Mock UI by accident" fix |
| P1-8 | NEX-010 shop templates smoke test | Shop must look non-broken |
| P1-9 | G-1 State B `onboarding_complete` column | Returning mid-onboarding user experience |
| P1-10 | G-4 theme persistence pre-auth → auth verification | Owner Proof #1 |
| P1-11 | G-5 shop offer screen verification (after P1-3/4 complete) | Owner Proof #3 |
| P1-12 | G-6 Invite Friends / Share NEX ID discoverability | Owner Proof #4 |

### 6.3 · P2 (launch quality, reliability, usability)

| # | ID | Why P2 |
|---|---|---|
| P2-1 | NEX-021 full-viewport sweep + `full-viewport-chrome.spec.ts` | Sealed 2026-11-24 |
| P2-2 | NEX-022 PWA install promotion wiring | Sealed 2026-11-24 |
| P2-3 | NEX-014 Why NEX drawer row | Blueprint §6 requested |
| P2-4 | NEX-006/007 Why NEX page + savings calculator Playwright | Marketing surface correctness |
| P2-5 | Perf regression CI enforcement | Sealed 2026-11-23 |
| P2-6 | Support tickets (NEX-019) — defer to v1.1 or apply sandbox-only ops path | Owner call |
| P2-7 | HQ incident/alerts (NEX-018) — apply mig 300 to prod? | Owner call |

### 6.4 · P3 (optional / deferred / needs-decision)

- NEX-002, NEX-003, NEX-005, NEX-009, NEX-011, NEX-012, NEX-001
- GAP-NAV-003..007 orphan zones — owner keep-or-delete decision required

---

## 7 · Near-live acceptance standard

NEX is **not** near-live until **every** row has independent evidence (not implementer self-report):

1. All LAUNCH-CRITICAL user journeys have a passing Playwright journey test executed by an **independent QA agent / human**.
2. Every entry point for a LAUNCH-CRITICAL feature exists and has been exercised.
3. Every return path (Back / close / cancel) preserves user state per that feature's card.
4. Every save/toggle/upload/delete writes to Supabase and the write has been verified in the sandbox DB (per sealed 2026-11-12 "UI must be DB-wired" rule).
5. Authentication and session expiry paths correct across guest / signed-in / admin / dev-impersonation.
6. Chat privacy: ciphertext-only on server, bucket private, purge job verified, schema debt reconciled.
7. Merchant-owned payment flow: trial start → day-5 reminder → charge day 8 → cancel-during-trial preserves access → merchant-direct Stripe charge.
8. SOS: contact CRUD, SOS activation without server coord write, cancel ≠ recall, explanation card before browser prompt.
9. Notifications: every advertised notification has a verified source event and delivery path.
10. Mobile + desktop + PWA-standalone: rendering + behaviour verified; full-viewport rule passing.
11. Error recovery: a user recovers from each known failure mode (network loss, session expired, migration gap, Stripe decline, Supabase outage) with a documented path back.
12. Security + regression tests on CI as required status checks on protected branches.
13. Build + deploy chain: push → deploy → `x-nex-commit-sha` matches HEAD per perf-regression chain verification 2026-11-23.
14. **Sandbox verification is separate from production readiness.** Sandbox green ≠ prod green. Prod remains sealed until a separate release decision.

**None of the 14 rows is passing today.** This is the honest bar.

---

## 8 · Test and independent QA strategy

### 8.1 · Independent QA contract

- QA agent **does not** share a working directory with the implementation agent.
- QA agent **does not** read the implementation agent's commit message or PR body as a shortcut.
- QA agent runs the Playwright journey from a clean sandbox DB with migrations applied fresh.
- QA agent asserts observable behaviour (DOM state, network requests, DB rows after action), not source-code greps.
- QA agent is empowered to **reject** work and return it to implementation. Rejected work does not merge.

### 8.2 · Required test families (one per LAUNCH-CRITICAL journey)

- `journey-create-shop.spec.ts` (fixes P1-1 destination existence)
- `journey-vault-activate.spec.ts` (fixes P1-2 destination)
- `journey-shop-trial-day-5-day-8.spec.ts` (P1-3)
- `journey-merchant-stripe-connect.spec.ts` (P1-4)
- `journey-sos-activate-cancel.spec.ts` (P1-5)
- `journey-buyer-checkout.spec.ts` (NEX-008)
- `journey-chat-send-e2e.spec.ts` (NEX-017)
- `journey-first-user-A-to-contacts.spec.ts` (G-4 + G-5 + G-6 + Owner Proof #1–#4)
- `journey-returning-signed-out-D-to-signin.spec.ts` (G-2 Owner Proof #2 remainder)
- `journey-chat-theme-persistence.spec.ts` (NEX-010 + G-4)
- `full-viewport-chrome.spec.ts` (NEX-021)
- `pwa-install-cadence.spec.ts` (NEX-022)
- `location-permission-explanation-card.spec.ts` (NEX-023)
- `nav-dead-link-crawl.spec.ts` (nav completeness — see §8.4 revised rule)

### 8.3 · Tree testing (human research — not agent simulation)

Owner-approved doctrine 2026-11-24: simulated scores are **not** real user research. Before treating Option X navigation as proven:

- Sitemap tree export (no UI) → 10–15 human participants per role × 8 realistic tasks → measure findability, first-click accuracy, time-to-find, wrong-category rate, lost rate.
- Report split by role; do **not** average across roles.
- Any task with <80% first-click accuracy on a LAUNCH-CRITICAL feature is a blocker for that feature's placement.

### 8.4 · Revised CI rule (replacing my earlier `routes_visited == N_routes`)

**Owner correction accepted.** Not every route is reachable from the main drawer by design (role-gated, session-gated, deep-link-only, admin-only). The correct rule is:

- Every LAUNCH-CRITICAL route is reachable **under its documented entry conditions**: by a user with the required role, session, and path.
- Every **non-gated** route is reachable from documented UI.
- A route may be legitimately gated **if and only if** its entry condition is recorded in the journey ledger.
- Orphan detection = route with **no** recorded entry condition in the ledger AND **no** declared reason-for-being-reachable-only-by-direct-URL.

CI status: a new PR that introduces an `<Link>` target for which no entry condition is recorded fails CI.

---

## 9 · Autonomous engineering workflow

### 9.1 · Role-separated agents (owner-approved 2026-11-24)

| Agent | Responsibility | Can / cannot |
|---|---|---|
| **Founder / Product Owner** | Product vision, commercial decisions, approval boundaries | HUMAN. Not simulatable. |
| **Product Architect** | Complete user experience and feature relationships | Reads, proposes, challenges. Cannot commit code. |
| **UX / Journey Researcher** | Entry points, navigation, order, placement, user expectations | Reads, proposes, scores. Cannot commit code. Flags simulation vs real research. |
| **Competitor Researcher** | Proven patterns in comparable products | WebSearch / WebFetch. Produces primary-sourced reports. |
| **Engineering Architect** | Routes, services, APIs, state, data dependencies | Reads codebase. Cannot commit code. |
| **Implementation Engineer** | Build approved work end-to-end | Edits inside approved scope. Cannot approve its own work. |
| **QA / User Simulation** | Independently test journeys | Runs Playwright, asserts observable behaviour, rejects incomplete work. Does **not** share context with Implementation agent. |
| **Independent Release Auditor** | Challenge the build, verify evidence | Audits PRs for implementer-bias, fake-done risk, evidence vs claim. |

### 9.2 · Eight-step autonomous cycle (per feature / per PR)

1. **Discover** — Engineering Architect + Product Architect read repo + requirements + blueprint + feature ledger.
2. **Research** — UX Researcher + Competitor Researcher produce evidence (sourced).
3. **Architect** — Claude (coordinating) selects and documents the recommended solution; Independent Release Auditor challenges.
4. **Implement** — Implementation Engineer builds in sandbox inside approved scope.
5. **Challenge** — QA agent attempts to break the journey; separate Playwright run; DB-row assertions; reverse-direction tests.
6. **Correct + retest** — Implementation Engineer fixes within authority; back to step 5 until QA passes.
7. **Reconcile** — feature ledger, journey map, blueprint, and verification evidence updated.
8. **Founder release gate** — owner reviews evidence; approves or revises; any action requiring owner authority stops here.

### 9.3 · Hand-off contract between agents

Every hand-off records:

- What the previous agent did (actions taken, files touched, tests run, evidence captured)
- What it claims (BUILT / WIRED / VERIFIED / REMAINING / BLOCKED per 2026-11-12 contract)
- What it **cannot** claim (explicit limitations — what the next agent must verify)
- A single-file deliverable that the next agent can read without re-context

Testing of the hand-offs themselves is a required discipline per owner doctrine 2026-11-24: inter-agent interfaces fail more often than single-agent output (MAST taxonomy: *context bleed / cascade error*).

### 9.4 · What agents may NOT do autonomously

- Invent commercial decisions (price, trial length, revenue split)
- Weaken sealed privacy or security doctrine
- Apply migrations
- Deploy to prod
- Commit without owner trigger
- Edit `MEMORY.md` or `CLAUDE.md` global instructions
- Claim VERIFIED without the test family defined in §8.2 for that feature

---

## 10 · Near-live acceptance checklist

A single-page owner review surface. Each row checked when evidence is attached.

- [ ] P0-1 Phase 2 chat-privacy close — bucket private + attachments migrated + Playwright `chat-privacy.spec.ts` passing + schema debt ADR-0002 filed
- [ ] P0-2 mig 258 billing RLS audit close (file in `docs/doctrine/billing-rls-audit-2026-11-21.md` already)
- [ ] P0-3 NEX-008 buyer-checkout price-validation close
- [ ] P0-4 NEX-017 schema reconciliation
- [ ] P0-5 NEX-023 location explanation card
- [ ] P1-1 GAP-NAV-001 Create Shop drawer row + conditional + regression test update
- [ ] P1-2 GAP-NAV-002 Vault drawer row + regression test update
- [ ] P1-3 Shop subscription Playwright passing in sandbox
- [ ] P1-4 Merchant-direct Stripe connect Playwright passing in sandbox
- [ ] P1-5 **Chat Themes Phase B** — Stripe writer + webhook + `themes_plus_until` + first-free apply write + 5 journey tests (per §4.3)
- [ ] ~~P1-6 Vault unlock Playwright~~ — reclassified OPTIONAL Pass 2
- [ ] P1-7 mig 341/343 applied in sandbox, NAV-0019/0021 moved from BROKEN → VERIFIED
- [ ] P1-8 Shop templates smoke test passing
- [ ] P1-9 G-1 State B column decision
- [ ] P1-10 G-4 theme persistence verified (Owner Proof #1)
- [ ] P1-11 G-5 shop offer verified (Owner Proof #3)
- [ ] P1-12 G-6 Invite / Share discoverability verified (Owner Proof #4)
- [ ] P2 quality items (NEX-021/022/014/006/007/perf)
- [ ] §8.3 tree testing with ≥10 humans per role on 8 LAUNCH-CRITICAL tasks
- [ ] §7 near-live acceptance 1..14 all green
- [ ] Owner release gate: production remains sealed; owner issues separate word-trigger for any prod change

---

## 11 · Decisions split — Founder vs engineering (Pass 2)

Pass 1 listed 16 "Founder decisions". Owner's Pass 2 correction: most are engineering decisions the autonomous team can resolve. True Founder decisions are product direction · commercial logic · privacy requirements · irreversible production/data moves · legal · launch-brand scope.

### 11.A · Genuine Founder decisions (CANNOT be resolved by engineering)

For each: **why engineering cannot resolve it.**

| # | Decision | Why engineering cannot resolve |
|---|---|---|
| F-1 | **Confirm §2 launch pillars** (NEX Chat · NEX Shop · Chat Themes) — or add/remove | Product direction. Only the Founder knows what the first public release promises customers. |
| F-2 | **GAP-NAV-003..007 orphan zones** — for each (NEX LIVE / Music / Group Calls / Family Safety / Notifications): keep + wire, defer, or delete | Product scope. Deleting code deletes capability; wiring commits launch resources. |
| F-3 | **NEX-001 merchant data export** — B1 delivery · B2 background-job budget · B3 Vault inclusion · B4 size cap · B5 legal phrasing | B5 is a legal/privacy-policy obligation. B1–B4 are commercial scope. |
| F-4 | **NEX-011 flippable chat cards** — generic or Safe Trade only? | Product scope decision. |
| F-5 | **Authorise Stripe sandbox exercise** for NEX-015 + NEX-016 | Money + irreversible external account connections; owner-sealed commercial model requires named trigger. |
| F-6 | **Authorise Themes+ Phase B** (Stripe writer + webhook + `themes_plus_until` write) | Money path. Owner Phase A seal 2026-11-13 deliberately held Phase B back. |
| F-7 | **Authorise mig 224/225 apply** to sandbox (Emergency Help contact tables) | Sealed 2026-11-09 doctrine; owner-closed intentionally; even sandbox apply is a named-authorisation step. |
| F-8 | **Authorise mig 341/343 apply** to sandbox (themes + bubble colours — silent-save failure) | Named-migration authorisation per CLAUDE.md §4/§5. |
| F-9 | **G-1 onboarding_complete column** — approve or reject | Irreversible schema change; owner-approved naming/semantics required. |
| F-10 | **NEX-018 HQ alerts** — apply mig 300 to **prod**? | Production migration = sealed prod project. Named prod authorisation required. |
| F-11 | **NEX-019 support tickets** — remain sandbox-only · defer to v1.1 · or apply to prod | Owner-sealed sandbox-only 2026-11-10 with explicit refusal of prod apply. Reopen requires Founder word-trigger. |
| F-12 | **Tree-testing budget** — ≥10 humans per role × 8 tasks · or continue with agent simulation | Research spend decision. |
| F-13 | **Production deploy decision** (per CLAUDE.md §5) | Prod gate — separate word-trigger. |
| F-14 | **Legal review of Privacy Policy §19** (data export obligation) | Legal counsel required; not an engineering decision. |
| F-15 | **Launch-brand scope** — nexcorner.com vs other surfaces | Commercial/brand decision. |
| F-16 | **Chat-privacy legacy-row policy** (per §4A.3) — migrate historical `attachment_url` public-bucket rows to private, OR declare them legacy-public | Privacy-posture commitment; owner call before any public chat-privacy claim. |
| F-17 | **Public-bucket retirement path** for `nex-peer-chat-attachments` (per §4A.3) — retire post-launch vs keep for business-asset pipeline | Commercial/architectural tradeoff. |

### 11.B · Engineering decisions the autonomous team resolves (inside approved scope)

These do NOT require Founder approval beyond the operating-model doctrine already sealed 2026-11-24. Agents resolve them and record the choice in the hand-off.

| # | Decision | Resolver |
|---|---|---|
| E-1 | Option X vs Option Y navigation structure — final selection | Product Architect + UX Researcher produce evidence-backed recommendation; Independent Auditor challenges; only Founder-level pillars affect the choice. |
| E-2 | Exact row ordering within the drawer under Option X | UX Researcher — frequency × criticality scoring. |
| E-3 | Full route denominator (`next build` + manifest parse) | Engineering Architect. |
| E-4 | Playwright helper patterns, selector strategy, fixture layout | QA Agent. |
| E-5 | NAV-nnnn numbering continuation and ledger upgrades DISCOVERED → MAPPED → VERIFIED | Engineering Architect + QA Agent. |
| E-6 | Error-recovery copy wording in each journey card (within sealed doctrine) | Product Architect + Implementation Engineer. |
| E-7 | Tool choice between Browser Use vs Skyvern for agent-as-user crawl (both production-ready per 2026-11-24 memory; neither requires Founder approval until install) | Engineering Architect — flagged to Founder only if install authorisation needed. |
| E-8 | CI check names + required-status enforcement wiring (owner already sealed the perf-regression rule 2026-11-23) | Implementation Engineer. |
| E-9 | Test family names + test matrix in `playwright.*.config.ts` | QA Agent. |
| E-10 | File locations for new route handlers, components, services (inside repo-layout rules) | Implementation Engineer. |
| E-11 | Mapping Audit §6 13-orphan-server-action disposition (wire-up vs remove, within approved scope) | Engineering Architect + Implementation Engineer. |
| E-12 | Mapping Audit §7 six-table RLS authoring (schema stays sandbox-only until Founder apply) | Engineering Architect; Founder authorises apply. |
| E-13 | Journey-ledger population at Pass 2 depth for the remaining 10 LAUNCH-CRITICAL cards | Product Architect + Engineering Architect. |
| E-14 | Sandbox-only verification order inside §6 P0/P1 backlog | QA Agent + Independent Auditor. |

---

## 12 · Recommended execution sequence

**Four gates (owner-approved doctrine 2026-11-24):**

### Gate 1 · Product foundation

1. Owner reviews this plan and approves §2 + §3 + §11.1.
2. Claude (Product Architect) produces option-Y navigation sketch if owner wants both.
3. Competitor Researcher agent produces evidence pack for the top 3 competitor shop + chat apps (per prior 2026-11-23 memory on 11 competitors).
4. Tree-testing plan drafted (even if execution deferred).
5. Owner closes Gate 1 by signing off the final navigation + feature classification.

### Gate 2 · Engineering connections

6. Engineering Architect produces full route denominator (`next build` + manifest parse + `next-route-impact`).
7. All 85 Pass 1 NAV rows upgraded to MAPPED status (branches + reverse direction filled).
8. New NAV rows added for LAUNCH-CRITICAL journeys not yet enumerated.
9. Migration apply sequence authored (in-order list, each with its own authorisation word-trigger).
10. Owner reviews the engineering connection map.

### Gate 3 · Sandbox implementation

11. P0 items in order. QA agent rejects incomplete work.
12. P1 items in order.
13. GAP-NAV-001 and GAP-NAV-002 drawer rows implemented (regression test updated in same PR).
14. mig 341/343 and mig 224/225 applied in sandbox (per 11.2 approvals).
15. Shop subscription + merchant Stripe exercised in sandbox.
16. Tree-testing with humans (if approved 11.2).

### Gate 4 · Near-live readiness

17. Independent Release Auditor runs the §7 14-row checklist against the sandbox build.
18. All green → owner reviews evidence pack → owner issues production release word-trigger (separate CLAUDE.md §5).
19. Prod deploy. Verify `x-nex-commit-sha` matches HEAD per perf-regression chain.
20. Post-launch monitoring per §7 row 12.

**Ordering principle:** nothing downstream advances if an upstream gate is not closed with evidence. "Written is not done" applies at every gate.

---

## 12A · Execution backlog (Pass 3 · per-task fields)

Each row is one bounded sandbox-executable unit. **No code change authorised yet** — this is the backlog the owner can approve selectively. "Founder-approval" column names the specific gate.

### 12A.1 · Priority 0 — launch-privacy readiness (bounded sandbox verification tasks)

| # | Task | Feature / NAV | Journey | Dependencies | Implementation area | Acceptance | Required tests | Security + data | Sandbox-completable | Founder approval needed |
|---|---|---|---|---|---|---|---|---|---|---|
| 0.1 | Verify mig 295 + private bucket provisioning in sandbox (per §4A.6) | NEX-017 · §4A · §4.5 | §4.5 attachment send/receive | mig 295 authored; sandbox DB access | DB read-only + Supabase Storage read-only | V-1..V-6 checklist all pass; no new data written | `journey-chat-attachment-signed-url-non-participant-404.spec.ts` · V-5/V-6 role-impersonation | Zero data exposure; read-only | YES (verification only, no apply) | **F-7-like trigger needed** — sandbox Storage-API call is sealed |
| 0.2 | Count legacy public-bucket rows (V-7 only) | NEX-017 · §4A | §4.5 | mig state read | Read-only SQL | Count returned · categorised chat vs business-asset | n/a | Zero data exposure | YES | Sandbox read authorisation |
| 0.3 | Propose Strategy A / B / C for legacy retirement (engineering recommendation) | NEX-017 · §4A.7 | §4.5 | §4A.6 output | Doctrine document authoring | Owner picks strategy by F-16 | n/a | n/a | n/a (planning) | **F-16** |
| 0.4 | Mig 295 apply authorisation request package | NEX-017 · §4A | §4.5 | 0.1 verification | Doctrine package | Owner signs named authorisation | n/a | n/a | n/a | **F-7-analogue for mig 295** (new Founder decision) |

### 12A.2 · Priority 1 — NEX Chat pillar (bounded, mostly unblocked engineering)

| # | Task | Feature / NAV | Journey | Dependencies | Implementation area | Acceptance | Required tests | Security | Sandbox-completable | Founder approval |
|---|---|---|---|---|---|---|---|---|---|---|
| 1.1 | Author `journey-chat-send-e2e.spec.ts` | NEX-017 · NAV-0xxx chat-send row | §4.1 | existing chat routes | `tests/e2e/` | Playwright passes on sandbox: A→C new conversation; outbox offline; retract; delete-for-me | self | Device-only; no new server storage | YES | NO (test-only, §11.B E-4/E-9) |
| 1.2 | Author `journey-chat-attachment-encrypted-image.spec.ts` + `-document` + `-fail-safe-503` + `-non-participant-404` + `-legacy-public-envelope-resolve` | NEX-017 · §4A · §4.5 | §4.5 | 0.1 verification | `tests/e2e/` | All five Playwright specs pass on sandbox | self | Participant-gated; non-leak check included | YES | NO |
| 1.3 | ADR-0002 — schema-debt reconciliation of `nex_peer_message.body` sentinel constraint | NEX-017 schema debt | §4.1 | schema read | `docs/architecture/decisions/` | ADR filed + reviewed | n/a | n/a | YES | NO (ADR filing is engineering) |
| 1.4 | Author mig 097 ciphertext-purge sandbox verification spec (observable: insert row, wait window, confirm purged) | NEX-017 · mig 097 | §4.1 | mig 097 applied | `tests/e2e/` | Playwright passes | self | Inserts dummy ciphertext; purge deletes | YES | NO |
| 1.5 | Author mig 279 chat-edit apply + verification spec | NEX-017 · mig 279 | §4.1 | mig 279 authored · NOT APPLIED | `tests/e2e/` + mig apply | On apply: edit history row written; UI edit works | self | New schema; apply gated | NO on apply | **F-new** (mig 279 sandbox apply) |

### 12A.3 · Priority 1 — NEX Shop pillar

| # | Task | Feature / NAV | Journey | Dependencies | Implementation area | Acceptance | Required tests | Security | Sandbox-completable | Founder approval |
|---|---|---|---|---|---|---|---|---|---|---|
| 2.1 | Implement GAP-NAV-001 `Create Shop` drawer row — conditional on `nex_business` absence, with `__tests__/control-drawer-client.test.tsx` regression update in same PR | GAP-NAV-001 · NEX-015 | §4.2 | Blueprint §6 drawer inventory | `src/app/nex-native/_shell.tsx` or drawer component; test update | Drawer regression test green; conditional label flips | self + drawer regression | None | YES | NO (bounded sandbox UI inside sealed drawer contract; §11.B E-1/E-10) |
| 2.2 | Author `journey-create-shop.spec.ts` | NEX-010/015/016 · GAP-NAV-001 | §4.2 | 2.1 | `tests/e2e/` | Playwright passes · state A→create→template→details→save | self | Writes `nex_business` row | YES | NO |
| 2.3 | Author `journey-shop-trial-day-5-day-8.spec.ts` (requires Stripe test mode) | NEX-015 | §4.2 | **F-5 Stripe sandbox exercise** · mig 311 state verified | `tests/e2e/` | Playwright passes · trial start, day-5 reminder observed, day-8 charge | self | Writes `nex_business.subscription_status` | YES after F-5 | **F-5** |
| 2.4 | Author `journey-merchant-stripe-connect.spec.ts` | NEX-016 · mig 311 | §4.2 | **F-5** · mig 311 | `tests/e2e/` | Playwright passes · OAuth round-trip · `stripe_connect_account_id` populated | self | Writes `stripe_connect_account_id` | YES after F-5 | **F-5** |
| 2.5 | Author `journey-buyer-checkout.spec.ts` incl. server-side price-validation (closes P1-A audit) | NEX-008 · mig 354/365 | §4.2 buyer-side | mig 354/365 applied state | `tests/e2e/` | Playwright passes · price-tamper attempt rejected · `nex_order` written with JSONB snapshot | self | Price validation at server | YES | NO (engineering within sealed Path A doctrine) |
| 2.6 | Verify mig 311 sandbox apply state | NEX-016 | §4.2 | sandbox DB read | Introspection | State recorded | n/a | None | YES | Sandbox read authorisation |

### 12A.4 · Priority 1 — Chat Themes pillar

| # | Task | Feature / NAV | Journey | Dependencies | Implementation area | Acceptance | Required tests | Security | Sandbox-completable | Founder approval |
|---|---|---|---|---|---|---|---|---|---|---|
| 3.1 | Author `journey-chat-theme-apply-free.spec.ts` + `-first-free-apply` | Themes+ Phase A sealed 2026-11-13 | §4.3 | Phase A UI + first-free writer authorised | `tests/e2e/` | Playwright passes · free apply · first-free row written | self | Writes `nex_theme_ownership` row | YES | NO |
| 3.2 | Author `journey-chat-theme-subscribe-themes-plus.spec.ts` | Themes+ Phase B | §4.3 | **F-6 Phase B Stripe writer** | `tests/e2e/` | Playwright passes · webhook writes `themes_plus_until` | self | Stripe webhook + DB write | YES after F-6 | **F-6** |
| 3.3 | Author `journey-chat-theme-region-unsupported-waitlist.spec.ts` | Themes+ | §4.3 | region table seeded | `tests/e2e/` | Unsupported region → WAITLIST (no USD fallback) | self | Writes waitlist row | YES | NO |
| 3.4 | Author `journey-chat-theme-cancel-subscription-retains-first-free.spec.ts` | Themes+ · ownership doctrine | §4.3 | 3.1 + 3.2 | `tests/e2e/` | After subscription expires, first-free theme still applied | self | n/a | YES after F-6 | **F-6** |
| 3.5 | Mig 341/343 apply authorisation request package (themes + bubble colours) — closes NAV-0019/0021 silent-save | NEX-010 · mig 341/343 | §4.3 + §4.1 | mig 341/343 authored NOT APPLIED | Doctrine package | Owner signs named authorisation | n/a | New columns | NO on apply | **F-8** |

### 12A.5 · Priority 1 — First-time + Returning-user journeys (unblocked work)

| # | Task | Feature / NAV | Journey | Dependencies | Implementation area | Acceptance | Required tests | Security | Sandbox-completable | Founder approval |
|---|---|---|---|---|---|---|---|---|---|---|
| 4.1 | Author `journey-first-user-A-to-contacts.spec.ts` (Owner Proof #1/#4) | G-4 · G-6 · NEX-017 | §4.4 + §4.1 | existing register + contacts routes | `tests/e2e/` | Playwright passes A → contacts seeded → first thread | self | New account row | YES | NO |
| 4.2 | Propose G-1 `onboarding_complete` column schema + journey behaviour | G-1 | §4.4 · §4.7 interruption #1 | schema read | Doctrine package + mig draft | Owner signs F-9 | n/a | New column | NO on apply | **F-9** |
| 4.3 | Author `journey-returning-signed-out-D-to-signin.spec.ts` (Owner Proof #2 close) | G-2 · `nex_known_device` | §4.7 | G-2 fixed 2026-11-23 | `tests/e2e/` | Playwright passes known-device + unknown-device branches | self | Cookie only | YES | NO |
| 4.4 | Author `journey-mid-shop-setup-interrupt-resume.spec.ts` | §4.7 interruption #4 | §4.7 | setup_step cursor verified | `tests/e2e/` | Playwright passes · phone-kill mid-setup · resume at correct step | self | n/a | YES | NO |
| 4.5 | Author `journey-mid-checkout-session-expired.spec.ts` | §4.7 interruption #5 | §4.7 · §4.2 buyer | mig 354/365 applied | `tests/e2e/` | Playwright passes · Stripe session expired → `My orders` shows Finish payment | self | n/a | YES | NO |
| 4.6 | Author `journey-directory-browse-and-filter.spec.ts` + `-signed-out-browse-buy-auth-gate.spec.ts` | §4.6 · auth-gate 2026-11-21 | §4.6 | `/directory` + `[businessSlug]` present | `tests/e2e/` | Playwright passes · search · filter · signed-out auth-gate on buy | self | n/a | YES | NO |

### 12A.6 · Priority 2 — Launch quality (sandbox-executable)

| # | Task | Feature | Journey | Dependencies | Area | Acceptance | Tests | Sandbox | Founder approval |
|---|---|---|---|---|---|---|---|---|---|
| 5.1 | Author `tests/e2e/full-viewport-chrome.spec.ts` (NEX-021 sealed 2026-11-24) | NEX-021 | §4.10 | existing layout | `tests/e2e/` | Playwright Pixel 7 + iPhone 14 Pro: boundingBox covers viewport | self | YES | NO |
| 5.2 | Author `pwa-install-cadence.spec.ts` (NEX-022 sealed 2026-11-24) | NEX-022 | §4.10 | install components | `tests/e2e/` | Install prompt only after register + Contacts + meaningful interaction | self | YES | NO |
| 5.3 | Author `location-permission-explanation-card.spec.ts` (NEX-023 sealed 2026-11-24) | NEX-023 | §4.10 | existing SOS gate | `tests/e2e/` | Explanation card shown BEFORE browser prompt; denial does NOT block SOS setup | self | YES | NO |
| 5.4 | Perf-regression branch-protection ruleset activation (per CLAUDE.md §10.3) | perf blueprint | §4.10 | existing CI workflow | GitHub ruleset | Required check enforced on `main` + release branch | self | n/a | **Repo-admin trigger** (Founder) |
| 5.5 | Author `nav-dead-link-crawl.spec.ts` per revised §8.4 rule (owner-corrected) | NAV-coverage | §4.10 | journey-ledger NAV-nnnn registry | `tests/e2e/` + custom reporter | Fails PR if `<Link>` target lacks entry-condition registration | self | YES | NO |

### 12A.7 · Independent tasks (unblocked — no Founder approval required)

All §12A.2–§12A.6 rows whose "Founder approval" column is NO can proceed **independently**. Explicit unblocked list:
- 1.1 · 1.2 · 1.3 · 2.1 · 2.2 · 2.5 · 3.1 · 3.3 · 4.1 · 4.3 · 4.4 · 4.5 · 4.6 · 5.1 · 5.2 · 5.3 · 5.5

These are 17 sandbox-executable tasks engineering can take right now the moment the Founder authorises implementation under §11.B scope. Nothing in this group writes to prod, touches money, or invents commercial decisions.

### 12A.8 · Tasks BLOCKED behind a specific Founder decision (listed per decision)

| Founder decision | Unblocks tasks |
|---|---|
| F-5 Stripe sandbox exercise | 2.3 · 2.4 |
| F-6 Themes+ Phase B authorisation | 3.2 · 3.4 |
| F-7 Mig 224/225 apply (Emergency Help) | currently sealed closed · no tasks blocked (intentional) |
| F-8 Mig 341/343 apply | 3.5 (apply step) |
| F-9 G-1 onboarding_complete | 4.2 (apply step) |
| F-16 Legacy-row policy | 0.3 strategy acceptance + any backfill task |
| New: mig 295 apply authorisation | 0.4 apply step + prod-privacy claim |
| New: mig 279 apply authorisation | 1.5 (apply step) |
| Repo-admin ruleset activation | 5.4 |

---

## 13 · Honest limitations of this plan

1. **This is Pass 1 planning, not an executable workflow.** Each gate requires its own authorisation sequence.
2. **Pass 1 reconciliation is not Pass 2 mapping.** The 85 NAV rows are a sample; the ledger and blueprint describe 23 features; many connections between the two remain to be drawn.
3. **Simulated navigation scores are not human user research.** Any score in §3 is agent-generated; Option X is a proposal, not a seal.
4. **Competitor research cited elsewhere (2026-11-23 memory, 11 competitors) has not yet produced a prescriptive NEX IA recommendation.** Gate 1 step 3 closes that gap.
5. **No agent has been spawned in writing this plan.** The plan does not commit Claude to any specific agent architecture; it describes roles.
6. **Owner has not approved §2 / §3 / §11 yet.** The classification and navigation above are Claude's **recommendation**, to be approved, revised or rejected.
7. **Production remains sealed.** No step here changes that. Production deploy requires its own separate word-trigger per CLAUDE.md §5.

---

## 14 · Audit integrity statements

- No `src/` files were edited during Pass 1 or Pass 2.
- No migrations were applied.
- No DB writes occurred.
- No feature ledger or blueprint edits were made.
- No commits or pushes were made.
- No HQ viewer code was changed.
- No agents were spawned in Pass 2 (Pass 1 used file-reading agents only).
- No tools were installed.
- Pass 2 verification is static-evidence only: read code files line-by-line, read migrations line-by-line, read bucket-config.ts; no runtime probe, no Storage API call, no sandbox DB query, no production data access.
- Every status in §1 is derived from the two companion audits + blueprint + feature-ledger.
- Every recommendation in §3, §6, §9 is explicitly marked proposal-not-seal.
- The 14-row near-live bar in §7 has 0 rows passing today.
- D5a remains paused. Production Supabase remains sealed. Migrations 341/343 remain unapplied. No code change authorised.
- Pass 2 reclassifications (Vault OPTIONAL · Emergency Help DEFERRED-SANDBOX · Chat Themes LAUNCH-CRITICAL pillar) are documented here but DO NOT propagate automatically — Founder must still sign F-1 before the engineering team acts on them.

---

## 15 · Pass 2 reconciliation report (archived · superseded by §16)

As required by the owner challenge 2026-11-24. Format: BUILT · RECONCILED · VERIFIED · REMAINING · BLOCKED · FOUNDER DECISIONS REQUIRED.

### BUILT (in this pass · documents only — no code / DB / commits)

- Pass 2 reconciliation header + doctrine seal (top of document).
- Rewritten §2 classification — Vault reclassified OPTIONAL, Emergency Help reclassified DEFERRED-SANDBOX, Chat Themes added as explicit LAUNCH-CRITICAL pillar.
- Fully-populated journey cards for the three launch pillars at owner-required axis depth: §4.1 NEX Chat · §4.2 NEX Shop · §4.3 Chat Themes.
- New §4A — reconciled chat-privacy bucket-evidence verdict grounded in exact files + lines.
- Rewritten §11 split into §11.A genuine Founder decisions (17 items, each with "why engineering cannot resolve") and §11.B engineering decisions the autonomous team resolves (14 items).
- §10 checklist update (Vault row retired; Chat Themes Phase B row added).
- Audit integrity statements updated to reflect Pass 2.

### RECONCILED (challenges 1..5 from owner message · in place)

| Owner challenge | Resolution |
|---|---|
| **1 · Vault misclassified** | Moved NEX-013 LAUNCH-CRITICAL → **OPTIONAL — NEX Store add-on**. Moved GAP-NAV-002 LAUNCH-CRITICAL → **OPTIONAL**. Launch pillars corrected to NEX Chat · NEX Shop · Chat Themes. Journey card for Vault retained (§4.5) as OPTIONAL. |
| **2 · Emergency Help should not auto-block launch** | Moved NEX-020 LAUNCH-CRITICAL → **DEFERRED — SANDBOX-ONLY · intentional**. Splash SOS decision screen kept gated to users already configured. Owner-closed live-mode gates recognised, not re-opened. |
| **3 · Chat-privacy bucket evidence** | §4A built. Exact evidence: bucket `nex-peer-chat-attachments` is public:true (mig 055 + 144); PRIVATE bucket `nex-peer-chat-ciphertext` has RLS policies in mig 295; both upload routes are PRIVATE-BUCKET-ONLY with fail-safe 503 (no public fallback); standard-send route is default 410 Gone under plaintext-freeze. **Previous framing "privacy claim is false" revised to P0-GATE on legacy rows + sandbox mig 295 apply state + prod bucket provisioning.** |
| **4 · 16 Founder decisions too many** | Split into §11.A 17 genuine Founder decisions (with "why engineering cannot resolve" column) and §11.B 14 engineering decisions the autonomous team resolves. |
| **5 · 0/10 journey cards populated** | Three fully populated at launch-pillar depth (Chat · Shop · Chat Themes). 10 more LAUNCH-CRITICAL journey cards remain — tracked in REMAINING below. |

### VERIFIED (independent evidence present)

- Attachment upload routes read line-by-line: `src/app/api/nex-native/attachment/encrypted/route.ts` and `src/app/api/nex-native/attachment/standard/route.ts`. Both verified PRIVATE-BUCKET-ONLY with fail-safe 503.
- Bucket-config design read: `src/lib/nex-native/attachment/bucket-config.ts`.
- Migration headers for 055, 144, 295 read.
- 16 files in `src/lib/nex-native/` confirmed referencing `nex-peer-chat-attachments` (grep); 10 under `src/lib/nex-native/` specifically.
- Peer-message service `nex-peer-chat-attachments` references at service.ts:60, :1650, :1695 confirm bucket name match.
- Session handoff and blueprint re-read partials.

### REMAINING (not done in this pass · tracked for next pass / gates)

1. 10 LAUNCH-CRITICAL journey cards still to populate at §4.1-level depth: Chat-side onboarding; buyer-side first-time journey; returning signed-out D→sign-in-return; NEX-004 outbox under forced-offline; perf-regression journey; full-viewport journey; PWA install cadence journey; location permission explanation card journey; GAP-NAV-001 drawer-row conditional journey; dead-link crawl.
2. Sandbox verification of mig 295 application (private bucket RLS).
3. Sandbox verification of bucket `nex-peer-chat-ciphertext` existence (not creatable by migration; requires Supabase Storage API call).
4. Signed-URL mint endpoint `/api/nex-native/attachment/encrypted/signed` audit — not read in this pass.
5. Legacy historical `nex_peer_message.attachment_url` row count against public bucket (§4A.3 ; owner-decision gated).
6. Pass 2 NAV upgrade DISCOVERED → MAPPED for the 85 existing NAV rows + add new NAV rows for launch-pillar journeys.
7. Tree-testing plan draft (§8.3) — awaits F-12 authorisation.
8. Full route denominator via `next build` + manifest parse — awaits Gate 2.
9. §7 14-row near-live checklist: 0/14 passing.

### BLOCKED (external authorisation / verification gates — owner-sealed closed)

- Stripe writer + webhook (NEX Shop P1-3/4) — BLOCKED on F-5.
- Themes+ Phase B writer (Chat Themes P1-5) — BLOCKED on F-6.
- Mig 224/225 apply (Emergency Help) — BLOCKED on F-7 (intentional).
- Mig 341/343 apply (themes / bubble silent-save fix) — BLOCKED on F-8.
- Mig 300 prod apply (HQ alerts) — BLOCKED on F-10.
- Support ticket prod apply — BLOCKED on F-11 (intentional).
- Production deploy — BLOCKED on F-13 (CLAUDE.md §5 word-trigger).
- Legacy chat-attachment row policy (§4A.3 / F-16) — BLOCKED on owner.
- Public-bucket retirement (§4A.3 / F-17) — BLOCKED on owner.

### FOUNDER DECISIONS REQUIRED (concise checklist per §11.A)

- [ ] F-1  Confirm NEX Chat · NEX Shop · Chat Themes as launch pillars (or revise).
- [ ] F-2  Orphan zones NEX LIVE / Music / Group Calls / Family Safety / Notifications — keep · defer · delete per zone.
- [ ] F-3  NEX-001 merchant data export B1–B5.
- [ ] F-4  NEX-011 flippable chat cards scope.
- [ ] F-5  Stripe sandbox exercise authorisation (NEX Shop).
- [ ] F-6  Themes+ Phase B authorisation.
- [ ] F-7  Mig 224/225 sandbox apply authorisation (Emergency Help — currently owner-closed intentionally; this is here only if owner wants to reopen).
- [ ] F-8  Mig 341/343 sandbox apply authorisation.
- [ ] F-9  G-1 `onboarding_complete` column approval.
- [ ] F-10 Mig 300 prod apply (HQ alerts).
- [ ] F-11 Support tickets status.
- [ ] F-12 Tree-testing budget.
- [ ] F-13 Production deploy word-trigger.
- [ ] F-14 Legal review of Privacy Policy §19.
- [ ] F-15 Launch-brand scope.
- [ ] F-16 Chat-privacy legacy-row policy.
- [ ] F-17 Public-bucket retirement path.

Every item above includes "why engineering cannot resolve" in §11.A. If an item in this list is one the owner wants engineering to propose first, say so and engineering will produce a proposal for approval.

---

**End of Foundation-to-Near-Live Master Plan · Pass 2 archived section.**

---

## 16 · Pass 3 execution-readiness report (owner-requested format)

Format strictly per 2026-11-24 Founder Instruction. No code changes · no DB writes · no bucket changes · no prod access · no commits · no push · no deploy in this pass.

### BUILT (Pass 3 · docs only)

- **§4A rewritten** as a full end-to-end attachment-architecture trace with file:line evidence for upload paths (U-1..U-5), retrieval paths (R-1..R-5), legacy references (five classes), signed-URL mint audit (participant-check + TTL + non-leak 404 confirmed), end-to-end encrypted flow (eight numbered steps · no gaps), sandbox verification checklist (V-1..V-7), legacy-retirement strategies A/B/C with engineering recommendation C.
- **Four new fully-populated launch-pillar journey cards** at owner-required axis depth: §4.4 Account creation + first-time entry · §4.5 Chat attachment send/receive · §4.6 Buyer shop discovery · §4.7 Returning-user + interrupted recovery.
- Existing cards **renumbered** (Emergency Help → §4.8 · Vault → §4.9 · Other launch-touching → §4.10).
- **§12A real execution backlog** — 7 sub-sections, every task carries: Priority · Feature/NAV · Journey · Dependencies · Implementation area · Acceptance · Required tests · Security + data · Sandbox-completable · Founder approval required. Independent tasks explicitly listed in §12A.7.
- Pass 2 §15 marked archived; this §16 is the current reconciliation surface.

### VERIFIED

**File-grounded evidence (new in Pass 3, from the Explore-agent trace):**

- Encrypted upload route: PRIVATE-ONLY, fail-safe 503 · `src/app/api/nex-native/attachment/encrypted/route.ts:37-117`
- Standard-send upload route: PRIVATE-ONLY, fail-safe 503, default 410 Gone plaintext-freeze, rate-limit 60/hr · `src/app/api/nex-native/attachment/standard/route.ts:112-264`
- Signed-URL mint: participant-gated, 900 s TTL, non-leak 404 · `src/app/api/nex-native/attachment/encrypted/signed/route.ts:51-119`
- Participant check implementation: three-part lookup incl. legacy overlay · `src/lib/nex-native/attachment/attachment-participant.ts:61-126`
- URL resolver: never silently falls back to plaintext · `src/lib/nex-native/crypto/attachment-url-resolver.ts:59-97`
- Encrypted flow: eight-step chain verified end-to-end with no missing functions · encrypt → wrap → upload → envelope → store → mint → fetch → decrypt
- Legacy public-bucket reference audit: 0 new-write callers · 0 new-read callers · 3 legacy readers · 4 migration/config files · 6 test/fixture/comment references
- Business assets relocated to `nex-business-assets` 2026-11-13 · `src/lib/nex-native/business-service.ts:1393-1495`
- Vault copies to `nex-vault-files` · `src/lib/nex-native/vault-persistence-service.ts:103-150`
- Mig 295 content verified: creates RLS policies only, does NOT create bucket (buckets must be provisioned via Storage API)

**Doctrine coherence:**
- Six user states A–F · 11 sealed decisions · 23 NEX-* features · 85 NAV transitions · four launch gates · eight agent roles · eight-step autonomous cycle — all preserved, nothing silently changed.

### REMAINING

**Documentation (acceptable debt — do NOT keep working on docs indefinitely):**
1. Pass 3 NAV upgrade DISCOVERED → MAPPED for the 85 existing NAV rows (branches + reverse-direction cards).
2. Route denominator via `next build` + manifest parse.
3. Journey cards at §4.1-depth for the remaining five launch-quality / infra journeys: NEX-021 full-viewport · NEX-022 PWA install cadence · NEX-023 location explanation card · GAP-NAV-001 drawer-row conditional · dead-link crawl.

**Sandbox verification (bounded, requires Founder trigger per §12A):**
4. §12A.1 — mig 295 + private bucket provisioning verification (tasks 0.1–0.2).
5. §12A.2 — mig 097 purge job + mig 279 chat-edit sandbox verification.
6. §12A.3 — mig 311 sandbox apply state verification.

**Execution (bounded sandbox build work · requires Founder "proceed inside §11.B scope" word):**
7. §12A.7 — 17 independent tasks ready to run: Playwright journey tests across the three pillars plus the GAP-NAV-001 drawer-row implementation with regression test update in same PR.

### BLOCKED

Each blocker points to the specific Founder decision that releases it:

| Blocker | Unlocks | Founder decision |
|---|---|---|
| Stripe sandbox exercise not authorised | §12A.3 rows 2.3 · 2.4 (NEX-015 + NEX-016 Playwrights) | **F-5** |
| Themes+ Phase B not authorised | §12A.4 rows 3.2 · 3.4 (subscription + cancel-retains-first-free) | **F-6** |
| Mig 341/343 apply not authorised | §12A.4 row 3.5 (silent-save NAV-0019/0021 fix) | **F-8** |
| G-1 `onboarding_complete` schema not approved | §12A.5 row 4.2 (mid-register interrupt resume) | **F-9** |
| Mig 295 apply not authorised | §12A.1 row 0.4 (private bucket live-wired) | **new Founder decision — F-18** |
| Mig 279 chat-edit apply not authorised | §12A.2 row 1.5 | **new Founder decision — F-19** |
| Legacy chat-attachment policy not sealed | §12A.1 row 0.3 + any backfill task | **F-16** |
| Public-bucket retirement path not decided | §4A.7 Strategy acceptance | **F-17** |
| Repo-admin ruleset not activated | §12A.6 row 5.4 (perf-regression enforced) | **Repo-admin trigger** |
| Prod remains sealed | all prod moves | **F-13** |
| Owner-closed Emergency Help live-mode | NEX-020 live activation (intentional) | **F-7 — NOT reopened** |

### FOUNDER DECISIONS REQUIRED

Pass 3 updates the Pass 2 list — two new items added (F-18 · F-19) that were implicit in Pass 2.

| # | Decision | Why engineering cannot resolve | Blocks tasks |
|---|---|---|---|
| F-1 | Confirm NEX Chat · NEX Shop · Chat Themes as the launch pillars | Product direction | §2.1 classification seal |
| F-2 | Orphan zones NEX LIVE / Music / Group Calls / Family Safety / Notifications — keep · defer · delete | Product scope | Nav Pass 2 clarity |
| F-3 | NEX-001 merchant data export B1–B5 | Legal (B5) · commercial (B1–B4) | — |
| F-4 | NEX-011 flippable chat cards scope | Product scope | — |
| F-5 | Stripe sandbox exercise authorisation | Money + irreversible external account link | 2.3 · 2.4 |
| F-6 | Themes+ Phase B authorisation | Money path · Phase A held Phase B deliberately | 3.2 · 3.4 |
| F-7 | Mig 224/225 apply authorisation (currently sealed closed · Pass 2 intentional) | Owner-closed per 2026-11-09 doctrine | — (no tasks blocked; intentional) |
| F-8 | Mig 341/343 apply authorisation | Named-migration authorisation per CLAUDE.md §4/§5 | 3.5 |
| F-9 | G-1 `onboarding_complete` column approval | Irreversible schema change | 4.2 |
| F-10 | Mig 300 prod apply (HQ alerts) | Prod seal · prod migration requires name | — |
| F-11 | Support tickets status (sandbox/defer/prod) | Owner-sealed sandbox-only 2026-11-10 | — |
| F-12 | Tree-testing budget | Research spend | §8.3 execution |
| F-13 | Production deploy word-trigger | Prod gate per CLAUDE.md §5 | all prod |
| F-14 | Legal review of Privacy Policy §19 | Requires counsel | F-3 B5 |
| F-15 | Launch-brand scope (nexcorner.com vs other) | Commercial/brand | — |
| F-16 | Chat-privacy legacy-row policy (Strategy A/B/C per §4A.7) | Privacy-posture commitment | 0.3 + backfill |
| F-17 | Public-bucket retirement path for `nex-peer-chat-attachments` | Commercial/architectural tradeoff | — |
| **F-18** | **Mig 295 apply authorisation (private ciphertext bucket RLS, sandbox then prod)** | Named-migration authorisation · prerequisite before any public privacy claim | **0.4** · P0 for launch privacy claim |
| **F-19** | **Mig 279 apply authorisation (chat-edit history, sandbox then prod)** | Named-migration authorisation | **1.5** |

If owner wants engineering to produce the proposal first for any of F-5 / F-6 / F-8 / F-9 / F-16 / F-17 / F-18 / F-19 before deciding, say which — the proposal format is the mini doctrine packages already demonstrated for other migrations.

### PROPOSED EXECUTION ORDER

The owner's critical note — "don't let the team spend weeks completing documentation before building anything" — is accepted as a hard constraint. The order below interleaves documentation reduction with bounded sandbox implementation, with the Founder's approval gate explicitly on the pillar-blocking money paths.

**Stage A · "Unblocked sandbox groundwork" (first execution package — no new Founder approval needed beyond §11.B operating-model authorisation).**

1. **Priority 0.1** Verify mig 295 + bucket provisioning in sandbox (Storage-API call sealed — needs **F-18-adjacent trigger**). *If F-18 not yet sealed, skip to A2.*
2. **§12A.5 4.1 + 4.3 + 4.6** Author Playwright tests for first-time entry (G-4/G-6 Owner Proof #1/#4), returning-user G-2 close (Owner Proof #2), directory browse + signed-out auth-gate. Three tests. Zero commercial exposure.
3. **§12A.3 2.1 + 2.2** Implement GAP-NAV-001 `Create Shop` drawer row **inside sealed drawer contract** + regression-test update in same PR + `journey-create-shop.spec.ts`. One UI change + two tests. **Highest-leverage owner-flagged gap.**
4. **§12A.2 1.1 + 1.2** Author chat journey tests: core send E2E + five attachment subtests (encrypted-image · encrypted-document · fail-safe-503 · non-participant-404 · legacy-public-envelope-resolve). Seven tests.
5. **§12A.4 3.1 + 3.3** Author Themes+ Phase A journey tests: free-theme apply + first-free apply + waitlist-for-unsupported-region. Three tests.

**Checkpoint A exit:** 15 tests landing in `tests/e2e/` + one drawer row with regression test. Zero Founder money/privacy commitments spent. Independent QA agent runs them against sandbox; rejections loop back.

**Stage B · "Pillar money paths" — gated.**

6. **F-5 authorisation** → §12A.3 rows 2.3 (trial day-5/day-8), 2.4 (merchant-direct Stripe connect), 2.5 (buyer checkout + price-validation close).
7. **F-6 authorisation** → §12A.4 rows 3.2 (Themes+ subscribe), 3.4 (cancel retains first-free).
8. **F-8 + F-18 authorisation** → §12A.4 row 3.5 (mig 341/343 apply closes NAV-0019/0021 silent-save) · §12A.1 row 0.4 (mig 295 apply closes private-chat claim gate).
9. **F-16 decision** → §12A.1 row 0.3 Strategy pick + backfill package drafted.
10. **F-9 authorisation** → §12A.5 row 4.2 (G-1 column apply + mid-register resume Playwright).

**Checkpoint B exit:** NEX Shop Playwrights green in sandbox · Chat Themes Phase B green in sandbox · chat-privacy claim at near-live readiness · first-time journey complete.

**Stage C · "Launch quality + independent QA".**

11. **§12A.6** rows 5.1–5.5 (full-viewport · PWA install cadence · location explanation card · perf-regression ruleset · dead-link crawl).
12. **§8.3 tree-testing** — after **F-12** authorisation, 10–15 humans per role × 8 tasks. If any LAUNCH-CRITICAL task < 80% first-click, revise placement.
13. **§8.1 independent QA contract** — Independent Release Auditor runs §7 14-row checklist against sandbox. Rejects fake-done. Reports evidence pack to Founder.

**Stage D · "Near-live gate".**

14. **F-13 production deploy word-trigger** (CLAUDE.md §5). Prod migrations in named order per F-10 + F-11 + F-18 + F-19.
15. Post-launch: §7 row 12 monitoring.

**Order principle:** nothing in Stage B/C/D starts until Stage A exits with QA-verified sandbox evidence. "Written is not done." The owner-stated constraint is honoured — once Stage A tests + the drawer row land, the loop is executed, not documented further.

---

**End of Foundation-to-Near-Live Master Plan · Pass 3.**
