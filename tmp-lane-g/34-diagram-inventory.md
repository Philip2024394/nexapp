# 34-diagram-inventory.md
# Lane G · Package E · Group-Call-Invite Journey Diagram Inventory
# 2026-11-19 · READ-ONLY evidence pass · SOURCE_INSPECTED ceiling only
# Authorship: coordinator-written from Package E agent reply after
# Explore tool-limit (no Write capability in Explore)
# No browser render executed. No LIVE_VERIFIED claims made.

---

## A. Node Inventory

| # | Label | Type | Source Anchor | Status |
|---|-------|------|---------------|--------|
| N01 | `/nex-native/call/preview?session=&accept=` | ROUTE | `src/app/nex-native/call/preview/page.tsx:184-197` | LIVE |
| N02 | `inviteContactToCallAction` (server action) | ACTION | `src/app/nex-native/call/preview/_invite-actions.ts:20` | LIVE |
| N03 | `inviteToCall()` | SERVICE_FN | `src/lib/nex-native/calls/invite-service.ts:220` | LIVE |
| N04 | `enforceRateLimit()` | SERVICE_FN | `src/lib/nex-native/calls/invite-service.ts:177` | LIVE |
| N05 | `ensureCallInviteAttachmentReady()` | SERVICE_FN | `src/lib/nex-native/calls/invite-service.ts:146` | LIVE |
| N06 | `fetchAccountCallCountry()` (host + invitee) | SERVICE_FN | `src/lib/nex-native/calls/invite-service.ts:63` | LIVE |
| N07 | INSERT `nex_group_call_session` (inviteToCall path) | ACTION | `src/lib/nex-native/calls/invite-service.ts:263-280` | LIVE |
| N08 | INSERT `nex_group_call_participant` (inviteToCall / direct admin) | ACTION | `src/lib/nex-native/calls/invite-service.ts:285-301` | LIVE |
| N09 | `getOrCreateConversation()` | SERVICE_FN | `src/lib/nex-native/calls/invite-service.ts:197` | LIVE |
| N10 | `sendCallInviteNotice()` (via peer-message-service) | SERVICE_FN | `src/lib/nex-native/calls/invite-service.ts:329` | LIVE |
| N11 | `notifyInviteePushNotification()` (fail-soft) | SERVICE_FN | `src/lib/nex-native/calls/invite-service.ts:377` | LIVE |
| N12 | `inviteToCallTransactionalCandidate()` | SERVICE_FN | `src/lib/nex-native/calls/invite-service.transactional-candidate.ts:98` | CANDIDATE_APPLIED_UNWIRED |
| N13 | RPC `nex_invite_to_call_tx` (PL/pgSQL, mig-356) | RPC | `nex-supabase/migrations/356_nex_group_call_invite_v2.sql` | CANDIDATE_APPLIED_UNWIRED |
| N14 | v4 combined RPC body (FOR UPDATE + whitespace guard) | RPC | `nex-supabase/candidate-migrations/CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW.sql` | CANDIDATE_UNAPPLIED |
| N15 | DECISION: `auth.uid()` identity check (RPC path) | DECISION | `nex-supabase/migrations/356_nex_group_call_invite_v2.sql` | CANDIDATE_APPLIED_UNWIRED |
| N16 | `createGroupCallSession()` (host-bootstrap) | SERVICE_FN | `src/lib/nex-native/calls/group-call-service.ts:54` | LIVE |
| N17 | INSERT `nex_group_call_session` (group-call-service path) | ACTION | `src/lib/nex-native/calls/group-call-service.ts:63-76` | LIVE |
| N18 | INSERT `nex_group_call_participant` loop (host + guests) | ACTION | `src/lib/nex-native/calls/group-call-service.ts:102-117` | LIVE |
| N19 | `joinGroupCallSession()` (callee-accept path) | SERVICE_FN | `src/lib/nex-native/calls/group-call-service.ts:152` | LIVE |
| N20 | UPDATE `nex_group_call_participant` (joined_at) | ACTION | `src/lib/nex-native/calls/group-call-service.ts:161-174` | LIVE |
| N21 | INSERT `nex_group_call_participant` fallback (not pre-invited) | ACTION | `src/lib/nex-native/calls/group-call-service.ts:177-195` | LIVE |
| N22 | `promoteSessionToLive()` (ringing→live) | SERVICE_FN | `src/lib/nex-native/calls/group-call-service.ts:199-205` | LIVE |
| N23 | `leaveGroupCallSession()` | SERVICE_FN | `src/lib/nex-native/calls/group-call-service.ts:207` | LIVE |
| N24 | UPDATE `nex_group_call_participant` (left_at) | ACTION | `src/lib/nex-native/calls/group-call-service.ts:211-219` | LIVE |
| N25 | `maybeEndSessionIfAllParticipantsLeft()` | SERVICE_FN | `src/lib/nex-native/calls/group-call-service.ts:231` | LIVE |
| N26 | UPDATE `nex_group_call_session` (state=ended) | ACTION | `src/lib/nex-native/calls/group-call-service.ts:241-245` | LIVE |
| N27 | `acceptInviteOnLoad()` in page (decline/accept branch) | ACTION | `src/app/nex-native/call/preview/page.tsx:199` | LIVE |
| N28 | UPDATE participant (left_at via decline — page direct) | ACTION | `src/app/nex-native/call/preview/page.tsx:234-245` | LIVE |
| N29 | `notifyInviteDeclined()` (fail-soft) | SERVICE_FN | `src/app/nex-native/call/preview/page.tsx:258` | LIVE |
| N30 | TABLE `nex_group_call_session` | TABLE | `nex-supabase/migrations/133_nex_group_call.sql:36-60` | LIVE |
| N31 | TABLE `nex_group_call_participant` | TABLE | `nex-supabase/migrations/133_nex_group_call.sql:61-72` | LIVE |
| N32 | TRIGGER `nex_group_call_participant_cap_tr` (BEFORE INSERT, cap=4) | TRIGGER | `nex-supabase/migrations/133_nex_group_call.sql:99-102` | LIVE |
| N33 | DECISION: cap >= 4? (trigger body) | DECISION | `nex-supabase/migrations/133_nex_group_call.sql:83-97` | LIVE |
| N34 | OUTCOME: `{ ok:true, skipped:"already_invited" }` | OUTCOME | `src/lib/nex-native/calls/invite-service.ts:297-298` | LIVE |
| N35 | OUTCOME: `{ ok:false, error:"participant_insert_failed" }` | OUTCOME | `src/lib/nex-native/calls/invite-service.ts:300` | LIVE |
| N36 | OUTCOME: `{ ok:true, sessionId, participantId, messageId }` | OUTCOME | `src/lib/nex-native/calls/invite-service.ts:388-394` | LIVE |
| N37 | OUTCOME: `rpc_unavailable` fallback signal | OUTCOME | `src/lib/nex-native/calls/invite-service.transactional-candidate.ts:122` | CANDIDATE_APPLIED_UNWIRED |
| N38 | DECISION: feature flag `NEX_INVITE_CALL_TX=1` (planned) | DECISION | `src/lib/nex-native/calls/invite-service.transactional-candidate.ts:18-19` | CANDIDATE_UNAPPLIED |
| N39 | PERFORM FOR UPDATE on `nex_group_call_session` (v4 RPC) | ACTION | `CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW.sql` | CANDIDATE_UNAPPLIED |
| N40 | GB-WHITESPACE POSIX guard (`!~*` pattern check) | DECISION | `CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW.sql` | CANDIDATE_UNAPPLIED |

