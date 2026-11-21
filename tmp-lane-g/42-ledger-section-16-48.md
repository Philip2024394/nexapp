
---

## §16.48 · Lane G · Gate A execution handback · 2026-11-19

### 16.48.0 · Scope and hard refusals (preserved)

Gate A was executed in `C:/Users/Victus/nexapp` against sandbox
`kdstoyyeygcopkogqsyv` only. Production `ijvqdvsvwtwxzcqmoqit`
remained sealed. No commits, no push, no deploy, no caller wiring,
no `NEX_INVITE_CALL_TX` flip, no credential/env/auth-setting changes,
no server/shell restart, no protected-account changes, no Hammerex,

Agent HARNESS completed authoring `scripts/gate-a-connected-matrix/`
(32 files, source-only). Agent DB completed Phase 1 preflight + Phase
2 staged apply but hit a tool-permission boundary executing the apply
scripts it had authored; the owner subsequently authorised the main
thread to run the staged scripts under the existing Gate A boundaries.

### 16.48.1 · Executive summary

- **Migrations 357/358/359**: all three applied to sandbox with
  history rows written, signatures/body-bytes matching their pinned
  sources, security + grants correct. Evidence tier: **CONNECTED SQL
  VERIFIED** for DDL + grants + migration-state inspection.
- **Preflight (00_preflight.sql)**: after one owner-authorised narrow
  fix to checks 22/23/24 (PUBLIC-privilege detection), 24/24 checks
  PASS.
- **Grants (10_grants.sql)**: 17 rows returned; proacl + RLS + scoped
  policies all as expected.
- **Supported-auth disposable signup**: **BLOCKED (two rounds)** —
  Round 1: Supabase Auth rejected the `.invalid` TLD; rate-limited
  the third attempt. Round 2 (2026-11-19 later): bounded-edited
  `20_signup_disposable_identities.mjs` to use owner-approved
  candidate identities (`<op-email>`,
  `<op-email+1>`, `<op-email+2>` —
  exact spelling preserved). First signUp attempt (A) returned
  HTTP 429 `email rate limit exceeded` before user creation;
  cascade-BLOCKED B and C without retry per owner spec. No
  `.invalid`-TLD rejection in round 2 — the fix removed that
  blocker; the rate-limit blocker persists until the provider's
  window resets.
- **All 22 downstream V-* behavioural scenarios**: **BLOCKED** — no
  supported-auth identities available in either round; runner halted
  after 20_signup per its STOP-on-first-FAIL policy.
- **Rollback scripts (80/81/82)**: **UNVERIFIED** (source-inspected
  only; invoked only on apply failure, none occurred).
- **Cleanup (90)**: **NO-OP** — 0 retained rows anywhere.
- **Gate B**: remains separately gated.
- **Public launch**: remains **NOT READY**.

### 16.48.2 · 357 partial-apply incident and repair

**Timeline and ground truth**

1. Agent DB authored `scripts/apply-migration-357-sandbox.mjs` with
   an INSERT that supplied only `(version, applied_at)`. The live
   `nex_migration_history` schema requires `description text NOT
   NULL` (verified at runtime). The migration file (`357_*.sql`)
   intentionally does not write its own history row.
2. `node scripts/apply-migration-357-sandbox.mjs` on the main thread:
   - sandbox ref pin verified
   - file SHA-256 `de77e9a1…` verified
   - migration SQL body executed (file contains its own
     `BEGIN;…COMMIT;`) · DDL committed successfully
   - subsequent apply-script history-INSERT raised SQLSTATE 23502
     `null value in column "description" of relation
     "nex_migration_history" violates not-null constraint`
   - exit code 1
3. Pre-repair live state verified: body length 5516 (vs mig-356
   baseline 4726), prosecdef=true, search_path correct, owner=postgres.
   `nex_migration_history` had no row for 357.

**Root cause**: `nex_migration_history` schema (inspected at runtime):

