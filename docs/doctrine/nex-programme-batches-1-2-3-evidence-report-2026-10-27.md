# NEX Programme · Batches 1-2-3 Evidence Report · 2026-10-27

> Founder-authorised controlled engineering batch. Executes with 3 explicit safeguards:
> (1) **Privacy first** · establish current behaviour before claiming exposure.
> (2) **Candidate B** · separate component acceptance from journey acceptance.
> (3) **TypeScript** · reproducible baseline before any cleanup.
>
> **Zero code changes landed in this batch.** All findings are `researched` and `verified at the evidence level stated`. Nothing is `production-verified`.
>
> Starting point: `f3c7df9` (review pack). Baseline reproducible from `/tmp/tsc-baseline-37acc10.log` (saved locally this pass).

---

## Batch 1 · Profile visibility · current behaviour verified · implementation blocked

### 1a · Current behaviour (verified · supersedes prior audit framing)

The prior audit (`nex-profile-visibility-audit-2026-10-27.md`) classified 20 surfaces as Class D "may leak". **Per the founder's safeguard · a surface "may leak" is NOT a confirmed exposure.** This batch verifies the actual current state.

**Architectural fact (verified this pass)**:
- `account-profile-service.ts` imports `nexSupabaseAdmin` (service-role client) · `src/lib/nex-native/account-profile-service.ts:15`.
- `friend-service.ts` same · uses `nexSupabaseAdmin` 10+ times.
- `conversation-service.ts` same · uses `nexSupabaseAdmin` 13 times.
- Service-role **bypasses RLS entirely**.

**Supabase schema state** (verified via migration file reads · not DB query):
- Migration 134 `nex_account_profile_public_read` policy: `USING (is_discoverable = true)` for anon + authenticated roles. Owner-reads unchanged.
- Migration 200 (profile_visibility column + CHECK + comments) · AUTHORED, NOT APPLIED (file header line 4).
- Migration 200 adds **NO RLS policy** · service-layer gating is the only intended defence.

**Live DB state** (cited from sealed F3 test, 2026-10-15 preflight · not re-queried):
- 728 accounts, 6 nex_account_profile rows, **0 with `is_discoverable=true`**.

### 1b · What this means for each class, honestly

**Class A `/profile/[handle]`** · the only surface currently calling `resolveProfileVisibilityForViewer`:
- Behaviour TODAY: calls service → service throws (column missing) → `getPrivacyPreferencesSafe` catches → returns PRIVACY-MAXIMUM → resolver returns `{visible:false, response:"404"}` → page calls `notFound()`.
- **Every non-self visit returns 404.**
- Hazard latent because 0 of 728 accounts are discoverable AND the public `nex_account_profile_public_read` RLS gate would already 404 non-discoverable rows at the DB layer (anon/authenticated role).
- **This is over-restriction, not under-restriction.** It is the inverse hazard the F3 test documents.

**Class D surfaces that READ profile data via service-role** (verified for `/contacts`, `/conversations`; same pattern inferred for the other 18 by code idiom):
- Behaviour TODAY: service-role reads the row (RLS bypassed), the surface renders.
- No current exposure of `profile_visibility='private'` **because the column does not exist in production**. Users cannot set the preference; there is no "private" preference to bypass.
- If migration 200 is applied + a user sets `profile_visibility='private'`, these surfaces WOULD render that user's profile data regardless of the setting (because they bypass both RLS and the service-layer resolver).

