# Phase 4a · Per-item Audit + Phase 4 Batch Plan · 2026-11-06

**Branch:** `phase-x/scope-reduction-chat-themes-shop-vault-2026-11-06`
**HEAD at run:** `8828e68` (Phase 3 report committed + pushed)
**Author:** Claude (Phase 4a read-only audit; one Write of this file; no code edits; no migrations; no pushes)
**Mode:** READ-ONLY per task constraint. `npm run typecheck` executed once for spot-check of TS error-code distribution. `npm run test` NOT executed (Phase 3 report used verbatim).

**Scope kept (per sealed 2026-11-06 Scope Reduction):** Chat · Chat Themes · Shop (bundles Vault) · Community Notice · Directory · Vault.

**Authority references in-report:**
- `docs/doctrine/nex-shop-entitlement-contract-LOCKED-2026-11-06.md` (§C, §G, §H, §K)
- `docs/doctrine/nex-package-contract-LOCKED-2026-11-06.md` (D1–D6 + P1–P3)
- `docs/doctrine/nex-vault-entitlements-policy-sheet-2026-10-20.md` (B1–B8, W1–W12)
- `docs/scope-reduction/phase-3-readiness-report-2026-11-06.md` (baselines)
- Sealed memory: `project_nex_scope_reduction_sealed_2026_11_06.md`

---

## § 0 · Community scope re-confirmation

**Verdict: CONFIRMED-KEPT.**

Evidence:

1. **Sealed memory** (`C:/Users/Victus/.claude/projects/C--Users-Victus/memory/project_nex_scope_reduction_sealed_2026_11_06.md:11-24`):
   > *"Keep five surfaces (CORRECTED 2026-11-06 mid-Phase 1c): 1. Chat … 5. Community Notice — address-anchored 2km community feature (KEPT — owner reversed mid-Phase 1c with 'we hold onto community notice'; Batch 5 reverted at `624c85f`; sealed doctrine 2026-10-23 remains in force)"*.
   Also line 24: *"Community Notice NOT removed (owner reversed mid-flight 2026-11-06)."*

2. **Phase 3 report** (`docs/scope-reduction/phase-3-readiness-report-2026-11-06.md:171`):
   > *"146–152, 197 | Community Notice — KEPT per mid-flight correction | applied | NOT stranded — Community surface is in-scope. Verified kept."*

3. **Code state (verified this pass):**
   - `src/app/nex-native/community/` → `_actions.ts`, `_palette.ts`, `chat/`, `compose/`, `feed/page.tsx`, `lost-found/`, `notices/[id]/page.tsx`, `select/`, `settings/`, `page.tsx` — all present.
   - `src/lib/nex-native/community/` → `business-discovery-service.ts`, `lost-found-service.ts`, `membership-service.ts`, `notice-service.ts` (opens with *"NEX Community Noticeboard · notice CRUD + lifecycle + corroboration + report"*), `photo-upload-service.ts`, `rate-limit.ts`, `types.ts`, `zone-service.ts`.
   - `src/app/nex-native/contacts/_community-notice-card.tsx` + `_community-card.tsx` present.
   - `src/app/api/nex-native/community/notices/route.ts` present.
   - Supabase migrations 146–152 + 197 kept in `nex-supabase/migrations/`.

4. **Shop Entitlement Contract LOCKED** does **NOT** mention Community Notice as a Shop entitlement. §C entitlements C-1…C-11 are strictly Shop-surface/Vault/discovery. Community is a **separate free feature** that persists under the kept-five scope but is **not bundled into Shop membership**. No downstream conflict.

**Action:** no change — Community Notice stays. Backend wiring remains a **separate authorisation gate** per sealed 2026-10-23 doctrine (schema + 1h-explain timeout + address→community mapping). Phase 4 touches it only to the degree Phase 4 touches **broken-journey surfaces** that Community Notice depends on (see § 4).

---

## § 1 · Per-item current-state audit (10 items)

Rubric per task:
- **BUILT** = code shipped and typecheck-clean for the item in isolation.
- **WIRED** = BUILT + connected end-to-end to data + callers (an actual user path exercises it).
- **VERIFIED** = WIRED + tested (unit or Playwright passing in Phase 3 run, OR owner visual confirmation).
- **REMAINING** = work still outstanding in Phase 4.
- **BLOCKED** = cannot proceed without an external input (owner, counsel, customers, prod auth).

### Item B2 · Server-side entitlement authority for § C items

| Field | Content |
|---|---|
| **Current state** | **REMAINING** (partial BUILT). C-1/C-2/C-3/C-5/C-6/C-11 are BUILT (phase-v P1–P22); C-4/C-7 are WIRED today against pre-scope-reduction tier logic; C-8/C-9/C-10 are UNIMPLEMENTED. No `shop-entitlement.ts` single-source helper exists. |
| **Code evidence** | • `thumbnail-entitlement.ts:150-184` keys on `effectiveTier === "bisnis"` (pre-scope-reduction `nex_account.tier` column — NOT `nex_business.membership_active`). <br>• No grep hit for `membership_active`, `membership_period_end`, `shop_subscription_id`, or `src/lib/nex-native/shop-entitlement.ts` anywhere in `src/`. <br>• `AvatarShopBadge` currently resolves "has shop" by `nex_business` row presence, not membership state (per Shop contract §C-4 "Gate needed: Membership-aware `hasShop` resolution"). <br>• `[businessSlug]/page.tsx` references `country_iso2` only in cookie-fallback comment — no membership-gated render. |
| **What's missing** | • Single-source `shop-entitlement.ts` helper exposing a typed `ShopEntitlement` object. <br>• `nex_business.membership_active` / `membership_period_end` / `membership_cancel_requested_at` / `membership_trial_used_at` schema (gated on B3). <br>• Rewire each of §C-1, C-4, C-5, C-7 call sites to read the new helper instead of `effectiveTier`. <br>• C-9 Vault bundling depends on B7. |
| **Can be completed in Phase 4?** | **PARTIAL.** Without B3 schema applied, B2 can SHIP the helper against a feature-flagged **shim** reading today's `account.tier === 'bisnis'` as the stand-in for `nex_business.membership_active`. Full enforcement rewire of C-4/C-5/C-7 to the helper is YES-medium once helper exists. Full B2 CLOSE requires B3. |
| **Dependencies** | B3 (schema migration) for full closure. B7 for C-9 subset. B8 for C-10 (P1/P2/P3) subset. |
| **Owner-auth required?** | YES — helper shape + shim strategy + list of rewired call sites needs owner sign-off before build; no migration needed for shim path. |

