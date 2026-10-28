# NEX Shop · Watches · Upload Schema · DRAFT

**Status:** 📝 DRAFT · owner-recorded 2026-10-26 (specialised commerce schema for the Shop > Watches category · PROPOSED · not approved · not final).
**Author:** Claude (recording owner-authored intent · generated from Round 3b §2 of the ongoing Live Commerce build).
**Scope:** Governs the data model + validation + upload flow for a watch-category product listing in the production Shop surface. Dev-only data lives in `src/lib/nex-native/live-broadcast/dev-video-manifest.ts` under the `watch*` fields today; this doc specifies the production surface the dev manifest is a placeholder for.
**Status transitions available:** keep as DRAFT · promote to LOCKED via a separately signed owner authorisation · revise before locking.

---

## 0 · Why this exists

Owner directive 2026-10-26: *"the watch information where we can take details or information will help us build the shop watches upload detailed page … save the shop upload page as we start to add watches we will build but save."*

Watches have 25+ specialised attributes (diameter, movement, caliber, water resistance, strap width, authenticity, warranty, origin, pricing modes, …) that generic `nex_product` columns do not model cleanly. This doc proposes a dedicated 1:1 join table `nex_watch_listing` and the upload-flow rules that write to it.

The doc is intentionally **conservative on commitments**: it only names fields and rules; it does NOT advertise a feature or seal a column. Nothing here grants permission to apply a migration, change `nex_product` schema, or expose any field in the production UI. Each is a separate explicit approval.

---

## 1 · Primary table · `nex_watch_listing`

One row per listed watch · 1:1 join to `nex_product`.

```sql
CREATE TABLE nex_watch_listing (
  -- Identity & ownership
  product_id            uuid PRIMARY KEY REFERENCES nex_product(id) ON DELETE CASCADE,
  business_id           uuid NOT NULL REFERENCES nex_business(id)   ON DELETE RESTRICT,

  -- Brand + identity
  brand                 text NOT NULL,                      -- "Rolex" or "Brand · On Request"
  model                 text NOT NULL,                      -- "Cosmograph Daytona · Two-Tone" or "On Request"
  reference_number      text,                               -- "116503"; optional, on-request OK
  serial_number         text,                               -- NEVER public · encrypted or on-request only
  nickname              text,                               -- "Panda", "Pepsi", "Hulk"

  -- Case
  case_diameter_mm      numeric(5,2),                       -- 40.00
  case_thickness_mm     numeric(5,2),
  lug_to_lug_mm         numeric(5,2),
  case_material         text,                               -- free text so composites read naturally
  bezel_type            text,                               -- fixed / rotating-uni / rotating-bi / tachymeter
  crystal               text CHECK (crystal IN ('sapphire','mineral','acrylic','on-request')),
  caseback_type         text CHECK (caseback_type IN ('solid','exhibition','engraved','on-request')),

  -- Movement
  movement              text NOT NULL CHECK (movement IN
    ('automatic','manual-wind','quartz-battery','solar-quartz','spring-drive','mecaquartz','on-request')),
  movement_caliber      text,                               -- "Cal. 4130"
  power_reserve_hours   int,
  jewels_count          int,
  frequency_bph         int,                                -- 28800 for 4 Hz

  -- Dial
  dial_color            text,
  dial_finish           text,                               -- sun-ray / matte / enamel / lacquer
  lume                  text,                               -- SuperLumiNova / tritium / none

  -- Strap / bracelet
  strap_material        text,
  strap_color           text,
  strap_width_mm        numeric(5,2),                       -- lug width
  strap_length_mm       numeric(6,2),                       -- end-to-end
  clasp_type            text,

  -- Resistance + origin
  water_resistance_m    int CHECK (water_resistance_m IS NULL OR water_resistance_m >= 0),
  made_in               text,
  production_year       int CHECK (production_year IS NULL OR production_year BETWEEN 1900 AND 2100),

  -- Condition + authenticity
  condition             text NOT NULL CHECK (condition IN
    ('new','pre-owned','vintage','on-request')),
  full_set              boolean,
  packaging             text[] CHECK (packaging <@ ARRAY[
    'box','papers','warranty-card','service-card','manual','spare-link','none'
  ]),
  authenticity          text NOT NULL CHECK (authenticity IN
    ('original-brand','original-brand-service-pending','homage-disclosed','replica-disclosed','on-request')),
  authenticity_note     text,                               -- free text where "disclosed" is used

  -- Warranty
  warranty_months_remaining int,
  warranty_note         text,

  -- Commerce
  shipping_scope        text[] CHECK (shipping_scope <@ ARRAY[
    'local','domestic','export','pickup-only'
  ]),
  pricing_modes         text[] CHECK (pricing_modes <@ ARRAY[
    'retail','wholesale','trade-in'
  ]),
  retail_price_minor    bigint,                             -- scale per IDR-SCALE decision (OPEN)
  wholesale_price_minor bigint,
  min_wholesale_qty     int,
  currency_code         char(3) NOT NULL DEFAULT 'IDR',
  price_note            text,

  -- Complications
  complications         text[]
    CHECK (array_length(complications, 1) IS NULL OR array_length(complications, 1) <= 15),

  -- Media
  cover_image_url       text,
  gallery_image_urls    text[]
    CHECK (array_length(gallery_image_urls, 1) IS NULL OR array_length(gallery_image_urls, 1) <= 20),
  video_id              uuid REFERENCES nex_uploaded_video(id) ON DELETE SET NULL,

  -- Lifecycle
  status                text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending-review','published','paused','sold','withdrawn')),
  draft_created_at      timestamptz NOT NULL DEFAULT now(),
  published_at          timestamptz,
  sold_at               timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
```

