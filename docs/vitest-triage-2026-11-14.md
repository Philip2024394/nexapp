# NEX v1 · Vitest Failure Triage · 2026-11-14

**Captured at HEAD `81b990eb`** on branch `release-audit-v1-2026-11-14`.
Node 26.13.1 · dev `.env.local` pointed at sandbox Supabase
`kdstoyyeygcopkogqsyv`. Production ref `ijvqdvsvwtwxzcqmoqit` not
touched.

## Headline

Fresh run captured at `/tmp/vitest-full-v3.log`:

```
Test Files  374 failed | 934 passed | 5 skipped (1313)
Tests       536 failed | 21598 passed | 330 skipped | 9 todo (22473)
Duration    123.88s
```

Pass rate: **97.6%**. This is a captured baseline, not a decision — each
cluster below has a verdict + rationale.

**Fixed this pass with fresh verification (16 tests):**

- `attempt-encrypted-attachment.test.ts` · 1 test (plus 1 new case
  added); file now 21/21 green.
- `vault-key-hierarchy.test.ts` · 8 tests; file now 59/59 green.
- `_pin-entry-reducer.test.ts` · 7 tests; file now 29/29 green.

All three were obsolete test assumptions versus sealed source-of-truth
changes. No assertion was weakened. No production code was changed.

---

## Clusters · bounded inventory with per-cluster verdict

### Cluster 1 · fork-residue in `src/lib/nex/*` · ~147 files

**What it is:** Legacy shared-infra fork tree inherited from the
`D:/trades` monorepo. Includes `brain/`, `comms-social/`, `programmer-*/`,
`merchant-assistant/`, `agent-runtime/`, `jobs/`, `ab/`, `est/`, `ops/`,
`pm/`, `security-agent/`, `hq/`, `knowledge-*/`, `marketing/`,
`observability/`, `config/`, `db/`, `verification/`, `storage/`,
`alerts/`, `analytics/`, `api/`, `business-context/`, `capability-*`,
`centre-publishing/`, `city-registry/`, `universal-intent/`.

**Why it fails:** Depends on tables, src files, and modules that do
not exist in this fork. Many `.test.mjs` under `lib/nex/*/tests/` are
process-level integration tests from the pre-fork repo.

**Launch impact:** OUT of v1 app scope per the 2026-11-06 Scope
Reduction. CLAUDE.md fork-hygiene section explicitly says "Clean up
incrementally, not in one pass." These tests are not launch gates for
Chat + Themes + Shop + Vault + Directory.

**Verdict:** NONBLOCKING. Document as owner-accepted baseline exception.

---

### Cluster 2 · `lib/nex-agent*` · ~30 files

**What it is:** NEX Agent Runtime tests. Out-of-v1 architecture.

**Launch impact:** NEX Agent is OUT of v1 (sealed Scope Reduction).

**Verdict:** NONBLOCKING. Same posture as Cluster 1.

---

### Cluster 3 · prod-only live-DB tests · 13 files · 26 fails

**Scope:** `src/lib/nex-native/first-conversation/__tests__/*.test.ts`
(13 files, 26 test failures).

**Why they fail:** Each file has a `beforeAll` guard:
```
if (!process.env.DATABASE_URL?.includes("ijvqdvsvwtwxzcqmoqit")) {
  throw new Error("refuses: not ijvqdvsvwtwxzcqmoqit");
}
```
They refuse to run against sandbox. The sealed rule is that production
project ref `ijvqdvsvwtwxzcqmoqit` is **not** to be used for engineering
work. So these tests can ONLY run in a founder-invoked prod probe.

**Launch impact:** The code they cover (provisional account, first-
message HTTP, orchestrator, risk-service, welcome-delivery, session-
registry) IS launch-critical. But the CI-style verification is blocked
by the sealed prod-ref policy.

**Verdict:** BLOCKED/UNVERIFIED. Correct posture is one of:
- Owner authorises a fenced prod probe (read-only or on a staging
  branch) — closes these with real evidence, OR
- Guard the describe blocks with `describe.skipIf(!<env check>)` so CI
  skips them cleanly instead of failing — closes the noise, keeps the
  prod probe available locally when owner opts in.

Engineering can do (b) with explicit owner approval. (a) is founder-
only.

---

### Cluster 4 · tests ahead of unbuilt surface · 4 files · 33+ fails

**Scope:**

- `src/lib/nex-native/__tests__/vault-contacts.test.ts` (32 failures) —
  asserts `src/app/nex-native/vault/home/contacts/page.tsx` which does
  not exist.
- `src/lib/nex-native/__tests__/vault-persistence.test.ts` — asserts
  `src/app/nex-native/vault/settings/page.tsx` which does not exist.
