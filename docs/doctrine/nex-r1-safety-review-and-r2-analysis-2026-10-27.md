# NEX R1 Safety Review + R2 Root-Cause Analysis · 2026-10-27

> Founder-authorised read-only safety review of commit `a2697a4` (R1 throw-shim) + R2 root-cause analysis for the next isolated repair batch. No code changes. No push until authorised.
>
> Classification per Protocol §6: `researched` + `verified at measurement level stated`. Not `approved`, not `implemented`.

---

## Part A · R1 Safety Review

### A1 · Shim exported symbols vs every legacy caller compatibility

**Verified**: all 109 legacy caller files use the identical import pattern:
```
import { supabaseAdmin } from "@/lib/supabaseAdmin"
```

Measurement: `grep -rohE "import [^;]+ from ['\"]@/lib/supabaseAdmin['\"]" src | sort -u` returned exactly ONE distinct line (`import { supabaseAdmin } from "@/lib/supabaseAdmin"`).

Alternative patterns searched + verified ABSENT:
- `import supabaseAdmin from ...` (default import) · zero occurrences
- `import * as supabaseAdmin from ...` (namespace import) · zero occurrences
- `require("@/lib/supabaseAdmin")` (CommonJS) · zero occurrences

Shim's export surface: `export const supabaseAdmin: SupabaseClient = new Proxy(...)`. Single named export, correctly typed as `SupabaseClient`.

**Compatibility: full.** Every caller's import binding is satisfied. No symbol-mismatch errors introduced.

### A2 · Production reachability

