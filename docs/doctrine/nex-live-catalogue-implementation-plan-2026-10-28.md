# NEX Live Catalogue · Implementation Plan · 2026-10-28

**Mandate**: founder-sealed 2026-10-28 · move from research-only picker to a genuinely live category + subcategory system with category-specific listing journeys for both Manage and Shop upload. Documentation-only output. No code, no migrations, no commits.

**Revision 2026-10-28 (same day)**: founder added the unified 5-card Create entry flow (Go Live · Upload Product Video · Upload Entertainment Video · Upload Image · Upload Music). Section 2.5 added below. Six founder gates preserved; two new decisions surfaced.

**Correction landed 2026-10-28 (code · 1 line)**: `_upload-client.tsx:226` toast copy changed from the dishonest `"is in the review queue"` to `"Your request hasn't been submitted yet. Category requests aren't available just yet."` — directly authorised by founder in the same message.

**Status**: Phase 1 audit + Phases 2-5 plan complete + 5-card Create flow folded in. Awaiting founder review before any implementation phase.

---

## Phase 1 · Research-to-Application Audit

### 1A · Research artifacts (verified by read)

| Artifact | Location | Size | State |
|---|---|---|---|
| Coverage register | `docs/doctrine/nex-catalogue-coverage-register.jsonl` | 116 rows (1 header · 1 Watches · 114 B1) | All JSON-valid |
| B1 dossiers · Books | `docs/doctrine/catalogue/books/` | **35 files** | 12-dim template · inline citations |
| B1 dossiers · Office | `docs/doctrine/catalogue/office/` | **46 files** | Same |
| B1 dossiers · Arts | `docs/doctrine/catalogue/arts/` | **33 files** | Same |
| Register validation report | `nex-catalogue-register-validation-2026-10-28.md` | V1 output | 0 missing · 1 inferred class · 0 mismatches |
| Token audit | `nex-manage-live-token-audit-2026-10-28.md` | V2 output | 48 line-cited tokens |
| A2-T2 plan | `nex-a2-t2-implementation-plan-2026-10-28.md` | V3 output | Pre-wire plan · superseded by this doc |
| 13 blocker log | `nex-catalogue-founder-blockers-batch-1.md` | V4 output | All 13 open · founder-decision pending |

**Dossier shape (sampled 3 across depts)**: fiction = 89 lines · office_chairs = 51 lines · artisan_rings = 50 lines. Common sections = D1 Identity · D2 Required · D3 Optional · D4 Technical · D5 Variant axes · D6 Media · D7 Commercial · D8 Compliance · D9 Search · D10 Non-physical · D11 i18n · D12 Unresolved. **Every claim tagged `[VERIFIED | CONVENTION | NEX_PROPOSAL | UNRESOLVED]`**.

### 1B · Application state (verified by read)

| Surface | File | State |
|---|---|---|
| Category picker | `src/app/nex-native/manage/watches/new/_category-picker.tsx` | 30 depts rendered · 1 Enabled (Watches) · 29 Pending-review · click opens Request form (console+toast, no persistence) |
| Interim taxonomy TS module | `src/lib/nex-native/catalogue/departments.ts` | 257 lines · 30 depts · first-level categories only · **not DB-backed** · marked INTERIM |
| Watches upload form | `_upload-client.tsx` | 5 tiers · 50+ fields across Essential/Detailed/Verified · lines 477-825 are TierHeader blocks · uses sealed `NexInput`/`NexTextarea` · writes to `nex_watch_listing` via `createWatchListingAction` |
| Watches DB layer | `nex-supabase/migrations/227-230` | `nex_watch_listing` · `_entitlement` · directory view · tsvector search · all applied |
| Watches tests | `src/lib/nex-native/watches/__tests__/*` | 7 files · 101 tests · all pass (verified 2026-10-28) |
| **No other category form** | — | **The 29 pending depts have no spec form, no server action, no table, no test** |
| Picker-on-same-page issue | `_upload-client.tsx` | Picker, Variant row, Essential, Detailed, Verified **all stack on one page** · the owner has now sealed that spec/details must be a **separate page** |

### 1C · Traceability matrix (dossier → app)

**Per-leaf status across the 5 completion states**:

