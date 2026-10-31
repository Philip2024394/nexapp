# NEX · Country Application Programme · Architecture + Rollout Plan · 2026-10-31 (Revision A)

**Status**: plan only · no code · no migrations · no SQL · no Vercel project creation or linking · no deployment · no activation · no push.

**Revision history**:
- Rev 0 (commit `7c2c7cb`) · original 733-line plan.
- **Rev A** (this commit) · incorporates owner decisions RV-A3, RV-A5, RV-A8 + the 7 required corrections from `nex-country-plan-review-round-2-2026-10-31.md`. See companion `nex-country-plan-decision-reconciliation-2026-10-31.md` for the full RV ledger. Sections changed: §4.5, §6, §7, §8, §10.2, §11, §12.1, §14.1, §14.2, §15, §16 · new sections §4.7, §8.5, §10.3, §11.4.

**Owner's confirmed decisions this round**:
- D-10 **Hosting shape · A** · three separate Vercel projects sharing one repository (NEX Ireland · NEX Indonesia · NEX HQ).
- D-11 **Rollout order · A** · Ireland first on isolated empty country data, Indonesia second.
- D-12 **No shared global activation** · each deployment resolves identity independently.
- D-13 **HQ independent** · HQ manages both apps but cannot flip identity globally.
- D-14 **Isolation enforced by DB RLS + storage + trusted server code** · never UI filtering alone.
- D-15 **Rollback real + tested** before every production stage · Migration 245 requires shadow-testing.
- **RV-A5 Option C** · Migration 245 is DELAYED until BOTH deployments operate under the deployment-based identity resolver with verified country-context middleware. No hot-patch to the existing Indonesia deployment. Indonesia continuity proof required.
- **RV-A3** · The original "DROP POLICY returns to USING(true)" rollback design is REJECTED. Migration 245 remains BLOCKED pending redesign (see §4.7 + §11.4). Strict-deny swap is NOT ASSUMED safe.
- **RV-A8** · HQ ordinary administration and HQ privileged cross-country moderation are SEPARATE capabilities. Every privileged action is scoped, logged, reason-recorded, country-tagged. Service-role credentials never reach the browser.

Companion files already shipped on `origin/main`:
- `nex-country-isolation-review-round-2-2026-10-31.md` · 7-gate RLS matrix
- `nex-rls-policy-matrix-2026-10-31.md`
- `nex-7-migrations-risk-assessment-2026-10-31.md`
- `nex-blocking-evidence-2026-10-31.md`
- `nex-rollback-role-security-evidence-2026-10-31.md`
- 7 migration drafts (244, 246, 247, 249, 251, 245, 248) · all guarded by `RAISE EXCEPTION`

---

## 0 · Programme vocabulary

- **Country application** · a single-identity NEX deployment that serves one country (e.g. `NEX_APP_IDENTITY=ireland`). Users of this deployment transact in its country's currency, see its country's content first, write only to its country's rows.
- **HQ** · the administrative deployment (`NEX_APP_IDENTITY=hq`). Ordinary admin pages (dashboards, health, operations) operate under country-aware RLS using the `authenticated` role · **privileged cross-country moderation** is a narrow, server-side-only, audited capability per §8.5-8.8 (RV-A8). Not a country.
- **Shared platform** · the single codebase and the single Supabase project both country apps + HQ connect to.
- **Country identity** · the string `ireland`, `indonesia`, or `hq`, resolved at deployment-env read time, never from DB state, never from user input.
- **Country isolation** · the DB RLS, storage path, server-action, and connection-pool guarantees that one country's non-public records cannot be read, written, or enumerated from another country's deployment.
- **Country data isolation** · a stronger claim than country isolation · covers data residency, backup locality, GDPR + Indonesian data-protection obligations. Not the same thing as RLS. Treated as a separate decision in §4 and §14.

---

## 1 · Hosting architecture

### 1.1 · Three Vercel projects, one repository

```
GitHub: Philip2024394/nexapp (one repository)
                 │
     ┌───────────┼───────────┐
     │           │           │
┌────▼────┐ ┌────▼────┐ ┌────▼────┐
│ Vercel  │ │ Vercel  │ │ Vercel  │
│ project │ │ project │ │ project │
│ "nex-   │ │ "nex-   │ │ "nex-   │
│ ireland"│ │ indones"│ │ hq"     │
└────┬────┘ └────┬────┘ └────┬────┘
     │           │           │
NEX_APP_         NEX_APP_   NEX_APP_
IDENTITY=        IDENTITY=  IDENTITY=
ireland          indonesia  hq
     │           │           │
     └───────────┼───────────┘
                 │
       Single Supabase project
       ijvqdvsvwtwxzcqmoqit
       (see §4 for safety analysis)
```

### 1.2 · Why not one Vercel project with host-based routing

- Host-based routing concentrates all three identities in one Node runtime. A middleware bug on a single hot path can switch identities for other requests pooled on the same instance.
- One build pipeline = one failure mode affects all three deployments at once.
- Preview deployments cannot carry a different `NEX_APP_IDENTITY` per PR unless the per-deployment env override is used, which is error-prone compared to project-level env.
- Owner directive D-12 is clearest to enforce when identity is a project-level env var, not a per-request derivation.

### 1.3 · Shared code paths vs country-specific code paths

| Concern | Shared | Country-specific |
|---|---|---|
| React components (chat, profile, shop, music, live) | ✅ | ❌ |
| Server actions | ✅ | ❌ |
| Supabase client SDK + auth flow | ✅ | ❌ |
| 7-migration SQL (country column, visibility, RLS, storage) | ✅ (one DB) | ❌ |
| Palette + CSS vars | ✅ driven by `NEX_APP_IDENTITY` | ❌ |
| Default locale / language | ✅ with env fallback | ❌ |
| Pricing display + currency | ✅ driven by env | ❌ |
| Legal copy (ToS, Privacy, Data Processing) | depends · see §9.4 | ❌ (strongly recommended country-specific) |
| Payment adapter | shared code · country-selected adapter | ❌ |
| Fonts, iconography, chrome | ✅ | ❌ |

The repository stays monolithic. The three Vercel projects are three deployments of the same `main` branch, differing only in environment variables.

---

## 2 · Deployment environment strategy

### 2.1 · The identity env vars (project-level)

Each Vercel project sets EXACTLY these at the project level. No overrides, no per-environment drift unless explicitly tracked:

| Vercel project | `NEX_APP_IDENTITY` | `NEX_APP_COUNTRY` |
|---|---|---|
| `nex-ireland` | `ireland` | `IE` |
| `nex-indonesia` | `indonesia` | `ID` |
| `nex-hq` | `hq` | *(unset)* |

### 2.2 · Env var categorisation

| Category | Example | Must be identical across all 3 projects? |
|---|---|---|
| **Identity** | `NEX_APP_IDENTITY`, `NEX_APP_COUNTRY` | NO — the whole point |
| **Shared DB connection** | `NEXT_PUBLIC_NEX_SUPABASE_URL`, `NEX_SUPABASE_SERVICE_ROLE_KEY` | YES on all three (single Supabase project) · see §4 for why this is the biggest shared risk |
| **Shared cryptographic** | `NEX_WORLD_PREVIEW_SIGNING_KEY` | YES (so previews work in all three) |
| **Country-specific operational** | postmark sender, pricing provider sandbox vs live | NO · each project uses its own country's operator credentials |
| **HQ-only** | HQ workbench feature flags, admin-only API tokens | present ONLY in `nex-hq`, absent from Ireland + Indonesia |
| **Dev-only** | `NEX_DEV_IMPERSONATE_HANDLE` | ABSENT from all three (dev-only, never in production env) |

### 2.3 · Env-var drift risk

The biggest operational hazard of three separate projects is that an env var meant to be identical (e.g. a rotated DB key) can be updated in 2 out of 3 projects. A sync-and-check mechanism is required:
- Owner-authored "env audit" script that reads project env vars via Vercel API, flags any divergence in the "identical" category, and runs weekly in CI (not in production).
- Any env-var rotation is a 3-project operation, logged in doctrine.

Mitigation detail is in §10.

---

## 3 · Shared repository and project configuration

### 3.1 · Repository layout

Current `main` already contains:
- `src/app/nex-native/*` · all pages
- `src/app/nex-native/hq/*` · HQ-specific pages (verified desktop + sidebar · landed in `bbe7f1b`)
- `src/lib/nex-worlds/*` · world engine primitives (`world-types`, `world-registry`, `world-resolver`, `world-cookie`, `world-palette-css`)
- `nex-supabase/migrations/*` · 7 country-isolation drafts, all guarded

What this programme adds to the repo (plan only · no code yet):
- `src/lib/nex-native/app/resolve-app-identity.ts` · the single authoritative resolver that reads `NEX_APP_IDENTITY` + `NEX_APP_COUNTRY` at request time, validates, and returns a typed `AppIdentity` object.
- `src/middleware.ts` · set `nex.app_country` via `SET LOCAL` on every DB-backed request (see §4.5).
- `src/app/nex-native/hq/*` · HQ gate already restricts to admins; add a hard runtime check that `NEX_APP_IDENTITY === 'hq'` so even a mis-configured country project cannot serve HQ pages.
- `src/app/nex-native/_country-chrome.tsx` · thin wrapper that reads the identity and sets the palette.
- Country-conditional pages (e.g. `/legal/privacy`) use the resolver, not hard-coded strings.

### 3.2 · Branch strategy

- Single `main` branch, no per-country branches.
- Pull requests target `main`. Preview deployments spin up on each Vercel project independently.
- Each Vercel project's "Production Branch" = `main`.
- Promotion to production per project is a Vercel-UI action (one project at a time), not a merge.

