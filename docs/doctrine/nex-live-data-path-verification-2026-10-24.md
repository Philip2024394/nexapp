# NEX Live · Data-Path Verification · 2026-10-24

**Status: VERIFICATION DOCUMENT · source-level trace only.**
**Does NOT substitute for the real-DB + 2-account browser verification
that remains blocked on sandbox provisioning + auth fixtures.**

This document traces three critical data paths through the actual
code and identifies the exact file+line references for an operator
to review manually. Where a path has a known gap, that gap is called
out explicitly rather than hidden.

---

## Path 1 · Participation materialisation on Live end

### Call chain

| Step | File:line | Behaviour |
|---|---|---|
| 1 · Viewer taps Like/Comment/Share | `src/components/nex-native/live-commerce/LiveViewerFooter.tsx` | Button handler fires |
| 2 · Footer invokes handler prop | `src/app/nex-native/live-commerce/[sessionId]/_viewer-client.tsx:166-172` (like), `190-205` (comment), `210-221` (share) | Dynamic-import of server action |
| 3 · Server action gated | `src/app/nex-native/live-commerce/go-live/_actions.ts:188-220` (`recordLiveEngagementAction`) | Signed-in + UUID shape + evidence-kind consistency checks |
| 4 · Service UPSERTs engagement row | `src/lib/nex-native/live-broadcast/participation-engagement-service.ts:39-69` (`recordEngagement`) | `ON CONFLICT (session_id, viewer_account_id, kind) DO NOTHING` |
| 5 · DB stores row | Migration 222 (unapplied) | `nex_live_engagement` table with partial unique index |
| — — — session continues — — — | | |
| 6 · Broadcaster taps End Live | `_go-live-client.tsx` → `endLiveSessionAction` | Fire-and-await |
| 7 · Server action: end session first | `_actions.ts:98-104` → `endLiveSession` service | Flips `nex_live_session.status = 'ended'` |
| 8 · Aggregate engagement | `_actions.ts:111` → `aggregateEngagementBySession(sessionId)` | Service builds `Map<viewer, Set<kind>>` |
| 9 · Materialise ledger | `_actions.ts:123-137` → `materialiseLiveParticipation` | Inserts one row per identity into `nex_live_participation` with session-end anchor + 16-byte seed |
| 10 · Broadcaster opens Shop Contacts | `/nex-native/manage/live/shop-contacts/[sessionId]/page.tsx` | Reads ledger via `listShopContactsCards` + dedup + shuffle |

### Verified invariants
- **Order of operations** · session ends BEFORE aggregation. Lifecycle test `end session · session end runs BEFORE engagement aggregation (closes write window)` locks this order.
- **RLS enforces this ordering** · the engagement INSERT policy in Migration 222 requires `nex_live_session.status = 'open'` · post-end attempts are rejected at the DB.
- **Idempotent re-end** · a second `endLiveSessionAction` call for the same session is a no-op · the session is already `ended`, aggregation returns the same rows, materialisation UPSERTs via partial unique index. Lifecycle test `end session · ledger write fails · session still ended cleanly` locks fail-closed-on-end + fail-open-on-ledger-write.
- **Zero-engagement path** · materialisation skipped · `materialisedParticipants = 0` · Shop Contacts shows the empty state.

### Known gap · **DB-dependent assertion**
Materialisation path has been tested with mocked Supabase chains
(32 lifecycle tests covering the action layer). The real-DB
assertion that `nex_live_participation` actually contains the rows
after a real session end requires Migration 221 + 222 applied in
sandbox. This is NOT yet verified against Postgres.

---

## Path 2 · Server-validated share evidence

### Call chain

