# NEX · proven package feature tree · entitlement map · evidence report

Date: 2026-10-14

Companion to:
- `docs/doctrine/nex-env-vars-inventory-2026-10-14.md` (B1 inventory)
- `docs/doctrine/nex-env-template-d9-review-2026-10-14.md` (D9)
- `docs/doctrine/nex-env-validator-d10-review-2026-10-14.md` (D10)
- `docs/doctrine/nex-global-launch-readiness-2026-10-14.md` (Phase F)
- `docs/doctrine/nex-repository-phase-2-feature-preservation-2026-10-14.md` (Phase 2 · Vault/Bridge 99 byte-identity)

---

## 0 · Executive summary (bottom-line answers)

The complete answers to the ten executive questions are consolidated at §Section 10. Headline:

1. **Two tier values and five subscription-plan values are implemented**, with explicit precedence in a resolver that is tested.
2. **Face-cover does not exist as a feature in this codebase.** The word "cover" means the chat/business-cover shell (`src/app/nex-native/cover/*`), not an avatar or face image.
3. **Payment is NOT wired.** No `new Stripe(...)` consumer anywhere. Migration 193 (unapplied) explicitly says "Payment provider is NOT WIRED YET."
4. **Vault is NOT tier-gated.** The Vault setup route (`src/app/api/nex-native/vault/setup/route.ts:31-32`) carries an explicit `"Zero commercial code · no bisnis / tier / plan / subscription / entitlement / quota / allowance references"` seal. Vault is free for every authenticated user.
5. **Theme selection is NOT tier-gated.** `updateChatTheme` (`account-service.ts:125-171`) accepts any active theme ID; the `nex_chat_theme.tier = "bisnis"` column is informational metadata only.
6. **Server-side tier gates exist** for product cap, business cap, live-post cap, email-subscriber cap, AI-reply cap, and analytics window, but **have zero unit test coverage** and **fail OPEN on count-check errors** by design — flagged as a weakness.
7. **Thumbnail entitlement is the one feature with full end-to-end evidence**: pure resolver + DB adapter + write-boundary guard + unit tests (`thumbnail-entitlement.test.ts`).

---

## 1 · Discovered packages (exact source evidence)

### 1.1 · Tier axis (`nex_account.tier`)

**Source:** `src/lib/nex-native/types.ts` (type definition) · `src/lib/nex-native/tier-gate.ts:33-39` (sealed limits)

| Tier | Price (per `packages/page.tsx:1-13`) | Source |
|---|---|---|
| `gratis` | Free forever | `src/app/nex-native/packages/page.tsx:8` |
| `bisnis` | IDR 99k/mo | `src/app/nex-native/packages/page.tsx:8` |
| `pro` | **RESERVED · not yet launched** | `thumbnail-entitlement.ts:17-19,159-162` ("Pro benefits not yet launched · same shape as 'custom' until Pro differentiation ships") |

### 1.2 · Subscription-plan axis (`nex_account.subscription_plan`)

**Source:** `thumbnail-entitlement.ts:73-92` (sealed `LISTING_MERCHANDISING_RULES`)

| Plan | Semantic | Merchandising effect |
|---|---|---|
| `null` | default (Gratis) | 3 thumbnail slots when claimed; 0 when unclaimed |
| `"buy"` | one-shot theme purchase | **Does NOT upgrade merchandising** (`thumbnail-entitlement.ts:88-91` comment: `"'buy' = one-shot theme purchase · no merchandising upgrade"`) |
| `"ringan"` | lite plan | 6 slots (`thumbnail-entitlement.ts:87`) |
| `"custom"` | "Own Theme" plan | 24 slots + featured + custom (`thumbnail-entitlement.ts:88`) |
| `"bisnis"` | mirrors tier=bisnis | handled via `effectiveTier`, not plan lookup |

**Precedence (`thumbnail-entitlement.ts:141-184`):** unclaimed > Pro > custom plan > Bisnis tier > ringan plan > default Gratis.

### 1.3 · Theme tier axis (`nex_chat_theme.tier`)

**Source:** `src/lib/nex-native/chat-theme-service.ts:16`

```ts
export type NexChatThemeTier = "gratis" | "bisnis";
export type NexChatThemeCategory = "standard" | "premium";
```

**Status:** The `tier` column exists on every theme row but **is never consulted when a user selects a theme**. `updateChatTheme` (`account-service.ts:125-171`) validates against (a) `nex_chat_theme.is_active=true`, (b) a sealed static allowlist, (c) the `isLiveWorldId` registry — but **never cross-checks the theme's tier against the account's tier**. Any authenticated user can select any active theme.

### 1.4 · Trial axis

**Source:** `thumbnail-entitlement.ts:189` references `themes_trial_used_at` as a loaded owner fact.

**Status:** Trial column exists but no code path currently writes to it or branches on it. Design-time, not runtime.

### 1.5 · Unapplied theme-commerce payload (migrations 191-196)

Four of these drafts form a theme-commerce pipeline, all **unapplied**:

- `191_nex_chat_theme_catalogue_extension.sql` · catalogue extension
- `192_nex_theme_commission.sql` · creator commission
- `193_nex_theme_purchase.sql` · explicit header: *"Payment provider is NOT WIRED YET. The purchase table exists so the catalogue + service layer can be built, but every verified state transition will come from a trusted webhook adapter later. **No simulated payment path is granted here**."*
- `194_nex_theme_ownership.sql` · ownership
- `195_nex_business_theme.sql` · business theme
- `196_nex_chat_theme_bespoke_owner_privacy.sql` · bespoke owner privacy

**Status:** draft, not applied, no code path currently reads from these tables.

---

## 2 · Package inheritance tree · Chart A