### 3.3 · Build artefact

- Build is identical across projects (`npm run build`).
- Differences appear only at runtime via env-var read.
- Advantage: a working build on one project is a near-guarantee it builds on the other two.
- Disadvantage: a build-time env-var read baked into the artefact would cause three different artefacts; this plan explicitly forbids build-time identity leaks. All identity resolution is runtime (SSR server component reads).

---

## 4 · Shared Supabase implications (OWNER-FLAGGED INVESTIGATION)

**Owner directive verbatim**: *"investigate whether one shared Supabase project can safely support the three deployments long-term, rather than assuming that three Vercel projects automatically provide data isolation."*

This is the most important section of the plan. Vercel-level isolation does NOT equal data isolation. All three Vercel projects target the same database.

### 4.1 · What Vercel-level isolation does and does NOT provide

| Guarantee | Three Vercel projects | Not provided by Vercel |
|---|---|---|
| Separate build pipelines | ✅ | — |
| Separate env vars | ✅ | — |
| Separate deployment histories | ✅ | — |
| Separate preview URLs | ✅ | — |
| Separate Node runtimes per request | ✅ | — |
| **Data isolation at the DB layer** | ❌ | PostgreSQL RLS + storage policies + server actions |
| **Shared Supabase project protects records if RLS is wrong** | ❌ | — |
| **Credential compromise contained** | ❌ (shared key, shared blast) | — |
| **Connection-pool safety** | ❌ | `SET LOCAL` discipline + harness tests |

A compromise of the service-role key held by any of the three Vercel projects compromises all data in the shared Supabase project regardless of Vercel-level separation.

### 4.2 · The four data-layer defences (ordered)

| # | Defence | Where enforced | Status today |
|---|---|---|---|
| 1 | Country column on 4 anchor tables + visibility column on 8 content tables | DB schema | DRAFT (migrations 244, 247) |
| 2 | 7-gate RLS policies on CO + CO-I tables (G1 published · G2 moderation · G3 privacy · G4 blocking · G5 age · G6 content scope · G7 relationship) | DB schema (RLS) | DRAFT (migration 245) · forward-only risk |
| 3 | Storage path prefix policies on `nex-business-assets` | DB schema (storage.objects RLS) | DRAFT (migration 248) |
| 4 | Server actions: fail-closed on empty `nex.app_country`, strict INSERT country = app country, HQ gate uses service role after `requireHqAdmin` | Application code (Vercel runtime) | PARTIAL (HQ gate present; `nex.app_country` setting plumbing pending) |

### 4.3 · Can one shared Supabase project safely support three deployments long-term?

**Short answer**: yes **IF AND ONLY IF** every one of these holds without exception:

1. All 4 anchor tables + all CO-I descendants have the RLS stack installed and verified green on every policy via positive AND negative tests.
2. Every request from every deployment opens a transaction, runs `SET LOCAL nex.app_country = $country`, performs its query, commits. This discipline is enforced by middleware, not by per-handler diligence.
3. Any code path that bypasses the setting (admin RPCs, cron jobs, background workers) is explicitly flagged as HQ-only and uses service role, never the deployment's own identity.
4. `service_role` key rotation is a 3-project operation; a key held by any production project is treated as a shared secret (because it IS one).
5. A connection-pool leakage test runs weekly in CI against a staging snapshot: open two parallel connections, one as `IE`, one as `ID`, assert each sees only its own COUNTRY-visibility rows.
6. Migration 245 ships to production ONLY after shadow-deploy verification against the actual shared Supabase (details §11).
7. Storage path renames (Migration 248) complete 100% before the storage RLS policy flips to enforce prefix.
8. An audit log table records every service-role-elevated action with (actor_account_id, action, country, timestamp) so a leak can be traced.

**Long answer / honest doubt**: a shared Supabase project is operationally simpler and cheaper, but it is one strong policy away from a cross-country leak at every schema change. The 7-migration programme is the control. If any of 1-8 slips in production, a separate-Supabase-per-country model becomes the safer long-term shape even at 2x cost.

### 4.4 · Alternative shape · one Supabase per country

For the record, so the owner can judge:

| Dimension | Shared project (current plan) | Supabase-per-country |
|---|---|---|
| Setup effort | None (project exists) | 2 new projects + data migration + 3-way sync for shared tables |
| Monthly cost | 1 × Supabase | 3 × Supabase (incl. HQ or HQ shared with one) |
| Data residency | AWS eu-west-1 for both IE and ID users | True per-country residency possible |
| Blast radius of RLS bug | All data | Only that country |
| Cross-country discovery (WORLDWIDE visibility) | Simple JOIN | Requires foreign tables / federated queries / hand-replicated indexes |
| Peer chat across countries | Trivial (one `nex_message` table) | Hard · needs replication or federated routing |
| HQ cross-country admin | One service role, one connection | Three service roles, three connections, admin UI unifies |
| Developer complexity | Low | High |
| Migration velocity | Migrations ship once | Migrations ship 2-3 times |

Recommendation: proceed with shared Supabase + the 7-migration programme + the §4.3 eight-point discipline. Add a decision gate in §12 to re-evaluate at **1 year post-launch** or **first production RLS incident**, whichever comes first.

### 4.5 · Connection-pool safety · the `SET LOCAL` discipline (RV-A2 revised)

Supabase + PgBouncer (session mode) can hold a connection open across multiple transactions. `SET` without `LOCAL` persists for the connection's lifetime; the next request on the same pooled connection inherits the previous request's setting.

**Postgres property stated explicitly**: `SET LOCAL` is transaction-scoped. On **both COMMIT and ROLLBACK**, the setting is cleared. The setting also does not survive an abnormal connection teardown (the next connection-check-out from the pool returns a connection without the setting).

**Discipline**:
- Every DB-backed request from Ireland or Indonesia must open a transaction, `SET LOCAL`, read/write, commit (or rollback).
- The middleware adds a `withCountrySession(handler)` wrapper that enforces this discipline. Server actions use the wrapper. Direct `supabase.from(...)` outside the wrapper is forbidden by lint.
- The wrapper must set the GUC INSIDE the transaction, never before `BEGIN`.
- The wrapper must ensure that on any uncaught error, the transaction is explicitly rolled back before the connection is returned to the pool.

**Required test matrix (added for RV-A2)**:

| # | Scenario | Expected result |
|---|---|---|
| T-POOL-1 | Two parallel requests on the same pooled connection, one IE one ID | Each sees own country only |
| T-POOL-2 | Request forgets `SET LOCAL` | Fails closed · zero rows |
| T-POOL-3 | **Happy path · explicit transaction + SET LOCAL + COMMIT** | Rows visible per country |
| T-POOL-4 | **Server action throws BEFORE commit** | Transaction rolls back · GUC cleared · next request on same connection has GUC unset (not leaked) |
| T-POOL-5 | **Server action explicitly ROLLBACKs** | GUC cleared · next request on same connection has GUC unset |
| T-POOL-6 | **Explicit ROLLBACK then connection reuse by DIFFERENT country** | Second request's SET LOCAL takes effect correctly · no residue from first |
| T-POOL-7 | **Connection check-out AFTER a connection returned mid-transaction (abnormal teardown)** | New connection check-out presents GUC unset; wrapper raises before any read |
| T-POOL-8 | **Preview deployment uses sandbox DB (G-PREVIEW-ISOLATION)** | Production Supabase sees zero writes from preview URL |
| T-POOL-9 | **Service-role connection NEVER sets GUC and still functions for HQ** | Service-role bypasses RLS by design; HQ moderation audit log row created per action |

Tests T-POOL-1 through T-POOL-7 run in CI weekly against a staging snapshot. T-POOL-8 runs on every preview deployment start. T-POOL-9 runs in the HQ moderation test suite (new).

### 4.6 · Shared Supabase storage

Storage buckets are project-level, not country-level. The `nex-business-assets` bucket is shared. Country isolation is enforced by:
- Path prefix: `{IE|ID}/{businessId}/...`
- Storage RLS (Migration 248) checks `(storage.foldername(name))[1] = current_setting('nex.app_country')` for same-country reads.
- WORLDWIDE businesses expose assets via a visibility-matched branch.

The sealed `nex-music-media` bucket (per music programme) stays as-is in this round. Country-aware policies on it are a separate programme if needed.

---

### 4.7 · Migration 245 recovery redesign (RV-A3 · PROPOSAL · owner approval required before any implementation)

**Owner directive summary**: The original "DROP POLICY returns to USING(true)" recovery design is REJECTED. Required properties:
- (a) Known restrictive pre-245 policy state.
- (b) Forward-fix recovery migration.
- (c) Tested recovery on a production-like database.
- (d) Fail-closed without unexpectedly locking out Indonesian users.
- (e) Recovery grants no wider access than intended.
- (f) Strict-deny swap is NOT ASSUMED safe · compatibility with BOTH deployments must be demonstrated first.

**Status**: this is a PROPOSAL. The redesign below is for owner review. Nothing is implemented, no SQL is written, no shadow test is run. Migration 245 remains BLOCKED.

#### 4.7.1 · Design constraint: both deployments MUST set the GUC before 245

Owner's RV-A5 Option C decision already establishes this. The recovery architecture inherits it: before 245 lands, both Ireland and Indonesia (post-cutover) are operating under the resolver + `withCountrySession` middleware. Any production state where ONE deployment doesn't set the GUC is a precondition failure, not an edge case to recover from.

#### 4.7.2 · The forward-fix recovery architecture

**No `DROP POLICY` is used as a recovery mechanism.** Recovery means replacing the current policy set with a corrected policy set, via a new forward migration (`245b`, `245c`, ... as needed).

