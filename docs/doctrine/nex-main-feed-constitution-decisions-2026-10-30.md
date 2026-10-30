# NEX Main Feed · Constitution + Decisions Log · 2026-10-30

**Status:** DRAFT · decision record only · **NO IMPLEMENTATION AUTHORISED.**

This document holds the owner-supplied Main Feed Constitution (10 rules) and the first round of product decisions (D1–D10) recorded 2026-10-30. The decisions were approved as **product rulings** that unlock design work. They do **not** authorise any code change, any migration draft, any schema change, any configuration change, or any deployment. Each build phase remains subject to a separate explicit gate.

Cross-references:
- Specification v1 and §5 Capability Matrix: delivered 2026-10-29 to 2026-10-30 in the conversation thread (Main Feed + Creator Libraries · Owner Review Required).
- Design doc for D1 public-listening: `nex-main-feed-public-music-listening-design-2026-10-30.md`.
- Design doc for the slot primitive: `nex-main-feed-slot-primitive-design-2026-10-30.md`.
- Sealed and preserved: all existing holds — Vault LOCKED (`project_nex_vault_entitlements_locked_2026_10_20`), Live R9 Eligibility Contract (`nex-live-eligibility-contract-2026-10-27.md`), Music Upload Contract DRAFT v3 (`nex-music-upload-contract-DRAFT-2026-10-29.md`), Live Uploaded Video Contract (`nex-live-uploaded-video-contract-2026-10-24.md`), Chat master layout, Design tokens, M1 queue, music-page redesign, Supabase music-bucket phase, Migration 235 (not applied), Migrations 229/233 (not applied).

---

## 1 · The Main Feed Constitution — owner-supplied 2026-10-30

Recorded verbatim as the governing policy for every subsequent Main Feed design decision.

> **Core principle: One active Main Feed entry per creator, per eligible creation card.**
>
> NEX Main Feed exists to help users discover worthwhile content, not to reward creators for flooding the feed.

1. **One active slot per creation card.** Each creator can have one current Main Feed entry for each eligible creation card or approved content category.
2. **Publishing updates the slot.** When a creator publishes a new eligible item from that card, the new item becomes its active Main Feed entry. The previous item remains in the creator's library unless explicitly removed.
3. **No feed flooding.** Repeated publishing must not create an unlimited stream of simultaneous active entries from the same creator and creation card.
4. **Quality over quantity.** NEX should encourage creators to publish content they are proud of, knowing that each creation card has a limited discovery position. Do not introduce arbitrary quality scores or AI censorship as part of this rule.
5. **Fair discovery for new users.** The shared Main Feed should expose users to a diverse range of creators and content types rather than allowing a few highly active accounts to dominate every swipe.
6. **Automatic updates.** Publishing a new eligible item should update the appropriate active slot without requiring manual intervention or administrator approval, subject to the normal publication and rights checks.
7. **Preserve creator libraries.** Replacing an active feed entry must never silently delete the previous published item or its underlying media.
8. **Keep content states distinct.** Draft, unpublished, archived, deleted, and rights-restricted items must not appear as eligible public feed entries.
9. **Protect the viewer experience.** The Main Feed must remain easy to browse, with one coordinated playback experience and no overlapping audio from previously viewed items.
10. **Measure success by value, not volume.** If NEX later introduces creator analytics, distinguish meaningful engagement from raw posting frequency. Do not make posting more often an automatic path to greater feed visibility.

> The objective is a healthy discovery ecosystem: creators have a reason to publish their best work, viewers discover different creators, and each creator's complete published collection remains available in their own library.

---

## 2 · Decision Register — D1 to D10 recorded 2026-10-30

Each entry records the owner's approved disposition, the status class (see §3 for class definitions), what it unlocks, and what remains pending.

### D1 · Public music playback

**Owner ruling:** Approve the design of a secure public-listening model, but keep implementation gated until reviewed.

- **Class:** Design authorised.
- **Unlocks:** Author the design doc for a public-listening primitive — authorisation model, signed-URL security, ownership boundaries, storage-adapter compatibility, abuse prevention, rights revocation, test strategy.
- **Still blocked:** Any code change, any migration, any storage-adapter change, any `nex_music_track.visibility` enum change. Implementation requires a separate explicit gate after the design is reviewed.
- **See:** `nex-main-feed-public-music-listening-design-2026-10-30.md`.