**Node count: 40**

---

## B. Edge Inventory

| # | From | To | Label | Evidence Class | Source Anchor |
|---|------|----|-------|----------------|---------------|
| E01 | N01 (URL ?accept=1) | N27 | callee accept/decline branch | DASHED_INTENDED | `page.tsx:199-282` |
| E02 | N27 | N20 | UPDATE joined_at on accept | DASHED_INTENDED | `page.tsx:219-245` |
| E03 | N27 | N28 | UPDATE left_at on decline | DASHED_INTENDED | `page.tsx:231` |
| E04 | N27 | N29 | fail-soft decline notice | DASHED_INTENDED | `page.tsx:258` |
| E05 | N27 | N25 | fail-soft session-end check | DASHED_INTENDED | `page.tsx:277` |
| E06 | N25 | N26 | all left → end session | DASHED_INTENDED | `group-call-service.ts:241-245` |
| E07 | N01 (no ?accept) | N02 | user submits invite form | DASHED_INTENDED | `_invite-actions.ts:20-64` |
| E08 | N02 | N03 | delegates to service | DASHED_INTENDED | `_invite-actions.ts:41` |
| E09 | N03 | N04 | rate-limit check | DASHED_INTENDED | `invite-service.ts:240` |
| E10 | N03 | N05 | CHECK probe | DASHED_INTENDED | `invite-service.ts:242` |
| E11 | N03 | N06 | resolve host+invitee country | DASHED_INTENDED | `invite-service.ts:252-253` |
| E12 | N03 | N07 | create new session | DASHED_INTENDED | `invite-service.ts:263-280` |
| E13 | N07 | N30 | INSERT session row | DASHED_INTENDED | `invite-service.ts:263-271` |
| E14 | N03 | N08 | invite participant | DASHED_INTENDED | `invite-service.ts:285-301` |
| E15 | N08 | N31 | INSERT participant row | DASHED_INTENDED | `invite-service.ts:286-293` |
| E16 | N08/N18/N21 | N32 | BEFORE INSERT fires trigger | DASHED_INTENDED | `133_nex_group_call.sql:99-102` |
| E17 | N32 | N33 | count all rows in session | DASHED_INTENDED | `133_nex_group_call.sql:88-91` |
| E18 | N33 (cap exceeded) | N35 | RAISE EXCEPTION → error | DASHED_INTENDED | `133_nex_group_call.sql:92-94` |
| E19 | N33 (cap ok) | RETURN NEW | allow INSERT | DASHED_INTENDED | `133_nex_group_call.sql:95` |
| E20 | N03 | N09 | get/create peer conversation | DASHED_INTENDED | `invite-service.ts:307` |
| E21 | N03 | N10 | send invite message | DASHED_INTENDED | `invite-service.ts:329` |
| E22 | N03 | N11 | fail-soft push | DASHED_INTENDED | `invite-service.ts:377` |
| E23 | N38 (flag, UNAPPLIED) | N12 | route via RPC wrapper | MISSING_IMPLEMENTATION | `invite-service.transactional-candidate.ts:18-20` |
| E24 | N12 | N13 | .rpc() call | MISSING_IMPLEMENTATION | `invite-service.transactional-candidate.ts:102` |
| E25 | N13 | N39 (FOR UPDATE lock) | PERFORM ... FOR UPDATE on session | MISSING_IMPLEMENTATION | `CANDIDATE_v4_combined_PREVIEW.sql` |
| E26 | N13 | N15 | verify auth.uid() | DASHED_INTENDED | `356_nex_group_call_invite_v2.sql` |
| E27 | N13 | N31 | transactional INSERT participant | MISSING_IMPLEMENTATION | `356_nex_group_call_invite_v2.sql` |
| E28 | N16 | N17 | host-bootstrap creates session | DASHED_INTENDED | `group-call-service.ts:63-76` |
| E29 | N16 | N18 | insert host + guests loop | DASHED_INTENDED | `group-call-service.ts:102-117` |
| E30 | N18 | N31 | INSERT row per invitee | DASHED_INTENDED | `group-call-service.ts:103-107` |
| E31 | N19 | N20 | try UPDATE existing row | DASHED_INTENDED | `group-call-service.ts:161-173` |
| E32 | N20 (hit) | N22 | promote ringing→live | DASHED_INTENDED | `group-call-service.ts:172` |
| E33 | N20 (miss) | N21 | row didn't exist → fresh INSERT | DASHED_INTENDED | `group-call-service.ts:177-195` |
| E34 | N21 | N31 | INSERT fresh participant | DASHED_INTENDED | `group-call-service.ts:178-186` |
| E35 | N21 | N22 | promote after fallback insert | DASHED_INTENDED | `group-call-service.ts:194` |
| E36 | N22 | N30 | UPDATE session state=live | DASHED_INTENDED | `group-call-service.ts:200-204` |
| E37 | N23 | N24 | set left_at=now() | DASHED_INTENDED | `group-call-service.ts:211-219` |
| E38 | N23 | N25 | check if session should end | DASHED_INTENDED | `group-call-service.ts:220` |
| E39 | N03 (direct-admin paths) | N32 | trigger fires on direct INSERT | DASHED_INTENDED | `133_nex_group_call.sql:99-102` |
| E40 | N13 (RPC path) | N39 | RPC holds row lock before INSERT | MISSING_IMPLEMENTATION | `CANDIDATE_v4_combined_PREVIEW.sql` |

