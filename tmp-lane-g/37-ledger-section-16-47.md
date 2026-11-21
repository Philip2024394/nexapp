
## §16.47 — Lane G Gate A preparation manifest · 2026-11-19

### 16.47.1 · Scope + hard refusals (round opening)

This round authorises **PREPARATION ONLY**. No DB connection · no SQL
execution · no migration application · no caller wiring · no runtime
activation · no flag changes. Sandbox `kdstoyyeygcopkogqsyv` is the
only permitted future target (not touched in this round). Production
`ijvqdvsvwtwxzcqmoqit` hard-refused. Preserves §16.46, §16.45 and
§16.44.12.

### 16.47.2 · Disk reconciliation vs §16.46 claims

Coordinator re-read all seven SQL files (v4 pair + v5-W1 pair + v5-W2
pair + v5-W3 pair) against disk. SHAs re-verified unchanged from
§16.46.3. Observations:

- **v5-W1 return-column discrepancy noted.** Agent F's §16.46.4
  abridgement listed 4 return columns. The v4 SQL (which v5-W1 declares
  as its body) actually returns FIVE columns:
  `(out_session_id, out_participant_id, out_conversation_id, out_message_id, out_skipped TEXT)`
  (`CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW.sql:113-119`).
  The v5-W1 preview header at lines 69-75 documents the full 5-col
  shape correctly. The TS wrapper and tests presumably handle it (per
  reviewer PASS 20/20 for W1). **Not a defect in the SQL or TS; a
  precision gap in the earlier handback text. Logged here for ledger
  accuracy.**

- v4 uses `DROP FUNCTION IF EXISTS nex_invite_to_call_tx(...)` followed
  by `CREATE FUNCTION` (lines 92-105). This supersedes mig-356's
  function body. Rollback must restore mig-356 body — the v4 rollback
  file does exactly that as a self-contained TEXT-copy (lines 62-233).

- v5-W2 uses `CREATE OR REPLACE FUNCTION` (no DROP). Safe for net-new
  function. Rollback is a bare `DROP FUNCTION IF EXISTS` (W2 rollback
  line 47). Because `nex_create_group_call_session_tx` did not exist
  pre-v5-W2, DROP is the correct rollback — there is no prior
  definition to restore.

- v5-W3 uses `DROP FUNCTION IF EXISTS` + `CREATE FUNCTION`. Rollback
  is also a bare `DROP FUNCTION IF EXISTS` (W3 rollback line 40).
  Same reasoning as W2.

- All four SQL files wrap state change in `BEGIN; ... COMMIT;`. All-or-
  nothing semantics at statement level.

### 16.47.3 · Migration numbering survey (local only · sandbox history unverified)

Local filesystem survey of `nex-supabase/migrations/`:

```
Highest-numbered applied-looking file: 356_nex_group_call_invite_v2.sql
Visible gap (no file in migrations/):   354, 355
PROPOSAL files still in candidate-migrations/: 354, 355 (cart_order,
                                                path_a_separation);
                                                also 353 PREVIEW mirror
Sandbox apply scripts under scripts/: through 348, 353, 356 (-sandbox.mjs)
```

**Numbering uncertainty.** Whether 354/355 should precede the v5 batch
cannot be resolved from local disk alone. Possibilities:

1. 354/355 applied in sandbox but preview-numbered artefacts never
   promoted to `migrations/` → v5 batch takes 357/358.
2. 354/355 never applied anywhere → v5 batch could claim any of
   357+, OR the operator may want 354/355 applied first.
3. 354/355 reserved for the unrelated cart_order/path_a workstream
   and will claim those numbers whenever that work ships → v5 batch
   must take 357+ to avoid collision.

**Resolution requires sandbox `nex_migration_history` inspection in
the Gate A preflight (read-only, project-ref-guarded).** Do not assign
final numbers without that inspection. Provisional numbers used in
this manifest are `357/358/359` for traceability only.

