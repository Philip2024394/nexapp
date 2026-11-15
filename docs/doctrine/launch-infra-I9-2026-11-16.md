# I9 · Public site URL · regional env-var reconciliation

**Author:** Stream C · 2026-11-16
**Scope:** Document-only. No code changes. No prod access.
**Related:** .env.example lines 150-178, src/lib/nex-native/seo/site-url-resolver.ts

---

## Current state (evidence)

The codebase currently reads the following env names under the "public app URL" concept:

| Env name                     | Consumer                                                              | Required? |
| ---------------------------- | --------------------------------------------------------------------- | --------- |
| `NEX_PUBLIC_SITE_URL_IE`     | src/lib/nex-native/seo/site-url-resolver.ts (Ireland country branch)  | Yes if Ireland ships |
| `NEX_PUBLIC_SITE_URL_WW`     | src/lib/nex-native/seo/site-url-resolver.ts (Worldwide + Indonesia)   | Yes if WW/ID ships |
| `NEXT_PUBLIC_APP_BASE_URL`   | documented canonical name in .env.example (used broadly for metadata) | Yes |
| `NEXT_PUBLIC_BASE_URL`       | alternate alias found in source                                       | Optional |
| `NEXT_PUBLIC_NEX_BASE_URL`   | alternate alias found in source                                       | Optional |
| `NEXT_PUBLIC_SITE_URL`       | alternate alias (no regional suffix)                                  | Optional |
| `NEX_PUBLIC_APP_BASE_URL`    | server-only mirror                                                    | Optional |
| `NEX_PUBLIC_BASE_URL`        | server-only mirror                                                    | Optional |

Confirmed by `grep -rn "NEX_PUBLIC_SITE_URL" src/`:

- `src/lib/nex-native/seo/site-url-resolver.ts` lines 74, 81 branch on
  `NEX_PUBLIC_SITE_URL_IE` for Ireland and `NEX_PUBLIC_SITE_URL_WW`
  for Worldwide/Indonesia. Production throws when the country's env
  is unset or resolves to localhost.
- `src/app/nex-native/profile/[handle]/__tests__/profile-json-ld.test.tsx`
  references `NEX_PUBLIC_SITE_URL_IE` and `NEX_PUBLIC_SITE_URL_WW` as
  the canonical names.
- `src/app/nex-native/layout.tsx` line 100 comment names
  `NEX_PUBLIC_SITE_URL_IE / _WW` as the canonical pair.

**Observation:** Sealed Scope Reduction 2026-11-06 ships v1 with
chat + themes + shop (bundles vault) + community notice in launch
markets **USD + GBP + IDR + EUR only (core four)**. A separate
UK-branch env is NOT read anywhere in current src; UK pricing is a
currency concern not a URL concern. Same for US and ID — the URL
resolver splits only `_IE` vs `_WW`.

## Required state

For a production deployment to succeed and not throw at request time:

### Required (one must be set depending on the deployed country):

- `NEX_PUBLIC_SITE_URL_IE` — set when `NEX_APP_IDENTITY=ireland`
- `NEX_PUBLIC_SITE_URL_WW` — set when `NEX_APP_IDENTITY=worldwide`
  OR when `NEX_APP_IDENTITY=indonesia` (resolver falls back to WW
  for Indonesia · the owner can provision a dedicated `_ID` later)

### Also required (broader metadata consumer):

- `NEXT_PUBLIC_APP_BASE_URL` — recommended canonical. .env.example
  line 167 already names it.

### Not required for v1 (per Scope Reduction 2026-11-06):

- `NEX_PUBLIC_SITE_URL_UK` — not read in src/
- `NEX_PUBLIC_SITE_URL_US` — not read in src/
- `NEX_PUBLIC_SITE_URL_ID` — not read in src/ (resolver falls back
  to `_WW` for Indonesia). Provisioning one would require editing
  `site-url-resolver.ts` first · out of scope for I9 which is
  env-prep only.

## Owner action

1. Decide which regions actually ship v1 among {IE, WW, ID}. Scope
   Reduction says all three are in-scope but that's a ship-list
   decision, not a code-read decision.
2. In Vercel production scope (prod project with repo
   `Philip2024394/nexapp` on branch `main` · verify FIRST):
   - Set `NEX_PUBLIC_SITE_URL_IE` to the Ireland production origin
     (e.g. `https://nex.app` or the chosen apex).
   - Set `NEX_PUBLIC_SITE_URL_WW` to the Worldwide production origin.
   - Set `NEXT_PUBLIC_APP_BASE_URL` to the same value the request's
     Host header will present (country-dependent · Vercel can emit
     per-environment values).
3. Leave UK + US + dedicated ID unset until src is extended to read
   them. Do NOT set them "just in case" — unused env vars waste a
   Vercel slot and confuse future maintainers.

## Validation command

After owner sets the env values in Vercel prod scope, the following
local checks confirm the resolver treats them correctly:

```bash
# Dev-only sanity check (no prod access required).
# Confirms the resolver refuses localhost in production mode
# and accepts a valid HTTPS URL. Does NOT exercise Vercel.

cd C:/Users/Victus/nexapp
NODE_ENV=production \
NEX_APP_IDENTITY=ireland \
NEX_PUBLIC_SITE_URL_IE=https://example-prod.nex.app \
node -e "console.log(require('./src/lib/nex-native/seo/site-url-resolver').resolveSiteUrl().url)"
```

Expected output: `https://example-prod.nex.app`.

Running the same with `NEX_PUBLIC_SITE_URL_IE=http://localhost:3008`
should throw (per the resolver's prod safety rule, lines 17-21 in
site-url-resolver.ts).

## What is NOT done here

- `.env.example` is updated by this cycle's env-example pass (see
  separate commit): add explicit comments calling out that IE + WW
  are REQUIRED for a prod build, UK/US/ID aliases are NOT YET read.
- No Vercel dashboard change. That is the owner's call.
- No code change to `site-url-resolver.ts`.
