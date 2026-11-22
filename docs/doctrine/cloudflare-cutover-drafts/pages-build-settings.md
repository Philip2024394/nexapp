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

## Known build-time blockers

Replaced 2026-11-22 by `02-SEALED-DECISIONS.md` Gate 3 · each of the
7 flagged deps now has a concrete disposition (KEEP, GATE, ROUTE, or
UNINSTALL) driven by a real `src/` audit rather than a severity guess.

Pre-build gate: confirm the three env flags
(`NEX_VIDEO_PROBE_ENABLED`, `NEX_EMAIL_RUNTIME`, `NEX_OCR_ENABLED`)
are present on both Production and Preview environments with the
defaults from `02-SEALED-DECISIONS.md` before enabling the Pages Git
integration.
