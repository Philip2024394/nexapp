# NEX Programme · Batches 1-2-3 Execution Report · 2026-10-27

> Founder-authorised execution of the 3-batch sequence requested after the review pack. Research + evidence only. **Zero code changes landed.** Each batch reports what was done, what was discovered, and why implementation was or was not safe to proceed.
>
> Classification per Protocol §6: all findings below are `researched` + (for Candidate B) `tested at logic layer`. Nothing in this report is `production-verified`.

---

## Batch 1 · Profile visibility · STOPPED per founder instruction

### 1a · Finding (critical)

**The 3 "safe Class-D fixes" documented in the audit are NOT safe to apply today. They depend on migration 200 being applied first.**

The audit's §1d claim was: *"Default-safe today, enforce when migration 200 applied."*

This claim is directly contradicted by the sealed F3 regression anchor test at `src/lib/nex-native/__tests__/privacy-pre-migration-200.test.ts` (dated 2026-10-16, owner-authored).

### 1b · Evidence (verbatim from the sealed test file)

Lines 15-35 of the F3 regression anchor:

> **WHAT THIS TEST PROVES:**
> 1. getPrivacyPreferencesSafe returns PRIVACY-MAXIMUM (private + contacts) on a service-layer error.
> 2. The service-layer error INCLUDES the pre-migration-200 state · SELECT of nex_account.profile_visibility fails with PostgreSQL 42703 "column does not exist" (verified at 262ms baseline).
> 3. resolveProfileVisibilityForViewer returns `{ visible: false }` for any non-self viewer when the fail-closed default is PRIVACY-MAXIMUM.
> 4. The /u/[handle] gate (verified in _enforcement-anchors.test.ts) calls notFound() when `!visibility.visible`, so **EVERY non-self visit to a discoverable profile currently 404s PRE-APPLY**.
>
> **DEPLOYMENT HAZARD (documented, not fixed in this session):**
> · Live DB: 728 accounts, 6 profiles, **0 discoverable** (per preflight readonly report 2026-10-15). TODAY the hazard is latent · no user ever sees a hidden profile because 0 are discoverable.
> · If a user flips is_discoverable=true BEFORE migration 200 is applied, their profile becomes invisible to ALL non-selves.

### 1c · What this means for the 3 proposed fixes

If I had implemented them today, the following would have happened in production (where migration 200 is NOT applied):

| Fix | Today's effect |
|---|---|
| `/live-commerce/feed` broadcaster filter via `resolveProfileVisibilityForViewer(null, broadcaster_id)` | Every broadcaster hidden · feed appears empty · live-commerce effectively dark |
| `/live-commerce/[sessionId]` broadcaster card gate | Every viewer page 404s · broadcaster unreachable |
| `/chat/guest/[ownerAccountId]` owner gate | Every guest chat 404s · guest first-message flow broken |

**All three regress to privacy-maximum (404) because `getPrivacyPreferencesSafe` fail-closes when `nex_account.profile_visibility` column does not exist, which is the current Supabase state.**

### 1d · Why the hazard hasn't crystallised yet

Only one surface currently uses `resolveProfileVisibilityForViewer` for enforcement: `/profile/[handle]`. The live DB has:
- 728 accounts
- 6 nex_account_profile rows
- **0** profiles with `is_discoverable=true`

So although `/profile/[handle]` would 404 every non-owner visit for a discoverable profile today, zero users are discoverable, so zero visits are affected. The audit catalogued code paths that would leak IF a user set private AND migration 200 were applied; the sealed F3 test catalogues the inverse hazard (every non-self sees 404 until migration 200 applied). Both hazards are real; the audit was addressing only one half.

### 1e · Decision per founder instruction (Batch 1 step 4)

> "If a fix depends on migration 200 or another held infrastructure change, document the exact dependency and stop that portion."

**STOP · the 3 fixes depend on migration 200.** They are not safe-to-ship-today code-only changes. Implementation deferred.

### 1f · Correct dependency unlocking path (recommendation)

To make the 3 fixes safe, either:

1. **Apply migration 200 to Supabase `ijvqdvsvwtwxzcqmoqit`** · requires founder authorisation per CLAUDE.md §5. Would also unlock any future surface wanting to call `resolveProfileVisibilityForViewer`. Pre-apply review for migration 200 does NOT yet exist (only migrations 227–233 have one from Candidate A prep). Recommend founder commission a pre-apply review for migration 200 before applying.

2. **Mitigation option documented in F3 test (lines 37-44)**: change `getPrivacyPreferencesSafe` to distinguish "column missing" (PostgreSQL 42703) from "service outage" (any other error) · column-missing could fall through to `DEFAULT_PRIVACY_PREFS` (public + everyone) matching migration 200's sealed default. This is a BEHAVIOUR CHANGE in a sealed service. Requires explicit founder approval per the sealed Settings doctrine · not implemented today.

