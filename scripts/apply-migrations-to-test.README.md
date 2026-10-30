# `apply-migrations-to-test.mjs` — execution + recovery

Owner-authorised 2026-10-30 (Path B · BUILD ONLY commit). This README is the operational companion to:

- `scripts/apply-migrations-to-test.mjs` — the guarded applier
- `scripts/_test-applied-versions.json` — the authoritative 161-version manifest

**Current status (as of this commit): BUILD-ONLY. No database writes have been performed.** The owner's next explicit approval is required for execution.

## 1 · Modes

| Mode | Command | Needs DB? | Writes anything? |
|---|---|---|---|
| Safety self-tests | `node scripts/apply-migrations-to-test.mjs --safety-tests` | No | No |
| Dry-run resolution | `node scripts/apply-migrations-to-test.mjs --dry-run` | No | No |
| Apply (gated) | `TEST_DATABASE_URL=... node scripts/apply-migrations-to-test.mjs` | Yes (test only) | Yes (test DB) + `logs/apply-migrations-<timestamp>.log` on disk |

## 2 · Safeguards verified in this commit

All 8 safeguards passed `--safety-tests`:

1. ✓ Production-ref URL (`ijvqdvsvwtwxzcqmoqit`) is refused · exit 2.
2. ✓ Empty `TEST_DATABASE_URL` is refused · exit 2.
3. ✓ Manifest `total === 161`.
4. ✓ Manifest `entries.length === 161`.
5. ✓ Manifest has resolution_map entries for 187 and 224.
6. ✓ All 161 entries resolve to real files on disk.
7. ✓ Duplicate prefix 187 resolves to `187_nex_world_country_us_au_seed.sql` (per production description), not alphabetical-first `187_nex_source_registry_osm_products.sql`.
8. ✓ Duplicate prefix 224 resolves to `224_nex_account_is_mock_persona.sql` (per production description), not alphabetical-first `224_nex_emergency_schema.sql`.
9. ✓ Missing-file causes hard failure (exit 2) before any DB connect.
10. ✓ Tampered manifest (187 → wrong file) is refused via resolution_map cross-check.

## 3 · Execution procedure

Only run after you have:
- Provisioned the dedicated test Supabase project (NOT production).
- Verified the project ref is NOT `ijvqdvsvwtwxzcqmoqit`.
- Exported `TEST_DATABASE_URL` pointing at the test project's direct connection.
- Owner explicit approval to run.

```sh
# Belt-and-braces · run safety tests + dry-run first
node scripts/apply-migrations-to-test.mjs --safety-tests
node scripts/apply-migrations-to-test.mjs --dry-run

# Then the real run:
export TEST_DATABASE_URL="postgres://..."
node scripts/apply-migrations-to-test.mjs
```

Expected output pattern:
```
Resolved 161/161 migration files · pre-flight OK
Logging to logs/apply-migrations-2026-10-30T18-30-00.log
APPLIED 001 · 001_nex_migration_history_and_account.sql
APPLIED 002 · 002_nex_business.sql
...
APPLIED 224 · 224_nex_account_is_mock_persona.sql
─── Done · 161 applied, 0 skipped, 161 total ───
```

Expected duration: 2–5 minutes on a test project with no latency to the Supabase pooler.

## 4 · Recovery procedure

### 4.1 · If the applier reports `FAILED N` for some version

The applier exits non-zero immediately. **No row is written to `nex_migration_history` on failure** — the migration SQL's own transaction rolls back, taking its own `INSERT INTO nex_migration_history` with it.

Steps:

1. Read `logs/apply-migrations-<timestamp>.log` to see the exact Postgres error.
2. Fix the root cause in the migration SQL file (or in the manifest if the file path is wrong). **DO NOT** manually insert a row into `nex_migration_history` to skip past it — that creates the exact fake-completion state the applier is designed to prevent.
3. Re-run the applier. The idempotency check at the top of each migration iteration will SKIP everything that successfully applied before the failure, then retry the failed version.

### 4.2 · If the applier gets killed mid-run (OS kill / network drop)

Each migration transaction is atomic. Either it committed (row in `nex_migration_history`) or it rolled back (no row). On re-run the applier sees the committed set via the idempotency check and continues from the first uncommitted version.

### 4.3 · If you need to start over on the test project

Supabase dashboard → the test project → Settings → "Reset database password" (changes connection string) OR delete + recreate the project (fastest). The seed script and this applier both target `TEST_DATABASE_URL`; no cleanup action is needed on the local repo.

### 4.4 · If the production-ref guard misfires

Not possible under normal use — the guard refuses any URL containing the literal string `ijvqdvsvwtwxzcqmoqit`. If a legitimate test URL ever contained that substring (it won't; Supabase project refs are unique), update the guard explicitly after owner approval. **Do not silently bypass.**

## 5 · What this applier does NOT do

- Does not reset or truncate the test database.
- Does not seed test accounts/businesses (that's `scripts/seed-test-env-e2e.mjs`).
- Does not install Playwright or run tests.
- Does not touch the production database or any file outside the project.
- Does not consult migration file headers for apply/skip decisions — only the authoritative manifest.
- Does not expand the manifest. The 161-version list is frozen until a fresh production probe + owner authorisation re-base it.

## 6 · Updating the manifest

If production applies new migrations later and you need to replay them to a fresh test project:

1. Re-run the sealed probe: `node scripts/preflight-nex-migration-history-readonly.mjs`.
2. Paste the output into the owner review loop.
3. Owner authorises a manifest update commit.
4. Re-run `--safety-tests` to verify count + resolution still clean.
5. Owner authorises execution against the test project.

The manifest is a frozen snapshot by design — do not auto-sync against production.
