# NEX Live · Interaction Feature Contract · 2026-10-24 · R3

**Status: PRODUCT CONTRACT · OWNER-APPROVED on three defaults 2026-10-24.**

**R3 (2026-10-24): the three previously-PROPOSED defaults are now
SETTLED owner decisions:**

- **D1 · APPROVED · Comments are ephemeral by default.** No permanent
  transcript. No 24-hour retention. Any future retention requires a
  separate explicit decision.
- **D2 · APPROVED · Share evidence trichotomy.** `native-share` ·
  `copy-link` · `chat-send` only. Server-side validation. Opening a
  share sheet without completing a share MUST NOT count.
- **D3 · APPROVED · Shop Contacts per-session shuffle seed.** Randomise
  cards per Live session, stable across refreshes within that session.
  Shop Contacts stays private to the business owner and authorised
  operators. Never expose interaction-to-participant mapping.

**R2 (2026-10-24): rewritten to REUSE the existing NEX Contacts system
(nex_friend_request + friend-request-service) rather than build any
parallel invitation / contact primitive.**

**R1 (2026-10-24): initial feature contract draft.**

This is the authoritative design contract for the Live interaction
feature set. It supersedes the briefer sketch in
`nex-live-deferred-features-2026-10-24.md`. The three feature slots
(F1 comments, F2 Shop-Contacts shuffle, F3 private Message) are
distinct product decisions · a Like, Comment or Share does NOT
auto-grant an invitation.

Implementation of the three sealed defaults is AUTHORISED. Infrastructure
gates (sandbox DB provisioning · Migrations 216–222 apply · 2-account
authenticated browser journey) remain as separate owner-decision tracks
with their own authorisation requirements · see §11.

---

## 1 · Existing Contacts system (verified · do NOT duplicate)

Verified in-repo on 2026-10-24.

### Schema
- **Table `nex_friend_request`** (Migration 215, authored, status =
  unapplied in production).
  - `sender_account_id uuid` → `nex_account.id`
  - `recipient_nex_handle text` CHECK `~ '^nex-\d+$'`
  - `recipient_account_id uuid` → `nex_account.id` (nullable so the
    row survives recipient handle changes)
  - `status text` ∈ {`pending`, `accepted`, `passed`, `expired`,
    `cancelled`}
  - `created_at`, `expires_at` (= created_at + 24h), `cooldown_ends_at`
    (= terminal_at + 72h)
  - `accepted_category text` ∈ {`friends`, `business`} · accept-time
  - `accepted_at`, `cancelled_at`

### Service · `src/lib/nex-native/friend-request-service.ts`
- `createInvite(senderAccountId, rawHandle)` · handle→account lookup
  via `getAccountByNexHandle`, cooldown check (72h after terminal) +
  pending-dedup (throws `FriendRequestCooldownError`) + self-invite
  guard. Returns `{ row: FriendRequestRow }`.
- `acceptInvite(requestId, actorAccountId, category)` · flips to
  `accepted`. For `category='friends'` writes a `nex_friend_edge` via
  `friend-service.respondToInvite(accept)`. For `category='business'`
  the peer-conversation open is deferred (status flips, UI shows
  the contact in the Business tab via the request row).
- `cancelInvite(requestId, actorAccountId)` · sender dismisses pending.
- `listPendingInbound(recipientAccountId)` · recipient inbox.
- `listPendingOutbound(senderAccountId)` · sender's own pending list ·
  **sealed doctrine**: hides terminal states so the sender never
  learns decline vs timeout.
- `sweepExpired()` · auto-flips expired rows.

### Server actions · `src/app/nex-native/contacts/_friend-request-actions.ts`
- `createFriendRequestAction(rawHandle)` · sign-in gated · shaped
  result union `{ok, ok-noop, cooldown, unknown-handle, unauthenticated, error}`.
- `acceptFriendRequestAction(requestId, category)` · sign-in gated.
- `cancelFriendRequestAction(requestId)` · sign-in gated.

