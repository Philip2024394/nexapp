# NEX v1 · Release-Completion Pass · 2026-11-14

**Verdict: NOT READY — specific blockers listed below.**
**Tested commit:** `14d7be1d` on branch `release-audit-v1-2026-11-14`.
**Environment:** local Windows 11, dev `.env.local` pointed at sandbox
Supabase `kdstoyyeygcopkogqsyv`. Production `ijvqdvsvwtwxzcqmoqit` not
touched. No push, no deploy, no migration, no bucket change, no
credential changes.

This pass is one bounded investigation + fix round and one final
regression. It does NOT replace the general audit (`docs/release-
audit-v1-2026-11-14.md`) or the payment audit (`docs/release-audit-
v1-payments-2026-11-14.md`) — those verdicts stand. This document
reconciles them against *new* evidence from this pass.

---

## 1 · New evidence collected this pass

### 1.1 · Production build was actually run

Two attempts of `npm run build`:

**Attempt 1 (`/tmp/next-build-output.log`):** failed during
`Collecting page data` with:

> `Error: Failed to collect configuration for /nex-native/call/preview`
>  caused by:
> `Error: NEX SEO: production requires NEX_PUBLIC_SITE_URL_IE to be set (country=ireland)`
> at `src/lib/nex-native/seo/site-url-resolver.ts:154`

This is a **real launch blocker** that `ignoreBuildErrors: true` does
NOT shield — it's a throw at module-eval time during page-data
collection, not a TypeScript error. Any Vercel production build will
hit the same throw unless `NEX_PUBLIC_SITE_URL_IE` (and likely
siblings for other countries) is set in the Vercel project env.

**Attempt 2** then died with `ENOSPC: no space left on device` — the
local disk filled to 100% (35 MB free). I did not delete anything
to free space; disk cleanup is a founder/operator action.

### 1.2 · Private-data boundary trace

Confirmed by direct inspection of `src/lib/nex-native/attachment/
bucket-config.ts`, `src/app/api/nex-native/attachment/encrypted/
route.ts`, `src/app/api/nex-native/attachment/standard/route.ts`,
`src/app/nex-native/chat/peer/[accountId]/_media-capture.tsx`, and
`src/app/nex-native/chat/peer/[accountId]/_composer.tsx`:

| Path | Where writes go today |
|---|---|
| Encrypted peer attachment | `nex-peer-chat-ciphertext` (private); fails 503 if bucket absent — no fall-back to public |
| "Send as standard" (user-opt-in plaintext) | `nex-peer-chat-ciphertext/std/*` (private); participant-gated signed URLs only |
| Recorder-sourced camera/video/voice | Same gate as picker; no bypass path |
| NEX1 Official (support) attachments | `nex-peer-chat-attachments` (public); **by sealed doctrine** — support plaintext |
| Business/venue logo + shop assets | `nex-business-assets` (separate bucket, since P1.T03 Step 1 2026-11-13) |

**Residual concern:** NEX1 Official attachments still land in a
*public* bucket. This is design, not a regression — but public bucket
+ guessable URLs ≠ ideal. A future ticket may move NEX1 Official to
the same participant-gated signed-URL mint. Not a v1 launch blocker
*if* owner accepts the design; is a launch blocker *if* NEX1 handles
ID-level PII. Flagged for founder decision.

### 1.3 · Dev-impersonation production guard

`src/lib/nex-native/app/dev-impersonation.ts:61-97`:

- Env var `NEX_DEV_IMPERSONATE_HANDLE` MUST be present (fail-closed if
  absent).
- When `NODE_ENV !== "production"` → impersonation allowed.
- When `NODE_ENV === "production"` → `NEX_SUPABASE_URL` is checked. If
  it contains the sealed prod ref `ijvqdvsvwtwxzcqmoqit`, impersonation
  is **refused**. Otherwise (preview envs pointing at sandbox) it is
  allowed.

**Verdict:** the guard cannot grant access to the production Supabase
project. Minor concern: the prod ref is hardcoded — if a new prod
project is ever created with a different ref, the guard would not
catch it. Owner/operator decision.

