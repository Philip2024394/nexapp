# NEX Product Upload · E2E tests

Owner-authorised 2026-10-31 (Product Upload World-Class brief · Technical Point 3 "real interaction testing"). Playwright scaffold for browser-based end-to-end tests against the product-upload journey.

## Running

```sh
# server must be running on port 3008 (next dev)
npx playwright test --config=playwright.product-upload.config.ts
```

Also wired as `npm run test:product-upload`.

## Test posture

The spec files are **skip-safe**. Each test calls `test.skip()` when the required test-environment variables are missing, so landing this scaffold does not break existing CI.

## Required environment (dedicated test Supabase project)

Owner selected 2026-10-31: "Playwright + dedicated test Supabase project". The spec expects these env vars set when it runs:

| Env var | What it points at | How to seed |
|---|---|---|
| `TEST_SUPABASE_URL` | The URL of the dedicated **test** Supabase project (NOT production, NOT `ijvqdvsvwtwxzcqmoqit`). | Create a second Supabase project in the dashboard. |
| `TEST_SUPABASE_SERVICE_ROLE_KEY` | Service-role key of the same project. | Dashboard → Settings → API. |
| `TEST_SELLER_ACCOUNT_ID` | UUID of a seeded `nex_account` with `is_mock_persona=true`. | Seed via a one-off script before CI runs (future PR). |
| `TEST_BUSINESS_ID` | UUID of a `nex_business` row owned by the seeded account. | Same seed script. |
| `TEST_BUSINESS_SLUG` | Human-readable slug of that business. | Same seed script. |
| `PLAYWRIGHT_TEST_BASE_URL` | *(optional)* Override of the default `http://localhost:3008`. | Only when running against a different port. |

## Provisioning checklist (owner action)

1. Create a new Supabase project in the dashboard. Note its URL + service-role key.
2. Apply every migration under `nex-supabase/migrations/` to the new project (same ordering as production). This includes the already-applied set + the DRAFT migrations when they are approved.
3. Seed one `nex_account` + one `nex_business` + mark the account `is_mock_persona=true` so `resolveSessionWithDevOverride` recognises it.
4. Export the four `TEST_*` env vars locally (or add them to your CI secrets).
5. Run `npx playwright test --config=playwright.product-upload.config.ts`.

Until step 4 is done the spec will log the skip reason and pass without executing.

## Dev-impersonation auth

Playwright does not drive the WebAuthn / face-unlock sign-in path. The spec expects a dev-impersonation cookie set by a fixtures module (`tests/e2e-product-upload/fixtures/dev-session.ts` — not in this scaffold). The exact cookie-name + payload shape is sealed in `src/lib/nex-native/app/dev-impersonation.ts`; the fixtures PR will mint the cookie against the seeded test account and attach it to the Playwright `page.context()`.

This matches the sealed pattern used by other NEX Playwright configs (chat-responsive, bio-link-auth) where the authenticated journey is deferred to a follow-up PR after the auth-fixture gap is addressed.

## Coverage (first pass · owner-selected)

- [x] `create-publish-verify.spec.ts` — Create → publish → verify in shop

Future journeys (not in this PR, per owner's single-pick first pass):
- Edit → reload persistence (all substrates)
- Archive → restore cycle
- Variant sync safety · markets · returns overlay (combined adversarial)

## What this scaffold does NOT do

- Does not provision the dedicated test Supabase project (owner action).
- Does not include the dev-impersonation fixtures module (follow-up PR).
- Does not configure CI to run these tests on push (owner's CI-config decision).
- Does not add Playwright or browsers (both already in the repo).
