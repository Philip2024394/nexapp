# NEX Product System · Implementation Contract

> **DRAFT · FOR OWNER REVIEW · NOT AUTHORISED FOR IMPLEMENTATION**
>
> This contract converts the owner's 2026-10-30 direction, provided
> after the Product-Creation/Live-Selling/Shop-Themes Read-Only
> Architecture Audit of the same day, into an actionable, review-ready
> implementation plan for the complete 30-department product system,
> the unified Create Product entry, the Live Product Library, and the
> Shop-Theme reconciliation. It authorises nothing. Every migration
> shape, server-action signature, route, UI component and test listed
> here requires separate explicit owner authorisation before any code
> is written. No DB mutations, migrations, commits, pushes, or
> deployments were performed in the production of this contract.

**Author:** Master AI Engineer (Claude Opus 4.7), on behalf of
Philip O'Farrell (owner).
**Date:** 2026-10-30.
**Source audit:** section-by-section findings produced earlier the
same day; agent reports preserved in the conversation record.
**Companion doctrines (binding, unchanged by this contract):**
- `docs/doctrine/nex-music-directory-architecture-draft-2026-10-30.md`
  (owner-accepted architectural direction · includes the Portrait-First
  Screen and Media Constitution + the Active-Slot Rotation Rule)
- `docs/doctrine/nex-music-directory-phase-1-build-plan-draft-2026-10-30.md`
  (unauthorised implementation gate example that this contract parallels
  in structure)
- `docs/doctrine/nex-music-upload-contract-DRAFT-2026-10-29.md`
- Sealed R9 Live-eligibility contract (2026-10-27)
- Sealed Community Notice doctrine (2026-10-23)
- Sealed "NEX never handles payments" rule

---

## 1 · Status and purpose

### 1.1 Status

This contract is a **draft implementation plan**. It records:

- The owner-decided product direction from 2026-10-30 (§2).
- The target shared product architecture (§A).
- A per-department implementation register for all 30 departments (§B).
- A design for the unified Create Product journey (§C).
- A specification for how a single canonical product record populates
  every Shop Theme layout (§D).
- A specification for the Live Product Library journey (§E).
- The Watches-to-canonical-record reconciliation (§F).
- Migration + DB dependencies and their verification posture (§G).
- Security, ownership, media, stock, and price consistency
  requirements (§H).
- A phased, batched implementation sequence that delivers all 30
  departments without rebuilding existing work (§I).
- Acceptance criteria and tests per department and for the end-to-end
  Create → Shop → Live → Viewer journey (§J).
- Remaining owner decisions genuinely requiring input (§K).
- Preservation guardrails and non-destructive boundaries (§L).

It is not a build spec. Nothing in it is approved to code. Every
section requires conversion into a per-phase build plan with
separate explicit owner authorisation.

### 1.2 Purpose

Deliver on the sealed owner direction (2026-10-30): one shared product
creation and upload system, one canonical product record, one unified
Create Product entry, 30 functional category-specific upload pages,
one Live Product Library per owner, and Shop Themes that control
presentation only. Finish and connect the existing systems rather than
rebuild them.

### 1.3 Scope boundaries

**In scope** — the complete product-creation-to-live-sale journey:

- A single Create Product entry at `/nex-native/create` and its
  category-picker flow.
- 30 functional category-specific upload surfaces, each writing to
  the canonical `nex_product` substrate + per-category validated spec.
- Shop Theme rendering of saved products across all 11 sealed cover
  layouts (`src/app/nex-native/cover/layout-ids.ts`).
- Live Product Library discovery, business selection, live-only
  eligibility filter, featured-product selection and switching, viewer
  display via `ProductOverlayCard`.
- Watches reconciliation to the canonical substrate.
- Migration dependencies (219 + others identified in §G).
- Security, ownership, media, stock, price consistency.
- Testing coverage per department and end-to-end.

**Out of scope** — deferred to separate contracts:

- `nex_product.primary_video_id` or video-as-first-class-product-field.
  Treated here as a separate media capability (owner-decided).
- Live product deep-link honouring (`?product=` hint). Owner-decided
  optional enhancement.
- New payment, checkout, wallet, escrow, tipping, or commission
  mechanics. Doctrine-forbidden. Sealed "NEX never handles payments".
- Replacement of the existing `nex_account.chat_theme` + per-business
  override architecture with a new theme system. Owner-decided retain.
- Any new `nex_shop` abstraction separate from `nex_business`.
- Introduction of a competing product table or a separate Live product
  upload path. Doctrine-forbidden.
- Phases 2+ of the Music Directory doctrine. Separate work.
- Production application of any migration. Separate CLAUDE.md §5 gate.

### 1.4 Owner-resolved decision record

| Date | Decision | Scope | Signatory |
|---|---|---|---|
| 2026-10-30 | Accept product-system direction + resolve §K 15/15 | The 10 owner-direction requirements in §2 + the 15 owner resolutions in §K + three protected invariants in §K.2. | Philip O'Farrell (owner) |

**Scope of resolution (strict):**

- Resolution applies to §K items 1–15 and the delivery instruction
  in §K.1 and the three protected invariants in §K.2.
- Resolution **does not** authorise code implementation. Phase 1 and
  every later phase remain gated by separate explicit owner
  authorisation.
- Resolution **does not** verify production migration application
  status. All claims in this contract about applied-vs-authored state
  remain unverified until the Phase 0 §8-verified read-only checks
  run.
- Resolution **does not** retire or amend the Music Directory
  doctrine, the Portrait-First Constitution, the Active-Slot Rotation
  Rule, R9 Live-eligibility, Community Notice, the chat master
  layout rule, or the sealed design-token rule. All sealed doctrine
  remains intact.
- No code, migration, DB mutation, commit, push, or deploy was
  performed to produce this resolution record.

**Architectural resolution is not implementation authorisation.
Phase 1 requires a separate explicit owner authorisation.**

---

## 2 · Owner direction (sealed 2026-10-30)

Reproduced verbatim in substance from the owner message, numbered for
traceability:

1. **All 30 departments** in the existing NEX category taxonomy must
   have functional category-specific product upload pages. Work may be
   delivered in controlled batches, but all 30 are the required
   outcome. Request-category stubs are not acceptable as the final
   state.
2. **One shared Create Product entry point.** Users select a category
   and receive the correct category-specific form.
3. **One canonical product record.** The same saved product populates
   the Shop Theme cover page and appears in the Live Product Library.
4. **Shop Themes control visual presentation only.** No separate
   product records or duplicate upload systems.
5. **Live Product Library.** When the owner opens Go Live, NEX shows
   their existing products; the owner selects one and it is displayed
   to viewers.
6. **Live-eligibility filter.** Only products with `status = 'live'`
   are selectable for public Live display. Draft products must never
   leak to the viewer screen.
7. **Multi-business selection.** If the owner has multiple businesses,
   they choose the Shop before selecting its products.
8. **Mid-stream featured-product switching** using the existing
   featured-product mechanism (migration 219 shape).
9. **Watches reconciliation.** Watches products must appear
   consistently in Shop and Live. Investigate whether a Watches upload
   creates a corresponding `nex_product` row and ensure consistency.
10. **Preserve payment doctrine.** NEX does not process seller
    payments or take commissions.

**Additional owner-locked decisions** from the same message:

- Product storage: one canonical `nex_product` record, category-specific
  specifications using validated schemas; retain specialised adjunct
  tables where genuinely necessary.
- Product video: separate media capability, not a blocker.
- Live product deep link: optional enhancement, not a blocker.
- Shop Themes: existing account-theme + business-override architecture
  retained unless investigation proves a business-theme table is
  required.

---

## 3 · Non-goals, preserved doctrine, and preservation guardrails

### 3.1 Non-goals

- Do not delete or replace existing upload forms (Watches, services,
  menu, accommodation, generic manage, first-product onboarding),
  Shop Theme components, Live product mechanisms, or category work
  without a verified migration plan.
- Do not create a competing product table.
- Do not create a separate Live product-upload system.
- Do not casually renumber migrations.
- Do not assume production migration application status.
- Do not propose any payment, escrow, wallet, or commission.
- Do not propose any new theme-storage system without first proving
  the existing one is insufficient.

### 3.2 Sealed doctrine preserved by this contract

- Portrait-First Screen and Media Constitution (owner-decided 2026-10-30
  on Music, applicable to product-media rendering by extension where
  surfaces are mobile).