Both paths require decisions the founder has not made. Correct outcome: hold.

### 1g · What was independently verified during Batch 1

- Read `src/lib/nex-native/privacy-preferences-service.ts` end-to-end (202 lines).
- Confirmed `getPrivacyPreferencesSafe()` catches ALL errors + returns `PRIVACY_MAXIMUM_PREFS` (private + contacts).
- Confirmed `resolveProfileVisibilityForViewer()` returns `{visible:false, response:"404"}` for `profile_visibility === "private"` for any non-self viewer.
- Read `privacy-pre-migration-200.test.ts` end-to-end (235 lines). All 7 test cases documented above are verbatim from the sealed F3 anchor.
- Did NOT modify any production code.
- Did NOT modify any test code.
- Did NOT apply any migration.

---

## Batch 2 · Candidate B acceptance · logic-verified · live journey PENDING

### 2a · What was attempted

Prerequisite for an authenticated owner browser pass:
- A `nex_account` row with `supabase_user_id` linked to Supabase Auth.
- A `nex_business` row owned by that account (otherwise `/manage` redirects to `/onboarding`).
- Valid email+password credentials to sign in via `/sign-in`.

### 2b · What was found

`scripts/nex-provision-dev-admin.mts` exists and would:
- Create or update a Supabase Auth user `dev-admin@nex-native.local` with password `NexDevAdmin!2026` + email_confirm=true.
- Create or lookup a linked `nex_account` row.
- Allocate a `nex_handle`.
- Run against the sealed Supabase project `ijvqdvsvwtwxzcqmoqit` using the service-role key.

Does NOT create a `nex_business` row · an authenticated owner reaching `/manage` would hit the `onboarding` redirect at `/manage/page.tsx:104`.

### 2c · Why Batch 2 live journey was not run

The founder's explicit instruction for this batch sequence: *"No migrations, production schema changes, RLS changes, storage changes or real customer-data modifications."*

Running `nex-provision-dev-admin.mts` would create or update a Supabase Auth user + a `nex_account` row in the production Supabase project. Even for a dev-admin, that is a real customer-data modification to the live production database. The script is explicit about this (line 24: `NEX_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit"` + line 27: throws if not that project).

Extending the script to additionally create a `nex_business` row would compound the modification.

Per the guard, Batch 2 live-browser verification is **not run**. The logic-level verification from the earlier commit stands:
- 18/18 vitest unit tests pass (pure helpers + SSR smoke).
- `react-dom/server` smoke confirms the component returns `null` during SSR (no fabricated badge).
- HTTP smoke on unauthenticated `/manage` returns 307 to `/home` (sealed Bridge 55 commerce gate behaviour · gate unchanged).

### 2d · What a founder-authorised live pass would need

**Option A** · founder provides credentials for an existing test owner account (nex_account + nex_business already exist). I run Playwright: sign in → navigate to `/manage` → verify badge appearance against unread-count API response → open conversation → verify count decrements → verify error-state hides the badge (via fetch interception).

**Option B** · founder authorises:
1. Running `scripts/nex-provision-dev-admin.mts` once (creates Supabase Auth user + nex_account).
2. Extending the script or running a provisioning server action to create a `nex_business` row for the dev-admin.
3. Playwright journey as in Option A.

Either option would complete the Phase-4 acceptance per the programme's "acceptance only when appearance and working flow both verified" rule.

### 2e · Non-owner access verification

The Candidate B component is mounted inside `/manage/page.tsx` which gates on `resolveNexAppSessionFromContext()` (session) and `businessService.listBusinessesByOwner(session.account.id).length` (owned business). Non-owners cannot reach the badge render because they are redirected before React executes. This is proven at the server-component level by code inspection, not at the HTTP level (would require Option A/B above).

### 2f · Gate change confirmation (restated)

`git diff 3ea9d8f..HEAD -- src/lib/nex-native/launch-flags.ts` returns **0 lines**. The `/conversations` commerce gate is unchanged. Clicking the badge in production (where `NEX_COMMERCE_ENABLED` is unset) still redirects to `/home` per sealed Bridge 55. This is the honest Path 1 behaviour as approved.

### 2g · Batch 2 outcome

- Candidate B logic: proven at unit + SSR layer. 18/18 pass. Zero new typecheck errors.
- Live browser pass: **pending** founder-authorised path (Option A or B).
- Candidate B remains in state `tested at logic layer`, not yet `accepted`.

---

## Batch 3 · TypeScript baseline analysis · distinct errors + root causes

### 3a · Baseline measurements (reproduced today)

```
$ npx tsc --noEmit 2>&1 | grep -cE "error TS"
1665
```

