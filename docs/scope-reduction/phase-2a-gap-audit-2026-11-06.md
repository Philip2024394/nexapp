# Phase 2a · Gap Audit (2026-11-06)

**Status:** READ-ONLY audit — no code changes.
**Branch:** `phase-x/scope-reduction-chat-themes-shop-vault-2026-11-06`
**HEAD at audit:** `fdf21e8` (Phase 1c Batch 9 · Archive retired doctrine)
**Typecheck baseline:** 1187 pre-existing errors (Phase 1c target: do not regress)
**Scope context:** KEEP → Chat · Chat Themes · Shop (bundles Vault) · Community Notice · Directory · Vault. REMOVED → Live, Music, nex-feed, Dev-live diagnostics, Trade Centre, Staircase, harvester, Starter Pack, Power Tokens, Sponsorship, non-shop Daily Discovery pool.
**Authority:** docs/doctrine/nex-shop-entitlement-contract-LOCKED-2026-11-06.md § K.

---

## § 1 · Dead links / dead URL strings in KEPT surfaces

### 1.1 Hit summary by removed route (grep `'/nex-native/<route>'` + nearby patterns, excluding `__tests__` noise where listed)

| Removed route token | TS/TSX string literal hits in `src/` |
|---|---|
| `/nex-native/live-commerce` | **0** (all callers deleted in Batch 4) |
| `/nex-native/go-live` | **0** |
| `/nex-native/music` (route-path form) | **0** — remaining 2 hits are comment-only references to the deleted `src/lib/nex-native/music/*` module (classification (c), not links) |
| `/nex-native/create/upload-music` | **0** |
| `/nex-native/nex-feed` | **9** (navigation + revalidate mix) |
| `/nex-native/manage/live` | **7** (one function-def header + one redirect helper + one prototype card + 4 `revalidatePath` calls) |
| `/nex-native/community-discovery` + `/manage/community-discovery` | **8** (route + API still live — see § 1.4) |
| Legacy `/nex-live/<...>` strings | **17 across lib + components** (classification varies — mostly historical comments inside kept infrastructure, see § 1.5) |

**Dead-link total requiring Phase 2 action in KEPT surfaces: 24 hits across 6 files.**

### 1.2 `/nex-native/nex-feed` — dead-link detail (9 hits)

| File:line | Kind | Classification |
|---|---|---|
| `src/components/nex-native/control-drawer/control-drawer-client.tsx:311` (comment) + `:317` (href) + `:997` (quick-access row) | **(a) navigation link** — the drawer's "Nex Live" / Quick-access "Live" row routes to a deleted feed. Three hits in one file. | REPLACE or REMOVE row |
| `src/app/nex-native/themes/theme-1/_composer.tsx:217` | **(a) navigation link** — PlusTile "Live post" in composer | REMOVE PlusTile |
| `src/app/nex-native/themes/pink-dream/_composer.tsx:362` | **(a) navigation link** — PlusTile "Live post" in composer | REMOVE PlusTile |
| `src/app/nex-native/_actions.ts:5862` | **(b) revalidatePath** inside `createLivePostAction` | DELETE revalidate (surface gone) |
| `src/app/nex-native/_actions.ts:5889` | **(b) revalidatePath** inside `expireLivePostAction` | DELETE revalidate |
| `src/app/nex-native/_actions.ts:5921` | **(b) revalidatePath** inside `updateLivePostBodyAction` | DELETE revalidate |
| `src/app/nex-native/_actions.ts:5939` | **(b) revalidatePath** inside `extendLivePostExpiryAction` | DELETE revalidate |

### 1.3 `/nex-native/manage/live` — dead-link detail (7 hits)

All in `src/app/nex-native/_actions.ts`:
- `:428` (comment) + `:431` (`redirectToManageLiveWithBanner` helper body) → **(a) helper routes to a deleted admin page**
- `:5861 / :5888 / :5920 / :5938` → **(b) revalidatePath** calls alongside the nex-feed revalidates
- Also at `src/app/nex-native/home-prototypes/3/page.tsx:18` → **(a) prototype-card nav link** ("Go live" emoji tile)

