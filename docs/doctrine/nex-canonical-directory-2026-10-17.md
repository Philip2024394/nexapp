# NEX Canonical Directory Doctrine · 2026-10-17

**Owner-sealed.** The NEXAPP has exactly ONE official NEX Directory experience.

## Canonical entry point

```
/nex-native/directory/landing
```

Reached from:
- Shared NEX header · magnifying-glass icon → `/directory/landing`
- Shared drawer · "Search" entry → `/directory/landing`
- Welcome drawer · "Search" entry → `/directory/landing`
- Welcome intent allowlist · `/directory/landing` slot (replaces former `/discover` slot)
- Capabilities menu · "Discovery" tile → `/directory/landing`
- Pink-dream theme bottom tab · "Discover" → `/directory/landing`
- Contacts hub · magnifying-glass icon → `/directory/landing`
- Cart · empty-state "Browse" CTA → `/directory/landing`
- Liked · empty-state CTA → `/directory/landing`
- Orders · empty-state "Browse NEX Directory" CTA → `/directory/landing`
- `manage/promos` · "NEX Directory" link → `/directory/landing`
- PWA `start_url` (if changed later) → `/directory/landing`

## Categories within the one experience

The one canonical NEX Directory covers every discovery category NEX supports:

- Businesses + business profiles
- Products + product discovery
- Food · restaurants · cafés · bakeries · catering
- Trades · contractors · professional services
- Shops · suppliers · retailers
- Local services · community businesses
- Any future directory category

These are **category filters within the one directory experience**, not separate competing directory systems. New categories must be added to the one directory, never spun up as parallel directory URLs.

## Surface map

| Route | Role | Status |
|---|---|---|
| `/nex-native/directory/landing` | **Canonical entry · hero + Shop by Category grid + featured deals** | SEALED · the ONE canonical NEX Directory |
| `/nex-native/directory` | Category/results surface · accepts `?category=X` and path-based `/directory/{slug}` · forwards to `LandingDirectoryView` | Preserved · part of canonical experience |
| `/nex-native/directory/[id]` | Listing detail page · Area Information Doctrine applies | Preserved · sealed · must not be modified without owner authorisation |

## Retired competing surfaces

| Retired route | Replacement | Mechanism |
|---|---|---|
| `/nex-native/discover` | `/nex-native/directory/landing` | Thin server-side redirect · bare path → landing · `?category=X` → `/directory?category=X` · `?q=X` → landing (query dropped · see blockers below) |
| `/nex-native/search` | `/nex-native/directory/landing` | **NOT retired yet** · see explicit retirement blocker below |

### Explicit retirement blocker · `/nex-native/search`

`/nex-native/search` remains operational specifically because two product-tag chip flows pass `?q=X` (search text) and the canonical `/directory` + `/directory/landing` do not yet support search-text filtering. The two blockers are:

- `src/app/nex-native/product/[productId]/page.tsx:127` · product-detail tag chip
- `src/app/nex-native/manage/page.tsx:809` · seller manage-page tag chip

Both pass `href={`/nex-native/search?q=${encodeURIComponent(tag)}`}`. Until the canonical directory accepts `?q=` (owner-authorised extension in a separate task), `/search` stays alive to serve these two flows. All OTHER navigation to `/search` has been rewired to `/directory/landing` (or `/directory?category=X` for category-query callers).

**This is a compatibility measure, not a change to the product decision.** The single canonical NEX Directory remains the only official entry point for discovery. `/search` is a legacy entry point that will be fully retired once the canonical surface supports search-text filtering, via its own owner-authorised task.

## Protected invariants

- **`/directory/[id]` + Area Information Doctrine** · unchanged. The sealed `docs/doctrine/area-information-doctrine.md` continues to apply.
- **Shared services** · `landing-feed-service`, `discovery-service`, `local-directory-service`, `landing-category-mapping`, `area-intelligence-service`, `ListingCard`, `FilterSheet`, `DiscoverThisArea`, `ControlDrawer` · all preserved. Even services previously shared with the retired `/discover` stay because the canonical consumes them.
- **Database layer** · `nex_business`, `nex_product`, `nex.business_canonical`, `nex.business_directory_v`, `nex.business_evidence`, `nex.meaningful_area` · unchanged.
- **Owner records · ownership · verification · permissions** · no changes.
- **Seller-side flows** · `manage/*` surfaces untouched except the two already noted (tag-chip stays on `/search?q=`, promo page link updated to `/directory/landing`).

## Caller preservation rules

- Pure navigation callers (header, drawer, menu, bottom tabs, empty-state CTAs) · always land on `/nex-native/directory/landing`.
- Category-query callers · route to `/nex-native/directory?category=X` to preserve the query intent.
- Search-text (`?q=`) callers · temporarily stay on `/nex-native/search?q=X` until the canonical supports search-text filtering.
- No caller may be deleted without explicit owner authorisation.

## What this doctrine does NOT authorise

- Deleting `/nex-native/search/page.tsx` or any of its helper components (`_amenity-chips.tsx`, `_promo-bubbles.tsx`, `_menu-preview.tsx`, `_hard-location-gate.tsx`, `_country-selector.tsx`, `_business-chips.tsx`, `_food-amenity-chips.tsx`, `_discount-pill.tsx`, `_discover-controls.tsx`, `_card-helpers.ts`) · dependency graph must be verified under a separate authorised task.
- Modifying migrations or database schema.
- Changing database records, listings, products, or business ownership.
- Adding a new location gate to the canonical directory.
- Changing the canonical landing's visual language or feature set beyond what the owner specifically authorises.
- Modifying `/nex-native/directory/[id]` detail page or the Area Information Doctrine panel.

## Open items

| Item | Owner decision needed |
|---|---|
| Canonical `?q=` support · add search-text filtering to `/directory/landing` or `/directory` | Separate authorised task · must land tests before `/search` can be fully retired |
| `/search` helper component dependency graph · which `search/_*.tsx` files are referenced from `/directory/[id]`, seller manage flows, or other canonical consumers | Needs per-file grep + owner approval before any deletion |
| Welcome intent flow · the `_remember-intent-action.ts` safeRedirects list already updated to replace `/discover` with `/directory/landing` · verified via `intent-persistence.test.ts` and `welcome-honesty.test.ts` | Change applied this commit · no further owner decision needed |
| PWA `start_url` · currently `/nex-native/contacts` per `public/nex.webmanifest` · unchanged | Separate decision if the canonical directory should become the PWA entry point |

## Audit trail

- 2026-10-17 · owner-sealed via NEXAPP SINGLE CANONICAL DIRECTORY DOCTRINE instruction
- 2026-10-17 · Phase D1 + D2 + D8 bundle (this doctrine + /discover retirement + 11 caller rewires + 2 preserved `?q=` blockers) · see Phase Y staging index

## References

- `src/app/nex-native/directory/landing/page.tsx` · canonical implementation
- `src/app/nex-native/directory/page.tsx` · results surface
- `src/lib/nex-native/directory/landing-feed-service.ts` · merged listing feed
- `src/lib/nex-native/directory/landing-category-mapping.ts` · category taxonomy
- `docs/doctrine/area-information-doctrine.md` · protects `/directory/[id]`
