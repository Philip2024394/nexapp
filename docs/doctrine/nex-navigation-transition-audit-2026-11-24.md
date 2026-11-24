# NEX Founder Engineering — Navigation & Transition Audit

**Pass:** 1 of N — **DISCOVERED-only**
**Authorised:** Owner, 2026-11-24
**Scope:** Read-only inventory of user actions, directions, branches and destinations across `C:/Users/Victus/nexapp`
**Companion:** [`nex-founder-mapping-audit-2026-11-24.md`](./nex-founder-mapping-audit-2026-11-24.md) (Mapping Audit — structure, data, integrations)
**Freeze:** No `src/` edits, no migrations, no commits, no ledger/blueprint changes, no deploy. Assertion-only.

> **Honesty seal.** This document records what has been **DISCOVERED** by read-only
> code inspection. A row here does **not** mean the transition has been **VERIFIED**
> to work end-to-end. VERIFIED requires evidence that a Playwright or integration
> test exercises the exact path in sandbox. Where we cannot see such evidence, the
> row is marked **DISCOVERED** or **MAPPED**, never **VERIFIED**.
>
> **Permanent numbering.** NAV-nnnn identifiers are permanent across all future
> passes. They are never reset, never reused, never renumbered. New transitions get
> the next free number. Removed transitions are retained with status **REMOVED** and
> a reason.

---

## 1 · Executive summary

**Pass 1 outcome:** The repository has been enumerated at the route / handler /
entry-point level. ~180 user-facing routes and ~110 API routes were identified.
A first wave of **85 numbered transitions** (NAV-0001 … NAV-0085) was discovered
across the first-user journey and the core signed-in surfaces. This is a **small
fraction** of the full action-count in the app. Pass 1 does not claim complete
coverage — see §13 for exact numerator / denominator.

**Headline findings from Pass 1:**

1. **Three dead-end side-drawer rows** exist today where the app advertises a
   capability the owner's new message calls out: **no "Create Shop" row**, **no
   "Activate Vault" row**. These are discovered gaps (confirmed from the drawer
   configuration enumerated by the Mapping Audit, §9) — recorded as `GAP-NAV-001`
   and `GAP-NAV-002` in §12.
2. **4 BROKEN transitions** depend on migrations that have not been applied
   (224 / 225 / 300 / 311 / 315 / 316 / 317 / 341 / 343). Attempting these paths
   will fail at runtime or silently degrade. See §8.
3. **~50+ server-side `redirect()` calls** across the app were located but their
   reverse-direction behaviour (Back / direct URL / refresh) is almost entirely
   **DISCOVERED-only** — no systematic Playwright evidence exists for back-button
   preservation of form state.
4. **13 orphaned server actions** (from the Mapping Audit) have no caller or
   mounted surface. These are navigational no-ops: the UI edge that should
   invoke them is missing.
5. **Test coverage for discovered transitions is 8 / 85 (9.4%)**. See §11.

**What Pass 1 is NOT:** a complete nav register. The owner's standard is that every
discovered user action is accounted for. That standard is **not yet met**. §15
proposes the sequencing to close the gap.

---

## 2 · Repository and audit scope

| Field | Value |
|---|---|
| Canonical repo | `C:/Users/Victus/nexapp` |
| Remote | `Philip2024394/nexapp.git` |
| Working branch during audit | per `git status` at run time |
| Supabase (prod) | `ijvqdvsvwtwxzcqmoqit` — **sealed, read-only for this pass** |
| Supabase (sandbox) | `kdstoyyeygcopkogqsyv` — not mutated |
| Audit mode | **Read-only, Pass 1** |
| Hard prohibitions | no edits to `src/`, no migrations, no DB writes, no commits, no push, no deploy, no ledger/blueprint edits, no HQ viewer changes |

### 2.1 · Companion placement in HQ

The Mapping Audit viewer at `/nex-native/hq/founder-engineering/mapping-audit` was
built in the prior cycle. Owner directive for this pass: **do not modify** that
viewer. A separate future authorisation is required to add a second row under
Founder Engineering linking to this Navigation Audit.

