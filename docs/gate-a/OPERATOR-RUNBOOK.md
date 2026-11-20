# Gate A Connected Matrix — Operator Runbook

Provenance: §16.48.20 · 2026-11-20 · Agent A deliverable.
Scope: operator reference for the sandbox-pinned Gate A Connected Matrix
harness at `scripts/gate-a-connected-matrix/`. Target: sandbox project
`kdstoyyeygcopkogqsyv` only. Production ref `ijvqdvsvwtwxzcqmoqit` is
hard-refused at every layer and MUST NOT appear in any operator
configuration.

What this is: a clear, click-level translation of the §16.48.19
fail-closed gates, the "Option α" bounded connected run, and the
operator actions required to move gates from UNVERIFIED-BLOCKED to
ATTESTED without ever exposing a secret.

---

## Section 1 — Gate relationship clarification

### 1.1 The three fail-closed gates (§16.48.19)

`_preflight-checklist.mjs` exports a pure `runGates()` that evaluates
three gates. The runner (`_runner.mjs`) imports this module behind a
try/catch and prints its result, but **the §16.48.19 gates are
advisory in the preflight printer — the HARD refusal lives in the
Option α connected-run wrapper, which is a separate owner-gated step.**
This matters: a green preflight is not permission to proceed. Owner
authorisation is still required.

The gates and their exact behaviour, per
`__tests__/preflight-checklist.spec.mjs`:

| Gate | Tier when ATTESTED | Tier otherwise |
|---|---|---|
| `G-SMTP-ATTEST` | `smtpCustomEnabled === "yes"` (passed in or via env `GATE_A_SMTP_CUSTOM_ENABLED=yes`) | `"no"` → `BLOCKED`; unset/empty → `UNVERIFIED-BLOCKED`; anything else → `throw "runGates: invalid input"` |
| `G-DB-CRED` | Flag file at `evidence/attestations/db-cred-verified.flag` (§16.48.22) parses as JSON with `verdict: "PASS"` AND `checked_at` within 24h of `now` | Missing file → `UNVERIFIED-BLOCKED` with code `DB_CRED_FLAG_MISSING`; malformed JSON → `UNVERIFIED-BLOCKED`; `verdict: "FAIL"` → `BLOCKED`; `verdict: "PASS"` older than 24h → `STALE-BLOCKED`; unknown verdict → `UNVERIFIED-BLOCKED`. See Section 6 for the full schema and refresh procedure. The legacy `_db-cred-check.status.OUTPUT` status marker is retired as of §16.48.22 — treat any residual reference to that path as historical. |
| `G-TARGET-REF` | `targetProjectRef === "kdstoyyeygcopkogqsyv"` | Production ref → `throw` (preflight prints `[BLOCKED] runGates refused`, no crash); other string → `BLOCKED` (raw value NOT echoed); empty/missing → `throw "runGates: invalid input"` |

The hard boundary imposed on runbook-drafting tasks forbids
hand-creating any attestation flag file. The `G-DB-CRED` gate therefore
remains `UNVERIFIED-BLOCKED` until the owner-only DB credential probe
script (`scripts/gate-a-connected-matrix/91_db_cred_probe.mjs`) runs
and writes the flag at `evidence/attestations/db-cred-verified.flag`.
**Only the probe may write this flag. Do NOT hand-create
`evidence/attestations/db-cred-verified.flag` or any similar marker as
part of this runbook work.** See Section 6 for the full source-of-truth
and refresh procedure under §16.48.22.

### 1.2 What "Confirm email" actually does on Supabase Auth

The sandbox project's **Authentication → Sign In / Providers → Email
→ Confirm email** toggle controls one branch in the signup flow:

- **Confirm email OFF** — `supabase.auth.signUp({ email, password })`
  returns a response containing both `data.user` AND
  `data.session` (immediately usable JWT). No outbound confirmation
  email is sent. In `20_signup_disposable_identities.mjs` the
  `if (!session && !IS_STUB)` branch is NOT taken, and
  `waitForEmailConfirm()` is never called.
- **Confirm email ON** — `signUp` returns `data.user` but
  `data.session === null`. The script then enters
  `waitForEmailConfirm()`, polling `auth.users.email_confirmed_at`
  over a direct `pg.Client` for up to 15 minutes while the owner
  clicks the Gmail confirmation link. An outbound email IS sent, and
  therefore the sandbox's SMTP configuration (Supabase default relay
  vs custom Brevo) matters.

### 1.3 Does Option α need custom SMTP if Confirm email is OFF?

No. With Confirm email OFF, Supabase sends no confirmation email as
part of the Option α flow. The abc-14 manifest contains exactly ONE
script that ever reaches `signUp` (`20_signup_disposable_identities.mjs`,
step 1 of 14). None of the 13 downstream V-* scripts call any Auth
endpoint that triggers email (no password resets, no magic links, no
email changes). So in the Confirm-email-OFF configuration, custom
SMTP is irrelevant to the Option α run.

### 1.4 Journeys / assertions remaining untested per configuration