### D2 · Music storage · Migration 235

**Owner ruling:** Keep Migration 235 unapplied until the existing provider decision and storage phase are resolved.

- **Class:** Hold preserved.
- **Unlocks:** Nothing new. Status quo.
- **Still blocked:** Migration 235 remains **AUTHORED but NOT APPLIED** per `nex-supabase/migrations/235_nex_music_track.sql:1-6` ("DO NOT APPLY until the music contract clears Gate 3 — provider selection + migration SQL review"). The Supabase music-bucket phase hold also remains in force. No change proposed by this decision.

### D3 · Replacing an active slot via unpublish / remove

**Owner ruling:** Keep the slot empty if the creator unpublishes or removes its current item. Do not unexpectedly resurface older content.

- **Class:** Rule set.
- **Unlocks:** Lifecycle state machine for the slot primitive can be designed with a deterministic rule (empty-on-remove, no auto-promotion). The slot primitive design doc operationalises this (`nex-main-feed-slot-primitive-design-2026-10-30.md`).
- **Still blocked:** Rights-revocation outcome handled separately under D8 (also empty-on-revoke · auto-promote remains undecided).

### D4 · Official NEX content density

**Owner ruling:** Mix NEX-official content into the shared feed at a controlled, owner-approved frequency.

- **Class:** Design authorised · operational parameter pending.
- **Unlocks:** The slot-primitive design doc may describe how an NEX-official source would be interleaved (reserved cadence vs. ratio), as an abstract rule. The feed-ordering design (future scope) can take the same abstract rule as input.
- **Still pending — owner decision required before any build involving this rule:**
  - **D4a** · The actual frequency parameter. Options to consider at owner review: fixed interval (every N slides), proportional ratio (X% of slides), or window-based cap (max M official slides per Y-minute window). This document **does not choose**.
  - **D4b** · The identity primitive for "NEX-official" accounts. No `is_nex_official` column exists on `nex_account` today. There is a sealed account identity primitive used in chat (`isNexOfficialAccount(peer.id)` referenced in `project_nex1_is_founder_chat_account.md`). Whether that primitive is reused, extended, or replaced by a new column is itself an owner decision — not made here.

### D5 · Product video eligibility

**Owner ruling:** Only allow videos explicitly published and linked to an eligible product.

- **Class:** Rule set · schema mapping pending.
- **Unlocks:** The slot primitive design can define a `product` card type whose eligibility predicate is "explicitly published AND linked to an eligible product." That is captured abstractly in the slot-primitive doc.
- **Still pending — owner decision required before any build involving this rule:**
  - **D5a** · The schema mapping. Three candidate shapes exist: (i) new column on `nex_product` referencing a video asset, (ii) new column on `nex_media_video` referencing a product, (iii) explicit join table. Each has different migration implications. This document **does not choose**.
  - **D5b** · The operational definition of "eligible product." Prior sealed decisions describe product entitlements and uniqueness constraints; the exact predicate for "eligible for Main Feed" must be defined before any product-video reader exists.

### D6 · Side-drawer Live button

**Owner ruling:** It should open the shared Main Feed, not the broadcaster setup page. Preserve a separate, clearly labelled Go Live action for creators.

- **Class:** Design authorised · label + destination pending.
- **Unlocks:** The documented understanding that the drawer's primary Live entry opens discovery, not broadcaster launch. Preserves broadcaster entry under a separate labelled row.
- **Still pending — owner decision required before any build involving this rule:**
  - **D6a** · Exact label(s) for the two rows (e.g. "Live" vs "Watch Live" vs "Discover" for the viewer row; "Go Live" or "Broadcast" for the broadcaster row).
  - **D6b** · Final destination route for the viewer row. Candidates include today's `/nex-native/live-commerce/feed` (which still returns 200 and now renders live sessions + recorded videos as cards), or a new unified Main Feed route — the latter does not exist yet.
- **Current verified state (not altered by this decision):** `src/components/nex-native/live-commerce/LiveSideDrawer.tsx:275` points "Go Live" at `/nex-native/live-commerce/welcome` (broadcaster-side).

### D7 · Live broadcasts inside the Main Feed