- Sealed R9 Live-eligibility contract (2026-10-27): only Shop-tier
  accounts may broadcast; applies verbatim.
- Sealed music upload contract (`nex-music-upload-contract-DRAFT-2026-10-29`):
  unchanged by this contract; media-handling patterns referenced only
  as precedent.
- Sealed design-token rule (2026-10-17): one font stack + one shared
  NEX in-header-badge size + mobile-first text sizes across new product
  surfaces.
- Sealed chat master layout rule (2026-10-14): irrelevant here, listed
  only for completeness of preservation.

---

## A · Shared product architecture

### A.1 Canonical substrate

The single authoritative product row is `nex_product` (migration
`003_nex_product.sql`), already carrying through migrations 015, 016,
017, 023, 030, 064, 075, 088, 107, 122 the fields:

- `id uuid PK`
- `business_id uuid NOT NULL REFERENCES nex_business(id) ON DELETE RESTRICT`
- `name text NOT NULL`
- `description text`
- `price_pence bigint`
- `currency text ~ '^[A-Z]{3}$'`
- `status text CHECK IN ('draft','live','archived') NOT NULL DEFAULT 'draft'`
- `stock_status text` (`in_stock | low_stock | sold_out | made_to_order`)
- `image_url text`
- `gallery_urls text[]` (≤10)
- `tags text[]`
- `sku text`
- `dispatch_sample_times` fields
- `spec jsonb NOT NULL DEFAULT '{}'`
- `size_chart` fields
- `created_at`, `updated_at`

**No category reference column** exists on `nex_product` today. Adding
one — e.g. `department_id text NOT NULL` and `category_id text NOT NULL`
(or `department text`/`category_slug text` referencing the taxonomy
in `src/lib/nex-native/catalogue/departments.ts`) — is **a required
Phase-0 schema addition** proposed by this contract.

**Rationale.** Without a category reference on `nex_product`, every
category-specific feature (per-category badges, per-category Shop
rendering, per-category filtering) must either join against a sibling
table or guess from `name/description`. The sealed Watches migration
suite (227–232) sidesteps this by using a sibling `nex_watch_listing`.
Scaling that pattern to 30 departments requires 30 sibling tables and
30 server-action families. Owner has instead approved **category-specific
specs using validated schemas** on the canonical row.

### A.2 Category-specific specifications: `spec jsonb` + Zod validator

**All 30 departments use the single `nex_product.spec jsonb` column**
to carry category-specific specifications. Each category registers a
Zod schema (TypeScript) that validates the shape of its spec payload.

```
src/lib/nex-native/catalogue/specs/
  electronics-technology.ts          · ElectronicsTechnologyBaseSpec
    mobile-phones.ts                 · MobilePhonesSpec (manufacturer, model, battery, ...)
    computers-laptops.ts             · ComputersLaptopsSpec (cpu, ram, storage, ...)
    ...
  home-furniture-living.ts
  kitchen-dining.ts
  fashion-clothing.ts
  jewellery-watches.ts               · includes WatchesSpec (brand, material, movement, ...)
                                       to be reconciled with current nex_watch_listing
  beauty-personal-care.ts
  ...
  everything-else.ts                 · fallback free-form spec
```

Spec examples (abbreviated):

```ts
// src/lib/nex-native/catalogue/specs/electronics-technology/mobile-phones.ts
export const MobilePhonesSpecSchema = z.object({
  manufacturer: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  storage_gb: z.number().int().positive().optional(),
  battery_mah: z.number().int().positive().optional(),
  colour: z.string().max(40).optional(),
  condition: z.enum(["new","used","refurbished"]).default("new"),
  unlocked: z.boolean().optional(),
  warranty_months: z.number().int().nonnegative().optional(),
});
```

```ts
// src/lib/nex-native/catalogue/specs/fashion-clothing/womens.ts
export const WomensClothingSpecSchema = z.object({
  size: z.string().min(1).max(10),           // "XS" ... "XXL" or free-text
  colour: z.string().min(1).max(40),
  material: z.string().min(1).max(80),
  care_instructions: z.string().max(400).optional(),
  season: z.enum(["spring","summer","autumn","winter","all-year"]).optional(),
  cut: z.string().max(40).optional(),
});
```

The server actions validate `spec` against the Zod schema matched by
the `(department_id, category_id)` pair before writing to `nex_product`.

### A.3 When to retain a sibling table

Owner-locked: **retain specialised adjunct tables where genuinely
necessary.** The contract applies this test:

- **Retain a sibling table** when the category has structural
  requirements that cannot be modelled as a flat jsonb payload. Known
  cases:
  - **Services** (`nex_service`, mig 112) — service listings carry
    multi-time-slot availability + geographic coverage; retain.
  - **Accommodation** (`nex_accommodation_unit`, mig 213) — room
    inventory + nightly rates + availability calendar; retain.
  - **Food/Menu** (`nex_menu_section`, `nex_menu_item`, mig 066) —
    menu structure + section grouping; retain.
  - **Vehicle listings** (sub-category of automotive_motorcycles_transport,
    not currently a table) — if introduced, likely needs its own
    adjunct for VIN, title transfer, plates. Phase-2 decision.
- **Do not retain a sibling table** for categories that only need
  attribute lists. Watches (currently `nex_watch_listing`) falls here
  — see §F for the reconciliation plan.

### A.4 The canonical write path

Every product-creating action, regardless of category, flows through
`src/lib/nex-native/product-service.ts` as a single function:

```ts
createProduct({
  businessId: string,
  name: string,
  description: string | null,
  price_pence: number | null,
  currency: string,
  departmentId: DepartmentId,
  categoryId: string,
  spec: unknown,                // validated against the (dept,cat) Zod schema
  imageUrl: string | null,
  galleryUrls: string[],
  stockStatus: NexProductStockStatus,
  tags: string[],
  sku: string | null,
  // status is always 'draft' on first create
}): Promise<NexProductRow>
```

Category-specific sibling-table writes (Services, Accommodation,
Food/Menu) call `createProduct` **first** to obtain the canonical
`nex_product.id`, then upsert their adjunct row keyed by `product_id`.
This guarantees every sellable item has a canonical row and appears
in `listProductsByBusiness`.

### A.5 Reads and single-source-of-truth guarantees

Every read goes through `productService` or `nex_product` directly.

- Shop reads: `listProductsByBusiness(business.id, "live")` (status
  filter mandatory).
- Live Library reads: `listProductsByBusiness(business.id, "live")`
  (status filter mandatory, see §E and §H).
- Owner management reads: `listProductsByBusiness(business.id)` (all
  statuses).
- Public product detail: `getProductById(id)` with owner-scoped RLS
  for drafts.

Any surface that bypasses `productService` or `nex_product` is a
contract violation and must be refactored.

---

## B · 30-department implementation register

For every department listed in `src/lib/nex-native/catalogue/departments.ts`,
record the current state, the required form fields, the Zod spec
schema name, and the required-vs-deferred posture. **Watches** is the
one department currently at `enabled: true`; all others at
`enabled: false`.

**Register columns:**

- **Dept id** — the sealed `DepartmentId` string.
- **Sub-categories** — count in the sealed taxonomy.
- **Current state** — audit finding: not-implemented / sibling-table /
  partial.
- **Core fields** — the fields the category-specific form MUST collect
  beyond the canonical `name/description/price_pence/currency/images`.
- **Zod spec name** — the module name that will host the validator.
- **Sibling table?** — yes/no per §A.3 test.

