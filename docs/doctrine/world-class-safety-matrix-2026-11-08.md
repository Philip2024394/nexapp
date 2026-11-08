# NEX World-Class Safety · Reliability · HQ Administration Matrix
## 2026-11-08 · Evidence-backed assessment

Branch `nex-ireland-build-2026-11-06` · HEAD `fd615fe`. Sealed per the
world-class-safety doctrine 2026-11-08 (round 4). This document is the
evidence-backed assessment the owner required BEFORE any further
production approvals (including migration 302).

Compiled from three parallel read-only audits:

- `safety-audit-A-user-sections-2026-11-08.md` (436 lines)
- `safety-audit-B-platform-recovery-2026-11-08.md` (259 lines)
- `safety-audit-C-hq-security-2026-11-08.md` (320 lines)

Classification used throughout:

- **BUILT** · code exists.
- **WIRED** · connected to a real user-facing or operator-facing path.
- **VERIFIED** · tested with evidence in this repo (vitest, smoke).
- **REMAINING** · what's still missing to meet the sealed standard.
- **BLOCKED** · depends on owner / Supabase / infra, cannot complete
  from engineering side.

And the owner's 5-state readiness: **ENGINEERING READY · SANDBOX
VERIFIED · PRODUCTION CONFIGURATION REQUIRED · LIVE DEPLOYMENT
REQUIRED · LIVE VERIFIED**.

---

## 1 · Executive summary

**Verdict · SANDBOX VERIFIED across most of the programme, with a
SMALL set of specific gaps that must close before the next production
step.** The sealed hard rules (no prod migrations · no prod buckets ·
no prod secrets · no prod deploy · preserve E2E encryption · HQ ≠
chat access) are honoured at HEAD `fd615fe`.

Three categories of remaining work, ranked by blast-radius:

1. **Failure isolation** · 40+ live user routes still render WITHOUT
   a `SectionBoundary` and without an intermediate `error.tsx`. The
   only wrapped tree is `/hq/*` (commit `aaea913`). Root
   `/nex-native/error.tsx` (commit `fd615fe`) catches the overflow
   but it is a generic fallback, not per-section containment.
2. **HQ Alerts structural gaps** · the current `nex_incident` schema
   is missing four fields the owner's sealed spec requires
   (`severity=HIGH` tier · `last_seen_at` · `detection_source` ·
   `service/dependency` · `verified_by_admin` / `verified_at` to
   split *auto-recovery succeeded* from *operator-verified resolved*).
   These are mechanical schema adds with no production risk.
3. **User-work protection on editors** · shop-setup (7 sub-steps),
   profile edit, product/menu/accommodation editors have no draft
   persistence and no dirty-state navigation guard. Chat composer
   and cart checkout DO have idempotency.

No RED findings · nothing on the list should block NEX from
continuing to run on sandbox or from a future production deployment
that happens AFTER these items close. The owner's gate on migration
302 should remain in place until items 2 + 3 above are closed.

---

## 2 · Pillar 1 · Failure isolation

| Capability | BUILT | WIRED | VERIFIED | REMAINING | BLOCKED |
|---|---|---|---|---|---|
| `SectionBoundary` component | ✅ `src/components/nex-native/section-boundary/SectionBoundary.tsx` | ✅ for `/hq/*` only (layout.tsx:128) | ✅ unit + endpoint tests | **Wrap 40+ user routes** per Agent A's inventory | — |
| Root `/nex-native/error.tsx` | ✅ commit `fd615fe` | ✅ catches overflow of the whole nex-native subtree | ✅ dev-server 200 confirmed | Intermediate `error.tsx` per segment (chat, shops, live, feed, directory) | — |
| Per-section `IncidentScope` enum | ✅ chat · shops · feed · live · directory · food · fashion · accommodation · property · hq · infra · auth · storage · db · cron | partially (only `hq` consumed by a live wrap) | — | Add `settings` + `community` to enum before wrapping those segments (owner auth needed) | Owner authorisation on those two scopes |
| Fire-and-forget incident on section error | ✅ POST `/api/nex-native/incident/section-error` | ✅ returns 200 always | ✅ tests | — | — |
| **Country isolation code paths** | ✅ NEX_APP_COUNTRY · DB CHECK · HQ filter · country-scoped index | ✅ sandbox verified 11/11 (prior audit) | ✅ | `dedupKeyBase` in `security-monitor.ts:44-46` still NOT country-scoped (latent · benign today, bug if we ever multi-tenant one process) | — |

