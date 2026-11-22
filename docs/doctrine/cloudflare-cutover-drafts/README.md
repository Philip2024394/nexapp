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

Gate status after 2026-11-22 update:

1. **Cloudflare API token** · **OPEN ACTION ON OWNER** · full clickpath
   + verify curl in `01-TOKEN-SETUP.md`. Only the owner can issue this
   from their logged-in Cloudflare dashboard. The previously supplied
   `cfat_...` string is a Zero Trust credential, not an API token, and
   has been verified dead against `api.cloudflare.com/user/tokens/verify`.
2. **Pages vs Workers** · **SEALED → Workers via `@opennextjs/cloudflare`**
   · see `02-SEALED-DECISIONS.md` Gate 2 REVISED 2026-11-22. Reason:
   `@cloudflare/next-on-pages@latest` peer-requires Next ≤15.5.2 and
   nexapp runs Next 16.3.8. `@opennextjs/cloudflare@1.20.11` peerDep
   accepts the installed Next version as-is. Pinned adapter version;
   later adapter upgrades gated on a Next patch bump.
3. **Node-native dep disposition** · **SEALED per-dep** · see
   `02-SEALED-DECISIONS.md` Gate 3. `pg` KEEP · `nodemailer` route
   through existing Brevo adapter · `ffprobe-static`+`fluent-ffmpeg`
   gate behind `NEX_VIDEO_PROBE_ENABLED` · `tesseract.js` KEEP (already
   lazy-imported WASM) · `@imgly/background-removal`+`onnxruntime-web`
   uninstall at Stage 1 cleanup (zero live imports).

## Chosen architecture · SEALED 2026-11-22 (revised)

| Piece | Choice | Why |
|---|---|---|
| App hosting | **Cloudflare Workers** via `@opennextjs/cloudflare@1.20.11` + Workers Assets | OpenNext's Cloudflare adapter is the actively-maintained path per Cloudflare's own docs. `@cloudflare/next-on-pages` peer-requires Next ≤15.5.2; nexapp is on Next 16.3.8. Workers Assets covers static delivery; `nodejs_compat` + `global_fetch_strictly_public` flags cover `pg`, `Buffer`, `stream`. |
| Cron jobs | **Separate Cloudflare Worker** with 3 Cron Triggers, each doing `fetch(WORKER_ORIGIN + cronHandlerPath, { headers: { Authorization } })` | Keeps the 3 existing HTTP cron handlers in `src/app/api/nex-native/.../cron/*/route.ts` unchanged. The cron Worker is a thin dispatcher. |
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
| `01-TOKEN-SETUP.md` | Gate 1 · owner clickpath + verify curl |
| `02-SEALED-DECISIONS.md` | Gate 2 + Gate 3 · sealed per-dep dispositions |
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