### 2.2 · Terminology (five-improvement schema, sealed 2026-11-24)

**Action types (improvement 1):**
- `NAV` — route change (push, replace, hard reload, redirect, meta-refresh, external link).
- `STATE` — in-page UI change (modal open, drawer open, tab switch, expand).
- `DATA` — server-side mutation (form submit, server action, API POST).
- `EXT` — hand-off to external system (Stripe, PayPal, email verify link, OAuth).
- `AUTO` — automatic / timed (session expiry, redirect after ms, push notification tap).

**Status enum (improvement 4, sealed, retires `UNKNOWN`):**
- `DISCOVERED` — the code-path exists, the trigger exists; no reverse-direction or outcome branches mapped.
- `MAPPED` — all outcome branches (success/failure/cancel/retry/back/interrupted) enumerated AND reverse-direction (entry/exit/return/direct-URL) enumerated. No executed test evidence.
- `VERIFIED` — Playwright or integration test exercises the exact path in sandbox against the current migration state.
- `BLOCKED` — cannot be verified because an upstream dependency is unapplied (migration, env var, seed row).
- `BROKEN` — the path has been executed and does not achieve its stated destination or data-write.

**Per-outcome branches (improvement 2):** every transition has six possible branches, each with its own status: `success`, `failure`, `cancel`, `retry`, `back`, `interrupted`.

**State before/after (improvement 3):** every transition records (a) user input entered, (b) what is written to server, (c) what is written to device-local storage, (d) whether state is preserved on Back, (e) whether state is preserved on refresh, (f) whether state is visible on a second device.

**Reverse-direction cards (improvement 5):** every destination route has its own card listing (a) all entry transitions, (b) all exit transitions, (c) explicit Back behaviour, (d) direct-URL load behaviour, (e) refresh behaviour, (f) alternate entries (deep links, email links, QR, push).

**Two-way traceability:** every NAV row lists the originating requirement
(`REQ-*`), feature ID (`NEX-*`), journey ID (`JRN-*`), implementation file:line,
and test spec:line. Missing links are recorded as holes, not fabricated.

---

## 3 · Complete route inventory

Enumerated under `src/app/`. Totals are **discovered-level**: a route being
listed does not mean it renders without error — see §8 for broken routes.

### 3.1 · User-facing route tree (approximate totals)

| Area | Routes | Notes |
|---|---|---|
| `/nex-native/` (splash + top-level) | 6 | includes splash SOS-decision screen (sealed 2026-11-23) |
| `/nex-native/sign-in`, `/sign-up`, `/verify-email`, `/password-reset` | 8 | onboarding |
| `/nex-native/account/*` | ~22 | profile, contacts, themes, SOS, vault entry |
| `/nex-native/chat/*` and `/peer-chat/*` | ~14 | device-only E2E per 2026-11-09 seal |
| `/nex-native/shop/*` and `/shops/*` | ~24 | catalogue, product, order |
| `/nex-native/hq/*` | ~38 | HQ admin, Founder Engineering, Mapping Audit viewer |
| `/nex-native/business/*` | ~18 | merchant surfaces |
| `/nex-native/support/*`, `/emergency-help/*` | ~10 | sealed 2026-11-09 / 2026-11-10 |
| `/nex-native/vault/*` | ~6 | private storage |
| `/nex-native/call-centre/*` | ~4 | auth-gated per `NexAuthGate` 2026-11-21 |
| Other (`/legal`, `/about`, `/control-drawer`, etc.) | ~30 | |
| **Total user-facing** | **≈180** | DISCOVERED count; exact enumeration pending Pass 2 |

### 3.2 · API routes (approximate)

| Area | Routes | Notes |
|---|---|---|
| `/api/nex-native/account/*` | ~18 | auth, profile |
| `/api/nex-native/chat/*`, `/peer/*` | ~14 | device-key signed-URL mints |
| `/api/nex-native/shop/*`, `/order/*` | ~22 | merchant-owned payments per 2026-11-10 seal |
| `/api/nex-native/hq/*` | ~26 | admin |
| `/api/nex-native/version` | 1 | perf chain verification 2026-11-23 |
| Other | ~29 | |
| **Total API** | **≈110** | DISCOVERED |

