# NEX Founder Engineering Mapping Audit · Pass 1

**Date sealed:** 2026-11-24
**Audit mode:** Read-only. No application code was edited to produce this document.
**Repository:** `C:/Users/Victus/nexapp` (nexapp Next.js 16 app; this is **not** D:/trades)
**Scope:** Discovery pass against the current `main`-branch state. Not a fix plan.

---

## 0 · Why this document exists

Founder directive 2026-11-24 paused D5a feature work and commissioned a complete mapping audit before any further feature-building. The goal is a traceable, evidence-backed answer to:

> *"Show me everything NEX contains, how every part connects, what has been verified, and what is still missing."*

This Pass 1 produces: (a) reconciliation of the feature ledger against actual code, (b) discovery of orphans not tracked by the ledger, (c) coverage of sealed requirements against implementation, and (d) a connection-integrity probe for mock UI / dead actions / unapplied migrations / tables lacking RLS.

**It does not propose fixes.** Decisions on what to do next sit with the Founder.

---

## 1 · Founder Engineering snapshot

| Metric | Count | Notes |
|---|---|---|
| Ledger feature IDs | 23 | NEX-001 … NEX-023 |
| Ledger entries cleanly matching code | **18** | |
| Ledger entries with medium drift | **2** | NEX-015, NEX-022 |
| Ledger entries with high-severity false claim | **0** | ledger is substantively honest |
| Feature zones built in code but NOT in ledger | **5** | NEX LIVE · Music · Group Calls · Family Safety · Notifications |
| Sealed decisions with unclear implementation state | **12** | mostly await purge / RLS / schema reconciliation |
| Routes with mock UI (no backend persistence) | **1** | `/settings/payments` — owner-sealed as "Phase B" |
| Dead server-action files (zero callers in `src/`) | **13** | mostly orphan feature cuts |
| Unapplied migrations with dependent user-visible code | **7** | 224, 225, 300, 315, 316, 317, 341, 343 |
| Tables without visible RLS policies | **6** | 3 support, 3 emergency/incident — RLS deliberately deferred by sealed comment |

**Headline:** the ledger is a credible record of the 23 strategic features it tracks. The structural risk sits elsewhere — in five undeclared feature zones that are in-code but unaudited, and in a cluster of unapplied migrations whose dependent surfaces will fail at runtime.

---

## 2 · Six-area coverage grid (per ledger feature)

Legend: **✓** code+tests match ledger · **◐** code present, verification missing · **✗** gap or not started · **—** not applicable

| ID | Feature | A Product | B Journeys | C Architecture | D Data/Security | E Integrations | F Testing |
|---|---|---|---|---|---|---|---|
| 001 | Merchant data export | ✓ scope sealed in ADR-0001 | ✗ no route | ✗ | ✗ no mig | ✗ | ✗ |
| 002 | Product import | ✗ no requirement doc | ✗ | ✗ | ✗ | ✗ | ✗ |
| 003 | Account appeals | ✗ blocked on phrase | ✗ | ✗ | ✗ | ✗ | ✗ |
| 004 | Device-local outbox | ✓ | ◐ | ✓ `location/outbox.ts` + mig 103 | ✓ | ✓ | ◐ no test cited |
| 005 | P2P fallback | ✓ scope=research | ◐ status-only | ◐ RTCDataChannel in status-p2p + calls | — | ◐ | — |
| 006 | Why NEX page | ✓ | ✓ `/why-nex/` | ✓ | — | — | ✗ no Playwright |
| 007 | Switch savings calc | ✓ | ✓ `/switch/` | ✓ client component | — | — | ✗ no Playwright |
| 008 | Product-sharing → checkout | ✓ | ✓ chat/peer | ✓ | ✓ mig 077/078/354/365 | ✓ | ✓ 3 tests |
| 009 | Chat Teams (shop inbox) | ◐ | ◐ `/manage/shop/inbox` | ◐ multi-member not built | — | — | ✗ |
| 010 | Shop templates | ✓ | ✓ 4-step wizard | ✓ 11 layout IDs | ✓ | — | ✗ |
| 011 | Flippable chat cards | ◐ Safe Trade only | ◐ one instance | ◐ | — | — | ✗ |
| 012 | Chat translation (pilot) | ✓ sealed founder-only | ✓ bubble control | ✓ `_translation-layer.tsx` | — | ◐ | ✓ 1 test |
| 013 | Vault preservation | ✓ | ◐ unlock unverified | ✓ mig 140-143 | ✓ | — | ✓ 25 test files |
| 014 | Side-drawer Why NEX link | ◐ blocked on option a/b/c/d | ✗ | — | — | — | — |
| 015 | Monthly shop billing (Stripe) | ✓ | ◐ UI present | ⚠ webhook present, **no checkout route** | ✓ price-registry | ◐ Stripe webhook only | ✗ payment path never exercised |
| 016 | Merchant-direct payments | ✓ sealed 2026-11-10 | ◐ | ✓ mig 311 + connect routes | ◐ sandbox state unverified | ◐ Stripe Connect | ✗ |
| 017 | Device-only E2E chat | ✓ sealed doctrine | — server-side | ◐ encrypted path + mig 093 | ⚠ `body` column still exists (schema debt) + purge mig 097 | — | ◐ |
| 018 | HQ incident/alerts | ✓ | ✓ UI present | ✓ | ⚠ mig 300 not applied to prod · mig 304 sandbox only | — | ✗ |
| 019 | Support tickets | ✓ sealed sandbox-only | ✓ UI present | ✓ ticket-service | ⚠ mig 315/316/317 NOT APPLIED anywhere | — | ✗ |
| 020 | Emergency help | ✓ sealed 2026-11-09 | ✓ UI present | ✓ emergency-service | ⚠ mig 224/225 NOT APPLIED | — | ✗ |
| 021 | Full-viewport rule | ✓ sealed 2026-11-24 | ◐ splash only | ◐ reference impl only | — | — | ✗ no `full-viewport-chrome.spec.ts` |
| 022 | PWA install promotion | ✓ sealed 2026-11-24 Option A | ⚠ ledger says NOT STARTED but drawer row `install-nex` added | ✗ no `beforeinstallprompt` capture · no card · no cooldown | — | — | ✗ |
| 023 | Location permission timing | ✓ sealed 2026-11-24 | ✗ no explanation card | ✗ no gated prompt | — | ✗ geolocation call-sites unaudited | ✗ |