**Related dead surface:** the 4 server actions `createLivePostAction / expireLivePostAction / updateLivePostBodyAction / extendLivePostExpiryAction` in `_actions.ts:5700-5945` import `liveService` from `src/lib/nex-native/live-service.ts` (Live-**Post** text feature, not Live-Commerce) and redirect to the deleted `/nex-native/manage/live`. The `liveService` module, the 4 action exports, and the `redirectToManageLiveWithBanner` helper form a **closed dead loop** — no surviving KEPT surface calls them. Phase 2 can delete the actions + the helper. The underlying `nex_live_post` table (migration 029) is a migration-reversal question for Batch 10.

### 1.4 `/nex-native/community-discovery` + `/manage/community-discovery` — dead-link detail (8 hits)

This route is listed as REMOVED in the Phase 2a brief (§ 1 "NOT /community/* which stays") but it currently still exists in-tree:
- `src/app/nex-native/manage/community-discovery/page.tsx` (page)
- `src/app/api/nex-native/manage/community-discovery/route.ts` (API)
- `src/app/nex-native/manage/page.tsx:522` (nav link INTO it)

**Context:** Phase 1c Batch 5 deleted the entire `community/` tree AND `manage/community-discovery/` + its API route in commit `4096601`. Mid-flight owner scope-correction (commit `b3c8a1c`) reverted Batch 5 entirely because Community Notice was ruled KEPT. The revert was wholesale — it brought `community-discovery` back along with Community Notice. The scope-reduction brief says `/community-discovery` is REMOVED while `/community/*` STAYS.

**FLAGGED FOR OWNER DECISION (Phase 2):** Is the business-owner-facing **community-discovery toggle** (business owner opts a shop into a hyperlocal welcome-card placement) part of the KEPT Community Notice feature (= keep and wire to Shop), or is it a separate per-shop discovery lever that goes away with the harvester / non-shop Daily Discovery removal (= delete again)? This is not a self-resolvable question. Default proposal: **DELETE again** — the sealed Daily Discovery doctrine (2026-11-05) replaces the per-shop welcome-card mechanism with the `nex_product.discovered_at` SECURITY DEFINER RPC pattern; `community-discovery` would then be the OLD per-business welcome-card lever, superseded.

### 1.5 Legacy `/nex-live/<...>` strings — 17 hits

These live in `src/components/nex-app/live/*` (`CreateWorldPanel.tsx`, `creator-actions.ts`, `CreatorPanel.tsx`) and `src/lib/nex/live/*` (`live-status.ts`, `mock-fixtures.ts`, `report.ts`, `media-declaration-store.ts`, `city-live-groupings.ts`, `free-content-intro-policy.test.ts`, `entity-live-query.ts`, `upload-validation.ts`), plus `src/components/nexapp/NexWorkspaceProducts.tsx:42,266,387` and `src/lib/nex/brain/live-discovery-handler.ts`.

These form a **separate legacy `/nex-live` surface** distinct from `/nex-native/live-commerce` — it predates the live-commerce batch and was never on the Phase 1a deletion list. Content mix:
- `src/components/nex-app/live/CreateWorldPanel.tsx` + `creator-actions.ts` + `CreatorPanel.tsx` → **(a) navigation links** to `/nex-live/upload` + `/nex-live/my` + routes/APIs under `/api/nex-live/*` that do not exist in the current tree. Classification: **dead-navigation residue** of a never-shipped feature.
- `src/lib/nex/live/*` + `NexWorkspaceProducts.tsx` → **(b) analytics/fetch targets** at `/api/nex-live/tonight`, mock-fixture paths, test URLs. Classification mixed: library modules that back the dead nav; some test assertions.

**FLAGGED:** This entire tree (`src/components/nex-app/live/*` + `src/lib/nex/live/*` + `NexWorkspaceProducts.tsx`) is **out of scope for Phase 2 batch 2a** per the brief ("dead links in KEPT surfaces"). If no KEPT page mounts `CreatorPanel` / `CreateWorldPanel` / `NexWorkspaceProducts`, they are orphan residue — recommend a separate **Phase 2+ sweep decision** to delete the whole `nex-app/live/*` + `lib/nex/live/*` sub-trees as follow-up to Batch 4. Audit is NOT proposing this deletion inside Phase 2 scope without confirmation.

### 1.6 "Go Live / Upload Music / Live Now" display-string hits

