# NEX Rate-Limit Infrastructure Audit · Mig 290-293 · 2026-11-21

Scope · forensic read-only audit of the rate-limit stack
(mig 290 table · mig 291 atomic claim RPC · mig 292 audit log ·
mig 293 reconciliation · mig 313 CHECK widening) against
credential-stuffing · OTP brute-force · chat flood · admin-grant
flood · webhook ingestion · account-creation flood · emergency-
help flood threats. Phase 2 Remediation priority 5 (P2-05) per
the sealed 2026-11-09 priority order.

Audit root · `C:/Users/Victus/nexapp`
Repo · `Philip2024394/nexapp` · branch `release-audit-v1-2026-11-14`
HEAD at audit time · `ab6b774b`

Posture in one line · **The rate-limit stack is architecturally
sound · atomic RPC path eliminates TOCTOU · 14 sensitive endpoints
are wired · RLS and append-only grants are correctly enforced in
every migration file.** The operational AT-RISK finding is identical
in shape to P2-04 · mig 290 is applied to SANDBOX only · mig 291/292/
293 are NOT applied to any database · production still runs on the
in-memory per-lambda fallback.

Spot-verified by direct Read before publication ·

- Mig 290 lines 52-61 · `ck_sec_rl_action` CHECK constraint lists
  only 8 actions · `hq_admin_grant` is NOT in the base constraint.
  Mig 313 (sealed 2026-11-09) widens this to 9 actions · the ring
  wiring in `security-rate-limit.ts:173-180` works on the client
  side but would fail the DB CHECK until mig 313 lands.
- Mig 290 lines 77-81 · RLS enabled with zero policies · explicit
  `REVOKE ALL` from `public` + `authenticated` + `anon` · `GRANT`
  to `service_role` only · defence-in-depth against Supabase auto-
  grants on new tables (comment lines 71-76).
- Mig 291 lines 124-133 · atomic `INSERT ... ON CONFLICT (key,
  action, window_started_at) DO UPDATE SET count = t.count + 1
  WHERE t.count < _max_per_window RETURNING t.count` · single
  statement under row lock · no read-then-upsert gap · TOCTOU
  eliminated.

---

## Compliance scorecard

| Component | Verdict | Prod-apply | Sandbox-apply |
|---|---|---|---|
| `nex_security_rate_limit` schema (mig 290) | COMPLIANT | NOT APPLIED | APPLIED 2026-11-08 |
| `nex_security_rate_limit` RLS + grants (mig 290) | COMPLIANT | NOT APPLIED | APPLIED |
| `nex_security_rate_limit_claim` atomic RPC (mig 291 active) | COMPLIANT · TOCTOU eliminated | NOT APPLIED | NOT APPLIED |
| `nex_security_audit_log` append-only (mig 292) | COMPLIANT | NOT APPLIED | NOT APPLIED |
| `nex_security_audit_reconcile_*` functions (mig 293) | COMPLIANT | NOT APPLIED | NOT APPLIED |
| CHECK widening for `hq_admin_grant` (mig 313) | COMPLIANT · closes mig 290 gap | NOT APPLIED | NOT APPLIED |
| 14 call-site integrations (`security-rate-limit.ts`) | WIRED · fail-open on `session_revoke` only · in-memory fallback elsewhere · 503 escalation on persistent `account_create` failure | n/a (code) | n/a (code) |

Zero VIOLATION. One operational AT-RISK · same shape as P2-04 ·
migrations pending prod apply. Not a new launch-blocker · tracked
under the sealed phase-2 gate (prod-apply authorisation owner-held).

---

## 1 · Threat model being tested

A malicious client · possibly scripted · possibly distributed ·
floods sensitive endpoints to achieve ·

- credential stuffing on `/auth/webauthn/assert-*`;
- account-create flood on `/account/create` (cost amplification);
- OTP/magic-link brute-force on auth paths;
- chat-message flood on `/chat/message` and visitor paths;
- admin-grant flood on HQ admin-grant service;
- resource exhaustion via `/security/sessions/revoke-all`;
- audit-log flood via `/incident/section-error`.

The server must token-bucket (per-identity · per-action · per
rolling window) every sensitive surface. The expected posture ·

