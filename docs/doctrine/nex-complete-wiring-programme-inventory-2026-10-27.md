# NEX Complete Application Wiring Programme · Phase 1 Inventory

**Authority**: founder directive 2026-10-27 · "NEX Complete Application Wiring Programme · Founder Directive"
**Target repo**: `C:/Users/Victus/nexapp` · remote `Philip2024394/nexapp.git` · branch `main` · HEAD at inventory time `3ea9d8f`
**Method**: 8 parallel READ-ONLY Explore subagents · 1 per surface family + 1 for cross-cutting platform
**Non-negotiable**: do NOT change founder-created UI · preserve all layouts/visuals/doctrine · new pages built in NEX visual language and presented for founder review
**All sealed holds remain in force** · see programme memory for full list

---

## Executive summary · state of the 7 areas

| Area | Overall state | What works today | Primary blocker to full E2E |
|---|---|---|---|
| **Chat** | ★★★★★ · overwhelmingly wired | Peer E2E encrypted chat · business-customer chat · guest-first-message · WebRTC calls · status · contacts · Vault-filtered inbox | None sealed · opportunity: owner dashboard entry point for Wave 5 inbox |
| **Vault** | ★★★☆☆ · Phase A/B wired, Phase B.7+ empty | Setup · unlock · cross-device enrollment · recovery · vaulted encrypted chat (B.4) | **LOCKED 2026-10-20** · W1–W12 unscheduled · quota + retention + deletion gate + download-everything + metadata privacy all unimplemented |
| **Themes** | ★★★★☆ · wired for free + tier-gated | Chat theme persistence · cover layouts · Standard Experience 5 live-world themes · 7-day trial · tier gate | **Theme Commerce DRAFT** · purchase path blocked · "My Themes" explicitly out of scope |
| **Intro / Onboarding** | ★★★★☆ · signup end-to-end works | Welcome → account creation (tier=gratis) · WebAuthn face sign-in · slug check · business onboarding · post-signup theme apply · trial status | **Business trial not auto-firing** · pricing-config `autoFiresOnSignup=false` · 3-unlock rule from 2026-10-21 doctrine · founder pricing APPROVAL required |
| **Shop** | ★★★★☆ · overwhelmingly wired for product/menu/order | Business create · product CRUD · menu editor · venue · public shop · public product detail · chat enquiry · order state machine · returns policy · gallery · live-post management | **Accommodation blocked** (nex_accommodation_listing missing · I-X) · **Watch uploads MOCK** · migrations 227-230 LOCAL only · submit is console.log |
| **NEX Directory** | ★★★★★ · Phase A sealed and complete | Grid of cards from nex_business + canonical pools · search (Feature A) · category filter · detail page · A-strict CATEGORY_FALLBACK for ID+food · currency picker · distance filter | **Watch + Live-post tiles blocked** · migrations 229 + 233 authored but not applied · fail-open projection returns empty |
| **NEX Live** | ★★★★★ · broadcaster + viewer E2E works | Go-live · WebRTC mesh (MAX_VIEWERS=10 sealed) · featured product channel · heartbeat · session ends · engagement aggregation · video playback (S1-S5 hls.js) · live-posts | **Watch listing publish MOCK** (same blocker as Shop) · Live Eligibility R9 DRAFT works but copy not final |
| **Platform cross-cutting** | ★★★★☆ · mostly wired, pockets of mock | Settings hub · Cart + Orders (commerce-gated) · Community (sealed 2026-10-23) · Emergency Help (simulated=TRUE in prod) · Family Safety · Socials chooser · Admin tier · HQ harvest · Support · Legal | **Chat-settings/privacy/data-usage toggles cosmetic** (no backend enforcement) · Emergency alert fanout unimplemented · Socials interaction phase NOT AUTHORISED to build |

**Overall grade**: NEX is further along than it looks. The founder-created UI shell is dense and mostly real. The gaps cluster around:
1. **Watch listings** (migrations not in Supabase prod)
2. **Vault** (LOCKED 2026-10-20)
3. **Theme Commerce** (DRAFT)
4. **Business trial auto-fire** (3 simultaneous unlocks needed)
5. **Chat-settings backend enforcement** (cosmetic toggles)
6. **Emergency alert fanout** (Phase 2)
7. **Socials interaction phase** (frozen design spec, not authorised to build)
8. **Accommodation** (table missing, Phase A1 hold)

