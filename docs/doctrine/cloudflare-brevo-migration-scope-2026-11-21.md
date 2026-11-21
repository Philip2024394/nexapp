# Cloudflare + Brevo Migration Scope · 2026-11-21

> Forensic forward-plan grounded in file:line evidence. Supersedes the
> preparation-phase clause of the sealed 2026-11-20 Cloudflare directive.
> Read-only plan. No code / DB / config / bucket / secret / deploy /
> migration changes authorised by this document — each execution step
> requires its own named word-trigger per the sealed 2026-11-12
> commit-and-push rule and constitution §4/§5.

## 0 · Scope + gates

- **Repo**: `C:/Users/Victus/nexapp` → `Philip2024394/nexapp.git`.
- **Branch**: `release-audit-v1-2026-11-14`.
- **Engineering ceiling**: Verified via source read. Not Live-verified.
- **Downtime posture**: Owner 2026-11-21 — *"site is not issue for now
  if taken down and relaunched"*. Cutover need not be zero-downtime.

## 1 · Stack declaration (sealed 2026-11-21)

| Layer | Provider | Status |
|---|---|---|
| Database + Auth + Storage | **Supabase** (prod `ijvqdvsvwtwxzcqmoqit`, sandbox `kdstoyyeygcopkogqsyv`) | Unchanged |
| Source control | **GitHub** (`Philip2024394/nexapp.git`) | Unchanged |
| Email (transactional + marketing) | **Brevo** (HTTPS API) | New — replaces `nodemailer` + `Resend` + `Mailgun` + `SendGrid` (see §3.1 for consolidation decision) |
| Hosting + DNS + CDN + WAF | **Cloudflare** | Replaces Vercel. Default product proposal: **Pages**. |

**Domain**: `nexcorner.com` added to Cloudflare account 2026-11-21.
Registrar: Hosting Ireland. Pending the two zone-assigned nameservers
(need valid API token or dashboard reveal).

## 2 · Target architecture

```
                                                ┌─────────────────────┐
                                                │   Hosting Ireland   │
                                                │  (domain registrar) │
                                                │   NS → Cloudflare   │
                                                └──────────┬──────────┘
                                                           │
                                                           ▼
┌──────────────────┐        ┌─────────────────────────────────────────┐
│  nexcorner.com   │ ─────► │              Cloudflare                 │
│   end user       │        │  ┌───────────────────────────────────┐  │
└──────────────────┘        │  │   Pages project (nexapp)          │  │
                            │  │   @cloudflare/next-on-pages       │  │
                            │  │   SSR via Pages Functions         │  │
                            │  │   Cron Triggers (3x)              │  │
                            │  │   Web Analytics + Analytics Eng.  │  │
                            │  └──────────┬────────────────────────┘  │
                            │             │                           │
                            └─────────────┼───────────────────────────┘
                                          │
                     ┌────────────────────┼────────────────────┐
                     ▼                    ▼                    ▼
              ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
              │   Supabase   │   │    Brevo     │   │ Cloudflare Stream│
              │  (DB · Auth  │   │  (email via  │   │ (video upload +  │
              │   · Storage) │   │   HTTPS API) │   │  duration probe) │
              └──────────────┘   └──────────────┘   └──────────────────┘
```

## 3 · Per-dependency migration plan

Based on grep-verified inventory. All file:line refs below are
VERIFIED via source read.

### 3.1 `nodemailer` → Brevo HTTPS

**Inventory** — 2 call sites, both in the legacy `src/lib/nex/` layer
(NOT nex-native primary user surfaces):

| File:line | Flow | Verdict |
|---|---|---|
| `src/lib/nex/listing-chat/smtp.ts:127-142` | `deliverViaSmtp()` via `nodemailer.createTransport` + `sendMail` — **owner_invite** (NEX Directory visitor notification to listing owners) | Replace with Brevo HTTPS |
| `src/lib/nex/founder-outbound/smtp-sender.ts:15,85,160` | `buildTransport` + batch send — **founder_batch_outbound** (authorised founder email campaigns) | Replace with Brevo HTTPS |

