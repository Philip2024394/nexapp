# NEX TypeScript Baseline · Root-Cause Triage · 2026-10-27

> Founder-authorised bounded read-only investigation · zero code changes · no push until authorised.
> Baseline: HEAD `9c41575` · reproducible via `npx tsc --noEmit 2>&1 > /tmp/tsc-baseline-37acc10.log` from the repo root. 1,665 distinct `(file, line, col, code)` diagnostics across 595 files and 46 distinct error codes.

---

## Phase 1 · Ranked-by-impact breakdown

### 1a · Full error-code histogram (46 codes)

| Code | Count | Share | Meaning |
|---|---|---|---|
| TS2307 | 379 | 22.8% | Cannot find module |
| TS7006 | 313 | 18.8% | Parameter implicitly `any` |
| TS2339 | 287 | 17.2% | Property does not exist on type |
| TS2322 | 200 | 12.0% | Type not assignable |
| TS2345 | 121 | 7.3% | Argument type not assignable |
| TS2540 | 50 | 3.0% | Cannot assign to read-only |
| TS2741 | 45 | 2.7% | Property missing in type |
| TS2353 | 32 | 1.9% | Object literal has unknown property |
| TS2739 | 26 | 1.6% | Type missing properties from required |
| TS2352 | 26 | 1.6% | Suspicious cast |
| TS18047 | 26 | 1.6% | Possibly null |
| TS2304 | 23 | 1.4% | Cannot find name |
| TS18048 | 21 | 1.3% | Possibly undefined |
| TS2305 | 19 | 1.1% | Module has no exported member |
| other 32 codes | 97 | 5.8% | long tail |

**Headline**: top 5 codes = 78.1% of diagnostics. Top 2 codes (TS2307 missing-module + TS7006 implicit-any) = 41.6%.

### 1b · Top 20 files by distinct diagnostic count (concentration)

| Count | File |
|---|---|
| 46 | `src/lib/nex-agent/code-engine/capability-meaning-construction.ts` |
| 44 | `src/lib/nex/centre-publishing/indexForSearch.ts` |
| 34 | `src/lib/nex-agent/code-engine/capability-conversation-working-memory.ts` |
| 31 | `src/lib/nex-agent-runtime/brains/intelligence-brains.ts` |
| 28 | `src/lib/nex/mutations/registry.ts` |
| 26 | `src/components/nex-app/centre/SupplierCard.tsx` |
| 25 | `src/lib/nex/create-banners/sandbox/composition-v2/layout-candidates.ts` |
| 24 | `src/lib/nex-agent-runtime/workstation-execution-bridge/execute-command.ts` |
| 22 | `src/lib/nex-native/directory/__tests__/directory-service.test.ts` |
| 19 | `src/lib/nex-agent/code-engine/capability-repository-discovery-s1-repair.test.ts` |
| 19 | `src/components/nex-app/centre/SupplierSheet.tsx` |
| 18 | `src/components/nexapp/NexFriendChatView.tsx` |
| 16 | `src/lib/nex/context.ts` |
| 16 | `src/lib/nex/authorization/policy.ts` |
| 14 | `src/lib/nex-native/theme-category/registry.ts` |
| 13 | `src/lib/nex-native/__tests__/vault-key-hierarchy.test.ts` |
| 13 | `src/lib/nex/i18n/i18n.test.ts` |
| 12 | `src/lib/nex/merchant-assistant/toolExecutors.ts` |
| 12 | `src/lib/nex/bi/adapters/invoices.ts` |
| 12 | `src/app/nex-native/vault/_pin-entry-reducer.test.ts` |

**Headline**: top 20 files account for 467 diagnostics (28% of baseline). Long tail: 575 files with ≤ 10 diagnostics each.

### 1c · Top 15 missing modules (TS2307 primary root causes)

