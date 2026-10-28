# NEX · Seven-Area Dependency-Aware Backlog · 2026-10-28

> **Status · AUTONOMOUS WORKSTREAM REGISTER** · continuation of the Phase 1 inventory 2026-10-27 and the Consolidated Decision Register 2026-10-27.
>
> **Purpose:** one durable artefact enumerating every operational-gap finding across the 7 areas that is NOT already captured in the batched material-decisions register D1–D15. Items here are candidates for autonomous completion under the mandate's §2 autonomy rule.
>
> **Sealed holds in force** (unchanged): Vault LOCKED 2026-10-20 · Theme Commerce DRAFT · Package Contract DRAFT · Service Principle DRAFT · pricing baseline (3 unimplemented claims) · migrations 145/202/213/219/221/222/225/227–230/231/232/233 held · 660 unapproved images · email backfill · orphan storage · Live R9 DRAFT · Community Notice security copy · pending-invite privacy · keypad universal · chat master layout · design tokens · NEX never handles payments · A-strict scope · Phase A1 Accommodation · Directory Spine SEALED.
>
> **Companion docs** (authoritative detail):
> - `nex-complete-wiring-programme-inventory-2026-10-27.md` (Phase 1 inventory)
> - `nex-consolidated-decision-register-2026-10-27.md` (D1–D15 batched)
> - `nex-gap-closure-ledger-2026-10-27.md` (G1–G15 schema/config-gated)
> - `nex-supabase-gap-ledger-2026-10-27.md`
> - `nex-integration-verification-ledger-2026-10-27.md`

---

## 1 · Session baseline (2026-10-28 03:46 Jakarta)

| Metric | Value |
|---|---|
| Repo root | `C:/Users/Victus/nexapp` |
| Remote | `https://github.com/Philip2024394/nexapp.git` |
| Branch | `main` |
| HEAD | `85bd4cb` |
| Dirty tree | 165 paths preserved (uncommitted · must stay preserved) |
| Local stash | `pre-nex-fork-snapshot-20261010-200712` (historical · not from this session) |
| TypeScript diagnostics | 1,299 (down from 1,665 session-start; cumulative −366 across sessions) |
| Vitest baseline | not re-run this phase (deferred to pre-commit per batch) |

**Candidate B** (Business-owner Conversations inbox + unread badge) is **verified complete** on disk — the Phase 1 inventory's recommendation has already landed. The `/manage` page mounts `ManageInboxUnreadBadgeClient` with 60s poll + visibility-change refresh; `conversation-service.ts` exposes `unread_count` per conversation; the "inbox" link routes to `/nex-native/conversations`. No further work on Candidate B.

---

## 2 · Honest-state findings · per area (fresh audit 2026-10-28)

Six parallel read-only audits ran against the 7 areas. Vault's audit crashed with a transport error; Vault LOCKED means its autonomous surface area is bounded to doctrine-copy honesty, deferred below.

### 2A · Chat (12 findings · ★★★★★ wired)

| # | Finding | File:line | Severity | Decision needed? |
|---|---|---|---|---|
| C-01 | ~~Message-send failures redirect with `message_error=…` query param but no UI consumer surfaces it~~ · **RESOLVED 2026-10-28** · `ChatErrorBanner` consumer at `chat/peer/[accountId]/_error-banner.tsx` surfaces calm actionable copy; blocking vs non-blocking distinguished · dismiss via Link | — | HIGH | — |
| C-02 | ~~Sticker send failures same pattern as C-01~~ · **RESOLVED 2026-10-28** · same consumer | — | HIGH | — |
| C-03 | ~~Upload errors `upload_error=…` unconsumed~~ · **RESOLVED 2026-10-28** · setter in `_actions.ts:1215` sanitised to bounded enum (`too_large \| unsupported_type \| failed`); server-side `console.warn` preserves diagnostic context; banner renders size- or type-specific copy | — | MEDIUM | — |
| C-04 | ~~Delete errors `delete_error=…` unconsumed; raw `Error.message` leaked into URL~~ · **RESOLVED 2026-10-28** · setter in `_actions.ts:3544` sanitised to bounded enum (`not_found \| not_allowed \| too_late \| failed`); banner renders blocking vs non-blocking copy per class | — | MEDIUM | — |
| C-05 | `/conversations` commerce-gate silent redirect to `/home` with no explanation | `conversations/page.tsx:32-40` | LOW | Y · is this feature-lock or product? |
| C-06 | ~~`/free-chat/call/page.tsx:263-265` renders Mute/Speaker/Add/Record/Keypad buttons with empty onClick handlers~~ · **RESOLVED 2026-10-28** · `CallButton` accepts optional `unavailableReason` prop; marks Mute/Speaker/Add/Record as `disabled + aria-disabled + title` tooltip explaining "not wired up on calls yet"; Keypad has `href` so stays active; End unchanged | — | MEDIUM | — |
| C-07 | `?focus_product=<id>` with unknown id opens FocusedShopSheet with no highlight ("honest-null" per code but user-ambiguous) | `chat/peer/[accountId]/page.tsx:158-161` + `_focused-shop-sheet.tsx` | LOW | N · documentation only |
| C-08 | ~~`?pending_product` dropped across sign-in redirect; only `focus_product` whitelisted~~ · **RESOLVED 2026-10-28** · sign-in redirect at `page.tsx:166-180` now whitelists both params explicitly; both survive the auth round-trip | — | MEDIUM | — |
| C-09 | ~~Empty inbox CTA is a Link, not a button-weight affordance~~ · **RESOLVED 2026-10-28** · empty-state now renders a theme-accent pill (44px tap target, `inline-flex`, "Open Contacts →") below separated explanation text. Preserved `/nex-native/chat` href + mobile-first sizing + secondary hierarchy | — | LOW | — |
| C-10 | ~~Stale comment block documenting the retired "Create free NEX" sticky footer~~ · **RESOLVED 2026-10-28** · comment deleted after verifying (a) parent `/nex-native/` route still redirects guests to `/create-account`, confirming retirement is real, and (b) `isGuest` IS still used at `free-chat/page.tsx:374` passed to `FreeChatComposerClient` — the stale comment's claim that `isGuest` was unused was factually wrong | — | LOW | — |
| C-11 | Chat-prefs migration 199 unapplied; typing + online status fail-closed silently | `chat/peer/[accountId]/page.tsx:172-180` | LOW | N · correctly gated; defer until migration 199 lands |
| C-12 | Unread badge spacing can occlude message body on mobile | `conversations/page.tsx:275-281` | LOW | N · cosmetic responsive refinement |

**Cross-area pattern**: ~~C-01 through C-04 (and C-08) are a SINGLE pattern~~ · **RESOLVED 2026-10-28** · founder authorised the batch under approved UX policy (inline banner · calm actionable · retry only when safe · blocking vs non-blocking) and all 5 findings landed in one coordinated change: shared `ChatErrorBanner` RSC consumer + two safe-enum sanitisations at the setters + sign-in redirect whitelist extension. 15 focused vitest cases cover parameter handling (missing · malformed · unknown enum fallback), role semantics (`alert` vs `status`), copy mapping, and priority order. Zero commits, zero push, zero prod data touched.

### 2B · Themes (6 findings · ★★★★☆ wired)

| # | Finding | File:line | Severity | Decision needed? |
|---|---|---|---|---|
| T-01 | Immersive preview sealed pages lack explicit "Back to themes" affordance on mobile | `themes/[id]/_preview-action-bar.tsx` | LOW | Y · founder removed back button on sealed pages 2026-10-19 |
| T-02 | "Theme applied" toast depends on `?applied=1` URL param rather than action result · fragile under slow redirects | `themes/[id]/page.tsx:501-555` | MEDIUM | Y · UX decision on confirmation shape |
| T-03 | `LayoutAccommodation` has no in-app "Back to cover catalog" affordance | `cover/layouts.tsx:353-464` | LOW | Y · founder decision on cover-nav uniformity |
| T-04 | ~~Accommodation blurb missing from COVER_LAYOUT_BLURB~~ | ~~`cover-themes-library/page.tsx` + `cover/preview/page.tsx`~~ | ~~HIGH~~ | **RESOLVED commit `ff45f92`** |
| T-05 | Trial badge may show stale "locked" state briefly after cross-tab activation (self-heals on revalidatePath) | `chat-themes-library/_phone-tile.tsx:213-214` · `_load-library-data.ts:77-79` | LOW | Y · surface "refresh page" hint? |
| T-06 | ~~Package effect names "warm-glow-pulse"/"steam-rising" not in effect union~~ | — | — | **DISAMBIGUATION NEEDED** — the audit says motion-library has these, TS flagged a type-union mismatch earlier. Likely two separate maps have drifted. Investigation-only. |

### 2C · Intro / Onboarding (8 findings · ★★★★☆ wired)

| # | Finding | File:line | Severity | Decision needed? |
|---|---|---|---|---|
| I-01 | S1/S2/S3 intent-driven signup chain completes without visible "you're done" state | `create-account/*/_actions.ts:383-392` + building step | HIGH | Y · ceremony vs silent forward |
| I-02 | No canonical "finish your profile" entry under `/settings` for users who abandon onboarding | `settings/_sections.ts` | MEDIUM | Y · for all users or incomplete-business only? |
| I-03 | Face sign-in error message is generic ("use password instead") regardless of failure reason | `sign-in/_face-button.tsx:77` | MEDIUM | Y · differentiated messages? |
| I-04 | Welcome-card pricing suppression · **COMPLIANT** with sealed 2026-10-21 principle | `welcome/page.tsx:843-856` | OK | N |
| I-05 | Trial-copy guards sealed · negative tests pass · **COMPLIANT** | `welcome/__tests__/welcome-trial-copy.test.ts` | OK | N |
| I-06 | Signup collects email + password only; display_name synthesised from email prefix (by design) | `create-account/_two-step-signup-form.tsx:103-106` | LOW | Y · push profile completion earlier? |
| I-07 | WebAuthn enrol-finish has no visible "Face registered ✓" success before redirect | `sign-in/_face-button.tsx:70` | LOW | Y · add explicit success? |
| I-08 | Signed-in `/welcome` bypass intentional (directive 2026-10-18) | `welcome/page.tsx:172` + `settings/page.tsx:308` | OK | N |

### 2D · Shop (15 findings · ★★★★☆ wired)

| # | Finding | File:line | Severity | Decision needed? |
|---|---|---|---|---|
| S-01 | `/cart` renders fully with no visible "beta/pre-launch" indicator; gated by `?commerce=1` undisclosed | `cart/page.tsx:51` | HIGH | Y · phase boundary visibility |
| S-02 | `/orders/[orderId]` same implicit gate | `orders/[orderId]/page.tsx` | MEDIUM | Y · same gate policy |
| S-03 | "Order Now" CTA implies checkout; actually opens chat · adjacent to "NEX never handles payments" doctrine | `[businessSlug]/[productId]/page.tsx:237-241` + `_order-bar.tsx` | HIGH | Y · global CTA copy decision |
| S-04 | Cart submit redirects silently to chat; no inline confirmation | `_actions.ts:2281-2550` | MEDIUM | Y · toast tone |
| S-05 | Empty public shop state doesn't distinguish "no products" from "all sold out" | `[businessSlug]/page.tsx:162-175` | MEDIUM | Y · product grid refactor scope |
| S-06 | `/manage/products` empty state redirects to shop editor; no inline add-product form | `manage/products/page.tsx:327-343` | HIGH | Y · product-add surface decision |
| S-07 | `/manage/gallery` upload success relies on list refresh (no banner) | `manage/gallery/page.tsx:59` | LOW | N · cosmetic |
| S-08 | `/manage/categories` rename + move operations non-atomic (no transaction guard) | `manage/categories/_actions.ts` | MEDIUM | Y · data-consistency fix scope |
| S-09 | `/manage/live` posts page honest · "geo-boundary filter is phase-2" explicitly labelled | `manage/live/page.tsx:78-82` | OK | N |
| S-10 | `/manage/shop` away-mode toggle doesn't surface active state as persistent chip | `manage/shop/page.tsx` | LOW | N · cosmetic chip addition |
| S-11 | Cart address client-side pre-validation missing · server rejects silently then user retries | `cart/_cart-client.tsx` | LOW | N · HTML required attributes |
| S-12 | `/manage/products` renders `low_stock` pill but toggle only accepts in_stock/sold_out · UI implies impossible state change | `manage/products/page.tsx:253-254` | MEDIUM | Y · product-service refactor scope |
| S-13 | `/manage/email` subheading says "compose and send from here" but compose is on sub-route | `manage/email/page.tsx:55` | MEDIUM | N · trivial copy fix |
| S-14 | `/manage/site` honest · site-builder purpose statement correct | `manage/site/page.tsx:48-50` | OK | N |
| S-15 | `/manage/promos` migration gate works correctly (`MigrationGate` component) | `manage/promos/page.tsx:109-143` | OK | N |

