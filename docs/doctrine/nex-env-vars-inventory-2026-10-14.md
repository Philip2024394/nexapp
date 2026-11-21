# NEX · B1 · production environment-variable inventory

Date: 2026-10-14

Companion to:
- `docs/doctrine/nex-global-launch-readiness-2026-10-14.md` (Phase F named this B1 as the single highest-priority blocker)
- `docs/doctrine/nex-single-source-of-truth-verification-2026-10-14.md` (confirmed canonical Supabase project)
- `nexapp/CLAUDE.md §8` (sealed Supabase project rule 2026-10-12)

---

## 0 · Executive summary · the numbers

| Metric | Count | Source method |
|---|---|---|
| Unique `process.env.*` references across `src/` + `scripts/` | **327** | `grep -rhoE "process\.env\.[A-Z][A-Z0-9_]+"` + `sort -u` |
| Of those, consumed by nex-native user-facing code paths (`src/lib/nex-native/*`, `src/app/nex-native/*`, `src/middleware.ts`) | **61** | Same grep restricted to those paths |
| Of those, consumed by legacy `src/lib/nex/*` monorepo-residue code paths (LLM, agents, brain, lab, programmer, workforce, delivery, etc.) | **266** | 327 − 61 |
| Keys actually present in `.env.local` (names only · values never read or printed) | **118** | `awk -F= '/^[A-Z]/{print $1}' .env.local` (prints key before `=` sign only) |
| Code expects var, `.env.local` does NOT have it | **266** | `comm -23 <code-vars> <env-local-keys>` |
| `.env.local` has key, no code reference | **57** | `comm -13 <code-vars> <env-local-keys>` |
| Keys present in both (actively used) | **61** | `comm -12 <code-vars> <env-local-keys>` |
| Keys listed in `.env.example` | **2** | File read in full: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Those 2 keys · evidence of staleness | **Both flagged as LEGACY** by nexapp CLAUDE.md §8 | Point at `msdonkkechxzgagyguoe` project per that doctrine |

**Headline findings:**

1. The repository claims to require 2 env vars (via `.env.example`) but the code reads 327 distinct variables. The two documented variables both point at a Supabase project that CLAUDE.md §8 explicitly flags as NOT the NEX project.
2. The **61 nex-native-critical variables** are the ones a Phase 1 operator must get right. They are inventoried individually in §Section A below.
3. The remaining **266 variables** live in the shared `src/lib/nex/*` layer which the local `CLAUDE.md` describes as "known legacy residue … may not exist in the NEX Supabase project … Surfaces that hit those code paths will fail at runtime until migrated." Phase 1 launch does not need these configured, but code paths that transitively import them may need defensive handling.
4. **No `STRIPE_*` env var is read anywhere.** Stripe is in `package.json` deps but is referenced only by a safe-logging regex in `src/lib/nex/observability/redact.ts:19`. This confirms the Phase F finding that payment integration is NOT WIRED.
5. The `.env.local` on disk has **57 keys the code never reads** — accumulated legacy configuration from the monorepo era. These are candidates for cleanup but are not safety-critical.

---

## Section A · nex-native-critical env vars (the 61)

These are the variables consumed by user-facing nex-native code paths. **An operator must set these correctly for Phase 1 to work.** Grouped by subsystem.

### A.1 · Supabase (canonical NEX project)

| Variable | Req | Exp | Subsystem consumer | Format | When needed | Safe validation | Evidence? |
|---|---|---|---|---|---|---|---|
| `NEX_SUPABASE_URL` | **required** | server | `src/lib/nex-native/supabase-admin.ts:31` + fallback for `NEXT_PUBLIC_NEX_SUPABASE_URL` | HTTPS URL ending in `.supabase.co` | always · server-side admin client | `curl -I <url>/rest/v1/` returns `401` (confirms project reachable); verify project ID matches `ijvqdvsvwtwxzcqmoqit` | **Yes** · `CLAUDE.md §8` records the exact project |
| `NEX_SUPABASE_SERVICE_ROLE_KEY` | **required** | server | `src/lib/nex-native/supabase-admin.ts:32` | JWT-formatted service-role key (JSON header + payload + signature, three dot-separated base64 segments) | always · server-side admin writes | Decode JWT header client-side without network; confirm `role: "service_role"` claim; never log the full token | **No** · must come from Supabase project settings · operator action required |
| `NEXT_PUBLIC_NEX_SUPABASE_URL` | **required** | **public** | `src/middleware.ts:3` (edge auth refresh), `src/lib/nex-native/realtime/client.ts`, 15+ nex-native client surfaces | HTTPS URL identical in value to `NEX_SUPABASE_URL` | always · client-side SSR + realtime | Confirm it equals `NEX_SUPABASE_URL` | **Yes** |
| `NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY` | **required** | **public** | `src/middleware.ts:4`, client-side Supabase helpers | JWT-formatted anon key | always · client-side SSR + realtime | Decode JWT, confirm `role: "anon"` claim | **No** · must come from Supabase project settings |

### A.2 · Supabase (LEGACY · detect-and-reject only)