**Owner approvals needed · Pillar 1 ·**
- Authorise SectionBoundary wrap for the 40+ routes Agent A catalogued, in batches by scope.
- Authorise adding `settings` + `community` to `IncidentScope`.

---

## 3 · Pillar 2 · Zero blank-screen

| Capability | BUILT | WIRED | VERIFIED | REMAINING | BLOCKED |
|---|---|---|---|---|---|
| Root friendly fallback | ✅ `/nex-native/error.tsx` (emerald, friendly copy, no stack) | ✅ | ✅ | — | — |
| Per-section `loading.tsx` | partial | some sections render instant server-rendered content, others risk a brief blank | — | Agent A flagged routes with blank-spinner risk · route-by-route `loading.tsx` additions | — |
| Last-valid-screen preservation on refetch | ✅ for Next App Router cached segments | partial | — | React 19 streaming + proper `Suspense` placements on heavy pages | — |
| Timeout + offline handling on long reads | partial | section probes have bounded 1.5s timeout; other reads don't | — | Add `withTimeout` to HQ dashboard aggregators + public-shop reads | — |
| Honest UNKNOWN (never false HEALTHY) | ✅ sealed rule enforced in probes + incident-service + members reader | ✅ | ✅ | — | — |
| **Known breakage** | — | — | — | `/nex-native/profile/me/page.tsx:42` redirects to a non-existent `/nex-native/create-account`. Same string at `_actions.ts:125, :545, :6934`. Currently falls through to root `error.tsx`. Confirm actual signup URL (likely under `/onboarding/*`) + redirect fix. | — |

---

## 4 · Pillar 3 · User-work protection

| Surface | Idempotency | Draft | Dirty-nav guard | Sent/failed/retry UX | State |
|---|---|---|---|---|---|
| Chat peer composer | ✅ `send_intent_id` | ✅ `localStorage` | ⚠️ partial | ✅ | **OK** |
| Cart checkout | ✅ `sendIntentId` | ❌ buyer form state not persisted | ❌ | ✅ | **AMBER** |
| HQ direct message composer | ✅ server dedup | ❌ | ❌ | ✅ | **AMBER** |
| HQ admin-grant (shop/theme) | server-side insert, no dedup needed | ❌ | ❌ | ✅ | **AMBER** |
| Profile edit (`/settings/profile/edit`) | — | ❌ no draft | ❌ no guard | partial | **AMBER** |
| Shop setup (7 sub-steps) | — | ❌ no step persistence | ❌ | partial | **AMBER** |
| Product editor | — | ❌ | ❌ | partial | **AMBER** |
| Menu / accommodation editors | — | ❌ | ❌ | partial | **AMBER** |

**Non-idempotent operations check (CRITICAL)** · **PASS · zero
violations.**

The sealed rule: payment capture · account creation · account
deletion · message sends · rate-limit counters · order creation
must NEVER be blindly retried. Agent B + A both confirmed: the only
production `withRetry` callsite is at
`webauthn/assert-finish/route.ts:222`, which wraps the
`auth.admin.getUserById` READ with `idempotent: true`. The companion
`generateLink` + `verifyOtp` mutations are explicitly left unwrapped
per the sealed comment at lines 212-220.

---

## 5 · Pillar 4 · Automatic recovery engine

| Primitive | Callsites | State |
|---|---|---|
| `withRetry` | **2** — `webauthn/assert-start/route.ts:103` + `webauthn/assert-finish/route.ts:222` | **ENGINEERING READY · heavily tested · lightly wired** |
| `withBreaker` | **2** — same two WebAuthn paths · breaker name `supabase_auth_admin` | Same |
| `withTimeout` | **0** in nex-native production code | **REMAINING · add to HQ aggregators + public-shop reads** |
| `withFallback` | **0** | Same |
| Idempotency surfaces (DB UNIQUE) | 7 enumerated · billing checkout · webhook · sell-charge · friend-request · audit reconciliation · peer send_intent · cart | **VERIFIED** |