---

## 3 · Divergences from the ledger

### 3.1 · NEX-015 · Stripe checkout route missing
- **Ledger claim:** "CODE PRESENT · price-registry + checkout + webhook"
- **Code reality:** `src/lib/nex-native/billing/price-registry.ts` exists · `src/app/api/nex-native/stripe/webhook/` exists · **no `/api/nex-native/stripe/checkout/` route** was found.
- **Severity:** MEDIUM. The ledger implies a complete Stripe flow; only the webhook end is wired. The monthly-shop-billing payment path cannot actually be initiated from the server.
- **Owner impact:** release gate NEX-015 "payment path NEVER EXERCISED" is stricter than currently documented — it's not just un-exercised, the initiating endpoint is missing.

### 3.2 · NEX-022 · Drawer row added despite "NOT STARTED"
- **Ledger claim:** "RULE SEALED · NOT STARTED · no card/modal, no beforeinstallprompt capture, no side-drawer row"
- **Code reality:** `src/components/nex-native/control-drawer/control-drawer-client.tsx` lines 433-438 now contains an `install-nex` row, verified by regression test at line 294. The row was added 2026-11-24 (same day as the seal).
- **Severity:** MEDIUM. The *state* is drifted (partial started, not "not started") though no false feature claim is made.
- **Owner impact:** ledger line needs a correction pass once a feature session touches NEX-022; do NOT re-add the row.

### 3.3 · NEX-004 · File-path prose minor drift
- Ledger prose vs actual file location differs very slightly; file content is correct. LOW severity; prose cleanup.

No other HIGH-severity divergences were found. The remaining 20 ledger entries materially match code state.

---

## 4 · Orphan zones (code without a ledger entry)

Five feature zones are implemented in code (routes + migrations + server actions) but are absent from the NEX-001…023 ledger. These are not "mock UI" — they are real, shipped-or-near-shipped surfaces that have been audit-invisible.

### 4.1 · NEX LIVE (live-commerce)
- **Migrations:** 29, 219, 222, 226, 233, 234 (`nex_live_post`, `nex_live_session_and_featured_product`, `nex_live_engagement`, `nex_live_participation`, `nex_live_post_directory_v`, `nex_live_jail`).
- **Surfaces:** `/live-commerce/guidelines/page.tsx`, `/live-commerce/studio/page.tsx` + public viewer routes.
- **Tests:** several Playwright specs under `live-commerce-*.spec.ts` (visible in `playwright.config.ts`).
- **Risk:** large surface area, sealed from prior sessions (migration 219 fail-open behaviour referenced in memory), but no ledger ID.
- **Proposed ID when adopted:** NEX-024.

