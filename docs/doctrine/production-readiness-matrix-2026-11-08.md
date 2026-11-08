# NEX Production-Readiness Matrix · 2026-11-08

Owner-directed Final Verification Phase synthesis. Written against branch
`nex-ireland-build-2026-11-06` after the Security Programme + Self-
Protection & Recovery build. This matrix is the authoritative answer to
the owner's instruction:

> *"Do not declare NEX production-ready merely because tests pass. Identify
> every remaining owner approval and every unverified infrastructure
> dependency."*

Status legend:

- **READY** — built, wired, tested, and the remaining work is owner infra
  (deploy / env / secrets / DNS) rather than engineering.
- **AMBER** — functionally built and safe to ship, but has known gaps
  documented below that should be closed or accepted before public launch.
- **BLOCKED** — a precondition is unresolved and the capability should not
  be declared live.
- **DEFERRED** — intentionally scoped out, documented, and not required
  for the launch posture requested.

Evidence pointers reference doctrine docs produced 2026-11-08 under
`docs/doctrine/` plus file:line citations in the codebase.

---

## 1 · Section health probes

| Capability                          | Status | Evidence |
|-------------------------------------|--------|----------|
| Core probes (chat/shops/feed/live/directory) | READY | `src/lib/nex-native/health/section-probes.ts:165-266` |
| Extended probes (food/fashion/accommodation/property) | READY | `section-probes.ts:285-370` · owner directive 2026-11-08 |
| UNKNOWN-on-schema-missing rule | READY | §13 preserved · `section-probes.ts:92-106` |
| Bounded timeout (1.5s per probe) | READY | `section-probes.ts:42` |
| Redacted detail field | READY | `section-probes.ts:51-59` |
| Parallel execution via `probeAllSections` | READY | `section-probes.ts:374-386` |

No remaining engineering gap. `?scope=sections` handler already consumes
`probeAllSections`.

## 2 · SectionBoundary coverage

| Capability                          | Status | Evidence |
|-------------------------------------|--------|----------|
| SectionBoundary component | READY | `src/components/nex-native/section-boundary/SectionBoundary.tsx` |
| `/api/nex-native/incident/section-error` endpoint | READY | Guest-callable POST · redacted `message_short` only · returns 200 |
| **Live-route wrap coverage** | **AMBER** | `docs/doctrine/section-boundary-coverage-2026-11-08.md` · zero live `/nex-native/*` routes currently wrap the component |

Eight routes map cleanly to existing `IncidentScope` values and should be
wrapped before public launch. Recommended order (highest blast-radius
first):

1. HQ (`/nex-native/hq/*`)
2. Chat peer thread
3. Live studio
4. Shops public + cart
5. Shops manage
6. Chat rest
7. Directory
8. Food · Fashion · Accommodation

Settings (19 pages) and community have no existing scope; adding
`"settings"` and `"community"` to `IncidentScope` + `LEGAL_SECTIONS`
requires owner authorisation first.

## 3 · Incident recorder + redaction

| Capability                          | Status | Evidence |
|-------------------------------------|--------|----------|
| `createIncident` + lifecycle transitions | READY | `src/lib/nex-native/incident/incident-service.ts` |
| REDACTION_PATTERNS (JWT / IPv4 / Stripe sk_ / password=) | READY | `incident-service.ts` |
| Chat body / attachment bytes / encryption keys leak-proof | READY | `docs/doctrine/incident-metadata-leak-review-2026-11-08.md` · GREEN on bodies/keys/tokens |
| Email / IPv6 / phone / OpenAI / AWS / GitHub / PEM / Stripe `rk_live_` / `api_key=` redaction | **AMBER** | Gap in `redactSummary` · regex additions already defined in review doc |
| `recovery_action_taken` field redaction | **AMBER** | `incident-service.ts:249` writes unredacted · fix: pass through `redactSummary` |
| `sanitiseMetadata` value-level scrub | **AMBER** | Key-name allowlist only · values under allowed keys can carry sensitive data |