- fail-CLOSED when the counter reaches max · route returns 429
  with `Retry-After` header;
- fail-OPEN only for a deliberate, low-abuse-value action
  (`session_revoke`) with documented justification;
- 503 escalation when distributed availability itself is at risk
  (`account_create` after sustained DB failure).

The failure modes we're looking for · a TOCTOU race in the claim
primitive · a missing index on the hot path · RLS left permissive
on the counter table · PII leaking into the audit log · a fallback
path that silently allows all traffic when the DB wobbles.

---

## 2 · Mig 290 · table schema + RLS correctness

File · `nex-supabase/migrations/290_nex_security_rate_limit.sql`

Schema · lines 44-66 ·

| Column | Type | Constraint | Purpose |
|---|---|---|---|
| `key` | text | `^(acct|ip):[a-z0-9-]{16,}$` | Identity · `acct:<uuid>` or `ip:<sha256>` |
| `action` | text | CHECK IN (8 values) | Action enum |
| `window_started_at` | timestamptz | NOT NULL | Rolling-window floor |
| `count` | integer | `>= 0` | Token-bucket counter |
| `updated_at` | timestamptz | DEFAULT now() | Last mutation |
| PK | (key, action, window_started_at) | | Per-identity, per-action, per-window |
| Index | (key, action, window_started_at DESC) | line 68-69 | Hot-path · matches claim RPC WHERE |

RLS · lines 77-81 · enabled · explicit `REVOKE ALL` from `public`
+ `authenticated` + `anon` · `GRANT select, insert, update, delete`
to `service_role` only · ZERO policies defined · deny-by-default
for RLS-enforced clients · service-role bypasses RLS. Comment
lines 71-76 document this as a defect fix 2026-11-08 after sandbox
apply revealed Supabase auto-grants to anon + authenticated roles
on new tables.

Base-constraint gap · `hq_admin_grant` is NOT in the 8-value
CHECK (lines 52-61). The `security-rate-limit.ts:173-180` ring
wires this action in client code · but inserts would fail the DB
CHECK until mig 313 lands. Operational impact · the admin-grant
ring is currently enforced per-lambda in-memory only on both prod
and sandbox · it will only persist in the DB counter once mig 290
+ mig 313 both apply.

Verdict · COMPLIANT (as of the authored CHECK in mig 290 + mig
313 widening). Zero USING(true). Zero missing index. Zero missing
RLS enable.

---

## 3 · Mig 291 · atomic claim RPC · TOCTOU analysis

File · `nex-supabase/migrations/291_nex_security_rate_limit_claim_rpc.sql`
(active · 2026-11-09 · supersedes the 2026-11-08 SUPERSEDED pair)

Core statement · lines 124-133 (verbatim spot-verified) ·

```
INSERT INTO nex_security_rate_limit AS t (
  key, action, window_started_at, count, updated_at
)
VALUES (_key, _action, v_window_started_at, 1, v_now)
ON CONFLICT (key, action, window_started_at)
  DO UPDATE SET
    count      = t.count + 1,
    updated_at = v_now
  WHERE t.count < _max_per_window
RETURNING t.count INTO v_new_count;
```

TOCTOU analysis ·

- Single atomic statement. The WHERE under the ON CONFLICT clause
  is evaluated under the conflicting row's lock · concurrent
  callers for the same `(key, action, window_started_at)` tuple
  serialise naturally on that row's lock.
- Return-logic · lines 135-151 · if `v_new_count IS NOT NULL`,
  the upsert landed → allowed. If NULL (WHERE blocked the update
  because `count >= _max_per_window`) → return `(false,
  retry_after)` with `retry_after = GREATEST(1, ceil(window
  remaining))`.
- Window boundary · lines 115-119 · `date_trunc('minute', now) -
  make_interval(mins := MOD(minute, window_minutes))` snaps the
  window floor deterministically · no client influence.
- Security · lines 165-168 · `REVOKE EXECUTE FROM public +
  anon + authenticated` · `GRANT EXECUTE TO service_role` ·
  SECURITY DEFINER with pinned `search_path = public, pg_temp`
  (comment line 160).