| Variable | Req | Exp | Subsystem consumer | Purpose | Safe validation | Evidence? |
|---|---|---|---|---|---|---|
| `SUPABASE_URL` | **should NOT be set** | server | `src/lib/llm/voiceTraining.ts:21` (legacy fallback) | Legacy env name · if set would point at a non-canonical project | Verify absent | — |
| `SUPABASE_SERVICE_ROLE_KEY` | **should NOT be set** | server | `src/lib/llm/voiceTraining.ts:22` (legacy fallback) | Legacy service-role · must NOT be relied on | Verify absent | — |
| `NEXT_PUBLIC_SUPABASE_URL` | **documented stale** | public | `src/lib/nex-native/realtime/client.ts:67` (named `legacyUrl` in code) | Legacy env name · per CLAUDE.md §8 points at `msdonkkechxzgagyguoe` · `realtime/client.ts` explicitly rejects this if set | Verify absent in production env (even though `.env.local` currently includes it per CLAUDE.md §8) | **Yes** · CLAUDE.md §8 documents the staleness |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **documented stale** | public | `src/lib/nex-native/realtime/client.ts:68` (named `legacyAnon`), `src/lib/llm/voiceTraining.ts:24` | Legacy anon key · same posture as above | Verify absent in production env | **Yes** |

**Note on `.env.example`.** The two variables listed in `.env.example` today are these two LEGACY variables. **This is incorrect-by-doctrine** per CLAUDE.md §8 and must be fixed in a separate authorised PR (not this task). An operator reading `.env.example` as-is would configure the wrong Supabase project.

### A.3 · Postgres direct (via Supabase pooler)

| Variable | Req | Exp | Subsystem consumer | Format | When needed | Safe validation | Evidence? |
|---|---|---|---|---|---|---|---|
| `NEX_POSTGRES_URL` | **conditional** | server | Directory canonical layer reads (`src/lib/nex/db/*` consumers used from nex-native directory service) | `postgres://` connection string via pooler · host `aws-0-eu-west-1.pooler.supabase.com` | When directory canonical reads happen (per CLAUDE.md §8: "nexapp currently uses `localhost:5433`; switching to Supabase requires either applying migrations or using Supabase REST client") | Confirm host matches the pooler endpoint; refuse `localhost` in production | **Partial** · CLAUDE.md §8 says this currently points at `localhost:5433` for local dev; production value is a decision pending |
| `NEX_CANONICAL_PG_URL` | **conditional** | server | Canonical directory layer alt-connection | Same as `NEX_POSTGRES_URL` | Where used in canonical pipelines | Same as above | Same decision pending |
| `DATABASE_URL` | **conditional** | server | Alternative Postgres connection fallback (several `src/lib/nex-native/*` paths) | `postgres://` connection string | Where used | Same as above | Partial |

**Blocker · unresolved operator decision.** Per CLAUDE.md §8 line 73-77: "`NEX_POSTGRES_URL` currently points at `localhost:5433` (local `nex_dev`). The directory read path uses this env var. Switching nexapp to read from Supabase requires either (a) applying the directory canonical migrations to Supabase and setting `NEX_POSTGRES_URL` to the Supabase pooler, or (b) changing the `@/lib/nex/db` layer to use the Supabase REST client." **Decision required: a or b.** Not inside the scope of this inventory to pick.

### A.4 · Public app base URLs

Multiple vars with overlapping purpose · one of the identified cleanup opportunities.

| Variable | Req | Exp | Subsystem consumer | Format | When needed | Safe validation | Evidence? |
|---|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_APP_BASE_URL` | **required** | public | Shared base URL for client-side navigation / shareable links | `https://nex.app` or production URL | Always | HTTP HEAD check; must match deployed URL | **Not resolved** · needs the canonical production URL confirmed |
| `NEXT_PUBLIC_BASE_URL` | optional (alt) | public | Legacy alias · some files read either | Same URL | Always | Same | **Not resolved** · operator should set only one of these for Phase 1 |
| `NEXT_PUBLIC_NEX_BASE_URL` | optional (alt) | public | Yet another alias for the public URL | Same URL | Always | Same | **Not resolved** |
| `NEXT_PUBLIC_SITE_URL` | optional (alt) | public | Another alias | Same URL | Always | Same | **Not resolved** |
| `NEX_PUBLIC_APP_BASE_URL` | optional (alt) | server-only mirror of the public | Same URL | For server-only equivalents | Same | **Not resolved** |
| `NEX_PUBLIC_BASE_URL` | optional (alt) | server-only mirror | Same URL | Same | Same | **Not resolved** |

**Finding:** Six variables for essentially the same value ("where is this app deployed"). Operator must pick one canonical and point all others at it, or (preferred) a code consolidation PR picks one and deletes the others. Flagging as a separate cleanup opportunity.

### A.5 · Launch flags

| Variable | Req | Exp | Subsystem consumer | Format | Default | Safe validation |
|---|---|---|---|---|---|---|
| `NEX_COMMERCE_ENABLED` | optional | server | `src/lib/nex-native/launch-flags.ts:27-35` | `"1" \| "true" \| "yes"` → true; anything else → false | **false** (Phase 1 chat+themes doctrine) | Parse per sealed logic |
| `NEX_SEARCH_ENABLED` | optional | server | `src/lib/nex-native/launch-flags.ts:80-88` | Same parse logic | **false** (Phase 1 search still hidden) | Same |

