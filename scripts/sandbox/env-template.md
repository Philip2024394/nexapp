# Sandbox env-var template · 2026-10-31

**Purpose**: a visible, auditable list of exactly which env vars go on each Vercel preview project after sandbox is created. Nothing is set until the owner reviews this template.

**Hard rule**: `NEXT_PUBLIC_NEX_SUPABASE_URL` on preview projects points to the SANDBOX project ONLY. It MUST NOT contain the string `ijvqdvsvwtwxzcqmoqit` (production project ID). The G-PREVIEW-ISOLATION boot guard enforces this at runtime; this template enforces it at configuration time.

---

## Preview project: `nex-ireland-preview`

| Env var | Value |
|---|---|
| `NEX_APP_IDENTITY` | `ireland` |
| `NEX_APP_COUNTRY` | `IE` |
| `NEXT_PUBLIC_NEX_SUPABASE_URL` | `https://<SANDBOX_PROJECT_REF>.supabase.co` |
| `NEX_SUPABASE_URL` | `https://<SANDBOX_PROJECT_REF>.supabase.co` |
| `NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY` | `<SANDBOX_ANON_KEY>` |
| `NEX_SUPABASE_SERVICE_ROLE_KEY` | `<SANDBOX_SERVICE_ROLE_KEY>` |
| `DATABASE_URL` | `<SANDBOX_POOLER_URL>` |
| `NEX_POSTGRES_URL` | `<SANDBOX_POOLER_URL>` |
| `NEX_WORLD_PREVIEW_SIGNING_KEY` | (generate new 32-byte hex for sandbox · do NOT reuse production) |
| `VERCEL_ENV` | `preview` (set automatically by Vercel) |

**NOT set on this project**:
- `NEX_DEV_IMPERSONATE_HANDLE` (dev-only; never production/preview)
- Any production Supabase credentials
- Any WebAuthn RP overrides (fall back to request Host header; preview hostname will be e.g. `nex-ireland-preview-nex-0062.vercel.app`)

---

## Preview project: `nex-indonesia-preview`

Same as above but with:

| Env var | Value |
|---|---|
| `NEX_APP_IDENTITY` | `indonesia` |
| `NEX_APP_COUNTRY` | `ID` |

Everything else identical. Both point to the SAME sandbox Supabase project.

---

## Existing project: `nexapp` (= current Indonesia production · DO NOT TOUCH)

Per the WebAuthn continuity audit (`docs/doctrine/nex-webauthn-continuity-audit-2026-10-31.md`), this project MUST NOT be renamed or reconfigured as part of the sandbox + preview work. Its env vars are untouched until the owner authorises Indonesia production cutover (a separate step).

At cutover time (NOT NOW), the owner will add:

| Env var | Value |
|---|---|
| `NEX_APP_IDENTITY` | `indonesia` |
| `NEX_APP_COUNTRY` | `ID` |

And nothing else. Hostname stays `nexapp-nex-0062.vercel.app`. WebAuthn credentials remain valid.

---

## Verification after Vercel env is set

Run against each preview URL:

```sh
# Should return 200 and 'ireland' / 'indonesia' chrome
curl -s https://<ireland-preview-url>/nex-native/sign-in | grep -o 'data-nex-world-root="[a-z0-9-]*"'
curl -s https://<indonesia-preview-url>/nex-native/sign-in | grep -o 'data-nex-world-root="[a-z0-9-]*"'
```

Expected:
- Ireland preview → `data-nex-world-root="ireland"` + `--nex-world-primary: #1F8B4C`
- Indonesia preview → `data-nex-world-root="indonesia"` + `--nex-world-primary: #C8102E`

Both responses contain `data-nex-sandbox-boot-check="safe"` (if the G-PREVIEW-ISOLATION guard emits a hint — current implementation throws on misconfig, so a successful response IS the proof).
