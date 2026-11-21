# Vitest · blocked-dependency inventory · 2026-11-21

> **Status**: Evidence for owner adjudication. No test or component edited by
> this document. The one mechanical fix shipped under #58 (commit `fc37e1b8`,
> `EmergencyConfirmationScreen.test.tsx` · `vi.mock("next/navigation")`
> extended with `usePathname` + `useSearchParams`) is the ONLY vitest change
> in this pass. Everything below needs an owner call before any further
> edits.
>
> **Source**: full `npx vitest run --reporter=json` against HEAD
> `fc37e1b8` on branch `release-audit-v1-2026-11-14`, run 2026-11-21.
> Raw output archived at (gitignored) `AppData/Local/Temp/vitest-inventory/run.json`.
>
> **Scope**: this is an **inventory**, not a remediation plan. Per owner
> directive 2026-11-21 (path b · Conservative + inventory), no component is
> treated as canonical, no test is rewritten to match current component
> output, no missing-module shim is authored.

---

## 1 · Numbers

| Metric | Count |
|---|---|
| Failing test files | **166** |
| Failing test cases | **444** |
| Passing test cases (same run) | 22,599 |

### 1.1 · Reachability split (per #61 classification)

| Class | Files | Cases | Notes |
|---|---:|---:|---|
| **LIVE** (reachable from app surface) | 136 | 394 | Must be adjudicated |
| **DEAD** (nex-agent-runtime, nex-agent subtree) | 30 | 50 | Deferrable · see §4 |
| **TEST-DEV** (scripts, audit fixtures) | 0 | 0 | None in failing set |

---

## 2 · Failure clusters · by root-cause signature

Signatures are derived by regex over the first failure message per test. A
single file can contribute to multiple signatures. Counts are **test cases**,
not files; `files` is distinct files touching that signature.

| Rank | Signature | Cases | Files | Reach mix | Cause class |
|---:|---|---:|---:|---|---|
| 1 | `assertion-drift` | 151 | 42 | mostly LIVE | **Drift** · owner must declare canonical source |
| 2 | `missing-module: @/lib/nex/indonesia/knowledge` | 29 | 29 | LIVE | **Fork residue** · module left behind by nexapp carve-out |
| 3 | `missing-module: @/lib/nex-food/db` | 26 | 2 | LIVE | **Fork residue** |
| 4 | `timeout` | 35 | 12 | LIVE | Opaque · needs per-file inspection |
| 5 | `runtime-stack-trace-error` | 34 | 3 | mostly DEAD | Opaque · 2 DEAD, 1 LIVE |
| 6 | `null-deref` | 13 | 3 | LIVE | Fixture / setup drift |
| 7 | `missing-module: @/lib/nex-accommodation/db` | 13 | 1 | LIVE | **Fork residue** |
| 8 | `missing-file: docs/nex-work-map.json` | 10 | 1 | LIVE | **Missing artifact** |
| 9 | `missing-module: @/lib/nex-runtime-queue/queue` | 8 | 8 | LIVE | **Fork residue** |
| 10 | `missing-file: src/app/nex-native/themes/theme-1/page.tsx` | 6 | 1 | LIVE | **Missing artifact · theme deletion?** |
| 11 | `missing-module: @/lib/nex-intelligence/provenance` | 6 | 6 | LIVE | **Fork residue** |
| 12 | `missing-file: src/app/nex-native/chat-themes-library/category/[categoryId]/page.tsx` | 5 | 1 | LIVE | **Missing artifact** |
| 13 | `missing-module: @/lib/crm/loadContactTimeline` | 5 | 5 | LIVE | **Fork residue** |
| 14 | `sandbox-guard-firing-on-prod-ref` | 5 | 5 | LIVE | **Safety guard working as designed** |
| 15 | `missing-module: @/lib/staircase-knowledge` | 4 | 4 | LIVE | **Scope-reduction residue** (Starter Pack removed 2026-11-06) |

Smaller tail (≤3 cases each): `missing-module: @/lib/nexapp/tokens` (3·2),
`missing-module: @/lib/nex/agents/nex-vision/corpus` (3·1),
`missing-module: @/lib/products/read` (3·3), plus the long tail of
`missing-file` entries listed in §6.

---

## 3 · Proposed resolution · by cluster

Each resolution below is **a proposal for owner review**, not an executed
change. Where a resolution conflicts with a sealed doctrine, the sealed
doctrine wins and the open decision is called out.

### 3.1 · `assertion-drift` (151 cases · 42 files)

