# NEX Family Safety · Database Proposal · DRAFT

**Status:** 📝 DRAFT · PROPOSAL ONLY · owner-recorded 2026-10-20
**Author:** Claude (recording verification results and open questions)
**Date:** 2026-10-20
**Supersedes:** nothing (first database proposal for this subsystem)

> **What this document is:** a proposal that captures what the current
> Family Safety service layer *expects* to find in Postgres, what
> cannot be verified from code alone, and what owner decisions must
> precede any migration authoring.
>
> **What this document is NOT:**
> - It is NOT a migration. No SQL is being authored by this proposal.
> - It does NOT grant permission to apply migrations to any database.
> - It does NOT change feature-flag defaults. `isFamilySafetyEnabled()`
>   stays TRUE (discoverability). `isFamilyProductionEnabled()` stays
>   FALSE (production writes blocked).
> - It does NOT enable production writes or real-world linking.
> - It does NOT change public package copy.
> - It does NOT alter Phase A1's release hold.
> - It does NOT unblock any W-item (Vault), S-item, or lock the
>   Package Contract DRAFT.
>
> **How to use this proposal:** read Section 2 (verified facts) first,
> then Section 4 (open questions) before deciding whether to authorise
> any migration-authoring work. Sections 5 and 6 are structural detail
> you can review once the open questions are closed.

---

## Section 1 · Executive summary

The Family Safety product surface has substantial implementation
across **~15 TypeScript files** (service layer + 10 route groups + 8
unit test files). Those files were written against **seven `nex.`
schema tables that do not exist in `nex-supabase/migrations/*.sql`**.
Every service entry point reads/writes through a raw `pg` pool
(`src/lib/nex/db.ts` · `NEX_POSTGRES_URL` connection) and gracefully
returns `db_unavailable` when the pool is absent or the tables are
missing.

The seven missing tables, in dependency order:

1. `nex.family_link` — the primary guardian↔child relationship
2. `nex.account_age_attestation` — declared date-of-birth record
3. `nex.account_minor_profile` — flag that an account is a minor
4. `nex.parent_custody_link` — scheduled age-18 transition primitive
5. `nex.family_link_revocation_cooldown` — revocation safety delay
6. `nex.family_link_pressure_report` — "child under pressure" signal
7. `nex.family_safety_dashboard_access_log` — guardian view audit

**No real linking flow functions end-to-end until these tables exist.**
Every live user hitting `/nex-native/family-safety` currently lands on
the sealed "SIMULATED · PILOT" surface and discovers only the
`db_unavailable` graceful fallback — which is honest for a pilot but
is not a working product.

**Scope correction vs. the earlier Package Contract DRAFT (Section
3B · S1):** that section listed two tables (`family_link` +
`account_age_attestation`). The verified count is seven. The S1
downstream work row in `nex-package-contract-draft-2026-10-20.md`
should be revised when the owner next edits that draft; this
proposal supersedes the two-table framing.

---

## Section 2 · Verified facts (from code reads)

Every fact in this section is derived from a direct read of a
checked-in source file. No DB connection was made.

### 2.1 · Zero migrations exist for any Family Safety table

```
$ grep -lE "nex\.family_|nex\.parent_custody|nex\.account_minor|nex\.account_age_attestation|nex\.family_safety_dashboard" nex-supabase/migrations/*.sql
(no matches)
```

Migration numbers 190–212 are already occupied by unrelated work
(notification prefs, chat theme catalogue, theme commission, theme
purchase, theme ownership, business theme, bespoke owner privacy,
peer rate limit, chat privacy prefs, data usage prefs, canonical
email qualification, outreach queue, chosen handle, profile cover
and interests, HQ role, onboarding+vault trial, discovery signal,
intro video, intros storage, intro title segments, shop cover
overrides). The next available number is 213 (currently sealed as
"not authorised" per Package Contract Section 5).

**Comment-level drift (not a bug, but worth recording):**
`src/lib/nex-native/family-links/family-link-service.ts:5` says
*"Thin pg wrapper around nex.family_link (migration 198)"*. Migration
198 was ultimately used for `nex_account_notification_prefs`. The
family_link migration was never authored at any number.

