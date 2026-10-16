# NEX-Official First-Visit Chat · Design Contract

**Status:** DESIGN ONLY · unauthorised · no code change required by this document.
**Date:** 2026-10-14.
**Scope:** Architecture + product contract for a future, bounded conversation that NEX itself holds with a first-time anonymous visitor, so the Phase 1 arrival-journey can be chat-first without routing uncontrolled welcome traffic to real business owners.
**Companion:** this document assumes the reader has read `docs/doctrine/nex-arrival-journey-phase-1-2026-10-14.md`.

Every claim in this document is tagged as **VERIFIED** (I inspected the referenced source), **PROPOSED** (new design · not shipped), or **FOUNDER DECISION** (requires explicit authorisation).

---

## Executive recommendation

1. **Do NOT invent a new identity model.** Migration 084 already seeds a canonical NEX support account at `nex_account.id = '00000000-0000-0000-0000-000000000001'` (handle `nex-00001`, display name `NEX`). Everything proposed below reuses this account.
2. **Do NOT weaken the Phase 1 commerce gate.** NEX-Official chat is a chat surface, not a shop; it never touches the `/nex-native/[businessSlug]` cover path and does not need the commerce flag flipped.
3. **Do NOT invent a new rate-limit primitive.** The existing `src/lib/nex-native/community/rate-limit.ts` + `nex_community_rate_limit` table is reusable because provisional sessions are backed by real `nex_account` rows.
4. **First release is small**: a single welcome entry point that opens a provisional conversation with the NEX1 account, renders the already-canonical welcome body deterministically, and gates follow-up with a honest "create a free account to continue" CTA. No autonomous replies in v1.
5. **One sealed invariant must be added**: a BEFORE-write re-check of the Bridge 99 fingerprint + risk assessment on every guest follow-up to the NEX1 conversation. The current `sendGuestMessageAction` does not do this (see §4 of the arrival-journey doctrine) and must not be exposed to welcome-page scale traffic without it.

The smallest safe first release is scoped as 5 bounded commits, listed in §9. **No commit may ship until the §7 acceptance criteria are met in the isolated schema harness, and even then the live rollout requires a separate authorisation.**

---

## 1. Identity and persistence

### 1.1 How a provisional visitor is identified (VERIFIED)

- `src/lib/nex-native/first-conversation/provisional-session.ts` returns `{ kind: 'authenticated' | 'provisional' | 'none' }`. Provisional is backed by a signed `nex_session` cookie whose server-side validity is checked against `nex_session_registry`.
- Sealed §7 of the Bridge-99 doctrine requires three conditions on the cookie path: `signature_matches AND now < expires_at AND session_id NOT IN revoked`. The first two are checked by `session-crypto.ts`; the third is a `nex_session_registry` lookup.
- Fingerprint is a RISK SIGNAL, not an identity resolver (§7A). The resolver module explicitly cannot import `risk-service.ts`.

### 1.2 What persists · what remains provisional (VERIFIED)

- The provisional account IS a real `nex_account` row (sealed §7B: "Curiosity does not create identity; participation does"). The row is created inside the first-message orchestrator's `Send` transaction, not by the resolver.
- Downstream FKs (`nex_peer_conversation`, `nex_peer_message`) point at `nex_account.id`. The provisional account functions as a regular identity anchor for the FK contract.
- No `is_provisional` column has been inspected; honest marker is: `supabase_user_id IS NULL AND claimed_at IS NULL` (needs confirmation during implementation).

### 1.3 On signup / account linking (PROPOSED referencing VERIFIED)

- Account-link path is sealed as "Phase C" per `/chat/guest/[ownerAccountId]/page.tsx:36`. Exact mechanics have not been inspected in this document (do not assume).
- Design assumption (needs source-level verification before build): on signup, the provisional account becomes the real account via a column flip (e.g. populating `supabase_user_id`), preserving every FK and every message history.
- The NEX-Official conversation ID stays stable across the link transition.

### 1.4 Honest user-facing privacy copy (PROPOSED)

Three honest sentences must appear on the NEX-Official chat surface, verbatim:

> "You're chatting with NEX. Your messages are stored on NEX so you can continue the conversation.
> This chat is linked to a temporary account on this device. Create a free NEX account to keep it.
> If you don't create an account within 30 days, this chat is removed."

The 30-day figure is a **PROPOSED** retention policy (§5.4) · the third sentence of the privacy copy MUST NOT ship until §5.4.1–§5.4.4 are each resolved, the §5.4.5 sweep is implemented, and the §5.4.3 backup/PITR behaviour has been answered. Shipping the sentence sooner would overstate what the application layer actually guarantees.

---

## 2. Official NEX destination · account vs. business identity

### 2.1 Option A · bare `nex_account` row (RECOMMENDED · VERIFIED exists)

- Migration 084 (`084_nex_official_account.sql`) seeds `nex_account.id = '00000000-0000-0000-0000-000000000001'`, handle `nex-00001`, display name `NEX`, `chat_theme = default`, `supabase_user_id = NULL`.
- The row is already consumed by `src/lib/nex-native/nex-official-welcome.ts` which renders a canonical welcome body.
- The NEX1 account is NOT a `nex_business`; it has no `cover_layout_id`; the commerce launch gate does not apply to it.

### 2.2 Option B · dedicated `nex_business` for NEX

- Would introduce a `/nex-native/<nex-slug>` cover page that is subject to Bridge 55's commerce gate.
- Visitor arrival-to-chat would require either flipping `NEX_COMMERCE_ENABLED` or hard-coding a bypass for a specific business slug.
- Both weaken the sealed Phase 1 doctrine.

### 2.3 Recommendation

**Option A.** The NEX1 account already exists for exactly this purpose (seed migration comment: "the NEX official support account that all users can chat with for upgrade help, feature questions, and account support"). Design the welcome entry point as a thin wrapper that opens a provisional conversation with `owner_account_id = NEX1`. No new table, no new identity model, no commerce-flag change.