### 4.2 · Music (upload + streaming)
- **Migrations:** 235, 236, 240, 241 (track table, active slot, rights ack, media bucket). Sealed 2026-10-29 per doctrine docs.
- **APIs:** `/api/nex-native/music/stream/route.ts`, `/api/nex-native/music/upload/route.ts`.
- **Server actions:** `src/lib/nex-native/music/upload-actions.ts`.
- **Risk:** complete musician-content feature with storage bucket, zero ledger ID. Public-music-listening doctrine from 2026-10-30 depends on this zone.
- **Proposed ID when adopted:** NEX-025.

### 4.3 · Group Calls
- **Migrations:** 133, 307, 353 + revisions 356, 357 (group call core + country metadata + transactional invite RPC).
- **APIs:** `/api/nex-native/calls/incoming-group/route.ts`.
- **Surfaces:** `/group-chat/[groupId]/*`.
- **Risk:** multi-call infrastructure, 7 migration iterations — a high-churn zone with no ledger ID.
- **Proposed ID when adopted:** NEX-026.

### 4.4 · Family Safety (FS-2)
- **Server actions:** `src/lib/nex-native/family-links/_server-actions.ts`, `family-safety/child-account-creation/_server-actions.ts`, `family-safety/subscription/_server-actions.ts`.
- **Risk:** child-linking + parental control surface implied by action set, no routes visibly wired to it. See §5.2 below — these are flagged as **dead server actions**, which strongly suggests a feature cut that never completed.
- **Proposed ID when adopted:** NEX-027 — **but** evaluate first whether to retire the code, not ship it.

### 4.5 · Notifications (in-app inbox)
- **Migration:** 366 (`nex_notification`).
- **Policy:** owner directive 2026-11-23 "Connect drawer to real notifications."
- **Risk:** sandbox-gated apply, no ledger entry; needed by Contacts/drawer surfaces for persistent read-state.
- **Proposed ID when adopted:** NEX-028.

---

## 5 · Connection integrity

### 5.1 · Mock UI (interactive surface with no backend)

Only **1** candidate found:

- `src/app/nex-native/settings/payments/` — `SaveSettingsButton` + `PaymentSettingsClient` toggles persist to local state only. The code is explicitly annotated "ships with Phase B" and appears to be owner-sealed as intentionally-incomplete. **Not a false claim** but a release-blocker if the shop-billing flow is ever marketed as live.
- `live-commerce/studio` metrics are labelled "demo" — this is honest-state behaviour, not a mock UI bug.

### 5.2 · Dead server actions

Thirteen server-action files have exported functions with **zero** callers in `src/`:

| File | Zone |
|---|---|
| `src/app/nex-native/contacts/_picker-actions.ts` | contacts picker |
| `src/app/nex-native/hq/members/[accountId]/_grant-actions.ts` | HQ grants |
| `src/app/nex-native/settings/payments/_qr-actions.ts` | QR upload (merchant payments) — only test-file imports |
| `src/app/nex-native/_bank-details-actions.ts` | bank details |
| `src/lib/nex-native/account-wall/server-actions.ts` | sign-in/up walls |
| `src/lib/nex-native/directory/listing-chat-actions.ts` | directory listing |
| `src/lib/nex-native/family-links/_server-actions.ts` | family safety |
| `src/lib/nex-native/family-safety/child-account-creation/_server-actions.ts` | family safety |
| `src/lib/nex-native/family-safety/subscription/_server-actions.ts` | family safety |
| `src/lib/nex-native/follow/follow-actions.ts` | follow graph |
| `src/lib/nex-native/music/upload-actions.ts` | music |
| `src/lib/nex-native/watches/watch-listing-actions.ts` | watches |
| `src/lib/nex-native/follow/*` | follow graph |

**Caveat:** grep-based detection may miss dynamic imports or server-form `action={...}` bindings in TSX; confirm each individually before deletion.

**Interpretation:** at least 4 feature zones (family-safety, follow, music, watches) ship server actions that nothing in `src/` calls. These are either (a) orphans from prior feature cuts that should be deleted, or (b) genuine features whose routes were never wired. Each merits an owner decision.

### 5.3 · Unapplied migrations with dependent surfaces

Seven migrations have code paths that will fail at runtime if the migration is not in the database:

