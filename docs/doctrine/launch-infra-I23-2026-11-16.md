# I23 · NEX_ALLOW_DEV_ADMIN · prod safety + runtime guard proposal

**Author:** Stream C · 2026-11-16
**Scope:** Document-only. No code changes. No `.env.local` edits.
**Related:** `src/app/nex-native/_actions.ts`, admin-action-role-gates test,
             `src/lib/nex-native/routing/route-registry.ts`

---

## Current state (evidence)

### No live `process.env.NEX_ALLOW_DEV_ADMIN` reads in src/

`grep -rn "process\.env\.NEX_ALLOW_DEV_ADMIN" src/` returns ZERO
matches. The env var is historically referenced in:

- `src/app/nex-native/_actions.ts:7519, 7710` — comments only:
  *"env `NEX_ALLOW_DEV_ADMIN=1` (never enabled in production)"*.
  The actual gate uses role-based checks, not the env.
- `src/app/nex-native/__tests__/admin-action-role-gates.test.ts:63,
  97, 123` — REGRESSION TESTS that assert no code reads the env
  directly anymore. They scan the source and fail if
  `process.env.NEX_ALLOW_DEV_ADMIN` reappears.
- `src/lib/nex-native/routing/route-registry.ts:211, 231` — flags
  the route as requiring the env (metadata only, not enforcement).
- `src/lib/nex-native/directory/__tests__/owner-upload-trust-boundary.test.ts:109`
  — asserts the env check was replaced by role check.
- `src/components/nex-native/account-gate/SettingsHeaderSlot.tsx:54`
  — comment only.

### .env.local reality (from prior context, not re-read this session)

Per the task brief, `.env.local` currently has `NEX_ALLOW_DEV_ADMIN`
SET to a truthy value to support dev workflows. Confirming: the
task brief states *"I23 · NEX_ALLOW_DEV_ADMIN — confirm current
.env.local has it set (yes it does)"*.

### .env.example coverage

Line 412: `# NEX_ALLOW_DEV_ADMIN=`
Within section "4.2 · Dev-only shortcuts (not safe in production)"
with the warning: *"All must be absent/false in prod."*

## Why the current state is already SAFE but should be hardened

The 2026-* refactor retired the `process.env.NEX_ALLOW_DEV_ADMIN`
runtime check and replaced it with role-based gates (email-match
+ nex_admin_grant row). The regression tests (admin-action-role-
gates.test.ts lines 63-126) GUARD the retirement — any accidental
re-addition of `process.env.NEX_ALLOW_DEV_ADMIN` fails the suite.

So setting the env in prod would currently have NO security effect
on server actions. But the risk is NOT zero:

1. Future code might reintroduce a direct env read (tests only
   catch a subset of file patterns — e.g. a file with a dynamic
   string lookup could evade them).
2. UI copy / comments still reference the env name, confusing new
   contributors into thinking it's active.
3. Operational hygiene: production env should never contain
   dev-only flag names.

## Proposed runtime guard

Add a defensive top-level module that runs at server boot and
refuses when `NEX_ALLOW_DEV_ADMIN` is set AND `NODE_ENV ==="production"`:

```typescript
// src/lib/nex-native/guards/prod-env-refusals.ts
//
// Server-only · runs at module-load time. Lists env vars that MUST
// NOT be set in a production deployment because they would unlock a
// dev-only shortcut. Historically those shortcuts have been removed
// but keeping this guard prevents future regressions.

import "server-only";

interface ForbiddenEnv {
  name: string;
  reason: string;
}

const FORBIDDEN_IN_PRODUCTION: ReadonlyArray<ForbiddenEnv> = [
  { name: "NEX_ALLOW_DEV_ADMIN",
    reason: "Dev-only admin bypass, retired from runtime but must stay absent in prod" },
  { name: "NEX_DEV_ROUTES",
    reason: "Exposes /dev routes that leak server internals" },
  { name: "NEX_AGENT_INTERNET_FORCE_ONLINE",
    reason: "Dev-only · forces real HTTP in agent paths" },
  { name: "NEX_AGENT_INTERNET_FORCE_OFFLINE",
    reason: "Dev-only · suppresses agent HTTP in a way prod operators would not expect" },
  { name: "NEX_LOCAL_ONLY",
    reason: "Dev-only · gates localhost-only behaviour" },
];

export function assertProdEnvHygiene(): void {
  if (process.env.NODE_ENV !== "production") return;
  const violations = FORBIDDEN_IN_PRODUCTION.filter(
    (f) => typeof process.env[f.name] === "string" && process.env[f.name] !== "",
  );
  if (violations.length === 0) return;
  // Refuse to boot. A startup crash is honest: the deployment is
  // misconfigured and silently ignoring it would create a false
  // sense of security.
  const message = violations
    .map((v) => `  - ${v.name}: ${v.reason}`)
    .join("\n");
  throw new Error(
    "PROD env hygiene violation · forbidden dev envs are set:\n" +
      message +
      "\n\nRemove these from the Vercel production scope and redeploy.",
  );
}
```

Call site (owner must authorise): `src/middleware.ts` or
`src/instrumentation.ts` — one call at boot.

**Important caveat:** adding a call-site would change runtime
behaviour. That is a security PR, not an infra doc. I am NOT
adding it in this stream.

## Owner action

1. In Vercel production scope: confirm `NEX_ALLOW_DEV_ADMIN` is
   NOT set. (Dashboard → Project → Settings → Environment
   Variables → Production.) Expected: absent.
2. If present, delete it. This alone is enough for v1.
3. (Optional follow-up) Authorise the `assertProdEnvHygiene()`
   guard PR to make the check enforced at boot. This would ensure
   any future accidental set of `NEX_ALLOW_DEV_ADMIN` in Vercel
   prod crashes the deployment loud instead of silently accepted.
4. Keep `.env.local` with `NEX_ALLOW_DEV_ADMIN` set for the owner's
   dev workflow — the guard runs only when
   `NODE_ENV === "production"`.

## Validation command

Confirm the owner's dev-admin flow still works locally:

```bash
cd C:/Users/Victus/nexapp
# Requires .env.local to carry NEX_ALLOW_DEV_ADMIN=1 locally.
npm run dev
# Browse /nex-native and verify the owner-admin surfaces appear
# (these are gated by role, so a dev sign-in with the owner email
# matters more than the env flag; the env flag is historically
# allied with that flow).
```

Confirm no src code reads the env directly:

```bash
cd C:/Users/Victus/nexapp
grep -rn "process\.env\.NEX_ALLOW_DEV_ADMIN" src/ --include="*.ts" --include="*.tsx"
# Expected: zero output (or only matches in __tests__ files that
# ASSERT no live reads).
```

Run the regression test directly:

```bash
npm test -- src/app/nex-native/__tests__/admin-action-role-gates.test.ts
```

Expected: passes.

## What is NOT done here

- No `assertProdEnvHygiene()` module created (owner-approved
  follow-up).
- No `.env.example` edit (line 412 already present with correct
  warning).
- No `.env.local` modification.
- No Vercel dashboard change.