### 2.4 How the sealed contract supports it (VERIFIED)

- The Bridge 99 first-message endpoint already accepts `owner_account_id: string` as its routing parameter (`src/lib/nex-native/first-conversation/first-message-http.ts`, `FirstMessageRequestBody` interface line ≈27–41).
- `peerConversationService.getOrCreatePeerConversation(a, b)` is idempotent per the sealed guest-chat action; passing `(provisional_account_id, NEX1_ID)` returns the one canonical conversation row.
- `nex_peer_message` writes use the service-role admin client regardless of who the peer is.

**No new identity contract is needed.** The sealed §7 resolver, the fingerprint pipeline, the orchestrator, the welcome-outbox worker, and the guest-chat page all accept this flow unchanged.

### 2.5 Isolation guarantees for the NEX1 identity

This section separates what the isolation model actually enforces (inspected in source) from what remains an unverified claim.

#### 2.5.1 Schema-level isolation (VERIFIED · migration 047)

Inspected `nex-supabase/migrations/047_nex_peer_chat.sql`:

```sql
CREATE TABLE IF NOT EXISTS nex_peer_conversation (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a_id    uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  participant_b_id    uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  …
  CONSTRAINT nex_peer_conversation_ordered_pair
    CHECK (participant_a_id < participant_b_id),
  CONSTRAINT nex_peer_conversation_distinct
    CHECK (participant_a_id <> participant_b_id),
  CONSTRAINT nex_peer_conversation_unique_pair
    UNIQUE (participant_a_id, participant_b_id)
);
```

Verified consequences:

- Every pair of accounts maps to AT MOST ONE conversation row (UNIQUE pair).
- Because `NEX1_ID = '00000000-0000-0000-0000-000000000001'` sorts lexicographically below every normal UUID, the ordered-pair CHECK forces NEX1 to always be `participant_a_id` in these conversations.
- Alice↔NEX1 is one row; Bob↔NEX1 is a different row. The schema does not permit a shared conversation.

**This is a schema guarantee**, not a RLS guarantee. See §2.5.3 below.

#### 2.5.2 Participant-check at the two inspected guest-chat sites (VERIFIED)

Inspected directly during this review:

- `src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts:54–58` — before any message write, `sendGuestMessageAction` checks `conversation.participant_a_id === guestAccount.id || conversation.participant_b_id === guestAccount.id` and returns `{ ok: false, reason: 'not_participant' }` on miss.
- `src/app/nex-native/chat/guest/[ownerAccountId]/page.tsx:122–133` — before `peerMessageService.listPeerMessages` is called, the same participant check runs; on miss the page returns `notFound()`. The adjacent source comment is explicit: *"the service-role reads below bypass RLS. We MUST verify the guest is actually a participant in this conversation before returning messages, otherwise any provisional-session holder could enumerate conversations by owner id."*

For an authenticated viewer, the sealed guest-chat page's prior rule (`/chat/guest/[ownerAccountId]/page.tsx:70–71`) redirects UP to `/chat/peer/[accountId]`. That path has its own participant check which was NOT inspected in this review (see §2.5.4 UNVERIFIED item).

#### 2.5.3 Service-role bypass model (VERIFIED · belt-and-braces · load-bearing)

Inspected `src/lib/nex-native/peer-message-service.ts:451–467` (`listPeerMessages`) and the adjacent comment on `getLastPeerMessageInConversation` at line 471–473. Verified facts:

- `listPeerMessages` and `getLastPeerMessageInConversation` filter ONLY on `conversation_id`. They do NOT perform their own participant check.
- The service runs under `nexSupabaseAdmin` (service-role client) which bypasses RLS by design.
- The sealed comment on `getLastPeerMessageInConversation` states: *"caller is responsible for verifying the viewer participates in the conversation."*

**The isolation guarantee therefore depends on EVERY CALLER performing the participant check.** The schema UNIQUE constraint prevents two visitors from sharing a conversation row, but the application layer prevents one visitor from reading another's row.

Known callers of `listPeerMessages` / `getLastPeerMessageInConversation` (6 sites · identified by grep · their individual participant-check status was NOT verified file-by-file in this review):

| Caller | Participant check verified in this review? |
|---|---|
| `chat/guest/[ownerAccountId]/page.tsx:136` | ✅ YES (section 2.5.2) |
| `chat/peer/[accountId]/page.tsx:175` | ❌ NOT INSPECTED |
| `chat/prototypes/hauntedhoteltheme/page.tsx:87` | ❌ NOT INSPECTED |
| `chat/prototypes/portrait-bloom/page.tsx:102` | ❌ NOT INSPECTED |
| `vault/home/chats/page.tsx:67` (preview) | ❌ NOT INSPECTED (Vault B.4 memory suggests membership check exists but this review did not read the file) |
| `vault/home/chats/[conversationId]/page.tsx:141` | ❌ NOT INSPECTED |
| `lib/nex-native/report-service.ts:139` | ❌ NOT INSPECTED |

**UNRESOLVED verification items for §2.5.3:**
- Each of the six non-inspected callers must be audited to confirm it performs a participant check before returning messages to its viewer. A missing check in any caller would be a cross-visitor exposure path.

#### 2.5.4 NEX1 as a sender in existing code paths (VERIFIED · worth stating)

Grep for `NEX_OFFICIAL_ACCOUNT_ID` returned usage in:

- `src/lib/nex-native/first-conversation/welcome-delivery.ts:47, 92, 102` — welcome messages are inserted into `nex_peer_message` with `sender_account_id = NEX_OFFICIAL_ACCOUNT_ID`.
- `src/app/nex-native/_actions.ts:176, 196, 5899, 5904, 5921` — two existing Server Actions already use NEX1 as a sender.

