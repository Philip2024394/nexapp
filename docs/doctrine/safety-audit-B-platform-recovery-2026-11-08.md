# NEX Safety Audit · Part B · Platform + recovery

Read-only audit for NEX World-Class Safety Programme round 4 · sealed 2026-11-08.
Branch `nex-ireland-build-2026-11-06` · HEAD `fd615fe`.
Scope: `src/app/api/nex-native/**` · `src/lib/nex-native/**` · `nex-supabase/migrations/**`.

Tag legend: BUILT (code exists) · WIRED (called from a user/cron surface) · VERIFIED (tests cover) · REMAINING (visible gap) · BLOCKED (sealed-doctrine hold).

---

## Platform services matrix

### 1 · Authentication · WebAuthn + session invalidation
- BUILT: `src/app/api/nex-native/auth/webauthn/{enroll-start,enroll-finish,assert-start,assert-finish}/route.ts` · `src/lib/nex-native/security-service.ts`.
- WIRED: assert-start uses `withBreaker("supabase_auth_admin")` for `listUsers` (`assert-start/route.ts:103-107`); assert-finish uses `withRetry({idempotent:true,maxAttempts:3})` + same breaker for `getUserById` (`assert-finish/route.ts:222-252`). `generateLink` + `verifyOtp` INTENTIONALLY LEFT BARE (non-idempotent · `assert-finish/route.ts:212-220` owner comment).
- WIRED rate-limit: `security-rate-limit` imported by all 4 webauthn routes (actions `webauthn_assert`, `webauthn_enroll`).
- Session invalidation: `bumpSessionsInvalidatedAtForOwner` (`security-service.ts`) · tested by `__tests__/security-service-bump-invalidation.test.ts`. Session mutation (`revoke`, `revoke-all`) uses `rate-limit` with `session_revoke` action. No DB fallback mode for `session_revoke` (owner directive line 80 `security-rate-limit.ts:73-80`).
- Hang risk: WebAuthn client flow bounded by `generateAuthenticationOptions({ timeout: 60_000 })` (`assert-start/route.ts:148`). Breaker OPEN surfaces as HTTP 503 / 500, not a hang.
- VERIFIED: `recovery-wires.test.ts:127-168`, `__tests__/assert-routes.test.ts`, `__tests__/enroll-routes.test.ts`.
- REMAINING: assert-start's `listUsers` paginates only page 1 × 200 users — not a hang vector, but a known enumeration cap (owner comment `assert-start/route.ts:101`).

### 2 · Uploads / media
- BUILT: `src/app/api/nex-native/attachment/encrypted/route.ts` (upload · bucket write) + `src/app/api/nex-native/attachment/encrypted/signed/route.ts` (signed URL).
- WIRED: Size cap `NEX_PEER_ATTACHMENT_MAX_BYTES + 1024` enforced at `encrypted/route.ts:34,51-56`. Private-bucket fail-safe (503) at `:77-82`. Participant check via `verifyParticipantForCiphertext` at `encrypted/signed/route.ts:69-80` collapses `not-found`+`not-participant` to 404 to avoid existence leak.
- Signed URL TTL 900s (`SIGNED_URL_TTL_SECONDS`, `encrypted/signed/route.ts:95`).
- REMAINING: NO resume / NO partial-upload recovery. Uploads are a single `arrayBuffer() → storage.upload` pass. A dropped connection mid-POST requires full re-upload. Encrypted path is non-idempotent (new `Date.now()-rand6` path per attempt) so DB-level dedup is not possible.
- REMAINING: no `withRetry` wrap around `storage.upload` in `encrypted/route.ts`. A transient 502 at the Supabase storage edge forces the client to retry the whole body.
- E2E posture preserved: server never sees plaintext (`encrypted/route.ts:11-15` comment + no decrypt code path).