---

## 2 · Validation rules (service layer)

| Rule | Enforcement |
|---|---|
| `brand` and `model` required · `"On Request"` is a valid literal | NOT NULL + CHECK length ≥ 1 |
| `serial_number` **never returned in public SELECT** | View projection + RLS policy |
| `retail_price_minor` requires `pricing_modes @> ['retail']` and vice versa | Service-layer precondition |
| `wholesale_price_minor` requires both `pricing_modes @> ['wholesale']` and `min_wholesale_qty > 0` | Service-layer precondition |
| `authenticity = 'replica-disclosed'` requires non-empty `authenticity_note` | Service-layer precondition + UI gate |
| `status = 'published'` requires: `cover_image_url NOT NULL`, `authenticity NOT 'on-request'`, `condition NOT 'on-request'`, at least one of `retail_price_minor` / `price_note` populated | Service-layer precondition |
| Description text max ≈ 500 chars (owner directive 2026-10-26 · "limit how many lines description owner can add") | UI textarea maxlength + service-layer check |
| All text fields enter through sealed universal `NexInput` / `NexTextarea` keypad | UI binding (per 2026-10-24 sealed rule) |

---

## 3 · Six-step upload flow

1. **Create draft** · `createWatchListingDraftAction(businessId)` → returns `product_id`. Writes a row with `status='draft'`.
2. **Upload media** · `uploadWatchGalleryAction(productId, file)` writes to the sealed `nex-live-uploaded` bucket (shared with uploaded video). Cover image is required before publish.
3. **Fill specs** · `updateWatchListingSpecsAction(productId, patch)` partial updates with per-field validation; `NexInput`/`NexTextarea` applies.
4. **Preview** · client-side render of exactly the `WatchOverlayCaption` the Live viewer will show; serialised preview URL for owner cross-check.
5. **Review (optional)** · `pending-review` state; moderation path to publish. Verified sellers may skip (owner decision pending).
6. **Publish** · `publishWatchListingAction(productId)` runs the publish-preconditions, flips `status`, stamps `published_at`.

---

## 4 · RLS posture (sealed-matching)

- **SELECT** · public read for `status = 'published'`; broadcaster-only for every other status (follows the `nex_live_session` pattern per migration 219).
- **INSERT / UPDATE** · broadcaster-only via `nex_current_account_ids()` + `nex_current_owned_business_ids()` (same helpers used across 46 policies).
- **DELETE** · service-role only (soft-delete via `status='withdrawn'` is the user path).
- **`serial_number`** · hidden from the public view projection; readable only to the owning business + service-role.

---

## 5 · Explicit scope boundaries (what this DRAFT does NOT do)

- Does not create the migration file.
- Does not pick the IDR-SCALE (still blocked by Round 2 Register E2 decision).
- Does not touch `nex_product` schema or `nex_business` schema.
- Does not define the moderation / review workflow (related to Register A Jail-B governance).
- Does not reseal any locked policy (Vault LOCKED, Package Contract DRAFT, Service Principle DRAFT, Pending-invite privacy, …).
- Does not advertise the Shop > Watches surface to users anywhere until the schema is approved + migration applied + upload UI shipped + Service Principle wording settled.