### Item B3 · Country schema + Stripe integration prereqs

| Field | Content |
|---|---|
| **Current state** | **BLOCKED-BY-OWNER-AUTH / REMAINING.** `nex_account.country_iso2` does NOT exist. Country persistence is via HTTP-only cookie (`country-hint-cookie.ts`). All Stripe-shaped columns from Shop contract §G are UNIMPLEMENTED. |
| **Code evidence** | • `src/lib/nex-native/country/country-hint-cookie.ts:16-26`: *"The `nex_account.country_iso2` column does NOT exist today (confirmed by grep of nex-supabase/migrations/ on 2026-11-06)"*. <br>• Grep for `country_iso2` in `src/`: 2 hits — the cookie comment and a `_actions.ts:223` comment. Zero migration file hits. <br>• Zero grep hits in migrations for `country_iso2`, `shop_subscription_id`, `membership_active`, `membership_period_end`, `nex_webhook_event_log`, `nex_ledger_entry`. <br>• Latest migration applied = `256_nex_visibility_amendment.sql`. Migrations 244/245/246/247/248 (the Ireland/Indonesia country-isolation drafts) are gated with `RAISE EXCEPTION` DRAFT guards. <br>• `vault-service.ts:18-24` reads `account.vault_tier` — the column does **not** exist in any migration file. This is the known "BROKEN SCAFFOLDING" from Vault §A. |
| **What's missing** | • Dedicated migration adding `nex_account.country_iso2` + `nex_account.shop_subscription_id` + `nex_account.vault_tier` + four `nex_business.membership_*` columns + `nex_product.discovered_at` (gated) + `nex_webhook_event_log` + `nex_ledger_entry`/`_line` (ledger shape still DRAFT per Social Commerce D1). <br>• Stripe SDK not yet installed/wired (grep in `package.json` would confirm — not run; task says no scheduled Stripe wiring until §H gates open). <br>• Country-detection path writes cookie only; no account-update action. |
| **Can be completed in Phase 4?** | **BLOCKED-EXTERNAL.** Per CLAUDE.md §5 and Shop contract §H-B3, a migration requires separate explicit authorisation. Phase 4 may AUTHOR the migration file (held behind a `RAISE EXCEPTION` guard like 244–248), may not APPLY it. |
| **Dependencies** | Owner authorisation to apply migration. Phase-u merge (mig 281 referenced by contract) is a prerequisite per contract §G header — current branch's latest is 256, phase-u has not merged into this branch. |
| **Owner-auth required?** | YES — explicit "apply migration N to `ijvqdvsvwtwxzcqmoqit`" authorisation per CLAUDE.md §5. Phase 4 may author the DRAFT file only. |

### Item B5 · Package welcome card + accurate messaging