**Edge count: 40**

---

## C. Proposed Text-Block Diagram (for coordinator integration)

Legend:
  ──>   DASHED_INTENDED (source-inspected; no browser/persistence proof)
  ··>   MISSING_IMPLEMENTATION (node exists but wiring absent/unapplied)
  [GB-4CAP: trigger-only]         direct-admin INSERT paths (N08, N18, N21)
  [GB-4CAP: trigger + FOR UPDATE] RPC v4 path (N39, CANDIDATE UNAPPLIED)
  [GB-WHITESPACE: UNAPPLIED v4]   POSIX guard in v4 combined RPC

(Full ASCII diagram preserved in coordinator's HQ edit at
 src/app/nex-native/hq/journey-map/page.tsx · see §16.45 ledger
 for anchor.)

---

## D. Verification Notes

### Confirmed by file read (SOURCE_INSPECTED)

- N03 / E08–E22: `invite-service.ts` lines 220–394. 4-step write
  sequence confirmed: session INSERT (line 263), participant INSERT
  (line 285), conversation get/create (line 307), sendCallInviteNotice
  (line 329), push (line 377).
- N08 direct-admin INSERT:
  `nexSupabaseAdmin.from("nex_group_call_participant").insert({...})`
  confirmed at line 285–293 with no RPC wrapping.