| Step | File:line | Behaviour |
|---|---|---|
| 1 · Viewer taps Share button | `LiveViewerFooter.tsx:63-76` (`handleShareNative`) | Calls `navigator.share({title, url})` |
| 2 · OS share sheet opens | Browser native | — |
| 3a · Success | `LiveViewerFooter.tsx:71-72` → `props.onShareEvidence("native-share")` | Fires evidence |
| 3b · Cancel / permission denied | `LiveViewerFooter.tsx:73-75` → catch block, **no evidence** | Zero DB write |
| 4 · Fallback popover copy-link | `handleCopy` at `LiveViewerFooter.tsx:79-89` | `navigator.clipboard.writeText` success → `onShareEvidence("copy-link")` |
| 5 · Fallback copy-link failure | `LiveViewerFooter.tsx:85-88` → catch, **no evidence** | Zero DB write |
| 6 · Footer bubbles evidence up | prop `onShareEvidence(evidence)` | — |
| 7 · Viewer client records | `_viewer-client.tsx:210-223` → `recordLiveEngagementAction({kind: "share", shareEvidence})` | — |
| 8 · Server action validates | `_actions.ts:194-200` | `share-requires-evidence` if missing · `share-evidence-only-valid-for-share` if non-share kind carries it |
| 9 · Service enforces | `participation-engagement-service.ts:46-50` | Throws on inconsistent `kind` + `shareEvidence` combo |
| 10 · DB CHECK pins values | Migration 222 CHECK | `share_evidence IN ('native-share', 'copy-link', 'chat-send')` |

### Verified invariants (locked by sealed-defaults-invariants.test.ts)
- Cancelled OS share sheet → zero evidence (D2 invariant locks the try/catch pattern).
- Clipboard write failure → zero evidence (same lock).
- Server action rejects spurious `shareEvidence` on non-share kinds.
- DB CHECK pins the exact three allowed values.

### Known gap · **UI copy-and-paste side evidence**
The current share popover offers "Copy link" only. The sealed
third evidence tag `chat-send` (share into an existing NEX chat)
has no UI mount yet · the server + DB accept it, the viewer footer
does not emit it. This is a safe local follow-up that needs an
in-footer "Send in NEX chat" button wired to the existing
contact-picker (reuse pattern).

### Known gap · **document.body.dataset diagnostic**
`_viewer-client.tsx:212-216` sets `document.body.dataset.nexLiveLastShareEvidence`
for Playwright diagnostics. This is NOT persistence · the authoritative
write is step 7+. Removing the dataset write would not change
behaviour. Documented honestly.

---

## Path 3 · Introduction note persistence + delivery

### Call chain · SENDER side (Shop Contacts → createFriendRequestAction)

| Step | File:line | Behaviour |
|---|---|---|
| 1 · Broadcaster taps "Send Invite" | `/manage/live/shop-contacts/[sessionId]/_shop-contacts-card.tsx` | Opens InviteModal |
| 2 · Broadcaster types in NexTextarea | `_shop-contacts-card.tsx` InviteModal → `NexTextarea` | `maxLength={INTRO_NOTE_MAX_LENGTH}` |
| 3 · Submit calls server action | `_shop-contacts-card.tsx` → `createFriendRequestAction(nexHandle, intro)` | — |
| 4 · Action resolves session | `_friend-request-actions.ts:39-57` | Signed-in gate |
| 5 · Service normalises intro | `friend-request-service.ts` `createInvite` | Trim · empty→null · slice at 280 |
| 6 · INSERT with intro_note field | `friend-request-service.ts` insert payload | `intro_note: introNote` always present (null when absent) |
| 7 · DB stores value | Migration 220 (unapplied) | `intro_note text CHECK (len ≤ 280)` |
| 8 · Service returns row | `.select("*").single()` | `FriendRequestRow` includes `intro_note` field |

### Call chain · RECIPIENT side (inbound display + accept)

| Step | File:line | Behaviour |
|---|---|---|
| 9 · Recipient visits `/contacts` | `src/app/nex-native/contacts/page.tsx` → `_pending-invites-section.tsx` | Currently uses `_pending-invites-mock.ts` fixture, NOT the real `listPendingInbound` service call. **GAP** |
| 10 · Would call `listPendingInbound` | `friend-request-service.ts:77` export | Not invoked by the UI today |
| 11 · Would render intro_note | NOT YET IMPLEMENTED on the inbound card | **GAP** |
| 12 · Accept → `acceptFriendRequestAction(reqId, 'business')` | `_friend-request-actions.ts:66-78` | Signed-in gate |
| 13 · Service flips status | `friend-request-service.ts` `acceptInvite` | Status → `accepted`, cooldown stamped |
| 14 · Business-category opens conversation | `friend-request-service.ts` (prior pass) | `getOrCreatePeerConversation(sender, recipient)` fires |
| 15 · Both parties can message | Existing `/nex-native/chat/peer/[accountId]` | — |