**Config X — Confirm email OFF + no custom SMTP (Supabase default relay):**
- Tested in Option α: signUp happy path returning session directly;
  all 13 behavioural V-* RPC scenarios.
- NOT tested: confirmation-email delivery, confirmation-link
  round-trip, `email_confirmed_at` transition, `waitForEmailConfirm`
  polling loop, custom-SMTP sender identity, SMTP deliverability under
  Brevo rate limits, Supabase default-relay bounce behaviour,
  per-hour email-send rate limit.

**Config Y — Confirm email ON + custom SMTP (Brevo) configured:**
- Tested in Option α: signUp returning `session=null`, owner-click
  confirmation round-trip, `pg.Client` polling, Brevo SMTP sender
  identity, delivery to the owner's Gmail, full V-* RPC suite after
  confirmation.
- NOT tested: direct-session happy path (signUp returning a session
  without the owner clicking anything); "no-SMTP" degraded path.
- Caveat: the entire run blocks up to 15 minutes per identity on the
  owner's Gmail click. For abc-14 that is up to 45 minutes of idle
  wait time if all three A/B/C confirmations are pending.

**Config Z — Confirm email OFF + custom SMTP still configured:**
- Tested in Option α: same as Config X (signUp returns session
  directly; email path never exercised).
- NOT tested: same gaps as Config X (confirmation-link round-trip,
  SMTP delivery, `waitForEmailConfirm`). Having SMTP configured but
  never invoked is a correct but non-exercising setup.

### 1.5 Recommendation

**Choose Config Y (Confirm email ON + Brevo custom SMTP)** for the
Option α connected run.

Rationale: the whole point of a connected A/B/C sandbox probe is to
observe the real auth flow NEX users will take. A connected run that
quietly bypasses email confirmation proves far less than a slower run
that actually exercises SMTP → Gmail → confirmation-link → polling
loop, because that flow is the one most likely to regress silently
(SMTP sender header, DNS SPF/DKIM, Supabase polling interval). The
owner's stated conflict — "if Confirm email is off, the run doesn't
need Brevo and doesn't test confirmation" — resolves the same way:
turning Confirm email OFF makes custom SMTP unnecessary precisely
because the run gives up the test coverage custom SMTP was meant to
provide. Picking Config Y preserves that coverage. The cost is up to
~45 minutes of blocking wait time while the owner clicks three Gmail
links; that is acceptable for an owner-authorised one-shot probe.

If the owner explicitly wants the fastest possible run and accepts
reduced coverage, Config X is the fallback — but it means
`G-SMTP-ATTEST` is being toggled to `ATTESTED` for a flow that is not
actually exercised in this run. The gate is still honestly answered
("yes, custom SMTP is enabled on the project"), but the run tells you
nothing about it. Prefer Config Y.

---

## Section 2 — Option α definition

"Option α" is the owner-authorised bounded A/B/C three-identity
connected run. It is a specific, frozen configuration of the Gate A
harness, not a free-form run. It MUST NOT be invoked without a fresh
trigger phrase (Section 2.6).

### 2.1 Required env configuration

Set these in the shell BEFORE invoking the runner. Do NOT add them to
`.env.local`; the runner reads them from `process.env`. Only the three
that affect Option α are listed; other variables are left unset.

| Env var | Required value | Effect |
|---|---|---|
| `GATE_A_IDENTITY_MODE` | `three` | A/B/C — all 3 fixture identities signed up |
| `GATE_A_BOUNDED_PROFILE` | `abc-14` | Restrict forward MJS run to exactly the 14-entry manifest |
| `GATE_A_SKIP_CLEANUP` | `1` | Belt-and-suspenders: refuse to dispatch `90_cleanup.mjs` even if the manifest unexpectedly includes it |
| `GATE_A_DRY_RUN` | unset | Normal (non-dry) run |
| `GATE_A_SMTP_CUSTOM_ENABLED` | `yes` | Lift `G-SMTP-ATTEST` gate to ATTESTED |

The runner also reads these from `.env.local` (handled by its
`readEnv` helper): `SANDBOX_DATABASE_URL`,
`NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_NEX_SUPABASE_URL`.
Each is verified to reference `kdstoyyeygcopkogqsyv`; a production
ref anywhere in those strings aborts startup with `exit(3)`.

The runner generates in parent memory and never prints or writes to
disk: `DISPOSABLE_PASSWORDS[A|B|C]` (32-char base64url from
`randomBytes(24)`) and `GATE_A_RUN_ID` (UUID v4 from `randomUUID()`).
These are injected into each child's `env` via `buildChildEnv()`.

### 2.2 Ordered manifest — the 14 abc-14 scripts

Frozen list from `_runner.mjs` constant `BOUNDED_PROFILE_ABC14`
(`Object.freeze([...])`). Cleanup (`90_cleanup.mjs`), rollback
scripts (`80_*`, `81_*`, `82_*`), MIXED cases (`61_*`, `62_*`), and
NEEDS_MORE_THAN_3 cases (`42_*`, `43_*`, `51_*`, `63_*`, `64_*`,
`70_*`) are deliberately absent.