### 16.47.4 · Recommended application method (one unambiguous choice)

**Recommend P2 · Promote to numbered files in `migrations/` with
dedicated per-migration apply scripts under `scripts/`.**

Rationale:

- Matches the exact convention used for every previously applied
  Lane G and Lane-adjacent change (mig-353, mig-356, 315-348).
- Enables the project-ref guard pattern already proven at
  `scripts/apply-migration-258.mjs:54-60` and
  `scripts/apply-migration-315-sandbox.mjs` (sandbox variants set
  `CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv"`). Prevents
  accidental production connection.
- Preserves candidate-migrations/ copies as traceable inputs
  (mirrors mig-353 precedent: `candidate-migrations/353_..._PREVIEW.sql`
  retained alongside `migrations/353_....sql`).
- `nex_migration_history` row is written by the applied migration
  OR the apply script (per existing convention), providing an
  auditable trail.

Rejected alternative: applying directly from `candidate-migrations/`
(one-off ad-hoc). Rejected because (a) it breaks the auditable path,
(b) no version row in `nex_migration_history`, (c) harder to reconcile
in prod later.

### 16.47.5 · Proposed migration identity per candidate

**Owner approval required before any file move or number assignment.**

| # | Provisional path | Source file (unchanged, read-only) | Source SHA-256 | RPC signature | Rollback source | Rollback SHA-256 |
|---|---|---|---|---|---|---|
| **MIG-A** | `nex-supabase/migrations/357_nex_group_call_invite_v4_combined.sql` | `candidate-migrations/CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW.sql` | `de77e9a19eb49df85433bf66969b87a44b05885b302a23559e76134b799bfea7` | `nex_invite_to_call_tx(UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID DEFAULT NULL) → TABLE(5 cols)` | `candidate-migrations/CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW_rollback.sql` | `7235edc9c51f244e3d01c5332fa28cf8d9e07725edec58540b022e1a5b6f8c9d` |
| **MIG-B** | `nex-supabase/migrations/358_nex_create_group_call_session_tx.sql` | `candidate-migrations/CANDIDATE_nex_call_session_create_rpc_v5_w2_PREVIEW.sql` | `51cb55863636a8b23f4c825646f5eeb980159493cedef7b36aea44154d4344db` | `nex_create_group_call_session_tx(TEXT, UUID, TEXT, UUID[]) → TABLE(3 cols)` | `candidate-migrations/CANDIDATE_nex_call_session_create_rpc_v5_w2_PREVIEW_rollback.sql` | `07466c7ecf2b2f71fddd17bf3186b72bf826ee01631042554e6c3777cd01c4ae` |
| **MIG-C** | `nex-supabase/migrations/359_nex_join_group_call_session_tx.sql` | `candidate-migrations/CANDIDATE_nex_call_participant_join_rpc_v5_w3_PREVIEW.sql` | `375fc243fd87bfab75c074824b29007518f84c868f588a6d92e018fc5a0802b9` | `nex_join_group_call_session_tx(UUID, TEXT DEFAULT 'guest') → TABLE(3 cols)` | `candidate-migrations/CANDIDATE_nex_call_participant_join_rpc_v5_w3_PREVIEW_rollback.sql` | `2b83c0fea0a70ccde9d16b4839e14a6fd5871b2c46534a3073526dba7d5665f5` |

**Note on v5-W1 as a migration identity.** `CANDIDATE_nex_call_invite_rpc_v5_w1_PREVIEW.sql`
(SHA `ec972d21...`) contains no executable DDL — it is a documentation
declaration pointing to v4. **W1 is not a separate migration.**
Applying MIG-A applies W1's effective SQL. The v5-W1 PREVIEW file
stays in `candidate-migrations/` as a traceability record only.
This answers the owner's reconciliation question: **W1 incorporates
v4; applying both files would attempt a duplicate DROP + CREATE —
avoid that by applying only MIG-A.**

