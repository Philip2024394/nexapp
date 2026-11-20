# Delivery flow · gaps between master prompt and current implementation

**Authored:** 2026-11-18 · Phase Delivery
**Status:** findings · not fixes · each item is explicit about why it is
not resolved in this pass
**Co-active work:** Phase W wholesale (see
`evidence/master-flow/wholesale-2026-11-18/HANDBACK.md`) · the delivery
pass is strictly disjoint from wholesale's freight-on-request path

This note records discrepancies discovered between the master build
prompt "COMPLETE EXISTING DELIVERY FLOWS, COORDINATED WITH WHOLESALE"
and the implementation that already exists in `C:/Users/Victus/nexapp`.
Each item is written so a future worker — or the owner — can decide
whether the implementation should change, the prompt should be
clarified, or the mismatch should be left intentional.

---

## G1 · Per-ring vs per-kilometre pricing

**Master prompt (§3) wording**
> seller-set delivery fee per kilometre

**What exists**
`src/lib/nex-native/catalogue/delivery-spec.ts` (sealed owner directive
2026-10-31) models local delivery as a **list of radius rings** where
each ring has a flat price:

```ts
LocalRadiusEntry = { km, price_pence, currency, delivery_days? }
LocalDeliverySpec = { radii: [...] }
```

The seller UI (`DeliveryEditor.tsx` → `LocalBlock`) presents a km-radius
dropdown (5 / 10 / 15 / 20 / 25 / 30 / 50 / 100) with one price per row,
not a per-km rate.

**Why the mismatch matters**
The master prompt is explicit about honest labelling: *"never silently
substitute one for the other"*. A per-ring UI MUST NOT be presented as a
per-kilometre rate; the fee for a 7 km trip in the current model is the
flat price of the 10 km ring, not `7 × per_km_rate`.

**Not resolved in this pass because**
1. The ring model is sealed by owner directive 2026-10-31 — changing it
   is an architectural decision, not a bug fix.
2. Both models are defensible (ring = simpler for sellers; per-km = more
   granular for buyers). Owner should choose.

**Required to resolve**
Owner decision: keep rings, switch to per-km, or support both. If the
answer is "keep rings", the master prompt wording for future delivery
phases should be revised to say *per-ring*, not *per-kilometre*.

---

## G2 · Distance semantics · Haversine, not routed road distance

**Master prompt (§3) wording**
> Prefer routed road distance for both the maximum-distance check and
> fee calculation so a buyer within a straight-line circle is not
> promised an impractical journey. If the existing implementation uses
> a geographic radius instead, label the radius accurately and
> distinguish it from billable road kilometres; never silently
> substitute one for the other.

**What exists**
Two independent Haversine implementations:

1. `src/lib/nex-native/bike-delivery-service.ts` → `haversineKm()` plus
   a `1.25×` "road correction" applied inside `estimateBikeFare()` so
   the Indonesian-bike-rate quote ships with an acknowledged
   straight-line-based figure.
2. `src/app/nex-native/directory/_distance.ts` → `haversineKm()`, pure
   straight-line, used for directory distance chips.

No routing API (Mapbox / Google / OSRM / Valhalla) is imported anywhere
in `src/`. `grep` over the entire source tree returns zero matches.

**Why the mismatch matters**
A buyer 7 km straight-line from a shop could be 12 km by road. Charging
the 10 km ring would lose the seller money; charging the 15 km ring
without disclosing the correction would misprice the trip. The master
prompt is explicit that a geographic-radius model must be *labelled*,
not silently treated as road distance.

**What this pass contributes**
`src/lib/nex-native/delivery/local-delivery-quote.ts` emits a
`distanceKind: "straight_line_haversine"` field on every successful
quote so UIs cannot forget the honest label. The existing cart
estimator already acknowledges the 1.25× correction in a code comment
but surfaces it as part of a human-readable "NEX estimate" label; no
quiet assumption is baked anywhere I found.

**Not resolved in this pass because**
Adding a routing API would:
1. Introduce a paid third-party dependency (master prompt §2 forbids
   this without separate approval).
2. Change the economics of the quote (road distance is almost always
   longer).
3. Require a new environment variable + server-side credential.

**Required to resolve**
Owner authorisation to adopt a specific routing provider, OR owner
confirmation that straight-line + explicit label is acceptable.

---

## G3 · DeliveryEditor seller input is NOT wired into the cart buyer quote

**What exists**
- Seller UI writes to `nex_product.spec.__delivery.local.radii` and
  `.export.countries` (persisted via `_actions.ts` save-product handler).
