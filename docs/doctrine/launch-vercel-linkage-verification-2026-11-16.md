# Vercel linkage verification · owner-facing checklist

**Author:** Stream C · 2026-11-16
**Scope:** Owner-facing procedure. No Vercel access performed by Claude.
**Related:** nexapp CLAUDE.md §1-5 (Safety Constitution)

---

## Why this check exists

Per the nexapp CLAUDE.md Safety Constitution §5:

> Before production changes, verify the current Vercel project's
> connected repository and production branch using authoritative
> project settings.
>
> Do not infer Vercel linkage from folder names, old commits,
> documentation files or assumptions.

A GitHub push is NOT proof of deployment success. A Vercel project
can be:

- linked to the WRONG repo (e.g. `trades` instead of `nexapp`)
- linked to the WRONG branch (e.g. `release-audit-v1-2026-11-14`
  instead of `main`)
- linked to the wrong Supabase project in env vars
- not auto-deploying because the integration token expired
- deploying to the wrong domain (preview vs prod confusion)

This checklist confirms the production Vercel project is pointed at
`Philip2024394/nexapp` on `main` and no other.

---

## Prerequisites

- Owner is signed into vercel.com with the account that owns the
  project.
- Owner has the `nexapp` project open in a browser tab.
- Project > Settings page is accessible (owner-level permission).

---

## Step 1 · Confirm connected repository

1. Open the NEX production project in Vercel.
2. Settings → Git.
3. Find "Connected Git Repository".
4. **Expected value:** `Philip2024394/nexapp`
5. **Not expected:** `Philip2024394/trades`, `Philip2024394/trades-harvest-deploy`,
   or any other.

If the value is wrong, STOP. Do not proceed. Report to the
constitution owner.

### Evidence to capture

- Screenshot the "Connected Git Repository" row.
- Save to `evidence/stream-c/vercel-linkage-repo-<YYYY-MM-DD>.png`
  (owner's local file — Claude does NOT write screenshots).

---

## Step 2 · Confirm production branch

1. Same page, Settings → Git.
2. Find "Production Branch".
3. **Expected value:** `main`
4. **Not expected:** `release-audit-v1-2026-11-14`,
   `phase-x/scope-reduction-chat-themes-shop-vault-2026-11-06`,
   or any feature branch.

Note on branch choice: nexapp CLAUDE.md §1 says *"Intended
production branch: `main`, subject to confirmation against the live
Vercel configuration."* If Vercel is configured for a different
branch (e.g. the owner shipped v1 from a release branch), that is
the authoritative value — NOT main. Update the memory doc rather
than changing Vercel.

---

## Step 3 · Confirm environment variables

1. Settings → Environment Variables.
2. Filter to "Production" scope.
3. Cross-reference every entry against
   `docs/doctrine/launch-prod-env-inventory-2026-11-16.md`.
4. Required checks:
   - `NEX_SUPABASE_URL` resolves to `ijvqdvsvwtwxzcqmoqit.supabase.co`
     (verify the project ref — not a typo, not a sandbox ref like
     `kdstoyyeygcopkogqsyv`).
   - `NEXT_PUBLIC_NEX_SUPABASE_URL` equals `NEX_SUPABASE_URL`.
   - `NEX_SESSION_SECRET` and `ENC_KEY` differ from all other
     environments (owner must hold distinct secrets).
   - No FORBIDDEN env present (per section J of the env inventory).

---

## Step 4 · Confirm production domain

1. Project overview → Domains.
2. **Expected:** the owner's chosen production apex is set as
   "Production" and the healthcheck is passing.
3. If the apex is `nex.app`, confirm that's what
   `NEX_WEBAUTHN_RP_ID` is set to in env vars.

---

## Step 5 · Confirm most-recent deployment matches the right commit

1. Project overview → Deployments.
2. Most recent "Production" deployment:
   - Branch name matches Step 2.
   - Commit SHA matches `git rev-parse origin/main` locally.
   - Status = "Ready".
   - Duration is reasonable (first prod deploy may take 2-5 min).

```bash
# Run locally to compare:
cd C:/Users/Victus/nexapp
git fetch origin main
git log origin/main -1 --format="%H %s"
```

Compare the SHA against the one Vercel shows.

---

## Step 6 · Confirm the live app responds

1. Open the production URL (whatever the apex from Step 4 is).
2. Expect splash → redirect → contacts (signed-in) OR free-chat
   (signed-out).
3. Expect NO 500, NO "configuration missing" banner.
4. Open browser dev-tools → Network → confirm requests resolve on
   the production apex, not a preview URL.

### Specific smoke requests

- `GET /nex-native` — 200, HTML body includes `<img` referencing
  `/nex-splash.png`.
- `GET /nex-native/not-found-smoke-123-abc` — 404 + rendered NEX
  dark not-found page (B5 from this stream).
- `GET /nex-native/subscription` — 307 redirect to
  `/nex-native/settings/tier` (B4 from this stream).
- `GET /api/nex-native/_health` (if the route exists; verify in src
  before relying on it).

---

## Step 7 · Confirm auto-deploy on next main push

1. Push a doc-only commit to `main` from a local checkout. (Owner
   must authorise · this document does NOT push.)
2. Within ~30 seconds Vercel should start a new deployment.
3. New deployment moves to "Ready" state.
4. If auto-deploy doesn't fire: Settings → Git → Deploy Hooks ·
   verify the GitHub integration is connected (green).

---

## Step 8 · Capture + archive evidence

For the owner's records, save:

- `evidence/stream-c/vercel-linkage-repo.png`
- `evidence/stream-c/vercel-linkage-branch.png`
- `evidence/stream-c/vercel-env-prod-summary.txt` (names only · NO
  values · screenshot or `vercel env ls production` trimmed to
  names)
- `evidence/stream-c/vercel-deploy-latest.png`

**Secret handling:** never commit env values. Even in private evidence
files, redact everything after `=`.

---

## Red flags · STOP conditions

Per nexapp CLAUDE.md §6, STOP if ANY of:

- Connected Git Repository ≠ `Philip2024394/nexapp`
- Production Branch is a feature branch the owner didn't authorise
- Any Supabase env resolves to a non-canonical project ref
- `NEX_ALLOW_DEV_ADMIN` or similar FORBIDDEN env is set in prod
- WebAuthn RP ID doesn't match the production apex
- Last production deploy is marked "Failed" or "Error"
- Production domain HTTP response is 5xx

Report evidence + ask for approval before any corrective action.

---

## What this document does NOT do

- Does not change Vercel configuration.
- Does not push commits.
- Does not deploy.
- Does not read or write env values.
- Does not authorise production changes.

Owner performs Steps 1-8 and records results. Claude's role is to
provide the checklist, not to execute it.
