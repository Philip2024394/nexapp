# Cloudflare Pages · env-var inventory · DRAFT 2026-11-21

Scope: enumerate every `process.env.*` read in the nexapp runtime and
classify each for the Cloudflare Pages cut-over. Secrets listed here
are NAMES ONLY. No values. Do not paste values into this repo.

Three buckets:

- **LAUNCH-CRITICAL** — must be set on Cloudflare before the first
  successful build, or runtime will 500 at the affected surface.
- **PROVIDER-SPECIFIC** — currently set on Vercel but either (a)
  replaced by Cloudflare equivalent or (b) retired at cleanup.
- **DEV-ONLY / LEGACY** — do NOT carry over.

## LAUNCH-CRITICAL · set on Cloudflare Pages (Production + Preview)

### Supabase (sealed project `ijvqdvsvwtwxzcqmoqit`)

```
NEXT_PUBLIC_NEX_SUPABASE_URL
NEX_SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY     # if read client-side
DATABASE_URL                           # pooler DSN, used by server routes
NEX_POSTGRES_URL                       # planned rename of DATABASE_URL
```

> Rule from CLAUDE.md §8: these MUST point at `ijvqdvsvwtwxzcqmoqit`
> for production, `kdstoyyeygcopkogqsyv` for sandbox / preview. Never
> set a preview env var to a prod key or vice versa.

### App identity

```
NEXT_PUBLIC_SITE_URL         # https://nexcorner.com in prod
NEX_SITE_URL                 # server-side canonical origin
NEXT_PUBLIC_APP_ENV          # "production" | "preview" | "development"
```

### Cron authentication (used by the dispatcher Worker)

```
NEX_HARVEST_CRON_SECRET
NEX_BILLING_CRON_SECRET
NEX_CRON_SECRET              # security-audit reconcile
```

> Also set on the cron-dispatcher Worker (see `wrangler.crons.toml`).
> Same values on both sides; the Worker sends them as the
> `Authorization: Bearer <secret>` header, the Pages route verifies.

### Stripe (currently gated OFF, surface still reads env at import)

```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

> Per 2026-11-08 sealing, Stripe live mode is NOT authorised yet.
> Keep these as TEST keys on preview, and leave PRODUCTION values
> blank until "connect stripe" word-trigger. The code tolerates
> absent keys (feature flagged).

### Brevo (email · replaces nodemailer)

```
NEX_DELIVERY_BREVO_API_KEY        # primary · read first by brevo.ts adapter
BREVO_API_KEY                      # legacy fallback name · same value acceptable
NEX_EMAIL_DEFAULT_FROM             # sender address fallback
BREVO_FROM_EMAIL                   # legacy alternate, optional
BREVO_FROM_NAME                    # legacy alternate, optional
```

> The Brevo adapter at `src/lib/nex/email/adapters/brevo.ts` already
> exists (native fetch, Workers-compatible). What's gated is the
> runtime switchover — see `NEX_EMAIL_RUNTIME` below.

### Cut-over feature flags · SEALED 2026-11-22

Added by `02-SEALED-DECISIONS.md` to let Cloudflare Pages preview come
up green while Node-native code paths stay dark until each one is
verified.

```
NEX_EMAIL_RUNTIME                  # "nodemailer" (current) | "brevo" (Cloudflare)
NEX_VIDEO_PROBE_ENABLED            # "true" | "false" · ffprobe path
NEX_OCR_ENABLED                    # "true" | "false" · tesseract.js path
```

| Flag | Vercel prod | CF Pages preview | CF Pages prod (initial) |
|---|---|---|---|
| `NEX_EMAIL_RUNTIME` | unset (= nodemailer) | `brevo` | `brevo` |
| `NEX_VIDEO_PROBE_ENABLED` | unset (= true) | `false` | `false` until probe passes |
| `NEX_OCR_ENABLED` | unset (= true) | `false` | `false` until bundle fits |

### LLM / observability (optional at runtime)

```
OPENAI_API_KEY                  # LLM wrappers under src/lib/llm/
ANTHROPIC_API_KEY               # if present
NEX_OBSERVABILITY_DSN           # optional
```

## PROVIDER-SPECIFIC · DO NOT carry over

These are set on Vercel today. Either Cloudflare provides them
automatically, or they are no longer needed.

| Vercel var | Replace with | Notes |
|---|---|---|
| `VERCEL_URL` | `CF_PAGES_URL` | Cloudflare sets this automatically on Pages |
| `VERCEL_ENV` | `CF_PAGES_BRANCH` / custom `NEXT_PUBLIC_APP_ENV` | choose one convention |
| `VERCEL_GIT_COMMIT_SHA` | `CF_PAGES_COMMIT_SHA` | Cloudflare sets this automatically |
| `VERCEL_PROJECT_ID` | — | **drop** |
| `VERCEL_ORG_ID` | — | **drop** |
| any `NEXT_PUBLIC_VERCEL_*` | — | **drop** |

Code audit action (NOT executed here, added to `cleanup.md`): grep
`src/` for `process.env.VERCEL_` reads and either replace with
`CF_PAGES_*` or make them optional with a sensible fallback. Any
hard-fail on missing `VERCEL_*` is a launch blocker.

## DEV-ONLY / LEGACY · DO NOT carry over

```
NEX_DEV_IMPERSONATION_ENABLED       # false in prod, strictly dev convenience
NEX_DEV_FORCE_USER_ID               # sandbox impersonation
PLAYWRIGHT_BASE_URL                 # test runner only
CI                                  # set automatically by CI
```

## Unknown / audit pending

The forensic scope doc counted **334 unique** `process.env.*` reads.
This document enumerates the launch-critical subset. Before first
Pages build, run:

```bash
# proposed audit command (do not run in prod CI yet)
rg -no --no-heading -I "process\.env\.[A-Z_][A-Z0-9_]+" src/ \
  | awk -F'process.env.' '{print $2}' \
  | awk -F'[^A-Z0-9_]' '{print $1}' \
  | sort -u > /tmp/nexapp-env-names.txt
```

Compare the output against the Cloudflare Pages Variables panel.
Anything on the file that isn't in the panel and isn't in the
"DEV-ONLY" bucket above is a candidate launch blocker — triage before
flipping DNS.

## Encryption at rest

Cloudflare Pages env vars are encrypted at rest. Mark anything that
is a secret (not a public key, not a URL) as **Encrypted** in the
dashboard. The `NEXT_PUBLIC_*` prefix convention still applies — vars
with that prefix are bundled into the client JS and MUST be treated
as public.
