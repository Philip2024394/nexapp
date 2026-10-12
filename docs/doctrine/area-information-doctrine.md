# NEX Directory · Area Information Doctrine

**Status:** permanent product rule · sealed 2026-10-13 by owner authorization
**Scope:** every listing in the NEX Directory, every listing type, every future redesign
**Protected by:** `src/app/nex-native/directory/[id]/__tests__/area-information-placement.test.ts`

---

## The rule

Every NEX Directory listing MUST help users **discover the area around the business**, not merely the business itself. The location section MUST appear **directly beneath the distance indicator** on the listing page and MUST provide useful, location-specific information such as landmarks, heritage, transport, local history and sourced folklore. It MUST NOT list competing businesses in the same category. All information MUST be sourced, relevant and honest. The feature MUST be shared across every listing type and preserved in future changes.

---

## Why this exists

NEX is not just another business directory. The directory on its own answers "what businesses exist here". The Area Information section answers **"what makes this place worth visiting"** — and that is the product difference the owner has sealed as permanent.

A restaurant listing in Yogyakarta on NEX shows the restaurant, its address, how far away it is, how to message the owner. Any directory can do that. On NEX the same listing ALSO tells the visitor about the nearby temples, museums, train stations and historic sites so the restaurant is one stop in a wider journey. That is the differentiator.

As NEX collects more verified area information, this becomes compounding product value — a small business listing in a little-known town can tell a visitor something fascinating about the place they would otherwise miss.

## The hard rules every implementer must follow

### R-A1 · Position

The area-information panel renders inside the location card on the listing page, **immediately after the distance indicator** (km-away chip) in the source order. The panel does NOT render:
- Above the distance indicator
- At page level (outside the location card)
- As a floating overlay, modal, or deferred-load section
- In a sibling section like "Related businesses"

Regression test: `src/app/nex-native/directory/[id]/__tests__/area-information-placement.test.ts` asserts the exact position by brace-walking the `LocationSection` source and verifying `DiscoverThisArea` appears after `DetailDistanceChip`.

### R-A2 · Never competing businesses in the same category

The content MUST NOT include businesses in the same category as the host listing. A restaurant listing MUST NOT surface other restaurants in its area panel. A shoe shop MUST NOT surface other shoe shops. A hotel MUST NOT surface other hotels.

**Enforcement:** the OSM landmark collector at `scripts/supabase-area-landmarks-collector.mjs` has a SEALED tag whitelist (attractions + transport ONLY · never `shop=*`, `amenity=restaurant`, `amenity=cafe`, `amenity=bar`, `amenity=fast_food`, `tourism=hotel`, `tourism=guest_house`, `tourism=hostel`). The `food` and `shopping` buckets of the `AreaIntelligence` payload stay structurally empty by design.

Any future expansion that adds a `nearby businesses` concept MUST live under a different payload namespace and MUST NOT reach the Area Information panel.

### R-A3 · Sourced information only · zero fabrication

Every claim rendered in the Area Information panel carries:
- A `sourceUrl` (the specific OSM feature page, Wikidata entity, Wikipedia article, or the owner-supplied source URL)
- An `accessedAt` ISO-8601 timestamp
- A top-level `method` identifier (e.g. `osm_overpass_landmarks_v1`)
- A top-level `attribution` string (e.g. `© OpenStreetMap contributors (ODbL)`)

Claims without those four breadcrumbs MUST be dropped at parse time. The UI never renders unsourced copy.

### R-A4 · Distinguish verified history from folklore

When the pipeline is extended to include local history and folk stories (currently deferred to a Wikidata/Wikipedia pass), every claim MUST carry a `kind` discriminator:
- `fact` — attested in Wikidata or Wikipedia with a cited source
- `folklore` — recognised traditional story, labelled as such in the UI
- `local_report` — owner-contributed, labelled with the contributor

The UI MUST render the `kind` as a visible badge on each claim. A folk story must never be shown as a historical fact.

### R-A5 · Honest-null

