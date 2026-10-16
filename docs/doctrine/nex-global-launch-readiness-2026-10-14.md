# NEX · global launch-readiness audit

Date: 2026-10-14
Scope: strictly read-only first-pass audit identifying launch blockers across Phases A-F.
Companion to earlier reports: Phase 1 identity audit, Phase 2 feature preservation, Phase 3A dev guard + hardening + acceptance, Stage 1.1 chain, single-source-of-truth verification.

Written as one file. Nothing in the repo was modified during this audit except this report. No code edited, no migration applied, no dependency installed, no DB queried, no server started/stopped, no secrets read, no git mutation, no `.env.local` opened. D:/trades not touched. Hammerex seed, migrations 191-197, Stage 1.1 code, Vault, Bridge 99 and Chat Master Layout all untouched.

---

## 0 · Executive summary

The founder's current launch doctrine (sealed Bridge 55 Phase 1 · 2026-09-29 at `src/lib/nex-native/launch-flags.ts`) is explicit: **Phase 1 is "a chat + themes product"**, not full commerce. `NEX_COMMERCE_ENABLED` defaults to `false` and gates all cart/shop/orders/manage/discovery UI. All commerce code is retained but hidden. Phase 2 (full commerce) is explicitly "one flag change, not a re-implementation."

Measured against the Phase 1 doctrine:

| Release gate | State | Headline |
|---|---|---|
| 1 · Repository + build integrity | **PARTIAL** | nexapp is the single source (Phase 1-3A verified). `next build` succeeds because TS errors are suppressed via `ignoreBuildErrors: true`, but **1614 TypeScript errors** remain, 34 of them in nex-native app code (WebAuthn API change, Vault SignInEventType, slug-availability type union). |
| 2 · Account creation, claim, identity continuity | **PARTIAL** | Bridge 99 provisional-session foundation is byte-identical to D:/trades (Phase 2). B1 Phase C "claim action" is designed but not implemented (per the Stage 1.1 roadmap). WebAuthn sign-in surface has broken TS imports (library API change). |
| 3 · Core messaging + persistence | **VERIFIED (fail-open rate-limit outstanding)** | Vault + peer-conversation + peer-message surfaces byte-identical to D:/trades. Guest-chat follow-up rate limit wired at code level · Stage 1.1 Option C fail-closed-with-retry policy approved in principle but **not implemented**. Migration 197 unapplied. |
| 4 · Mobile usability | **BLOCKED** | **No Playwright config exists**. No e2e harness. 795 vitest files but zero mobile-viewport automation. All of Phase B's mobile claims would be unverifiable until a harness exists. |
| 5 · Package + entitlement correctness | **BLOCKED** | `/nex-native/packages/page.tsx` exists but **zero Stripe payment code is implemented** across the codebase. Stripe is in deps (`stripe@^17.7.0`), but no `stripe.checkout`, no webhook route, no payment API. Entitlement enforcement scaffolding present (tiers · `gratis`/`bisnis`) but revenue path absent. |
| 6 · Market configuration + payments | **BLOCKED** | 10 currencies defined in code (`src/lib/nex-native/currencies.ts`). i18n foundation exists with id + en packs only. **No per-market payment provider mapping, no tax config, no regional availability flag.** Current `nex_account.locale CHECK (locale IN ('id','en'))` restricts the DB to two languages. |
| 7 · Security + privacy | **PARTIAL** | Phase 3A dev guard sealed + 112/112 tests pass. Vault B.1-B.6A sealed. Rate-limit fail-open bypass (Stage 1.1) remains. 2 legacy-Supabase refs are routing-away boundaries, not active clients. **Operational observability missing** (no metric on fail-open warn, no alert). |
| 8 · Production operations + recovery | **PARTIAL** | `vercel.json` has exactly 1 cron entry (`harvest/tick` hourly). HSTS + security headers in `next.config.mjs:35-50`. No documented backup/restore procedure in-repo. No alerting documented. **`.env.example` lists only 2 vars** while code references ~50-100 env vars. |
| 9 · End-to-end regression | **PARTIAL** | Vitest harness healthy (sample run: **130/130 pass · 309ms**). But no Playwright, no production-build smoke test documented. |
| 10 · Explicit go/no-go | **NO-GO** · Phase 1 commerce+themes launch is blocked on items in gates 4, 5, 6, 8 above. See §Phase F for the single highest-priority blocker. |

**Overall verdict: NOT READY for a global launch today.** The chat-themes core is architecturally sound (Phases 1-3A proved this), but the surrounding operational envelope — environment inventory, mobile verification harness, payment implementation, regional-market configuration — is incomplete or absent.