### 1.4 · Connect-detector fix stability

Fix at commit `12ceea43` (`src/lib/nex-native/billing/stripe-connect-
service.ts :: detectConnectColumns`) — no new evidence of defect this
pass. The fail-OPEN posture on unknown transient errors is intentional
and documented: the subsequent `INSERT` surfaces a real `42703` if
columns are truly absent. Not re-opened.

### 1.5 · Deployment runbook

Authored `docs/ROLLBACK.md` this pass (documented procedure, tested
recovery NOT verified). Flags the UNKNOWN items: Vercel project
linkage, PITR window, country site-URL env vars, the `_THIS_IS_NOT_
THE_APP.md` quarantine contradiction.

### 1.6 · Repo-identity inconsistency

Flagged, not fixed:

- `_THIS_IS_NOT_THE_APP.md` (2026-10-09) says this folder is NOT the
- `CLAUDE.md` (local, 2026-10-10) says "This IS the NEX app standalone
  repo".
- All recent commits (Stages 1-10, both audits, this pass) happened
  here.

The local `CLAUDE.md` is the newer seal and operational reality
follows it. The quarantine notice is stale. A future assistant may
be confused by it; founder may want to either retire the quarantine
notice or clarify the global rule.

---

## 2 · Reconciled launch ledger

Status key: BLOCKER-DEMONSTRATED (reproduced) · BLOCKED/UNVERIFIED
(cannot prove PASS from here) · NONBLOCKING · FOUNDER-DECISION.

### 2.1 · Blockers demonstrated this pass (new or re-confirmed)

| # | Finding | Evidence |
|---|---|---|
| L1 | `next build` fails on `NEX_PUBLIC_SITE_URL_IE` missing in production NODE_ENV | `/tmp/next-build-output.log` |
| L2 | Local disk is 100% full → cannot complete a local production build until disk is freed | `df -h /c` shows 35 MB free |

### 2.2 · Blockers inherited from prior audits (still in effect)

| # | Finding | Smallest next action | Acceptance criterion |
|---|---|---|---|
| P1 | Flow A subscription E2E not exercised (`STRIPE_WEBHOOK_SECRET` empty + Stripe CLI not installed) | Founder adds webhook endpoint in Stripe test dashboard OR installs Stripe CLI; copies `whsec_…` into `.env.local` | A sandbox Checkout → signed webhook → `BillingStore.markSubscriptionActive` round-trip observed |
| P2 | Flow B Connect test key lacks `connected_accounts:write` | Founder enables the scope on the restricted key or swaps for `sk_test_…` | Connect account-create returns a valid `AccountLink` URL |
| P3 | Flow B Connect webhook secret missing (`NEX_STRIPE_CONNECT_WEBHOOK_SECRET`) | Founder registers a SECOND webhook endpoint → distinct `whsec_…` | Signed `account.updated` and `checkout.session.completed` events verified end-to-end |
| P4 | Flow B PayPal has zero creds + missing column | Founder picks: (a) supply creds + authorise mig 336 apply, or (b) explicit v1 deferral | Either sandbox E2E works, or the UI surface stops offering PayPal |
| P5 | Vitest baseline 535-failing is not owner-accepted as nonblocking | Founder states acceptance OR engineering produces a bounded failure inventory with impact | Either explicit acceptance recorded, or the top clusters triaged |
| P6 | Stages 6-10 not browser-verified with two genuinely isolated contexts | Authorise one Playwright run with two separate browser contexts (not just sequential impersonation toggles) | Cross-shop isolation + owner-reply attribution observed live |
| P7 | No tested recovery from deploy or DB rollback | After launch, run one PITR restore drill into a staging environment | Restore completes; app connects to the restored DB |

### 2.3 · Nonblocking (polish / hygiene)

- Turbopack dynamic-filesystem-access warning on `src/lib/nex/
  idempotency/store.ts:53` — bundle-size risk, not functional.
- Next.js deprecation: `middleware.ts` file convention → should migrate
  to `proxy.ts` per the Next 16 upgrade notice. Non-blocking.
