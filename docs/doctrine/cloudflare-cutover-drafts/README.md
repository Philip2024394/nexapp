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

> **2026-11-22 Workers reconciliation.** The 2026-11-22 Gate 2 revision
> switches the target from Pages to Workers via
> `@opennextjs/cloudflare@1.20.11`. The mechanics below have been
> updated accordingly. The `pages-build-settings.md` / `wrangler.crons.toml`
> / `crons-worker.ts` files in this directory were drafted against the
> original Pages path and are retained as historical reference — a
> Workers-shaped equivalent (likely a single `wrangler.jsonc` with a
> `triggers.crons` block + `scheduled()` export in the main Worker) is
> the proposed replacement, pending separate ratification.

Order matters — each step is reversible up to step 6.

1. **Provision Cloudflare Workers project** `nexapp` pointed at
   `Philip2024394/nexapp` · production branch `main` · deploy via
   `wrangler deploy` after `npx opennextjs-cloudflare build` succeeds
   (either locally with Windows Developer Mode enabled, or from GitHub
   Actions CI).
2. **Mirror env vars** per `env-vars.md` — secrets via
   `wrangler secret put <NAME>`, non-secret config via `[vars]` in
   `wrangler.jsonc`. Production and preview environments configured
   separately.
3. **Deploy to a preview URL** (`<something>.<account>.workers.dev`)
   and smoke-test against the live sealed Supabase (reads only; do not
   run any destructive admin surfaces). Verify:
   - sign-in loads, `/nex-native/free-chat` loads for guest,
     notifications drawer guest container renders,
     `/nex-native/call-centre` shows auth-gate banner,
     shop pages render inside phone-frame.
   - A single Brevo send end-to-end (sandbox mailbox, not prod recipient).
4. **Enable Workers Cron Triggers** on the main `nexapp` Worker via the
   `triggers.crons` block in `wrangler.jsonc` and a `scheduled()` export
   that dispatches to the existing Next.js cron handler routes (harvest
   / tick · billing reconcile · security-audit reconcile). On Workers,
   Cron Triggers live on the same Worker as `fetch` — no separate
   dispatcher Worker is required. The `wrangler.crons.toml` /
   `crons-worker.ts` files in this directory remain as historical
   reference from the original Pages draft.
5. **Observe one full cron cycle** (hourly harvest + 15-min billing +
   10-min security-audit) firing from the Worker's scheduled handler.
   Check HQ incidents for new entries.
6. **Flip DNS** · point `nexcorner.com` + `www.nexcorner.com` to the
   Workers custom-domain or route binding. This is the only step that
   touches live user traffic.
7. **Promote preview env to production env** · re-run `wrangler deploy`
   against the production env defined in `wrangler.jsonc`, then verify
   the live custom-domain route resolves to the new Worker (look for
   `cf-ray` header, absence of `x-vercel-id`).
8. **Observe 24h** · HQ incidents, Supabase logs, Cloudflare analytics,
   Brevo delivery.
9. **Decommission Vercel** per `cleanup.md`.

## File inventory

| File | Purpose |
|---|---|
| `README.md` | this file |
| `01-TOKEN-SETUP.md` | Gate 1 · owner clickpath + verify curl |
| `02-SEALED-DECISIONS.md` | Gate 2 + Gate 3 · sealed per-dep dispositions |
| `pages-build-settings.md` | ⚠️ HISTORICAL · original Pages dashboard settings · superseded 2026-11-22 by `wrangler.jsonc` at repo root |
| `env-vars.md` | env variable inventory · what to set on Cloudflare Workers, what to NOT carry over |
| `wrangler.crons.toml` | ⚠️ HISTORICAL · original separate-Worker cron dispatcher config · superseded 2026-11-22 (see step 4 above — Workers Cron Triggers live on the main Worker) |
| `crons-worker.ts` | ⚠️ HISTORICAL · handler code for the original separate cron dispatcher · superseded 2026-11-22 |
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