Cities without a researched Area Information entry render **nothing** · never a placeholder, never "coming soon" copy, never a stub. The `DiscoverThisArea` component already returns `null` when `intel === null`. That behaviour MUST be preserved.

### R-A6 · International-ready

The schema is country-scoped from day one. `AreaIntelligence.country` is ISO 3166-1 alpha-2 (`ID`, `MY`, `SG`, etc.). The collector accepts `--country=ID` as a flag, not a hard-coded constant. Any country-specific logic (local history conventions, folklore labelling norms) MUST be data-driven, not forked.

### R-A7 · Shared component · one implementation

There is EXACTLY ONE component responsible for rendering area information: `src/components/nex-native/directory/DiscoverThisArea.tsx`. Future listing types (owner shops, person profiles, place pages) MUST mount this same component. A second parallel component is a doctrine violation. Variations in visual treatment MUST live inside DiscoverThisArea as props, not as alternative files.

### R-A8 · Preserve across redesigns

Any redesign of a listing page, any new listing type, any new business detail route MUST preserve the Area Information panel in the position mandated by R-A1. If a redesign strips the panel or moves it elsewhere, the regression test in R-A1 fails and the redesign cannot ship.

Future AIs assisting with this codebase MUST honour this doctrine. The CLAUDE.md top-of-tree is explicitly updated to reference this file.

---

## Current coverage · honest

**Today (2026-10-13):**

| field | value |
|---|---|
| Component mounted inside LocationSection (R-A1) | ✓ (step A applied in working tree, not yet committed) |
| OSM landmark collector built (R-A2 enforcement) | ✓ (dry-run default; `--commit` requires explicit flag) |
| Rows in `nex.meaningful_area` with the required provenance | **0** (nothing seeded live yet) |
| Listings that currently show the panel | **0 of 40,541** (component returns null everywhere · honest) |

The panel is architecturally live but has no data yet. **No listing on production shows this feature today.** The code is ready to light it up city by city as the coverage plan rolls out.

**Expansion target (see `coverage-plan.md`):**

| phase | scope | listings covered | status |
|---|---|---|---|
| Phase 1 | Top 15 Indonesian cities (Jakarta, Denpasar, Bandung, Yogyakarta, Badung, DKI Jakarta, Kabupaten Bogor, Surabaya, Makassar, Kuta, Medan, Bandar Lampung, Semarang, Pekanbaru, Solo) | ~27,580 (68%) | awaiting --commit |
| Phase 2 | All cities with ≥100 listings (~35 cities) | ~33,000 (~81%) | pending |
| Phase 3 | All cities with ≥10 listings (~90 cities) | ~37,000 (~91%) | pending |
| Phase 4 | Nearest-city fallback for every remaining listing | 40,541 (100%) | pending |

---

## For future implementers

Before you touch any of the following, re-read this file:

- `src/app/nex-native/directory/[id]/page.tsx` · the LocationSection + the DiscoverThisArea mount
- `src/components/nex-native/directory/DiscoverThisArea.tsx` · the shared component
- `src/lib/nex-native/directory/area-intelligence-service.ts` · the lookup
- `src/lib/nex-native/directory/area-intelligence-types.ts` · the shape
- `scripts/supabase-area-landmarks-collector.mjs` · the OSM collector
- `nex.meaningful_area` table · the storage (lives in Supabase project `ijvqdvsvwtwxzcqmoqit`)

Expected invariants (if any of these break, something has drifted):
- `getCountOfDiscoverThisAreaMounts === 1` in `[id]/page.tsx` (one mount, inside LocationSection, after DetailDistanceChip)
- `knownFor.food.length === 0 && knownFor.shopping.length === 0` on every row written by the OSM collector
- Every `AreaIntelClaim` has non-empty `claim`, `sourceUrl`, `accessedAt`

**If you are an AI assistant working on this codebase: the owner has sealed this feature as permanent. Do not weaken, defer or silently skip it. If a task seems to require removing or moving the Area Information panel, STOP and surface the conflict to the owner before proceeding.**