---

## 6 · Interaction with open blockers

| Blocker | Interaction |
|---|---|
| IDR-SCALE (Round 2 Register E2) | Determines whether `retail_price_minor` and `wholesale_price_minor` are × 100 pence or × 1 integer rupiah. **Blocking.** |
| Jail-A amendment (Round 2 §4) | Needed before a seller's listing is gated by any ephemeral mute. Not blocking the schema itself. |
| Entitlement mapping (Round 2 Register C) | Determines which business tier may list watches at which volume. Owner authored a C1-C11 register that still needs decisions. |
| Service Principle final wording (Round 2 §4 wording candidates) | Determines what "NEX facilitates / does not guarantee" strings appear on confirm sheets at publish. |
| Receipt copy (Round 2 Blocker 2 C-1 through C-11) | For listings sold via Buy-Now / Offer / Auction, the receipt copy settles the handoff language. |

---

## 7 · Status

- 📝 DRAFT · recorded 2026-10-26 · unapproved.
- Promotion to LOCKED requires a separately signed owner authorisation and resolution of §6 blockers.
- Implementation (migration authoring, service layer, upload UI, media bucket writes) is each a separately-authorised step.

---

## 8 · Appendix · World-standard spec expansion (owner directive 2026-10-26 Round 3g)

Expanded to meet world-standard watch spec architecture across luxury,
everyday, sports, vintage, and smartwatch categories.

### 8a · Brand picker policy

- Primary input is a curated dropdown drawn from
  `src/lib/nex-native/watch-catalog/watch-brands.ts` (~110 brands,
  alphabetical, categorised).
- "Other brand" always available · reveals a custom text input
  **hard-capped at 2 words max** via `clampCustomBrand()`.
- Custom brand text may NOT overflow the surrounding field · enforced
  by `max-width: 100%; box-sizing: border-box` on every input in the
  form.

### 8b · 3-tier progressive form

The upload form uses collapsible disclosure levels so sellers aren't
drowned in fields:

**Level 1 · Essential** · always visible · 11 required fields:
brand · model · reference · watch type · movement · face dia · dial
colour · strap material · condition · Buy Now price (optional) ·
description.

**Level 2 · Detailed specifications** · collapsible · expands on tap:
dimensions, case material + crystal + water resistance, strap/lug/
clasp (strap width and lug width are **separately recorded** per
owner directive · integrated and proprietary connectors do not share
measurement), movement block that **reveals only the fields relevant
to the chosen movement category** (mechanical/quartz/digital), fit &
comfort, durability, appearance.

**Level 3 · Verified premium** · collapsible · for pre-owned + luxury
depth: masked serial number · authenticity · service history · boxes
and papers · packaging · seller type · shipping scope · pricing
modes · returns.

### 8c · Category-dependent reveal rules

Movement enum → revealed block:

| Movement | Block revealed |
|---|---|
| `manual`, `automatic`, `spring-drive` | Mechanical movement block (calibre, manufacturer, power reserve, jewels, frequency, hacking, hand-winding) |
| `quartz-battery`, `solar-quartz`, `mecaquartz` | Quartz block (calibre, manufacturer only) |
| `digital`, `smartwatch`, `hybrid` | Smartwatch block (display tech, screen size, OS, battery life, GPS / HR / NFC toggles) |

Owner directive is binding: "do not require mechanical-only fields
for a quartz watch or smartwatch."

### 8d · Lug width ≠ strap width

Database schema MUST store `strap_width_mm` and `lug_width_mm` as
separate columns even when they normally match. Some watches (Richard
Mille, Audemars Piguet Royal Oak, Hublot MP series, Apple Watch, etc.)
use integrated / proprietary connectors where the two measurements
diverge or where strap compatibility is proprietary. Collapsing the
two into one field causes misleading strap-compatibility advice.

### 8e · Water-resistance honesty rule

The `water_resistance_m` field records the **manufacturer's stated
rating** · never a swim/dive claim derived from a generic depth label.
The upload UI uses the `WATER_RESISTANCE_RATINGS` enum which carries
both metres and bar labels (e.g. `100m-10bar`). The receipt / overlay
rendering must never translate "100 m" into "safe for swimming" or
"dive-rated" without an explicit `diving_certification` field being
set.

