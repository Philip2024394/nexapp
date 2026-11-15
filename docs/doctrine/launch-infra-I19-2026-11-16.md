# I19 · Error telemetry · minimal Sentry integration proposal

**Author:** Stream C · 2026-11-16
**Scope:** Document-only. No code changes. No package installs.
**Related:** `src/lib/nex/alerts/` (existing alerts), console.error patterns

---

## Current state (evidence)

### No Sentry integration exists in runtime code

`grep -rn "Sentry\|@sentry" src/` returns only:

- `src/lib/nex/collection/candidateExtractor.ts:502` · the literal
  string "sentry.io" appears in a list of **blocklisted domains**
  (prevents the extractor from treating sentry.io links as
  candidate NEX businesses). This is NOT a Sentry integration.
- `src/lib/nex-agent/plugin-catalog.ts:309-325` · a plugin catalog
  ENTRY describing Sentry as an installable plugin for the agent.
  This is metadata, not an integration.
- `src/lib/nex-agent/code-engine/.../vocabulary.ts:1429` and the
  matching test · vocabulary classification only.

Confirmed: no `@sentry/nextjs`, no `Sentry.init(...)`, no
`sentry.*.config.ts`, no sourcemap upload wiring. Zero runtime
Sentry usage.

### Existing error-logging surfaces

- `src/lib/nex/observability/logger.ts` — in-house logger wrapping
  console.* with a scoped prefix. No external sink.
- `src/lib/nex/alerts/dispatch.ts` — Alert dispatcher capable of
  Slack webhook, generic webhook, email. Gated behind
  `NEX_ALERTS_DISPATCH_ENABLED === "1"`. Covers OPERATIONAL alerts
  (dispatch outcomes, worker circuit trips, rate-limit floods) not
  per-request unhandled exceptions.
- Scattered `console.error(...)` and `console.warn(...)` in server
  components and server actions — visible in Vercel runtime logs
  but not captured anywhere persistent.

### Gap

A single unhandled exception in a server component bubbles to the
nearest `error.tsx` boundary (every nex-native segment has one).
The user sees a friendly error, but:

1. No persistent record of the stack trace outside Vercel's
   10-minute runtime log window.
2. No alert on repeat occurrences.
3. No source-map resolution for minified prod stacks.
4. No session replay of the click that triggered it.

For a chat+themes launch this is acceptable short-term but creates
a blind spot when the owner needs to triage "why did Clara's sign-in
fail three times yesterday?"

## Proposed minimal integration

### Phase 1 (recommended first install)

Install `@sentry/nextjs` (latest LTS compatible with Next 15 in
this fork — verify against `node_modules/next/package.json` version
at install time).

```
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

The wizard creates:

- `sentry.server.config.ts`
- `sentry.client.config.ts`
- `sentry.edge.config.ts`
- updates `next.config.ts` to wrap with `withSentryConfig`
- adds env var reads for `NEXT_PUBLIC_SENTRY_DSN` and server-only
  `SENTRY_AUTH_TOKEN` (used only at build time for sourcemap
  upload).

### Config defaults for v1 (Phase 1 cost control)

- `tracesSampleRate: 0.1` — 10 % of requests traced. At the chat+
  themes launch volume this is conservative.
- `profilesSampleRate: 0` — profiling OFF until performance
  bottlenecks are identified.
- `replaysSessionSampleRate: 0` — session replay OFF for Phase 1
  because the chat-privacy doctrine (sealed 2026-11-09) forbids
  server-side capture of private chat input, and session replay
  by default captures DOM input. Enabling replay would need
  surface-scoped masking rules — a separate design pass.
- `replaysOnErrorSampleRate: 0` — same reason.
- `environment` — reads `process.env.VERCEL_ENV` (production /
  preview / development).

### Files that would need the integration wired

- `sentry.server.config.ts` — server component + server action
  errors.
- `sentry.client.config.ts` — browser unhandled rejections.
- `sentry.edge.config.ts` — middleware (`src/middleware.ts`).
- `src/instrumentation.ts` — Next 15 instrumentation hook (already
  used in this fork? check before writing).

### Env vars to add to .env.example (but NOT set in this doc-pass)

```
# ---- 5.6 · Error telemetry (OPTIONAL · recommended for prod) ----
# Sentry DSN · public · safe to commit to env scope but never
# commit the auth token. Configure via Vercel project envs.
# NEXT_PUBLIC_SENTRY_DSN=
#
# Build-time only · server scope · scope ONLY to Vercel "Build"
# phase, not Runtime. Used to upload sourcemaps.
# SENTRY_AUTH_TOKEN=
#
# Required when SENTRY_AUTH_TOKEN is set · identifies the Sentry
# org and project the sourcemaps upload to.
# SENTRY_ORG=
# SENTRY_PROJECT=
```

These additions to `.env.example` are deferred to the install PR
(not this doc-pass). Doing them here would imply the integration is
wired, which it isn't.

## Owner action

1. **Decide** whether to adopt Sentry vs an alternative (Datadog,
   Honeycomb, self-hosted Glitchtip). Recommended: Sentry for v1,
   it's the lowest-effort integration for Next 15 and the free
   tier covers chat+themes launch volume.
2. **If Sentry chosen:**
   a. Create a Sentry project at sentry.io (Next.js platform).
   b. Capture DSN + generate an auth token scoped to the project
      (not org-wide).
   c. Add `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` +
      `SENTRY_ORG` + `SENTRY_PROJECT` to Vercel production scope.
   d. Approve a follow-up PR (not this stream) that runs the
      wizard and commits the four config files + the
      `next.config.ts` wrap.
3. **Do NOT** enable session replay in that PR. That is a privacy
   review, not an installation step.

## Validation command

After the install PR lands and Vercel env is set:

```bash
# Local: confirm the Sentry SDK boot path is reachable.
cd C:/Users/Victus/nexapp
npm run dev
# In a second shell:
curl http://localhost:3008/api/nex-native/_sentry-boot-check
```

The health route doesn't exist yet — the install PR would add it
specifically to prove the SDK loaded. Alternative: artificially
trigger an error in a non-prod route and verify it appears in the
Sentry dashboard within 60 seconds.

## What is NOT done here

- No `npm install` run.
- No config files created.
- No `next.config.ts` wrap.
- No env addition to `.env.example`.
- No Sentry account provisioning.
- No session-replay design.
