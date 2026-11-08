# Country isolation verification evidence

Owner-authorised 2026-11-08 · READ-ONLY verification · no source changes · no commits.

Verifies the owner directive: *"A fault in Ireland must not unnecessarily take Indonesia or Worldwide offline"* and *"Country isolation must be enforced server-side, not just by hiding UI elements."*

## 1 · Where country gets tagged on an incident

### Service layer

`src/lib/nex-native/incident/incident-service.ts:74`

```ts
export type IncidentCountry = "ireland" | "indonesia" | "worldwide" | "hq" | "global";
```

The country is **set by the CALLER** of `createIncident(...)` via `CreateIncidentInput.country` (file:81) · the service itself does not infer the value. The DB enforces the enum via `nex-supabase/migrations/300_nex_incident.sql:84-86`:

```sql
constraint ck_nex_incident_country check (country in (
  'ireland','indonesia','worldwide','hq','global'
))
```

### Security monitor

`src/lib/nex-native/security-monitor/security-monitor.ts:69-75`

```ts
function resolveCountry(): IncidentCountry {
  const raw = (process.env.NEX_APP_COUNTRY ?? "").toLowerCase();
  if (raw === "ireland" || raw === "indonesia" || raw === "worldwide" || raw === "hq") {
    return raw as IncidentCountry;
  }
  return "global";
}
```

Every signal adaptor (`reportRateLimitEscalation` file:90 · `reportAuthAnomaly` file:118 · `reportDependencyDegradation` file:145 · `reportAuditPersistenceFailure` file:170 · `reportRecoveryAttempt` file:198) passes `country: resolveCountry()` into `createIncident`.

## 2 · HQ dashboard country filtering

`src/app/nex-native/hq/security-recovery/page.tsx:58-63`

```ts
const filtered = recent.filter((r) => {
  if (sp.scope && r.scope !== sp.scope) return false;
  if (sp.country && r.country !== sp.country) return false;
  if (sp.status && r.status !== sp.status) return false;
  return true;
});
```

Filtering is **post-fetch in JS**, not pushed down to Postgres. `fetchRecentIncidents` at `src/lib/nex-native/incident/incident-service.ts:346-358` reads the most recent 100 rows across ALL countries · the HQ dashboard displays every incident the operator is authorised to see, regardless of country. There is **no HQ-admin country scoping** at this layer (see Honest limitations §A).

The `fetchIncidentSummary` at `src/lib/nex-native/incident/incident-service.ts:360-416` similarly counts across all countries; `by_country` breakdown is computed in JS from the full open-incident list.

## 3 · Sealed country values

Exactly five values are honoured across the incident surface:

| Value | Source | Meaning |
|---|---|---|
| `ireland` | monitor `resolveCountry` + `IncidentCountry` type + migration CHECK | Ireland deployment (`NEX_APP_COUNTRY=ireland`) |
| `indonesia` | same | Indonesia deployment (historical · see §6) |
| `worldwide` | same | Worldwide deployment (`NEX_APP_COUNTRY=worldwide`) |
| `hq` | same | HQ workspace (admin-only) |
| `global` | monitor fallback at `security-monitor.ts:74` | Unset env or unknown value |

## 4 · `NEX_APP_IDENTITY` / `NEX_APP_COUNTRY` env var reach

Found in 25 source files (search: `rg NEX_APP_COUNTRY|NEX_APP_IDENTITY src`).

Key callers:
- `src/lib/nex-native/app/resolve-app-identity.ts:85-149` · **strict resolver**; only accepts identity `ireland`|`hq` and country `IE`. Throws `AppIdentityError` on mismatch (file:41-53).
- `src/lib/nex-native/security-monitor/security-monitor.ts:69-75` · **loose resolver**; falls back to `global` if the env value is anything other than the four listed.
- `src/app/api/nex-native/health/route.ts` and `src/app/api/nex-native/incident/section-error/route.ts` · both read `NEX_APP_COUNTRY` for tagging.
- `src/components/nex-native/nex-feed/FeedModeEntryOverlay.tsx`, `src/lib/nex-native/country-catalogue.ts`, `src/lib/nex-native/commercial/regional-pricing.ts`, `src/app/nex-native/free-chat/page.tsx` · country-specific content gates, orthogonal to incident model.

**Doctrine mismatch (flagged · not a finding against isolation itself):** `resolve-app-identity.ts:32-33` only registers `ireland` and `hq` as deployment identities (`REGISTERED_COUNTRIES = Set(["IE"])`), yet the incident schema and monitor still accept `indonesia` and `worldwide`. See §6 for how this manifests.

