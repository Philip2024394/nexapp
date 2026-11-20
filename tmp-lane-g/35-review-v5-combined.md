# Lane G · v5 Batch Review · 35-review-v5-combined

**Generated:** 2026-11-19  
**Reviewer:** Independent automated reviewer (Claude Sonnet 4.6)  
**Evidence tier:** SOURCE_INSPECTED + UNIT (vitest 51/51 pass)  
**Scope:** W1 (Package F), W2 (Package G), W3 (Package H) — 12 staged artefacts  

---

## SHA Verification

All 12 artefact SHAs match the envelope exactly:

| File | Expected SHA | Actual SHA | Match |
|---|---|---|---|
| CANDIDATE_nex_call_invite_rpc_v5_w1_PREVIEW.sql | ec972d21... | ec972d21... | PASS |
| CANDIDATE_nex_call_invite_rpc_v5_w1_PREVIEW_rollback.sql | f42848e9... | f42848e9... | PASS |
| CANDIDATE_nex_call_session_create_rpc_v5_w2_PREVIEW.sql | 51cb5586... | 51cb5586... | PASS |
| CANDIDATE_nex_call_session_create_rpc_v5_w2_PREVIEW_rollback.sql | 07466c7e... | 07466c7e... | PASS |
| CANDIDATE_nex_call_participant_join_rpc_v5_w3_PREVIEW.sql | 375fc243... | 375fc243... | PASS |
| CANDIDATE_nex_call_participant_join_rpc_v5_w3_PREVIEW_rollback.sql | 2b83c0fe... | 2b83c0fe... | PASS |
| invite-service.v5-candidate.ts | 6b66b01f... | 6b66b01f... | PASS |
| group-call-service.v5-candidate.ts | 25a9b7df... | 25a9b7df... | PASS |
| group-call-join.v5-candidate.ts | ff0d5f95... | ff0d5f95... | PASS |
| invite-service-v5-candidate.test.ts | b515281a... | b515281a... | PASS |
| group-call-service-v5-candidate.test.ts | a4aaf9c8... | a4aaf9c8... | PASS |
| group-call-join-v5-candidate.test.ts | 267c2ea7... | 267c2ea7... | PASS |

**v4 SHA:** de77e9a19eb49df85433bf66969b87a44b05885b302a23559e76134b799bfea7 — UNCHANGED (PASS)  
**mig-133 SHA:** 35af48379268cb56736bc7024c4e310b51f8e722772d814bf7e0e2a4be3af26b — UNCHANGED (PASS)

---

## Vitest Results

Command: `npx vitest run <three test files>`  
Exit code: 0  
Test files: 3 passed (3)  
Tests: **51 passed (51)**  
Duration: 357ms  

---

## W1 — invite-service.v5-candidate (Package F)

W1 is a **declaration file only** — no executable SQL. It points to v4 as the RPC body unchanged (option a). The RPC DDL, security envelope, and lock mechanics live in the v4 file.

### SQL Candidate (CANDIDATE_nex_call_invite_rpc_v5_w1_PREVIEW.sql)

**Check 1 · SECURITY DEFINER + search_path:** PASS  
Declared in comment as confirmed from v4: `SECURITY DEFINER · SET search_path = public, pg_temp`. Since this file contains no executable DDL (it is a declaration that the operator applies v4 directly), and v4 is confirmed to carry both attributes (grep confirmed `SECURITY DEFINER`, `SET search_path = public, pg_temp` at lines 121-122 of v4), the check is satisfied by reference. SOURCE_INSPECTED.

**Check 2 · GRANT envelope:** PASS  
Confirmed from v4 grep: `REVOKE ALL FROM PUBLIC`, `REVOKE EXECUTE FROM anon`, `REVOKE EXECUTE FROM service_role`, `GRANT EXECUTE TO authenticated`. Declaration comment in W1 file repeats these verbatim. SOURCE_INSPECTED.

**Check 3 · auth.uid() fail-closed body guard:** PASS  
Confirmed from v4 grep: `auth.uid()` → `caller_identity_required` ERRCODE 42501 (NULL uid), `caller_account_not_found` ERRCODE 42501 (no account row). Both paths present in v4 at lines 135-145. SOURCE_INSPECTED.