- `Live Now` string hits in `settings/intro-video/*` + `chat-standard/_standard-intro-overlay.tsx` are **"View Live Now" CTA on intro-video flow** — the CTA points to `/nex-native/settings/intro-video/live` (the owner's own personal intro-video live-landing, sealed 2026-10-20). **Not related to Live Commerce or Live feed.** KEEP.
- `Go Live` + `Upload Music` string hits are all inside `src/components/nex-app/live/*` (the same orphan tree flagged in § 1.5). No KEPT surface renders these strings.

### 1.7 Related: `liveService` closed dead loop in `_actions.ts`

Not a URL string but a related dead-code surface produced by route removal:
- `src/app/nex-native/_actions.ts:81` imports `liveService` from `@/lib/nex-native/live-service`
- 4 server-action exports (`createLivePostAction / expireLivePostAction / updateLivePostBodyAction / extendLivePostExpiryAction`, `_actions.ts:5700-5945`) only emit `redirectToManageLiveWithBanner` to the deleted `/nex-native/manage/live`
- `src/lib/nex-native/live-service.ts` is now reachable ONLY from these 4 unreachable actions

→ Phase 2 Batch A should DELETE: the 4 action exports + the helper + the module + the `liveService` import + `revalidatePath("/nex-native/nex-feed")` calls + `revalidatePath("/nex-native/manage/live")` calls. The `nex_live_post` table (migration 029) is the migration-reversal question for Batch 10.

---

## § 2 · Starter Pack residue

Grep sweep:
- `rg -i "starter_?pack|StarterPack" src/` → **0 hits**
- `rg -i "starter_?pack|StarterPack" nex-supabase/` → **0 hits**
- `rg -i "intent=starter_pack" src/` → **0 hits**
- `ls nex-supabase/migrations/ | rg -i "starter|281"` → **0 hits** (latest on phase-x is mig 256; mig 281 lives on phase-u)

**Starter Pack residue on phase-x: ZERO hits. Clean.** Phase 1a § 6.C audit result confirmed; Phase 1c did not reintroduce.

---

## § 3 · Phase 2 required deliverables

### A · Retire the "deliberately-untouched-at-signup" hold · wire `startBusinessTrial` on business signup

- **WHAT:** `createNexAccountAction` currently writes a new account row without starting any business trial (per the sealed 2026-10-18 hold). § K-3 RETIRES that hold and requires the 7-day trial to auto-fire on first business signup. The Phase 2 wiring calls `startBusinessTrial(account.id)` on the signup success path when the user's `WELCOME_INTENT_COOKIE` indicates business intent.
- **WHY:** § K-3 (locked) · § H gate B4 (trial auto-fire or disclosure wiring agreed)
- **WHERE:**
  - `src/app/nex-native/_actions.ts:123-399` → `createNexAccountAction` (add trial-start call on business intent path before `redirect("/pick-theme")`)
  - `src/lib/nex-native/business-trial/service.ts:187` → `startBusinessTrial` (already exists; just call it)
  - `src/lib/nex-native/pricing-config.ts:187-198` → flip `autoFiresOnSignup` on the `nex_business` package from `false` → `true` ONCE the wiring is proven
  - Tests to update: `src/app/nex-native/create-account/building/__tests__/building-setup.test.ts:394` (`startThemesTrial` guard) + `src/app/nex-native/welcome/__tests__/welcome-trial-copy.test.ts:117` (welcome-trial-copy guard). Per § H-B5, these guards must retire **in the same commit** that ships the approved copy.
  - `src/app/nex-native/__tests__/slice-*` fixtures mock `startThemesTrial` — these are mocks and do not block.
- **EFFORT:** **M** — one import + one call + one pricing-config flag flip + 2 sealed-guard retirements in the same commit + likely a new business-trial test fixture. Trial service itself is already built.
- **BLOCKS ON:** § H gates B4 + B5 (same commit discipline). Non-blocked on § H gates B1 / B3 because trial start does not require price validation nor migration 281+ work.

### B · Closed-shop URL soft-landing page

- **WHAT:** `/nex-native/{slug}/page.tsx` currently calls `notFound()` at line 241 when `getBusinessBySlug` returns null. § K-4 requires a soft-landing render for shops that WERE active but whose membership has expired > 30 days.
- **WHY:** § K-4 (locked) · § E-4 (post-grace permanent-closure behaviour)
- **WHERE:**
  - `src/app/nex-native/[businessSlug]/page.tsx:240-245` — add a branch: distinguish "no such slug ever" (keep `notFound()`) from "slug exists but membership_active=false AND period_end > 30 days ago" (render soft-landing).
  - Current state of slug page: already Live-unaware after Phase 1c Batch 4 (see page comment at `:33-35`). Page does NOT currently inspect any `membership_active` column (none exists yet).
  - Dependency on § G schema: `nex_business.membership_active boolean` + `membership_period_end timestamptz` columns do NOT exist today. **Without those columns, Phase 2 cannot write the "day 30+ grace expired" branch cleanly.**
  - Minimum Phase 2 deliverable (without new schema): render the soft-landing **shell + chat CTA** behind a feature flag reading `nex_business.status='archived'` OR a boolean-equivalent for membership that the schema PR adds.
- **EFFORT:** **M** (shell + routing) or **L** if § G schema migration is bundled.
- **BLOCKS ON:** § H gate B3 (schema migration) for the authoritative version. A placeholder shell CAN ship ahead of schema if it reads `status='archived'` only.

### C · `/nex-native/shop/create` pricing wall for unauth visitors

- **WHAT:** § K-2 locks Shop as pay-only. An unauthenticated visitor reaching a "create a shop" entry point must see a pricing-preview wall + "Start 7-day free trial" CTA + sign-in, **not** a form.
- **WHERE:**
  - `src/app/nex-native/shop/create/page.tsx` — **DOES NOT EXIST**. There is NO `/nex-native/shop/` routable directory (only `/nex-native/shop-prototypes/` + `/shop-prototypes-v2/` + `/shop-share-demo/` which are prototype surfaces, never user-facing).
  - Current signup/entry points for Shop creation flow:
    - `src/app/nex-native/create-account/business-welcome/page.tsx` (signed-in business welcome)
    - `src/app/nex-native/create-account/business-kind/page.tsx` (business kind picker)
    - `src/app/nex-native/manage/shop/page.tsx` (post-creation shop edit surface)
    - `src/app/nex-native/packages/page.tsx` (the public 2-tier Gratis + Bisnis landing — unauth-visible)
  - `src/app/nex-native/packages/page.tsx:171-186` already RENDERS a Bisnis card with a CTA `href="/nex-native/create-account?intent=bisnis"` + secondary "chat with NEX" CTA for existing users. This IS the pricing wall for unauth visitors today, except (i) it says "Rp 99,000 per month" hard-coded (not from `pricing-config`), (ii) it does not explicitly say "7-day free trial", and (iii) it never routes to `/shop/create`.
- **REQUIRED CHANGE:** Either (a) create `src/app/nex-native/shop/create/page.tsx` that mirrors the packages Bisnis card in the "unauth path" branch and routes signed-in users to `/create-account/business-welcome`, OR (b) KEEP `/packages` as the public wall and add a short-circuit in `/manage/shop` to redirect unauthenticated visitors to `/packages?intent=bisnis`. Option (b) is cheaper.
- **EFFORT:** **S** (route one redirect in `/manage/shop/page.tsx` guard) or **M** (new `/shop/create/page.tsx` + packages-copy harmonisation).
- **BLOCKS ON:** none directly. Welcome-card copy alignment (deliverable E) must happen alongside to satisfy "same story" per § H-B5.

### D · Country / IP detection at create-account

- **WHAT:** § B-3 requires country persistence at account creation so the user sees local-currency pricing.
- **CURRENT STATE:** `src/app/nex-native/create-account/page.tsx:29-41` **already** reads `x-vercel-ip-country` → `cf-ipcountry` → `x-nex-ip-country` → `accept-language` via `readCountryHint()`. The helper is called at `:98` and the result flows into `TwoStepSignupForm` as `initialIso2`. **Detection is done.**
- **GAP:** The detected ISO-2 is NOT persisted anywhere — `accountService.createAccount` (`src/lib/nex-native/account-service.ts`) takes no country parameter. `nex_account.country_iso2` column does not yet exist (§ G migration pending).
- **WHERE:**
  - `src/lib/nex-native/account-service.ts:65-100` — add `country_iso2?: string` input to `createAccount` signature.
  - `src/app/nex-native/_actions.ts:204-230` — thread `countryIso2` from `_two-step-signup-form` submission into `createAccount`.
  - § G migration: `nex_account.country_iso2 text NULL CHECK (country_iso2 ~ '^[A-Z]{2}$')`.
- **EFFORT:** **S** (code wiring, 2-3 files) + **S** (migration SQL) = **M** total when both ship.
- **BLOCKS ON:** § H gate B3 (schema migration). Code wiring is safe to ship in a column-nullable migration; prices do not need to resolve from country until packages-copy harmonisation (deliverable E).

### E · Welcome-card copy alignment ("same story")

- **WHAT:** § K-1 LOCKED core-four currencies (USD · GBP · IDR · EUR). The Business card everywhere (welcome / packages / signup / billing emails) must say "7 days free, then [price]" where price matches the detected country.
- **CURRENT STATE:**
  - `src/app/nex-native/welcome/page.tsx:109 imports from pricing-config.ts` — welcome card is pricing-config-driven. Chip renders "7 days free, then $9.99/month" ONCE `autoFiresOnSignup=true` + price `status='APPROVED'`. Currently both are `PROPOSAL` so the chip falls back to "See all plans →".
  - `src/app/nex-native/packages/page.tsx:174-175` — hard-coded "Rp 99,000 per month · IDR 990k / year" in a `PackageCard` prop. **Not** reading `pricing-config`. This is the misalignment that § K-1 + § H-B5 explicitly call out.
  - `src/app/nex-native/packages/page.tsx:224` — body copy repeats "Rp 99,000" hard-coded.
- **REQUIRED CHANGES:**
  - `src/lib/nex-native/pricing-config.ts`: add 3 more regional price entries (GBP · IDR · EUR) alongside the USD anchor; add a lookup by ISO-2.
  - `src/lib/nex-native/pricing-config.ts:197`: flip `autoFiresOnSignup: false → true` once § A wiring lands.
  - `src/lib/nex-native/pricing-config.ts:183` + `:203`: flip `status: "PROPOSAL" → "APPROVED"` once owner validates (§ H-B1).
  - `src/app/nex-native/packages/page.tsx:171-186` + `:224-225`: replace hard-coded Rp 99,000 with a `pricing-config` resolver call keyed on detected country.
  - `src/app/nex-native/welcome/page.tsx`: update secondary line to include "7 days free, then [price]" when all three unlocks pass.
- **EFFORT:** **M** — pricing-config entries + packages-copy edit + welcome-card chip-text update. All in files already touched by sealed guards; those guards must retire **in the same commit** per § H-B5.
- **BLOCKS ON:** § H gates B1 (price validation) + B4 (deliverable A wiring complete) + B5 (same-commit guard retirement). **If owner has not validated prices with real customers (B1 OPEN), the pricing-config entries must stay `status='PROPOSAL'` and the Business chip stays on the "See all plans →" fallback — the module's readiness guard handles this.**

### F · Nav / menu cleanup

- **WHAT:** Ensure app chrome does not offer Live / Music / nex-feed / Trade-Centre entries after Phase 1c deletions.
- **CURRENT STATE:**
  - `src/app/nex-native/_shell.tsx` (69 lines): **clean** — no Live / Music / nex-feed strings.
  - `src/components/nex-native/control-drawer/control-drawer-client.tsx`: **3 nex-feed hits** (`:311` comment, `:317` href on "Nex Live" row, `:997` quick-access "Live" row). These are the deliverable-F action items.
  - `src/app/nex-native/themes/theme-1/_composer.tsx:217` + `src/app/nex-native/themes/pink-dream/_composer.tsx:362`: **PlusTile "Live post"** — composer surface still offers a Live-post tile routing to the deleted feed.
  - `src/app/nex-native/home-prototypes/3/page.tsx:18`: `{ href: "/nex-native/manage/live", emoji: "🔴", title: "Go live" }` — prototype surface (not production), still a dead link.
  - `src/app/nex-native/manage/page.tsx:522`: still links to `/nex-native/manage/community-discovery` (see § 1.4 open question).
- **REQUIRED CHANGE:** Remove or repoint the three "nex-feed" + "manage/live" entries in `control-drawer-client.tsx`; remove the Live-post PlusTile from both theme composers; decide prototype cleanup (low priority).
- **EFFORT:** **S** (one commit, 4 files).
- **BLOCKS ON:** none.

### G · Dead doctrine references in code comments

- **WHAT:** Batch 9 archived 22 doctrine files to `docs/doctrine/_retired/`. Any code comment pointing at the old path is now a stale pointer.
- **CURRENT STATE:** Spot-check via `rg -n "docs/doctrine/nex-(live|music)-" src/` would surface candidates. Not critical-path for Phase 2.
- **EFFORT:** **XS** — only if touched during other edits.
- **BLOCKS ON:** none. **Skip unless a file is being edited for another deliverable.**

### Summary · Phase 2 deliverables

| Deliverable | Effort | Files touched (approx) | Blocks on |
|---|---|---|---|
| A · Wire `startBusinessTrial` on signup + retire deliberately-untouched hold | M | 4-5 | B4 + B5 (same commit) |
| B · Closed-shop soft-landing | M (shell) / L (schema) | 1-2 | B3 (schema) for authoritative version |
| C · `/shop/create` pricing wall | S or M | 1-2 | none (E for copy) |
| D · Country IP detection wiring | M | 3 + 1 migration | B3 (schema) |
| E · Welcome-card + packages copy alignment | M | 3-4 | B1 + B4 + B5 |
| F · Nav/menu cleanup + composer PlusTile removal | S | 4 | none |
| G · Doctrine-comment cleanup | XS | opportunistic | none |

**Deferred (XL):** Stripe wiring, migration 281+ for membership columns, buyer-seller cart flow, Daily Discovery Phase B.

---

## § 4 · Blocking gates (§ H enforcement items — status after Phase 1c)

| Gate | Short name | Status after Phase 1c | Why |
|---|---|---|---|
| **B1** | Price validated with real customers | **OPEN & BLOCKS LAUNCH** | Needs owner external action (customer discovery / survey / pilot) OR explicit acceptance of proposal as launch anchor. Code cannot help. |
| **B2** | § C entitlements have server-side authority | **PARTIALLY OPEN** | C-1/C-2/C-3/C-4/C-5/C-6/C-11 IMPLEMENTED (phase-v P1-P22). C-7 implemented + tier-gated. C-8 UNIMPLEMENTED (reserved per K-6). C-9 Vault POLICY LOCKED but ENFORCEMENT missing. C-10 claims mixed (see B8). |
| **B3** | Schema in § G applied | **OPEN** | No migration 281+ on phase-x. Needs phase-u merge or standalone shop-membership migration. |
| **B4** | Trial auto-fire or disclosure wiring agreed | **OPEN — Phase 2 deliverable A** | § K-3 retires the sealed hold. Code gap: `createNexAccountAction` does not yet call `startBusinessTrial`. Service exists. |
| **B5** | Welcome-card copy aligned to final price + trial | **OPEN — Phase 2 deliverable E** | Packages page hard-codes Rp 99,000; welcome card driven by `pricing-config` but packages page is not. "Same story" violated. |
| **B6** | Vault B6 "omit encryption copy" respected | **PRESUMED CLOSED** | No Shop-side copy currently claims encryption. Must verify every public card + Vault intro on next audit. Vault W7 ("100% PRIVATE" / "Always Available" copy at `vault/intro/page.tsx`) remains an independent bug, NOT a Shop-contract violation. |
| **B7** | Vault W1-W12 relevant gaps scheduled | **OPEN & BLOCKS LAUNCH** | W1/W2/W3/W4/W5/W7/W10/W12 are all unscheduled per Vault LOCKED 2026-10-20. W5 (download-everything ZIP) is a hard release blocker. |
| **B8** | Package Contract P1/P2/P3 claims resolved | **OPEN** | P1 (verified badge) no schema, no render. P2 (20 boosted messages) no quota code. P3 (cancel any time) admin-only. Each must build server-side OR be removed from Shop copy. |
| **B9** | Legal review scoped (not completed) | **OPEN & BLOCKS PUBLIC LAUNCH** | External workstream per Social Commerce D4. Does not block dev/preview. |
| **B10** | Daily Discovery Phase B migration separately authorised | **OPEN** | § K-6 LOCKED C-8 as "reserved, not in public copy" — this gate stays OPEN but does not block Shop membership public copy as long as C-8 benefit is omitted. |

**Open § H gates: 10 / 10 (B1-B10).** None CLOSED by Phase 1c. Phase 2 deliverables A + E close B4 + B5 together. Everything else remains for separate authorisation or external action.

---

## § 5 · Phase 2 batch plan proposal

Each batch = one commit; typecheck-clean; no cross-batch churn. Order minimises risk by starting with dead-code cleanup (safe) and ending with wiring that depends on it.

### Batch A · Dead-link cleanup in KEPT surfaces
- **WHAT:** Delete nex-feed PlusTile from both theme composers; remove nex-feed row + quick-access "Live" from `control-drawer-client.tsx`; remove home-prototypes/3 "Go live" tile; delete the 4 unreachable `LivePost` server actions from `_actions.ts` + the `redirectToManageLiveWithBanner` helper + the `liveService` import + revalidatePath calls to deleted routes.
- **FILES:** `src/app/nex-native/themes/theme-1/_composer.tsx` · `src/app/nex-native/themes/pink-dream/_composer.tsx` · `src/components/nex-native/control-drawer/control-drawer-client.tsx` · `src/app/nex-native/home-prototypes/3/page.tsx` · `src/app/nex-native/_actions.ts` (lines 428-432 + 5700-5945) · optionally `src/lib/nex-native/live-service.ts` (delete file) — **keep migration 029 reversal for Batch 10**.
- **TYPECHECK DELTA:** expect 0 — deleting unreachable exports does not affect TS surface outside the file.
- **RISK:** low.

### Batch B · Starter Pack residue sweep (no-op confirmation)
- **WHAT:** Grep-verify ZERO hits in `src/`, `nex-supabase/`, `scripts/`, `docs/`. Add an audit-note (no code change) if clean.
- **FILES:** none — this is an acceptance task, not a code change. Can be rolled into Batch A commit message as a confirmation line.
- **RISK:** zero.

### Batch C · `/manage/community-discovery` disposition
- **WHAT:** Owner decision (see § 1.4). If DELETE: remove the page + API + nav link in `manage/page.tsx:522` + reversal of migration 152's `nex_business.community_discovery_zone_id` FK (defer to Batch 10 reversal gate). If KEEP: re-wire it to a Shop-member-only gate.
- **FILES:** `src/app/nex-native/manage/community-discovery/page.tsx` · `src/app/api/nex-native/manage/community-discovery/route.ts` · `src/app/nex-native/manage/page.tsx:522`.
- **RISK:** low (deletion) · medium (if KEEP forces new shop-member gate ahead of § G schema).
- **BLOCKS ON:** owner decision.

### Batch D · Closed-shop soft-landing shell
- **WHAT:** Add soft-landing branch to `[businessSlug]/page.tsx` for shops with `status='archived'` (the only distinguisher available until § G schema lands). Chat CTA to seller's primary account.
- **FILES:** `src/app/nex-native/[businessSlug]/page.tsx` (one branch inserted after line 241).
- **TYPECHECK DELTA:** expect 0.
- **RISK:** low (feature-flagged on `status='archived'` which is already in schema).
- **FOLLOW-UP:** when § G schema lands, extend the branch to read `membership_active + membership_period_end` + 30-day arithmetic.

### Batch E · Country IP → `nex_account.country_iso2` wiring
- **WHAT:** Thread the already-detected country ISO-2 through signup. Add migration adding `nex_account.country_iso2` column (NULLABLE).
- **FILES:** `src/app/nex-native/_actions.ts:204-230` · `src/lib/nex-native/account-service.ts:65-100` · `src/app/nex-native/create-account/_two-step-signup-form.tsx` (if the form needs a hidden field) · `nex-supabase/migrations/NEW_country_iso2.sql`.
- **TYPECHECK DELTA:** expect 0 after the service signature update.
- **RISK:** medium — migration touches production `nex_account`; must be nullable; separate authorisation gate per § H-B3.

### Batch F · Trial auto-fire on business signup (+ guard retirement + welcome/packages copy alignment)
- **WHAT:** THE three-unlocks-same-commit batch. Wire `startBusinessTrial` in `createNexAccountAction` (business-intent path only); flip `pricing-config.ts` business trial `autoFiresOnSignup=true`; flip packages page off hard-coded Rp 99,000 onto `pricing-config`; retire welcome-trial-copy guard at `welcome/__tests__/welcome-trial-copy.test.ts` + building-setup guard at `create-account/building/__tests__/building-setup.test.ts`; add integration test proving auto-fire.
- **FILES:** `src/app/nex-native/_actions.ts` · `src/lib/nex-native/pricing-config.ts` · `src/app/nex-native/packages/page.tsx` · `src/app/nex-native/welcome/page.tsx` · 2 guard test files + 1 new integration test.
- **TYPECHECK DELTA:** expect 0.
- **RISK:** medium — same-commit retirement of 2 sealed guards is high-sensitivity but explicitly authorised by § K-3 LOCK. Mis-sequence (wire before guards retire → test red; retire before wire → welcome lies) means this MUST be one commit.
- **BLOCKS ON:** price-validation decision (§ H-B1). If prices remain `status='PROPOSAL'`, the chip falls back to "See all plans →" automatically via `isPackageReadyForLive`, and Batch F still ships cleanly.

### Proposed batch total: 6 (A-F)

Batch B is a confirmation, not a diff — can fold into A's commit message. Effective diff-producing batches: **5**.

---

## § 6 · Deferred items (XL · require external action)

| Item | Reason deferred |
|---|---|
| Stripe Checkout wiring (membership billing) | § H-B1 price validation + § H-B3 schema migration must close first. Hard gate per owner-sealed Entitlement-Contract-First rule 2026-11-05. |
| § G schema migration (membership_active + membership_period_end + country_iso2 + webhook_event_log + ledger + discovery RPC + idempotency) | § H-B3 separate authorisation required; phase-u merge for next migration number is a prerequisite. |
| Daily Discovery Phase B migration (`nex_product.discovered_at` + SECURITY DEFINER RPC) | Sealed doctrine 2026-11-05 says not authorised. Shop contract reserves C-8 internally only (§ K-6). |
| Buyer→seller cart + Stripe Checkout per-transaction wiring | Social Commerce D1 LOCKED on the model; implementation is XL + depends on legal review (§ H-B9). |
| Package Contract P1 (verified badge) · P2 (20 boosted messages) · P3 (customer-facing cancel UI) | Each is M-to-L on its own; collectively XL for Phase 2. Shop copy must omit these claims until built. |
| Vault W1-W12 (storage cap · per-file size · vault_tier column · grace scheduler · download-everything ZIP · audit log · intro-copy fix · legacy-migration verification) | All UNSCHEDULED per Vault LOCKED 2026-10-20. Hard launch blockers for any Vault-bundled claim. |
| Batch 10 migration reversal (mig 029 `nex_live_post` · mig 152 `community_discovery_zone_id` FK · mig 235/236/240/241 music · plus 244-256 country/visibility DRAFT hold) | Separate owner-authorisation gate per repo CLAUDE.md § 5. Phase 2 does not touch this. |
| Legacy `/nex-live/*` + `src/components/nex-app/live/*` + `src/lib/nex/live/*` orphan tree deletion (§ 1.5) | Not in Phase 2 brief. Needs separate confirmation that no KEPT surface mounts these components. |

---

## § 7 · Phase 3 readiness pre-check checklist

Before Phase 3 (Launch-readiness QC) begins, these should be TRUE after Phase 2:

- [ ] Typecheck errors ≤ 1187 (Phase 1c baseline). Phase 2 batches are architected to be type-neutral.
- [ ] `rg "'/nex-native/(live-commerce|go-live|music|upload-music|nex-feed|manage/live)'" src/` → 0 hits in production-reachable files.
- [ ] `rg "starter_?pack|StarterPack" src/ nex-supabase/` → 0 hits (currently clean; verify after each merge).
- [ ] `createNexAccountAction` business-intent path calls `startBusinessTrial` (deliverable A landed).
- [ ] `src/lib/nex-native/pricing-config.ts` core-four markets (USD/GBP/IDR/EUR) present; Business trial `autoFiresOnSignup=true`.
- [ ] `src/app/nex-native/packages/page.tsx` reads Bisnis price from `pricing-config.ts`, not hard-coded Rp 99,000.
- [ ] `src/app/nex-native/[businessSlug]/page.tsx` has soft-landing branch for archived shops (feature-flagged if schema not yet applied).
- [ ] Control-drawer + theme composers: zero dead-link rows pointing at deleted routes.
- [ ] Founder UI unchanged: no new UI surfaces introduced in Phase 2 (deliverable C may ADD `/shop/create/page.tsx` iff owner picks option (a); otherwise reuses `/packages`).
- [ ] § H gates status snapshot updated: B4 + B5 CLOSED; B1 + B3 + B6 + B7 + B8 + B9 + B10 still OPEN (expected).
- [ ] Phase 1c Batch 10 (migration reversal) and § G schema PR remain explicitly deferred — Phase 3 does NOT require them closed, but requires them clearly flagged as the gate preventing public launch.

**Founder-UI rule check:** None of Batches A-F introduce a new UI design. All copy changes are inside existing cards/pages. Batch C-option-(a) (new `/shop/create/page.tsx`) is the only new file possibility and that file is a redirect wall, not a new designed surface. **No violation of "do not change founder UI" expected.**

---

## Audit end · 2026-11-06

Ready for owner review. No code changed in producing this document.