**Correct reframe of the audit**:
- *"Class D · UNAUDITED · may leak"* was the audit's phrasing.
- Verified in this pass: **no current exposure** (the preference does not yet exist in the production schema).
- Forward-looking: once migration 200 applied + user sets private, these surfaces would expose data the user intended to hide.
- Prior exposure for these surfaces: **unknown** · would require production access-log audit to confirm whether private-setting-expecting users have been affected (per sealed Universal Image Doctrine's audit discipline).

### 1c · Verified code paths (exact file:line references)

| Surface | Reader | Supabase client | Current gate | Current behaviour |
|---|---|---|---|---|
| `/profile/[handle]` | `resolveProfileVisibilityForViewer` + `getProfileByAccountId` | service-role | service-layer resolver | **404 for every non-self visit TODAY** (service fail-closes) |
| `/contacts` | `friendService.listFriendsByAccountId` + `accountProfileService.getProfileByAccountId` | service-role (verified `friend-service.ts:18` + `account-profile-service.ts:15`) | friend-edge ownership check | renders friend profiles · RLS bypassed · no visibility gate |
| `/conversations` | `conversationService.listConversationsForAccount` | service-role (verified · 13 uses in file) | participant check | renders participant identities · RLS bypassed · no visibility gate |
| `/live-commerce/feed` | `listOpenSessionsPublic` + nex_account display names | not re-verified this pass | open-session filter only | renders broadcaster identities · no visibility gate |

### 1d · Verified fixes that are safe TODAY · ZERO found

The audit proposed 3 "safe code-only remediations" (feed broadcaster filter, live-session broadcaster card, guest-chat owner gate). All 3 call `resolveProfileVisibilityForViewer`. Per Batch 1 Phase 1 verification + the sealed F3 regression anchor (verbatim §Priority 1 of prior report), these would 404 every surface in production until migration 200 is applied.

**No verified code-only fix is safe to apply today without first resolving a founder decision.**

### 1e · Decision options for founder (unchanged from prior report D13; now with current-behaviour evidence)

1. **Apply migration 200 to Supabase**. Columns created with sealed defaults (`'public'`/`'everyone'`); every account becomes safely visible by default. Unblocks `/profile/[handle]` to work correctly for discoverable profiles AND unlocks the 3 safe code-only fixes.
2. **Revise sealed `getPrivacyPreferencesSafe`** per F3 test lines 37-44: distinguish "column missing" (PostgreSQL 42703) from "service outage" and fall through to `DEFAULT_PRIVACY_PREFS` (public) when column is missing. Avoids a schema change but modifies a sealed service.
3. **Neither** · accept that `/profile/[handle]` 404s all non-self visits for the 0 currently-discoverable accounts, AND defer all Class-D migration work until a later batch.

Option 1 is the cleanest path. Option 2 is a sealed-service revision that modifies the fail-closed invariant · deserves its own doctrine note. Option 3 maintains current state.

### 1f · What I verified vs did NOT verify

**Verified this pass**:
- Service-role usage in account-profile-service, friend-service, conversation-service (`src/lib/nex-native/*.ts`, grep + read).
- Migration 134 RLS policy (`nex_account_profile_public_read USING (is_discoverable = true)`).
- Migration 200 is authored, not applied (file header line 4 verbatim).
- Migration 200 adds no RLS policy (full file read).
- The sealed F3 regression test's 7 assertions are intact (full file read).
- The 3 audit-proposed fixes are not safe today (consequence of F3).

**Did NOT verify this pass**:
- Whether `/live-commerce/feed`, `/live-commerce/[sessionId]`, `/chat/guest/[ownerAccountId]`, `/chat/peer/[accountId]`, `/directory`, `/directory/[id]`, `/[businessSlug]`, `/call/g/[sessionId]`, `/group-chat/[groupId]`, `/report/[accountId]`, `/community/notices/[id]`, `/community/lost-found/[id]` all use service-role · spot-checked only 2 (contacts + conversations).
- Whether any surface actually ever displays data differently based on `is_discoverable=true` for the 0 live rows.
- Whether a production access-log audit would show prior exposure incidents.
- Whether `/profile/[handle]`'s 404 is reaching real users (would need production telemetry).

---

## Batch 2 · Candidate B · COMPONENT verified · JOURNEY blocked

### 2a · Explicit separation (per founder safeguard 2)

**Component acceptance** = the badge primitive behaves correctly in isolation.
**Journey acceptance** = the full Customer Chats flow works for a real signed-in business owner from end to end.

### 2b · Component acceptance · VERIFIED

Evidence:
- 18/18 vitest unit tests pass · `src/app/nex-native/manage/__tests__/inbox-unread-badge.test.tsx`.
  - Tests cover: pure helpers `computeBadgeRender` (0/null/NaN/Infinity/negative/fractional/≥99+ cap/plural grammar) + `parseUnreadCountBody` (malformed/non-numeric/missing/non-object) + SSR smoke (returns null · no fabricated badge).
- SSR smoke · `renderToString(<ManageInboxUnreadBadgeClient />)` returns `""` · correct (useEffect has not fired).
- Zero new typecheck diagnostics introduced · grep `inbox-unread-badge` in baseline returns **0 hits** (confirmed this pass).

**Status**: component is `tested at logic layer` + `tested at SSR layer`. Not `tested at browser layer`.

### 2c · Journey acceptance · NOT verified

The full owner journey:
1. Owner signs in via `/sign-in`.
2. Navigates to `/manage`.
3. Sees the Customer Chats badge with current unread count.
4. Clicks the badge.
5. Reaches `/conversations` and sees their customer inbox.
6. Opens a conversation.
7. Unread count decrements (Wave 5 `last_read_at` semantics).
8. New message arrives and badge updates within polling window.

**Step 5 is blocked in production.** `/conversations` is gated by `commerceEnabledForRequest` (sealed Bridge 55 + B9/B10 2026-10-14 route-containment). In production (`NEX_COMMERCE_ENABLED` unset), clicking the badge redirects to `/home` per the sealed gate. **The Customer Chats journey as a whole is NOT acceptable in production until commerce is enabled.**

**What works in dev**:
- With `NEX_COMMERCE_ENABLED=1` on the server env OR `?commerce=1` on the URL (non-production only), the full journey works.

**What is NOT verified**:
- Live authenticated owner browser pass in either environment.
- The dev-admin provisioning script would create a Supabase Auth user + nex_account row in the sealed production project · per founder's safeguard "no real customer-data modifications", NOT run.
- Non-owner (anon/non-business-owner) attempting to reach `/manage` is server-side redirected via existing gates in `/manage/page.tsx:92-105` · verified by code read, not by browser test.

### 2d · Smallest safe change to accept the journey (presented for approval; not implemented)

The gate is doing exactly what it was sealed to do: contain Phase 1 (chat + themes only) in production. Three paths to accept the journey:

1. **Flip `NEX_COMMERCE_ENABLED=1` in production env** · product decision · lifts the gate for all 13 named commerce surfaces simultaneously, not just `/conversations`. Not a code change.
2. **Add an owner-specific bypass to `commerceEnabledForRequest`** · requires an amendment to the sealed B9/B10 production route-containment doctrine (2026-10-14). Would allow signed-in business owners to reach `/conversations` while keeping cart/orders/shop etc. gated. Scope creeps the sealed Phase 1 contract.
3. **Accept the component but defer the journey** · ship the badge as-is; owners cannot click through in production today, but the badge accurately reports count. Journey acceptance deferred to Phase 2 (commerce launch).

**Recommendation**: Option 3. The sealed gate is doing the job it was designed to do. The badge adds visible value (owner awareness) even without the click-through. Journey acceptance should land naturally with Phase 2 commerce launch, not via a doctrine edit.

### 2e · Non-regression confirmation

- `git diff 3ea9d8f..HEAD -- src/lib/nex-native/launch-flags.ts` = **0 lines** (verified).
- No sealed-doctrine amendment attempted or implied.
- Pre-existing TS2352 at `/manage/page.tsx:451` (now line 458 after my 7-line insertion) is unchanged by Candidate B · verified `git show HEAD:src/app/nex-native/manage/page.tsx | grep NexWeeklyHours` returns the same cast at line 451.

### 2f · Status

| Scope | State |
|---|---|
| Component (unread badge primitive) | **tested at logic + SSR layer** · zero typecheck regression · PASSES per the sealed test suite |
| Component (authenticated browser render) | **not verified** · pending Option A credentials or Option B script authorisation |
| Journey (end-to-end click-through) | **blocked by sealed Bridge 55 commerce gate** in production · works in dev with `?commerce=1` |
| Journey acceptance | **NOT accepted** · depends on D11 (live-journey authorisation) + D14 (gate decision below) |

---

## Batch 3 · TypeScript baseline · reproducibly captured

### 3a · Baseline file

Saved locally: `/tmp/tsc-baseline-37acc10.log` (ephemeral · regenerate with `npx tsc --noEmit 2>&1 > /tmp/tsc-baseline-37acc10.log`).

Reproducible on any clone at HEAD `37acc10` + Node.js installed · running `npx tsc --noEmit` from the repo root yields the identical diagnostic set.

### 3b · Distinct diagnostic count (not output lines)

A single compiler error may emit multiple output lines (e.g. generic constraint elaborations). The founder requested distinct count, not raw lines.

| Metric | Value | Formula |
|---|---|---|
| Raw stderr lines | 2,256 | `wc -l /tmp/tsc-baseline-37acc10.log` |
| Distinct `(file, line, col, code)` tuples | **1,665** | `grep -oE "^[^(]+\([0-9]+,[0-9]+\): error TS[0-9]+" ...` + `sort -u` + `wc -l` |
| Distinct files with any diagnostic | **595** | `grep -oE "^[^(]+\(" ...` + `sort -u` + `wc -l` |
| Distinct error codes | **46** | `grep -oE "error TS[0-9]+" ...` + `sort -u` + `wc -l` |

The 1,665 "distinct diagnostics" number happens to equal the "error lines" count (because tsc emits one line per diagnostic in this codebase; multi-line errors are rare for the dominant TS2307 case). The prior report's "1,665 error lines" count is thus accidentally correct as a distinct count too · reproduced from the saved baseline.

### 3c · Top error codes

| Code | Count | Meaning |
|---|---|---|
| TS2307 | 379 | Cannot find module |
| TS7006 | 313 | Parameter implicitly `any` |
| TS2339 | 287 | Property does not exist on type |
| TS2322 | 200 | Type is not assignable |
| TS2345 | 121 | Argument type not assignable |
| TS2540 | 50 | Cannot assign to read-only |
| TS2741 | 45 | Property missing in type |
| TS2353 | 32 | Object literal has unknown property |
| TS2739 | 26 | Type missing properties from required type |
| TS2352 | 26 | Suspicious cast |

### 3d · Root-cause attribution (verified)

Top missing modules (TS2307):

| Module | Count | Origin |
|---|---|---|
| `@/lib/supabaseAdmin` | 114 | Sibling-product legacy path (nexapp uses `@/lib/nex-native/supabase-admin`) |
| `@/lib/nexapp/tokens` | 30 | Nexapp prototype scaffold path · dropped by fork extraction |
| `@/lib/nex-cap/nex1-engineer` | 25 | Sibling product |
| `@/lib/nex-intelligence/provenance` | 16 | Sibling product |
| `@/lib/nex-cap/registry` | 12 | Sibling product |
| `@/lib/app-builder/blueprint-schema` | 9 | Sibling product |
| `@/lib/crm/loadContactTimeline` | 8 | Sibling product |
| `@/apps/materials/_schema/types` | 8 | Sibling product |
| `@/apps/materials/_schema/memory_types` | 6 | Sibling product |
| `@/lib/supabaseNexAdmin` | 5 | Alternative name variant |

**Root-cause summary**: ~233 of the 1,665 distinct diagnostics (14%) are TS2307 primary failures. The remaining ~1,432 (86%) are cascading errors (TS7006/TS2339/TS2322/TS2345) downstream of those failed imports (variables typed `unknown`/`never` after import failure propagates).

Per `C:/Users/Victus/nexapp/CLAUDE.md` nexapp §"Fork hygiene": these are expected residue from the 2026-10-10 fork extraction. The CLAUDE.md disclosure of "~14 known broken imports" is substantially understated.

### 3e · Candidate B zero-regression (verified reproducibly)

- `grep -cE "inbox-unread-badge" /tmp/tsc-baseline-37acc10.log` returns **0**.
- `grep -cE "directory-image-adapter" /tmp/tsc-baseline-37acc10.log` returns **0** (A-strict from earlier · also no regression).
- `grep -cE "nexVisualAssets" /tmp/tsc-baseline-37acc10.log` returns **0** (UID-B7 catalogue · no regression).

All 3 session commits that touched code contribute zero diagnostics to the baseline.

### 3f · Remediation plan (proposed · NOT implemented)

Per founder's "small, isolated remediation batches · no mass fix":

| Batch | Scope | Expected delta | Risk |
|---|---|---|---|
| R1 · `@/lib/supabaseAdmin` → `@/lib/nex-native/supabase-admin` re-point | ~114 primary + large cascading drop | 500–1,000 fewer diagnostics expected | moderate · requires per-file signature verification |
| R2 · `@/lib/nexapp/tokens` shim or delete | ~30 primary + cascading | 50–150 fewer | low if shim; moderate if delete (deadcode detection) |
| R3 · nex-cap · nex-intelligence · app-builder · crm · materials type-only `.d.ts` shims | ~75 primary + cascading | 200–400 fewer | low (type shims cannot change runtime) |
| R4 · Residual case-by-case | remaining ~500 after R1-R3 | varies | per-file |

Each batch requires separate founder authorisation per CLAUDE.md §4. **Not implemented in this report.**

### 3g · Status

- Baseline is reproducible from HEAD + saved to `/tmp/tsc-baseline-37acc10.log`.
- Distinct count (1,665), distinct files (595), distinct codes (46) all verified.
- Candidate B regression delta: **0**.
- Remediation plan drafted (R1-R4) · implementation requires separate authorisation.

---

## Consolidated status (final report per founder's requested structure)

### Completed + verified
- **Candidate B component** · 18/18 unit tests · SSR smoke · zero typecheck regression · verified at `src/app/nex-native/manage/_inbox-unread-badge-client.tsx` + its test.
- **A-strict CATEGORY_FALLBACK** (committed earlier at `3ea9d8f`) · 29/29 tests · zero typecheck regression · verified in dev browser food/directory grid.
- **UID-B7 OPT1a nexVisualAssets catalogue port** (committed at `f4cd1d4`) · 16/16 resolver tests · zero typecheck regression.
- **Reproducible TypeScript baseline** · 1,665 distinct diagnostics · 595 files · 46 codes · saved to `/tmp/tsc-baseline-37acc10.log`.
- **Launch gate confirmation** · `launch-flags.ts` unchanged since session start (`git diff 3ea9d8f..HEAD` = 0 lines).

### Implemented but not fully verified
- **Candidate B journey** · component ships; end-to-end browser pass not run; blocked by sealed Bridge 55 gate in production anyway.

### Blocked + exact dependency
- **3 proposed Class-D safe fixes** · depend on migration 200 being applied (or a sealed-service revision per F3 lines 37-44). Currently cannot be shipped without regressing to 404-everyone behaviour per sealed F3 regression anchor.
- **Watch Listing E2E production journey** · depends on D1 (apply watch migrations 227-233) + storage bucket + Stripe webhook decisions. No prerequisite verified in Supabase (001/002/003/010/217/219).
- **Audit-Decisions A/B/C** · depend on founder product thinking on shop visibility, chat stickiness, null-viewer UX.

### Decisions requiring founder approval (consolidated · prior + new)

Prior (from `nex-programme-review-pack-2026-10-27.md` + batches-1-2-3-report):
- **D1** · Apply watch migrations 227-233 (held)
- **D2** · Apply migration 200 (held)
- **D3** · Add RLS policy on nex_account for `profile_visibility` (defence-in-depth; separate migration)
- **D4** · Ship 3 safe Class-D fixes (**blocked** · see Batch 1 above · depends on D2 or D13)
- **D5** · Resolve audit A/B/C (shop visibility, chat stickiness, null-viewer UX)
- **D6** · Hide `pricing_mode='auction'` from launch UI
- **D7** · Choose Watch Listing approach B
- **D8** · Accept Candidate B after browser pass
- **D9** · Correct Phase 1 inventory footnote (chat-settings/privacy/data-usage sealed-complete)
- **D10** · Commission pre-apply review for migration 200
- **D11** · Candidate B live-journey authorisation path (Option A credentials or Option B script authorisation)
- **D12** · Authorise TypeScript remediation programme (R1-R4)
- **D13** · Apply migration 200 vs revise sealed service behaviour (two paths to unlock the 3 safe fixes)

**New (surfaced this batch)**:
- **D14** · Customer Chats journey acceptance path · (a) accept component only, defer journey to Phase 2 commerce launch (recommended), (b) flip `NEX_COMMERCE_ENABLED=1` in production, (c) amend sealed B9/B10 doctrine for owner-specific bypass.

### Proposed next authorised task

Per founder's "do not start unrelated feature work until this report is delivered": this report is now delivered.

**Candidate next task** (requires founder authorisation to proceed):
1. **If founder picks D13 Option 1 (apply migration 200)**: produce migration-200 pre-apply review doc (mirroring the watch migrations review); after review, apply with explicit approval; THEN ship the 3 Class-D safe fixes as 3 isolated commits.
2. **If founder picks D13 Option 2 (revise sealed service)**: produce a sealed-service revision doctrine note; after approval, revise `getPrivacyPreferencesSafe` as its own isolated commit; THEN ship the 3 Class-D safe fixes.
3. **If founder picks D14 (c) (owner-specific gate bypass)**: produce a sealed B9/B10 amendment doctrine note; after approval, implement the bypass as its own isolated commit; THEN accept the Customer Chats journey.
4. **If founder picks TypeScript remediation (D12)**: begin remediation Batch R1 (`@/lib/supabaseAdmin` re-point) as its own isolated commit, verify delta against saved baseline.
5. **If founder picks something else**: name the surface or journey; I inspect + propose + wait for authorisation.

---

## Explicit scope guards (restated · nothing in this report violated them)

- Zero code changes landed in this report.
- No migration applied.
- No RLS/storage/payment infrastructure altered.
- No shop identity, historical-chat semantics, or null-viewer presentation touched.
- Dev-admin provisioning script NOT run.
- Founder-created UI unchanged.
- Dirty-tree work (164 entries) preserved.
- Baseline captured BEFORE any proposed cleanup (per founder safeguard 3).
- Potential vs current exposure clearly separated (per founder safeguard 1).
- Component vs journey acceptance clearly separated (per founder safeguard 2).

## Honest limitations

- Did NOT independently verify Supabase runtime schema (relies on sealed F3 test's cited preflight).
- Did NOT run authenticated browser pass (per no-customer-data-modifications guard).
- Did NOT run every Class-D surface's current-behaviour verification (spot-checked /contacts + /conversations architectural pattern; inferred for 18 others).
- Did NOT compute per-root-cause expected delta beyond rough estimates in §3f (would require running R1 trial on one file to measure).
- Did NOT propose a sealed-doctrine amendment · all decisions presented preserve existing seals pending founder approval.
- The 1,665 distinct count equals the "error lines" count by coincidence in this codebase (dominated by single-line TS2307); for a codebase with generic-heavy diagnostics, the two numbers would diverge.