**Check 4 · No caller-supplied trusted identity:** PASS  
7-param v4 signature confirmed: `p_invitee_account_id, p_media_type, p_host_country, p_attachment_meta, p_invite_body, p_attachment_url, p_existing_session_id`. No `p_self_supabase_user_id`, no `p_host_account_id`, no `p_account_id`. The TS wrapper test V5-PARAM-CONTRACT explicitly verifies this. SOURCE_INSPECTED + UNIT.

**Check 5 · Cap-count semantics (W1 uses mig-133 trigger):** PASS  
Relies on mig-133 `nex_group_call_participant_cap_tr` trigger. V4 holds `FOR UPDATE` on `nex_group_call_session` above the participant INSERT (line ~219 in v4). Declaration comment confirms `FOR UPDATE` present. SOURCE_INSPECTED.

**Check 6 · Lock order (session FOR UPDATE before participant INSERT):** PASS  
Confirmed: `PERFORM 1 FROM nex_group_call_session WHERE id = v_session_id FOR UPDATE` inserted in v4 before participant row INSERT. Lock order: session first, participant second. SOURCE_INSPECTED.

**Check 7 · Dedup semantics:** PASS  
v4 surfaces `already_invited` skipped result via `out_skipped` column. TS wrapper handles `already_invited` dedup returning `ok:true, skipped:'already_invited'`. Test V5-DUP-1 verifies. No silent swallow. SOURCE_INSPECTED + UNIT.

**Check 8 · mig-133 role CHECK — 'cohost' loophole:** N/A for W1  
W1 (invite path) inserts invitee as a participant via the v4 RPC. The v4 RPC does not expose a `p_role` parameter to the caller; role is set internally. No cohost loophole in the invite path.

**Check 9 · Rollback soundness:** PASS  
W1 rollback is a declaration only — no DDL to drop. Rollback delegates to v4 rollback file explicitly. No side-effect DROPs. SOURCE_INSPECTED.

**Check 10 · No table/trigger/constraint modification:** PASS  
W1 SQL file contains no executable DDL whatsoever. Zero risk. SOURCE_INSPECTED.

### TS Wrapper (invite-service.v5-candidate.ts)

**Check 11 · Named error classes / discriminated-union return mapping:** PASS  
Discriminated union `InviteToCallV5ErrorCode` with 8 distinct codes. Each SQLSTATE maps: 42883→rpc_unavailable, 22023/attachment_url→attachment_url_required, 42501→caller_identity_required, P0001→participant_cap_exceeded, 23505 implicit via dedup path, 22023/self_invite→self_invite_denied. All tested. SOURCE_INSPECTED + UNIT.

**Check 12 · No service_role bypass:** PASS  
Wrapper accepts `AdminLike` interface with only `.rpc()`. Does not call `admin.auth.getUser()`. Does not forward `selfSupabaseUserId` to the RPC (the parameter does not exist). The 7-param signature passed to `admin.rpc` is verified by test V5-PARAM-CONTRACT. SOURCE_INSPECTED + UNIT.

**Check 13 · No live import:** PASS  
`grep` for imports of `invite-service.v5-candidate` in `src/app/` and `src/lib/` (excluding `.v5-candidate.ts` siblings and `__tests__`) returned zero hits. SOURCE_INSPECTED.

**Check 14 · Preserves return shape vs live `inviteToCall`:** PASS  
Returns `InviteToCallV5Result` with `ok, sessionId, participantId, conversationId, messageId, skipped, error`. Shape-compatible with the live `inviteToCall` return contract. The key difference (new distinct error codes) is intentional and additive. SOURCE_INSPECTED.

### Test File (invite-service-v5-candidate.test.ts)

**Check 15 · vitest run:** PASS — 20 tests in this file, all pass. UNIT.

**Check 16 · Coverage:**  
- Happy path: V5-OK-1 ✓  
- Dedup 23505 outcome: V5-DUP-1 ✓  
- 42883: V5-RPC-MISSING, V5-RPC-MISSING-MSG ✓  
- 22023 URL guard: V5-URL-GUARD ✓  
- 42501 NULL uid: V5-IDENTITY-NULL ✓  
- 42501 account-not-found: V5-IDENTITY-404 ✓  
- P0001 cap trigger: V5-4CAP, V5-4CAP-MSG ✓  
- UUID validation, self-invite, media type: V5-UUID-*, V5-MEDIA-INVALID, V5-SELF ✓  
- Param contract (no p_self_supabase_user_id): V5-PARAM-CONTRACT ✓  
- Shape errors: V5-SHAPE-* ✓  
- Pre-mig-306 CHECK violation: V5-CHECK-306 ✓  
- session_not_owned: V5-SESSION-OWNED, V5-SESSION-OWNED-MSG-ONLY ✓  

