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
| C-01 | Message-send failures redirect with `message_error=…` query param but no UI consumer surfaces it | `chat/peer/[accountId]/page.tsx:143-147` · `_actions.ts:817-828` | HIGH | Y · tone + retry policy |
| C-02 | Sticker send failures same pattern as C-01 (`sticker_error=…` unconsumed) | `chat/peer/[accountId]/page.tsx:143-147` · `_actions.ts:1129-1132` | HIGH | Y · same policy as C-01 |
| C-03 | Upload errors `upload_error=…` unconsumed; comment at line 148 acknowledges | `chat/peer/[accountId]/page.tsx:107-111` | MEDIUM | Y · same policy as C-01 |
| C-04 | Delete errors `delete_error=…` unconsumed; code comment explicitly documents the gap | `chat/peer/[accountId]/page.tsx:143-147` | MEDIUM | Y · same policy as C-01 |
| C-05 | `/conversations` commerce-gate silent redirect to `/home` with no explanation | `conversations/page.tsx:32-40` | LOW | Y · is this feature-lock or product? |
| C-06 | `/free-chat/call/page.tsx:263-265` renders Mute/Speaker/Add/Record/Keypad buttons with empty onClick handlers | `free-chat/call/page.tsx:263-265` | MEDIUM | N · can mark aria-disabled with honest tooltip |
| C-07 | `?focus_product=<id>` with unknown id opens FocusedShopSheet with no highlight ("honest-null" per code but user-ambiguous) | `chat/peer/[accountId]/page.tsx:158-161` + `_focused-shop-sheet.tsx` | LOW | N · documentation only |
| C-08 | `?pending_product` dropped across sign-in redirect; only `focus_product` whitelisted | `chat/peer/[accountId]/page.tsx:167` | MEDIUM | Y · known trade-off or oversight? |
| C-09 | Empty inbox CTA is a Link, not a button-weight affordance | `chat/inbox/page.tsx:382` | LOW | N · cosmetic |
| C-10 | Stale comment block documenting the retired "Create free NEX" sticky footer | `free-chat/page.tsx:385-393` | LOW | N · pure hygiene |
| C-11 | Chat-prefs migration 199 unapplied; typing + online status fail-closed silently | `chat/peer/[accountId]/page.tsx:172-180` | LOW | N · correctly gated; defer until migration 199 lands |
| C-12 | Unread badge spacing can occlude message body on mobile | `conversations/page.tsx:275-281` | LOW | N · cosmetic responsive refinement |

**Cross-area pattern**: C-01 through C-04 (and C-08) are a SINGLE pattern · the chat page redirects with error query params but there is no toast / banner / consumer. A single error-banner-consumer component on the peer chat page would resolve 5 findings. The pattern needs **one product policy call** (tone, dismissability, retry affordance) before any build.

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
