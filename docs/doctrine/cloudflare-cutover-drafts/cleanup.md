# Post-cutover cleanup · DRAFT 2026-11-21

Execute ONLY after step 8 of `README.md` — 24h observation on
Cloudflare has passed with no incidents, Brevo delivery is confirmed
end-to-end, and crons are visibly firing from the Worker.

**This file is a list of future deletions. Nothing is deleted now.**

Each item lists what to remove and why it is safe to remove at that
step. Order matters — remove the pieces that are definitely orphaned
first; keep the Vercel account open until the end so you can roll
back DNS if anything surfaces.

## Stage 1 · immediately safe (zero live references)

These dependencies are at **0 live imports** across `src/` today
(verified 2026-11-22 against both forensic audit + fresh grep). Remove
at any time.

| Target | Kind | Why safe |
|---|---|---|
| `@vercel/analytics` | dep in `package.json` | 0 imports |
| `@vercel/speed-insights` | dep in `package.json` | 0 imports |
| `@imgly/background-removal` | dep in `package.json` | 0 imports in `src/` |
| `onnxruntime-web` | dep in `package.json` | only a comment reference in `src/lib/nex-native/intelligence/models/qwen25-05b-instruct.ts`; model not reached at runtime |

Action:

```bash
# proposal, not executed
npm uninstall @vercel/analytics @vercel/speed-insights \
              @imgly/background-removal onnxruntime-web
```

Grep probes to re-verify before pulling the trigger (zero hits
required for each):

```bash
rg -n "@imgly/background-removal" src/
rg -n "onnxruntime-web" src/
```

## Stage 2 · safe once Brevo port lands

Blocked on the separate Brevo workstream. Do NOT remove `nodemailer`
until all `createTransport`/`sendMail` call sites have been ported
and are proven working against Brevo.

| Target | Kind | Why safe after Brevo port |
|---|---|---|
| `nodemailer` | dep in `package.json` | No remaining call sites · SMTP replaced by Brevo HTTPS |

## Stage 3 · safe once crons Worker is firing

Blocked on step 5 of the README checklist (observed one full cron
cycle). Only then is it safe to remove the Vercel cron definitions.

| Target | Kind | Why safe |
|---|---|---|
| `vercel.json` | file at repo root | Cloudflare Pages ignores it; crons now dispatched from the Worker |

Action:

```bash
git rm vercel.json
```

## Stage 4 · safe once DNS has been on Cloudflare for 24h with no incidents

The Vercel linkage artifacts in the repo. Removing these means the
Vercel CLI can no longer `vercel deploy` from this working tree. That
is the desired end state — the owner's directive is that Vercel is
retired.

| Target | Kind | Why safe |
|---|---|---|
| `.vercel/` | folder at repo root | Cached Vercel project linkage · nexapp lives on Pages now |
| `scripts/_tmp/vercel-*.mjs` | 3 ad-hoc Vercel scripts | Tied to Vercel CLI · no equivalent needed on Cloudflare |

Action:

```bash
# proposal, not executed
rm -rf .vercel
git rm scripts/_tmp/vercel-*.mjs
```

Note: `.vercel/` is in `.gitignore` already; the `rm -rf` is a local
cleanup, not a git operation.

## Stage 5 · codebase sweep (grep-driven, not blind delete)

The forensic audit noted an unknown number of `process.env.VERCEL_*`
reads in app code. These need a surgical sweep, not a mass delete.

```bash
# proposal · run and review, do not auto-rewrite
rg -n "process\.env\.VERCEL_" src/
rg -n "@vercel/" src/
rg -n "vercel\.app" src/
```

For each hit:

- If the reader has a sensible fallback already, replace
  `process.env.VERCEL_URL` with
  `process.env.CF_PAGES_URL ?? process.env.NEXT_PUBLIC_SITE_URL`.
- If the reader hard-fails on missing value, add a fallback instead
  of removing the read.
- Do NOT rewrite in a drive-by unrelated to an owner-approved task.

## Stage 6 · documentation sweep

Historical doctrine references Vercel. Do NOT silently rewrite — flag
and leave, per the 2026-11-20 memory seal:

> "Doctrine docs referencing Vercel become historical — do not rewrite
> silently."

Any doctrine update that touches these docs needs a dated banner noting
the Cloudflare supersession, not a find-and-replace.

Files known to reference Vercel (do not touch without approval):

- `CLAUDE.md` §5 (production deployment gate) — needs owner-approved
  revision to mention Cloudflare, retained wording about separate
  approval still in force
- `docs/doctrine/cloudflare-brevo-migration-scope-2026-11-21.md` —
  authoritative forward-plan; leave as-is, it already describes the
  transition
- Older doctrine files mentioning `vercel.json` scheduling — add a
  footer note pointing at `wrangler.crons.toml`

## Stage 7 · Vercel account

The last step. Once the repo has no Vercel linkage and DNS has been
on Cloudflare for ≥48h without incidents:

1. In the Vercel dashboard, pause (not delete) the `nex-ireland-preview`
   project · keeps the fallback DNS target alive for 7 more days in
   case rollback is needed.
2. Verify `www.nexcorner.com` and `nexcorner.com` resolve to Cloudflare
   Pages (not Vercel) via `curl -I` — look for `cf-ray` header, absence
   of `x-vercel-id`.
3. After 7 days with no rollback used, delete the Vercel project.
4. If no other Vercel projects on the account are in use, close the
   Vercel account. (Owner decision; not automated.)

## Not touched by cleanup

- Supabase project `ijvqdvsvwtwxzcqmoqit` — the sealed backend; not
  affected by the hosting change.
- GitHub repo `Philip2024394/nexapp.git` — primary source; not
  affected. Pages project is connected via Git integration.
- Brevo account — this is the replacement for `nodemailer`, not a
  retirement.
- Any `src/lib/nex-native/` code — business logic migrates unchanged.
- Any `nex-supabase/migrations/` — schema is backend-side, not
  hosting-side.

## Rollback triggers

If any of these occur during observation, pause cleanup and consider
rollback via DNS (flip CNAME back to Vercel):

- HQ incident volume spikes above baseline
- Supabase connection errors in logs (exhausted pool, timeout)
- Brevo bounces or 4xx rate >1%
- Any cron failure for 2 consecutive runs
- Pages build repeatedly fails on `main` pushes
- User-reported "site down" for a surface that works locally

Rollback is CNAME-level; the Pages project and Worker can stay
provisioned while the issue is diagnosed. Cleanup resumes only after
the trigger is understood and resolved.