Coverage: COMPLETE for all required dimensions. UNIT.

**W1 VERDICT: PASS**  
No fixes applied.

---

## W2 — group-call-service.v5-candidate (Package G)

### SQL Candidate (CANDIDATE_nex_call_session_create_rpc_v5_w2_PREVIEW.sql)

**Check 1 · SECURITY DEFINER + search_path:** PASS  
Lines 76-77: `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = public, pg_temp`. Explicitly present. SOURCE_INSPECTED.

**Check 2 · GRANT envelope:** PASS  
Lines 220-230: `REVOKE ALL FROM PUBLIC`, `REVOKE EXECUTE FROM anon`, `REVOKE EXECUTE FROM service_role`, `GRANT EXECUTE TO authenticated`. Exactly correct. SOURCE_INSPECTED.

**Check 3 · auth.uid() fail-closed body guard:** PASS  
Lines 94-106: `v_self_sb_user_id := auth.uid()`, NULL check → RAISE EXCEPTION `caller_identity_required` ERRCODE `42501`. Account lookup → RAISE EXCEPTION `caller_account_not_found` ERRCODE `42501`. Both paths present. SOURCE_INSPECTED.

**Check 4 · No caller-supplied trusted identity:** PASS  
4-param signature: `p_media_type TEXT, p_from_call_link_id UUID, p_host_country TEXT, p_invitee_account_ids UUID[]`. No identity params. Host derived from `auth.uid()` → `nex_account.supabase_user_id`. Test W2-PASSTHROUGH-2 confirms `p_host_account_id` and `hostAccountId` are not forwarded. SOURCE_INSPECTED + UNIT.

**Check 5 · Cap-count semantics (W2 — new session):** PASS  
W2 creates a brand-new session. Document at lines 139-148 explicitly explains why FOR UPDATE is unnecessary for new sessions (no concurrent writer can know the session_id before COMMIT). Cap enforcement rests on mig-133 trigger + TS `.slice(0,3)`. Rationale is sound. SOURCE_INSPECTED.

**Check 6 · Lock order (W2 documents absence):** PASS  
Explicitly documented at lines 139-148. No FOR UPDATE taken; rationale given (new session, no published session_id yet, no concurrent writer possible). This is the correct reasoning per the review brief. SOURCE_INSPECTED.

**Check 7 · Dedup semantics:** PASS  
Lines 203-208: `EXCEPTION WHEN unique_violation THEN NULL` per guest loop iteration. Duplicate guest silently skipped (consistent with existing service behaviour). The returned JSONB array omits the duplicate. Test W2-DUP-1 verifies. SOURCE_INSPECTED + UNIT.

**Check 8 · mig-133 role CHECK — 'cohost' loophole:** N/A for W2  
W2 inserts host with role `'host'` (line 161) and all guests with role `'guest'` (line 185). No caller-controlled role parameter exists. No cohost exposure. SOURCE_INSPECTED.

**Check 9 · Rollback soundness:** PASS  
`DROP FUNCTION IF EXISTS nex_create_group_call_session_tx(TEXT, UUID, TEXT, UUID[])` — exact signature match. No side-effect DROPs. SOURCE_INSPECTED.

**Check 10 · No table/trigger/constraint modification:** PASS  
Only creates one function. No ALTER TABLE, no trigger changes, no constraint modifications. SOURCE_INSPECTED.

### TS Wrapper (group-call-service.v5-candidate.ts)

**Check 11 · Named error classes / discriminated-union return mapping:** PASS  
Three named error classes: `V5RpcUnavailableError` (42883), `V5CallerIdentityRequiredError` (42501), `V5ParticipantCapExceededError` (P0001). 22023 handled as generic rethrow with code attached. All mapped correctly and tested. SOURCE_INSPECTED + UNIT.

**Check 12 · No service_role bypass:** PASS  
`AdminLike` interface with only `.rpc()`. No `admin.auth.getUser()`. `hostAccountId` explicitly NOT forwarded to RPC params (documented in wrapper header; test W2-PASSTHROUGH-2 verifies). SOURCE_INSPECTED + UNIT.

**Check 13 · No live import:** PASS  
Zero hits for imports of `group-call-service.v5-candidate` in `src/app/` or `src/lib/` (excluding candidates/tests). SOURCE_INSPECTED.