| Migration | Depended on by | Risk |
|---|---|---|
| **315 / 316 / 317** support tickets | `/hq/support-tickets/page.tsx`, `/nex-1/`, `ticket-service.ts` | PRODUCTION BLOCK — admin + user surface both crash |
| **224 / 225** emergency help | `emergency/actions.ts`, `/emergency-help/*` | RUNTIME FAILURE on SOS flows |
| **300** HQ incident | `/hq/members/page.tsx` (defaults green on missing table) | SILENT SILENCE — production ops sees "healthy" with no incidents |
| **304** incident v2 | `/hq/security-recovery/page.tsx` | SANDBOX-ONLY (per memory) |
| **341 / 343** bubble colours | `free-chat/_customize-actions.ts`, `settings/chat-settings/bubble-colours`, `chat/preview/my-view` | SILENT DEGRADATION — service-layer catches missing-column and falls back to cookie; users think their save worked, next device sees defaults |
| **311** Stripe Connect | `settings/payments/_stripe-connect-client.tsx` | HONEST FAIL — service returns 422 `columns_not_applied`; UI surfaces the error |

Migrations 341/343 are the most insidious: the UI reports success, the cross-device persistence silently fails because the service layer catches the missing-column error and falls back to the cookie set in-session. **This is the "mock UI by accident" case** that the Founder Engineering directive specifically targets.

### 5.4 · Tables with deferred RLS

Six tables were created without RLS policies in their creation migration. Of those:

- **`nex_support_ticket` / `nex_support_message` / `nex_support_admin_grant`** (mig 315) — sealed comment explicitly says "RLS deferred to a separate migration so policy sign-off happens independently." Defence-in-depth `REVOKE ALL FROM anon, authenticated` present; service-role-only by design. Follow-on RLS migration not yet authored.
- **`nex_emergency_incident`** (mig 224) — same pattern: "RLS deferred."
- **`nex_incident`** (mig 300) — REVOKE present, no policies.
- **`nex_generation_job`** (mig 011) — service-role-only by design.

These are not accidental omissions; the sealed comment establishes a design pattern (two-stage: schema first, policies separately). The risk is that the follow-on RLS migration is never authored before the tables are populated with production data.

---

## 6 · Prioritised gap register

Severity scale: **S1** = feature shipped-or-marketed with a broken persistence/security assumption; **S2** = sealed decision without implementation; **S3** = orphan or cleanup debt.