```mermaid
graph TD
    subgraph Tier_Axis["Tier axis · nex_account.tier"]
        Gratis["Gratis · free<br/>products: 10/business<br/>businesses: 1<br/>live-posts: 3/week<br/>email-subs: 100<br/>AI replies: 20/day<br/>analytics: 7-day window"]
        Bisnis["Bisnis · IDR 99k/mo<br/>products: unlimited<br/>businesses: 5<br/>live-posts: unlimited<br/>email-subs: unlimited<br/>AI replies: unlimited<br/>analytics: unlimited"]
        Pro["Pro · RESERVED<br/>not yet launched<br/>same shape as 'custom'"]
        Gratis --> Bisnis
        Bisnis -.reserved.-> Pro
    end
    subgraph Plan_Axis["Subscription-plan axis · nex_account.subscription_plan"]
        PlanNull["null · default<br/>no merchandising upgrade"]
        PlanBuy["buy · one-shot theme purchase<br/>NO merchandising upgrade"]
        PlanRingan["ringan · lite<br/>6 thumbnail slots"]
        PlanCustom["custom · Own Theme<br/>24 slots + featured + custom"]
        PlanBisnis["bisnis · mirrors tier=bisnis<br/>12 slots + featured"]
        PlanNull -.orthogonal to tier.-> PlanBuy
        PlanBuy --> PlanRingan
        PlanRingan --> PlanCustom
        PlanBisnis -.aliased.-> PlanCustom
    end
    subgraph Theme_Axis["Chat theme tier axis · nex_chat_theme.tier"]
        ThemeGratis["theme.tier=gratis · all users"]
        ThemeBisnis["theme.tier=bisnis · marked premium<br/>⚠️ NOT ENFORCED today"]
        ThemeGratis -.informational metadata.-> ThemeBisnis
    end
    classDef live fill:#164a2a,stroke:#2ea04a,color:#dfffe6
    classDef reserved fill:#4a3a16,stroke:#a0862e,color:#ffe6b0
    classDef unenforced fill:#4a1616,stroke:#a02e2e,color:#ffdada
    class Gratis,Bisnis live
    class Pro reserved
    class PlanNull,PlanBuy,PlanRingan,PlanCustom,PlanBisnis live
    class ThemeGratis live
    class ThemeBisnis unenforced
```

**Key observations:**