---

## Dependency map · which journeys connect

```
Signup ──► Business setup ──► Product/Menu/Watch publish ──► Directory tile ──► Detail ──► Chat ──► Order ──► Fulfilment
   │              │                      │                        │              │
   │              │                      │                        └──► Watch/Live-post E2E (BLOCKED on migrations 229+233)
   │              │                      │                                       
   │              │                      └──► Live broadcast (go-live) ──► Live session ──► Viewer ──► Featured product ──► Chat
   │              │
   │              └──► Theme + Cover ──► Public shop
   │
   ├──► Trial status ──► Welcome card copy (BLOCKED · 3-unlock pricing APPROVAL)
   │
   ├──► Settings ──► Privacy / Chat visibility (COSMETIC · needs backend enforcement)
   │
   └──► Vault (LOCKED 2026-10-20 · do not advance)
```

**Journeys that are complete end-to-end today** (no new work required beyond polish):
- Chat: peer E2E conversation · business-customer chat · guest first-message · status
- Directory: browse → search → category → detail → owner contact
- Shop: create business → add product → publish → public shop → chat enquiry → order state machine
- Themes: free theme pick → apply → persist
- Live: go-live → session → viewers join → engagement → end
- Community: notice board (sealed 2026-10-23) · lost/found · zone join
- Family Safety: child account creation · age transition · safechat · subscription
- Legal / Support: terms · privacy (template) · support branching

**Journeys that are partial / blocked**:
- Watch listing publish → directory tile → detail → buy (migrations)
- Live-post → directory tile (migrations)
- Theme purchase (Theme Commerce DRAFT)
- Business trial auto-fire + welcome card trial copy (pricing APPROVAL)
- Vault file management (LOCKED)
- Emergency alert fanout (Phase 2)
- Socials interaction (frozen design)
- Accommodation listing (table missing)
- Chat-settings backend enforcement (service boundary)

---

## Critical blockers · ranked by unlock impact

| Rank | Blocker | Unlocks | Decision owner | Decision shape |
|---|---|---|---|---|
| 1 | Apply migrations 227–230 + 229 + 233 to Supabase `ijvqdvsvwtwxzcqmoqit` | Watch listing publish · directory watch tiles · live-post directory tiles · entire watches E2E loop | Founder | Approve migration apply + storage bucket name + public/signed URL policy |
| 2 | Pricing-config APPROVED for Business tier | Welcome card trial copy · business trial auto-fire · all pricing-sealed surfaces | Founder | Price number + currency + tax treatment confirmed |
| 3 | Vault LOCKED 2026-10-20 lift | File rooms (documents/photos/videos/plans/important/archived) · quota · retention · deletion gate · download-everything | Founder | Explicit lift per Vault Entitlements Policy; preconditions sealed in `nex-vault-entitlements-policy-sheet-2026-10-20.md §G` |
| 4 | Theme Commerce DRAFT → DECIDED | Theme purchase · ownership persistence · receipt | Founder | 5 open directions in DRAFT; migrations 191–196 authored but not applied |
| 5 | Accommodation `nex_accommodation_listing` table + Phase A1 lift | `/manage/accommodation` becomes real · Stay category grid pulls real data | Founder | Approve migration 213 apply + Phase A1 lift |
| 6 | Chat-settings backend enforcement | privacy_level + read_receipts actually gate behavior | Founder | Approve service-boundary enforcement (likely low-risk) |
| 7 | NEX_EMERGENCY_LIVE_MODE flip + Phase 2 fanout design | Real emergency dispatch (today simulated) | Founder | Separate programme |
| 8 | Socials interaction phase authorisation | Pass/invite flows beyond chooser (frozen design spec) | Founder | One atomic authorisation per architecture piece |

---

## Convergence · what the 8 agents independently point to

**Three agents converge on WATCH LISTINGS**:
- Shop agent E: "Watch shop uploads (migrations 227–230 backend + /manage/watches/new UI)"
- Directory agent F: "Apply migrations 229+233 to unblock watch + live-post tiles"
- Live agent G: "Watch listing → publish with real DB writes → appears in /watches directory → buyer upsell"

This is the strongest cross-area journey candidate but is **blocker-#1 bound** (needs founder migration approval).

