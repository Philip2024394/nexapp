# NEX · WebAuthn Continuity Audit · 2026-10-31

**Purpose**: owner-mandated audit before any Indonesia-production Vercel-project rename or cutover. Owner's correction: *"preserving the hostname alone does not prove WebAuthn continuity. The actual production origin, relying-party ID, authentication configuration and credential verification flow must all be checked before any project transfer or cutover."*
**Status**: audit only. No code change. No project rename. Nothing cut over.

---

## 1 · How WebAuthn is configured today (code evidence)

**File**: `src/lib/nex-native/webauthn-config.ts` (sealed · unchanged).

**Resolution logic** (verbatim):
```ts
export function resolveWebauthnConfig(req?: Request): NexWebauthnConfig {
  const envRpID = process.env.NEX_WEBAUTHN_RP_ID?.trim();
  const envOrigin = process.env.NEX_WEBAUTHN_ORIGIN?.trim();
  const rpName = process.env.NEX_WEBAUTHN_RP_NAME?.trim() || "NEX";
  if (envRpID && envOrigin) {
    return { rpName, rpID: envRpID, origin: envOrigin };
  }
  if (req) {
    const url = new URL(req.url);
    return {
      rpName,
      rpID: url.hostname,
      origin: `${url.protocol}//${url.host}`,
    };
  }
  return { rpName, rpID: "localhost", origin: "http://localhost:3008" };
}
```

**Three resolution tiers, in order**:
1. If BOTH `NEX_WEBAUTHN_RP_ID` and `NEX_WEBAUTHN_ORIGIN` env vars are set → use them.
2. Else, if a request object is available → use the request's `Host` header (hostname + full origin).
3. Else → `localhost:3008` (CLI fallback).

## 2 · Production state today (observed)

- `.env.local` contains NO `NEX_WEBAUTHN_RP_ID` and NO `NEX_WEBAUTHN_ORIGIN` env vars.
- Vercel production project: `nexapp` (team `nex-0062`).
- Production URL (as reported by `vercel projects ls`): `https://nexapp-nex-0062.vercel.app`.
- Therefore, production uses **tier 2 fallback**: `rpID = "nexapp-nex-0062.vercel.app"`, `origin = "https://nexapp-nex-0062.vercel.app"`.

**Call sites** (confirmed existence, not re-verified at runtime):
- `src/app/api/nex-native/auth/webauthn/enroll-start/route.ts` — calls `resolveWebauthnConfig(req)` for enrolment challenge issuance.
- `src/app/api/nex-native/auth/webauthn/enroll-finish/route.ts` — calls `resolveWebauthnConfig(req)` for enrolment verification.
- `src/app/api/nex-native/auth/webauthn/assert-start/route.ts` — calls `resolveWebauthnConfig(req)` for authentication challenge.
- `src/app/api/nex-native/auth/webauthn/assert-finish/route.ts` — calls `resolveWebauthnConfig(req)` for authentication verification.

All four call sites use `resolveWebauthnConfig(req)` where `req` is the incoming Next.js API request. Therefore all four use the Host header fallback in production.

## 3 · What this means for Indonesia project transfer

**Vercel's URL-generation rule**: `{project-name}-{team-slug}.vercel.app`. The project NAME is part of the hostname. Renaming the project auto-changes the URL.

**If we rename `nexapp` → `nex-indonesia`**:
- New Vercel URL would be `nex-indonesia-nex-0062.vercel.app`.
- `url.hostname` changes from `nexapp-nex-0062.vercel.app` to `nex-indonesia-nex-0062.vercel.app`.
- The new `rpID` NO LONGER MATCHES the credentials stored in `nex_webauthn_credential` (which were enrolled against `nexapp-nex-0062.vercel.app`).
- **Every existing WebAuthn credential verification fails.** Every user who signs in via biometric would be locked out until they re-enrol.

**This is the exact scenario the owner's correction warned about.**

## 4 · Safe cutover design

### Option A · DO NOT rename the Vercel project (RECOMMENDED)

- Keep the Vercel project named `nexapp`.
- Set env vars on it:
  - `NEX_APP_IDENTITY=indonesia`
  - `NEX_APP_COUNTRY=ID`
  - (Optional defence) `NEX_WEBAUTHN_RP_ID=nexapp-nex-0062.vercel.app`
  - (Optional defence) `NEX_WEBAUTHN_ORIGIN=https://nexapp-nex-0062.vercel.app`