| # | Dept id | Sub-categories | Current state | Core category-specific fields | Zod spec module | Sibling table? |
|---|---|---|---|---|---|---|
| 1 | `electronics_technology` | 11 | Not implemented | manufacturer, model, condition, warranty_months, serial_number (optional), technical_specs | `electronics-technology/*` (per-sub-category) | No |
| 2 | `home_furniture_living` | 10 | Not implemented | material, dimensions_cm (lxwxh), weight_kg, assembly_required, room_type | `home-furniture-living/*` | No |
| 3 | `kitchen_dining` | 8 | Not implemented | material, capacity_litres (if applicable), dishwasher_safe, induction_compatible | `kitchen-dining/*` | No |
| 4 | `fashion_clothing` | 8 | Not implemented | size, colour, material, care_instructions, season, cut, fit | `fashion-clothing/*` | No |
| 5 | `jewellery_watches` | 5 | **Partial** — Watches has `nex_watch_listing` + 7 tests + 6 migrations (227-232) · migration application status unverified | brand, material, movement, water_resistance, box_papers, condition, serial_number | `jewellery-watches/*` (watches, fine_jewellery, fashion_jewellery, …) | No (reconcile per §F) |
| 6 | `beauty_personal_care` | 8 | Not implemented | brand, volume_ml, ingredients, skin_type, cruelty_free, shade | `beauty-personal-care/*` | No |
| 7 | `health_wellness_medical` | 8 | Not implemented | brand, intended_use, certification, prescription_required, expiry_date | `health-wellness-medical/*` | No |
| 8 | `baby_nursery_parenting` | 7 | Not implemented | age_range, safety_certification, material, size, care_instructions | `baby-nursery-parenting/*` | No |
| 9 | `toys_games_hobbies` | 6 | Not implemented | age_range, brand, player_count (for games), battery_required, choking_hazard | `toys-games-hobbies/*` | No |
| 10 | `sports_fitness_outdoors` | 8 | Not implemented | sport, weight_kg (for equipment), size, material, intended_use | `sports-fitness-outdoors/*` | No |
| 11 | `garden_outdoor_agriculture` | 8 | Not implemented | plant_type (if plant), hardiness_zone, pot_size, soil_type, fuel_type (for machinery) | `garden-outdoor-agriculture/*` | No |
| 12 | `tools_diy_construction` | 17 | Not implemented | tool_type, power_source, voltage, battery_included, size, material | `tools-diy-construction/*` | No |
| 13 | `automotive_motorcycles_transport` | 10 | Not implemented | compatible_make, compatible_model, year_range, condition; **vehicle_listings sub-category** requires VIN + mileage + plates + registration-status, flagged for sibling-table review | `automotive-motorcycles-transport/*` | Vehicle_listings may need adjunct (defer to Phase 2 B-flag) |
| 14 | `food_grocery_beverages` | 10 | Not implemented | expiry_date, allergens, dietary (vegan/halal/kosher/organic), weight_g, origin_country | `food-grocery-beverages/*` | No |
| 15 | `pet_supplies_animals` | 8 | Not implemented | species, breed_specific, weight_kg, age_range, dietary_compatibility | `pet-supplies-animals/*` | No |
| 16 | `books_education_stationery` | 6 | Not implemented | isbn (books), author, publisher, format (hardback/paperback), year, subject | `books-education-stationery/*` | No |
| 17 | `office_business_industrial` | 4+ | Not implemented | brand, model, capacity, voltage, industrial_use_only | `office-business-industrial/*` | No |
| 18 | `arts_crafts_handmade` | TBD | Not implemented | medium, handmade, dimensions_cm, framed, limited_edition_number | `arts-crafts-handmade/*` | No |
| 19 | `music_film_entertainment` | TBD | Not implemented | format (vinyl/cd/stream/physical), genre, artist, year, limited_edition | `music-film-entertainment/*` | No |
| 20 | `travel_luggage_outdoor` | TBD | Not implemented | capacity_litres, weight_kg, material, wheel_type, carry_on_compliant | `travel-luggage-outdoor/*` | No |
| 21 | `digital_products_software` | TBD | Not implemented | licence_type, platform (ios/android/web/desktop), delivery_method, download_url (post-purchase handled by owner, not NEX) | `digital-products-software/*` | No |
| 22 | `accommodation_property` | TBD | **Sibling** — `nex_accommodation_unit` (mig 213) + manage surfaces | property_type, bedrooms, bathrooms, amenities, availability_window, nightly_rate | `accommodation-property/*` | **Yes** (`nex_accommodation_unit`) |
| 23 | `food_delivery_restaurants` | TBD | **Sibling** — `nex_menu_section`/`nex_menu_item` (mig 066) + manage surfaces | menu_section, dietary_tags, portion_size, allergens, availability_window | `food-delivery-restaurants/*` | **Yes** (`nex_menu_item`) |
| 24 | `services_marketplace` | TBD | **Sibling** — `nex_service` (mig 112) + manage surfaces | service_type, duration_minutes, service_area, licence_number, portfolio_url | `services-marketplace/*` | **Yes** (`nex_service`) |
| 25 | `experiences_activities_tickets` | TBD | Not implemented | event_type, duration_hours, max_participants, location, age_restriction, instant_booking | `experiences-activities-tickets/*` | Possibly adjunct for ticket inventory; defer to Phase 2 decision |
| 26 | `second_hand_refurbished` | TBD | Not implemented | original_category, condition, refurb_certified, warranty_months_post_refurb | `second-hand-refurbished/*` | No (overlay on parent category spec) |
| 27 | `luxury_premium_collectibles` | TBD | Not implemented | authentication, provenance_notes, limited_edition_number, serial_number, rarity | `luxury-premium-collectibles/*` | No |
| 28 | `gifts_celebrations_seasonal` | TBD | Not implemented | occasion, season, gift_wrap_included, personalisation_available | `gifts-celebrations-seasonal/*` | No |
| 29 | `renewable_energy_utilities` | TBD | Not implemented | energy_type (solar/wind/battery), capacity_kwh, installation_included, warranty_years | `renewable-energy-utilities/*` | No |
| 30 | `everything_else` | 1 (fallback) | Not implemented | free-form `other_specs: Record<string,string>` | `everything-else.ts` | No |

**Note on sub-category counts**: for departments 18–21 and 25–29 the
exact sub-category count is read from the sealed taxonomy file. The
contract does not restate them here to keep the register compact;
the implementation batch for each department MUST enumerate its own
sub-categories from the sealed source.

**TBD columns** mean the contract defers to the sealed taxonomy as the
authoritative source; implementers must read `departments.ts` at build
time and NOT rebuild the taxonomy from the register.

### B.1 Required-per-department deliverables

For every department, the implementation must produce:

1. **Zod spec module** at `src/lib/nex-native/catalogue/specs/<dept>/<cat>.ts`
   per sub-category OR a single `<dept>.ts` with discriminated-union
   per sub-category.
2. **Category-specific form component** at
   `src/components/nex-native/product-create/<dept>/<cat>-form.tsx`
   OR a shared form primitive that reads the Zod schema and renders
   automatically (preferred — reduces per-dept UI work).
3. **Server action** reuse of a single `createProductAction` and
   `updateProductSpecAction` that dispatch on `(departmentId, categoryId)`.
4. **Rendering** — the sealed `CoverProductCard` already renders
   `name/image/price/stock`. Per-department spec rendering on the
   product detail page is a separate concern per §D.
5. **Tests** — unit tests on the Zod schema (valid + invalid payloads)
   plus one integration test that exercises create → read → render.
6. **Browse surface** — a `/nex-native/catalogue/<dept>/` route that
   lists live products in that department (parallel to the sealed
   `/nex-native/watches` surface).

**Required state for a department to be marked done:**

- Zod schema shipped and tested.
- Shared form renders the schema or dedicated form component shipped.
- Create + edit flow functional end-to-end.
- Live Product Library includes the department's products.
- Shop Theme renders the products via the sealed primitives.
- At least one Playwright E2E spec per department covering create →
  shop-list → shop-detail.

---

## C · Shared Create Product journey

### C.1 Entry point