- Buyer-side cart (`src/app/nex-native/cart/*`) computes its delivery
  quote via `estimateBikeFareBetween()` in `bike-delivery-service.ts`.
  That function uses a HARDCODED Indonesian bike-hail rate (base Rp
  9,000 + Rp 2,500/km + Rp 12,000 min) and does **not read** the
  seller's radius rings.

**Consequence**
Every Indonesian seller's product edit of delivery rings is currently
**BUILT-UNWIRED** for the buyer path: the UI accepts the input, the DB
stores the value, the buyer cart ignores it and quotes the generic
bike-service rate instead.

**Not resolved in this pass because**
The three files that would need to change (`src/app/nex-native/cart/_client.tsx`,
`src/app/nex-native/cart/_checkout-sheet.tsx`, `src/app/nex-native/_actions.ts`)
all carry concurrent uncommitted work. The master-prompt envelope §1
explicitly prohibits disturbing concurrent work or the running :3008
server.

**What this pass contributes**
`src/lib/nex-native/delivery/local-delivery-quote.ts` is the pure
resolver that wires the gap. Dropping it into the cart client (replace
the `estimateBikeFareBetween` call) and into `sendCartOrderAction`
(replace the structure-only validation) would close G3 end-to-end
without further schema work.

**Required to resolve**
Concurrent-work settlement on the three listed files, then a narrow
3-call wiring:
1. Cart client reads `product.spec.__delivery.local.radii`, calls
   `quoteLocalDelivery`, surfaces either the fare or a BLOCKED state
   (no_rings / out_of_range / missing_destination).
2. `sendCartOrderAction` recomputes the quote server-side with the
   same resolver, compares via `isSubmittedLocalQuoteAuthentic`, and
   rejects the send on mismatch.
3. Nothing else.

---

## G4 · sendCartOrderAction validates structure, not authenticity

**Master prompt (§4) wording**
> Server-side checks must reject tampered distances, prices, origins
> and unsupported destinations; do not trust a client-submitted fee.

**What exists**
`src/app/nex-native/_actions.ts:2769-2801` validates `delivery_quote`
as follows:

```
if kind === "estimate":
  distance_km, fare_pence, eta_minutes must each be positive numbers
  currency is forced to "IDR"
```

That is: it rejects negative / missing / non-finite values but ACCEPTS
any positive fare the client submits. A buyer who crafts a POST body
with `fare_pence: 1` passes validation.

**Why the mismatch matters**
The sealed slice-0.6b Fix A comment (2026-10-18) explicitly says
*"strict typed validation per quote kind"* — this prevented *nonsense*
quotes (zero fare for "estimate") but the comment does NOT claim to
verify fare authenticity against seller configuration, and the code
indeed does not.

**Not resolved in this pass because**
`_actions.ts` is on the concurrent-work modified list (see git status
output in handback §6). Any edit here collides with in-flight owner
work.

**What this pass contributes**
`isSubmittedLocalQuoteAuthentic()` + `quoteLocalDelivery()` pair, ready
to drop into `sendCartOrderAction`. Covered by 11 of the 16 D1 tests.

**Required to resolve**
Concurrent-work settlement, then a ~10 line insertion in
`sendCartOrderAction` right after the existing structural validation.

---

## G5 · No shop-level default · each product carries its own rings

**Master prompt (§3) wording**
> Apply the shop default across eligible food, drink and physical
> products without repetitive product entry.

**What exists**
- `nex_business` carries `location_lat`, `location_lng` (sealed
  migration 082), but no shop-level delivery pricing columns.
- `spec.__delivery.local.radii` is a per-product field. A seller with
  10 products currently re-enters the same ring list 10 times.