- NEX1 Official attachments land in public bucket by design; may want
  to move to signed-URL mint in a later cycle.
- 1,262 TypeScript errors in `src/*` — owner-accepted baseline per
  `ignoreBuildErrors: true`. Does not block `next build` in itself but
  masks real signals.
- 535 pre-existing vitest failures (97.6% pass rate).
- Repo quarantine-notice contradiction (`_THIS_IS_NOT_THE_APP.md` vs.
  `CLAUDE.md`).

---

## 3 · Verdicts (separate per payment flow)

| Flow | Verdict | Delta vs payment audit |
|---|---|---|
| Flow A · NEX subscription | **BLOCKED/UNVERIFIED** | No change · still waiting on webhook secret + E2E run |
| Flow B · Stripe Connect | **BLOCKED/UNVERIFIED** | No change · code fix at `12ceea43` still holds; key scope + webhook still owner-action |
| Flow B · PayPal | **BLOCKED/UNVERIFIED** | No change · creds + column missing |
| Flow B · QRIS | **NOT APPLICABLE** | Out of v1 by scope-reduction 2026-11-06 |
| Flow B · Checkout in chat | **PASS** (unchanged) | Handler + Playwright evidence preserved |

---

## 4 · Fixes applied this pass

**None.**

No reproduced code defect required a code change this pass. The one
new reproduced blocker (L1 · missing `NEX_PUBLIC_SITE_URL_IE`) is an
env-var provisioning task, not a code fix. The disk-full condition
(L2) is an operator task.

Docs added: `docs/ROLLBACK.md` and this file.

---

## 5 · Tests run this pass

- `npm run build` ×2 — both runs documented; both failed (one on env
  var, one on disk).
- No vitest run this pass (disk constrained; prior audit results
  preserved).
- No Playwright run this pass (bounded scope; prior results preserved).

---

## 6 · Final list of unresolved items

Founder-controllable (cannot be closed without founder action):

1. **Free disk space** on `C:` (currently 100% full; prevents local
   production build).
2. **Provision `NEX_PUBLIC_SITE_URL_IE`** + siblings for other
   countries, in `.env.local` locally and in Vercel prod env scope.
3. **Decide the Vercel project linkage** for `Philip2024394/nexapp`
   → populate it in `docs/ROLLBACK.md` § 1.
4. **Confirm Supabase PITR window** on the prod project; schedule
   one restore drill before launch (post-cutover acceptable too, but
   must happen before the first major schema change).
5. **Flow A Stripe webhook secret** (see § 2.2 P1).
6. **Flow B Connect key scope** + Flow B webhook secret (P2, P3).
7. **PayPal decision** (P4).
8. **Vitest baseline acceptance** (P5).

Engineering-closable (after founder decisions land):

9. Run one sandbox Flow A + Flow B Stripe E2E. (Needs P1-P3 done.)
10. Run two-session Playwright over Stages 6-10. (Standalone.)
11. Optional: migrate `middleware.ts` → `proxy.ts` per Next 16 notice.
12. Optional: fix the Turbopack dynamic-filesystem-access warning.

---

## 7 · What this pass did NOT cover

- No vitest re-run.
- No Playwright re-run.
- No real signup / recovery / vault unlock exercised.
- No production environment inspected.
- No migration applied in any environment.
- No bucket or policy change.
- No push.
- No deploy.
- No live charge.

---

## 8 · Honest statement

**The agreed v1 launch checks did not all pass in the tested environment.**
Seven inherited P1 blockers + two new L1/L2 blockers remain. Of those,
most require founder action (credentials, env-var provisioning, decisions)
and cannot be closed by engineering alone.

This pass's contribution: a reproduced build-time blocker nobody had
surfaced before (L1), a verified private-bucket boundary trace, a
verified dev-impersonation production guard, and a documented
(not yet tested) rollback runbook.

Technical readiness ≠ market demand, competitive superiority, or
revenue. Reliability work is honest; marketing claims belong to the
founder.

If the gates listed above close, re-audit at the final commit and
re-run § 5 before cutover.