**These are existing production code paths.** NEX1 is not a theoretical account; it already sends messages into real conversations today. The NEX-Official chat proposal reuses the same sender-identity pattern.

#### 2.5.5 Administrative / support surfaces · UNRESOLVED

Directory listing identified two surfaces that MAY reference NEX1 or carry support information:

- `src/app/nex-native/admin/` — admin surfaces exist on disk. Contents NOT inspected in this review.
- `src/app/nex-native/support/` — support surfaces exist on disk. Contents NOT inspected in this review.

**I CANNOT assert that NEX1 has no administrative or support surface** · neither directory was opened in this review. The migration-084 comment that NEX1 "has no supabase_user_id" implies no login-based admin UI, but a server-side admin page reading NEX1 conversation data would not require a login for NEX1 itself.

**UNRESOLVED verification items for §2.5.5 (release-gating):**
- Audit every file under `src/app/nex-native/admin/` and `src/app/nex-native/support/` for reads from `nex_peer_message` / `nex_peer_conversation` scoped to NEX1 or to arbitrary conversations without a viewer-participant check.
- If any admin surface displays a NEX1 conversation thread, verify the viewer-access policy (RLS, role check, feature flag, authentication requirement) is correctly enforced.
- Document what NEX1 is used for today beyond `welcome-delivery.ts` and the two `_actions.ts` call sites. If NEX1 holds support-ticket conversation data in production, that data must not be reachable from the proposed welcome entry point.

**Until §2.5.5 is resolved, do NOT ship a NEX-Official chat welcome tile.** The isolation argument is incomplete without this audit.

#### 2.5.6 What isolation DOES NOT prevent (honest limits)

- A visitor who sends many messages into their own NEX1 conversation can still cause storage bloat (addressed by §4 rate limits once implemented).
- A visitor who shares the raw conversation UUID with a third party does NOT thereby grant access — the participant check blocks third-party reads (verified for the two guest-chat sites in §2.5.2, unverified for the six other callers in §2.5.3).
- Isolation is a per-site property. A future surface that reads `nex_peer_message` without a participant check would break isolation for every conversation it enumerates, not just NEX1.

---

## 3. Reply contract

### 3.1 First-release reply model (PROPOSED)

- **Deterministic server-side strings only.** No streaming, no model inference, no third-party AI service, no agentic behaviour, no promise of autonomous capability.
- The first-release NEX1 conversation shows **one** scripted welcome message (from `renderNex1WelcomeBody`, VERIFIED to exist and tested) and a single scripted auto-reply when the visitor sends their first follow-up.
- The auto-reply text (PROPOSED):

> "NEX reads your message. For now, create a free NEX account to continue this conversation — I'll see every message you send after that and reply with help. Your current chat is kept on this device for 30 days."

- No further scripted replies in v1. The visitor sees: welcome + their own first message + the account-creation nudge. That is the entire v1 contract.

### 3.2 Why no autonomous intelligence in v1 (PROPOSED rationale)

- Autonomous replies require either a model/API (third-party dependency and runtime cost) or a hand-maintained canonical catalogue (ongoing editorial burden).
- Shipping a convincing-looking auto-replier that is actually a canned string is dishonest.
- A silent "NEX will reply later" posture is honest, bounded, and lets us measure real demand before investing.

### 3.3 Out-of-scope input handling (PROPOSED)

Every input is treated as out-of-scope in v1. The auto-reply does not pretend to understand the question. It explicitly says the chat is a draft and the next step is account creation. **No input classification, no keyword routing, no sentiment analysis.**

### 3.4 Honesty invariants (sealed by design)

- NEX replies **MUST** be rendered server-side from a sealed catalogue (`src/lib/nex-native/nex-official-chat/reply-catalog.ts` · PROPOSED path).
- Reply bodies **MUST NOT** interpolate anything other than the first name of the visitor (same contract as `renderNex1WelcomeBody`).
- **MUST NOT** include a fake typing indicator, fake "NEX is online now" banner, or any UX that implies a human on the other side.
- A sealed regression test (PROPOSED) will fail if any catalogue entry contains the strings `AI`, `GPT`, `Claude`, `OpenAI`, `Anthropic`, or any model/vendor name.

---

## 4. Abuse and rate limits

> **No operating protection today.** Every rate-limit value, action key, and threshold in §4.2 is a hypothesis. These proposals **do not provide any protection** against flooding, replay, or shared-session abuse in the current running app. They become protection ONLY after they are (a) implemented against the primitive described in §4.1, (b) deployed to the live environment, (c) verified against the regression + adversarial matrix defined in §7, and (d) explicitly re-approved for production. Until all four conditions hold, treat §4.2 as intent, not state.

### 4.1 Verified primitives

- **`recordIfAllowed(accountId, action)`** at `src/lib/nex-native/community/rate-limit.ts` is a rolling-window limiter. Keyed on `(account_id, action, window_started_at)` composite PK of `nex_community_rate_limit`.
- Config at `src/lib/nex-native/community/types.ts:321` is `NEX_COMMUNITY_RATE_LIMITS: Record<Action, { windowMinutes, maxPerWindow }>`.
- Current entries are community-notice specific; the primitive supports any new action key.
- Provisional accounts ARE real `nex_account` rows, so the existing `account_id`-keyed limiter works unchanged.

#### 4.1.1 Concurrency limitation (VERIFIED from source · load-bearing)

The sealed source comment on `recordIfAllowed` is explicit: *"Not atomic in the strict sense — two concurrent calls to recordIfAllowed at a cold bucket could both pass. For Phase 1 (community-notice authoring, 3/hour per account) this is acceptable. If stricter serialisation becomes needed we can move to a Postgres advisory lock or a stored procedure."*

**Precise race window.** Two concurrent requests from the same `(account_id, action, window_started_at)` triple can both:
1. Read `currentCount = N` (where `N < maxPerWindow`).
2. See `N < maxPerWindow` and pass the gate.
3. UPSERT `count = N + 1`.
4. Both commits succeed because the UPSERT is on the composite PK, not conditional on the previous value.