Verdict · ATOMIC · TOCTOU ELIMINATED. The older 2-phase
read-then-upsert path (inherited from `nex_community_rate_limit`,
still used as fallback when the RPC is missing) has a documented
cold-bucket race · mig 291 is the Phase 1.1 upgrade that closes it.

---

## 4 · Mig 292 · audit log + append-only enforcement

File · `nex-supabase/migrations/292_nex_security_audit_log.sql`

Three tables ·

- `nex_security_audit_log` · lines 40-84 · columns `event` (regex
  CHECK line 70-71 · `^[a-z][a-z0-9_]{1,127}(\.[a-z][a-z0-9_]{1,63}){1,5}$`)
  · `outcome` · `actor_account_id` (FK · ON DELETE SET NULL) ·
  `actor_identity` (CHECK regex on key shape · stored as hashed /
  pseudonymised snapshot per sealed doctrine · NEVER raw email /
  phone / password) · `target_type` · `target_id` · `metadata`
  (jsonb · allow-list enforced at application layer) · `occurred_at`.
- `nex_security_audit_retention` · event-prefix → retain-days
  schedule · operator-authored.
- `nex_security_audit_reconciliation` · attempted-log reconcile
  decisions · UNIQUE(attempted_log_id) prevents double-decide.

RLS + grants · lines 110-122 ·

- RLS enabled · zero policies · deny-by-default for
  anon/authenticated via PostgREST.
- `GRANT INSERT, SELECT` to service_role · `UPDATE / DELETE /
  TRUNCATE` INTENTIONALLY NOT GRANTED (comment line 120) · sealed
  append-only posture · pruning/erasure goes through a separate
  SECURITY DEFINER function (deferred to HQ UI · not in this
  migration).

PII sweep ·

- `actor_identity` · CHECK regex forces the `acct:<uuid>` or
  `ip:<sha256>` or `erased:<random>` shape · no raw PII possible
  via the DB column itself.
- `metadata` jsonb · the DB does NOT restrict keys · the sealed
  doctrine (lines 25-27 of mig 292 preamble) holds the application
  writer responsible for the allow-list. AT-RISK IF the application
  violates the allow-list contract · doctrine-only enforcement.
- Doctrine recommendation · P2-08 (HTTP route tests) should add a
  negative test that writing an unknown metadata key on a
  sensitive audit event rejects at the writer.

Verdict · COMPLIANT in the migration · AT-RISK on the jsonb
allow-list contract until writer-side test exists (P2-08 scope).

---

## 5 · Mig 293 · reconciliation functions

File · `nex-supabase/migrations/293_nex_security_audit_reconcile.sql`

Two SECURITY DEFINER functions with pinned `search_path` ·

- `nex_security_audit_reconcile_unmatched(window_seconds)` · lines
  38-100 · idempotent via `ON CONFLICT (attempted_log_id) DO
  NOTHING` (line 95) · window clamped to `[60s, 3600s]` (lines
  50-52) · EXECUTE granted service_role only (lines 104-107).
- `nex_security_audit_reconcile_match_late(attempted_log_id,
  completed_log_id, notes)` · lines 117-138 · transitions
  `unresolved → matched_late` ONLY (line 134 WHERE decision =
  'unresolved') · never reverses direction (comment line 115) ·
  operator audit-trail notes.

Verdict · COMPLIANT.

---

## 6 · Production apply status

| Migration | Prod `ijvqdvsvwtwxzcqmoqit` | Sandbox `kdstoyyeygcopkogqsyv` |
|---|---|---|
| 290 | NOT APPLIED | APPLIED 2026-11-08 |
| 291 (atomic RPC · active) | NOT APPLIED | NOT APPLIED |
| 292 (audit log) | NOT APPLIED | NOT APPLIED |
| 293 (reconcile) | NOT APPLIED | NOT APPLIED |
| 313 (CHECK widening for `hq_admin_grant`) | NOT APPLIED | NOT APPLIED |

Evidence ·

- `docs/doctrine/phase-1-mig-290-production-preflight-2026-11-09.md`
  section 2.1 · "NOT PRESENT in production migration history".