The AMBER items are regex additions and a redaction wire · none affect
whether an incident gets recorded, they affect the *quality* of the
summary. Low-risk to land before launch. Overall verdict from the leak
audit: **AMBER — no secret/PII leak path found today; recommended
hardening listed inline.**

## 4 · Security monitor signals

| Capability                          | Status | Evidence |
|-------------------------------------|--------|----------|
| Rate-limit escalation signal | READY | `security-monitor.ts:reportRateLimitEscalation` |
| Auth anomaly signal | READY | `security-monitor.ts:reportAuthAnomaly` |
| Country resolution via `NEX_APP_COUNTRY` | READY | `security-monitor.ts:69-75` |
| 60s per-signature dedupe | READY | `security-monitor.ts:44-46` |
| **Dedup key is country-scoped** | **AMBER** | `docs/doctrine/country-isolation-verification-2026-11-08.md` · `dedupKeyBase` does NOT include country. Benign today (one country per process) · latent in multi-tenant/test. |

## 5 · Recovery primitives

| Capability                          | Status | Evidence |
|-------------------------------------|--------|----------|
| Bounded retry with jitter (`withRetry`) | READY | `src/lib/nex-native/recovery/retry.ts` |
| Circuit breaker (CLOSED→OPEN→HALF_OPEN) | READY | `src/lib/nex-native/recovery/circuit-breaker.ts` |
| Idempotency keys | READY | `src/lib/nex-native/recovery/idempotency.ts` |
| Graceful degradation helpers | READY | `src/lib/nex-native/recovery/degradation.ts` |
| Non-idempotent-never-retry contract honoured at every callsite | READY | `docs/doctrine/recovery-callsites-audit-2026-11-08.md` · every mutation surface (billing / delete / webauthn finish / send / vault / push subscribe) left unwrapped |
| Callsite wrap coverage | AMBER (by design) | Only `assert-start` + `assert-finish` currently wrap reads. 15 idempotent-read candidates (U-1..U-15) safe to wrap. Highest-value: `unread-count/route.ts`. No owner authorisation yet to expand. |

## 6 · Country isolation (Ireland / Indonesia / Worldwide)

| Capability                          | Status | Evidence |
|-------------------------------------|--------|----------|
| Country tag on incident write | READY | `security-monitor.ts:69-75` |
| DB CHECK on `country` enum | READY | Migration 300 |
| HQ dashboard server-side country filter | READY | `security-recovery/page.tsx:58-63` |
| Country-scoped index | READY | `idx_nex_incident_status_country` · planner-verified |
| **Shared Supabase project across countries** | **AMBER** | `docs/doctrine/country-isolation-verification-2026-11-08.md` · one DB serves all countries · country boundary is enforced in code only |
| **No country-scoped HQ role** | **AMBER** | Any HQ admin can read any country's incidents |
| HQ direct-message country gate | **AMBER** | No country scoping on HQ Nex direct-message sends |
| Indonesia enum accepted by monitor/schema but removed from `resolve-app-identity.ts:32` | AMBER | Partial removal · schema still accepts it |

These AMBER items are all *known-and-accepted-for-today* given the one-
country-per-deployment reality. Promotion to READY requires either (a)
owner acceptance of the single-DB posture in writing, or (b) a split-
project migration (not in scope for this phase).

## 7 · HQ Security & Recovery Centre

| Capability                          | Status | Evidence |
|-------------------------------------|--------|----------|
| Dashboard scaffold | READY | `src/app/nex-native/hq/security-recovery/page.tsx` |
| Incident drill-down page | READY | `security-recovery/[incidentId]/page.tsx` |
| 5 operator actions (ack / transition / assign / escalate / resolution-notes) | READY | `security-recovery/[incidentId]/_actions.ts` |
| Lifecycle transitions walk DETECTED→INVESTIGATING→PROTECTING→RECOVERING→RECOVERED | **READY** | `docs/doctrine/hq-security-recovery-e2e-2026-11-08.md` · 13/13 E2E PASS |
| Audit history (`fetchIncidentEvents`) | READY | ordered ASC · degrades gracefully when table absent |
| UNKNOWN state surfaced honestly | READY | §13 rule honoured end-to-end |