### 2E · Directory (10 findings · ★★★★★ Phase A sealed)

| # | Finding | File:line | Severity | Decision needed? |
|---|---|---|---|---|
| D-01 | Filter sheet exposes 5 category pills; landing exposes 8 category tiles · 3 categories (Travel/Transport/Deals) + Accommodation unreachable from filter | `_filter-sheet-client.tsx:55-64` vs `landing-category-mapping.ts:124-143` | MEDIUM | Y · scope: filter minimal by design? |
| D-02 | Search Feature A empty state uses generic "No eligible listings yet" copy, no search-specific signal | `directory/page.tsx:152-178` + `search-service.ts:96-151` | LOW | Y · search-empty vs filter-empty copy? |
| D-03 | Currency picker writes cookie but FX pipeline (Slice 2) renders only when `getDailyFxSnapshot()` succeeds · no UI when FX unavailable | `_currency-picker-client.tsx:1-25` + `_landing-directory-view.tsx:189-217` | MEDIUM | Y · disable picker or disclaimer? |
| D-04 | A-strict CATEGORY_FALLBACK scope has no regression test proving non-food/non-ID rows never get fallback | `directory-image-adapter.ts:61-75` | LOW | N · pure test addition |
| D-05 | Orphaned canonical row (deleted after feed render) → tap → `notFound()` 404 | `directory/[id]/page.tsx:248-294` | HIGH | Y · accept 404 or pre-check? |
| D-06 | `?km=50` + location-denied → distance filter silently ignored · chip shows generic hint | `_directory-results.tsx:189-190` + `:249-265` | LOW | Y · targeted hint? |
| D-07 | Search→detail slug hand-off works for both UUID + nex_business slug but has no regression test | `search-service.ts:277-304` + `[id]/page.tsx:248-294` | LOW | N · pure test addition |
| D-08 | Pagination shows "Next" on page 1 when mocks visible but real feed is empty · tap leads to empty page 2 | `_landing-directory-view.tsx:291-308` | LOW | Y · pagination logic refinement |
| D-09 | "Coming soon" filter sections render with opacity+chip but no `aria-disabled` | `_filter-sheet-client.tsx:257-277` + `:312-321` | LOW | N · a11y improvement |
| D-10 | Featured Deals empty-state CTA to `/directory` loses the per-visit seed thread | `landing/page.tsx:412-428` | LOW | Y · thread seed? |

### 2F · Live (10 findings · ★★★★★ wired)

| # | Finding | File:line | Severity | Decision needed? |
|---|---|---|---|---|
| L-01 | R9 upsell copy "Live is a Shop member tool…" ships against R9 DRAFT (not finalised) | `live-eligibility.ts` · `_go-live-client.tsx:233-235` | MEDIUM | Y · R9 finalisation gate |
| L-02 | Live heartbeat failures swallowed by `catch(() => {})` with no log | `_go-live-client.tsx:362-417` | HIGH | Y (dev-only vs always-on log) |
| L-03 | Dev-impersonation (`NEX_DEV_IMPERSONATE_HANDLE`) uses REAL seeded tier · mutating actions pre-audit-table | `dev-impersonation.ts:47-90` · `_actions.ts:39` | HIGH | Y · audit table doctrine timeline |
| L-04 | BroadcasterLibrarySheet 3 tiles (Go Live / Create / Studio) route to real pages but destinations need integration-test verification | `BroadcasterLibrarySheet.tsx` + `_video-viewer-client.tsx:1356-1389` | MEDIUM | N · test addition |
| L-05 | `/live-commerce/[sessionId]` → "Order Now" → `?pending_product=…&live_session_id=…` · chat peer page must read both params; untested | `_viewer-client.tsx:689-702` + chat peer page | MEDIUM | N · integration test addition |
| L-06 | Viewer count race condition with MAX_VIEWERS=10 enforcement · brief visual confusion | `_go-live-client.tsx:115,272` | LOW | Y · guarantee vs advisory |
| L-07 | HLS player attach has no `.catch` · stream errors show black screen | `_video-viewer-client.tsx:282-299` | MEDIUM | Y · banner vs overlay vs log |
| L-08 | Live-posts migration unapplied · comments are client-only mocks · documented but could be clearer | `_video-viewer-client.tsx:183-229` | LOW | Y · timeline for live-posts persistence |
| L-09 | LIVE badge may render before first viewer's WebRTC offer answered · minor timing edge | `[sessionId]/_viewer-client.tsx:1103-1121` | LOW | Y · badge semantic |
| L-10 | Featured-product picker empty-state uses R9 DRAFT upsell tone · should be centralised post-R9 | `_go-live-client.tsx:1281-1296` | LOW | Y · centralise upsell copy |

### 2G · Vault (DEFERRED · LOCKED)

Vault audit crashed with a transport error. Vault LOCKED 2026-10-20 bounds autonomous surface area to **doctrine-copy-honesty only** · no entitlement/quota/retention/deletion/download work allowed until founder lifts W1–W12.

Deferred until Vault lift. Expected scope on re-audit:
- Confirm all `/vault/home/*` empty category rooms honestly label themselves as "coming soon"
- Confirm Vault promise copy anywhere in sign-up / welcome flow honestly reflects LOCKED status
- Confirm 7-day-trial + 30-day-grace sealed decisions aren't advertised ahead of implementation

No autonomous work queued.

---

## 3 · Cross-cutting patterns

Seven patterns emerged across the 6 reports:

### P1 · Silent URL-error params not consumed by UI
Pages redirect with `?*_error=…` params on action failure; UI has no consumer. **Affected:** C-01, C-02, C-03, C-04, C-08. **Fix shape:** one error-banner consumer per page + whitelist missing params in sign-in handoff. **Blocker:** product policy on tone/retry.

### P2 · Silent catch handlers hide real failures
`catch(() => {})` or missing `.catch()` on async flows swallow errors with no observability. **Affected:** L-02 (heartbeat), L-07 (HLS). **Fix shape:** add console.warn / console.error at the catch site; no UX change. **Blocker:** none (console-only logging is autonomous per mandate).

### P3 · "Did it work?" ambiguity on success states
Actions complete but UI gives no explicit "✓ done" state. **Affected:** I-01 (onboarding), T-02 (theme applied), S-04 (cart submit), S-07 (gallery), I-07 (face enrol). **Fix shape:** success banners / toasts / markers. **Blocker:** per-flow UX decision.

### P4 · Doctrine-adjacent CTA copy risks
Button labels imply features that doctrine bans. **Affected:** S-03 ("Order Now" → chat), L-01 + L-10 (R9 DRAFT upsell shipped). **Fix shape:** global copy audit + sealed sign-off before change. **Blocker:** founder copy approval.

### P5 · Phase/gating markup inconsistency
Pre-launch features render with no visible indicator of their phase state. **Affected:** S-01 (cart), S-02 (orders), D-03 (currency FX). **Fix shape:** persistent beta/phase chip on gated surfaces. **Blocker:** phase-boundary policy.

### P6 · Broken hand-offs between areas
Context lost at area boundaries. **Affected:** C-08 (Intro↔Chat sign-in loses pending_product), L-05 (Live→Chat context), S-06 (Shop→product-add dead-end), D-05 (Directory→detail 404). **Fix shape:** URL param whitelist audit; integration tests. **Blocker:** per-hand-off decision.

### P7 · UI claims features that don't execute
UI promises mutations the backend doesn't support. **Affected:** S-12 (low_stock pill unchangeable), S-13 (compose "from here"), S-10 (away-mode no state badge), D-09 (coming-soon a11y). **Fix shape:** honest copy / disabled state / move affordance to real surface. **Blocker:** per-finding scope.

---

## 4 · Autonomous backlog (prioritised · no new decisions needed)

Items I can execute WITHOUT further founder input, per the mandate's §2 autonomy rule and the consolidated register's autonomous-workstream clause.

### Tier A · Pure hygiene (truly reversible · minimal blast radius)

| ID | Finding | Scope | Est. commits |
|---|---|---|---|
| A1 | C-10 · Clean up stale "Create free NEX" comment block | 1 file, docs-cleanup only | 1 |
| A2 | S-13 · `/manage/email` subheading honest copy ("Create campaigns and manage lists here") | 1 file, copy only, no feature claim added | 1 |
| A3 | D-04 · Add regression test for CATEGORY_FALLBACK A-strict scope | 1 test file, no behaviour change | 1 |
| A4 | D-07 · Add regression test for search→detail slug routing | 1 test file, no behaviour change | 1 |
| A5 | L-04 · Add integration test for BroadcasterLibrarySheet tile→destination handoff | 1 test file | 1 |
| A6 | L-05 · Add integration test for live-commerce → chat context pass (pending_product + live_session_id) | 1 test file | 1 |
| A7 | D-09 · Add `aria-disabled="true"` to "coming soon" filter sections | 1 file, a11y only | 1 |

### Tier B · Observability (console-only · no UX change)

| ID | Finding | Scope | Est. commits |
|---|---|---|---|
| B1 | L-02 · Add `console.warn("[live-heartbeat] ping failed", err)` to heartbeat catch | 1 file | 1 |
| B2 | L-07 · Chain `.catch((err) => console.error("[video-hls]", err))` on `attachHlsPlayer` | 1 file | 1 |

### Tier C · Investigation-first (gather evidence, no code change)

| ID | Finding | Scope | Est. commits |
|---|---|---|---|
| C1 | T-06 · Reconcile effect-name union vs motion-library map (confirm "warm-glow-pulse" / "steam-rising" live state) | 1 investigation note | 0 (research only) |

### Tier D · TypeScript diagnostics that block real work

**TS reduction log · 2026-10-28** · root-cause clustering of the 1,299-error baseline. Fixes are made in small attributable groups and the full compiler is re-run after each.