| Rank | Severity | Gap | Where | Minimal next step (NOT authorised yet) |
|---|---|---|---|---|
| 1 | S1 | Bubble-customize save silently discards cross-device state | mig 341/343 unapplied; `bubble-colours-service.ts` catches error and returns cookie | Apply mig 341+343 to sandbox, confirm write, then OWNER DECIDES prod apply |
| 2 | S1 | NEX-015 Stripe checkout endpoint missing | no `/api/nex-native/stripe/checkout/` route | Confirm whether this is intentional (manual invoicing) or a gap; update NEX-015 ledger entry either way |
| 3 | S1 | Emergency Help (NEX-020) will runtime-fail if used | mig 224/225 not applied; code reads from non-existent tables | Sandbox apply + E2E test before any owner can use the feature |
| 4 | S1 | Support tickets surface crashes on load | mig 315/316/317 not applied; `/hq/support-tickets/` queries non-existent tables | Sandbox apply + sandbox-only release (memory confirms this is already the owner's stated plan) |
| 5 | S2 | PWA install promotion sealed 2026-11-24 but drawer-row added without card / capture / cooldown | NEX-022 partial | Scope the remaining pieces or revert the drawer row to match "not started" |
| 6 | S2 | Location permission card not built | NEX-023 | Scope the explanation-card + SOS pre-prompt |
| 7 | S2 | Full-viewport rule verified only on splash | NEX-021 | Author `full-viewport-chrome.spec.ts` + audit every nex-native route |
| 8 | S2 | Device-only E2E chat body-column schema debt | NEX-017 | Verify mig 097 purge actually running in sandbox; plan body-column drop as separate migration |
| 9 | S3 | Five orphan feature zones not in ledger | NEX LIVE, Music, Group Calls, Family Safety, Notifications | Adopt into NEX-024…028 OR formally mark out-of-scope |
| 10 | S3 | 13 dead server-action files | §5.2 | Owner picks: retire or wire; grep-confirm each before delete |
| 11 | S3 | Follow-on RLS migrations missing for support + emergency + incident tables | §5.4 | Author RLS migrations before sandbox tables see real data |
| 12 | S3 | Four high-exposure owner-sealed requirements lack implementation | NEX-001, NEX-003, NEX-022, NEX-023 | Owner-driven; scope decisions already pending |

**Not ranked** — low-risk ledger prose cleanup (NEX-004 file-path wording, correct the drift) can be bundled with any next NEX-004 touch.

---

## 7 · Sealed-decision implementation status

From the blueprint §9 sealed-decisions table and doctrine files:

| Decision (sealed date) | Code evidence | Status |
|---|---|---|
| Device-only E2E chat (2026-11-09) | mig 093 + 097 + `nex_peer_message` | PARTIAL — body column still live; purge state unverified |
| Themes+ pricing (2026-11-13) | `chat-themes-library/*` + `nex_theme_ownership` | PARTIAL — first-free apply write unverified |
| Shop trial 7-day + 4 guardrails (2026-11-08) | pricing page + webhook | UNVERIFIED — all four guardrails need test evidence |
| Auth gate pattern `NexAuthGate` (2026-11-21) | `components/nex-native/auth-gate/` + call-centre page | PARTIAL — page-level present; click-time `RequireAccount` unverified |
| Merchant-owned payments 0% fee (2026-11-10) | mig 311 + Stripe Connect routes | PARTIAL — sandbox state unverified |
| Full-viewport rule (2026-11-24) | splash reference only | PARTIAL — not audited elsewhere |
| PWA install Option A (2026-11-24) | drawer row only | NOT STARTED — card / capture / cooldown missing |
| Location permission Option A (2026-11-24) | — | NOT STARTED |
| Emergency Help personal-contacts-only (2026-11-09) | code + mig 224/225 unapplied | BLOCKED — needs sandbox apply |
| Repository ban on D:/trades in nexapp sessions (2026-11-21) | n/a (operational rule) | ENFORCED this session |
| D-1 business-assets migration (2026-11-09) | no mig found | NOT STARTED |
| D-3 message-content removal (2026-11-09) | mig 097 purge + body-column still present | PARTIAL — see NEX-017 |
| D-4 90-day export window | — | PROVISIONAL (legal review pending) |
| D-5 TURN provider | — | COMPARISON AUTHORISED; provider not selected |

---

## 8 · What this audit did NOT do

- **No live database inspection.** Every claim about "applied" vs "unapplied" migrations is drawn from the migration-file headers and ledger annotations, not from `information_schema` in sandbox or production. A follow-on pass against `kdstoyyeygcopkogqsyv` would be needed to confirm actual applied-state.
- **No test execution.** The claim that Playwright tests exist is based on file presence, not on run-state.
- **No deep source-level logic audit.** Each sampled file was read in overview, not line-by-line. Dead-code detection relies on grep and may miss dynamic bindings.
- **No production verification.** Nothing in this audit was checked against production (`ijvqdvsvwtwxzcqmoqit`) — doing so was out of scope and would have required explicit Founder approval.
- **No fix implementation.** By directive. All findings are observations, not change proposals.

---

## 9 · Proposed next steps (for Founder decision)

In order of value:

1. **Author Pass 2 — sandbox DB reconciliation.** Run read-only `information_schema` queries against `kdstoyyeygcopkogqsyv` to confirm which migrations are actually applied. Compare to the "NOT APPLIED" headers. Produces a clean "what's really in the sandbox" baseline.
2. **Decide on the five orphan zones** (NEX-024…028 adoption OR out-of-scope declaration).
3. **Decide on the 13 dead server actions** (retire or wire).
4. **Correct the two ledger drifts** (NEX-015, NEX-022) when a feature session next touches them.
5. **Commission a Founder Engineering dashboard page** — a read-only `/nex-native/hq/founder-mapping/` surface that renders the per-feature six-area grid from this document plus Pass-2 DB evidence. Makes Pass 1/2 outputs queryable instead of document-only.
6. **Address the S1 gaps** in strict rank order (§6 rows 1–4), each as a separate authorised sandbox session.

Nothing in this list is authorised to execute without explicit Founder approval citing the specific gap.

---

## 10 · Reconciliation log entry

- **Audit date:** 2026-11-24
- **Audit mode:** Read-only Pass 1
- **Repository SHA at audit:** uncommitted working tree (nexapp local)
- **Documents read:** `docs/product/feature-ledger.md`, `docs/product/nex-blueprint.md`, `docs/doctrine/**`, `docs/architecture/decisions/**`, `nex-supabase/migrations/**`
- **Documents written:** this file only
- **Code changed:** none
- **Migrations applied:** none
- **Owner approvals used:** audit-authorisation directive 2026-11-24
- **Follow-on authorisation required for:** every item in §9.