- `src/lib/nex-native/__tests__/vault-move-and-preserve-b5.test.ts` —
  similar vault page ahead-of-impl.
- `src/lib/nex-native/__tests__/vault-lock-and-leave-recover.test.ts`
  — similar.

**Why they fail:** The tests use `fs.readFileSync` against paths that
have never been added to this fork. The tests were speculatively
written for Vault surfaces that have been design-sealed but not yet
built.

**Launch impact:** Vault IS v1 (bundles with Shop per Scope Reduction).
The bundled Vault scope today is `/vault`, `/vault/intro`, `/vault/
setup`, `/vault/home`, `/vault/home/chats[/id]`, `/vault/home/plans`,
`/vault/home/videos`, `/vault/home/archived`. **No** `/vault/home/
contacts` or `/vault/settings` or `/vault/move` are built.

**Verdict:** FOUNDER-DECISION per missing surface. If these pages are
out of v1, `describe.skip` + a pointer to the design doc is the honest
fix. If they're in v1, they need to be built (new-feature work, not a
test fix).

---

### Cluster 5 · `send-cart-order-slice-0.test.ts` · 1 file · 37 fails

**Why it fails:** Vitest SSR `vi.mock("@/lib/...")` hoisting pattern no
longer matches the import graph. Error signature:
```
expected '__vite_ssr_import_2__.nexSupabaseAdmi…' to contain
'REDIRECT:/nex-native/cart?send_error='
```
The mock import is being rendered as its `__vite_ssr_import_*` symbol
rather than invoked.

**Launch impact:** The production code it targets (`sendCartOrderAction`)
is **Playwright-verified** via Stage-5 shop-chat journey (15/15 green at
`b382dd43`). The runtime path works. This is test-infra debt.

**Verdict:** NONBLOCKING with **evidence** (Playwright on the same
code). Full mock-chain rewrite is deferred. Can be closed by one of:
- Convert the mock to `vi.mock("@/lib/nex-native/supabase-admin")`
  with explicit factory + actual function references in each test, OR
- Switch this test file to use the real sandbox DB (same pattern as
  the first-conversation live-DB tests but pointed at sandbox).

---

### Cluster 6 · env-dependent gate test · 1 file · 3 fails

**Scope:** `src/lib/nex-native/__tests__/launch-flags.test.ts` · tests
"searchEnabledForRequest · production (B9/B10 containment)".

**Root cause:** `NEX_SEARCH_ENABLED=1` is set in dev `.env.local`. The
module-level constant evaluates to `true` at import. The function has
an early return `if (NEX_SEARCH_ENABLED) return true;` that fires
BEFORE the `NODE_ENV==='production'` refusal check. The test can
`vi.stubEnv("NODE_ENV","production")` but cannot change the already-
imported constant.

**Launch impact:** Production gate works correctly when
`NEX_SEARCH_ENABLED` is unset (the intended prod state). The test fails
only because *dev env* has it on.

**Verdict:** NONBLOCKING. Correct fix is to add `vi.resetModules()` +
`vi.stubEnv("NEX_SEARCH_ENABLED","")` before the describe block, or
mock the constant directly. Not launch-critical.

---

### Cluster 7 · brittle data-count assertions · 2 files · 3 fails

**Scope:** `library/backgrounds/__tests__/sandbox-db.test.ts` (seed row
count 450 → 451 drift) and `shop-happy-path.test.ts` (one expected-null
URL now populated).

**Launch impact:** The feature works. Test expectations lag the sandbox
seed.

**Verdict:** NONBLOCKING. Update the expected count and the URL
assertion to the current sandbox state. Low priority.

---

### Cluster 8 · missing-table tests (sandbox not fully migrated)
### · 2 files · ~14 fails

**Scope:** `src/lib/nex/category-registry.db.test.ts` and companion ·
assert on `nex.category_candidate`, `nex.category_registry`. Both
relations missing in sandbox.

**Launch impact:** `nex.category_*` is directory-factory legacy infra
(see Cluster 1). Not in v1 app scope. Also missing in sandbox for
`nex.family_safety_entitlement`, `nex.family_safety_payment_attempt`,
`nex.worker_heartbeat`.

**Verdict:** NONBLOCKING (same posture as Cluster 1).

---

### Cluster 9 · source-grep contract tests · various files · ~40 fails

**Scope:** `_page-header.test.ts`, `_page-header-drawer.test.ts`,
`_shop-auto-open-cookie.test.ts`, `directory/__tests__/page-no-
fabrication.test.ts`, `directory/[id]/__tests__/detail-page-no-
fabrication.test.ts`, `chat-standard/_universal-header-icons-overlay.
test.ts`, `settings/_settings-ia.test.ts`, `_landing-i18n.test.ts`,
and others.

