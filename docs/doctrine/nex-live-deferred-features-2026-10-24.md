# NEX Live · Deferred Product Features · 2026-10-24 (extended 2026-10-25)

**Status: RECORDED FOR NEXT IMPLEMENTATION SCOPE · NOT COMPLETE.**

These six features were discussed during the NEX Live & Commerce
build but are **not shipped**, not in the completion evidence, and
must not be marked complete. They are tracked here so the next
authorised scope can pick them up intact.

---

## F1 · Live comments overlay

A low-latency chat overlay rendered on the viewer surface, letting
viewers post short messages that broadcasters + other viewers see in
real time during an open live session.

- Transport: candidate design is a Supabase Realtime broadcast
  channel per session (reuses the `openFeaturedProductChannel`
  pattern · comments are additive on a sibling channel).
- Persistence: open question. Three plausible postures:
  (a) ephemeral — no DB row, comment lives for the duration of the
      broadcast only;
  (b) short-retention — table with 24h TTL, same posture as Status;
  (c) full retention — join `nex_live_session` as the parent row.
- Moderation: owner can delete / mute per message. Non-owner viewers
  can report a message (reuses the Flag + 1h-explain pattern from the
  Community Notice doctrine).
- Identity: the broadcaster sees NEX-IDs (opaque handle) by default ·
  F2 below extends this with a tap-to-see-card affordance.
- Explicit non-claims (what deferred means):
  - No DB table drafted.
  - No RLS policy drafted.
  - No UI mounted.
  - No tests. No actions. No service module.
- Owner-stated constraint (from earlier conversation): copy MUST
  honour the sealed security-copy prohibition — never surface
  "radius" / "2km" / "near you" / "auto-assigned" to end users.

---

## F2 · Participant contact cards (NEX-ID-anchored)

A side-sheet or hover affordance on the broadcaster's viewer-list
that opens a minimal contact card for a specific NEX account. Card
shows:
- Display name (post-reveal flip, honours the pending-invite
  identity privacy rule).
- NEX-ID (opaque — the only durable identifier shared on this
  surface).
- General area (city only · never coordinates · never radius · never
  neighbourhood — per the sealed security-copy rule).
- Shop / profession slot (if the account owns a NEX business).
- Verified badge **deferred** — the package-contract draft explicitly
  flagged verified as unimplemented (see
  `nex-package-contract-draft-2026-10-20.md § P1`).

Separate from F3 — the contact card does NOT contain a "Message"
button on its own. F3 is a different, deliberate action.

Explicit non-claims:
- No API surface drafted.
- No pre-flight identity-domain mapping worked out (nex_account.id
  vs auth.uid()).
- No tests.

---

## F3 · Deliberate private Message action

A dedicated "Send a private message" action that opens the existing
peer chat between the current viewer and the broadcaster (or vice
versa), **separately** from the "Order Now" product-chat flow that
Phase 2 already ships.

Key properties:
- Must NOT reuse the product-attachment path (`pending_product`) —
  this is private chat, not a product enquiry.
- Honours the sealed Socials invitation doctrine when the two
  accounts are not already connected (invite → accept → chat opens,
  mutual acceptance required, "Pass" language, 24h expiry).
- When accounts ARE already connected (prior accepted invite), the
  action deep-links straight into their existing peer conversation
  thread.

Explicit non-claims:
- No action drafted.
- No UI mounted.
- Interaction with the sealed invite architecture
  (`project_nex_socials_interaction_spec_2026-10-07.md`) not
  worked out in detail.

---

## Why these are deferred rather than cut

Each of these three features was discussed during the Live & Commerce
build but authorised scope stopped at: session persistence, featured
product, viewer transport, central feed, directory indicator, chat
handoff, security remediation design + migrations 216–219. Comments,
viewer contact cards, and a deliberate private-message action are
all **net-new UI + new DB rows + new service modules** that would
widen the Phase 2 Slice 1 scope beyond what the owner authorised.
They are strong candidates for the next scope cycle after Phase 2
Slice 1 has landed in production.

---

## Status fingerprint (what IS complete)

- Live session persistence via Migration 219 (unapplied) + the
  live-session-service.
- Broadcaster lifecycle (start / end / heartbeat / feature / clear).
- Viewer surface with product overlay + Order-Now routing into
  existing peer-chat.
- Central Live feed stub at `/nex-native/live-commerce/feed`.
- Directory card + product card + shop strip live indicators.
- Stale-session recovery policy (filter-only, no auto-end worker).
- Server-side directory batch resolver + N≤4 round-trip budget.
- Journey trace from broadcaster start → viewer → product → chat
  → enquiry/cart with ownership + idempotency checks verified.

F1 / F2 / F3 / F4 / F5 / F6 are **separate** from this scope and
must be requested as their own authorised build.

---