### 8f · Authenticity-evidence rule

A seller selecting `authenticity = 'original-brand'` is NOT enough to
label the watch "authentic". The DB field is a seller-asserted claim;
public UI should surface the asserted claim together with the
evidence (if any) and the verifier identity. If NEX adds a
verification service later, that verifier is a separate recorded
field, not the seller's checkbox.

### 8g · Vocabulary source of truth

All picklists live at
`src/lib/nex-native/watch-catalog/watch-vocabularies.ts` as readonly
`[key, label]` tuples. The upload form, overlay rendering, and future
service layer all import from the same file so key stability survives
schema changes.

### 8h · Withdrawn · superseded by the sibling-table approach

**Status · WITHDRAWN · 2026-10-26 · owner-signed.**

The original §8h proposal (recorded on 2026-10-26 earlier the same day
and preserved verbatim in the historical block below) suggested making
`nex_product.business_id` NULLABLE and adding a
`nex_watch_listing.standalone_account_id` column. **That proposal is
withdrawn.**

#### Replacement direction

Independent sellers who do not own a shop are supported through a
**separate sibling table** `nex_watch_listing`, not through
modifications to the sealed `nex_product` schema. The sibling table
carries:

- `owner_account_id uuid NOT NULL REFERENCES nex_account(id)` ·
  seller ownership, always present
- `business_id uuid NULL REFERENCES nex_business(id)` · optional
  shop association

The sealed `nex_product` schema is **not modified**. Its
`business_id NOT NULL` constraint remains in force for shop-owned
products.

Discovery of shop-less watch listings goes through the view-only
projection `watch_listing_directory_v` (see the directory tile
amendment at
`docs/doctrine/nex-directory-tile-uniqueness-g3-amendment-2026-10-26.md`)
and the dedicated route `/nex-native/watches/[listingId]`.

#### Why the original §8h was withdrawn

- Making `nex_product.business_id` NULLABLE would have required a
  schema change on a sealed table. Sealed-table modifications were
  flagged as high-risk during the Round 4 planning audit.
- The `standalone_account_id` column added two possible ownership
  paths to a single row, creating duplication risk and FK-cascade
  ambiguity.
- The sibling-table approach preserves `nex_product` entirely and
  keeps watch-listing concerns in their own table with a single
  ownership column (`owner_account_id`).

#### Changelog

- 2026-10-26 · §8h withdrawn and replaced · owner-signed
- 2026-10-26 · original §8h proposal recorded earlier same day

#### Preserved original §8h proposal (for historical traceability)

The withdrawn text is kept here verbatim so future readers can trace
the decision path:

> ### 8h · Live-cards fallback for sellers without a shop
>
> Owner directive 2026-10-26 (R3g): "which also will connect with live
> cards if user does not have shop yet."
>
> When a seller submits a watch listing but does NOT yet have an
> `nex_business` row (i.e. no shop), the production submit path does
> NOT reject. Instead, the listing is **converted into a Live card**
> tied to the seller's `nex_account` directly, surfaced in their Live
> feed and the overlay's Video Center. The schema reconciliation:
>
> - `nex_watch_listing.business_id` becomes NULLABLE (change from §1).
> - A new `nex_watch_listing.standalone_account_id uuid` column
>   (NULLABLE) stores the owning account when no business is present.
> - CHECK constraint: exactly one of `business_id` or
>   `standalone_account_id` must be non-null.
> - RLS: broadcaster-write policy keys on
>   `COALESCE(nex_current_owned_business_ids(), nex_current_account_ids())`
>   so a shop-less seller can still own their listings.
> - Publishing: Live-card-only listings skip the Shop surface entirely
>   and appear only in Live (feed + overlay Video Center). The seller
>   can promote to a Shop surface later by creating a business and
>   reassigning `standalone_account_id → business_id`.
>
> This is a schema update to §1 of this doctrine, not a separate
> primitive. The migration (`227_nex_watch_listing`) must land with
> both columns + the CHECK + the RLS from the start.

### 8i · Status

Still 📝 DRAFT · appendix additions do not promote the doctrine.
Each §8 clause requires owner approval before implementation.
Backend is unbuilt. UI skeleton lives at
`src/app/nex-native/manage/watches/new/` (behind auth) and
`src/app/nex-native/dev/watches-upload-preview/` (dev preview).
Brand picker + vocabularies + 3-tier form are shipped in dev.