| State | Watches | 114 B1 leaves |
|---|---|---|
| Research complete | ✅ (frozen reference) | ✅ 114 / 114 |
| Specification complete *(dossier → form field spec)* | ✅ (sealed `_upload-client.tsx`) | ❌ 0 / 114 |
| Implemented *(form page exists in app)* | ✅ `/manage/watches/new` | ❌ 0 / 114 |
| Verified *(automated or manual tests)* | ✅ 101 unit tests pass | ❌ 0 / 114 |
| Enabled *(seller can publish)* | ✅ in `departments.ts.enabled=true` | ❌ 29 depts flagged `enabled: false` |

### 1D · Honest gap

- **Research completion ≠ specification completion**. A dossier is a research artifact · it does not get rendered as a form by itself.
- The research dossier shape is **well-structured** (12 dimensions, consistent tagging) · a mechanical reader could extract D2 required + D3 optional + D4 technical + D5 variants + D8 compliance into a form schema. That extraction has not happened yet.
- Field-level mapping Watches dossier → `_upload-client.tsx` fields was never codified in a machine-readable form · it was done by hand during Stage A1-A3. Replicating that by hand across 114 leaves is not scalable.
- **No "universal form renderer" exists** · each category today requires its own React component. A dossier-driven generic renderer is a Phase 5 proposal below, not an existing primitive.

---

## Phase 2 · Target User Journey (sealed: picker and spec on separate pages)

### 2A · Routes (proposed · subject to founder approval)