**What it means**: test asserts a string / DOM structure / HTML attribute
that the current component no longer renders. Example from the shipped
EmergencyConfirmationScreen fix: component now renders `"Alert Canceled"`,
test still expects `"Alert revoked"`.

**Why I will not silently fix**: declaring the component canonical would
ratify the drift. The owner may want the test's copy restored, not the
component's. Several files touch user-visible copy (e.g. settings landing,
directory no-fabrication, first-contact panel) which has sealed wording
doctrines.

**Proposed owner decision structure** (one of):
- (a) **Component is canonical** — update each test to match current render
      output. Each cluster lands in its own commit.
- (b) **Test is canonical** — revert the component copy / structure. Risk:
      may undo an intentional owner-sealed copy change.
- (c) **Per-file adjudication** — use this document's §5 appendix as the
      ballot and mark each file (a) or (b) individually.

**42 files pending adjudication** are listed in §5.1.

### 3.2 · `sandbox-guard-firing-on-prod-ref` (5 cases · 5 files)

**What it means**: these 5 test files import a code path that calls the
sandbox ref-check (`refuses: not ijvqdvsvwtwxzcqmoqit`). The check fires
because the underlying import resolves the prod Supabase ref `ijvqdvsvwtwxzcqmoqit`
at module-load time, while the sandbox migration doctrine demands
`kdstoyyeygcopkogqsyv` is the only legitimate target in dev.

**This is the safety guard working as designed.** It is the same guard
installed under the 2026-11-10 support-tickets prod-sealing event. These
tests failed before the guard existed (undetectably). The honest reading
is: **the tests need to be rewritten to run against sandbox**, OR the
test fixtures need to inject `NEX_SUPABASE_URL` for sandbox before import.

**Affected files** (`src/lib/nex-native/first-conversation/__tests__/`):
- `end-to-end-a2.test.ts`
- `first-message-http.test.ts`
- `section-13-a1-single-identity.test.ts`
- `welcome-delivery.test.ts`
- `welcome-outbox-worker.test.ts`

**Proposed resolution**: author a shared `beforeAll` fixture in that
directory that sets `process.env.NEX_SUPABASE_URL` to the sandbox
`kdstoyyeygcopkogqsyv.supabase.co` URL before module import, AND adds an
explicit comment that no production ref may ever appear in the first-
conversation test tree. BLOCKED pending owner confirmation that sandbox-ref
tests are acceptable in this subtree (vs leaving them as prod-rejection
evidence).

### 3.3 · Fork-residue missing modules (~97 cases across ~59 files)

| Missing module | Cases | Files | Likely origin |
|---|---:|---:|---|
| `@/lib/nex/indonesia/knowledge` | 29 | 29 | ID directory knowledge pack · left in `D:/trades` |
| `@/lib/nex-food/db` | 26 | 2 | nex-food vertical · not in nexapp carve-out |
| `@/lib/nex-accommodation/db` | 13 | 1 | nex-accommodation vertical · not in carve-out |
| `@/lib/nex-runtime-queue/queue` | 8 | 8 | runtime-queue infra · appears to be a lift target |
| `@/lib/nex-intelligence/provenance` | 6 | 6 | intelligence layer · partial carve-out |
| `@/lib/crm/loadContactTimeline` | 5 | 5 | CRM module (not in Scope Reduction) |
| `@/lib/staircase-knowledge` | 4 | 4 | **Retired** · Scope Reduction 2026-11-06 removed Starter Pack |
| `@/lib/nexapp/tokens` | 3 | 2 | design-tokens module |
| `@/lib/products/read` | 3 | 3 | products read helper |
| `@/lib/nex/agents/nex-vision/corpus` | 3 | 1 | nex-vision corpus · partial carve-out |

**Pattern**: test files for features whose dependencies were NOT brought
across in the 2026-10-10 nexapp carve-out from `D:/trades`.

**Proposed resolution options** (owner picks per cluster):
- **Shim** — write a minimal pin-the-contract module (like the 2026-11-21
      `src/lib/nex-voice.ts` recovery). Appropriate when the type surface is
      small, the runtime usage is narrow, and the full module is not needed.
- **Port** — copy the full module from `D:/trades` under a fresh licence-
      review step. Appropriate when the runtime behaviour is reachable.
      Requires owner authorisation per the sealed D:/trades BANNED rule for
      nexapp sessions — the port is NOT a live cross-repo read, it is a
      curated one-time lift.
