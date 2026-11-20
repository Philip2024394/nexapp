
## §16.46 — Lane G v5 staged implementation (W1/W2/W3) · 2026-11-19

### 16.46.1 · Authorisation scope + hard refusals

Founder authorisation received in round that opened §16.46: bounded
local implementation of transactional RPCs covering W1 (invite),
W2 (session-create), W3 (join) to close the GB-4CAP coverage gap
diagnosed in §16.45. Preserved under hard refusal:

- No modification of v4 preview + rollback
  (SHA `de77e9a19eb49df85433bf66969b87a44b05885b302a23559e76134b799bfea7`).
- No modification of mig-133 (SHA `35af48379268cb56736bc7024c4e310b51f8e722772d814bf7e0e2a4be3af26b`)
  or any applied migration.
- No modification of live `invite-service.ts`,
  `group-call-service.ts`, or `invite-service.transactional-candidate.ts`.
- No modification of any `src/app/` file.
- No env, middleware, or deploy-config change.
- `NEX_INVITE_CALL_TX` NOT flipped.
- No SQL applied to any database.
- No commit · no push · no deploy.
- Production project `ijvqdvsvwtwxzcqmoqit` hard-refused.
- Sandbox apply remains SEPARATELY GATED.

### 16.46.2 · Parallel execution record · 4 agents · exclusive ownership

Three writer agents launched in parallel as general-purpose
write-enabled subagents (sonnet). Each held exclusive ownership
of a disjoint 4-file envelope. One reviewer agent launched after
all three completed.

| Agent | Task-ID              | Scope        | Files owned                                                                                          |
|-------|----------------------|--------------|------------------------------------------------------------------------------------------------------|
| F     | `a6016a5f0a8001b74`  | W1 invite    | 2 SQL (`CANDIDATE_nex_call_invite_rpc_v5_w1_PREVIEW{,_rollback}.sql`) · wrapper · test             |
| G     | `a80dbaa1525a61c21`  | W2 session   | 2 SQL (`CANDIDATE_nex_call_session_create_rpc_v5_w2_PREVIEW{,_rollback}.sql`) · wrapper · test     |
| H     | `a76aeec5bbb6b185c`  | W3 join      | 2 SQL (`CANDIDATE_nex_call_participant_join_rpc_v5_w3_PREVIEW{,_rollback}.sql`) · wrapper · test   |
| I     | `a2d2ca90ed7ad1ed9`  | Review       | `tmp-lane-g/35-review-v5-combined.{md,json}` + concrete in-scope fixes authorisation (none used)  |

Common envelope: no `D:/trades` reference · no `src/app/` touch ·
no live-service touch · no env/commit/push/deploy/DB access ·
default-off / fail-closed staging.

### 16.46.3 · Coordinator-verified SHA-256 of 12 new files

Independently recomputed via `sha256sum` after all three writer
agents reported. Exact match with agent-reported hashes.

```
ec972d21c5de69839096c1534540dd7ffeda2a08574c23070b93929e9c27d524  CANDIDATE_nex_call_invite_rpc_v5_w1_PREVIEW.sql
f42848e98207f21e579bb217748fbd215ab5f5a177c7f3d0e99ada8ced92175d  CANDIDATE_nex_call_invite_rpc_v5_w1_PREVIEW_rollback.sql
6b66b01fd59e0469bf38d32d4296124a88f40e7d74fb4b0a62c90ddf4db9be90  invite-service.v5-candidate.ts
b515281a27aed315f59f757d2159777751d7792165d445aece3e1a1e7a8cb683  invite-service-v5-candidate.test.ts

51cb55863636a8b23f4c825646f5eeb980159493cedef7b36aea44154d4344db  CANDIDATE_nex_call_session_create_rpc_v5_w2_PREVIEW.sql
07466c7ecf2b2f71fddd17bf3186b72bf826ee01631042554e6c3777cd01c4ae  CANDIDATE_nex_call_session_create_rpc_v5_w2_PREVIEW_rollback.sql
25a9b7dfccbe08ad6ff27922adce2266a1b1cf051cb8ae070aa7d0062db6589b  group-call-service.v5-candidate.ts
a4aaf9c824a6c6718c390d0551f74fa9b6c6627ce8ca82a06aea623018acd4cd  group-call-service-v5-candidate.test.ts

375fc243fd87bfab75c074824b29007518f84c868f588a6d92e018fc5a0802b9  CANDIDATE_nex_call_participant_join_rpc_v5_w3_PREVIEW.sql
2b83c0fea0a70ccde9d16b4839e14a6fd5871b2c46534a3073526dba7d5665f5  CANDIDATE_nex_call_participant_join_rpc_v5_w3_PREVIEW_rollback.sql
ff0d5f95357d9acd18d4c61f6b8a27f5e4cabc7d831b77f4b96e7817ae98c23a  group-call-join.v5-candidate.ts
267c2ea7708dd2464ce1e75912e2552198c21fb67239e1b99c669602ad6f700a  group-call-join-v5-candidate.test.ts
```