- Hostname preserved → `url.hostname` continues to match credential `rpID` → **WebAuthn credentials continue to verify**.
- UI/branding/palette switches to Indonesia because the identity resolver reads the env.
- "Project name" vs "Deployment identity" are decoupled: the project retains its label `nexapp` for operational clarity (and WebAuthn survival), while its identity to users is "NEX Indonesia".

**Pros**: zero credential disruption; zero sign-in rework.
**Cons**: the Vercel project name doesn't match its logical identity. Easily resolved by labelling it clearly in the Vercel dashboard description.

### Option B · Rename + re-enrol all users

- Rename `nexapp` → `nex-indonesia`.
- Issue a one-time re-enrolment prompt to every existing Indonesia user on next sign-in.
- Design the re-enrolment flow (not yet designed).
- Communicate to users beforehand.

**Pros**: Vercel project name matches logical identity.
**Cons**: breaks existing credentials; requires re-enrolment UX; user friction; owner coordination burden.

### Option C · Lock the env vars + rename later

- Rename immediately but set `NEX_WEBAUTHN_RP_ID=nexapp-nex-0062.vercel.app` + `NEX_WEBAUTHN_ORIGIN=https://nexapp-nex-0062.vercel.app` BEFORE the rename.
- Browser requests still hit the new URL (`nex-indonesia-nex-0062.vercel.app`), but the server reports `rpID=nexapp-...` and `origin=https://nexapp-...` back to the browser.
- **This BREAKS WebAuthn** because the browser compares the origin in `ClientDataJSON` (which it generated from the real URL) against the server's `origin` field. Mismatch → verification fails. Does NOT work.

**Verdict**: Option C is NOT a viable workaround. The browser-side origin is immutable.

### Option D · Add a custom domain

- Buy a custom domain (e.g. `nex.id` or whatever Indonesia should launch under).
- Point the custom domain at either `nexapp` OR a new `nex-indonesia` project.
- Set `NEX_WEBAUTHN_RP_ID=nex.id` + `NEX_WEBAUTHN_ORIGIN=https://nex.id` after enrolment migration.
- But existing credentials were enrolled against `nexapp-nex-0062.vercel.app`, so re-enrolment is still required UNLESS we keep the vercel.app URL ALSO reachable AND users re-enrol over time.

**Verdict**: viable long-term but not for the immediate preview-stage work.

---

## 5 · Recommended path for THIS programme

**Option A** · do NOT rename the existing `nexapp` project. Only set its env vars when owner authorises the Indonesia production cutover.

For the preview deployments being created now:
- Preview projects (`nex-ireland-preview`, `nex-indonesia-preview`) have different auto-generated hostnames (e.g. `nex-ireland-preview-nex-0062.vercel.app`).
- Previews have ZERO existing WebAuthn credentials.
- Users testing on preview will enrol credentials bound to the preview hostname.
- Those credentials live in the SANDBOX Supabase, not production.
- Nothing from preview WebAuthn touches production credentials.

**The owner's correction prevents a credential disaster.** My prior commit message (`6b4baec`) said "rename this project to `nex-indonesia`" — that was WRONG. Noting that correction explicitly here so future reads of the commit history see the superseded recommendation.

---

## 6 · What this audit does NOT claim

- It does NOT claim current WebAuthn works in production (there are no users with WebAuthn credentials verified by this audit — the owner should confirm separately whether the sealed `nex_webauthn_credential` table currently has rows).
- It does NOT run a verification against the production endpoint.
- It does NOT propose a rename plan.
- It does NOT change any env var.
- It does NOT touch the Vercel project.

## 7 · Owner-level action items from this audit

| # | Item | Status |
|---|---|---|
| W-1 | Supersede the prior "rename to nex-indonesia" recommendation. **Keep project name as `nexapp`.** | **Captured** |
| W-2 | Set NEX_APP_IDENTITY + NEX_APP_COUNTRY on the existing `nexapp` project at Indonesia cutover time | pending separate owner authorisation |
| W-3 | Decide longer-term: keep vercel.app hostname forever, or migrate to a custom domain with a credential-re-enrolment programme | pending |
| W-4 | Confirm current count of rows in `nex_webauthn_credential` to understand real impact scope | pending (owner-run query recommended) |

---

*Audit 2026-10-31. No code change. No env change. No project rename. No cutover.*
