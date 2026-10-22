# NEX Delivery Pricing · Doctrine · DRAFT 2026-10-22

**Status:** 📝 DRAFT · owner-recorded 2026-10-22 · NOT IMPLEMENTED
**Scope:** Decisions sealed as doctrine. Code lands in a separate authorisation.
**Precedes:** schema migration · `/manage/delivery` page · shop-creation toggle · dashboard nudge · legacy `/manage/info` Delivery textarea retirement.

---

## 0 · Why this doctrine exists

NEX never handles payments. We're applying the same discipline to logistics: NEX never books couriers, never calls Gojek/JNT/JNE APIs, never acts as the logistics referee.

What NEX DOES do:
- Let the seller declare a delivery policy once (bike per-km + cargo zones + size tiers + delivery times)
- Show buyers a price + time estimate at checkout based on that declaration
- Freeze the quote into the order message that lands in the seller's chat
- Require the seller to confirm stock + lead time + dispatch before the buyer pays anything

What NEX does NOT do:
- Call courier APIs for real-time rates
- Book a courier for the seller
- Enforce the declared price against the actual courier charge
- Autocomplete / verify addresses via paid APIs

---

## 1 · Three-surface split (SEALED)

Delivery pricing lives across three surfaces. Each has a distinct job.

### Surface 1 · Shop creation toggle

**Location:** top of `/nex-native/business-setup/*` (or wherever the shop-create form lives).

**UX:**
```
┌─ How do customers get their orders? ─┐
│ ○ I deliver (bike or cargo)          │
│ ○ Pickup only · customer collects    │
└───────────────────────────────────────┘
```

**Behaviour:**
- Binary choice · captures policy intent in one tap
- Does NOT ask for prices at this surface
- "I deliver" selected → sets `offers_delivery=true` · post-save redirect carries a banner "⚡ Set your delivery prices · 2 min" pointing at Surface 2
- "Pickup only" selected → sets `pickup_only=true` · no banner · shop can go live without further delivery config
- Default: no selection · owner must pick before the shop can be saved

**Why not full form here:** shop creation already asks for 10+ fields (name, category, address, hours, payment methods, portrait, etc.). Adding bike per-km + cargo zone grid pushes abandonment. Keep creation = identity.

### Surface 2 · Dedicated edit page

**Location:** `/nex-native/manage/delivery` (NEW).

**Content:** full version of the prototype at `/nex-native/delivery-prototype`:
- Business basics (country, province, pickup address, GPS verification)
- Pickup-only override (top-level)
- Bike delivery section (per-km rate + max distance)
- Cargo zones (province + optional city + optional size tier + price + delivery time + notes)
- Checkout preview (buyer-side + seller-side chat bubble)
- Save-to-DB (not localStorage) with `revalidatePath` + banner redirect

**Gates:** `assertOwner()` server action gate matching the pattern in `/manage/orders/_actions.ts` and `/manage/accommodation/_actions.ts`.

**Who can see it:** owner only. Editable any time (not just at onboarding).

### Surface 3 · Side drawer entry

**Location:** `src/components/nex-native/control-drawer/control-drawer-client.tsx` · `YOUR_BUSINESS_ROWS` array.

**Insertion point:** between `My businesses` and `Business Vault` (keeps commerce-adjacent rows grouped).

**Row shape:**
```typescript
{
  key: "delivery-pricing",
  label: "Delivery pricing",
  subtitle: "Bike, cargo, pickup rules per order",
  href: "/nex-native/manage/delivery",
  locked: true,
}
```

---

## 2 · Data model (SEALED shape · migration unauthorised)

### 2.1 · Policy table (one row per business)