**Call-site upstream**:
- `src/lib/nex/listing-chat/owner-invite.ts:72` → `enqueueEmail()` → smtp.ts.
- No `nex-native` user-facing route reaches nodemailer today.

**Brevo endpoint**:
`POST https://api.brevo.com/v3/smtp/email` with `api-key` header + JSON
body `{ sender, to[], subject, htmlContent/textContent }`.

**Open decision — email provider consolidation**:
The codebase currently has **four** email providers wired:
- `nodemailer` (2 sites · legacy)
- `Resend` (`src/lib/nex-native/vault/pin-reset-email-sender.ts:147-154`
  · Phase 2B PIN reset + emergency help — **nex-native runtime**)
- `Mailgun` (`MAILGUN_API_KEY` env · founder deliverability provider)
- `SendGrid` (`SENDGRID_API_KEY` env · founder deliverability provider)

Owner sealed **Brevo** as THE email provider. Two interpretations:

- **(i) Replace all four with Brevo** — single provider, cleanest.
  Includes migrating the Phase 2B PIN reset code (already HTTPS-based,
  so move is cheap).
- **(ii) Replace only `nodemailer` with Brevo; keep Resend/Mailgun/
  SendGrid as-is** — all other providers are already Workers-
  compatible (HTTPS), so the Cloudflare blocker is only nodemailer.

**Awaiting owner confirmation.** Default proposal = (i), single-provider
consolidation.

### 3.2 `pg` → Supabase REST

**Inventory** — ZERO runtime uses in `src/app/api/**` or
`src/lib/nex-native/**`. All runtime DB access already routes through
`@supabase/supabase-js` (HTTPS · Workers-compatible).

**Local tooling (OK to keep)**: `scripts/apply-migration-*.mjs`,
`scripts/apply-P-RLS-sandbox.mjs`, `scripts/supabase-apply-directory-
canonical.mjs`, `scripts/gate-a-connected-matrix/*.mjs`,
`scripts/concurrency-rehearsal/*.mjs` — all run locally on the owner's
machine via `node`, never in the Cloudflare runtime. These continue
to use `pg` for schema-apply and dev work. No change needed.

**Action**: **No-op** for migration. `pg` stays in `package.json` as a
dev-tool dependency (used by `scripts/**`), never imported by runtime
code.

### 3.3 `ffmpeg-static` / `ffprobe-static` → Cloudflare Stream (proposal)

**Inventory**:

| File:line | Purpose | Verdict |
|---|---|---|
| `src/lib/nex-native/billing/video-duration-probe.ts:49-58` | `probeVideoDurationSeconds()` via `fluent-ffmpeg.ffprobe()` — **enforces 30-second tier cap on cover-video uploads** | **Launch-critical · needs-replacement** |
| `scripts/nex-themes/extract-palette.mjs:28,32` | `spawn(ffmpegPath, args)` — local theme-palette CLI | **Dev-only · no change** |

**Upstream of runtime site**:
`src/app/api/nex-native/product/upload-cover-video/route.ts:28` →
`probeVideoDurationSeconds()`.

**Three replacement options**:

1. **Cloudflare Stream** (recommended — already on Cloudflare).
   Upload goes to Stream; Stream returns duration + playback IDs in
   response. Replace `probeVideoDurationSeconds()` with a Stream API
   lookup. Cost: ~$0.005 per minute stored; durable video CDN.
2. **External probe service** (Mux, Bunny Stream, etc.) — adds a
   vendor outside the sealed stack.
3. **Client-side probe + server-side trust** — reject if client says
   >30s, but trivially bypassable (NOT RECOMMENDED for a billing-tied
   cap).

**Default proposal**: **Option 1 — Cloudflare Stream**. Keeps the
stack sealed. Adds one new env var (`CF_STREAM_API_TOKEN` and account
ID). Awaiting owner confirmation.

### 3.4 `tesseract.js` → stays as-is (WASM, Workers-compat probable)

**Inventory**:

| File:line | Purpose | Verdict |
|---|---|---|
| `src/lib/nex/intake/adapters/ocr-tesseract.ts:50-93` | `createWorker()` + `worker.recognize()` — **admin intake OCR**, founder-tier feature | **Potential-compat · not launch-critical** |

tesseract.js is pure WASM — no native binary dependency. Cloudflare
Workers supports WASM. Needs smoke test during cutover.

**If smoke test fails**: wrap OCR calls in a feature-gate and ship
without it for Phase 1 (admin-only feature, no user-visible impact).

### 3.5 `@imgly/background-removal` → remove (dead code)

**Inventory** — ZERO imports in `src/`. Only hit in codebase is an
unrelated social-icon component (false positive on `@imgly` substring).

**Action**: Remove from `package.json` dependencies at cutover time.

### 3.6 `onnxruntime-web` → stays (transitive, WASM)

**Inventory** — ZERO direct imports in `src/`. Only hit is a JSDoc
reference at `src/lib/nex-native/intelligence/models/qwen25-05b-
instruct.ts:21`. Any actual use is transitive via `@huggingface/
transformers`.

WASM-based, Workers-compat probable. Phase 1 generation is OFF unless
feature-flagged, so not launch-critical.

### 3.7 `sharp` → no-op (devDep only)

Confirmed `package.json:152` places `sharp` in `devDependencies`. All
usage is in `scripts/**` or `src/lib/nex/**/sandbox/**` — never in
production runtime.

## 4 · Vercel config → Cloudflare

### 4.1 `vercel.json`

Full current contents:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/nex-native/harvest/tick",                  "schedule": "0 * * * *" },
    { "path": "/api/nex-native/billing/cron/reconcile",        "schedule": "*/15 * * * *" },
    { "path": "/api/nex-native/cron/security-audit-reconcile", "schedule": "*/10 * * * *" }
  ]
}
```

**Action at cutover**: delete `vercel.json`. Behaviour migrates to §4.2.

### 4.2 3 crons → Cloudflare Cron Triggers

| Vercel cron | Handler file | Cloudflare equivalent |
|---|---|---|
| `0 * * * *` → `/api/nex-native/harvest/tick` | `src/app/api/nex-native/harvest/tick/route.ts` | Cron Trigger `0 * * * *` → invokes the same route (Pages Functions supports this) |
| `*/15 * * * *` → `/api/nex-native/billing/cron/reconcile` | `src/app/api/nex-native/billing/cron/reconcile/route.ts` | Cron Trigger `*/15 * * * *` |
| `*/10 * * * *` → `/api/nex-native/cron/security-audit-reconcile` | `src/app/api/nex-native/cron/security-audit-reconcile/route.ts` | Cron Trigger `*/10 * * * *` |

Cloudflare Pages exposes Cron Triggers that can fetch any Pages-
hosted route; no handler shape change needed for the existing route
files. Secret delivery for `CRON_SECRET`: migrate from Vercel's header
injection to a Cloudflare env binding, then the existing header-check
code continues to work.

### 4.3 Analytics replacement

| Vercel package (currently installed, 0 import sites) | Cloudflare replacement |
|---|---|
| `@vercel/analytics` ^2.0.1 | Cloudflare Web Analytics (free, zero-config page-level analytics via `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"..."}'></script>`) |
| `@vercel/speed-insights` ^2.0.0 | `web-vitals` npm package → POST to Analytics Engine (paid) OR drop entirely for launch |

Both Vercel packages have **zero import sites** per P2-10 (`2fb40071`).
Removing them from `package.json` is a near-no-op.

### 4.4 Additional Vercel artefacts to retire at cutover

- `.vercel/` directory (contains Vercel project linkage).
- `scripts/_tmp/vercel-*.mjs` any remaining ad-hoc helpers.
- `@vercel/analytics` + `@vercel/speed-insights` deps.
- `vercel.json`.

## 5 · Pages vs Workers final call

**Default proposal: Cloudflare Pages + `@cloudflare/next-on-pages`**

Rationale:
- Mature adapter for Next.js 16 App Router + RSC + Server Actions.
- Pages Functions natively support the `/api/.../route.ts` handler
  shape already in use (100+ routes).