Pinned references unchanged (post-batch recompute):

```
de77e9a19eb49df85433bf66969b87a44b05885b302a23559e76134b799bfea7  CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW.sql
7235edc9c51f244e3d01c5332fa28cf8d9e07725edec58540b022e1a5b6f8c9d  CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW_rollback.sql
35af48379268cb56736bc7024c4e310b51f8e722772d814bf7e0e2a4be3af26b  133_nex_group_call.sql
```

### 16.46.4 · Exact implemented RPC signatures

W1 · invite (v5 declares v4 as its RPC body · no new DDL):

```sql
nex_invite_to_call_tx(
  p_invitee_account_id   UUID,
  p_media_type           TEXT,
  p_host_country         TEXT,
  p_attachment_meta      JSONB,
  p_invite_body          TEXT,
  p_attachment_url       TEXT,
  p_existing_session_id  UUID DEFAULT NULL
) RETURNS TABLE (
  out_session_id       UUID,
  out_participant_id   UUID,
  out_conversation_id  UUID,
  out_message_id       UUID
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
```

Lock shape (from v4): `PERFORM 1 FROM nex_group_call_session WHERE id = v_session_id FOR UPDATE` between session-ownership and participant INSERT. Covers GB-4CAP race under READ COMMITTED for the invite writer path ONLY WHEN wrapper is wired.

W2 · session-create (ADDS alongside v4):

```sql
nex_create_group_call_session_tx(
  p_media_type          TEXT,
  p_from_call_link_id   UUID,
  p_host_country        TEXT,
  p_invitee_account_ids UUID[]
) RETURNS TABLE (
  out_session_id      UUID,
  out_participants    JSONB,
  out_rejected_count  INT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
```

Host derived server-side from `auth.uid()` → `nex_account.id`. Invitees gated via server-side slice to 3 (same 4-cap invariant as mig-133). No FOR UPDATE required: the session_id is created inside this call and is not yet published, so no concurrent writer can observe or race against it before COMMIT.

W3 · join (ADDS alongside v4):

```sql
nex_join_group_call_session_tx(
  p_session_id  UUID,
  p_role        TEXT DEFAULT 'guest'
) RETURNS TABLE (
  out_participant_id    UUID,
  out_was_update        BOOLEAN,
  out_session_promoted  BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
```

Server-side role guard rejects anything outside `('host','guest')` at ERRCODE 22023 BEFORE INSERT · mig-133 CHECK unchanged. Session-row FOR UPDATE above UPDATE-first / INSERT-fallback path.

Grant envelope on all three: `REVOKE EXECUTE ... FROM PUBLIC, anon, service_role; GRANT EXECUTE ... TO authenticated`.

### 16.46.5 · Exact wrapper function signatures + error maps

Each wrapper preserves the live counterpart's return shape where one exists (W1→inviteToCall, W2→createGroupCallSession, W3→joinGroupCallSession). None imported by any live caller.

| Wrapper | Signature (abridged) | Error map (SQLSTATE → outcome) |
|---------|-----------------------|---------------------------------|
| W1      | `inviteToCallV5Candidate(admin, input) → Promise<Result>` discriminated-union | 42883→`rpc_unavailable` · 22023→`attachment_url_required`/`invalid_media_type` · 42501→`caller_identity_required` · P0001→`participant_cap_exceeded` · 23505 at SQL→`skipped:already_invited` |
| W2      | `createGroupCallSessionV5Candidate(admin, input) → Promise<Result>` named classes | 42883→`V5RpcUnavailableError` · 42501→`V5CallerIdentityRequiredError` · 22023→Error(code=22023) · P0001→`V5ParticipantCapExceededError` · others→rethrow |
| W3      | `joinGroupCallSessionV5Candidate(admin, input) → Promise<{participantId,wasUpdate,sessionPromoted}\|null>` named classes | 42883→`V5RpcUnavailableError` · 42501→`CallerIdentityRequiredError` / `InvalidSessionError` · 22023→`InvalidRoleError`/`InvalidSessionError` · 23505 leaked to TS→`null` · P0001→rethrow |

No wrapper substitutes service_role bypass. No wrapper forwards a caller-supplied identity parameter. SECURITY DEFINER runs as function owner; the authenticated caller token continues to drive `auth.uid()` inside the function body.