| Count | Module | Classification |
|---|---|---|
| 114 | `@/lib/supabaseAdmin` | **sealed-separate legacy sibling-product** (NEX-native must NOT accidentally share this DB) |
| 30 | `@/lib/nexapp/tokens` | nexapp prototype scaffold path · dropped by fork extraction |
| 25 | `@/lib/nex-cap/nex1-engineer` | sibling product |
| 16 | `@/lib/nex-intelligence/provenance` | sibling product |
| 12 | `@/lib/nex-cap/registry` | sibling product |
| 9 | `@/lib/app-builder/blueprint-schema` | sibling product |
| 8 | `@/lib/crm/loadContactTimeline` | sibling product |
| 8 | `@/apps/materials/_schema/types` | sibling product |
| 6 | `@/apps/materials/_schema/memory_types` | sibling product |
| 5 | `@/lib/supabaseNexAdmin` | alternative name variant · legacy |
| 5 | `@/lib/openai/vision` | sibling product |
| 5 | `@/lib/nex-hq-agents/registry` | sibling product |
| 5 | `@/lib/nexapp/mockContacts` | nexapp prototype · dropped |
| 4 | `@/lib/products/read` | sibling product |
| 4 | `@/lib/nex-voice` | sibling product |

**Headline**: top 10 missing modules = 233 of the 379 TS2307 errors (61%). All trace to the 2026-10-10 nexapp fork extraction.

### 1d · Distribution shape

| Tree | Files w/ errors | Total diagnostics | Avg per file |
|---|---|---|---|
| `src/lib/nex/*` (NEX infra · heavy legacy residue) | 296 | 802 | 2.7 |
| `src/lib/nex-native/*` | ~80 | ~130 | 1.6 |
| `src/lib/nex-agent/*` + `nex-agent-runtime/*` | ~40 | ~190 | 4.8 |
| `src/app/*` | ~100 | ~250 | 2.5 |
| `src/components/*` | ~50 | ~130 | 2.6 |
| other (`tests/`, `scripts/`, etc.) | ~29 | ~163 | ~5.6 |

**Headline**: `src/lib/nex/*` tree contains **802 of 1,665 diagnostics (48%)**. This is the historical NEX infra tree that imports heavily from the dropped sibling-product paths.

---

## Phase 2 · Root-cause clustering

### 2a · Primary vs cascading classification

Primary = the compiler cannot resolve a type-level dependency.
Cascading = downstream errors caused when a primary failure leaves a variable typed `any` / `unknown` / `never`.

| Classification | Codes | Count | Share |
|---|---|---|---|
| **Primary · missing module** | TS2307 + TS2305 (missing exported member) + TS2304 (cannot find name) | 421 | 25.3% |
| **Cascading · downstream of failed imports** | TS7006 + TS2339 + TS2322 + TS2345 | 921 | 55.3% |
| **Nullability hygiene** | TS18046 + TS18047 + TS18048 | 54 | 3.2% |
| **Readonly / structural mismatches** | TS2540 + TS2741 + TS2353 + TS2739 + TS2740 + TS2561 + TS2724 + TS2459 + TS2416 | 143 | 8.6% |
| **Suspicious casts** | TS2352 | 26 | 1.6% |
| **Other long tail** | 20+ codes with ≤ 10 occurrences each | 100 | 6.0% |

**Headline**: fixing the ~421 primary failures would likely cascade-clear a large fraction of the 921 cascading errors (though not 1:1 · some cascading errors are genuine type issues independent of the import failure).

### 2b · Root-cause buckets

#### Bucket B1 · Sibling-product fork extraction (dominant · 233+ primary · ~800+ cascading)
Every top-10 missing module in §1c traces to the 2026-10-10 nexapp fork extraction (per `CLAUDE.md` nexapp §"Fork hygiene"). The nexapp fork intentionally dropped `trade-off`, `hammerex`, `xrated-trades`, `thenetworkers`, `van-wrap`, `apprenticeships`, `homeowners`, `trade-center` from the source monorepo. The code trees that imported from those products' libraries (e.g. `@/lib/supabaseAdmin` = legacy `thenetworkers`/`hammerex` admin client) are still present but no longer resolve their imports.

**Important doctrine clash to flag**: `src/lib/nex-native/supabase-admin.ts:11-14` reads verbatim:
> "It is DELIBERATELY SEPARATE from `src/lib/supabaseAdmin.ts` which targets the legacy thenetworkers/hammerev substrate. Every NEX-native service imports from THIS module; legacy code continues to use the other one. **This split guarantees that a NEX-native service cannot accidentally read from or write to the legacy DB.**"