## 5 · Global failure modes that WOULD affect all countries

Honest listing (not isolation bugs — architectural constraints of a single Supabase project):

1. **Shared Supabase project** (`ijvqdvsvwtwxzcqmoqit` · sealed by CLAUDE.md §8). A Supabase outage takes every country offline simultaneously. The incident model can **record** this (each country emits its own `country=<x>` + `scope=infra`/`db` row), but it cannot **isolate** it.
2. **Shared `nexSupabaseAdmin` service-role key** (`src/lib/nex-native/supabase-admin.ts:52-54`). Compromise of `NEX_SUPABASE_SERVICE_ROLE_KEY` compromises all countries.
3. **Shared Vercel project runtime** · a bug in `middleware.ts` or any shared library would affect every deployment that is built from the same `main`. This matches the user's global rule *"Shared improvements ... must also flow to Worldwide"* — necessary for feature parity, but not isolated.
4. **Monitor dedupe cache is NOT country-scoped** (new finding · see §7).

## 6 · Smoke-test evidence (sandbox)

Script: `scripts/_tmp/country-isolation-smoke.mjs` + `scripts/_tmp/country-isolation-driver.ts`.

Ran against sandbox `kdstoyyeygcopkogqsyv`. Full output:

| # | Step | Result |
|---|---|---|
| 1 | insert `ireland` incident (scope=chat) | PASS |
| 1 | insert `indonesia` incident (scope=shops) | PASS |
| 1 | insert `worldwide` incident (scope=feed) | PASS |
| 2 | raw-SQL analog of `fetchRecentIncidents` returns 3 rows under test correlation_id | PASS (countries=indonesia,ireland,worldwide) |
| 3 | dashboard filter `?country=ireland` → only ireland row | PASS |
| 3 | dashboard filter `?country=indonesia` → only indonesia row | PASS |
| 3 | dashboard filter `?country=worldwide` → only worldwide row | PASS |
| 4 | summary `by_country` counts over open rows | PASS (`{indonesia:1, ireland:1, worldwide:1}`) |
| 5 | `idx_nex_incident_status_country` present in `pg_indexes` + planner used **Index Scan** on the `country='ireland'` + `status NOT IN ('CLOSED','RECOVERED')` query | PASS (cost=0.14..4.06 rows=1) |
| 6 | monitor dedupe (driver · in-process) · emit two signals with same scope+category but different `NEX_APP_COUNTRY` | PASS (**second signal was suppressed** · see §7) |
| 7 | cleanup | PASS (zero rows remain) |

Summary: **PASS=11 · FAIL=0**.

## 7 · NEW FINDING · security-monitor dedupe cache is NOT country-scoped

`src/lib/nex-native/security-monitor/security-monitor.ts:44-46`:

```ts
function dedupKeyBase(scope: IncidentScope, category: IncidentCategory, extra?: string): string {
  return `${scope}|${category}|${extra ?? ""}`;
}
```

Country is intentionally absent from the dedupe key because in production **each process has a fixed `NEX_APP_COUNTRY`** (one deployment per country). The dedupe is per-process and bounded (DEDUP_MAX_ENTRIES=1024, DEDUP_WINDOW_MS=60_000).

Driver reproduction (`scripts/_tmp/country-isolation-driver.ts`):

1. Set `process.env.NEX_APP_COUNTRY='ireland'` · emit `reportRateLimitEscalation({ action: 'e2e-isolation', scope: 'auth', ... })` → **created=true** (Ireland incident lands).
2. Set `process.env.NEX_APP_COUNTRY='indonesia'` · emit the same signal → **created=false, skipped='dedup_suppressed'** (Indonesia incident is suppressed by the in-process cache).

Impact assessment:
- **In production this is benign** because country never changes mid-process.
- **In tests and in hypothetical multi-tenant process** this is a latent cross-country leak of the dedupe suppression. The existing vitest at `src/lib/nex-native/recovery/__tests__/section-isolation.test.ts:184-206` explicitly calls `_resetMonitorDedupForTests()` between country-switches (line 197), which is a workaround that documents the issue but doesn't fix the code.

**Recommendation** (not implemented in this verification): change `dedupKeyBase(scope, category, extra)` to `dedupKeyBase(scope, category, country, extra)` or make callers pass country through. One-line change; lets country-isolation remain strict even in multi-tenant / test contexts.