Honest deviation: a raw-SQL step-2 in the smoke test inserts without
the service's companion `created` event → 4 events observed not 5.
Documented in the E2E doc; not a product-code defect.

## 8 · HQ Nex direct-message

| Capability                          | Status | Evidence |
|-------------------------------------|--------|----------|
| `requireHqAdmin` gate on every entry point | READY | `docs/doctrine/hq-direct-message-security-review-2026-11-08.md` |
| Chat-body privacy (allowlist = target id + body length) | READY | Categorical prohibition on `message_body` / `chat_body` / `body_text` in audit payload |
| Soft-delete refusal server-side | READY | RPC refuses at migration 301:180-186 · crafted POST cannot bypass |
| Nex sentinel un-loginable | READY | Verified live · `supabase_user_id=null`, `deleted_at=null` |
| **Dedicated rate-limit action** | **AMBER** | Reuses `account_create` · 503 escalation ring shares side-effect |
| **Country gate** | **AMBER** | No country scoping (see §6) |
| **Operator retract/delete surface** | **AMBER** | Immutable trigger + no DELETE policy → only service_role via direct SQL · no HQ UI retract |
| Audit-payload defence-in-depth | **AMBER** | Add bare `"body"` to prohibition list |

## 9 · Incident metadata leak

Full doc: `docs/doctrine/incident-metadata-leak-review-2026-11-08.md`.

- **GREEN**: chat bodies, attachment bytes, encryption keys, session
  tokens CANNOT reach incident writes today.
- **AMBER**: regex gaps in `redactSummary` (emails, IPv6, phone, OpenAI
  `sk-proj-`, AWS, GitHub PAT/OAuth, PEM blocks, Stripe `rk_live_`,
  `api_key=`) + unredacted `recovery_action_taken` + key-only
  `sanitiseMetadata`.
- No RED findings.

## 10 · Backup / restore readiness

Full doc: `docs/doctrine/backup-restore-readiness-2026-11-08.md`.

| Capability                          | Status | Evidence |
|-------------------------------------|--------|----------|
| Application-level backup scripts | **DEFERRED** | None exist today · 100% reliance on Supabase default backups |
| Supabase backup tier verified | **BLOCKED on owner** | Tier assumption in doc · owner must confirm |
| Cascading-delete inventory | READY | 162 `ON DELETE CASCADE` across 81 migrations · documented |
| Sandbox-verifiable restore drill | READY | Scoped in doc · no destructive ops performed |
| **PITR / point-in-time restore drill** | **BLOCKED on owner** | Requires Supabase support window · not executable from sandbox |
| **Deletion-restore GDPR hazard** | **AMBER** | Snapshot taken before `nex_account_mark_deleted` can un-scrub a soft-deleted account's display_name/handle · documented · owner decision needed on post-restore re-scrub job |

## 11 · Security CI (GitHub Actions)

Full doc: `docs/doctrine/security-ci-verification-2026-11-08.md`.

| Capability                          | Status | Evidence |
|-------------------------------------|--------|----------|
| Workflow file + triggers (`nex-ireland-build-*`, `phase-*/*`, `main`) | READY | `.github/workflows/security-ci.yml` |
| `secret-scan` job (locally clean at 4736 files) | READY | Will PASS on first remote run |
| `dependency-audit` job (non-fatal) | READY | Will report; does not fail build |
| `typecheck` job | **AMBER** | Will FAIL on first run due to pre-existing TS2307 cluster in legacy `src/lib/nex/` tree (per CLAUDE.md known-issue) · recommended: scope tsc or soft-fail until legacy cleanup lands |
| `security-programme-tests` job | READY | 478 tests pass locally |
| **First remote run** | **BLOCKED on push** | `gh auth login` required by owner · run history not yet fetchable |

## 12 · Account deletion recovery

