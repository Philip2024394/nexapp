# Cloudflare Pages · build settings · DRAFT 2026-11-21

Entered in the Cloudflare dashboard under
**Workers & Pages → Create → Pages → Connect to Git → Philip2024394/nexapp**.

## Project

| Field | Value |
|---|---|
| Project name | `nexapp` (or `nex-ireland` if the former is taken) |
| Production branch | `main` |
| Preview branches | All non-production branches (default) |

## Build configuration

| Field | Value |
|---|---|
| Framework preset | **None** (do NOT pick "Next.js" — that preset uses the old Next adapter; we use `@cloudflare/next-on-pages`) |
| Build command | `npx @cloudflare/next-on-pages@1` |
| Build output directory | `.vercel/output/static` |
| Root directory | *(blank — repo root)* |
| Node.js version | `20` (match local; Next 16 requires ≥18.17) |

> `@cloudflare/next-on-pages` compiles the Next.js build into the
> Vercel Build Output API format at `.vercel/output/static`. That path
> name is historical — the Vercel BOA is an open standard; the folder
> contents are static assets + edge functions suitable for Pages. No
> Vercel service is involved at build or runtime.

## Compatibility flags

Add under **Settings → Functions → Compatibility flags** on BOTH the
Production and Preview environments:

```
nodejs_compat
```

Required for Next.js server code paths that touch Node builtins
(`Buffer`, `crypto`, `stream`, etc.). Without this flag the build will
compile but many routes will 500 at runtime.

## Compatibility date

```
2026-11-21
```

(or whatever "today" is at provision time — do NOT pick a date in the
future).

## Not configured here

- **Custom domain** · configured AFTER the first successful build at
  `Settings → Custom domains → Set up a custom domain → nexcorner.com`.
  Cloudflare will offer to create the CNAME automatically since the
  zone is already on Cloudflare.
- **Environment variables** · see `env-vars.md`. Must be added before
  the first build or the build will fail at runtime config validation.
- **Build cache** · leave default (enabled).
- **Access policy** · do NOT put Cloudflare Access in front of the
  Pages project. The app has its own auth.

## Known build-time blockers to resolve BEFORE first push

From the forensic audit (`cloudflare-brevo-migration-scope-2026-11-21.md`
§6), the following deps are Node-native and may fail the Workers
runtime even with `nodejs_compat`. Pages is more forgiving than Workers
but still constrained:

| Dep | Used by | Risk on Pages | Action |
|---|---|---|---|
| `pg` | direct Supabase pooler scripts (not runtime) | **low** — only used in `scripts/` + migrations, not in app routes | leave |
| `nodemailer` | 1 server action | **high** — SMTP client needs Node sockets | **replace with Brevo HTTPS API** (separate workstream) before first build |
| `ffmpeg-static` | video thumbnail route | **high** — ships a static binary | gate the route behind feature flag; disable until a Workers-compatible path exists |
| `ffprobe-static` | ditto | **high** | ditto |
| `tesseract.js` | OCR route | **medium** — WASM; may work with increased bundle limits on Pages | test on preview, gate behind flag if it fails |
| `@imgly/background-removal` | image edit | **medium** — WASM | test, gate if needed |
| `onnxruntime-web` | ML inference | **medium** — WASM | test, gate if needed |

**Pre-build gate:** before enabling the Cloudflare Pages Git
integration (which would auto-build on every push), confirm the above
items are either ported, gated behind a flag that defaults OFF, or
accepted as temporarily broken on the preview.