### 16.46.6 · Caller-site changes

Zero. No live caller was touched. `src/app/nex-native/call/preview/_invite-actions.ts:41`, `src/app/nex-native/free-chat/call/_live-add-to-call-action.ts:70`, and `src/app/nex-native/chat/peer/[accountId]/_add-to-call-action.ts:55` continue to invoke the pre-v5 service functions. Activation requires a separately authorised wiring step.

### 16.46.7 · Independent review verdict (Package I)

Reviewer agent I (`a2d2ca90ed7ad1ed9`) ran 20 checks per package across SECURITY DEFINER, pinned search_path, GRANT envelope, auth.uid() fail-closed, no caller-supplied identity, cap-count semantics, lock order, dedup semantics, mig-133 role-CHECK compliance (including W3 `cohost` loophole closure), rollback soundness, no table/trigger mutation, named error classes, no service_role bypass, no live import, preserved return shape, independent vitest rerun, test coverage breadth, v4/mig-133 SHA pinning, git hygiene, and non-mutation of live services.

```
Per-package verdict: W1 PASS · W2 PASS · W3 PASS
Overall: PASS
Fixes applied: 0
Vitest: 3 files · 51 tests · exit code 0 · 357 ms
```

Reports at `tmp-lane-g/35-review-v5-combined.md` + `.json`.

Review notes incorporated into this ledger:

- W3 `cohost` loophole CLOSED. v5-W3 SQL lines 136-141 raise `invalid_role` 22023 before any INSERT; TS type union additionally rejects at compile time. The mig-133 `role CHECK (role IN ('host','guest'))` constraint is never reached by a malformed role value through the v5 path.
- W2 FOR UPDATE absence correctly documented and justified (new, unpublished session · no concurrent writer window pre-COMMIT).
- One pre-existing unstaged modification to `group-call-service.ts` (export of `maybeEndSessionIfAllParticipantsLeft` from §16.33 decline-path workstream) predates this batch and is not caused by F/G/H/I. Flagged as prior state, not a §16.46 scope violation.

### 16.46.8 · Supersede / incorporate matrix

| Candidate   | Relation to v4              | Rationale                                                                                                                   |
|-------------|-----------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| v5-W1 SQL   | INCORPORATES v4             | v5-W1 preview declares v4 as the W1 RPC body · contains no executable DDL · operator applies v4 as-is to materialise W1.    |
| v5-W2 SQL   | ADDS alongside v4           | Covers different function (`nex_create_group_call_session_tx`) · different scope (session creation) · no v4 mutation.       |
| v5-W3 SQL   | ADDS alongside v4           | Covers different function (`nex_join_group_call_session_tx`) · different scope (joinee-side) · no v4 mutation.              |
| v5-W1 wrapper | Alternative to live W1    | Not wired · default-off · preserves 7-param v4 call shape.                                                                  |
| v5-W2 wrapper | Alternative to live W2    | Not wired · default-off · preserves `createGroupCallSession` return shape.                                                  |
| v5-W3 wrapper | Alternative to live W3    | Not wired · default-off · preserves joinGroupCallSession semantics (null on dedup race).                                    |

Operator may apply v4 alone, (v4 + v5-W2) alone, (v4 + v5-W2 + v5-W3), or any subset — order-independent — because no v5 SQL modifies v4 artefacts.

### 16.46.9 · Residual open items (preserved from §16.45 unless noted)

- GB-WHITESPACE-GUARD · OPEN (v4 still UNAPPLIED at DB boundary).
- GB-4CAP · OPEN · would become PARTIAL-covered on v4 apply for W1-wired path only. OPEN for W2 (theoretical · new session) and W3 (theoretical · no live caller) irrespective of v4. Full closure requires both the DB apply AND a separately-authorised wiring step for the v5 wrappers.
- Case B (NULL auth.uid fail-closed in live DB) · UNVERIFIED. SQL-runtime evidence unavailable.
- Case G (intermediate-write fault) · STATE_BLOCKER unchanged.
- Supplied-identity mismatch · INAPPLICABLE (v5 rejects the pattern at SQL boundary by not exposing identity parameters at all).
- W3 live caller · still NOT grep-found in `src/app/` · severity THEORETICAL.
- BROWSER / PERSISTENCE / PROVIDER / PHYSICAL_DEVICE tiers · UNVERIFIED.

### 16.46.10 · Verdict matrix (4-verdict separation, extended)

