# NEX · 8-System Country + Visibility Audit · 2026-10-31

**Scope**: read-only audit of what each of the 8 NEX sections currently does for country and visibility, measured against the targets in `nex-global-content-and-country-discovery-2026-10-31.md`.
**Status**: analysis only · no code change · no migration · owner reviews before implementation moves.

---

## At-a-glance summary

| # | System | Exists | Country today | Visibility today | Gap vs doctrine |
|---|---|---|---|---|---|
| 1 | **Feed** | yes · `/nex-native/nex-feed/*` | **none** | **none** | needs country + visibility · needs shared service refactor |
| 2 | **Directory** | yes · spine applied | ✅ `country` NOT NULL (ISO-3166 alpha-2) | ✅ `lifecycle_state` enum + sealed publication gate (`business_directory_v`) | **mostly ready** · reuse the spine · wire country selector |
| 3 | **Live** | yes · `nex_live_session` | **none** | partial · `status: open/ended` (session lifecycle, not audience) | needs country + visibility · session lifecycle is NOT audience scope |
| 4 | **Live Selling** | partial · `live-commerce` surfaces + `nex_live_featured_product` (M219 unapplied) | **none** | inherits from product status | needs country + visibility + delivery-destinations list |
| 5 | **Social** | yes · `/nex-socials/*` chooser · peer chat shared | **none** | **none** (no persistent social content table) | greenfield · but peer chat already crosses countries freely (correct by doctrine) |
| 6 | **Creator** | yes · just built this session · `/creator`, `/settings/creator`, badges | **none** | partial · `creator_support_settings.enabled` (settings-scoped only) | needs no changes today · creator content lives in Music / Video / Shop / etc. · badges are global by design |
| 7 | **Business** | yes · `nex_business` applied | **none** | **none** · RLS = `USING (true)` (everyone can read every business) | **blocker** · businesses MUST have a country column before deployments split |
| 8 | **Shop** | yes · `nex_product` applied | indirect via business (which lacks country) | ✅ `status: draft/live/archived` with public RLS filtering to `live` | needs country + delivery-destinations (per doctrine §5) |

**Headline**: Directory + Shop have ~half the pieces · everything else is greenfield for country.

---

## 1 · Feed

**Where it lives**:
- `src/app/nex-native/nex-feed/page.tsx`
- `src/lib/nex-native/nex-feed/nex-feed-entries.ts`

**Country today**: none found.

**Visibility today**: none found. The feed pulls from `nex_music_track` (filtered to visibility ≠ removed) and `nex_uploaded_video` (no visibility column shown), concatenates, serves everyone equally.

**Takeaway**: greenfield. The doctrine's "one connected feed with country-weighted ranking + visibility filters" needs:
- `visibility` column on feed-contributing content models (music, video, future posts)
- A ranking service that reads viewer's primary + selected country, viewer's relationships, and author visibility
- No country column on the feed itself · ranking is per-request

---

## 2 · Directory

**Where it lives**:
- `src/lib/nex-native/directory/directory-service.ts`
- `src/app/nex-native/directory/[id]/page.tsx`
- Spine: migrations 167 (`nex.business_canonical`), 175 (`nex.business_directory_v` publication view), related evidence/freshness tables

**Country today**: ✅ `nex.business_canonical.country` text NOT NULL, ISO 3166-1 alpha-2 (migration 167:225). `country_counts.ts` reads directly.

**Visibility today**: ✅ `lifecycle_state` enum: `DISCOVERED, ENRICHED, VERIFIED, OWNER_CLAIMED, OWNER_VERIFIED, DORMANT, SUPERSEDED`. Sealed publication gate (`nex.business_directory_v`) filters to L1 = `{VERIFIED, OWNER_CLAIMED, OWNER_VERIFIED}` only.

**Takeaway**: **mostly ready**. The country selector + per-country directory view can be built on existing primitives. No new migration needed for the Directory itself. The sealed directory spine stays untouched.

---

## 3 · Live

**Where it lives**:
- `src/lib/nex-native/live-broadcast/live-session-service.ts`
- `nex-supabase/migrations/219_nex_live_session_and_featured_product.sql`

**Country today**: none found.

**Visibility today**: partial · `nex_live_session.status` text `CHECK IN ('open','ended')`. RLS makes `open` sessions readable, `ended` sessions private to the broadcaster.

**Takeaway**: needs country + a separate audience-visibility column. Session lifecycle (`open/ended`) is NOT the same as audience scope (`PRIVATE/FOLLOWERS/COUNTRY/SELECTED_COUNTRIES/WORLDWIDE`). Need to add a column, do NOT reuse `status`.

**Sealed note**: the Live R9 DRAFT doctrine (sealed 2026-10-27) + MAX_VIEWERS=10 are untouched · adding country + audience scope doesn't conflict with them.

---

