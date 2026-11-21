# Cloudflare cut-over · prep drafts · 2026-11-21

Companion to `docs/doctrine/cloudflare-brevo-migration-scope-2026-11-21.md`
(the forensic scope doc). This folder holds **drafts only** — nothing in
here has been applied to Cloudflare, Vercel, DNS, or the repo runtime
config. No `wrangler.toml` at repo root. No `package.json` edits. No
deletions.

Owner direction sealed 2026-11-21:

> "i want the app hosted on cloudflare - delete vercel we dont require .
> and updates live on nexcorner,com"

Executed in a safe order, not immediately.

## Why drafts, not execution

The Vercel origin is still serving the live site (confirmed via
`x-vercel-id` / `x-vercel-cache` response headers on `www.nexcorner.com`).
Deleting Vercel before Cloudflare is green would create an outage.

Three gates still CLOSED before execution:

1. **Valid Cloudflare API token** — the `cfat_...` string supplied
   earlier is a Cloudflare Access (Zero Trust) credential, not an API
   token. `GET /user/tokens/verify` returned `{"code":1000,"Invalid API
   Token"}`. Needs a real API token from
   `dash.cloudflare.com → My Profile → API Tokens → Create Token`
   with these scopes (minimum):
   - Account · Cloudflare Pages · Edit
   - Account · Workers Scripts · Edit
   - Account · Account Settings · Read
   - Zone · DNS · Edit (for `nexcorner.com`)
   - Zone · Zone · Read
2. **Pages vs Workers decision** — recommendation below is Pages.
   Owner hasn't picked yet.
3. **Node-native dep disposition** — 7 deps currently prevent a pure
   Workers deploy. Pages gives more room here. See `env-vars.md` + the
   Cloudflare scope doc §6 for the enumeration.

## Chosen architecture (recommended, not approved)

| Piece | Choice | Why |
|---|---|---|
| App hosting | **Cloudflare Pages** via `@cloudflare/next-on-pages` | Pages has longer CPU limits + larger bundle allowance than Workers; closer to the Next.js 16 feature set the app already uses. |
| Cron jobs | **Separate Cloudflare Worker** with 3 Cron Triggers, each doing `fetch(PAGES_ORIGIN + cronHandlerPath, { headers: { Authorization } })` | Keeps the 3 existing HTTP cron handlers in `src/app/api/nex-native/.../cron/*/route.ts` unchanged. The Worker is a thin dispatcher. |
| DNS | Cloudflare (already proxying `nexcorner.com`) | Zone already added by owner. |
| Email | Brevo HTTPS API | Replaces `nodemailer` SMTP (Workers-incompatible). Separate workstream — not in this folder. |
| Analytics | Cloudflare Web Analytics | Replaces `@vercel/analytics` + `@vercel/speed-insights` (both at 0 imports today — safe to drop at cleanup). |

## Execution checklist (DO NOT RUN until all three gates open)

Order matters — each step is reversible up to step 6.

1. **Provision Cloudflare Pages project** pointed at
   `Philip2024394/nexapp` · production branch `main` · build settings
   from `pages-build-settings.md`.
2. **Mirror env vars** onto the Pages project per `env-vars.md`
   (production and preview sets separately).
3. **Deploy to a preview URL** (`<something>.pages.dev`) and smoke-test
   against the live sealed Supabase (reads only; do not run any
   destructive admin surfaces). Verify:
   - sign-in loads, `/nex-native/free-chat` loads for guest,
     notifications drawer guest container renders,
     `/nex-native/call-centre` shows auth-gate banner,
     shop pages render inside phone-frame.
   - A single Brevo send end-to-end (sandbox mailbox, not prod recipient).
4. **Provision the crons Worker** from `wrangler.crons.toml` +
   `crons-worker.ts`. Set `PAGES_ORIGIN` to the `*.pages.dev` URL first,
   not the apex domain, so DNS flip is a separate step.
5. **Observe one full cron cycle** (hourly harvest + 15-min billing +
   10-min security-audit) hitting the Pages origin. Check HQ incidents
   for new entries.
6. **Flip DNS** · point `nexcorner.com` + `www.nexcorner.com` to Pages
   (CNAME to `*.pages.dev` or Pages custom-domain flow). This is the
   only step that touches live user traffic.
7. **Flip crons Worker** · update `PAGES_ORIGIN` from `*.pages.dev` to
   `https://nexcorner.com` and redeploy.
8. **Observe 24h** · HQ incidents, Supabase logs, Cloudflare analytics,
   Brevo delivery.
9. **Decommission Vercel** per `cleanup.md`.

## File inventory

| File | Purpose |
|---|---|
| `README.md` | this file |
| `pages-build-settings.md` | the exact Pages project settings to enter in the dashboard |
| `env-vars.md` | env variable inventory · what to set on Cloudflare, what to NOT carry over |
| `wrangler.crons.toml` | config for the cron-dispatcher Worker |
| `crons-worker.ts` | handler code for the cron-dispatcher Worker |
| `cleanup.md` | post-cutover deletion list, ordered to avoid outages |

## Not in scope here

- Brevo API wiring (`nodemailer` replacement) — separate doctrine doc.
- Supabase migration — none required. Backend stays on
  `ijvqdvsvwtwxzcqmoqit`.
- Repo restructure — none required. `@cloudflare/next-on-pages`
  consumes the standard Next.js build output; no repo layout change.
- Any touch to `D:/trades` — nexapp is a standalone repo
  (`Philip2024394/nexapp.git`), unrelated to the `D:/trades` product
  line.