```sql
CREATE TABLE nex_business_delivery_policy (
  business_id uuid PRIMARY KEY REFERENCES nex_business(id) ON DELETE CASCADE,

  -- Country-agnostic ISO 3166-1 alpha-2. Indonesia first; swappable per-market.
  country_code text NOT NULL DEFAULT 'ID'
    CHECK (country_code ~ '^[A-Z]{2}$'),

  -- Province override: ISO 3166-2 (e.g. "ID-JK"). Captured on the policy
  -- surface because GPS reverse-geocode may land in the wrong one when
  -- the owner is at home vs at the shop.
  seller_region_code text,

  -- Free-text pickup address shown on the Visit Us panel. Informal is OK
  -- (Indonesian landmarks, "behind X", etc.). NOT a geocoded field.
  pickup_address text NOT NULL DEFAULT '',

  -- GPS ground truth (nullable until seller verifies).
  -- Reuses existing nex_business.location_lat / _lng columns in the final
  -- migration · this column spec is here for completeness. Final migration
  -- MAY choose to leave coordinates on nex_business and reference them.
  location_lat double precision,
  location_lng double precision,
  location_accuracy_meters int,
  location_verified_at timestamptz,

  -- Top-level override. When true, hides bike + cargo in display.
  pickup_only boolean NOT NULL DEFAULT false,

  -- Bike (local) delivery.
  offers_bike boolean NOT NULL DEFAULT false,
  bike_price_per_km_cents int,         -- IDR cents to avoid float drift
  bike_max_distance_km int,

  -- Cargo (intercity) delivery.
  offers_cargo boolean NOT NULL DEFAULT false,

  -- Staleness tracking.
  policy_updated_at timestamptz NOT NULL DEFAULT now(),
  staleness_nudge_dismissed_at timestamptz,

  -- Honest audit.
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nex_business_delivery_policy_updated
  ON nex_business_delivery_policy (policy_updated_at)
  WHERE pickup_only = false AND (offers_bike = true OR offers_cargo = true);
```

### 2.2 · Zone rows (N rows per business, only when cargo offered)

```sql
CREATE TABLE nex_business_delivery_zone (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,

  -- ISO 3166-2 region code (e.g. "ID-JK", "ID-JB").
  region_code text NOT NULL,

  -- Optional city override. NULL = whole province. Set = specific city.
  city_name text,

  -- Optional size tier. NULL = flat price for any size. Set = this row
  -- applies only to packages up to weight_max_grams.
  size_tier text CHECK (size_tier IS NULL OR size_tier IN ('xs','s','m','l','xl')),
  weight_max_grams int,

  -- Price in IDR cents (country-agnostic because the parent policy's
  -- country_code dictates how to display · all countries use integer
  -- minor units at this layer).
  price_cents int NOT NULL CHECK (price_cents >= 0),

  -- Preset delivery time range (days).
  delivery_days_min int NOT NULL CHECK (delivery_days_min >= 0),
  delivery_days_max int NOT NULL CHECK (delivery_days_max >= delivery_days_min),

  -- Optional per-row seller note shown to buyer at checkout.
  notes text,

  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nex_business_delivery_zone_business
  ON nex_business_delivery_zone (business_id, sort_order);

CREATE INDEX idx_nex_business_delivery_zone_lookup
  ON nex_business_delivery_zone (business_id, region_code);
```

### 2.3 · Country constants file (code, not DB)

Each supported country gets a `src/lib/nex-native/delivery/countries/<cc>.ts` with:
- Province list (ISO 3166-2 codes · common names · English names · regional group)
- Major cities per province (shipping-relevance curated · not exhaustive)
- Optional regulated tariff reference (Indonesia: Permenhub; other countries: whatever applies or `null`)
- Courier names (informational only)

Indonesia file already exists at `src/app/nex-native/delivery-prototype/_indonesia-data.ts` and will move to `src/lib/nex-native/delivery/countries/id.ts` on graduation.

Shared types + enums (`DeliveryTimePreset`, `DeliverySizeTier`, `formatters`) move to `src/lib/nex-native/delivery/types.ts`.

---

## 3 · Checkout flow integration (SEALED)

### 3.1 · Where delivery_quote lives in existing shape

Per audit 2026-10-22: `NexPeerCartOrderSnapshot` already carries a `delivery_quote` field with:
- `kind: "free" | "estimate" | "unknown"`
- `distance_km`
- `fare_pence`
- `eta_minutes`

The new policy will populate this field at checkout, replacing today's default of `kind: "unknown"`.

### 3.2 · Resolution rules

At checkout time, server computes delivery_quote by:
1. Load buyer's declared destination (region_code + city_name OR just region_code)
2. Query `nex_business_delivery_zone` for the seller's business, matching region_code
3. If city_name provided AND a city-specific override exists → use that row
4. Else if a whole-province row exists → use that row
5. Else if `pickup_only=true` → kind='free', eta_minutes=null, note="Pickup only"
6. Else → kind='unknown' (no matching zone · buyer sees "Ask seller about shipping")

