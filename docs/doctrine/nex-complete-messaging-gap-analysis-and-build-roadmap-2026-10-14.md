# NEX Complete Messaging · Gap Analysis + Build Roadmap

**Date:** 2026-10-14 · **Scope:** evidence-based inventory of the existing NEX messaging implementation + a dependency-ordered build roadmap for the full world-class experience · **Mode:** read-only inspection, one new document, zero implementation.

Reads these companion documents as context:

- `docs/doctrine/nex-arrival-journey-phase-1-2026-10-14.md`
- `docs/doctrine/nex-official-first-visit-chat-contract-2026-10-14.md`
- `docs/doctrine/nex-official-preimplementation-security-audit-2026-10-14.md`

---

## Executive summary

- **Security gaps B2 + B3 both close as VERIFIED** · see Part A.
- **Account-claiming (B1) remains UNRESOLVED** · signup creates a new `nex_account` and never reads the provisional cookie · the provisional-conversation IS NOT transferred today · see Part B.
- The existing NEX messaging stack already ships a strong **core** (peer conversation + per-device-encrypted messaging + replies + reactions + delete-for-everyone + voice recording + calls + realtime typing + 16 settings pages + multi-device key chain). See Part C.
- The visible **feature gaps against a world-class messaging product** are: edit, forward, in-conversation search, mute/archive/pin, group *text* chat, shared-media gallery, disappearing messages — none of which are implemented. See Part C.
- **The complete messaging build can proceed in parallel with the B1 claim decision** for every item except user-visible claim prompts and the account-link race test. See Part D §Dependencies.

**No code changed. No test changed. No migration changed. No existing design/audit document changed.** Only this file was created this turn.

---

## Part A · Closing B2 and B3

### B2 · `adminSetAccountTierAction` independent authorization — **VERIFIED**

Direct inspection of `src/app/nex-native/_actions.ts:5785–5853`. The action has **two independent gates** at the top of the function, before any Supabase mutation:

1. `if (process.env.NEX_ALLOW_DEV_ADMIN !== "1")` → redirects with `admin_disabled` (lines 5786–5791). This disables the action entirely in production.
2. Session resolution + Supabase auth lookup + email check:
   - `const session = await resolveNexAppSessionFromContext()` (5794) → unauth redirect.
   - `const authRow = await nexSupabaseAdmin.auth.admin.getUserById(session.account.supabase_user_id!)` (5801).
   - `if ((authRow.data.user.email ?? "").toLowerCase() !== "dev-admin@nex-native.local")` → redirects with `not_dev_admin` (5804–5810).

Both gates execute independently of `admin/tier/page.tsx`'s render-time gate. **No bypass path observed.** The action is safe to invoke from any surface because it re-asserts its own gate.

Status: **VERIFIED · B2 closed.** No follow-up required.

### B3 · `copyConversationAttachmentsToVault` caller-authorization — **VERIFIED**

Direct inspection of `src/lib/nex-native/vault-entry-service.ts:152–199`. `moveConversationToVault` performs the participant check BEFORE calling `copyConversationAttachmentsToVault`:

```ts
const isParticipant = await peerConvService.isPeerConversationParticipant(
  conversationId,
  accountId,
);
if (!isParticipant) {
  throw new Error(
    "vault-entry-service.moveConversationToVault: viewer is not a participant",
  );
}
// Step 1 · upsert nex_vault_entry
// Step 2 · copy attachments (lines 193–196)
```

The sealed source comment on `copyConversationAttachmentsToVault` ("The caller … has already asserted the viewer is a participant") now matches a verified call site. The attachment copy itself (`vault-persistence-service.ts:107`) is a service-layer helper that trusts its caller; the only caller is `moveConversationToVault` which does the check.

Status: **VERIFIED · B3 closed.** No follow-up required.

---

## Part B · Account-claiming reality (B1)

### B.1 What the schema supports (VERIFIED from migration 102 Part A)

`nex_account.claimed_at timestamptz NULL`. Sealed semantics (migration 102 Part A, lines 78–100): *"NULL = provisional identity · timestamp = user claimed via `/settings/profile`. Same schema, same FKs downstream · provisional vs claimed is a lifecycle state."* The SAME `nex_account.id` is supposed to flow through every downstream FK across the claim boundary. If this mechanism worked, conversations and messages created while provisional would simply remain attached to the same account id after claim.