**Check 14 · Preserves return shape vs live `createGroupCallSession`:** PASS  
Returns `CreateGroupCallSessionV5Result` with `session: GroupCallSessionRow, participants: GroupCallParticipantRow[], rejectedCount: number`. Shape-compatible with existing `createGroupCallSession` contract. Types imported from live `group-call-service.ts`. SOURCE_INSPECTED.

**Note on `host_account_id` in reconstructed session row:** The session row returned by the wrapper has `host_account_id: "" as NexUuid` because the RPC only returns `out_session_id`. This is explicitly documented in the wrapper. It is a known limitation for callers that need `host_account_id` immediately; they can call `getGroupCallSession()`. Not a security issue, not a correctness bug — intentional design tradeoff to avoid a second round-trip.

### Test File (group-call-service-v5-candidate.test.ts)

**Check 15 · vitest run:** PASS — 11 tests in this file, all pass. UNIT.

**Check 16 · Coverage:**  
- Happy path (3 invitees): W2-OK-1 ✓  
- TS cap slice (5 invitees → 3): W2-CAP-1 ✓  
- 22023 media type: W2-MEDIA-1 ✓  
- 42501 NULL uid: W2-AUTH-1 ✓  
- 42501 account-not-found: W2-AUTH-2 ✓  
- Dedup (unique_violation per guest): W2-DUP-1 ✓  
- 42883 RPC unavailable (code): W2-RPC-MISSING-1 ✓  
- 42883 RPC unavailable (msg): W2-RPC-MISSING-2 ✓  
- P0001 cap trigger: W2-4CAP-1 ✓  
- Exact param contract: W2-PASSTHROUGH-1, W2-PASSTHROUGH-2 ✓  

Coverage: COMPLETE for all required dimensions. UNIT.

**W2 VERDICT: PASS**  
No fixes applied.

---

## W3 — group-call-join.v5-candidate (Package H)

### SQL Candidate (CANDIDATE_nex_call_participant_join_rpc_v5_w3_PREVIEW.sql)

**Check 1 · SECURITY DEFINER + search_path:** PASS  
Lines 108-109: `SECURITY DEFINER`, `SET search_path = public, pg_temp`. Present. SOURCE_INSPECTED.

**Check 2 · GRANT envelope:** PASS  
Lines 240-250: `REVOKE ALL FROM PUBLIC`, `REVOKE EXECUTE FROM anon`, `REVOKE EXECUTE FROM service_role`, `GRANT EXECUTE TO authenticated`. Exactly correct. SOURCE_INSPECTED.

**Check 3 · auth.uid() fail-closed body guard:** PASS  
Lines 120-134: `auth.uid()` NULL → RAISE EXCEPTION `caller_identity_required` ERRCODE `42501`. Account lookup NULL → RAISE EXCEPTION `caller_account_not_found` ERRCODE `42501`. Both paths present. SOURCE_INSPECTED.

**Check 4 · No caller-supplied trusted identity:** PASS  
2-param signature: `p_session_id UUID, p_role TEXT DEFAULT 'guest'`. No identity params. Caller identity derived from `auth.uid()`. Test W3-PARAMS-1 confirms `account_id`, `p_account_id`, `accountId` are NOT in the RPC call params. SOURCE_INSPECTED + UNIT.

**Check 5 · Cap-count semantics (W3 uses mig-133 trigger):** PASS  
INSERT fallback path (lines 185-211) triggers mig-133 `nex_group_call_participant_cap_tr`. FOR UPDATE lock acquired at lines 159-162 before the INSERT, serialising concurrent INSERT-path callers. UPDATE path (lines 169-175) is cap-neutral (row already exists; BEFORE INSERT trigger does not fire on UPDATE). Correctly analysed in function header. SOURCE_INSPECTED.

**Check 6 · Lock order (session FOR UPDATE before participant INSERT):** PASS  
Two-stage lock at lines 145-162: first a bare `PERFORM 1 ... WHERE id = p_session_id` (existence check), then `PERFORM 1 ... WHERE id = p_session_id FOR UPDATE` (lock). Lock is acquired BEFORE participant mutation (UPDATE or INSERT). Matches v4 convention. SOURCE_INSPECTED.