### 3.3 · Auto-chat message after order (SEALED COPY)

When `sendCartOrderAction` succeeds, append a system message to the same conversation:

```
Thanks for your order! We are now processing and will confirm
dispatch time shortly.
```

Attributed to the SELLER (not NEX) so the buyer sees a natural "seller is responding" cadence. The seller then follows up with their own message confirming stock + lead time + actual dispatch window.

Fallback: if the seller's shop is marked `pickup_only=true`, message becomes:
```
Thanks for your order! Please collect from our pickup address.
We'll confirm when it's ready.
```

---

## 4 · Nudges + enforcement (SEALED)

### 4.1 · Dashboard banner

When owner has `offers_delivery=true` from shop creation but no `bike_price_per_km_cents` OR no cargo zones AND is not `pickup_only`:
- Show amber banner on `/manage/*` surfaces: *"⚡ Set your delivery prices before customers can checkout"*
- Links to `/manage/delivery`
- Dismiss-and-remind: banner reappears after 7 days if still incomplete
- Hard dismiss: hidden once policy has at least one valid price

### 4.2 · Shop status badge

On the owner's view of their own shop (not public), show:
- *"⚠ Delivery not configured"* until policy is complete
- *"✓ Delivery active"* after save

Public shop surface: no badge (buyers never see "misconfigured" · they just see the "Ask seller" fallback copy if no zone matches).

### 4.3 · Staleness nudge

After 90 days without `policy_updated_at` touched:
- One-time inline nudge on `/manage/delivery`: *"Prices last confirmed 90 days ago · still accurate?"*
- One-tap dismiss sets `staleness_nudge_dismissed_at = now()`
- Nudge re-arms 90 days after dismissal

### 4.4 · Checkout fallback (buyer-side)

When buyer is in a region/city NOT in the seller's zones:
- Checkout shows the row inline but says "Ask seller about shipping to your area · Rp —"
- "Ask seller" opens peer chat using the existing `shareProductToContactAction` flow from the Ask-Seller feature (Slice 1-5, 2026-10-22)
- Buyer can still complete checkout IF seller policy allows pickup OR if buyer accepts "price TBD · seller will confirm"

---

## 5 · Retirement path for legacy `/manage/info` Delivery textarea

Per audit 2026-10-22: `/manage/info/page.tsx:130-138` currently has a free-text "Delivery" textarea where sellers type their delivery info (toggle on/off, placeholder: "e.g. We deliver Ubud + Denpasar 08:00-21:00 · last order 20:30").

**Migration path:**
1. On first visit to the new `/manage/delivery` page, if the legacy field has content: show it as a non-editable reference block at the top ("Here's what you had in the old delivery info field — set your structured prices below")
2. Keep the legacy field read-only in `/manage/info` for 90 days after the new page ships
3. After 90 days: legacy field removed · reference block in `/manage/delivery` stays until owner saves at least one policy

**Why not auto-migrate the text:** free-text can't be parsed reliably into prices + zones. Showing it as reference lets the seller translate manually.

---

## 6 · What NOT to build (SEALED)

Each of these is a tempting feature we deliberately defer or decline:

| Tempting | Why we decline |
|---|---|
| Gojek/JNT/JNE API integration | Months of partnership work · enterprise contracts · uptime obligations. 90% of UX win comes from seller-declared prices. |
| Google Places autocomplete | $2.83 per 1,000 sessions · needs billing · Indonesian informal addresses don't autocomplete well. |
| Enforcement of declared price vs actual courier charge | NEX is not the logistics referee. Seller eats the delta or asks buyer for top-up. |
| "Request delivery quote" buyer flow | Would require NEX booking couriers. Pickup + chat fallback are enough. |
| Province-based delivery promotions ("free in Jakarta") | Owner can set `price_cents=0` on a specific zone row today. No new field needed. |
| Multi-currency per policy | `country_code` is per-policy. Multi-country storefronts open a separate country-selection problem out of scope here. |
| Weight-based auto-calculation from product metadata | Needs product weight field migration. Keep flat per-zone pricing for v1. |

---

## 7 · Honest limits (DISCLOSED)