Observable consequence: a maliciously fired burst of M concurrent requests can exceed `maxPerWindow` by up to `M − 1` within one window. For low-concurrency traffic the overshoot is bounded; for a motivated attacker it is not.

**This limitation MUST NOT be hand-waved away by referencing expected traffic volume.** A NEX-Official welcome surface exposed from the welcome page is, by design, a potentially high-concurrency endpoint. Treat the race as a real abuse vector.

**Required test before any production exposure (release gate · see §7.2 criterion #12):** an adversarial test that fires N = 50 concurrent `nex_official_start` requests from the same `provisional_account_id` and asserts the number of `created` responses is ≤ (`maxPerWindow` + a tolerance that reflects the race). If the overshoot exceeds the acceptable tolerance (**founder decision D7 required** · zero is strongest, N/5 is pragmatic), the implementation must migrate to one of the sealed-source alternatives:

- Postgres advisory lock (`pg_advisory_xact_lock(hashtext(account_id || action))`) around the read-modify-write.
- Stored procedure that performs the check-and-increment in a single transaction with `FOR UPDATE` row-level locking.

Either path requires a new migration (not needed in this design document; a Stage-level task).

**Condition that requires atomic enforcement.** If measured burst-abuse during live traffic exceeds `maxPerWindow × 2` within any single window, atomic enforcement is mandatory before the surface stays exposed. Monitoring hook: emit a structured event when `currentCount > maxPerWindow` is observed on read (the primitive today does not do this; the hook is a proposed addition inside the Stage-level follow-up protection PR).

### 4.2 Proposed limits (NUMBERS ARE PROPOSALS · NOT PRODUCTION CONFIG)

| Action | Scope | Proposed limit | Rejection behaviour |
|---|---|---|---|
| `nex_official_start` | per provisional `account_id` | 3 per 60 min | HTTP 429 · suggest returning user path |
| `nex_official_send_followup` | per provisional `account_id` | 5 per 60 min | HTTP 429 · surface "Create an account to continue" copy |
| `nex_official_start_per_fingerprint` | per `fingerprint_hash` | 10 per 24 h | HTTP 429 · possible challenge escalation (reuse Bridge 99 `turnstile`/`phone_otp` challenge paths) |
| `nex_official_start_per_ip24` | per `/24` IP bucket | 50 per 24 h | HTTP 429 · abuse-review hook |

The `fingerprint_hash` and `ip_24_bucket` are already produced by `src/lib/nex-native/first-conversation/provisional-fingerprint.ts` (VERIFIED). The limits above are **PROPOSED** numbers that need load-testing against real traffic patterns.

**Shared-IP / NAT caveat (sealed by design decision).** An IP /24 bucket is a **soft signal only**. Schools, offices, mobile carriers, and consumer NAT routinely place dozens or thousands of honest visitors behind the same /24 — and increasingly behind the same /32 due to carrier-grade NAT. The per-`ip_24_bucket` limit in the table above exists as a sudden-surge backstop ONLY; it must NEVER be used as the sole basis for blocking an otherwise-legitimate visitor. The primary keys the system should trust are `provisional_account_id` (unique per device/session) and `fingerprint_hash` (within the sealed §7A whitelist). When the per-IP backstop triggers, the correct behaviour is to challenge (reuse Bridge 99 `turnstile` / `phone_otp` escalation) and continue serving legitimate traffic, not to drop the request. **Any future amendment to this document that proposes blocking on IP alone requires a separate founder authorisation.**

### 4.3 Required protection gaps to close before exposure

| Gap | Where it lives today | Proposed fix |
|---|---|---|
| **G1** · `sendGuestMessageAction` has no frequency rate limit | `src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts` (per §4 of arrival-journey doctrine) | Wrap `sendGuestMessageAction` with `recordIfAllowed(guestAccount.id, 'nex_official_send_followup')` IF the target conversation's `owner_account_id === NEX1_ID`. Non-NEX conversations (B2C) retain their existing behaviour until a separate pass. |
| **G2** · follow-up messages do not re-check fingerprint / risk | same file, no risk-service import | Thread `assessRisk(RiskInput)` from `risk-service.ts` into the follow-up path; on `block`, return 403 and revoke the session via `nex_session_registry`. |
| **G3** · no content-safety classifier on guest-sent bodies | — | Phase 2+. In v1 the auto-reply doesn't actually read user input, so content classification is not strictly required for the NEX side. User-sent content IS stored though · a basic length + character-set validator is sufficient for v1. |

> **Honest scope caveat on G1/G2 fixes.** The narrow scope (NEX1-only in v1) does NOT mean non-NEX guest follow-ups are acceptably protected today. They are not. Every existing Bridge 99 conversation inherits V1 and V2 from §5.5. The narrow fix exists to let the NEX-Official surface be exposed safely BEFORE the wider pass completes. The wider sweep across all guest-chat callers is a separate, mandatory precondition for any additional guest-surface exposure (see §5.5).
| **G4** · no logging of blocked attempts | — | Reuse `assessRisk` decision log (sealed §8) · emit a structured event when a NEX-Official follow-up is blocked. No PII beyond what §7A already permits (fingerprint hash, no raw IP). |

### 4.4 Fingerprint/risk re-check (PROPOSED)

On every `nex_official_send_followup`:
1. Re-compute fingerprint from the request (`provisional-fingerprint.computeProvisionalFingerprint`).
2. Compare to the stored fingerprint hash recorded at first-message time (via `verifyProvisionalFingerprint`, VERIFIED to exist).
3. If the hash does not verify under any accepted salt, call `assessRisk` with the mismatch signal and act on the returned decision (`allow`, `challenge`, `block`).
4. The RISK SIGNALS pipeline doctrine (§7A/§8) must not be weakened — no new identity resolution, no fingerprint-to-account lookup.

---

## 5. Security and privacy

### 5.1 Session authorisation (VERIFIED)

- Signed `nex_session` cookie · verified by `session-crypto.ts` · validity checked against `nex_session_registry` on every resolve.
- Service-role credentials stay server-side (`nexSupabaseAdmin` is the only writer; never bundled to the client).

### 5.2 Revocation (PROPOSED referencing VERIFIED surface)

- Admin can revoke a session via `nex_session_registry` (existing). The NEX-Official chat MUST participate in the standard revocation path.
- When a session is revoked server-side, subsequent `sendGuestMessageAction` calls receive `kind: 'none'` from the resolver and return 401.

### 5.3 Account-linking race (PROPOSED analysis)

- **Scenario:** visitor opens NEX-Official chat, sends 2 messages, then clicks "Create free account" in another tab. The create-account action runs the sealed Phase C link path. The in-flight NEX-Official conversation sees the account id change under it.
- **Mitigation:** `peerConversationService.getOrCreatePeerConversation` is keyed on the pair `(account_a, account_b)`. If the account id is re-labelled from provisional to real, downstream reads via the new id continue to see the same conversation row (FK on `account_id` or on a stable column — needs source-level verification before build).
- **Required test:** adversarial test that performs a signup WHILE the provisional NEX-Official conversation has unflushed writes in the outbox, and asserts the conversation + its messages survive with no duplication.

### 5.4 Data retention and deletion

**Before any retention POLICY can be approved, the four behaviours below must each be specified and verified. The 30-day sweep proposed in §5.4.5 is CONDITIONAL on §5.4.1–§5.4.4 being resolved.**

#### 5.4.1 Messages (CASCADE semantics · VERIFIED at schema level)

Verified from `nex-supabase/migrations/047_nex_peer_chat.sql` (direct inspection this review):

- `nex_peer_conversation.participant_a_id uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE`
- `nex_peer_conversation.participant_b_id uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE`
- `nex_peer_message.conversation_id uuid NOT NULL REFERENCES nex_peer_conversation(id) ON DELETE CASCADE`
- `nex_peer_message.sender_account_id uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE`

Consequence: deleting a provisional `nex_account` row cascades to delete every `nex_peer_conversation` the account participates in, which cascades to every `nex_peer_message` in those conversations. **This includes the counterpart's messages in that conversation** (e.g. Bob's replies to Alice disappear from Bob's side if Alice is deleted). This is standard right-to-erasure behaviour but worth stating explicitly — the policy affects the counterpart's view of the thread.

**UNRESOLVED verification items for §5.4.1:**
- Are there additional FKs pointing at `nex_account.id` (e.g. reactions, read receipts, bookmarks) that CASCADE / RESTRICT / SET NULL differently? Not yet inspected.
- Any triggers that run on delete and could leak PII to audit tables? Not yet inspected.

#### 5.4.2 Linked accounts (definition + exclusion rule · PROPOSED)

Honest definition: an account is **linked** when either of the following holds:

- `supabase_user_id IS NOT NULL` (an authenticated login has been attached), OR
- A Phase C link marker is present (e.g. `claimed_at IS NOT NULL`, if such a column exists).

**UNRESOLVED verification item for §5.4.2:** the exact Phase C column (`claimed_at`? another marker?) has not been inspected in this review. Build cannot proceed until the actual link marker is verified in source.

Any retention sweep MUST exclude linked accounts without exception. A linked account is a real user and its conversation history is their property, not a dormant draft.

#### 5.4.3 Backups and point-in-time recovery (UNRESOLVED · verification required)

The application layer cannot guarantee a row is gone from the storage layer. Supabase provisions managed Postgres with its own backup / point-in-time-recovery (PITR) window.

**UNRESOLVED verification items for §5.4.3:**
- What is the PITR window on the NEX Supabase project?
- Can a deleted row be read from PITR by any role?
- What is the retention of logical backups (if any) that may be exported outside Supabase?
- Does Supabase support SQL-level `pg_wal_force_switch` or logical-replication slots that would preserve rows beyond `DELETE`?

**Do not claim right-to-erasure compliance** until these questions are answered by an operator with direct access to the Supabase project configuration. Application-level `DELETE` is a necessary but insufficient condition.

#### 5.4.4 User- and admin-triggered deletion requests (UNRESOLVED · design required)

A dormancy sweep does NOT answer "a visitor asks us to forget them NOW." The following behaviours must be specified before the 30-day sweep ships:

- **User-triggered deletion:** a "forget this device" button on the NEX-Official surface that invokes a server action to delete the provisional `nex_account`. Returns 200 + a confirmation message that explains the §5.4.3 backup caveat honestly.
- **Admin-triggered deletion:** a service-role-only endpoint for honouring an inbound right-to-erasure request from an identified visitor. Must log the request + evidence of deletion to a tamper-evident surface outside the deleted account's cascade reach.
- **Confirmation copy:** the honest statement about PITR must appear in any confirmation UI. Must not promise more than the application layer can deliver.

**UNRESOLVED verification items for §5.4.4:**
- No such UI exists today (not inspected in detail; grep found no `forget-this-device` route).
- No audit-trail table outside the cascade reach has been identified.

#### 5.4.5 Dormancy sweep (CONDITIONAL · requires §5.4.1–§5.4.4 resolved)

Only after §5.4.1–§5.4.4 are resolved can a dormancy sweep be approved. The proposed shape:

- Nightly job (service-role).
- Target: provisional `nex_account` rows where (a) `supabase_user_id IS NULL`, (b) the account's Phase C link marker is unset, (c) the account has not sent or received a message in `> 30` days.
- Action: `DELETE FROM nex_account WHERE id = $1`; relies on the verified CASCADE chain from §5.4.1.

The 30-day figure is a **PROPOSAL · founder decision D1 required** (GDPR / dormancy semantics / support-request behaviour). Do NOT claim right-to-erasure compliance until §5.4.3 is answered.

### 5.5 Vulnerabilities to flag (not to fix in this task)

**The wider guest follow-up surface is NOT acceptably protected today.** V1 and V2 below apply to EVERY guest-chat conversation reachable via Bridge 99 (not just the NEX-Official flow). The narrow NEX1-only fix proposed in §4.3 G1/G2 closes the gap for this one surface but leaves the rest of the guest-chat population exposed. **No additional guest-chat entry point may be opened from the welcome page or any new surface until V1 and V2 are addressed across all guest-chat callers and the fix is verified in CI.** This is a hard precondition for any future "chat with any business from welcome" or similar expansion.

- **V1 · Gap G1 above** — `sendGuestMessageAction` lacks frequency rate limiting. If exposed from the welcome page without the proposed limiter, a single visitor could flood any conversation. Applies to every guest-chat destination today, not just NEX1.
- **V2 · Gap G2 above** — fingerprint drift on follow-up is not detected. Session hijack would not be caught by the current path. Applies to every guest-chat destination today.
- **V3 · Provisional account retention** — no cleanup today; sealed §7A says fingerprint hashes "clear on claim" via `clearProvisionalFingerprintOnClaim`, but the row itself persists. Not a security vulnerability per se; a privacy / data-minimisation concern. See §5.4.

**None of V1/V2/V3 should be fixed in this design task.** Each is Stage-level work with its own authorisation. V1 and V2 MUST be fixed across the wider guest-chat surface before any guest-chat expansion is contemplated.

---

## 6. Launch boundary

### 6.1 Preserving the sealed Phase 1 commerce gate (VERIFIED)

- `NEX_COMMERCE_ENABLED` default false (`src/lib/nex-native/launch-flags.ts`).
- Gates the business cover page at `src/app/nex-native/[businessSlug]/page.tsx:81-83`.
- Direct quote from launch-flags header: *"Chat, themes, settings, profile, friends, contacts, NEX1 support stay always-on."*

### 6.2 Why NEX-Official chat is outside the gate (PROPOSED architecture)

- NEX-Official chat uses `nex_peer_conversation` + `nex_peer_message` — the sealed chat primitives explicitly listed as **always-on** in the launch-flags doctrine.
- The entry point is a chat API (`POST /api/nex-native/nex-official/start` · PROPOSED), NOT a cover page. The commerce gate at `[businessSlug]/page.tsx` is never traversed.
- The NEX1 account is a `nex_account`, not a `nex_business`. No `cover_layout_id`, no shop sheet, no commerce surface mounts.
- Therefore no launch-flag change is required.

### 6.3 How this preserves the ordinary business-owner-chat path (VERIFIED)

- Ordinary business cover pages remain gated behind `commerceEnabledForRequest()` as today.
- Ordinary `/chat/guest/[ownerAccountId]` continues to serve conversations opened via a business cover.
- NEX-Official chat is a parallel, dedicated route — it does not touch any business owner's traffic volume or expose their account to welcome-page scale.

### 6.4 What must NOT be done as a shortcut

- **NO** flipping `NEX_COMMERCE_ENABLED` to make a specific business cover publicly reachable as the welcome destination.
- **NO** adding a `/nex-native/[businessSlug]/page.tsx` bypass that recognises "NEX" as a special slug.
- **NO** making the welcome page tile deep-link into a real seller's cover.

---

## 7. Testing and rollout

### 7.1 Threat model summary

| Threat | Impact | Mitigation (PROPOSED) |
|---|---|---|
| Message flood by one provisional session | DB write pressure · UX for the (future) NEX-Official reply system | `nex_official_send_followup` limit · 5 per 60 min |
| Many provisional sessions from one IP | Conversation sprawl, resource exhaustion | `nex_official_start_per_ip24` · 50 per 24 h · possible challenge escalation |
| Session hijack across devices | Impersonation of a provisional account | Fingerprint re-check on every follow-up (§4.4) |
| Account-link race | Lost messages or orphan conversations | Adversarial test (§5.3) · `getOrCreatePeerConversation` idempotency |
| Fake-reply disclosure drift | Dishonest UX | Catalogue regression test disallowing vendor/model terms (§3.4) |
| PII leakage via fingerprint | Privacy violation of §7A whitelist | Static test asserting no new fingerprint signal added |
| Launch-flag bypass | Phase 1 commerce boundary breach | Launch-boundary test (§7.3) |

### 7.2 Acceptance criteria for v1 (PROPOSED)

A v1 release is acceptable iff ALL of the following hold:

1. `POST /api/nex-native/nex-official/start` returns `created` for a cold visitor, idempotently returns `existing_session` for a repeat visit.
2. The visitor sees exactly ONE scripted welcome body on first open, matching `renderNex1WelcomeBody` output verbatim.
3. The visitor sends a follow-up; the sealed catalogue auto-reply appears within the same transaction.
4. The visitor sends a 6th follow-up within 60 min; the server returns 429 with the honest "create an account to continue" copy.
5. The visitor refreshes the page; their conversation and all messages are still there.
6. The visitor signs up via the sealed Phase C link path; the NEX-Official conversation + all messages carry over to the real account.
7. An authenticated viewer visiting `/chat/guest/00000000-0000-0000-0000-000000000001` is bumped UP to `/chat/peer/00000000-0000-0000-0000-000000000001` per the sealed guest-chat page rule.
8. No message bypasses the fingerprint re-check (§4.4).
9. No welcome-page tile claims a feature not covered by this contract.
10. The sealed Phase 1 commerce gate is unchanged (unit test asserts `NEX_COMMERCE_ENABLED` default remains `false`).
11. **MANDATORY RELEASE GATE** · the adversarial account-linking race test described in §5.3 passes in CI. The scenario: a visitor opens NEX-Official chat, exchanges N > 1 messages, then signs up (Phase C link path) in another tab while a follow-up message is still in flight. The test asserts: (a) zero messages lost, (b) zero duplicate messages, (c) zero messages misattributed between provisional and real account identities, (d) zero cross-visitor exposure under this transition. **A failure of this test blocks release.**
12. **MANDATORY RELEASE GATE** · the adversarial concurrency test described in §4.1.1 passes within the founder-decided tolerance (D7). Overshoot beyond tolerance blocks release until atomic enforcement is implemented.

### 7.3 Regression matrix (PROPOSED)

- Welcome-honesty test (G1-G7) continues to pass after the welcome page gains a 4th "Chat with NEX" tile. G2's allowlist is updated to include `/nex-native/nex-official` (or whatever the new route is).
- Chat Master Layout `no-reimplementation.test.ts` (sealed) continues to pass — the new surface mounts `<ChatIdentityHeader>` + `<ChatComposerPill>`.
- Bridge 99 end-to-end test (`end-to-end-a2.test.ts` exists at `src/lib/nex-native/first-conversation/__tests__/`) extended with a NEX-Official variant.
- Rate-limit primitive test asserts the new action keys are honoured.
- Catalogue regression test asserts no forbidden phrases.
- Launch-flag test asserts `NEX_COMMERCE_ENABLED` default is `false` and the NEX-Official route does not call `commerceEnabledForRequest`.

### 7.4 Migration implications (PROPOSED)

- **New migration (197+)** · adds `NEX_COMMUNITY_RATE_LIMITS` entries for the 4 new action keys. Actually — the config is a TypeScript constant, not a DB row, so **no DDL migration is needed**. The migration-ish change is a code change to `types.ts`.
- **No new tables.** `nex_community_rate_limit` already supports the new action keys because the `action` column is `text` (needs verification — if there's a CHECK constraint listing current actions, a migration is required to extend it).
- **No change to `nex_account`, `nex_peer_conversation`, `nex_peer_message`, `nex_session_registry`, or `nex_account_risk_signal`.**
- **No interaction with migrations 191–196 (theme commerce).** NEX-Official chat is architecturally orthogonal.

### 7.5 Rollout sequence (PROPOSED · safeguards-first)

**Ordering rule:** safeguards precede replies; replies precede UI; UI precedes end-to-end; end-to-end precedes the welcome tile. Each step has an independent authorisation gate; a failed gate at any step blocks the subsequent steps.

1. **Design review + founder authorisation** of this document.
2. **Rate-limit extension PR** (safeguards · part 1) — add the 4 new action keys to `NEX_COMMUNITY_RATE_LIMITS`. If `nex_community_rate_limit.action` has a CHECK constraint, bundle a migration (197) to extend the enum. Includes the concurrency test proposed in §4.1.1 (criterion #12) — if the test fails, this PR must adopt the advisory-lock or stored-procedure variant before merge.
3. **Follow-up protection PR** (safeguards · part 2) — wrap `sendGuestMessageAction` with the rate-limit + fingerprint re-check WHEN the conversation's peer is NEX1. Non-NEX conversations retain existing behaviour (§4.3 and §5.5 are explicit that the wider sweep is a separate precondition for any wider surface). Includes the §2.5.5 admin/support audit as a release-gating sub-task.
4. **Reply catalogue PR** — add `src/lib/nex-native/nex-official-chat/reply-catalog.ts` + a regression test (including the sealed forbidden-strings guard against vendor/model names). No UI yet. Can be reviewed in isolation.
5. **Start endpoint PR** (guest UI · server surface) — new API route `POST /api/nex-native/nex-official/start`. Reuses Bridge 99 orchestrator with `owner_account_id = NEX1_ID`. Honest privacy-copy strings land here (gated on §5.4 resolution before shipping the 30-day claim).
6. **End-to-end test PR** (release-gating) — the full flow in the isolated schema harness (requires Docker — tracked separately in the theme-commerce workstream). MUST include: criterion #11 account-link race test, criterion #12 concurrency test, cross-visitor isolation test, catalogue honesty test, launch-flag non-regression test.
7. **Welcome page tile PR** — adds the 4th tile pointing at the start endpoint. Updates welcome-honesty test G2 allowlist. **ONLY after step 6 is green AND founder decision D4 confirms wording + position.**
8. **Live rollout** — behind a dark-launch flag, enabled first for internal testers, then widened. Rollback plan per §7.6.

Each PR is reviewable in isolation. Each has its own authorisation gate. The welcome tile (step 7) does not land until end-to-end tests (step 6) are green in CI.

### 7.6 Rollback plan (PROPOSED)

- v1 is additive: a new route + a new tile + 4 new rate-limit action keys. Rollback = revert the PRs in reverse order.
- The sealed Bridge 99 orchestrator is UNCHANGED. All existing surfaces (business cover first-message, authenticated peer chat) continue to work during and after rollback.
- No DB data is at risk during rollback (the new rate-limit action keys would stay in the config but become unused).

### 7.7 Smallest safe first release

Just steps 1–3 of the rollout sequence (design + catalogue + rate-limit extension), WITHOUT any user-facing surface. This proves the primitives work in the harness. The visible NEX-Official chat ships only when steps 4–7 are also authorised + tested.

---

## 8. Separation of verified / proposed / founder-decision

### 8.1 Verified today (inspected source or sealed migrations)

- `nex_account` row for NEX1 at UUID `00000000-0000-0000-0000-000000000001` (migration 084).
- Canonical welcome-body renderer (`src/lib/nex-native/nex-official-welcome.ts`).
- Bridge 99 three-identity resolver (`provisional-session.ts`).
- First-message HTTP contract (`first-message-http.ts` + `first-message-orchestrator.ts`).
- Fingerprint pipeline (`provisional-fingerprint.ts`) with the sealed 5-signal whitelist.
- Risk-service surface (`risk-service.ts`) with sealed §8 boundaries.
- Community rolling-window rate-limit primitive (`rate-limit.ts`) + its config shape.
- Phase 1 commerce launch gate (`launch-flags.ts`).
- Chat primitives (`nex_peer_conversation`, `nex_peer_message`) listed as always-on in launch-flags doctrine.
- Welcome-honesty test guardrail (G1–G7).

### 8.2 Proposed new work (NOT shipped · described in this document)

- `POST /api/nex-native/nex-official/start` endpoint.
- Reply catalogue module (`src/lib/nex-native/nex-official-chat/reply-catalog.ts`).
- 4 new rate-limit action keys with proposed thresholds.
- Fingerprint re-check on follow-up messages addressed to NEX1.
- Honest privacy copy on the NEX-Official chat surface.
- Welcome-page 4th tile pointing at the new endpoint.
- Adversarial tests for message flood, account-link race, launch-flag bypass, catalogue honesty.
- Dark-launch flag for staged rollout.
- Provisional-account retention sweep (30 days · subject to founder decision).

### 8.3 Founder decisions still required

- **D1** · Confirm 30-day retention sweep is the correct dormancy policy (GDPR / dormancy / support-request semantics).
- **D2** · Confirm the four PROPOSED rate-limit thresholds (3/60min start, 5/60min follow-up, 10/24h per-fingerprint, 50/24h per-IP-24).
- **D3** · Confirm no autonomous AI reply in v1 (deterministic catalogue only).
- **D4** · Confirm the welcome-page 4th tile wording and position.
- **D5** · **MANDATORY** · the Phase C account-link race test (§7.2 criterion #11) is a release-blocking gate. Not a recommendation · a bound requirement. A failure blocks release unconditionally.
- **D7** · Confirm the acceptable concurrency overshoot tolerance for §7.2 criterion #12 (zero / small fraction / etc.). Determines whether the first release ships with the sealed `recordIfAllowed` primitive or requires migration to the advisory-lock / stored-procedure variant.
- **D6** · Confirm the follow-up fingerprint re-check applies only to NEX1-targeted conversations in v1 (reducing blast radius) · vs. applying it to all provisional follow-ups (closes G1/G2 globally but is a larger scope).

---

## 9. Cross-reference index

### 9.1 Verified source files (inspected during this design pass)

- `nex-supabase/migrations/084_nex_official_account.sql`
- `src/lib/nex-native/nex-official-welcome.ts`
- `src/lib/nex-native/first-conversation/provisional-session.ts`
- `src/lib/nex-native/first-conversation/provisional-fingerprint.ts`
- `src/lib/nex-native/first-conversation/risk-service.ts`
- `src/lib/nex-native/first-conversation/first-message-http.ts`
- `src/lib/nex-native/community/rate-limit.ts`
- `src/lib/nex-native/community/types.ts` (`NEX_COMMUNITY_RATE_LIMITS`)
- `src/lib/nex-native/launch-flags.ts`
- `src/app/nex-native/chat/guest/[ownerAccountId]/page.tsx`
- `src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts`
- `src/app/nex-native/welcome/page.tsx`
- `src/app/nex-native/welcome/__tests__/welcome-honesty.test.ts`

### 9.2 Verified tests (inspected · referenced for reuse)

- `src/lib/nex-native/first-conversation/__tests__/end-to-end-a2.test.ts`
- `src/lib/nex-native/first-conversation/__tests__/first-message-orchestrator.test.ts`
- `src/lib/nex-native/first-conversation/__tests__/provisional-session.test.ts`
- `src/lib/nex-native/first-conversation/__tests__/risk-service.test.ts`
- `src/lib/nex-native/__tests__/nex-official-welcome.test.ts`
- `src/app/nex-native/welcome/__tests__/welcome-honesty.test.ts`

### 9.3 Companion doctrine notes

- `docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md` (sealed · §7, §7A, §7B, §8)
- `docs/doctrine/nex-arrival-journey-phase-1-2026-10-14.md` (companion to this document)
- `docs/doctrine/nex-theme-commerce-vault-receipt-plan-2026-10-14.md` (unrelated workstream · referenced to show theme commerce is orthogonal)

---

## 10. What this document is NOT

- NOT an authorisation to build anything.
- NOT a change to Bridge 99, launch flags, rate limiting, account linking, authentication, Vault, Hammerex seed, or any migration.
- NOT a claim that NEX-Official chat is implemented, tested, or safe to expose in production.
- NOT a replacement for the required founder decisions D1–D6.
- NOT a security review — §5.5 flags V1/V2/V3 but does not fix them.
- NOT a commitment to the specific numeric thresholds in §4.2 (they are proposals pending D2).

---

## Appendix · one-page summary for review

- NEX1 account exists (migration 084). Use it. Do not invent new identity.
- Welcome page gets a 4th tile: "Chat with NEX" → `POST /api/nex-native/nex-official/start` → provisional conversation with NEX1 → redirect to `/chat/guest/00000000-0000-0000-0000-000000000001`.
- First release has ONE scripted welcome + ONE scripted auto-reply + an honest "create a free account to continue" CTA. No autonomous replies.
- Add 4 new rate-limit action keys to the existing community primitive. No new rate-limit infrastructure.
- Add fingerprint re-check to `sendGuestMessageAction` when the peer is NEX1 (closes gap G2 for the NEX-Official surface only; wider sweep is a separate pass).
- Phase 1 commerce gate is UNCHANGED. NEX-Official chat lives on the chat primitives, which are always-on by sealed doctrine.
- 10 acceptance criteria + 1 regression matrix + 6 founder decisions must be resolved before implementation.
- 8-step rollout: design review → rate-limit extension PR (safeguards) → follow-up protection PR (safeguards) → reply catalogue PR → start endpoint PR → end-to-end test PR (release gate) → welcome tile PR → live rollout. Each is independently reviewable + rollback-safe. The welcome tile does not ship until the e2e release-gating tests are green.
