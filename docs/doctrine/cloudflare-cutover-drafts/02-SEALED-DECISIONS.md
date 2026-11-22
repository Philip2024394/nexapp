# Gate 2 + Gate 3 · sealed decisions · DRAFT 2026-11-21

Closes two of the three cut-over gates by making the architectural
calls I previously held as "recommendation". Both are reversible until
the Pages project is actually provisioned.

---

## Gate 2 · REVISED 2026-11-22 — Cloudflare Workers via `@opennextjs/cloudflare`

**Supersedes the 2026-11-21 Pages / `@cloudflare/next-on-pages` seal**
below. The prior seal was made without verifying the adapter's
peerDependency against the installed Next version; a verified compat
audit changed the choice.

### Verified evidence

| Fact | Value | Source |
|---|---|---|
| Installed Next version | `16.3.8` | `package-lock.json` `node_modules/next.version` |
| Declared range | `^16.2.9` | `package.json` `dependencies.next` |
| Registry | `https://registry.npmjs.org/` | `npm config get registry` |
| `@cloudflare/next-on-pages@1.13.16` peerDep on Next | `>=14.3.0 && <=15.5.2` | `npm view` |
| `@opennextjs/cloudflare@1.20.18` peerDep on Next | `>=15.5.29 <16 \|\| >=16.4.5` | `npm view` |
| **`@opennextjs/cloudflare@1.20.11` peerDep on Next** | **`>=15.5.27 <16 \|\| >=16.3.8`** | `npm view` |
| Official OpenNext Cloudflare docs statement | *"All minor and patch versions of Next.js 16 and the latest minor of Next.js 15 are supported."* | `opennext.js.org/cloudflare` |

### Decision

- **Keep Next at the installed `16.3.8`.** No upgrade, no downgrade.
- **Pin `@opennextjs/cloudflare@1.20.11`** as a devDependency — newest
  adapter release whose declared peerDep explicitly accepts our Next.
- **Deploy target is Cloudflare Workers**, not Pages. OpenNext's
  Cloudflare adapter targets Workers + Workers Assets. This is the
  actively maintained path per Cloudflare's own documentation; the
  Pages adapter (`next-on-pages`) is in soft-deprecation.
- **Later adapter upgrades** (1.20.12+) are gated on a Next patch bump
  to `≥16.4.1` or `≥16.4.5`. Do not upgrade the adapter alone.

### Why not the originally-sealed Pages path

- `@cloudflare/next-on-pages@latest` peer-requires Next `≤15.5.2`.
  Installing it against our Next 16.3.8 would fail peer-dep checks or
  require `--legacy-peer-deps`, which defeats the point of peer
  contracts and masks real runtime incompatibilities.
- Downgrading Next 16.3.8 → 15.5.2 would drop every Next-16-only API
  surface the codebase already depends on. The owner directive
  "no silent feature removal" rules this out.

### Why not newer adapter + Next bump (1.20.18 + Next 16.4.6)

Rejected under directive "Prefer retaining the current Next version
if a verified supported OpenNext release accepts it." 1.20.11 accepts
16.3.8 as-is, so no Next change is justified at this step. If a later
need forces a Next bump, it is re-evaluated on evidence then — not
pre-emptively here.

### Companion decision — crons

The 3 Vercel crons still migrate to a **separate Cloudflare Worker**
(`wrangler.crons.toml` + `crons-worker.ts`) that HTTPs-dispatches to
the Workers origin. Keeps the app Worker unaware of scheduling.

---

## Gate 2 · ORIGINAL 2026-11-21 (superseded) — Cloudflare Pages

**Historical record. Superseded 2026-11-22 by the revised seal above.
Do not act on this section.**

Decision: nexapp ships on **Cloudflare Pages** via
`@cloudflare/next-on-pages`.

Reasoning · recorded for owner audit:

| Factor | Pages | Workers | Choice |
|---|---|---|---|
| Next.js 16 feature coverage (app router, server actions, RSC) | native via the adapter | partial; several surfaces require workarounds | Pages |
| CPU-time limit per request | 30s on free, more on paid | 10–30s depending on plan | Pages |
| Bundle size | up to 25MB per function on free, larger on paid | 10MB compressed | Pages |
| `nodejs_compat` effectiveness | good — `pg`/`Buffer`/`stream` available | good but tighter memory | Pages |
| Pricing at nexapp traffic shape (long-tail, infrequent crons) | generous free tier covers the floor | similar | neutral |
| Cron Triggers | supported natively via Pages Functions, but Worker is simpler to reason about | supported natively | split — see below |

Companion decision: the 3 Vercel crons are migrated to a **separate
Cloudflare Worker** (`wrangler.crons.toml` + `crons-worker.ts`) that
HTTP-dispatches to the Pages origin. The app itself lives on Pages;
the cron Worker is a thin scheduler. This keeps the Next.js app
unaware of its scheduling layer.

If Pages ends up blocked by a specific capability the audit missed,
the drafts here can be re-pointed at Workers without changing the
business logic — the Next.js source stays identical.

