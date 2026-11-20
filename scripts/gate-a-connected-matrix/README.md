# Gate A Connected Matrix — Lane G v5 batch

**THIS DIRECTORY IS AUTHOR-ONLY IN AGENT HARNESS'S SCOPE.**
**EXECUTION IS AGENT DB'S RESPONSIBILITY.**

Authored: 2026-11-19
Source ledger: `evidence/master-flow/RECONCILIATION-LEDGER-2026-11-18.md` §16.47.8 (V-* matrix) and §16.47.6 (grant-envelope checks)
Sandbox target: `kdstoyyeygcopkogqsyv` ONLY. Production `ijvqdvsvwtwxzcqmoqit` is explicitly excluded.

---

## Purpose

This directory contains all scripts required to advance Lane G v5 batch evidence from UNIT (vitest pass) to CONNECTED SQL tier. No script in this directory has been executed. No DB connection has been made. All files are source-authored only.

---

## Run order

Execute in strict serialized order. STOP on the first FAIL unless overridden (override is not supported — stopping on FAIL is mandatory).

| Order | File | Category | Writes DB? |
|---|---|---|---|
| 1 | `00_preflight.sql` | READ-ONLY preflight — §16.47.6 checks 1-8 | NO |
| 2 | `10_grants.sql` | READ-ONLY expanded privilege inspection | NO |
| 3 | `20_signup_disposable_identities.mjs` | Creates 3 disposable auth identities via `signUp` | YES (auth.users only) |
| 4 | `30_v_auth_null.mjs` | V-AUTH-NULL | READ (anon RPC call) |
| 5 | `31_v_auth_unknown.mjs` | V-AUTH-UNKNOWN | READ-ONLY (inspect) |
| 6 | `32_v_auth_unauthorized_diff.mjs` | V-AUTH-UNAUTH-DIFF | YES (fixture session) |
| 7 | `40_v_w1_new.mjs` | V-W1-NEW | YES |
| 8 | `41_v_w1_exist.mjs` | V-W1-EXIST | YES |
| 9 | `42_v_w1_cap.mjs` | V-W1-CAP | YES |
| 10 | `43_v_w1_cap_race.mjs` | V-W1-CAP-RACE | YES |
| 11 | `44_v_w1_whitespace.mjs` | V-W1-WS | YES (expected-fail + success) |
| 12 | `45_v_w1_dup.mjs` | V-W1-DUP | YES |
| 13 | `50_v_w2_ok.mjs` | V-W2-OK | YES |
| 14 | `51_v_w2_over.mjs` | V-W2-OVER | YES |
| 15 | `52_v_w2_dup.mjs` | V-W2-DUP | YES |
| 16 | `53_v_w2_auth.mjs` | V-W2-AUTH | READ (anon RPC call) |
| 17 | `60_v_w3_update.mjs` | V-W3-UPDATE | YES |
| 18 | `61_v_w3_insert.mjs` | V-W3-INSERT | YES |
| 19 | `62_v_w3_role.mjs` | V-W3-ROLE | READ (expected-fail call) |
| 20 | `63_v_w3_cap.mjs` | V-W3-CAP | YES |
| 21 | `64_v_w3_race.mjs` | V-W3-RACE | YES |
| 22 | `65_v_w3_promote.mjs` | V-W3-PROMOTE | YES |
| 23 | `66_v_w3_nopromote.mjs` | V-W3-NOPROMOTE | YES |
| 24 | `70_v_atomic.mjs` | V-ATOMIC | YES |
| 25 | `80_v_rollback_a.mjs` | V-ROLLBACK-A (failure path only) | CONDITIONAL |
| 26 | `81_v_rollback_b.mjs` | V-ROLLBACK-B (failure path only) | CONDITIONAL |
| 27 | `82_v_rollback_c.mjs` | V-ROLLBACK-C (failure path only) | CONDITIONAL |
| 28 | `90_cleanup.mjs` | Scoped DELETE of test-fixture rows | YES |

