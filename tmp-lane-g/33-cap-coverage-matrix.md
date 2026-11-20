# Lane G · Cap Coverage Matrix
# Package: D (coordinator-authored after Explore tool-limit)
# Evidence tier: SOURCE_INSPECTED
# Banner: OFFLINE SOURCE INSPECTION ONLY · NO POSTGRES RUNTIME PROOF
# Date: 2026-11-19
# Context: §16.44.12 preserved · supplements §16.44 verification receipts

## Scope

Three INSERT writers against `nex_group_call_participant` identified by
coordinator-verified grep (8 raw `.from("nex_group_call_participant")`
hits reduced to 3 INSERT writers after classifying 5 SELECT/UPDATE hits
as cap-irrelevant · BEFORE INSERT trigger only fires on INSERT).

The mig-133 trigger `nex_group_call_participant_cap_tr` (checked-in
definition at `nex-supabase/migrations/133_nex_group_call.sql:83-102`)
runs `SELECT COUNT(*) FROM nex_group_call_participant WHERE session_id
= NEW.session_id` and raises if cnt ≥ 4. The deployed sandbox/prod
definitions are NOT inspected in this batch (source-review only).

## Matrix

### W1 · createCallInviteOrchestrated / inviteToCall (invite-service.ts)

- **Writer**: `inviteToCall` body · direct admin INSERT at line 287
  (nested inside the orchestrated helper reported by Package B as
  `createCallInviteOrchestrated` line ~285 · coordinator confirms line
  numbers drift by 1 · same function body).
- **Entry points**: `src/app/nex-native/call/preview/_invite-actions.ts:41`
  (`inviteToCall({...})`) from the `/nex-native/call/preview` route.
  No other grep-visible live callers in `src/app/`.
- **Participant mutation**: INSERT one row with columns
  `session_id`, `account_id` (= `input.inviteeAccountId`),
  `invited_at = NOW()`. One row per invocation.
- **Cap-count semantics (as described by the checked-in trigger)**:
  `SELECT COUNT(*) FROM nex_group_call_participant WHERE session_id =
  NEW.session_id` · counts ALL rows irrespective of `left_at` (the
  mig-133 invariant is "at most 4 rows ever per session" · NOT
  "4 active rows"). The invariant is preserved by the v4 candidate
  (Package C P3-H confirmed the model of this contract).
- **Lock/trigger protection evidenced in source**: The live INSERT at
  :287 holds **no session-row lock** · no `PERFORM 1 ... FOR UPDATE`
  precedes it in the TS code path (the `FOR UPDATE` lock exists ONLY
  in the candidate RPC body at
  `nex-supabase/candidate-migrations/CANDIDATE_nex_group_call_invite_
  v4_combined_whitespace_and_4cap_PREVIEW.sql` lines inside the
  function body · that RPC is applied to sandbox as mig-356 variant
  but NO TS caller invokes it in live code).
- **Ordering guarantees**: Serialised only by (a) UNIQUE(session_id,
  account_id) rejecting duplicate accounts in the same session, and
  (b) the trigger's `SELECT COUNT(*)`. Neither establishes strict
  ordering against a concurrent writer on the same session.
- **Authorization check**: TypeScript-side checks only · UUID shape
  validation at lines 224-238 · `enforceRateLimit(input.selfAccountId)`
  at line 240 · host/invitee country resolution. No DB-side identity
  check runs because the INSERT is issued via `nexSupabaseAdmin`
  (service_role · RLS bypassed). The RLS policy
  `nex_group_call_participant_insert_self` (mig-133 lines 153-157)
  is NOT evaluated on this path.
- **Dedup / retry behaviour**: `unique_violation` ("duplicate key" or
  "unique constraint" message match) → treated as success with
  `skipped: "already_invited"` at lines 294-300. No explicit retry.
- **Evidence**: `invite-service.ts:220-301` read directly 2026-11-19 ·
  `_invite-actions.ts:41` call chain grep-confirmed.
- **Uncertainty**: (i) Deployed trigger definition not inspected in
  this batch (DB gate closed) · (ii) actual Postgres isolation level
  at the Supabase pooler for admin inserts not verified · (iii) no
  behavioral evidence that the race fires in observed traffic ·
  (iv) no founder-walkthrough or physical-device signal.