**Why the mismatch matters**
The master prompt wants a single shop default. The existing DB and UI
make every product carry its own rings. A naive patch that reads from
a non-existent shop column would silently succeed with empty rings
(sellers' entered values ignored) — exactly the kind of silent failure
master-prompt §1 forbids.

**Not resolved in this pass because**
Requires a migration that:
1. Adds `nex_business.default_delivery_radii jsonb` (or equivalent).
2. Changes the editor to default-fill from the shop row on new
   products.
3. Changes `extractDelivery()` to fall back to the shop default when
   the product jsonb is empty.
4. Preserves existing per-product overrides.

This is an architectural change, not a bug fix.

**Required to resolve**
Owner decision on the shape of the shop default, then a migration
proposal (sandbox-only, PROPOSAL per sealed envelope) authored
analogously to migration 350.

---

## G6 · Export rates are per-product, not shop-level · same shape question

Mirror of G5 for export. Every product carries its own country list.
Same architectural choice applies. Not resolved for the same reason.

---

## G7 · Multi-unit export · no per-item rule

**Master prompt (§5) wording**
> A country price must say what it covers: one item, an additional-item
> rule, a bounded quantity/weight band, or a defined parcel. Do not
> multiply or combine rates by guesswork; prevent a five-item order
> silently receiving an unsupported one-item shipping fee.

**What exists**
The sealed `ExportCountryEntry` shape has `{ iso, price_pence, currency,
delivery_days? }` — no per-item rule, no additional-item field, no
weight band.

**What this pass contributes**
`isExportQuoteValidForQuantity()` returns `false` for any
`quantity > 1` (see `export-shipping-quote.ts`). Calling code MUST use
this guard before multiplying the export fare by quantity. Four of the
test cases in D2 pin this guard.

**Not resolved by schema change in this pass because**
Extending `ExportCountryEntry` is an owner-level architectural
decision, not something to be invented in a verification pass.

**Required to resolve**
Owner directive on the per-item rule shape, then schema extension,
then an editor UI change to collect it.

---

## G8 · Pickup / local / domestic / international surfaces are not clearly separated

**Master prompt (§2) wording**
> Separate fulfilment choices clearly using existing appropriate
> terminology: Pickup; Local delivery; Domestic/nationwide shipping;
> International/export shipping.

**What exists**
- "Local delivery" and "Export (cross-border)" are distinct blocks in
  `DeliveryEditor.tsx`.
- "Pickup" is not an explicit toggle in the sealed delivery substrate
  (dropped per owner directive 2026-10-31: "no pickup toggles").
- "Domestic/nationwide shipping" is not represented — the current model
  has only local-ring + export-country. A seller shipping anywhere in
  Indonesia today has to enter "Indonesia" as an export country or
  oversize the largest local ring.

**Why the mismatch matters**
A seller in Jakarta shipping to Bali today has no clean path in the
current schema. The buyer also cannot filter pickup-only shops.

**Not resolved in this pass because**
Requires schema extension (pickup toggle on either business or product)
and either a per-country price table or domestic-flat-rate column.

**Required to resolve**
Owner decision on whether to re-introduce the pickup toggle that was
dropped 2026-10-31, and whether to add a third fulfilment surface
(domestic) between local-rings and export-countries.

---

## G9 · No forbidden commission / gojek-comparison copy was added

**Master prompt (§2) wording**
> Do not promise a guaranteed 25–30% saving against Gojek/GoFood… The
> truthful claim is no Nex sales commission, with seller delivery costs
> still payable.

**What this pass contributes**
Nothing was added. `grep` for `30%`, `25%`, `commission`, `GoFood`
returned zero matches in files I authored. The existing codebase (not
touched) was not audited for this; a follow-up grep on `src/app/**`
would be a cheap pre-launch check.

---

## G10 · Bike-delivery rates are Indonesian-hardcoded

**What exists**
`bike-delivery-service.ts` hardcodes `NEX_BIKE_DELIVERY_RATE = { base
Rp 9,000, per-km Rp 2,500, min Rp 12,000 }` with `currency: "IDR"`.

**Why it matters for this master prompt**
The master prompt (§2) explicitly says "Nex supplies delivery tools,
not a mandatory courier or guaranteed courier price" — a hardcoded
Indonesian bike rate contradicts that framing for every non-Indonesian
market.

**Not resolved in this pass because**
The module is sealed Bridge 25c and is the current cart estimator. A
replacement must come from G3's wiring (buyer cart reads the seller's
own rings instead), not by patching the Indonesian constants out from
under the existing Indonesian sellers.

---

## Summary table

| # | Topic | Master prompt | Current impl | Resolved this pass |
|---|---|---|---|---|
| G1 | Pricing model | per-km | per-ring | documented |
| G2 | Distance | routed road (preferred) | straight-line Haversine | labelled honestly in D1 |
| G3 | Seller→buyer wire | end-to-end | BUILT-UNWIRED | pure resolver authored |
| G4 | Server tamper reject | required | structure only | pure helper authored |
| G5 | Shop-level default | required | per-product only | documented |
| G6 | Export shop default | required | per-product only | documented |
| G7 | Multi-unit export | per-item rule required | none in schema | `isExportQuoteValidForQuantity` guard |
| G8 | Fulfilment surfaces | pickup/local/domestic/export | local/export only | documented |
| G9 | Honest commission copy | required | not audited | no new false copy added |
| G10 | Bike-rate hardcode | tool not courier | Indonesian hardcode | documented |

None of G1-G10 is **fixed** by this pass. G2 + G3 + G4 + G7 are
**partially closed** by pure libraries that are ready to drop into the
concurrent-work files once those settle.

---

**Classification**
- G1, G5, G6, G8 → owner architectural decision required
- G2, G10 → owner authorisation or confirmation
- G3, G4, G7 → concurrent-work settlement + narrow wiring (no migration)
- G9 → pre-launch grep; cheap
