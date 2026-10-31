# NEX · Country Application Programme · Architecture + Rollout Plan · 2026-10-31

**Status**: plan only · no code · no migrations · no SQL · no Vercel project creation or linking · no deployment · no activation · no push.
**Owner's confirmed decisions this round**:
- D-10 **Hosting shape · A** · three separate Vercel projects sharing one repository (NEX Ireland · NEX Indonesia · NEX HQ).
- D-11 **Rollout order · A** · Ireland first on isolated empty country data, Indonesia second.
- D-12 **No shared global activation** · each deployment resolves identity independently.
- D-13 **HQ independent** · HQ manages both apps but cannot flip identity globally.
- D-14 **Isolation enforced by DB RLS + storage + trusted server code** · never UI filtering alone.
- D-15 **Rollback real + tested** before every production stage · Migration 245 requires shadow-testing.

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
- **HQ** · the administrative deployment (`NEX_APP_IDENTITY=hq`). Reads across all countries via `service_role` after `requireHqAdmin`. Not a country.
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

### 4.5 · Connection-pool safety · the `SET LOCAL` discipline

Supabase + PgBouncer (session mode) can hold a connection open across multiple transactions. `SET` without `LOCAL` persists for the connection's lifetime; the next request on the same pooled connection inherits the previous request's setting.

- `SET LOCAL nex.app_country = $country` is transaction-scoped. On COMMIT or ROLLBACK, the setting disappears.
- Every DB-backed request from Ireland or Indonesia must open a transaction, SET LOCAL, read/write, commit.
- The middleware adds a `withCountrySession(handler)` wrapper that enforces this discipline. Server actions use the wrapper. Direct `supabase.from(...)` outside the wrapper is forbidden by lint.
- A positive test: two requests on the same pooled connection, one from IE, one from ID; the ID request's `current_setting('nex.app_country')` returns `ID`, not leaked `IE`.
- A negative test: a request that forgets `SET LOCAL`; the policy denies, no rows return. (Fail-closed is already a design property of migration 245.)

### 4.6 · Shared Supabase storage

Storage buckets are project-level, not country-level. The `nex-business-assets` bucket is shared. Country isolation is enforced by:
- Path prefix: `{IE|ID}/{businessId}/...`
- Storage RLS (Migration 248) checks `(storage.foldername(name))[1] = current_setting('nex.app_country')` for same-country reads.
- WORLDWIDE businesses expose assets via a visibility-matched branch.

The sealed `nex-music-media` bucket (per music programme) stays as-is in this round. Country-aware policies on it are a separate programme if needed.

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

## 6 · Ireland-first implementation stages

Each stage is a separate owner authorisation. Nothing starts without the gate before it.

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

### Stage I-9 · Shadow-deploy test for Migration 245

- Supabase branch created from production snapshot.
- Migration 245 applied to the branch.
- Full 7-gate test matrix run from `nex-rls-policy-matrix-2026-10-31.md` §5.
- Both existing Indonesia data and a seeded Ireland test row verified.
- Connection-pool leakage test runs.
- Rollback tested in the branch (apply then DROP POLICY · the policies disappear · behaviour returns to pre-245).
- Report: pass/fail per gate, per scenario, per rollback step.
- **Owner gate**: approve apply to production ONLY on an all-pass shadow report.

### Stage I-10 · Migration 245 applied to production (CENTRAL RISK)

- Announced maintenance window.
- Pre-apply: full point-in-time snapshot (Supabase PITR).
- Apply.
- Immediate post-apply: smoke test suite runs (same as shadow).
- **Rollback decision gate**: if ANY smoke-test fails, the operator triggers DROP POLICY to return to pre-245. Data unchanged. A forward-fix migration (245b) is then prepared.
- **Owner gate**: present during apply.

### Stage I-11 · Migration 248 applied (storage prefix policy)

- External path-rename script runs for existing objects (prefix `ID/`).
- Verification: 0 objects at root prefix.
- Storage policy installed.
- Signed URL rotation plan runs.
- CDN cache invalidated.
- **Owner gate**: approve apply.

### Stage I-12 · Ireland preview + acceptance test