| Capability                          | Status | Evidence |
|-------------------------------------|--------|----------|
| Half-state detection | READY | `account-deletion-recovery-service.ts` |
| `retryAccountDeletionAuthStep` | READY | Migration 299 + HQ service + page |
| HQ operator surface | READY | `/nex-native/hq/security-audit/deletion-recovery` |
| GDPR erasure after recovery | READY | re-runs full deletion with scrub |

## 13 · Production-sealing posture (CRITICAL)

Across every migration, workflow, and operator action:

- **Production Supabase `ijvqdvsvwtwxzcqmoqit` has NEVER been written to** in
  this phase. Every migration 290-301 was applied to sandbox
  `kdstoyyeygcopkogqsyv` only.
- No production deploy has been triggered.
- No secrets have been added to any repo or environment.
- No destructive sandbox operations performed.
- CLAUDE.md §4 (Build-Commit-Push) and §5 (never-apply-prod-without-
  authorisation) honoured throughout.

---

## Remaining owner approvals required before public launch

1. **Backup tier confirmation** for `ijvqdvsvwtwxzcqmoqit` (free vs
   paid · determines PITR window).
2. **PITR restore drill** (owner must open Supabase support window).
3. **Country posture decision**: accept shared-project reality for
   Ireland + Indonesia + Worldwide, OR authorise split-project
   migration.
4. **SectionBoundary live-route wrap** authorisation (specifically for
   settings + community new-scope additions).
5. **Recovery-wrap expansion** authorisation for the 15 idempotent-read
   candidates (U-1..U-15) catalogued in the recovery audit.
6. **Audit-pattern expansion** authorisation to land the AMBER redaction
   additions (emails, IPv6, phone, OpenAI, AWS, GitHub, PEM, Stripe
   `rk_live_`, `api_key=`) + `recovery_action_taken` through
   `redactSummary` + value-level `sanitiseMetadata`.
7. **HQ direct-message hardening** authorisation for the three AMBER
   items (dedicated rate-limit action, country gate or explicit
   acceptance, operator retract/delete surface).
8. **GitHub Actions**: `gh auth login` on the operator machine so the
   first remote run's log is fetchable + a decision on the pre-existing
   typecheck failures (scope-narrow vs fix vs soft-fail).
9. **Deletion-restore GDPR posture**: post-restore re-scrub job
   authorisation (or formal acceptance of the risk window).
10. **`.github/workflows/security-ci.yml` first-run review** after the
    next push to `nex-ireland-build-2026-11-06`.

## Unverified infrastructure dependencies

- Supabase backup tier / PITR window.
- Supabase Storage replication contract for `nex-music-media` + any
  encrypted-attachment bucket.
- Vercel project environment variable completeness for each of
  `nex-ireland-preview`, `nex-indonesia-preview`, `nexapp` production.
- GitHub Actions runner egress to Supabase (first remote run will
  confirm).
- Legal review status (DAC7 / DSA / PSD2 / consumer-protection / GDPR)
  per sealed Social Commerce doctrine D4 · tracked separately.

## Live-readiness verdict

Security Programme + Self-Protection & Recovery are **engineering-READY
to AMBER** across the eleven capability groups above. The system is safe
to run and already provides verifiable observability, bounded failure
behaviour, and operator-driven recovery.

Public launch is **not** declared live until items 1-10 above are
approved or accepted by the owner. No code merge to `main` is required
for any of them; most are policy or infra calls.

---

Doctrine docs produced 2026-11-08:

- `section-boundary-coverage-2026-11-08.md`
- `recovery-callsites-audit-2026-11-08.md`
- `backup-restore-readiness-2026-11-08.md`
- `incident-metadata-leak-review-2026-11-08.md`
- `security-ci-verification-2026-11-08.md`
- `hq-security-recovery-e2e-2026-11-08.md`
- `country-isolation-verification-2026-11-08.md`
- `hq-direct-message-security-review-2026-11-08.md`
- `production-readiness-matrix-2026-11-08.md` *(this file)*