**Implication for repair**: a naïve find-replace of `@/lib/supabaseAdmin` → `@/lib/nex-native/supabase-admin` would **violate this sealed doctrine** by silently crossing the DB boundary. The repair must preserve the architectural separation.

#### Bucket B2 · Dependency API drift (TS2305 "no exported member" · ~19 primary)
Clusters:
- `@simplewebauthn/server` + `@simplewebauthn/browser` · missing exports (`RegistrationResponseJSON`, `PublicKeyCredentialRequestOptionsJSON`, etc.). Likely version mismatch between `package.json` installed version and code-expected version.
- Internal renames · `./capability-conversation-context` has `ActiveSubject`/`ActiveTimeframe`/`LastRetrieval` imports that don't exist; `./session` has `SessionEntity` imports; `../registry` has `warmBusinessFromDatabase` import. These are not fork-extraction residue; they are internal module evolution where imports weren't updated.

#### Bucket B3 · Implicit `any` discipline (TS7006 · 313 occurrences · mostly cascading)
Many of these are cascading from Bucket B1. Independent cases exist (callbacks without annotated parameters). Not clean to fix without touching individual callers.

#### Bucket B4 · Nullability + readonly discipline (TS18047/48/46 + TS2540 · ~104 occurrences)
Mix of legitimate code-quality issues + cascading. Typically fix one file at a time.