## F5 · Power Tokens (wallet-based virtual currency) · recorded 2026-10-25

**Status: FUTURE PRODUCT CONCEPT · NOT AUTHORISED FOR IMPLEMENTATION.**
Evolving concept, not a locked decision. Do not change code, wallet
balances, token pricing, membership entitlements, database schemas,
public pages, or production systems. After the currently-authorised
NEX Live work (Plan v4 S8 release decision, Jail doctrine resolution)
is complete, present a proposal and wait for explicit owner approval.

### Concept

A wallet-based virtual currency called **Power Tokens**, usable for
shop-support gifts during NEX Live and potentially other
owner-approved Live features. Users top up the wallet with real
money; tokens are then spent on in-stream gifts or future gift-like
primitives.

### Illustrative modelling example (not an approved rate)

- A user pays **Rp 100,000**.
- The user receives **79 Power Tokens**.

The gap between the paid amount and the token value MUST be
justified by actual payment-processing costs, transfer fees,
platform economics, and the intended per-token purchasing power.
**This is a modelling example only** · not an approved exchange
rate, not a public price, not a committed value.

### Research + modelling required BEFORE any build

1. Payment-method and processor fees per supported method (card,
   e-wallet, bank transfer, local rails in Indonesia launch
   geography).
2. Fees for depositing money into NEX (ingress cost per method).
3. Fees for transferring or withdrawing eligible seller earnings
   OUT of NEX (egress cost per method + per geography).
4. Per-token purchasing power + its stability across price-level
   changes.
5. Refund, reversal, chargeback, fraud, and accounting
   requirements · including the lifecycle of a token that was paid
   for but not yet spent when a refund is requested.
6. **Token redemption model** · pick ONE for v1 and research the
   legal + operational consequences of each:
   - Spend-only (closed-loop; cannot be transferred or cashed out)
   - Transferable between users
   - Redeemable back to real money
7. KYC / AML implications for each model (especially (b) and (c)).
8. Treatment under Indonesian financial regulations (eOTC, OJK,
   BSP, Bank Indonesia · may require licensed partner).

### Hard honest-copy rule

**Do NOT assume the full Rp 100,000 is NEX revenue, and do NOT
assume all token value is available to pay sellers.** The split
between payment-rail cost, platform margin, and seller-eligible
earnings MUST be explicit before any public marketing copy.

### Non-claims (what deferred means today)

- No schema. No wallet service. No ledger primitives.
- No pricing authorised.
- No redemption model selected.
- No partner integration investigated.
- No UX / UI mounted.
- No tests. No actions. No migrations.

### Doctrine interaction

- MUST honour the sealed **service principle** (never promise a
  feature is live until delivery is verified).
- MUST honour the **Vault Entitlements LOCKED policy** (Memory
  2026-10-20) · tokens are not Vault assets.
- MUST honour the **Pricing baseline + entitlement-contract-first
  discipline** (Memory 2026-10-20) · "complete enforceable pricing
  system" required BEFORE public price.
- MUST honour the sealed **owner-authored package contract DRAFT**
  (Memory 2026-10-20) · membership credits are a separate
  decision from token economics.
- MUST honour the **guardian-managed child-profile model** ·
  minors must not be able to top up or spend tokens without
  guardian authorisation; separate child-safety review required.

---

## F6 · Monthly Shop Sponsorship · recorded 2026-10-25

**Status: FUTURE PRODUCT CONCEPT · NOT AUTHORISED FOR
IMPLEMENTATION.** Same hard-rules preamble as F5. Related to F5
only in that both are commerce-adjacent to NEX Live; the two
features MUST stay separate products with separate contracts and
separate accounting rails.

### Concept

A user or business pays NEX to sponsor another seller's shop for
one month. In return, the sponsor receives a **small, tasteful,
time-limited branding placement** on the sponsored seller's shop
page. Clicking the placement routes the visitor to the sponsor's
own NEX shop.

### Placement MUST

- Clearly identify the **sponsor** (name + tasteful logo).
- Carry an **explicit start date + end date**.
- **Auto-expire** at the end of the paid period · no manual cleanup.
- Be **visually secondary** to the seller's own identity, products,
  and shopping experience · never dominant chrome, never a hero
  slot, never on the first fold of the primary product strip.
- **Never** be presented as an endorsement by the sponsored seller
  unless the seller has explicitly agreed to endorsement wording.
- Respect the seller's **consent** and placement rules (seller
  retains an opt-out at any time).

### Product-exclusivity protection (proposed rule)

**The sponsor MUST NOT sell the exact same product** as the shop
they are sponsoring. The intention is to let a sponsor gain
visibility without turning the placement into a free poaching
channel.

### Pre-build problem to solve

"The exact same product" must be defined operationally BEFORE the
rule can ship. Investigate:

1. Product-identifier strategies (SKU match · title+brand match ·
   image similarity · owner-declared product-code match).
2. Variant handling (colour / size / bundle vs base product).
3. The matching difficulty across sellers who list the same
   underlying item with different photos, titles, descriptions.
4. False-positive risk (a legitimate complementary business
   mis-flagged as a duplicate).
5. False-negative risk (a near-identical competitor slips through).
6. **Do NOT promise perfect enforcement unless the system can
   actually provide it.** If the implementation can only do
   best-effort, the public rule must say "may" / "where NEX
   detects duplicates" rather than "will" / "always".

### Separation from F5 Power Tokens (sealed)

- Shop-support gifts (F5) · viewers purchase themed gifts during
  Live. Potentially generates eligible seller earnings.
- Monthly sponsorship (F6) · sponsor pays for time-limited
  branding + link.
- **Membership rewards** (separate) · eligible NET earnings from
  gifts MAY eventually count towards the seller's monthly NEX
  Shop membership, subject to a separately-approved entitlement +
  financial contract (see the owner-authored Package Contract
  DRAFT · 2026-10-20).
- **Do NOT assume** sponsorship revenue qualifies towards
  membership credits · define the accounting rules separately.

### NEX trust + economics

The placement MUST NOT turn a seller's shop into uncontrolled
advertising space or unexpectedly divert their customers. Research:

1. How to make sponsorship useful to both parties (relevant
   complementary categories, seller consent, transparent sponsor
   labels, strict placement-size limits).
2. Whether the monthly sponsor payment covers payment + wallet +
   operations costs while leaving NEX an acceptable margin.
3. Dispute workflow if a sponsor misrepresents itself or if a
   seller feels the placement conflicts with their brand.
4. The exit mechanism · the seller MUST be able to end a
   sponsorship early (with pro-rata refund rules TBD).

### Non-claims (what deferred means today)

- No sponsorship contract drafted.
- No pricing authorised.
- No placement UI mounted.
- No duplicate-detection engine investigated beyond this brief.
- No seller-consent flow designed.
- No tests. No actions. No migrations.

### Doctrine interaction

- MUST honour the sealed **service principle** (never promise a
  feature is live until delivery is verified).
- MUST honour the sealed **Community Notice security-copy
  prohibition** (no "near you" / "radius" / proximity-reveal
  language if the placement is ever location-targeted).
- MUST honour the **Pricing baseline + entitlement-contract-first
  discipline** (define promises → source of truth → authorise
  implementation).
- MUST honour the sealed **Package Contract DRAFT** rule that
  revenue sources are accounted separately · membership credits
  from gifts (F5) and sponsorship revenue (F6) stay on different
  rails until a separately-approved contract merges them.

### Timing + authorisation

**NOT AUTHORISED.** Complete the currently-authorised NEX Live
work (Plan v4 S8 release decision + Jail doctrine resolution)
first. When those are complete, present:

1. Combined F5 + F6 proposal covering: token economics,
   sponsorship pricing, seller consent, product-exclusivity rules,
   financial flows (ingress + egress + reserves), user experience,
   and legal/regulatory posture.
2. Explicit owner approval required before ANY code, schema, UI,
   pricing claim, or migration lands.

---

## F4 · Comment-to-Stage Guest Video · recorded 2026-10-25

**Status: FUTURE FEATURE · MEMORY ONLY · NOT AUTHORISED FOR
IMPLEMENTATION.** Do not interrupt, reorder, or expand the currently
authorised NEX Live tasks (Plan v4 S8 Steps 2–7, open Jail doctrine
items) because of this idea. Bring it back for a fresh read-only
architecture audit and a proposed implementation plan once the
current work is complete; obtain explicit owner approval before any
code, test, migration, participant-limit, commit, push, or deploy
change.

### Concept

Rather than relying on a row of static circular profile avatars, a
viewer may **voluntarily** enable their camera so their actual live
video appears inside their comment bubble alongside their message.
The broadcaster can see both the comment text and the viewer's live
video, understand what they are saying, and decide whether to invite
that person onto the live stage. The video-carrying comment bubble
becomes the entry point to a live video conversation.

### Intended interaction

1. Viewers can comment normally without enabling their camera. The
   default remains a text-only bubble (no silent camera activation).
2. A viewer who chooses to participate on camera may have their live
   video rendered inside their own comment bubble, subject to final
   design + proven technical feasibility.
3. The broadcaster can select such a video comment and invite that
   viewer onto the guest stage.
4. The viewer must **explicitly accept** the invitation and grant
   the required camera + microphone permissions.
5. Once connected, the guest appears in a compact square or
   rectangular video window alongside the broadcaster's own stream.
6. The broadcaster can remove a guest at any time.
7. **Maximum three invited guests simultaneously**, in addition to
   the broadcaster.
8. Other viewers can continue commenting normally while all three
   guest slots are occupied.