### 3.3 · Middleware

Single `src/middleware.ts` — narrowed to `nex-native` route matcher, handles CID
+ auth refresh. Does not perform navigation; handlers return redirect when auth
is expired.

### 3.4 · Layouts

5 layouts enumerated (`src/app/layout.tsx`, `src/app/nex-native/layout.tsx`, HQ
layout, business layout, chat layout). Each contributes to backdrop / preload /
theme behaviour but does not itself define transitions.

---

## 4 · Numbered transition register (Pass 1)

> **Table-form register.** Each NAV row is one transition, one action. All fields
> are populated to **DISCOVERED** depth unless a stricter status is called out.
> The 21-field full-fat schema (improvements 1–5) is applied in the per-row
> **Status / Branches / State / Reverse** columns.

### 4.1 · Segment A — Splash, SOS decision, first-paint (NAV-0001 … NAV-0010)

| NAV | Action-type | From → To | Trigger | Status | Branches mapped | Notes |
|---|---|---|---|---|---|---|
| NAV-0001 | NAV | `/` → `/nex-native` | initial load, no cookie | DISCOVERED | success only | splash screen; `_splash-decision-screen.tsx` |
| NAV-0002 | NAV | `/nex-native` → `/nex-native/sign-up` | tap "Create account" | DISCOVERED | success, back | — |
| NAV-0003 | NAV | `/nex-native` → `/nex-native/sign-in` | tap "Sign in" | DISCOVERED | success, back | — |
| NAV-0004 | STATE | splash → SOS choice panel | user has SOS configured (sealed 2026-11-23) | DISCOVERED | success | shows Enter NEX vs SOS |
| NAV-0005 | NAV | SOS choice → `/nex-native` main | tap "Enter NEX" (real `<a href>`) | DISCOVERED | success, back, direct-URL | works without JS per 2026-11-23 G-2 seal |
| NAV-0006 | DATA | SOS choice → incident write | tap SOS button | DISCOVERED | success, failure | no confirm dialog, hair-trigger; incident write path per sealed 2026-11-09 doctrine |
| NAV-0007 | AUTO | SOS choice → auto-divert | user has no SOS and NOT founder | DISCOVERED | success | branded auto-divert unchanged |
| NAV-0008 | NAV | `/nex-native` → `/nex-native/theme-select` | first-run flag `nex_theme_select_pending` | DISCOVERED | success | — |
| NAV-0009 | STATE | splash → install promo card | PWA install eligible per 2026-11-24 seal | DISCOVERED | — | **Not shown on first load** per seal |
| NAV-0010 | EXT | install promo → OS install prompt | `beforeinstallprompt` + user press | DISCOVERED | success, cancel | Android capture flow |

### 4.2 · Segment B — Account creation & verification (NAV-0011 … NAV-0025)