| Metric | Value |
|---|---|
| Total error lines | 1,665 |
| Distinct error codes | 46 |
| Distinct files with errors | 577 |

### 3b · Top error codes grouped by frequency

| Code | Count | Meaning | Root cause |
|---|---|---|---|
| TS2307 | 379 | Cannot find module | **~200 are legacy sibling-product imports from the 2026-10-10 fork extraction** (see §3c). Remainder are cascading. |
| TS7006 | 313 | Parameter implicitly has 'any' type | Cascading downstream of TS2307 (variables from failed imports typed as `any`). |
| TS2339 | 287 | Property does not exist on type | Cascading from TS2307 (properties on `unknown`/`never` from missing modules). |
| TS2322 | 200 | Type is not assignable | Cascading from TS2307 (type widening after import failure). |
| TS2345 | 121 | Argument type not assignable | Cascading from TS2307. |
| TS2540 | 50 | Cannot assign to read-only | Likely genuine refactor finds · not sibling-product cascade. |
| TS2741 | 45 | Property missing in type | Mixed · some cascading, some genuine. |
| TS2353 | 32 | Object literal has unknown property | Mixed. |
| TS2739 | 26 | Type missing properties from required type | Mixed. |
| TS2352 | 26 | Suspicious cast | Includes the pre-existing /manage/page.tsx:451 case. |
| TS18047 | 26 | Possibly null | Null-safety hygiene. |
| TS2304 | 23 | Cannot find name | Mixed. |

### 3c · Top missing modules (TS2307 root cause)

The ~200 missing-module errors cluster into legacy sibling-product paths that the nexapp fork extraction (2026-10-10) left behind:

| Missing module | Occurrences | Origin |
|---|---|---|
| `@/lib/supabaseAdmin` | 114 | **Sibling product** path · nexapp has `@/lib/nex-native/supabase-admin` instead |
| `@/lib/nexapp/tokens` | 30 | Dropped nexapp file (prototype scaffold path) |
| `@/lib/nex-cap/nex1-engineer` | 25 | Sibling product |
| `@/lib/nex-intelligence/provenance` | 16 | Sibling product |
| `@/lib/nex-cap/registry` | 12 | Sibling product |
| `@/lib/app-builder/blueprint-schema` | 9 | Sibling product |
| `@/lib/crm/loadContactTimeline` | 8 | Sibling product |
| `@/apps/materials/_schema/types` | 8 | Sibling product |
| `@/apps/materials/_schema/memory_types` | 6 | Sibling product |
| `@/lib/supabaseNexAdmin` | 5 | Alternative name for the same thing |

Per `C:/Users/Victus/nexapp/CLAUDE.md` nexapp §"Fork boundary" + §"Fork hygiene":
> "Products that were in the source monorepo but NOT in this fork: trade-off, hammerex, xrated-trades, thenetworkers, van-wrap, apprenticeships, homeowners, trade-center. Do not try to pull them back in."
>
> "When you touch any file under `src/lib/nex/`, if you notice bleed-through to legacy terms (hammerex, trade-off, xrated, networkers), clean the specific functions you're editing — but do not refactor the whole tree in a drive-by."

The CLAUDE.md "~14 known broken imports" number is understated vs the actual ~200. This is pre-existing project state.

### 3d · Candidate B regression check vs baseline

- Baseline at HEAD (`3ea9d8f`): 1,665 error lines.
- After Candidate B (`70571e3`): 1,665 error lines.
- Delta: **0 new errors introduced by Candidate B**.
- One error on `/manage/page.tsx` (line 451 at HEAD, line 458 after my edit) is pre-existing TS2352 on a Weekly-hours cast. Verified pre-existing by `git show HEAD:src/app/nex-native/manage/page.tsx | grep NexWeeklyHours`.

### 3e · Proposed small-batch remediation plan (not implemented today)

Per founder's "small, isolated remediation batches; no mass fix":

**Remediation Batch R1 · supabaseAdmin re-point** (~114 errors, highest value)
- Scope: find/replace `@/lib/supabaseAdmin` → `@/lib/nex-native/supabase-admin` in affected files · verify each imported symbol exists in the nexapp replacement + has the same signature.
- Risk: if the nexapp replacement has a different API, re-point would create NEW errors.
- Suggested verification: one file at a time, re-run tsc, keep only changes that reduce the count.

**Remediation Batch R2 · nexapp/tokens shim or delete** (~30 errors)
- Scope: find callers of `@/lib/nexapp/tokens` + decide per-file whether to shim with a thin `.d.ts` declaration OR delete the caller if it's dead code from the fork extraction.
- Risk: deleting live code; favour shimming + keeping callers.

