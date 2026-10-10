# Vercel setup

Minimum steps to deploy `nexapp` to Vercel.

## 1 · npm install

A `.npmrc` with `legacy-peer-deps=true` is committed to the repo root.
Vercel will respect it automatically — no `install command` override
needed. The flag works around `@imgly/background-removal` pinning
`onnxruntime-web@1.21.0` while the rest of the project is on
`^1.27.0`.

## 2 · Required environment variables

Set these in the Vercel dashboard under **Project → Settings →
Environment Variables**. All should be `Production + Preview +
Development` unless noted. Copy values from your local `.env.local`.

### Must-have (app will not boot without these)

```
NEX_SUPABASE_URL                        — https://ijvqdvsvwtwxzcqmoqit.supabase.co
NEXT_PUBLIC_NEX_SUPABASE_URL            — same as above (client bundle)
NEX_SUPABASE_SERVICE_ROLE_KEY           — server-only, do NOT prefix NEXT_PUBLIC
NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY       — safe for client bundle
NEX_BRAIN_BACKEND                       — "postgres"
NEX_POSTGRES_URL                        — see §4 — localhost will NOT work on Vercel
NEX_PUBLIC_URL                          — https://<your-vercel-domain>.vercel.app
NEXT_PUBLIC_NEX_BASE_URL                — same as NEX_PUBLIC_URL
NEX_SESSION_SECRET                      — long random string
```

### Auth / sign-in surfaces

```
NEX_WEBAUTHN_RP_ID                      — your production host, no scheme (e.g. nexapp.vercel.app)
NEX_WEBAUTHN_RP_NAME                    — "NEX"
NEX_WEBAUTHN_ORIGIN                     — https://<your-vercel-domain>.vercel.app
NEX_FINGERPRINT_SALT_ACTIVE             — random 32-byte base64
NEX_FINGERPRINT_SALT_ACCEPTED           — same or previous rotation
NEX_SESSION_SIGNING_KEY_ACTIVE          — random 32-byte base64
NEX_SESSION_SIGNING_KEY_ACCEPTED        — same or previous rotation
```

### Delivery / notifications

```
RESEND_API_KEY                          — for transactional email (optional)
```

### Dev-admin unlock (do NOT set in production)

```
NEX_ALLOW_DEV_ADMIN=1                   — only in Preview or Development
```

### Session cookie (optional)

```
NEX_SESSION_COOKIE_DOMAIN
NEX_SESSION_COOKIE_PATH
```

## 3 · Variables you can SKIP

Your local `.env.local` has ~111 entries. Many are legacy or dev-only
and are NOT needed in production:

- `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  — legacy xratedtrade-era project. The DNS no longer resolves. Omit.
- `NEX_LLM_RESCUE*` — only used by `live-chat-completion/local-only.ts`,
  which is dormant in the NEX intelligence path (`NEX_BRAIN_BACKEND=postgres`).
  Safe to omit.
- `NEX_PROGRAMMER_*_DIR`, `NEX_SANDBOX_PYTHON_EXE`, local path configs
  — Victus-machine specific.
- `TRADE_OTP_SECRET`, `HOMEOWNER_*`, `STRIPE_*`, `NEX_LAB_*`,
  `XRATED_VAPID_*` — legacy multi-product env, not used by the NEX
  surface tree in this fork.

## 4 · The NEX_POSTGRES_URL blocker

`localhost` won't work on Vercel. The local `nex_dev` Postgres (which
holds the 22,186-row canonical directory + 35,909-row verticals) must
be migrated to a cloud Postgres before the `/nex-native/search`
landing + DISCOVER + country picker will work in production.

Three sensible targets:
- **Neon** (`https://neon.tech`) — serverless Postgres, generous free tier
- **Supabase** — add a second project (keep NEX project separate), use
  its `postgres://` DSN as `NEX_POSTGRES_URL`
- **Railway** or **Fly.io** — pay-as-you-go, straightforward dump+restore

Workflow once you've picked a provider:

```bash
# Dump local nex_dev (full)
"C:/Program Files/PostgreSQL/18/bin/pg_dump" \
  --format=custom \
  --no-owner --no-privileges \
  --dbname "<local-postgres-url>" \
  --file nex_dev.dump

# Restore to cloud
"C:/Program Files/PostgreSQL/18/bin/pg_restore" \
  --no-owner --no-privileges \
  --dbname "<cloud-postgres-url>" \
  nex_dev.dump
```

Then set `NEX_POSTGRES_URL` in Vercel to the cloud URL.

Until this is done, `/nex-native/search` landing will throw at runtime
on Vercel (search page uses `local-directory-service.ts`). Other
surfaces (home, sign-in, chat, vault, themes, auth) work independently
of local Postgres.

## 5 · Build command / output

Vercel auto-detects Next.js:
- Build: `next build`
- Output: `.next/`
- Node version: 20.x or newer (uses `turbopack`, Next 16.3.8)

No `vercel.json` required.

## 6 · Known advisories (non-blocking)

- Deprecated: `middleware.ts` convention replaced by `proxy.ts` in Next
  17 — this is a warning in dev, not a fatal error.
- Service worker file `/nex-native-sw.js` 404s if the browser requests
  it. Harmless — the register call is in `_push-subscribe-hub.tsx` and
  the client falls through on 404.