#### Bucket B5 · Test-only errors
~50-80 diagnostics live in `*.test.ts` / `*.test.tsx` files. Lower priority (tests fail-closed in CI if the test suite can't compile, but production code is unaffected).

### 2c · Cascading-to-primary ratio (per candidate shim)

Measured per the saved baseline:

| Candidate shim | Primary errors cleared | Files affected | Total diagnostics in those files (cascading included) |
|---|---|---|---|
| `@/lib/supabaseAdmin` shim | 114 | 109 | **322** |
| `@/lib/nexapp/tokens` shim | 30 | ~25 | ~70 (estimated) |
| `@/lib/nex-cap/*` shims (2) | 37 | ~25 | ~110 (estimated) |
| `@/lib/nex-intelligence/*` shims | 16 | ~10 | ~50 (estimated) |

**Headline**: the `@/lib/supabaseAdmin` cluster is both the highest-count primary AND has the highest cascading multiplier (~2.8× · 322 total / 114 primary). It is the clear winner for R1.

### 2d · Files that would cleanly return to zero diagnostics

Verified by cross-indexing: three of the top-20 offenders (`src/lib/nex/centre-publishing/indexForSearch.ts`, `src/lib/nex/context.ts`, `src/lib/nex/bi/adapters/invoices.ts`) all import `@/lib/supabaseAdmin`. These three files contribute 72 of the 1,665 diagnostics. If their primary TS2307 clears + cascading drops, we expect them to reduce to a residual of likely < 15 total.

---

## Phase 3 · Smallest isolated repair batch · R1 proposal

### 3a · Proposed R1 scope

**Create a single file** · `src/lib/supabaseAdmin.ts` · implementing a **honest throw-at-use proxy** that satisfies the TypeScript compiler without allowing accidental runtime access to the legacy sibling-product DB.

### 3b · Why this and not a re-point

A straight-forward `@/lib/supabaseAdmin` → `@/lib/nex-native/supabase-admin` find-replace in 109 files WOULD VIOLATE the sealed doctrine at `src/lib/nex-native/supabase-admin.ts:11-14` (verbatim · "This split guarantees that a NEX-native service cannot accidentally read from or write to the legacy DB"). The 109 files are **legacy sibling-product code**, not NEX-native code. They were written to talk to the OLD thenetworkers/hammerex DB. If they ever execute against the NEX-native DB, data could land in the wrong place silently.

A throw-at-use proxy:
- **Satisfies TypeScript** (109 files typecheck without touching them)
- **Fails loudly if any of these legacy paths are ever executed at runtime** (descriptive error, no silent cross-DB write)
- **Signals intent** · future readers see "legacy module · not wired · will throw if reached"
- **Reversible** · deleting the file reinstates the broken-import state exactly

### 3c · Proposed file contents (for review · not written)

```typescript
// src/lib/supabaseAdmin.ts
//
// LEGACY MODULE · HONEST THROW-AT-USE PROXY · 2026-10-27.
// -----------------------------------------------------------
// The 109 files under src/lib/nex/* that import { supabaseAdmin } from
// '@/lib/supabaseAdmin' were authored for the pre-fork-extraction
// thenetworkers/hammerev multi-product monorepo. The nexapp fork
// extraction (2026-10-10) dropped the real supabaseAdmin.ts file but
// did not delete the 109 callers.
//
// This proxy exists to satisfy TypeScript (so unrelated work can
// typecheck against a cleaner baseline) WITHOUT re-pointing those
// callers to the NEX-native Supabase client. Per the sealed doctrine
// in src/lib/nex-native/supabase-admin.ts (lines 11-14), NEX-native
// services must NEVER share a client with the legacy substrate.
//
// Any accidental execution of a legacy caller surfaces as a descriptive
// runtime throw rather than a silent cross-DB write. Loud failure is
// the correct outcome: it tells us a dead code path is still being
// invoked, and preserves data integrity.
//
// Status · researched · not implemented · founder review required.
// Doctrine anchor · to be authored if founder approves.

import type { SupabaseClient } from "@supabase/supabase-js";

const LEGACY_SUPABASE_ADMIN_MESSAGE =
  "src/lib/supabaseAdmin · legacy sibling-product module (pre-fork). " +
  "This path was dropped by the 2026-10-10 nexapp fork extraction and " +
  "must NOT silently fall through to the NEX-native Supabase client " +
  "(see src/lib/nex-native/supabase-admin.ts lines 11-14 sealed doctrine). " +
  "If you reached this error at runtime, a legacy caller under src/lib/nex/* " +
  "needs to be either (a) migrated to an explicit nex-native service with " +
  "an auditable DB boundary, or (b) deleted if the code path is dead.";

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get() {
    throw new Error(LEGACY_SUPABASE_ADMIN_MESSAGE);
  },
  apply() {
    throw new Error(LEGACY_SUPABASE_ADMIN_MESSAGE);
  },
}) as SupabaseClient;
```

### 3d · Expected delta (quantified from baseline)

| Measurement | Before (HEAD `9c41575`) | After R1 (predicted) |
|---|---|---|
| Distinct diagnostics | 1,665 | **≈ 1,343** (−19%) |
| TS2307 errors | 379 | ≈ 265 (−114) |
| TS2305 errors (new TS2305 from unexpected shim exports) | 19 | 19 (zero new · all 109 imports use `{ supabaseAdmin }` matching the shim's export) |
| Files with any error | 595 | ≈ 525 (−70, estimated) |
| Files cleanly reduced to zero errors | n/a | 60-80 (estimated · those that have NO other error source) |

**Measurement procedure** (reproducible after R1 lands):
1. Save new baseline: `npx tsc --noEmit 2>&1 > /tmp/tsc-after-r1.log`
2. Count distinct diagnostics: `grep -oE "^[^(]+\([0-9]+,[0-9]+\): error TS[0-9]+" /tmp/tsc-after-r1.log | sort -u | wc -l`
3. Compare to baseline count 1,665.
4. Expected: 1,310–1,370 range.

### 3e · Risk assessment

| Risk | Severity | Mitigation |
|---|---|---|
| New file hides architectural debt | **medium** | Explicit comment in file header + descriptive runtime throw + "status: researched · not implemented" marker in doctrine. Future architect sees intent, not quiet cleanup. |
| TypeScript assumes imported `supabaseAdmin` has the real SupabaseClient API; downstream code typechecks against this fiction | **low** | The 109 files were already using `SupabaseClient` methods. Our shim is typed as `SupabaseClient`. Behaviour unchanged at type layer. |
| Legacy code path ever executed in production | **unknown · not measured** | Proxy throws descriptive error. If a route transitively imports one of these 109 files, that route surfaces the error loudly on first use rather than silently cross-writing. |
| Any of 109 files is actually REACHED by current production code | **low but not zero** | A separate audit (not R1) would trace reachability from `/nex-native/*` routes. Current session has NOT done this. |
| R1 creates implicit permission to leave 109 legacy files indefinitely | **medium** | Doctrine note should explicitly scope R1 as "typecheck hygiene · does not endorse the 109 legacy files · future work must either migrate or delete them". |

### 3f · Rollback plan

Delete the new file `src/lib/supabaseAdmin.ts`. Baseline returns to current state (1,665 diagnostics). No other changes.

### 3g · What R1 is NOT

- Does NOT touch any of the 109 legacy caller files.
- Does NOT migrate any legacy code to NEX-native.
- Does NOT re-point any import.
- Does NOT change runtime behaviour of any currently-executing code path.
- Does NOT delete any file.
- Does NOT weaken any sealed doctrine.
- Does NOT change RLS, schema, storage, production env, or payment infrastructure.
- Does NOT fix the ~1,343 remaining diagnostics (candidates for R2-R4).

### 3h · Next-batch candidates (R2-R4 · not proposed in detail yet)

| Batch | Candidate | Expected delta | Why not R1 |
|---|---|---|---|
| R2 | `@/lib/nexapp/tokens` shim | ~70 diagnostics | Smaller cluster · same shim pattern; natural follow-on after R1 proves the pattern |
| R3 | `@/lib/nex-cap/*` and `@/lib/nex-intelligence/*` type-only `.d.ts` shims | ~160 diagnostics | Multiple modules · needs per-module decision whether to shim or delete; more judgement calls |
| R4 | `@simplewebauthn/*` version mismatch · requires `package.json` bump or alternative-export adaptation | ~5 diagnostics | Smallest count but requires a dependency decision |

**No R2-R4 proposal in this triage.** Each would need its own founder-reviewed scope.

---

## Phase 4 · Honest limitations

- The predicted "60-80 files cleanly reduced to zero errors" assumes the TS cascading model behaves as it typically does when a module import failure is resolved. The actual number can only be verified by applying R1 and re-running tsc.
- Did NOT verify whether any of the 109 legacy caller files is reachable from a current NEX-native production route. If any is reachable, R1 would surface a runtime throw where silent broken behaviour exists today (improvement, but worth being aware of).
- Did NOT measure the cascading-to-primary ratios for buckets B2, B3, B4, B5 beyond the top candidate.
- Did NOT investigate the top-20 offenders that are NOT in the supabaseAdmin cluster (e.g. `capability-meaning-construction.ts` with 46 diagnostics may need its own analysis; it is nex-agent-runtime territory, likely sibling-product residue too).
- All counts measured against baseline at HEAD `9c41575`. Any subsequent commit changes the baseline.

---

## Classification per Protocol §6

- `discovered` · the 46 error codes + 595 files + 15 missing-module clusters.
- `researched` · the primary vs cascading classification + the supabaseAdmin doctrine clash + the proposed R1 scope.
- `proposed` · R1 shim scope + expected delta + risk assessment.
- NOT `approved`, NOT `implemented`, NOT `tested`, NOT `committed`, NOT `pushed`.

## What this triage does NOT do

- Does NOT change any code.
- Does NOT create any file.
- Does NOT propose a repair beyond R1.
- Does NOT re-measure the baseline (uses saved `/tmp/tsc-baseline-37acc10.log`).
- Does NOT grant implementation authority.
- Does NOT touch any founder-created UI.
- Does NOT edit any sealed doctrine.

## Founder decision requested

**D15** · Approve or reject R1 as proposed:
- **Approve R1** → I write the single file at `src/lib/supabaseAdmin.ts` as specified in §3c, run full typecheck to measure actual delta vs predicted, add a short doctrine note formalising the "legacy throw-shim" pattern, isolated commit, request push approval. No other changes in the batch.
- **Approve R1 with modifications** → tell me what to change in §3c (shim style · error message · scope) and I iterate the proposal before implementing.
- **Reject R1 and request a different candidate** → I write a new triage for a different root cause (e.g. `@/lib/nexapp/tokens`, or a nex-agent-runtime-specific cluster).
- **Reject R1 and request deeper audit first** → I perform a reachability audit on the 109 legacy caller files before any shim lands (would need separate authorisation per the "small, isolated" discipline).
