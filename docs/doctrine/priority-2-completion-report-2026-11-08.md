# NEX Priority 2 · Completion Report
## 2026-11-08 (round 12) · evidence-backed

Owner-directed 2026-11-08 · "Confirm what exactly migration 305
changed, whether it was applied successfully and verified against the
intended schema, and whether Priority 2's full requirements are now
complete — not simply whether the migration ran."

This report walks the 7 Priority-2 requirements from the owner's
round-8 directive AND the migration-305 additions from round 11,
mapping each to live-sandbox evidence pulled from
`scripts/verify-priority-2-completion.mjs` run against
`kdstoyyeygcopkogqsyv`.

Target checked · **sandbox project `kdstoyyeygcopkogqsyv`**.
Production project `ijvqdvsvwtwxzcqmoqit` · **UNTOUCHED · not queried
by this verifier · SECURITY_SANDBOX_DATABASE_URL hard-refuses the
production ref at pre-flight.**

## Summary · 22/22 checks PASS

The verifier script exits 0. Every requirement below has live
`pg_catalog` / `information_schema` evidence · nothing is asserted
from memory.

Run the audit yourself at any time:

```
node scripts/verify-priority-2-completion.mjs
```

## What migration 305 actually changed

Round 11 commit `8d86ff1f` applied migration 305 to sandbox. The
observed delta (from the verifier run):

| # | Change | Verified on sandbox |
|---|---|---|
| 1 | `nex_incident.dedup_count integer not null default 1` | `{"column_name":"dedup_count","is_nullable":"NO","column_default":"1","data_type":"integer"}` |
| 2 | `CHECK (dedup_count >= 1)` | `CHECK ((dedup_count >= 1))` |
| 3 | Partial index `idx_nex_incident_verified_at` on `(verified_at DESC) WHERE status='VERIFIED' AND verified_at IS NOT NULL` | present |
| 4 | Partial index `idx_nex_incident_closed_at` on `(resolved_at DESC) WHERE status='CLOSED' AND resolved_at IS NOT NULL` | present |
| 5 | Partial index `idx_nex_incident_correlation_status` on `(correlation_id, status, verified_at DESC) WHERE correlation_id IS NOT NULL` | present |
| 6 | Ledger row `nex_migration_history.version = '305'` | present |
| 7 | Historical backfill · all existing rows get `dedup_count = 1` | 0 missing · 0 invalid |

**305 did NOT change** · status / severity / scope enums · RLS
policies · service_role grants · any existing data beyond the
`dedup_count` backfill. All of those were owned by migration 304.

## The 7 Priority-2 requirements · mapped to evidence

### R1 · HIGH severity tier · PASS

**Evidence** · `ck_nex_incident_severity` reads:

```sql
CHECK ((severity = ANY (ARRAY['info'::text, 'warn'::text, 'high'::text, 'critical'::text])))
```

The `'high'` literal sits between `'warn'` and `'critical'` per the
owner's stated ordering.

### R2 · DETECTED / RECOVERY_ATTEMPTED / VERIFIED_RESOLVED genuinely distinct · PASS

Four sub-checks · each PASS on sandbox:

- **R2a · status enum carries all three** · the CHECK reads
  `'DETECTED'`, `'INVESTIGATING'`, `'PROTECTING'`, `'RECOVERING'`,
  `'RECOVERED'`, `'MONITORING'`, `'VERIFIED'`, `'NEEDS_ADMIN'`,
  `'CLOSED'`. `DETECTED` + `RECOVERED` (recovery claimed) + `VERIFIED`
  (operator-confirmed) are three distinct values.
- **R2b · verified_by_admin + verified_at must be paired**:
  ```sql
  CHECK (
    (verified_by_admin IS NULL AND verified_at IS NULL)
    OR (verified_by_admin IS NOT NULL AND verified_at IS NOT NULL)
  )
  ```
  No row can land with one set and the other null · integrity enforced
  at the DB.
- **R2c · VERIFIED status requires the verification pair**:
  ```sql
  CHECK (
    status <> 'VERIFIED'
    OR (verified_by_admin IS NOT NULL AND verified_at IS NOT NULL)
  )
  ```
  A row cannot be marked VERIFIED with no verifier · prevents
  silent reinterpretation at any write path.