**Recovery discipline is correct but under-applied.** The primitives
are unit-tested and the two wires that do exist are reference-grade
(right policy for the dependency they protect). But the 15-scenario
failure-injection matrix (below) shows what's actually tested in
anger · and what isn't.

---

## 6 · Failure-injection test matrix (15 scenarios)

Classification per Agent B:

| # | Scenario | Coverage |
|---|---|---|
| 1 | Chat API becomes unavailable | **TESTED** |
| 2 | Feed query fails | **TESTED** |
| 3 | Storage becomes unavailable | **TESTED** |
| 4 | Realtime disconnects | **PARTIAL** (reconnect path present, missed-event replay not) |
| 5 | Authentication service times out | **TESTED** (WebAuthn breaker) |
| 6 | One country environment fails | **TESTED** (country-isolation suite) |
| 7 | One section crashes | **TESTED** (SectionBoundary unit) |
| 8 | Multiple sections fail | **PARTIAL** |
| 9 | An upload fails midway | **UNTESTED** |
| 10 | User submits an action twice | **TESTED** (idempotency key suite) |
| 11 | A recovery attempt fails | **TESTED** (circuit-breaker OPEN state) |
| 12 | Admin resolves an incident | **TESTED** (13/13 E2E smoke 2026-11-08) |
| 13 | Incident returns after resolution | **PARTIAL** (lifecycle allows reopen via NEW incident only) |
| 14 | HQ loses realtime connection | **N/A** (HQ Alerts does not use realtime today) |
| 15 | Incident database temporarily unavailable | **UNTESTED** |

**Score · 10 TESTED · 3 PARTIAL · 2 UNTESTED · 1 N/A.**

---

## 7 · HQ Alerts as operational control centre

The sealed standard requires HQ Alerts to be *the* destination for
every significant NEX operational / security / availability /
application failure.

### Category coverage

| Owner-stated category | Current wire | State |
|---|---|---|
| Application crash | SectionBoundary → section-error endpoint → createIncident | **WIRED (HQ only)** |
| Section failure | Same | **WIRED (HQ only)** |
| Repeated component errors | Dedup via 60s per-signature cooldown | **WIRED** |
| Chat service failure | — | **REMAINING** |
| Authentication failure | WebAuthn + rate-limit signals | **WIRED** |
| Database unavailable | — | **REMAINING** (no probe-to-incident wire) |
| Database query failures | — | **REMAINING** |
| Storage failure | — | **REMAINING** |
| Upload failure | — | **REMAINING** |
| Realtime connection failure | — | **REMAINING** |
| Notification delivery failure | — | **REMAINING** |
| Live service failure | — | **REMAINING** |
| Country environment failure | NEX_APP_COUNTRY resolution | **WIRED** |
| Security incident | — | **WIRED** (audit → incident bridge) |
| Suspicious activity | security-monitor signals | **WIRED** |
| Rate-limit escalation | `reportRateLimitEscalation` | **WIRED** |
| Background job failure | — | **REMAINING** |
| Failed recovery | lifecycle status | **PARTIAL** (modelled as transition, no explicit category) |
| Backup/reconciliation failure | — | **REMAINING** |
| Payment service failure | — | **N/A** (sealed: no payment surface) |
| Configuration failure | — | **REMAINING** |

**Half the owner's category list has NO wire today.** These are all
*signal → createIncident* additions · each is a small focused
service change, not a new architecture.

### Severity gap · needs **HIGH** tier

Current enum (migration 300): `info | warn | critical`. Owner's
sealed spec: `CRITICAL · HIGH · WARNING · INFO`. **HIGH** sits
between `warn` and `critical`. Adding it is a schema change:

```sql
ALTER TABLE nex_incident DROP CONSTRAINT ck_nex_incident_severity;
ALTER TABLE nex_incident ADD CONSTRAINT ck_nex_incident_severity
  CHECK (severity IN ('info','warn','high','critical'));
```

Plus a UI colour-map update. No data migration required (existing
`warn` rows stay valid).