**Why they fail:** They `fs.readFileSync` a page source file and
assert that specific strings appear or don't appear (sentinel phrases
like "Unclaimed", "SystemPreparingState", "Nothing on this page is
fabricated", etc.). Page refactors drifted away from those sentinels.

**Launch impact:** These are policy-grep tests, not behavioural tests.
A failure means the sentinel moved or was renamed, not that the
behaviour broke.

**Verdict:** PER-TEST REVIEW needed. Each one needs the sentinel
updated or the test retired. Not launch-blocking individually; several
need one-liner fixes.

---

### Cluster 10 · slice-* commerce integration tests · ~7 files

**Scope:** `slice-0.8-commerce-inquiries.test.ts`, `slice-0.9-chat-
sharing.test.ts`, `slice-1a-inquiry-idempotency.test.ts`, `slice-1b-
share-product-live-session.test.ts`, `slice-1d-signal-emission.test.ts`,
`slice-1f-interest-page.test.tsx`, and `send-cart-order-slice-0`.

**Why they fail:** Mix of (a) `slice-1b` references Live sessions
(OUT of v1 scope), (b) others share the Vitest SSR mock-chain shape
bug from Cluster 5.

**Launch impact:** Mixed. `slice-0.8`/`0.9`/`1a` test chat-sharing +
inquiry flows that ARE v1-critical; they're affected by the mock-chain
drift, same as Cluster 5. `slice-1b/1d/1f` touch live/interest
surfaces that may be out of v1.

**Verdict:** PER-FILE REVIEW. Chat-sharing + inquiry pieces should be
fixed like Cluster 5. Live-related pieces are nonblocking.

---

### Cluster 11 · small assertion drift on real v1 code · ~15 files

**Scope:** `badge-sync-contract.test.ts`, `business-service-cover-
layout.test.ts`, `chat-view-preferences-service.test.ts`, `directory-
v1-api-contract.test.ts`, `disappearing-messages-service.test.ts`,
`dev-impersonation.test.ts`, `identity-chrome-ssr.test.ts`, `chat-
chrome/no-reimplementation.test.ts`, `contact-picker-service.test.ts`,
`theme-category/registry.test.ts`, directory component tests (country-
picker, osm-attribution, listing-card), control-drawer-client, etc.

**Launch impact:** These are the files that actually matter for v1.
Needs per-test inspection. Some will be stale expectations (fast fix),
some may be real drift from recent UI commits.

**Verdict:** NEEDS PER-TEST REVIEW. Potential to close 30-50 tests
with low-risk assertion updates after inspecting the sealed intent of
each.

---

## What this triage recommends

| Verdict | Clusters | Rough test count |
|---|---|---|
| FIXED this pass (fresh-verified) | 1 (attempt-enc + vault-key + pin-reducer) | **16 tests** |
| BLOCKED/UNVERIFIED (prod-only tests, policy-bound) | 3 | 26 |
| NONBLOCKING (fork residue · owner-accepted baseline candidate) | 1, 2, 6, 7, 8 | ~200 |
| PLAYWRIGHT-COVERED (test-infra debt only) | 5 | 37 |
| FOUNDER-DECISION (build-or-skip missing surfaces) | 4 | ~33 |
| PER-TEST REVIEW (small clusters · engineering-closable) | 9, 10, 11 | ~95 |

## Owner acceptance request

If the owner accepts the following as a documented nonblocking
baseline exception for v1 launch:

- Cluster 1 (lib/nex fork residue · ~147 files)
- Cluster 2 (lib/nex-agent* · ~30 files)
- Cluster 6 (env-dependent gate test · 1 file)
- Cluster 7 (brittle data-count · 2 files)
- Cluster 8 (missing-table legacy · 2 files)

…and defers the following to post-launch backlog with named owner
decisions:

- Cluster 3 (13 prod-only live-DB · guard with `describe.skipIf` so
  CI is green)
- Cluster 4 (4 ENOENT · skip until surfaces are built)
- Cluster 5 (37 mock-chain test-infra debt · covered by Playwright)
- Cluster 9 (~40 source-grep policy tests · per-sentinel review)
- Cluster 10 (~7 slice-* commerce · mixed · per-file review)
- Cluster 11 (~15 v1-core drift · per-test review)

…then P5 ("vitest baseline not owner-accepted") closes with a
documented bounded exception, not a blanket "accept 535 failures"
posture.

## What this triage did NOT touch

- Did not weaken any assertion.
- Did not change any runtime code.
- Did not run Playwright.
- Did not touch production in any way.
- Did not apply any migration.
- Did not alter credentials.
- Did not skip any test.

The three cluster fixes are committed at `81b990eb` with scoped
regression evidence (117/117 pass across the touched files + the
prior detect-columns regression).