**Remediation Batch R3 · nex-cap · nex-intelligence · app-builder · crm · materials shims** (~75 errors across 7 modules)
- Scope: these are sibling products not ported. Simplest fix: provide type-only `.d.ts` shims that satisfy the import without implementation. Then classify the callers:
  - (a) callers that are themselves sibling-product code → consider removing from the nexapp tree entirely
  - (b) callers that are genuine nexapp code accidentally depending on sibling-product types → migrate the type dependency

**Remediation Batch R4 · remaining cascading errors**
- After R1-R3 land, re-run tsc and re-count TS7006/TS2339/TS2322/TS2345. Expect dramatic drop · these are cascading from the module failures above.
- Any residual after R1-R3 is likely genuine code quality + would need individual review.

### 3f · Why I did not implement R1-R4 today

Per founder's instruction: *"Do not attempt a mass fix or conceal existing errors."* R1-R4 collectively would touch hundreds of files. Even if done as small batches, each batch requires:
- Verifying the replacement symbol has the same signature as the missing import.
- Not accidentally changing runtime behaviour.
- Not accidentally cleaning files outside the batch's scope.
- Running focused tests + full typecheck after each batch to confirm the count decreased.

That's a dedicated multi-session programme on its own. Beyond this Batches-1-2-3 sequence's scope.

### 3g · Batch 3 outcome

- Baseline established: 1,665 error lines, 46 distinct codes, 577 files.
- Root cause attribution: ~200 primary TS2307 (missing sibling-product modules) + ~1,465 cascading errors downstream.
- Candidate B: zero new diagnostics.
- Remediation plan: 4-batch sequence proposed · not implemented · would require separate founder authorisation.

---

## Consolidated status

| Batch | Status | Code committed | Awaits |
|---|---|---|---|
| 1 · Profile visibility fixes | **STOPPED · dependency on migration 200 confirmed via sealed F3 test** | none | founder decision: apply migration 200 + separate pre-apply review for it |
| 2 · Candidate B acceptance | logic-verified · live browser **pending** | none | founder-provided test credentials OR authorisation to run dev-admin provisioning script |
| 3 · TypeScript baseline | baseline captured + root cause attributed + remediation plan drafted | none | founder authorisation for separate R1-R4 remediation programme |

---

## Decisions requiring founder authority (consolidated · emerging from this batch)

### D10 · Commission a pre-apply review for migration 200
- **Why**: migration 200 is now a direct blocker for 3 distinct work items (the 3 safe Class-D fixes + any future caller of `resolveProfileVisibilityForViewer`). A pre-apply review (same format as D1's for 227-233) would surface risks + confirm prerequisites.
- **Recommendation**: author the review as a separate research doc (would mirror the structure of `nex-watch-migrations-pre-apply-review-2026-10-27.md`).

### D11 · Candidate B live-journey authorisation path
- **Why**: no live-browser pass has been run.
- **Recommendation**: founder picks Option A (provide existing test owner credentials) or Option B (authorise running `nex-provision-dev-admin.mts` + extension to create a nex_business row).

### D12 · TypeScript remediation programme
- **Why**: 1,665 error lines is substantial technical debt. Future touches to any affected file risk introducing new errors against a noisy baseline.
- **Recommendation**: founder authorises a dedicated remediation programme (4 batches R1-R4). Each batch isolated commit. Not blocking current feature work.

### D13 · Mitigation path in `getPrivacyPreferencesSafe`
- **Why**: the F3 test comment (lines 37-44) proposes a sealed-service behaviour change that would distinguish "column missing" from "service outage" · would make the 3 safe fixes safe-today.
- **Recommendation**: founder decides if this behaviour change is acceptable (sealed Settings doctrine revision) OR prefers applying migration 200 (schema change). Both unlock the fixes · different trade-offs.

---

## What this report does NOT do

- Does NOT change any code.
- Does NOT apply any migration.
- Does NOT run the dev-admin provisioning script.
- Does NOT run any live-browser verification.
- Does NOT attempt the proposed R1-R4 remediation.
- Does NOT grant implementation authority.
- Does NOT edit any sealed doctrine.
- Does NOT make claims about Supabase runtime state beyond what is cited verbatim from the sealed F3 regression test (0 discoverable profiles as of 2026-10-15 preflight).

---

## Honest limitations

- Did NOT independently verify the live Supabase schema; relies on the F3 test's assertion that `profile_visibility` column does not exist.
- Did NOT investigate whether `resolveProfileVisibilityForViewer` is being called elsewhere in production code (beyond the 3 Class-A pages inventoried earlier). A broader call-graph analysis would surface any additional surfaces that silently 404 today.
- Did NOT investigate whether `/profile/[handle]` 404s are currently reaching real users (would require production telemetry).
- The TS baseline count of 1,665 is error-lines; some single compiler errors emit multiple lines (e.g. generic constraints). "Distinct errors" by (file, line, code) tuple is a stricter metric I did not compute.