```
┌─ Page 1 · Category selection ───────────────────────────────────┐
│  Route: /manage/listings/new                                    │
│    Headline: Select Product Category                            │
│    Content: all 30 depts + first-level categories + search      │
│    Interaction: tap enabled leaf → router.push("/manage/        │
│                 listings/{leaf_id}/new")                        │
│                 tap pending leaf → inline Request form (toast)  │
│    No spec fields rendered here. Just picker.                   │
└─────────────────────────────────────────────────────────────────┘
                              │ navigate on enabled leaf
                              ▼
┌─ Page 2 · Category-specific form ───────────────────────────────┐
│  Route: /manage/listings/{leaf_id}/new                          │
│    Headline: {category label} · List a new {thing}              │
│    Content: Essential / Detailed / Verified sections derived    │
│             from that leaf's dossier D2/D3/D4/D5/D8             │
│    Interaction: back button returns to Page 1 with selection    │
│                 preserved · submit publishes via leaf-specific  │
│                 server action                                   │
│  Watches special case:                                          │
│    Existing /manage/watches/new keeps working (back-compat)     │
│    OR redirects to /manage/listings/jewellery_watches.watches/  │
│       new (founder-decision)                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 2B · State preservation across pages

- Selected `leaf_id` carried in URL (not localStorage · survives refresh, deep-link, mobile backgrounding)
- Draft form state preserved on the Page-2 route for the active `leaf_id` · back-navigation does not reset
- Validation errors never clear user input
- Draft vs published lifecycle = existing `nex_watch_listing.status` pattern applied per new table (one table per leaf OR shared `nex_product_listing` · see Phase 3)

### 2C · Shop upload entry point (not just Manage)

- Shop (seller) workflow lands on the SAME `/manage/listings/new` picker (reached via the 5-card Create entry — see §2.5)
- Difference is UI framing only · `source: "shop"` vs `source: "live"` can be a query param captured server-side at submit · no divergent category tree

### 2.5 · The 5-card Create entry page (founder-sealed 2026-10-28)

**New top-level entry**: `/nex-native/create` (route does not exist today · needs creation in Phase 5 step 1).

The Create button (currently fires `onCreate` from `BroadcasterLibrarySheet` → `router.push("/nex-native/manage/watches/new")` at `_video-viewer-client.tsx:1390`) must be rewired to land on this new 5-card entry instead of jumping directly to the watch upload page.

**Card layout** (mobile-first, 1-column on narrow phone frame, 2-column at tablet width):

```
┌─ Create ────────────────────────────────────────────────────────┐
│  What would you like to create?                                 │
│                                                                 │
│  ┌────────────────────┐  ┌────────────────────┐                 │
│  │  🔴 Go Live        │  │  🛒 Product Video  │                 │
│  │  Stream now        │  │  Add to shop       │                 │
│  └────────────────────┘  └────────────────────┘                 │
│  ┌────────────────────┐  ┌────────────────────┐                 │
│  │  🎥 Entertainment  │  │  🖼️ Image          │                 │
│  │  Video post        │  │  Photo post        │                 │
│  └────────────────────┘  └────────────────────┘                 │
│  ┌────────────────────┐                                         │
│  │  🎵 Music          │                                         │
│  │  Playlist / links  │                                         │
│  └────────────────────┘                                         │
└─────────────────────────────────────────────────────────────────┘
```

#### Destination + flow per card · verified against existing routes

| Card | Destination (route) | Route exists? | Uses product categories? | Result shape |
|---|---|---|---|---|
| **A · Go Live** | `/nex-native/live-commerce/welcome` (then `/go-live`) | ✅ **exists** · sealed · verified at `src/app/nex-native/live-commerce/welcome/page.tsx` + `/go-live/page.tsx` | No | Existing live session via sealed broadcaster · 10-viewer cap preserved · no new infra |
| **B · Upload Product Video** | `/nex-native/manage/listings/new` (Page-1 picker) → tap enabled leaf → `/nex-native/manage/listings/{leaf_id}/new` (Page-2 category form) | ❌ **picker route does not exist** today · currently `/manage/watches/new` conflates picker + form | **Yes** · depends on §2A/§2B routes being created in Phase 5 step 1 | Product/service listing with optional video attached · uses existing `nex_watch_listing` for Watches, future shared/sibling table for others |
| **C · Upload Entertainment Video** | `/nex-native/create/video` or similar | ❌ **route does not exist** today · the Record/Drafts hub at `/live-commerce/create` was **deleted** 2026-10-28 session | No product taxonomy · uses the existing `nex_uploaded_video` table (already applied, used for Hendra W-6) with `visibility='public'`, `source='owner_upload'` | Entertainment media item · owner-content rights · stored in prod `nex-live-uploaded` bucket |
| **D · Upload Image** | `/nex-native/create/image` or similar | ❌ **route does not exist** today | Content category only · optional route-into-listing CTA if user says "I'm selling this" | Image post (new primitive) · OR hand-off to card B when sale intent |
| **E · Upload Music** | `/nex-native/create/music` or similar | ❌ **route does not exist** today | No product taxonomy | Playlist/collection with external Spotify/YouTube links · **no NEX hosting** · no download/redistribution |

#### Honest state per card

| Card | What exists today | What is missing | Can it ship first? |
|---|---|---|---|
| A | Full sealed Go Live flow | Nothing — just a card linking to it | ✅ **Yes · ship card A first · zero backend work** |
| B | Picker rendered · subcategory tap works · watches form exists | Page-2 route split · generic FormRenderer · 5 of 6 original gates unresolved | ⚠️ Depends on gates 1-6 |
| C | `nex_uploaded_video` table applied · bucket `nex-live-uploaded` exists · Hendra W-6 wire proves the write path | UI route · upload UX · thumbnail generation · publishing lifecycle · moderation surface | ⚠️ New route · needs doctrine for owner-content moderation |
| D | None | Everything · schema · storage path · route · UI · moderation | ❌ Full greenfield |
| E | None | Everything · schema (likely `nex_playlist` + `nex_playlist_link`) · route · link-validation utility · Spotify/YouTube oEmbed parsing · platform compliance review | ❌ Full greenfield · plus IP/copyright considerations (external link only ≠ hosting but still needs policy copy) |

**Decision not yet made** (new, from this revision): **does card A ship on day 1 standalone, or do all five ship together?** My recommendation is **phased · card A first (zero backend), then B, then C, then D+E with their own doctrine seals**. This is a new founder gate (gate 7).

#### Composition rule (unchanged)

Manage and Shop upload both land on **card B's Page-1 picker** · they do NOT fork their own catalogue. The only diff is `source: "live" | "shop" | "manage"` captured server-side on submit. No duplicate taxonomy. No duplicate FormRenderer.

### 2D · Three illustrative category-specific form shapes (from the dossiers · research-only)

**Books · Fiction** (sampled from `books.books.fiction.md`):
```
Essential:  title · author · language · binding · condition · isbn_13 · genre · price
Detailed:   subtitle · publisher · publication_year · edition · page_count ·
            series_name/number · summary · translator · illustrator
