# Cloudflare Workers · env-var inventory · DRAFT 2026-11-22

> **2026-11-22 Workers reconciliation.** This file was drafted
> against Cloudflare Pages on 2026-11-21. The 2026-11-22 Gate 2
> revision switches the target to Cloudflare Workers (via
> `@opennextjs/cloudflare@1.20.11`, Next 16.3.8 peer-compatible).
> Pages-specific terminology has been reconciled below. Notably,
> Workers does NOT auto-inject `CF_PAGES_URL` / `CF_PAGES_BRANCH` /
> `CF_PAGES_COMMIT_SHA` — see §PROVIDER-SPECIFIC for the replacement
> contract.

Scope: enumerate every `process.env.*` read in the nexapp runtime and
classify each for the Cloudflare Workers cut-over. Secrets listed here
are NAMES ONLY. No values. Do not paste values into this repo.

Three buckets:

- **LAUNCH-CRITICAL** — must be set on Cloudflare before the first
  successful build, or runtime will 500 at the affected surface.
- **PROVIDER-SPECIFIC** — currently set on Vercel but either (a)
  replaced by Cloudflare equivalent or (b) retired at cleanup.
- **DEV-ONLY / LEGACY** — do NOT carry over.

## LAUNCH-CRITICAL · set on Cloudflare Workers (Production + Preview)

> On Workers, set these via `wrangler secret put <NAME>` for secrets
> and the `[vars]` block in `wrangler.jsonc` (or the Workers Variables
> and Secrets panel in the dashboard) for non-secret config. Preview
> environments use `wrangler.jsonc` `env.<name>` sections.

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

### Cron authentication (used by Workers Cron Triggers)

```
NEX_HARVEST_CRON_SECRET
NEX_BILLING_CRON_SECRET
NEX_CRON_SECRET              # security-audit reconcile
```

> Workers Cron Triggers invoke the same Worker (`nexapp`) via scheduled
> `fetch` against an internal cron handler path. Same secret values on
> both the trigger request builder (inside `scheduled()` export of the
> Worker) and the route handlers — same `Authorization: Bearer <secret>`
> contract that currently exists for Vercel cron dispatch, just
> originating from within the Worker instead of Vercel's cron runner.

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

Added by `02-SEALED-DECISIONS.md` to let Cloudflare Workers preview
come up green while Node-native code paths stay dark until each one is
verified. Implemented in `src/lib/nex-native/runtime-flags.ts` and
contract-locked by `src/lib/nex-native/__tests__/runtime-flags.test.ts`.

```
NEX_EMAIL_RUNTIME                  # "nodemailer" (current) | "brevo" (Cloudflare)
NEX_VIDEO_PROBE_ENABLED            # "true" | "false" · ffprobe path
NEX_OCR_ENABLED                    # "true" | "false" · tesseract.js path
```

| Flag | Vercel prod | CF Workers preview | CF Workers prod (initial) |
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

These are set on Vercel today. Workers does NOT auto-inject hosting
metadata the way Vercel or Pages does — the cutover contract is to
either (a) set a custom env var manually in `wrangler.jsonc` / Workers
Variables panel, or (b) drop the read. The CF_PAGES_* names are listed
only because older `cleanup.md` wording referenced them; those names do
**not** exist on Workers.

| Vercel var | Replace with (Workers) | Notes |
|---|---|---|
| `VERCEL_URL` | `NEX_SITE_URL` / `NEXT_PUBLIC_SITE_URL` | set manually; no Workers auto-inject |
| `VERCEL_ENV` | `NEXT_PUBLIC_APP_ENV` | set per-environment in `wrangler.jsonc` |
| `VERCEL_GIT_COMMIT_SHA` | `NEX_GIT_COMMIT_SHA` | set by CI (GitHub Actions) at deploy time; no Workers auto-inject |
| `VERCEL_PROJECT_ID` | — | **drop** |
| `VERCEL_ORG_ID` | — | **drop** |
| any `NEXT_PUBLIC_VERCEL_*` | — | **drop** |

Code audit action (NOT executed here, listed in `cleanup.md` Stage 5):
grep `src/` for `process.env.VERCEL_` reads and either replace with the
Workers-contract equivalent above or make them optional with a sensible
fallback. Any hard-fail on missing `VERCEL_*` is a launch blocker.

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
Workers deploy, run:

```bash
# proposed audit command (do not run in prod CI yet)
rg -no --no-heading -I "process\.env\.[A-Z_][A-Z0-9_]+" src/ \
  | awk -F'process.env.' '{print $2}' \
  | awk -F'[^A-Z0-9_]' '{print $1}' \
  | sort -u > /tmp/nexapp-env-names.txt
```

Compare the output against the Workers Variables and Secrets panel
(or the `[vars]` / `wrangler secret list` output). Anything on the file
that isn't bound and isn't in the "DEV-ONLY" bucket above is a candidate
launch blocker — triage before flipping DNS.

## Encryption at rest

On Cloudflare Workers there are two bindings:

- **Secrets** (`wrangler secret put <NAME>`) — encrypted at rest; never
  returned in plaintext after upload; not visible in the dashboard
  value field.
- **Vars** (`[vars]` in `wrangler.jsonc`) — plaintext config committed
  to the deploy config; visible in the dashboard.

Anything that is a secret (API keys, service role keys, Stripe secret,
cron secrets, SMTP passwords) MUST be a secret binding — never a `[vars]`
entry. The `NEXT_PUBLIC_*` prefix convention still applies — vars with
that prefix are bundled into the client JS and MUST be treated as
public.