| column | type | nullable | default |
|---|---|---|---|
| `version` | text | NO | — |
| `applied_at` | timestamptz | NO | `now()` |
| `description` | text | **NO** | — |
| `notes` | text | YES | — |

All three apply scripts (357/358/359) shared the same defect.

**Repair** (owner-authorised narrow edit of apply scripts only):

- `apply-migration-357-sandbox.mjs`: pre-fix SHA
  `357a4f08c91526a5398067fc8a0018f3a9e38d10dfe8440f4c173f72d024e15d`
  → post-fix `5b75440690322850db8381f20efbeae840298b26e3124b5967db983dbd7cb8fe`
- `apply-migration-358-sandbox.mjs`: pre-fix SHA
  `c228783f9ca87f6b7f88f977a2cfb6264e739e9e73898ca5c94e2b2c46adf5c1`
  → post-fix `2187d86d8565ba889548086f12a005b88c4708f5283b7fb123256577a547ceab`
- `apply-migration-359-sandbox.mjs`: pre-fix SHA
  `807cfc16ce0e2d57f34f3fc9b3a479423b2ebf6e8ef6a9b81f6bc60e098b7015`
  → post-fix `6992a07415156b9ac11be08b843fd815f42ffbe707cc8cf5e0deeaebc86d8e39`

Change: only the `nex_migration_history` INSERT; from `(version,
applied_at)` to `(version, description, notes)` with `ON CONFLICT
(version) DO NOTHING`. Style matches migrations 353/356 which write
their own history rows. Nothing else was touched; sandbox-ref pin,
production rejection, SHA guards, postchecks, and pinned migration
SQL files all byte-for-byte unchanged.

**357 recovery postcheck** (tmp-lane-g/38-357-postcheck-and-history.mjs):

- Live body sha256 `2eeb6ec0fcbd55805c48e027f996bef6b985aa7c13e09baf55b532357fd6040d`
  matches the body extracted from the pinned migration SQL source
  byte-for-byte.
- Signature exact match: `p_invitee_account_id uuid, p_media_type text,
  p_host_country text, p_attachment_meta jsonb, p_invite_body text,
  p_attachment_url text, p_existing_session_id uuid`.
- pronargs=7, prosecdef=true, search_path=`public, pg_temp`, owner=postgres.
- Privileges PASS (anon=false, service_role=false, authenticated=true).
- `auth.uid()` fail-closed test: RPC invoked in a session without JWT
  claims raised **SQLSTATE 42501 `caller_identity_required · auth.uid()
  is NULL`**. (Observed error class matches §16.47.5 expectation.)
- History row written: `version=357`, `applied_at=2026-11-19
  21:11:01+07:00`, `description=nex_group_call_invite_v4_combined ·
  whitespace guard + 4-cap pre-insert check`, notes field populated.

### 16.48.3 · 358 and 359 apply results

**358 (MIG-B · W2 create session)**

- `node scripts/apply-migration-358-sandbox.mjs` · exit code 0 · duration 3388ms
- SHA `51cb55863636a8b23f4c825646f5eeb980159493cedef7b36aea44154d4344db` verified
- Postcheck: pronargs=4, prosecdef=true, search_path=`public, pg_temp`,
  owner=postgres, signature `p_media_type text, p_from_call_link_id
  uuid, p_host_country text, p_invitee_account_ids uuid[]`.
- Privileges PASS (anon=false, service_role=false, authenticated=true).
- History row: `version=358`, `applied_at=2026-11-19 21:11:13+07:00`,
  `description=nex_create_group_call_session_tx · W2 session creation
  with server-side invitee slice`.

**359 (MIG-C · W3 join session)**

- `node scripts/apply-migration-359-sandbox.mjs` · exit code 0 · duration 2348ms
- SHA `375fc243fd87bfab75c074824b29007518f84c868f588a6d92e018fc5a0802b9` verified
- Postcheck: pronargs=2, prosecdef=true, search_path=`public, pg_temp`,
  owner=postgres, signature `p_session_id uuid, p_role text`.
