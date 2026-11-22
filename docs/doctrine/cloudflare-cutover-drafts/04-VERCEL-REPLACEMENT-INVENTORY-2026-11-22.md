# Vercel-specific surfaces · replacement inventory · 2026-11-22

Enumerates every Vercel-specific file, dep, and runtime behavior that
has to be replaced by a Cloudflare equivalent before Vercel can be
decommissioned. Each row names the replacement, the proof of
replacement, and the retire-safe gate.

Supersedes the loose "cleanup.md" severity model with a concrete
replacement contract per item.

## 1 · Repository-level Vercel artefacts

| Artefact | Current state at HEAD | Replacement | Retire-safe gate |
|---|---|---|---|
| `vercel.json` (3 crons) | 3 crons live: hourly `/api/nex-native/harvest/tick`, every-15min `/api/nex-native/billing/cron/reconcile`, every-10min `/api/nex-native/cron/security-audit-reconcile` | Cloudflare Cron Triggers via **separate** crons Worker (`wrangler.crons.toml` + `crons-worker.ts` drafts exist in this folder) · dispatches HTTPS to Worker origin | 24h observation period after all 3 cron paths return 200 on Worker origin + HQ incidents show 0 new failure rows attributable to cron migration |
| `.vercel/project.json` | Preview project `prj_nS0i2pqaseEpUaEcTar4wI5OQ0VO` / `nex-ireland-preview` linked from local checkout | Delete after DNS flip · not referenced by Workers runtime | DNS CNAME points at Workers domain, not Vercel |
| `.vercel/README.txt` | Vercel CLI self-documentation | Delete with `.vercel/project.json` | Same gate as `.vercel/project.json` |
| `scripts/_tmp/vercel-*.mjs` (6 files) | One-off Vercel-API scripts: `vercel-check-git-wiring`, `vercel-create-bypass-token`, `vercel-list-projects-full`, `vercel-loosen-preview-protection`, `vercel-set-preview-sandbox-env`, `vercel-switch-prod-branch` | None required — these call `api.vercel.com`. On Cloudflare the equivalent operations are `wrangler` CLI or the Cloudflare dashboard | After cut-over, delete. Retain in git history for provenance. |
| `scripts/_tmp/vercel-protection-prior.json` | Snapshot of Vercel-specific access-protection state at a point in time | Delete with scripts above | Same gate |

## 2 · Node/npm dependencies that map 1-to-1 or must be gated

Confirmed grep-counts against `src/` at HEAD (commit range not yet
measured; counts valid as of `release-audit-v1-2026-11-14`).

| Dep | `src/` imports | Disposition | Replacement path | Retire-safe gate |
|---|---|---|---|---|
| `@vercel/analytics` | **0** | **Uninstall (zero-import)** | Cloudflare Web Analytics (separate workstream · browser snippet) | `npm ls @vercel/analytics` empty, build still green |
| `@vercel/speed-insights` | **0** | **Uninstall (zero-import)** | Cloudflare Web Analytics covers both surfaces | Same gate as above |
| `@imgly/background-removal` | **0** | **Uninstall (zero-import)** | None — unused dead dep | `npm ls @imgly/background-removal` empty |
| `onnxruntime-web` | **0 code imports** · 1 comment-only mention at `src/lib/nex-native/intelligence/models/qwen25-05b-instruct.ts:21` | **Uninstall (effectively zero-import)** | None — model not reached at runtime per current routing | `npm ls onnxruntime-web` empty, build green |
| `nodemailer` | 2 (static import at `src/lib/nex/founder-outbound/smtp-sender.ts:15`, dynamic `new Function("m", "return import(m)")(...)` at `src/lib/nex/listing-chat/smtp.ts:126`) | **Route through Brevo adapter** | Existing adapter at `src/lib/nex/email/adapters/brevo.ts` (verified present) · gated by `NEX_EMAIL_RUNTIME=brevo` per Gate 3 seal | Both call sites updated · one Brevo send end-to-end verified on preview Worker |
| `ffmpeg-static` | 0 direct imports in `src/` · transitively pulled via `fluent-ffmpeg` | **Keep** · gated behind `NEX_VIDEO_PROBE_ENABLED=false` on Workers preview | Flag flip to `true` only after bundle size + runtime probe test on Worker | Probe returns duration without error on Worker preview |
| `ffprobe-static` | 1 (`src/lib/nex-native/billing/video-duration-probe.ts`) | **Keep · gate** behind `NEX_VIDEO_PROBE_ENABLED` | Same as above | Same as above |
| `fluent-ffmpeg` | 1 (same video-duration-probe file) | **Keep · gate** behind `NEX_VIDEO_PROBE_ENABLED` | Same as above | Same as above |
| `tesseract.js` | 2 (`src/lib/nex/file-extraction/ocr-extractor.ts`, `src/lib/nex/intake/adapters/ocr-tesseract.ts`) · already lazy-imported | **Keep** · WASM, Workers-compatible | None — adapter passes Workers compat via `nodejs_compat` | Bundle size check under 25MB on first Worker build; OCR trigger returns text on preview |
| `pg` | 20+ call sites (billing, trial, agent runtime, trust-score) | **Keep** · works on Workers with `nodejs_compat` + `global_fetch_strictly_public` | None — Postgres pooler endpoint unchanged | Hit `/api/nex-native/billing/*` on preview Worker, see 200 + Supabase pooler log |

Gate 3 flags (**NOT applied yet** — drafted here for traceability):