**Doctrine note:** Both default off. For Phase 1 launch (chat + themes) both stay off. Admin bypass via `?commerce=1` or `?search=1` query string is sealed and intentional for internal testing · see §Section G for the production-risk flag.

### A.6 · WebAuthn (sign-in)

| Variable | Req | Exp | Subsystem consumer | Format | When needed | Safe validation | Evidence? |
|---|---|---|---|---|---|---|---|
| `NEX_WEBAUTHN_RP_ID` | **conditional** | server | `src/lib/nex-native/webauthn-config.ts:24` | DNS hostname (e.g. `nex.app`) · must match the deployed origin's host | Required for WebAuthn enroll/assert to produce device-portable credentials | Confirm matches `location.hostname` of the deployed origin; must not be empty in production | **No** · needs production URL decision first |
| `NEX_WEBAUTHN_ORIGIN` | **conditional** | server | `src/lib/nex-native/webauthn-config.ts:25` | HTTPS origin (e.g. `https://nex.app`) · must match the browser-visible origin exactly | Same as above | Confirm matches the deployed `window.location.origin` | **No** |
| `NEX_WEBAUTHN_RP_NAME` | optional | server | `src/lib/nex-native/webauthn-config.ts:26` | Human-readable string (default `"NEX"`) · shown in the WebAuthn consent prompt | Any time | Any non-empty string | Yes · default `"NEX"` acceptable |

**Note:** If RP_ID or ORIGIN are not set, the code at `webauthn-config.ts:30+` falls back to deriving them from the incoming request Host header, which **is a security risk in production** (a malicious Host header could cross-origin trick the browser). The brief's phrase "safe validation method" applies here: an operator must set `NEX_WEBAUTHN_RP_ID` and `NEX_WEBAUTHN_ORIGIN` explicitly in production and not rely on the request-header fallback.

**TypeScript error** (see global launch report Phase E): `@simplewebauthn/server@11` renamed `RegistrationResponseJSON` and `AuthenticationResponseJSON`. This affects the API routes at `src/app/api/nex-native/auth/webauthn/*` and must be fixed before WebAuthn sign-in works end-to-end. Separate workstream (B4 in the global launch report).

### A.7 · Push notifications (VAPID / Web Push)