1. `20_signup_disposable_identities.mjs` — infra: sign up A/B/C
2. `30_v_auth_null.mjs` — V-AUTH-NULL: anon RPC call → ACL block
3. `31_v_auth_unknown.mjs` — V-AUTH-UNKNOWN: signed-in w/ no `nex_account`
4. `32_v_auth_unauthorized_diff.mjs` — V-AUTH-UNAUTH-DIFF: B invites to A's session
5. `40_v_w1_new.mjs` — V-W1-NEW: A invites B, new session
6. `41_v_w1_exist.mjs` — V-W1-EXIST: A adds C to existing session
7. `44_v_w1_whitespace.mjs` — V-W1-WS: whitespace/malformed URL rejection
8. `45_v_w1_dup.mjs` — V-W1-DUP: idempotent re-invite → `out_skipped=already_invited`
9. `50_v_w2_ok.mjs` — V-W2-OK: A creates session with B,C
10. `52_v_w2_dup.mjs` — V-W2-DUP: duplicate B in invitee array → dedup
11. `53_v_w2_auth.mjs` — V-W2-AUTH: anon W2 call → ACL rejection
12. `60_v_w3_update.mjs` — V-W3-UPDATE: B joins as pre-invited (UPDATE path)
13. `65_v_w3_promote.mjs` — V-W3-PROMOTE: session `ringing→live` on first join
14. `66_v_w3_nopromote.mjs` — V-W3-NOPROMOTE: 2nd join does not re-promote

SQL preflights `00_preflight.sql` and `10_grants.sql` run FIRST,
before the MJS list (via `runSqlFile()`).

### 2.3 Network / DB call inventory per script

| Script | Supabase Auth | Supabase REST (RPC/table) | Direct `pg.Client` |
|---|---|---|---|
| `00_preflight.sql` | — | — | `pg.Client → SANDBOX_DATABASE_URL` (runner-owned); executes the SQL |
| `10_grants.sql` | — | — | same pg.Client; executes the SQL |
| `20_signup` | 3× `signUp` + 3× `signInWithPassword` + (if Confirm email ON) 3× `pg.Client` poll of `auth.users.email_confirmed_at` | 3× authed `select id from nex_account where supabase_user_id = $1 limit 1` | Only for the confirm-email polling loop |
| `30_v_auth_null` | — | 1× anon `rpc("nex_invite_to_call_tx", …)` expected to fail ACL (42501/42883/PGRST301) | — |
| `31_v_auth_unknown` | 1× `signInWithPassword` | 1× authed `rpc` expected to fail for missing `nex_account` | — |
| `32_v_auth_unauthorized_diff` | 2× `signInWithPassword` (A and B) | authed RPC: B invites to A's session → rejection | — |
| `40_v_w1_new` | 1× `signInWithPassword` (A) | authed `rpc("nex_invite_to_call_tx", …)` A→B new session | — |
| `41_v_w1_exist` | `signInWithPassword` (A) | two authed RPC calls (new then existing) | — |
| `44_v_w1_whitespace` | `signInWithPassword` (A) | authed RPC with malformed URL → validation error | — |
| `45_v_w1_dup` | `signInWithPassword` (A) | authed RPC re-invite → `out_skipped=already_invited` | — |
| `50_v_w2_ok` | `signInWithPassword` (A) | authed `rpc("nex_create_group_call_session_tx", invitees=[B,C])` | — |
| `52_v_w2_dup` | `signInWithPassword` (A) | authed RPC with duplicate B in array → dedup | — |
| `53_v_w2_auth` | — | 1× anon RPC → ACL rejection | — |
| `60_v_w3_update` | `signInWithPassword` (A and B) | A creates+invites; B joins → UPDATE on pre-invited participant | — |
| `65_v_w3_promote` | `signInWithPassword` (A and B) | authed RPC: on first join, session state `ringing→live` | — |
| `66_v_w3_nopromote` | `signInWithPassword` (A, B, C) | authed RPC: 2nd join leaves state `live` | — |

Every authed RPC in Option α hits the Supabase REST endpoint at
`NEXT_PUBLIC_NEX_SUPABASE_URL` (sandbox) with the per-identity JWT in
the `Authorization: Bearer …` header. No script in the abc-14
manifest issues raw `pg.Client` DELETE/INSERT/UPDATE statements —
the only direct-pg writes in the full harness live in
`90_cleanup.mjs`, which is EXCLUDED from Option α.

### 2.4 Identity creation and provenance

`20_signup_disposable_identities.mjs` creates three auth.users using
owner-supplied Gmail plus-aliases hardcoded in the script:

- Label A → `<op-email>`
- Label B → `<op-email+1>`
- Label C → `<op-email+2>`

Each signUp is wrapped by a **write-ahead manifest** (§16.48.19): the
script appends a `pending_signup` row to `created_fixtures` and
fsyncs `99_identity_capture.json.OUTPUT` BEFORE calling `signUp`, so a
mid-run crash cannot leave an orphan `auth.users` row the cleanup
script will not recognise. The row transitions in-place to
`signed_up` or `signup_failed`.