- Applier scripts · `scripts/apply-migration-290-production.mjs`
  gates on `NEX_PRODUCTION_APPLY_CONFIRMED=YES-I-UNDERSTAND`
  (line 34) · `scripts/apply-migration-290-sandbox.mjs` hard-
  refuses prod ref (line 25) · post-apply checks V-290-T1..T5
  verify table + RLS + grant posture.
- Mig 291 appliers · sandbox variant exists · production variant
  not authored · active RPC is Phase 1.1 authorised 2026-11-09
  but NOT yet deployed.

Operational state until applies land ·

- Prod runs on the in-memory per-lambda fallback (fail-open
  reduced to per-lambda effective-cap).
- Sandbox runs on mig 290 2-phase read-then-upsert path (has
  documented cold-bucket race).
- Neither environment runs the atomic RPC.
- Neither environment logs rate-limit decisions to a persistent
  audit log.

This is the existing Phase 1 remediation debt tracked in the sealed
2026-11-08 Phase 1 priority order · P2-05 inherits it without
adding new scope.

---

## 7 · Call-site inventory · 14 protected endpoints

From `docs/doctrine/phase-1-mig-290-production-preflight-2026-11-09.md`
section 3.1 ·

| # | Endpoint | Action | Key type |
|---|---|---|---|
| 1 | `/auth/webauthn/enroll-start` | `webauthn_enroll` | account |
| 2 | `/auth/webauthn/enroll-finish` | `webauthn_enroll` | account |
| 3 | `/auth/webauthn/assert-start` | `webauthn_assert` | ip |
| 4 | `/auth/webauthn/assert-finish` | `webauthn_assert` | ip |
| 5 | HQ admin-grant service | `hq_admin_grant` | account |
| 6 | `/chat/visitor-session` | `visitor_bootstrap` | ip |
| 7 | `/chat/visitor-first-message` | `visitor_bootstrap` | ip |
| 8 | `/chat/message` | `chat_message` | account |
| 9 | `/security/sessions/revoke-all` | `session_revoke_all` | account |
| 10 | `/security/sessions/revoke` | `session_revoke` | account |
| 11 | `/incident/section-error` | `webauthn_assert` (reused) | ip |
| 12 | `/security/password/change` | `password_change` | account |
| 13 | `/hq/direct-message` | `account_create` (reused) | account |
| 14 | `/security/account/delete` | `password_change`/`account_create` | account |

Unprotected-endpoint sweep · no gaps surfaced within P2-05 scope.
All 9 sealed actions in `security-rate-limit.ts:79-180` have call-
site integrations.

---

## 8 · Fail-open vs fail-closed posture

Per `security-rate-limit.ts:79-180` sealed policy ·

| Action | On DB error | Rationale |
|---|---|---|
| `password_change` | in-memory per-lambda | fail-closed per lambda |
| `session_revoke` | **fail-open** | legitimate ops path · low abuse value · 10/15min cap comfortably above legit (comment lines 119-121) |
| `session_revoke_all` | in-memory per-lambda | fail-closed per lambda |
| `chat_message` | in-memory per-lambda | fail-closed per lambda |
| `account_create` | in-memory + 503 escalation | lines 540-568 · if ≥10 consecutive DB failures within 60s, throw `SecurityUnavailableError` (503) · prevents unbounded account creation across lambdas |
| `webauthn_assert` | in-memory per-lambda | fail-closed per lambda |
| `webauthn_enroll` | in-memory per-lambda | fail-closed per lambda |
| `visitor_bootstrap` | in-memory per-lambda | fail-closed per lambda |
| `hq_admin_grant` | in-memory per-lambda | fail-closed per lambda |

Fail-open scope · 1 of 9 actions · deliberate · documented.
`account_create` 503 escalation is correct defensive posture ·
protects distributed availability without silent allow-all.

Verdict · COMPLIANT.

---

## 9 · Red-flag sweep · zero criticals