- **Delete tests** — if the feature is not part of nexapp's shipped
      surface, retire the test files. Appropriate for `staircase-knowledge`
      (already scope-reduced out per 2026-11-06).

**Example per-cluster** (for owner consideration):
- `staircase-knowledge` → **delete 4 test files** (scope-reduction decision
      already removed the feature; the tests are stranded).
- `@/lib/nex/indonesia/knowledge` → open question · is Indonesian directory
      knowledge still in scope? If yes, port. If no, delete 29 test files.
- `@/lib/nex-food/db`, `@/lib/nex-accommodation/db` → open question · are
      these verticals in nexapp or were they left behind intentionally?

### 3.4 · `missing-file` cluster (~56 cases · ~33 distinct files)

Tests that read source files via `fs.readFileSync(...)` to assert on their
contents. The source files no longer exist, so the test suite aborts at
setup. Falls into two sub-clusters:

**3.4.1 · Theme routes removed** (~15 cases across 6 files)
  - `src/app/nex-native/themes/theme-1/page.tsx` (6 cases)
  - `src/app/nex-native/themes/pink-dream/page.tsx` (3 cases)
  - `src/app/nex-native/themes/cyber-grid/page.tsx` (3 cases)
  - `src/app/nex-native/chat/prototypes/hauntedhoteltheme/page.tsx` (3 cases)
  - `src/app/nex-native/chat/prototypes/haunted-hotel-bubbles/page.tsx` (2 cases)
  - `src/app/nex-native/chat/prototypes/haunted-hotel-effects/page.tsx` (1)

  **Likely cause**: the themes library consolidation that collapsed per-theme
  pages into the shared `[themeId]/*` route structure. The tests that
  asserted against the individual `theme-1/page.tsx` etc. source files were
  not updated.

  **Proposed resolution**: retire these tests (they encode a structure that
  no longer exists). Pair with a new test against the current `[themeId]`
  route structure, if theme-level invariants are worth re-asserting. BLOCKED
  pending owner call on whether to re-author the equivalent assertions.

