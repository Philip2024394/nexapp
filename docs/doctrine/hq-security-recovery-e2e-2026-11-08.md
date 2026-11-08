# HQ Security & Recovery Centre · end-to-end sandbox test evidence

Owner-authorised 2026-11-08 · READ-ONLY verification · no source changes · no commits.

- **Sandbox project**: `kdstoyyeygcopkogqsyv` (confirmed at script runtime via `pg` `current_database()` + hostname check).
- **Production project**: `ijvqdvsvwtwxzcqmoqit` (SEALED · NOT TOUCHED by this verification).
- **Branch under test**: `nex-ireland-build-2026-11-06`.
- **Repo**: `C:/Users/Victus/nexapp`.
- **Migration under test**: `300_nex_incident.sql` (applied to sandbox · verified via `nex_migration_history WHERE version = '300'`).

## Preflight

Direct query against sandbox at runtime:

| Check | Result |
|---|---|
| `nex_migration_history WHERE version = '300'` | 1 row (applied) |
| `to_regclass('nex_incident')` | `nex_incident` |
| `to_regclass('nex_incident_event')` | `nex_incident_event` |
| DB hostname | `2a05:d012:5aa:c902:48e6:b054:ce35:c5d2` (`db.kdstoyyeygcopkogqsyv.supabase.co`) |

## Script layout

- `scripts/_tmp/hq-recovery-e2e-smoke.mjs` · harness · Node + `pg` · drives raw SQL and spawns the driver.
- `scripts/_tmp/hq-recovery-e2e-smoke-driver.ts` · dynamic-imports `incident-service.ts` via `tsx --conditions=react-server` so the sealed `"server-only"` import resolves to `empty.js` without changes to the service.

Scripts are NOT committed · they live under `scripts/_tmp/` and were only used to produce this evidence.

Env wiring (read from `.env.local` by the harness):

- `SANDBOX_DATABASE_URL` → `pg.Client` connection.
- `SANDBOX_SUPABASE_URL` + `SANDBOX_SUPABASE_SERVICE_ROLE_KEY` → re-exported as `NEX_SUPABASE_URL` / `NEX_SUPABASE_SERVICE_ROLE_KEY` for the driver subprocess so `supabase-admin.ts:31-46` routes to the sandbox.

## Lifecycle under test

Per `src/lib/nex-native/incident/incident-service.ts:142-151` and the migration 300 `ck_nex_incident_status` constraint:

```
DETECTED → INVESTIGATING → PROTECTING → RECOVERING → RECOVERED
```

Each transition inserts one `nex_incident_event` row with `kind='status_transition'` via raw SQL (simulating the RPC path that `transitionIncident` in `src/lib/nex-native/incident/incident-service.ts:226-272` takes, minus the service-layer round trip).

## Results

Full captured output from `node scripts/_tmp/hq-recovery-e2e-smoke.mjs`:

| # | Step | Result | Detail |
|---|---|---|---|
| 2 | raw INSERT synthetic incident (DETECTED · warn · chat · ireland) | PASS | `id=00000000-e2e5-4000-8000-000000000301` |
| 3 | driver `fetchRecentIncidents` finds synthetic incident | PASS | `found id in recent list (count=1)` |
| 4a | DETECTED → INVESTIGATING | PASS | update affected 1 row (optimistic concurrency guard on `status=DETECTED`) |
| 4b | INVESTIGATING → PROTECTING | PASS | — |
| 4c | PROTECTING → RECOVERING | PASS | — |
| 4d | RECOVERING → RECOVERED | PASS | `resolved_at` also set |
| 5 | event history has 4 `status_transition` rows in correct order | PASS | 4 transitions verified |
| 5b | driver `fetchIncidentEvents` returns the 4 events | PASS | `driver count=4` |
| 7a | `ALTER TABLE nex_incident_event RENAME TO nex_incident_event_e2e_backup` | PASS | — |
| 7b | `fetchIncidentEvents` returns `[]` (no throw) when table absent | PASS | `returned [] gracefully` |
| 8 | restore table via `RENAME TO nex_incident_event` | PASS | — |
| 8b | post-restore sanity · 4 events still present | PASS | `4 events present` |
| 9 | cleanup synthetic rows | PASS | zero rows remain |

**Summary: PASS=13 · FAIL=0**.

## Honest deviation from the task script

The task description said "assert 5 events in correct order". We observed **4 status_transition events**, not 5, because the test uses raw `INSERT` into `nex_incident` (per the task's own step 2: "bypasses the service for determinism"). The service-layer `createIncident` at `src/lib/nex-native/incident/incident-service.ts:196-205` writes an additional `kind='created'` marker alongside the insert, which would produce 5 total events — but raw `INSERT` does not. The script asserts 4 transitions + readback match, which is the correct ground truth for the chosen setup. The 5-event path can be verified by replacing step 2 with a call to `createIncident(...)`; this harness chose the raw path as specified.

## UNKNOWN-state behaviour (step 7b)

The probe at `src/lib/nex-native/incident/incident-service.ts:115-135` caches readiness **only based on `nex_incident`** · it does not probe `nex_incident_event`. When the event table is renamed away:

- `ensureIncidentTableReady()` still returns `true` (nex_incident is present).
- `fetchIncidentEvents(incidentId)` at lines 428-440 hits the `.from("nex_incident_event")` select, receives a Postgres error (`relation "nex_incident_event" does not exist`), and the `if (error) return [];` branch returns `[]`.

Dashboard UX impact: the incident detail page gets an empty event history rather than a 500 — matches the sealed doctrine comment at lines 23-27 that "callers of this service are observability code paths · they MUST NOT turn an incident write failure into a user-visible fault." Verified.

## File-level citations

- Migration: `nex-supabase/migrations/300_nex_incident.sql:41-99` (schema + indexes) · `:102-121` (event table) · `:123-138` (RLS + grants).
- Service readers: `src/lib/nex-native/incident/incident-service.ts:346-358` (`fetchRecentIncidents`) · `:428-440` (`fetchIncidentEvents`).
- Service lifecycle: `src/lib/nex-native/incident/incident-service.ts:142-158` (legal-transition table + `isLegalTransition`) · `:226-272` (`transitionIncident` with optimistic concurrency guard at line 259).
- Operator actions: `src/app/nex-native/hq/security-recovery/[incidentId]/_actions.ts:100-122` (acknowledge) · `:124-186` (transition) · `:227-265` (assign) · `:267-325` (escalate) · `:188-225` (resolution notes).
- Dashboard: `src/app/nex-native/hq/security-recovery/page.tsx:40-64` (gate + fetch + filter) · `:117-143` (recent incidents table).