Recovery flow when a 245 production incident is observed:

```
observe incident on sealed Supabase
         │
         ▼
assess: is this a POLICY DRIFT (RLS evaluating wrong) or a MIDDLEWARE DRIFT
(deployment not setting GUC) or a DATA DRIFT (country values wrong)?
         │
         ├─── POLICY DRIFT ────────── draft 245b (forward-fix) ──► shadow ──► apply
         │
         ├─── MIDDLEWARE DRIFT ────── revert the deployment that drifted, not the DB
         │
         └─── DATA DRIFT ──────────── separate owner-authorised data-repair migration
                                        (not a 245 recovery)
```

**No rollback step restores a less-restrictive policy.** If a 245b forward-fix cannot be authored and applied within a defined operational window (owner to set, e.g. 24h), the fallback is:

- Supabase PITR (point-in-time recovery) of the entire project to the pre-245 state. This is heavy and loses post-245 writes. Owner-authorised only.

PITR is the LAST resort, not the first.

#### 4.7.3 · Why `DROP POLICY` is forbidden as recovery

Prior to Migration 245, `nex_business` has `USING(true)` as its SELECT policy (owner-flagged gap). After 245, that policy is replaced by the strict 7-gate policy. If an operator runs `DROP POLICY nex_business_select_all_gates`, Postgres falls back to the DEFAULT policy for RLS-enabled tables, which is **deny** (not permissive). But the plan's §11.1 originally said rollback returns to USING(true); that was wrong — the correct Postgres behaviour on `DROP POLICY` with RLS still enabled is deny-all.

Clarification: the hazard the owner correctly caught is that `DISABLE ROW LEVEL SECURITY ON ...` or re-creating the `USING(true)` policy as a "quick fix" would restore permissive. Both are now EXPLICITLY FORBIDDEN as recovery steps.

Even with this clarification, `DROP POLICY` is forbidden as a recovery mechanism because:
- The resulting state is "no policy on an RLS-enabled table" which Postgres treats as deny.
- Deny-everywhere locks out legitimate traffic and is operationally indistinguishable from a broken middleware deployment.
- Recovery must be deliberate forward progress, not a schema regression.

#### 4.7.4 · Known restrictive pre-245 state

Rather than relying on `USING(true)` as the fallback, before Migration 245 is scheduled, a prior migration (candidate working name `244c_nex_business_pre_strict`) runs:

```sql
-- PROPOSAL · not an apply · DRAFT only · subject to owner approval
-- Replace the existing USING(true) permissive policy with a defined
-- restrictive pre-state that both deployments can satisfy.
ALTER TABLE public.nex_business ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_business FORCE  ROW LEVEL SECURITY;

-- Drop whatever permissive policy exists (operator confirms by name)
-- then install the pre-state:
CREATE POLICY nex_business_pre_strict_select ON public.nex_business
  FOR SELECT TO authenticated
  USING (
    current_setting('nex.app_country', true) IS NOT NULL
    AND country IS NOT DISTINCT FROM current_setting('nex.app_country', true)
  );
```

**Explicit owner-safeguard**: owner RV-A3 says the strict-deny swap is NOT assumed safe. The pre-state above is a strict COUNTRY-match. It would lock out any viewer whose country does not match their deployment's `nex.app_country`. Specifically:
- Cross-country WORLDWIDE discovery (Section 5.2) STOPS WORKING during the pre-state window.
- Blocked-list reads via `nex_friend_edge` continue to work (friend edge is G, not CO).
- Chat Themes continue (G).
- Music + video (GV, not CO) continue.

**Compatibility proof required**: before this pre-state is applied to production, a dedicated shadow test (new stage I-9a) proves:
- Both Ireland and Indonesia deployments can continue to serve ALL non-cross-country journeys (sign-in, profile, own business, own products, chat).
- Only cross-country WORLDWIDE discovery is temporarily denied — accepted as a known gap during the pre-state window.
- The gap closes when Migration 245 lands and adds the visibility-OR-country branch.

**This is still the "strict-deny swap" the owner flagged as not-assumed-safe.** The compatibility proof is the acceptance criterion. If it fails, the pre-state is NOT applied and a different design is proposed.

#### 4.7.5 · Forward-fix recovery migrations

Each `245x` recovery migration follows the shape:

```sql
-- 245b_nex_rls_forward_fix_<reason>.sql (template)
-- Replaces specific broken policies with corrected ones. No DROP TABLE.
-- No DISABLE RLS. No USING(true).
BEGIN;
-- Apply guard, same as every other DRAFT
DO $$ BEGIN RAISE EXCEPTION 'Migration 245b is DRAFT · requires explicit owner authorisation naming this file.'; END $$;

-- Example (hypothetical fix):
DROP POLICY IF EXISTS nex_business_select_all_gates ON public.nex_business;
CREATE POLICY nex_business_select_all_gates ON public.nex_business
  FOR SELECT TO authenticated
  USING ( /* corrected policy body */ );

INSERT INTO public.nex_migration_history (version, description, applied_at)
VALUES ('245b-<timestamp>', 'Forward-fix: <reason>', now())
ON CONFLICT (version) DO NOTHING;
COMMIT;
```

Multiple `245c`, `245d`, ... can be issued over time. Each is a separate owner authorisation.

**No `245b` is drafted now.** The template is a shape, not a shipped artefact.

#### 4.7.6 · Tested recovery evidence requirements

Before Migration 245 is approved for production (G-245-APPLY), the shadow test (G-245-SHADOW) must additionally produce:

| Evidence item | What is proven |
|---|---|
| 7-gate test matrix green on shadow | Baseline correctness |
| Fail-closed matrix (T-POOL-2, T-POOL-7) green on shadow | No bypass on missing GUC |
| **Pre-state compatibility report** (new) | Both deployments serve their non-cross-country journeys under the §4.7.4 pre-state |
| **Forward-fix dry run** (new) | A hypothetical 245b is drafted, applied to shadow, shadow re-passes the 7-gate matrix |
| **PITR last-resort test** (new) | A PITR restoration to pre-245 on a scratch Supabase branch completes successfully, with data integrity verification |
| **No-wider-access assertion** (new) | For each proposed 245b forward-fix, a differential policy check (shadow sees NO MORE rows than production baseline) |

Only when all six evidence items are green is G-245-APPLY unblockable.

#### 4.7.7 · What this proposal does NOT claim

- It does not claim strict-deny is proven safe.
- It does not claim the §4.7.4 pre-state is approved.
- It does not claim PITR has been verified on the current Supabase tier.
- It does not promise 245b can always fix a broken policy; it may be that a specific drift is unfixable by forward-fix alone and PITR is the only option.
- It does not change the status of G-245-APPLY, which remains BLOCKED.

---

## 5 · Country data ownership and isolation

### 5.1 · Writes · strict country-match

Owner CI-9: country is immutable through UPDATE. Enforced by RLS + a trigger that raises on any attempt to UPDATE the `country` column from a non-service-role connection.

- INSERT: `country = current_setting('nex.app_country')` AND `current_setting('nex.app_country') IS NOT NULL`.
- UPDATE: USING + WITH CHECK both require country match; a trigger blocks `country` column mutation.
- DELETE: author-only + same-country.
- HQ (service role) bypasses RLS by design; application layer `requireHqAdmin` is the gate.

### 5.2 · Reads · country-match OR visibility-permits, both branches run the 7 gates

Repeated here from the round-2 report so this plan is self-contained:

```
USING (
  (country = current_setting('nex.app_country') AND G1..G5)
  OR
  (visibility != 'COUNTRY' AND G1..G5 AND G6..G7)
  OR
  (author_account_id = auth.uid())
)
```

### 5.3 · Data classification (reference to the 99-table review)

- 56 tables GLOBAL (identity, peer chat, vault, chat themes, operational)
- 4 tables COUNTRY-OWNED direct column (nex_business, nex_community_zone, nex_live_session, nex_report)
- 32 tables COUNTRY-OWNED inherited via FK join
- 2 tables REFERENCE
- 2 tables GLOBAL-WITH-VISIBILITY (music, uploaded video)
- 5 tables MIXED resolved (profession R · vertical R · banner CO-I · report CO · chat themes G)
- 8 tables receive `content_visibility`; 91 explicitly do not

### 5.4 · User identity under two apps

A user is one global account (`nex_account.id` UUID). `primary_country` (Migration 246) is informational, set at signup from the deployment they created the account in. Not a security gate.

- Sari Dewi signs up on NEX Indonesia → `primary_country='ID'`.
- Visits NEX Ireland in a browser → authenticates against the same Supabase, sees Ireland chrome, writes only to `country='IE'` rows while on that deployment.
- Her Indonesia-owned business is CO Indonesia · she can read it on Ireland only if its `visibility != 'COUNTRY'` AND G1-G5.
- Her Indonesia-owned products are CO-I Indonesia · same.

This is the deliberate design: identity is portable, data ownership is country-stamped at write time.

---

## 6 · Ireland-first implementation stages (Rev A · RV-A5 Option C applied)

Each stage is a separate owner authorisation. Nothing starts without the gate before it.

**Rev A reordering summary**: Stages I-9, I-10, I-11 (shadow + apply Migration 245 + apply Migration 248 storage) are MOVED from the Ireland phase to a new §7A joint-cutover phase. Stage I-13 (original Ireland production domain live) is REMOVED from §6 and moved into §7A as Stage JC-5. The Ireland-first phase (§6) now ends at Stage I-12 (Ireland preview + acceptance). **Ireland does NOT go into production during §6.** Ireland production launch happens only in §7A JC-5, after both deployments are on the new resolver + middleware and after Migration 245 has applied with its forward-fix recovery architecture.