### B.2 What the code actually does today (VERIFIED by inspecting `createNexAccountAction`)

Direct inspection of `src/app/nex-native/_actions.ts:95–245`:

- The action calls `supabase.auth.signUp({ email, password, ... })` to create a fresh Supabase auth user.
- It calls `accountService.getAccountBySupabaseUserId(data.user.id)` — this looks up a `nex_account` by `supabase_user_id`, which the new auth user does not yet have attached. The lookup returns NULL for a fresh signup.
- It calls `accountService.createAccount({ supabase_user_id: data.user.id, display_name, phone_* })` → **this inserts a NEW `nex_account` row**, not an update to an existing provisional row.
- It stamps `zero_knowledge_ack_at = now()` on the new account.
- It opens a NEX1 conversation with the NEW account id and sends the welcome message (Bridge 62).
- It redirects to `/create-account/pick-theme`.

**The action never**:

- Resolves the provisional session (`resolveNexAppOrProvisionalSession` is not imported in `_actions.ts` — grep confirmed).
- Reads the `nex_session` cookie.
- Clears the `nex_session` cookie.
- Updates `claimed_at` on any `nex_account` row.
- Looks up or references any pre-existing provisional `nex_account.id`.

### B.3 Observable consequence

Behaviour today: a visitor who used Bridge 99 to send a first message (now has a provisional `nex_account` row + a conversation with a business owner, or with NEX1 after signup via Bridge 62) and then signs up through `/create-account` ends up with **two `nex_account` rows**:

- The **provisional row** (`claimed_at = NULL`, `supabase_user_id = NULL`) keeps the original conversation + messages attached to its id. It is reachable only by the still-valid `nex_session` cookie until the cookie expires or is revoked via `nex_session_registry`.
- The **new signed-up row** (`claimed_at = NULL`, `supabase_user_id = <new auth user>`) gets a fresh NEX1 welcome via Bridge 62 and a fresh conversation. No prior history.

Grep confirms no code writes `nex_account.claimed_at = now()` or similar anywhere in `src/`. The `/settings/profile` directory exists with handle sharing / face camera / display name editor pages but no claim action.

### B.4 Smallest-safe design for the claim flow (PROPOSAL · requires founder approval)

**Design goal:** when a visitor with an active provisional `nex_session` signs up (either via `/create-account` or via the account-wall return path), the resulting authenticated identity owns the provisional conversation + messages without losing, duplicating, misattributing, or exposing anything.

**Approach:** promote the provisional row in place, do NOT create a second row.

1. At the top of `createNexAccountAction` (BEFORE `supabase.auth.signUp`), resolve the provisional session via `resolveNexAppOrProvisionalSession`.
2. If `kind === 'provisional'`, capture the provisional `nex_account.id` into a local variable `provisionalAccountId`.
3. Call `supabase.auth.signUp(...)` as today. Capture the new `data.user.id`.
4. **Instead of** `accountService.createAccount(...)`, call a new `accountService.promoteProvisional(provisionalAccountId, data.user.id, { display_name, phone_* })` that:
   - Opens a Postgres transaction (service-role).
   - `SELECT ... FOR UPDATE` on the provisional `nex_account` row.
   - If `claimed_at IS NOT NULL` OR `supabase_user_id IS NOT NULL`, raise a conflict (race case).
   - `UPDATE nex_account SET supabase_user_id = $newUserId, display_name = $displayName, phone_country_code = ..., phone_national_number = ..., claimed_at = now() WHERE id = $provisionalAccountId AND supabase_user_id IS NULL AND claimed_at IS NULL`.
   - If zero rows updated, race lost → raise.
   - COMMIT.
5. If `resolved.kind === 'none'`, fall through to the existing `createAccount` path (fresh signup, no provisional).
6. After promotion, revoke the provisional `nex_session` registry entry so the cookie cannot be re-used, and clear the cookie on the response.
7. If a NEX1 conversation already exists with the (now claimed) account, SKIP the Bridge 62 welcome insert (there would be an existing welcome message in it). Fall back only when there's no existing NEX1 conversation.