| Tier                          | Status                                                                               |
|-------------------------------|--------------------------------------------------------------------------------------|
| Local engineering (source)    | SOURCE_INSPECTED · PASS for the staged envelope                                      |
| Offline tests (vitest)        | UNIT · PASS · 51/51 · exit 0                                                         |
| Connected RPC (SQL runtime)   | UNVERIFIED (DB gate closed)                                                          |
| Activated in live app         | NOT ACTIVATED (no wiring · no flag flip)                                             |
| Founder walkthrough           | UNVERIFIED                                                                           |
| Public launch readiness       | NOT READY                                                                            |

Engineering ceiling held. No Live-Verified claim.

### 16.46.11 · Files changed in this batch

New (12) — all untracked at batch close:

- `nex-supabase/candidate-migrations/CANDIDATE_nex_call_invite_rpc_v5_w1_PREVIEW.sql`
- `nex-supabase/candidate-migrations/CANDIDATE_nex_call_invite_rpc_v5_w1_PREVIEW_rollback.sql`
- `nex-supabase/candidate-migrations/CANDIDATE_nex_call_session_create_rpc_v5_w2_PREVIEW.sql`
- `nex-supabase/candidate-migrations/CANDIDATE_nex_call_session_create_rpc_v5_w2_PREVIEW_rollback.sql`
- `nex-supabase/candidate-migrations/CANDIDATE_nex_call_participant_join_rpc_v5_w3_PREVIEW.sql`
- `nex-supabase/candidate-migrations/CANDIDATE_nex_call_participant_join_rpc_v5_w3_PREVIEW_rollback.sql`
- `src/lib/nex-native/calls/invite-service.v5-candidate.ts`
- `src/lib/nex-native/calls/group-call-service.v5-candidate.ts`
- `src/lib/nex-native/calls/group-call-join.v5-candidate.ts`
- `src/lib/nex-native/calls/__tests__/invite-service-v5-candidate.test.ts`
- `src/lib/nex-native/calls/__tests__/group-call-service-v5-candidate.test.ts`
- `src/lib/nex-native/calls/__tests__/group-call-join-v5-candidate.test.ts`

Modified by coordinator (2):

- `src/app/nex-native/hq/journey-map/page.tsx` · Lane G subgraph extended with "STAGED v5 IMPLEMENTATION (§16.46)" section.
- `evidence/master-flow/RECONCILIATION-LEDGER-2026-11-18.md` · §16.46 appended (this section).

Modified by reviewer (2):

- `tmp-lane-g/35-review-v5-combined.md` (NEW)
- `tmp-lane-g/35-review-v5-combined.json` (NEW)

Unchanged (pin-confirmed post-batch):

- `nex-supabase/candidate-migrations/CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW.sql` (SHA `de77e9a19eb49df8...`).
- `nex-supabase/candidate-migrations/CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW_rollback.sql` (SHA `7235edc9c51f244e...`).
- `nex-supabase/migrations/133_nex_group_call.sql` (SHA `35af48379268cb56...`).
- `src/lib/nex-native/calls/invite-service.ts` · live service.
- `src/lib/nex-native/calls/invite-service.transactional-candidate.ts` · unwired RPC caller.
- All `src/app/` files · env · middleware · deploy config.

### 16.46.12 · Explicitly NOT performed

- No SQL applied to any database.
- No migration numbered or promoted out of `candidate-migrations/`.
- No `NEX_INVITE_CALL_TX` flip.
- No wiring of any v5 wrapper into any live caller.
- No commit, push, or deploy.
- No prod reference. Production `ijvqdvsvwtwxzcqmoqit` hard-refused.
- No sandbox DB connection. No `kdstoyyeygcopkogqsyv` migration apply or probe.
- No `D:/trades` reference (per nexapp canonical-repo rule).

### 16.46.13 · One precise next gate (owner-held, not executed)

Only one authorisation can advance Lane G from here:

> Sandbox apply scope — name the exact application target as
> Supabase project `kdstoyyeygcopkogqsyv` · select migration identity
> for each v5 candidate (either re-number into `nex-supabase/migrations/`
> or apply in place from `candidate-migrations/`) · confirm grant
> envelope (REVOKE from PUBLIC/anon/service_role · GRANT to
> authenticated) · confirm cleanup permission on failure · confirm
> rollback bounds (per-candidate rollback SQL only · no destructive
> wider DROP) · hard-refuse production `ijvqdvsvwtwxzcqmoqit`.

Activation (wiring the v5 wrappers into live callers and flipping any
feature flag) is a SEPARATE subsequent gate, not bundled with the
sandbox-apply gate.

Until one of these authorisations lands, Lane G remains at
`SOURCE_INSPECTED + UNIT-tested` ceiling with the 12 v5 artefacts
staged, unwired, default-off, fail-closed.

*End §16.46.*