---

## Phase A · release baseline feature register

### App surface inventory

**52 top-level surface roots** under `src/app/nex-native/` (from `ls -d .../nex-native/*/`):

```
[businessSlug]  _trust-scan  about  admin  affiliate  business-setup
call  calls  cart  chat  chat-standard  chat-themes-library  community
contacts  conversations  cover  create-account  dev  directory  discover
emergency-help  family-safety  friends  home  home-prototypes  hq  liked
live  manage  nex-socials  onboarding  orders  packages  post-signup-apply
product  prototypes  report  safe-trade  search  settings  share
shop-prototypes  sign-in  site  status  support  terms  themes  u
unsubscribe  vault  welcome
```

**73 API routes** under `src/app/api/nex-native/*` (`route.ts`). Categorised:

| Category | Routes | Status |
|---|---|---|
| **Auth** (webauthn, sessions, credentials) | 9 | **PARTIAL** · WebAuthn routes have broken imports (library API change) |
| **Chat core** (messages, conversations, visitor, nex-reply, first-message) | 8 | **VERIFIED** (byte-identical to D:/trades per Phase 2) |
| **Peer messaging** (encrypted, delivered, since) | 3 | **VERIFIED** |
| **Vault** (setup, unlock, rotate, device, envelope, migration, recovery, chat/attachment) | ~30 | **VERIFIED** (sealed B.1-B.6A chain, Phase 2 byte-identical) · but TS event-type mismatches on 12 routes |
| **Community** (notices, lost-found, zones, membership) | 11 | **VERIFIED** (migrations 146-152 present) |
| **Push + attachments + storage** (push subscribe, custom intro, attachment, business media) | 5 | **PARTIAL** · wiring present, delivery provider verification not done |
| **Security** (password change, sessions, credentials, trust) | 4 | **PARTIAL** |
| **Account/slug/health/harvest** (account-gate, slug-availability, surface-health, harvest/tick, generation-jobs, engine/health) | 6 | **PARTIAL** · slug-availability has type error |
| **Session helpers** (first-message, reset-cover-continuity, visitor-session) | 3 | **VERIFIED** · Bridge 99 |

### Launch flags present

Two sealed launch gates in `src/lib/nex-native/launch-flags.ts`:

- `NEX_COMMERCE_ENABLED` (default `false`) · gates cart, shop, orders, `/[businessSlug]`, `/manage/*`, direct-price, share-to-earn, ladder. Admin bypass via `?commerce=1` query string.
- `NEX_SEARCH_ENABLED` (default `false`) · gates `/nex-native/search` only. Admin bypass via `?search=1`.

Both default to disabled per Phase 1 doctrine. The query-string bypasses are an intentional admin footgun — in production they could allow unauthorised users to see unfinished UI if someone crafts the URL manually. Flagging for Phase 1 release QA.

### Status · high-level

| Area | Status | Evidence |
|---|---|---|
| Chat (identity header + composer pill master layout) | **VERIFIED** | Phase 2 · 56-file chat subtree byte-identical to D:/trades; sealed Chat Master Layout primitives at `src/lib/nex-native/chat-chrome/` are nexapp-only post-fork |
| Themes catalogue + viewer | **VERIFIED** | Chat-themes-library files unchanged this session; theme-viewer tests pass |
| Vault B.1-B.6A | **VERIFIED** | Phase 2 · all 17 lib files + 51 app route files byte-identical; sealed deterministic + Playwright `vault-master-pass.spec.ts` 1/1 PASS (from prior session chain) |
| Bridge 99 provisional-session + 5-signal fingerprint | **VERIFIED** | 28/30 byte-identical to D:/trades; 2 differences are the deliberate 2026-10-14 Hammerex guest-handoff fixes |
| Family Safety + SafeChat | **VERIFIED** | Phase 2 · 87/87 files byte-identical |
| Guest chat follow-up rate limit | **PARTIAL** | Code wired (Stage 1.1 pass 1), migration 197 unapplied, fail-open bypass still live |
| Commerce (cart, orders, products, business shops) | **DISABLED** (gated off per Phase 1 doctrine) · implementation present but hidden |
| NEX Search | **DISABLED** (gated off) |
| WebAuthn sign-in | **BLOCKED (TS)** · `@simplewebauthn/server` export names changed (library upgrade); `RegistrationResponseJSON` and `AuthenticationResponseJSON` no longer exist |
| Payment / checkout | **NOT IMPLEMENTED** · zero `stripe.checkout`, no webhook, no payment route |
| Universal i18n in nex-native layout | **PARTIAL** · 10 nex-native files consume `useT` / `resolveClientLang` / `I18N_KEYS` including `layout.tsx`; packs are id + en only; DB CHECK locks to those two |