**Owner ruling:** Use a clear Live card that opens the real-time viewer, rather than connecting every swipe to another WebRTC session.

- **Class:** Rule set.
- **Unlocks:** The feed design may treat a Live session as a static card type (type: `live`). Tap-through routes to the dedicated WebRTC viewer at `/nex-native/live-commerce/[sessionId]`. In-feed cells do **not** subscribe to WebRTC; the feed does not consume broadcaster bandwidth per swipe.
- **Compatibility with sealed doctrine:** This decision explicitly preserves `MAX_VIEWERS = 10` (sealed in `src/lib/nex-native/live-broadcast/broadcast-engine.ts:59` and across prior Live doctrine). Nothing in this ruling raises the viewer cap.

### D8 · Rights revocation

**Owner ruling:** Remove the affected item from discovery immediately; do not automatically promote another item until the rules are defined.

- **Class:** Rule set · auto-promote rules pending.
- **Unlocks:** The lifecycle state machine includes a `rights-revoke` transition whose observable outcome is identical to D3's unpublish/remove — slot cleared, left empty. The underlying library row is marked restricted (not deleted) per Rule 7.
- **Still pending — owner decision required before any build involving auto-promote:**
  - **D8a** · When (if ever) an auto-promote replacement runs after rights revocation. This document explicitly preserves "no auto-promote" as the current rule and does **not** schedule a future auto-promote policy.

### D9 · Feed freshness

**Owner ruling:** Test a rolling 72-hour discovery window as a proposal, not a permanent rule.

- **Class:** Proposal.
- **Unlocks:** When a feed-ordering reader is designed in a future phase, `72 h` is the first test value for the eligibility window. Permanent sealing requires measurement and owner review before being adopted as doctrine.
- **Still pending:** Measurement plan, success criteria, and the review event that would seal (or revise) the window.

### D10 · Private "My Content" management view

**Owner ruling:** Build a private management view only after its scope is approved.

- **Class:** Scope approval pending.
- **Unlocks:** Nothing. The design docs reference "My Content" as an owner-side-only surface but do **not** specify it.
- **Still pending:** A scope decision on routes, states managed (draft / unpublished / archived / removed), rights-revoke status visibility, and interactions with the slot primitive before any design begins.

---

## 3 · Decision status classes

Classes used in §2 and §5 so a future reviewer can tell what the owner approved vs. what is a proposal.

- **Rule set** — The owner has decided the behavioural rule. The rule is in force for any subsequent design. Does **not** itself authorise code.
- **Design authorised** — The owner has approved authoring a design document. The design may propose primitives, schemas, and lifecycles. The design does **not** itself authorise code. A separate "implement this design" gate is required.
- **Hold preserved** — No change from the previously sealed hold. Status quo is maintained.
- **Proposal** — A value or shape proposed by Claude or the owner but not yet sealed. Carries an expectation of later review before becoming doctrine.
- **Owner-proposed policy, confirmation required** — The owner has recorded a preferred policy direction (e.g., D1e immediate invalidation). The policy is NOT yet doctrine; explicit confirmation is required. No implementation of any specific mechanism is authorised by the proposal; implementation always requires a separate explicit gate.
- **Scope approval pending** — The decision is deferred. No design or build work is authorised until the owner delivers an explicit scope.

---

## 4 · Per-creator / per-card slot clarification (owner, 2026-10-30)

Recorded verbatim from the owner review (constitutional Rule 1 clarified by example):

> "When Hendra publishes a new music track, it should replace his Music card's active Main Feed entry, not his Video or Shop entry. The old track remains in his library. If he later removes the active track, I agree with leaving that slot empty rather than unexpectedly promoting an old track."

Interpretation locked in:

- Slot cardinality is per `(creator_id, card_id)`, **not** per `creator_id`.
- Known card ids today: `music`, `video`, `product`. "NEX-official" is a separate source class treated under D4, not a per-card creator slot.
- Publishing a new eligible item on card Y for creator X **replaces** the active entry for (X, Y) only. The previous entry remains in library (constitutional Rule 7).
- Removing or unpublishing the active entry for (X, Y) leaves (X, Y) empty (D3).
- Rights revocation on the active entry for (X, Y) also leaves (X, Y) empty (D8).

Any divergence from this clarification is a doctrine amendment and must be recorded explicitly.