### Identity privacy rules (sealed 2026-10-23)
Pending-invite rows render **NEX-ID + state only** · no display name,
avatar, city, presence until the recipient accepts. See
`feedback_nex_pending_invite_identity_privacy.md`.

### UI
Mock-complete at `/nex-native/contacts` · pending-invites section +
Connect-by-NEX-ID form.

**Rule for Live: every invite action from the Shop-Contacts shuffle
MUST call `createFriendRequestAction(nex-handle)` and MUST NOT touch
`nex_friend_request` directly.**

---

## 2 · Scope and non-scope

### In scope
- Footer actions on the viewer surface: Like, View Shop, Share, text input.
- The text input is the existing **NEX keypad** (reused · no new keyboard).
- Live comments overlay (F1) rendered over the broadcast video.
- **Shop-Contacts shuffle** (F2): end-of-Live participant cards
  materialise in the broadcaster's **Shop Contacts** view · NEX-ID
  only, random order, no per-event mapping.
- Shop-Contacts cards launch the **existing** `createFriendRequestAction`
  with `category='business'` after owner-recipient flow.
- Dedup against existing `nex_friend_request` + `nex_friend_edge`
  rows (don't duplicate the relationship).
- Reuse 24h expiry + 72h cooldown + outbound-privacy already in
  `nex_friend_request`.

### Explicitly out of scope
- **Any new table that duplicates `nex_friend_request`**.
- **Any new invitation API** · `createFriendRequestAction` is the
  single entrypoint.
- Any auto-DM or auto-accept.
- Any surface that lets the broadcaster see WHICH event (Like /
  Comment / Share) a specific identity triggered after the live ends.
- F1/F2 writes being joined into Intelligence / Directory canonical
  queries (marketing-boundary doctrine).
- Payments / tipping on Live.

---

## 3 · Footer actions

### 3.1 · Like · idempotent per identity per session
Second tap is a no-op (not a tip, not stacking). Generates the
participant-card entitlement (§5). Broadcaster never sees per-event
identity attribution; only the aggregate count during the live, and
the random Shop-Contacts shuffle after.

### 3.2 · View Shop
Navigates to the broadcaster's shop. Does NOT generate a
participant-card entitlement (navigation is not engagement).

### 3.3 · Share · evidence-gated
Participant-card entitlement fires ONLY when NEX has reliable
evidence:
- `navigator.share` resolved successfully (user picked a target), OR
- "Copy link" button pressed and clipboard write confirmed, OR
- "Send in NEX chat" tapped AND the subsequent chat-send succeeded.

NOT counted: user cancelled OS share sheet · clipboard write failed ·
chat-recipient picker closed with no selection.

The share-event carries `evidence: "native-share" | "copy-link" |
"chat-send"` for audit.

### 3.4 · Text input · existing NEX keypad
Sends into the comments overlay (§4). Signed-in only. Max length,
rate limit, slow-mode: owner decisions deferred.

### 3.5 · Dedup across events
A single NEX identity that likes AND comments AND shares yields ONE
participant card. Not three.

---

## 4 · Comments overlay (F1)

- Rendered over the video during the open session.
- Transport: Supabase Realtime broadcast channel per session · sibling
  to the sealed `openFeaturedProductChannel`.
- During the live the broadcaster sees NEX-ID + text in real time and
  can mute / delete per-comment. Flagger identity on viewer-side flags
  is ALWAYS private (consistent with sealed Community Notice doctrine).
- After end-of-Live the historical mapping NEX-ID → comment is NOT
  replayable in the Shop Contacts surface. If a comment archive is
  authorised later it will be a separate surface, not linked to §5.
- Default retention policy: **ephemeral** (DRAFT · owner decision
  pending). Session-level aggregate counts may be persisted on
  `nex_live_session` for the broadcaster's analytics.

---

## 5 · End-of-Live · Shop-Contacts shuffle (F2) · reusing Contacts

### 5.1 · Materialisation
When `endLiveSessionAction` succeeds, a batch job computes the eligible
participant set from the session's engagement log (§6) and materialises
one row per identity in a NEW table `nex_live_participation` (§6
schema). **This table carries only the participation evidence; it
does NOT replicate the invitation lifecycle · all invitations continue
to run through `nex_friend_request` as of today.**

### 5.2 · Shop Contacts surface
The broadcaster's Shop Contacts view queries `nex_live_participation`
(filtered by the broadcaster's owned business) in **random order per
session** (seed stored once at materialisation time · not predictable
from client input).

### 5.3 · Pre-render dedup against the Contacts system
For each candidate participant, the surface runs the SAME eligibility
checks the Contacts page runs today, in this order (short-circuit):

1. **Accepted edge exists** · query `nex_friend_edge`
   `WHERE (sender, recipient)` or `(recipient, sender)` with
   `status='accepted'` → suppress the card entirely (the broadcaster
   already has this contact).
2. **Pending invite exists** · query `nex_friend_request`
   `WHERE (sender=broadcaster, recipient_account_id=participant)
    AND status='pending'` → suppress (the invite is already in
    flight; the Shop Contacts card would duplicate the surface at
    `/contacts`).
3. **Cooldown window active** · query `nex_friend_request`
   `WHERE (sender=broadcaster, recipient_account_id=participant)
    AND cooldown_ends_at > now()` → suppress (the Contacts system
    will refuse `createInvite` anyway; honestly hide the card so the
    broadcaster isn't led into an immediate error).
4. **Participant has blocked the broadcaster** (block table lookup;
   same rule the ordinary Shop Contacts surface uses today) →
   suppress silently.

Cards that survive all four checks render with NEX-ID + general area
only (per sealed pending-invite identity privacy doctrine) plus a
broadcaster-authored session anchor (e.g. "From Live · Oct 24 ·
22:11"). No comment text. No evidence tag. No per-event timestamp.

### 5.4 · The "Send Invite" tap
When the broadcaster taps a Shop Contacts card:
1. Modal confirms + offers an **existing-NEX-keypad text field** for
   the "introduction" (optional) · same keypad as every other NEX
   input.
2. On submit the UI calls the EXISTING `createFriendRequestAction(
   participantNexHandle)` with the participant's handle.
3. `createInvite` runs its own cooldown + self-invite + dedup checks
   (§1) and returns the shaped result. The card updates to show the
   result:
   - `ok` → chip flips to "Pending · 24h" (same as /contacts page).
   - `cooldown` → inline "Already in cooldown · try again at …"
     (same copy pattern used today).
   - `unknown-handle` → should never happen for a Live participant
     (we have their account), but we still surface the shaped error
     honestly.
4. The broadcaster NEVER sees per-event identity attribution during
   this flow. The participant is identified by NEX-ID only.

**The introduction text IS the existing promotional-text capability
already supported by the Contacts text field.** We do not add a
second content pipeline.

### 5.5 · Recipient-side flow (reused verbatim)
The recipient's `/contacts` inbound invitations tab already handles:
- Showing the requester's **profile image + display name + NEX-ID +
  city** per the existing inbound-request copy.
- Accept → category modal (friends / business) → `acceptFriendRequestAction`.
- Decline (via timeout today · explicit Pass UI deferred) → sender
  sees "expired", never "declined".
- 24h expiry (DB-enforced via `expires_at`).

**Business-category rule for Live-originated invites**: the invite
MUST be created with intent to accept as `category='business'` because
these are shop contacts, not personal friends. The CATEGORY IS CHOSEN
BY THE RECIPIENT AT ACCEPT TIME (as it is today) · the sender cannot
force the category. The broadcaster-side UI copy should set
expectations ("Invite to your shop contacts") so the recipient knows
to choose the Business category.

### 5.6 · Post-accept identity reveal
Standard: the recipient's display name becomes visible to the sender
once the request flips to `accepted` (sealed identity rule).

---

## 6 · New data · minimal addition

**Only new DB object is a per-session participation ledger. Everything
else reuses existing tables.**

### 6.1 · Candidate schema (DRAFT · not authorised)

```sql
CREATE TABLE nex_live_participation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL
    REFERENCES nex_live_session(id) ON DELETE CASCADE,
  participant_account_id uuid NOT NULL
    REFERENCES nex_account(id) ON DELETE CASCADE,
  -- Bitmask: like=1, comment=2, share=4. Readable BY SERVICE for
  -- audit · never surfaced per-event to the broadcaster.
  evidence_mask int NOT NULL DEFAULT 0,
  -- SERVER-side timestamp of first evidence · used ONLY for audit.
  first_evidence_at timestamptz NOT NULL DEFAULT now(),
  -- Anchor timestamp used by the Shop Contacts render projection
  -- (session end time). Shared across every row materialised in the
  -- same batch · breaks per-event timestamp correlation.
  shuffle_anchor_at timestamptz NOT NULL,
  -- Per-session random seed · stable so re-renders in the same
  -- Shop Contacts view are consistent. Server-generated at session end.
  shuffle_seed bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_nex_live_participation_one_per_identity_per_session
  ON nex_live_participation (session_id, participant_account_id);
```

RLS: service-role writes only (same posture as the Live tables in
Migration 219). Broadcaster reads via a view that joins to
`nex_live_session.business_id` and ONLY surfaces rows for sessions
the caller owns. **The marketing-boundary rule applies**: never joined
into Intelligence / Directory canonical queries · GRANT/REVOKE
enforcement at migration time (same pattern as Migration 155).

### 6.2 · Share-evidence enum
A tiny new ENUM `nex.live_share_evidence` ∈ {`native-share`, `copy-link`,
`chat-send`}. Carried on the client-side event emit · persisted on the
ledger row via `evidence_mask`-adjacent tracking (not surfaced to the
broadcaster).

### 6.3 · What is NOT a new table
- No new invitation table. `nex_friend_request` is the single
  invitation lifecycle.
- No new contacts table. `nex_friend_edge` is the single accepted
  edge.
- No new identity table. `nex_account` is the single identity.

---

## 7 · Indirect-identification mitigations (unchanged from R1)

- No per-event `created_at` surfaced in the Shop Contacts projection.
- No comment text replayed on the Shop Contacts card.
- Random shuffle anchored to a non-predictable server seed.
- A session with ONE participant necessarily unmasks that identity ·
  we disclose this honestly in the UI copy.
- The participation entitlement is a BATCH write at session end · not
  per-event streaming (which would let the broadcaster correlate
  card-count-jump with comment arrival).

---

## 8 · Edge cases (reconciled against the Contacts system)

| Case | Rule |
|---|---|
| Guest likes / comments / shares | Comments blocked (signed-in only). Likes count only (no card). Shares with evidence: no card (no NEX identity to invite). |
| Share action fails | No card, no event logged. |
| Same identity acts N times | One `nex_live_participation` row, one card. |
| Accepted `nex_friend_edge` already exists | Card suppressed (dedup rule 1). |
| Pending `nex_friend_request` already exists | Card suppressed (dedup rule 2). |
| Cooldown active after previous invite declined / expired | Card suppressed (dedup rule 3). Broadcaster is NOT shown that this participant was previously declined · just no card. |
| Participant blocks broadcaster | Card suppressed silently. |
| Broadcaster blocks participant | Card suppressed silently. |
| Session timed out (stale, no explicit end) | Participation ledger does NOT materialise. |
| Session force-ended by moderation | Owner decision deferred. |
| Zero participants | No Shop Contacts additions. |
| Broadcaster has multiple businesses | Participation ledger is per-session, not per-business · Shop Contacts view scopes by the session's `business_id` (NULL for free-tier broadcasters · no Shop Contacts materialisation in that case). |

---

## 9 · Interaction with F3 (deliberate private Message)

F3 is separate. A Like, Comment or Share does NOT grant private
messaging. The broadcaster must:
1. See the identity in Shop Contacts (random order).
2. Call `createFriendRequestAction(handle)` via the existing flow.
3. Recipient accepts.
4. ONLY THEN can the broadcaster message them via the existing peer
   chat.

The viewer-initiated "Order Now" product-chat path (Phase 2) is a
different flow and does NOT grant F3 rights either.

---

## 10 · Explicit non-claims

- No code shipped under this contract.
- No DB migration drafted (candidate SQL only).
- No UI mount.
- No tests.
- Share-evidence enum PROPOSED · UI affordances for the three
  evidence paths not decided.
- Retention for comments PROPOSED as ephemeral · owner decision
  pending.
- The `category='business'` accept path currently defers the actual
  peer-conversation creation (per friend-request-service.ts:214).
  Full business-category acceptance (creating a peer_conversation on
  accept) is a prerequisite BEFORE launching F2 Shop Contacts,
  otherwise an accepted invite results in a limbo state where the
  broadcaster can see the contact but can't message them · see §11.

---

## 11 · Build gating

### 11.1 · Code-level gates · CLOSED (APPROVED 2026-10-24)

1. ✅ **`nex_live_participation` schema + RLS posture** — approved;
   Migration 221 drafted. Partial unique index on
   `(session_id, participant_account_id)` + broadcaster-scoped SELECT
   via `nex_current_owned_business_ids()` + GRANT/REVOKE
   marketing-boundary.
2. ✅ **Share-evidence enum** (D2) — approved. `native-share` ·
   `copy-link` · `chat-send`. CHECK constraint on Migration 222.
   Server action rejects anything else. Cancelled share sheets fire
   no evidence.
3. ✅ **Comment retention** (D1) — approved as ephemeral. No DB
   table. Overlay renders the last 50 in-session; nothing persists
   past session close.
4. ✅ **Business-category peer-conversation open** — wired in
   `friend-request-service.acceptInvite(category='business')` via
   `getOrCreatePeerConversation`. 6 tests covering idempotency,
   duplicate accept, failure propagation, non-recipient actor,
   expired request, friends-category non-regression.
5. ✅ **Pending-invite identity privacy** (NEX-ID only on cards) —
   honoured verbatim by `ShopContactsCard` + `_shop-contacts-card.tsx`.
   Service projection strips `evidence_mask`, `first_evidence_at`,
   `created_at` before the broadcaster ever sees it.
6. ✅ **Implementation authorised** as a separate scope. Service
   layer + UI mounts + regression tests all shipped.

### 11.2 · Infrastructure gates · OPEN (separate owner tracks)

These are explicitly SEPARATE from the three sealed product decisions.
They remain as independent owner-decision tracks:

- **G-DB1 · Sandbox provisioning.** A dedicated non-production
  Supabase project (or local Docker-backed `supabase start`) must be
  provisioned by the owner. Must NOT reuse
  `ijvqdvsvwtwxzcqmoqit` (sealed production).
- **G-DB2 · Migration apply plan 216 → 217 → 218 → 219 → 220 → 221 →
  222.** Procedure authored in
  `docs/doctrine/nex-live-migrations-apply-procedure-2026-10-24.md`.
  Each migration carries its own rollback block. Apply requires:
  (a) target verified as non-production, (b) pre-apply schema
  snapshot captured, (c) explicit owner authorisation per migration
  window.
- **G-E2E · Two-account browser journey.** Playwright
  `mobile-chromium-pixel7-authed` project exists; `tests/e2e/.auth/
  state.json` fixture must be produced by an owner-authorised
  interactive sign-in. Second account requires a second storage-state
  fixture (deferred by Playwright config change). Credentials MUST
  NOT be committed or pasted in chat.