- Ireland Vercel preview deployment runs the full seven-gate scenario matrix.
- Seeded Ireland test data (3-5 synthetic rows in `country='IE'`).
- Confirm: Ireland sees Ireland rows, does NOT see Indonesia COUNTRY rows, DOES see Indonesia WORLDWIDE rows if any (none at this point).
- Playwright acceptance test (comparable to the HQ test in `scripts/_tmp/hq-browser-acceptance.mjs`).
- **Owner gate**: approve promotion of Ireland preview to the production domain.

### Stage I-13 · Ireland production domain live (nex.ie or chosen domain)

- DNS points at Vercel.
- `nex.ie/sign-up` is live for Ireland users.
- Indonesia deployment unchanged · still pointing to `main`, but running with its env vars still unset. Still on Vercel but under its old pattern (whatever that currently is).
- **Owner gate**: pre-launch final approval.

---

## 7 · Indonesia migration and cutover stages

Only begins after I-13 is accepted.

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

### Stage ID-4 · DNS cutover for Indonesia

- Announced change window.
- DNS flips from current deployment to the new `nex-indonesia` Vercel project.
- Zero data migration · same Supabase, same records.
- Rollback: DNS flip back.

### Stage ID-5 · Indonesia post-cutover acceptance

- Smoke-test key journeys for Indonesia users (sign in, open chat, visit profile, open shop, go live viewer).
- Confirm existing Chat Themes still render.
- Confirm music library plays.
- Confirm payment flows (if any) still work with Indonesia-specific payment adapter.

### Stage ID-6 · Monitor + decommission old deployment

- 30-day observation window.
- The old (pre-two-apps) deployment stays available on a legacy URL for recovery.
- After 30 days: owner approves decommission.

---

## 8 · HQ responsibilities and permissions

### 8.1 · HQ Vercel project

- `NEX_APP_IDENTITY=hq`
- `NEX_APP_COUNTRY=` *(unset)*
- No public domain. HQ is accessed only via an owner-known URL (and could optionally be on an internal-only subdomain gated by IP allowlist in production).

### 8.2 · HQ page gate · defence-in-depth

Three layers, every HQ page passes all three:
1. `requireHqAdmin(session.account.id)` throws if the account doesn't have `hq_role='admin'`.
2. The deployment's `NEX_APP_IDENTITY === 'hq'` is checked in a top-level HQ layout guard; if false, `notFound()`.
3. Supabase RLS continues to apply (HQ uses service role, which bypasses RLS by design, but HQ-only tables + the HQ audit log have their own policies).

### 8.3 · What HQ can and cannot do

Can:
- Read across both countries' data via service role (gated by `requireHqAdmin`).
- Update `moderation_status` on content.
- Preview a country's palette on the HQ owner's device (owner-only preview cookie, 1h TTL).
- See the Worlds catalogue (reference view).

Cannot:
- Change the global identity (there is no global identity · each app resolves its own at runtime).
- Push an "activate this country for all users" button — such a button does not exist and must not be added.
- Change the `country` column on an existing row (RLS + trigger block it even for service role; a separate owner-authorised migration would be needed for a legitimate country reassignment).

### 8.4 · HQ audit log

- Every service-role-elevated action from HQ writes a row to a new `nex_hq_audit_log` table (plan only · not yet drafted · would be a separate migration after the 7-migration programme).
- Includes `(actor_account_id, action, target_table, target_row_id, country, request_id, timestamp)`.
- HQ UI shows the last 100 entries for operator transparency.

---

## 9 · DNS, domains and environment secrets

### 9.1 · Domain plan

| Deployment | Suggested domain | Decision point |
|---|---|---|
| NEX Ireland | `nex.ie` (owner to confirm availability) OR a subdomain of a shared root | Owner picks before I-13 |
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

### 10.4 · Deployment protection

- Each project has a "Deployment Protection" rule disabling automatic promotion to production unless manual approval.
- Owner-authorisation step before every production deploy (matches the push-authorisation discipline).

---

## 11 · Rollback and disaster recovery

### 11.1 · Per-stage rollback summary (reference to the risk assessment)