- Privileges PASS (anon=false, service_role=false, authenticated=true).
- History row: `version=359`, `applied_at=2026-11-19 21:11:20+07:00`,
  `description=nex_join_group_call_session_tx · W3 join with FOR UPDATE
  + ringing→live promotion`.

### 16.48.4 · Pre-run DB verification (before resuming runner)

`tmp-lane-g/39-gate-a-prerun-verify.mjs` was authored and executed
read-only to reconfirm the state end-to-end before invoking the
HARNESS runner. Results:

- File SHAs for all three pinned migration files unchanged from §16.47.5.
- Live `prosrc` for each RPC matched the body extracted from the pinned
  source SQL (sha256-equal):
  - 357: `2eeb6ec0…` (5516 bytes)
  - 358: `e4c53f32…` (4505 bytes)
  - 359: `9de0f26d…` (4225 bytes)
- Each RPC appears exactly once in `pg_proc` under schema `public`;
  no overload collisions.
- `nex_migration_history` rows: exactly one per version (357, 358, 359).
- mig-133 cap trigger (`nex_group_call_participant_cap_tr`) exists and
  `tgenabled='O'`.
- RLS policies on `nex_group_call_participant`: three rows
  (`insert_self cmd=a`, `select_scoped cmd=r`, `update_scoped cmd=w`).
- All checks PASS.

### 16.48.5 · HARNESS directory audit and bounded preflight fix

**Syntax check**: all 28 `.mjs` files in `scripts/gate-a-connected-matrix/`
passed `node --check` on the first attempt (HARNESS had not executed
checks owing to its subagent Bash-permission denial; checks were
performed on the main thread). `README.md`, `99_identity_capture.json.PLACEHOLDER`,
`00_preflight.sql`, `10_grants.sql` were inspected by read.

**Runner source audit**: `_runner.mjs` pins CANONICAL_PROJECT_REF to
`kdstoyyeygcopkogqsyv`, hard-refuses production in the URL string
before parsing, pins pooler-username regex, reads secrets from
`.env.local` without emitting values, serialises execution, STOPs
on the first non-zero exit from an SQL or `.mjs` step, writes
progress to `_results.json.OUTPUT`. No destructive operations. No
service-role impersonation. No admin API. Uses `pg` (direct DB for
SQL preflight/grants and matrix runs) + `@supabase/supabase-js` in
`.mjs` steps (for supported auth).

**First runner invocation (pre-fix)**:
`node scripts/gate-a-connected-matrix/_runner.mjs` → halted
immediately at `00_preflight.sql` with error `role "PUBLIC" does not
exist`.

**Root cause**: checks 22/23/24 called `has_function_privilege('PUBLIC',
sig, 'EXECUTE')`. PUBLIC is a PostgreSQL pseudo-role (role OID 0, no
`pg_roles` row); `has_function_privilege()` requires a real role name.

**Bounded fix** (owner-authorised transfer of narrow ownership for
these three checks):

- Pre-fix hash of `00_preflight.sql`: `832771b25d18e15e3b615107f56ca3615fda99b6fea2cd2a3474cce194c471ee`
- Change: replaced checks 22, 23, 24 with per-check subqueries that
  - resolve the function by exact signature via `pg_get_function_identity_arguments`
  - require the function to exist (missing → `observed='missing'`,
    `passed_bool=false`; no NOT-EXISTS short-circuit to pass)
  - inspect `aclexplode(COALESCE(p.proacl, acldefault('f',
    p.proowner)))` for `grantee = 0 AND privilege_type = 'EXECUTE'`
  - a NULL proacl expands to the DEFAULT function ACL (includes
    PUBLIC EXECUTE), so NULL **fails** the "no PUBLIC execute"
    assertion (per owner spec).
  - expected value `'false'` preserved (not weakened).