---

## Gate 3 · per-dep disposition · SEALED 2026-11-21

Replaces the loose "may fail" language in `pages-build-settings.md`
with a concrete call for each dep plus its code-touch cost.

### Audit summary (verified against `src/` and `package.json`)

| Dep | Version | Live call sites in `src/` | Disposition |
|---|---|---|---|
| `pg` | ^8.22.0 | 20+ files · billing, trial, agent runtime, trust-score | **KEEP** · works on Pages with `nodejs_compat`. Monitor cold start times. |
| `nodemailer` | ^10.0.3 | 2 files · `nex/listing-chat/smtp.ts`, `nex/founder-outbound/smtp-sender.ts` · plus 1 adapter shim | **ROUTE THROUGH BREVO** · the registry adapter at `src/lib/nex/email/adapters/brevo.ts` already exists (native fetch, Workers-compat). Call sites keep running on Vercel until email runtime flips to Brevo. |
| `ffmpeg-static` | ^5.3.0 | (no direct import found) | **KEEP** · likely pulled via `fluent-ffmpeg`. Gate behind feature flag. |
| `ffprobe-static` | ^3.1.0 | 1 file · `nex-native/billing/video-duration-probe.ts` | **GATE** · wrap existing code in `NEX_VIDEO_PROBE_ENABLED` env flag. Default OFF on Cloudflare preview. Default ON on Vercel until cut-over. |
| `fluent-ffmpeg` | ^2.1.3 | 1 file · `video-duration-probe.ts` | **GATE** · same flag as above. |
| `tesseract.js` | ^7.0.0 | 2 files · `nex/file-extraction/ocr-extractor.ts`, `nex/intake/adapters/ocr-tesseract.ts` · already **lazy-imported** | **KEEP** · WASM, no Node-native deps. Lazy `await import("tesseract.js")` already keeps it off the cold-start path. Confirm bundle size fits Pages' 25MB limit on first build. |
| `@imgly/background-removal` | ^1.7.0 | **zero imports** in `src/` | **UNINSTALL** at Stage 1 cleanup. Was carried over from a past feature. |
| `onnxruntime-web` | ^1.27.0 | zero live imports · 1 comment reference in `qwen25-05b-instruct.ts` | **UNINSTALL** at Stage 1 cleanup. The qwen model is not reached at runtime per current routing. |

### Env flags introduced (NOT applied yet — proposal)

| Flag | Default on Vercel | Default on Cloudflare Pages preview | Default on Cloudflare Pages prod |
|---|---|---|---|
| `NEX_VIDEO_PROBE_ENABLED` | `true` | `false` | `true` only after confirming ffprobe runs on Pages |
| `NEX_EMAIL_RUNTIME` | `nodemailer` (current) | `brevo` | `brevo` |
| `NEX_OCR_ENABLED` | `true` | `false` on first build; flip after bundle-size check | `true` after flip |

These flags are ADDITIVE · if they are unset, code behaves as it does
today (keeps the Vercel-side contract intact until each flag is
flipped explicitly).

### Test gate for each dep before green-light

| Dep | Test on Cloudflare preview | Pass criterion |
|---|---|---|
| `pg` | Hit `/api/nex-native/billing/...` on preview URL | 200 response, DB round-trip visible in Supabase logs |
| `nodemailer` → Brevo | Flip `NEX_EMAIL_RUNTIME=brevo` on preview, trigger the password-reset path | Brevo dashboard shows the delivery |
| `ffprobe-static` | Flip `NEX_VIDEO_PROBE_ENABLED=true` on preview, upload a short mp4 | Probe returns duration without error |
| `tesseract.js` | Trigger an OCR extraction on preview | Extraction returns text; preview build size under 25MB |

Any failure → leave the flag OFF, open an incident, do not block the
cut-over of the rest of the app. Features gate to "temporarily
unavailable" surface — do not throw raw 500s.

---

## Changes required in existing drafts

- `pages-build-settings.md` · the "Known build-time blockers" table
  gets replaced by a one-line pointer to this file. Severity labels
  ("high"/"medium") no longer apply once each dep has a named
  disposition.
- `env-vars.md` · adds `NEX_VIDEO_PROBE_ENABLED`, `NEX_EMAIL_RUNTIME`,
  `NEX_OCR_ENABLED`, `NEX_DELIVERY_BREVO_API_KEY` to the
  launch-critical list.
- `cleanup.md` · Stage 1 (zero-import) extends from 2 to 4 deps:
  `@vercel/analytics`, `@vercel/speed-insights`,
  `@imgly/background-removal`, `onnxruntime-web`.

Those updates land in the same commit as this file.

---

## What this does NOT seal

- The actual implementation of the three env flags (pure docs today).
- The Brevo cut-over of the two nodemailer call sites (separate
  workstream per 2026-11-21 sealing).
- The decision on whether to retain or retire the agent-runtime `pg`
  callers — out of nexapp cut-over scope, lives in `src/lib/nex/` and
  is covered by the CLAUDE.md "legacy residue" clause.