| Field | Content |
|---|---|
| **Current state** | **REMAINING (partial WIRED).** Welcome card copy has been updated per Phase 2 Batch 4 to route through `?intent=bisnis`, but: packages page is still Rp 99k pre-scope-reduction content; Vault bundling is NOT mentioned; 0% commission phrase present in packages but not on welcome card; "same story" principle NOT yet satisfied end-to-end. |
| **Code evidence** | • `welcome/page.tsx:280-357` — three cards (`free-chat`, `personalised` → Chat Themes, `shop` → Business Chat). Card 3 chip = `"Chat · Shop · Vault"` but **no price displayed**. Comments explicitly note (lines 296-305): "retired 2026-11-06 per Shop contract §K-3 LOCK · the separate 7-day BUSINESS trial now auto-fires on FIRST business signup". <br>• `packages/page.tsx:197-227` — two cards: Gratis (Rp 0) + Bisnis (Rp 99,000). NO Vault bullet. NO verified badge / boosted messages copy (confirmed no grep hits). NO 7-days-free. FAQ at line 311-313 correctly describes manual-cancel path. <br>• `packages/page.tsx:210`: `priceLabel="Rp 99,000"` — **hard-coded IDR** that conflicts with Shop contract §K-1 "core-four markets" lock (USD + GBP + IDR + EUR; USD anchor $9.99). <br>• `pricing-config.ts` exists and is referenced in welcome card (line 349 comment). |
| **What's missing** | • Packages page rewrite to display pricing for all 4 core markets (not just Rp 99k) using `pricing-config.ts` + country-hint cookie. <br>• Welcome card chip to display `See all plans →` OR the resolved local-currency price (per §K-3 trial-auto-fires lock). <br>• Vault bundling copy strategy decision (Vault §B6 says OMIT until W-items ship, so welcome card chip "Chat · Shop · Vault" is **at risk** — "Vault" word appears today without W5 download-everything or W7 honest intro copy). <br>• "7 days free, then [price]" copy once B4 wiring is verified to fire. |
| **Can be completed in Phase 4?** | **PARTIAL.** Copy alignment YES-medium (no migration needed). Full price-display across 4 markets requires `pricing-config.ts` extension YES-small. Vault bullet decision is locked to B6 — **remove the Vault token from the chip until W5+W7 land**, or accept the risk (owner choice). |
| **Dependencies** | B2 (knowing what's enforced), B7 (Vault W5 + W7), B8 (P1/P2/P3 claims). Package Contract §3 Business package bullet list is authoritative. |
| **Owner-auth required?** | PARTIAL — copy rewrite needs owner approval of the exact bullets. Code mechanism (country-hint-cookie → pricing-config lookup) needs no auth. |

### Item B7 · Vault W1–W12 (prioritise W5 download-everything + W7 intro copy)

| Field | Content |
|---|---|
| **Current state** | **REMAINING.** 0 of 8 blocking W-items closed per Phase 3 report §7. |
| **Code evidence** | • `vault/intro/page.tsx:293`: *"more — all in one secure vault, only you can access."* Line 440: *"End-to-end encrypted, with no access from us. Only you hold the…"*. These phrases live in the file **today**, unfixed. Vault §A audit marks them as misleading (chat-attachment Phase A.1 is plaintext-at-rest). <br>• W5 grep: **zero** matches for `downloadAll`, `vault-zip`, `exportVault` in Vault surfaces. The "download-everything" endpoint **does not exist**. <br>• `vault-service.ts:22-23` still reads `account.vault_tier` — W3 broken-scaffolding unresolved. <br>• W1 (storage cap): zero `storage_cap` / `BYTES_LIMIT` / `5_000_000_000` constants in Vault modules. <br>• W2 (per-file cap): zero `50_000_000` or `MAX_FILE_BYTES` constants in Vault modules. |
| **What's missing** | • W5: implement a signed-URL ZIP/manifest download endpoint at `/api/nex-native/vault/export` with per-file structural validator + resume path. **Hard release blocker**. <br>• W7: rewrite `vault/intro/page.tsx` lines 293 + 440 to honest copy (drop "100% PRIVATE" marquee, qualify E2E claim for Phase A.1). <br>• W1 server-side storage-cap enforcement at upload boundary. <br>• W2 per-file 50,000,000-byte enforcement at upload boundary + API + accounting. <br>• W3 `vault_tier` migration (satisfied inside B3 migration if authorised). <br>• W4 grace-period scheduler + six-pre-condition fail-safe deletion gate. <br>• W10 technically-honest audit log. <br>• W12 verify sealed Phase A.6 client-side legacy-migration runner line-by-line. |
| **Can be completed in Phase 4?** | **PARTIAL.** <br>• **W7 copy fix: YES-small.** Honest copy swap on `vault/intro/page.tsx`. No migration. No owner authorisation beyond the copy wording. <br>• **W5 download-everything: YES-medium.** API route + manifest generator + resume path — feasible in one batch. Needs Storage-bucket read-only key available server-side (already is — `nex-vault-files` bucket + service-role per `vault-persistence-service.ts`). <br>• W1/W2: YES-small each, additive upload-boundary checks. <br>• W3: BLOCKED on B3 migration. <br>• W4: YES-medium but **should not run** without W5 + W10 + W12. <br>• W10: YES-medium (audit log table + write-paths). <br>• W12: YES-small (line-by-line read-only audit — doc deliverable). |
| **Dependencies** | B3 (W3 column), reasonable reliance on existing Vault E2E key hierarchy (sealed; no code change). Download-everything path requires decision: ZIP streaming vs signed-URL manifest. |
| **Owner-auth required?** | PARTIAL — W5 + W7 are code-only and can be built against owner-authorised scoping; W4 deletion-scheduler **must not run** without separate authorisation covering six-pre-condition gate verification. |

### Item B8 · Package Contract P1/P2/P3 enforcement

| Field | Content |
|---|---|
| **Current state** | **REMAINING.** All three claims deferred per Package Contract. |
| **Code evidence** | • **P1 verified badge**: grep for `is_verified`, `verified_at`, `VerifiedBadge` in Shop surfaces — zero hits. Shop contract §C-10 confirms: *"advertised on /packages:482-486 + /settings/tier:482. No `is_verified` / `verified_at` column. No badge-render component. No tier gate."* On current (post-scope) packages page, the badge is **NOT currently advertised** (no "Verified" word in `packages/page.tsx`), but §C-10 flags it as *advertised* historically — likely referring to the pre-Phase-1c state or `settings/tier`. <br>• **P2 20 boosted messages**: grep — zero hits for `boosted_message`, `boostedMessage`. `packages/page.tsx` does NOT mention boosted messages today. <br>• **P3 Cancel any time**: `packages/page.tsx:313` has the manual-cancel FAQ copy: *"Message NEX via the NEX1 support chat. Cancellation is processed manually by NEX while the self-service flow is being built."* This is **honest** but is NOT the "Cancel any time" claim. |
| **What's missing** | • If owner wants any of these claims on new Shop copy: build server-side state (schema + enforcement) BEFORE adding wording. <br>• If owner wants to retire the claims: no code change needed — the post-scope packages page does not currently carry them. Only `/settings/tier:482-486` (not in current working tree audit) may still carry Business-card copy with P1/P3 — needs spot-read before copy pass. |
| **Can be completed in Phase 4?** | **PARTIAL.** P1 enforcement = schema + render + tier gate — YES-medium. P2 quota = table + counter + reset rules — YES-medium. P3 customer cancel flow = state machine + email + UI — YES-medium. Each is a separate build slice, and each depends on B3 schema. |
| **Dependencies** | B3 migration. Package Contract §4 lists each as "Separately needed: owner authorisation to EITHER remove the claim from existing copy, OR to design and build the system." |
| **Owner-auth required?** | YES per slice — each of P1/P2/P3 is explicitly a separate authorisation per Package Contract §4. |

### Item · Test-suite failures

| Field | Content |
|---|---|
| **Current state** | **REMAINING.** 367 failures across 285 files per Phase 3 report §2. **Zero regressions from Phase 1c / Phase 2** (grep-proven). |
| **Code evidence** | Phase 3 report §2 categorisation + list of 13 orphan E2E spec files under `tests/e2e/`. |
| **What's missing** | Test-cleanup batch: delete 13 orphan Playwright specs; opportunistically fix the ~27 pre-existing unit drift files (`bio-page.test.ts`, `multi-vertical.test.ts`, `listing-card.test.tsx`, `control-drawer-client.test.tsx`, HQ `SETUP · HQShell.tsx`). |
| **Can be completed in Phase 4?** | **PARTIAL.** Orphan spec deletion YES-small (safe deletion batch). Unit-drift fixes YES-medium per file — will likely take a dedicated slice. Full 367 → 0 is not realistic in a single Phase 4; realistic target is 13 orphans deleted + top-10 unit-drift files fixed. |
| **Dependencies** | None blocking. Independent of B2–B8. |
| **Owner-auth required?** | NO (deletion of own-repo test files is in-scope repo work). |

### Item · TypeScript 1185 errors

| Field | Content |
|---|---|
| **Current state** | **REMAINING.** 1185 pre-existing errors; Phase 3 confirmed delta = 0. |
| **Code evidence** | Spot-check of 1185 via `npx tsc --noEmit` in this pass. Error code distribution (top 10): TS2307 (234, cannot find module) · TS2322 (190, type assignment) · TS2339 (180, prop missing) · TS7006 (163, implicit any) · TS2345 (113, arg type) · TS2540 (50, readonly) · TS2741 (43, missing prop) · TS18047 (25, possibly null) · TS2739 (24, missing many props) · TS2352 (23, not assignable to never). Error-file directory distribution: `src/lib/nex` (468) · `src/lib/nex-agent` (185) · `src/lib/nex-agent-runtime` (179) · `src/components/nexapp` (142) · `src/lib/nex-native` (126) · `src/app/nex-native` (46). |
| **What's missing** | Category-A (legacy residue `src/lib/nex/*` + the `src/components/nexapp/*` tree with TS2307 missing `@/lib/nex-apps/*` / `@/lib/nexapp/*` / `@/lib/nexapp-shell/*` / `@/lib/pricing/_locale` imports): **ALL 234 TS2307 are in legacy trees not touched by scope reduction** — candidate for same "move-to-trades-or-delete" treatment as staircase/stairparts (owner memory 2026-10-28). Category-B (nex-agent / nex-agent-runtime shape drift): 364 errors, largely TS2339/TS7006/TS2322 in agent runtime — pre-existing. Category-C `src/lib/nex-native`: 126 errors — closest to kept surfaces; highest-value cleanup target. Category-D `src/app/nex-native`: 46 errors — real app code; must fix for genuine launch. |
| **Can be completed in Phase 4?** | **PARTIAL.** <br>• **Category D (46 errors in `src/app/nex-native`): YES-medium** — scoped to kept surfaces. <br>• **Category C (126 errors in `src/lib/nex-native`): YES-medium** per batch. <br>• **Category A 234 TS2307**: YES-small IF the owner authorises deleting the orphaned `src/components/nexapp/*` tree + the `src/components/nex-app/shell/*` orphan cluster (Phase 3 report §5) — this is a **deletion** operation, not a type fix. <br>• **Category B (nex-agent/* 364 errors): BLOCKED without owner guidance** — scope-reduction memo did not mention agent runtime. Treat as "do not touch in Phase 4". |
| **Dependencies** | Owner authorisation for orphan-deletion batch (CLAUDE.md fork-hygiene guidance allows incremental cleanup). |
| **Owner-auth required?** | PARTIAL — deletion of `src/components/nexapp/*` or `src/components/nex-app/shell/*` (except `WorldCardsInline.tsx`) needs owner approval per Phase 3 §10. Fixes within `src/app/nex-native/*` + `src/lib/nex-native/*` do not. |

### Item · Broken user journeys (see § 4 detail)

| Field | Content |
|---|---|
| **Current state** | **REMAINING.** ~8 degraded-or-broken journeys identified in § 4. |
| **Code evidence** | See § 4 enumeration. |
| **What's missing** | See § 4 per-journey breakdown + remedy. |
| **Can be completed in Phase 4?** | **PARTIAL.** BLOCKS-LAUNCH items are addressable with owner authorisation; DEGRADED items are opportunistic. |
| **Dependencies** | B2 + B3 + B7 cascading. |
| **Owner-auth required?** | YES per slice. |

### Item · Country schema + Stripe prereqs (duplicate framing of B3)

| Field | Content |
|---|---|
| **Current state** | **BLOCKED-EXTERNAL.** Same substance as B3 — kept distinct per owner's item list. |
| **Code evidence** | Same as B3: no `country_iso2` column; cookie-only country persistence; no Stripe SDK call sites; no webhook consumer; no ledger shape. |
| **What's missing** | • Authored (not applied) migration draft. <br>• Stripe SDK + webhook consumer scaffolding (behind `NEX_STRIPE_ENABLED=false` default). <br>• Checkout session creation action (feature-flagged). <br>• Ledger table shape finalised (DRAFT per Social Commerce D1). |
| **Can be completed in Phase 4?** | **PARTIAL.** Stripe scaffolding behind a strict feature flag can land without going live. Migration must stay DRAFT per CLAUDE.md §5. No real test keys outside sandbox per §H-B9. |
| **Dependencies** | B3 migration applied (needs auth); ledger-shape DRAFT resolution; Stripe account credentials (sandbox-only) — not available in this read-only pass. |
| **Owner-auth required?** | YES — migration apply + real Stripe credentials. |

### Item · Community scope confirmation

| Field | Content |
|---|---|
| **Current state** | **BUILT/WIRED (mock-complete UI + DB schema applied).** See § 0. |
| **Code evidence** | § 0 references. Backend action-wiring + security-copy auditing + address→community mapping + 1h-explain timeout job are OUT OF SCOPE for Phase 4 per sealed 2026-10-23 "backend wiring is a separate authorisation gate". |
| **What's missing** | Nothing for scope-reduction purposes. Everything else is sealed-doctrine separate authorisation. |
| **Can be completed in Phase 4?** | **PARTIAL — "confirmation" step: YES-small** (this report closes it). Any further Community work is out of scope. |
| **Dependencies** | None. |
| **Owner-auth required?** | NO (confirmation only). |

---

### § 1 current-state summary table

| Item | State | Phase-4-completable? |
|---|---|---|
| B2 entitlement authority | REMAINING | PARTIAL (shim YES; full needs B3) |
| B3 schema + Stripe prereqs | REMAINING / BLOCKED-EXTERNAL | BLOCKED (owner auth to apply) |
| B5 welcome card copy | REMAINING (partial) | PARTIAL (copy YES; full price display YES-small) |
| B7 Vault W-items | REMAINING | PARTIAL (W5 + W7 YES; W4 BLOCKED behind W5/W10/W12) |
| B8 P1/P2/P3 | REMAINING | PARTIAL (each a separate build slice, depends on B3) |
| Tests | REMAINING | PARTIAL (13 orphans + top-10 unit drift) |
| TypeScript 1185 | REMAINING | PARTIAL (app routes YES; agent runtime BLOCKED) |
| Broken journeys | REMAINING | PARTIAL |
| Country/Stripe prereqs | BLOCKED-EXTERNAL | BLOCKED (owner auth to apply migration) |
| Community confirmation | BUILT/WIRED | YES (this report closes it) |

---

## § 2 · Test-suite categorisation

Phase 3 summary: 1219 total · 929 pass · **285 failed files** · 5 skipped · **367 failed tests** · 146 skipped tests · 9 todo · 108.2 s.

| Bucket | Approx count | Nature |
|---|---|---|
| **A · Requires live dev server** (Playwright E2E on `:3008`) | ~245 files | `tests/e2e/**`, `tests/_capture-*`, `tests/_preview-pass-tmp/**`, `tests/e2e-chat-responsive`, `tests/e2e-product-upload`, `tests/e2e-themes`. Fail with `ECONNREFUSED` / navigation timeout. **Not Phase-4 blockers**. |
| **B · Pre-existing unit drift** | ~27 files | `bio-page.test.ts` (R10 visibility shape), `multi-vertical.test.ts`, `listing-card.test.tsx` (div-structure guards), `control-drawer-client.test.tsx`, HQ `SETUP · HQShell.tsx` missing, world-adapter SQL schema mismatches. Reproduces on `main` per Phase 3. |
| **C · Outdated · targeting deleted routes** | **13 files** (exhaustive list captured in Phase 3 §2) | `tests/nex-feed-perf-baseline.spec.ts`, 9× `tests/e2e/live-commerce-*.spec.ts`, `tests/e2e/live-footer-3-dots-container.spec.ts`, `tests/e2e/live-header-ping-and-ai-chip.spec.ts`, `tests/e2e/live-library-tiles.spec.ts`, `tests/e2e/nex-feed-gate1-acceptance.spec.ts`, `tests/e2e/nex-feed-visual-verify.spec.ts`, 2× `tests/e2e/_capture-live-persona-*.spec.ts`. Fail on URL navigation (route no longer exists). **Delete-safe.** |
| **D · Actual NEX functionality broken** | **0 regressions from Phase 1c/2** (Phase 3 grep-proven). Any real-functionality-broken failures that exist are in B. | n/a — Phase 3 confirmed no scope-reduction regression. |
| **E · Ambiguous / needs investigation** | ~13 files | `.mjs` standalone runners under `src/lib/nex/comms-social/tests/` that call `process.exit(2)`. Pre-existing, unrelated to scope. |

**Phase-4 target:** Delete the 13 Bucket-C files (YES-small batch). Fix top-10 Bucket-B files opportunistically (YES-medium batch). Bucket-A/E out of Phase-4 scope.

---

## § 3 · TypeScript error categorisation

**Baseline: 1185 errors across 408 unique files** (verified this pass).

### Top error-code distribution (this pass)

```
234  TS2307  Cannot find module
190  TS2322  Type not assignable
180  TS2339  Property does not exist
163  TS7006  Parameter implicitly has an 'any' type
113  TS2345  Argument not assignable
 50  TS2540  Cannot assign to readonly property
 43  TS2741  Property missing
 25  TS18047 'x' is possibly null
 24  TS2739  Many properties missing
 23  TS2352  Not assignable to never
 22  TS2353  Object literal unknown property
 21  TS18048 'x' is possibly undefined
 17  TS2305  Module has no exported member
 10  TS2344  Type does not satisfy constraint
  7  TS2304  Cannot find name
  … (balance distributed across TS2769/TS2740/TS2459/TS2367 et al.)
```

### Error-file directory distribution

```
468  src/lib/nex             (legacy monorepo residue per CLAUDE.md fork-hygiene)
185  src/lib/nex-agent
179  src/lib/nex-agent-runtime
142  src/components/nexapp   (orphan "nexapp/*" component tree)
126  src/lib/nex-native      (kept product · HIGH VALUE)
 46  src/app/nex-native      (kept product · HIGH VALUE)
 15  src/app/api
  9  src/components/nex-app  (orphan "nex-app/shell/*" cluster)
  6  src/app/nex-generated
  3  src/components/nex-native
  2  src/lib/llm
  2  scripts/nex-themes/__tests__
  2  tests/e2e/*             (orphan specs targeting deleted routes)
```

### Buckets

| Bucket | Approx count | Nature |
|---|---|---|
| **A · Legacy residue** (`src/lib/nex/*` fork-hygiene known residue incl. hammerex / trade-off / xrated / networkers) | ~468 | CLAUDE.md "Fork hygiene" paragraph explicitly says clean up incrementally when touching those files; **do not refactor the whole tree in a drive-by**. |
| **B · Missing dependency imports** (TS2307 `@/lib/nex-apps/*`, `@/lib/nexapp/*`, `@/lib/nexapp-shell/*`, `@/lib/pricing/_locale`, `@/app/api/nex-directory/listings/route`) | **234** (exact) | Sample: all 15 `src/components/nexapp/*` files + 3 `src/components/nex-app/shell/*` files + agent runtime. Cleanest path = delete the dead component trees (owner auth needed). |
| **C · Shape drift** (schema evolution / interface updates) | ~300 (mix of TS2322/TS2339/TS2741/TS2739) | Primarily `nex-agent` + `nex-agent-runtime`. Many fixable per-file. |
| **D · Null/undefined guards missing** (TS18047/TS18048) | ~46 | Scattered. |
| **E · Other** (TS7006 implicit any, TS2540 readonly, TS2353 unknown prop, TS2304 cannot find name) | ~240 | Scattered. |

### Phase-4 recommended sub-batches

- **TS-batch-1 · `src/app/nex-native/*` 46 errors** — YES-medium. Kept surface, real app code. Includes the `theme-engine.tsx` + `chat-standard` palette drift + `peer-call-quality` test drift + `contacts/page.tsx:321/336` missing-prop (ContactsFilterPills) + `dev/phone-gallery-fixture` BrowserThemeRow drift.
- **TS-batch-2 · `src/lib/nex-native/*` 126 errors** — YES-medium. Kept library. High value.
- **TS-batch-3 · Delete `src/components/nexapp/*` tree** (142 errors eliminated by deletion) — YES-small CODE, but **OWNER AUTH required** for deletion.
- **TS-batch-4 · Delete `src/components/nex-app/shell/*` minus `WorldCardsInline.tsx`** (9 errors eliminated by deletion) — YES-small CODE, OWNER AUTH per Phase 3 §10.
- **TS-batches-5+** · `src/lib/nex-agent*` + `src/lib/nex/*` — **DO NOT TOUCH in Phase 4** unless owner opens the fork-hygiene batch.

**Expected Phase 4 delta: 1185 → ~860** (if batches 1+2+3+4 land) — ~325 errors removed.

---

## § 4 · Broken user journeys audit

Journeys walked read-only from route entrypoint + action handler + service layer, scoped to kept surfaces.

| Journey | Status | Severity | Evidence |
|---|---|---|---|
| **J1 · Chat (free)** · `/nex-native/free-chat` | WORKS today | n/a | `free-chat/page.tsx` + canvas/composer clients present. No tier gate. No deleted-route dependency. |
| **J2 · Chat Themes · browse + buy** · `/nex-native/chat-themes-library` → one-time purchase | **DEGRADED** | **DEGRADED** | Library renders; purchase flow is the Rp 99k Bisnis path (§3 in Package Contract), not the sealed launch $3.99 one-time per theme. No Stripe Checkout path for per-theme one-time purchase. Existing `account-service.ts` carries themes_trial_used_at but no per-theme ownership column. |
| **J3 · Shop · signup → create → publish** · signup → `/create-account/business-welcome` → `pick-theme` → `pick-cover` → `building` → `createBusinessAction` | **WORKS with guards** | DEGRADED | Phase 2 Batch 4 wiring at `createBusinessAction` (`_actions.ts:4583-4594`) imports `startBusinessTrial` and soft-fails on absence. Shop is CREATED whether or not trial fires. But: `NEX_BUSINESS_TRIAL_ENABLED` defaults FALSE (per `business-trial/service.ts:66-68`), so by default trial will NOT fire. The welcome-card "retired 2026-10-18 hold" comment is premature per feature-flag default. |
| **J4 · Shop manage** · `/nex-native/manage/shop` | **WORKS with unauth redirect** | MINOR | `manage/shop/page.tsx:128` redirects unauth to `/nex-native/packages?intent=bisnis` — per Phase 2 Batch 3. Good. No membership check for authed-but-lapsed users (because `membership_active` column does not exist yet — cannot enforce until B3). |
| **J5 · Directory browse** · `/nex-native/directory` → shop card → `/nex-native/{slug}` | WORKS | DEGRADED | `thumbnail-entitlement.ts` tier-gates listing slots on `effectiveTier` (account tier) not on `nex_business.membership_active`. A trialing-then-lapsed seller keeps directory presence beyond grace. |
| **J6 · Shop URL · lapsed-member soft-landing** · `/nex-native/{slug}` after day-30 | **WORKS** (CORRECTED 2026-11-06 post-audit) | n/a | Phase 2 Batch 3 wired this at `[businessSlug]/page.tsx:260-270`. Renders `ClosedShopSoftLanding` when `business.archived_at` is set. Audit's "UNIMPLEMENTED" claim was WRONG — the branch exists and is active. Placeholder signal (`archived_at`) is per owner contract §E-4 interim; §G schema upgrade later refines the condition but current branch is functional. |
| **J7 · Vault intro** · `/nex-native/vault/intro` | **DISHONEST COPY** | **BLOCKS-LAUNCH** | Lines 293 + 440 of `vault/intro/page.tsx` carry "100% PRIVATE" / "End-to-end encrypted, with no access from us. Only you hold the…" claims. Vault §A audit grades these as PARTIALLY FALSE for Phase A.1 chat-attachment plaintext-at-rest. W7 explicitly listed as "already misleading today" — hard release blocker. |
| **J8 · Vault download-everything** | **MISSING** | **BLOCKS-LAUNCH** | W5 — the ZIP/manifest endpoint does not exist. Any grace-period expiry would delete customer files with no recovery path. B4 grace-flow cannot ship. |
| **J9 · Community Notice · post + flag** · `/nex-native/community/*` | **MOCK-COMPLETE UI, BACKEND NOT WIRED** | DEGRADED | Sealed 2026-10-23 doctrine confirms backend wiring is a **separate authorisation gate**. Per Phase 3 §6 migrations 146–152 + 197 are applied, but address→community mapping + 1h-explain timeout job + review-simulator-to-prod flip are unscheduled. UI reviewable; functionality simulated. |
| **J10 · Shop checkout (Stripe)** | **UNIMPLEMENTED** | **BLOCKS-LAUNCH (but blocked externally)** | Per sealed 2026-11-05 Stripe-entitlement-contract-first rule, Stripe cannot be built until entitlements enforce. B2 + B3 + §H gates must open first. |

**Journey severity summary (CORRECTED 2026-11-06):** **3 BLOCKS-LAUNCH** (J7 Vault intro copy, J8 Vault download-everything missing, J10 Stripe unimplemented — blocked externally) · **4 DEGRADED** (J2, J3, J5, J9) · **1 MINOR** (J4) · **2 WORKS** (J1, J6 verified by in-code Read post-audit).

---

## § 5 · Proposed Phase 4 batch plan

Ordered to minimise cross-dependency. Each batch is a SEPARATE commit (per Build-Commit-Push doctrine 2026-11-01), and most need SEPARATE owner authorisation before starting.

### Batch 4.1 · Vault W7 honest intro copy (YES-small)
- **Scope:** W7 only. Replace misleading phrases on `vault/intro/page.tsx:293,440` with the Vault §A-audit-honest wording. No functionality change.
- **Files:** `src/app/nex-native/vault/intro/page.tsx` only.
- **Expected typecheck delta:** 0.
- **Risk:** LOW (pure copy swap).
- **Auth:** owner approves the exact wording.

### Batch 4.2 · Vault W5 download-everything endpoint (YES-medium)
- **Scope:** W5. New API route `/api/nex-native/vault/export` returning signed-URL manifest OR streamed ZIP (owner choice). Includes resume support; structural validator per file.
- **Files:** `src/app/api/nex-native/vault/export/route.ts` (new), `src/lib/nex-native/vault/export-service.ts` (new).
- **Expected typecheck delta:** 0 or ≤ +5 (new route may introduce minor shape issues).
- **Risk:** MEDIUM (opaque-ciphertext handling must stay opaque; signed-URL TTL + rate limit).
- **Auth:** owner approves scope + response shape.

### Batch 4.3 · Delete 13 orphan E2E specs + delete `src/components/nex-app/shell/*` (minus `WorldCardsInline.tsx`) (YES-small)
- **Scope:** test cleanup + orphan tree deletion.
- **Files:** 13 Playwright specs under `tests/e2e/` + `src/components/nex-app/shell/{AppNav,AppShell,BottomNav,ChatSurface,FriendChatSurface,Hero,ChatToolTilesRow,QuickActionsGrid,...}.tsx`.
- **Expected typecheck delta:** –9 (shell cluster) + –2 (orphan test specs that fail typecheck).
- **Risk:** LOW (Phase 3 §5 verified zero external imports).
- **Auth:** owner approves orphan-deletion batch per Phase 3 §10 recommendation.

### Batch 4.4 · Delete `src/components/nexapp/*` orphan tree (YES-small)
- **Scope:** 142 TS errors eliminated by deletion.
- **Files:** `src/components/nexapp/**/*.tsx` (full subtree).
- **Expected typecheck delta:** –142 approx.
- **Risk:** MEDIUM — must grep for external importers first (not just inside-folder refs). Owner memory 2026-10-28 on "legacy files can be moved to trades" is the governing principle — this tree is likely the same shape.
- **Auth:** owner explicit authorisation per memory 2026-10-28 ("do NOT delete autonomously · each move needs per-batch authorisation").

### Batch 4.5 · `shop-entitlement.ts` single-source helper (shim) (YES-medium)
- **Scope:** B2 — create `src/lib/nex-native/shop-entitlement.ts` exposing `getShopEntitlement(accountId)` → typed `ShopEntitlement` object. SHIM backend: reads `account.tier === 'bisnis'` + `account.bisnis_expires_at` until B3 migration lands. Rewire C-4 (AvatarShopBadge), C-5 (directory/new list filter), C-7 (thumbnail-entitlement.ts) to call the helper.
- **Files:** `src/lib/nex-native/shop-entitlement.ts` (new); minor edits to `AvatarShopBadge.tsx`, `directory/new/page.tsx`, `thumbnail-entitlement.ts`.
- **Expected typecheck delta:** 0 to –5.
- **Risk:** MEDIUM (rewiring 3 call sites; test coverage).
- **Auth:** owner approves helper shape + shim strategy.

### Batch 4.6 · Shop contract §G DRAFT migration authored (NOT applied) (YES-small FILE-ONLY)
- **Scope:** B3 DRAFT. Author new migration file `nex-supabase/migrations/282_nex_shop_membership_schema.sql` with same `RAISE EXCEPTION` DRAFT guard pattern as 244–248. Adds `nex_account.country_iso2`, `nex_account.shop_subscription_id`, `nex_account.vault_tier`, four `nex_business.membership_*` columns, `nex_product.discovered_at` (gated), `nex_webhook_event_log`. No `nex_ledger_entry` (ledger shape still DRAFT per Social Commerce D1).
- **Files:** `nex-supabase/migrations/282_*.sql` (new, DRAFT).
- **Expected typecheck delta:** 0.
- **Risk:** LOW (guard prevents accidental apply).
- **Auth:** separate owner authorisation to APPLY per CLAUDE.md §5.

### Batch 4.7 · Welcome-card + packages-page copy alignment to Shop LOCK (YES-medium)
- **Scope:** B5. Packages page rewrite to display pricing for all 4 core markets via `pricing-config.ts` + country-hint cookie. Welcome card: resolve the "Chat · Shop · Vault" chip (owner decides whether to retain Vault token now that W7 has landed in 4.1, pending W5 landing in 4.2). "Same story" audit against `account-service` + packages + welcome.
- **Files:** `src/app/nex-native/packages/page.tsx`, `src/app/nex-native/welcome/page.tsx`, `src/lib/nex-native/pricing-config.ts` (extend).
- **Expected typecheck delta:** 0.
- **Risk:** MEDIUM (sealed welcome-trial-copy G-D4-* guards must stay honest).
- **Auth:** owner approves the exact bullets.

### Batch 4.8 · `src/app/nex-native/*` TypeScript fix batch (YES-medium)
- **Scope:** TS-batch-1. 46 errors scoped to kept surfaces. Includes theme-engine palette drift, chat-standard packages motion-token drift, peer-call-quality shape drift, contacts/page.tsx missing prop, phone-gallery-fixture BrowserThemeRow drift.
- **Files:** approximately 15 files under `src/app/nex-native/`.
- **Expected typecheck delta:** –46 (approx).
- **Risk:** MEDIUM (several interlinked chat-standard files).
- **Auth:** none beyond standard build.

### Batch 4.9 · `src/lib/nex-native/*` TypeScript fix batch (YES-medium)
- **Scope:** TS-batch-2. 126 errors in kept library layer.
- **Files:** approximately 25 files.
- **Expected typecheck delta:** –126 (approx).
- **Risk:** MEDIUM.
- **Auth:** none beyond standard build.

### Batch 4.10 · Bucket-B unit-drift fix top-10 (YES-medium)
- **Scope:** Fix 10 highest-value pre-existing unit test files per Phase 3 §2 Bucket-B list (`bio-page.test.ts`, `multi-vertical.test.ts`, `listing-card.test.tsx`, `control-drawer-client.test.tsx`, HQ `HQShell.tsx` missing, world-adapter SQL schema, etc.).
- **Files:** ~10 test files + any production files with shape drift causing the failures.
- **Expected test-fail delta:** –10 files.
- **Risk:** MEDIUM.
- **Auth:** none beyond standard build.

---

## § 6 · Items that CANNOT be closed in Phase 4 without external input

| Item | Needs | Who | Note |
|---|---|---|---|
| **B1 · Price validation** | Customer discovery · interviews / survey / pilot | Owner + external customers | Shop contract §H-B1 explicit gate. Until closed, prices in `pricing-config.ts` remain PROPOSAL and may not hard-code any Stripe-live price. |
| **B9 · Legal review** | Counsel engagement for DAC7 / DSA / PSD2 / Irish consumer-protection / GDPR | Owner + external counsel | Shop contract §H-B9. Blocks PUBLIC Ireland launch, not dev. Phase 4 Stripe sandbox + preview OK. |
| **B3 production migration apply** | Explicit per-migration authorisation to apply `282_nex_shop_membership_schema.sql` to `ijvqdvsvwtwxzcqmoqit` | Owner | CLAUDE.md §5 explicit gate. Phase 4 may author file only. |
| **Music migrations 235/236/240/241 reversal (Batch 10)** | Explicit authorisation to drop stranded prod schema + Storage bucket teardown decision | Owner | Phase 3 §10 "Recommended next steps" item 4. Outside scope-reduction Phase 4 unless owner opens separately. |
| **Phase-u merge (mig 281)** | Merge `phase-u/creator-payments-ireland-entry-2026-11-04` into this worktree's base | Owner | Shop contract §G header note; prerequisite for the proposed `282_*` number. |
| **Stripe live mode** | Real Stripe API keys + webhook signing secret | Owner | Sandbox only in Phase 4. |
| **Owner visual verification** | Visual confirmation on `:3008` dev server of all KEPT routes + Ireland/Indonesia/Worldwide previews | Owner | Sealed 2026-11-01 Continuous Build + Visual Verification Rule. |
| **W4 grace-period scheduler run** | Six-pre-condition fail-safe deletion gate ALL green (download succeeded · W10 audit write · day-20 notification · no legacy rows · bucket cleanup verified · no active ops ticket) | Internal infra + owner | Vault §B4 explicit. Not runnable in Phase 4 even if authored — must wait for W5 + W10 + W12. |
| **Daily Discovery Phase B migration (C-8)** | Separate authorisation per sealed 2026-11-05 doctrine | Owner | §K-6 "RESERVED internally, NOT in public copy until Phase B migration authorised". |
| **Package Contract P1/P2/P3 build** | Per-item authorisation ("build verification" or "remove claim") | Owner | §4 explicit: each is a separate owner decision. |

---

## § 7 · Phase 4 completion criteria (final-report checklist)

The final Phase 4 launch-readiness report must contain:

1. **Per-item BUILT/WIRED/VERIFIED/REMAINING/BLOCKED matrix** for B2, B3, B5, B7, B8, Tests, TypeScript, User Journeys, Stripe Prereqs, Community (same 10 items audited here, side-by-side with Phase 4a current state).
2. **Side-by-side Phase 3 vs Phase 4 §H enforcement-gate status** (B1–B10 + 7 Vault W-sub-checks). Expected: 1 closed → ≥3 closed (B4 preserved + W7 + optionally W5 landed as 4.1/4.2). Each gate line cites exact batches that moved it.
3. **Remaining launch blockers — external vs internal** split. Internal blockers should be zero if Phase 4 lands all authorised batches; external blockers (B1 customer validation, B9 counsel, Stripe keys, visual verification) remain.
4. **Vault W1–W12 status matrix.** All 12 rows. Each marked CLOSED / OPEN / BLOCKED with evidence.
5. **Confirmed test pass rate for KEPT surfaces.** Not `929/1219` but a scoped `X/Y` for KEPT routes only. Explicit list of KEPT test files that pass.
6. **TypeScript error delta.** From 1185 to Phase-4 end count. Tabulated by directory + error-code if non-zero.
7. **Broken-journey status.** For each of J1–J10, status update + blocker/remedy citation.
8. **Owner-visual-verification checklist** reproduced from Phase 3 §8 — unchecked unless owner has confirmed each item.
9. **Build-Commit-Push receipt** per batch (repo root, branch, commit hash, files, test result, pushed Y/N, Vercel Y/N, production verification Y/N).
10. **Explicit statement of what is and is NOT ready for public launch**, honouring the Shop Entitlement Contract §K rule ("advertising a feature whose enforcement is not built is misrepresentation") + Package Contract DRAFT operating rule ("Never promise a feature simply because it appears in a design or database").

---

## § 8 · Appendix · evidence this pass

- Branch: `phase-x/scope-reduction-chat-themes-shop-vault-2026-11-06` · HEAD `8828e68`.
- `git status --short` → 5 modified JSON/JSONL data files unrelated to Phase 4a (knowledge-acquisition promoted-knowledge, programmer-execution command_audit, etc.) — pre-existing, left as-is per read-only pass.
- `npx tsc --noEmit` executed once this pass · error count unchanged from Phase 3 baseline · error-code + error-dir distributions captured in § 3.
- `npm run test` NOT executed this pass; relied on Phase 3 §2 verbatim.
- Shop contract + Package contract + Vault policy sheet read in full.
- Sealed memory `project_nex_scope_reduction_sealed_2026_11_06.md` read in full.
- Community kept-status triple-verified (sealed memory + Phase 3 report + current filesystem presence).

**End of Phase 4a plan.**