| Wave | Date | Group | Fix | Delta | Baseline → Final |
|---|---|---|---|---|---|
| 1 | 2026-10-28 | TS2578 (10 err) · unused `@ts-expect-error` directives in `i18n.test.ts` (×9) + `wave-a-language-framework.ts` (×1) | Removed stale directives (test shims that modern TS no longer flags) + reworded one documentation comment that TS was mistakenly parsing as a directive. 9 valid directives still protecting `window = undefined` SSR assertions were PRESERVED. Zero suppression added · 10 suppressors removed. | **−10** | 1299 → 1289 |
| 2 | 2026-10-28 | TS2307 verified dead imports (6 of 260) · per-site classification via `scripts/ts2307-candidates.mjs` · 221 locations rejected as **load-bearing** (symbol used elsewhere · their missing module is a separate problem) · 25 parse-failed-skipped · 7 partial-use-skipped · 1 re-export miscategorised by same-file-only analyzer and preserved after manually confirming `indexForSearch.ts` consumes it. **6 cleanly removable**: `SOURCE_GUARDIAN_REJECTIONS_COLLECTION` in 2 test files, `persistCapabilityGap` in orchestrator test, `generateKeyPair` + `buildFounderKeyRecordForTest/FounderKeyManifest` in runtime-12-attacks test, `CapabilityGap` type in `mission.ts`. Every removal verified: (a) no other reference in file, (b) no side-effect import pattern, (c) type-only or test-only context. Nothing created · no shim · no module written · no feature behavior changed. | **−6** | 1289 → 1283 |
| 3 | 2026-10-28 | TS2353 small-cluster · **(a)** 2× `WebkitColumnBreakInside` CSS vendor-prefix stripped from `NexPinterestFeed.tsx` + `listing-card.tsx` (property obsolete since Safari 10 (2017); dropped from csstype; `breakInside: "avoid"` already covers modern browsers; `pageBreakInside: "avoid"` kept where present as print fallback). Pure UI-only change · no runtime behavior lost. **(b)** 3× `interior` property added to `NexHudTheme` interface in `theme.ts`. The feature shipped 2026-08-28 (dated doctrine comments in-file + 12-step heroSequence player) but the type was never updated — `NexHudFrame.tsx:872-878` already consumes `theme.interior?.backgroundSrc / speakingBackgrounds / speakingSwapMs / backgroundFilter / heroSequence` with optional chaining. The new interface shape mirrors the consumer's prop surface verbatim; all 5 sub-fields optional (matches existing TITANIUM/PINK_METAL/GOLD call-site shape with no edits to the themes themselves). Zero `any` · zero cast · zero suppression. **Downstream win**: 5 TS2339 errors also resolved (consumer-side `theme.interior.X` accesses that were erroring because `interior` wasn't a known property). | **−10 total** (−5 direct TS2353 + −5 downstream TS2339) | 1283 → 1273 |
| 4 | 2026-10-28 | TS2353 `priority_prefixes` (8 err) · **STOPPED · recorded as owner-decision blocker · no fix applied** · Evidence trail: field appears in 8 test call sites in `capability-repository-discovery-s1-repair.test.ts` (×7) + `capability-declaration-bridge.test.ts` (×1), all targeting founder-authorised "S1 Repair" scope. Production function `discoverRepositoryCandidates` in `capability-repository-discovery.ts:48` **does NOT reference `priority_prefixes` or sibling `definition_intent`** anywhere in the implementation. Running the test file confirms: **15 of 19 tests FAILING** — tests describe an aspirational S1 Repair feature that was planned, documented ("priority_prefixes is the SOLE behavioural difference"), typed into test shapes, but never shipped in the production function. **NOT the same pattern as Wave 3's `interior`** — in Wave 3 the consumer actively read the field with optional chaining (shipped but untyped). Here the consumer ignores the field entirely (unimplemented feature with aspirational tests). **Why we did NOT extend the type**: adding `priority_prefixes?` to `DiscoverRepositoryCandidatesInput` would silence TS2353 but create a silent false public contract — any future caller passing `priority_prefixes: [...]` would compile cleanly while the walker continues to ignore the field. That violates the directive "Do not change runtime behavior merely to reduce the diagnostic count" and the sealed operating rule "Never promise a feature simply because it appears in a design or database." **Why we did NOT remove from test shapes**: the tests describe the intended behavior; removing the field without completing the implementation would erase evidence of what S1 Repair was supposed to do. **Owner decision required**: (a) complete the S1 Repair implementation (`priority_prefixes` biases BFS to the prefixed roots; `definition_intent` boosts declaration-site scoring) and run tests to green; OR (b) formally retire the planned S1 Repair, delete the test file, and drop field references everywhere; OR (c) accept the current state and leave the 8 TS2353 errors as living documentation of unfinished work. **No code change · no type change · 8 TS2353 errors remain.** | **0** (intentionally no change) | 1273 → 1273 |
| 6 | 2026-10-28 | TS2353 `RefacingCapabilityKey` cluster (4 err) · **MIXED outcome** · (a) `kit_or_product_supplier` × 3 = **FIXED** (Wave 3 pattern · `isStairpartsSupplier` at `directorySeedLoader.ts:423` actively reads `seed.capabilities?.kit_or_product_supplier === "yes"` · consumer-wired, documented at line 420 as the Trade Centre Stairparts chip filter · the enum entry was simply missing · added to the union with a dated comment linking the type to its consumer). (b) `manufacture` × 1 = **FIXED** (test typo · the valid enum key is `staircase_manufacture` · the test's capability line is semantic padding for a seed representing a manufacturer, and the function doesn't read it either way — the actual assertion runs through the `business_type === "STAIRCASE_MANUFACTURER"` branch · corrected to the canonical key with a comment explaining why). **Session context (owner-clarified 2026-10-28 verbatim)**: "the staircase manufacture or stiracse parts can be moved out of the nexapp into trades app if its better for our app nexapp we wont be useing in nexapp stairacase files" — this entire `src/lib/nex/centre-publishing/*` tree is **legacy carryover from the trades monorepo** and is not nexapp product code. The Wave 6 fix is still correct for the current state (the files are here, they type-check), but owner-authorised **move-to-trades** is on the table for a separate cleanup. Many of the deferred TS2307 clusters (`nex-cap/*`, `nex-intelligence/*`, `apps/materials/*`, legacy `hammerex_*`, etc.) are likely in the same category — the right disposition is **move or delete, not type-fix**. Hygiene continues on these files only while they remain in-tree. | **−5** (−4 direct TS2353 + −1 downstream) | 1273 → 1268 |
| 5 | 2026-10-28 | TS2353 `intelligence_status` (3 err) · **STOPPED · recorded as owner-decision blocker · no fix applied · same pattern as Wave 4** · Evidence trail: field appears in 3 test call sites in `src/lib/nex/master-ai/intelligence-status.test.ts` (lines 288, 326, 363), all targeting founder-authorised "NI Doctrine Phase 2" (`known-intelligence-profiles.ts:1-16` · "Founder 2026-09-16 · AUTHORIZE (NI Doctrine Phase 2)"). Doctrine comment at line 12 explicitly documents the intended API: `recordCapabilityProfile({ agent_id, ..., intelligence_status: <constant> })`. Production function `recordCapabilityProfile` at `agent-capability-profile.ts:72-85` validates only 5 fields (agent_id, mission, current_state, reliability, learning_trajectory) · **no intelligence_status validator exists**. The `Nex1IntelligenceProfile` type is defined and inert constants (NEX1_CAPABILITY_A_PROFILE etc.) are authored, but the recording API was never extended to accept or validate the field. Running the test file confirms: **3 of 19 tests FAILING** — exactly the 3 that assert `.toThrow(/intelligence_status/)` on specific invalid NATIVE/HYBRID claims (NATIVE claim with hidden LLM delegation, etc.). The validation rules per doctrine (NATIVE must have no delegation · HYBRID must have at least one delegation · etc.) are specified in-test but unimplemented. **Why we did NOT extend the type**: adding `intelligence_status?: Nex1IntelligenceProfile` to `AgentCapabilityProfile` would silence 3 TS2353 errors but would NOT fix the 3 failing tests (they assert validation behavior, not type shape), AND would create a silent false public contract — a future caller passing a NATIVE claim with hidden LLM delegation would compile cleanly, be recorded to JSONL, and the intended rejection would never fire. **Why we did NOT remove the field from tests**: the tests encode the NI Doctrine Phase 2 authorization rules; removing them deletes the behavioral specification of what founder-authorised recording was supposed to enforce. **Owner decision required**: (a) complete NI Doctrine Phase 2 — extend `AgentCapabilityProfile` + implement validation in `recordCapabilityProfile` matching the test specs; OR (b) formally retire NI Doctrine Phase 2 recording — delete the intelligence_status validation tests, keep the inert constants as documentation; OR (c) accept the current state. **No code change · no type change · 3 TS2353 errors remain.** | **0** (intentionally no change) | 1273 → 1273 |

**Explicitly out-of-scope for autonomous TS reduction** (require owner decisions):
- **TS2307 `@/lib/nexapp/tokens` (30 err)** · creating the module would seal design-token values the sealed Design Tokens Rule 2026-10-17 says are "pending explicit owner choice." Would collide with the seal. **DEFER** until canonical token palette is approved.
- **TS2307 other missing modules (~230 err total)** · `@/lib/nex-cap/*` (37), `@/lib/nex-intelligence/*` (20), `@/lib/app-builder/*` (9), `@/apps/materials/*` (14), etc. Each cluster requires either: (a) confirming the referenced legacy module is dead code and the imports should be removed, or (b) producing a shim that captures the right contract. **Needs owner intent per cluster.**
- **TS2459 (5 err)** · "declared locally but not exported." Each case needs owner intent: was `export` forgotten, or is the symbol intentionally internal? **Judgment call per case.**
- **TS7006 implicit-any (167 err)** · fixing requires knowing the intended parameter type. Without that context, risk of introducing incorrect types. Should be addressed when editing the containing function for other reasons, not as a sweeping pass.

Historical TS wave reduced 1,665 → 1,299. Continuing only on diagnostics that **obstruct** a Tier A/B/C item (not scoreboard-chasing). Will decide per touch.

### Items explicitly NOT in autonomous backlog

Everything else listed in §2 has a product-policy decision attached and belongs in the consolidated-decisions register. Specifically:
- All P1 (silent URL-error) findings · need tone/retry decision
- All P3 (success state) findings · need per-flow UX decision
- All P4 (CTA copy) findings · need founder copy approval
- All P5 (phase gating) findings · need phase-boundary policy
- Most P6 (hand-off) findings · need per-case product decision
- Most P7 (UI claims) findings · need per-finding scope

These do not block autonomous progress; they wait for the next batched owner review.

---

## 5 · Dependencies

```
Tier A items (A1–A7) are mutually independent · can execute in any order.

Tier B items (B1, B2) are mutually independent.

Tier C1 (T-06 investigation) feeds into a possible future Tier A item (either
delete dead effect references OR add missing effects to type union · founder
scope decision).

Tier D touches intersect specific Tier A/B edits as they land.

NO Tier A/B/C item depends on any batched decision (D1–D15 in consolidated
register, G1–G15 in gap-closure ledger). All migration-gated / env-gated /
product-gated work remains in those registers.
```

---

## 6 · Recommended first journey · Tier B + Tier A combined mini-batch

**Rationale:** Mandate explicitly flags "silent fallbacks" as dishonest-state. B1 and B2 directly address the silent-catch pattern (P2) with observability-only changes · no UX, no copy, no feature promise. Combined with Tier A hygiene items in isolated commits, this is a safe, measurable, cross-area batch that demonstrates the operating cadence without touching any sealed hold.

**Proposed sequence:**

1. **B1** · Live heartbeat observability (`_go-live-client.tsx` catch · 1 line + comment) · one commit
2. **B2** · HLS attach observability (`_video-viewer-client.tsx:282-299` · 1 line + comment) · one commit
3. **A1** · Delete stale "Create free NEX" comment block (`free-chat/page.tsx:385-393`) · one commit
4. **A2** · `/manage/email` subheading copy (1 line) · one commit
5. **A3** · CATEGORY_FALLBACK regression test (`__tests__/` new file) · one commit
6. **A7** · `aria-disabled` on coming-soon filter sections · one commit
7. Batch push authorisation after 2–3 commits land · verify dirty tree still at 165 before each stage

Expected outcome: 6 micro-commits · ~0 TS delta (no behaviour change) · dirty tree preserved at 165 · observability improved on 2 silent-catch paths · 3 copy/hygiene fixes · 1 new test · zero sealed hold touched · zero migration applied · zero founder decision required.

---

## 7 · What this register does NOT do

- Does **not** apply any migration (D1–D5 batched · founder gate).
- Does **not** change any env (D-D5 · founder gate).
- Does **not** advance any locked policy (Vault LOCKED, Theme Commerce DRAFT, Package Contract DRAFT, Service Principle DRAFT).
- Does **not** rewrite founder-created UI (sealed Chat Master Layout, 10 cover layouts, 5 live-world themes, welcome cards, package page).
- Does **not** promise any price, trial, badge, tier benefit, boosted-message count, or cancel-any-time commitment not already shipped.
- Does **not** touch customer data.
- Does **not** commit the 14 untracked doctrines on the owner's behalf.
- Does **not** declare any area "complete" that depends on a batched decision.

Everything in §4 is executable without further owner input. Everything in §2 that's not in §4 waits for the next batched decision cycle (see consolidated register D1–D15 + gap ledger G1–G15).

---

## 9 · NEX legacy-residue audit · 2026-10-28 · PHASE 1 READ-ONLY · owner-authorised

Owner clarification 2026-10-28 (verbatim): *"the staircase manufacture or stiracse parts can be moved out of the nexapp into trades app if its better for our app nexapp we wont be useing in nexapp stairacase files"*

Phase 1 audit scope · read-only inventory of 5 suspected-legacy clusters. 3 parallel Explore agents returned file lists, reverse-dependency maps, and classifications. No code changed. No files moved. Findings presented as **batches for separate owner approval**.

### 9A · Cluster findings summary