- **R2d · event kind accepts 'verified'** · the CHECK on
  `nex_incident_event.kind` now includes `'verified'` alongside
  `'status_transition'` etc.

**Code-side companion** · `transitionIncident()` in
`src/lib/nex-native/incident/incident-service.ts:314-358` refuses
`toStatus=VERIFIED` with `verifier_required` · the only entry path
into VERIFIED is `verifyIncidentRecovery()` which stamps the
verifier id. Combined with the DB CHECKs above, there is no path
(SQL or TS) that can mark an incident VERIFIED without recording
who verified it.

### R3 · last_seen_at + detection_source + service correctly populated · PASS

- **R3a · last_seen_at** · `NOT NULL`, `timestamp with time zone`,
  default `now()`. Backfilled on migration-304 apply · 0 nulls.
- **R3b · detection_source** · `NOT NULL`, `text`, default `'unknown'`,
  bounded CHECK with the 8-value enum (`section_boundary`,
  `section_probe`, `core_probe`, `security_signal`,
  `audit_reconciler`, `manual`, `external_webhook`, `unknown`).
  Backfilled on migration-304 apply · 0 nulls.
- **R3c · service** · nullable text, bounded CHECK
  `(char_length BETWEEN 1 AND 64 AND regex '^[a-z][a-z0-9_.-]{0,63}$')`.
  Nullable because historical rows have no service identity · new
  writes populate it (security-monitor signals all carry it).

**Population wire** · `src/lib/nex-native/security-monitor/security-monitor.ts`
populates all three on every signal call · verified in the sealed
Priority 2 commit `00f3d3ec` with inline `detectionSource:
"security_signal"` + per-signal `service:` + a `stableDedupKey()`.

### R4 · Settings and Community scope expansion · PASS

**Evidence** · `ck_nex_incident_scope` reads:

```sql
CHECK ((scope = ANY (ARRAY['chat'::text, 'shops'::text, 'feed'::text,
  'live'::text, 'directory'::text, 'food'::text, 'fashion'::text,
  'accommodation'::text, 'property'::text, 'hq'::text, 'infra'::text,
  'auth'::text, 'storage'::text, 'db'::text, 'cron'::text,
  'settings'::text, 'community'::text])))
```

**Code-side companion** · IncidentScope TS enum, LEGAL_SECTIONS in
the section-error endpoint, SegmentScope, SegmentErrorBoundary's
exhaustive `sectionLabel`, and the two route-level error.tsx files
(`src/app/nex-native/settings/error.tsx` + `.../community/error.tsx`)
all use the real `"settings"` / `"community"` scopes. The Phase-1
`"infra"` placeholder is gone.

### R5 · Recursive sanitiseMetadata scrub · PASS (code-level)

This requirement is code, not schema. Evidence lives in the test
suite not the DB. Ten tests cover arrays, nested objects, arrays-in-
objects, objects-in-arrays, mixed structures, depth cap (8),
cycle detection (via WeakSet). All pass green.

Specifically covered:

- `scrubs sensitive values under permitted keys` · baseline.
- `scrubs string leaves inside a top-level array under a permitted key`
- `scrubs strings in objects nested inside arrays`
- `scrubs strings in arrays nested inside objects (multi-level)`
- `truncates at SCRUB_MAX_DEPTH rather than recursing forever`
- `handles cycles by substituting REDACTED_CYCLE`

Source · `src/lib/nex-native/security-audit-service.ts` ·
`scrubMetadataValue` → `scrubWalk` recursion with WeakSet cycle
detection and depth cap.

### R6 · Country-aware incident deduplication · PASS

Four pieces of evidence · three schema + one in-process:

- **R5a · dedup_key column present** · nullable text, bounded CHECK
  (`char_length` 1..256, lowercase regex).
- **R5c · country-aware partial index**:
  ```sql
  CREATE INDEX idx_nex_incident_dedup_key ON public.nex_incident
    USING btree (dedup_key, country, status)
    WHERE ((dedup_key IS NOT NULL)
       AND (status <> ALL (ARRAY['CLOSED'::text, 'VERIFIED'::text])))
  ```
  The index COMPOUND is `(dedup_key, country, status)` · a lookup
  for the same dedup_key in `country='ireland'` returns a different
  row than in `country='indonesia'`. Countries never share a dedup
  entry at the DB layer.