### Stage I-1 · Deployment identity resolver (code · no deploy)

Author `resolve-app-identity.ts` + middleware wrapper. Add tests. Local only.

- **Deliverables**: resolver module + middleware integration + 10 unit tests (valid IE, valid ID, valid HQ, invalid value, empty value, mismatched identity+country, HQ page from non-HQ identity denied, etc.).
- **Done when**: tests pass · typecheck clean · local branch ready for owner review.
- **Owner gate**: review the resolver before any Vercel project is created.

### Stage I-2 · Vercel project `nex-ireland` created (infra only · empty DB)

- Owner creates the Vercel project (or authorises Claude via Vercel CLI with specific scope).
- Project set to:
  - Repository: `Philip2024394/nexapp`
  - Production branch: `main`
  - Framework preset: Next.js
  - `NEX_APP_IDENTITY=ireland`
  - `NEX_APP_COUNTRY=IE`
  - Shared Supabase connection env vars (verified identical to Indonesia's future values from a sealed env-vault)
- No deployment yet. Project exists but Production Branch has not deployed because `main` has nothing Ireland-specific yet.
- **Owner gate**: inspect project settings before the first preview deployment.

### Stage I-3 · First preview deployment of Ireland (no production domain)

Preview URL only. Empty database state. No real users, no real data. Verifies the resolver works end-to-end at a Vercel URL.

- **Verification**: hit Ireland preview URL, confirm `NEX_APP_IDENTITY` resolves to `ireland`, confirm palette is Ireland, confirm an attempt to read anything from DB fails-closed (no RLS yet, so `nex_business` returns rows but with `country='ID'` only — this is the current pre-isolation shape).
- **Owner gate**: approve preview before any further migration work.

### Stage I-4 · Migration 244 applied (country column on 4 anchors)

- Shadow-tested in a Supabase branch first (not in production).
- Applied to the sealed Supabase. Zero behaviour change on apply (column is NULL).
- Verification queries from the migration file run post-apply.
- **Owner gate**: approve apply.

### Stage I-5 · Migration 246 applied (country backfill + account enrichment)

- Pre-flight audit confirms zero non-ID country rows exist.
- Backfill `country='ID'` across 4 anchors.
- `nex_account.primary_country='ID'` for all existing accounts.
- Post-apply verification: zero NULL country rows.
- **Owner gate**: approve apply.

### Stage I-6 · Migration 247 applied (visibility + enum + product triple)

- Default values apply: everything stays `COUNTRY` or `PRIVATE`.
- No cross-country exposure change at this stage.
- **Owner gate**: approve apply.

### Stage I-7 · Migration 249 applied (moderation_status)

- Default `ok`.
- **Owner gate**: approve apply.

### Stage I-8 · Migration 251 applied (age_rating + DOB + verified_at)

- Default `general`, DOB NULL, verified NULL.
- **Owner gate**: approve apply.

### Stage I-9 · (MOVED to §7A · joint cutover) Shadow-deploy test for Migration 245

**Rev A**: Shadow of Migration 245 is now performed in the §7A joint-cutover phase, not during Ireland-first. See §7A for the moved stages.

### Stage I-10 · (MOVED to §7A · joint cutover) Migration 245 applied to production

**Rev A**: Delayed per RV-A5 Option C. See §7A.

### Stage I-11 · (MOVED to §7A · joint cutover) Migration 248 applied (storage prefix policy)

**Rev A**: Delayed to the joint-cutover phase. Ireland can launch without storage path-prefixing because its empty dataset means no asset collisions; strict storage RLS lands only after both countries are country-aware. See §7A.

### Stage I-12 · Ireland preview + acceptance test (end of Ireland-only phase)

**Rev A note**: §6 ends here. There is NO Stage I-13 under the delayed-245 regime. Ireland production goes live only in §7A (joint cutover) after Indonesia moves to the new code and the pre-state → 245 sequence completes.

- Ireland Vercel preview deployment is used. Preview DB target decided by U-4 (see §10.3).
- Current production DB still has `nex_business` under `USING(true)` (unchanged · the pre-state is NOT installed yet because installing it would break Indonesia old deployment).
- Seeded Ireland test data (3-5 synthetic rows with `country='IE'`) in the preview environment.
- Confirm:
  - Ireland chrome, palette, locale correct.
  - Ireland deployment's requests all set `SET LOCAL nex.app_country='IE'` (verified by the SET LOCAL test matrix §4.5 T-POOL-*).
  - Ireland reads existing Indonesia rows via USING(true) (expected · this is the current permissive state that §7A will replace).
  - Country-stamp of INSERTs is correct (`country='IE'` on new rows).
  - Preview DB isolation G-PREVIEW-ISOLATION gate test green.
- Playwright acceptance test (comparable to the HQ test).
- **Owner gate**: approve the preview as proof the resolver + middleware work. **This gate does NOT authorise an Ireland production domain.** Production Ireland happens only in §7A JC-5.

### Stage I-13 · REMOVED

**Rev A note**: the original Stage I-13 (Ireland production domain live) is removed from §6 and moved into §7A as Stage JC-5 (Ireland production domain live during the joint cutover). This resolves the architectural contradiction surfaced in the review: under RV-A5 Option C, Ireland cannot launch into production while the old Indonesia deployment lacks the SET LOCAL middleware, because any tightening of RLS before Indonesia cuts over would break Indonesia.

---

## 7 · Indonesia preparation + continuity proof stages (Rev A)

Only begins after I-12 is accepted (Ireland preview + acceptance). The old Indonesia production deployment keeps running the pre-two-apps codebase throughout this phase — unchanged, un-hot-patched, undisturbed, per RV-A5.

### Stage ID-1 · Vercel project `nex-indonesia` created

- Mirror Ireland's project settings except:
  - `NEX_APP_IDENTITY=indonesia`
  - `NEX_APP_COUNTRY=ID`
- Not yet deployed.
- Env-var audit script confirms shared env vars identical to Ireland's.

### Stage ID-2 · Indonesia preview deployment

- Hits same production Supabase.
- Verifies Indonesia-specific chrome, Rp pricing, Indonesia terms copy, Garuda palette.
- Verifies RLS policies deny attempts to insert into `country='IE'` rows from Indonesia deployment.

### Stage ID-3 · Session migration plan

The existing Indonesia userbase lives on the current (pre-two-apps) deployment. Cutover must preserve:
- Logged-in sessions (cookie compatibility across the current and new domains).
- WebAuthn credentials (bound to the eTLD+1 of the current domain).
- Business data (unchanged · remains `country='ID'`).
- Chat Themes ownership (G · unchanged).
- Music library (G · unchanged).

If the current Indonesia domain is `nex.id`, the new one is also `nex.id` → session + WebAuthn continuity preserved by DNS cutover alone.
If the current Indonesia domain is a different hostname (e.g. `nexapp.vercel.app` today), WebAuthn credentials bound to that origin cannot be used on `nex.id`. Options:
- (a) Keep the old domain live under the Indonesia Vercel project (just swap the backing deployment).
- (b) Issue a one-time credential re-enrolment prompt at the new domain (less friction than full re-signup).
- Owner picks before ID-3 is scheduled.

### Stage ID-4 · Indonesia continuity proof (NEW · RV-A5 requirement)

Owner's RV-A5 directive requires that *"before any production cutover, prove that existing Indonesian users, accounts, sessions, WebAuthn credentials, businesses, content and storage remain accessible."* This stage is the proof.

**Shadow environment**: Supabase branch created from the current production snapshot. The new `nex-indonesia` Vercel project is pointed at this shadow DB.

**Required proof matrix** (every row must be green before ID-4 is accepted):

| # | Scenario | Pass criterion |
|---|---|---|
| CP-1 | Existing Indonesia user (Sari Dewi, Dewi Anggraini, etc.) attempts sign-in on `nex-indonesia` preview | Supabase auth session issued identical to current experience |
| CP-2 | Same user's WebAuthn credential (bound to current Indonesia production eTLD+1) | Session + WebAuthn continuity decision from U-3 (see §9.1) honoured; credential verifies OR a re-enrolment path is proven |
| CP-3 | User opens their business page | Business row visible, image loaded, products enumerated |
| CP-4 | User opens peer chat with existing contact | Messages render, send/receive works |
| CP-5 | User opens Chat Themes carousel | All owned themes list correctly; purchase state unchanged |
| CP-6 | User plays music from library | Audio streams; durations correct |
| CP-7 | User opens Community Notice feed | Notices from their zone render |
| CP-8 | User checks notification prefs | Settings reflect their current state |
| CP-9 | User's existing uploaded assets (business images, logos, QR codes) | URLs resolve via current storage paths (pre-prefix) |
| CP-10 | Guest-chat flow for a prospective buyer | First-message orchestrator still works |
| CP-11 | Guardian-managed child-profile access (if any) | Child profile behaviour unchanged |
| CP-12 | Payment-related state (if applicable) | Membership status, trial countdowns, and sealed vault behaviour unchanged |

Any FAIL blocks ID-5. Report produced for owner review. 100% pass is required.

### Stage ID-5 · DNS cutover for Indonesia

- Announced change window.
- DNS flips from current deployment to the new `nex-indonesia` Vercel project (now in production).
- Zero data migration · same Supabase, same records.
- Rollback: DNS flip back (and the old deployment URL stays live for 30 days).
- **Owner gate**: present during cutover.

### Stage ID-6 · Indonesia post-cutover acceptance

- Smoke-test key journeys for Indonesia users (sign in, open chat, visit profile, open shop, go live viewer).
- Confirm Chat Themes, music library, Community Notice feed, business pages all render.
- Confirm payment flows (if any) still work with Indonesia-specific payment adapter.
- Confirm `nex.app_country='ID'` is being set on every DB-backed request from the new deployment (SET LOCAL test matrix §4.5 T-POOL-* re-run on production).

### Stage ID-7 · Monitor + decommission old deployment

- 30-day observation window.
- The old (pre-two-apps) deployment stays available on a legacy URL for recovery.
- After 30 days: owner approves decommission.

---

## 7A · Joint cutover · pre-state → Migration 245 → storage → Ireland production live (NEW · RV-A5 + RV-A3)

This phase executes only after both Ireland (through I-12) AND Indonesia (through ID-6) are stable. At this point BOTH deployments are setting `SET LOCAL nex.app_country` on every DB-backed request. The old Indonesia deployment is still available for emergency DNS rollback (ID-7's 30-day window).

### Stage JC-1 · Pre-state installation (SUBJECT TO OWNER APPROVAL per RV-A3)

**Status**: PROPOSAL only. The pre-state (strict COUNTRY-match SELECT · §4.7.4) is not applied without owner authorisation of §4.7.4's compatibility assertions.

**Preconditions before this stage can even be scheduled**:
- Both deployments on new code, verified setting GUC (§4.5 T-POOL-* green on production for both).
- Indonesia continuity proof green (CP-1..CP-12 all pass).
- Compatibility proof green: pre-state applied to a Supabase branch, both deployments served, non-cross-country journeys all pass.
- A 245b forward-fix template is drafted (not applied) as a demonstrated recovery route.

**Actions** (owner-authorised):
- Replace `USING(true)` on `nex_business`, `nex_community_zone`, `nex_live_session`, `nex_report` with the strict country-match pre-state (§4.7.4).
- Zero functional change for same-country reads (both deployments satisfy the country match).
- Known temporary gap: cross-country WORLDWIDE discovery is temporarily unavailable; closed in JC-3 by Migration 245.
- **Owner gate**: present during apply.

### Stage JC-2 · Migration 245 shadow test (with full RV-A3 evidence)

Same as prior §11.2 protocol but WITH:
- Fail-closed assertions inline (§4.7.6 evidence item 2).
- Pre-state compatibility report (§4.7.6 evidence item 3).
- Forward-fix dry run (§4.7.6 evidence item 4).
- PITR last-resort test (§4.7.6 evidence item 5).
- No-wider-access assertion (§4.7.6 evidence item 6).

100% pass across all six evidence items is required.

### Stage JC-3 · Migration 245 production apply

- Announced maintenance window.
- Full PITR snapshot before apply.
- Apply.
- Immediate post-apply: smoke test suite + continuity proof (CP-1..CP-12) re-run on production.
- **Recovery procedure** (RV-A3 compliant): if any smoke test fails, forward-fix 245b is drafted + applied; if 245b cannot be authored within the operational window, PITR is the last resort. **No `DROP POLICY` to restore permissive. No DISABLE RLS.**
- **Owner gate**: present during apply.

### Stage JC-4 · Migration 248 storage prefix + path rename + old-URL policy

- External path-rename script runs for existing objects.
- Verification: 0 objects at root prefix.
- Storage policy installed.
- Old signed-URL policy (new · §10.3b): existing signed URLs that reference the old path return 404 after rename · dual-serve window N days (owner to set via U-10, new open decision) · after N days, old URLs are irretrievable.
- CDN invalidation.
- Cross-country denial acceptance tests inline (new): from the Ireland production deployment, download attempt against `ID/<businessId>/x.png` → 404 unless business is WORLDWIDE; from Indonesia production deployment, download attempt against `IE/<businessId>/x.png` → 404 unless business is WORLDWIDE.
- **Owner gate**: present during apply.

### Stage JC-5 · Ireland production domain live (moved from original I-13)

- DNS points to Vercel.
- `nex.ie/sign-up` live for Ireland users under the full 7-gate RLS stack.
- Indonesia already on new deployment (ID-5), serving Indonesia users without interruption.
- **Owner gate**: pre-launch final approval.

### Stage JC-6 · Joint cutover acceptance

- Full programme acceptance against both deployments live, both setting GUC, full RLS, full storage prefix.
- Playwright acceptance suite covering: Ireland user discovers Ireland COUNTRY content · Ireland user does NOT see Indonesia COUNTRY content · Ireland user DOES see Indonesia WORLDWIDE content · Indonesia user mirrors (own country + Ireland WORLDWIDE) · blocked pairs invisible to each other across countries · HQ moderation panel sees both countries' pending items via the privileged-moderation path (not raw service_role) · audit log contains one row per HQ moderation action.
- 100% pass is required.
- **Owner gate**: joint acceptance.

### Stage JC-7 · 30-day monitoring window

- Both deployments in production, full RLS, full storage prefix.
- Weekly SET LOCAL leakage test on production (sampled).
- Daily audit log review (HQ moderation actions).
- No new country-isolation migration during the window.
- End of window: owner-authorised decommission of the old Indonesia URL (if ID-7's 30-day clock has elapsed).

---

## 8 · HQ responsibilities and permissions (Rev A · RV-A8 redesign)

**Rev A principle**: HQ ordinary administration and HQ privileged cross-country moderation are TWO SEPARATE capabilities. Owner's RV-A8 verbatim: *"Controlled global moderation is permitted in principle. Unrestricted global data access by ordinary HQ users is not."*

### 8.1 · HQ Vercel project

- `NEX_APP_IDENTITY=hq`
- `NEX_APP_COUNTRY=` *(unset)*
- No public domain. HQ is accessed only via an owner-known URL (and could optionally be on an internal-only subdomain gated by IP allowlist in production).

### 8.2 · HQ page gate · defence-in-depth

Three layers, every HQ page passes all three:
1. `requireHqAdmin(session.account.id)` throws if the account doesn't have `hq_role='admin'`.
2. The deployment's `NEX_APP_IDENTITY === 'hq'` is checked in a top-level HQ layout guard; if false, `notFound()`.
3. Supabase RLS applies to ordinary HQ operations (see §8.5) · privileged moderation uses a scoped elevated path (see §8.6).

### 8.3 · What HQ CAN do (ordinary admin · country-aware)

Ordinary HQ admin operates under the same country-aware RLS as any country deployment, but with a wider read scope limited to:
- Platform-operational tables (`nex_surface_health_event`, `nex_migration_history`, `nex_collection_fetch_errors`, etc.).
- Reference tables (`nex_profession`, `nex_vertical`, `nex_color_palette`).
- Aggregated / counted views that do not expose individual user records.
- Owner's own content (as any user).
- The Worlds catalogue + preview (owner-only, 1h TTL).

**Ordinary HQ admin DOES NOT get a service-role-shaped blanket read across country-owned tables.** If an operator wants to view a specific business, they invoke a privileged action (§8.6).

### 8.4 · What HQ CANNOT do

Cannot:
- Change the global identity (there is no global identity · each app resolves its own at runtime).
- Push an "activate this country for all users" button — such a button does not exist and must not be added.
- Change the `country` column on an existing row (RLS + trigger block it even for service role; a separate owner-authorised migration would be needed for a legitimate country reassignment).
- Browse Indonesia's or Ireland's full user list from the ordinary admin surface.
- Execute `SELECT *` on country-owned content tables from the browser or from ordinary admin pages.

### 8.5 · Ordinary HQ administration (country-aware)

Ordinary HQ pages (dashboards, operational monitoring, system health, harvest status, ladder enablement, platform metrics):
- Server-rendered.
- Use the **same** Supabase client that country deployments use (`authenticated` role via Supabase SSR auth helper), NOT the service role.
- RLS applies.
- Operator sees only data they are authorised to see under the normal rules (their own account's content, platform-operational data, aggregates).
- Service-role credentials are NEVER sent to or exposed in the browser.

### 8.6 · HQ privileged moderation path (NEW · RV-A8 compliant)

Privileged cross-country moderation is a NARROW, AUDITED, SERVER-SIDE-ONLY capability. It is not a UI toggle that "shows everything to HQ." It is a specific action against a specific resource with a specific reason.

**Shape**:

1. UI: an HQ moderator loads a page like `/nex-native/hq/moderation/report/<report_id>`. The page shows:
   - The report's metadata (country, status, subject-table, subject-id).
   - A **"View subject with reason"** button, disabled until a reason is typed.
   - A free-text reason field (minimum N characters, N TBD; recommended 20 characters).

2. Click: the browser sends `{ reportId, reason }` to a server action `moderationViewReportSubjectAction`.

3. Server action:
   - `requireHqAdmin(session.account.id)` throws if not admin.
   - Validates `reason` length.
   - Opens a transaction.
   - INSERTs an audit row into `nex_hq_moderation_audit` with `(actor_account_id, action='view_report_subject', report_id, subject_table, subject_id, country, reason, request_id, timestamp)`.
   - ONLY NOW: uses the service-role Supabase client (held exclusively server-side) to perform a SINGLE SELECT narrowed to the specific subject row.
   - Returns the subject row to the React component for display.
   - Commits.

4. Browser: renders the subject row. The service-role credential never leaves the server.

5. If `requireHqAdmin` throws, if the reason is too short, or if the audit INSERT fails, the service-role call does not happen.

**Scope rules**:
- Every privileged action is a dedicated server action (`moderationViewReportSubjectAction`, `moderationFlipReportStatusAction`, `moderationMarkContentTakenDownAction`, `moderationUnmarkContentAction`, …). No generic `hqServiceRoleReadAction(table, id)` endpoint.
- Each action operates on EXACTLY ONE resource (one row, one subject).
- Each action records exactly one audit row.
- Country is tagged on every audit row.
- Reason is required on every audit row.

**Separation from ordinary admin**:
- Ordinary admin pages (e.g. `/nex-native/hq/harvest`) use the user-identity Supabase client. If RLS denies, the page shows denied.
- Privileged moderation pages are under `/nex-native/hq/moderation/*`. They explicitly use a different server-action path.
- No ordinary admin page silently escalates to service-role.

### 8.7 · `nex_hq_moderation_audit` schema (plan only · migration NOT drafted)

```
-- PROPOSAL · not an apply · requires separate owner-authorised migration
-- after the 7-migration programme.
CREATE TABLE public.nex_hq_moderation_audit (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_account_id uuid       NOT NULL REFERENCES public.nex_account(id),
  action          text        NOT NULL,  -- enum TBD
  subject_table   text        NOT NULL,
  subject_id      uuid        NOT NULL,
  country         text        NULL,       -- subject's country if known
  report_id       uuid        NULL,
  reason          text        NOT NULL CHECK (char_length(reason) >= 20),
  request_id      uuid        NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nex_hq_moderation_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_hq_moderation_audit FORCE  ROW LEVEL SECURITY;
-- No authenticated policies. Reads via scoped RPC from HQ UI only.
```

Status: PROPOSAL. Timing of the backing migration is U-7 (unchanged, now explicitly BLOCKING on any privileged moderation shipping to production).

### 8.8 · Service-role credential hygiene

- The service-role key is a Vercel env var on the HQ project only.
- The country Vercel projects (`nex-ireland`, `nex-indonesia`) DO NOT hold the service-role key in their production env. (They hold `anon` + whatever the Supabase SSR auth helper needs.)
- The service-role key is never read into browser JavaScript. Server actions use it; pages render results.
- Rotation of the service-role key is HQ-only (one project, not three).

---

## 9 · DNS, domains and environment secrets

### 9.1 · Domain plan

| Deployment | Suggested domain | Decision point |
|---|---|---|
| NEX Ireland | `nex.ie` (owner to confirm availability) OR a subdomain of a shared root | Owner picks before JC-5 (Rev A · was I-13) |
| NEX Indonesia | Current Indonesia production domain (preserved for session + WebAuthn continuity) | Owner confirms current domain before ID-3 |
| NEX HQ | `hq.nex.app` or similar owner-internal domain, IP-allowlisted | Owner picks before HQ production |

### 9.2 · TLS

Vercel manages certificates. Each project has its own cert. No cross-project cert sharing.

### 9.3 · Secrets inventory

Captured here as a plan (not touched):

| Secret | Where | Rotation cadence | Owner |
|---|---|---|---|
| `NEX_SUPABASE_SERVICE_ROLE_KEY` | All 3 Vercel projects (identical) | 180 days | Owner |
| `NEX_WORLD_PREVIEW_SIGNING_KEY` | All 3 Vercel projects (identical) | 365 days | Owner |
| Country-specific payment credentials | Country project only | Vendor-driven | Owner |
| Supabase direct Postgres URL (if used for migrations) | HQ or operator machine only, NEVER production projects | On breach | Owner |
| DNS registrar credentials | Owner only | 365 days | Owner |

Secrets rotation is a 3-project operation for shared keys. The audit script in §10 catches drift.

### 9.4 · Legal copy per country

Each country ships its own Privacy, ToS, Data Processing Agreement. Implementation:
- Shared React components; country-specific copy strings loaded from a `legal/{countryCode}.ts` module via the resolver.
- A legal review per country is a separate owner-engaged process; NOT in programme scope.

---

## 10 · CI/CD and deployment protection

### 10.1 · CI (GitHub Actions / Vercel integration)

- Lint + typecheck + test on every PR (shared).
- No country-specific CI job needed because the artefact is identical.
- Env-var audit script runs weekly on a schedule, reads each Vercel project's env, diffs the "identical" category, raises an issue if any drift found.

### 10.2 · Preview deployment protection

- Vercel preview URLs are password-protected per project (feature exists in Vercel Pro and above).
- No preview URL is shared publicly without owner confirmation.
- Previews use the SAME shared Supabase. Caveat: a preview from Ireland PR gets `country='IE'` writes committed to the real Supabase. Mitigation: previews write to a per-PR country prefix OR previews use a sandbox Supabase (preferred). Owner picks before promoting any PR workflow (§14 open decision).

### 10.3 · Production promotion

- `main` is protected: direct push disabled, PR + review required (current CLAUDE.md rules already enforce the push-authorisation discipline).
- Each Vercel project's Production Branch is `main`. Promotion to production per project is a Vercel UI action.
- The three projects' promotion are independent: Ireland can be on commit X, Indonesia on commit Y, HQ on commit Z. A given PR can be live on HQ but not yet on Ireland or Indonesia.

### 10.3 · Preview DB isolation · G-PREVIEW-ISOLATION (NEW · RV-A1 + RV-A9)

**Owner directive (correction #1)**: *"G-PREVIEW-ISOLATION with measurable acceptance tests."*

**Hard rule**: No preview deployment of any country project is permitted to boot against the production Supabase project `ijvqdvsvwtwxzcqmoqit`.

**Mechanism** (owner-chosen between the following; the specific choice is U-4):
- (a) A dedicated sandbox Supabase project (`nex-sandbox-*`) with all 7-migration programme SQL applied + synthetic seed data. Preview deployments use its URL.
- (b) A `SKIP_PRODUCTION_SUPABASE` build assertion: at boot the server checks `NEXT_PUBLIC_NEX_SUPABASE_URL`. If it contains `ijvqdvsvwtwxzcqmoqit` AND `VERCEL_ENV === 'preview'`, boot fails with a thrown error.

Both (a) and (b) can coexist; (a) is the primary isolation, (b) is the belt-and-braces assertion.

**Measurable acceptance test (ran on every preview deployment start)**:

```
Given VERCEL_ENV === 'preview'
When the application boots
Then the resolved Supabase project ID MUST NOT equal 'ijvqdvsvwtwxzcqmoqit'
And an attempt to boot with the production project ID throws a documented error
And the preview deployment is observable in logs with the sandbox project ID
```

Positive test: deploy a PR preview with the sandbox URL → boots, serves pages, writes to sandbox only.
Negative test: deploy a PR preview with the production URL (misconfiguration) → boot fails, no HTTP server listens, no write reaches production.

Weekly audit: scan Vercel API for any preview project whose Supabase URL matches production. Any match raises an alert.

### 10.3b · Signed URL policy (NEW · RV-A4 correction #5)

Owner directive: *"Explicit old signed-URL handling and revocation/expiry policy."*

**Rule**: signed URLs minted BEFORE Migration 248 reference pre-rename paths. After rename, those paths no longer exist at the old location. Possible policies:

| Policy | Property | Owner decision needed? |
|---|---|---|
| **Strict**: old signed URLs 404 immediately after rename · users must re-request via a fresh signed URL | Fastest, simplest, but users see broken images while short-lived URLs expire | Yes — see new U-10 |
| **Dual-serve window**: for N days after Migration 248, both old and new paths serve the same bytes · old paths soft-404 after N days | Transition grace, but requires per-object dual-location bookkeeping during the window | Yes — see new U-10 |
| **Full revocation**: Supabase storage API bulk-revokes all pre-cutover signed URL tokens | Simplest post-cutover state, but all browsers holding cached signed URLs break immediately | Yes — see new U-10 |

**U-10 (new open decision)**: pick a policy between Strict / Dual-serve / Full revocation. Recommended: Dual-serve window of 7 days to cover common CDN cache lifetimes + user session duration, then full revocation.

### 10.4 · Deployment protection

- Each project has a "Deployment Protection" rule disabling automatic promotion to production unless manual approval.
- Owner-authorisation step before every production deploy (matches the push-authorisation discipline).

---

## 11 · Rollback and disaster recovery (Rev A · RV-A3 forward-fix architecture)

### 11.1 · Per-stage rollback summary

| Stage | Rollback / recovery | Notes |
|---|---|---|
| I-1..I-3 (resolver + Vercel + preview) | Delete Vercel project or revert the resolver commit | Fully reversible |
| I-4 (Migration 244) | Guarded rollback with role + GUC + data guards (file on disk) | Reversible if 246 not applied |
| I-5 (Migration 246) | UPDATE country=NULL + DROP primary_country | Reversible |
| I-6-I-8 (Migrations 247/249/251) | DROP COLUMN + DROP TYPE | Lossy if non-default values set between apply and rollback; snapshot pattern available |
| I-12 (Ireland preview acceptance) | Revert the commit · delete preview | Reversible |
| ID-1..ID-3 (Indonesia Vercel + preview) | Delete project or revert | Reversible |
| ID-4 (Indonesia continuity proof) | Delete Supabase shadow branch | Zero production impact |
| ID-5 (Indonesia DNS cutover) | DNS flip back · old deployment URL stays live for 30 days | Reversible |
| ID-6..ID-7 (post-cutover acceptance + monitoring) | Revert + DNS flip | Reversible until decommission |
| JC-1 (pre-state installation) | Forward-fix migration replacing the pre-state with a corrected one · last resort PITR | **No DROP POLICY · no USING(true) restoration · no DISABLE RLS** |
| JC-2 (Migration 245 shadow test) | Delete Supabase branch | Zero production impact |
| **JC-3 (Migration 245 production apply)** | **Forward-fix migration (245b)** replacing specific broken policies · last resort PITR to pre-245 state. **No DROP POLICY. No DISABLE RLS. No permissive restore.** | ⚠️ Forward-only · see §4.7 for the full redesign and §11.4 for the recovery procedure |
| JC-4 (Migration 248 storage) | Forward-fix migration replacing policy · reverse path rename (operationally fraught) · old-URL policy per §10.3b | Partial rollback possible for policies, less so for path rename |
| JC-5 (Ireland production domain live) | DNS flip back · take Vercel domain down | Reversible unless Ireland users have signed up new accounts (those persist as real users on the shared platform) |
| JC-6..JC-7 (acceptance + monitor) | Revert via forward-fix | Country deployments operating independently |

### 11.2 · Migration 245 shadow-test protocol

Owner's directive: *"Migration 245 requires special treatment because its current rollback risk is unacceptable without shadow testing and a verified recovery strategy."*

- Create a Supabase project branch from the latest production snapshot.
- Apply all prerequisite migrations (244, 246, 247, 249, 251) to the branch.
- Apply Migration 245 to the branch.
- Run the full 7-gate test matrix:
  - Positive tests: owner sees own content, Ireland sees Ireland COUNTRY, both see WORLDWIDE, blocked parties see nothing, etc.
  - Negative tests: Ireland sees no Indonesia COUNTRY, no NULL app country allows read, moderation `taken_down` invisible, etc.
  - Edge tests: deep CO-I chains (nex_product_variant → nex_product → nex_business), nex_report has no SELECT policy, nex_live_jail inherits from session.
- Run the connection-pool leakage test.
- Run the per-table policy count assertion.
- Produce a shadow-test report (JSON + Markdown).
- **Owner gate**: a 100%-pass shadow report is a HARD prerequisite to I-10 approval.

### 11.3 · Disaster recovery

- Supabase Point-in-Time Recovery (PITR) is retained on the sealed project (verify tier via U-9).
- Snapshot before any migration apply.
- If a cross-country leak is detected post-launch:
  - Immediate: toggle maintenance mode on the leaking deployment (`vercel pause` on the country project).
  - Investigate RLS policy diffs vs the shadow-tested state.
  - Forward-fix migration 245b (not rollback) if the policy drift is identified.
  - Audit log inspection to determine blast radius.
  - Owner-level communication plan if real data has been exposed.

### 11.4 · Migration 245 operational recovery procedure (NEW · RV-A3 compliant)

Owner's RV-A3 requires: *known restrictive pre-state · forward-fix recovery · tested on production-like DB · fail-closed without locking out Indonesia · no wider access granted · strict-deny swap not assumed safe.*

**When this procedure applies**: incident is observed within the maintenance window of JC-3 (Migration 245 production apply) or in the 30-day monitoring window JC-7.

**Triage within 5 minutes of the incident**:

1. Classify the incident (per §4.7.2):
   - **Policy drift**: RLS evaluates differently than shadow test predicted (e.g. a WORLDWIDE row is denied, a COUNTRY row from another country is visible).
   - **Middleware drift**: a country deployment is not setting `SET LOCAL nex.app_country`.
   - **Data drift**: country values on existing rows are wrong (e.g. a backfill misclassified a row).
   - **Infrastructure drift**: Supabase + PgBouncer configuration changed (connection pool mode, GUC default), the application was blameless.

2. Based on classification, pick the correct recovery path:

| Classification | Recovery path | Not allowed |
|---|---|---|
| Policy drift | Draft `245b_nex_rls_forward_fix_<reason>.sql` → shadow → apply via owner authorisation | DROP POLICY · USING(true) restoration · DISABLE RLS |
| Middleware drift | Revert the deployment that drifted (`vercel rollback`) · do NOT touch the DB | DB changes to compensate for app changes |
| Data drift | Separate owner-authorised data-repair migration · scoped per-row · audit-logged | Blanket UPDATE without owner approval |
| Infrastructure drift | Escalate to Supabase support · maintenance mode on affected country project until resolved | Changing GUC default without owner authorisation |

3. **If the forward-fix cannot be authored within the owner-defined operational window (recommended: 24h)**:
   - Owner-authorised PITR to the pre-245 state. This is the last resort.
   - PITR loses all writes between the 245 apply and the restore target. Audit log + Vercel logs preserved separately for reconstruction.
   - After PITR, Migration 245 is BLOCKED again until a revised design is approved.

4. **Explicitly forbidden recovery steps** (per RV-A3):
   - `DROP POLICY` on a 245-era policy without a replacement policy applied in the same transaction.
   - `ALTER TABLE … DISABLE ROW LEVEL SECURITY`.
   - Creating a replacement policy with `USING(true)`.
   - Executing a maintenance-mode bypass that opens service-role access to the browser.
   - Pushing a hotfix to the deployment that bypasses the `SET LOCAL` wrapper.

5. **Audit requirements**:
   - Every emergency action is recorded in `nex_hq_moderation_audit` with action='emergency_recovery' + reason.
   - PITR execution records a dedicated incident report, owner-signed.

---

## 12 · Acceptance criteria and owner approval gates

### 12.1 · Gate matrix (Rev A · reordered + expanded · each requires the previous)

| # | Gate | Scope | Owner acceptance signal |
|---:|---|---|---|
| 1 | G-RESOLVER | Resolver code reviewed | Written approval of the module + its tests |
| 2 | **G-PREVIEW-ISOLATION** (NEW · RV-A1 + RV-A9) | Preview DB target decided (U-4) + measurable test passes | Written approval naming U-4 outcome + green test on sandbox |
| 3 | G-IE-PROJECT | Ireland Vercel project configuration | Written approval of env vars + protection rules |
| 4 | G-IE-PREVIEW | First Ireland preview deployment | Written approval after preview smoke test |
| 5 | G-244 | Migration 244 apply | Written approval naming the file |
| 6 | G-246 | Migration 246 apply | Written approval + pre-flight audit result |
| 7 | G-247 | Migration 247 apply | Written approval |
| 8 | G-249 | Migration 249 apply | Written approval |
| 9 | G-251 | Migration 251 apply | Written approval |
| 10 | G-IE-ACCEPTANCE (was G-IE-PROD) | Ireland preview acceptance (end of §6 · NOT production) | Written approval of the preview acceptance report |
| 11 | G-ID-PROJECT | Indonesia Vercel project configuration | Written approval of env + session continuity plan |
| 12 | G-ID-PREVIEW | Indonesia preview deployment | Written approval |
| 13 | **G-ID-CONTINUITY** (NEW · RV-A5) | CP-1..CP-12 continuity proof matrix 100% green on shadow | Written approval of the continuity proof report |
| 14 | G-ID-CUTOVER | Indonesia DNS cutover | Written approval DURING cutover window |
| 15 | G-ID-ACCEPTANCE | Indonesia post-cutover acceptance | Written approval |
| 16 | **G-245-FORWARDFIX** (NEW · RV-A3) | Approval of the recovery architecture itself (§4.7) · PITR verified · 245b template drafted · no permissive restore | Written approval of §4.7 design + U-9 Supabase tier verification |
| 17 | **G-245-PRESTATE** (NEW · RV-A3) | Pre-state installation (strict COUNTRY-match) on production · compatibility proof green | Written approval DURING pre-state apply window |
| 18 | G-245-SHADOW | Shadow test with all 6 evidence items (§4.7.6) green | Written approval of the shadow report |
| 19 | G-245-APPLY | Migration 245 apply to production | Written approval DURING maintenance window |
| 20 | **G-STORAGE-URL-POLICY** (NEW · RV-A4 correction #5) | U-10 answered · signed-URL policy picked | Written approval |
| 21 | G-248-APPLY | Migration 248 apply + storage path rename | Written approval + rename script completion report |
| 22 | **G-IE-PROD-LIVE** (NEW · moved from original G-IE-PROD) | Ireland production domain live under full 7-gate RLS | Written approval of pre-launch checklist |
| 23 | G-JOINT-ACCEPTANCE | Joint cutover acceptance test (JC-6) | Written approval of the Playwright + CP matrix report |
| 24 | **G-HQ-MODERATION-AUDIT** (NEW · RV-A8) | `nex_hq_moderation_audit` migration drafted, applied, UI shipped before any privileged moderation action is callable | Written approval of the audit table + privileged-action pattern |
| 25 | G-30-DAY | 30-day post-cutover observation | Written approval of monitoring report |
| 26 | G-DECOMM | Decommission old Indonesia deployment | Written approval |

**No stage proceeds without its gate.** Nothing is auto-promoted. Nothing is batched. Each gate requires the previous.

**Owner RV-A3 explicit constraint**: Migration 245 is BLOCKED at G-245-FORWARDFIX until the owner approves the §4.7 recovery architecture. The current status at commit time is **BLOCKED**.

**Owner RV-A5 explicit constraint**: no gate from G-245-FORWARDFIX forward is unblockable until both deployments are on new code (completion of G-ID-ACCEPTANCE). Migration 245 does NOT apply while Indonesia old deployment is live.

**Owner RV-A8 explicit constraint**: G-HQ-MODERATION-AUDIT requires the audit table + privileged-action pattern to exist before any privileged moderation action ships to production.

### 12.2 · What "accepted" means

For each gate, acceptance requires:
- Pre-stage artefact exists (plan item, shadow report, migration file, etc.)
- Owner reviewed and signed off in writing
- The next-stage pre-flight audit (if any) passes
- No open regression on prior gates

---

## 13 · Cost and operational trade-offs

### 13.1 · Vercel

- **Three projects on one Pro plan**: no cost multiplier for the plan itself; usage (build minutes, bandwidth, invocations) is counted together.
- **Build minutes**: three deployments per `main` push (one per project). Each is ~2-4 min for Next.js builds; 6-12 min per push total.
- **Bandwidth / invocation**: scales with real usage; two active country domains + HQ is roughly the same volume as one Indonesia-only app today.

### 13.2 · Supabase

- No cost increase from three Vercel projects → shared Supabase.
- Cost scales with database size, egress, and connection count.
- Three projects means ~3x the simultaneous DB connections at peak; Supabase pool size must be verified against current tier.

### 13.3 · DNS + domains

- One new domain for Ireland (if we buy a new one): registrar fee.
- No change for Indonesia if the existing domain is reused.
- HQ on an internal subdomain: zero.

### 13.4 · Operational

- Three projects to monitor, three sets of env vars to keep in sync.
- Env-audit script offsets most of this.
- Weekly connection-pool leakage test adds ~5 min of CI time.

### 13.5 · Developer velocity

- Monolithic codebase means PRs are reviewed once.
- Three deployments means a prod bug can be rolled back on one country without touching the others (if the bug is country-specific).
- Shared code means a shared bug ships to all three on the same `main` promotion.

---

## 14 · Unresolved decisions and risks

### 14.1 · Decisions the owner must make before the next stage starts (Rev A · + U-10)

| # | Decision | Blocking |
|---|---|---|
| U-1 | Ireland domain name (new domain purchase or subdomain of existing) | G-IE-PROD-LIVE |
| U-2 | HQ domain name and IP allowlist policy | G-HQ-MODERATION-AUDIT |
| U-3 | Current Indonesia production domain + WebAuthn continuity strategy | G-ID-PROJECT + G-ID-CONTINUITY |
| **U-4** | **Preview-deployment DB target** · sandbox project (recommended) OR other mechanism | **G-PREVIEW-ISOLATION (now early-blocking per RV-A9)** |
| U-5 | Legal review schedule per country (Privacy, ToS, Data Processing) | G-IE-PROD-LIVE and G-ID-ACCEPTANCE |
| U-6 | Payment adapter strategy per country (Stripe · Midtrans · other) | NOT blocking resolver + RLS, but blocking Ireland's launch readiness |
| U-7 | Audit log table (`nex_hq_moderation_audit`) migration timing | G-HQ-MODERATION-AUDIT (now tightened per RV-A8) |
| U-8 | Preview-environment WebAuthn registration policy | G-IE-PREVIEW |
| U-9 | Supabase tier verification (PITR enabled, connection pool size adequate) | G-245-FORWARDFIX |
| **U-10** (NEW · RV-A4 correction #5) | **Signed-URL policy at Migration 248 time**: Strict / Dual-serve window N days / Full revocation | G-STORAGE-URL-POLICY |

### 14.2 · Risks ranked (Rev A · R-1 revised; R-11..R-14 added)

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | **(revised)** Migration 245 forward-fix recovery fails to resolve a production policy drift within operational window → PITR last-resort required | Medium | Critical | §4.7 forward-fix architecture + §11.4 recovery procedure + U-9 PITR verification before G-245-FORWARDFIX |
| R-2 | Env-var drift between the three Vercel projects causes shared-key skew → auth or signing failures | High | Medium | Weekly audit script (§10.1) |
| R-3 | Connection-pool leaks `nex.app_country` across requests | Medium | Critical | SET LOCAL discipline + middleware wrapper + T-POOL-1..T-POOL-9 CI matrix (§4.5) |
| R-4 | Shared Supabase project means one RLS bug exposes both countries | Low-Medium | Critical | 7-migration programme + §4.3 eight-point discipline + 1-year decision gate for per-country split |
| R-5 | Storage path rename (Migration 248) partially completes, leaves mixed-state objects | Medium | Medium | Idempotent rename script + CDN invalidation plan + fail-closed storage RLS |
| R-6 | Indonesia DNS cutover breaks WebAuthn | Medium | Medium | U-3 decision + CP-2 continuity proof |
| R-7 | Preview deployments write to production Supabase | High | Medium | G-PREVIEW-ISOLATION gate + U-4 decided + boot-time assertion (§10.3) |
| R-8 | Legal copy not country-specific at launch | Medium | High (regulatory) | U-5 decision before G-IE-PROD-LIVE and G-ID-ACCEPTANCE |
| R-9 | A commit meant for HQ only ships to Ireland or Indonesia (shared artefact) | Low | High | HQ-only runtime check (§8.2 layer 2) is the backstop |
| R-10 | Payment adapter not ready for Ireland by launch | High | Medium | U-6 decision; soft-launch option |
| **R-11** (NEW · RV-A5) | Indonesia dark-mode window if the pre-245 state is applied before Indonesia cuts over | Medium | **Critical** | RV-A5 Option C enforced: pre-state only in §7A JC-1 after G-ID-ACCEPTANCE; no hot-patch |
| **R-12** (NEW · RV-A3) | Operator attempts `DROP POLICY` or `DISABLE RLS` under pressure, restoring permissive | Low-Medium | **Critical** | §11.4 explicit forbidden-recovery list + §4.7.3 explicit prohibition + audit required for every emergency action |
| **R-13** (NEW · RV-A8) | Service-role credential leaks to browser via accidental `use client` component with env-var access | Low | Critical | §8.8 credential hygiene + lint rule enforcing server-only usage + no runtime browser access to service role |
| **R-14** (NEW · RV-A4) | Signed URLs minted pre-Migration 248 become orphaned mid-session for in-flight users | High (at Migration 248 moment) | Low-Medium (user-visible broken images; recoverable by refresh) | U-10 decision + dual-serve window (recommended 7 days) + CDN invalidation plan |

---

## 15 · Non-goals (explicitly out of this plan · Rev A additions marked)

- Activating the Worlds-page "Activate" red buttons on anyone's device.
- Shipping two independent country applications before the 7-migration programme is approved.
- Changing Chat Themes.
- Changing the sealed design tokens.
- Changing HQ authentication (`requireHqAdmin`).
- Switching to a per-country Supabase model (deferred decision in §4.4).
- Shipping an admin "re-stamp country" tool (would need its own owner-authored migration + audit).
- **(Rev A)** `DROP POLICY` or `DISABLE ROW LEVEL SECURITY` on any Migration 245-era policy as a recovery mechanism (per §4.7.3, §11.4).
- **(Rev A)** Restoring `USING(true)` on any country-owned table as a recovery mechanism (per RV-A3).
- **(Rev A)** Hot-patching the existing Indonesia production deployment to accelerate Ireland launch (per RV-A5).
- **(Rev A)** Shipping a generic `hqServiceRoleReadAction(table, id)` endpoint. Privileged moderation requires a specific, named action per RV-A8.
- **(Rev A)** Exposing the service-role credential to any browser-side JavaScript.
- **(Rev A)** Preview deployments reaching production Supabase (per G-PREVIEW-ISOLATION).

---

## 16 · Owner acceptance targets for THIS plan (Rev A)

Return approve / modify / defer for each:

| # | Item | Return |
|---|---|---|
| AP-1 | Hosting architecture in §1 (three Vercel projects, no host-based routing) | approve / modify |
| AP-2 | Deployment env strategy in §2 | approve / modify |
| AP-3 | Shared Supabase analysis in §4, including the eight-point discipline + Migration 245 recovery redesign (§4.7) | approve / defer / split |
| AP-4 | **(Rev A)** Ireland-first implementation stages I-1 through I-12 only (no I-13) in §6 | approve / resequence |
| AP-5 | **(Rev A)** Indonesia stages ID-1 through ID-7 + continuity proof matrix CP-1..CP-12 in §7 | approve / modify |
| AP-5b | **(Rev A · NEW)** Joint cutover phase §7A (JC-1..JC-7) | approve / modify |
| AP-6 | **(Rev A · rewritten)** HQ ordinary admin / privileged moderation separation + `nex_hq_moderation_audit` design in §8 | approve / modify |
| AP-7 | DNS + secrets inventory in §9 (U-1, U-2, U-3 still open) | partial approve / request specifics |
| AP-8 | **(Rev A · expanded)** CI/CD + deployment protection in §10 including G-PREVIEW-ISOLATION (U-4 open) and signed-URL policy (U-10 new, open) | approve / specify |
| AP-9 | **(Rev A · redesigned)** Rollback + DR plan in §11 including §11.4 Migration 245 operational recovery procedure | approve / tighten |
| AP-10 | **(Rev A · expanded to 26)** Gate matrix in §12 as the authoritative owner-authorisation flow | approve / modify |
| AP-11 | Cost + ops in §13 | ack |
| AP-12 | **(Rev A · R-11..R-14 added)** Risk register in §14 | ack / add risks |
| AP-13 | **(Rev A · additions marked)** Non-goals in §15 | ack / add non-goals |

**Nothing starts until the owner signs off on the specific stage.** No code is written, no migration is applied, no Vercel project is created, no DNS is changed, no deployment goes live, no push happens, as a result of this plan existing.

**Rev A status summary**:
- Migration 245 remains **BLOCKED** at G-245-FORWARDFIX pending owner approval of §4.7.
- G-RESOLVER is unblockable in principle (resolver code review) but requires U-4 answered first (because the resolver depends on preview isolation).
- All seven RV-A corrections are now reflected in the plan.
- Three owner decisions (RV-A3, RV-A5, RV-A8) are incorporated as hard rules.
- Six RV items (RV-A1, RV-A2, RV-A4, RV-A6, RV-A7, RV-A9) are approved via the corrections list.
- One decision remains open (U-10, new).

---

*Rev A 2026-10-31 · architecture + rollout plan · doctrine only · awaiting AP-1..AP-13 + RV-A3 recovery architecture approval + U-4 + U-10. Previous Rev 0 preserved in commit `7c2c7cb` git history. See `nex-country-plan-decision-reconciliation-2026-10-31.md` for the RV-A ledger.*