**Direct reachability check**:
- Set A = 110 files that import `@/lib/supabaseAdmin` (via `grep -lE "from.*['\"]@/lib/supabaseAdmin['\"]" src -r`)
- Set B = 10 nex/* modules directly imported from `/nex-native/*` or `/api/nex-native/*` production routes:
  - `src/lib/nex/db.ts`
  - `src/lib/nex/i18n/{format,I18nProvider,keys,packs/en,packs/id,server,supported-locales}.ts`
  - `src/lib/nex/observability/correlation.ts`
  - `src/lib/nex/storage/object-registry.ts`
- Intersection A ∩ B = **0**

**Transitive reachability check**:
- Recursive grep for `@/lib/supabaseAdmin` under `src/lib/nex/{db,i18n,observability,storage}` returned **zero matches**.
- Direct import scan of the 10 shared-infra files for ANY `@/lib/nex/*` sub-module returned **zero matches**. The shared-infra tree is self-contained.
- `src/lib/nex-native/*` imports of `@/lib/supabaseAdmin`: **zero** (confirms the sealed cross-DB separation doctrine).

**Reachability verdict**: the 109 legacy caller files are **unreachable from NEX-native production routes through the TypeScript import graph**. The R1 shim's runtime throw cannot fire via a user-triggered NEX-native route.

**Caveats** (honest):
- Did NOT scan for dynamic `import()` expressions.
- Did NOT scan for `require(path)` with a computed path.
- Did NOT scan `scripts/` or `tests/` for crossings.
- Did NOT verify that Next.js route-collection does not scan non-page files for server-action exports in a way that transitively imports a legacy caller.

### A3 · Tests covering intended fail-closed behaviour

**Verified**: ZERO tests exist for the R1 shim's throw-at-access behaviour.
- No `src/lib/__tests__/supabaseAdmin.test.ts` file.
- No reference to `src/lib/supabaseAdmin` in any `*.test.ts` or `*.test.tsx` in the repo (grep confirmed).

**This is a testing gap introduced by R1.** The shim's intended behaviour (every property access + every call throws descriptively) is enforced by code review only, not by automated regression.

**Recommended follow-up** (not implemented in this review): add `src/lib/__tests__/supabaseAdmin.test.ts` with assertions:
1. Accessing `.from('x')` throws, error message contains the sealed guidance string.
2. Calling the Proxy directly throws.
3. The export is type-compatible with `SupabaseClient`.
4. Deleting the shim file would cause the typecheck baseline to grow by the expected delta (regression anchor).

Tests would land as a separate isolated commit under separate founder authorisation per the "no new code changes" guard on this review.

### A4 · Baseline reproducibility (same command, same config, before and after)

**Verified**:
- Same `tsconfig.json` across baselines (confirmed · zero diffs in tsconfig.json since session start).
- Same command: `npx tsc --noEmit 2>&1 > /tmp/tsc-{baseline-37acc10|pre-r1|safety-check|after-r1}.log`.
- Same Node/TypeScript binary.

**Reproducibility results**:
| Snapshot | HEAD | Distinct diagnostics |
|---|---|---|
| Baseline (pre-triage) | `37acc10` | 1,665 |
| Pre-R1 recheck | `2894629` | 1,665 |
| Post-R1 (first measurement) | `a2697a4` | 1,400 |
| Post-R1 (safety-review recheck) | `a2697a4` | **1,400** |

Count regenerates stably. Reproducible.

### A5 · Honest correction · R1 introduced 6 new diagnostics (not zero as previously reported)

**My earlier R1 commit message claimed "zero new typecheck errors introduced by this change" and the measured delta of −265. The second claim is correct; the first is INCOMPLETE.**

Set-diff between pre-R1 and post-R1 diagnostic sets:
- Diagnostics ONLY in pre-R1 (cleared by R1): **271**
- Diagnostics ONLY in post-R1 (NEW): **6**
- Diagnostics in both (unchanged): **1,394**
- Net delta: 1,665 − 271 + 6 = **1,400** ✓

**The 6 new diagnostics**:

| File | Line:Col | Code | Message |
|---|---|---|---|
| `src/lib/nex/bookkeeping/storage.ts` | 78:12 | TS2349 | This expression is not callable |
| `src/lib/nex/business-context/database.ts` | 67:15 | TS2352 | Conversion of type `GenericStringError` to type `BusinessBlueprintRow` may be a mistake... |
| `src/lib/nex/business-context/database.ts` | 98:15 | TS2352 | same |
| `src/lib/nex/business-context/database.ts` | 179:15 | TS2352 | same (array variant) |
| `src/lib/nex/business-context/database.ts` | 213:16 | TS2352 | same (array variant) |
| `src/lib/nex/centre-publishing/indexForSearch.ts` | 112:45 | TS2339 | Property `id` does not exist on type `GenericStringError` |

**Analysis**:
- Before R1: `supabaseAdmin` failed to resolve → implicit `any` → suppressed all downstream type checks on its usage.
- After R1: `supabaseAdmin` resolves as `SupabaseClient` → Supabase's own TypeScript inference now applies → the `GenericStringError` discriminated-union branch of query responses is visible → legacy casts of `.single()` / `.select()` results to row types without discriminating the error branch are now flagged.

**Verdict**: these 6 new diagnostics reveal **genuine latent code quality issues** in the legacy caller files. They are TRUE-POSITIVE signals that pre-R1 implicit-any had been hiding. The net exchange is 271 noise diagnostics (TS2307 primary + cascading) cleared for 6 useful signal diagnostics gained — net improvement, not just arithmetic reduction.

**Correction to R1 commit message**: should have read *"net −265 (271 cleared, 6 new honest-signal diagnostics introduced revealing latent casts of error branches to row types in legacy files)"*. The R1 commit's framing was accurate in spirit (net reduction) but incomplete in reporting (did not surface the 6).

### A6 · R1 safety verdict

| Dimension | Assessment |
|---|---|
| Exported symbols vs caller compatibility | **PASS** · all 109 callers' identical `{ supabaseAdmin }` import satisfied |
| Direct production reachability (A ∩ B) | **PASS** · zero intersection |
| Transitive production reachability | **PASS** · shared-infra tree is self-contained; zero paths to the 109 legacy callers |
| Fail-closed test coverage | **GAP** · no tests exist; add in a separate authorised commit |
| Baseline reproducibility | **PASS** · same tsc command + tsconfig + node; count regenerates stably |
| New diagnostics introduced | **6 (honest signal)** · not zero; prior commit message was incomplete |
| Doctrine compliance (cross-DB separation) | **PASS** · no re-point; throw-at-use preserves the sealed separation |

**No rollback recommended.** R1 stands. Three follow-ups suggested (not implemented):
1. Add fail-closed tests (new isolated commit, separate authorisation).
2. Investigate the 6 new TRUE-POSITIVE diagnostics in `business-context/database.ts` + `bookkeeping/storage.ts` + `centre-publishing/indexForSearch.ts` to decide: fix (via legacy migration) OR delete (if dead code).
3. Amend the R1 commit's doctrine note (`nex-legacy-throw-shim-pattern-2026-10-27.md`) to record the +6 new-diagnostics discipline for future shims.

---

## Part B · R2 Root-Cause Analysis

### B1 · Post-R1 cluster map (reproduced on `/tmp/tsc-safety-check.log`)

**Top missing modules (post-R1 TS2307 clusters)**:

| Count | Module | Likely origin |
|---|---|---|
| 30 | `@/lib/nexapp/tokens` | Nexapp prototype design-tokens · dropped by fork extraction |
| 25 | `@/lib/nex-cap/nex1-engineer` | Sibling product (nex-cap) |
| 16 | `@/lib/nex-intelligence/provenance` | Sibling product (nex-intelligence) |
| 12 | `@/lib/nex-cap/registry` | Sibling product (nex-cap) |
| 9 | `@/lib/app-builder/blueprint-schema` | Sibling product |
| 8 | `@/lib/crm/loadContactTimeline` | Sibling product |
| 8 | `@/apps/materials/_schema/types` | Sibling product |
| 6 | `@/apps/materials/_schema/memory_types` | Sibling product |
| 5 | `@/lib/supabaseNexAdmin` | Alternative legacy admin client name |
| 5 | `@/lib/openai/vision` | Sibling product |
| 5 | `@/lib/nex-hq-agents/registry` | Sibling product |
| 5 | `@/lib/nexapp/mockContacts` | Nexapp prototype · dropped |
| 4 | `@/lib/products/read` | Sibling product |
| 4 | `@/lib/nex-voice` | Sibling product |
| 4 | `@/lib/nex-intelligence/source-pool` | Sibling product |

Top-15 missing modules = 146 of the remaining 265 TS2307 errors (55%).

**Top offending files post-R1** (first 6 that changed vs pre-R1):

| Count | File | Change vs pre-R1 |
|---|---|---|
| 46 | `src/lib/nex-agent/code-engine/capability-meaning-construction.ts` | unchanged |
| 34 | `src/lib/nex-agent/code-engine/capability-conversation-working-memory.ts` | unchanged |
| 31 | `src/lib/nex-agent-runtime/brains/intelligence-brains.ts` | unchanged |
| 28 | `src/lib/nex/mutations/registry.ts` | unchanged |
| 26 | `src/lib/nex/centre-publishing/indexForSearch.ts` | **−18** (was 44) · R1 cleared ~41% of this file's errors |
| 25 | `src/lib/nex/create-banners/sandbox/composition-v2/layout-candidates.ts` | unchanged |

R1 reduced `centre-publishing/indexForSearch.ts` significantly (confirming that file imports `@/lib/supabaseAdmin` + heavily uses it) but did not touch the top three nex-agent/* files — those have different root causes.

### B2 · R2 candidate ranking

Quantified against the 1,400 post-R1 baseline:

| Candidate | Primary cleared | Total diagnostics in callers | Shim complexity | Risk |
|---|---|---|---|---|
| **R2 · `@/lib/nexapp/tokens`** | 30 | **99** (30 files) | Trivial · single `NEX` export · identical pattern across all 30 callers | low · pure design-tokens type data, no DB/service surface |
| R3 · `@/lib/nex-cap/*` (nex1-engineer + registry) | 37 | 70 (22 files) | Medium · multiple distinct symbols imported; mixed value + type imports | medium · shim would need matching exports for 7+ distinct symbol sets |
| R4 · `@/lib/nex-intelligence/provenance` | 16 | ~50 (estimated) | Low · provenance is likely a types-only module | low |
| R5 · `@/apps/materials/_schema/*` | 14 (combined) | ~60 (estimated) | Low · types-only; sibling product | low |
| R6 · `@/lib/supabaseNexAdmin` | 5 | ~15 (estimated) | Trivial · reuses R1 pattern | low · same doctrine as R1 |

**R2 recommendation** (if authorised): `@/lib/nexapp/tokens`.

Reasons:
- Simplest shim (30 identical imports, single symbol `NEX`)
- Second-highest cluster size after R1
- Zero DB/service surface (design tokens are pure data) · no runtime safety concerns
- Zero cross-DB doctrine clash (design tokens have no DB)
- Predicted delta: **1,400 → ~1,320 diagnostics (~−80, ~−6%)**

### B3 · What R2 would need (not proposed in detail here)

A full R2 proposal (following the R1 pattern) would need to answer:
1. What symbol shape does `NEX` export? Likely a design-tokens record (colors, sizes, radii). Confirm by inspecting one caller that uses `NEX.xxx` property.
2. Does the current nexapp codebase already have a replacement tokens source? E.g. `src/lib/nex-native/design-tokens.ts` (memory suggests this exists from the sealed 2026-10-17 design-token rule).
3. If a replacement exists AND is compatible, the shim should re-export from the real source rather than throw. If no replacement, use the R1 throw-at-use pattern.
4. Will R2 introduce new TRUE-POSITIVE diagnostics (like R1's 6)? Likely YES because real types restore inference on the 30 callers.
5. Set-diff measurement before + after (identical to R1 safety-review protocol).

**This review does NOT propose R2 in detail** · the founder's instruction was "R2 root-cause analysis", not "R2 full proposal". Full proposal requires separate authorisation.

### B4 · Alternative R2 scope (if founder prefers a different cluster)

- **R3 (nex-cap)** · more complex but similar risk profile; good if nexapp/tokens is deemed too design-coupled to touch.
- **R6 (supabaseNexAdmin)** · smallest · validates the R1 pattern on a 5-file cluster before committing to a larger R2.
- **Tests-first** · implement the recommended R1 fail-closed test suite instead of a new shim. This is **lower novelty** but **higher coverage dividend** · adds regression safety to R1 before R2 lands.

### B5 · Honest limitations of this analysis

- Did NOT inspect a caller of `@/lib/nexapp/tokens` to confirm the `NEX` symbol usage pattern or verify its property surface.
- Did NOT check whether `src/lib/nex-native/design-tokens.ts` already exports compatible primitives.
- Did NOT compute cascading-to-primary ratios for every candidate cluster (only R1's actual, R2's estimated).
- Predictions for R3-R6 cascading sizes are estimates, not measured.
- Did NOT scan dynamic imports for any candidate.

---

## Consolidated status (per founder's review structure)

### Completed + verified (this review)
- R1 shim's export surface vs 109 caller usage patterns · **PASS**.
- R1 production reachability (A ∩ B direct + transitive) · **PASS** · zero intersection.
- Baseline reproducibility · **PASS** · 1,400 stable across multiple runs on HEAD `a2697a4`.
- Set-diff computation · **271 cleared, 6 new (honest-signal) introduced, 1,394 unchanged**.
- Post-R1 cluster map for R2+ selection.

### Implemented but not fully verified
- R1 shim runtime throw path · verified by code review only; no automated tests.

### Blocked + exact dependency
- R2+ repair batches blocked on founder authorisation.
- Fail-closed test coverage for R1 blocked on founder authorisation (new code change).
- Investigation of the 6 new TRUE-POSITIVE diagnostics blocked on founder decision about scope.

### Decisions requiring founder approval
- **D16** · Approve adding fail-closed tests for `src/lib/supabaseAdmin.ts` (new isolated commit).
- **D17** · R2 candidate choice: `@/lib/nexapp/tokens` (recommended), OR `@/lib/nex-cap/*`, OR `@/lib/supabaseNexAdmin` (smallest), OR "tests-first" alternative.
- **D18** · Scope decision for the 6 new TRUE-POSITIVE diagnostics: fix via migration (requires NEX-native boundary design), delete the legacy callers (if dead), or leave in place as honest-signal (acceptable).

### Proposed next authorised task
Founder picks:
1. **Approve D16 (tests-first)** → I write `src/lib/__tests__/supabaseAdmin.test.ts` as a new isolated commit · ~40 LOC + vitest run · zero other changes · request push separately.
2. **Approve D17 R2 nexapp/tokens** → I produce the full R2 proposal doc (same format as the R1 proposal), measure predicted delta against the 1,400 baseline, then wait for separate authorisation to implement.
3. **Combine D16+D17** → tests-first lands as commit N, R2 proposal lands as commit N+1 (both doc/test only, zero behaviour change) and R2 implementation remains a separate approval.
4. **Something else** → name the direction.

---

## What this review does NOT do

- Does NOT change any code.
- Does NOT re-run or modify R1.
- Does NOT propose R2 implementation (only R2 analysis).
- Does NOT add tests for the R1 shim (acknowledged gap, deferred).
- Does NOT touch any founder-created UI, sealed doctrine, RLS, schema, storage, env, or payment infrastructure.
- Does NOT grant implementation authority for R2 or any follow-up.