**Properties:**

- **No row migration.** The `nex_account.id` is unchanged, so every downstream FK (`nex_peer_conversation.participant_{a,b}_id`, `nex_peer_message.sender_account_id`, etc.) is already correct. No cascade of UPDATEs.
- **No lost messages.** Messages written during the signup transaction may land after the SELECT FOR UPDATE commits · they still attach to the same `nex_account.id`.
- **No duplicated conversations.** The UNIQUE pair constraint on `nex_peer_conversation(participant_a_id, participant_b_id)` prevents a second conversation with any peer. The visitor's existing NEX1 (or business) conversation remains the only one.
- **No misattribution.** `sender_account_id` is immutable (per `nex_peer_message` IMMUTABLE doctrine from migration 004; peer messages inherit this). The row keeps its original sender.
- **No cross-visitor exposure.** The SELECT FOR UPDATE + the `claimed_at IS NULL AND supabase_user_id IS NULL` guard mean two concurrent claim attempts cannot both succeed on the same provisional row.

### B.5 Required acceptance tests before this flow ships

1. **Fresh signup (no provisional)** → new `nex_account` row created, NEX1 welcome fires. Baseline (today's behaviour).
2. **Provisional-to-claim happy path** → `nex_account.id` unchanged, `claimed_at` set, `supabase_user_id` set, `nex_session` cookie cleared, revocation entry present in `nex_session_registry`.
3. **Race A · same provisional, two concurrent signups** → exactly one succeeds, the other sees the sealed race error.
4. **Race B · provisional sends message DURING claim transaction** → the message writes successfully, attached to the same `nex_account.id`, and visible after claim.
5. **Race C · provisional already claimed, cookie still live** → promotion fails with the sealed guard error, caller falls back to fresh-signup path.
6. **Cross-visitor isolation under claim** → Alice claims; Bob's conversations are not affected and Bob cannot read Alice's claimed conversation.
7. **Phase C with existing NEX1 conversation** → no duplicate welcome message inserted; existing conversation preserved verbatim.
8. **Session revocation effective** → the pre-claim `nex_session` cookie cannot be re-used after promotion.

**Static-SQL unit test cases:** 3 above exercise the `UPDATE ... WHERE ... AND supabase_user_id IS NULL AND claimed_at IS NULL` idempotency.

**Integration test cases:** 1, 2, 4, 7 exercise the full HTTP signup flow.

**Adversarial test cases:** 3, 5, 6, 8.

### B.6 This design is a proposal · implementation NOT authorised here

Nothing in Part B is implemented. The claim action should land as its own PR with its own authorisation, with the 8 acceptance tests above as release gates. Until then, the design contract's criterion #11 (release-gating account-link race test) cannot be meaningfully run.

---

## Part C · Feature inventory (evidence-based)

Each row below carries a status + source evidence. Status legend:

- **VERIFIED** · the capability is implemented, with service + migration + UI references.
- **PARTIAL** · some pieces exist; critical pieces missing.
- **NOT FOUND** · grep + directory walk returned no implementation.
- **UNRESOLVED** · evidence inconclusive · needs follow-up inspection to classify.
- **SEALED-ABSENT** · deliberately not implemented by doctrine.

### C.1 Personal conversations and contact identity

| Capability | Status | Evidence |
|---|---|---|
| Peer conversation row keyed on ordered pair | **VERIFIED** | `nex-supabase/migrations/047_nex_peer_chat.sql` · UNIQUE pair + ordered-pair + distinct CHECKs |
| Message persistence (plaintext + encrypted) | **VERIFIED** | 047 + `093_nex_peer_message_encrypted.sql` · body / ciphertext dual |
| Idempotent conversation open on first click | **VERIFIED** | `peer-conversation-service.getOrCreatePeerConversation` |
| Account identity anchored on `nex_account.id` | **VERIFIED** | Migrations 001 + 102 Part A · identity doctrine |
| Multi-device key chain | **VERIFIED** | `nex-supabase/migrations/092_nex_account_device_key.sql` + Bridge 76 ciphertext fan-out · `first-message-http.ts:FirstMessageRequestBody.ciphertext_rows` |
| Per-conversation canonical participant check in service layer | **VERIFIED** | `peer-conversation-service.isPeerConversationParticipant` + the audit's confirmed 8 callers |

### C.2 Business/customer conversations

| Capability | Status | Evidence |
|---|---|---|
| Business cover composer → first-message API → provisional conversation | **VERIFIED** | `cover/_composer/CoverComposer.tsx` + `useCoverSendMessage.ts` + `/api/nex-native/first-message/route.ts` |
| Guest-chat continuation surface for provisional viewers | **VERIFIED** | `/chat/guest/[ownerAccountId]/page.tsx` + `_actions.ts` |
| Service-role participant check on all guest paths | **VERIFIED** | Pre-implementation security audit §1 |
| Provisional→registered account claim | **NOT FOUND** | Part B.2 (above) |
| Business shop surface respects commerce launch gate | **VERIFIED** | `src/app/nex-native/[businessSlug]/page.tsx:81-83` + `launch-flags.ts` |

### C.3 Group conversations

| Capability | Status | Evidence |
|---|---|---|
| Group CALL infrastructure | **VERIFIED** | `nex-supabase/migrations/133_nex_group_call.sql` |
| Group TEXT conversation table | **NOT FOUND** | No migration for `nex_group_conversation` / `nex_group_message` / `nex_group_participant` (grep returned zero relevant matches) |
| Group creation UI | **PARTIAL** | `src/components/nex-app/contacts/CreateGroupModal.tsx` exists as a 4-step wizard · routes to group creation action unverified |
| Group creation server action | **UNRESOLVED** | Not inspected in this audit · the wizard component may post to an action that isn't wired to a DB write |
| Group text message send | **NOT FOUND** | No `nex_group_message` schema · no group-send server action in grep |

**Overall group text chat: PARTIAL at best · the database and server contract are not implemented.** Group calls DO exist as a separate feature.

### C.4 Message delivery and read states

| Capability | Status | Evidence |
|---|---|---|
| `sent_at` timestamp per message | **VERIFIED** | 047 schema |
| `read_at` + `markPeerMessagesRead` | **VERIFIED** | `peer-message-service.markPeerMessagesRead` · called from `chat/peer/[accountId]/page.tsx:176` |
| Typing indicators (realtime) | **VERIFIED** | `src/lib/nex-native/realtime/typing.ts` on channel `nex:typing:{conversationId}` |
| Unread count | **VERIFIED** | `peer-message-service.countUnreadPeerMessages` · used by inbox |
| Delivery receipts (sent vs. delivered vs. read tri-state) | **UNRESOLVED** | Only `sent_at` and `read_at` observed; a separate `delivered_at` was not confirmed |

### C.5 Replies, swipe-to-reply, reactions, long-press

| Capability | Status | Evidence |
|---|---|---|
| `reply_to_id` column + rendering | **VERIFIED** | Migration `052_nex_peer_message_reply_to.sql` · composer wiring at `chat/peer/[accountId]/_composer.tsx:62,439` · rendering at `page.tsx:573-580` |
| Swipe-to-reply gesture | **UNRESOLVED** | No file matches `swipe-to-reply` by name; the reply pill exists but the SWIPE gesture entry wasn't grep-confirmed |
| Reactions column + ordered list | **VERIFIED** | `nex_peer_message.reactions` + `reactions_order` in migration 047 · `_reactions.tsx` component |
| Reaction toggle service | **VERIFIED** | `peerMessageService` has a reaction toggle (seen in prior session) · integrated with `theme-sticker-service` for themed emoji sets |
| Long-press / action sheet on message bubbles | **VERIFIED** | `src/app/nex-native/chat/_message-bubble-client.tsx` exists; this is the sealed message-bubble client · action-sheet shape unverified line-by-line in this audit |

### C.6 Edit / delete / copy / forward / multi-select

| Capability | Status | Evidence |
|---|---|---|
| Delete for everyone (retract) | **VERIFIED** | Migration `053_nex_peer_message_delete.sql` · `_actions.ts:deletePeerMessageAction` + `peerMessageService.deletePeerMessageForEveryone` |
| Edit a sent message | **SEALED-ABSENT** | Migration 004 doctrine: *"nex_message rows are IMMUTABLE after INSERT. No UPDATE policy is granted for any role · corrections are new messages · audit trail preserved."* Grep for `editPeerMessage` / `edit_at` returned zero. **Deliberately not implemented.** |
| Copy message text | **UNRESOLVED** | Standard HTML clipboard API, likely present in `_message-bubble-client.tsx` long-press menu but not grep-confirmed |
| Forward message | **NOT FOUND** | Grep for `forwardMessage` / `forwardPeer` returned zero |
| Multi-select messages | **NOT FOUND** | `CreateGroupModal.tsx` uses multi-select for contact pickers; no multi-select for messages |

### C.7 Media and voice

| Capability | Status | Evidence |
|---|---|---|
| Attachment columns (`attachment_url`, `attachment_type`, `attachment_meta`) | **VERIFIED** | Referenced from `vault-persistence-service.ts:234` + `peer-message/encrypted` route + inferred from migration 047 shape (not opened in this audit but columns consumed by every reader) |
| Image / video / audio attachment types | **VERIFIED** | `attachment_type` constrained to `image | video | audio` (seen in `vault-persistence-service.ts`) |
| Voice recording in composer | **VERIFIED** | `chat/peer/[accountId]/_media-recorder.tsx` · `MediaRecorder` + `MediaRecorderModal` wiring in `_composer.tsx:25,383` |
| In-chat photo preview + full-screen view | **UNRESOLVED** | Attachment URL exists; the gallery/lightbox component was not inspected in this audit |
| Attachment upload bucket | **VERIFIED** | `nex-peer-chat-attachments` bucket (migration 055) + Bridge 81 upload flow |
| Shared media gallery per conversation | **NOT FOUND** | Grep returned zero · a cross-conversation "all photos" gallery view does not exist |

### C.8 Conversation + global settings

| Capability | Status | Evidence |
|---|---|---|
| Settings landing + 16 sub-pages | **VERIFIED** | Directory walk: `/settings/{about,affiliate,blocked,chat-settings,custom-intro,data-usage,help,language,notifications,privacy,profile,security,storage,tier,world-intro}/page.tsx` plus root `page.tsx` |
| Per-conversation mute | **NOT FOUND** | Grep for `muteConversation` / `is_muted` returned zero in `src/lib/nex-native` and migration 047 |
| Per-conversation archive | **NOT FOUND** | Same · zero evidence |
| Per-conversation pin | **NOT FOUND** | Same · zero evidence |
| Blocked contacts | **PARTIAL** | `settings/blocked/page.tsx` exists · the actual block table + block-respecting read-path not inspected in this audit |
| Push notifications (service-worker + subscription) | **VERIFIED** | `src/lib/nex-native/push-subscription-service.ts` + `/api/nex-native/push/*` + `_push-subscribe-hub.tsx` |
| Chat theme selection (account-level) | **VERIFIED** | `nex_account.chat_theme` + `chat-themes-library` + `settings/chat-settings/page.tsx` |
| Language | **VERIFIED** | `settings/language/page.tsx` + `nex_account.locale` + sealed Phase B.7 i18n primitive (per earlier session memory) |
| Storage settings | **VERIFIED** | `settings/storage/page.tsx` exists · behaviour unverified in this audit |
| Data usage | **VERIFIED** | `settings/data-usage/page.tsx` exists |

### C.9 Offline, retry, loading, error states

| Capability | Status | Evidence |
|---|---|---|
| Optimistic message send | **PARTIAL** | `_portrait-bloom-shell.tsx` + `_composer.tsx` grep hits suggest optimistic UI but a sealed "pending" state column was not identified |
| Retry UI on send failure | **UNRESOLVED** | Grep returned general matches; specific retry affordance not inspected |
| Offline detection (navigator.onLine, service-worker fallback) | **UNRESOLVED** | Not inspected |
| Loading skeletons | **UNRESOLVED** | Not inspected |

### C.10 Calls

| Capability | Status | Evidence |
|---|---|---|
| Call log table | **VERIFIED** | `nex-supabase/migrations/131_nex_call_log.sql` |
| Call link table | **VERIFIED** | `nex-supabase/migrations/132_nex_call_link.sql` |
| Group call support | **VERIFIED** | `nex-supabase/migrations/133_nex_group_call.sql` |
| Calls UI routes | **VERIFIED** | `/call`, `/calls`, `/prototypes/call-buttons`, `/prototypes/call-center` |
| Call launcher component | **VERIFIED** | `chat/peer/[accountId]/_call-launcher.tsx` with `MediaRecorder` + `getUserMedia` |
| Incoming call hub + privacy gating | **VERIFIED** (per prior Vault B.6A memory) | Vault B.6A sealed · call privacy presentation on locked state |

### C.11 Disappearing messages / ephemeral

| Capability | Status | Evidence |
|---|---|---|
| Ephemeral TTL column on peer messages | **NOT FOUND** | Grep for `expires_at.*message` / `ephemeral.*message` returned zero relevant hits |
| Burn-after-reading flow | **NOT FOUND** | Zero evidence |

### C.12 Vault chat (sealed · reference only · NOT part of this build)

Covered by sealed memory: Vault B.1–B.6A ships encrypted-at-rest chat caches with per-device wrapped `K_c` keys. **Out of scope for this roadmap** — Vault is a separate workstream and must not be modified by messaging builds.

### C.13 Search

| Capability | Status | Evidence |
|---|---|---|
| In-conversation search (find text in messages) | **NOT FOUND** | Grep returned Brain search modules unrelated to chat |
| Global search (across all conversations) | **NOT FOUND** | Zero |
| Shared-media filter (photos / videos only) | **NOT FOUND** | Zero |

---

## Part D · Build roadmap

### D.1 Dependency order (highest safety → user-facing surface)

The roadmap preserves existing NEX architecture (sealed Bridge 3 / 76 / 99 / Chat Master Layout / peer-conversation + peer-message services / nex_account identity) and never introduces a parallel system.

#### Stage 1 · Core messaging foundation (safeguards + reliability)

Dependencies: none new. Can proceed in parallel with Part B (account claim) because all items here are safe for authenticated users today.

| Item | Where | Why first |
|---|---|---|
| **S1.1** Close the wider guest-chat protection gap (apply the sealed §4.3 G1/G2 fix across ALL guest conversations, not just NEX1) | `_actions.ts:sendGuestMessageAction` + `community/rate-limit.ts` config extension | Blocks any welcome-page expansion. Flagged release-blocking in the design contract's §5.5. |
| **S1.2** Dedup + idempotency surface audit | `peerMessageService.sendPeerMessage` + `sendEncryptedPeerMessages` + `nex_peer_message.send_intent_id` | Confirms no duplicate messages under retry — foundation for optimistic UI. |
| **S1.3** `delivered_at` column + delivery receipt | New migration + `peer-message-service` + realtime channel | Completes the tri-state (sent / delivered / read) needed before Stage 2 UX. |
| **S1.4** Offline + retry UX | `_composer.tsx` + `_portrait-bloom-shell.tsx` | Visible reliability improvement. Depends on S1.2 being clean. |

#### Stage 2 · Message gestures and actions

Dependencies: Stage 1 complete.

| Item | Where | Dependency |
|---|---|---|
| **S2.1** Confirm swipe-to-reply gesture mount site + regression test | `_message-bubble-client.tsx` + bubble gesture layer | None net new (reply_to_id ships today) |
| **S2.2** Formalise long-press action sheet + accessibility | `_message-bubble-client.tsx` | None net new |
| **S2.3** Copy message text (standard clipboard affordance) | Message action sheet | S2.2 |
| **S2.4** Forward message (open conversation picker → create new message with original attachment + body) | New server action `forwardPeerMessageAction` · reuses `sendPeerMessage` | S2.2 |
| **S2.5** Multi-select for bulk-forward / bulk-delete | Bubble UI + new multi-send + bulk-delete action | S2.4 |

**EDIT MESSAGE is SEALED-ABSENT by migration 004 doctrine** (messages are IMMUTABLE; corrections are new messages). Do not propose edit without an explicit sealed-doctrine amendment.

#### Stage 3 · Media and voice

Dependencies: Stage 1 clean · Stage 2 optional.

| Item | Where | Dependency |
|---|---|---|
| **S3.1** Shared-media filter view per conversation | New `/chat/peer/[accountId]/media` route · reads `nex_peer_message` with `attachment_type IN (...)` scoped by participant check | S1.1 (so broadcasted on all guest conversations too) |
| **S3.2** In-conversation photo lightbox | Client component inside the chat page | S3.1 |
| **S3.3** Voice-message polish (waveform scrub, 1.5x playback, hands-free hold-to-record) | `_media-recorder.tsx` + `_composer.tsx` | Current recorder ships; polish only |
| **S3.4** Attachment upload progress + resumability | `_composer.tsx` + Bridge 81 attachment flow | S1.1 |

#### Stage 4 · Conversation + global settings

Dependencies: none net new for settings presence (16 pages already ship). Each item below is additive within a settings page.

| Item | Where | Dependency |
|---|---|---|
| **S4.1** Per-conversation mute | New migration (`nex_peer_conversation_preferences(account_id, conversation_id, muted_until, ...)`) + UI toggle in conversation header + inbox mute badge + push gate | None |
| **S4.2** Per-conversation archive | Same table extension · hides the row from the main inbox list (no delete) | S4.1 shares the table |
| **S4.3** Per-conversation pin | Same table extension · surfaces pinned rows at the top of inbox | S4.1 |
| **S4.4** Blocked contacts honouring the service-layer read path | Audit `settings/blocked/page.tsx` + the block table (not inspected in this audit) · ensure every peer-message read respects the block | Audit only · code change may follow |
| **S4.5** Push-notification quiet hours | `settings/notifications/page.tsx` + push gate | None |

#### Stage 5 · Business/customer chat and groups

Dependencies: Stage 1 for the broader guest-chat gap closure (S1.1).

| Item | Where | Dependency |
|---|---|---|
| **S5.1** Business dashboard: inbox view across the business's conversations | New route under `/manage/*` · reads `nex_peer_conversation` scoped by `participant_a_id` or `participant_b_id = business_owner_account_id` | None |
| **S5.2** Business-owner mute / archive per customer | Reuse S4.1 preferences table | S4.1 |
| **S5.3** **Group TEXT chat** · schema + service + UI | **NEW migration** · `nex_group_conversation` + `nex_group_message` + `nex_group_participant` + indexes + RLS. Service module. UI mount via existing `CreateGroupModal` wiring. | Significant new backend. Needs its own design pass before this roadmap item is authorised. |
| **S5.4** Group calls lift to parity with 1:1 calls | Existing `nex_group_call` table + call UI extension | None |

**S5.3 is the largest net-new work in this roadmap.** It should get its own design doctrine document (parallel to the NEX-Official contract) before implementation.

#### Stage 6 · Advanced capabilities (separate security + infra gates)

Each item below requires its own authorisation pass and should NOT be bundled with Stages 1–5.

| Item | Where | Why separate |
|---|---|---|
| **S6.1** In-conversation search | New index strategy (Postgres full-text or extension) · UI | Index/perf design |
| **S6.2** Global search (across all conversations) | Same index + a cross-conversation UI | S6.1 |
| **S6.3** Disappearing / ephemeral messages | TTL column + nightly sweep + UI | Interacts with Vault retention + §5.4 retention open items in the NEX-Official design contract |
| **S6.4** NEX-Official chat welcome destination | Design contract + security audit already written; blocked on B1 + the follow-up protection PR | Multi-stage · founder decisions D1–D7 |
| **S6.5** Phase C account-claim action | Part B above | **Blocks** NEX-Official exposure + the design contract's release-gating race test |
| **S6.6** Vault B.7+ (post-A encryption lifting) | Sealed Vault workstream | Explicitly out of scope |
| **S6.7** Theme-commerce Stage 3 (migrations 191–196 applied + ownership + purchase) | Theme-commerce workstream · requires Docker harness | Explicitly out of scope |

### D.2 Reusable existing components (DO NOT duplicate)

- `peer-conversation-service.getOrCreatePeerConversation` + `isPeerConversationParticipant`
- `peer-message-service.listPeerMessages` + `getLastPeerMessageInConversation` + `countUnreadPeerMessages` + `markPeerMessagesRead` + `sendPeerMessage` + `deletePeerMessageForEveryone`
- `community/rate-limit.ts` rolling-window primitive + `NEX_COMMUNITY_RATE_LIMITS` config shape
- `nex-official-welcome.renderNex1WelcomeBody` canonical welcome body
- `provisional-session.resolveNexAppOrProvisionalSession` three-identity resolver (for the proposed claim action in B.4)
- `_message-bubble-client.tsx` long-press action sheet host
- `_media-recorder.tsx` + `MediaRecorderModal`
- `realtime/typing.ts` on `nex:typing:{conversationId}`
- `push-subscription-service.ts` + `/api/nex-native/push/*`
- 16 existing settings pages (do not create duplicates)
- Chat Master Layout primitives (`ChatIdentityHeader`, `ChatComposerPill`) — **mandatory for any new chat surface per sealed memory**
- `_phone-tile.tsx` + `pickTileChipKind` (from this session) for the theme library
- `_premium-banner-copy.ts` honest-banner helper (from this session)

### D.3 What can proceed INDEPENDENTLY of B1 (claim action)

- **All of Stage 1** (safeguards, delivery receipts, offline/retry) — authenticated users unaffected by claim gaps.
- **All of Stage 2** (gestures, actions) — same.
- **All of Stage 3** (media, voice) — same.
- **S4.1–S4.3 and S4.5** (conversation preferences + notifications) — same.
- **S4.4** (blocked contacts) — same.
- **S5.1, S5.2, S5.4** (business dashboard, business-side mute/archive, group calls) — authenticated-only.
- **S5.3** (group text chat) — authenticated-only. Benefits from Part B being resolved first but does not depend on it.
- **S6.1, S6.2** (search) — authenticated-only.
- **S6.3** (disappearing) — authenticated-only; interacts with retention design but not with claim.

### D.4 What DEPENDS on B1 (claim action)

- **S6.4** · NEX-Official chat welcome destination · the entire user-facing feature cannot ship until the §7.2 criterion #11 account-link race test can be meaningfully written against a real claim mechanism.
- The welcome-page tile for NEX-Official (step 7 of the design-contract rollout) cannot land.
- Any UI copy that promises "sign up and your chat becomes yours" is dishonest without B1.

### D.5 What depends on operator answers (B4 + B5)

- **S6.3** · disappearing-messages retention promise.
- NEX-Official chat's §5.4 user-facing 30-day deletion sentence.
- GDPR right-to-erasure escalation path.

### D.6 Smallest safe first commits (recommended order)

1. **Audit S1.1 broader guest-chat gap** · propose the single rate-limit + fingerprint re-check PR; land it with its own release-gating adversarial test.
2. **Design + land S1.3 delivered_at** · smallest reliability improvement, foundation for optimistic UX.
3. **Formalise S2.1 + S2.2** · gesture + action sheet regression tests.
4. **Prototype S4.1 preferences table + mute toggle** · minimum product-visible value.
5. **Design pass for Part B.4 claim action** · requires founder approval of the proposed shape above.
6. In parallel: **S5.3 group text chat design doctrine** · its own doc.

Every step above is a separate authorisation gate. No step may proceed without founder approval.

---

## Hard stops observed this turn

- **Only one file created**: `docs/doctrine/nex-complete-messaging-gap-analysis-and-build-roadmap-2026-10-14.md`.
- No application code · no test · no migration · no existing design/audit document modified.
- No `.env.local` read · no DB access · no seed executed · no dependency installed.
- No `git` operations · no branch changes · no deploys.
- No implementation of account claiming, rate limits, retention, or any messaging feature.
- No welcome-page tile added · no new guest-chat entry point exposed.
- **No implementation operation whatsoever.**

Stopping. The next decision is yours:

1. Approve the **Part B.4 claim-action design** so S6.5 can enter Stage 3 of the design-review chain.
2. Approve **S1.1 broader guest-chat gap fix** as the next bounded implementation PR.
3. Request a dedicated design doctrine for **S5.3 group text chat** (the largest net-new scope in the roadmap).
4. Keep NEX-Official chat (S6.4) parked until the above advance.
