# I11 · WebAuthn relying-party identity · env-var hardening

**Author:** Stream C · 2026-11-16
**Scope:** Document-only. No code changes. No prod access.
**Related:** `src/lib/nex-native/webauthn-config.ts`, .env.example lines 181-206

---

## Current state (evidence)

`src/lib/nex-native/webauthn-config.ts` lines 23-39 resolve the
WebAuthn relying-party config like this:

```typescript
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

**Security concern:** when BOTH `NEX_WEBAUTHN_RP_ID` and
`NEX_WEBAUTHN_ORIGIN` are unset in production, the resolver derives
them from the request `URL` (effectively the `Host` header after
proxy normalisation). The Host header is attacker-influenceable in
some deployment topologies (misconfigured upstream proxy, direct
hit bypassing CDN, etc.). WebAuthn's security model requires the
relying-party ID to be a FIXED attribute of the origin so a credential
scoped to `nex.app` cannot be used against `attacker.app` even if the
server receives a spoofed Host header.

.env.example already names the three env vars (lines 199, 202, 206)
and the 2.3 section header carries the warning text, but the
runtime code keeps the Host-derived fallback, so in prod you MUST
set the envs — unset is NOT a safe default.

## Required state

Production Vercel scope MUST set:

- `NEX_WEBAUTHN_RP_ID` — DNS hostname only (no scheme, no port, no
  path, no trailing slash). Example: `nex.app`.
- `NEX_WEBAUTHN_ORIGIN` — full HTTPS origin. Example:
  `https://nex.app`. Must satisfy: RP_ID is a registrable domain
  suffix of ORIGIN.
- `NEX_WEBAUTHN_RP_NAME` — human-readable; optional. Defaults to
  `"NEX"` when unset.

Per-environment values the owner will need:

| Environment    | NEX_WEBAUTHN_RP_ID | NEX_WEBAUTHN_ORIGIN       |
| -------------- | ------------------ | ------------------------- |
| prod (Ireland) | `nex.app`          | `https://nex.app`         |
| prod (WW)      | `nex.app`          | `https://nex.app`         |
| preview        | `vercel.app`       | NOT WebAuthn-eligible — WebAuthn credentials created on `*.vercel.app` will fail on apex and vice versa. Owner should decide: either disable WebAuthn on preview, or scope preview to a dedicated subdomain and ignore preview creds. |
| local dev      | `localhost`        | `http://localhost:3008`   |

RP_ID being `localhost` + ORIGIN `http://localhost:…` is the one
case the WebAuthn spec explicitly permits HTTP.

## Owner action

1. Decide the production apex domain. Do not change it later —
   every WebAuthn credential already registered on the old apex
   becomes orphaned. (This is a WebAuthn protocol property, not a
   NEX limitation.)
2. Set the three env vars in Vercel production scope exactly.
3. Decide the preview-scope policy. Recommended: set
   `NEX_WEBAUTHN_RP_ID=preview.nex.app` and
   `NEX_WEBAUTHN_ORIGIN=https://preview.nex.app` on a dedicated
   preview subdomain so previews don't accidentally create
   production-registrable credentials, OR just block WebAuthn in
   preview by refusing to call `resolveWebauthnConfig` when
   `VERCEL_ENV === "preview"`.
4. OPTIONAL hardening PR (not in this stream's scope): refuse the
   Host-derived fallback in production. Suggested diff:

   ```typescript
   // in resolveWebauthnConfig, after the envRpID+envOrigin check:
   if (process.env.NODE_ENV === "production") {
     throw new Error(
       "WebAuthn RP config missing in production. " +
       "Set NEX_WEBAUTHN_RP_ID and NEX_WEBAUTHN_ORIGIN in Vercel.",
     );
   }
   ```

   This would make the "forgot to set the env" failure loud instead
   of silently accepting Host-derived (and spoofable) config.
   Owner must approve this separately — it changes runtime
   behaviour.

## Validation command

After owner sets the envs in Vercel prod:

```bash
# Confirms the env vars are both parsed correctly.
# Does NOT exercise Vercel. Prod validation requires a real browser.

cd C:/Users/Victus/nexapp
NEX_WEBAUTHN_RP_ID=nex.app \
NEX_WEBAUTHN_ORIGIN=https://nex.app \
node -e "
  const { resolveWebauthnConfig } = require('./src/lib/nex-native/webauthn-config');
  const cfg = resolveWebauthnConfig();
  console.log(JSON.stringify(cfg, null, 2));
  if (cfg.rpID !== 'nex.app' || cfg.origin !== 'https://nex.app') {
    process.exit(1);
  }
"
```

Then in prod browser: Dev-Tools → Network → sign-in flow → verify
the `/api/nex-native/auth/webauthn/options` response carries
`rp.id === "nex.app"` and the subsequent `/verify` call does not
fail with `rp id mismatch`.

## What is NOT done here

- No runtime hardening to refuse the Host fallback (deferred to
  owner-approved follow-up).
- No `.env.example` edit (already covers these vars at lines 199,
  202, 206). This document adds missing per-region guidance.
- No Vercel configuration. Owner's action.