| Red flag | Status |
|---|---|
| `USING (true)` in RLS | Not found (zero policies · correct) |
| Missing RLS on counter table | Not found · enabled line 77 |
| Missing index on hot path | Not found · `idx_nex_security_rate_limit_window` covers claim-RPC WHERE |
| TOCTOU race in claim RPC | Eliminated · lines 124-133 single atomic upsert under row lock |
| Cold-bucket race in 2-phase fallback | DOCUMENTED · accepted as Phase 0 posture · mig 291 is the Phase 1.1 upgrade |
| PII leakage via `actor_identity` | Not found · CHECK regex forces hashed/pseudonymised shape |
| PII leakage via `metadata` jsonb | AT-RISK on contract · doctrine-only · writer-side test is P2-08 scope |
| Missing append-only enforcement on audit log | Not found · UPDATE/DELETE/TRUNCATE revoked line 120-122 |
| Overbroad grants on counter table | Not found · service_role only · explicit revoke from public/authenticated/anon line 78-80 |
| Unsafe `event` string in audit log | Not found · regex CHECK line 70-71 blocks injection |
| `hq_admin_grant` missing from mig 290 CHECK | FOUND · closed by mig 313 · pending apply |

---

## 10 · What this audit does NOT prove

- Mig 290/291/292/293/313 applied state in prod · UNVERIFIED by
  this audit (owner infra call).
- Live load test against the atomic RPC in sandbox · NOT performed
  (owner infra · scheduled when sandbox applies mig 291).
- Metadata allow-list adherence by every writer in `src/lib/
  nex-native/` · code-read suggests compliance but a negative
  test for an unknown key does not exist (P2-08 scope).
- Live-verified rate-limit rejection against a production endpoint
  with a crafted flood · owner infra call per sealed 2026-11-08.

Engineering ceiling reached is Verified · code-read. Live-verified
is owner infra.

---

## 11 · Recommendation (not an authorisation)

Sealed priority order and 2026-11-08 five-state model both prohibit
this audit from authorising anything. For owner consideration only ·

1. Apply mig 313 to sandbox + verify the 9-action CHECK now
   accepts `hq_admin_grant`.
2. Apply mig 291 to sandbox + exercise the atomic RPC under a
   small concurrency load · confirm `v_new_count` NULL-path
   returns the 429 correctly.
3. Apply mig 292 + 293 to sandbox + verify append-only grants
   stick.
4. Open the production-apply gate separately · `apply mig 290
   313 prod` and `apply mig 291 292 293 prod` as distinct
   authorisation word-triggers.

Until step 4, no prod-apply script may be staged or committed.

---

## 12 · Evidence pointers

Code consulted ·

- `nex-supabase/migrations/290_nex_security_rate_limit.sql`
- `nex-supabase/migrations/291_nex_security_rate_limit_claim_rpc.sql`
- `nex-supabase/migrations/291_nex_security_rate_limit_claim.SUPERSEDED.sql`
- `nex-supabase/migrations/292_nex_security_audit_log.sql`
- `nex-supabase/migrations/293_nex_security_audit_reconcile.sql`
- `nex-supabase/migrations/313_*` (CHECK widening)
- `src/lib/nex-native/security-rate-limit.ts` (lines 79-180 sealed policy · lines 540-568 503 escalation · lines 581-599 2-phase fallback · lines 619-633 RPC-missing detection)
- `scripts/apply-migration-290-production.mjs`
- `scripts/apply-migration-290-sandbox.mjs`
- `docs/doctrine/phase-1-mig-290-production-preflight-2026-11-09.md`

---

## 13 · Readiness classification

| Area | State |
|---|---|
| Mig 290/291/292/293/313 architecturally correct | Built · (code read) |
| Mig 290 applied sandbox | Built · Wired · Verified (per Phase 1 preflight doc) |
| Mig 291 atomic RPC applied anywhere | Not yet applied |
| Mig 292/293 applied anywhere | Not yet applied |
| Mig 313 CHECK widening applied anywhere | Not yet applied |
| 14-endpoint call-site integration | Built · Wired · Verified (code read) |
| Fail-open scope · 1 of 9 actions documented | Built · Wired · Verified |
| `account_create` 503 escalation | Built · Wired · Verified (code read) |
| Metadata allow-list enforcement | Built (doctrine) · Not yet Verified (P2-08 scope) |

Engineering ceiling reminder · no finding here may be promoted to
Live-verified. That remains an owner infra call per sealed
2026-11-08.
