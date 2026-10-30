# NEX Product Upload · E2E tests

Owner-authorised 2026-10-31. Playwright scaffold for browser-based end-to-end tests of the seller product-upload journey.

This README is the authoritative provisioning plan. **Nothing in this scaffold provisions infrastructure or applies migrations.** The owner approves and executes those steps.

---

## 1 · Provisioning plan (owner action)

### 1.1 Dashboard steps

1. Sign in to the Supabase dashboard with the NEX ops account (`asknexapp@gmail.com` per CLAUDE.md §8).
2. **Create a new project**. Use a clearly test-only name — suggested: `nex-e2e-test-product-upload`.
3. Choose a region. Recommended: match the production region (`aws-0-eu-west-1`) so timing behaviour is comparable. If you prefer lower latency to your laptop, use the nearest region — this is a test env, not production.
4. Pick a strong database password. Save it in a password manager; the plan references it below.
5. Wait for the project to finish initialising (typically 1–2 minutes).

### 1.2 Project settings to verify after creation

- **Database → Connection string → Direct connection**: copy the pooled connection string. This becomes `TEST_DATABASE_URL`.
- **Settings → API → Project URL**: copy. This becomes `TEST_SUPABASE_URL`. Confirm the project ref in the URL is **NOT** `ijvqdvsvwtwxzcqmoqit` (that's production — the seed script refuses to run against it, see §4 below).
- **Settings → API → service_role secret**: copy. This becomes `TEST_SUPABASE_SERVICE_ROLE_KEY`.
- **Storage → Create a new bucket** named `nex-business-assets`. Set to **Public** (same policy as production). This is required so the upload-image + upload-cover-video routes return usable public URLs.
- **Authentication → Settings**: leave defaults. The tests use dev-impersonation (not real auth); the seeded test account is marked `is_mock_persona=true` and resolved via `resolveSessionWithDevOverride`.

### 1.3 Expected cost

- **Free tier.** Supabase's free tier includes 2 projects × 500 MB database + 1 GB file storage + unmetered egress for development. A single Playwright-driven test run writes <10 MB. The free tier is sufficient for this scaffold.
- **If you exceed free-tier quotas** (unlikely for E2E tests, more likely if the project doubles as a staging env), billing moves to the Pro plan at ~$25/project/month. The plan here does not require Pro.
- **No external paid infrastructure.** No separate CDN, no Vercel project, no CI-side costs beyond the GitHub Actions minutes you may later choose to spend running the suite.

### 1.4 Migrations to apply

Apply migrations `001` through `238`, in filename order, from `nex-supabase/migrations/`. **234 migrations total** in that range.

**Explicitly SKIP:**
- `239_nex_product_category_reference.sql` — DRAFT, not yet applied in production (CLAUDE.md §5 gate). The scaffold's test spec does not require 239 because the category registry resolves client-side; a published product without `department_id`/`category_id` columns still writes successfully.
- `999_WIP_add_canonical_business_id_to_nex_business.sql` — deliberately unapplied WIP.

**How to apply** (owner's choice):

Option A — hand-apply via Supabase SQL editor:
- Open each migration file, paste into the SQL editor, run. Order matters; apply 001, 002, 003… strictly in sequence.

Option B — reuse existing applier scripts under `scripts/`:
- `apply-migration-NNN.mjs` scripts exist for 212, 215, 220, 221, 223, 224, 237, 238.
- They read `DATABASE_URL` and check for the production project ref `ijvqdvsvwtwxzcqmoqit`. For the test project, you'd need either:
  - A new wrapper script that walks every migration in order, OR
  - A one-off `psql` invocation: `psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f nex-supabase/migrations/001_nex_migration_history_and_account.sql` repeated per file.

Option C — I can write a disposable applier script (gated — ask first). It would require per-migration schema diff awareness because a handful of the 234 migrations include DDL that only idempotently applies to a greenfield DB; others assume prior data state.

### 1.5 Env vars to export after provisioning

| Env var | Source | Purpose |
|---|---|---|
| `TEST_SUPABASE_URL` | 1.2 → Project URL | Supabase REST endpoint the test spec hits via the running Next.js dev server. |
| `TEST_SUPABASE_SERVICE_ROLE_KEY` | 1.2 → service_role | Seed script writes to seed the account + business. |
| `TEST_DATABASE_URL` | 1.2 → Direct connection | Direct Postgres connection for the seed script. |
| `TEST_SELLER_ACCOUNT_ID` | Output of §2 seed script | UUID of the seeded `nex_account`. |
| `TEST_BUSINESS_ID` | Output of §2 seed script | UUID of the seeded `nex_business`. |
| `TEST_BUSINESS_SLUG` | Output of §2 seed script | Slug of the seeded business (for shop-detail-page assertions). |
| `PLAYWRIGHT_TEST_BASE_URL` | *(optional)* | Overrides `http://localhost:3008` if you run the dev server on a different port. |

For local dev the convention is to write these into `.env.test.local` and load via `--env-file`. CI secrets management is a separate decision (§5 of your last instruction).

### 1.6 Test data seed

Run `scripts/seed-test-env-e2e.mjs` (added by this commit) after provisioning. The script:
- **Refuses to run** if `TEST_SUPABASE_URL` or `TEST_DATABASE_URL` contains the production project ref `ijvqdvsvwtwxzcqmoqit`.
- Creates one `nex_account` with `is_mock_persona=true`, `tier=bisnis` (so Live eligibility passes), and a stable email (`e2e-seller@test.nex.local`).
- Creates one `nex_business` owned by that account with a stable slug (`e2e-test-shop`).
- Prints the three UUIDs/slug to stdout so you can export them.

The script is idempotent — re-running it is safe (either returns the existing seed row IDs or inserts fresh ones based on the stable email/slug).

---

## 2 · Seed script

See `scripts/seed-test-env-e2e.mjs` in the same commit as this README. Snapshot of its safety posture:

```js
const PROD_SIGIL = "ijvqdvsvwtwxzcqmoqit";
if (TEST_SUPABASE_URL.includes(PROD_SIGIL) || TEST_DATABASE_URL.includes(PROD_SIGIL)) {
  console.error("REFUSED: test env URL contains production project ref. Aborting.");
  process.exit(2);
}
```

**You must not point this script at production under any circumstances.** The production sigil check is a last-resort guard; the primary safety is that the test project has its own URL/key pair.

---

## 3 · Running

```sh
# server must be running on port 3008 (next dev)
# TEST_* env vars must be exported
npm run test:product-upload
```

Also wired as:
```sh
npx playwright test --config=playwright.product-upload.config.ts
```

## 4 · Test posture

Spec files are **skip-safe**: when `TEST_*` env vars are missing each test calls `test.skip()` with an explicit reason, so landing this scaffold does not break existing CI.

## 5 · Dev-impersonation auth

Playwright does not drive the WebAuthn / face-unlock sign-in path. The test spec expects a dev-impersonation cookie set by a fixtures module (next PR after the test project is live). The cookie-name + payload shape is sealed in `src/lib/nex-native/app/dev-impersonation.ts`; the fixtures PR will mint the cookie against the seeded test account and attach it to the Playwright `page.context()`.

## 6 · Expanded coverage (owner-approved, follow-up PR after seed is live)

Owner expanded the test beyond create → publish → verify to cover:

- Create product (text fields, substrates).
- Configure delivery, identity, wholesale, returns, colours, cover video.
- Upload and display images.
- Publish.
- Edit and verify persistence of every substrate.
- Mark sold out / mark available.
- Archive and restore.
- Validation failures (bad hex, >30s video, >60MB file, bad ISO, invalid delivery day range).
- Unauthorised business access (sign in as account A, attempt to upload for business owned by account B — expect 403).

Each of these becomes a separate `*.spec.ts` in `tests/e2e-product-upload/`, all under the same `playwright.product-upload.config.ts`. They are gated behind the same `TEST_*` env check so the suite stays skip-safe until provisioning completes.

## 7 · What this scaffold does NOT do

- Does not provision the dedicated test Supabase project (owner action).
- Does not include the dev-impersonation fixtures module (follow-up PR).
- Does not configure CI (reported separately per your §5).
- Does not apply migrations (CLAUDE.md §5 gate).
- Does not add Playwright or browsers (both already in the repo).