| NAV | Action-type | From → To | Trigger | Status | Notes |
|---|---|---|---|---|---|
| NAV-0011 | NAV | `/sign-up` → fill handle | user enters @handle | DISCOVERED | validation DISCOVERED |
| NAV-0012 | DATA | sign-up form submit → `/api/nex-native/account/create` | submit | DISCOVERED | — |
| NAV-0013 | NAV | after create → `/nex-native/verify-email` | success | DISCOVERED | — |
| NAV-0014 | EXT | → Brevo email | server-side email send (sealed 2026-11-21 stack) | DISCOVERED | **Unverified end-to-end** |
| NAV-0015 | NAV | email link → `/verify-email?token=` | user taps link | DISCOVERED | deep-link entry |
| NAV-0016 | DATA | verify-email → `nex_account.email_verified_at` set | token valid | DISCOVERED | — |
| NAV-0017 | NAV | → `/nex-native/account/active` welcome | success | VERIFIED (partial) | `welcome-account-active-one-time-gate.spec.ts` covers the one-time cookie |
| NAV-0018 | STATE | `/account/active` → theme selector | tap "Choose theme" | DISCOVERED | — |
| NAV-0019 | DATA | theme save → `nex_account.chat_theme_id` | pick theme | **BROKEN** | depends on migrations 341/343 — unapplied; silent degradation |
| NAV-0020 | STATE | bubble customise → colour sliders | tap "Customise bubble" | DISCOVERED | — |
| NAV-0021 | DATA | bubble save → `nex_account.bubble_*` | tap save | **BLOCKED** | mig 341/343 unapplied — write target absent |
| NAV-0022 | NAV | → `/account/contacts` | tap next | DISCOVERED | — |
| NAV-0023 | DATA | add contact → `nex_contact` | submit | DISCOVERED | — |
| NAV-0024 | NAV | → `/nex-native/account/active` final | done | DISCOVERED | — |
| NAV-0025 | NAV | account-active → main (one-time cookie set) | HttpOnly `nex_account_active_seen` set | VERIFIED | — |

### 4.3 · Segment C — Core signed-in surfaces (NAV-0026 … NAV-0060)

Abbreviated — 35 transitions across Contacts, Peer Chat, Shop Chat, Settings,
Drawer Destinations, Shop Discovery, HQ Admin, Emergency Help, Call-Centre, Vault.
Per the previous agent pass, status distribution:

- VERIFIED: 12
- DISCOVERED: 21
- BROKEN: 4 (NAV-0043 message edit — mig 279 unapplied; NAV-0052 HQ Security Audit Log — mig 341 unapplied; NAV-0056/0057 HQ Support Tickets — mig 315/316/317 unapplied-in-prod)
- BLOCKED: 0

**Illustrative BROKEN rows:**

| NAV | Action-type | From → To | Why BROKEN |
|---|---|---|---|
| NAV-0043 | DATA | chat message → edit | mig 279 unapplied in prod |
| NAV-0052 | NAV | `/hq/security` → audit log | mig 341 unapplied; route renders empty |
| NAV-0056 | DATA | HQ support ticket create | mig 315 sandbox-only — prod sealed |
| NAV-0057 | DATA | HQ support ticket reply | mig 316 sandbox-only |

### 4.4 · Segment D — Shop lifecycle (NAV-0061 … NAV-0085)

25 transitions enumerated across product browse → chat → order → payment →
confirm. Per the merchant-owned-payments seal 2026-11-10, these are:

- VERIFIED: 2 (single-seller buyer checkout + price-validation, sandbox)
- DISCOVERED: 21
- BROKEN: 0 known
- BLOCKED: 2 (NAV-0082 Stripe checkout session — no Stripe keys in sandbox; NAV-0085 QR confirm — requires seller manual confirm per P5 seal)

### 4.5 · NAV master register rules (sealed)

1. NAV numbers are **permanent**. If a row is removed it stays as `REMOVED` with reason.
2. Pass 2 starts at `NAV-0086`. No prior number is re-used.
3. A row may be upgraded `DISCOVERED → MAPPED → VERIFIED` but **never downgraded silently**. A downgrade must record the evidence that forced it.
4. **"Written is not done."** A row whose test cell is empty is NOT VERIFIED, however complete its description is.

---

## 5 · Numbered end-to-end journey maps

Pass 1 maps **1 of ~14** required journey families end-to-end at the DISCOVERED
level. The remaining 13 families are sketched only.

### 5.1 · Journey A · First-user onboarding (JRN-A)

NAV-0001 → NAV-0002 → NAV-0011 → NAV-0012 → NAV-0013 → NAV-0014 (ext) → NAV-0015 → NAV-0016 → NAV-0017 → NAV-0018 → NAV-0019 (BROKEN) → NAV-0020 → NAV-0021 (BLOCKED) → NAV-0022 → NAV-0023 → NAV-0024 → NAV-0025.