### Features still in prototype state

Three surface roots name themselves prototypes: `prototypes/`, `home-prototypes/`, `shop-prototypes/`. The `dev/` surface is explicitly dev-only. These should either be gated out of production routing or deleted before launch. Flag for release QA.

---

## Phase B · mobile QA

### Harness status · BLOCKED

- **No `playwright.config.*` at repo root** · `Glob playwright.config.*` returned zero files.
- **No `tests/e2e/` directory** · zero `.spec.ts` files anywhere.
- `@playwright/test` is in `devDependencies` (`"^1.62.1"`) but no configuration or test files use it.
- Prior session chain mentions Playwright specs (e.g. `vault-master-pass.spec.ts`, `nex-socials-chooser.spec.ts`, `vault-contacts.test.ts`) that passed · those are in D:/trades's history and are **not present in nexapp**.

**Verdict: mobile QA is unverifiable in nexapp today.** This is a Phase B hard blocker because every claim about mobile viewport behaviour (touch targets, keyboard, safe area, chat bubbles, navigation, product sheets, settings) would be unsupported.

### Chat Master Layout sealed · known mobile-friendly

The Chat Master Layout rule (sealed 2026-10-14 per global memory) requires every chat surface to mount `ChatIdentityHeader` (56px avatar + 44px circle buttons · explicit mobile tap targets) and `ChatComposerPill` (44px minH · aurora-pill · 36px send button · 32px plus/emoji). These numeric specifications are mobile-first by design. Phase 2 confirmed the primitives exist at `src/lib/nex-native/chat-chrome/` and are byte-identical in the only places that use them. **But this is a design-doctrine finding, not a mobile-QA result.** It does not substitute for a Playwright run against actual phone viewports.

### What the dev server tells us today