Modify `/nex-native/create` (sealed owner comment 2026-10-28 "Card A
first"):

- Add a sixth card: **"Product"** · routes to `/nex-native/create/product`.
- Keep the existing five cards (Go Live, Product Video, Entertainment
  Video, Image, Music) · the three disabled stubs (Product Video,
  Entertainment Video, Image) remain disabled per their sealed
  non-implementation status and are a separate decision.

```
/nex-native/create
   ├── Go Live             → /nex-native/live-commerce/welcome
   ├── Product (NEW)       → /nex-native/create/product
   ├── Music               → /nex-native/create/upload-music
   ├── Product Video       → disabled
   ├── Entertainment Video → disabled
   └── Image               → disabled
```

### C.2 Business selection (precondition)

Before category selection, the Create Product flow MUST resolve which
business the product belongs to:

- **Zero businesses** → redirect to onboarding (`/nex-native/onboarding`)
  with a clear message. Honest limitation per sealed R9 posture.
- **One business** → proceed with that business; no picker needed.
- **Multiple businesses** → render a business picker. **Chosen business
  id persists per device for 30 days** (owner resolution §K.7) with
  an obvious way to change it. Never silently assume the remembered
  business is the only business the owner can use.

```
/nex-native/create/product
   if businesses.length === 0 → onboarding
   if businesses.length === 1 → ?business=<id> → /create/product/category
   if businesses.length >= 2  → BusinessPicker → /create/product/category?business=<id>
```

### C.3 Category selection

Reuse the sealed component at
`src/app/nex-native/manage/watches/new/_category-picker.tsx` by **lifting
it to a shared location** (`src/components/nex-native/product-create/category-picker.tsx`).
The Watches-direct URL (`/manage/watches/new`) continues to work for
backward compatibility; the public picker lives at
`/create/product/category`.

- Reads sealed `DEPARTMENTS` from
  `src/lib/nex-native/catalogue/departments.ts`.
- Tiles for all 30 departments. Enabled departments route to the
  category-form flow; `enabled: false` departments open the sealed
  "Request category" inline form (toast-only).
- `enabled: true` is the ONLY gate controlling flow. Each department's
  implementation batch must flip `enabled: true` as part of its
  completion.

```
/create/product/category?business=<id>
   DEPARTMENT PICKER (30 tiles)
      selected department (enabled)
         → /create/product/category?business=<id>&dept=<deptId>
            SUB-CATEGORY PICKER (dept.categories)
               selected sub-category
                  → /create/product/form?business=<id>&dept=<deptId>&cat=<catId>
```

### C.4 Category-specific form

The form is **one component with pluggable fields**:

```
src/components/nex-native/product-create/
   create-product-form.tsx           · one form, consumes a FormConfig
   form-primitives/
      ImagePicker.tsx                · reused across all departments
      PricePicker.tsx                · reused
      StockStatusPicker.tsx          · reused
      TagsPicker.tsx                 · reused
      TurnaroundPicker.tsx           · reused
      SizeChartPicker.tsx            · optional per-department
      SpecFormBuilder.tsx            · reads Zod schema → renders fields
   form-configs/
      <dept>/<cat>.ts                · defines FormConfig per sub-category
```

`SpecFormBuilder` auto-generates input fields from the Zod schema
shape when a dedicated form component is not provided. Each
`FormConfig` can override individual fields with custom inputs (e.g.
Watches brand picker, Fashion colour swatch).

### C.5 Save flow

```
Save Draft
  POST createProductAction({
    business_id, department_id, category_id, name, description,
    price_pence, currency, spec, image_url, gallery_urls,
    stock_status, tags, sku, size_chart,
  })
  → validates spec against Zod schema matched by (dept, cat)
  → inserts nex_product row with status='draft'
  → upserts sibling-table row IF (dept, cat) is in the sibling list
  → returns product_id
  → routes to /manage/products/<product_id>
```

```
Publish (draft → live)
  POST changeProductStatusAction({ product_id, status: 'live' })
  → validates completeness (name, price, at least one image, stock_status)
  → flips status to 'live'
  → cascades to any sibling row (status mirror)
  → revalidates owner's Shop surface + Live Library view
```

### C.6 Backward compatibility

- `/manage/watches/new` continues to work until Phase 2 Watches
  reconciliation completes (see §F). After reconciliation, the
  Watches route redirects to `/create/product/form?dept=jewellery_watches&cat=watches`.
- `/manage` dashboard inline product form (`createManagedProductAction`)
  stays functional for the "generic product" legacy flow until
  **Phase 1 completes AND the first category batch has passed
  acceptance testing** (owner resolution §K.9) · then retired via
  a doctrine-signed migration. Preserve compatibility until the
  replacement is proven. No premature deletion.
- `/onboarding/first-product` stays functional for first-time flow;
  internal implementation switches to the shared `createProductAction`
  but UX remains identical.

### C.7 Edit journey

- `/manage/products/<product_id>` renders the per-department form in
  edit mode (loads the existing spec, pre-fills fields).
- Edit uses the same Zod validation + the same `updateProductSpecAction`
  (and sibling updates where applicable).
- Category change is **not supported** post-creation (sealed per this
  contract). To re-categorise, owner must archive the product and
  create a new one. Rationale: cross-category spec validation is a
  trap.

---

## D · Shop Theme product population

### D.1 Rendering contract

The sealed 11 cover layouts (`src/app/nex-native/cover/layout-ids.ts`)
render products through the sealed shared primitive
`CoverProductCard` (`src/app/nex-native/cover/primitives.tsx:662`).

- The primitive reads `{ name, price_pence, currency, image_url,
  stock_status, section_id, description }` — the fields fixed by the
  canonical row.
- Theme controls visual chrome: card radius, accent hex, wallpaper,
  charm glyph, layout orientation (landscape/round/portrait).
- Theme does NOT control which fields render.

### D.2 Per-department badges (new)

Add a department badge to `CoverProductCard` that reads
`nex_product.department_id` (introduced per §A.1) and renders a short
glyph + label (e.g. ⌚ Watches, 👟 Shoes, 📚 Books). The badge
mapping lives in `src/lib/nex-native/catalogue/badges.ts`.

- Badge style follows the sealed design-token rule 2026-10-17.
- Opt-in per theme: themes that already carry their own iconography
  may suppress the department badge.

### D.3 Category-specific detail page sections

Product detail (`[businessSlug]/[productId]`) renders a per-department
spec block that lists category-relevant fields:

```
<ProductDetailShell>
  <ProductHeader />                       · name · price · images · stock
  <ProductDescription />                  · from nex_product.description
  <ProductSpecBlock
    departmentId={product.department_id}
    categoryId={product.category_id}
    spec={product.spec}
  />                                      · dispatches on dept/cat → spec presenter
  <ProductActions />                      · Order Now / Message Seller (sealed intent-only)
</ProductDetailShell>
```

`ProductSpecBlock` dispatches to per-category spec-presenter components
registered alongside the Zod schemas:

```
src/lib/nex-native/catalogue/specs/<dept>/<cat>.ts
export const <Cat>SpecSchema = z.object({ ... });
export function <Cat>SpecPresenter({ spec }: { spec: unknown }) { ... }
```

### D.4 Draft / live / archived behaviour (unchanged)

Preserved from sealed audit:

- Draft: owner-only read via `nex_product_owner_read` RLS; invisible
  to public and to Live viewers.
- Live: public read via `nex_product_public_read_live` RLS; visible
  to Shop and to Live Library.
- Archived: owner-only read; retained for audit + order history.

### D.5 Migration-100 CHECK drift (not blocking Phase 1)

The audit flagged that `cover_layout_id` CHECK in migration 100 lists
10 older layout ids while the sealed `layout-ids.ts` lists 11 current
ones. This contract notes the drift and lists it as a Phase-0
reconciliation task (§I.0 and §G.5). Phase 1 of this contract does
NOT depend on the resolution — Phase 1 reads existing products and
renders in existing themes without changing the layout list.

### D.6 Dormant `nex_business_theme` (migration 195)

The audit flagged a dormant table with zero `src/` consumers. Owner
has locked: "retain existing account theme and business override
architecture unless investigation proves a business-theme table is
required." The implementation action here is:

- **Owner-resolved 2026-10-30 (§K.3): retire as active theme system.**
  Preserve existing data and migration history. Do NOT destructively
  drop tables or records without a separate verified data-safety
  reason. Use sealed account-theme + business-override architecture.
- **Phase 1 does NOT read or write `nex_business_theme`.** No shim is
  required. The dormant table is left in place (data + schema
  preserved).

---

## E · Live Product Library journey

### E.1 Entry point

When an owner taps Go Live (`/nex-native/live-commerce/welcome`) or
otherwise initiates a broadcast, the flow is:

```
Go Live tap
  ↓
Sealed R9 eligibility check (hasShopAccess)
  ↓ pass
Business selection (if multi-business)
  ↓
Live Product Library  ← this contract adds this surface
  ↓ owner picks product
  ↓
Session start (enter-broadcast-room)
```

### E.2 Live Product Library surface

New route: `/nex-native/live-commerce/library`.

- Mounted inside the Go Live flow, before the broadcast engine starts.
- Reads `productService.listProductsByBusiness(businessId, "live")`.
- **Mandatory `"live"` status filter** — closes the audit's draft-leak
  gap (§H.1).
- Renders a scrollable grid of `CoverProductCard`-equivalent tiles.
- Includes per-department filter chips if the owner has products in
  multiple departments.
- Includes a search bar (name + spec text + tag). Phase 1 uses
  `name ILIKE` + `tags && ARRAY[...]`; faceted search is Phase 2.
- Includes an "Add new product" link that routes to
  `/create/product?business=<id>` and returns the owner to the Library
  after save.

### E.3 Business selection (precondition)

Mirror §C.2 — owner picks the business before the Library opens.
**30-day device-level persistence per owner resolution §K.7** · with
an obvious change-business affordance always visible in the picker
and library header.

```
/nex-native/live-commerce/library
   if businesses.length === 0 → onboarding
   if businesses.length === 1 → ?business=<id>
   if businesses.length >= 2  → BusinessPicker (honour 30-day remembered choice if present)
                                → ?business=<id>
```

The current audit found Go Live hard-codes `businesses[0]`. Phase 1
replaces this with the explicit picker on the business-selection
surface and plumbs `business_id` through the broadcaster shell.

### E.4 Session start

- Owner picks a product → routes to
  `/nex-native/live-commerce/enter-broadcast-room?business=<id>&product=<id>`.
- The broadcaster shell starts the session with `business_id` AND
  pre-selects the chosen product as the initial featured product.
- `startLiveSessionAction` writes to `nex_live_session` with
  `business_id` populated.
- `setLiveFeaturedProductAction` fires immediately after with the
  pre-selected `product_id`.

### E.5 Mid-stream featured-product switching

**Preserve existing mechanism** at
`src/app/nex-native/live-commerce/enter-broadcast-room/_actions.ts:238`
`setLiveFeaturedProductAction`. Confirmed sealed sequence:

- Resolves session + validates UUIDs.
- Fetches product by id and verifies ownership
  (`product.business_id ∈ ownedBusinessIds`).
- Calls `setFeaturedProduct` service which closes any active pin and
  inserts a new row in `nex_live_featured_product`.
- **Adds a server-side `status === 'live'` check** to close the draft
  leak (§H.1).

Broadcaster UI changes:

- The sealed inline bottom-sheet picker at `_go-live-client.tsx:2143`
  is preserved as the mid-stream picker.
- The picker's catalog read is swapped from
  `listProductsByBusiness(business.id)` to
  `listProductsByBusiness(business.id, "live")` so drafts no longer
  appear.
- Add a visible "Clear featured product" affordance (verified absent
  by audit §D.2) on the broadcaster rail.
- Add explicit business-id passthrough so the picker always matches
  the session's business.

### E.6 Viewer display

**Preserve existing `ProductOverlayCard`** at
`src/components/nex-native/live-commerce/ProductOverlayCard.tsx`.
No changes to its contract.

- Props shape unchanged.
- "Order Now" tap continues to route to
  `/nex-native/chat/peer/{broadcasterAccountId}?pending_product={id}&live_session_id={id}`
  (sealed intent-only pattern · no payment).
- Portrait-first viewport remains the design axis per sealed
  Portrait-First Constitution.

### E.7 Deep-link honouring (optional enhancement · deferred)

Owner-decided: deep link `?product=<id>` on viewer URL is an optional
enhancement, not a blocker. The audit confirmed the hint is currently
discarded (`void incomingProductHint;`). Phase 1 does NOT wire this.

### E.8 Live session ending

Preserved existing sequence: `endLiveSessionAction` closes any active
`nex_live_featured_product` row (sets `ended_featuring_at`), flips
session status to `'ended'`, closes Realtime channels, viewer card
clears via presence-sync.

---

## F · Watches reconciliation to canonical product

### F.1 Current state (confirmed by audit)

- Watches ships with `nex_watch_listing` + entitlement + search_tsv +
  deletion_audit + rate_limit (migrations 227-232).
- `createWatchListingAction` writes to `nex_watch_listing` only.
- Watches products do **NOT** appear in `listProductsByBusiness`
  (unverified absence confirmed by code shape).
- Watches Shop surface is `/nex-native/watches/page.tsx` + detail,
  rendered independently of the sealed cover-primitive stack.
- Watches is the only `enabled: true` department.

### F.2 Reconciliation design

**Dual-write pattern** during transition, then **merge** once stable.

Phase F-1 (dual-write):

- `createWatchListingAction` creates a `nex_product` row first (with
  `department_id='jewellery_watches'`, `category_id='watches'`, Zod-
  validated spec), then upserts the `nex_watch_listing` row keyed by
  `product_id`.
- `nex_watch_listing` gains a `product_id uuid NOT NULL REFERENCES
  nex_product(id) ON DELETE CASCADE` column. New migration proposed
  as **next-free number at drafting time** (per sealed §11.4 of the
  Music Directory doctrine · do NOT reuse any sealed number).
- Updates to Watches mirror into both rows.
- Reads: Shop reads `nex_product` + joins `nex_watch_listing` via
  `product_id`. Live Library reads `nex_product` only (status gate).

Phase F-2 (merge):

- After dual-write has been stable (minimum 30 days + verification
  of row counts), decide whether to retire `nex_watch_listing`
  entirely in favour of `nex_product.spec` or keep it for the search_tsv
  + rate_limit infrastructure that would need rebuilding on
  `nex_product`.
- Owner decision at Phase F-2: retire or retain. Default
  recommendation: retain `nex_watch_listing` for the sealed
  entitlement + search_tsv infrastructure; use the dual-write
  consistency as the source of truth for Shop/Live reads.

### F.3 Risks

- Divergence between `nex_product` and `nex_watch_listing` if a
  dual-write partially fails. Mitigation: wrap both writes in a
  transaction and fail-closed.
- Entitlement + rate-limit paths currently bind to
  `nex_watch_listing.id`. Rebinding to `nex_product.id` is a
  non-trivial code change. Defer the rebind to Phase F-2.
- Watches browse surface `/nex-native/watches/*` reads
  `nex_watch_listing` directly. During Phase F-1, this remains
  functional. After F-2, surfaces route through `nex_product`.

### F.4 Backward compatibility

- `/manage/watches/new` continues to function (writes via the
  dual-write path).
- `/nex-native/watches/*` continues to render.
- No existing Watches data is destroyed; the migration is additive.

---

## G · Migration and DB dependencies

### G.1 Migration numbering posture

- No sealed migration file is renamed or renumbered by this contract.
- All new migrations proposed below take **the next-free number at
  drafting time** (per the sealed resolution recorded in §11.4 of
  the Music Directory doctrine · 2026-10-30).

### G.2 Required Phase-0 migrations (not drafted · not applied)

| Proposal | Purpose |
|---|---|
| `nex_product_category` | ALTER `nex_product` ADD `department_id text NOT NULL` + `category_id text NOT NULL` + CHECK against the sealed taxonomy. Backfill plan: existing rows get `department_id='everything_else'` and `category_id='other'` until owner reclassifies. |
| `nex_watch_listing_product_id` | ALTER `nex_watch_listing` ADD `product_id uuid NOT NULL REFERENCES nex_product(id) ON DELETE CASCADE` + UNIQUE index. Backfill plan: for each existing watch listing, insert a `nex_product` row and link. |

### G.3 Migration-100 CHECK drift · owner-resolved 2026-10-30

Audit flagged that `nex_business.cover_layout_id` CHECK list in
migration 100 (10 older ids) differs from the sealed
`src/app/nex-native/cover/layout-ids.ts` (11 current ids).

**Owner resolution 2026-10-30 (§K.4): resolve through a new
forward-only migration after verifying the actual database state
and all existing layout IDs. Never edit or renumber the sealed
migration 100. The new constraint must support the sealed 11 layout
IDs. Do not apply the migration without separate authorisation.**

- Phase 0 §8-verified read-only check reports which
  `cover_layout_id` values are actually present on `nex_business`
  rows in the sealed production project `ijvqdvsvwtwxzcqmoqit`.
- New migration takes next-free number at drafting time (per sealed
  §11.4 of the Music Directory doctrine · 2026-10-30).
- Non-destructive, additive: drops the old CHECK and adds a new
  CHECK supporting all 11 sealed layout IDs.
- Apply window is a separate CLAUDE.md §5 gate.

### G.4 Migration 219 (sealed Live) · verification posture

- Migration file `219_nex_live_session_and_featured_product.sql` is on
  disk with header "AUTHORED · NOT YET APPLIED to any database."
- **Production application status is unverified** by this contract.
- Phase 0 includes a §8-verified read-only check against
  `ijvqdvsvwtwxzcqmoqit` to confirm whether `nex_live_session` and
  `nex_live_featured_product` tables exist. The check is read-only.
- If NOT applied: Phase 1 includes a CLAUDE.md §5-gated apply window
  as a separate authorisation.
- If applied: Phase 1 proceeds directly to code wiring.

### G.5 Watches migrations 227-232 · verification posture

- Audit flagged header statements "AUTHORED · NOT YET APPLIED".
- **Production application status is unverified.**
- Phase 0 verification: read-only check for `nex_watch_listing`,
  `nex_watch_listing_entitlement`, search_tsv index.
- Not blocking Phase 1 of this contract. Watches reconciliation (§F)
  depends on their state and is sequenced after verification.

### G.6 Music migrations 235, 236, 237, 238 · unchanged

Preserved from sealed Music Directory doctrine. Not in scope of this
contract.

### G.7 Migration-ledger anomalies · recorded, not fixed

Audit noted:

- `226_nex_live_participation.sql` inserts ledger version `'221'`
  (mismatch).
- Duplicate numbering: `187_*`, `224_*`.
- `221_nex_uploaded_video_is_ai_generated.sql` precedes
  `223_nex_uploaded_video.sql` despite logical dependency inverse.

**Phase 0 action:** record these in a "known migration-ledger
anomalies" register at `docs/doctrine/nex-migration-ledger-anomalies-
register-draft-2026-10-30.md` (not drafted by this contract). The
register is owner-review-only. No file is renamed.

### G.8 Dormant `nex_business_theme` (migration 195)

Phase 0.5 decision: activate or retire. See §D.6.

---

## H · Security, ownership, media, stock, price

### H.1 Draft-product leak closure

**Confirmed audit gap**: `enter-broadcast-room/page.tsx:105` calls
`listProductsByBusiness(business.id)` without a status filter →
draft products reach the broadcaster picker → can be featured to
viewers.

**Contract fix (sealed per owner direction §2.6):**

- Change the call to `listProductsByBusiness(business.id, "live")`.
- Add a server-side check in `setLiveFeaturedProductAction` that
  rejects any product whose `status !== 'live'` with error code
  `"product-not-live"`.
- Add a server-side RLS policy on `nex_live_featured_product` that
  checks the referenced `nex_product.status = 'live'` at INSERT time.

### H.2 Ownership enforcement

Preserved sealed pattern + add two checks:

- `setLiveFeaturedProductAction`: product's `business_id` MUST be in
  `ownedBusinessIds` for the caller. **Already enforced.**
- Session's `business_id` MUST equal the product's `business_id`.
  **New check** closes the audit gap: today, a caller owning
  businesses A and B can start a session under A and feature a
  product from B.

### H.3 Multi-business selection

- Business picker required before Create Product and Live Library.
- `nex_live_session.business_id` is populated at session start.
- `nex_product.business_id` populated at creation.
- UI picker renders businesses from `listBusinessesByOwner(accountId)`
  with name + logo + (optional) product-count badge.

### H.4 Media policy

- All product images and gallery items use the sealed existing
  product-image upload path (`uploadOnboardingLogo` writing to
  `nex-peer-chat-attachments/business-logo/onboarding/{accountId}/…`).
- Minimum 1 image required to publish a product (`status='live'`).
- Max 10 gallery items per `nex_product.gallery_urls`.
- Portrait-First Constitution applies to cover images per sealed
  Music Directory doctrine (reused by extension to product media).
- Product video (future) uses `nex_uploaded_video` as a sibling
  concept; `nex_product.video_url` or `nex_product.primary_video_id`
  is **not introduced by this contract** (owner-decided separate
  media capability).

### H.5 Stock integrity

- `nex_product.stock_status` is the single source of truth across
  Shop and Live.
- `stock_status = 'sold_out'` renders the "Unavailable" button on
  Live `ProductOverlayCard` (sealed).
- Mid-stream stock changes propagate via the sealed Realtime channel
  `nex:live-featured:{sessionId}` + a new `featured-stock-update`
  broadcast event. Phase-2 enhancement; Phase 1 relies on the next
  page refresh.

### H.6 Price integrity

- `price_pence bigint` + `currency text ~ '^[A-Z]{3}$'` on
  `nex_product`. Currency defaults are owner-configured per business
  (not hardcoded to GBP as the current `createManagedProductAction`
  does — this is a Phase 1 fix).
- Price is immutable during an active Live session · changing price
  mid-stream requires `clearLiveFeaturedProductAction` → edit →
  `setLiveFeaturedProductAction`. This closes the "viewer sees old
  price" race.

### H.7 Idempotency

- `createProductAction` accepts an optional `request_uuid` for
  idempotent retries. If the same `(business_id, request_uuid)`
  pair arrives twice, the second returns the first result.
- `setLiveFeaturedProductAction` is naturally idempotent via the
  partial unique index on `nex_live_featured_product`.

### H.8 Deletion and archival

- Delete: hard-delete reserved for owner-explicit action; not exposed
  on UI by default. Cascades through `nex_product_variant`,
  `nex_product_share_grant`, `nex_product_section`, (future)
  `nex_watch_listing.product_id`.
- Archive: `status='archived'` hides from public Shop + Live Library;
  retained for audit + order history.
- Cross-account access: no cross-account read of drafts; RLS enforced.

---

## I · Implementation sequence

Every phase requires separate owner authorisation. **No phase is
authorised by this contract.** Batches are explicitly declared so
owner can approve or reorder them.

### I.0 Phase 0 · Verification + reconciliation (zero code change)

- Read-only §8-verified checks against `ijvqdvsvwtwxzcqmoqit` for
  table existence: `nex_product` + all extension columns,
  `nex_live_session`, `nex_live_featured_product`, `nex_watch_listing`
  + siblings, `nex_business_theme`. Report findings.
- Resolve audit "honest unknowns" list via targeted file + DB
  inspection.
- Draft the migration-ledger anomalies register as a separate
  doctrine doc.
- No code changes.

### I.0.5 Phase 0.5 · Owner-decision gates

Owner-signed answers required for:

1. `nex_business_theme` activate or retire.
2. Migration 100 CHECK reconciliation path (new migration or ADR).
3. Watches dual-write-then-merge (default) or alternative.
4. Business-selection UX details (picker shape, remember-last-choice
   behaviour).
5. Category spec storage: `nex_product.spec jsonb` + Zod (default) or
   per-dept sibling table (not recommended).

See §K for the full list.

### I.1 Phase 1 · Shared Create Product + canonical substrate

- New migrations drafted: `nex_product_category` (adds `department_id`
  + `category_id`), `nex_watch_listing_product_id` (links watches).
- Migration apply: §5-gated disposable-schema dry-run then production.
- Lift `_category-picker.tsx` to shared location.
- Build `/create/product` + `/create/product/category` + `/create/product/form`
  routes.
- Build shared `createProductAction` + `updateProductSpecAction` that
  dispatch on `(dept, cat)`.
- Build business-selection surface (shared with Live Library).
- Build `SpecFormBuilder` reading Zod schemas.
- Build Zod spec module skeleton for **1 "pilot" department** (owner
  picks; recommendation: `fashion_clothing` because it is high-volume
  and simple).
- Flip pilot department to `enabled: true`.
- Full E2E: create → draft → publish → appears in Shop → appears in
  Live Library.
- Tests: unit on Zod + repository + action; integration + Playwright E2E.

### I.2 Phase 2 · Live Product Library + Live gaps

**Draft-leak closure runs in PARALLEL with Phase 1 per owner
resolution §K.14. Critical Live safety correction. Do not wait for
Phase 1 pilot to finish.** Specifically, the two items marked
`[K.14 · parallel]` below ship as soon as the two-line change is
reviewed, independently of pilot department progress.

- `[K.14 · parallel]` Status-filter fix on broadcaster picker (`"live"`).
- `[K.14 · parallel]` Server-side `status === 'live'` check in
  `setLiveFeaturedProductAction`.
- New route `/nex-native/live-commerce/library`.
- Business-selection surface (reused from Phase 1).
- Session-business-match check.
- Clear-featured-product UI affordance.
- Migration 219 apply if not already (§5-gated).
- Tests: unit + integration + E2E for the full Live journey.

### I.3 Phase 3 · Shop Theme reconciliation

- Phase 3a: migration 100 CHECK drift resolution (per Phase 0.5
  decision).
- Phase 3b: department badge on `CoverProductCard` (reads
  `department_id`).
- Phase 3c: `ProductSpecBlock` on product detail page (reads
  `(dept, cat)` and renders per-category presenter).
- Phase 3d: Browse surfaces per department
  (`/nex-native/catalogue/<dept>/`) — one at a time per department
  batch.

### I.4 Phase 4 · Watches reconciliation (dual-write)

- Draft `nex_watch_listing_product_id` migration.
- Modify `createWatchListingAction` to dual-write via
  `createProductAction` first.
- Modify Watches read paths (Shop surface, Watches browse) to join
  `nex_product` by `product_id`.
- Smoke tests confirm Watches products now appear in
  `listProductsByBusiness` and the Live Library.

### I.5 Phase 5 · 29-department rollout (batched)

Each batch builds forms + spec schemas + tests + browse surface for a
set of departments. Owner approves each batch separately.

**Recommended batches (owner can reorder):**

- **Batch A** (3 departments · high-volume physical goods):
  - Fashion & Clothing *(pilot in Phase 1)*
  - Electronics & Technology
  - Beauty & Personal Care

- **Batch B** (3 departments · tangible goods, mid-complexity):
  - Home, Furniture & Living
  - Kitchen & Dining
  - Health, Wellness & Medical

- **Batch C** (3 departments · lifestyle):
  - Baby, Nursery & Parenting
  - Toys, Games & Hobbies
  - Sports, Fitness & Outdoors

- **Batch D** (3 departments · outdoor + diy):
  - Garden, Outdoor & Agriculture
  - Tools, DIY & Construction
  - Automotive, Motorcycles & Transport

- **Batch E** (3 departments · consumables):
  - Food, Grocery & Beverages
  - Pet Supplies & Animals
  - Books, Education & Stationery

- **Batch F** (3 departments · professional + arts):
  - Office, Business & Industrial
  - Arts, Crafts & Handmade
  - Music, Film & Entertainment

- **Batch G** (3 departments · travel + digital):
  - Travel, Luggage & Outdoor
  - Digital Products & Software
  - Experiences, Activities & Tickets

- **Batch H** (3 departments · existing-sibling-table reconciliation):
  - Accommodation (reconcile with `nex_accommodation_unit`)
  - Food Delivery & Restaurants (reconcile with `nex_menu_item`)
  - Services Marketplace (reconcile with `nex_service`)

- **Batch I** (3 departments · categorical overlays):
  - Second-hand & Refurbished
  - Luxury, Premium & Collectibles
  - Gifts, Celebrations & Seasonal

- **Batch J** (2 departments · tail):
  - Renewable Energy & Utilities
  - Everything Else

**Grouping rationale**: the 10 batches above group categories by
dependency + testing-safety, NOT by a fixed delivery schedule.
**Owner resolution 2026-10-30 (§K.2) explicitly rejects the 10-week
baseline as a delivery requirement.** Work continuously, parallelise
independent categories where sensible, and do not defer easy or
independent categories unnecessarily. All 30 departments are required
for completion; "pilot-becomes-stopping-point" is not acceptable.

**Every batch must deliver all §B.1 "required per-department
deliverables"** before the batch is signed off. No cutting corners
on tests.

### I.6 Phase 6 · Full-flow acceptance

- End-to-end acceptance per §J criteria.
- Documentation updates: public help page explaining the new flow;
  this contract gets a `OWNER-ACCEPTED` status block.
- Retirement of the legacy `/manage` dashboard inline product form
  via a doctrine-signed migration.

---

## J · Acceptance criteria and tests

### J.1 Per-department acceptance criteria

A department is "shipped" when all of:

1. Zod spec module ships + passes unit tests covering valid payloads,
   invalid payloads (missing required field, bad enum, overflow), and
   boundary cases.
2. The sub-category tree is navigable in the Create Product category
   picker and leads to the category form.
3. The category form renders every field defined in the Zod schema
   (via `SpecFormBuilder` or dedicated component).
4. Create → draft → publish round-trip works end-to-end against the
   dev database.
5. Published product appears in the owner's Shop under the sealed
   cover primitive.
6. Published product appears in the Live Product Library when the
   owner opens Go Live.
7. Published product can be featured on Live via the sealed
   `setLiveFeaturedProductAction`.
8. Viewer sees the product via `ProductOverlayCard` with correct name
   + price + image + stock badge.
9. Edit flow updates `nex_product.spec` and re-renders consistently.
10. Playwright E2E spec covers the full create-to-live-view flow.

### J.2 End-to-end journey acceptance

- Create path: `/create` → "Product" card → business picker → category
  picker → sub-category picker → form → Save Draft → `/manage/products/<id>`.
- Publish path: `/manage/products/<id>` → "Publish" button →
  status flip → Shop reflects immediately.
- Shop path: `/<businessSlug>` → scroll to Shop grid → product card
  renders → tap → detail page → spec block renders per-department.
- Live path: `/create` → Go Live → business picker → Live Library →
  tap product → session starts → viewer sees `ProductOverlayCard`.
- Edit path: `/manage/products/<id>` → edit form → Save → all
  surfaces reflect.

### J.3 Security acceptance

- Draft products NEVER appear on public Shop OR Live Library OR
  Live viewer surface.
- A caller cannot feature a product they do not own.
- A caller cannot start a session under business A then feature a
  product from business B.
- RLS policies enforce owner-only read of drafts.
- No cross-business leaks.

### J.4 Test coverage matrix

| Scope | Minimum coverage |
|---|---|
| Zod spec | 100% of each schema's required/optional/enum/boundary behaviour |
| `product-service.ts` canonical read/write | Unit tests on every exported function (currently absent — see §G.9 of the audit) |
| `createProductAction` + category dispatch | Error-code matrix per sealed Follow-pattern |
| `updateProductSpecAction` | Owner-only enforcement + spec revalidation |
| `setLiveFeaturedProductAction` | Status-live gate + ownership + session-business-match |
| Shop rendering | Snapshot tests per layout × department badge |
| Live Library | Scrollable grid + filter chips + search + add-new fallback |
| E2E Playwright | One spec per department covering create → shop-list → shop-detail → live-feature → viewer-sees |

### J.5 Observability acceptance

- Emit sealed counter names per sealed observability pattern:
  - `product.create_ok` / `product.create_rejected` (per code)
  - `product.publish_ok` / `product.publish_rejected`
  - `live.featured_set_ok` / `live.featured_rejected` (per code)
- Alerts on `product.create_rejected > N/min` for configurable `N`.
- No alerts on test or dev-impersonation activity.

---

## K · Owner-resolved decisions (sealed 2026-10-30)

The 15 decisions below were resolved by the owner on 2026-10-30
following owner review of this contract's §K draft form. Each
resolution is binding on the implementation. Default recommendations
from the draft are preserved in substance; the owner's resolution is
the authoritative state.

**Status: owner-resolved 15/15.** Build objective is the **complete
30-department product system**, not a pilot that becomes the permanent
stopping point. Fashion is the pilot, not the limit. Deliver in
controlled batches where safe testing requires, but avoid unnecessary
waiting between batches. **There will be no Audit 3.**

| # | Decision | Owner resolution 2026-10-30 |
|---|---|---|
| 1 | Pilot department for Phase 1 | **Fashion & Clothing** · accept default · prove the complete shared Create → spec → media → Shop → Live flow. |
| 2 | Batch ordering of the remaining 29 (§I.5) | **Retain category grouping + dependency logic. Do NOT fix the 10-week schedule as a delivery requirement.** Work continuously in controlled batches. All 30 required. Do not defer easy / independent categories unnecessarily. |
| 3 | `nex_business_theme` activate or retire (§D.6) | **Retire as active theme system.** Preserve existing data + migration history. Do NOT destructively drop tables or records without a separate verified data-safety reason. Use sealed account-theme + business-override architecture. |
| 4 | Migration 100 CHECK drift resolution (§G.3) | **Resolve through a new forward-only migration after verifying actual database state and all existing layout IDs.** Never edit or renumber the sealed migration 100. New constraint must support the sealed 11 layout IDs. Do not apply the migration without separate authorisation. |
| 5 | Watches reconciliation path (§F) | **Accept additive dual-write for Phase F-1**, provided consistency / idempotency / failure handling are demonstrated. Canonical `nex_product` record must be available to Shop and Live. **Preserve `nex_watch_listing`, existing infrastructure, and the Watches browse surface.** F-2 retirement decision deferred to after 30 days of actual stability. |
| 6 | Category spec storage (§A.2) | **`nex_product.spec jsonb` with Zod schemas per category.** Keep per-category adjunct tables only where a demonstrated technical requirement justifies them. Do NOT create 30 separate product systems. |
| 7 | Multi-business UX detail | **Remember last selected business per device for 30 days, with an obvious way to change it.** Never silently assume the remembered business is the only business the owner can use. |
| 8 | Business picker position on Create Product | **Before category selection.** Owner selects business → department → sub-category → form. |
| 9 | Legacy `createManagedProductAction` retirement timing (§C.6) | **Retire after Phase 1 AND the first category batch have passed acceptance testing.** Preserve compatibility until the replacement is proven. No premature deletion. |
| 10 | Legacy `createFirstProductAction` retirement timing (§C.6) | **Keep its onboarding-specific semantics.** Where practical, route its product persistence through the shared canonical product service so onboarding + ordinary creation cannot produce incompatible product records. |
| 11 | Product video (`primary_video_id`) scope and timing (§3.1) | **Separate contract after the 30-category product system is delivered.** Do not block the product system on product-video implementation. Preserve existing media capabilities. |
| 12 | Live deep-link `?product=` honouring (§E.7) | **Defer until after the main product system is complete.** Not a blocker. |
| 13 | `/nex-native/watches/*` retirement after Watches reconciliation (§F.2) | **Keep.** Retain as a department-specific browse experience connected to the canonical catalogue. |
| 14 | Draft-leak closure precedence vs. Phase 1 pilot department | **Run in parallel with Phase 1. Critical Live safety correction.** Draft and archived products must NEVER be publicly selectable or featured. Do NOT wait for the pilot department to finish before closing this gap. |
| 15 | Monetisation / commission / payment doctrine | **No change.** Preserve sealed NEX doctrine: NEX does not handle, intermediate, or process seller payments and does not take seller commissions. Order Now remains a chat handoff for the seller and customer to arrange payment and fulfilment. |

### K.1 · Owner delivery instruction (sealed 2026-10-30)

The build objective is **the complete 30-department product system**,
not a pilot that becomes the permanent stopping point. Deliver in
controlled batches where needed for safe testing, but avoid
unnecessary delays between batches. Reuse the shared foundation.
Do not repeat architecture audits. **There will be no Audit 3.**

### K.2 · Owner protections (sealed 2026-10-30)

Three invariants the owner has explicitly protected in this contract:

1. **One product record.** No separate catalogue for each Shop Theme
   or Live. Canonical `nex_product` is the single source of truth.
2. **All 30 departments required.** Fashion is the pilot, not the
   limit. "Pilot-becomes-stopping-point" is not an acceptable outcome.
3. **No unnecessary waiting.** Migration-verification checks must not
   stall independent product work.

---

## L · Preservation guardrails

### L.1 Non-destructive, non-rebuilding posture

This contract explicitly preserves:

- Sealed `nex_product` substrate + all 12 extension migrations
  (015, 016, 017, 023, 030, 064, 075, 088, 107, 122).
- Sealed Watches implementation (`nex_watch_listing` + migrations
  227-232 + the 7 test files + the browse surface at
  `/nex-native/watches/*`).
- Sealed services + accommodation + food/menu vertical implementations
  (`nex_service`, `nex_accommodation_unit`, `nex_menu_item` + their
  manage surfaces).
- Sealed cover primitives (`CoverProductCard`, `CoverIdentityBadge`,
  `CoverProductGrid`, etc.) at `src/app/nex-native/cover/`.
- Sealed Live mechanisms: `ProductOverlayCard`,
  `featured-product-channel.ts`, `_go-live-client.tsx`,
  `enter-broadcast-room/_actions.ts`, migration 219 shape.
- Sealed R9 Live-eligibility contract.
- Sealed Portrait-First Screen and Media Constitution.
- Sealed Active-Slot Rotation Rule (Music; unrelated but preserved).
- Sealed design-token rule 2026-10-17.
- Sealed chat master layout rule 2026-10-14 (unrelated but preserved).

### L.2 Nothing removed before replacement is stable

- `/manage/watches/new` continues to work until Watches reconciliation
  is stable AND owner signs off (Phase 4 completion).
- `/manage` dashboard inline product form continues to work until
  Phase 1 completes AND owner signs off.
- `createFirstProductAction` continues as-is (sealed onboarding
  surface).
- Legacy `createManagedProductAction` hard-coded GBP currency is
  **fixed in Phase 1** without changing the action's public contract
  so existing callers continue to work.

### L.3 Scope hygiene

- No introduction of `nex_shop` abstraction. Shop == `nex_business`.
- No introduction of a competing product table.
- No introduction of a competing Live product-upload system.
- No casual renumbering of migrations.
- No assumption of production migration application status.
- No code changes authorised by this contract.
- No commits, pushes, deployments authorised by this contract.

### L.4 Explicit non-events

- No payment processing added.
- No commission or fee added.
- No seller-earnings surface added.
- No tipping or wallet added.
- Watches sealed entitlement + rate-limit infrastructure preserved
  (owner can decide to retain or rebuild post-reconciliation).

---

## Appendix A · Glossary (binding)

| Term | Definition in this contract |
|---|---|
| Canonical product | A row in `nex_product`. Single source of truth. Immutable `business_id` and (after Phase 1) immutable `department_id` + `category_id`. |
| Department | One of the 30 sealed `DepartmentId` strings in `src/lib/nex-native/catalogue/departments.ts`. |
| Category | A sub-category within a department. Both are strings. The pair `(department_id, category_id)` uniquely identifies a product's taxonomy slot. |
| Spec | `nex_product.spec jsonb`. Category-specific attribute payload. Validated by Zod. |
| Live Product Library | The owner-facing surface at `/nex-native/live-commerce/library` that lists the owner's `status='live'` products for selection before/during a broadcast. |
| Featured product | The product currently pinned to a Live session. Mediated by `nex_live_featured_product` row + Realtime channel + local React state. At most ONE active per session. |
| Shop Theme | The visual layout + chrome applied to a `nex_business`'s cover page. Governed by `cover_layout_id` + `chat_theme` + the two sealed per-business override columns. Not a product store. |
| Shop | A `nex_business` row + its sealed cover-page rendering. No separate `nex_shop` table. |

---

## Appendix B · State-distinction vocabulary (binding)

- **Drafted** — a file exists on disk and has been authored. No
  claim about correctness, review, application, or production state.
- **Implemented in development** — a code path exists and runs in
  the development environment. No claim about production-readiness,
  staging verification, or production stability.
- **Tested** — a formal test suite exercises the path and passes.
  Separate from staging or production.
- **Applied** — a migration has been successfully run against a
  specific target database. Must name the target.
- **Production-ready** — tested, applied to a production-mirror
  environment, free of known production-blocking issues, and
  authorised by the owner for production use.
- **Authorised** — the owner has explicitly approved the specific
  action, with the scope and target clearly identified.

Every claim in this contract about the state of existing code,
migrations, or systems uses these distinctions precisely.

---

## Appendix C · Known migration-ledger anomalies (recorded, not fixed)

Preserved from the audit. Phase 0 action is to record these in a
separate register for owner review. This contract introduces none of
these; it inherits them.

- `226_nex_live_participation.sql` inserts `nex_migration_history`
  version `'221'` (mismatch).
- Duplicate numbering: `187_nex_source_registry_osm_products.sql`
  and `187_nex_world_country_us_au_seed.sql`; `224_nex_account_is_mock_persona.sql`
  and `224_nex_emergency_schema.sql`.
- `221_nex_uploaded_video_is_ai_generated.sql` precedes
  `223_nex_uploaded_video.sql` despite logical dependency inverse.
- MEMORY.md states "Migrations 236 + 237 NOT DRAFTED" while
  `236_nex_music_active_slot_and_idempotency.sql` and
  `237_nex_follow_graph.sql` exist on disk (resolved by Music
  Directory doctrine §11.4 2026-10-30).

---

**End of document.**

> **DRAFT · FOR OWNER REVIEW · NOT AUTHORISED FOR IMPLEMENTATION**
>
> This contract converts the owner-direction 2026-10-30 into an
> actionable plan. No code change, migration, DB mutation, commit,
> push, or deploy was performed in its production. Awaiting explicit
> per-phase authorisation.