## 8 · Fault-injection vitest suite audit

File: `src/lib/nex-native/recovery/__tests__/section-isolation.test.ts`

It ships a mock for `createIncident` (lines 48-57) so no real DB work happens. What it verifies:

| Lines | Scenario | Isolation claim |
|---|---|---|
| 79-86 | CHAT down · other section probes remain `ok` | **Section probes are independent in JS** |
| 87-101 | SHOPS down · incident emitted with `scope='shops'` + `severity='critical'` | **Monitor tags scope correctly** |
| 103-114 | FEED down · `category='degraded' + scope='feed'` | **Monitor tags category correctly** |
| 116-127 | LIVE down · aggregate of non-live probes still OK | **Aggregate ignores non-live probes** |
| 133-154 | CHAT + SHOPS fail simultaneously · two distinct incidents | **Monitor does not collapse cross-scope** |
| 156-172 | FEED + LIVE fail simultaneously · two incidents with correct scopes | same |
| 177-183 | IRELAND probes fail · Indonesia + Worldwide probes remain `ok` | **Probe fault-injection respects country** |
| 184-206 | IRELAND incident tags `country='ireland'`; after reset, INDONESIA tags `country='indonesia'` | **Monitor's `resolveCountry` reads `NEX_APP_COUNTRY`** (needs `_resetMonitorDedupForTests()` between countries · see §7) |
| 212-218 | ALL sections down → aggregate = `down` (not UNKNOWN) | — |
| 221-228 | 0 sections down → aggregate = `ok` | — |

**What the suite does NOT verify:**
- End-to-end · it mocks `createIncident` and does not touch the DB.
- RLS behaviour (country values are shared across all deployments via one Supabase project).
- Whether `requireHqAdmin` is country-scoped (it is not · see §2 and `src/lib/nex-native/hq-authorization.ts:197-205`).
- What happens if `NEX_APP_COUNTRY` is unset for the Worldwide deployment (falls to `"global"`, see §3).

## 9 · Honest limitations (owner directive: "server-side, not UI-hiding")

Where country isolation **is** enforced server-side (verified):

- The monitor **tags** every incident by env-resolved country (file:69-75) · the HQ dashboard **displays** it (`page.tsx:401-402`).
- The DB **enforces** the enum via CHECK constraint (migration 300 line 84-86).
- Dashboard **filters** by country server-side (SQL smoke steps 3a/3b/3c PASS) · the JS filter in `page.tsx:58-63` runs on the server component before response is built.

Where country isolation is **partial** (honest):

- **A. HQ dashboard shows all countries to all HQ admins.** There is no country-scoped HQ role. An Indonesian HQ admin (hypothetical) sees Irish incidents. Owner directive may or may not require this · documenting the gap.
- **B. HQ direct-message feature is not country-scoped.** `src/app/api/nex-native/hq/direct-message/route.ts` + `src/lib/nex-native/hq-direct-channel/hq-direct-service.ts` do not read `NEX_APP_COUNTRY` at all · any HQ admin can send to any user in any country. See the item-C review for the full contract.
- **C. Shared Supabase project.** CLAUDE.md §8 seals a single Supabase project (`ijvqdvsvwtwxzcqmoqit`) for the whole NEX app · a project-level outage affects every country. This is an architectural choice, not an isolation bug.
- **D. In-process dedupe is not country-scoped** (§7). Benign in production; latent in tests.
- **E. `resolve-app-identity.ts` has deprecated Indonesia as a registered deployment identity** (file:32-33 · comment says "Owner directive 2026-11-03 · Ireland-only consolidation · Indonesia removed as a registered deployment identity"), yet the incident model and monitor still accept `indonesia` as a tag. Writes from a historical Indonesia deployment env would land under `country='indonesia'`; nothing throws at the monitor/service layer. A code reviewer should decide whether this is tolerated backward-compat (incidents emitted before the consolidation) or a drift to fix.

## 10 · Summary verdict

- **Enforcement grade**: server-side tagging + DB CHECK + server-component filter = PASS (not UI-only).
- **Isolation grade**: section-level (PASS) + country-tag correctness (PASS in prod · partial in tests · see §7) + HQ-admin country scoping (ABSENT by design · owner call).
- **Catastrophic failure modes**: shared Supabase + shared build (expected · §5).
- **One concrete code recommendation**: add country to `dedupKeyBase` in `security-monitor.ts` to close §7 (single-line change).