**One agent points at WAVE 5 OWNER INBOX** (Chat agent A):
- "Business-to-customer real-time message list + unread badge for business owner dashboard"
- Zero migrations, zero new schema, pure code wiring on top of Wave 5 (which already works)
- Smallest blast radius

**One agent points at BUSINESS TRIAL AUTO-FIRE** (Intro agent D):
- Pricing-config needs flipping to APPROVED (founder sign-off)
- startBusinessTrial exists but not called in createNexAccountAction
- 3 unlocks must land together per sealed 2026-10-21 doctrine

**One agent points at CHAT-SETTINGS ENFORCEMENT** (Platform agent H):
- Toggles exist as cosmetic UI; service-boundary enforcement missing
- ~40 lines in peer-message-service + ~10 lines tests

---

## First-journey candidates · ranked for Phase 3

### Candidate A · Watch Listing production E2E (BLOCKED pending authorisation)
- **Value**: ★★★★★ · unblocks 3 of 7 areas · completes the Buyer-sees-watch-tile → clicks → sees detail → initiates buy flow
- **Cross-area impact**: Shop + Directory + Live/Watches
- **Blast radius**: large · touches production Supabase schema
- **Readiness**: UI complete (R3g) · service layer written (P2) · migrations applied to LOCAL nex_dev · payment in dev-mock mode · ONLY blocked on founder migration + storage bucket + Stripe webhook approvals
- **Authorisation required**: YES · migrations to prod · bucket name + public/signed URL policy

### Candidate B · Business-owner Conversations inbox + unread badge (NO new approvals)
- **Value**: ★★★★☆ · ties Shop to Chat · owner finally sees customer activity signal
- **Cross-area impact**: Chat + Shop
- **Blast radius**: small · pure code, no schema, no migration
- **Readiness**: Wave 5 inbox at `/nex-native/conversations` already works · API returns unread_count per conversation · reuses existing conversation-service · no new UI pages required
- **Authorisation required**: approve the journey + the new owner-dashboard entry point UI (if new page needed)

### Candidate C · Themes Standard Experience default routing (trivial polish)
- **Value**: ★★☆☆☆ · minor
- **Cross-area impact**: Themes only
- **Blast radius**: tiny
- **Readiness**: all primitives sealed · 1 hub route addition
- **Authorisation required**: approve the small hub route

### Candidate D · Chat-settings backend enforcement (cross-cutting hygiene)
- **Value**: ★★★☆☆ · stops shipping cosmetic toggles
- **Cross-area impact**: Platform + Chat
- **Blast radius**: small · service-boundary change
- **Readiness**: toggles exist, service layer boundaries clear
- **Authorisation required**: approve privacy/visibility semantics (deserves its own doctrine note)

**Recommendation** (per Protocol §3 Compare before Selecting): **Candidate B first** · it is the only option that is both authorised-ready (needs no new founder decisions beyond "proceed") AND cross-area-connecting. Candidate A should be queued in parallel pending founder migration approval. Candidates C + D can slot in afterwards.

---

## Appendix · per-area detailed inventories

Full agent reports preserved as research artefacts; summarised here. For verbatim agent output, see the parent conversation transcript.

### Chat · Agent A summary
- All production chat routes WIRED to real backend. Peer E2E (Bridge 76), Wave 4/5 business messaging, Wave 4N guest bootstrap, R1 universal live messaging all working.
- Doctrine: Chat Master Layout Rule SEALED 2026-10-14 · Keypad universal rule SEALED 2026-10-24 · Pending-invite privacy SEALED 2026-10-23.
- Mock pockets: `/free-chat` and `/call/dial` are intentionally minimal placeholders. `/calls` group-call + call-link disabled with "coming later" honest UI.

### Vault · Agent B summary
- Phase A (A.3–A.6) and Phase B.1–B.4 largely IMPLEMENTED with real DB writes. Setup, unlock, cross-device enrollment, recovery, vaulted encrypted chat all work.
- Vault LOCKED 2026-10-20 blocks: quota enforcement, retention automation, fail-safe deletion gate, download-everything path, PIN rotation UI, metadata privacy, trial access gating. 7+ `/vault/home/*` category rooms are empty shells.
- No wire-up candidate until founder lifts LOCKED status.