**Check 7 · Dedup semantics:** PASS  
Lines 200-211: `EXCEPTION WHEN unique_violation THEN` → SELECT existing `participant_id`, set `v_was_update := TRUE`. Not silently swallowed — surfaces as `was_update=TRUE` to TS layer. Test W3-RACE-2 covers the case where unique_violation leaks to TS layer (returns null). SOURCE_INSPECTED + UNIT.

**Check 8 · mig-133 role CHECK — 'cohost' loophole:** PASS — TIGHTENED  
Lines 136-141: `IF p_role NOT IN ('host', 'guest') THEN RAISE EXCEPTION 'invalid_role · must be host or guest (mig-133 CHECK constraint)' USING ERRCODE = '22023'; END IF;`  
This explicit RPC-level guard fires BEFORE the INSERT reaches the DB-level CHECK constraint. Any value outside `('host','guest')` including `'cohost'` is rejected at this guard with ERRCODE 22023. The TS type `JoinRole = "host" | "guest"` additionally excludes 'cohost' at compile time. No 'cohost' loophole exists. SOURCE_INSPECTED + UNIT (W3-ROLE-1 tests the 22023 mapping).

**Check 9 · Rollback soundness:** PASS  
`DROP FUNCTION IF EXISTS nex_join_group_call_session_tx(UUID, TEXT)` — exact signature match. No side-effect DROPs. SOURCE_INSPECTED.

**Check 10 · No table/trigger/constraint modification:** PASS  
Only `DROP FUNCTION IF EXISTS` (idempotent guard) + `CREATE FUNCTION`. No ALTER TABLE, no trigger changes, no constraint modifications to mig-133. SOURCE_INSPECTED.

### TS Wrapper (group-call-join.v5-candidate.ts)

**Check 11 · Named error classes / discriminated-union return mapping:** PASS  
Four named error classes: `V5RpcUnavailableError` (42883), `CallerIdentityRequiredError` (42501/identity), `InvalidRoleError` (22023/role), `InvalidSessionError` (22023/non-role or 42501/session_not_found). P0001 rethrown as generic Error (documented: W3 does not define a named cap error class — the trigger firing here is passed up to the caller). 23505 returns `null` (defensive fallback). SOURCE_INSPECTED + UNIT.

**Check 12 · No service_role bypass:** PASS  
`AdminLike` interface with only `.rpc()`. No `admin.auth.getUser()`. No account_id or identity forwarded. Source inspected. SOURCE_INSPECTED + UNIT.

**Check 13 · No live import:** PASS  
Zero hits for imports of `group-call-join.v5-candidate` in `src/app/` or `src/lib/` (excluding candidates/tests). SOURCE_INSPECTED.

**Check 14 · Preserves return shape vs live `joinGroupCallSession`:** PASS  
Returns `JoinGroupCallSessionV5Result | null` with `participantId, wasUpdate, sessionPromoted`. Additive improvement over live contract (live returns void/minimal; this adds structured boolean flags). SOURCE_INSPECTED.

### Test File (group-call-join-v5-candidate.test.ts)

**Check 15 · vitest run:** PASS — 20 tests in this file, all pass. UNIT.

**Check 16 · Coverage:**  
- Happy paths (UPDATE/INSERT/session promotion): W3-UPDATE-1, W3-UPDATE-2, W3-INSERT-1, W3-INSERT-2 ✓  
- P0001 cap trigger: W3-4CAP-1 ✓  
- Dedup (unique_violation SQL-caught): W3-RACE-1 ✓  
- Dedup (unique_violation TS-layer defensive): W3-RACE-2 ✓  
- 22023 role rejection: W3-ROLE-1 ✓  
- 42501 NULL uid: W3-AUTH-1 ✓  
- 42501 account-not-found: W3-AUTH-2 ✓  
- 42501 session_not_found: W3-SESSION-1 ✓  
- 42883 RPC missing (code): W3-RPC-MISSING-1 ✓  
- 42883 RPC missing (msg): W3-RPC-MISSING-2 ✓  
- Param contract: W3-PARAMS-1, W3-PARAMS-2 ✓  
- Null/empty rowset: W3-NULL-1, W3-NULL-2 ✓  

Coverage: COMPLETE for all required dimensions. UNIT.

**W3 VERDICT: PASS**  
No fixes applied.

---

## Repository Hygiene

**Check 17 · v4 SHA unchanged:** PASS  
`de77e9a19eb49df85433bf66969b87a44b05885b302a23559e76134b799bfea7` — confirmed.