| Variable | Req | Exp | Subsystem consumer | Format | Safe validation | Evidence? |
|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY` | **conditional** | **public** | Browser-side push-subscription registration | VAPID public key (base64url) | Decode base64url · verify ~87-byte length | **No** · operator must generate a VAPID keypair (`web-push generate-vapid-keys`) |

**Note on naming:** The `XRATED_` prefix is legacy monorepo residue (xrated-trades). The variable still works but reads wrong-looking. Candidate for rename to `NEX_VAPID_PUBLIC_KEY` in a separate code-cleanup PR.

**Companion server-only pair not reached by this nex-native grep but required for push to work end-to-end:** `XRATED_VAPID_PRIVATE_KEY`, `XRATED_VAPID_SUBJECT` — found in the full 327-list. Server-side push sender needs both. See §Section B for the subsystem rollup.

### A.8 · Cron / scheduled jobs

| Variable | Req | Exp | Subsystem consumer | Format | Safe validation |
|---|---|---|---|---|---|
| `CRON_SECRET` | **required if any cron exists** | server | Vercel cron auth guard in `src/app/api/nex-native/harvest/tick/route.ts` and similar | Random 32+ byte hex/base64 string | Verify length ≥ 32; use `crypto.timingSafeEqual` in-app checks (confirm the code does this · follow-up) |
| `NEX_HARVEST_CRON_SECRET` | optional alt | server | Harvest-specific cron auth | Same shape | Same |

Vercel `vercel.json` declares one cron: `/api/nex-native/harvest/tick` hourly at `0 * * * *`. For that cron to work in production, one of the above must be set and the route must `require` it.

### A.9 · Admin / dev shortcuts

| Variable | Req | Exp | Purpose | Risk if misconfigured |
|---|---|---|---|---|
| `NEX_ALLOW_DEV_ADMIN` | optional | server | Grants a dev admin bypass on certain surfaces | **If enabled in production** could expose admin-only features |
| `NEX_DEV_ROUTES` | optional | server | Enables routes under `/nex-native/dev/*` | Same risk · must be absent/false in prod |
| `NEX_FAMILY_SAFETY_ID_ADMIN_READER_TOKEN` | admin-only | server | Read access for family-safety ID verification admin tooling | High sensitivity · bearer token · must not be exposed |

**Blocker (production hygiene):** these three must be verified absent/false in production or they constitute a privilege-escalation surface. Flag as acceptance test.

### A.10 · Backpressure, autoscale, worker circuits (16 vars)

Grouped (not individually inventoried · operator-tunable with sensible defaults in-code):

| Prefix | Count | Default behaviour if unset |
|---|---|---|
| `NEX_BACKPRESSURE_*` | 4 | Hardcoded fallbacks in `src/lib/nex-native/backpressure.ts` (`maxQueued=3`, `globalSoft=500`, `globalHard=5000`, `oldestWarn=60s`) |
| `NEX_AUTOSCALE_*` | 7 | Fallbacks in worker-autoscaler code · operator overrides for prod capacity |
| `NEX_WORKER_CIRCUIT_*` | 4 | Fallbacks for circuit-breaker timing · operator overrides for stability |
| `NEX_INPROCESS_LOAD_TIMEOUT_MS` | 1 | Default load timeout |

**Verdict:** None are launch-blocking for Phase 1 chat+themes · all have in-code defaults. Flag for Phase 2+ tuning if the system is scaled.

### A.11 · Emergency help / Family Safety SafeChat

| Variable | Req | Exp | Default behaviour | Phase 1 safe default |
|---|---|---|---|---|
| `NEX_EMERGENCY_DEFAULT_RADIUS_KM` | optional | server | In-code default | Operator-set only if emergency help is enabled |
| `NEX_EMERGENCY_EMAIL_REAL_SEND` | optional | server | If false, emails are mock | **FALSE for Phase 1** unless real email provider configured and the Family Safety release gate authorises it |
| `NEX_EMERGENCY_HELP_ENABLED` | optional | server | Gates /emergency-help surface | Operator decision per market |
| `NEX_EMERGENCY_LIVE_MODE` | optional | server | Enables live emergency flow | Operator decision |
| `NEX_EMERGENCY_WIDER_COMMUNITY_ENABLED` | optional | server | Expands notification radius | Operator decision |
| `NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED` | optional | server | Enables SafeChat Phase 1 observability log | On for staging, decision for prod |
| `NEX_SAFECHAT_USER_FACING_ENABLED` | optional | server | Gates user-facing SafeChat UI | **FALSE for Phase 1** unless the SafeChat Phase 1 release gate authorises |

### A.12 · Themes

| Variable | Req | Exp | Default | Purpose |
|---|---|---|---|---|
| `NEX_THEMES_IMMERSIVE_PREVIEW` | optional | server | false | Enables an immersive theme preview mode |
| `NEX_THEMES_PHONE_TILES` | optional | server | false | Enables the phone-tile preview mode |

Neither launch-blocking.

### A.13 · Engine health + telemetry + surface health

| Variable | Req | Exp | Purpose |
|---|---|---|---|
| `NEX_ENGINE_HEALTH_CACHE_TTL_MS` | optional | server | Health-endpoint cache TTL |
| `NEX_ENGINE_TELEMETRY_CAPACITY` | optional | server | Ring buffer size for in-memory telemetry |
| `NEX_SURFACE_HEALTH_TEST_BRIDGE` | optional | server | Bridge for surface-health test injection |

Not launch-blocking.

### A.14 · Cross-DB reconciler

| Variable | Req | Exp | Purpose | Phase 1 safe default |
|---|---|---|---|---|
| `NEX_CROSS_DB_RECONCILER_ENABLED` | optional | server | Reconciles data between source DBs | **FALSE for Phase 1** unless explicitly authorised |
| `NEX_CROSS_DB_RECONCILER_SIMULATE_ONLY` | optional | server | Dry-run mode | TRUE if ENABLED=true for safety |

### A.15 · MaxMind GeoIP

| Variable | Req | Exp | Purpose |
|---|---|---|---|
| `NEX_MAXMIND_DB_PATH` | optional | server | Filesystem path to the MaxMind GeoLite2 City database for IP → location lookup | Needed only if geo-based features are enabled (e.g. Community Lost&Found zone suggestion). File must exist at the given path on the server. |

### A.16 · Framework / platform

| Variable | Req | Exp | Who sets it |
|---|---|---|---|
| `NODE_ENV` | implicit required | server | Set by `next build` / `next start` / `next dev` · `"production"` for prod · never set manually |

---

## Section B · Legacy `src/lib/nex/*` subsystem rollup (266 vars)

**These are NOT inventoried individually** because (a) they are concentrated in the legacy infra layer the local CLAUDE.md calls "known legacy residue" and (b) Phase 1 launch (chat + themes) does not depend on them. However, several code paths in nex-native transitively import `src/lib/nex/*` modules, so **some of these may fail at runtime on first touch**.

### Subsystem rollup (by prefix / purpose)

| Subsystem | Representative vars | Phase 1 impact | Action |
|---|---|---|---|
| **LLM providers** | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GEMINI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, `CEREBRAS_API_KEY`, `SAMBANOVA_API_KEY`, `HUGGINGFACE_API_KEY`, `CLOUDFLARE_WORKERS_AI_TOKEN`, `NEX_LOCAL_LLM_URL`, `NEX_OLLAMA_*` | **Partial** · chat has no LLM auto-reply in Phase 1 (chat is human-to-human). But `nex-reply` route exists in API inventory · if touched it will fail without a provider configured. | **For Phase 1 chat+themes launch · unset is acceptable.** The route path can be gated behind a feature flag or guarded. Separate decision. |
| **LLM provider chain** | `LLM_PROVIDER_CHAIN`, `LLM_ALLOW_MOCK_FALLBACK` | Same as above | — |
| **Email providers** | `RESEND_API_KEY`, `MAILGUN_API_KEY`, `SENDGRID_API_KEY`, `POSTMARK_API_TOKEN`, `NEX_DELIVERY_*` (12 vars), `NEX_SMTP_*` (7 vars), `NEX_EMAIL_PROVIDER` | **Required for Phase 1** if any transactional emails ship (sign-up verification, password reset, invite). | Operator must pick ONE provider and set its vars. Multiple vars for the same purpose · must consolidate on one path. |
| **OAuth** | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` | **Required** if social sign-in is enabled; **optional** otherwise. | Operator choice |
| **WhatsApp (Meta Business API)** | `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_OTP_TEMPLATE_LANG`, `META_WHATSAPP_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_TEMPLATE_NAME`, `NEX_META_*`, `NEX_WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Only needed if WhatsApp OTP/notification is used. | Operator choice |
| **SMS (Twilio)** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TWILIO_MESSAGING_SERVICE_SID` | Only if SMS notifications are enabled. | Operator choice |
| **S3 / Cloudflare R2 / MinIO storage** | `AWS_ACCESS_KEY_ID`, `AWS_REGION`, `R2_*` (4 vars), `NEX_MINIO_*` (5 vars), `NEX_OBJECT_BACKEND`, `NEX_STORAGE_BACKEND`, `NEX_APPROVED_STORAGE_HOSTS` | **Only Supabase storage is used by nex-native**; the other backends are legacy. **Verify `NEX_STORAGE_BACKEND=supabase` or equivalent for Phase 1.** | Operator decision |
| **Observability / alerting** | `NEX_ALERT_*` (6 vars), `NEX_ALERTS_*` (6 vars) | **Blocker-adjacent:** Stage 1.1 fail-open warn + migration-197 posture both require a working alerting path. | Pick one · webhook URL + severity threshold |
| **Author studio** | `NEX_AUTHOR_ALLOWLIST`, `NEX_AUTHOR_COOKIE_SECRET`, `NEX_AUTHOR_INVITE_SECRET`, `NEX_AUTHOR_STUDIO_ENABLED` | Legacy monorepo feature. **Should be disabled / unset in production.** | Operator |
| **Brain / Agent runtime / Lab / Programmer / Workforce** | `NEX_BRAIN_*` (8 vars), `NEX_AGENT_*` (4 vars), `NEX_LAB_*` (3 vars), `NEX_PROGRAMMER_*` (4 vars), `NEX_WORKFORCE_*` (1 var), `NEX_SIMULATOR_*`, `NEX_SCALE_LARGE`, `NEX_P0_*` (6 vars), `NEX_P1_*` (7 vars) | Legacy "nex-agent" runtime from the monorepo era · **not needed for Phase 1 chat+themes**. | **Default: unset in production.** Code paths that touch these should degrade gracefully. |
| **Image generation / vision** | `NEX_IMAGE_GEN*` (3 vars), `NEX_VISION*` (5 vars), `NEX_SD_*` (2 vars), `NEX_PIPER_*`, `NEX_WHISPER_MODEL`, `NEX_OCR_*` (2 vars), `NEX_PERCEPTUAL_HASH_PROVIDER`, `NEX_VOICE_PROVIDER` | Legacy monorepo features · **not needed for Phase 1**. | **Default: unset in production.** |
| **Idempotency / data roots** | `NEX_*_DATA_ROOT` (6 vars), `NEX_IDEMPOTENCY_DATA_ROOT`, `NEX_SEMANTIC_MEMORY_DATA_ROOT`, `NEX_USER_FACT_STORE_DIR`, `NEX_LIVE_DATA_ROOT`, `NEX_L4_*_DIR`, `NEX_ISG_DATA_ROOT`, `NEX_FILES` | Legacy on-disk cache paths · operator should NOT configure these in production (serverless · no persistent filesystem) | Flag as "should be unset" |
| **Local Postgres (dev-only)** | `NEX_LOCALPG_PASSWORD`, `NEX_LOCALPG_PORT`, `NEX_LOCALPG_USER` | Dev-only · must NOT be set in production | Flag as "must be unset in prod" |
| **DNS resolvers / internet forcing** | `NEX_DNS_RESOLVERS`, `NEX_AGENT_INTERNET_FORCE_OFFLINE`, `NEX_AGENT_INTERNET_FORCE_ONLINE`, `NEX_LOCAL_ONLY`, `NEX_ISP_STATUS` | Dev-only / test-only | Flag as "must be unset in prod" |
| **Fly.io machine runtime** | `FLY_MACHINE_ID`, `HOSTNAME`, `PORT`, `NODE_OPTIONS` | Platform-set · operator does NOT set these | Framework contract |
| **Hammerex monorepo residue** | `HAMMEREX_TRADE_FROM_EMAIL`, `NEXT_PUBLIC_HAMMEREX_SITE_URL` | Legacy xrated/hammerex-only (per nexapp CLAUDE.md fork boundary) · should NOT be referenced in nexapp but still appears | Candidate for removal / audit |
| **Member / marketing** | `NEX_MARKETING_BASE_URL`, `NEX_MARKETING_UNSUB_SECRET`, `NEX_MEMBER_TOKEN_SECRET`, `NEX_COMPLIANCE_RESET_SOFT_ON_DELIVERED`, `NEX_COMPLIANCE_SOFT_BOUNCE_THRESHOLD` | Marketing emails only · Phase 1 scope decision | Operator |
| **Founder mode** | `NEX_FOUNDER_MODE_PASSWORD`, `NEX_FOUNDER_MODE_SECRET`, `NEX_FOUNDER_MODE_TTL_SEC`, `NEX_FOUNDER_SUPABASE_USER_ID` | Admin bypass · requires explicit setup, high sensitivity | Operator decision |
| **Gates / alignment** | `NEX_GATE_*` (5 vars), `NEX_RETRIEVAL_TELEMETRY`, `NEX_TURN_TELEMETRY` | LLM gate testing (legacy) · unset for Phase 1 | Default unset |
| **Rate limiting (general)** | `NEX_RATE_LIMIT_PER_MIN`, `NEX_RATE_LIMIT_WINDOW_MS` | Operator-tunable with in-code defaults | Default OK |
| **Session secret** | `NEX_SESSION_SECRET` | **Required** if cookie-signed sessions are used · high sensitivity | Must be set to random 32+ byte string |
| **Encryption** | `ENC_KEY`, `NEX_TRACKING_FP_SALT` | **Required** · encryption keys · high sensitivity | Must be set · random 32+ byte string |
| **MaxMind / HQ / Research / Response model / Tone / BPJPH / Autoscale** | Various | Mostly legacy or Phase 2+ | Operator decision |

---

## Section C · `.env.example` discrepancy · documented stale

### Current state

`.env.example` at the repo root (193 bytes · 5 lines) reads:

```
# Supabase — required for /api/nex/sign-up + /api/nex/sign-in.
# Get these from https://supabase.com/dashboard/project/_/settings/api
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Finding

Both variables listed are the **legacy** environment-variable names (prefix `NEXT_PUBLIC_SUPABASE_*`, no `_NEX_` in the middle). Per nexapp `CLAUDE.md §8` lines 83-87:

> "Never create, use, or reference any OTHER Supabase project for NEX work. If a legacy `msdonkkechxzgagyguoe` reference exists in a specific file, it is being treated as a legacy boundary that routes AWAY from the NEX project — do not reactivate it."

And `CLAUDE.md §8` lines 100-104:

> "`.env.local` ALSO carries a stale `SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_URL` pointing at a non-existent `msdonkkechxzgagyguoe` project. These unprefixed env vars should be updated to the correct project but the code already routes around them via `NEXT_PUBLIC_NEX_SUPABASE_URL`."

### Impact on operators

An operator cloning the repository and reading `.env.example` as the canonical configuration template would:

1. See only 2 vars documented
2. Attempt to set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with values from "the Supabase project"
3. Either leave them pointing at a stale legacy project (if they inherit values from the backed-up `.env.local`) OR point them at the correct NEX project but with the WRONG VARIABLE NAME · the code paths that gate on `NEXT_PUBLIC_NEX_SUPABASE_URL` would still fail to find the required value
4. Have no documentation of the other 325 env vars the application reads

### Recommendation (not actioned in this task)

**Do NOT edit `.env.example` as part of this inventory task** · the brief forbids it. Flag as the next bounded action: produce a correct `.env.example` as a separate authorised PR referring to this inventory. The replacement should:

- List only the vars Phase 1 operators need (the 61 nex-native-critical set, trimmed to the ~15-20 required/conditional ones)
- Group by subsystem with inline comments
- Use the canonical `NEX_SUPABASE_*` / `NEXT_PUBLIC_NEX_SUPABASE_*` names only
- Document (as a comment) that the legacy `SUPABASE_*` / `NEXT_PUBLIC_SUPABASE_*` names must remain UNSET in production
- Reference `docs/doctrine/nex-env-vars-inventory-2026-10-14.md` for the full picture

---

## Section D · `.env.local` gap analysis (names only · no values touched)

Keys were extracted from `.env.local` using `awk -F= '/^[A-Z]/{print $1}'`, which prints only the string BEFORE the first `=` character on each line. **No value, no comment, no secret substance of any kind was read, held in a variable, or printed.** Counts and set-comparison summaries only:

| Set | Count | Interpretation |
|---|---|---|
| Keys defined in `.env.local` | 118 | What the operator has configured today |
| Keys code references but `.env.local` lacks | **266** | Code expects these; env file doesn't set them. For legacy monorepo vars this is expected (code degrades gracefully). For nex-native-critical vars (Section A) this would be a hard failure. |
| Keys `.env.local` sets but no code reads | **57** | Legacy / unused · candidates for cleanup in a separate hygiene PR · not safety-critical |
| Keys in both | **61** | Active configuration |

**Not listed:** the specific key-NAMES present in `.env.local`. The brief permits "names or presence only" but to maximise safety this report sticks to **counts and overlap structure**. If owner wants the key-name list for the hygiene PR, that is a trivially-safe follow-up (names only, still no values).

**Important inference (safe):** Since the 61 keys-in-both include whatever the running dev server is actually using, and the dev server is confirmed launching + predev-guard passing (per single-source verification report), the critical minimum set of nex-native vars must be in `.env.local` today. The 266 missing are overwhelmingly the legacy `src/lib/nex/*` vars which code degrades on when absent.

---

## Section E · subsystem summary table

| Subsystem | Phase-1 critical vars | Status | Blocker? |
|---|---|---|---|
| Supabase (canonical) | 4 | Documented in CLAUDE.md §8; names visible in code | **Documentation gap** (`.env.example` has wrong names) |
| Supabase (legacy, detect-reject) | 4 | Properly gated by routing-away boundaries | Not a blocker |
| Postgres direct | 3 | **Unresolved operator decision** (localhost vs Supabase pooler) | **Yes · decision pending** |
| Public app URLs | 6 | Six overlapping variables for the same value | Cleanup opportunity, not a blocker |
| Launch flags | 2 | In-code defaults, documented | Not a blocker (Phase 1 off is the sealed doctrine) |
| WebAuthn | 3 | **Unresolved operator decision** (production hostname) + TS error on API routes | **Yes · depends on A4 URL + B4 TS fix** |
| Push notifications (VAPID) | 1 public + 2 server-only | Operator must generate keypair | **Yes · operator action** |
| Cron | 1-2 | Operator must set CRON_SECRET | **Yes · operator action** |
| Admin / dev shortcuts | 3 | Must be absent/false in prod | **Yes · acceptance test** |
| Backpressure / autoscale / circuits | 16 | In-code defaults | Not a blocker (tuning for Phase 2+) |
| Emergency help / SafeChat | 7 | Per-feature decisions | Not Phase 1 critical |
| Themes | 2 | Not a blocker | — |
| Engine / telemetry | 3 | Not a blocker | — |
| Cross-DB reconciler | 2 | Should be off | Flag |
| MaxMind | 1 | Conditional | — |
| Framework | 1 (`NODE_ENV`) | Platform-set | — |
| Session / encryption secrets | 2 (`NEX_SESSION_SECRET`, `ENC_KEY`) | **Required · must be set to random strings** | **Yes · operator action** |
| Email delivery | 1 chosen provider | **Required if any transactional email** | **Yes · operator action + provider decision** |
| Observability / alerting | 1 webhook + severity | **Required for Stage 1.1 Option C** | **Yes · ties to the sealed messaging-safety plan** |
| Legacy LLM / brain / agent / lab / etc. | 150+ | Default unset in production | Not Phase 1 critical if code degrades gracefully |

### Phase 1 operator checklist (the "must set" subset)

An operator deploying Phase 1 chat+themes NEX must set, at minimum:

1. `NEX_SUPABASE_URL` + `NEX_SUPABASE_SERVICE_ROLE_KEY` (server-side admin writes)
2. `NEXT_PUBLIC_NEX_SUPABASE_URL` + `NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY` (identical URL + anon key for client-side)
3. **Decision pending** · one of: `NEX_POSTGRES_URL` → Supabase pooler (requires migration apply) · OR change code to use REST client · OR disable directory read path
4. One canonical public URL — pick one: `NEXT_PUBLIC_APP_BASE_URL` (recommended) · set all overlapping aliases to the same value for safety
5. `NEX_WEBAUTHN_RP_ID` + `NEX_WEBAUTHN_ORIGIN` (must match the deployed hostname/origin exactly)
6. `NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY` + `XRATED_VAPID_PRIVATE_KEY` + `XRATED_VAPID_SUBJECT` (push notification keypair · generate with `web-push generate-vapid-keys`)
7. `CRON_SECRET` (random 32+ byte string · used by the hourly `harvest/tick` cron)
8. `NEX_SESSION_SECRET` (random 32+ byte string)
9. `ENC_KEY` (random 32+ byte string)
10. One email provider's env set (choose: `NEX_DELIVERY_*` Mailgun/Postmark/SendGrid/SES/SMTP · or `RESEND_API_KEY`) · see §A.1 note that these were NOT inventoried individually in this pass but are a prerequisite for sign-up emails
11. One alerting webhook (`NEX_ALERTS_SLACK_WEBHOOK_URL` or `NEX_ALERTS_WEBHOOK_URL`) · needed for Stage 1.1 Option C observability prerequisite

Everything else: either Phase 2+ or legacy infra · default unset in production.

### Phase 1 operator checklist (the "must NOT set" subset)

Also required for safety:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — legacy; must be absent in production env
- `NEX_ALLOW_DEV_ADMIN` — must be absent/false
- `NEX_DEV_ROUTES` — must be absent/false
- `NEX_LOCALPG_*` — dev-only; must be absent
- `NEX_AGENT_INTERNET_FORCE_OFFLINE`, `NEX_AGENT_INTERNET_FORCE_ONLINE`, `NEX_LOCAL_ONLY` — dev-only; must be absent
- `NEX_FOUNDER_MODE_PASSWORD` — set only if founder-mode bypass is intentionally enabled (not a Phase 1 requirement)
- `NEX_CROSS_DB_RECONCILER_ENABLED` — must be false unless authorised

---

## Section F · validation recommendations

### Safe validation patterns

For each required variable, a safe validation method that does NOT read `.env.local` or print secret values:

1. **Presence check**: `test -n "$VAR_NAME"` in a shell script or `typeof process.env.VAR_NAME === "string" && process.env.VAR_NAME.length > 0` in Node. Reports only present/absent, no value disclosure.
2. **Length check**: `process.env.VAR_NAME.length >= 32` for secret-key vars. Reveals only that the length meets a threshold.
3. **Format check**: Regex match for URL shape (`/^https:\/\/[a-z0-9.-]+\.supabase\.co$/`) or JWT shape (`/^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/`). Reveals only format conformance, not content.
4. **Reachability check**: `curl -I <SUPABASE_URL>/rest/v1/` must return `401 Unauthorized` with a `WWW-Authenticate` header. Confirms endpoint exists and responds like Supabase, without authenticating.
5. **Project-ID match**: Extract project ID from `NEX_SUPABASE_URL` host (`<id>.supabase.co`) and compare literal equality to the sealed `ijvqdvsvwtwxzcqmoqit` constant from CLAUDE.md §8. One string comparison, no value exposed to logs.

### Proposed validation script

Not written as part of this task. The recommended next step after `.env.example` is corrected is to produce `scripts/validate-env.mjs` that:

- Runs on application boot (or via `npm run validate:env`)
- Checks each required var is present and matches its format
- Fails loudly with an actionable error listing which vars are missing
- NEVER logs variable values

This becomes the "safe method that reports names or presence only" the brief calls for.

---

## Section G · unresolved decisions (require owner input)

| # | Decision | Scope | Blocker rank |
|---|---|---|---|
| D1 | `NEX_POSTGRES_URL` destination · (a) point at Supabase pooler after migrating directory canonical layer, (b) rewrite `@/lib/nex/db` to use Supabase REST, or (c) disable the directory read path for Phase 1 | Backend connectivity | **High** · gates any production directory feature |
| D2 | Canonical public app URL · pick ONE of the 6 overlapping vars (recommend `NEXT_PUBLIC_APP_BASE_URL`) and codify the rest as aliases or delete them | Config cleanliness | Medium · doesn't block Phase 1 but creates drift |
| D3 | Production hostname for WebAuthn RP_ID + ORIGIN | Sign-in / auth | **High** · WebAuthn production flow requires this + depends on D2 |
| D4 | Email provider for transactional emails · Resend / Mailgun / Postmark / SendGrid / SES / SMTP · pick one | Account verification + password reset | **High** · can't sign up without transactional email |
| D5 | SafeChat Phase 1 user-facing surface · on or off for Phase 1 launch | Family Safety | Decision per launch doctrine |
| D6 | Emergency help · on or off for Phase 1 launch | Emergency features | Decision per launch doctrine |
| D7 | Legacy `src/lib/nex/*` subsystem defaulting · formally document that these must be unset in production and that code paths touching them must degrade gracefully | Legacy monorepo residue | Medium · requires audit |
| D8 | Rename `XRATED_VAPID_*` to `NEX_VAPID_*` or leave for Phase 2 cleanup | Code hygiene | Low · cosmetic |
| D9 | `.env.example` replacement · the correct canonical template | Documentation | **High** · this is the direct follow-up to this inventory |
| D10 | Validation script `scripts/validate-env.mjs` | Operator tooling | High · unblocks reliable deployment |

---

## Section H · next step

**The direct next step after this inventory is reviewed is D9: produce the corrected `.env.example`.**

Why specifically D9:

- The current `.env.example` is actively misleading (points operators at the stale project per CLAUDE.md §8).
- Fixing it is bounded (one file edit, cite this inventory for context, document the Phase 1 "must set" subset from §Section E, document the "must NOT set" subset).
- It unblocks D10 (`validate-env.mjs` builds on top of a correct contract).
- It unblocks any staging/CI deployment that an operator would use to run Phase 1 integration tests.
- It does not require making the pending decisions (D1, D3, D4) — the replacement `.env.example` can document those as `# OPERATOR MUST DECIDE: ...` placeholders.

**Prerequisites for D9:**

1. Owner authorisation to edit `.env.example` (currently prohibited by this task's boundary).
2. Agreement that D9 should contain only the ~15-20 "must set" nex-native-critical variables inline, with comments pointing at this inventory for the full picture.
3. Agreement that D9 should EXPLICITLY list the "must NOT set" legacy variable names as commented-out lines with an inline reason.

Estimated effort: ~30 minutes of focused work after authorisation. One file edit (`.env.example` only · no code change, no DB touch).

---

## Boundary compliance

- Read-only · one new report file created. No code, test, migration, DB, deploy, dep, secret, port, process, or git mutation performed.
- **`.env.local` values were never read or printed.** Keys were extracted using `awk -F= '{print $1}'` which prints only the string BEFORE the `=` character on each line, producing names-only output. The resulting key list is referenced in counts only · the individual key names from `.env.local` are **not reproduced** in this report (per the brief's maximum-safety reading of "names or presence only").
- `.env.example` read (contents shown · it is a public template · no values beyond empty-value placeholders).
- `.env.local.pre-llm-removal.20261010-213218` (a dated backup of `.env.local`) was **not** opened or read.
- No `.env.harvest.local`, `.env.tools.local`, or any other `*.local*` file read.
- `.env.example` NOT edited.
- No application code modified. No migration. No DB. No deploy. No dep install. No commit, push, pull, stash, checkout, reset.
- 29 pre-existing nexapp working-tree modifications preserved verbatim.
- Running dev server (PID 7172 on port 3008) untouched.

Stopping. Awaiting owner review and authorisation for D9 (corrected `.env.example`) or any alternative sequencing from the unresolved decisions in §Section G.