**3.4.2 · Routes not yet built / scope-reduced** (~41 cases across ~27 files)
  Mixed bag — settings pages, business-slug product pages, HQ pages,
  live-commerce pages, docs/*.json manifests. Each needs a case-by-case
  call: is the test premature (route not built yet) or is the route gone
  (scope reduction)?

  **Proposed resolution**: appendix §6 lists every file with its test file;
  owner can tick "retire test" / "build route" / "keep deferred".

### 3.5 · `timeout` (35 cases · 12 files)

Vitest's default 5s timeout. Causes vary:
- Integration tests against sandbox DB (likely `connect ECONNREFUSED` if
      sandbox is unreachable from this host · `NEX_SUPABASE_URL` not set).
- Long-running async setup (e.g. `category-metadata.test.ts`).
- Mismatched promise chains.

**Proposed resolution**: these need per-file inspection; cannot be
clustered by pattern without more evidence. Not actioned in this pass.

### 3.6 · `runtime-stack-trace-error` (34 cases · 3 files)

Two of the three files are DEAD (nex-agent-runtime subtree). The remaining
LIVE file is `src/lib/nex-native/directory/__tests__/category-metadata.test.ts`
which also appears in the `timeout` cluster — likely the same underlying
cause (unresolvable async / DB connection failure under setup).

**Proposed resolution**: skip the 2 DEAD; inspect the one LIVE file
alongside §3.5 cluster.

### 3.7 · `null-deref` (13 cases · 3 files)

Small cluster. Needs per-file inspection. Not actioned.

---

## 4 · DEAD subtree · deferrable

30 failing files fall under `src/lib/nex-agent-runtime/*` or
`src/lib/nex-agent/*`. These paths are not reachable from the current
nexapp shipped surface per the #61 reachability classification. Per the
same reasoning used in #57 (bounded TS fixes), DEAD-subtree test failures
are **deferrable**: fixing them has no effect on live product safety.

The honest treatment is to **mark the DEAD subtree as `.skip` at the
suite level** (not delete), so (a) the failures stop drowning signal, and
(b) the tests can be revived if the subtree is ever re-promoted to LIVE.
This requires a separate owner call before any `.skip` annotation lands
in the tree.

Full DEAD file list (30):

<details><summary>Expand</summary>

- `src/lib/nex-agent-runtime/__tests__/all-brains.test.ts`
- `src/lib/nex-agent-runtime/__tests__/crawler-reference-agent.test.ts`
- `src/lib/nex-agent-runtime/__tests__/foundation-extensions.test.ts`
- `src/lib/nex-agent-runtime/__tests__/growth-snapshot.test.ts`
- `src/lib/nex-agent-runtime/__tests__/mission-dispatcher.test.ts`
- `src/lib/nex-agent-runtime/__tests__/real-repo-retry-a-plus-b-2026-09-15.test.ts`
- `src/lib/nex-agent-runtime/__tests__/restart-and-failure-honesty.test.ts`
- `src/lib/nex-agent-runtime/__tests__/supervisor.test.ts`
- `src/lib/nex-agent-runtime/__tests__/wo-agent-runtime-01.test.ts`
- `src/lib/nex-agent-runtime/c1-nex-facial-state-model/__tests__/contamination.test.ts`
- `src/lib/nex-agent-runtime/founder-authority/__tests__/runtime-08.test.ts`
- `src/lib/nex-agent-runtime/internet-doorway/__tests__/runtime-09.test.ts`
- `src/lib/nex-agent-runtime/nex1/__tests__/nex1-tick-integration.test.ts`
- `src/lib/nex-agent-runtime/nex1/__tests__/nex1.test.ts`
- `src/lib/nex-agent-runtime/nex2/__tests__/nex2.test.ts`
- `src/lib/nex-agent-runtime/nex3/__tests__/nex3.test.ts`
- `src/lib/nex-agent-runtime/orchestrator/__tests__/orchestrator.test.ts`
- `src/lib/nex-agent-runtime/process/__tests__/daemon-real-process.test.ts`
- `src/lib/nex-agent-runtime/programming-mission/__tests__/runtime-11.test.ts`
- `src/lib/nex-agent-runtime/programming-mission/__tests__/runtime-12-attacks.test.ts`
- `src/lib/nex-agent-runtime/security/__tests__/security.test.ts`
- `src/lib/nex-agent-runtime/self-diagnostics/__tests__/evidence-collector.test.ts`
- `src/lib/nex-agent-runtime/workstation-integration/__tests__/runtime-10.test.ts`
- `src/lib/nex-agent/code-engine/capability-chat-turn-integration.test.ts`
- `src/lib/nex-agent/code-engine/capability-declaration-bridge.test.ts`
- `src/lib/nex-agent/code-engine/capability-repository-discovery-s1-repair.test.ts`
- `src/lib/nex-agent/code-engine/capability-target-discovery.test.ts`
- `src/lib/nex-agent/learning-ledger.test.ts`
- `src/lib/nex-agent/prompt-classifier.test.ts`
- `src/lib/nex-agent/seo-agent.test.ts`

</details>

---

## 5 · Per-file inventory · live-reachable drift

### 5.1 · Assertion-drift files (42) · live-reachable

| File | Proposed owner check |
|---|---|
| `src/app/api/nex-native/unread-count/__tests__/route.test.ts` | Route semantics (actual vs expected status/shape) |
| `src/app/nex-native/call/preview/__tests__/preview-honesty.test.ts` | Preview copy drift |
| `src/app/nex-native/chat-standard/_surfaces/__tests__/_shop-slider-owner-add.test.tsx` | Shop-slider owner-add structure |
| `src/app/nex-native/chat-themes-library/_category-grid.test.ts` | Category grid rendering drift |
| `src/app/nex-native/chat-themes-library/_mini-phone-controls-ambient.test.ts` | Mini phone controls ambient |
| `src/app/nex-native/chat/__tests__/shop-chooser-catalog.test.ts` | Shop chooser catalog |
| `src/app/nex-native/chat/peer/[accountId]/__tests__/peer-call-quality.test.ts` | Peer call quality assertions |
| `src/app/nex-native/chat/peer/[accountId]/__tests__/stage-a-document-contract.test.ts` | Stage-A document contract |
| `src/app/nex-native/contacts/__tests__/header-mounted.test.ts` | Header mount assertions |
| `src/app/nex-native/directory/[id]/__tests__/detail-page-no-fabrication.test.ts` | **Honesty invariants** · no-fabrication rule |
| `src/app/nex-native/directory/__tests__/page-no-fabrication.test.ts` | **Honesty invariants** · no-fabrication rule |
| `src/app/nex-native/home/__tests__/first-contact-panel.test.ts` | First contact panel copy |
| `src/app/nex-native/home/__tests__/first-visit-invitation.test.ts` | First visit invitation copy |
| `src/app/nex-native/profile/[handle]/__tests__/submit-report-fail-open-policy.test.ts` | **Fail-open policy** · safety-critical |
| `src/app/nex-native/settings/__tests__/_enforcement-anchors.test.ts` | Enforcement anchor contract |
| `src/app/nex-native/settings/_landing-i18n.test.ts` | i18n landing text |
| `src/app/nex-native/settings/_landing-renders-ia.test.ts` | Settings landing IA |
| `src/app/nex-native/settings/_settings-ia.test.ts` | Settings IA |
| `src/app/nex-native/themes/[id]/motion/_motion-client.test.ts` | Motion client assertions |
| `src/components/nex-native/directory/CountryPicker.test.tsx` | SVG-vs-img flag badge |
| `src/components/nex-native/directory/OsmAttributionBadge.test.tsx` | OSM attribution text |
| `src/components/nex-native/directory/__tests__/listing-card.test.tsx` | Listing card structure |
| `src/components/nex-native/emergency/__tests__/EmergencyConfirmationScreen.test.tsx` | 5 remaining failures · "Activate System" / "Alert Canceled" copy |
| `src/lib/nex-native/__tests__/chat-view-preferences-service.test.ts` | Chat view preferences service |
| `src/lib/nex-native/__tests__/vault-contacts.test.ts` | Vault contacts |
| `src/lib/nex-native/directory/__tests__/area-intelligence-types.test.ts` | Area intelligence type contract |
| `src/lib/nex-native/directory/__tests__/category-metadata.test.ts` | Category metadata · also in timeout cluster |
| `src/lib/nex-native/directory/__tests__/directory-service.test.ts` | Directory service |
| `src/lib/nex-native/emergency/_email-adapter-for-emergency.test.ts` | Emergency email adapter |
| `src/lib/nex-native/intelligence/__tests__/product-knowledge.test.ts` | Product knowledge |
| `src/lib/nex-native/live-broadcast/__tests__/sealed-defaults-invariants.test.ts` | **Sealed-defaults invariants** · doctrine-anchored |
| `src/lib/nex/behaviour.test.ts` | Behaviour baseline · also in timeout cluster |
| `src/lib/nex/brain/live-discovery-handler.test.ts` | Live discovery handler |
| `src/lib/nex/capability-runtime/execution-level.test.ts` | Execution level contract |
| `src/lib/nex/knowledge-layer/retrieve.test.ts` | Knowledge layer retrieve |
| `src/lib/nex/marketing/selectBanner.test.ts` | Banner selection logic |
| `src/lib/nex/universal-intent/classify.test.ts` | Intent classifier |

Two files surface additional risk flags for owner attention:
- `**detail-page-no-fabrication.test.ts**` and `**page-no-fabrication.test.ts**`
      encode the **directory no-fabrication honesty rule**. If the component
      is canonical, verify that the drift does not weaken the honesty
      invariant (e.g. inferred data now present where previously forbidden).
- `**submit-report-fail-open-policy.test.ts**` encodes safety-critical
      report submission policy. Drift here needs a security read before
      declaring the component canonical.
- `**sealed-defaults-invariants.test.ts**` is doctrine-anchored.

### 5.2 · Known copy drift (shipped-fix file)

`src/components/nex-native/emergency/__tests__/EmergencyConfirmationScreen.test.tsx`
— mock-gap fixed in `fc37e1b8` (15/20 cases recovered). Remaining 5:
- Test expects `"I Understand — Continue"` · component renders
      `"Activate System"` (acknowledge CTA)
- Test expects `"Alert revoked"` · component renders `"Alert Canceled"`
      (revoked-phase heading)
- Missing `data-testid="nex-emergency-category-button-medical_concern"`
      (category-select phase has been reshaped)
- Missing `data-testid="nex-emergency-countdown-phase"` (countdown wrapper
      lost the attribute during a later refactor)
- Fifth failure mirrors the revoked-copy drift above

---

## 6 · Per-file inventory · missing-file sources

Files that tests expect to read but no longer exist on disk.

| Missing source | Test files affected | Likely resolution |
|---|---|---|
| `docs/nex-work-map.json` | 1 | Artifact never published; retire test or author manifest |
| `src/app/nex-native/themes/theme-1/page.tsx` | 1 | Theme consolidation · retire |
| `src/app/nex-native/chat-themes-library/category/[categoryId]/page.tsx` | 1 | Route structure change · verify current route exists, update test target |
| `src/app/nex-native/themes/pink-dream/page.tsx` | 1 | Theme consolidation · retire |
| `src/app/nex-native/themes/cyber-grid/page.tsx` | 1 | Theme consolidation · retire |
| `src/app/nex-native/chat/prototypes/hauntedhoteltheme/page.tsx` | 1 | Prototype route · retire |
| `src/app/api/nex/hq/agents/route.ts` | 1 | HQ agents API not in nexapp carve-out · retire or author |
| `src/app/nex-native/chat/prototypes/haunted-hotel-bubbles/page.tsx` | 1 | Prototype route · retire |
| `src/app/nex-native/business-setup/_actions.ts` | 2 | Scope reduction may have retired · verify |
| `nex-supabase/migrations/221_nex_live_participation.sql` | 1 | Migration file identity test · verify migration naming |
| `src/app/nex-native/manage/live/shop-contacts/[sessionId]/page.tsx` | 1 | Live-commerce route · scope-reduction retiree |
| `src/app/api/nex-head-quarters/directory-factory/decide/route.ts` | 1 | HQ directory-factory not in carve-out · retire or author |
| `src/app/nex-head-quarters/directory-factory/page.tsx` | 1 | HQ directory-factory UI · retire or author |
| `src/app/nex-native/chat/prototypes/haunted-hotel-effects/page.tsx` | 1 | Prototype route · retire |
| `src/app/nex-native/settings/about/page.tsx` | 1 | Settings subroute · verify current structure |
| `src/app/nex-native/settings/notifications/page.tsx` | 1 | Settings subroute · verify current structure |
| `src/app/nex-native/settings/notifications/_actions.ts` | 1 | Settings subroute actions · verify |
| `src/app/nex-native/[businessSlug]/[productId]/_order-bar.tsx` | 1 | Order bar structure · verify current product page |
| `data/nex-image-manifest.json` | 1 | Image manifest · artifact never generated |
| `src/app/nex-native/welcome/page.tsx` | 1 | Welcome route · verify current structure |
| `src/app/nex-native/vault/recover/_recover-unlock-client.tsx` | 1 | Vault recover · verify |
| `src/app/nex-native/settings/notifications/_toggle-row.tsx` | 1 | Toggle row component · verify |
| `src/app/nex-native/[businessSlug]/[productId]/page.tsx` | 1 | Product page · verify current structure |
| `src/app/nex-native/live-commerce/[sessionId]/_viewer-client.tsx` | 1 | Live-commerce scope-reduced · retire |
| `docs/NEX1/assets/nex-visual-master-reference.png` | 1 | Asset never checked in · retire or add |
| `docs/NEX1/assets/nex-visual-master-side-views-reference.png` | 1 | Asset never checked in · retire or add |
| `src/app/nex-native/live-commerce/enter-broadcast-room/_actions.ts` | 1 | Live-commerce scope-reduced · retire |
| `src/app/nex-native/manage/live/shop-contacts/[sessionId]/_shop-contacts-card.tsx` | 1 | Live-commerce scope-reduced · retire |
| `src/app/nex-native/dev/standard-experience-preview/page.tsx` | 1 | Dev preview route · scope-reduction retiree |

---

## 7 · Owner decision ballot

Before the next #58 work pass, I need the owner to call on at least these:

| # | Decision | Default-if-silent |
|---:|---|---|
| D-1 | §3.1 assertion-drift · component or test canonical? Per-file? | Leave all 42 as BLOCKED |
| D-2 | §3.2 sandbox-guard · author env-fixture or leave as prod-ref rejection? | Leave as rejection |
| D-3 | §3.3 fork-residue · per missing-module cluster · shim / port / delete? | Delete `staircase-knowledge` (4 files · scope-reduction confirmed); hold the rest |
| D-4 | §3.4 missing-file · retire / build / defer per file? | Hold all |
| D-5 | §4 DEAD subtree · `.describe.skip` at suite level? | Leave as failing (status quo) |

No further edits will be made against the listed files until the ballot
returns.

---

## 8 · What this inventory is NOT

- Not a remediation plan. Each cluster is a question, not a prescription.
- Not a declaration that any component is canonical.
- Not an authorisation to edit any of the 166 files listed.
- Not an authorisation to delete any `src/*` source file to satisfy a test.
- Not a replacement for the sealed scope-reduction doctrine — any
  cluster whose fix would re-introduce a scope-reduced feature is BLOCKED
  by the 2026-11-06 Scope Reduction seal and stays BLOCKED.

The one acceptable mechanical fix already shipped (`fc37e1b8`) was a
pure test-side mock-table extension, no component touched, and it reduced
one file's failure count from 20 to 5. That pattern — pure test-side
mechanical gap — is the only one safely automatable; everything else
requires owner judgment.