- Cron Triggers available on Pages projects.
- Preview URLs (`<pr-sha>.<project>.pages.dev`) help smoke-test each
  batch of dep replacements before main cutover.

**Alternative: Workers + `@opennextjs/cloudflare`** — newer, more
flexible, but less-battle-tested for a 100+ server-action app. Only
pick Workers if Pages' Node.js compat mode proves insufficient.

**Awaiting owner confirmation.** Scope doc assumes **Pages**.

## 6 · Cutover sequence (phases)

Each phase is its own commit + push per sealed 2026-11-12 rule. Each
phase is independently reversible until §6.7.

### 6.0 Prerequisite — valid Cloudflare API token
Current `cfat_*` token rejected. Need either:
- Dashboard API Token with scope `Account:Read, Zone:Read, Zone:Edit
  DNS, Pages:Edit, Workers Scripts:Edit, Cloudflare Stream:Edit`
  (if Stream is adopted per §3.3), OR
- Dashboard manual walkthrough with owner reading NSs + IDs back.

### 6.1 Brevo integration (feature-flagged OFF by default)
- Add `src/lib/nex/email/brevo-sender.ts` (new file) implementing the
  Brevo HTTPS POST with the four-field send shape.
- Add env var `BREVO_API_KEY` to `.env.example` (not committed with a
  real value).
- Gate behind `NEX_EMAIL_PROVIDER=brevo` env flag; default stays on
  existing provider.
- Smoke test with sandbox API key against a test inbox.

### 6.2 Email provider switchover
- Flip `NEX_EMAIL_PROVIDER=brevo` in Cloudflare Pages env.
- Monitor owner_invite + founder_batch + PIN-reset flows for a
  defined window.
- Retire `nodemailer` dep.

### 6.3 Video duration probe switchover
- Create Cloudflare Stream account binding.
- Add `src/lib/nex-native/billing/stream-duration-probe.ts` (new file)
  implementing the Stream API lookup.
- Gate behind `NEX_VIDEO_PROBE_PROVIDER=cf_stream` env flag; default
  stays on ffmpeg-static.
- Flip flag in Cloudflare Pages env.
- Retire `ffmpeg-static` + `ffprobe-static` + `fluent-ffmpeg` deps.

### 6.4 Pages project creation
- `npx wrangler pages project create nexapp` (needs valid token).
- Add `@cloudflare/next-on-pages` to devDependencies.
- Add `_routes.json` if any routes need to be excluded from Functions.
- Configure env vars: `BREVO_API_KEY`, `CF_STREAM_API_TOKEN`,
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `CRON_SECRET`, plus the existing nex-native stack.
- Trigger a preview deploy on `release-audit-v1-2026-11-14`.
- Confirm preview URL serves the app.

### 6.5 Cron migration
- Configure 3 Cron Triggers on the Pages project pointing at the
  existing routes.
- Delete `vercel.json`.

### 6.6 DNS flip
- With a valid token: `POST /zones/{id}/dns_records` for `A`/`AAAA`/
  `CNAME` records pointing `nexcorner.com` + `www.nexcorner.com` at
  the Pages project.
- Owner enters the two Cloudflare nameservers at Hosting Ireland.
- Wait for NS propagation (typical 1–24 h).
- Verify `nexcorner.com` resolves to Cloudflare + loads the app.

### 6.7 Vercel retirement (final, less-reversible step)
- Delete `vercel.json`, `.vercel/`, `scripts/_tmp/vercel-*.mjs`.
- Remove `@vercel/analytics`, `@vercel/speed-insights` from
  `package.json`.
- Disconnect the Vercel project (dashboard action by owner).
- **Explicit word-trigger required** before this step runs (per
  constitution §4/§5).

## 7 · Open decisions