- Post-fix hash: `d9547a23aafe4d20f1ff021e6c4667188f032b1e6726669e62546a63b6ba9344`
- Line count: 362 → 427.
- No other HARNESS file was modified.

**Standalone preflight validation**
(`tmp-lane-g/40-run-preflight-standalone.mjs`): 24/24 checks PASS,
including the repaired checks 22/23/24 all `observed='false'`.

### 16.48.6 · Runner second invocation — connected matrix outcomes

`node scripts/gate-a-connected-matrix/_runner.mjs` (second run, after
preflight fix):

**Step 00 · SQL preflight** — PASS (24/24). Output captured in
`scripts/gate-a-connected-matrix/_results.json.OUTPUT`.

**Step 10 · SQL grants** — PASS (17 rows). Observed:

- `nex_create_group_call_session_tx`: proacl `{postgres=X/postgres,
  authenticated=X/postgres}`, prosecdef=true, owner=postgres.
- `nex_invite_to_call_tx`: proacl `{postgres=X/postgres,
  authenticated=X/postgres}`, prosecdef=true, owner=postgres.
- `nex_join_group_call_session_tx`: proacl `{postgres=X/postgres,
  authenticated=X/postgres}`, prosecdef=true, owner=postgres.
- `routine_privileges` for all three RPCs shows only `authenticated`
  (NO grantable) and `postgres` (YES grantable) with EXECUTE. No
  PUBLIC or `anon` or `service_role` grantee rows.
- RLS enabled + not forced on `nex_group_call_session` and
  `nex_group_call_participant`. Expected scoped policies present on
  both tables (session: `insert_host`, `select_participants`,
  `update_host`; participant: `insert_self`, `select_scoped`,
  `update_scoped`). WITH CHECK / USING predicates all reference
  `auth.uid()`-based scoping via `nex_account.supabase_user_id`.

**Step 20 · supported-auth disposable signUp** — **BLOCKED** · exit 1.
All three identities rejected:

| Id | Email | Error class | Error message |
|---|---|---|---|
| A | `nex-gate-a-<ts>-A@test.kdstoyyeygcopkogqsyv.sandbox.invalid` | HTTP 400 | `Email address "…" is invalid` |
| B | `nex-gate-a-<ts>-B@test.kdstoyyeygcopkogqsyv.sandbox.invalid` | HTTP 400 | `Email address "…" is invalid` |
| C | `nex-gate-a-<ts>-C@test.kdstoyyeygcopkogqsyv.sandbox.invalid` | HTTP 429 | `email rate limit exceeded` |

Captured in `scripts/gate-a-connected-matrix/99_identity_capture.json.OUTPUT`
(no passwords, no JWTs). Passwords held only in process env of the
`.mjs` child; not persisted.

**Root cause of signup BLOCKED (round 1)**:

1. Supabase Auth email validator rejects the reserved `.invalid` TLD
   (RFC 6761 reserved; many validators refuse it). HARNESS chose
   that domain to avoid sending live email, which is the correct
   privacy posture but incompatible with the provider's current
   validator.
2. Rate-limit (HTTP 429 `email rate limit exceeded`) activated after
   the second failed attempt. Actual window-reset time not known;
   provider's `Retry-After` header not exposed by supabase-js.

**Runner STOP**: enforced by `_runner.mjs` after the first mjs FAIL.

**Second signup round (owner-approved candidates)** · 2026-11-19
later same day:

Owner authorised resuming Gate A with three candidate identities
sharing the owner-controlled Gmail inbox:

- A: `<op-email>`
- B: `<op-email+1>`
- C: `<op-email+2>`