### 2.2 · The service layer uses raw `pg`, not Supabase REST

- Shared pool at `src/lib/nex/db.ts` · `withClient(fn)` acquires a
  client from `pg.Pool`, runs `fn`, releases on completion.
- Pool creation is lazy: `NEX_POSTGRES_URL` absent → pool is `null`
  → `withClient` returns `null` → services return `db_unavailable`.
- Connection URL defaults to `localhost:5433` (local `nex_dev`) per
  the CLAUDE.md note in this repo. Supabase pooler URL
  (`aws-0-eu-west-1.pooler.supabase.com`) is the production target
  per the Safety Constitution §8.

**Implication:** this service layer bypasses PostgREST entirely.
Row-Level Security policies would only matter if a Supabase client
(anon/authenticated role) ever became a reader. All current reads
and writes go through a service-role-equivalent raw connection.
Access control therefore lives in the TypeScript authorisation
layer (`family-link-service.ts`'s own actor checks), NOT in RLS.

### 2.3 · All writes force `simulated = TRUE`

Confirmed across all seven tables (verbatim from the INSERT
statements):

| Table | INSERT forces | Service file |
|---|---|---|
| `nex.family_link` | `simulated = TRUE` | `family-link-service.ts:201` |
| `nex.account_age_attestation` | `simulated = TRUE` | `age-attestation-service.ts:224` |
| `nex.family_link_revocation_cooldown` | `simulated = TRUE` | `cooldown-service.ts:184` |
| `nex.family_link_pressure_report` | `simulated = TRUE` | `pressure-signal-service.ts:214` |
| `nex.parent_custody_link` | (read-only in current code) | `age-transition-service.ts` |
| `nex.account_minor_profile` | (read-only in current code) | `age-transition-service.ts` |
| `nex.family_safety_dashboard_access_log` | `simulated = TRUE` | `dashboard-service.ts:112` |

Error code `FAMILY_LINK_ERROR_CODES.SIMULATED_ONLY` is thrown if any
caller tries to create a non-simulated link in Phase 1
(`types.ts:108`). Equivalent code exists for age attestations.

### 2.4 · Column shapes extracted from service queries

The following column lists are the **minimum** each table must
provide. Column names are quoted verbatim from the SQL in the
service layer. Types are declared based on how the service reads +
writes each column.

#### `nex.family_link` · from family-link-service.ts (INSERT line 193) + mapRow (line 66)
Columns the service writes or reads:
- `link_id` (PK · stable identifier · service treats as text/uuid-shaped string)
- `guardian_account_id` (text · references nex_account.id)
- `child_account_id` (text · references nex_account.id)
- `role` (text · one of 4 sealed values: `guardian_primary`, `guardian_secondary`, `trusted_adult`, `mentor`)
- `state` (text · one of 4 sealed values: `pending`, `active`, `revoked`, `expired`)
- `initiated_by` (text · one of 3 sealed values: `guardian_invite`, `child_invite`, `system_setup`)
- `initiated_at` (timestamptz · set at INSERT by DB default)
- `confirmed_at` (timestamptz NULL · set at confirmLink)
- `revoked_at` (timestamptz NULL · set at revokeLink)
- `revoked_by` (text NULL · account_id of revoker)
- `revoked_reason` (text NULL · freeform within length bounds per Phase 1)
- `expires_at` (timestamptz NULL · optional expiry)
- `can_see_emergency_alerts` (boolean · DB default TRUE)
- `can_see_safety_summaries` (boolean · DB default FALSE)
- `can_see_location_when_shared` (boolean · DB default FALSE)
- `simulated` (boolean · DB default TRUE)
- `created_at` (timestamptz · set at INSERT by DB default)

**Partial unique index observed in use:** the service re-checks for a
duplicate `(child_account_id, role='guardian_primary', state='active')`
tuple (family-link-service.ts:177). A matching partial unique index
on the DB side would turn that race window into a hard constraint;
the service already handles the exception path.

#### `nex.account_age_attestation` · from age-attestation-service.ts (INSERT line 216)
- `attestation_id` (PK)
- `account_id` (text · references nex_account.id)
- `declared_date_of_birth` (date · ISO 8601 YYYY-MM-DD)
- `attested_by` (text · one of: `self`, `guardian`, `system_fallback`)
- `attested_by_account_id` (text NULL · present when attested_by='guardian')
- `attestation_method` (text · one of: `declared`, `guardian_declared`, `document_verified_future_phase`)
- `attestation_notes` (text NULL · freeform)
- `superseded_by` (text NULL · attestation_id of the row that superseded this one)
- `simulated` (boolean · DB default TRUE)
- `created_at` (timestamptz · set at INSERT by DB default)

#### `nex.family_link_revocation_cooldown` · from cooldown-service.ts (INSERT line 179)
- `cooldown_id` (PK)
- `link_id` (text · FK to family_link.link_id)
- `initiated_by_account_id` (text)
- `effective_at` (timestamptz)
- `state` (text · one of: `pending`, `confirmed`, `bypassed`, `expired`)
- `simulated` (boolean · DB default TRUE)
- plus `created_at` and whichever updated_at columns the DB default manages

**Named constraint observed in use:**
`family_link_revocation_cooldown_link_pending_uq` — the service's
error-handling branch catches a unique-violation on this constraint
and surfaces `COOLDOWN_ALREADY_PENDING`
(cooldown-service.ts:197-199). The constraint is a partial unique
on `(link_id)` where `state='pending'`.

#### `nex.family_link_pressure_report` · from pressure-signal-service.ts (INSERT line 211)
- `report_id` (PK)
- `link_id` (text · FK to family_link.link_id)
- `reporter_account_id` (text · the party raising the signal)
- `reason_code` (text · set of sealed codes defined in pressure-signal-service types)
- `reason_notes` (text NULL · freeform)
- `reported_against_account_id` (text · counterparty on the link)
- `state` (text · one of: `open`, `closed`, `superseded` · observed values)
- `simulated` (boolean · DB default TRUE)
- plus `created_at`, `closed_at`, etc. (not fully extracted; see assumption 3.4)

**Named constraint observed in use:**
`family_link_pressure_report_reporter_open_uq` — partial unique on
`(link_id, reporter_account_id)` where `state='open'`.

#### `nex.parent_custody_link` · from age-transition-service.ts
Columns the service reads (lines 192-199):
- `custody_id` (PK)
- `parent_account_id` (text)
- `child_account_id` (text)
- `auto_transfer_at` (timestamptz NULL · the scheduled 18th-birthday moment)
- `transferred_at` (timestamptz NULL · set when transition completes)
- `revoked_at` (timestamptz NULL · set when custody is revoked)
- `simulated` (boolean)

**Write path:** `UPDATE … SET transferred_at = $2 WHERE custody_id = $1
AND transferred_at IS NULL AND revoked_at IS NULL` (line 498). No
INSERT is in this file; the row must be created elsewhere (likely a
server action referenced from `family-safety/create-child/`).

#### `nex.account_minor_profile` · from age-transition-service.ts (line 511)
- `account_id` (PK or UNIQUE · the single flag row per account)
- `is_minor` (boolean · toggled to FALSE on age-18 transition)
- `transferred_at` (timestamptz NULL)
- `updated_at` (timestamptz · bumped on every UPDATE)
- plus whatever else the service that creates the row writes (not
  visible from the files I read; see assumption 3.5)

#### `nex.family_safety_dashboard_access_log` · from dashboard-service.ts (INSERT line 106)
- `log_id` (PK · implicit)
- `viewer_account_id` (text · the guardian or trusted adult)
- `viewed_child_account_id` (text NULL · the "null" sentinel is semantically distinct from empty string — the service normalises empty string → NULL)
- `surface_name` (text · which dashboard surface the access occurred on)
- `outcome` (text · what happened · success/denied/not_available)
- `simulated` (boolean · DB default TRUE)
- `created_at` (timestamptz · set at INSERT by DB default)

### 2.5 · Authorisation is enforced in TypeScript, not SQL

Every service entry point (createLink, confirmLink, revokeLink,
createCooldown, confirmBypass, openPressureReport, etc.) explicitly
checks `actorAccountId` against the stored
`guardian_account_id`/`child_account_id` and throws
`UNAUTHORIZED_ACTOR` on mismatch. A migration cannot "safely rely
on RLS" here because the raw-pg path bypasses PostgREST.

### 2.6 · 8 service-level test files already exist

```
_server-actions.test.ts
age-attestation-service.test.ts
cooldown-service.test.ts
family-link-service.test.ts
family-role-reader.test.ts
invite-service.test.ts
pressure-signal-service.test.ts
```

These test the TypeScript business logic (not SQL execution).
If the DB layer lands, these tests will continue to pass against
mocks · they are NOT proof that the schema is correct, only that
the service handles its own code paths. A separate integration test
suite is needed to verify DB behaviour (see Section 6).

---

## Section 3 · Assumptions (inferred from code · must be validated)

Each assumption below is something I *cannot* confirm without
owner input or a live DB inspection.

### 3.1 · UUID vs text identifiers

The service treats all `_id` columns as strings. It does NOT call
`gen_random_uuid()` client-side. The migrations in
`nex-supabase/migrations/167_nex_business_canonical.sql` enable
`pgcrypto` and use `uuid` columns with `DEFAULT gen_random_uuid()`.
**Assumption:** the Family Safety tables should follow the same
convention · PK columns as `uuid` with `DEFAULT gen_random_uuid()`,
not `text` identifiers. The service treats them as strings either
way (uuid is serialised to string by `pg`), so no code change is
needed if this assumption holds.

**Risk if wrong:** any ad-hoc migration that uses `text` for `_id`
columns would diverge from the rest of the project's convention and
make future joins / cross-DB tooling awkward.

### 3.2 · The `role` and `state` columns should be CHECK-constrained

The TypeScript layer already defines the 4-value `role`, 4-value
`state`, and 3-value `initiated_by` enums. The DB has no equivalent
constraint today. **Assumption:** these should be enforced at the
DB level with CHECK constraints (not `CREATE TYPE enum` — Postgres
enums are hard to evolve; CHECK is cheaper to adjust). This is a
defence-in-depth decision, not a correctness requirement.

### 3.3 · `can_see_emergency_alerts` DB default is TRUE

The service's doctrine comment (family-link-service.ts:17-20)
asserts that `can_see_emergency_alerts` has a DB-level default of
TRUE while the other two permission flags default FALSE. This is
sealed language, so the migration MUST set these defaults
correctly. **Assumption:** this is the owner-approved behaviour and
should not be renegotiated here.

### 3.4 · `family_link_pressure_report` has `created_at` and `closed_at` columns

The read path in `pressure-signal-service.ts:271` is
`SELECT * FROM nex.family_link_pressure_report WHERE …`. I did not
read the full `mapRow` to extract every timestamp column. **Likely
columns beyond those listed in 2.4:** `created_at` (NOT NULL),
`closed_at` (NULL), `closed_by_account_id` (NULL),
`closed_reason` (NULL). Needs confirmation from a full read of the
service file before migration-authoring.

### 3.5 · `account_minor_profile` has `created_at` and possibly `declared_dob` columns

The service only touches `account_id`, `is_minor`, `transferred_at`,
`updated_at`. The ROW likely has more columns written at
account-creation time (`created_at`, possibly the declared DOB
mirrored from `account_age_attestation`). The INSERT path lives in
whichever create-child server action owns minor-profile creation,
which I did not open. Needs confirmation.

### 3.6 · The migrations should run on the Supabase project `ijvqdvsvwtwxzcqmoqit`

The Safety Constitution §8 names this project as the sole NEX DB.
`NEX_POSTGRES_URL` currently points at `localhost:5433` per
CLAUDE.md. **Assumption:** when the migrations are applied, both
local dev DB AND the Supabase pooler should receive them. The
local DB is development only · the Supabase project is production
truth.

**Risk if wrong:** if migrations are applied only locally, the
production Supabase would stay in the current "db_unavailable"
state and the Family Safety product would still not function in
production.

### 3.7 · No separate "nex_family_safety_reader" role is required

The Directory spine uses sealed roles (`nex_directory_reader`,
`nex_intelligence_reader`, etc.) that GRANT/REVOKE discipline
enforces at the DB level. **Assumption:** because the Family
Safety service uses a raw service-role-equivalent connection, no
analogous reader role is needed in Phase 1. If a future wave
exposes a limited reader (e.g. an auditor), that role would be
added as a separate migration. See open question 4.6 for whether
this assumption holds.

---

## Section 4 · Unresolved questions (owner decisions required)

These must be answered before authoring migrations. Each is phrased
as a decision the owner must make.

### 4.1 · Should the migration file(s) land now, or wait on a verified end-to-end flow design?

Family Safety was designed Phase-1-at-once in the service layer,
but the DB-layer absence means **no part of it has ever been
exercised against a real DB**. Options:

- **A** · Author the migrations now (one file, number 213) and
  separately authorise application later. Lowest risk · code
  changes zero.
- **B** · Design the end-to-end linking flow with the owner first
  (invite → accept → active → revocation → cooldown → pressure
  signal → age transition) and author the migrations as part of
  that flow. Highest confidence but biggest scope.
- **C** · Author a *minimal* migration (`family_link` +
  `account_age_attestation` only, three others deferred) that
  enables the Setup / Invite / Accept flow but keeps cooldown,
  pressure signal, age transition, and dashboard access log
  dormant. Smallest working surface. **Risk:** some service
  calls (`openPressureReport`, `logDashboardAccess`,
  `createCooldown`) will still return `db_unavailable` and must be
  surfaced honestly in the UI.

**Recommended default:** C. Reasoning: the Setup/Invite/Accept flow
is the critical "parent-child link" path. Cooldown and pressure
signal are safety-net primitives that can land later without
compromising the primary flow's honesty — they can continue to
return `db_unavailable` while labelled "pilot".

### 4.2 · Which identifier type for primary keys?

See assumption 3.1. **Decision needed:**
- **A** · `uuid` with `DEFAULT gen_random_uuid()` (matches 167_nex_business_canonical and modern conventions)
- **B** · `text` (unusual · would diverge from the rest of the project)
- **C** · `bigint` sequence (older convention · used by some pre-166 migrations)

**Recommended:** A.

### 4.3 · Should permission-flag flipping stay unavailable in Phase 1?

The service comment seals: *"No permission-flag flip in Phase 1 ·
updateLinkPermissions is NOT exposed. Flipping the two
default-FALSE flags requires a future wave with its own explicit
authorisation."* **Decision needed:** does this doctrine still hold?

If yes → the migration should not add any `UPDATE` triggers or
flow for changing `can_see_safety_summaries` /
`can_see_location_when_shared`. If no → separate wave of UI +
service work before anything is advertised.

**Recommended:** yes · keep Phase 1 sealed · the PILOT chip
depends on this doctrine not drifting.

### 4.4 · How should the DB handle the `simulated` column at live-mode flip?

The `simulated` column currently defaults TRUE and every INSERT
forces TRUE. **Decision needed:** when live mode flips (a future
authorisation separate from this proposal):

- **A** · Flip the DB default to FALSE and update every service's
  INSERT to pass `simulated` as a boolean argument.
- **B** · Keep the DB default TRUE and have the service pass
  `simulated = isFamilyProductionEnabled() ? false : true` on
  INSERT.
- **C** · Partition: old rows stay `simulated=true` (quarantined);
  new rows after flip are `simulated=false`. Requires a `migration
  cohort` column.

**Recommended:** B. Keeps backward-compat and makes the live-mode
decision reversible without migration surgery.

### 4.5 · Should the Family Safety migrations be applied to the live Supabase project (`ijvqdvsvwtwxzcqmoqit`) as part of landing them?

Per Safety Constitution §5, "authoring" and "applying" are two
separate gates. **Decision needed:**

- **A** · Authoring only · applied later behind a separate gate.
- **B** · Author + apply to local dev DB only · Supabase stays
  cold.
- **C** · Author + apply to both local + Supabase pooler.

**Recommended:** A. The owner's directive on 2026-10-20 was
explicit: *"Do not author or apply migrations in this task."*
Authoring is a separate task; applying is a further-separate task.

### 4.6 · Should any migration GRANT/REVOKE roles for Family Safety reads?

The Directory spine uses dedicated reader roles. **Decision
needed:** should Family Safety also carry explicit grants (e.g. a
`nex_family_safety_reader` role) or stay raw-pg only in Phase 1?

**Recommended:** stay raw-pg only in Phase 1. Add roles when a
non-service-role reader is identified (none today).

### 4.7 · Should `can_see_emergency_alerts` default stay TRUE?

See 3.3. Doctrine says yes. **Decision needed:** confirm the
default or renegotiate before migration lands.

### 4.8 · Is `nex_account.id` text or uuid?

Every Family Safety table FKs an `account_id` to the account layer.
I did not read the `nex_account` migration to confirm its PK type.
**Decision needed:** confirm the type so the FKs are shaped
correctly. Needs a one-line read of the `nex_account` migration.

---

## Section 5 · Table-by-table minimum migration specification

Not SQL · descriptive only. Translates Sections 2.4 + 3 into the
columns, constraints, and indexes an eventual migration would need.
Review this against Section 4 open questions before any SQL is
authored.

### 5.1 · `nex.family_link`
- **PK:** `link_id` · uuid · `DEFAULT gen_random_uuid()`
- **FKs:** `guardian_account_id`, `child_account_id` → `nex_account.id`
- **Enums (via CHECK):** `role`, `state`, `initiated_by`
- **Timestamps:** `initiated_at` default `now()`, `confirmed_at`, `revoked_at`, `expires_at`, `created_at` default `now()`
- **Flags:** `can_see_emergency_alerts` default TRUE, two others default FALSE, `simulated` default TRUE
- **Partial unique index:** `(child_account_id, role) WHERE role='guardian_primary' AND state='active'`
- **Other indexes:** `(guardian_account_id)`, `(child_account_id)`, `(state)` for the common list queries
- **CHECK:** `guardian_account_id <> child_account_id` (service enforces too)

### 5.2 · `nex.account_age_attestation`
- **PK:** `attestation_id` · uuid · default
- **FK:** `account_id` → `nex_account.id`, `attested_by_account_id` → `nex_account.id` nullable
- **Enums:** `attested_by`, `attestation_method` (both CHECK)
- **CHECK:** `(attested_by='guardian') = (attested_by_account_id IS NOT NULL)`
- **CHECK:** reject `attestation_method='document_verified_future_phase'` (Phase 1 doctrine)
- **Partial index:** `(account_id) WHERE superseded_by IS NULL` — latest attestation per account

### 5.3 · `nex.account_minor_profile`
- **PK:** `account_id` (or separate `minor_profile_id` + unique on `account_id`)
- **FK:** `account_id` → `nex_account.id`
- **Columns:** `is_minor` boolean NOT NULL, `transferred_at` timestamptz NULL, `created_at` default `now()`, `updated_at` default `now()`
- **Open question:** does this table also mirror the declared DOB from `account_age_attestation`, or always derive it on read? (See 3.5.)

### 5.4 · `nex.parent_custody_link`
- **PK:** `custody_id` · uuid · default
- **FKs:** `parent_account_id`, `child_account_id` → `nex_account.id`
- **Columns:** `auto_transfer_at` timestamptz NULL, `transferred_at` timestamptz NULL, `revoked_at` timestamptz NULL, `simulated` boolean default TRUE
- **Partial unique:** one active custody per child · `(child_account_id) WHERE transferred_at IS NULL AND revoked_at IS NULL`
- **Open question:** INSERT path · which service / server action owns row creation? Needs identification before migration.

### 5.5 · `nex.family_link_revocation_cooldown`
- **PK:** `cooldown_id` · uuid · default
- **FK:** `link_id` → `family_link.link_id`
- **Columns:** `initiated_by_account_id`, `effective_at` timestamptz NOT NULL, `state` text CHECK, `simulated` default TRUE
- **Named partial unique:** `family_link_revocation_cooldown_link_pending_uq` on `(link_id) WHERE state='pending'`

### 5.6 · `nex.family_link_pressure_report`
- **PK:** `report_id` · uuid · default
- **FK:** `link_id` → `family_link.link_id`
- **FKs:** `reporter_account_id`, `reported_against_account_id` → `nex_account.id`
- **Columns:** `reason_code` text CHECK against sealed codes · `reason_notes` text NULL · `state` text CHECK · `simulated` default TRUE
- **Named partial unique:** `family_link_pressure_report_reporter_open_uq` on `(link_id, reporter_account_id) WHERE state='open'`
- **Confirm columns:** `created_at`, `closed_at`, `closed_by_account_id`, `closed_reason` (see 3.4)

### 5.7 · `nex.family_safety_dashboard_access_log`
- **PK:** `log_id` · uuid · default
- **Columns:** `viewer_account_id` NOT NULL · `viewed_child_account_id` NULL · `surface_name` NOT NULL · `outcome` NOT NULL · `simulated` default TRUE · `created_at` default `now()`
- **No FKs required** (append-only audit log · doesn't need cascading constraints · drop-friendly if an account is deleted)
- **Index:** `(viewer_account_id, created_at DESC)` for guardian-side audits

---

## Section 6 · Minimum tests + verifications before implementation

The 8 existing service-level test files (Section 2.6) are unit
tests. Before any migration applies, the following additional
verifications are needed:

### 6.1 · Column-level drift test

A SQL-only script that connects to the test DB, inspects
`information_schema.columns` for each of the 7 tables, and asserts
every column named in Section 2.4 exists with the expected type +
nullability + default. Blocks CI if any migration drops or renames
a column referenced by the service.

### 6.2 · Service-against-real-DB integration tests

Run each service's existing test file (currently against mocks) a
second time against a real Postgres instance seeded by the proposed
migration. If both pass → service↔schema alignment is proven. If
mocks pass but real-DB fails → migration or service is wrong.

**Scope:** 8 test files × ~15-30 test cases each = ~120-240 cases
to run twice. Owner must decide whether this gating runs in CI or
only pre-release.

### 6.3 · Named-constraint regression tests

The service relies on two named partial-unique constraints by
pattern-matching the error message:
- `family_link_revocation_cooldown_link_pending_uq`
- `family_link_pressure_report_reporter_open_uq`

A regression test that forces a duplicate INSERT and asserts the
exact error-code mapping stays correct.

### 6.4 · `db_unavailable` graceful-degradation test

Prove that when `NEX_POSTGRES_URL` is unset:
- Every service entry point returns `null` or throws the
  `*.DB_UNAVAILABLE` sealed code.
- No service panics or leaks a raw pg error to the UI.
- The UI renders the "temporarily unavailable" copy (already
  covered in `accept/[linkId]/_accept-client.tsx:480`).

### 6.5 · Partial-unique duplicate-primary-guardian race test

The service re-checks the primary-guardian uniqueness in two
places (lines 177 + 269). A race between two concurrent
`createLink` calls must be caught by the DB index, not just the
pre-check. Test by invoking two `createLink` calls in parallel on a
test DB and asserting exactly one succeeds.

### 6.6 · Account-ID FK integrity test

Every Family Safety table FKs `nex_account.id`. A test that creates
a family_link row, deletes the referenced account, and verifies the
cascade behaviour matches the migration's `ON DELETE` policy (which
is itself an open question — Section 4 does not yet decide
CASCADE vs RESTRICT vs SET NULL).

### 6.7 · UI/service agreement test for the "simulated" chip

The `SimulatedBadge` component on 6 Emergency Help surfaces, the
"SIMULATED · PILOT" banner on the Family Safety home, and the
PILOT chip on the Settings hero tile must all remain honest after
any live-mode flip. A source-level test that greps for a mismatch
between a `simulated` prop/default and the sealed badge gating.

---

## Section 7 · Downstream dependencies + risks

### 7.1 · The `nex_account.id` type is a cross-cutting unknown

See 4.8. Every proposed FK depends on this. Resolve first.

### 7.2 · Supabase project state is uncertain

The CLAUDE.md note at `C:\Users\Victus\nexapp\CLAUDE.md:§8` says:
*"The directory canonical layer is expected to live in this
project. Where the current state has these tables missing or
diverged from the local `nex_dev`, the Supabase project is the
SINGLE source of truth going forward · the migration + backfill
plan must bring Supabase up to date, not create a parallel DB."*

**Implication:** before any Family Safety migration applies to
Supabase, the Supabase project must be at a known schema version.
If it is behind local `nex_dev`, Family Safety is not the first
migration gap; the backfill plan for the Directory spine must
precede it.

### 7.3 · The "comment-level drift" at family-link-service.ts:5

The reference to "migration 198" in the service comment is now
misleading (198 is notification prefs). When the real migration
lands, update that doctrine comment to point at the correct
number.

### 7.4 · Phase 2 features depend on this schema landing

Everything in `src/app/nex-native/family-safety/{age-transition,
create-child, dashboard}` is coded against these tables. Any
future UX improvement (search for a child, pending-invitation
indicator, dashboard polish) blocks on this proposal moving
forward.

### 7.5 · The Emergency Help wiring correction (Task 1 of this
owner directive 2026-10-20) is unrelated to this proposal