- **In-process dedup** · `dedupKeyBase()` in security-monitor.ts
  includes the country in the key. All 5 signal functions
  (`reportRateLimitEscalation`, `reportAuthAnomaly`,
  `reportDependencyDegradation`, `reportAuditPersistenceFailure`,
  `reportRecoveryAttempt`) resolve country once and pass it to the
  key. Verified by the security-monitor tests · "identical signal
  in a different country is NOT deduped" + "identical signal in the
  same country IS deduped".
- **Burst depth tracking (305)** · `dedup_count` increments on every
  bump via `bumpIncidentLastSeen()` · operator sees "this signal
  recurred N times" at a glance.

### R7 · Historical compat · no retroactive reinterpretation · PASS

Two sub-checks:

- **R7a · no silent VERIFIED** · live query against sandbox returns
  `total=0, already_VERIFIED=0, without_verifier=0`. (Sandbox had
  no pre-migration rows; the invariant that a VERIFIED row MUST
  carry a verifier is enforced by R2c even if rows existed.)
- **R7b · all nullable-forbidden columns backfilled** · 0 nulls
  across `last_seen_at`, `detection_source`, `dedup_count`.
  0 rows with `dedup_count < 1`.

**Code-level invariant** · the only path into VERIFIED is
`verifyIncidentRecovery()` which stamps the verifier id. There is
no SQL migration that sets any existing row's status to VERIFIED.

### R8 · service_role grants UNCHANGED · PASS

Observed on sandbox: `INSERT, SELECT, UPDATE` on `nex_incident` for
`service_role`. Identical to migration 300. Neither migration 304
nor 305 altered grants.

### R9 · RLS discipline UNCHANGED · PASS

`relrowsecurity = true` · `policies = 0`. Same sealed service_role-
only discipline as the migrations 290-301 cohort. Anon and
authenticated have zero access.

### R10 · Migration ledger · PASS

`nex_migration_history.version` contains both `304` and `305` with
their descriptions.

## Was Priority 2 "complete" vs "the migrations ran"

**All seven Priority-2 requirements verify PASS against live sandbox
schema.** This is stronger than "the migration applied without error"
· the verifier asserts the SHAPE of the resulting schema matches the
owner's stated intent, and asserts the backfill + invariants are
correct.

### What is NOT claimed

- **Live production.** No production state was touched. The 5-state
  readiness classification stays at SANDBOX VERIFIED. LIVE VERIFIED
  is reached only by production deployment + post-deploy smoke test
  per the sealed 5-state rule.
- **No security test on production data.** The sandbox has no
  historical rows; the historical-compat invariants (R7a + R7b) are
  enforced structurally (CHECK constraints) rather than empirically
  on real production data. If production has pre-migration rows at
  apply time, the same CHECK constraints will enforce the invariants
  there too — but that's a future production action, not a claim
  from this report.
- **Country-partitioned HQ semantics.** The country-admin proposal
  (`docs/doctrine/hq-country-administration-proposal-2026-11-08.md`)
  still awaits owner decision. Priority 4's dedicated rate ring was
  landed in round 11 commit `8d86ff1f` and is independent of that
  policy.

## What's next · per owner's directive

1. **Priority 4 country-policy decision** · pending on
   `hq-country-administration-proposal-2026-11-08.md` (Options 1 /
   2 / 3). No code change authorised yet.
2. **Priority 5 · draft persistence on 5 editors** · queued.
3. **Priority 6 · end-to-end failure-injection matrix** · queued ·
   required before any LIVE VERIFIED claim.
4. **Production application of migrations 302-305** · remains
   UNAUTHORISED pending owner review of this completion report.

## Reproducibility

```
node scripts/verify-priority-2-completion.mjs
```

Exit 0 means all checks PASS. The script hard-refuses to target
production · if `SANDBOX_DATABASE_URL` is ever accidentally pointed
at `ijvqdvsvwtwxzcqmoqit`, it aborts at pre-flight with no DB round-
trip. Pre-flight message: `STOP · READ-ONLY script refused · points
at production ijvqdvsvwtwxzcqmoqit`.