### Product principles (non-negotiable even at design time)

- Camera activation is **always voluntary**. Posting a comment MUST
  never implicitly turn on a camera.
- A static profile image MUST NEVER be visually implied to be a live
  camera feed.
- The broadcaster selects whom to invite; each guest controls
  whether to accept.
- The host's broadcast, comments overlay, product-feature card, and
  Order Now control MUST remain usable while guests are on stage.
- Guest video MUST NOT overwhelm the intimate, theatrical, honest
  character of NEX Live.
- Clearly distinguish four states: (a) viewer, (b) camera-preview
  participant (self-opted in a bubble), (c) invited guest (invite
  pending), (d) successfully-connected guest.
- Honour the sealed service principle: no feature is "live" until
  complete implementation + delivery has been verified.

### Technical constraints requiring future investigation

The current NEX Live design uses a **WebRTC mesh with a 10-participant
cap** (sealed, enforced at `broadcast-engine.ts:59` as
`MAX_VIEWERS = 10`). Before any implementation is approved, a
read-only architecture audit MUST establish:

- Whether camera-preview commenters count against the 10-participant
  cap (if yes, Comment-to-Stage dramatically shrinks concurrent
  audience; if no, we need a parallel transport that doesn't publish
  into the main mesh).
- How to avoid creating a WebRTC connection per commenter — mesh
  math breaks at scale.
- Whether the current mesh can carry broadcaster + three on-stage
  guests with the intended audience experience, or whether an SFU
  (future TURN/SFU layer, deferred in the current pilot) is a
  precondition.
- Guest-invite lifecycle: invitation, acceptance, rejection, timeout,
  removal, reconnection — each with Realtime channel shape + state
  transitions.
- Mobile-performance envelope: four live tiles + audience chrome +
  product overlay on a 390×844 viewport without dropping frames.
- Privacy + consent: explicit camera + microphone permission
  prompts; honour the sealed universal-keypad rule for any text input
  surfaced in this flow; honour the sealed Community Notice
  security-copy prohibition (no "radius"/"2km"/"near you"/"auto-
  assigned" leakage).
- Interaction with existing live-shopping controls (Feature product,
  Jail/timeout, Mute, End) when guests are on stage.

**Hard preservation rule:** do not modify the current WebRTC
participant limit or mesh architecture without a separate approved
plan. Any Comment-to-Stage implementation attempt that would
silently expand MAX_VIEWERS or move to a different transport MUST
be flagged as a doctrine change, not an incremental feature.

### Originality + positioning

Treat as a **promising proposed NEX interaction**, not a proven
world-first claim. Guest video + live chat exist on other platforms
(Instagram Live, TikTok Live, Clubhouse-style stages). The proposed
NEX differentiator is the specific combination of (a) an opted-in
live-video **comment bubble** that the broadcaster can read-and-see
simultaneously, and (b) a **direct promotion** from that bubble to
a guest-stage slot — not a separate "request to join" flow.

### Explicit non-claims (what deferred means today)

- No schema drafted (no `nex_live_guest_slot` or similar table).
- No service module drafted.
- No Realtime channel shape drafted.
- No invite/accept/timeout state machine drafted.
- No UI mounted.
- No tests, no actions, no architecture audit yet.
- No MAX_VIEWERS change or SFU adoption authorised.
- No naming decision (the working name is "Comment-to-Stage Guest
  Video" and MAY change before any build).

### Doctrine interaction

- MUST honour the sealed **universal NEX keypad rule** (any text
  input in this flow routes through `NexInput` / `NexTextarea` with
  `forceKeypadActive`).
- MUST honour the sealed **Community Notice security-copy
  prohibition** (no proximity / radius / neighbourhood language).
- MUST honour the sealed **service principle** (never promise a
  feature is live until delivery is verified).
- MUST honour the sealed **guardian-managed child-profile model**
  (Decision #1 · 2026-10-25): if a camera-preview commenter is on a
  guardian-managed minor profile, additional consent + guardian-
  notification pathway is required BEFORE camera activation. This
  is a hard precondition for any audit that considers accepting
  minors on-camera (recommendation: default-deny for
  guardian-managed profiles pending a separate child-safety review).
- MUST honour the Jail/timeout flow (owner-authorised 2026-10-25):
  a jailed viewer MUST NOT be eligible for Comment-to-Stage during
  their timeout window.

### Timing + authorisation

**NOT AUTHORISED.** Complete the currently-authorised NEX Live
work (Plan v4 S8 Steps 2–7, Jail doctrine resolution) and its
reviews first. When that is complete, bring F4 back for:

1. Read-only architecture audit against the actual current
   `broadcast-engine.ts` + `viewer-client.ts` + Realtime channel
   stack.
2. Proposed implementation plan.
3. Explicit owner approval before any code change.