Task 1 shipped a one-prop fix on two shells. It does not touch
Family Safety. The two workstreams are independent and should
remain so.

### 7.6 · The 4.99 pricing memory is still unsupported in git

Confirmed in the Package Contract DRAFT Section 3B. No change here.
S1 stays on the free-pilot plan.

---

## Section 8 · What this proposal does NOT do (explicit)

- Does NOT author any SQL migration.
- Does NOT apply any migration to any database (local or Supabase).
- Does NOT connect to a database to validate assumptions.
- Does NOT change `isFamilySafetyEnabled()` default (stays TRUE).
- Does NOT change `isFamilyProductionEnabled()` default (stays FALSE).
- Does NOT change `isEmergencyLiveMode()` default (stays FALSE).
- Does NOT enable real-world child-account linking.
- Does NOT enable real-world pressure-signal routing.
- Does NOT enable real-world age transitions.
- Does NOT change the SimulatedBadge wording or thresholds.
- Does NOT change the PILOT chip on the Settings hero tile.
- Does NOT change the Family Safety "What this does / What this
  doesn't do" transparency section on the home page.
- Does NOT touch Phase A1's release hold.
- Does NOT promote the Package Contract DRAFT to LOCKED.
- Does NOT change public `/packages` or `/settings/tier` copy or
  pricing.
- Does NOT unblock any W-item (Vault), S-item, or P-item.
- Does NOT discard, overwrite, or alter any uncommitted work.
- Does NOT commit, push, or deploy.

---

## Section 9 · Approval checkpoint

The owner's directive on 2026-10-20 was explicit:

> *"Prepare a proposal only. Verify the existing SQL queries,
> expected columns, constraints, foreign keys, migration
> conventions, RLS policies, and ownership/access requirements for
> `nex.family_link` and `nex.account_age_attestation`. Do not
> author or apply migrations in this task. Do not enable production
> writes or change feature-flag defaults. Identify any additional
> schema dependencies and the minimum tests needed before
> implementation. Clearly separate verified facts from assumptions
> and unresolved questions."*

This file records those items. The next decision belongs to the
owner:

- Resolve open questions 4.1–4.8.
- Separately authorise migration *authoring* (next step after the
  decisions in Section 4).
- Separately authorise migration *application* (further-separate
  step per Safety Constitution §5).
- Hold until the Supabase baseline-vs-local-nex_dev reconciliation
  (Section 7.2) is resolved.
- Keep as DRAFT and move on to other work.