| Cluster | Files | TS err | nex-native callers? | Classification |
|---|---|---|---|---|
| `src/lib/nex/centre-publishing/*` (staircase + Trade Centre feed) | 14 code + 2 tests + 137 image assets + 1 migration (065) | 5 | **YES** · 4 Trade Centre UI components + 2 web-scraper lib files | **MIXED** · staircase is clean move, Trade Centre infra needs decision |
| `src/lib/nex-agent/code-engine/*` (NEX1 agent programming layer) | 257 (192 code + 65 test) | 187 | **0** (metadata registry only) | **LEGACY-ISOLATED** · founder-authorised sealed infra, zero product callers |
| `src/lib/nex/capability-graph/*` + `src/lib/nex/capability-runtime/*` (Wave 8 infra) | 36 (28 code + 8 test) | 2 | **0** | **LEGACY-ISOLATED** · "founder-authorised 2026-09-23 · additive · inert", explicitly non-integrated |
| `src/lib/nex/intelligence/*` (vestigial barrel) | 12 (10 code + 2 test) | 6 | **0** · 8 callers import `intelligence-storage-grid` NOT this | **OBSOLETE** · dead weight |
| `src/components/nex-app/materials/*` (orphan UI tree) | 15 UI components | 16 TS2307 | **0** · zero consumers | **OBSOLETE** · broken imports to nonexistent `@/apps/materials/_schema/*`, no backend ever shipped |
| Legacy `hammerex_*` Supabase reads (56 tables · 100 files) | — | — | **TRANSITIVE** via `apiHelpers.ts` (tier/rate-limit/history), `ab/agents.ts`, `backup/*` | **LEGACY-COUPLED · RUNTIME RISK** · tables don't exist in nex Supabase, silent runtime failure risk if nex-native transitively reaches these |

### 9B · Centre Feed boundary · RESOLVED 2026-10-28

**Owner-clarified 2026-10-28** (verbatim): *"trade center is not part of nexapp"*

Decision is **locked**: Trade Centre feed is NOT nexapp product. Moves to trades app together with staircase/stairparts.

**Evidence supporting the decision** (from the Phase 1 Trade Centre audit sub-task):
- Trade Centre reads `directory_seeds` (walker-harvested trades data) via `directorySeedsDb.ts`. Does NOT read `nex_business`, `nex_product`, `business_canonical`, `watch_listing_directory_v`, or `nex_live_post_directory_v` — the sealed NEX Directory Spine (2026-10-07) is a completely separate system.
- `/nex-app/centre/page.tsx` **does not exist** — Trade Centre is referenced from `MainGrid.tsx` + `NexSectionsNav.tsx` navigation chips but the destination page is absent. The feature is unmounted orphan code.
- 100% staircase content — only "Staircase Refacing" category is enabled; all 26 `RefacingCapabilityKey` keys are staircase-specific.
- Zero coupling to NEX Shop — does not render owner-authored `nex_business` shops.

**Batch C scope is now the WIDE option** (previous C2): the whole Trade Centre tree moves. The narrow option (C1) is retired.

### 9B-superseded · prior question text (kept for history)

The staircase cluster at `src/lib/nex/centre-publishing/*` is NOT purely staircase. It carries the broader **Trade Centre Feed** infrastructure: `CentreFeedItem` type + `isStairpartsSupplier` filter + `directorySeedsDb.ts` + Centre Feed cache. The nex-native UI components actively consuming it are:
- `src/components/nex-app/refacing/TradeProfileSheet.tsx` (refacing-trade cards)
- `src/components/nex-app/centre/NexCentreLiveFeed.tsx` (main Trade Centre feed)
- `src/components/nex-app/centre/ProductDetailsSheet.tsx` + `MerchantProfileSheet.tsx`
- `src/components/nex-app/shell/CentreFeedPreloader.tsx`

Plus 2 web-scraper library files (`src/lib/nex/collection/candidateExtractor.ts` + `urlQueueProcessor.ts`) that use `RefacingCapabilityKey` for multi-service classification.

**Question for owner**: Is **Trade Centre feed** itself NEX product, or is it trades-era residue that should also move? The staircase+stairparts category CAN cleanly move out of Trade Centre regardless, but if Trade Centre overall stays, the move is narrower (just staircase images + the staircase category entries). If Trade Centre is also trades-era, Batch C expands significantly.

### 9C · Proposed batched transfer plan (BLOCKED pending owner approval per batch)

Each batch is independently authorizable. Nothing executes until owner says "approve Batch X."

**Batch A · OBSOLETE deletions · lowest risk · pure subtraction** (candidates: nothing imports them)
- **A1**: `src/components/nex-app/materials/*` (15 files · deletes 16 TS2307 errors · zero consumers · imports a `_schema/*` backend that never shipped)
- **A2**: `src/lib/nex/intelligence/*` (12 files · deletes 6 TS errors · the apparent callers actually use `intelligence-storage-grid` instead)

**Batch B · NEX agent/code-engine tooling → trades** (clearly separable, big TS yield)
- **B1**: `src/lib/nex-agent/code-engine/*` (257 files · ~187 TS errors) · founder-authorised 2026-09-16 NEX1 agent programming layer. Includes the files holding Wave 4 (`priority_prefixes`) and partial Wave 5 (`intelligence_status`) blockers — moving these clusters resolves both blockers in nexapp by removing their containing files entirely.
- **B2**: `src/lib/nex/capability-graph/*` + `src/lib/nex/capability-runtime/*` (36 files · 2 errors) · "Wave 8 infra · additive · inert" per internal doctrine comments. Zero nex-native integration.
- **B3**: `src/lib/nex/master-ai/*` (contains `intelligence-status.test.ts` + Wave 5 blocker; registers metadata for B1 modules) · move with B1-B2 to keep the agent-infra tree intact.

**Batch C · Trade Centre + staircase/stairparts move to trades · LOCKED SCOPE** (owner-resolved 2026-10-28 · Trade Centre is NOT part of nexapp)

Full cluster moves as one atomic transfer:
- `src/lib/nex/centre-publishing/*` (14 code files + 2 tests) — directorySeedLoader + stairpartsPool + refacingMembership + directorySeedsDb + imageMatcher + indexForSearch + publishToFeed + paidMemberEntitlements + collectorNotifications + mockFeed + tradeCategoryRegistry + categories + types + index
- `src/components/nex-app/centre/*` — NexCentreLiveFeed + ProductDetailsSheet + MerchantProfileSheet + CentreFeedPreloader
- `src/components/nex-app/refacing/TradeProfileSheet.tsx`
- `src/lib/nex/collection/candidateExtractor.ts` + `src/lib/nex/collection/urlQueueProcessor.ts` (web-scraper, consumes RefacingCapabilityKey)
- Static assets: `public/staircase-renovations/` (125 PNG files) + `public/crown-banners/staircase-*.png` (12 files)
- Supabase schema: migration 065 adds `business_category` CHECK including `'staircase-company'` — may need coordinated schema change on trades side (NOT a nexapp migration to apply, but a trades-side acceptance task)
- Navigation chips in `src/components/nex-app/MainGrid.tsx` + `src/components/nex-app/NexSectionsNav.tsx` reference `/nex-app/centre` — remove those entries (route is unmounted already, so removing the chip is purely visual cleanup)
- Low-touch nexapp survivors to leave alone: `src/lib/nex-native/site-templates.ts`, `src/lib/nex-native/directory/landing-category-mapping.ts`, `src/lib/nex-native/cover-layout-suggest.ts` only STRING-match `"staircase-company"` as a business_category label; they don't import from centre-publishing. Keep as-is pending separate owner decision on whether to retire `staircase-company` as a `nex_business.business_category` value nexapp-side.

**Batch D · Hammerex_* runtime risk · SAFETY-CRITICAL (separate work stream, not just TS cleanup)**
- **D1**: Audit which nex-native routes transitively reach `src/lib/nex/apiHelpers.ts` (tier/rate-limit/history functions), `src/lib/nex/ab/{agents.ts,queue.ts}`, and `src/lib/nex/backup/*`. These paths read `hammerex_*` tables that DO NOT EXIST in the nex Supabase project (ijvqdvsvwtwxzcqmoqit). Any traversal triggers silent empty-result or runtime error per sealed CLAUDE.md note.
- **D2**: Per-table decision: migrate schema to nex Supabase · extract reads into nex-native · OR drop the feature. 56 tables need per-table disposition.
- **D3**: This batch is **not just TS hygiene** — it's production correctness. Needs its own owner-decision gate separate from TS reduction.

**Batch E · Semantic cleanup (low priority, incremental)**
- `homeowners` enum pervasive in `src/lib/nex/` (per CLAUDE.md fork hygiene note); rename incrementally when touching containing files, not in bulk
- `trade-off` term appears 4× in nex-native staircase-advisor (semantic only, not breaking)
- `thenetworkers`/`van-wrap`/`trade-center` fixture copy strings; isolated, no runtime effect
- `apprenticeships`/`xrated-trades`: ZERO occurrences (already clean)

### 9D · Interaction with completed TS waves

Wave 6's extension of `RefacingCapabilityKey` with `kit_or_product_supplier` lives IN the staircase cluster. If Batch C moves the cluster to trades, the Wave 6 fix moves with it (correct for both current state and post-move state). No conflict.

The Wave 4 blocker (`priority_prefixes` · unimplemented S1 Repair) and Wave 5 blocker (`intelligence_status` · unimplemented NI Doctrine Phase 2) BOTH live in files that would move under Batch B. **Batch B approval would retire both blockers as nexapp concerns** · their feature-completion decision becomes a trades-side consideration.

### 9E · Delivery boundary (strict · unchanged)

Phase 1 is read-only inventory only. No files moved. No files deleted. No type changes beyond the already-completed Waves 1-6. Dirty tree preserved. **No commits · no push · no deployment · no production migration · no production data modified.** Each batch above requires explicit owner authorisation before any file operation.

---

## 10 · Batch A · Phase 2 PLAN · OBSOLETE deletions · 2026-10-28 · AWAITING OWNER APPROVAL

**Scope**: `src/components/nex-app/materials/*` (31 files) + `src/lib/nex/intelligence/*` (12 files). Pure deletions, no moves. Both trees authorised for Phase 2 planning on 2026-10-28. Owner directive: "This is authorization for read-only planning and final dependency verification only, not for deletion yet."

### 10A · Final dependency verification · completed 2026-10-28

**Materials tree** · `src/components/nex-app/materials/*`:
| Check | Result |
|---|---|
| External static imports (anything outside the tree) | **0** |
| External dynamic imports (`import('...')`) | **0** |
| Route-level mounts (any `page.tsx` referencing `MaterialsAppShell`, `MaterialsLanding`, etc.) | **0** |
| `next/dynamic` / `React.lazy` references | **0** |
| String-literal references outside the tree | **0** (all 10 matches found are self-references within the tree) |
| Tests outside the tree pointing at these files | **0** |
| Test files inside the tree | **0** (no `.test.ts` / `.test.tsx` files · all 31 files are production components) |
| Backend `src/apps/materials/_schema/*` existence | **DOES NOT EXIST** in the repo — the 16 TS2307 errors are from importing a backend that was never shipped |
| TS errors attributable to this tree | **23** direct in-tree errors (TS2307 + TS2322 + TS7006 mix) |

**Intelligence barrel** · `src/lib/nex/intelligence/*`:
| Check | Result |
|---|---|
| External static imports | **0** (`intelligence-storage-grid/*` is a DIFFERENT tree, substring-match false positive during Phase 1 audit) |
| External dynamic imports | **0** |
| Route-level mounts | **0** |
| String-literal references outside the barrel | **0** |
| Test files inside the barrel | 3 (`graph.test.ts`, `research.test.ts`, `types.test.ts`) · they test only symbols that live inside this tree, so they delete with the tree |
| TS errors attributable to this tree | **1** direct in-tree error |

**Conclusion**: Both trees are strictly removable. Nothing in nexapp retained-functionality imports from them. The 3 intelligence test files reference only the symbols being deleted. The 16 TS2307 errors in Materials point at `@/apps/materials/_schema/*` which has no backend.

### 10B · Exact file manifest (44 files total)

**Materials · 31 files**:
- `src/components/nex-app/materials/MaterialsAppShell.tsx`
- `src/components/nex-app/materials/MaterialsAskBar.tsx`
- `src/components/nex-app/materials/MaterialsLanding.tsx`
- `src/components/nex-app/materials/MaterialsSubPage.tsx`
- `src/components/nex-app/materials/RecentActivity.tsx`
- `src/components/nex-app/materials/_ModulePlaceholder.tsx`
- `src/components/nex-app/materials/_TimberIllustration.tsx`
- `src/components/nex-app/materials/_tokens.ts`
- `src/components/nex-app/materials/lists/{PacksList,StockList}.tsx` (2)
- `src/components/nex-app/materials/add-stock/{ActionsCard,AddStockWorkflow,ConfirmationForm,DoneView,EntryHero,ErrorCard,InterpretationCard,MemoryMatchCard,StockChangesCard,ThinkingBar}.tsx` (10)
- `src/components/nex-app/materials/pack-detail/PackDetailScreen.tsx` (1)
- `src/components/nex-app/materials/_shared/{BoardCard,CameraIconButton,FilterChip,OfflineIndicator,PackHeader,SearchBar,StatusBadge,SummaryCards,UploadIconButton,VoiceButton}.tsx` (10)
- The parent `src/components/nex-app/materials/` directory itself (empty after deletions)