## 4 · Live Selling

**Where it lives**:
- `src/app/nex-native/live-commerce/feed/`
- `src/app/nex-native/live-commerce/go-live/`
- `nex_live_featured_product` (migration 219 · not yet applied)

**Country today**: none found.

**Visibility today**: none of its own. Pinned products inherit visibility from `nex_product.status` (draft/live/archived).

**Takeaway**: greenfield for country. Doctrine section 5 ("visibility ≠ purchasing") specifically requires two independent fields on products:
- `visibility` (who sees it)
- `allowed_delivery_destinations text[]` (who can buy it)

Both to be added when Shop is wired for country isolation.

---

## 5 · Social

**Where it lives**:
- `src/app/nex-native/nex-socials/page.tsx`
- `_chooser-client.tsx`, `_intent-catalog.ts`
- Peer chat tables (`nex_peer_conversation`, `nex_peer_message`) · from prior commits · GLOBAL per prior plan

**Country today**: none found.

**Visibility today**: none found · nex-socials is an intent chooser (how do you want to connect to someone) · not a content table.

**Takeaway**: greenfield for persistent social content IF/WHEN we add one. Peer chat already correctly crosses country boundaries (doctrine §4 Social row). No new migration needed yet.

---

## 6 · Creator

**Where it lives**:
- `src/app/nex-native/creator/page.tsx` (dashboard)
- `src/app/nex-native/settings/creator/*` (Support settings · M242 applied)
- `src/lib/nex-native/creator/*`

**Country today**: none found · creator identity is global by design.

**Visibility today**: `creator_support_settings.enabled` is a settings-scoped flag. The actual CONTENT (music / video / etc. a creator publishes) lives in those feature's tables.

**Takeaway**: **no change needed today**. Creator badges + Support settings are owner-personal · global by design. When Live / Music / Video get their own country/visibility treatment, the creator surfaces inherit automatically.

---

## 7 · Business

**Where it lives**:
- `src/app/nex-native/[businessSlug]/*`
- `src/lib/nex-native/business/engine.ts`
- `nex-supabase/migrations/002_nex_business.sql`

**Country today**: **none found**. `nex_business` has no country column. Owner is linked via `owner_account_id` FK only.

**Visibility today**: **none found**. RLS: `CREATE POLICY nex_business_public_read ... USING (true)` (migration 002:71) — everyone reads every business.

**Takeaway**: **this is the biggest gap**. Businesses MUST get a country column before the two-apps deployment can meaningfully isolate anything commerce-related. Also needs a visibility column (business can opt into international discovery · doctrine §4).

**Draft migration 244 already proposes this**: `nex_business` is in the country-column list. The reissued migration 247 scope adds the `visibility` column.

---

## 8 · Shop

**Where it lives**:
- `src/app/nex-native/packages/*`
- Product routes under `/nex-native/[businessSlug]/[productId]/`
- `nex-supabase/migrations/003_nex_product.sql`

**Country today**: indirect · `nex_product.business_id` FK · but `nex_business` has no country · so `nex_product` effectively has no country today.

**Visibility today**: ✅ `nex_product.status` text `CHECK IN ('draft','live','archived')`. RLS: public reads only `status='live'`. Owners read all states.

**Takeaway**: `status` is a decent visibility primitive but doesn't capture the doctrine's 6 scopes. Options:
- Keep `status` for lifecycle (draft/live/archived) · add separate `visibility` column for audience scope
- Add `allowed_delivery_destinations text[]` per doctrine §5 (purchasing separate from visibility)

---

## Reconciliation with Draft Migration 244

Migration 244 (country column DRAFT) targets 37 tables. Against this audit:

- **Already have country** · DO NOT add via 244: `nex.business_canonical` (sealed spine · stays as-is).
- **Correctly listed in 244** · `nex_business`, `nex_product`, `nex_live_session`, `nex_live_featured_product`, community tables, etc.
- **Not yet in 244 but need country** · (list is probably correct · needs CI-1 sign-off)
- **Visibility column** · needs reissued migration 247 (currently scoped only to RLS; owner reissue should also add the `visibility content_visibility` column + an enum type).

---

## What this audit says to do (not do)

| Statement | Verdict |
|---|---|
| Build a new feed service from scratch | No. First wire visibility + country into existing content models · the feed service is downstream of that. |
| Add a country column to businesses | Yes · high priority. The current `USING (true)` RLS + no country column means two deployments cannot be isolated meaningfully. |
| Add country to peer chat / music / vault | No. Those are GLOBAL by doctrine. Only country-anchored content gets the country column. |
| Create a new `nex_feed` table | No. Feed is a query layer, not a storage layer. |
| Reshape chat themes for country | No. Sealed commerce product · stays global. |

---

*Audit recorded 2026-10-31 as a companion to the global content doctrine. Pure analysis · no implementation claims.*