- **Smallest proposed closure**: described in §Proposals below ·
  cannot be a one-line TS lock-insertion because
  `nexSupabaseAdmin.rpc(...)` or a bespoke pg client would be
  required to hold a transaction across SELECT FOR UPDATE and the
  participant INSERT · the current `.from(...).insert(...)` call
  shape cannot span a transaction with a prior SELECT FOR UPDATE.

### W2 · createGroupCallSession (group-call-service.ts)

- **Writer**: Loop INSERT at lines 102-117 · inserts 1-4 rows (host +
  up to 3 guests · pre-filtered via `.slice(0, 3)` at line 90).
- **Entry points** (grep-confirmed):
  - `src/app/nex-native/free-chat/call/_live-add-to-call-action.ts:70`
    ("live add-to-call" action)
  - `src/app/nex-native/chat/peer/[accountId]/_add-to-call-action.ts:55`
    (peer-chat add-to-call from the 1:1 chat UI)
- **Participant mutation**: INSERT row with `session_id`, `account_id`,
  `role` (`host` for first row, `guest` for the rest), `joined_at`
  (host only). Session row is also inserted at line 63-72 immediately
  prior (NEW session on each call · no `existingSessionId` reuse).
- **Cap-count semantics**: Same trigger as W1.
- **Lock/trigger protection evidenced in source**: NO session-row
  lock. Session was just created at line 63-72 in this same
  invocation so no other writer sees it yet. Each `.insert()` in the
  loop is a SEPARATE Supabase HTTP call · they are NOT wrapped in a
  single transaction · sequential but not atomic.
- **Ordering guarantees**: The loop is sequential within one caller
  but not serialised against any other writer. In practice W2 is the
  SOLE WRITER on this newly-created session_id for the duration of
  the loop · a concurrent W1 or W3 on the same session_id would
  require the session_id to leak to another caller before W2
  completes (not grep-evident). Client-side `.slice(0, 3)` enforces
  the 4-cap pre-emptively · the trigger is a backstop only.
- **Authorization check**: TypeScript-side (callers must have mapped
  `hostAccountId` to an authenticated session · verified at the
  action layer not shown in this matrix). Admin INSERT bypasses RLS.
- **Dedup / retry behaviour**: On `error.code === "23505"` (unique
  violation) at line 111 · skip this row and continue the loop.
  Comment at line 110 says `P0001 = our 4-cap trigger · skip + bump
  rejected` but the actual branch only matches 23505 · P0001 would
  hit the `throw new Error` branch at line 112 · this is a potential
  contract drift between the comment and code but OUT OF SCOPE for
  this matrix (coordinator notes only).
- **Evidence**: `group-call-service.ts:42-120` read directly 2026-11-19.
- **Uncertainty**: (i) Same DB-definition uncertainty as W1 ·
  (ii) if the session_id is somehow published to a concurrent writer
  before the loop completes, race window exists · not grep-evident ·
  (iii) 4-cap enforcement is primarily CLIENT-SIDE via `.slice(0, 3)`
  not server-side here · a bug or caller passing more than 3
  invitees still gets stopped at the trigger, but silently loses
  invitees via slice without surfacing `rejectedCount` to the user
  (line 97-99 computes it but exposing it is caller responsibility).
- **Smallest proposed closure**: §Proposals below · W2 benefits
  LEAST from a per-row FOR UPDATE because the session is new and
  self-owned for the duration of the loop · the race window is
  theoretical absent evidence of concurrent-caller publication of
  the new session_id.

### W3 · joinGroupCallSession (group-call-service.ts)

- **Writer**: Fresh-INSERT fallback at lines 177-195 · fires only
  when the UPDATE at line 161-167 found no pre-invite row.
- **Entry points**: NO LIVE CALLERS grep-confirmed in `src/app/`.
  The function is exported and imported by callers not visible in
  the grep pattern used (coordinator inspected only `.ts` matches
  of the function name). Package B's MEDIUM severity flag on this
  writer is theoretical absent a grep-confirmed live caller.
- **Participant mutation**: INSERT row with `session_id`,
  `account_id`, `role` (default `guest`), `joined_at = NOW()`.