- N12 / N13 / E23–E24: `invite-service.transactional-candidate.ts`
  lines 1–28. File header: "Production code does NOT import this
  file." Feature flag `NEX_INVITE_CALL_TX=1` is "planned" (line 18).
- N32 trigger: `133_nex_group_call.sql` lines 83–102. `BEFORE INSERT
  ON nex_group_call_participant FOR EACH ROW EXECUTE FUNCTION
  nex_group_call_participant_cap()` confirmed. COUNT(*) counts all
  rows without filtering `left_at`.
- N14 / N39 / N40 (v4 combined): v4 preview lines 1–80. FOR UPDATE
  described inside function body. File clearly labelled "UNAPPLIED ·
  UNASSIGNED NUMBER · PREVIEW-ONLY · DO NOT APPLY" (coordinator
  SHA de77e9a19eb49df85433bf66969b87a44b05885b302a23559e76134b799bfea7).
- N16–N18 host-bootstrap: `group-call-service.ts` lines 50–119.
  INSERT session (line 63), loop INSERT participants (line 102–117),
  `.slice(0,3)` pre-cap at line 90 confirmed.
- N19–N22 callee join: `group-call-service.ts` lines 152–196.
  UPDATE-then-INSERT pattern; fallback INSERT at line 177–186;
  promoteSessionToLive at lines 199–205 confirmed.
- N23–N26 leave / end: `group-call-service.ts` lines 207–247.
  `maybeEndSessionIfAllParticipantsLeft` exported at line 231;
  UPDATE state=ended at lines 241–245 confirmed.
- N27–N29 decline page branch: `page.tsx` lines 199–281. UPDATE
  participant at line 234, `notifyInviteDeclined` at line 258,
  `maybeEndSessionIfAllParticipantsLeft` at line 277 (§16.33 fix)
  confirmed.
- N02 server action: `_invite-actions.ts` lines 1–65.
  `inviteContactToCallAction` delegates to `inviteToCall` at line 41
  confirmed.
- N30 / N31 tables: `133_nex_group_call.sql` lines 36–72. Table
  definitions confirmed.
- N13 mig-356: Package E reports file header states "UNAPPLIED ·
  REVIEW REQUIRED". Coordinator notes §16.39 recorded mig 353
  PROMOTED+APPLIED on sandbox; mig-356 forward-correction status
  per deployed sandbox function definition is NOT inspected this
  batch · diagram shows CANDIDATE_APPLIED_UNWIRED based on prior
  §16.39 evidence.

### Inferred (not directly read line-by-line)

- N38 (feature flag wiring): Flag `NEX_INVITE_CALL_TX=1` documented
  as "planned" in `invite-service.transactional-candidate.ts:18-19`
  but no routing code in `invite-service.ts` reads it. Wiring is an
  intent, not an implementation. Edges E23–E24 marked
  MISSING_IMPLEMENTATION.
- `createGroupCallSession` call-site routes: Coordinator-confirmed
  TWO callers via grep: `free-chat/call/_live-add-to-call-action.ts:70`
  and `chat/peer/[accountId]/_add-to-call-action.ts:55`.
- `joinGroupCallSession` call-site: no live caller grep-confirmed by
  coordinator; MEDIUM severity flag on that writer is theoretical.

### Explicit non-claims

- No BROWSER evidence tier claimed anywhere in this document.
- No LIVE_VERIFIED claims. All behavioral claims rest on reading
  source code (SOURCE_INSPECTED).
- No dev server was started. No SQL was executed. No `.env` was read.
- No application code was modified.

### Load-bearing single fact

The TypeScript feature flag `NEX_INVITE_CALL_TX=1` that would route
`inviteToCall` through `inviteToCallTransactionalCandidate()` to the
RPC `nex_invite_to_call_tx` does not exist as an implemented branch
in any production code path. The transactional wrapper file is
explicitly marked "Production code does NOT import this file."
Consequently, the atomicity + cap-protection fix is fully authored
but completely unwired. All three direct-admin INSERT paths (N08,
N18, N21) are subject only to the trigger cap with no row-level
lock, regardless of whether v4 SQL is applied to the database.