**Intelligence · 12 files**:
- `src/lib/nex/intelligence/graph.ts` + `graph.test.ts`
- `src/lib/nex/intelligence/research.ts` + `research.test.ts`
- `src/lib/nex/intelligence/types.ts` + `types.test.ts`
- `src/lib/nex/intelligence/health.ts`
- `src/lib/nex/intelligence/review.ts`
- `src/lib/nex/intelligence/search.ts`
- `src/lib/nex/intelligence/teaching.ts`
- `src/lib/nex/intelligence/versions.ts`
- `src/lib/nex/intelligence/index.ts` (barrel)
- The parent `src/lib/nex/intelligence/` directory itself (empty after deletions)

### 10C · Shared functionality to retain (confirmed EMPTY)

- No shared utility, helper, type, or primitive provided by either tree is used by any file outside the tree.
- The `intelligence-storage-grid` directory (which IS a consumer of other code) is **unrelated** to this `intelligence` barrel — different path, different purpose. NOT in Batch A scope.
- No images, static assets, or data files to preserve.
- No env vars reference these trees.
- No Supabase migrations reference these trees.
- No build config (`next.config.*`, `tsconfig.*`, `vitest.config.*`) references these trees.

### 10D · Removal order + verification gates

**Phase 2a · ordering decision** · the two trees are mutually independent. Either order is safe. **Proposed**:

1. **Step 1 · Delete Materials tree first** (bigger, simpler, pure UI)
   - Verification gate: `npx tsc --noEmit --pretty false 2>&1 | grep -c "error TS"` · expect reduction of ~23 direct errors + a handful of downstream (TS2307 chains from the `_schema` imports going away)
   - Verification gate: `npx vitest run src/components/nex-app` · expect no new failures (zero tests touch materials)
   - Verification gate: `rg -c "MaterialsAppShell|MaterialsLanding|MaterialsSubPage" src/` · expect 0 hits total (confirms clean removal)

2. **Step 2 · Delete Intelligence barrel** (small, 3 internal tests delete with it)
   - Verification gate: TS count expect reduction of 1 error
   - Verification gate: `npx vitest run src/lib/nex/intelligence` · expected result: tests don't run (files gone) — confirm the overall `vitest run` doesn't show new failures (zero other test files import the deleted paths)
   - Verification gate: `rg "@/lib/nex/intelligence'" src/` and `rg "from.*@/lib/nex/intelligence/" src/` · both expect 0 hits

3. **Step 3 · Full-suite regression** · same chat + watch + i18n + inbox suites used throughout the TS reduction waves. Expected result: unchanged pass counts (192/192 chat+watch, 115/115 i18n+wave-a, etc.). The pre-existing agent-runtime suite failures remain pre-existing (not resolved by this batch, not newly caused by this batch).

4. **Step 4 · Hendra 7-area walkthrough** · same `scripts/hendra-walkthrough.mjs` matrix. Expected result: 13/13 OK unchanged (zero of the 13 routes touch materials or intelligence).

### 10E · Expected TS diagnostic impact (ESTIMATE · not guarantee)

| Source | Direct count | Expected after Batch A |
|---|---|---|
| Current baseline | 1268 | — |
| Materials in-tree errors | 23 | 0 |
| Intelligence in-tree errors | 1 | 0 |
| Downstream TS2307 that may resolve (unverifiable until files gone) | 0-5 | — |
| **Expected baseline after Batch A** | — | **≈ 1240-1245** (unverified estimate) |

Caveat: the estimate assumes TypeScript doesn't surface new errors from the deletions (shouldn't · zero external imports). The actual delta is reported after Step 3.

### 10F · Rollback plan

Every file deletion is a `git` operation. If any verification gate fails:
- `git restore -s HEAD -- <deleted-path>` restores files from HEAD before stage.
- Since we're not committing within Batch A execution, `git checkout -- src/components/nex-app/materials src/lib/nex/intelligence` fully reverts without touching other dirty work.
- The dirty-tree preservation is intact — Batch A touches only these two directories, no other files.

### 10G · Delivery boundary (strict)

Phase 2 planning (this document) is read-only verification + planning only. **Nothing has been deleted.** Dirty tree + untracked work preserved. **No commits · no push · no deployment · no production migration · no production data modified.** Execution of Steps 1-4 requires explicit owner authorisation ("approve Batch A execution" or similar).

### 10I · Batch A EXECUTION OUTCOME · 2026-10-28 · PARTIAL · gate failure stopped intelligence delete

**Step 1 · Materials tree · COMPLETE · all gates passed**
- 31 files deleted from `src/components/nex-app/materials/` (parent directory removed cleanly)
- TS error count: 1268 → **1245** (−23 exactly as estimated)
- Residual string references in `src/`: **0**
- Chat/watches regression (`src/app/nex-native/chat/peer` + `src/lib/nex-native/watches`): **192/192 pass** unchanged
- Pre-existing dirty tree preserved · zero in-scope uncommitted work existed before deletion

**Step 2 · Intelligence barrel · GATE FAILED · tree restored to HEAD**
- 12 files deleted from `src/lib/nex/intelligence/`
- TS error count: 1245 → **1247** (+2 net, expected −1 · gate 2a FAILED)
- Precise error diff via `/tmp/ts-materials-only.txt` vs. `/tmp/ts-intelligence-deleted.txt`:
  - **Resolved**: `src/lib/nex/intelligence/research.ts(20,28)` (in-tree TS2307 on `@/lib/openai/reasoning` · gone with the file)
  - **New introduced** (3 errors in one file):
    - `src/lib/nex/knowledge.ts(5,30)` · TS2307 · Cannot find module './intelligence'
    - `src/lib/nex/knowledge.ts(6,35)` · TS2307 · Cannot find module './intelligence'
    - `src/lib/nex/knowledge.ts(8,35)` · TS2307 · Cannot find module './intelligence'
- **Root cause**: `src/lib/nex/knowledge.ts` imports `hybridSearch` + `KnowledgeHit` from `./intelligence` using a **RELATIVE** path. My Phase 2 verification only grepped **absolute** `@/lib/nex/intelligence*` paths — the relative import slipped through.
- **Rollback executed** · targeted `git checkout HEAD -- src/lib/nex/intelligence/` restored all 12 files. No other paths touched. No broader git command used. Pre-existing dirty tree preserved.
- **Stash side-effect**: during the diagnostic I ran `git stash push -- src/lib/nex/intelligence` by mistake. Dropped `stash@{0}` immediately after via `git stash drop`. The pre-existing `stash@{1}: pre-nex-fork-snapshot-20261010-200712` is untouched.
- **TS count after restore**: back to **1245** (identical to post-Materials-only state)

**Step 3-6 · NOT RUN** · per directive "If a gate fails, stop further cleanup."

### 10J · Downstream `knowledge.ts` dependency chain (discovered during failure diagnosis)

`src/lib/nex/knowledge.ts` is a thin facade:
```ts
import { hybridSearch } from "./intelligence";
import type { KnowledgeHit } from "./intelligence";
export type { KnowledgeHit } from "./intelligence";
export async function retrieveKnowledge(query, limit = 3) {
  return hybridSearch({ query, limit, expand: true });
}
```

Who imports from `@/lib/nex/knowledge` or its `retrieveKnowledge`/`KnowledgeHit` exports? Based on grep:
- `src/lib/nex/agent.ts:20` imports `KnowledgeHit` from `@/lib/knowledge/search` (**different** module)
- `src/lib/nex/context.ts:14` imports `KnowledgeHit` from `@/lib/knowledge/search` (**different** module)
- `src/lib/nex/brain/orchestrate.ts:29` imports `retrieveKnowledge` from `@/lib/nex/indonesia/knowledge` (**different** module)
- `src/lib/nex/brain/tools/knowledge.ts:13` imports `retrieveKnowledge` from `@/lib/nex/indonesia/knowledge` (**different** module)

**Preliminary finding**: `src/lib/nex/knowledge.ts` facade appears to have **ZERO active consumers** — every caller uses one of the other `knowledge` modules (`@/lib/knowledge/search` or `@/lib/nex/indonesia/knowledge`). The facade may itself be dead code. **This has NOT been fully verified**; a Phase-2b audit with the corrected methodology (absolute + relative imports) is required before trusting that classification.

### 10K · Current repository state (post-Batch-A-partial)

- `src/components/nex-app/materials/` · **DELETED** · 31 files · git status shows `D` for each
- `src/lib/nex/intelligence/` · **RESTORED to HEAD** · 12 files on disk, no local modifications
- Dirty tree: **220 lines** in git status (189 pre-existing + 31 materials-deletion markers = correct)
- TypeScript: **1245 errors** · −23 from session-start-of-Batch-A baseline of 1268 · −54 from session-ultimate-start of 1299
- Stashes: 1 (the pre-existing `pre-nex-fork-snapshot-20261010-200712`, not from this execution)
- No commits · no push · no deployment · no production migration · no production data modified

### 10M · Phase 2b · knowledge.ts dependency audit · READ-ONLY · 2026-10-28

**Scope**: determine whether `src/lib/nex/knowledge.ts` has active consumers after correcting the Phase 2 methodology (which checked absolute imports only).

**Working-tree state at audit start** · Branch `main` · HEAD `e6e4ac82` · 222 dirty paths · 1 pre-existing stash `pre-nex-fork-snapshot-20261010-200712` (preserved) · Materials still DELETED (31 D entries) · Intelligence still RESTORED (0 changes) · TS = 1245.

#### 10M.1 Target files inspected in full
- `src/lib/nex/knowledge.ts` (13 lines) · thin facade with 2 imports from `./intelligence` + 1 re-export + 1 async function (`retrieveKnowledge`)
- `src/lib/nex/intelligence/index.ts` (11 lines) · barrel using `export * from "./types"` + 7 other modules (versions, review, graph, search, teaching, health, research)
- 11 other `intelligence/*.ts` files · exports enumerated: graph (5 fns), health (1 type + 1 fn), research (3 types + 4 fns), review (8 fns), search (`hybridSearch`), teaching (4 fns), types (`KnowledgeHit` at line 164 + schemas + helpers), versions (4 fns)