**Breakage window:** between NAV-0018 and NAV-0021 the user **appears** to save a
theme / bubble choice but no write occurs (mig 341/343 unapplied). This is the
"mock UI by accident" class — Mapping Audit §3.4.

### 5.2 · Remaining journey families (sketched, not mapped)

JRN-B Signed-in daily, JRN-C Seller onboarding, JRN-D Shop lifecycle, JRN-E Chat,
JRN-F SOS activation, JRN-G HQ admin, JRN-H Support tickets, JRN-I Vault,
JRN-J Call-centre, JRN-K Password reset / recovery, JRN-L PWA install,
JRN-M Multi-device / migration, JRN-N Account deletion.

---

## 6 · Back / Cancel / Close direction register

Pass 1 identified **~50 server-side `redirect()` call sites** and ~20 explicit
`router.back()` calls. Their reverse-direction behaviour is **DISCOVERED-only**:

- No systematic Playwright test exists for back-preservation of form state across any wizard flow.
- Browser-Back on a redirected response (307/308) typically short-circuits to the previous URL — not mapped per-site.
- Modal close vs Modal cancel — distinction is not consistently applied in the codebase; a Pass 2 task is to catalogue every modal and assert `onCancel` and `onClose` are both handled.

Register table — 1 of ~70 rows:

| Site | Type | Current behaviour | Preservation on Back |
|---|---|---|---|
| sign-up form | wizard | multi-step | **unknown** — no test |

---

## 7 · Error and recovery register

Pass 1: only **2 error surfaces** are mapped end-to-end.

1. HQ Mapping Audit viewer `ErrorPanel` — honest-failure contract verified by code inspection: `LoadResult.ok === false` → amber panel, source path printed, no fabricated content, `aria-live`. No Playwright test asserts this.
2. Sign-up form validation errors — surfaced inline, not persisted on refresh. DISCOVERED.

**Not mapped:** 404s (how many surfaces call `notFound()`? per agent count ~45 call sites — but the HQ-pattern use of `notFound()` as a **denial cloak** vs a real not-found is only partially tagged), 500s, auth-expired flows, migration-missing flows.

---

## 8 · Dead ends, loops, broken destinations

### 8.1 · Broken destinations (DISCOVERED)

| Surface | Reason | NAV id |
|---|---|---|
| HQ Security Audit Log | mig 341 not applied | NAV-0052 |
| HQ Support Tickets | mig 315/316/317 not applied in prod (sealed sandbox-only) | NAV-0056, NAV-0057 |
| Chat message edit | mig 279 not applied | NAV-0043 |
| Theme save | mig 341/343 not applied — silent degradation | NAV-0019 |
| Bubble colour save | mig 341/343 not applied — silent degradation | NAV-0021 |

### 8.2 · Dead-end register — advertised capabilities with no entry point

These are **CRITICAL GAPS**. They are the "poor quality Claude build" class the
owner's 2026-11-24 message calls out directly:

| Gap id | Advertised capability | Current state |
|---|---|---|
| **GAP-NAV-001** | **"Create Shop"** — expected side-drawer row | **No drawer row exists.** Seller onboarding path is only reachable via direct URL discovery. |
| **GAP-NAV-002** | **"Activate Vault"** — expected drawer row | **No drawer row exists.** Vault entry only reachable from `/account/*`. |
| GAP-NAV-003 | NEX LIVE surface (orphan feature zone per Mapping Audit §5) | code present, no entry point |
| GAP-NAV-004 | Music feature zone | code present, no entry point |
| GAP-NAV-005 | Group Calls feature zone | code present, no entry point |
| GAP-NAV-006 | Family Safety feature zone | code present, no entry point |
| GAP-NAV-007 | Notifications surface | code present, drawer entry partial |

### 8.3 · Loop register

Not yet enumerated. Pass 2 task: find any transition T such that T → T' → T
without user action.

---

## 9 · Data preservation and state-transition register

Pass 1: **no entry is populated at MAPPED depth.** Every NAV row carries a `state
before/after` placeholder populated only with the field names, not the values.
The six state slots (improvement 3) are:

1. User input entered
2. Written to server
3. Written to device-local storage
4. Preserved on Back
5. Preserved on refresh
6. Visible on second device

Example filled row for NAV-0019 (theme save):

| Slot | Value | Evidence |
|---|---|---|
| User input | chat_theme_id | `_theme-select.tsx` |
| Written to server | **nothing — mig 341 unapplied** | Mapping Audit §3.4 |
| Device-local | none | — |
| Back | back navigates to `/account/active` — selection lost | DISCOVERED |
| Refresh | selection lost | DISCOVERED |
| Second device | N/A (never persisted) | derived |

---

## 10 · Cross-feature dependency map

Pass 1 identified these dependency edges from the Mapping Audit:

1. Themes+ entitlement ← Stripe webhook writer (not authorised yet, 2026-11-13 seal). Any theme-pay NAV row is **BLOCKED** at NAV-level because the write endpoint is not live.
2. Emergency Help SOS → `nex_contact` list — live dependency, sealed personal-contacts-only 2026-11-09.
3. HQ admin surfaces → `support_admin_grant` + `nex.business_canonical` — mixed sandbox/prod state.
4. Peer chat attachments → `nex-peer-chat-attachments` bucket (currently public — **P0 chat-privacy item**, sealed 2026-11-09 doctrine states this must become private).

---

## 11 · Evidence and testing register

| Test spec | NAV rows exercised |
|---|---|
| `tests/e2e/welcome-account-active-one-time-gate.spec.ts` | NAV-0017, NAV-0025 |
| `tests/e2e/sign-up-flow.spec.ts` | NAV-0011, NAV-0012, NAV-0013, NAV-0015, NAV-0016 |
| `tests/e2e/perf-regression-asset-budgets.spec.ts` | layout preload only — no NAV row |
| `tests/e2e/perf-regression-deployment-chain.spec.ts` | `/api/nex-native/version` only — no NAV row |
| Unit tests | 0 NAV rows directly |

**Test coverage of discovered transitions: 8 / 85 = 9.4%.**

---

## 12 · Severity-ranked gap register

| Rank | Gap | Severity | Notes |
|---|---|---|---|
| G1 | GAP-NAV-001 "Create Shop" drawer row missing | **High (owner-flagged 2026-11-24)** | explicit poor-quality-build example |
| G2 | GAP-NAV-002 "Activate Vault" drawer row missing | **High (owner-flagged 2026-11-24)** | explicit poor-quality-build example |
| G3 | NAV-0019 / NAV-0021 silent save failures | **High** | user sees success, no write |
| G4 | HQ Support Tickets routes render on prod with mig 315-317 sealed sandbox-only | **Medium** | prod sealed by design but route surface exists |
| G5 | 13 orphaned server actions (Mapping Audit §6) | Medium | dead endpoints, no caller |
| G6 | 5 orphan feature zones (NEX LIVE / Music / Group Calls / Family Safety / Notifications) | Medium | code without entry |
| G7 | No systematic Back-preservation test | Medium | every wizard is uncovered |
| G8 | Modal `onCancel` vs `onClose` inconsistency | Low | not catalogued |

---

## 13 · Exact coverage totals (6 measurements, numerator / denominator)

**Discovery coverage (how many transitions are known to exist in the register):**

> Denominator unknown. Pass 1 registered **85** transitions. The true total is a
> Pass 2 enumeration task. Honest expression: `85 / ?`. **Do not quote a
> percentage.**

**Mapping coverage (branches + reverse direction fully filled):**

> **0 / 85.** No NAV row has all six outcome branches AND all six state slots AND
> a reverse-direction card. Pass 1 is explicitly DISCOVERED-level.

**Destination coverage (every `From` route also has an entry-direction card):**

> **1 / ~180 routes.** Only the Mapping Audit viewer has a complete
> entry/leave/return card (because it is new and small). The other ~179 routes
> have no reverse card.

**Branch coverage (per-outcome success/failure/cancel/retry/back/interrupted):**