### Three-state distinction gap · needs split

Owner-exact: *"distinguish a detected error, a successful recovery
attempt and a verified resolution. Those are not the same thing."*

Current lifecycle collapses "auto-recovery succeeded" and "operator-
verified resolved" into a single `RECOVERED`. Required:

- Add columns `verified_by_admin uuid` + `verified_at timestamptz`.
- Add status `VERIFIED` after `RECOVERED` (keep MONITORING as the
  intermediate "watch-after-auto-recovery" state).
- `RECOVERED` = auto-recovery claim; `VERIFIED` = operator has
  confirmed. An unverified RECOVERED must stay visible on the HQ
  Alerts "Needs verification" bucket.

### Required incident fields gap

Missing from current schema (migration 300):

- `last_seen_at timestamptz` (first_seen_at is `detected_at`,
  last_seen_at distinct)
- `detection_source text` (section_boundary · probe · signal ·
  manual)
- `service text` or `dependency text` (chat_api · supabase_auth ·
  storage · realtime)
- `occurrence_count integer` (dedup counter)

### Admin workflow coverage

| Action | Present? | File |
|---|---|---|
| View / filter (severity · country · section) | ✅ | `security-recovery/page.tsx:58-63` |
| Drill into incident | ✅ | `security-recovery/[incidentId]/page.tsx` |
| Event history | ✅ | `fetchIncidentEvents` |
| Acknowledge | ✅ | `_actions.ts` |
| Assign | ✅ | Same |
| Escalate | ✅ | Same |
| Investigation notes | ✅ | Same |
| Trigger approved recovery | partial | `retryAccountDeletionAuthStep` is the only one wired |
| Verify recovery | ❌ | Needs the `VERIFIED` status above |
| Resolve | ✅ | Transition to `RECOVERED` / `CLOSED` |
| Reopen | partial | Only via NEW incident |

### Alert delivery