| Stage | Rollback | Notes |
|---|---|---|
| I-1..I-3 (resolver + Vercel + preview) | Delete Vercel project or revert the resolver commit | Fully reversible |
| I-4 (Migration 244) | Guarded rollback with role + GUC + data guards (file on disk) | Reversible if 246 not applied |
| I-5 (Migration 246) | UPDATE country=NULL + DROP primary_country | Reversible |
| I-6-I-8 (Migrations 247/249/251) | DROP COLUMN + DROP TYPE | Lossy if non-default values set between apply and rollback; snapshot pattern available |
| I-9 (shadow test) | Delete Supabase branch | Zero production impact |
| **I-10 (Migration 245)** | **DROP POLICY returns to USING(true) permissive · WORSE than before** · forward-fix preferred | ⚠️ FORWARD-ONLY in practice |
| I-11 (Migration 248 storage) | DROP POLICY + reverse path rename (operationally fraught) | Partial rollback possible |
| I-12 (Ireland preview acceptance) | Revert the commit · delete preview | Reversible |
| I-13 (Ireland production domain live) | DNS flip back · take the Vercel domain down | Reversible unless users have signed up new accounts (then those accounts persist, which is OK — they are real users of the shared platform) |

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

- Supabase Point-in-Time Recovery (PITR) is retained on the sealed project (verify tier allows it).
- Snapshot before any migration apply.
- If a cross-country leak is detected post-launch:
  - Immediate: toggle maintenance mode on the leaking deployment (`vercel pause` on the country project).
  - Investigate RLS policy diffs vs the shadow-tested state.
  - Forward-fix migration 245b (not rollback) if the policy drift is identified.
  - Audit log inspection to determine blast radius.
  - Owner-level communication plan if real data has been exposed.

---

## 12 · Acceptance criteria and owner approval gates

### 12.1 · Gate matrix (bottom-to-top; each requires the previous)

| Gate | Scope | Owner acceptance signal |
|---|---|---|
| G-RESOLVER | Resolver code reviewed | Written approval of the module + its tests |
| G-IE-PROJECT | Ireland Vercel project configuration | Written approval of env vars + protection rules |
| G-IE-PREVIEW | First Ireland preview deployment | Written approval after preview smoke test |
| G-244 | Migration 244 apply | Written approval naming the file |
| G-246 | Migration 246 apply | Written approval + pre-flight audit result |
| G-247 | Migration 247 apply | Written approval |
| G-249 | Migration 249 apply | Written approval |
| G-251 | Migration 251 apply | Written approval |
| G-245-SHADOW | Shadow-test completed, 100% pass | Written approval of the shadow report |
| G-245-APPLY | Migration 245 apply to production | Written approval DURING maintenance window |
| G-248 | Migration 248 apply + storage path rename | Written approval + rename script completion report |
| G-IE-PROD | Ireland production domain live | Written approval of the pre-launch checklist |
| G-ID-PROJECT | Indonesia Vercel project configuration | Written approval of env + session continuity plan |
| G-ID-PREVIEW | Indonesia preview deployment | Written approval |
| G-ID-CUTOVER | Indonesia DNS cutover | Written approval DURING cutover window |
| G-HQ-GATE | HQ layout guards + identity check | Written approval of defence-in-depth check |
| G-30-DAY | 30-day post-cutover observation | Written approval of monitoring report |
| G-DECOMM | Decommission old Indonesia deployment | Written approval |

**No stage proceeds without its gate.** Nothing is auto-promoted. Nothing is batched.

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

### 14.1 · Decisions the owner must make before the next stage starts

| # | Decision | Blocking |
|---|---|---|
| U-1 | Ireland domain name (new domain purchase or subdomain of existing) | G-IE-PROD |
| U-2 | HQ domain name and IP allowlist policy | G-HQ-GATE |
| U-3 | Current Indonesia production domain (needed to plan ID-3 session continuity) | G-ID-PROJECT |
| U-4 | Preview-deployment DB target: shared Supabase OR a dedicated sandbox Supabase project | G-IE-PREVIEW |
| U-5 | Legal review schedule per country (Privacy, ToS, Data Processing) | G-IE-PROD and G-ID-PROJECT |
| U-6 | Payment adapter strategy per country (Stripe · Midtrans · other) | NOT blocking the resolver + RLS work, but blocking Ireland's launch readiness |
| U-7 | Audit log table (`nex_hq_audit_log`) — new migration post-7-programme? Separate programme? | G-HQ-GATE deferral |
| U-8 | Preview-environment WebAuthn registration policy (preview URLs cannot host production WebAuthn) | G-IE-PREVIEW |
| U-9 | Supabase tier verification (PITR enabled, connection pool size adequate) | G-245-SHADOW |