#### 10M.2 Consumer search · all vectors
| # | Vector | Hits for knowledge.ts | Hits for intelligence barrel |
|---|---|---|---|
| A1 | `from "@/lib/nex/knowledge"` (absolute) | **0** | — |
| A2 | `import("@/lib/nex/knowledge")` (dynamic) | **0** | — |
| A3 | `require("@/lib/nex/knowledge")` | **0** | — |
| B1 | `from "./knowledge"` from siblings in src/lib/nex/ | 6 matches · ALL resolve to `src/lib/nex/indonesia/knowledge.ts` (different file) | — |
| B2 | `from "../knowledge"` from children of src/lib/nex/* | 8 matches · 6 resolve to `src/lib/nex/indonesia/knowledge.ts` · **2 resolve to the target** at `src/lib/nex/orch/catalog.ts:13` + `src/lib/nex/orch/registry.ts:13` | — |
| B3 | `from "../../knowledge"` etc. (deeper relatives) | **0** | — |
| C | Comment/string/type references | **0** | — |
| F | Barrel re-export patterns | **0** · no barrel re-exports knowledge.ts | — |
| G | `src/lib/nex/index.ts` barrel existence | **does not exist** | — |
| H | `import("../knowledge")` dynamic | 1 at `indonesia/commerce/commerce.test.ts:369` · resolves to `indonesia/knowledge.ts` (different file) | — |
| V | tsconfig path aliases | Only `"@/*": ["./src/*"]` · no additional aliases that could route through alternate paths | — |
| W | Scripts, next.config, package.json | 1 hit · `scripts/ts2307-candidates-report.json` (my own prior audit artefact, not an active consumer) | — |
| AA | vitest.config / playwright.config | **0** | — |

#### 10M.3 Confirmed consumers of `src/lib/nex/knowledge.ts`
Exactly **2 files**:
1. `src/lib/nex/orch/catalog.ts:13` · `import { retrieveKnowledge } from "../knowledge";` (relative path from `orch/` resolves to `src/lib/nex/knowledge.ts`)
2. `src/lib/nex/orch/registry.ts:13` · same import pattern

**Classification: A** (not B) — knowledge.ts DOES have active consumers in the grep sense. However, those consumers are themselves part of a chain that must be traced further before any deletion recommendation.

#### 10M.4 Transitive chain beyond the 2 direct consumers
Reverse-dependency trace from `orch/catalog.ts` + `orch/registry.ts`:
- Query Q · direct imports of `@/lib/nex/orch/catalog` or `@/lib/nex/orch/registry` → **0**
- Query R · direct imports of `@/lib/nex/orch` barrel → **0**
- Query K · imports of `@/lib/nex/orch/types` → 2 files, both at `src/lib/nex/brains/_catalog_hook.ts` and its `.test.ts`
- `brains/_catalog_hook.ts` exports `withBrain` function
- Query O · imports of `_catalog_hook` → re-exported via `src/lib/nex/brains/index.ts:49` as `withBrain`
- Query T · `withBrain` symbol references outside the file itself → **0 outside brains/** · all 6 hits are internal (file + its re-export + test file)
- Query S · imports from `@/lib/nex/brains` barrel directly → **0** · all 8 brains-related imports go to specific sub-paths (`/brains/_schema`, `/brains/_loader`, `/brains/_studio/*`, `/brains/_supabase`, `/brains/_ensure_loaded`), NOT the barrel that re-exports `withBrain`
- Query AB · `retrieveKnowledge` / `hybridSearch` references in `src/app/nex-native/*` or `src/lib/nex-native/*` → **0**

**The entire chain is transitively dead relative to active NEX product code.** No file in `nex-native/*` reaches `knowledge.ts`, `intelligence/*`, `orch/*`, or `brains/_catalog_hook`. The chain exists as internal legacy infrastructure that other legacy modules import but no active product surface consumes.

#### 10M.5 Dependency table

| Consumer | Line | Import form | Resolved target | Symbols consumed | Status | Evidence |
|---|---|---|---|---|---|---|
| `src/lib/nex/orch/catalog.ts` | 13 | `import { retrieveKnowledge } from "../knowledge"` | `src/lib/nex/knowledge.ts` | `retrieveKnowledge` | **ACTIVE** (type-check and runtime at the file level) · but transitively dead (no nex-native consumer reaches it) | File imported from relative path, used at line 64, 684, 748, 958 of same chain |
| `src/lib/nex/orch/registry.ts` | 13 | `import { retrieveKnowledge } from "../knowledge"` | `src/lib/nex/knowledge.ts` | `retrieveKnowledge` | ACTIVE at file level · transitively dead | File imported, used inside baseline-agent definitions in registry.ts |
| `src/lib/nex/brains/_catalog_hook.ts` | — | `import type { Agent, AgentInvocationContext, AgentResult } from "@/lib/nex/orch/types"; import { evidenceFor } from "@/lib/nex/orch/types"` | `src/lib/nex/orch/types.ts` | 3 type imports + 1 value import | ACTIVE at file level · transitively dead | Only `withBrain` export · never consumed outside brains/ itself |
| `src/lib/nex/brains/index.ts` | 49 | `export { withBrain } from "./_catalog_hook"` | — | re-export | Dead · no file imports `withBrain` from anywhere | Query T returned zero external references |
| `src/lib/nex/orch/*` tests | various | internal | — | internal test fixtures | test-only · no production consumer | all `*.test.ts` files run only in vitest |
| `src/lib/nex/intelligence/*` tests | various | internal | — | internal test fixtures | test-only · no production consumer | 3 `*.test.ts` files internal to intelligence/ |

#### 10M.6 Methodology verification · what Phase 2 missed vs. Phase 2b caught

Phase 2 grep patterns (incomplete):
- ✓ `from ['"]@/lib/nex/intelligence['"]` → correctly returned 0 (no absolute imports exist)
- ✗ Missed: `from ['"]./intelligence['"]` (sibling-relative within `src/lib/nex/`)

Phase 2b grep patterns (complete):
- ✓ Absolute aliases
- ✓ Sibling-relative (`./knowledge`, `./intelligence`)
- ✓ Parent-relative (`../knowledge`, `../intelligence`)
- ✓ Deep-parent-relative (`../../`, `../../../`)
- ✓ Dynamic `import()` form
- ✓ `require()` form
- ✓ Barrel re-export patterns (`export * from`, `export … from`)
- ✓ Symbol-name whole-word greps (`retrieveKnowledge`, `KnowledgeHit`, `hybridSearch`)
- ✓ Scripts, next.config, package.json, vitest.config, playwright.config
- ✓ tsconfig path alias verification
- ✓ Multi-hop transitive consumer trace through orch/* → brains/* → external

#### 10M.7 Final classification · B+ with chain nuance

- **Strictly per the question "does knowledge.ts have consumers"**: **A · it has 2 active consumers** (orch/catalog.ts + orch/registry.ts)
- **Per the deeper question "is the chain dead code"**: **B · yes, in aggregate** · the whole chain [`intelligence/*` + `knowledge.ts` + `orch/*` + `brains/_catalog_hook.ts`] forms a closed loop that no active NEX product surface enters
- **Per the strict safety rule from the directive**: **retain everything in isolation** · deleting `intelligence/*` alone would break `knowledge.ts` which would break `orch/catalog.ts` and `orch/registry.ts` which would break the barrel at `orch/index.ts` (even though nobody imports that barrel) which would propagate type errors. The chain can only be retired safely as a single coordinated transaction, not piecemeal.

#### 10M.8 Proposed deletion scope (if separately authorised)

**36 files + 1 one-line edit** · atomic transaction:

| Group | Path | Count |
|---|---|---|
| Facade | `src/lib/nex/knowledge.ts` | 1 |
| Intelligence tree | `src/lib/nex/intelligence/*` | 12 |
| Orch tree | `src/lib/nex/orch/*` | 21 |
| Catalog hook (brains sub-chain) | `src/lib/nex/brains/_catalog_hook.ts` + `_catalog_hook.test.ts` | 2 |
| Edit (not delete) | Remove line 49 `export { withBrain } from "./_catalog_hook";` from `src/lib/nex/brains/index.ts` | 1 line edit |

Expected direct TS error reduction: ~ `knowledge.ts` 0 + `intelligence/*` 1 + `orch/*` ~15 + `brains/_catalog_hook` ~0 = modest; the real benefit is removing ~36 files of legacy infrastructure in one atomic cleanup. Precise count available only post-execution.

#### 10M.9 What was NOT verified in Phase 2b

- Whether any INDIRECT, string-based mechanism (e.g. a dev-only route registry that stringifies module paths) could load these files at runtime. The grep searches found no evidence, but ambient Next.js file-system routing + webpack glob imports CAN discover files that no explicit import names.
- Whether tests in the deleted chain are referenced by any CI config or coverage report that would break if the test files vanish.
- The `nex-native/*` surface was checked for direct `retrieveKnowledge` usage but NOT for every possible symbol re-exported through the barrel chain. A thorough pre-execution check (if authorised) should grep for every exported symbol from the intelligence barrel (hybridSearch, proposeEdge, verifyEdge, neighbours, traverse, deleteEdge, readHealth, runResearch, coerceSource, isTrustedUrl, draftTier, getResearchReport, readEntry, readVersionHistory, createEntryImmediate, publishNewVersion, submitCreate, submitEdit, submitCorrection, approveReview, rejectReview, mergeReview, archiveReview, getReview, recordUpload, markExtracting, recordExtractionResults, listUploads, withTier, Source, SourceSchema, SourceTier, SourceTierSchema, Difficulty, DifficultySchema, KIND_TO_TIER, KnowledgeHit, HealthRow, ResearchInput, SearchSummary, ResearchReport) across nex-native/*.

#### 10M.10 Recommendation for separately authorised next step

- **Do not retire intelligence/* alone.** Phase 2 proved that path fails.
- **Phase 2c (recommended)**: before any deletion of the full chain, run symbol-level verification — grep every exported symbol from intelligence/types.ts, orch/types.ts, orch/index.ts across `src/app/nex-native/*` + `src/lib/nex-native/*`. If any symbol appears there, the chain is NOT fully dead and the deletion must stop or scope-adjust. If zero symbols appear, the atomic deletion is safe.
- **Phase 2d (contingent on 2c being clean)**: present a precise deletion manifest (37 files + 1 line edit) for owner approval, same batch-A-style gates: typecheck delta, chat/watches regression, Hendra walkthrough. All or nothing.
- **Alternative · defer indefinitely**: Materials cleanup already delivered −23 TS errors. The intelligence chain cleanup is a bigger coordinated transaction (~36 files · atomic). If the yield doesn't justify the risk, leave it in place. Nothing in it reaches active product code, so it's inert ballast — not a correctness risk.

### 10N · Phase 2c · symbol-level final verification · READ-ONLY · 2026-10-28

**Scope**: finalise the Phase 2b finding by (a) enumerating every exported symbol from the proposed chain, (b) checking each against the entire repo via symbol-level and import-level analysis, (c) ruling out runtime-discovery mechanisms, (d) verifying barrel/config/CI reachability, (e) producing a reconciled file manifest with limitations.

**Working-tree state preserved unchanged**: HEAD `e6e4ac82` · 222 dirty paths · stash `pre-nex-fork-snapshot-20261010-200712` · Materials 31 D · Intelligence restored · TS = **1245**.

#### 10N.1 Complete symbol inventory (~90 exports)

| Source file | Exports |
|---|---|
| `knowledge.ts` | `KnowledgeHit` (re-exported from `./intelligence`), `retrieveKnowledge` |
| `intelligence/types.ts` | 22 schemas/types/consts: `DifficultySchema`, `Difficulty`, `SourceTierSchema`, `SourceTier`, `KIND_TO_TIER`, `SourceSchema`, `Source`, `withTier`, `EvidenceSchema`, `Evidence`, `KnowledgeEntryDraftSchema`, `KnowledgeEntryDraft`, `KnowledgeEntry`, `ChangeKind`, `KnowledgeVersion`, `RelationshipSchema`, `Relationship`, `KnowledgeEdge`, `ReviewKindSchema`, `ReviewKind`, `ReviewSubmitterKind`, `ReviewStatus`, `ReviewItem`, `TeachingUpload`, `KnowledgeHit` |
| `intelligence/versions.ts` | 4 fns: `readEntry`, `readVersionHistory`, `createEntryImmediate`, `publishNewVersion` |
| `intelligence/review.ts` | 10 fns: `submitCreate`, `submitEdit`, `submitCorrection`, `approveReview`, `rejectReview`, `mergeReview`, `archiveReview`, `getReview`, `listReviews`, `countPending` |
| `intelligence/graph.ts` | 5 fns: `proposeEdge`, `verifyEdge`, `neighbours`, `traverse`, `deleteEdge` |
| `intelligence/search.ts` | 1 fn: `hybridSearch` |
| `intelligence/teaching.ts` | 4 fns: `recordUpload`, `markExtracting`, `recordExtractionResults`, `listUploads` |
| `intelligence/health.ts` | 1 type + 1 fn: `HealthRow`, `readHealth` |
| `intelligence/research.ts` | 3 types + 6 fns: `ResearchInput`, `SearchSummary`, `ResearchReport`, `runResearch`, `coerceSource`, `isTrustedUrl`, `draftTier`, `getResearchReport`, `listResearchReports` |
| `intelligence/index.ts` | barrel · `export * from` 7 modules above |
| `orch/types.ts` | 12 types + 1 fn: `AgentId`, `AgentPermission`, `AgentSpeciality`, `AgentCategory`, `CountryCode`, `Agent`, `AgentInvocationContext`, `AgentResult`, `PlanStep`, `OrchestrationPlan`, `OrchestrationResult`, re-exports `Evidence`, `evidenceFor` |
| `orch/catalog.ts` | 3 items: `buildSpecialistAgent`, `SPECIALIST_SPECS`, `SPECIALIST_AGENTS` |
| `orch/registry.ts` | 5 items: `AGENTS`, `getAgent`, `agentsByCategory`, `_auditFindings`, `_invoke` |
| `orch/permissions.ts` | 4 items: `REQUIRED_PERMISSIONS`, `AuditFinding`, `auditRegistry`, `canAgentPerform` |
| `orch/planner.ts` | 1 fn: `planForAsk` |
| `orch/runner.ts` | 2 items: `RunPlanInput`, `runPlan` |
| `orch/answer.ts` | 4 items: `OrchestrateInput`, `orchestrate`, `isCompoundAsk`, `formatOrchestration` |
| `orch/confidence.ts` | 8 items: `Confidence`, `rankConfidence`, `stepUp`, `stepDown`, `rollupConfidence`, `Conflict`, `detectConflicts`, `resolveConflict` |
| `orch/voice.ts` | 4 fns: `stripAgentLabel`, `stripEmDash`, `normaliseContribution`, `composeNexReply` |
| `orch/explain.ts` | 2 items: `ExplainInput`, `explain` |
| `orch/mesh.ts` | 7 items: `MeshInput`, `MeshResult`, `runMesh`, `AnswerMeshInput`, `AnswerMeshResult`, `answerMesh`, `asksForExplanation` |
| `orch/index.ts` | barrel re-exports from all 10 orch files above |
| `brains/_catalog_hook.ts` | 2 items: `BrainAgentWrapperInput`, `withBrain` |

#### 10N.2 Symbol-collision discovery

Raw whole-word symbol greps returned **939 hits** outside the chain. Investigation showed **most are name-collisions**, not consumers:
- `evidenceFor` has its own definitions at `src/lib/nex/xp/types.ts:124` and `src/lib/nex/world/types.ts:158` (3 distinct implementations · different modules re-use the name).
- `CountryCode` has its own enum at `src/lib/nex/world/types.ts:24` (different value set).
- `KnowledgeHit` is defined independently at `src/lib/nex/indonesia/knowledge.ts:324` AND `src/lib/nex/intelligence/types.ts:164`; external callers go to `@/lib/knowledge/search` (yet another module).
- `Evidence`, `Source`, `Confidence`, `Conflict`, `explain`, `orchestrate`, `Agent`, `Difficulty`, `Relationship` — common identifier names collide with unrelated modules.

Whole-word symbol greps are **not** a reliable reachability signal when names are common. Switched methodology to **import-statement reachability per chain path**.

#### 10N.3 Import-statement reachability per chain path (CORRECTED METHODOLOGY)

| Chain path | External import consumers | Evidence |
|---|---|---|
| `src/lib/nex/knowledge.ts` | **0** | 10 relative-path hits for `./knowledge` + `../knowledge` all resolve to `src/lib/nex/indonesia/knowledge.ts` (different file). 2 chain-internal consumers (`orch/catalog.ts` + `orch/registry.ts`) are inside the proposed deletion scope. |
| `src/lib/nex/intelligence/*` | **0** | 10 absolute-path hits for `@/lib/nex/intelligence` all resolve to `@/lib/nex/intelligence-storage-grid/accommodation/*` (different tree · prefix-match artefact). 1 chain-internal consumer (`knowledge.ts`). |
| `src/lib/nex/orch/*` (absolute) | **0** external | 4 hits all inside the chain: `brains/_catalog_hook.ts` + its test (both in deletion scope). |
| `src/lib/nex/orch/*` (relative) | **0** | 10 relative-path hits (`./orch...`, `../orch...`) all resolve to unrelated modules (`nex-agent/core/orchestrator-types.ts`, `nex-agent-runtime/orchestrator/*`, `nex/brain/orchestrate.ts`) — different files. |
| `src/lib/nex/brains/_catalog_hook` | **0** external | 2 hits: 1 self-test import, 1 re-export in `brains/index.ts:49`. Both in deletion scope. |
| `withBrain` symbol | **0** external | All 7 hits internal to the chain (self + test + index.ts re-export). |

**Result**: zero import statements from outside the proposed deletion scope reach any file in the chain.

#### 10N.4 Runtime-discovery assessment

| Mechanism | Found? | Impact |
|---|---|---|
| Next.js app-router convention files (`page.tsx`, `route.ts`, `layout.tsx`) inside the chain | **NONE** | No routes auto-mount from the chain |
| Webpack `require.context` directory-glob loader | **NONE** across repo | No glob-loaded modules |
| `import.meta.glob` (Vite/esbuild file enumeration) | **NONE** across repo | No glob-loaded modules |
| `globSync` or similar runtime file enumeration | **NONE** across repo | No runtime file discovery |
| Dynamic `import()` of chain paths | **NONE** external | Already checked in 2b |
| `require()` of chain paths | **NONE** external | Already checked in 2b |
| `src/middleware.ts` referencing chain | **NONE** | Middleware clean |
| `src/instrumentation.ts` referencing chain | **File does not exist** | No instrumentation hook |
| `scripts/*` referencing chain | **1 hit** · `scripts/ts2307-candidates-report.json` is a JSON artefact from my own prior audit · not an active consumer | Not a reachable path |
| `.github/workflows/*` CI config | **Directory does not exist in nexapp** | No CI references |

**Result**: no runtime-discovery mechanism reaches the chain.

#### 10N.5 Barrel integrity · brains/index.ts

The 1-line edit removes `export { withBrain } from "./_catalog_hook";` at line 49. The remaining barrel exports (verified via full read):
- `nexBrainRuntimeEnabled` (from `./_flag`)
- `loadBrain`, `brainRegistry` (from `./_loader`)
- `BrainBootError`, `LoadedBrain`, `BrainPack`, `BootAuditError` (from `./_types`)
- `retrieveFromBrain`, `retrieveFromBrains`, `DomainSeparationError`, `RetrievalResult`, `RetrievalHit`, `RetrievalOptions`, `RetrievalStatus` (from `./_router`)
- `computeConfidence`, `isInsufficient`, `INSUFFICIENT_CONFIDENCE_THRESHOLD`, `ConfidenceInputs`, `ConfidenceResult` (from `./_confidence`)
- `analyseImageWithBrain`, `estimateWithBrain`, `BrainVisionInput`, `BrainVisionResult`, `BrainEstimateInput`, `BrainEstimateResult`, `BrainEstimateLine` (from `./_integrations`)
- `export * from "./_schema"`

None of those depend on `_catalog_hook.ts`. Removing the one re-export line does not break any other brains barrel export.

Also verified: no file imports from `@/lib/nex/brains` as a whole barrel (query 9 above returned 0). All 8 brains imports found earlier go to specific sub-paths (`/brains/_schema`, `/brains/_loader`, `/brains/_studio/*`, `/brains/_supabase`, `/brains/_ensure_loaded`) — never from the barrel itself. Removing `withBrain` from the barrel is a no-op for all external consumers because nobody imports from the barrel.

#### 10N.6 Reconciled file manifest · 36 deletions + 1 line edit

**Deletions (36 files total)**:

| Group | Count | Files |
|---|---|---|
| Facade | 1 | `src/lib/nex/knowledge.ts` |
| Intelligence tree | 12 | `graph.ts`, `graph.test.ts`, `health.ts`, `index.ts`, `research.ts`, `research.test.ts`, `review.ts`, `search.ts`, `teaching.ts`, `types.ts`, `types.test.ts`, `versions.ts` (all in `src/lib/nex/intelligence/`) |
| Orch tree | 21 | `answer.ts`, `answer.test.ts`, `catalog.ts`, `catalog.test.ts`, `confidence.ts`, `confidence.test.ts`, `explain.ts`, `explain.test.ts`, `index.ts`, `mesh.ts`, `mesh.test.ts`, `permissions.ts`, `permissions.test.ts`, `planner.ts`, `planner.test.ts`, `registry.ts`, `runner.ts`, `runner.test.ts`, `types.ts`, `voice.ts`, `voice.test.ts` (all in `src/lib/nex/orch/`) |
| Catalog hook | 2 | `_catalog_hook.ts`, `_catalog_hook.test.ts` (in `src/lib/nex/brains/`) |

**Edit (not delete, 1 line)**:
- `src/lib/nex/brains/index.ts` · remove line 49 `export { withBrain } from "./_catalog_hook";`

**Reconciliation**: 1 + 12 + 21 + 2 = **36 deletions**. Matches Phase 2b's estimated scope. No files added to or removed from the manifest after Phase 2c verification.

**Files that must REMAIN** because they have active consumers (confirmed not in deletion scope):
- `src/lib/nex/brains/*` **except** `_catalog_hook.{ts,test.ts}` — the rest of the brains tree has active consumers (`_schema`, `_loader`, `_studio`, `_supabase`, `_ensure_loaded`, etc. are used by `nex/live-chat-completion/*`, `nex/golden/telemetry.ts`, `nex/brains/_studio/_scaffold.ts`)
- `src/lib/nex/indonesia/knowledge.ts` — different file, active consumers in indonesia/*, brain/orchestrate.ts (via `@/lib/nex/indonesia/knowledge`)
- `src/lib/nex/intelligence-storage-grid/*` — different tree, 10 consumers in live-chat-completion
- `src/lib/knowledge/search` — different module with its own `KnowledgeHit` and `searchKnowledge`, imported by `nex/agent.ts` + `nex/context.ts`

#### 10N.7 Decision criteria classification

Per directive:
- **Clean · No externally reachable consumers or indirect runtime-discovery paths found, with evidence sufficient to justify proposing Phase 2d.** ✅
- Not clean: — (not triggered)
- Inconclusive: — (not triggered · all vectors checked)

#### 10N.8 Limitations documented

Static-analysis is thorough but not infallible. The following constraints apply:

1. **TypeScript module resolution** uses `moduleResolution: "bundler"` with `"@/*": ["./src/*"]`. The grep patterns cover all common import forms, but a hypothetical custom webpack loader could remap paths in ways grep can't detect. **Mitigation**: `next.config.*` was inspected — no custom loaders present.
2. **Vitest test discovery** uses glob `**/*.test.ts` by default. Deleting a test file stops that test from running. No `vitest.config.*` references the chain test files individually, so no explicit allowlist breaks.
3. **Supabase RPC / database functions** named identically to chain exports could theoretically be invoked via raw string. The chain contains no `.from('nex_knowledge*')` or `.rpc('*')` reads unique to it — all its DB access is through its own files; cutting the chain cuts the DB access too.
4. **Future static-method or decorator-based discovery** that doesn't exist today but could be added would not be detected. **Mitigation**: no decorators (`@ClassDecorator`) are used anywhere in the chain's exports.
5. **CI/CD outside the repo** (e.g., Vercel deployment hooks) cannot be inspected from here. **Mitigation**: these files are server-only (`"server-only"` import at the top of `account-profile-service.ts` and similar), and nothing in the chain is referenced by `package.json` scripts.

#### 10N.9 Recommendation for separately-authorised Phase 2d

**Recommended** · evidence supports an atomic deletion of 36 files + 1 line edit as a single transaction with the following verification gates:

1. Pre-flight: `git status --short` + `git stash list` snapshot (preserve pre-existing stash). Verify Materials 31 D unchanged. Verify Intelligence/*, orch/*, brains/_catalog_hook* all have ZERO uncommitted modifications. TS baseline 1245.
2. Step 1 · `rm -rf src/lib/nex/intelligence/ src/lib/nex/orch/ src/lib/nex/knowledge.ts src/lib/nex/brains/_catalog_hook.ts src/lib/nex/brains/_catalog_hook.test.ts` (one `rm` command, 36 files)
3. Step 2 · `Edit` on `src/lib/nex/brains/index.ts` removing the single `withBrain` re-export line
4. Gates:
   - `npx tsc --noEmit --pretty false | grep -c "error TS"` · expect reduction (precise count available only post-execution)
   - `rg -c "retrieveKnowledge|hybridSearch|withBrain|evidenceFor" src/lib/nex-native src/app/nex-native` · expect 0 (unchanged · chain never reached these paths)
   - `rg "@/lib/nex/intelligence['\"']|@/lib/nex/orch|@/lib/nex/knowledge|from.*_catalog_hook" src/` · expect 0
   - Chat/watches/inbox/i18n regression suites · expect unchanged pass counts
   - Hendra 7-area walkthrough · expect 13/13 OK
5. Rollback: targeted `git checkout HEAD -- <specific-path>` per file if any gate fails. Never broad `git reset` or `git checkout --`.

#### 10N.10 Delivery boundary (unchanged)

Phase 2c is read-only. **No files deleted. No files modified. TS baseline unchanged at 1245. Dirty tree + pre-existing stash intact.** No commits · no push · no deployment · no production migration · no production data modified. Phase 2d is explicitly NOT executed.

### 10O · Phase 2d · EXECUTED · 2026-10-28 · all 7 gates pass · retained

**Pre-flight baseline**: HEAD `e6e4ac82` · 222 dirty paths · pre-existing stash intact · Materials 31 D unchanged · zero in-scope local mods or untracked content · manifest reconciled (1 + 12 + 21 + 2 = 36 files) · TS baseline **1245**.

**Transaction executed**:
- `rm -rf src/lib/nex/intelligence/` (12 files)
- `rm -rf src/lib/nex/orch/` (21 files)
- `rm -f src/lib/nex/knowledge.ts` (1 file)
- `rm -f src/lib/nex/brains/_catalog_hook.ts src/lib/nex/brains/_catalog_hook.test.ts` (2 files)
- Edit on `src/lib/nex/brains/index.ts` · removed single line `export { withBrain } from "./_catalog_hook";` (line 49 of pre-edit file)

**Verification gates · all PASS**:

| Gate | Expected | Actual |
|---|---|---|
| 1 · TypeScript delta | reduction, precise count only post-exec | **1245 → 1244 (−1)** · one in-chain error removed · zero new errors |
| 2 · Dangling references across repo | 0 | 0 for all four chain paths · no orphan imports |
| 3 · Symbol checks in nex-native | 0 | 0 for retrieveKnowledge, hybridSearch, withBrain in both lib/nex-native/ and app/nex-native/ |
| 4 · Regression suites | unchanged pass counts | chat/watches 192/192 · chat-inbox + free-chat + i18n 47/47 |
| 5 · Hendra 7-area walkthrough | 13/13 OK (route-rendering only) | **13/13 OK** · explicitly a route-rendering check, not functional end-to-end verification |
| 6 · Scope integrity | exactly 36 D + 1 M attributable to Phase 2d · unrelated dirty work intact · retained files present | 36 Phase 2d D + 31 Materials D (preserved from Step 1) + 1 M (brains/index.ts edit) · `indonesia/knowledge.ts`, `intelligence-storage-grid/`, `brains/index.ts`, `brains/_schema/`, `brains/*` survivors all present |
| 7 · Stash integrity | pre-existing stash untouched | `stash@{0}: pre-nex-fork-snapshot-20261010-200712` intact |

**One investigation finding during gate 6**: a spot-check flagged `src/lib/knowledge/search.ts` as "MISSING". Investigation showed this file **never existed in HEAD** — it was already a missing-module reference consumed by `src/lib/nex/agent.ts:20` as a pre-existing TS2307 error, unchanged by Phase 2d. Not a regression.

**Transaction retained** · no rollback required · dirty tree total 259 lines (222 pre + 36 deletions + 1 modification).

**Delivery boundary strictly observed**: no commit · no push · no deployment · no production migration · no production-data modified. The deletions are staged only as uncommitted working-tree changes. Rollback available via targeted `git checkout HEAD -- <specific path>` per file at any time.

**Cumulative session TS reduction**:

| Phase | Baseline → Final | Delta |
|---|---|---|
| Session start | 1299 → 1273 | −26 (Waves 1-3 + 6 TS hygiene) |
| Batch A Step 1 (Materials) | 1273 → 1245 (adjusted) OR 1268 → 1245 (Batch-A-local) | −23 (local to Batch A) |
| Batch A Phase 2d (Intelligence/orch/knowledge/_catalog_hook chain) | 1245 → **1244** | **−1** |
| **Session total** | 1299 → **1244** | **−55** |

The intelligence chain cleanup was architecturally significant (36 files + 1 edit removed) but numerically modest for the TS score — the chain had only 1 own TS error. Its real value is the architectural simplification: 36 files of trades-era legacy infrastructure retired, atomic transaction without regression.

### 10L · Methodology miss + prevention

**What went wrong**: Phase 2 verification used only absolute-path greps:
- `rg "@/lib/nex/intelligence[^-]"` — correctly caught zero external absolute imports
- `rg "from.*@/lib/nex/intelligence/"` — correctly caught zero external absolute imports

But missed relative imports from sibling files in the same directory:
- `src/lib/nex/knowledge.ts` → `from "./intelligence"` ← this is a sibling-relative import that was invisible to the absolute-path grep

**For Batches B/C/E**: verification must include BOTH:
- Absolute `@/lib/<path>` imports
- Relative `./<name>` and `../<name>` imports from siblings and parents

**No one-line retry fix**: deleting intelligence while `knowledge.ts` exists will always regress. Either (a) delete both intelligence + knowledge.ts if knowledge.ts turns out to have zero consumers (needs Phase-2b verification), or (b) replace the `./intelligence` import in knowledge.ts with something else, or (c) accept intelligence stays nexapp-side until the facade is retired by a feature decision.

### 10H · What this plan does NOT touch

- Batches B, C, D, E remain in their prior state. No read-only verification of those is done here.
- The Hammerex runtime risk audit is a separate work stream (Batch D) and remains untouched.
- The `kit_or_product_supplier` type extension from Wave 6 lives in the staircase cluster (Batch C territory), not Batch A. No conflict.
- The `priority_prefixes` / `intelligence_status` owner-decision blockers (Waves 4, 5) live in `src/lib/nex-agent/code-engine/*` and `src/lib/nex/master-ai/*` (Batch B territory), not Batch A.
- No sealed-doctrine files, no Vault, no NEX Directory Spine, no Chat Master Layout, no design tokens, no pricing, no payment — none touched.

---

## 8 · Hendra journey verification · 2026-10-28 session (addendum)

Executed under founder directive 2026-10-28 (Hendra as full-flow test persona). All changes are **local, uncommitted, no production data modified**. The dirty tree is preserved.

### 8.1 · Hendra 7-area walkthrough matrix (final · 13/13 OK)

| Area | Route | Status |
|---|---|---|
| Chat landing | `/chat` → redirect to `/contacts` | OK |
| Chat inbox | `/chat/inbox` | OK (empty · Hendra has 0 peer conversations) |
| Themes library | `/chat-themes-library` | OK |
| Themes · watches-hendra | `/themes/watches-hendra` | OK (hendra marker present) |
| Intro settings | `/settings/intro-video` | OK (avatar renders) |
| Vault | `/vault` | OK (route-opened only · entitlement/LOCKED-policy correctness NOT verified) |
| Shop · public | `/hendra-watches` | OK (requires `NEX_COMMERCE_ENABLED=1`) |
| Shop · manage | `/manage/shop` | OK (requires `NEX_COMMERCE_ENABLED=1`) |
| Directory | `/directory` | OK (hendra tile present) |
| Live feed | `/live` | OK |
| Live · go-live | `/live-commerce/go-live` | OK (broadcaster self-view is camera; no viewer avatar needed) |
| Profile · me | `/profile/nex-50014` | OK (avatar renders) |
| Contacts | `/contacts` | OK (Hendra has 0 friends · fix code-correct, visually unverified) |

### 8.2 · Avatar propagation audit

- **Canonical source**: `nex_account_profile.avatar_url` (Migration 045). Hendra's seeded value verified.
- **Reader**: `getProfileByAccountId()` · `src/lib/nex-native/account-profile-service.ts`.
- **Session shape**: `resolveNexAppSessionFromContext()` returns `account: NexAccountRow` WITHOUT the avatar · callers must explicitly fetch the profile.
- **Two wiring defects repaired** (data-layer only · no sealed-UI changes):
  - `src/app/nex-native/contacts/page.tsx:203` · stale `avatarUrl: null` replaced with `profile?.avatar_url ?? null` using the already-fetched `friendProfiles[i]`.
  - `src/app/nex-native/chat/inbox/page.tsx` (3 edits) · added `accountProfileService` import; added `peerAvatarUrl` to `InboxRow`; parallel-fetched peer profile; swapped inline initials-only circle for conditional `<img>` fallback (themed border preserved).
- **By-design surfaces** (correctly show business/partner/content, NOT viewer avatar): Vault, Live feed, Directory, Shop public, Shop manage, Live go-live.
- **Sealed-UI constraint** (out of scope): ControlDrawer identity-bar is sealed 2026-10-16 as `displayName + nexHandle + chat-theme thumbnail` · no avatar slot. "Same avatar across chrome" would require explicit owner-authorised sealed-UI change.
- **Visual proof gap**: Hendra has 0 seeded friends/conversations · the Contacts/inbox fixes are TS-clean and code-correct but need populated peer data to prove visually.

### 8.3 · `/manage/shop` gate fix

- Not an ownership gate. The redirect at `src/app/nex-native/manage/layout.tsx:28-30` is the sealed Phase-1 commerce launch flag · unconditional for `/manage/*` because App Router layouts don't see `?commerce=1`.
- Added `NEX_COMMERCE_ENABLED=1` to `.env.local` with a dated owner-directive block · the sealed doctrine's own escape hatch at `manage/layout.tsx:14`. Local dev only · gitignored · prod unaffected.
- Verified the flag does NOT bypass authorization:
  - `/[businessSlug]/page.tsx` renders public business pages for any viewer · setup-complete banner independently gated by `owner_account_id === viewer.account.id`.
  - `/manage/shop/page.tsx` filters by `businessService.listBusinessesByOwner(session.account.id)` · owner-scoped at the service layer regardless of launch flag.

### 8.4 · ERR_ABORTED diagnosis (not an app defect)

- Both `/chat/inbox` and `/hendra-watches` return HTTP 200 clean when probed in isolation (curl + direct Playwright probe).
- Root cause: Playwright navigation race · each failing route followed a server-side redirect route (`/chat` → `/contacts`; `/vault` layout mount timing). Next `page.goto` fired before previous navigation committed.
- Fixed in walkthrough script via `about:blank` + 250ms settle between routes.

### 8.5 · Track A · Watch listing E2E production path · verification

**Code-complete locally · structurally blocked in prod.** No in-scope defects.

| Surface | Code | Prod behavior |
|---|---|---|
| `/nex-native/watches` (public search) | ✓ | HTTP 200 · "No watches listed yet. Be the first." empty state · service fail-open |
| `/nex-native/watches?q=rolex` (tsvector search) | ✓ | HTTP 200 · same empty state |
| `/nex-native/watches/[listingId]` (public detail) | ✓ | Cannot verify · no published listings |
| `/nex-native/manage/watches/new` (seller upload) | ✓ | HTTP 200 · full 3-tier progressive-disclosure form renders · "Save draft" available · "Publish" correctly disabled with honest "Payment unavailable" message (dev-mock payment flag unset) |
| `/nex-native/dev/watches-upload-preview` (dev tour) | ✓ | HTTP 200 · full form tour |
| Directory tile projection via `watch_listing_directory_v` | ✓ | Fail-open · directory + home render cleanly without any watch tiles · no crash |

**Prod DB state (introspected 2026-10-28)**: zero watch-related tables/views exist in `ijvqdvsvwtwxzcqmoqit`.

**Vitest**: `src/lib/nex-native/watches/` · 7 files · 101 tests · 101 pass.

**What CANNOT be verified without separate authorization**:
1. Create → persist (needs migrations 227–230 applied to prod)
2. Draft → publish transition (needs migrations + payment provider wired OR dev-mock opt-in with migrations present)
3. Edit / archive / status transitions (needs existing listing)
4. Directory tile projection with actual data (needs migrations + published listing with entitlement)
5. Public detail page with real id (needs migrations + published listing)

**What IS verified safely**:
- No in-scope defect to fix. Fail-open behavior is correct and honest.
- Dev preview form at `/dev/watches-upload-preview` is a complete unauthenticated UI tour.
- Publish button correctly disabled with honest reason copy.
- Service layer tests all green against local `nex_dev` (where migrations ARE applied).
- Directory + home surfaces don't crash when the view is missing.

**Decision gates blocking production completion**:
- Migration apply to prod (227 + 228 + 229 + 230) · pre-apply review DONE (task #79) · needs offline-window authorization per Supabase Project seal + CLAUDE.md §5.
- Payment provider configuration (Stripe/Xendit webhook secret) OR dev-mock opt-in with explicit scope.
- Rp 30,000 / 30-day service fee is still DRAFT in the payment-doctrine amendment · activating it requires price-approval decision.

### 8.6 · Files changed this session (preserve-dirty-tree accurate)

New files written this session (in addition to pre-existing dirty tree):
- `src/app/nex-native/contacts/page.tsx` (edited · lines 201–204)
- `src/app/nex-native/chat/inbox/page.tsx` (edited · 3 regions)
- `.env.local` (two local-dev blocks: `NEX_COMMERCE_ENABLED=1` + `NEX_DEV_IMPERSONATE_HANDLE=hendra`)
- `scripts/hendra-walkthrough.mjs` (walk script · settle-between-navs fix)
- `scripts/hendra-walkthrough-results.json` (artefact)

**No commit · no push · no production migration · no production data modified.**