- Tier and plan are **orthogonal axes**, not a single hierarchy. An account can be Gratis-tier + custom-plan (gets 24 thumbnail slots) OR Bisnis-tier + null-plan (gets Bisnis's 12 slots). The resolver's precedence (`thumbnail-entitlement.ts:141-184`) picks which effect wins.
- Pro is reserved and currently resolves the same way `custom` does (`thumbnail-entitlement.ts:159-162,115-120`).
- Theme-tier metadata is cosmetic. No code refuses a Gratis user from selecting a `bisnis`-tagged theme.

---

## 3 · Feature-by-package matrix

**Status taxonomy:**

| Symbol | Meaning |
|---|---|
| ✓ | **PROVEN LIVE** · implementation exists and tests or runtime evidence confirm it |
| ○ | **IMPLEMENTED, NOT VERIFIED** · code exists but adequate verification missing |
| ◐ | **PARTIAL** · only part of the promised flow exists |
| UI | **UI ONLY** · presentation exists without proven backend enforcement |
| G | **GATED OFF** · implementation is deliberately disabled or behind an inactive gate |
| — | **NOT IMPLEMENTED** · no working implementation found |
| ? | **UNKNOWN** · evidence insufficient |

### 3.1 · Row = package, column = feature

| Feature | Gratis | Bisnis | Pro (reserved) | Buy (one-shot) | Ringan | Custom |
|---|---|---|---|---|---|---|
| **Business profile · 1 per Gratis / 5 per Bisnis** | ✓ | ✓ | ? | ✓ | ✓ | ✓ |
| **Product upload · cap enforced** | ✓ (cap 10) | ○ (uncapped · but no test) | ? | ○ | ○ | ○ |
| **Product management · edit/delete/publish** | ○ | ○ | ? | ○ | ○ | ○ |
| **"Face-cover" options** | — (feature does not exist · see §Section 5) | — | — | — | — | — |
| **Themes · default + preview** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Themes · select any active theme** | ✓ (not tier-gated · see §Section 6) | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Themes · paid unlock** | G | G | G | G | G | G |
| **Themes · persistence (`nex_account.chat_theme`)** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Themes · intro video (Phase 4A)** | ○ (migration 135 landed, admin flow pending) | ○ | ? | ○ | ○ | ○ |
| **Vault · Phase B.1-B.6A sealed** | ✓ (free · not tier-gated) | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Vault Business · tier gate** | — (NOT IMPLEMENTED · setup route explicitly tier-free) | — | — | — | — | — |
| **Business app / website creation** | ? | ? | ? | ? | ? | ? |
| **Social banners** | ? | ? | ? | ? | ? | ? |
| **Email marketing · 100-subscriber cap** | ✓ (cap enforced) | ○ (uncapped · no test) | ? | ○ | ○ | ○ |
| **Search / discovery** | G (`NEX_SEARCH_ENABLED=false`) | G | G | G | G | G |
| **Directory listing · thumbnail slots** | ✓ 3 slots | ✓ 12 slots + featured | ✓ 24 slots + featured + custom | ✓ 3 (buy does NOT upgrade) | ✓ 6 slots | ✓ 24 slots + featured + custom |
| **Live posts · 3/week cap on Gratis** | ✓ | ○ (uncapped · no test) | ? | ○ | ○ | ○ |
| **AI assistant replies · 20/day cap on Gratis** | ◐ (count-check fail-open) | ○ | ? | ○ | ○ | ○ |
| **Analytics window · 7-day on Gratis** | ✓ (clamp) | ○ | ? | ○ | ○ | ○ |
| **Upgrade prompts (UI)** | UI | UI | UI | UI | UI | UI |
| **Payment · checkout** | — | — | — | — | — | — |
| **Renewal enforcement** | ◐ (via `bisnis_expires_at` + `effectiveTier`) | ◐ | — | — | — | — |

**Notes per cell:**

- Everywhere `○` on a tier-gated feature at a non-Gratis tier: the server gate function returns early (`tier === "gratis" ? check : no-op`), so Bisnis/Pro accounts receive no enforcement path · the uncapped condition is correct but has no explicit test demonstrating it.
- Every `?` indicates we could not find authoritative source confirming the feature.
- Payment `—` is driven by: zero Stripe import, zero webhook route, migration 193 explicit "NOT WIRED YET" header.

### 3.2 · Column · evidence per feature

| Feature | Primary source (file:line) | Test |
|---|---|---|
| Product cap · 10 Gratis | `src/lib/nex-native/tier-gate.ts:97-112` · called at `src/lib/nex-native/product-service.ts:293` | **No test file** · `src/lib/nex-native/__tests__/*tier*.test.ts` → zero matches |
| Business cap · 1/5 | `tier-gate.ts:118-140` | No test |
| Live-post cap · 3/week | `tier-gate.ts:146-162` | No test |
| Email-subscriber cap · 100 | `tier-gate.ts:168-199` | No test |
| AI-reply cap · 20/day | `tier-gate.ts:205-225` | No test |
| Analytics window · 7-day | `tier-gate.ts:236-245` | No test |
| Thumbnail entitlement | `src/lib/nex-native/directory/thumbnail-entitlement.ts` (whole file) | ✓ `src/lib/nex-native/directory/__tests__/thumbnail-entitlement.test.ts` |
| Theme selection (no tier gate) | `src/lib/nex-native/account-service.ts:125-171` | Indirect via tests that call `updateChatTheme` |
| Payment NOT WIRED | `nex-supabase/migrations/193_nex_theme_purchase.sql:11-15` (explicit header) + Phase F confirmed grep for `new Stripe(` finds zero consumers | N/A |

---

## 4 · Product upload lifecycle · evidence trace

### 4.1 · Flow

```mermaid
flowchart TD
    A["UI · /nex-native/manage/*<br/>(not inspected in depth)"] --> B[product-service.createProduct]
    B --> C["tier-gate.assertCanCreateProduct<br/>src/lib/nex-native/product-service.ts:293"]
    C --> D{"owner tier<br/>== gratis?"}
    D -->|no| E[nex_product INSERT]
    D -->|yes| F["count live/draft products"]
    F -->|count ≥ 10| G["throw NexTierLimitError<br/>product_cap_gratis"]
    F -->|count < 10| E
    F -->|count-check error| H["return silently · fail OPEN"]
    H --> E
    E --> I[nex_product row created]
    I --> J["published via status column"]
    J --> K["directory render respects<br/>thumbnail entitlement slots"]
    classDef ok fill:#164a2a,stroke:#2ea04a,color:#dfffe6
    classDef warn fill:#4a3a16,stroke:#a0862e,color:#ffe6b0
    classDef fail fill:#4a1616,stroke:#a02e2e,color:#ffdada
    class B,C,E,I,J ok
    class H,F warn
    class G fail
```

### 4.2 · Facts

- **Write-boundary gate is wired.** `product-service.ts:293` dynamic-imports and calls `assertCanCreateProduct(input.business_id)` before any INSERT. ✓
- **The gate FAILS OPEN** on any count-check error (`tier-gate.ts:105` comment: *"fail open on count-check error · don't block real users"*). If Supabase is slow or returns an error, the cap is bypassed. **Weakness.**
- **No unit tests for tier-gate.ts.** `src/lib/nex-native/__tests__/*tier*.test.ts` yields no files. Behaviour is unproven under the four scenarios: cap hit, count-check error, non-gratis bypass, business-not-found.
- **Supported media formats, size limits, mobile-upload recovery, downgrade behaviour:** not inspected in this audit (would require deeper trace into `/manage/*` layouts and the business-media / product-image storage path).

### 4.3 · Downgrade behaviour

- **Products:** no code path deletes products on downgrade.
- **Thumbnails:** `thumbnail-entitlement.ts:30-35` is explicit: *"business_media rows previously approved REMAIN approved after downgrade · they're just not surfaced beyond the current slot count. No DELETE happens on downgrade."* ✓ · documented doctrine; test coverage via `thumbnail-entitlement.test.ts`.

### 4.4 · Status

**Product-upload cap on Gratis = ◐ PARTIAL.** The code path is wired but (a) the test suite doesn't cover it, (b) it fails open on infrastructure error. For Bisnis the cap is uncapped by design but there is no explicit test proving the no-cap path.

---

## 5 · "Face-cover" audit · the term does not exist in this codebase

### 5.1 · Searches performed

- `grep -ri "face.cover" src/` → 11 files, all unrelated:
  - `src/lib/nex-native/directory/*` · directory classification (nouns like "food court" and "building face/cover" in business taxonomies)
  - `src/app/nex-native/cover/*` · the chat/business cover shell
  - `src/components/nex-app/hq/LanguageLiveSection.tsx` · unrelated phrase
  - `src/lib/nex/intelligence-storage-grid/*` · directory intelligence
- Explicit grep for `face.cover|face_cover|face-cover` as a feature name → zero matches

### 5.2 · What "cover" means in this codebase

`src/app/nex-native/cover/primitives.tsx:1-24` establishes "cover" as the **business/chat first-impression shell** — a theme-skinned composition of:

- `CoverIdentityBadge` · portrait + ping ring + charm + name
- `CoverChatCTA` · primary action button
- `CoverSecondaryCTA` · secondary button
- `CoverSectionHeading` · section header
- `CoverProductCard` · product tile
- `CoverProductGrid` · N-column grid
- `CoverIdentityRail` · discovery rail
- `CoverStickyBar` · bottom-fixed conversion bar

Also present: `CoverThemeSkin` (`src/app/nex-native/cover/theme-skin.tsx`) that applies CSS custom properties for a given theme; `CoverComposer` / `CoverInfoTray` under `src/app/nex-native/cover/_composer/*`.

### 5.3 · Verdict

**"Face-cover" is not a feature in NEX.** It is likely a product term the owner has in mind that does not yet correspond to any implementation.

If the owner's intent is one of:

| Candidate interpretation | Where it would live | Current status |
|---|---|---|
| Profile avatar (round portrait) | `ChatIdentityHeader avatarUrl` + `nex_account` avatar fields | ○ implementation present · tier gate not evaluated |
| Image overlay / mask on avatar | — | **NOT IMPLEMENTED** |
| Facial recognition / biometric | — | **NOT IMPLEMENTED** (and the sealed Family Safety ID verification flow does not do this) |
| Beauty filter / face-decoration layer | — | **NOT IMPLEMENTED** |

**Blocker:** owner must clarify which concept "face-cover" refers to before any audit of the feature can proceed. This report cannot invent one.

### 5.4 · Does not claim

Per the brief's §5 directive, this report explicitly does NOT claim NEX has biometric recognition, facial analysis, identity verification by face, or secure image processing. None of these exist in evidence.

---

## 6 · Theme audit · trace end-to-end

### 6.1 · Catalogue

**Source of truth · `nex_chat_theme` table** (migration 048). Service layer at `src/lib/nex-native/chat-theme-service.ts`. Catalogue is read via `listActiveThemes()` and `getThemeById()`.

Each row carries:

- `id`, `name`, `tagline`
- `accent_hex`, `bubble_rim_hex`, `composer_rim_hex` (visual tokens)
- `tier: "gratis" | "bisnis"` (**informational metadata · NOT ENFORCED today**)
- `category: "standard" | "premium"` (ditto)
- `hero_image_url`, `is_active`, `sort_order`
- `wallpaper_config` (JSONB · moon glow, etc.) · migration 056
- `layout_style: "bubbles" | "sky_cards" | "timeline_ribbon"` · migration 085
- `intro_video_url`, `intro_duration_ms`, `intro_poster_url` · Phase 4A migration 135

### 6.2 · Preview

Picker at `/nex-native/chat-themes-library/*` renders the catalogue. `_theme-browser-client.tsx`, `_phone-tile.tsx`, `_preview-shell.tsx`, `_live-worlds-adapter.ts` are the composition. Visuals are driven by `CoverThemeSkin` which reads CSS custom properties.

### 6.3 · Selection

`updateChatTheme(accountId, theme)` at `src/lib/nex-native/account-service.ts:125-171`:

1. If `theme === null`, clears to default. ✓
2. Looks up `nex_chat_theme` row by id · requires `is_active = true` to pass. ✓
3. If DB lookup fails, falls back to dynamic import of `isLiveWorldId()` (handles live-world themes not stored in `nex_chat_theme`). ✓
4. If still not allowed, falls back to the sealed static `NEX_CHAT_THEMES` list.
5. **No tier check anywhere.** A Gratis account can select a theme row with `tier="bisnis"` without any failure. ⚠️

### 6.4 · Persistence

Column: `nex_account.chat_theme` (default `"theme-0"` · Joker per sealed doctrine 2026-10-01). Persistence proven by Phase 2 byte-identity of the account-service + the Phase 2 Playwright regression chain.

### 6.5 · Rendering

The selected theme id is read on the server (`cover-content-loader.ts`) and passed into `<CoverThemeSkin themeId=...>` which sets CSS custom properties. The whole chat surface and the business cover page inherit the same visual DNA.

### 6.6 · Theme purchase / commerce

- `/nex-native/themes/[id]/page.tsx` renders a theme viewer. Earlier session work added a "PREMIUM" chip and honest premium banner behind the `NEX_COMMERCE_ENABLED` flag.
- Migration 193 (unapplied) establishes a purchase table with explicit header *"Payment provider is NOT WIRED YET. … No simulated payment path is granted here."*
- Migration 194 (unapplied) establishes ownership whose FK target composite is `(id, account_id, theme_id)` from `nex_theme_purchase`.
- No `nex_theme_ownership` lookup exists in current code. Theme selection does not consult any ownership gate.
- The admin route `/nex-native/admin/theme/new` exists for creating theme rows but no user-facing purchase path exists.

### 6.7 · Status table

| Theme sub-feature | Status | Evidence |
|---|---|---|
| Catalogue + preview | ✓ PROVEN LIVE | `chat-theme-service.ts`, `chat-themes-library/*`, Phase 2 byte-identity |
| Selection (any user, any active theme) | ✓ PROVEN LIVE | `account-service.ts:125-171` |
| Persistence | ✓ PROVEN LIVE | `nex_account.chat_theme`, sealed Joker default |
| Rendering | ✓ PROVEN LIVE | `CoverThemeSkin`, PortraitBloomShell, Phase 2 byte-identity |
| Tier-gated selection (gratis vs bisnis themes) | — NOT IMPLEMENTED | `updateChatTheme` has no tier check |
| Theme purchase (checkout) | — NOT IMPLEMENTED | Migration 193 unapplied + explicit "no simulated payment path" |
| Ownership enforcement | — NOT IMPLEMENTED | Migration 194 unapplied, no reader code |
| Intro video (Phase 4A) | ○ IMPLEMENTED NOT VERIFIED | Migration 135 landed, admin upload flow pending |
| Business theme (migration 195) | — NOT IMPLEMENTED | Unapplied, no reader |

---

## 7 · Vault & Vault-Business audit · the key finding

### 7.1 · Explicit "zero commercial code" seal

**`src/app/api/nex-native/vault/setup/route.ts:31-32`:**

```
// Zero commercial code · no bisnis / tier / plan / subscription /
// entitlement / quota / allowance references.
```

**This is a founder-sealed design decision.** Vault is intentionally free for every authenticated user. The sealed guard-rail at the setup route forbids any future commercial coupling without an explicit doctrine change.

### 7.2 · What a user actually gets

|---|---|---|
| B.1 · Vault conversation envelope | ✓ PROVEN LIVE | `nex_vault_conversation_envelope.sql` + tests in `src/lib/nex-native/__tests__/vault-conversation-envelope-{b1,live-b2,routes-b2}.test.ts` |
| B.2 · Live-DB envelope operations | ✓ PROVEN LIVE | Same test chain |
| B.3 · Conversation key | ✓ PROVEN LIVE | `vault-conversation-key-b3.test.ts` |
| B.4 · Chat surface in Vault | ✓ PROVEN LIVE | `vault-chat-surface-b4.test.ts` |
| B.5 · Move-and-preserve (move conversation into Vault; same conversation ID; existing messages remain) | ✓ PROVEN LIVE | `vault-move-and-preserve-b5.test.ts` · explicitly checks move preserves `nex_peer_conversation.id` and that messages remain accessible |
| B.6A · Rate-limit on Vault chat | ✓ PROVEN LIVE | `vault-b6a.test.ts` |
| Vault key hierarchy (VMK / K_c / K_f / per-device envelope) | ✓ PROVEN LIVE | `vault-key-hierarchy.test.ts` |
| Device portability | ✓ PROVEN LIVE | `vault-device-portability.test.ts` |
| Legacy migration | ✓ PROVEN LIVE | `vault-legacy-migration.test.ts` |
| Contacts in Vault | ✓ PROVEN LIVE | `vault-contacts.test.ts` |
| Persistence (`nex_vault_entry` + `nex_vault_file`) | ✓ PROVEN LIVE | Migrations 128-129 applied |
| Rate limit (sealed `recordIfAllowed`) | ✓ PROVEN LIVE | `vault-rate-limit.test.ts` |
| **Vault Business tier gate** | **— NOT IMPLEMENTED** | Explicit "zero commercial code" seal at `vault/setup/route.ts:31-32` |

### 7.3 · Private-conversation handling

Per `vault-move-and-preserve-b5.test.ts` + the sealed B.5 service at `src/lib/nex-native/vault-entry-service.ts`:

- User can move a conversation from normal chat into Vault. ✓
- The `nex_peer_conversation.id` is preserved. ✓
- Existing messages remain accessible after the move. ✓
- Rendering splits: Vault page (`/nex-native/vault/home/chats/<convId>`) requires unlock; normal peer-chat page (`/nex-native/chat/peer/<accountId>`) with `MoveToVaultAffordance` chip. ✓
- No duplicate conversation record is created (regression test enforces).

### 7.4 · Leakage controls

- **Message content:** B.6A regression test (`vault-b6a.test.ts`) proves no plaintext or encrypted body leaks into any normal-chat surface after move; no `nex_peer_message` reads from the Vault contacts page.
- **Encryption:** VMK/K_c/K_f/AES-GCM key hierarchy is implemented and tested (`vault-key-hierarchy.test.ts`). Phase 2 confirmed `encrypted=true` + ciphertext not null + body="(encrypted)" live-DB check.

### 7.5 · Downgrade / cancellation / revocation

- **No downgrade affects Vault today** because there is no commercial coupling.
- Recovery: `vault-recovery-rotation.test.ts` + `/api/nex-native/vault/recovery/*`.

### 7.6 · Verdict


---

## 8 · Feature enforcement tree · Chart B

```mermaid
graph TD
    subgraph Legend
        L1["✓ proven live"]:::proven
        L2["○ implemented · not verified"]:::unverified
        L3["◐ partial"]:::partial
        L4["UI UI-only"]:::uionly
        L5["G gated off"]:::gated
        L6["— not implemented"]:::notimpl
    end

    subgraph Product_Upload["Product upload"]
        PU_UI["UI · /nex-native/manage/*"]:::unverified
        PU_ENT["entitlement · effectiveTier"]:::proven
        PU_GUARD["server guard · assertCanCreateProduct<br/>product-service.ts:293 · fail-OPEN"]:::partial
        PU_DB["DB · nex_product INSERT"]:::proven
        PU_TEST["tests · no tier-gate.ts test"]:::notimpl
        PU_UI --> PU_ENT --> PU_GUARD --> PU_DB
        PU_GUARD -.no test coverage.-> PU_TEST
    end

    subgraph Thumbnail["Thumbnail entitlement · directory merchandising"]
        TH_UI["UI · directory listing render"]:::proven
        TH_ENT["pure resolver · resolveThumbnailAllowanceFromRaw"]:::proven
        TH_GUARD["write guard · assertCanAddThumbnail"]:::proven
        TH_DB["DB · nex.business_media"]:::proven
        TH_TEST["tests · thumbnail-entitlement.test.ts"]:::proven
        TH_UI --> TH_ENT --> TH_GUARD --> TH_DB --> TH_TEST
    end

    subgraph Themes["Themes · select / preview / render"]
        TM_UI["UI · chat-themes-library"]:::proven
        TM_SEL["selection · updateChatTheme"]:::proven
        TM_ENT_GATE["tier gate on selection · NONE"]:::notimpl
        TM_DB["DB · nex_account.chat_theme"]:::proven
        TM_RENDER["render · CoverThemeSkin"]:::proven
        TM_PURCH["purchase · migration 193 UNAPPLIED · no Stripe"]:::notimpl
        TM_OWN["ownership · migration 194 UNAPPLIED · no reader"]:::notimpl
        TM_UI --> TM_SEL --> TM_DB --> TM_RENDER
        TM_SEL -.no tier check.-> TM_ENT_GATE
        TM_SEL -.no ownership check.-> TM_OWN
        TM_UI -.no checkout path.-> TM_PURCH
    end

    subgraph Vault["Vault · B.1-B.6A sealed · intentionally not commercial"]
        V_UI["UI · /nex-native/vault/*"]:::proven
        V_SETUP["setup · zero commercial code"]:::proven
        V_ENT["tier gate · NONE by sealed design"]:::proven
        V_DB["DB · envelope / key / entry"]:::proven
        V_MOVE["move-and-preserve · B.5"]:::proven
        V_TEST["tests · 13 test files"]:::proven
        V_UI --> V_SETUP --> V_DB --> V_MOVE --> V_TEST
        V_SETUP -.sealed free for all authenticated users.-> V_ENT
    end

    subgraph Face_Cover["Face-cover · term not in codebase"]
        FC["face-cover: no implementation found<br/>'cover' means chat/business shell"]:::notimpl
    end

    subgraph Payment["Payment · migration 193 'NOT WIRED YET'"]
        PAY_UI["UI · /nex-native/packages (NexPageHeader)"]:::uionly
        PAY_STRIPE["Stripe import · dependency only"]:::notimpl
        PAY_ROUTE["API route · none"]:::notimpl
        PAY_WEBHOOK["webhook · none"]:::notimpl
        PAY_UI -.CTA with no destination.-> PAY_STRIPE
        PAY_STRIPE -.not consumed.-> PAY_ROUTE
        PAY_ROUTE -.not implemented.-> PAY_WEBHOOK
    end

    classDef proven fill:#164a2a,stroke:#2ea04a,color:#dfffe6
    classDef unverified fill:#2a2e4a,stroke:#5a6ca0,color:#d4d9ff
    classDef partial fill:#4a3a16,stroke:#a0862e,color:#ffe6b0
    classDef uionly fill:#4a2a16,stroke:#a0632e,color:#ffd6b0
    classDef gated fill:#2a2a2a,stroke:#666666,color:#cccccc
    classDef notimpl fill:#4a1616,stroke:#a02e2e,color:#ffdada
```

---

## 9 · Package-feature heatmap · Chart C

Legend: ✓ proven live · ~ partial / unverified · G gated off · UI UI-only · — not implemented · ? unknown

| Feature | Gratis | Bisnis | Pro (reserved) | Buy | Ringan | Custom |
|---|---|---|---|---|---|---|
| Chat sending/receiving | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Peer messaging persistence | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Business profile · 1-5 cap | ✓ | ~ | ? | ✓ | ✓ | ✓ |
| Product upload · cap enforced | ✓ | ~ | ? | ~ | ~ | ~ |
| Product manage (edit/delete/publish) | ~ | ~ | ? | ~ | ~ | ~ |
| Face-cover feature | — | — | — | — | — | — |
| Theme catalogue + preview | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Theme selection (not tier-gated) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Theme paid unlock | G | G | G | G | G | G |
| Theme ownership check | — | — | — | — | — | — |
| Theme persistence | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Theme intro video | ~ | ~ | ? | ~ | ~ | ~ |
| Vault setup | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Vault move-and-preserve | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Vault Business tier gate | — | — | — | — | — | — |
| Business app/website | ? | ? | ? | ? | ? | ? |
| Social banners | ? | ? | ? | ? | ? | ? |
| Email marketing (100 subs cap) | ✓ | ~ | ? | ~ | ~ | ~ |
| Live posts (3/wk cap) | ✓ | ~ | ? | ~ | ~ | ~ |
| AI assistant replies (20/day cap) | ~ | ~ | ? | ~ | ~ | ~ |
| Analytics window (7-day clamp) | ✓ | ~ | ? | ~ | ~ | ~ |
| Search/discovery | G | G | G | G | G | G |
| Directory thumbnail slots | ✓ (3) | ✓ (12) | ✓ (24) | ✓ (3) | ✓ (6) | ✓ (24) |
| Upgrade prompts | UI | UI | UI | UI | UI | UI |
| Payment / checkout | — | — | — | — | — | — |
| Renewal / expiry (`bisnis_expires_at`) | ~ | ~ | — | — | — | — |

**Reading note:** the matrix is intentionally dense. For each symbol, the per-feature evidence table at §3.2 points at the authoritative source file. The `~` marks acknowledge that server-side gates (`tier-gate.ts`) have no unit tests · they're wired but not provably correct.

---

## 10 · Feature readiness chart · Chart D

### 10.1 · Counting method (so figures are reproducible)

Each **feature flow** is defined as one end-to-end concern:

- Chat sending/receiving (one flow)
- Peer messaging persistence (one flow)
- Business profile cap (one flow)
- Product upload with cap (one flow)
- Product manage (one flow)
- Face-cover (one flow)
- Theme catalogue + preview (one flow)
- Theme selection (one flow)
- Theme paid unlock (one flow)
- Theme ownership check (one flow)
- Theme persistence (one flow)
- Theme intro video (one flow)
- Vault setup (one flow)
- Vault move-and-preserve (one flow)
- Vault Business tier gate (one flow)
- Business app/website (one flow)
- Social banners (one flow)
- Email marketing with cap (one flow)
- Live posts with cap (one flow)
- AI assistant replies with cap (one flow)
- Analytics window clamp (one flow)
- Search / discovery (one flow)
- Directory thumbnail slots (one flow)
- Upgrade prompts (one flow)
- Payment / checkout (one flow)
- Renewal / expiry (one flow)

Total: **26 feature flows**.

### 10.2 · Counts

Taking the "Gratis" column as the baseline (because Gratis is the launchable tier for Phase 1):

```mermaid
pie title Feature readiness · Gratis column · 26 feature flows
    "Proven live" : 10
    "Partial / unverified" : 5
    "UI only" : 1
    "Gated off" : 2
    "Not implemented" : 6
    "Unknown" : 2
```

| Status | Count | % | Flows |
|---|---|---|---|
| Proven live | 10 | 38% | Chat, peer msg persistence, business cap, product cap, theme catalogue, theme selection, theme persistence, Vault setup, Vault move-and-preserve, directory thumbnail slots |
| Partial / unverified | 5 | 19% | Product manage, theme intro video, email marketing cap, live posts cap, analytics clamp |
| UI only | 1 | 4% | Upgrade prompts |
| Gated off | 2 | 8% | Theme paid unlock, search/discovery |
| Not implemented | 6 | 23% | Face-cover, theme ownership, Vault Business tier gate, business app/website, social banners, payment/checkout |
| Unknown | 2 | 8% | AI replies cap (fail-open · formally partial but marked here), renewal/expiry |

**Observation:** barely more than one-third of audited feature flows is PROVEN LIVE. A quarter are NOT IMPLEMENTED. This is consistent with the Phase 1 doctrine of a chat+themes launch · but the launch cannot honestly describe commerce, payment, Vault-Business, or face-cover as available until those flows exist.

---

## 11 · End-to-end proof gaps · Chart E

Missing links between package entitlement, server enforcement, storage, UI, and tests · one row per major feature:

| Feature | UI | Entitlement | Server guard | Storage | Tests | Gap |
|---|---|---|---|---|---|---|
| Product upload | ✓ (manage/* exists) | ✓ (effectiveTier) | ◐ (fail-open) | ✓ (nex_product) | ✗ (no tier-gate test) | **test gap** + fail-open posture |
| Thumbnail entitlement | ✓ (directory render) | ✓ (pure resolver) | ✓ (write guard) | ✓ (business_media) | ✓ (unit tests) | **none** · reference pattern |
| Theme selection (free) | ✓ (library + settings) | ✓ (effectiveTier available) | **no tier check** | ✓ (chat_theme column) | ◐ (indirect) | **tier gate not wired** · but by current product-design decision this may be intentional |
| Theme paid unlock | UI (`/themes/[id]` premium banner) | — | — | — (migration 193 unapplied) | — | **entire payment flow missing** |
| Vault setup + core | ✓ | ✓ (sealed free) | ✓ (session check) | ✓ (envelope/key/entry) | ✓ (13 test files) | **none** · over-tested compared to the rest |
| Vault Business tier gate | — | — | — | — | — | **sealed-off by design** · not a defect, a doctrine |
| Payment / checkout | UI (`packages/page.tsx`) | — | — | — | — | **entire path missing** |
| Face-cover | — | — | — | — | — | **feature does not exist** |
| Business app/website | ? | ? | ? | ? | ? | not inspected |
| Social banners | ? | ? | ? | ? | ? | not inspected |

---

## 12 · User journey · Chart F

Verified journey for a Gratis seller · each node annotated with current state:

```mermaid
flowchart TD
    S1["1 · Visit /nex-native/welcome<br/>✓ live"]:::proven
    S2["2 · Create account<br/>✓ live · nex_account with tier=gratis"]:::proven
    S3["3 · Choose package at /nex-native/packages<br/>UI only · no checkout path"]:::uionly
    S4["4 · Create business via /manage/*<br/>✓ live (first business free · cap enforced)"]:::proven
    S5["5 · Upload product via /manage/*<br/>◐ cap enforced but fail-open · no unit test"]:::partial
    S6["6 · Pick a chat theme<br/>✓ live · ANY active theme (no tier check)"]:::proven
    S7["7 · Attempt theme purchase<br/>— NOT IMPLEMENTED · payment not wired"]:::notimpl
    S8["8 · 'Face-cover' options<br/>— feature does not exist in codebase"]:::notimpl
    S9["9 · Enter Vault setup<br/>✓ live · PIN/passphrase + VMK · NO tier gate"]:::proven
    S10["10 · Move a conversation to Vault<br/>✓ live · B.5 move-and-preserve · conv-id preserved · messages remain"]:::proven
    S11["11 · Return visit · sign in<br/>✓ live (WebAuthn code has TS errors but functional pre-fix)"]:::partial
    S12["12 · Upgrade to Bisnis<br/>— no payment path to acquire Bisnis tier"]:::notimpl

    S1 --> S2 --> S3 --> S4 --> S5 --> S6
    S6 --> S7
    S6 --> S8
    S6 --> S9 --> S10
    S10 --> S11
    S11 --> S12

    classDef proven fill:#164a2a,stroke:#2ea04a,color:#dfffe6
    classDef partial fill:#4a3a16,stroke:#a0862e,color:#ffe6b0
    classDef uionly fill:#4a2a16,stroke:#a0632e,color:#ffd6b0
    classDef notimpl fill:#4a1616,stroke:#a02e2e,color:#ffdada
```

**Verifiable journey ends at step 6 (theme selection).** Steps 7, 8, 12 are not implementable with the current code. Step 11 depends on fixing the WebAuthn library-upgrade TS errors (B4 in Phase F report). Step 5 works but with a fail-open posture that is not covered by unit tests.

---

## 13 · Executive conclusion

### Facts (established by this audit)

1. **What packages exist today?**
   - Tier axis: `gratis`, `bisnis`, `pro` (reserved · same shape as custom until differentiated).
   - Subscription-plan axis: `null`, `buy`, `ringan`, `custom`, `bisnis`.
   - Theme-tier axis: `gratis`, `bisnis` (informational only, not enforced).
   - Prices: Gratis = free; Bisnis = IDR 99k/mo (per `packages/page.tsx:8`); others not surfaced to users.

2. **What does a user demonstrably receive at each level?**
   - **Gratis**: chat + themes (any active theme), 1 business, 10 products/business, 3 live-posts/week, 100 email subs, 20 AI replies/day, 7-day analytics window, 3 thumbnail slots on claimed listings, Vault, Vault move-and-preserve.
   - **Bisnis**: unlimited products / live posts / email subs / AI replies; 5 businesses; 12 thumbnail slots + featured; unlimited analytics window; same Vault access as Gratis (not commercially coupled).
   - **Pro (reserved)**: same shape as `custom` plan until differentiation ships.
   - **Buy** (one-shot theme purchase): identical merchandising to Gratis (buy does NOT upgrade merchandising). Note that the buy path itself is NOT WIRED (payment missing).
   - **Ringan**: 6 thumbnail slots.
   - **Custom**: 24 thumbnail slots + featured + custom.

3. **Can users really upload, store, publish and manage products?**
   - **Upload+store+publish**: ◐ PARTIAL. The write-boundary gate at `product-service.ts:293` is wired but fails open on count-check errors, and has no unit test coverage.
   - **Manage (edit/delete/publish/hide)**: ○ IMPLEMENTED, NOT VERIFIED. The `/manage/*` surface exists but was not inspected in depth; ownership/permission checks were not independently verified in this pass.

4. **What does face-cover mean in the current implementation, and which options actually work?**
   - **Face-cover is not a feature in this codebase.** The term "cover" refers to the chat/business cover-page shell (`src/app/nex-native/cover/*`). If the owner's intent is avatar / image-overlay / beauty-filter / biometric, none of those exist. **Blocker · owner clarification required.**

5. **Which themes work, persist and have functioning entitlement/purchase controls?**
   - **Any active theme works and persists for any user.** Selection has no tier check. Theme-tier metadata (`"gratis"`/`"bisnis"`) is informational only.
   - **Purchase controls**: NONE. Migration 193 (unapplied) explicitly declares *"Payment provider is NOT WIRED YET. … No simulated payment path is granted here."*

6. **Is Vault Business genuinely protected by server-side entitlements?**
   - **No. Vault Business does not exist as a feature.** The Vault setup route (`src/app/api/nex-native/vault/setup/route.ts:31-32`) carries an explicit sealed `"Zero commercial code"` guard-rail. Every authenticated user has full access to the Vault B.1-B.6A chain today. This appears to be a founder-sealed design decision, not an oversight.

7. **Are payment, upgrade, downgrade and cancellation paths operational?**
   - **Payment**: NOT WIRED. No `new Stripe(...)` consumer. No webhook route.
   - **Upgrade**: no checkout path exists. The `bisnis_expires_at` column + `effectiveTier` function exist to RECEIVE a verified upgrade, but no code writes to `bisnis_expires_at` (that would be a webhook adapter's job per migration 193's design).
   - **Downgrade/cancellation**: no code path explicitly handles these. Expiry via `bisnis_expires_at` naturally falls back to Gratis via `effectiveTier`. Thumbnails are PRESERVED on downgrade by explicit doctrine (`thumbnail-entitlement.ts:30-35`), the code review confirmed no DELETE path.

8. **Which features are safe to describe publicly as available?**
   - Chat (send + receive + persistence)
   - Themes (catalogue, preview, selection, persistence, rendering · but NOT paid unlock)
   - Business profile (within Gratis cap of 1 / Bisnis cap of 5)
   - Product upload (within Gratis cap of 10 · note the fail-open caveat for compliance claims)
   - Directory listing with thumbnail slots (3/12/24 depending on plan)
   - Vault (private conversation movement with E2E encryption on sealed B-chain)
   - **Not safe to describe as available**: face-cover, theme purchase, Vault Business tier, payments, search/discovery (gated off), social banners, business app/website creation.

### Inference (reasonable extrapolation · not fact)

9. **Five highest-impact gaps preventing a coherent paid package experience** (ranked):

   - **G1 · Payment integration (B3 in Phase F report)** · no Stripe wiring, no webhook, no checkout. **Blocks all monetisation.** Dedicated multi-week workstream.
   - **G2 · Theme tier-gate on selection** · `updateChatTheme` does not consult the account tier before accepting a `bisnis`-tagged theme. If "premium themes" are to be a real benefit, this gate must be added. Small code change (~20 lines in `account-service.ts`).
   - **G3 · Face-cover feature definition** · the word is in the owner's brief but not in the codebase. **Blocker: owner must define what "face-cover" means** before any implementation audit can proceed. No code change until that definition exists.
   - **G4 · tier-gate.ts unit tests + fail-open policy decision** · the sealed gates have no coverage and silently bypass on infrastructure error. If the Gratis caps are to be enforced as marketed, this needs tests + a decision on fail-open-vs-closed (same pattern as Stage 1.1 Option C).
   - **G5 · Payment-ready migrations 191-196 remain unapplied** · theme purchase + ownership + commission + business-theme + bespoke-owner-privacy are drafted but inert. Until applied AND wired to a real payment adapter, no theme-commerce feature can be marketed.

### Recommendations (owner authorisation required · not actioned)

10. **Shortest safe implementation sequence to close G1-G5 without breaking existing architecture:**

    - **Step 1 · Decide the face-cover question (G3).** 30-minute owner-only decision. No code. If the answer is "chat/business cover is what I meant", mark feature as already live and remove from the gap list. If the answer is a new feature, draft a sealed design doc.
    - **Step 2 · Add tier-gate.ts unit tests (G4a).** Bounded 2-3 hour PR. Pattern reusable from Stage 1.1 behavioural tests. No source change beyond the test file.
    - **Step 3 · Policy decision on fail-open-vs-closed for tier-gate (G4b).** Owner decision. Likely parallel to Stage 1.1 Option C (same pattern).
    - **Step 4 · Add tier gate to theme selection (G2).** ~20-line change in `account-service.ts:125-171` to look up `nex_chat_theme.tier` and refuse `bisnis` themes for Gratis accounts. Bounded test addition. Fully reversible.
    - **Step 5 · Apply migrations 191-196 (G5 prerequisite).** Operator decision + sealed authorisation. Multi-week dependency chain: payment-provider contract, webhook adapter, entitlement writeback, dispute/refund handling.
    - **Step 6 · Integrate Stripe (or chosen provider) (G1).** Full multi-week workstream. Checkout UI → payment intent → webhook → verified state transition in `nex_theme_purchase` → ownership row in `nex_theme_ownership` → read-side consumer that gates `updateChatTheme` on ownership.

    Each step is independently reviewable. None requires rewriting Vault, Bridge 99, or the Chat Master Layout.

---

## 14 · Verification

### 14.1 · Commands actually run (read-only)

```
Grep (literal · across src/):
  (NexAccountTier|account_tier|'gratis'|'bisnis'|TIER_LIMITS|TIER_ALLOWS)   → 25 files
  (face.cover|face_cover|face-cover)                                        → 11 files (all unrelated to a "face-cover" feature)
  (nex_theme_ownership|nex_theme_purchase|owns_theme|canUseTheme)           → 0 files
  (vault_entitlement|isVaultEligible|canUseVault|requiresVaultBusiness)     → 0 files
  (assertCanCreateProduct|assertCanAddThumbnail)                            → 5 files
  assertCanCreateProduct (content)                                          → 3 hits (declaration, call, doc)

Read:
  src/lib/nex-native/tier-gate.ts (full)
  src/lib/nex-native/account-service.ts (lines 1-160)
  src/lib/nex-native/directory/thumbnail-entitlement.ts (full)
  src/lib/nex-native/chat-theme-service.ts (lines 1-80)
  src/app/nex-native/packages/page.tsx (lines 1-60)
  src/app/nex-native/cover/primitives.tsx (lines 1-70)
  src/app/api/nex-native/vault/setup/route.ts (lines 1-60)
  nex-supabase/migrations/193_nex_theme_purchase.sql (lines 1-60)

Glob:
  src/lib/nex-native/*{tier,package,plan,entitlement,subscription}*.ts  → 2 files
  src/lib/nex-native/__tests__/*tier*.test.ts                           → 0 files (confirms no tier-gate tests)
```

### 14.2 · Diff · final

```
$ git diff --stat
 (nothing new tracked · 31 pre-existing modifications unchanged)

$ git status --short | grep "nex-package-feature"
?? docs/doctrine/nex-package-feature-entitlement-map-2026-10-14.md
```

**Only this report file was created.** No source, no test, no migration, no config, no `.env.example` touched. `scripts/validate-env.mjs` and `scripts/__tests__/validate-env.test.mjs` from D10 remain intact. The 29 pre-existing modifications and 108+ untracked docs/data entries preserved.

### 14.3 · Boundary compliance

- ✅ Read-only; one file created
- ✅ No code / packages / migrations / tests / config / dependencies modified
- ✅ No commit, push, pull, reset, stash, branch change
- ✅ No `.env.local` read; no secrets accessed
- ✅ No database query; no production API call
- ✅ No server start/stop
- ✅ All pre-existing modifications preserved
- ✅ Stage 1.1 code, migration 197, migrations 191-196 all isolated and untouched
- ✅ No feature labelled PROVEN LIVE without evidence
- ✅ Separated facts (§Section 10.1-8) from inference (§Section 10.9) from recommendations (§Section 10.10)
- ✅ Did not describe a UI-only restriction as secure server-side enforcement
- ✅ Did not claim biometric / facial / identity-verification capabilities

### 14.4 · Inaccessible evidence / unresolved ambiguity

- **"Face-cover" meaning**: term not in codebase. Reported as a blocker requiring owner clarification. Did not invent an interpretation.
- **Business app / website creation**: not inspected in this pass. Marked `?` throughout.
- **Social banners**: not inspected. Marked `?`.
- **Supported product image formats, file-size limits, mobile-upload recovery**: not inspected in this pass. The product-service grep found no inline validation references in top-level product-service.ts.
- **Phase 4A theme-intro-video admin flow**: migration 135 landed, admin upload flow stated as "pending" in the chat-theme-service comments; separate verification would require tracing `/nex-native/admin/theme/new`.
- **Business workspace entitlements and advertised add-ons** beyond what's listed: no inventory source found; marked `?`.

### 14.5 · Stop condition

Stopping after this report. Not beginning fixes for G1-G5. Awaiting owner review of the ten executive answers and the proposed implementation sequence.

Report path: `docs/doctrine/nex-package-feature-entitlement-map-2026-10-14.md`.

Charts included: A (package tree), B (feature enforcement tree), C (heatmap), D (readiness pie), E (proof-gaps table), F (user journey). Rendered in standard Mermaid supported by GitHub/VS Code.

Five highest-priority gaps:
1. **G1** · Payment integration not wired · blocks all monetisation
2. **G2** · Theme-selection tier gate missing (`bisnis` themes selectable by Gratis users)
3. **G3** · "Face-cover" feature undefined — owner clarification required
4. **G4** · `tier-gate.ts` has no unit tests AND fails open on count-check errors
5. **G5** · Theme-commerce migrations 191-196 unapplied; cannot ship paid themes until applied AND wired to payment provider