### 14.2 · Risks ranked

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Migration 245 forward-only rollback shape bites in production | Medium | High | Shadow test (§11.2) + maintenance window + PITR snapshot |
| R-2 | Env-var drift between the three Vercel projects causes shared-key skew → auth or signing failures | High | Medium | Weekly audit script (§10.1) |
| R-3 | Connection-pool leaks `nex.app_country` across requests | Medium | Critical | `SET LOCAL` discipline + middleware wrapper + CI test (§4.5) |
| R-4 | Shared Supabase project means one RLS bug exposes both countries | Low-Medium | Critical | 7-migration programme + §4.3 eight-point discipline + 1-year decision gate for per-country split |
| R-5 | Storage path rename (Migration 248) partially completes, leaves mixed-state objects | Medium | Medium | Idempotent rename script + CDN invalidation plan + fail-closed storage RLS |
| R-6 | Indonesia DNS cutover breaks WebAuthn | Medium | Medium | Keep existing eTLD+1 OR issue re-enrolment prompt |
| R-7 | Preview deployments write to production Supabase | High | Medium | Decide U-4 before any PR workflow enables preview DB writes |
| R-8 | Legal copy not country-specific at launch | Medium | High (regulatory) | U-5 decision before G-IE-PROD |
| R-9 | A commit meant for HQ only ships to Ireland or Indonesia (because the build artefact is shared) | Low | High | The HQ-only runtime check (§8.2 layer 2) is the backstop |
| R-10 | Payment adapter not ready for Ireland by launch | High | Medium | Treat as a parallel programme; Ireland can soft-launch "free" or "members-only" first |

---

## 15 · Non-goals (explicitly out of this plan)

- Activating the Worlds-page "Activate" red buttons on anyone's device.
- Shipping two independent country applications before the 7-migration programme is approved.
- Changing Chat Themes.
- Changing the sealed design tokens.
- Changing HQ authentication (`requireHqAdmin`).
- Switching to a per-country Supabase model (deferred decision in §4.4).
- Shipping an admin "re-stamp country" tool (would need its own owner-authored migration + audit).

---

## 16 · Owner acceptance targets for THIS plan

Return approve / modify / defer for each:

| # | Item | Return |
|---|---|---|
| AP-1 | Hosting architecture in §1 (three Vercel projects, no host-based routing) | approve / modify |
| AP-2 | Deployment env strategy in §2 | approve / modify |
| AP-3 | Shared Supabase analysis in §4, including the eight-point discipline and the per-country alternative recorded for a future decision gate | approve / defer / split |
| AP-4 | Ireland-first implementation stages I-1 through I-13 in §6 | approve / resequence |
| AP-5 | Indonesia stages ID-1 through ID-6 in §7 | approve / modify |
| AP-6 | HQ responsibilities + three-layer defence-in-depth in §8 | approve / modify |
| AP-7 | DNS + secrets inventory in §9 (U-1, U-2, U-3 still open) | partial approve / request specifics |
| AP-8 | CI/CD + deployment protection in §10 (U-4 open) | approve / specify preview DB target |
| AP-9 | Rollback + DR plan in §11, especially the 245 shadow-test protocol | approve / tighten |
| AP-10 | Gate matrix in §12 as the authoritative owner-authorisation flow | approve / modify |
| AP-11 | Cost + ops in §13 | ack |
| AP-12 | Risk register in §14 | ack / add risks |
| AP-13 | Non-goals in §15 | ack / add non-goals |

**Nothing starts until the owner signs off on the specific stage. No code is written, no migration is applied, no Vercel project is created, no DNS is changed, no deployment goes live, no push happens, as a result of this plan existing.**

---

*Architecture + rollout plan 2026-10-31. Doctrine only. Awaiting AP-1..AP-13.*