**Prerequisites before any script runs:**
- MIG-A (`nex_invite_to_call_tx` v4 combined) must be applied to sandbox.
- MIG-B (`nex_create_group_call_session_tx`) must be applied to sandbox.
- MIG-C (`nex_join_group_call_session_tx`) must be applied to sandbox.
- `.env.local` must contain `SANDBOX_DATABASE_URL` (pooler username `postgres.kdstoyyeygcopkogqsyv`) and `NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_NEX_SUPABASE_URL` pointing at sandbox.

---

## Runner invocation

```
node scripts/gate-a-connected-matrix/_runner.mjs
```

No arguments. The runner reads `.env.local` from the repo root. STOP on first FAIL is mandatory and not overridable.

Output file: `scripts/gate-a-connected-matrix/_results.json.OUTPUT`
Identity capture: `scripts/gate-a-connected-matrix/99_identity_capture.json.OUTPUT`

---

## Authentication contract

**JWTs are minted ONLY via `supabase.auth.signInWithPassword`.**

- NO `service_role` impersonation for RPC invocation.
- NO `supabase.auth.admin.createUser` — identities are created with `signUp` only.
- NO RLS stubbing, no `SET LOCAL role`, no `SET LOCAL request.jwt.claims`.
- NO manufactured PASS via privileged key posing as `authenticated`.

The RPCs are `SECURITY DEFINER` and read `auth.uid()` server-side. Every PASS result must be produced by a real authenticated JWT whose `sub` maps to a `nex_account.supabase_user_id` row.

---

## Retained-row report format

Each `.mjs` script that writes rows captures IDs in a standard structure appended to `_results.json.OUTPUT`:

```json
{
  "file": "40_v_w1_new.mjs",
  "verdict": "PASS | FAIL | BLOCKED | PARTIAL",
  "classification": "CONNECTED | UNIT-VERIFIED | BLOCKED",
  "detail": "...",
  "retained_rows": {
    "nex_group_call_session": ["<uuid>"],
    "nex_group_call_participant": ["<uuid>"],
    "nex_peer_conversation": ["<uuid>"],
    "nex_peer_message": ["<uuid>"]
  }
}
```

---

## STOP conditions

The runner stops immediately (non-zero exit) if:

1. `SANDBOX_DATABASE_URL` or `NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY` are missing from `.env.local`.
2. The pooler username in `SANDBOX_DATABASE_URL` does not match `postgres.kdstoyyeygcopkogqsyv`.
3. The URL contains `ijvqdvsvwtwxzcqmoqit` anywhere — hard production guard.
4. Any `.sql` file or `.mjs` file exits with a non-zero code or records `verdict: "FAIL"`.
5. `00_preflight.sql` returns any `passed_bool = false` row.

Rollback scripts (`80_v_rollback_a.mjs`, `81_v_rollback_b.mjs`, `82_v_rollback_c.mjs`) are excluded from the STOP cascade — they are manually invoked after a FAIL and are not part of the normal forward run.

---

## Hard invariants

- `CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv"` pinned in every file.
- Pooler username regex `/^postgres\.kdstoyyeygcopkogqsyv$/` enforced at startup.
- No script touches production ref `ijvqdvsvwtwxzcqmoqit`.
- No script deletes `nex_account` or `auth.users` rows.
- No script references `D:/trades`.
- No Hammerex, Rosa, or protected accounts.

---

## Disposition of scenarios requiring > 3 identities

The signup script (`20_signup_disposable_identities.mjs`) provisions exactly 3 identities (A, B, C). Scenarios that require 4 or 5 identities (V-W1-CAP, V-W1-CAP-RACE, V-W2-OVER, V-W3-CAP, V-W3-RACE) will degrade to PARTIAL-COVERAGE if only 3 identities are available. Each script documents the exact identity-count threshold and reports PARTIAL with a clear reason when the threshold is not met.

If the sandbox signup path produces more than 3 identities (e.g. the runner is extended), the scripts are written to use additional identities if captured.

---

*End README.*