Technical:  width_mm · height_mm · spine_thickness_mm · weight_g · page_count
Media:      2-8 images · front cover + back cover required
```

**Office · Office Chairs** (sampled from `office.business_furniture.office_chairs.md`):
```
Essential:  product name · brand · chair_type · weight_capacity_kg ·
            upholstery_material · has_wheels · has_armrests · price · condition
Detailed:   model · armrests_adjustable · lumbar_support · reclining ·
            seat_height_range_mm · headrest · footrest · warranty_months ·
            assembly_required
Technical:  width_mm · depth_mm · min/max_height_mm · seat_width/depth_mm ·
            weight_kg · weight_capacity_kg
Variants:   colour (max 8) · size M/L (max 3)
Media:      4-10 images · front + side + back + casters/mechanism
Compliance: BIFMA X5.1 · ISO 24496 · EN 1335 · gas-strut shipping warning
```

**Arts · Artisan Rings** (sampled from `arts.handmade_jewellery.artisan_rings.md`):
```
Essential:  product name · maker_or_atelier · metal_type · metal_fineness ·
            ring_size_system · ring_size · has_gemstone · gemstone_type (if) · price
Detailed:   model · hallmark_assay_office · gemstone_weight_ct · cut · colour ·
            clarity · treatment_disclosed · rhodium_plated · engraving_available ·
            lead_time_days
Technical:  ring_size · band_width_mm · band_thickness_mm · weight_g · gem_ct
Variants:   ring_size (max 20) · metal_type
Media:      4-10 images · front + side + hallmark close-up + on-finger
Compliance: ISO 9202 fineness · ISO 8653 ring sizing · hallmark jurisdictional ·
            Kimberley/CITES conditional