### 3 · Realtime · Supabase channels
- BUILT: `src/lib/nex-native/realtime/channel.ts` (base wrapper · `.channel(name)`, broadcast + presence, no `postgres_changes`), `signalling.ts`, `typing.ts`, `presence.ts`, `people-presence.ts`, `message-events.ts`, `message-arrival.ts`, `incoming-calls.ts`.
- WIRED: Every realtime surface routes through `openNexChannel` (`channel.ts:80-161`). Topic naming `nex:<feature>:<scope>` enforced.
- Reconnect: delegated to Supabase SDK (`channel.ts:68-71` comment). Status handler surfaces `CHANNEL_ERROR` / `TIMED_OUT` via `onError` callback (`channel.ts:134-139`). No app-level reconnect backoff — relies on SDK internals.
- Missed-event handling: `onSubscribed` fires on initial + reconnect (`message-events.ts:62-66`) — consumers use it to trigger a catch-up fetch against `/peer-message/since` (`message-events.ts:22-23`). Doctrine: the realtime payload is a NUDGE, the authenticated fetch is the source of truth.
- Strict-mode / HMR safety: stale channel evicted synchronously from `realtime.channels` (`channel.ts:97-110`) so React double-mount cannot hang.
- REMAINING: no app-level quorum / stuck-channel detector. If the Supabase SDK's internal reconnect gives up, the consumer's `onSubscribed` never re-fires and the catch-up loop stalls.

### 4 · Notifications · Push / in-app
- BUILT: `src/lib/nex-native/notification-dispatch-service.ts` (fan-out) · `push-subscription-service.ts` (subscribe/prune) · `notification-preferences-service.ts` (opt-outs).
- WIRED: Dispatch is server-side, called from `sendPeerMessageAction`, `toggleMessageReactionAction`, `sendCallPushAction` (comments at `notification-dispatch-service.ts:31-42`).
- Fail-closed on prefs read AND Vault check (`notification-dispatch-service.ts:147-201`) — returns `skipped_reason: "prefs_unavailable" | "vault_check_failed" | "vault_rejected"`.
- Delivery reporting: `attempted / delivered / failed / pruned` semantics (`:117-128`). `delivered` is adapter-ack ONLY (NOT device display).
- Failure recording: 410/404 prune via `prunePushSubscription`; 429/5xx preserve subscription. No application-level incident write on repeated failures.
- REMAINING: NO rate-limit on push fan-out. NO dedup across concurrent sends (if `sendPeerMessageAction` is called twice in quick succession the push fires twice). NO application-level dedup window — relies solely on adapter 429.
- BLOCKED / BY DESIGN: mention category deferred (no send-site exists, `notification-dispatch-service.ts:44-49`).

### 5 · Payments / billing
- BUILT: `src/lib/nex-native/billing/{webhook-handler,webhook-processor,checkout-session,sell-payment-intent,reconciliation,supabase-store,entitlement,enforcement,cancellation,price-registry,store,shop-tier-enforcement,shop-tier-guard,vault-quota,video-duration-probe,sell-listing-count}.ts`.
- BUILT API: `src/app/api/nex-native/billing/{webhook/stripe,checkout,sell-listing-charge,cron/reconcile}/route.ts`.
- Status: ALL FILES CARRY `LOCAL DRAFT · NOT WIRED to real Stripe account yet` BANNERS (e.g. `webhook-handler.ts:4`, `webhook/stripe/route.ts:5-8`, `sell-listing-charge/route.ts:5`, `cron/reconcile/route.ts:5`).
- Enforcement: `vercel.json` schedules `/api/nex-native/billing/cron/reconcile` at `*/15 * * * *`. Env-gate `NEX_BILLING_CRON_SECRET` returns 500 `config_error` when unset (`cron/reconcile/route.ts:28-34`). Without the secret the cron is a no-op.
- "NEX never handles payments" sealed rule: PARTIALLY HOLDS. Stripe adapter code exists at `sell-payment-intent.ts` (constructs PaymentIntent · `sell-listing-charge/route.ts:32-43`) and webhook ingest at `webhook/stripe/route.ts`. Both are gated behind env-var absence. Per Scope Reduction sealed 2026-11-06, buyer-seller cart is REMOVED; shop-standard/unlimited + vault subscriptions remain allowed but operate via Stripe CHECKOUT (hosted), not direct capture. Verdict: WITHIN DOCTRINE as long as `STRIPE_WEBHOOK_SECRET` + `STRIPE_SECRET_KEY` + `NEX_BILLING_CRON_SECRET` remain UNSET in prod (owner-gated authorisation).
- UNIQUE idempotency: `nex_checkout_idempotency_unique` (`258_nex_billing_foundation.sql:375`) + `nex_checkout_stripe_session_unique` + `nex_checkout_stripe_sub_unique` + `nex_account_shop_stripe_sub_unique` + `nex_account_vault_stripe_sub_unique` (`258_nex_billing_foundation.sql:90, 93, 379, 385`). DB-layer dedup present.
- REMAINING: billing cron reconcile uses plain-string secret compare (`cron/reconcile/route.ts:36`), NOT timing-safe · a reconcile-cron secret leak via timing is theoretically possible but the surface is low-value (reconciler returns scanned counts only). Compare to security-audit-reconcile which IS timing-safe (`cron/security-audit-reconcile/route.ts:57-62, 76`).