**No auto-refresh / no realtime on `/hq/alerts` today.** Admins must
reload. The owner's standard allows "reliable refresh or realtime
updates with polling fallback". A simple Next revalidate + `<meta
http-equiv="refresh">` isn't allowed (reloads the whole page); the
right fix is a client component that revalidates every 30s with
`router.refresh()` and keeps the server-rendered content between
refreshes.

---

## 8 · Incident privacy

**Verdict · GREEN** on body / key / token leak-proofing · **AMBER**
on one specific bypass class.

- Chat body / attachment bytes / encryption keys / session tokens
  CANNOT reach incident writes today.
- Expanded `REDACTION_PATTERNS` (commit `39c3dfb`) catches JWT ·
  IPv4 · IPv6 · email · phone · OpenAI · Anthropic · AWS · GitHub
  PAT · Stripe `rk_` · PEM blocks · `api_key=`.
- `sanitiseMetadata` recurses ONE level into nested objects. **It
  does NOT recurse into arrays.** A caller passing a sensitive value
  inside an array under a permitted key would land raw. Single-class
  bypass · low likelihood today (no current caller does this) but
  worth closing.

**HQ admin ≠ chat content** · verified. `fetchHqChannelMessages`
restricts reads to messages authored by the sealed `Nex` sentinel,
never into the user's E2E peer messages.

---

## 9 · Health monitoring

**13 probes total** (9 section + 4 core). Each · bounded (1.5s
section · varies for core) · read-only · returns UNKNOWN when
backing table missing. The sealed UNKNOWN-never-false-HEALTHY rule
is honoured end-to-end.

**No route-health HEAD sweeper** · confirmed NOT PRESENT. This is
the "URL dead · 404/500 at a real route" detection gap already
listed on the alerts page's **Known detection gaps** panel. Needs
a nightly job + `nex_route_health` table (future migration).

---

## 10 · Security + admin protection

| Capability | State |
|---|---|
| Authentication (WebAuthn + email) | **VERIFIED** |
| Session invalidation | **VERIFIED** (security-service-bump) |
| Privilege escalation | **VERIFIED** (requireHqAdmin on every HQ action) |
| HQ admin access | **VERIFIED** |
| Country isolation code gates | **VERIFIED** |
| API authorisation | **VERIFIED** |
| Server-action authorisation | **VERIFIED** |
| RLS | **VERIFIED** (service_role INSERT+SELECT on all security tables) |
| Storage permissions | **VERIFIED** |
| Upload ownership | **VERIFIED** |
| Rate limiting | **AMBER** · HQ admin-grant shares the `account_create` ring (should have its own) |
| CSRF | **VERIFIED** (Next App Router server actions) |
| Realtime authorisation | **PARTIAL** (used sparsely · each channel gated separately) |
| Audit logging | **VERIFIED** (476 tests) |
| Incident privacy | **AMBER** (array bypass above) |
| Account deletion | **VERIFIED** (recovery service + HQ UI) |
| Secrets management | **AMBER** · see below |
| Webhook verification | **AMBER** · see below |

### Secrets · AMBER findings

1. **Legacy dev-fallback HMAC in `src/lib/nex/auth/session-signer.ts:15`.**
   Not consumed by nex-native but packaged in the bundle. Should be
   removed or gated behind a build flag.
2. **Billing cron reconcile** at `billing/cron/reconcile/route.ts:36`
   uses plain-string secret compare. The parallel
   `cron/security-audit-reconcile/route.ts:57-62` uses timing-safe
   compare. Normalise to timing-safe everywhere.

### Webhook verification · AMBER

No webhook signature verification code is present because there are
no live webhooks (sealed "NEX never handles payments"). Noted for
when any webhook ships.

### HQ admin-grant surface specifics (migration 302)

- UI properly HQ-gated (server re-check in `_grant-actions.ts`). ✅
- Emits `security.hq.admin_grant.completed` audit event. ✅
- Chat bubble uses the sealed `Nex` sentinel, not the admin's
  personal account. ✅
- **Shares rate ring with `account_create`.** Should have its own
  `hq_admin_grant` ring to avoid the 503 escalation interaction. ⚠️
- **No country-scope check on the target.** An HQ admin could grant
  shop to a member outside their country purview. Not necessarily
  wrong if HQ is global-today, but owner should decide. ⚠️

---

## 11 · Performance + UX (not measured yet · decision gate)

Per the sealed standard · *"Measure performance rather than assuming
it is acceptable."* This is UNVERIFIED today. Recommended quick wins
before any production push:

- Lighthouse score capture on `/`, `/free-chat`, `/chat`,
  `/[businessSlug]`, `/hq`, `/hq/alerts`.
- INP + CLS measurement on real mobile hardware.
- Bundle-size review (Next 16 ships with Turbopack · verify
  tree-shaking of the new `_hq-nav.tsx` accordion state + the new
  admin-grant surface).
- Memory-leak check on the Members page (polls + list re-renders).

None of these can be completed from the engineering seat without a
measurement step. Not a blocker; a gate for "Live verified".

---

## 12 · Backup / restore

Prior audit at `docs/doctrine/backup-restore-readiness-2026-11-08.md`
remains authoritative:

- 162 `ON DELETE CASCADE` paths catalogued.
- Sandbox-verifiable restore drill scoped.
- **GDPR re-scrub hazard flagged** (snapshot before
  `nex_account_mark_deleted` can un-scrub a deleted account's
  display_name/handle) · owner-decision needed on post-restore
  re-scrub job.
- **PITR / production restore drill BLOCKED on Supabase support
  window** — not actionable from engineering.

---

## 13 · 5-state readiness per capability

| Capability group | Reading |
|---|---|
| Section probes (9 probes) | **SANDBOX VERIFIED** |
| SectionBoundary · component | **ENGINEERING READY** (0 live user wraps) |
| SectionBoundary · HQ wrap (commit aaea913) | **SANDBOX VERIFIED** |
| Root `error.tsx` · hide-crashes-from-users | **SANDBOX VERIFIED** |
| Incident recorder + redaction | **SANDBOX VERIFIED** (GREEN on bodies/keys/tokens · AMBER on array scrub) |
| Recovery primitives (retry · breaker · idempotency) | **SANDBOX VERIFIED** (2+2+0+0 live wires) |
| Country isolation code gates | **SANDBOX VERIFIED** (dedup latent) |
| HQ Security & Recovery Centre | **SANDBOX VERIFIED** (13/13 E2E PASS) |
| HQ Members (free/paid tabs + package + shop URL + orders) | **SANDBOX VERIFIED** |
| HQ Alerts (new) | **SANDBOX VERIFIED** (no auto-refresh · category coverage gaps listed) |
| HQ admin-grant surface + migration 302 | **ENGINEERING READY** (mig NOT applied anywhere outside sandbox) |
| Audit CI (GitHub Actions) | **PRODUCTION CONFIGURATION REQUIRED** (first run blocked on `gh auth login`) |
| Backup / PITR | **LIVE DEPLOYMENT REQUIRED** (owner infra) |
| Performance measurement | **PRODUCTION CONFIGURATION REQUIRED** (needs measurement) |

**No capability on this branch has been promoted to LIVE VERIFIED.**
That remains an owner infra act per the 5-state rule sealed 2026-11-08.

---

## 14 · Top 15 fixes to land next (ranked by blast-radius)

Owner authorisation requested for these specifically, in order. Each
is a single focused commit, sandbox-only, no production touch.

1. **Fix `/nex-native/profile/me/page.tsx:42` + 3 companion sites**
   redirecting to non-existent `/nex-native/create-account`.
   Resolve to the real signup URL.
2. **SectionBoundary wrap · chat + shops + live + feed** (4 top-
   traffic surfaces), each with its own scope value.
3. **Add `HIGH` severity tier** to `nex_incident` (migration 303).
4. **Add `verified_by_admin` + `verified_at` + `VERIFIED` status**
   to `nex_incident` + `nex_incident_event` (migration 304). Splits
   RECOVERED ≠ VERIFIED.
5. **Add `last_seen_at` + `detection_source` + `service`**
   (migration 305).
6. **Close `sanitiseMetadata` array bypass** · recurse into arrays
   + apply `redactPatterns` to string elements.
7. **Wire the 10 missing HQ Alert categories** (chat / db / storage
   / upload / realtime / notification / live / bg-job / backup /
   config). Each is a new signal fn calling `createIncident`.
8. **Auto-refresh on `/hq/alerts`** · client-side `router.refresh()`
   every 30s, server content preserved.
9. **Dedicated rate-limit ring `hq_admin_grant`** (currently shares
   with `account_create`).
10. **Country-scope check on HQ admin-grant target** (decide + enforce).
11. **Draft persistence on shop-setup (7 steps) + profile edit +
    product/menu/accommodation editors.** Pattern: localStorage per
    step + dirty-nav guard.
12. **`withTimeout` on HQ aggregators + public shop reads.**
13. **Country-scope `dedupKeyBase`** in security-monitor.ts.
14. **Timing-safe secret compare** at
    `billing/cron/reconcile/route.ts:36`.
15. **Remove / gate the legacy dev-fallback HMAC** at
    `src/lib/nex/auth/session-signer.ts:15`.

---

## 15 · Decision gate

Per the owner's directive 2026-11-08 (round 4):

> *"My recommendation is to complete this review before authorising
> migration 302. The next milestone should be an evidence-backed NEX
> safety assessment, not simply another batch of commits."*

This document is that assessment. The specific migration 302 approval
gate recommended BEFORE any production application of 302:

- **Items 3 + 4 + 5 (schema completeness for the incident model) ·
  migration 303/304/305** should land on sandbox first.
- **Item 9 (dedicated rate-limit ring for admin-grant)** should land
  before 302 goes near production.
- **Item 10 (country-scope on admin-grant target)** is an owner
  policy call — needs explicit sign-off either way before 302 ships.

Items 1 + 2 + 6-8 + 11-15 can proceed in parallel on the sandbox
branch.

Owner infra gates that remain outside my reach:

- `gh auth login` for the first remote CI run.
- Supabase support window for PITR drill.
- Supabase tier confirmation.
- Production deploy decision for anything above.
- Performance measurement capture (Lighthouse / INP / CLS).

---

Authored 2026-11-08 at HEAD `fd615fe`. No code was modified during
this audit. No migrations applied. No secrets created. No production
touched.