Dev server is running (Phase 1 confirmed · PID 7172 on port 3008 from nexapp's `node_modules/next/...`). Not exercised at mobile viewports in this audit per the read-only boundary.

### Required to close Phase B

1. Install Playwright test harness (requires `--save-dev` dependency installation · explicit owner authorisation required).
2. Author at least 5 mobile-viewport specs: arrival + sign-up, chat send/receive, settings navigation, theme preview, guest-to-authenticated handoff.
3. Snapshot the actual viewport screenshots at 375×812, 414×896, and a landscape case.
4. Record pass/fail evidence per gate.

Estimated effort: medium. No dependency changes to source code; only test harness.

---

## Phase C · packages, pricing, entitlements

### Package surface

- `/nex-native/packages/page.tsx` exists (one page). Not inspected end-to-end in this audit; not yet verified for working checkout flow (no Stripe integration to flow to, see below).
- Account tiers in code: `gratis` and `bisnis` (per the TS error at `slug-availability/route.ts:109` referencing a `NexAccountTier` union narrowing).
- `commerceOnly` flag used by capabilities menu to hide features when commerce is off.

### Payment code · NONE wired

Grep for `stripe\.|new Stripe|stripe\.webhooks|stripe\.checkout` across `src/` returned **one** match — a safe-logging regex in `src/lib/nex/observability/redact.ts:19` that redacts anything matching `stripe.*key`. No `src/app/api/nex-native/stripe/*/route.ts`. No `src/app/api/nex-native/webhook/*`. No `src/app/api/nex-native/payment/*`. No `src/app/api/nex-native/checkout/*`. No consumer of `const stripe = new Stripe(...)` anywhere.

**Verdict · Phase C blocker: packages + plans are advertised in UI but there is no payment implementation.** Stripe is a listed dependency but is not actually integrated into the application.

### Entitlement enforcement scaffolding

Server-side entitlement enforcement is present in theory — e.g., Vault surfaces check `nex_account.tier` for the `bisnis` tier, there's an `adminSetAccountTierAction` with dual-auth gate (per the session memory). But there is no payment event feeding tier upgrades: tier changes today are admin-only.

### Pricing display

Currency code library at `src/lib/nex-native/currencies.ts:24-35` defines 10 currencies (IDR default + GBP, USD, EUR, SGD, MYR, THB, PHP, VND, AUD). These are the pricing-display options for sellers. No per-user "home currency" field in nex_account. No tax / VAT / GST rate table in the repo.

### Market-by-market matrix

Current state against the brief's "Asia / Europe / USA / other" axis:

| Market | Language | Currency display | Phone format | Payment provider | Tax config | Status |
|---|---|---|---|---|---|---|
| Indonesia | id (default) | IDR | not inspected | **none wired** | not inspected | **NOT CONFIGURED FOR CHECKOUT** · currency label exists only |
| UK | en | GBP | not inspected | **none wired** | not inspected | **NOT CONFIGURED FOR CHECKOUT** |
| USA | en | USD | not inspected | **none wired** | not inspected | **NOT CONFIGURED FOR CHECKOUT** |
| EU (any country) | en only (no fr/de/es/it packs) | EUR | not inspected | **none wired** | not inspected | **NOT CONFIGURED FOR CHECKOUT** |
| Singapore | en | SGD | not inspected | **none wired** | not inspected | **NOT CONFIGURED FOR CHECKOUT** |
| Malaysia | en | MYR | not inspected | **none wired** | not inspected | **NOT CONFIGURED FOR CHECKOUT** |
| Thailand | — (no th pack, en fallback) | THB | not inspected | **none wired** | not inspected | **NOT CONFIGURED FOR CHECKOUT + language gap** |
| Philippines | en | PHP | not inspected | **none wired** | not inspected | **NOT CONFIGURED FOR CHECKOUT** |
| Vietnam | — (no vi pack, en fallback) | VND | not inspected | **none wired** | not inspected | **NOT CONFIGURED FOR CHECKOUT + language gap** |
| Australia | en | AUD | not inspected | **none wired** | not inspected | **NOT CONFIGURED FOR CHECKOUT** |

**None of the 10 named markets is actually configured for a real end-to-end purchase today.** Currency symbols can be *displayed* in a dropdown. That is not the same as "USA is launch-ready."

### Residency / data-location / privacy

Supabase project `ijvqdvsvwtwxzcqmoqit` is in `aws-0-eu-west-1.pooler.supabase.com` (per nexapp CLAUDE.md §8). **Data residency is EU-West (Ireland)**. For:

- EU users: data stays in EU — GDPR data-transfer rules are not triggered (same jurisdiction).
- UK users: EU → UK transfers governed by the UK-EU adequacy decision.
- USA, Australia, SEA users: data crosses borders to EU · requires standard contractual clauses / privacy policy disclosure.

**Specialist legal review required** before launch in any specific market. Not within audit scope.

---

## Phase D · global application configuration

### The environment-variable gap · PRIMARY BLOCKER

`.env.example` at repo root contains exactly **2 variables**:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Grep for `process.env.*` across `src/` yields references to approximately **50-100 distinct env vars** (not inventoried individually in this pass; see Phase A §API routes for a partial picture — webauthn, Supabase service role, email providers, image hosts, launch flags, DB connection strings, etc. all referenced).

**Operator consequence:** anyone trying to deploy nexapp to a new environment would not know what to set. The deployment would fail opaquely on the first missing variable. Even with the correct ones set, the operator would not know which are *required* vs *optional*, which are *public* (`NEXT_PUBLIC_*`) vs *server-only* (`NEX_*`), or which gate specific features (`NEX_COMMERCE_ENABLED`, `NEX_SEARCH_ENABLED`).

This is a **production-readiness hard blocker** and it is simultaneously the **smallest safe first fix** (produce one new documentation file inventorying every `process.env` reference, grouped by subsystem, with notes on required/optional and source).

### Config surfaces that need operator input

Already identified in various `process.env` grep hits:

| Env var | Purpose | Documented? |
|---|---|---|
| `NEXT_PUBLIC_NEX_SUPABASE_URL` + `NEX_SUPABASE_URL` | NEX authoritative Supabase project URL | **NOT in `.env.example`** · documented in `CLAUDE.md §8` |
| `NEX_SUPABASE_SERVICE_ROLE_KEY` | Supabase admin service-role key | **NOT in `.env.example`** · referenced in `supabase-admin.ts:32` |
| `DATABASE_URL` + `NEX_POSTGRES_URL` | Direct Postgres via pooler | **NOT in `.env.example`** · documented in `CLAUDE.md §8` |
| `NEX_COMMERCE_ENABLED` | Launch flag (gates commerce) | **NOT in `.env.example`** · documented in `launch-flags.ts:20` |
| `NEX_SEARCH_ENABLED` | Launch flag (gates search) | **NOT in `.env.example`** · documented in `launch-flags.ts:73` |
| `NEX_APPROVED_STORAGE_HOSTS` | Image boundary allowlist | **NOT in `.env.example`** |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **LEGACY** (per CLAUDE.md §8: "stale, point at non-existent `msdonkkechxzgagyguoe`") | listed in `.env.example` — the **ONLY** two listed · **misleading** |
| Email provider env (Resend key, SMTP host/user/pass) | Email delivery (verification, reset) | **NOT in `.env.example`** · code references in `src/lib/nex/{listing-chat,founder-outbound,delivery,alerts}/*/smtp.*` |
| `STRIPE_SECRET_KEY` + webhook secret | Payments | **NOT in `.env.example`** · and **not actually referenced in code** · (listed dep but no consumer) |
| `OPENAI_API_KEY` and friends | LLM providers (`src/lib/llm/*`) | **NOT in `.env.example`** |

**Verdict:** `.env.example` is strictly misleading today — it lists only the two **legacy** Supabase vars that CLAUDE.md §8 explicitly flags as stale, and nothing else. An operator reading this file would configure the wrong Supabase project.

### `next.config.mjs` posture

- `turbopack: { root: __dirname }` · Turbopack enabled.
- `devIndicators: false` · dev UI chrome hidden.
- **`typescript: { ignoreBuildErrors: true }`** · **this is why 1614 TS errors don't block the build**. Correctness risk retained in production bundle.
- `serverExternalPackages: ["unzipper", "tesseract.js", "ffmpeg-static", "ffprobe-static"]` · heavy modules kept external to the serverless bundle.
- `experimental.turbopackFileSystemCacheForBuild: true` · build cache enabled.
- `images.remotePatterns` · only `ijvqdvsvwtwxzcqmoqit.supabase.co` and `ik.imagekit.io`. Legacy host NOT whitelisted (good).
- Security headers: `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`. All set, globally applied to `/(.*)`.
- One redirect: `/nex-native/settings/theme` → `/nex-native/chat-themes-library`.

**Verdict for next.config.mjs: PARTIAL.** Security headers are good. TS-error suppression is a known risk. No ESLint `ignoreDuringBuilds` observed (lint config not inspected).

### `vercel.json` posture

- One scheduled cron: `/api/nex-native/harvest/tick` at `0 * * * *` (hourly), with 300s max duration.
- No `regions` config · defaults to Vercel default (iad1 unless overridden by the project settings).
- No env-var policy, no routing overrides, no middleware config, no `headers` override (headers are in `next.config.mjs` instead · fine).

**Verdict: PARTIAL.** The single cron is correctly configured. **But**: for a multi-region launch, no regional serverless placement is defined. Supabase is in eu-west-1 (Ireland). If Vercel defaults to iad1 (US East), every request from EU/SEA users round-trips through the US before reaching Supabase. **Operational finding.**

### Observability

Grep for alerting / metric libraries in `src/`:

- `@vercel/analytics` + `@vercel/speed-insights` in deps · wiring not inspected.
- No OpenTelemetry, no Sentry, no datadog, no logtail. Logging via `console.warn` / `console.error`.
- The Stage 1.1 safety review already identified the `console.warn("[guest-chat] rate-limit primitive failed")` fail-open event has **no metric or alert** · operators would not notice sustained bypass.

**Verdict: PARTIAL** · base analytics present, structured observability missing.

### Backup + recovery

No backup/restore procedure documented in `docs/doctrine/*`. Supabase project is the system of record (per `CLAUDE.md §8`) · the project itself has PITR + daily backups via Supabase if configured on the paid tier. **Not inspected in this audit.** Operator must verify via Supabase dashboard.

---

## Phase E · security + release QA

### Phase 3A dev guard (nexapp-only predev)

- Sealed per `docs/doctrine/nex-repository-phase-3a-dev-guard-acceptance-2026-10-14.md`.
- 112/112 guard tests pass (verified sample run this audit: **130/130 pass on a known-good suite** — guard + Stage 1.1 + welcome-honesty).
- Blocks `npm run dev` outside the canonical nexapp root with the canonical GitHub remote.

### Vault B.1-B.6A sealed

Phase 2 confirmed:
- 17/17 Vault lib files byte-identical to D:/trades (sealed B-chain)
- 51/51 Vault app route files byte-identical
- `vault-master-pass.spec.ts` (Playwright) was 1/1 PASS from the earlier session chain (in D:/trades · regression not re-run in nexapp)

### Bridge 99 + 5-signal fingerprint

- `provisional-fingerprint.ts` sealed · 5-signal contract (`device_id, ua_class, ip_24_bucket, tz_offset_minutes, accept_language_primary`) defined at 4 places inside one file (comment, type, const array, runtime validators)
- 28/30 first-conversation files byte-identical to D:/trades
- G2 fingerprint re-check on guest-chat follow-up remains deferred

### Rate limit (guest-chat follow-up)

- Stage 1.1 code wired at `src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts:88-107` via sealed `recordIfAllowed`
- Migration 197 (CHECK extension to include `peer_message_guest`) **unapplied**
- Current policy: fail-open on non-sealed error (`console.warn` + allow)
- Owner-approved Option C (fail-closed with 1 bounded retry, retryable error to UI) **not yet implemented**
- Sequencing: UI PR first, then observability, then server policy flip, then migration 197 under separate operator auth

### TypeScript correctness

- **1614 total TS errors across 558 unique files**
- 34 errors in `src/app/*` (nex-native app code, not just prototype routes)
- 333 errors in `src/lib/*` · includes both `src/lib/nex-native/` and the legacy `src/lib/nex/` monorepo residue

Representative nex-native errors (all 20 I inspected manually):

- `src/app/api/nex-native/auth/webauthn/assert-finish/route.ts:21` — `AuthenticationResponseJSON` no longer exported from `@simplewebauthn/server@11`
- `src/app/api/nex-native/auth/webauthn/enroll-finish/route.ts:8` — `RegistrationResponseJSON` no longer exported
- `src/app/api/nex-native/slug-availability/route.ts:109` — `NexAccountTier` type doesn't narrow to the expected `"gratis" | "bisnis"` union
- **12 Vault routes with `SignInEventType` string-literal mismatches**: `step_up_required_blocked`, `device_authorized`, `device_revoked`, `vault_unlock`, `vault_unlock_failed`, `vault_rotated`, `recovery_configured`, `legacy_file_migrated` — none are in the typed enum
- `TinyCalculator.test.tsx` in `src/app/nex-generated/` — nex-generated prototype

**Impact:** `next build` succeeds because `ignoreBuildErrors: true` in `next.config.mjs:10`. But the Vault event-type mismatches are REAL — those strings get emitted at runtime and whoever consumes `SignInEventType` (likely an admin dashboard filter or audit table) will silently drop or mis-filter these event rows. Not a build blocker; **is** a correctness blocker.

### Validation / abuse / privacy

- `src/lib/nex/observability/redact.ts` has a comprehensive secret-redaction regex covering `email, phone, apikey, api_key, secret, token, password, authorization, bearer, cookie, session, jwt, refresh_token, access_token, private_key, service_role_key, stripe.*key` · good.
- Rate limit primitive at `src/lib/nex-native/community/rate-limit.ts` · verified in Phase 2
- No visible unencrypted secrets logging path in the main `nex-native` tree.

### Dev-only shortcuts in production

- `?commerce=1` and `?search=1` query params unlock gated features for admin testing. **If an attacker guesses the URL in production they can bypass the launch flag** and see unfinished UI. Not a data-leak path (server-side enforcement still protects data), but a UX / cleanliness risk.
- The `prototypes/`, `home-prototypes/`, `shop-prototypes/`, `dev/` surfaces are in production routing. They should be gated out or deleted before launch.

### Build / typecheck / lint / test status

- `npm run build` not run this audit (would create `.next/` artefacts).
- `npm run typecheck` run · **1614 errors** (above).
- `npm run test` sample · **130/130 pass on representative suite** at vitest `v4.1.11` (project-local, no npx download).
- Full test-suite run not done (CLAUDE.md documents "~14 known broken imports from missing deps").
- No lint config inspected this pass.

---

## Phase F · release decision

### Launch blockers · prioritised

| # | Blocker | Severity | Affected gate | Smallest safe fix | Owner authorisation? |
|---|---|---|---|---|---|
| B1 | `.env.example` lists 2 vars, code references 50-100 | **CRITICAL** · ops | 8 (production ops) | Read-only inventory pass → produce `docs/doctrine/nex-env-vars-inventory-2026-10-14.md` with name, required/optional, prod/dev, which subsystem; then write a correct `.env.example` as a separate authorised edit | No (inventory is read-only); yes (final `.env.example` edit) |
| B2 | No Playwright config → no mobile QA | **CRITICAL** · verification | 4 (mobile usability) | Create `playwright.config.ts` with mobile viewports (iPhone 12 Pro, Pixel 7); add 5 bedrock specs: arrival-signup, chat-send-receive, settings-nav, theme-preview, guest-to-authenticated | Yes · requires `--save-dev` of none-new deps (Playwright is already a declared devDependency) but needs owner authorisation to add tests + config |
| B3 | Zero payment implementation (Stripe in deps only) | **CRITICAL** · revenue path | 5 (packages + entitlements) | **Only matters for Phase 2 commerce launch.** Phase 1 is chat+themes · `NEX_COMMERCE_ENABLED=false` already hides commerce surfaces. For Phase 1: no action needed. For Phase 2: dedicated multi-week workstream (checkout, webhook, entitlement writeback, refund, dispute). | Yes · Phase 2 scoping decision |
| B4 | 1614 TS errors (34 in nex-native app code) | **HIGH** · correctness | 1 (build integrity) + 7 (security correctness) | Separate workstream per subsystem: (a) WebAuthn library upgrade or type-stub patch; (b) `SignInEventType` enum extension to cover the 8 missing Vault event names; (c) `NexAccountTier` narrowing in `slug-availability`. Each is small (~1-20 lines) but needs owner authorisation per file. | Yes · each fix touches sealed surfaces |
| B5 | Migration 197 unapplied + Stage 1.1 Option C unimplemented | **HIGH** · sealed security gap | 7 (security) | Per the sealed Option C sequencing: (1) UI PR for `rate_limited` + `rate_limit_unavailable` branches in `_guest-chat-client.tsx`; (2) observability metric; (3) server policy flip (1 bounded retry + fail-closed); (4) apply migration 197 | Yes · each step |
| B6 | i18n locked to id + en at DB CHECK level | **HIGH** · market readiness | 6 (markets) | DB migration to widen `nex_account.locale` CHECK + add translation packs for target markets (th, vi, zh, fr, de, es, …). Per-market scope decision. | Yes · DB migration + translation effort |
| B7 | No regional payment-provider mapping | **MEDIUM** (gated by B3) | 6 (markets) | After B3: Stripe payment-methods per market, local-currency SKU IDs, tax config, Alipay/GrabPay for SEA markets if needed | Yes · commercial decision |
| B8 | No backup/restore / alerting documented | **MEDIUM** · ops | 8 | Document Supabase PITR config, backup retention, GDPR escalation path, incident alerting | Operator / specialist review |
| B9 | Prototype / `dev` routes live in production routing | **MEDIUM** · security | 7 | Gate `prototypes/`, `home-prototypes/`, `shop-prototypes/`, `dev/` behind `process.env.NODE_ENV !== "production"` or delete them | Yes · code edit |
| B10 | Query-string bypass (`?commerce=1`, `?search=1`) live in production | **LOW** · UX risk | 7 | Guard query bypasses behind `NODE_ENV !== "production"` | Yes · tiny code edit |
| B11 | Vercel region defaults to US East; Supabase in eu-west-1 | **LOW** · operational latency | 8 | Set `"regions": ["fra1"]` or `["lhr1"]` in `vercel.json` | Yes · deploy config |

### Release gates · state matrix

| Gate | State | What's needed |
|---|---|---|
| 1 · Repository + build integrity | **AMBER** | TS errors in nex-native app routes (B4). Build succeeds via `ignoreBuildErrors` but risks runtime correctness. |
| 2 · Account creation, claim, identity continuity | **AMBER** | WebAuthn routes broken at type level (B4). Phase C claim action unimplemented. |
| 3 · Core messaging + persistence | **AMBER** | Core sealed, but rate-limit fail-open bypass remains (B5). |
| 4 · Mobile usability | **RED** | No Playwright, no mobile verification evidence (B2). |
| 5 · Package + entitlement correctness | **RED** for Phase 2 commerce · **AMBER** for Phase 1 (packages page exists but no checkout) (B3). |
| 6 · Market config + payment readiness | **RED** · 10 markets displayed, 0 configured end-to-end (B6, B7). |
| 7 · Security + privacy | **AMBER** · Vault + guard sealed; rate-limit bypass + prototype routes + query bypasses outstanding (B5, B9, B10). |
| 8 · Production ops + recovery | **RED** · `.env.example` misleads (B1); no backup/alert documentation (B8); region placement unoptimised (B11). |
| 9 · End-to-end regression | **AMBER** · unit tests healthy, no e2e (B2). |
| 10 · Explicit go/no-go | **NO-GO** |

### Single highest-priority blocker

**B1 · Production environment variable inventory.**

Why this specifically:

- It's the **prerequisite for every subsequent gate**. Without a correct env-var list, nobody can even deploy a staging environment to run B2's Playwright specs against, let alone verify B5-B8.
- It's the **smallest safe first action**: one read-only inventory pass (grep `process.env.*` across `src/`, categorise by subsystem, note required/optional/public/server), then one new documentation file. Zero source-code change. Zero dependency change. Zero DB touch. Zero deploy. Can be done in one bounded session.
- It **unblocks** B2 (test env), B4 (CI config), B5-B7 (payment env), B8 (ops documentation), and the single most dangerous current state — the misleading `.env.example` that points operators at the stale `msdonkkechxzgagyguoe` project per `CLAUDE.md §8`.

**Prerequisites for B1:**

1. Owner authorisation for a read-only sweep of `src/**/*.{ts,tsx,mjs}` collecting every `process.env.*` reference.
2. Agreement on the deliverable name and location (recommend `docs/doctrine/nex-env-vars-inventory-2026-10-14.md`).
3. Agreement on the taxonomy: {required | optional | admin-only} × {public (NEXT_PUBLIC_*) | server-only} × {subsystem}.
4. Agreement NOT to edit `.env.example` in the same pass (keep the edit as a separate authorised PR so you can review the proposed canonical file before it replaces the misleading current one).
5. Agreement that the inventory does NOT read any `.env.local` value (names only; no secret exposure).

Estimated effort: ~2-3 hours of focused work, one deliverable file, zero code or DB change.

### Sequenced implementation plan after B1

If B1 lands cleanly, next in order:

- **B9/B10** · gate prototype routes + query-bypasses behind `NODE_ENV` · trivial code edits, immediately raise the production-safety floor.
- **B11** · set Vercel region to EU-West (one `vercel.json` line).
- **B5 (sequencing step 1-3)** · implement Stage 1.1 Option C in the already-approved order: client UI → observability → server bounded retry.
- **B2** · author Playwright config + 5 bedrock mobile specs.
- **B4 (incremental)** · fix the WebAuthn API change + Vault SignInEventType enum + slug-availability type union · each in a separate authorised small PR.
- **B5 step 4** · apply migration 197 under separate operator authorisation after Option C ships + tests pass.
- **B6** · scope the i18n expansion decision with the owner · which markets, which packs.
- **B8** · document Supabase backup posture + alert thresholds.

After the above, re-run this audit to measure gate transitions AMBER→GREEN.

### Explicit non-go for commerce (Phase 2)

Even after all Phase 1 blockers are fixed, **Phase 2 commerce launch (payments, orders, business shops, discovery) requires B3** which is a multi-week dedicated workstream to actually integrate Stripe. **Do not represent any market as "commerce-ready" without that work.** Phase 1 (chat + themes + Vault + community) can launch without B3.

---

## Boundary compliance for this audit

- Read-only. One file written (this report). No code, no migration, no dependency installed.
- No `.env.local` opened. No secrets read or printed.
- No DB queried. No deploy. No port change. No process stopped (dev server at PID 7172 untouched).
- No git state change. No commit, push, pull, stash, checkout, reset.
- No `D:/trades` read or write.
- No change to Stage 1.1 code (`_actions.ts`, `_guest-chat-client.tsx`, Stage 1.1 test file), migration 197, migrations 191-196, Hammerex seed, Vault, Bridge 99, Chat Master Layout, or any sealed surface.
- `package.json`, `scripts/assert-nexapp-cwd-and-remote.mjs`, Phase 3A guard tests — all read-only.
- Working-tree preservation: 29 pre-existing modified files intact; 108+ pre-existing untracked docs/data intact.

### Commands actually run

```
git -C /c/Users/Victus/nexapp rev-parse --show-toplevel
git -C /c/Users/Victus/nexapp branch --show-current
git -C /c/Users/Victus/nexapp rev-parse HEAD
git -C /c/Users/Victus/nexapp remote get-url {origin,--push origin}
git -C /c/Users/Victus/nexapp diff --stat <files>
git -C /c/Users/Victus/nexapp status --short
Get-NetTCPConnection -State Listen -LocalPort 3008
Glob/Grep (read-only) over src/, nex-supabase/migrations/, docs/doctrine/
./node_modules/.bin/tsc --noEmit    (reports 1614 errors; no .next output)
./node_modules/.bin/vitest run <focused suites>   (130/130 pass sample)
```

No `npm run build`, no `npm install`, no `npm run dev` stop/start, no DB query, no deploy.

---

## Stopping here

Awaiting owner decision on whether to proceed with B1 (env-var inventory) as the next bounded step. The report explicitly does **not** declare the application ready for any market. The Phase 1 chat+themes core is architecturally sound; the operational envelope around it needs the Phase F work above before any market claim can be made.

Keeping Stage 1.1 rate-limit work, migration 197, Hammerex seed, migrations 191-196, and the selective doctrine port all **isolated** per prior sealed agreements. None of them is touched by this audit; each remains an independent workstream.