- **GPS requires HTTPS.** The "Set my business location" button only works on `https://` or `localhost`. Over plain HTTP, browsers block geolocation. The error path shows this honestly.
- **Nominatim is OpenStreetMap-coverage-dependent.** Rural Indonesian addresses may fail the reverse-geocode suggestion. The fallback (manual address textarea) always works.
- **Permenhub tariffs are LEGAL FLOORS, not market rates.** Actual Gojek/Grab/Maxim prices run 15-30% higher under surge. The current UI frames the per-km input as "estimated from Gojek" — honest and non-regulatory.
- **No weight gate at order time.** Seller declares size tiers but NEX cannot verify the package weight. Seller takes on any delta between declared and actual.

---

## 8 · Build sequence (PROPOSED · not authorised)

Each is a separate authorisation gate.

### Phase A · Shop creation toggle (smallest)
Add the binary "I deliver / Pickup only" toggle to the shop-create form.
- Scope: 1 file in `/business-setup/*` + 1 field add on `nex_business` (`offers_delivery boolean DEFAULT false`)
- Risk: low · minimal UI add · no new routes

### Phase B · Dashboard nudge banner
Add the amber banner on `/manage/*` when policy is incomplete.
- Scope: 1 shared banner component + 1 helper to check policy state
- Risk: low · pure display

### Phase C · Dedicated page + schema (biggest)
Graduate the prototype to `/manage/delivery` with real DB persistence.
- Scope: 1 schema migration (2 tables) + 1 server action + 1 page + 1 layer helper
- Risk: medium · schema migration · needs real Supabase apply authorisation

### Phase D · Checkout quote integration
Wire `delivery_quote` population into `sendCartOrderAction`.
- Scope: resolver function + 1 server action edit
- Risk: medium · touches existing cart flow · needs careful testing

### Phase E · Auto-chat message
Append the "Thanks for your order" seller-attributed message to the conversation.
- Scope: 1 server action edit · copy sealed in Section 3.3
- Risk: low · additive

### Phase F · Legacy retirement
Mark `/manage/info` Delivery textarea read-only + reference-block it in `/manage/delivery`.
- Scope: 1 file edit · 90-day timer
- Risk: low · cosmetic

---

## 9 · Open sub-decisions (deliberately preserved)

These stay open for owner decision before Phase C begins:

**Q1 · Where do GPS coordinates live?** The prototype keeps lat/lng on the delivery policy. Alternative: reuse existing `nex_business.location_lat/_lng` and reference them. **Recommendation:** reuse. One source of truth across Visit Us panel + delivery.

**Q2 · Reverse-geocode on save or on tap?** Prototype fires on every "Set my location" tap. Production could cache the suggested address once and only re-geocode on "Re-verify". **Recommendation:** fire on every tap · low cost · owner expects fresh data.

**Q3 · Size tier definitions.** Prototype uses xs/s/m/l/xl with weight ceilings 500g/1kg/5kg/20kg/>20kg. These match SiCepat/JNT typical brackets but need confirmation with real sellers. **Recommendation:** validate with 3-5 pilot sellers before Phase C.

**Q4 · Should "offers_delivery=true" at shop-creation force the banner, or just show it?** Harder gate (shop can't go live until delivery is set) adds friction. Softer gate (banner only) lets shop go live incomplete. **Recommendation:** softer gate · let shop go live · nudge for completion. Phase B banner handles it.

**Q5 · Order of Phase A vs Phase C.** Could ship C first (full page) then A (toggle) · or A then C. **Recommendation:** A → B → C. Toggle captures intent at scale even without C. B surfaces completion gap. C delivers the full editor.

---

## 10 · Doctrine seal

**Status:** DRAFT · owner-recorded 2026-10-22.
**Authorisation required for:** Phase A (shop toggle) · Phase B (banner) · Phase C (page + schema) · Phase D (checkout wire) · Phase E (chat message) · Phase F (legacy retirement).

**No code changes land from this doctrine alone.** Each phase requires separate explicit authorisation referencing this document.

**Doctrine signatures of record:**
- Three-surface split (SEALED)
- Data model shape (SEALED · migration unauthorised)
- Auto-chat message copy (SEALED)
- Nudge behaviour (SEALED)
- Country-agnostic design (SEALED · Indonesia first)
- What-not-to-build list (SEALED)