### 6 · Search
- BUILT: `src/lib/nex-native/directory/search-service.ts`. Composes `searchCanonicalBusinesses` + `searchBusinesses` reads; deduplicates by `slug||id`.
- WIRED: Called server-side from `/nex-native/directory?q=…` (page server component). No dedicated API route under `src/app/api/nex-native/search/` — directory page handles it inline.
- Input bounds: `MAX_QUERY_LEN=100`, `MIN_LIMIT=1`, `MAX_LIMIT=24` (`search-service.ts:72-74`). Collapse-whitespace normalisation (`:76-82`).
- REMAINING: NO rate limiting on search. An unauth'd scraper can hammer `/nex-native/directory?q=` arbitrarily until Vercel's edge limits kick in. `search-service.ts` is bare — no `withTimeout` / `withBreaker` wrapper. A slow DB will stall every browser tab on the directory page.

### 7 · User profiles · `nex_account_profile` writers
- BUILT: `src/lib/nex-native/account-profile-service.ts` · `account-service.ts`.
- Idempotency: `createAccount` relies on DB UNIQUE constraint `supabase_user_id uuid UNIQUE REFERENCES auth.users(id)` (`001_nex_migration_history_and_account.sql:55`). Second create for same supabase_user_id raises constraint-violation.
- Validation gates at service layer: phone shape (`account-service.ts:71-82`), chosen_handle (`:83-89`).
- Draft prevention: no explicit draft concept in `account-service.createAccount` — insert is atomic; partial rows impossible.
- REMAINING: Profile edit flows (`/settings/profile/edit`) NOT audited here · separate verification needed to prove the profile writer also rejects concurrent-edit races.

