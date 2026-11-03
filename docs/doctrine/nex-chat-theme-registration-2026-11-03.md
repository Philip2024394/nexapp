# NEX Chat Theme — Registration Surfaces

**Owner-sealed 2026-11-03 · Engineering Quality Correction directive.**
Do not consolidate or remove existing surfaces under this doctrine. The
goal is DISCOVERABILITY, not refactoring.

A single chat theme is REGISTERED in up to **five** places. Each place
is read by a different consumer. Missing a surface means the theme
appears in some screens but not others — this is the single biggest
cause of "I added a theme and it didn't show up".

## The five surfaces

| # | Surface | Form | Who reads it | Required for |
|---|---|---|---|---|
| 1 | `nex_chat_theme` table | DB row | `chat-theme-service.listActiveThemes()` / `getThemeById()` | Core theme to exist · wallpaper to render in `/chat/*` surfaces when applied · HQ rename page to show it |
| 2 | `LIVE_WORLD_PACKAGES` in `src/app/nex-native/chat-standard/_live-worlds.ts:55` | TypeScript constant | `listLiveWorldsAsBrowserRows()` and `getThemeById()` fallback | Code-backed themes (legacy `nex-bubbles` · `joker` · etc). NOT required for Supabase-only themes. |
| 3 | `_sealed-free-themes.ts:32` allowlist | TypeScript constant | Entitlement check for free users | Making a `tier='gratis'` theme free FOREVER (bypasses the premium gate). Only `default` and `theme-0` are in this allowlist today. |
| 4 | `POPULAR_THEME_IDS` in `_featured-picks.ts:38` | TypeScript constant | Entry carousel on `/chat-themes-library` (landing) | Appearing on the LANDING carousel when `nex_theme_view_counter` has no view counts yet. Pure fallback. |
| 5 | `LIBRARY_THEMES` in `_catalog.ts:36` | TypeScript constant · hard-coded wallpaper URLs + prices + download counts | `/chat-themes-library/all` (Full Library grid) | Appearing on the Full Library route. **This surface does not read the DB.** |

## What surfaces are needed for your use case

| Goal | Required surfaces |
|---|---|
| Theme exists in DB (readable by API) | 1 |
| Theme auto-applies as wallpaper when a user picks it | 1 |
| Theme shows on landing-page carousel immediately (before view counts accumulate) | 1 + 4 |
| Theme shows on Full Library grid at `/all` | 1 + 5 |
| Theme is free for Gratis users regardless of `tier` | 1 + 3 |
| Theme has an industry-mapped Hero on landing | 1 + mapping edit in `_featured-picks.ts:50` (`FEATURED_BY_INDUSTRY`) |
| Theme has animated wallpaper config / layout style / intro video | 1 (`wallpaper_config` + `layout_style` + `intro_*` fields on the row) |

## Checklist · adding a new theme

Follow in order. Skip steps only when the "Required for" column above
says the surface isn't needed for your goal.

1. **Decide tier + category** · `gratis` + `standard`, or `bisnis` + `premium`. Premium touches sealed Theme Commerce DRAFT 2026-10-20 · requires separate authorisation.
2. **Pick a stable id** matching `^[a-z][a-z0-9_-]{1,30}$` (CHECK ck_theme_id_shape · migration 048). Example: `theme-o42` · `library-ireland-mist`.
3. **Upload wallpaper asset** · prefer Supabase Storage bucket `nex-chat-themes/library/<filename>` (sealed pattern · public read, 54 MB kept out of git). Alternative: `public/nex-themes/library/<filename>` (ships in repo).
4. **Insert row** into `nex_chat_theme` via a migration · fields documented at `src/lib/nex-native/chat-theme-service.ts:19` (`NexChatThemeRow`). Minimum: `id · name · accent_hex · tier · category · hero_image_url · is_active · sort_order`.
5. **If gratis + non-trial free-forever**: append id to `_sealed-free-themes.ts:32`.
6. **If you want it on the entry carousel immediately**: append id to `POPULAR_THEME_IDS` in `_featured-picks.ts:38`.
7. **If you want it on the Full Library grid at `/all`**: append an entry to `LIBRARY_THEMES` in `_catalog.ts:36` with the SAME `id` prefix convention and a wallpaperUrl matching step 3.
8. **If the theme has a code-backed package (legacy pattern · wallpaper config + bubble material + ambient layers)**: add to `LIVE_WORLD_PACKAGES` in `_live-worlds.ts:55`.

## Common failure modes

| Symptom | Likely missed surface | Fix |
|---|---|---|
| "Theme exists in HQ but not in `/chat-themes-library/all`" | 5 | Add to `LIBRARY_THEMES` catalog |
| "Theme shows on `/all` but never on landing carousel" | 4 | Add to `POPULAR_THEME_IDS` OR wait for view counts |
| "Theme is in DB but library doesn't display it" | 1 field `is_active=false` OR 5 | Flip `is_active` · or add to `LIBRARY_THEMES` |
| "Free user can't apply a free theme" | 3 (if forever-free) OR tier mismatch | Add to allowlist · or verify tier='gratis' |

## Guardrails

- **Never set `tier='bisnis'` or `category='premium'` without separate owner authorisation** · sealed Theme Commerce DRAFT 2026-10-20 (D1–D5 open) + Launch Pricing DRAFT 2026-10-20 (US$3.99 proposal unvalidated).
- **Never hard-code a wallpaper URL into `_catalog.ts` without a matching DB row** · drift between the two is the #1 root cause of "theme doesn't apply even though it's listed". Use `scripts/check-chat-theme-consistency.mjs` to detect this.

## Validator

Run before any PR that touches theme registration:
```
node scripts/check-chat-theme-consistency.mjs
```
Non-zero exit = drift. Reports each mismatch between DB rows and the
TypeScript surfaces.