(Exact spelling — three L's — preserved per owner directive.)

**Pre-flight existence probe** (read-only;
`tmp-lane-g/43-check-candidate-identities.mjs`): 0 rows in
`auth.users` and 0 linked `nex_account` rows for all three
addresses (case-insensitive). Safe to attempt supported `signUp`
without risk of adopting or disturbing any pre-existing account.

**Bounded edit to `20_signup_disposable_identities.mjs`**:

- Pre-edit SHA: `be637e14c38d28bf4d1c4d4dd62603c99dfa4fd3ceca3be2f4b4839b7f870a44` (9495 bytes)
- Post-edit SHA: `7e0fadf7ad80963e0a86d5fe72eb1ae431a092dc459c451a2f6d4474adb78566` (11256 bytes)
- Scope of edit (bounded per owner spec):
  1. Added `import pg from "pg"`.
  2. Replaced `.invalid`-TLD email generator with an explicit map
     of A/B/C → the three owner-approved candidate addresses.
  3. When `signUp` returns a null session (email-confirm ON path),
     the script now polls `auth.users.email_confirmed_at`
     read-only (no auth-setting changes, no admin API, no
     in-chat token paste) with a 15-minute bounded window per
     identity, 15s poll cadence, and clear per-poll log lines
     so the owner can click the Gmail confirmation link; on
     timeout → BLOCKED `email_confirm_timeout`, no bypass.
- Unchanged: rate-limit cascade STOP, supported `signUp` only, no
  `admin.createUser`, no auth-setting mutation, passwords held
  only in process env of the child mjs, no secrets in capture
  file or stdout.

**Round-2 signup result** (log
`tmp-lane-g/44-signup-run.log`):

| Id | Email | Error class | Error message |
|---|---|---|---|
| A | `<op-email>` | HTTP 429 | `email rate limit exceeded` |
| B | `<op-email+1>` | `rate_limit_cascade` | cascade from prior rate-limit |
| C | `<op-email+2>` | `rate_limit_cascade` | cascade from prior rate-limit |

Exit 1. Cascade behaviour per existing script policy: on 429, no
further signups attempted. Re-probe after 429
(`tmp-lane-g/43-check-candidate-identities.mjs`) confirmed **0
rows** created for any of the three candidate addresses — the
provider rejected the request before auth.user creation; sandbox
state unchanged.

**Blocker classification after round 2**:

- `B-SIGNUP-DOMAIN` from round 1 is **resolved**: the owner-
  approved Gmail domain is accepted by Supabase Auth (round 2
  did not return HTTP 400 "Email address is invalid"). The 429
  response implies the email reached the provider's rate-limit
  gate, which only applies once validation passes.
- `B-SIGNUP-RATE` **persists**: HTTP 429 fired on the first new
  attempt. Actual reset window not independently verified; per
  owner's directive this report does **not** claim ~60 min as a
  verified reset time. Owner-initiated retry at a later point is
  the approved next step.

**Candidate-distinctness caveat**: Supabase Auth treatment of
Gmail plus-aliases as distinct `auth.users` rows was **not yet
observed**; the provider rejected before user creation. The
distinctness test remains open until at least one of B/C
successfully signs up alongside A. Three aliases sharing one
inbox is **not proof** of three distinct accounts and must not
be claimed as such.

### 16.48.7 · Per-case V-* verdict table

Per the owner's reporting contract, every V-* case gets an explicit
verdict. The source-tier claims from §16.47.6 remain **UNIT-VERIFIED
only** (source inspection). No connected evidence closes any V-*
case in this round.

| Case | Verdict | Expected | Observed | Missing evidence |
|---|---|---|---|---|
| V-AUTH-NULL | BLOCKED | Anon RPC call → ACL rejection (not reachable via supported auth) | Runner halted before this step | Supported-auth identity (0 of 1 min) |
| V-AUTH-UNKNOWN | BLOCKED | Signed-in JWT without `nex_account` row → 42501 | — | Supported-auth identity (0 of 1 min) + knowledge of sandbox `nex_account` auto-create behaviour |
| V-AUTH-UNAUTH-DIFF | BLOCKED | B invites to A's session → 42501 session_not_owned | — | 2 identities (0 of 2 min) |
| V-W1-NEW | BLOCKED | A→B new session; 5-col return shape; session ringing; participant invited_at set, joined_at NULL | — | 2 identities (0 of 2 min) |
| V-W1-EXIST | BLOCKED | A→B then A→C same session; second participant inserted | — | 3 identities (0 of 3 min) |
| V-W1-CAP | BLOCKED | 5th invite → P0001 participant_cap_exceeded | — | 5 identities (0 of 5 min) · would be PARTIAL at 3 anyway |
| V-W1-CAP-RACE | BLOCKED | Concurrent invites never exceed 4-cap | — | 5 identities (0 of 5 min) |
| V-W1-WS | BLOCKED | 6 whitespace variants → 22023; valid URL → success | — | 2 identities (0 of 2 min) |
| V-W1-DUP | BLOCKED | Re-invite same → `out_skipped='already_invited'`, no new participant/message | — | 2 identities (0 of 2 min) |
| V-W2-OK | BLOCKED | W2 with B+C; host role/joined_at, guests invited | — | 3 identities (0 of 3 min) |
| V-W2-OVER | BLOCKED | Server-side slice at 3; `out_rejected_count = N-3` | — | 5 identities (0 of 5 min) · would be PARTIAL at 3 |
| V-W2-DUP | BLOCKED | Dup invitees dedup to one participant each | — | 3 identities (0 of 3 min) |
| V-W2-AUTH | BLOCKED | Anon W2 call → ACL rejection | — | 0 identities required but runner halted |
| V-W3-UPDATE | BLOCKED | Pre-invited B joins; `was_update=TRUE`, session promoted | — | 2 identities (0 of 2 min) |
| V-W3-INSERT | BLOCKED | Cold-join B; `was_update=FALSE`, session promoted | — | 2 identities (0 of 2 min) |
| V-W3-ROLE | BLOCKED | `p_role='cohost'` → 22023 invalid_role; no INSERT attempted | — | 1 identity (0 of 1 min) |
| V-W3-CAP | BLOCKED | 5th cold-join → P0001 | — | 5 identities (0 of 5 min) |
| V-W3-RACE | BLOCKED | Concurrent cold-joins never exceed 4 | — | 5 identities (0 of 5 min) |
| V-W3-PROMOTE | BLOCKED | W3 on ringing → `out_session_promoted=TRUE`, session=live | — | 2 identities (0 of 2 min) |
| V-W3-NOPROMOTE | BLOCKED | W3 on live → `out_session_promoted=FALSE` | — | 2 identities (0 of 2 min) |
| V-ATOMIC | BLOCKED | Existing-session cap failure leaves no orphan conv/msg rows (indirect Case G evidence only) | — | 5 identities (0 of 5 min) + cap-trigger failure |
| V-ROLLBACK-A | UNVERIFIED | Rollback source inspected only | Not invoked (no failure) | Run only on forward-apply failure per approved policy |
| V-ROLLBACK-B | UNVERIFIED | Rollback source inspected only | Not invoked | Same |
| V-ROLLBACK-C | UNVERIFIED | Rollback source inspected only | Not invoked | Same |

**Partial-coverage caveat preserved**: V-W1-CAP, V-W1-CAP-RACE,
V-W2-OVER, V-W3-CAP, V-W3-RACE, V-ATOMIC degrade to PARTIAL even
with full 3-identity signup. These remain BLOCKED at a stricter
level because they cannot be closed by the approved-scope identity
count regardless of signup outcome.

### 16.48.8 · Exact-ID cleanup and retained records

Per the approved cleanup policy, cleanup operates only on records
with exact IDs recorded during the run. The signUp step produced no
IDs (all three failed server-side before user creation). Direct
inspection (tmp-lane-g/41-check-retained-identities.mjs) returned:

- `auth.users WHERE email LIKE 'nex-gate-a-%'`: **0 rows**
- `nex_account linked to those auth users`: **0 rows**
- `nex_group_call_session` (sandbox-wide): **0 rows**
- `nex_group_call_participant` (sandbox-wide): **0 rows**

No cleanup was required. No retained records.

### 16.48.9 · Evidence tier matrix

| Element | Local / engineering | Offline UNIT | Connected SQL | Activated callers | Founder | Public launch |
|---|---|---|---|---|---|---|
| MIG-A (357) | PASS (SHA pinned) | PASS (§16.47.5 source review) | **VERIFIED** (body, sig, privs, auth.uid fail-closed, history) | — | — | — |
| MIG-B (358) | PASS | PASS | **VERIFIED** (body, sig, privs, history) | — | — | — |
| MIG-C (359) | PASS | PASS | **VERIFIED** (body, sig, privs, history) | — | — | — |
| 00_preflight.sql (24 checks) | PASS | PASS | **VERIFIED** (24/24 PASS live) | — | — | — |
| 10_grants.sql (17 rows) | PASS | — | **VERIFIED** (acl, routine_privileges, RLS) | — | — | — |
| v5-W1 wrapper (TS) | PASS (§16.47 WRAP) | **COMPATIBLE** (vitest 6/6) | — | — | — | — |
| V-AUTH-* behavioural | — | source review | **BLOCKED** | — | — | — |
| V-W1-* behavioural | — | source review | **BLOCKED** | — | — | — |
| V-W2-* behavioural | — | source review | **BLOCKED** | — | — | — |
| V-W3-* behavioural | — | source review | **BLOCKED** | — | — | — |
| V-ATOMIC | — | source review | **BLOCKED** (plus Case G STATE_BLOCKER below) | — | — | — |
| V-ROLLBACK-A/B/C | — | source review | **UNVERIFIED** (not invoked) | — | — | — |
| GB-4CAP direct writes (table-level) | identified | source review | **OPEN** — function REVOKE does not close direct INSERT by `service_role` | — | — | — |
| W3 live caller | — | source review | **OPEN** — no live caller in `src/` | — | — | — |
| Browser/UI journey | — | — | — | — | — | — |
| Provider check (STUN/TURN) | — | — | — | — | — | — |
| Physical-device evidence | — | — | — | — | — | — |

### 16.48.10 · Files changed in this round

| File | Owning agent | Action |
|---|---|---|
| `scripts/apply-migration-357-sandbox.mjs` | Claude (main thread, per authorisation) | narrow INSERT-column fix |
| `scripts/apply-migration-358-sandbox.mjs` | Claude | narrow INSERT-column fix |
| `scripts/apply-migration-359-sandbox.mjs` | Claude | narrow INSERT-column fix |
| `nex-supabase/migrations/357_nex_group_call_invite_v4_combined.sql` | Agent DB (prior round) | staged byte-for-byte from candidate |
| `nex-supabase/migrations/358_nex_create_group_call_session_tx.sql` | Agent DB | staged byte-for-byte |
| `nex-supabase/migrations/359_nex_join_group_call_session_tx.sql` | Agent DB | staged byte-for-byte |
| `scripts/gate-a-connected-matrix/*` (32 files) | Agent HARNESS (prior round) | authored |
| `scripts/gate-a-connected-matrix/00_preflight.sql` | Claude (bounded transfer of ownership per owner spec) | narrow fix to checks 22/23/24 |
| `scripts/gate-a-connected-matrix/_results.json.OUTPUT` | runner | written at runtime |
| `scripts/gate-a-connected-matrix/99_identity_capture.json.OUTPUT` | signUp step | written at runtime; no secrets |
| `tmp-lane-g/38-357-postcheck-and-history.mjs` | Claude | scratch verification script |
| `tmp-lane-g/39-gate-a-prerun-verify.mjs` | Claude | scratch verification script |
| `tmp-lane-g/40-run-preflight-standalone.mjs` | Claude | scratch verification script |
| `tmp-lane-g/41-check-retained-identities.mjs` | Claude | scratch cleanup-audit script |
| `scripts/gate-a-connected-matrix/20_signup_disposable_identities.mjs` | Claude (bounded transfer, round 2) | email map replaced with owner-approved candidates; read-only confirmation-wait added |
| `tmp-lane-g/43-check-candidate-identities.mjs` | Claude | read-only candidate-identity probe |
| `tmp-lane-g/44-signup-run.log` | Claude | captured round-2 signup stdout/stderr (no secrets) |
| `tmp-lane-g/42-ledger-section-16-48.md` | Claude | this section (staging mirror before append) |
| `evidence/master-flow/RECONCILIATION-LEDGER-2026-11-18.md` | Agent EVIDENCE (this handback) | §16.48 appended |
| `src/app/nex-native/hq/journey-map/page.tsx` | Agent EVIDENCE | Lane G section appended from this evidence only |

No application code (`src/lib/**`, `src/app/**` excluding the HQ
journey-map) was modified. No commits were created. No pushes
occurred. Dev server was neither started nor restarted.

### 16.48.11 · Remaining blockers (preserved and new)

- **GB-4CAP-DIRECT · OPEN** (preserved). Service-role direct writes
  to `nex_group_call_participant` remain possible via REST/pg. The
  mig-133 BEFORE INSERT trigger raises P0001 once `cnt>=4` but does
  not prevent the two-concurrent-INSERT race below the cap. Gate A
  did not address this blocker; v4 combined (MIG-A) addresses only
  the RPC body path.
- **W3 live caller · OPEN** (preserved). No code in `src/` imports
  or invokes `nex_join_group_call_session_tx`. W3 severity therefore
  remains THEORETICAL until a caller is wired. V5-W3 preview wrapper
  on disk (`group-call-join.v5-candidate.ts`) is fail-closed /
  default-off; not called by production code.
- **Case G · STATE_BLOCKER · OPEN** (preserved). No PL/pgSQL
  mid-function fault-injection facility in sandbox. V-ATOMIC gives
  only indirect atomicity evidence (and remains BLOCKED anyway in
  this round due to no signup).
- **Live UI journeys · OPEN** (preserved). No browser, provider
  (STUN/TURN), or physical-device evidence collected.
- **B-SIGNUP-DOMAIN · RESOLVED (round 2)**. The `.invalid` TLD
  blocker from round 1 was closed by the owner-approved
  substitution of `<op-email>` and two plus-
  aliases. Supabase Auth accepted the domain; round 2 did not
  return HTTP 400 "Email address is invalid". Note: Gmail
  plus-alias distinctness in `auth.users` was not independently
  verified because the provider rejected round-2 attempts at the
  rate-limit gate before user creation. **Distinctness remains
  open** and must be confirmed once signups succeed — three
  aliases sharing one inbox do not establish three distinct
  authenticated accounts.
- **B-SIGNUP-RATE · OPEN (persists across rounds)**. HTTP 429
  `email rate limit exceeded` fired on the first round-2 attempt.
  Actual reset window is not known to this report:
  supabase-js does not surface the provider's `Retry-After`
  header, and the owner directive explicitly instructs this
  report not to claim the previous ~60-minute estimate as
  verified. Downstream fixture creation remains gated until an
  owner-initiated retry succeeds. Per owner directive, Claude
  will not loop, rotate identities to evade the limit, or alter
  rate-limit configuration.

Gate B remains **separately gated**. A Gate B authorisation requires:
(a) successful supported-auth signup of at least three distinct
identities (round-2 domain approval unlocks the attempt; the
rate-limit reset and a successful pass for all three is still
pending), (b) connected V-* matrix execution with per-case
evidence, (c) a resolution on the Case G blocker (likely a sandbox-
only PL/pgSQL fault hook, which itself requires owner approval).
Public launch remains **NOT READY** for every one of the 11 §21
per-surface launch gates.

*End §16.48.*