### 8 · Country environment resolution
- BUILT: `src/lib/nex-native/app/resolve-app-identity.ts`. Env-var driven: `NEX_APP_IDENTITY ∈ {ireland, hq}` · `NEX_APP_COUNTRY ∈ {IE}` · Indonesia removed per owner directive 2026-11-03.
- Fail-closed: `AppIdentityError` with codes `missing-identity | invalid-identity | missing-country | invalid-country | identity-country-mismatch` (`:41-53`).
- WIRED: imported by `app/with-country-session.ts`, SSR chrome tests, and the `/api/nex-native/health` route (`health/route.ts` surfaces `app.identity` + `app.country` in response).
- REMAINING: Only 6 files in `src/app` reference it directly (grep · `_world-stylesheet.tsx`, `free-chat/page.tsx`, `free-chat/_canvas-client.tsx`, `_types.ts`, `contacts/_prototype-shared.tsx`, `/api/.../health/route.ts`). Country gating at per-API-route boundaries IS NOT universally enforced; relies on `data-nex-world` + SSR composition rather than inside every data mutation. Worth a dedicated sweep (not in this audit's scope).

### 9 · Background jobs / cron · `vercel.json`
- BUILT: 3 cron entries declared.
  - `/api/nex-native/harvest/tick` · `0 * * * *` (hourly) · `maxDuration=300` (`harvest/tick/route.ts:35`) · auth via `NEX_HARVEST_CRON_SECRET` header `x-nex-harvest-key` OR session (`:9-11`) · idempotent via `ON CONFLICT DO NOTHING` on canonical rows + per-tick `cycleId` UUID (`:70-74`). Failure recording: writes `nex.aof_cycle` row.
  - `/api/nex-native/billing/cron/reconcile` · `*/15 * * * *` · auth via `NEX_BILLING_CRON_SECRET` bearer (NOT timing-safe · `billing/cron/reconcile/route.ts:36`) · returns 500 config-error when unset.
  - `/api/nex-native/cron/security-audit-reconcile` · `*/10 * * * *` (vercel.json says `*/10`; the route header comment says `*/15` · minor stale doc) · auth timing-safe (`cron/security-audit-reconcile/route.ts:57-62, 76`) · idempotent via DB UNIQUE(`attempted_log_id`) in migration 293 (route comment `:33-44`). No `withIdempotencyKey` wrap by design (DB constraint is the idempotency primitive).
- REMAINING: Only `harvest/tick` sets `maxDuration`. The two reconcilers run under Vercel's default (likely 10s/60s depending on plan). A long-running reconciler can get cut off mid-batch — the UNIQUE constraint protects against double-write but partial progress is possible. Each cron has implicit timeout via Vercel; no app-level `withTimeout`.
- REMAINING: NO timing-safe compare in billing cron (see §5). Harvest tick's `x-nex-harvest-key` compare path not audited in this file.

### 10 · Secrets management
- Grep patterns (`sk_live_`, `AKIA...`, `ghp_...`, `xox[baprs]-`, `eyJ...` JWT, `password=…`, `SECRET='…'`) across `src/` returned:
  - Test / sanitiser / redaction / mock usages ONLY (e.g. `content-scanner.test.ts`, `incident-service.ts:106` redaction regex, `adversarial-corpus.ts:723` labelled corpus, `__tests__/security-audit-service.test.ts:245` sanitisation fixture, `src/lib/nex/observability/tests/redact.test.mjs:82`). No real credentials.
  - BILLING_README.md references `STRIPE_SECRET_KEY` as an env-var contract only.
- Dev fallback: `src/lib/nex/auth/session-signer.ts:15` ships a hard-coded `DEV_FALLBACK_SECRET = "nex-dev-only-do-not-use-in-prod-9f4e2b7a"`. Behaviour: when `NEX_SESSION_SECRET` is unset or <32 chars the signer falls back and `console.warn`s once (`:17-24`). Owner-doc comment says "In production we WOULD reject at boot rather than silently fall back" (`:20`). NOT a leaked secret, but the fallback path is OPEN — a misconfigured production env would sign sessions with a public constant. This is a legacy `src/lib/nex/` module; nex-native does NOT use this signer (uses Supabase sessions + nex_session via `security-service.ts`). Still flaggable for Phase-1.1 cleanup.

---

## Recovery callsite inventory

### withRetry · 2 production callsites
| File:line | Operation | idempotent | maxAttempts | sleep | Audit on failure |
|---|---|---|---|---|---|
| `src/app/api/nex-native/auth/webauthn/assert-finish/route.ts:222-244` | `nexSupabaseAdmin.auth.admin.getUserById(supabaseUserId)` | `true` | 3 | SDK default (exp backoff + jitter) | breaker records 1 failure after exhaustion; route returns `auth_user_missing` 500 |
| `src/lib/nex-native/recovery/__tests__/*` | test callsites (fault-injection + wire tests) | mixed | varies | injected | N/A (test harness) |

### withBreaker · 2 production callsites (shared breaker name)
| File:line | Breaker | failureThreshold | windowMs | cooldownMs | Degrade-when-OPEN |
|---|---|---|---|---|---|
| `src/app/api/nex-native/auth/webauthn/assert-start/route.ts:103-107` | `supabase_auth_admin` | 5 | 30_000 | 60_000 | falls through to empty allowCredentials (browser does resident-key discovery · `:108-118`) |
| `src/app/api/nex-native/auth/webauthn/assert-finish/route.ts:248-252` | `supabase_auth_admin` | 5 | 30_000 | 60_000 | returns `auth_user_missing` 503 (`:257-258`) |

Shared-breaker design: both auth-admin surfaces trip the same budget — an outage in gotrue opens once and both routes degrade coherently.

### withTimeout · 0 production callsites in nex-native app routes
| File:line | Timeout bound | Fallback |
|---|---|---|
| `src/lib/nex-native/health/health-probes.ts:39-55, :71-120, :122-169` | 2000ms (`DEFAULT_TIMEOUT_MS`) | returns `down` probe with `detail: "probe_timeout"` |
| `src/lib/nex-native/health/section-probes.ts:42, :61-77, :142-161` | 1500ms (`SECTION_TIMEOUT_MS`) | returns `down` probe with `detail: "probe_timeout"` |
| `src/lib/nex-native/recovery/degradation.ts:46-70` | caller-supplied | rejects with `TimeoutError` |
| legacy `src/lib/nex/comms-social/validators/*`, `src/lib/nex/marketing/deliverability/dns-domain-auth-checker.ts`, `src/lib/nex/brain/adapters/whatsapp-provider-adapter.ts` | per-call | legacy · outside nex-native sealed surface |

`withTimeout` from `recovery/degradation.ts` is NOT called by any nex-native API route in production code. Health probes have their OWN local `withTimeout` (not the shared one) — intentional per `section-probes.ts:62-77` comment ("Kept local so a future tweak here doesn't accidentally change core-probe semantics").

### withFallback · 0 production callsites
Only test callsites (`recovery/__tests__/degradation.test.ts`, `recovery-scenarios.test.ts`). The primitive is LIBRARY-ONLY.

### Idempotency surfaces
**In-memory layer** (`src/lib/nex-native/recovery/idempotency.ts`):
- `withIdempotencyKey` · caller callsites: 0 in `src/app`, 0 in `src/lib/nex-native` (apart from the module + its tests). Security-audit-reconcile route documents WHY it is not wrapped (`cron/security-audit-reconcile/route.ts:31-44` — DB UNIQUE is the correctness primitive).

**DB UNIQUE constraints enforcing idempotency**:
- `nex_checkout_idempotency_unique` · `258_nex_billing_foundation.sql:375`
- `nex_checkout_stripe_session_unique` · `:379`
- `nex_checkout_stripe_sub_unique` · `:385`
- `nex_account_shop_stripe_sub_unique` · `:90`
- `nex_account_vault_stripe_sub_unique` · `:93`
- `nex_adverse_open_dispute_unique`, `nex_adverse_refund_unique`, `nex_adverse_origin_unique`, `nex_adverse_admin_action_unique` · `:306-326`
- `nex_friend_request_idempotency_unique` · `264_nex_friend_request_idempotency.sql:221`
- `nex_security_audit_reconcile_sidecar UNIQUE(attempted_log_id)` · `293_nex_security_audit_reconcile.sql:95`
- `idx_nex_emergency_fanout_log_idempotency` · `224_nex_emergency_schema.sql:366`
- `nex_account.supabase_user_id UNIQUE` · `001_nex_migration_history_and_account.sql:55`

**Pattern**: NEX's idempotency strategy is DB-UNIQUE-first. The in-memory `withIdempotencyKey` exists but is unused in app code — the comment at `recovery/idempotency.ts:11-16` explicitly says the in-memory cache is "the FIRST layer, not the only layer" and strict dedup lives at the DB.

---

## Non-idempotent protection proof

For each family, confirmed NOT wrapped in blind retry:

| Family | Evidence · file:line |
|---|---|
| Payment capture | Billing stack is LOCAL DRAFT NOT WIRED (`webhook-handler.ts:4-5`, `sell-listing-charge/route.ts:5`). When wired: `sell-payment-intent.ts` uses `requestNonce` from client (`sell-listing-charge/route.ts:17`) + DB UNIQUE idempotency indices on `nex_checkout_*` (migration 258). No `withRetry` on PaymentIntent create. |
| Purchases / cart | Scope Reduction 2026-11-06 REMOVED buyer-seller cart entirely. No cart-checkout surface in HEAD. |
| Account creation | `account-service.createAccount` uses DB UNIQUE on `supabase_user_id` (`001...sql:55`). No `withRetry` wrapper. |
| Account deletion | `account-deletion-service.ts` orchestrates 5 fail-loud steps; each step is idempotent by design (nex_account_mark_deleted `coalesce`, mass-invalidate monotonic, auth.admin.deleteUser treats "not found" as success). No blind retry — an HQ-driven recovery handler exists (`account-deletion-recovery-service.ts`) for stuck half-states. |
| Message sending | `sendPeerMessageAction` not wrapped in `withRetry`. Each send writes a fresh row; app-level double-submit is addressed at the client via `Button disabled` while in-flight; server-side there is NO DB UNIQUE on (sender, body, sent_at) — a true duplicate IS possible on network retry. Mitigated by the sealed "arrival is a nudge, authenticated fetch is truth" realtime doctrine (`realtime/message-events.ts:16-23`). |
| Rate-limit counters | `security-rate-limit.ts` has a documented cold-bucket race (`:24-28`) — two concurrent calls at a fresh (key, action, window) both pass. Acceptable per owner directive. NOT retried via `withRetry`. |
| Order creation | No order surface in HEAD · Scope Reduction removed commerce beyond shop subscriptions. |

Explicit affordance: `withRetry({idempotent:false})` runs once and rethrows (`retry.ts:168-180`). `NonIdempotentRetryError` export at `retry.ts:139-147` lets callers signal refusal.

---

## Account deletion recovery readiness

- Half-state detection: `fetchHalfStateAccounts` (`account-deletion-recovery-service.ts:215-232`) — reader for HQ; queries `nex_account` where `deleted_at IS NOT NULL AND supabase_user_id IS NOT NULL`.
- Recovery handler: `retryAccountDeletionAuthStep` (`account-deletion-recovery-service.ts:77-203`).
  - Step 1 state-check: refuses any row that is NOT soft-deleted (`:88-100`).
  - Step 2 audit attempted: fail-loud (`:102-124`).
  - Step 3 Auth delete: "not found" treated as success (`:126-148`).
  - Step 4 finalize: `nex_account_finalize_deletion` SECURITY DEFINER RPC (migration 299 · `:150-170`).
  - Step 5 completion audit: fail-loud; orphan explicitly flagged for reconciler if this step fails (`:172-197`).
- Idempotent: second call sees `supabase_user_id IS NULL` and returns `{ok:true, already_complete:true}` (`:98-101`).
- HQ visibility: `fetchHalfStateAccounts` powers an HQ dashboard surface. Gate: HQ server action MUST call `requireHqAdmin` BEFORE invoking this service (service-level trust model documented at `:36-39`).
- VERIFIED: tests exist at `__tests__/account-deletion-recovery-service.test.ts` (not read in this audit; file present per directory listing).

---

## Failure-injection coverage · 15 scenarios

Tests in `src/lib/nex-native/recovery/__tests__/`:
- `recovery-scenarios.test.ts` (264 lines)
- `recovery-wires.test.ts` (265 lines)
- `attack-simulation.test.ts` (183 lines)
- `dependency-outage.test.ts` (206 lines)
- `section-isolation.test.ts` (229 lines)
- `retry.test.ts`, `circuit-breaker.test.ts`, `degradation.test.ts`, `idempotency.test.ts` (primitive unit tests)

| # | Scenario | Classification | Evidence |
|---|---|---|---|
| 1 | chat API down | TESTED | `section-isolation.test.ts:76-end` CHAT-DOWN case · probes 'chat' section + asserts others OK |
| 2 | feed query fails | TESTED | `dependency-outage.test.ts` uses the probe harness with mocked DB error · also `section-isolation` for feed-only |
| 3 | storage down | TESTED | `recovery-scenarios.test.ts:135-151` withFallback(storage) → cached value; `dependency-outage.test.ts` STATE.storageError path |
| 4 | realtime disconnect | UNTESTED | No `src/lib/nex-native/realtime/__tests__/` scenario exercising SDK reconnect — behaviour relies on Supabase SDK internals + `onSubscribed`-driven catch-up (`message-events.ts:62-66`). The catch-up ITSELF is not fault-tested. |
| 5 | auth timeout | TESTED | `recovery-wires.test.ts:132-168` ECONNRESET on `getUserById` · retries + breaker budget; `recovery-wires.test.ts:249-264` withTimeout bound |
| 6 | country env fails | UNTESTED | `app/__tests__/resolve-app-identity.test.ts` verifies the resolver throws; no scenario proves the downstream SSR surface degrades gracefully |
| 7 | section crashes | TESTED | `section-isolation.test.ts` (single-section failure matrix) |
| 8 | multi-section fails | TESTED | `section-isolation.test.ts` builds probe arrays via `buildSectionProbes([...])` + asserts `aggregateStatus` is worst-wins |
| 9 | upload mid-way failure | UNTESTED | No `__tests__/attachment-encrypted-route.test.ts` scenario for mid-body connection drop. Upload is one-shot `arrayBuffer()` — fails cleanly, but not exercised |
| 10 | double-submit | PARTIAL | `recovery/__tests__/idempotency.test.ts` tests `withIdempotencyKey` directly. BUT `withIdempotencyKey` has 0 production callsites — the application does not exercise this harness in-situ. Chat message double-send NOT TESTED at service layer. |
| 11 | recovery fails | TESTED | `recovery-scenarios.test.ts:225-243` HALF_OPEN probe failure returns to OPEN · does NOT prematurely recover |
| 12 | admin resolves | TESTED | `__tests__/account-deletion-recovery-service.test.ts` exists (not read); `incident-service` tests cover lifecycle in `incident/__tests__/` |
| 13 | incident returns | PARTIAL | Incident lifecycle transitions covered in `incident-service.ts:12-25`. A transient failure-then-recovery flow not exercised end-to-end as a single named scenario. |
| 14 | HQ loses realtime | NOT-APPLICABLE | HQ dashboard is desktop-only server-rendered polling; no realtime channel on HQ surfaces |
| 15 | incident DB temp unavailable | TESTED | `incident-service.ts:88-92, :169, :211` return `{ok:false, skipped:"table_not_available"}` without throwing; `incident/__tests__/incident-service.test.ts` + `dependency-outage.test.ts` cover the missing-table shape |

**Coverage summary**: 10/15 TESTED · 3/15 PARTIAL · 2/15 UNTESTED (realtime disconnect, upload mid-way) · 1/15 NOT-APPLICABLE (HQ loses realtime) · 1/15 UNTESTED (country env fails).

---

## Health monitoring verification

### `health-probes.ts` · 4 core probes
| Probe | Timeout | Missing-schema → | Mutation? |
|---|---|---|---|
| `probeDatabase` (`:71-120`) | 2000ms (`withTimeout` wraps · onTimeout returns `down + probe_timeout`) | reports `down + redacted message` · DB missing is not expected on `nex_migration_history` | read-only SELECT 1 |
| `probeStorage` (`:122-169`) | 2000ms | reports `down + redacted message` | read-only `listBuckets()` |
| `probeIncidentTable` (`:171-206`) | no explicit timeout (direct try/catch) | reports `unknown + "migration 300 not applied"` | read-only `SELECT id LIMIT 0` |
| `probeAuditTable` (`:208-243`) | no explicit timeout | reports `unknown + "migration 292 not applied"` | read-only `SELECT id LIMIT 0` |

- All 4 probes are READ-ONLY.
- Probes 3 and 4 correctly return UNKNOWN (never false-HEALTHY) on missing schema.
- Probes 1 and 2 return DOWN on error (not UNKNOWN) — a connectivity issue IS a legitimate down signal; NOT a false-HEALTHY path.
- REMAINING: `probeIncidentTable` and `probeAuditTable` do NOT have an outer `withTimeout` wrapper. A hung Supabase connection on these two probes can stall the `/api/nex-native/health` response. Minor exposure since the health route caller `GET /api/nex-native/health` would itself be subject to Vercel's edge timeout.

### `section-probes.ts` · 9 section probes
| Probe | Table | Timeout | Missing-schema → |
|---|---|---|---|
| `probeChat` (`:165-183`) | `nex_peer_conversation` | 1500ms | UNKNOWN |
| `probeShops` (`:185-204`) | `nex_business` with `deleted_at` filter | 1500ms | UNKNOWN |
| `probeFeed` (`:206-225`) | `nex_live_post` | 1500ms | UNKNOWN |
| `probeLive` (`:227-245`) | `nex_live_session` | 1500ms | UNKNOWN |
| `probeDirectory` (`:247-266`) | `nex_business` with `is_public=true` | 1500ms | UNKNOWN |
| `probeFood` (`:285-303`) | `nex_menu_item` | 1500ms | UNKNOWN |
| `probeFashion` (`:305-326`) | `nex_product` | 1500ms | UNKNOWN |
| `probeAccommodation` (`:328-346`) | `nex_accommodation_unit` | 1500ms | UNKNOWN |
| `probeProperty` (`:348-370`) | `nex_business` (proxy · owner note `:350-353`) | 1500ms | UNKNOWN |

- All 9 bounded timeout via `runProbe` → local `withTimeout` (`:142-161`).
- All 9 return UNKNOWN on `isMissingSchema` match (`:79-89` matches "does not exist", "undefined_table", etc.).
- All 9 are READ-ONLY (SELECT id LIMIT 1).
- `probeAllSections` fan-out parallel (`:374-386`) · total wall-clock bounded by max(timeouts).

### Route-health probe (HEAD sweep of `/nex-native/*`)
- Grep for `route.?health`, `routeHealth`, `sweep.?routes`, `HEAD.*/nex-native` returned ZERO production files.
- CONFIRMED NOT PRESENT · as expected.

---

## Top 10 recovery gaps to close next

1. **Realtime disconnect fault-coverage**: no test exercises the `onSubscribed`-driven catch-up when Supabase SDK gives up reconnecting. Add a scenario at `src/lib/nex-native/realtime/__tests__/`. Current reliance: SDK internals + visibilitychange + mount triggers (`message-events.ts:22-23`).
2. **Upload mid-way recovery**: `encrypted/route.ts` is one-shot `arrayBuffer()` — no resumable upload, no `withRetry` around `storage.upload`. Encrypted-path idempotency is intentionally difficult (fresh timestamp+rand6 per attempt). Design decision needed: either client-generated stable object key + DB dedup, or accept double-upload on retry.
3. **Push-notification dedup**: no app-level dedup window on `dispatchPushNotification` fan-out. A double-fire of `sendPeerMessageAction` produces two pushes. Add a short-TTL dedup key keyed on `(recipient, conversation_id, message_group_id)`.
4. **Billing cron reconcile · timing-safe compare**: `billing/cron/reconcile/route.ts:36` uses plain `!==` on bearer. Match `cron/security-audit-reconcile/route.ts:57-62` pattern (`timingSafeEqual` via `Buffer`-length-check-first).
5. **`withTimeout` on core incident/audit probes**: `probeIncidentTable` and `probeAuditTable` (`health-probes.ts:171-243`) lack the outer `withTimeout` wrapper the other two core probes use.
6. **Message-send DB dedup**: no DB UNIQUE constraint on `nex_peer_message (sender_account_id, message_group_id)` would protect against true double-send on client-retry. Current defence is client `disabled` + server-trust. A client-generated `message_group_id` plus DB UNIQUE would close the hole without server-side state.
7. **Country env gating per-route-boundary**: only 6 files in `src/app` reference `resolveAppIdentity`. Sweep all `src/app/api/nex-native/**/route.ts` for country-sensitive mutations and ensure each gates on resolver before performing the mutation. In-scope for Phase 1.1.
8. **Dev-fallback session signer** (`src/lib/nex/auth/session-signer.ts:15-24`): hard-coded fallback secret. Production path: require `NEX_SESSION_SECRET` at module boot (throw instead of `console.warn`). Legacy module, not used by nex-native, but still shippable with the bundle.
9. **Vercel `maxDuration` on reconcilers**: `billing/cron/reconcile` and `cron/security-audit-reconcile` do NOT set `maxDuration`. A long batch could be cut by Vercel. Idempotency protects correctness; `maxDuration` protects completeness.
10. **Search rate-limit**: `/nex-native/directory?q=…` reads flow through `search-service.ts` with no rate limit. An unauth'd scraper can hammer DB. Add `visitor_bootstrap`-shape limit or a new `directory_search` action in `security-rate-limit.ts`.

---

End of audit · READ-ONLY · no edits · no commits · no dev-server start · no migration apply. E2E encryption posture preserved (server-never-sees-plaintext confirmed at `encrypted/route.ts:11-15`).