Every manifest row carries `provenance_tag =
"gate-a-<GATE_A_RUN_ID>-<8 hex>"`. `90_cleanup.mjs` refuses any
manifest or dependent row whose `provenance_tag` is missing or does
not start with `gate-a-`. This is the foreign-row hardening gate
(`MISSING_OR_FOREIGN_PROVENANCE_TAG`).

Note: Option α is a FORWARD-ONLY bounded run and therefore does NOT
dispatch cleanup. The disposable auth identities persist after the run
per the supported-signup-only policy; `nex_peer_message` /
`nex_peer_conversation` / `nex_group_call_session` /
`nex_group_call_participant` rows produced by V-* scripts also
persist and must be cleaned up in a SEPARATE owner-authorised
cleanup pass (which IS where `90_cleanup.mjs` runs — not in Option α).

### 2.5 Cleanup contract (reference only — not part of Option α)

`90_cleanup.mjs` is quoted here for reference because the owner will
need it in a follow-up pass. It is NOT dispatched in Option α (both
the frozen manifest and the `GATE_A_SKIP_CLEANUP=1` guard refuse it).

Cleanup contract, per `validateCleanupPlan()` and
`assertIdentityDeletable()`:

- Must receive `GATE_A_RUN_ID` from parent; `capture.run_id` must
  match exactly.
- Capture file must exist, parse as JSON, `created_at` within 6h and
  not in future beyond 60 s skew.
- `capture.provenance_tag` must start with `gate-a-`.
- Every fixture's `provenance_tag` must equal
  `capture.provenance_tag`.
- Every fixture `supabase_user_id` is a well-formed UUID and NOT on
  the hard denylist (`HARD_DENYLIST` lists Hammerex
  `11111111-1111-4111-8111-111111111111` and Rosa
  `11111111-1111-4111-8111-111111111113`; an empty denylist aborts
  with `DENYLIST_EMPTY`).
- Results file `_results.json.OUTPUT` must exist, have matching
  `run_id`, and each retained id must be a well-formed UUID present
  in `allowedIds` from `created_fixtures` with no duplicates across
  tables.
- Plan-wide last-mile guard: each fixture passes
  `assertIdentityDeletable` BEFORE any `pg.Client.connect()`.
- DELETE order (only after all validation passes):
  1. `DELETE FROM nex_peer_message WHERE id = ANY($1::uuid[])`
  2. `DELETE FROM nex_peer_conversation WHERE id = ANY($1::uuid[])`
  3. `DELETE FROM nex_group_call_participant WHERE id = ANY($1::uuid[])`
     then `DELETE … WHERE session_id = ANY($1::uuid[])`
  4. `DELETE FROM nex_group_call_session WHERE id = ANY($1::uuid[])`
- Does NOT delete `nex_account` or `auth.users` rows.
- `GATE_A_CLEANUP_LIST_ONLY=1` prints the plan and exits 0 without
  instantiating pg.Client.

### 2.6 Trigger phrase

Proposed exact trigger phrase the owner must type verbatim to
authorise an Option α run. It is deliberately long, non-routine, and
contains the sandbox ref and the §16.48.19/.20 anchors so it cannot
be matched by any casual request or by a reused phrase from earlier
rounds:

> **"Run Gate A Option alpha abc-14 against sandbox kdstoyyeygcopkogqsyv now — §16.48.22 authorised"**

Rules that attach to the phrase:
- Any variant of the wording (shortened, paraphrased, missing the
  sandbox ref, missing the §16.48.22 anchor) does NOT authorise the
  run. Ask, do not infer.
- The phrase is single-use: a second run requires a fresh issue of
  the phrase with a fresh §16.48.xx anchor.
- The phrase does NOT authorise `90_cleanup.mjs`. Cleanup needs its
  own separately issued trigger.
- The phrase does NOT authorise any commit, push, deploy, migration,
  or production touch.

### 2.7 Pre-run env variables and expected values (summary)

| Variable | Source | Expected value |
|---|---|---|
| `GATE_A_IDENTITY_MODE` | shell | `three` |
| `GATE_A_BOUNDED_PROFILE` | shell | `abc-14` |
| `GATE_A_SKIP_CLEANUP` | shell | `1` |
| `GATE_A_DRY_RUN` | shell | unset or empty |
| `GATE_A_SMTP_CUSTOM_ENABLED` | shell | `yes` (if Config Y) |
| `SANDBOX_DATABASE_URL` | `.env.local` | pooler URL whose username matches `/^postgres\.kdstoyyeygcopkogqsyv$/` |
| `NEXT_PUBLIC_NEX_SUPABASE_URL` | `.env.local` | URL containing `kdstoyyeygcopkogqsyv`, not production ref |
| `NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY` | `.env.local` | non-empty; harness does not validate its contents |

### 2.8 Stop / abort conditions

The runner aborts with non-zero exit on any of:

- `.env.local` missing or any required key absent → `exit(2)`.
- `SANDBOX_DATABASE_URL` contains `ijvqdvsvwtwxzcqmoqit` or extracts a
  non-`kdstoyyeygcopkogqsyv` project ref → `exit(3)`.
- Pooler username does not match `/^postgres\.kdstoyyeygcopkogqsyv$/`
  → `exit(3)`.
- `GATE_A_IDENTITY_MODE`, `GATE_A_BOUNDED_PROFILE`,
  `GATE_A_SKIP_CLEANUP`, or `GATE_A_DRY_RUN` set to any unrecognised
  value → `exit(2)` (raw value NOT echoed to the log).
- `GATE_A_BOUNDED_PROFILE=abc-14` without `GATE_A_SKIP_CLEANUP=1` →
  `exit(2)`.
- The bounded profile unexpectedly references
  `90_cleanup.mjs` → `exit(2)`.
- Any SQL preflight row has `passed_bool=false` → `STOP` and
  `exit(1)`.
- Any MJS script exits non-zero → `STOP` and `exit(1)`. (Note: a
  429 rate-limit inside `20_signup` is handled inside the child as a
  cascade that marks remaining identities `signup_failed` and
  persists the manifest before returning. The runner then reads the
  child's exit code; if `20_signup` concludes with zero OK
  identities, it exits `1`, triggering the runner's STOP.)

In-run behaviours worth knowing:

- The runner writes `_results.json.OUTPUT` after every entry append.
- Child stdout/stderr is forwarded in full; the full env is NOT
  printed. Disposable passwords never appear on stdout.
- A single `429` in `20_signup` cascades to mark B and C
  `signup_failed` without retry; the subsequent V-* scripts will emit
  `BLOCKED` structured results because `getOk(label)` returns null
  for B and C. BLOCKED verdicts exit 0 and do not cascade-stop.

---

## Section 3 — Operator action steps

Click-level paths assume the Supabase Studio UI at
`https://app.supabase.com`. If the UI has shifted since this runbook,
follow the "Authentication" and "Project Settings" headings in the
left nav.

### 3.1 Confirm which project you are looking at (sanity check)

1. Open `https://app.supabase.com` → sign in.
2. Pick the project whose name identifies the NEX sandbox. The
   sandbox project reference is `kdstoyyeygcopkogqsyv`. Confirm by:
   - Project home header shows "Project ref: …" — compare to the
     sandbox ref.
   - Or: **Project Settings → General → Reference ID**.
3. If what you see is the production ref `ijvqdvsvwtwxzcqmoqit`,
   STOP. Close the tab. Everything in this runbook is sandbox-only.

### 3.2 Toggle "Confirm email"

1. In the sandbox project, left nav → **Authentication**.
2. Sub-nav → **Providers** (or "Sign In / Providers" in newer UI).
3. Expand **Email**.
4. Find the **Confirm email** toggle.
5. For Config Y (recommended): ensure it is **ON**.
6. For Config X (fallback): switch it **OFF**.
7. Save if the UI exposes a Save button.

### 3.3 Check / configure SMTP sender settings

1. Left nav → **Authentication**.
2. Sub-nav → **Emails** (or "Email templates" + "SMTP settings"; the
   layout has varied).
3. Locate the **SMTP Settings** section (toggle labelled "Enable
   Custom SMTP").
4. For Config Y: toggle **Enable Custom SMTP** ON. Fill the Brevo
   relay credentials provided to you out-of-band (host, port,
   username, password, sender name, sender email). Do NOT paste
   these into this runbook, any chat, or any file in the repo.
5. Click **Save**. Use the **Send test email** button if offered,
   and confirm delivery to the owner's Gmail.
6. After saving, record out-of-band that custom SMTP is enabled.
   The attestation to the harness is simply exporting
   `GATE_A_SMTP_CUSTOM_ENABLED=yes` in the shell before running the
   preflight.

### 3.4 Verify Auth rate-limit state

1. Left nav → **Authentication** → **Rate Limits** (new UI) or
   **Policies**/**Settings** → **Rate Limits** (older UI).
2. Note the current per-hour signup and email send limits.
   Option α issues at most 3 `signUp` + 3 `signInWithPassword` + 3
   `signInWithPassword` (authed-client refresh) = 9 auth calls. This
   is well under default limits, but a prior failed run within the
   same hour adds to the count.
3. If the rate-limit view shows elevated recent usage from a prior
   run, wait until the sliding window clears before issuing the
   trigger phrase.

### 3.5 Confirm the sandbox project reference

Same check as 3.1. The runner enforces this in code (`extractProjectRef`
+ `validateDatabaseUrl` + pooler username regex). The operator-side
check is to confirm visually that the Studio tab you have open is the
sandbox, not production.

### 3.6 Find current sandbox DB credentials without exposing them

The owner's DB credentials for the sandbox live in `.env.local` as
`SANDBOX_DATABASE_URL`, `NEXT_PUBLIC_NEX_SUPABASE_URL`, and
`NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY`. The harness reads them via
`readEnv()`, which greps a single line out of the file without
printing values. Operator actions:

1. If you need to confirm which project a value points at WITHOUT
   revealing the value, run the dry-run:
   - `GATE_A_DRY_RUN=1 GATE_A_IDENTITY_MODE=three GATE_A_BOUNDED_PROFILE=abc-14 GATE_A_SKIP_CLEANUP=1 node scripts/gate-a-connected-matrix/_runner.mjs`
   - On success, the startup banner prints
     `VERIFIED: SANDBOX_DATABASE_URL → sandbox kdstoyyeygcopkogqsyv`
     without echoing the URL.
2. If a credential is believed stale, obtain the replacement
   out-of-band from Supabase Studio → Project Settings → API /
   Database and edit `.env.local` directly. Do NOT paste the new
   value into any other file, chat, or log.
3. Keys to NEVER echo in any log, commit, chat, or copy-paste: the
   service-role key, the anon JWT, the `SANDBOX_DATABASE_URL`
   password component, Brevo SMTP credentials.

### 3.7 Rotation of stale OUTPUT files

Agent C owns rotation of stale `_results.json.OUTPUT` and
`99_identity_capture.json.OUTPUT` between runs. Do not perform this
work as part of the operator runbook. If a prior OUTPUT is present at
run start, Agent C's rotation step moves it aside to a dated sibling
filename (the repo already contains an example:
`_results.json.OUTPUT.prior-16.48.15-round2-2026-11-19`). Reference
only — do not duplicate that procedure here.

---

## Section 4 — Safety reminders

- Engineering ceiling for this harness is **Verified** (offline-tested
  via `vitest` under `scripts/gate-a-connected-matrix/__tests__/`).
  A connected run that passes all 14 scripts can only be classified
  **Live-tested in sandbox**. It is NOT Live-verified for production,
  and is never evidence for a production claim. Per sealed 2026-11-08
  5-state readiness model: sandbox PASS ≠ Live verified.
- A green preflight (all three gates ATTESTED) does NOT authorise
  the Option α run. The owner MUST issue the trigger phrase in
  Section 2.6 verbatim, even with every gate green.
- Any deviation from the frozen abc-14 manifest aborts the run. The
  runner refuses unknown script names, missing basenames, and
  accidental re-inclusion of `90_cleanup.mjs`.
- No side effects to the repo: Option α does not commit, does not
  push, does not deploy, does not apply migrations, does not alter
  `.env.local`, does not touch production, does not touch Hammerex
  or Rosa accounts.
- `90_cleanup.mjs` is NEVER part of Option α. Scheduling cleanup is a
  separate owner-authorised task with its own trigger phrase (not
  defined here).
- Writing any attestation flag file (e.g.
  `evidence/attestations/db-cred-verified.flag`) is explicitly
  forbidden for the agent drafting this runbook. Only the probe
  `scripts/gate-a-connected-matrix/91_db_cred_probe.mjs` may write it.
  The DB-cred gate stays `UNVERIFIED-BLOCKED` until the probe runs and
  emits a PASS verdict within the 24h freshness window. See Section 6
  for the schema, fail-closed taxonomy, and refresh procedure.
- The hard denylist in `90_cleanup.mjs` MUST remain non-empty
  (currently Hammerex and Rosa UUIDs). An empty denylist aborts
  cleanup with `DENYLIST_EMPTY` — this is a feature, not a bug.
- Production reference `ijvqdvsvwtwxzcqmoqit` is hard-refused in
  `_runner.mjs`, `_preflight-checklist.mjs`, every V-* script, and
  `90_cleanup.mjs`. The operator must still visually confirm which
  Studio project is open before toggling anything.

---

## Section 5 — Config X · quick-path instructions

Provenance: §16.48.21 · 2026-11-20 · Agent B addition. The existing
Config Y guidance above (Section 1.5 onward) is unchanged — Config X
is the alternative path when the owner wants the fastest possible
sandbox exercise and is willing to defer email-confirmation coverage.

### 5.1 Why Config X is faster

Config X skips the entire Brevo custom-SMTP setup. Supabase default
relay is not invoked either, because with Confirm email OFF the
sandbox never emits a confirmation email for `20_signup_disposable_
identities.mjs` to wait for. Specifically:

- No Brevo account, no SMTP credentials, no DNS SPF/DKIM step.
- One toggle in Supabase Studio (one click + save) instead of the
  four-field SMTP form + test-send flow.
- Zero blocking wait for the owner to click confirmation links in
  Gmail. Where Config Y can stall up to ~45 minutes across three
  identities, Config X signs up A/B/C back-to-back and proceeds to
  V-* scripts immediately.

### 5.2 What Config X does NOT exercise

The email-confirmation journey is deliberately left UNVERIFIED under
Config X. That journey includes:

- `supabase.auth.signUp` returning `data.session === null`.
- `waitForEmailConfirm()` polling `auth.users.email_confirmed_at`
  over the direct `pg.Client` for up to 15 minutes per identity.
- Outbound confirmation email delivery (Supabase default relay vs
  Brevo custom-SMTP sender identity, bounce behaviour, per-hour send
  rate limits).
- Confirmation-link round-trip from Gmail back into the project.
- Sender-header / DNS SPF-DKIM alignment (Brevo only).

Under Config X these behaviours are not being tested. The final
report labels them UNVERIFIED and scope-defers them to a later
Brevo-enabled round.

### 5.3 Exact operator steps for Config X

a. **Supabase Studio** — sign in at `https://app.supabase.com`. Pick
   the sandbox project (Reference ID `kdstoyyeygcopkogqsyv`, verified
   under Section 3.1). Left nav → **Authentication** → **Providers**
   → expand **Email** → toggle **Confirm email** OFF → click **Save**
   if the UI exposes a Save button. No screenshots, no secrets, no
   values to paste anywhere.

b. **`.env.local`** — append (or edit) exactly the line:
   `GATE_A_SMTP_CUSTOM_ENABLED=confirm-off`
   This is the ONLY new env change for Config X. Do NOT add any
   Brevo-related variables. Do NOT add any SMTP host/port/username/
   password. Do NOT set `GATE_A_SMTP_CUSTOM_ENABLED=yes`.

c. **SMTP settings** — do NOT touch. The Authentication → Emails →
   SMTP Settings section stays as it is (either disabled, or
   unchanged from whatever Config Y left behind). Having custom SMTP
   previously configured is harmless under Config X because nothing
   in the abc-14 manifest will invoke it with Confirm email OFF.

### 5.4 What stays UNVERIFIED in the final Config X report

Under Config X the final report MUST list the following as
UNVERIFIED (not VERIFIED, not LIVE-VERIFIED) and include the
scope-defer annotation `deferred to a later Brevo-enabled round`:

- Email-confirmation signup branch (`data.session === null` path).
- `waitForEmailConfirm()` polling loop over `pg.Client`.
- Outbound confirmation email delivery from either sender (default
  relay or Brevo).
- Confirmation-link round-trip from the owner's Gmail.
- SMTP sender identity, SPF/DKIM alignment, per-hour send limits.
- Supabase default-relay bounce behaviour.

The `G-SMTP-ATTEST` gate line in the preflight output under Config
X reads exactly:

> `G-SMTP-ATTEST: ATTESTED · detected config = X (Confirm email OFF; email-confirmation journey UNVERIFIED, deferred to a later Brevo round)`

For comparison, the Config Y equivalent reads:

> `G-SMTP-ATTEST: ATTESTED · detected config = Y (Confirm email ON + custom SMTP; email-confirmation journey will be exercised)`

### 5.5 Auth-state attestation under Config X (§16.48.22)

Provenance: §16.48.22 · owner directive — `SUPABASE_ACCESS_TOKEN` is
intentionally NOT provisioned and NOT requested. There is no
Management API path being exercised by this round, and no new token
env var is being introduced. Do not add one to `.env.local`. Do not
ask the owner to supply one.

Behaviour of `scripts/gate-a-connected-matrix/92_auth_state_check.mjs`
under Config X:

- The helper detects the absent `SUPABASE_ACCESS_TOKEN` and soft-fails
  with verdict `AUTH_STATE_UNREADABLE` and refusal code
  `MGMT_TOKEN_MISSING`. Exit code is `0` so the preflight pipeline
  continues.
- This soft-fail branch is the AUTHORITATIVE path under Config X. It
  is not a degradation; it is the sealed shape of the check in this
  round.
- The helper never prints the URL, service-role key, management token,
  or raw response body on any path.

Because the Management API is not being read, the operator attests
the following two items MANUALLY in Supabase Studio before issuing the
Option α trigger phrase:

1. **Confirm email state.** Expected under Config X: **OFF**.
   - Supabase Studio → **Authentication** → **Sign In / Providers**
     → expand **Email** → inspect the **Confirm email** toggle.
   - Confirm the toggle is OFF. If it is ON, flip it OFF and Save,
     then re-open the page and confirm the saved state.
2. **Rate-limit state.** Expected under Config X: well below the
   per-row limit, with no residual usage from a prior run.
   - Supabase Studio → **Authentication** → **Rate Limits**.
   - For each row (notably `email_sent`, `signups`, `token_refresh`,
     `verifications`), confirm the "Used in last hour" count is well
     below the configured per-hour limit.
   - If a recent failed run has elevated any counter, wait for the
     sliding window to clear before issuing the trigger phrase.

Do NOT paste any of these values, screenshots, keys, tokens, or
database URLs into this runbook, any chat, or any file in the repo.
The attestation is an in-head confirmation the operator carries into
the trigger-phrase moment; it leaves no textual trace.

### 5.6 Safety carry-over

Every rule from Sections 2–4 still applies under Config X:
- The Option α trigger phrase (Section 2.6) is still required
  verbatim; a green preflight does not authorise a run.
- `90_cleanup.mjs` is still NEVER part of Option α.
- Production ref `ijvqdvsvwtwxzcqmoqit` is still hard-refused.
- No commit, no push, no deploy, no migration.
- No secrets in this doc (unchanged).

---

## Section 6 · G-DB-CRED evidence source (§16.48.22)

Provenance: §16.48.22 · 2026-11-20 · Agent B addition. This section
documents the source-of-truth change for the `G-DB-CRED` fail-closed
gate. The old status-marker dependency at
`_db-cred-check.status.OUTPUT` is retired as of §16.48.22; references
to that path in older notes are historical only and must not be used
to refresh the gate.

### 6.1 Flag path and sole writer

- **Canonical path:** `evidence/attestations/db-cred-verified.flag`
- **Sole writer:** `scripts/gate-a-connected-matrix/91_db_cred_probe.mjs`
- **Readers:** the preflight checklist (`_preflight-checklist.mjs`
  via `runGates()`), which reads this flag exclusively to evaluate
  `G-DB-CRED`. No other producer writes it. Hand-creation is
  forbidden.

### 6.2 Flag schema

The flag is a small JSON document with the following fields:

| Field | Type | Meaning |
|---|---|---|
| `verdict` | string — `"PASS"` or `"FAIL"` | The probe's conclusion for the sandbox credential check. `PASS` means the configured credentials resolve to the canonical sandbox project and permit the probe's minimal checks; `FAIL` means at least one check failed. |
| `probe_version` | string | The probe's own version anchor (e.g. a `§16.48.xx` tag). Used so future rounds can reason about which probe shape produced the flag. |
| `checked_at` | ISO-8601 timestamp | When the probe wrote the flag. The gate enforces a 24h freshness window: a `PASS` older than 24h degrades to `STALE-BLOCKED`. |
| `current_database` | string | The database name the probe observed (e.g. `postgres`). Recorded so operators can confirm the probe hit the expected sandbox role, without echoing the full connection string. |
| `project_ref` | string — forward-compatible | Reserved for a future round that extends the probe to echo the canonical sandbox ref (`kdstoyyeygcopkogqsyv`) inside the flag. Current round may omit this field; future readers must tolerate its absence and MUST hard-refuse any value equal to the sealed production ref `ijvqdvsvwtwxzcqmoqit`. |

Any additional fields the probe emits are permitted and must be
ignored by the reader. No secrets, no URLs, no passwords, no tokens
are ever written into the flag.

### 6.3 Fail-closed verdicts (gate taxonomy)

Mirroring the probe's fail-closed taxonomy at a documentation level
(the code taxonomy is normative; this table is a reference):

| Flag state | `G-DB-CRED` gate |
|---|---|
| File missing | `UNVERIFIED-BLOCKED` with code `DB_CRED_FLAG_MISSING` |
| File present, not valid JSON | `UNVERIFIED-BLOCKED` with code `DB_CRED_FLAG_MALFORMED` |
| `verdict` missing or unrecognised value | `UNVERIFIED-BLOCKED` |
| `verdict: "FAIL"` | `BLOCKED` |
| `verdict: "PASS"` with `checked_at` older than 24h | `STALE-BLOCKED` |
| `verdict: "PASS"` with `checked_at` within 24h AND (when present) `project_ref` equals canonical sandbox | `ATTESTED` |
| `project_ref` present AND equals the sealed production ref | `UNVERIFIED-BLOCKED` (refuse the flag outright) |

This runbook does not prescribe code — the probe and the preflight
own the exact string codes and exit shapes. The table above is the
operator-facing summary.

### 6.4 Refresh procedure

To refresh the flag, run the probe once:

```
node scripts/gate-a-connected-matrix/91_db_cred_probe.mjs
```

The probe is the sole writer. It:

- Reads `.env.local` for the sandbox credentials (never prints them).
- Confirms the configured values resolve to the canonical sandbox
  project ref `kdstoyyeygcopkogqsyv`.
- Hard-refuses the sealed production ref `ijvqdvsvwtwxzcqmoqit`.
- Writes the flag at the canonical path with a fresh `checked_at`.

After a successful run, re-run the preflight to confirm
`G-DB-CRED: ATTESTED`.

**Do NOT hand-create or hand-edit the flag.** A flag file that was
not written by the probe is treated as `UNVERIFIED-BLOCKED` by
policy, even if its JSON parses.

### 6.5 Retirement of `_db-cred-check.status.OUTPUT`

The legacy status-marker file at `_db-cred-check.status.OUTPUT` is
retired as of §16.48.22. The preflight no longer reads it, and the
`G-DB-CRED` gate's evidence source is now solely the flag described
above. If a prior-round note or script comment references
`_db-cred-check.status.OUTPUT`, treat it as historical and do not
attempt to refresh or interpret it. Removal of the retired path from
other callers is Agent A's scope under §16.48.22.

### 6.6 Operator steps remaining

Under §16.48.22, the operator's remaining steps for `G-DB-CRED` are:

1. Run the probe (Section 6.4). This is the only action that moves
   the gate.
2. Observe the preflight re-report `G-DB-CRED: ATTESTED` once the
   fresh flag is in place.

No status-marker file needs to be touched. No hand-edited JSON. No
secrets to paste. If the probe reports `FAIL`, STOP and raise the
issue — do not hand-edit the flag to work around it.