Dependencies:

- MIG-A depends on: `133_nex_group_call.sql`, `356_nex_group_call_invite_v2.sql`
  (replaces mig-356's function body).
- MIG-B depends on: `133_nex_group_call.sql` only.
- MIG-C depends on: `133_nex_group_call.sql` only.
- MIG-A/B/C are independent of each other at the DDL level (no cross-
  function references). Execution order recommended `A → B → C` for
  reviewability but could be any order.

Execution model:

- Each migration is applied via its own dedicated script
  `scripts/apply-migration-{357,358,359}-sandbox.mjs`, modeled on the
  existing `scripts/apply-migration-315-sandbox.mjs` template,
  pinned to `CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv"`.
- Each script reads `.env.local`, parses the pooler username, refuses
  to proceed if project ref ≠ sandbox (per `apply-migration-258.mjs:54-60`
  pattern).
- Secrets are never printed or logged; project-ref is the only identity
  leaked to stdout.
- Target verification before SQL execution: `SELECT current_database(),
  inet_server_addr(), pg_get_userbyid(session_user::regrole::oid::int)`
  plus the pooler-username parse already performed. The connection
  string itself is read from `.env.local` and must contain
  `postgres.kdstoyyeygcopkogqsyv`.

The scripts for these do not yet exist on disk. They will be drafted
under Gate A authorisation using the existing sandbox template.

### 16.47.6 · Grant / security envelope — effective-privilege caveats

All three candidate SQL files declare the same intended envelope:

```
REVOKE ALL      ON FUNCTION <name>(<types>) FROM PUBLIC;
REVOKE EXECUTE  ON FUNCTION <name>(<types>) FROM anon;
REVOKE EXECUTE  ON FUNCTION <name>(<types>) FROM service_role;
GRANT  EXECUTE  ON FUNCTION <name>(<types>) TO   authenticated;
```

Plus: `SECURITY DEFINER`, `SET search_path = public, pg_temp`,
`auth.uid()` fail-closed body guard raising 42501, `nex_account`
server-side lookup.

**Effective-privilege reality (owner's negative-authorization question).**
SQL ACL REVOKE blocks direct `EXECUTE` of the function under that role;
it does NOT prevent all forms of access the role might otherwise have:

1. **Table-level writes via `service_role` remain possible** regardless
   of function REVOKE. The live `src/lib/nex-native/calls/invite-service.ts:287`
   and `group-call-service.ts:105,179` paths already use service_role
   INSERT directly against `nex_group_call_participant`. The v5 RPCs
   *provide an alternative* that requires `authenticated`; they do NOT
   close the direct-table-write pathway. That pathway is closed only
   by caller rewiring (Gate B) — not Gate A.

2. **SECURITY DEFINER runs as function owner**, not as caller. If the
   owner has broad table privileges (typical for migration-applier
   roles), the function body operates under those privileges. The
   REVOKE blocks who can INVOKE, not what the function BODY can do.
   The auth.uid() fail-closed guard is therefore **the load-bearing
   caller-identity constraint**, not the ACL.

3. **Role inheritance.** If `service_role` or `anon` inherits
   privileges from a parent role that has EXECUTE, the REVOKE could
   be shadowed. Supabase's default role tree does not inherit this
   way, but the preflight must verify it rather than assume it.

**Negative-authorization checks the Gate A connected run MUST execute**
(read-only inspection, no mutations):

1. `SELECT has_function_privilege('anon', 'public.nex_invite_to_call_tx(uuid,text,text,jsonb,text,text,uuid)', 'EXECUTE')` → expect **false**.
2. `SELECT has_function_privilege('service_role', '<same>', 'EXECUTE')` → expect **false**.
3. `SELECT has_function_privilege('authenticated', '<same>', 'EXECUTE')` → expect **true**.
4. Repeat 1-3 for `nex_create_group_call_session_tx(text,uuid,text,uuid[])` and `nex_join_group_call_session_tx(uuid,text)`.
5. `SELECT proname, prosecdef, proconfig, pg_get_userbyid(proowner)
   FROM pg_proc WHERE proname IN ('nex_invite_to_call_tx',
   'nex_create_group_call_session_tx', 'nex_join_group_call_session_tx')`
   → expect `prosecdef=true`, `proconfig` contains
   `search_path=public, pg_temp`, `proowner` is the sandbox migrator role
   (not `postgres` superuser unless that is the intended owner).
6. `SELECT polname, polcmd, polqual FROM pg_policy WHERE schemaname='public' AND tablename='nex_group_call_participant'` → confirm RLS INSERT policy unchanged from mig-133.
7. `SELECT tgname, tgenabled FROM pg_trigger WHERE tgname='nex_group_call_participant_cap_tr'` → confirm trigger still enabled.
8. Confirm `inet_server_addr()` and pooler-host parse identify the sandbox endpoint, not production.

**Blockers to flag if any check fails:** stop, do not proceed to writes.

### 16.47.7 · Bounded apply + rollback procedures per candidate

**Apply order:** A → B → C (independence allows any order; A first
because it supersedes mig-356 and is therefore the most behaviorally
visible if other work depends on mig-356 state).

**Per-candidate procedure:**

| Step | MIG-A (v4 combined) | MIG-B (session-create) | MIG-C (join) |
|---|---|---|---|
| Pre-check | Verify mig-356 present (`SELECT 1 FROM nex_migration_history WHERE version='356'`) · verify sandbox target | Verify mig-133 present · verify sandbox target | Verify mig-133 present · verify sandbox target |
| Transaction boundary | `BEGIN;` in file · `COMMIT;` in file | Same | Same |
| On-error | Fail entire transaction · no partial state · **STOP on first error** · do not continue to next migration | Same | Same |
| If function exists | DROP IF EXISTS (safe idempotent) + CREATE replaces mig-356 body | CREATE OR REPLACE (idempotent) | DROP IF EXISTS + CREATE |
| Post-check | `SELECT prosecdef FROM pg_proc WHERE proname='nex_invite_to_call_tx' AND pronargs=7` → true | Same for `nex_create_group_call_session_tx` pronargs=4 | Same for `nex_join_group_call_session_tx` pronargs=2 |
| Grant envelope verify | §16.47.6 checks 1-3 | §16.47.6 checks 1-3 | §16.47.6 checks 1-3 |
| History row | Written as part of the apply script `INSERT INTO nex_migration_history (version, applied_at) VALUES ('357', NOW())` (model: existing apply-migration scripts) | Version '358' | Version '359' |

**Rollback bounds (what each restores, what it does NOT):**

| Rollback | Restores | Does NOT restore |
|---|---|---|
| MIG-A rollback | mig-356 function body verbatim (self-contained TEXT copy at lines 62-233 of v4 rollback) + mig-356 permission envelope | Any data written via MIG-A (none expected — wrapper unwired) · `nex_migration_history` row (housekeeping deliberately omitted · operator decides) · any grants on unrelated objects |
| MIG-B rollback | **Nothing** (DROP only). This is correct — no prior `nex_create_group_call_session_tx` existed. | Any participant rows written via MIG-B · the function itself after DROP |
| MIG-C rollback | **Nothing** (DROP only). Correct — no prior `nex_join_group_call_session_tx` existed. | Any participant rows written via MIG-C · the function itself after DROP |

**DROP FUNCTION is NOT universally safe.** It is safe for MIG-B and
MIG-C because they are net-new functions. It would be unsafe for
MIG-A — hence MIG-A's rollback is a text-copy CREATE, not a bare DROP.

**Test-record cleanup permission scope (if Gate A authorises
connected tests):** cleanup is scoped strictly to rows created by
the test fixture, identified by a known test session_id and test
account_ids (both to be assigned under Gate A, none to be Hammerex,
Rosa, or any protected account). Cleanup statement form:

```
DELETE FROM nex_group_call_participant WHERE session_id = <test_id>;
DELETE FROM nex_group_call_session       WHERE id         = <test_id>;
DELETE FROM nex_peer_message             WHERE id         = <test_message_id>;
```

No broader DELETE. No cleanup of `nex_peer_conversation` (reused by
tests). If cleanup permission is NOT granted in Gate A, procedure is:
on failure, stop immediately, report retained rows with full identity.
Do not retry destructive cleanup.

### 16.47.8 · Smallest connected verification matrix

Goal: advance evidence from UNIT (vitest pass) to CONNECTED SQL
without manufacturing PASS through privileged calls or mocks.

| ID | Scenario | Target RPC | Setup (test fixture) | Expected outcome | Advances |
|---|---|---|---|---|---|
| **V-DEP-A** | MIG-A applied + signature | n/a | fresh connection | `pg_proc` row with prosecdef=true, 5-col RETURNS | SQL deploy/signature |
| **V-DEP-B** | MIG-B applied + signature | n/a | fresh connection | `pg_proc` row prosecdef=true, 3-col RETURNS | SQL deploy/signature |
| **V-DEP-C** | MIG-C applied + signature | n/a | fresh connection | `pg_proc` row prosecdef=true, 3-col RETURNS | SQL deploy/signature |
| **V-GRANT-ANON** | REVOKE from anon effective | all 3 | anon JWT | `has_function_privilege('anon', ...)` = false | Effective grants |
| **V-GRANT-SR** | REVOKE from service_role effective | all 3 | service_role | false | Effective grants |
| **V-GRANT-AUTH** | GRANT to authenticated effective | all 3 | authenticated JWT | true | Effective grants |
| **V-AUTH-NULL** | NULL auth.uid() fail-closed | W1 | anon JWT forwarded as if authenticated (no `sub` claim) | ERRCODE 42501, msg `caller_identity_required` | Case B |
| **V-AUTH-UNKNOWN** | Unknown account | W1 | authenticated JWT whose `sub` has no nex_account row | ERRCODE 42501, msg `caller_account_not_found` | Case B |
| **V-AUTH-UNAUTH-DIFF** | Impersonation blocked | W1 | authenticated JWT for user X attempts p_existing_session_id owned by Y | ERRCODE 42501, msg `session_not_owned` | Negative-auth |
| **V-W1-NEW** | Create new session + invite | W1 | authenticated JWT, p_existing_session_id=NULL, valid attachment_url | 5-col return · 1 participant row for invitee · 1 peer_message row · 1 conversation row | W1 happy path |
| **V-W1-EXIST** | Invite to existing self-owned session | W1 | authenticated JWT, p_existing_session_id set, session already has 3 rows (host + 2 guests) | 5-col return · participant row created · cap not exceeded | W1 existing-session |
| **V-W1-CAP** | 4th invite triggers cap | W1 | session has 3 guests + host (4 rows), invite a 5th | ERRCODE P0001, trigger message | GB-4CAP coverage |
| **V-W1-CAP-RACE** | Concurrent invites to same session | W1 | two parallel `pg_notify`-synced BEGINs each invite different accounts to a 3-row session | one succeeds, one fails with P0001 OR both succeed (if below cap). **FOR UPDATE must serialise so the 4-cap is never exceeded** · final count never > 4 | GB-4CAP race (load-bearing) |
| **V-W1-WS** | Whitespace-guard | W1 | attachment_url with tab/LF/CR only → fails · with valid pattern → passes | 22023 on bad · success on good | GB-WHITESPACE-GUARD |
| **V-W1-DUP** | Idempotent re-invite | W1 | same invitee re-invited | 5-col return with `out_skipped='already_invited'`, no new rows beyond the first | Dedup |
| **V-W2-OK** | Session create with 3 invitees | W2 | authenticated JWT, 3 UUIDs | 1 session + 4 participant rows (host + 3 guests) · out_rejected_count=0 | W2 happy path |
| **V-W2-OVER** | Server-side slice | W2 | 5 UUIDs | 4 rows, out_rejected_count=2 | W2 cap semantics |
| **V-W2-DUP** | Duplicate invitee in array | W2 | same UUID appears twice | one row for that UUID, no error | W2 dedup |
| **V-W2-AUTH** | W2 identity fail-closed | W2 | NULL sub | 42501 `caller_identity_required` | Case B W2 |
| **V-W3-UPDATE** | Join as pre-invited | W3 | pre-existing participant row with left_at=NULL, joined_at=NULL | out_was_update=TRUE · existing row updated · trigger does not fire (UPDATE path) | W3 update path |
| **V-W3-INSERT** | Cold join (no pre-invite) | W3 | no participant row yet | out_was_update=FALSE · new row with joined_at=NOW() · trigger fires | W3 insert path |
| **V-W3-ROLE** | Role rejection at RPC | W3 | p_role='cohost' | ERRCODE 22023, msg `invalid_role` BEFORE INSERT · mig-133 CHECK never reached | W3 cohost loophole closure |
| **V-W3-CAP** | Cold join to full session | W3 | session already has 4 rows, cold-join 5th | ERRCODE P0001, trigger message | GB-4CAP W3 |
| **V-W3-RACE** | Concurrent cold-joins | W3 | 2 parallel BEGINs each cold-join a 3-row session | FOR UPDATE serialises · one succeeds · other sees updated count | GB-4CAP W3 race |
| **V-W3-PROMOTE** | Session ringing→live | W3 | session in state='ringing' | out_session_promoted=TRUE · state='live' post-commit | W3 promotion |
| **V-W3-NOPROMOTE** | Session already live | W3 | session in state='live' | out_session_promoted=FALSE · state unchanged | W3 idempotent promote |
| **V-ATOMIC** | Transaction atomicity | W1 | force 4-cap breach mid-function (invite 5th when 4 present) | No session INSERT persisted if session was new in same tx · no peer_message row · no conversation row created in this transaction | Atomicity (indirect Case G) |
| **V-ROLLBACK-A** | MIG-A rollback restores mig-356 body | n/a | apply then rollback MIG-A | `prosrc` of nex_invite_to_call_tx equals mig-356 body text (byte compare after whitespace normalisation) | Rollback soundness |
| **V-ROLLBACK-B** | MIG-B rollback drops function | n/a | apply then rollback MIG-B | `pg_proc` has no row for nex_create_group_call_session_tx | Rollback soundness |
| **V-ROLLBACK-C** | MIG-C rollback drops function | n/a | apply then rollback MIG-C | `pg_proc` has no row for nex_join_group_call_session_tx | Rollback soundness |

**Expected outcomes derived from actual source,** not invented:
mig-133 cap-count semantics, v4 lock + whitespace guard, v5-W2 slice
+ loop, v5-W3 UPDATE-first+INSERT-fallback.

**Test identities.** The matrix requires at least 3 disposable test
accounts (A, B, C) and at least 2 disposable test sessions. None to
be Hammerex, Rosa, or any protected account. Accounts/sessions to be
named in the Gate A approval or on first run under Gate A authorisation.

**Authenticated-caller supply.** The RPCs require real `auth.uid()`
behaviour, which comes from Supabase JWT auth. Gate A preflight must
confirm how the test harness will mint JWTs:
- Option 1: Use existing test-fixture accounts' Supabase credentials
  from `.env.local` sandbox section (if present), logged via the
  Supabase client's `signInWithPassword`.
- Option 2: Use the Supabase admin API to create ephemeral auth
  users for each run, then clean them up (requires `service_role` key
  for admin auth API · still does not bypass auth.uid() in the RPC).
- Flag if neither is available.

**Unmatched live caller.** W3 (`joinGroupCallSession`) has no
grep-confirmed caller in `src/app/`. The V-W3-* tests still validate
the RPC itself but cannot exercise an end-to-end user journey. The
V-W3 severity classification remains THEORETICAL until a live caller
is identified or deliberately introduced (Gate B scope).

**Case G state.** Case G ("bounded intermediate-write fault") remains
a STATE_BLOCKER: PL/pgSQL does not expose a clean fault-injection
mid-function body. V-ATOMIC gives *indirect* evidence of atomicity
(observed state matches all-or-nothing transaction semantics) but
does not satisfy Case G as defined. Report as UNVERIFIED after Gate A
runs; do not relabel.

**No manufactured PASS.** Do not run V-* under `service_role`
posing as authenticated. Do not mock Supabase auth at the RPC layer.
Do not stub the RLS policy. Every PASS must be produced by an
authenticated JWT whose `sub` maps to a `nex_account.supabase_user_id`.

### 16.47.9 · Gate separation (A ≠ B)

**Gate A** (what §16.47.11 requests): read-only preflight · exact
SQL application of MIG-A/B/C · exact bounded connected tests from
§16.47.8 · bounded cleanup per §16.47.7 · reviewer/independent
observer re-review of post-apply state. Writes ONLY the migration
DDL and test-fixture rows. Does not wire live callers. Does not flip
NEX_INVITE_CALL_TX. Does not close GB-4CAP or GB-WHITESPACE-GUARD at
the "effectively live" tier — only at CONNECTED SQL tier.

**Gate B** (separately requested, only after Gate A evidence
reviewed): wiring of v5 wrappers into actual callers in
`_invite-actions.ts`, `_live-add-to-call-action.ts`,
`_add-to-call-action.ts` · independent caller/integration review ·
authenticated rendered journey checks (user-logged-in call-invite
button flow, cart-to-live transition) · any named activation flag
flip. Gate A authorisation does **not** imply Gate B. Gate B
authorisation does **not** imply activation beyond the named flag;
flag flip is itself a separately-sealed sub-step.

### 16.47.10 · Evidence-tier status after this round

| Tier | Status after §16.47 preparation |
|---|---|
| SOURCE | VERIFIED unchanged from §16.46.10 |
| UNIT | VERIFIED unchanged (51/51 vitest PASS) |
| CONNECTED SQL (deployment/signature/effective-grants) | UNVERIFIED — Gate A dependency |
| CONNECTED SQL (cap/whitespace/race behaviour) | UNVERIFIED — Gate A dependency |
| ACTIVATED CALLERS | UNVERIFIED — Gate B dependency |
| BROWSER | UNVERIFIED |
| PERSISTENCE | UNVERIFIED |
| PROVIDER | UNVERIFIED |
| PHYSICAL DEVICE | UNVERIFIED |
| Founder walkthrough | UNVERIFIED |
| Public launch readiness | NOT READY |

GB-4CAP: OPEN (unchanged). GB-WHITESPACE-GUARD: OPEN (unchanged).
No defect is closed by preparation alone.

### 16.47.11 · ONE complete Gate A approval request

> **GATE A · bounded sandbox application + connected verification · Lane G v5 batch**
>
> **Requesting approval for the following as a single atomic
> authorisation:**
>
> 1. **Target.** Supabase sandbox project ref `kdstoyyeygcopkogqsyv`.
>    Production `ijvqdvsvwtwxzcqmoqit` is explicitly excluded.
>    Connection source: `.env.local` `DATABASE_URL` whose pooler
>    username must be `postgres.kdstoyyeygcopkogqsyv` (hostname-
>    verified before any SQL runs, model
>    `scripts/apply-migration-258.mjs:54-60`).
>
> 2. **Preflight (READ-ONLY).** Before any write, run
>    §16.47.6 checks 1-8 and §16.47.3 `nex_migration_history` inspection.
>    If any check fails: STOP, report, do not proceed to writes.
>
> 3. **Final migration numbering.** Confirm whether `357/358/359`
>    are free (my proposal) or assign different numbers from the
>    first three unused values ≥ 357 observed in `nex_migration_history`.
>
> 4. **File moves (bounded).** Copy the three source SQL files from
>    `candidate-migrations/` to `nex-supabase/migrations/` under the
>    confirmed numbers, preserving contents byte-for-byte (SHA pins
>    §16.47.5). Preserve the candidate-migrations originals.
>    Author `scripts/apply-migration-{N}-sandbox.mjs` for each,
>    modeled on `apply-migration-315-sandbox.mjs`, with
>    `CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv"` pinned.
>
> 5. **Apply scope (WRITE).** Execute in order MIG-A → MIG-B → MIG-C.
>    Each migration runs inside its own `BEGIN; ... COMMIT;`.
>    **Stop on first error.** No bulk/broader cleanup. After each
>    apply, record exit code, duration, `nex_migration_history`
>    version row, and §16.47.7 post-check results.
>
> 6. **Grant envelope verification (WRITE-free).** Run §16.47.6
>    checks 1-8 again post-apply. Expected results stated in §16.47.6.
>    Any divergence → STOP, report, do not proceed to connected tests.
>
> 7. **Connected test matrix (WRITE, scoped).** Run V-DEP-*, V-GRANT-*,
>    V-AUTH-*, V-W1-*, V-W2-*, V-W3-*, V-ATOMIC, V-ROLLBACK-* from
>    §16.47.8. Test identities and session IDs to be a disposable
>    triple (A, B, C) created under this authorisation. **No Hammerex.
>    No Rosa. No protected account.** Maximum write scope per run:
>    the exact `INSERT`s produced by the RPC bodies plus the test
>    fixture setup.
>
> 8. **Cleanup permission.** Grant explicit permission for the scoped
>    DELETEs in §16.47.7 (rows matching test session_id and test
>    account_ids only). Without this permission, procedure is: stop
>    on failure, report retained rows with identity, do not retry
>    destructive cleanup.
>
> 9. **Rollback bounds.** Permission to run MIG-A/B/C rollback files
>    (self-contained in `candidate-migrations/`) **only if** the apply
>    or post-apply checks fail or produce unexpected state. Rollback
>    is a safety path, not an outcome of success. Rollback covers:
>    function body (A), function drop (B), function drop (C). It does
>    not cover `nex_migration_history` row cleanup (operator decides
>    history housekeeping separately). It does not cover test-fixture
>    row cleanup (see cleanup permission).
>
> 10. **Hard refusals that persist through Gate A.**
>     - No connection, no apply, no test against production
>       `ijvqdvsvwtwxzcqmoqit`.
>     - No wiring of v5 wrappers into any `src/app/` caller.
>     - No `NEX_INVITE_CALL_TX` flip.
>     - No commit or push of the apply scripts without a SEPARATE
>       explicit approval under the sealed push rule
>       (`feedback_nex_push_requires_separate_approval_2026_11_10.md`).
>     - No destructive broadening (table resets, bulk DELETE, trigger
>       disable, RLS alteration).
>
> 11. **Expected handback after Gate A execution.**
>     - Per-migration apply exit codes + `nex_migration_history` rows.
>     - §16.47.6 preflight + postflight check results (all 24 rows).
>     - V-* matrix pass/fail with evidence anchors (SQL + observed rows).
>     - Rollback outcome if invoked; retained-row inventory if cleanup
>       not permitted or failed.
>     - Updated §16.48 ledger section preserving §16.47.
>     - Recommendation for Gate B scope (or STOP if Gate A surfaces
>       blockers).
>
> **Gate A does NOT authorise Gate B.** The wrapper wiring, flag
> flip, and activated-caller journey checks require their own
> explicit approval after Gate A evidence is reviewed.

*End §16.47.*