```

**Note**: these three shapes are **substantially different**. A single generic form cannot serve all three honestly. The variant-engine shape differs: fiction has no variants, chairs has 2 axes, rings has 2 axes. This is the architectural reason category-specific pages are mandatory.

---

## Phase 3 · One Consistent Category System

### 3A · Shared taxonomy source · interim status flagged

- `src/lib/nex-native/catalogue/departments.ts` is the **interim** shared source
- Header of the file states explicitly: *"This file is NOT a database-backed catalogue"*
- Both Page-1 picker and (future) admin Manage views read from this module
- Replacement path: Stage B · new `nex_category` + `nex_category_attribute` tables · requires separate founder authorisation + migration
- **Not two taxonomies**. Not now, not after Stage B. The TS module is deprecated the moment the DB table lands; no parallel maintenance.

### 3B · Existing `nex_product_variant` tables (ADR carried forward)

- Migrations `035` + `075` define `nex_product_variant` with `attribute` text enum + `stock_status` text
- **Not a universal variant engine today** · zero per-variant SKU · zero per-variant image · zero per-variant price override
- Should be **extended**, not replaced, when a non-Watches variant-driven category needs enablement
- Variant engine design is **out of scope** for this plan · it is a Stage C conversation after at least one new category ships end-to-end

### 3C · Enablement enforcement

- Current: `departments.ts` has `enabled: boolean` per dept · 1 is true (jewellery_watches)
- Target: `enabled` is the **sole gate**. Rendering a tile does not imply publication readiness. Page-2 route for a disabled leaf must 404 or redirect to the Request form.
- Server-side verification: the leaf-specific server action must independently check `enabled: true` on the dossier module · never trust the client

### 3D · Watches preserved as sealed

- `nex_watch_listing` + `_entitlement` + directory view + tsvector · all stay
- `createWatchListingAction` + `grantWatchListingEntitlementMockAction` · all stay
- `/manage/watches/new` route · stays (back-compat) · may optionally redirect to `/manage/listings/jewellery_watches.watches/new` after Phase 5
- The sibling-table 1-of-1 pattern is **not the pattern for other categories** · Watches is the sealed exception

---

## Phase 4 · 13 Founder Blockers · Mapped to Categories

Each blocker is already in the explicit decision log at `docs/doctrine/nex-catalogue-founder-blockers-batch-1.md`. Below is the readiness impact on this plan.

| Blocker | Affects (dept.category.leaf) | Blocks enablement of | Can Phase 5 proceed without? |
|---|---|---|---|
| B1-01 Age-safety matrix | books.educational_resources.* · books.books.children · arts.craft_materials.beads · .clay · .craft_tools | 6-9 leaves | ✅ Yes · skip these at launch |
| B1-02 HAZMAT shipping | arts.craft_materials.resin · arts.painting_drawing.paints · arts.handmade_home.candles · office.commercial_cleaning.cleaning_chemicals | 4 leaves | ✅ Yes · skip |
| B1-03 PPE verification | office.industrial_safety.* (3) | 3 leaves | ✅ Yes · skip |
| B1-04 POS payment-doctrine disclaimer | office.business_tech.pos_systems · .barcode_scanners · .receipt_printers | 3 leaves | ✅ Yes · skip until copy drafted |
| B1-05 Biometric privacy | office.business_tech.access_control | 1 leaf | ✅ Yes · skip |
| B1-06 LOLER lifting | office.material_handling.lifting · .hoists · .slings | 3 leaves | ✅ Yes · skip |
| B1-07 ISO reseller attestation | office.industrial_safety.safety_signs + 10 indirect | 11 leaves | ⚠️ Partial · attestation copy is a 10-min decision |
| B1-08 Book authenticity (COA) | books.collectibles.* (4) | 4 leaves | ✅ Yes · skip collectibles |
| B1-09 Droit de suite | arts.art_collectibles.* (4) | 4 leaves | ✅ Yes · skip |
| B1-10 Buyer IP for personalised | arts.personalised_gifts.* (4) · .handmade_jewellery.custom_bracelets · .bespoke_jewellery | 6 leaves | ✅ Yes · skip personalised at launch |
| B1-11 Personalised returns policy | Same 7 personalised leaves | 7 leaves | ✅ Yes · same skip |
| B1-12 Trolley duplicate | office.warehouse.trolleys · office.material_handling.trolleys | 2 leaves | ⚠️ Partial · pick one for Phase 5 |
| B1-13 Umbrella leaves | 13 identified | 13 leaves | ✅ Yes · ship as-is, split later |

**Leaves safely enablable without any blocker resolution**: approximately **60-70 of the 114**. The rest need founder decisions.

### 4A · Illustrative "safe to prototype first" shortlist (not permission to enable · just scope)

- **books.books.fiction** · books.books.business · books.books.nonfiction · books.books.cookbooks · books.books.travel_guides · books.books.religious · books.books.art_design · books.books.technical (8 book leaves · no compliance blocker · simplest dossiers)
- **office.office_stationery.paper · pens · pencils · notebooks · envelopes · labels · desk_organisers · filing_supplies** (8 commodity leaves)
- **office.packaging_shipping.cardboard_boxes · bubble_wrap · mailing_bags · shipping_labels** (4 commodity leaves)
- **office.warehouse.shelving · storage_bins · work_platforms** (3 commodity leaves)
- **arts.painting_drawing.brushes · canvases · drawing_pencils · sketchbooks** (4 commodity leaves · note: paints has HAZMAT, skip)
- **arts.sewing_textiles.needles · threads · patterns** (3 commodity leaves · note: fabrics has material-specific disclosure, review)

**≈ 30 safely enablable leaves** across Books + Office + Arts. Each needs its spec-complete gate per the sealed 9-state flow.

---

## Phase 5 · Implementation Plan · Approval Gates

### 5A · What already exists and can be reused

- ✅ `_category-picker.tsx` (current light-neutral build · 30 depts rendered · subcategory buttons work · UX validated)
- ✅ `departments.ts` interim module (shared source)
- ✅ Watches full E2E flow (reference)
- ✅ Shared primitives: `NexInput`, `NexTextarea`, `SubmitButton`, `NexNativeShell`, dev-impersonation, Supabase admin client
- ✅ 114 dossiers (research-grade source)
- ✅ Watches payment-webhook + entitlement + rate limit modules (adaptable patterns · not direct reuse)
- ✅ `nex_product_variant` table (adaptable primitive · needs extension)

### 5B · What is missing

| Missing | Why | Scope impact |
|---|---|---|
| **Dossier → form-schema compiler** | Dossiers are Markdown · forms need TypeScript Zod schemas | New module `src/lib/nex-native/catalogue/leaf-schemas/*` (one TS file per enabled leaf) |
| **Generic FormRenderer** | Watches form is hardcoded JSX · 29 other leaves can't duplicate 50+ fields each by hand | New component · reads a leaf schema · renders Essential/Detailed/Verified groups |
| **Shared `nex_product_listing` table** OR per-category sibling tables | Watches uses sibling-table (sealed §8h). Universal would be `nex_product_listing + attributes JSONB` | **Decision gate** · founder picks model before any migration |
| **Image upload per leaf** | Watches uses `cover_image_url + gallery_image_urls text[]` on `nex_watch_listing` · other leaves need the same | Either new column on shared table OR mirror the pattern per sibling table |
| **Media uploader component** | Current flow is URL-only · owner may want file upload | Stage B+ concern · out of this plan |
| **Leaf-router Page-2 route** | `/manage/listings/{leaf_id}/new` doesn't exist | New Next route · dynamic segment · 404 if `leaf.enabled !== true` |
| **Request-queue durable storage** | Audit identified JSONL doctrine file is wrong for prod | Stage B · `nex_category_request` table + proper auth |
| **Admin "Manage categories" surface** | Owner mandate: configure categories, see live status, manage listing options | New admin route at e.g. `/manage/catalogue` · reads from the same shared source |

### 5C · Proposed category-specific form architecture (research-only · not authorised)

**Three competing shapes · founder picks**:

#### Option A · One shared `nex_product_listing` table + `attributes JSONB`

- One table · one server action · 1 generic Page-2 renderer
- Leaf schema (Zod) validates the attributes JSON per leaf
- Watches stays separate (sibling-table seal preserved)
- **Pros**: fast to add new leaves · one migration up front
- **Cons**: can't efficiently query across variants · complex RLS · validation lives client+server+DB CHECK
- Fits Shopify/Saleor model

#### Option B · Sibling table per enabled leaf (Watches pattern replicated)

- One table per enabled leaf (`nex_book_listing`, `nex_office_chair_listing`, …)
- One server action per leaf
- Dedicated columns · typed · indexed
- **Pros**: strongest typing · simple RLS · cheap queries
- **Cons**: new migration per leaf (scales badly) · duplicated boilerplate
- Fits the current sealed §8h pattern

#### Option C · Hybrid

- Core table `nex_product_listing` for common fields (price, currency, seller, images, draft/live, title, description)
- Sibling tables for category-specific `_watch_specs`, `_book_specs`, `_chair_specs` with 1:1 FK to the core
- One Page-2 route reads the core + joins the sibling
- **Pros**: common lifecycle in one place, dedicated specs tables · less duplication
- **Cons**: 2-table write per listing · more migrations than A, fewer than B

**None of these are authorised by this plan.** They are the three options the founder needs to pick one of before any migration.

### 5D · Minimum-safe implementation sequence (if founder picks Option A, which this plan **recommends** · fastest to launch · simplest ops)

Each step is a separate authorisation gate.

| # | Step | New files | Migrations | Authorisation needed |
|---|---|---|---|---|
| 1 | Split picker to its own Page-1 route · `_upload-client.tsx` becomes watches-only until migrated | `src/app/nex-native/manage/listings/new/page.tsx` + `_picker-only-client.tsx` | 0 | Scope-only |
| 2 | Draft Zod leaf schema for ONE safe B1 leaf (e.g. `books.books.fiction`) · author `src/lib/nex-native/catalogue/leaf-schemas/books.books.fiction.ts` | 1 | 0 | Scope-only |
| 3 | Author doctrine for Option A (or founder's choice) · formally seal the table shape | 1 doctrine doc | 0 | **Founder seal of chosen shape** |
| 4 | Migration for `nex_product_listing` + `nex_category_request` (if Request path upgraded) | 0 code | 2 SQL files · staged review | **Founder migration auth** |
| 5 | Server actions: `createProductListingAction` + leaf-dispatched validation | 2 action files | 0 | Scope-only |
| 6 | Generic FormRenderer component | 1 component | 0 | Scope-only |
| 7 | Page-2 dynamic route `/manage/listings/{leaf_id}/new` · uses FormRenderer | 1 route | 0 | Scope-only |
| 8 | Enable `books.books.fiction` · flip `enabled: true` in `departments.ts` leaf config | 1 edit | 0 | **Founder leaf-enable gate** |
| 9 | Verification: E2E test seller journey · 101 Watches tests still green · screenshots at 390×844 | 1 Playwright spec | 0 | Scope-only |
| 10 | Repeat steps 2 + 8 + 9 for the next safe B1 leaf | per-leaf authoring | 0 (after step 4) | **Founder enablement per leaf** |

**Expected delta per new leaf after step 10**: 1 Zod schema file + 1 `enabled: true` flip + 1 Playwright test · zero migrations · zero new routes.

### 5E · Watches migration path (preserve seal)

- Watches stays on `nex_watch_listing` **permanently** (§8h sibling-table sealed)
- `_upload-client.tsx` + `createWatchListingAction` + `/manage/watches/new` route · unchanged
- FormRenderer **does not** render Watches · Watches is the sealed exception
- Only new question: does the Page-1 picker send `jewellery_watches.watches` taps to `/manage/watches/new` (current) or `/manage/listings/jewellery_watches.watches/new` (new generic)? **Recommend: current route stays** · zero regression surface.

### 5F · Readiness matrix (owner-ready snapshot)

| Dept | Dossier coverage | Can launch @ Phase 5 end | Blocker count |
|---|---|---|---|
| 📚 Books, Education & Stationery | 35 / 35 researched | ~24 safely enablable | 2 (B1-01, B1-08) |
| 🏢 Office, Business & Industrial | 46 / 46 researched | ~22 safely enablable | 7 (B1-02 to B1-07, B1-12) |
| 🎨 Arts, Crafts & Handmade | 33 / 33 researched | ~10 safely enablable | 4 (B1-02, B1-09, B1-10, B1-11) |
| 🧭 29 Other departments | 0 / ~500 researched | 0 | — |
| **Total** | 114 / 114 B1 researched (Batch 1 scope) | **~56** safely enablable | 13 blockers |

### 5G · Regression tests required for Phase 5

**Catalogue + listing flow**:
- All 101 Watches unit tests continue to pass
- Watches E2E Playwright test continues to pass
- New Playwright spec: Page-1 picker → tap enabled leaf → navigate to Page-2 → fill form → submit → draft saved
- Page-2 for a disabled leaf: 404 or redirect to Request path (never renders form)
- `data-nex-category-dept-enabled` attribute still differentiates 29/1 split
- Hendra impersonation still resolves (`display_name` fallback holds)
- `/manage/watches/new` still returns HTTP 200 unchanged (back-compat during migration)

**5-card Create entry (new)**:
- Playwright: `/nex-native/create` renders 5 cards with correct markers
- Card A tap → navigates to `/live-commerce/welcome` without any new session side-effect
- Card B tap → navigates to `/manage/listings/new` picker
- Card B picker → tap Watches leaf → lands on existing `/manage/watches/new` (back-compat) OR new `/manage/listings/jewellery_watches.watches/new` (per gate 2 decision)
- Card B picker → tap any pending leaf → inline Request form prefilled · submit shows honest "not available just yet" toast (verified in current build)
- Card C/D/E taps → placeholder "coming soon" OR their actual destination routes (depends on gate 7 phasing)
- Back-button from each destination returns to `/nex-native/create` with no card re-selection flicker
- Mobile viewport check at 390×844 (sealed NEX frame)

**Honesty regressions**:
- Toast copy on request submit = exactly `"Your request hasn't been submitted yet. Category requests aren't available just yet."` (verified landed in `_upload-client.tsx:226`)
- No "In the review queue" string anywhere in the catalogue surfaces
- Non-Watches depts still render `In review` chip, never `Live` or `Soon`

**Universal keypad regression**:
- Every text input on any new Create flow uses `NexInput`/`NexTextarea` with `forceKeypadActive={true}`
- No raw `<input type="text">` or `<textarea>` reaches a seller surface

### 5H · Risks and known debt

| Risk | Likelihood | Mitigation |
|---|---|---|
| 1,244 pre-existing typecheck errors remain outside A2-T2 scope · not my responsibility to fix in this plan | Known | Separate TS-cleanup programme (prior task #167 baseline exists) |
| 13 blockers surfaced but unresolved · may block B1 leaves from enabling | High | Blocker log already explicit · founder picks resolutions per leaf |
| Playwright click-through + 390×844 screenshots never delivered this session | Medium | Add to step 9 as mandatory evidence before any Phase 5 commit |
| Request-queue path currently console+toast only · dishonest if sellers expect follow-up | Medium | Toast copy in `_upload-client.tsx` says "in the review queue" which is now untrue · 1-line fix |
| Owner-sealed sibling-table pattern (§8h) conflicts with Option A shared-table recommendation · may force Hybrid (Option C) | Low | Explicit decision gate in step 3 |
| 23 dossiers under umbrella leaves (B1-13) may need splitting post-launch | Low | Accept as technical debt · split rows only if seller feedback demands |

---

## Final gates (founder decisions required before any Phase 5 code lands)

**6 original gates · preserved · state tracked**:

| # | Gate | State |
|---|---|---|
| 1 | 🚦 **Approve Option A, B, or C** for the listing table shape (§5C) | Open |
| 2 | 🚦 **Approve Page-1 route rename** `/manage/listings/new` (or keep `/manage/watches/new` as the picker and add `/manage/listings/{leaf_id}/new` for Page 2) | Open — now intersects with gate 7 since the 5-card entry sits above |
| 3 | 🚦 **Approve the shortlist of leaves** for first-launch enablement (recommend starting with 1 leaf · `books.books.fiction` · to prove the pattern) | Open |
| 4 | 🚦 **Resolve or defer each of the 13 blockers** per leaf-launch plan | Open |
| 5 | 🚦 **Approve the Request-queue upgrade** (Supabase table) OR formally accept the console+toast state | ✅ **Resolved 2026-10-28** · founder sealed Option 1 revert (console+toast only) + authorised honest toast copy fix (landed) |
| 6 | 🚦 **Approve Playwright + screenshot evidence requirement** before any Phase 5 commit | Open |

**2 new gates from the 5-card Create revision**:

| # | Gate | State |
|---|---|---|
| 7 | 🚦 **Phasing of the 5 cards** · ship card A standalone first (recommended) · OR all five together · OR a different sequence | Open · depends on moderation capacity + policy clarity |
| 8 | 🚦 **Policy sign-off per non-product card** · entertainment-video moderation copy · image moderation + optional sale-intent routing · music external-link-only policy (no hosting, no download, Spotify/YouTube compliance review) | Open · 3 sub-items, each is a separate seller-copy + moderation question |

**No code starts beyond the single authorised toast-copy fix until all remaining open gates have explicit answers.**

### Dependency map · which Create cards depend on which gates

| Card | Depends on gate(s) |
|---|---|
| A · Go Live | None open · card itself is just a link into the sealed flow |
| B · Product Video | 1, 2, 3, 4, 6 (and partially 7) |
| C · Entertainment Video | 7, 8a (moderation copy for user-generated entertainment content) |
| D · Image | 7, 8b (image moderation + sale-intent routing) |
| E · Music | 7, 8c (external-link policy, Spotify/YouTube compliance review) |

**Recommendation**: card A can ship as soon as gate 7 confirms phased approach. Everything else waits on its specific gate list.

---

## What changed by this revision

**One-line code correction (founder-authorised)**:
- `_upload-client.tsx:226` toast copy — now says `"Your request hasn't been submitted yet. Category requests aren't available just yet."` · removes the dishonest "in the review queue" claim · everything else in the file is identical

**Documentation added (this file)**:
- §2.5 · 5-card Create entry page design + route audit
- §5G expanded · 5-card regression tests
- Gates 7 + 8 added · phasing + per-card policy

**Nothing else touched**:
- Zero migrations · zero commits · zero pushes · zero deployment
- Zero sealed invariants modified (keypad rule · Watches §8h · payment doctrine · design tokens · chat master layout)
- Zero founder blockers silently resolved
- Research register + 114 dossiers unchanged
- Current category picker + its subcategory wire remain as-shipped
- `_category-request-action.ts` remains deleted (per the Option 1 revert)
- `departments.ts` interim module unchanged
- Hendra impersonation fix unchanged
- All 29 non-Watches depts remain `enabled: false`

The deliverable is this revised plan. Awaiting founder decisions at the **8 gates** above (6 preserved · 2 new · 1 already resolved).