---

## 5 · Pending clarifications — authoritative owner-review surface

This table is the single authoritative surface for every unresolved **owner decision** across all three Main Feed doctrine documents (CD, PL, SP). It was reconciled 2026-10-30 following a read-only hostile-reader review that identified gaps between CD §5 and the open-questions lists in PL §9 and SP §14.

Entries are classified as:

- **Owner decision** — must be answered by the owner before any build phase that touches the item. Cannot be silently decided by the architect.
- **Owner-proposed policy, confirmation required** — the owner has recorded a preferred policy that is captured here as a proposal pending explicit confirmation. Build is not authorised; the policy is not yet doctrine.

Engineering requirements that are the architect's responsibility to specify (not owner decisions) are listed separately in §5.1.

| ID | Pending (owner decision) | Class | Source | Required for |
|---|---|---|---|---|
| D1a | `licensed` rights sub-rule for public music — which licence terms are automatically compatible with NEX public distribution; which require secondary attestation | Owner decision | PL §4.2, §9.1 | Any public-music build involving `rights_declaration='licensed'` |
| D1b | Shop-membership gate on entering music `public` state — parallel to Live R9, or available at all tiers | Owner decision | PL §6, §9.2 | Any public-music build involving tier gating |
| D1c | View-count deduplication rule under public playback — exact window + attribution strategy consistent with Rule 10 ("value, not volume") | Owner decision | PL §5.6, §9.3 | Any public-playback view-counting |
| D1d | Separate "Publish publicly" confirmation UX distinct from "Save to library" | Owner decision | PL §9.6 | Public-music publish UX |
| D1e | Public URL invalidation policy on unpublish, delete, restrict, rights-revoke — owner **proposes immediate invalidation**; policy requires explicit confirmation; implementation of any specific mechanism is **not** authorised | Owner-proposed policy, confirmation required | PL §5.1 (revised), owner directive 2026-10-30 | Any public-music build and any takedown workflow |
| D4a | NEX-official density parameter — frequency / ratio / windowed cap | Owner decision | CD §2 D4 | Any build involving NEX-official feed entries |
| D4b | NEX-official account identity primitive — reuse `isNexOfficialAccount(peer.id)` chat primitive, extend, or add new column | Owner decision | CD §2 D4 | Any build involving NEX-official feed entries |
| D5a | Product video schema mapping — new column on `nex_product`, new column on `nex_media_video`, or explicit join table | Owner decision | CD §2 D5, SP §12.2 | Any build involving product-video feed slots |
| D5b | "Eligible product" operational predicate — exact definition | Owner decision | CD §2 D5, SP §12.3 | Any build involving product-video feed slots |
| D6a | Final drawer row label(s) — "Live" vs "Watch Live" vs "Discover"; "Go Live" vs "Broadcast" | Owner decision | CD §2 D6 | Any drawer rewiring |
| D6b | Final drawer destination route for the viewer row | Owner decision | CD §2 D6 | Any drawer rewiring |
| D8a | Auto-promote policy after rights revoke — current rule is "leave empty"; any future reversal requires explicit decision | Owner decision | CD §2 D8, SP §14 Q7 | Any extension beyond "leave empty" |
| D10 | Private "My Content" scope — routes, states managed, interactions with slot primitive | Owner decision | CD §2 D10 | Any build of the owner-side management view |
| D11 | Retention duration for historical slot rows (`demoted`, `cleared_*`) — SP proposes ≥ 365 days; owner selects the actual value | Owner decision | SP §6.3, §14 Q3 | Slot primitive build |
| D12 | Clear-on-no-active semantics — SP proposes idempotent no-op; owner confirms vs. explicit failure | Owner decision | SP §7.2, §14 Q5 | Slot primitive build |
| D13 | Internal observability metrics exposure beyond the "no feed-ranking, no visibility scores" invariant — specifically whether raw posting-volume metrics may be exposed via API, export, or any non-ops surface | Owner decision | SP §9, §14 Q4 | Observability layer |

### 5.1 · Engineering requirements (architect specifies — not owner decisions)

The following items were raised in PL and SP as unresolved but are the architect's responsibility to specify in a later design or implementation gate. They are listed here so the owner knows they exist, without creating the expectation that the owner answers them:

- Rate-limit numeric parameters for the public stream route (per-IP, per-track, per-account caps). Target the Rule 10 principle; actual numbers set by engineering (PL §5.3, §9.4).
- Minimum Postgres transaction isolation level for the slot primitive (`READ COMMITTED` sufficient; design pins the minimum in SP §7.1).
- Key-rotation operational procedure — storage, rotation trigger wiring, propagation SLA (PL §5.1, §7.3). Blocked at the "ops doctrine" level; propagation guarantees surfaced to the owner only where they bear on policy (see D1e).
- Public signing key provisioning (PL §7.3).
- Log retention + purge windows for public playback logs (PL §5.7).
- Observability event definitions and metric names (SP §9).
- Postgres partial-unique-index IMMEDIATE vs DEFERRABLE semantics (SP §7.1 revised specifies IMMEDIATE).

---

## 6 · Capability Matrix cross-reference (§5 of Specification v1)

Transcribed from the audit delivered 2026-10-29 (via general-purpose agent). Each row is evidenced in the conversation thread; this doctrine does not re-verify, only cross-references.

| Capability | State as of 2026-10-30 |
|---|---|
| Shared Main Feed route | Partial · `src/app/nex-native/live-commerce/feed/page.tsx:293-347` renders live + recorded + TBD-community sections as scrollable cards. |
| Vertical swipeable feed shell (cross-type) | Missing · each content type has its own full-bleed viewer; no cross-type mixer. |
| Live sessions in feed | Exists · `feed/page.tsx:304-306` + `listOpenSessionsPublic` + `evaluateLiveness`. |
| Recorded videos in feed | Exists · `RecordedVideosSection` at `feed/page.tsx:349-406`. |
| Music tracks in feed | Missing · no code path aggregates `nex_music_track` into feed. |
| Product videos in feed | Missing · `nex_product` referenced only via live-session featured-product pins. |
| "One active entry per creator per card" primitive | Missing · no table/service enforces this. |
| Music public playback | Missing · owner-scoped at four layers (storage-adapter contract, stream route, server action, preview page). |
| Public per-track viewer URL | Missing · `/nex-native/music/page.tsx:11-13` redirects to upload. |
| Music `public` visibility state | Missing · enum is `private \| shared_live \| removed`. |
| Creator profile libraries (Music/Video/Shop) | Missing · profile layout has no library sections. |
| Side-drawer "Live" → feed | Inconsistent · drawer "Go Live" → `/live-commerce/welcome` (broadcaster) today. |
| Live broadcasting (WebRTC) | Exists · `broadcast-engine.ts:59` · `MAX_VIEWERS = 10` sealed. |
| Recorded video playback | Exists · `videos/[videoId]/page.tsx:60`. |
| HLS integration | Partial (idle) · `attach-hls-player.ts` wired to one viewer only. |
| Migration 235 (nex_music_track) | Authored, not applied. |
| Migration 236 | Does not exist. |
| Live R9 Eligibility Contract | DRAFT · wired · 2026-10-27. |
| Vault | LOCKED (2026-10-20). |

---

## 7 · Explicit non-actions and preserved state (as of this doctrine's writing)

- **No application code modified.**
- **No SQL migration file drafted or applied.** Migration 235 remains unapplied. Migration 236 remains absent.
- **No schema change proposed as doctrine.**
- **No configuration change.** `.env.local`, Supabase project, uploaded music, seeded tracks, and the dev-only `.dev-music-data/` are untouched by this doctrine (data already present there from prior conversation turns remains as-is).
- **No commit, no push, no deploy.**
- **No existing hold overridden.** Vault LOCKED, Live R9 contract DRAFT, M1 queue hold, music-bucket phase hold, music-page redesign hold, chat master layout, design tokens, Live uploaded-video contract — all preserved.
- **No implementation phase authorised.** Owner's Option C envelope is strictly doctrine-only.

---

## 8 · Review protocol

This doctrine is reviewable by the owner at any time. Changes to any D1–D10 ruling, any pending clarification, or any constitutional rule are made by replacing or appending to this document and dating the change. Doctrine supersedes conversation. Conversation does not supersede doctrine.

If any later message asks for an action incompatible with this doctrine, that message must either be read as a doctrine amendment (explicit) or declined pending clarification. Silent drift is not permitted.