| # | Decision | Default proposal | Awaiting |
|---|---|---|---|
| 1 | Pages vs Workers | **Pages** | Owner confirm |
| 2 | Email provider consolidation — Brevo-only vs nodemailer-only replacement | **Brevo-only (retire Resend/Mailgun/SendGrid active use)** | Owner confirm |
| 3 | Video duration probe path | **Cloudflare Stream** | Owner confirm |
| 4 | tesseract.js / onnxruntime-web ship status for Phase 1 | **Feature-gated, non-blocking** | Default accepted unless objected |
| 5 | Full-app vs reduced launch surface | **Full app** (replace deps, don't drop features) | Default accepted unless objected |
| 6 | Launch-cutover downtime window | **To be scheduled** | Owner picks a time |
| 7 | Cloudflare API token | **Dashboard Create Token** | Owner to generate |

## 8 · BUILT / WIRED / VERIFIED / REMAINING / BLOCKED

### BUILT (no action needed)
- Supabase REST interface everywhere runtime (`pg` not reached in
  `src/app/api/` or `src/lib/nex-native/`).
- `sharp` is devDep-only.
- `@vercel/analytics` + `@vercel/speed-insights` have zero import
  sites — removal is near-free.
- Nex-native primary surfaces (chat, cart, vault, sign-in) do NOT
  touch nodemailer, ffmpeg, tesseract, imgly, or onnx directly.

### WIRED (needs flag / env flip only)
- Resend already HTTPS (PIN reset + emergency help) — Workers-compat
  as-is.
- Existing cron handler routes work unchanged under Cloudflare Pages
  Functions.

### VERIFIED via source read (no code changes yet)
- 2 `nodemailer` call sites, both legacy layer (not nex-native).
- 1 `ffmpeg-static`/`ffprobe-static` runtime site (video probe,
  launch-critical).
- 1 `tesseract.js` site (admin-only).
- 0 `@imgly/background-removal` sites.
- 0 direct `onnxruntime-web` sites (transitive only).
- 3 Vercel crons verified against their handler routes.

### REMAINING (work to do, each its own commit)
1. Author `src/lib/nex/email/brevo-sender.ts` + `BREVO_API_KEY` env
   wiring + feature flag.
2. Replace nodemailer call sites at `smtp.ts:127-142` + `smtp-
   sender.ts:85,160`.
3. (If email consolidation accepted) migrate Resend/Mailgun/SendGrid
   paths to Brevo.
4. Author `src/lib/nex-native/billing/stream-duration-probe.ts` +
   `CF_STREAM_*` env wiring + feature flag.
5. Replace video probe call site at `video-duration-probe.ts:49-58`.
6. Remove `@imgly/background-removal` from `package.json`.
7. Add `@cloudflare/next-on-pages` + Pages build pipeline.
8. Configure Cloudflare Pages project (name, env, Cron Triggers).
9. Smoke-test tesseract.js and transitive `onnxruntime-web` on Workers.
10. DNS records in Cloudflare → NS flip at Hosting Ireland.
11. Vercel retirement (deps + config + project disconnect).

### BLOCKED
- **DNS work**: blocked on valid Cloudflare API token OR owner
  manually reading back the two zone-assigned NSs from the dashboard.
- **Pages project creation**: blocked on valid API token (or manual
  dashboard create).
- **Cloudflare Stream**: blocked on owner approval of §3.3 default
  proposal + Stream API token.
- **Final Vercel retirement**: blocked on explicit word-trigger per
  constitution §4/§5 (deliberately held — this step is less
  reversible than the others).

## 9 · Engineering ceiling

Everything in this document is VERIFIED via source read. Nothing is
Live-verified. None of the §6 phases execute without the sealed
commit-and-push rule, named approval for destructive steps, and (for
§6.6/§6.7) a fresh word-trigger authorising production-affecting
changes.

## 10 · Next authorised actions (if owner says proceed)

In priority order:

1. Owner generates valid Cloudflare API token + pastes.
2. I verify token, list zones, confirm `nexcorner.com` is in the
   account, read back the two assigned NSs.
3. Owner enters NSs at Hosting Ireland.
4. Owner answers open decisions §7.1–7.3.
5. Phase 6.1 begins (Brevo integration, feature-flagged OFF).

Nothing beyond step 4 runs until each prior step is complete and the
owner has acknowledged the next one.