### Themes · Agent C summary
- 41 catalogue themes (migration 048) + 5 code-registered live-world themes all persist via `nex_account.chat_theme`. Tier gate + 7-day trial enforced server-side.
- 10 sealed cover layouts hardcoded; `nex_business.cover_layout_id` writes work.
- Payment path does NOT exist. "NEX never handles payments" doctrine applies. Theme Commerce DRAFT 2026-10-20 blocks ownership + receipt.

### Intro · Agent D summary
- Full signup end-to-end: /welcome → /create-account → createNexAccountAction (tier=gratis) → post-signup-apply → /home. WebAuthn face sign-in optional via nex-has-face cookie.
- Business trial NOT auto-firing. `/api/trial/start` exists but pricing-config `autoFiresOnSignup=false` and welcome card falls back to "See all plans".
- 3-unlock rule from sealed 2026-10-21 doctrine blocks the trial copy ever appearing.

### Shop · Agent E summary
- Business create, product CRUD, menu, venue, orders (full state machine), returns policy, gallery, chat enquiry, cart/order attachments ALL REAL.
- Payment is "offline only" by sealed doctrine · NEX never handles funds.
- Accommodation surface exists; `nex_accommodation_listing` table missing from Supabase (I-X audit · Phase A1 hold).
- Watch upload UI complete (R3g); submit is console.log mock; migrations 227–230 LOCAL only.

### Directory · Agent F summary
- Phase A sealed 2026-10-16. 3 pools merged: nex_business (Supabase) + canonical (local nex_dev Postgres) + watch/live-post (migrations 229/233 not applied, fail-open).
- Search Feature A wired 2026-10-27. Category filter real. Detail page [id] resolves canonical UUID OR landing slug. Owner-claimed redirects to owner cover page.
- A-strict CATEGORY_FALLBACK committed today (`3ea9d8f`): ONLY canonical ID+food gets fallback; everything else is monogram.

### Live · Agent G summary
- Broadcaster + viewer E2E works. WebRTC mesh. Realtime presence + signalling + comments + engagement. R9 eligibility gate sealed. MAX_VIEWERS=10 sealed (`broadcast-engine.ts:59`).
- Watch upload MOCK: UI done, submit is console.log, migrations LOCAL only.
- `publishUploadedVideo` action exists in uploaded-video-service.ts but never called from UI.
- Dev-impersonation (nil UUID) uses REAL seeded tier for honest gate testing.

### Platform · Agent H summary
- Settings hub + 16+ subpages mostly wired; chat-settings + privacy + data-usage toggles are cosmetic.
- Cart + Orders + Liked under commerce gate (?commerce=1 bypass) all real.
- Community sealed 2026-10-23 end-to-end (notice board + lost/found + zones + safechat).
- Emergency Help wired but simulated=TRUE by default (NEX_EMERGENCY_LIVE_MODE=false).
- Family Safety fully implemented across 25+ subpages.
- Socials chooser sealed 2026-10-07; interaction phase NOT AUTHORISED to build (frozen design spec).
- Affiliate MVP sealed; commission ledger unimplemented.
- Admin tier + HQ harvest sealed with role gates.
- Legal/Support/About static and sealed.

---

## What this register does NOT do

- Does not propose new UI changes to any founder-created surface.
- Does not touch any sealed doctrine · all LOCKED/DRAFT holds remain in force.
- Does not apply any migration · documents required approvals only.
- Does not grant implementation authority · recommendations only.
- Does not substitute for founder review of newly built pages.

## Next step (Phase 2 handoff)

Founder reviews this register + the first-journey proposal (presented in the parent conversation turn) and either:
- Authorises **Candidate B** (Chat inbox + unread badge · no new approvals) → I begin implementation under Protocol §4 (build complete user journey) with Protocol §5 (preserve founder UI) + Protocol §6 (evidence reporting).
- Authorises **Candidate A** (Watch listing E2E · requires migration + bucket + webhook decisions) → I queue the migration pre-apply review + ship a research brief covering world-class watch marketplace discovery (eBay, Chrono24, WatchCharts, Hodinkee) before any code.
- Authorises both tracks in parallel (safe · Track A is blocker-bound and will pause for approvals; Track B can proceed concurrently).
- Picks a different candidate from C/D or names a journey not surfaced above.