- **Cap-count semantics**: Same trigger as W1.
- **Lock/trigger protection evidenced in source**: NO session-row
  lock. The UPDATE-first pattern at line 161-167 mitigates the
  COMMON case (pre-invited row exists · UPDATE is non-cap-triggering)
  but a fresh JOINER (no prior invite row) races the same trigger
  with any concurrent W1 invite on the same session_id.
- **Ordering guarantees**: UPDATE-first at line 161 narrows the
  race window to "joiner who was NOT pre-invited" · relies on the
  caller to have performed some gate (presumably the call-link
  flow) that admits the account to the session.
- **Authorization check**: Caller provides `accountId` directly ·
  admin INSERT bypasses RLS · no DB-side mapping of `auth.uid()` to
  account.
- **Dedup / retry behaviour**: `insErr.code === "23505"` returns null
  (line 189) · treated as "already a participant · race with
  another join" · no explicit retry. Comment at line 188 names the
  intended semantic.
- **Evidence**: `group-call-service.ts:150-196` read directly 2026-11-19.
- **Uncertainty**: (i) No live caller grep-found · severity may be
  purely theoretical · (ii) same DB-definition uncertainty as W1 ·
  (iii) call-link admission flow NOT traced in this batch.
- **Smallest proposed closure**: Same shape as W1 · requires a
  transaction spanning SELECT FOR UPDATE + INSERT · the current
  `.from(...).insert(...)` shape cannot express this.

## Trigger-coverage summary

The mig-133 cap trigger body (checked-in definition only · not DB-
inspected this batch) performs `SELECT COUNT(*) ... WHERE session_id =
NEW.session_id` without an explicit lock. Postgres documents this
behaviour: under READ COMMITTED (the default isolation level), a
statement sees rows committed before the statement started · not
rows inserted by a concurrent transaction that has not yet committed.
Two concurrent INSERTs into the same session, each starting when
count=3, would each see count=3 in their trigger's SELECT (neither
sees the other's uncommitted row), each pass the `cnt < 4` check,
each proceed to insert, and both commit · producing count=5.

This is documented Postgres isolation behaviour, not a runtime
anomaly, and it is the race Package B names in its uncoveredCap
WritePaths entries. Package C case P3-E modelled this in JavaScript
and marked it PASS against the v4 behaviour (where FOR UPDATE on the
session row serialises the two trigger-firing INSERTs). The JS
model does NOT prove PostgreSQL concurrency behaviour · it is
illustrative of the contract only.

The v4 candidate RPC body (file above) adds `PERFORM 1 FROM
nex_group_call_session WHERE id = v_session_id FOR UPDATE` BEFORE
the participant INSERT. Under READ COMMITTED, the second concurrent
transaction blocks on this lock until the first commits · at which
point its own COUNT(*) sees the newly-inserted row and the trigger
raises. This serialises the race against the invariant.

## Why standalone v4 application does NOT close current coverage

- All three live writer paths (W1, W2, W3) issue direct
  `nexSupabaseAdmin.from("nex_group_call_participant").insert(...)`
  calls · none invoke `admin.rpc("nex_invite_to_call_tx", ...)`.
- The only TS caller of the RPC is `src/lib/nex-native/calls/invite-
  service.transactional-candidate.ts:102` which is unapplied
  candidate code · not imported by any route in `src/app/`.
- Applying v4 to sandbox or production, without a caller rewire or
  flag flip, leaves W1/W2/W3 using the exact same lock-less pattern
  they use today. The function body changes · the TypeScript call
  chain does not.
- Therefore standalone v4 application would close GB-4CAP only for
  callers of the RPC · and no current application caller invokes the
  RPC. The reported source-review finding (Package B JSON
  `unverifiedNotes[4]`) and coordinator verification both support
  this.

This is a SOURCE-REVIEW conclusion based on checked-in source · not a
runtime demonstration of any production race.

## Proposals for the minimal cap-coverage closure (NOT RECOMMENDED · NOT EXECUTED)

Three families of minimal closure exist. This matrix describes their
shape and trade-offs. **No recommendation is made here**; the
coordinator will summarise and name the single minimal proposal in
the HQ diagram and §16.45 ledger section · all three require their
own separately-authorised implementation gate.

### Option A · Route all three writers through the v4 RPC