### Verified invariants (locked by friend-request-intro-note-persistence.test.ts)
- Guard 1 · INSERT payload always includes `intro_note` key (null when absent).
- Guard 2 · Non-empty note trimmed + persisted verbatim.
- Guard 3 · Round-trip · `.select("*")` surfaces stored value.
- Guard 4 · Whitespace-only → null (never empty string).
- Guard 5 · Compile-time type guard · `FriendRequestRow.intro_note` must exist.

### Known gaps (honest · require follow-up slice)

**G-INTRO-RECIPIENT-UI** · Narrower than previously stated.
Re-trace on 2026-10-24: the `/contacts` inbound card ALREADY renders
a sender-authored note. `_pending-invites-section.tsx:1527,1559`
guards + renders `invite.note` on each inbound invite card. The
`PendingInvite` type already carries `note: string | null` + the
`PendingInviteSeed` type carries `note?: string | null`.

So the UI render capability is **present**. The real gap is purely
the data wiring:
1. `_pending-invites-section.tsx` reads from `_pending-invites-mock.ts`
   seeds; a server wrapper that calls
   `listPendingInbound(recipientAccountId)` must replace the seed
   source. (This is a slice-worth of work · the Contacts page is
   mock-complete per sealed memory 2026-10-23.)
2. In the real-data hydrator, map `FriendRequestRow.intro_note` to
   the `PendingInvite.note` field (shape identical: `string | null`).
3. A regression test proves the mapping (the UI render is already
   proven via source-shape).

The sealed identity-privacy rule (NEX-ID only pre-accept) still
holds — the intro note is sender-authored and the recipient already
knows the sender's NEX-ID at this point, so rendering the note does
NOT leak identity.

**G-INTRO-DB-ROUNDTRIP** · The DB-level round-trip (INSERT then
read-back the same value) is tested with mocks. The real Postgres
assertion that `intro_note` survives after Migration 220 is applied
needs the sandbox.

---

## Cross-cutting · what IS proven vs what is NOT

| Claim | Status | Evidence |
|---|---|---|
| Code path exists end-to-end from Live interaction to Shop Contacts to invite send | ✓ | File:line references above |
| Participation materialisation is wired into `endLiveSessionAction` | ✓ | `_actions.ts:111-137` + 4 lifecycle tests |
| Share evidence trichotomy enforced at every layer | ✓ | 6 lifecycle tests + sealed-defaults-invariants tests |
| Intro note persists through the service layer | ✓ | 6 regression guards + 6 business+intro tests |
| Intro note displays on recipient card | **GAP** | `_pending-invites-section.tsx` uses mock data |
| `chat-send` share evidence has a UI mount | **GAP** | Only copy-link + native-share wired in footer |
| Real-DB enforcement of RLS + CHECK + partial unique indexes | **BLOCKED** | 37 real-DB tests `.skip`'d · needs sandbox |
| Two-account authenticated journey end-to-end | **BLOCKED** | needs auth storage state fixtures (owner-provided) |

---

## Summary · ready-for-sandbox state

The three sealed defaults (D1 comments ephemeral, D2 share-evidence
trichotomy, D3 per-session shuffle seed) are honoured at code level.
The two load-bearing data paths — participation materialisation on
Live end, and introduction note sender-side persistence — are wired
end-to-end at the service + action layer.

Two safe-local gaps remain:
- Recipient-side intro_note UI mount.
- `chat-send` share-evidence UI mount.

Both are additive · neither blocks the sandbox application of
migrations 216–222. Both can be closed in a follow-up slice.

Three infrastructure gates remain BLOCKED on owner action:
- G-DB1 · sandbox provisioning (Docker Desktop start or cloud project).
- G-DB2 · migration apply window authorisation (procedure in
  `nex-live-sandbox-pre-apply-report-2026-10-24.md`).
- G-E2E · two-account auth storage state fixtures.