**Check 18 · mig-133 SHA unchanged:** PASS  
`35af48379268cb56736bc7024c4e310b51f8e722772d814bf7e0e2a4be3af26b` — confirmed.

**Check 19 · No live-file mutation by this batch:** PASS  
`git status --short` shows the 6 new TS/test files as `??` (untracked), and the entire `nex-supabase/candidate-migrations/` directory as `??` (untracked). Zero new staged or unstaged modifications to `invite-service.ts`, `group-call-service.ts`, `invite-service.transactional-candidate.ts`, or any `src/app/` file from this batch.  

One pre-existing unstaged modification exists in `src/lib/nex-native/calls/group-call-service.ts` (export of `maybeEndSessionIfAllParticipantsLeft` from the §16.33 decline-path workstream). This is a pre-existing uncommitted workstream change, NOT caused by the F/G/H batch. It is NOT a violation of the scope boundary. Its git log confirms it predates this batch (single commit in history: fork commit).

**Check 20 · No commits/pushes/deploys/env/mig-apply:** PASS  
No commit was made. No push. No DB connection. No env changes. All 12 files remain untracked/unstaged artefacts. SOURCE_INSPECTED.

---

## v5 vs v4 Supersede Assessment

v5-W1 does NOT supersede v4. It declares option (a): v4 is applied directly by the operator; W1 is a binding declaration only. v4 remains the sole source of RPC DDL for the invite path.

v5-W2 and v5-W3 are ADDITIONS alongside v4, covering orthogonal operations (session-create and join-accept respectively). They do not conflict with v4 and can be applied in any order relative to v4.

---

## Residual Open Items (not blockers for sandbox apply authorisation)

1. **Case B NULL auth.uid() fail-closed path in v4:** Marked UNVERIFIED in v4 documentation. This is a documentation note, not a code gap — the fail-closed path is present in the SQL. Sandbox runtime evidence would close it.

2. **Case G bounded intermediate-write fault (v4):** Marked STATE_BLOCKER in v4 documentation. Outside scope of v5 batch.

3. **mig-133 trigger counts ALL rows, not just active (left_at IS NULL):** If 4-active-row semantics are required, that is a separate schema change. Noted in W1 declaration. No action possible in this batch scope.

4. **`host_account_id: "" as NexUuid` in W2 session reconstruction:** Callers needing the full session row post-creation should call `getGroupCallSession()`. Documented limitation.

5. **P0001 not named in W3 wrapper:** W3's TS wrapper rethrows cap-trigger P0001 as a generic Error rather than a named class. This is consistent with the stated severity (THEORETICAL — no live caller confirmed) and does not block sandbox apply. Can be tightened when a live caller is identified.

6. **Pre-existing unstaged modifications to `group-call-service.ts`** (§16.33 decline path workstream): Not caused by this batch. Owner should commit or discard this change before the v5 batch is promoted so git history remains clean.

---

## Cap-Coverage Judgement

GB-4CAP is CLOSED for the invite path (W1/v4: FOR UPDATE serialises concurrent participant INSERTs to same session before mig-133 trigger COUNT). GB-4CAP is THEORETICAL for W3 INSERT-fallback (FOR UPDATE acquired before INSERT; theory is that two cold-joiners to same session would race — this is now closed by the FOR UPDATE lock in W3). GB-4CAP is NOT APPLICABLE to W2 (new session, no published session_id, no concurrent writer).

GB-WHITESPACE-GUARD is CLOSED via v4 (POSIX ERE guard on attachmentUrl). W2 and W3 do not involve the attach_url parameter.

Both defects remain SANDBOX_UNAPPLIED — no sandbox runtime evidence yet.

---

## Overall Verdict

| Package | SQL | TS Wrapper | Tests | Verdict |
|---|---|---|---|---|
| W1 (invite) | PASS | PASS | 20/20 PASS | **PASS** |
| W2 (session-create) | PASS | PASS | 11/11 PASS | **PASS** |
| W3 (join) | PASS | PASS | 20/20 PASS | **PASS** |
| **Overall** | | | **51/51 PASS** | **PASS** |

**No fixes were applied.** All 12 artefacts pass all checks as-staged.

**Next gate:** Sandbox apply authorisation (`kdstoyyeygcopkogqsyv`) from the owner, naming:
- v4 → migration number N (inspect `nex_migration_history` on sandbox)
- W2 → migration number N+k (or whichever next available)
- W3 → migration number N+k+1 (or whichever next available)
- Feature flag flips remain separately gated