| Flag | Vercel default | Workers preview default | Workers prod default |
|---|---|---|---|
| `NEX_VIDEO_PROBE_ENABLED` | `true` | `false` | `true` only after probe verified on Worker |
| `NEX_EMAIL_RUNTIME` | `nodemailer` | `brevo` | `brevo` |
| `NEX_OCR_ENABLED` | `true` | `false` first build · flip after bundle-size check | `true` after flip |

## 3 · Runtime HTTP headers served by Vercel edge

Not an in-repo file, but part of the current production response shape.
Examples captured from `www.nexcorner.com`:

| Header | Who sets it | Workers equivalent |
|---|---|---|
| `x-vercel-id: <edge-region>::<fn-region>::<request-id>` | Vercel origin | Replace with Cloudflare `cf-ray`/`cf-request-id` (set automatically) |
| `x-vercel-cache: HIT|MISS|STALE|BYPASS` | Vercel edge cache | Replace with Cloudflare `cf-cache-status` (set automatically) |
| `server: Vercel` | Vercel origin | OpenNext worker sets no `server` header by default; optionally override in `open-next.config.ts` |

**No app code reads these headers** (verified: grep for `x-vercel-id`
in `src/` returned 0 matches). They are observational / diagnostic
only. Dashboards or external monitors that filter on these strings
(if any) will need updating at DNS-flip time. **Owner responsibility
to check external tooling (DataDog / Sentry / etc.) before cutover.**

## 4 · Deployment-platform wiring

| Surface | Vercel today | Cloudflare equivalent | Retire-safe gate |
|---|---|---|---|
| Git → prod deploy on push to `main` | Vercel project `nex-ireland-preview` auto-build | Cloudflare dashboard → Workers project → **Connect Git** → repo `Philip2024394/nexapp` → branch `main` · build command `npx opennextjs-cloudflare build` · output dir `.open-next` · deploy command auto-set by adapter | One green auto-deploy observed on a preview branch |
| Preview deployments on branch push | Auto per Vercel default | Cloudflare per-branch preview URL (`<branch>.<project>.workers.dev` or custom preview domain) | One preview URL loads with `/nex-native/*` routes working |
| Env vars (prod) | Vercel dashboard | `wrangler secret put` per var OR Cloudflare dashboard → Workers → Settings → Variables and Secrets | All env vars from `env-vars.md` set on Workers prod · test boot green |
| Env vars (preview) | Vercel dashboard preview env | Same path as prod on Cloudflare but scoped to preview environments | All preview env vars set · preview boot green |
| DNS `www.nexcorner.com` | Points at Vercel (proxied through Cloudflare) | Points at Workers custom domain | After Workers prod stable for ≥24h, flip DNS. Vercel keeps responding until DNS TTL expires; cut it only after 48h of 0 Vercel traffic. |
| Edge image optimisation | Vercel `Image Optimization` | Cloudflare Images binding (declared in `wrangler.jsonc` · `IMAGES` binding) · OpenNext wires `next/image` to it | Image-heavy page (`/nex-native/vault`) returns images at expected sizes |

## 5 · Order of operations · what must land BEFORE DNS flip

**Code changes** (every one of these needs `BUILT/WIRED/VERIFIED` per
the sealed engineering-ceiling model):

1. Introduce `NEX_EMAIL_RUNTIME` + `NEX_VIDEO_PROBE_ENABLED` +
   `NEX_OCR_ENABLED` flag reads. Verify default-unset preserves
   current Vercel behavior bit-for-bit (**contract**: if a flag is
   unset, the code behaves exactly as it did at `b382dd43`).
2. Route both `nodemailer` call sites through the Brevo adapter when
   `NEX_EMAIL_RUNTIME=brevo`. Keep nodemailer code paths intact for
   fallback.
3. Fix the `src/lib/nex/idempotency/store.ts:53` dynamic-fs trace
   warning (static path OR dev-only gate) so Worker bundle stays
   under 25MB. Only if bundle size check fails.

**Infra provisioning** (all require owner approval + Gate 1 API token):

4. Create Workers project · set env vars from `env-vars.md`.
5. First auto-deploy from `main` (branch-preview, NOT prod URL).
6. Provision crons Worker · point at `*.workers.dev` first.
7. 24h observation on `*.workers.dev` · all cron paths firing, no
   new HQ incident categories.

**DNS flip** (owner action):

8. `nexcorner.com` + `www.nexcorner.com` CNAME → Workers custom
   domain.
9. Flip crons Worker `WORKER_ORIGIN` to `https://nexcorner.com`.
10. Another 24h observation.

**Decommission** (owner approval + explicit "retire vercel" word):

11. Delete `.vercel/`, remove `vercel.json`, uninstall 4 zero-import
    deps (`@vercel/analytics`, `@vercel/speed-insights`,
    `@imgly/background-removal`, `onnxruntime-web`), delete 7
    `scripts/_tmp/vercel-*` files.
12. Delete Vercel project from dashboard.

## 6 · What this inventory does NOT authorise

- Uninstalling any dep (requires `npm uninstall` + commit + push).
- Routing nodemailer through Brevo (requires code edit + commit +
  push + test).
- Deleting `.vercel/` or `vercel.json` (requires DNS flip first).
- Creating the Workers project (requires API token · owner only).
- Flipping DNS (requires explicit "flip DNS" approval).

Everything in this file is **inventory + replacement contract**, not
execution. The retire-safe gates exist so that when execution is
authorised, each step has an objective pass criterion separate from
"it felt fine".