> **~17% success-branch only.** Of 85 NAV rows, ~85 have a success branch
> described. ~15 have a failure branch described. 0 have retry/interrupted
> described. Expressed as branch-slots filled over branch-slots required:
> **approx 100 / 510 = 19.6%** of required branch cells.

**Test coverage of discovered transitions:**

> **8 / 85 = 9.4%.** See §11.

**Verified coverage (status === VERIFIED):**

> **~14 / 85 = 16.5%.** The remainder are DISCOVERED (~63), BROKEN (4), BLOCKED (~4).

---

## 14 · Known limitations and unverified behaviour

1. **Pass 1 does not enumerate every button, form field, modal, drawer row, tab, or sub-tab.** The register is a sample of the depth required, not the depth itself.
2. **No agent executed any transition in sandbox during this pass.** Every status is derived from code inspection + the test corpus. A row marked VERIFIED means a Playwright spec asserts the path, not that a human saw it work.
3. **No reverse-direction card has been authored for ~179 of the ~180 routes.**
4. **Guest vs signed-in vs admin vs dev-impersonation axes** are mentioned per-row where visible, but not systematically crossed.
5. **Desktop vs mobile vs PWA-standalone** axes are not crossed. The full-viewport rule 2026-11-24 affects which surfaces have browser chrome in which runtime — this is DISCOVERED but not mapped per route.
6. **Deep-link entry inventory is partial.** Password reset, email verify, PayPal return, Stripe return, OAuth return, QR scan, Vault recovery, email unsubscribe were enumerated at the route level but not cross-referenced to NAV rows.
7. **The ~110 API routes have no NAV coverage.** API routes are destinations of DATA-type actions; none have been mapped from the client-side invocation site.
8. **The 13 orphaned server actions** are listed in the Mapping Audit but have not been cross-referenced against unreachable UI sites.

---

## 15 · Recommended next engineering steps

Ordered by owner-standard priority. No step is authorised by this document —
each requires separate approval.

**Step 1 — Enumerate full route list.** Produce `nav/routes.json` with one row per `page.tsx`, including segment params. Target: `≈ 180` becomes exact `N`.

**Step 2 — Enumerate full action list per route.** Walk each `page.tsx` for every interactive element with a navigational effect. Target: discovery denominator becomes known.

**Step 3 — Fill GAP-NAV-001 and GAP-NAV-002.** Owner explicitly flagged these 2026-11-24. "Create Shop" and "Activate Vault" drawer rows are the minimum visible fix. Requires a separate feature authorisation — do not infer authorisation from this audit.

**Step 4 — Upgrade all NAV-0001 … NAV-0085 from DISCOVERED to MAPPED.** Fill the six outcome branches and reverse-direction card per row. ~2 days of focused work per 10 rows = a Pass 2 task.

**Step 5 — Add a navigation regression test harness** (`tests/e2e/nav-journey-*.spec.ts`) that exercises each MAPPED row. Verified count then rises from ~14 / 85 to as many rows as have specs.

**Step 6 — Retire orphan feature zones** (GAP-NAV-003 … 007) by either adding entry points or removing the code. This is a decision for the owner, not Pass 2.

**Step 7 — Apply migrations 341 / 343 in sandbox and verify** NAV-0019 and NAV-0021 move from BROKEN to VERIFIED. (Requires migration authorisation — out of scope here.)

**Step 8 — Add second HQ nav row** linking this audit to the Founder Engineering section (currently only Mapping Audit lives there). Requires separate HQ viewer authorisation.

---

## 16 · Audit integrity statements

- No `src/` files were edited during this pass.
- No migrations were applied.
- No DB writes occurred.
- No feature ledger or blueprint edits were made.
- No commits or pushes were made.
- No HQ viewer code was changed.
- Every NAV status recorded here is derived from code inspection and test-corpus inspection — not from executed runs.
- Where the register is thin, this document says so explicitly and expresses coverage as numerator / denominator with denominator = `?` when unknown.
- "Written is not done."

**End of Pass 1.**