- Change: W1, W2, W3 call `admin.rpc("nex_invite_to_call_tx", {...})`
  instead of direct `.insert()`. Requires an RPC signature that
  accepts the superset of inputs (or three RPCs / branched calls).
- Covers: all 3 writers.
- Preserves: SECURITY DEFINER identity checks · adds `FOR UPDATE`
  serialisation per writer invocation.
- Risks: (i) `createGroupCallSession` ALSO inserts the session row
  itself · the current RPC assumes session already exists or is
  created inside its own body (session-create happens inside the
  function at the `IF p_existing_session_id IS NOT NULL ELSE INSERT`
  branch) · the RPC's session-create path may not support the
  `from_call_link_id` or multi-invitee shape that
  `createGroupCallSession` needs. (ii) `joinGroupCallSession` writes
  `joined_at` + `role` which the current RPC does NOT accept as
  parameters · an RPC extension is required · which drifts the v4
  candidate out of its byte-additive envelope and requires its own
  review/rollback cycle.
- Gate separation: Caller rewires PROHIBITED · RPC signature
  extension PROHIBITED · flag flip PROHIBITED · sandbox application
  PROHIBITED until separately authorised.

### Option B · Add a session-row FOR UPDATE wrapper at each writer

- Change: Each writer acquires a short pg transaction that executes
  `SELECT 1 FROM nex_group_call_session WHERE id = $1 FOR UPDATE`
  then the participant INSERT, inside the same transaction.
- Covers: all 3 writers (W1 and W3 benefit most; W2 gets a theoretical
  tightening).
- Preserves: existing RPC and candidate SQL · no DB-side change needed.
- Risks: (i) Supabase JS client's `.from(...).insert(...)` cannot
  express a transaction with a prior SELECT · would require a raw
  `rpc()` call OR a bespoke pg client with pooled connections ·
  this is a MAJOR behavioural change for the invite surface (new
  code path · new error modes · new timeout semantics).
  (ii) Admin role runs OUTSIDE RLS · the FOR UPDATE must be issued
  with the same auth as the subsequent INSERT or correctness is
  lost · service_role satisfies this but changes the identity story.
  (iii) FOR UPDATE under service_role on session rows may introduce
  deadlock patterns not currently present if callers obtain the
  lock in inconsistent order across writers · a lock-order review is
  owed before commit.
- Gate separation: Same as Option A · NO caller rewire · NO new
  transaction-handling infrastructure authorised this batch.

### Option C · Narrow trigger predicate to make the race self-closing

- Change: Mig-NN replaces the cap trigger with a statement that
  takes an advisory lock keyed by session_id, or issues `SELECT 1
  FROM nex_group_call_session WHERE id = NEW.session_id FOR UPDATE`
  from inside the trigger body before the COUNT.
- Covers: all writers transparently (no TS change).
- Preserves: existing writer contract · existing RPC · existing
  candidate SQL.
- Risks: (i) New migration · new rollback · new review cycle ·
  drifts outside the Lane G v4 envelope. (ii) In-trigger FOR UPDATE
  changes lock acquisition timing · a bulk-create path like W2's
  loop would now serialise against itself across its 4 iterations ·
  measurable latency cost · pattern not currently proven.
  (iii) Cannot redefine the invariant from "4 rows ever" to
  "4 active rows" without separately gated semantic change.
- Gate separation: Requires its own migration-authorship +
  sandbox-apply + rollback-draft cycle · PROHIBITED this batch.

## Residual uncovered coverage after any option

- Deployed trigger definition remains unverified against the
  checked-in source (DB connection gate closed).
- Postgres isolation level at the Supabase pooler not verified in
  this batch.
- No behavioural evidence (browser, persistence, provider, device)
  that any race fires in practice.
- Case B (NULL auth.uid fail-closed) remains UNVERIFIED.
- Case G (intermediate-write fault) remains STATE_BLOCKER.
- Case supplied-identity mismatch remains INAPPLICABLE (no caller
  passes selfSupabaseUserId in the current contract).

## Honest limitations

This matrix is a source-inspection product. It does NOT prove any
PostgreSQL race or demonstrate a production exploit. The mig-133
trigger analysis is based on the checked-in SQL · not on the
deployed sandbox or production function definition. Any proposed
closure requires separately-authorised implementation, sandbox
inspection, and connected verification before being considered
remediated.
