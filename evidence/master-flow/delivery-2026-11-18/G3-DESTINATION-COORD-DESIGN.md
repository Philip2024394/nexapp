# G3 · Destination-coordinate wiring · Design + safe-wiring plan · 2026-11-18

## Problem statement

**G4 landed · fare-vs-claimed-km.** If the client posts
`delivery_quote.kind="estimate"` with `distance_km` and `fare_pence`, the
server re-runs `estimateBikeFare(distance_km)` and refuses when
`fare_pence` doesn't match the sealed rate card. This stops fare tampering.

**G3 does NOT prove actual distance.** A malicious or buggy client can
still post `distance_km: 1` with the matching `fare_pence` for 1 km and
pay the minimum bike fare for a 30 km ride. The server has no trusted
origin → destination distance today.

## What currently exists (reusable, no migration)

| Piece | Location | Notes |
|---|---|---|
| `haversineKm(aLat, aLng, bLat, bLng)` | `src/lib/nex-native/bike-delivery-service.ts:55` | pure, no deps |
| `estimateBikeFare(distanceKm)` | `src/lib/nex-native/bike-delivery-service.ts:77` | sealed rate card |
| `estimateBikeFareBetween(fromLat, fromLng, toLat, toLng)` | `src/lib/nex-native/bike-delivery-service.ts:99` | wraps the two above |
| Seller origin lat/lng | `nex_business.location_lat` + `.location_lng` (columns already exist, seller setup UI writes them) | business-service.ts writes via admin |
| Cart single-seller invariant | `sendCartOrderAction` already resolves ONE `business_id` for the whole cart | Memory #5 |

## What is missing (the real gate)

**Buyer destination coords are not in the payload.** Today's cart
`delivery_address` JSONB field has:
```
{ recipient_name, phone, street, street_2, city, region, postal_code, country, notes }
```
No `lat` or `lng`. The buyer address-entry UI is a plain text form at
checkout — there is no map picker, no geocoder call, no coord capture.

So the authoritative-distance path breaks into two sub-gates:

### G3-UI · buyer coord capture (UI work · no migration)
The checkout address step needs to EITHER
- (a) show a map picker (OSM / Leaflet) that returns lat/lng, OR
- (b) call a geocoder (OSM Nominatim is free + already allowed by
  `landing-feed-service.ts` which uses `haversineKm` on seller coords)
  against the typed address, surface the pin for buyer confirmation.

This is UI work only. The JSONB column accepts any shape — writing
`lat` and `lng` into `delivery_address` requires no schema change.

### G3-Server · trust-the-coords validation (server work · no migration)
Once `delivery_address.lat/lng` arrive:
1. Parse them in `sendCartOrderAction` with the same `Number.isFinite + > 0` discipline the existing block uses (~line 2815).
2. Resolve the cart's single seller business_id, read `location_lat/lng`.
3. `authoritativeKm = haversineKm(sellerLat, sellerLng, buyerLat, buyerLng)`.
4. If `deliveryQuote.distance_km` and `authoritativeKm` differ by more than a tolerance (proposal: ±0.6 km, which covers Haversine vs road rounding plus the 1.25× correction factor in `estimateBikeFare`), refuse with "Delivery distance disputed · please refresh the quote".
5. Re-run `estimateBikeFare(authoritativeKm)` and refuse if `fare_pence` doesn't match (strict G3+G4 combined).
6. If `deliveryAddress.lat/lng` are ABSENT, the current G4 behaviour stays (fare-vs-claimed-km only). This keeps the change backward-compatible with any client that hasn't been updated — no regression on existing paths.

## Why this is NOT MIG-352

I previously named this gate MIG-352. That was incorrect:
- `delivery_address` is already JSONB; adding lat/lng keys is schema-free.
- `nex_business.location_lat/lng` already exist.
- No new table, column, constraint, index or RLS policy is required.

The real dependency is **UI work + a coordinated server parse**, both of
which are implementable in this repo with no DB touch. **MIG-352 is
withdrawn.** Owner gate renamed to **G3-UI + G3-Server**, both
code-only.

## Order of operations when owner authorises G3

1. **G3-Server first** · add the optional parse + authoritative-km
   check, guarded on `lat/lng` presence so no existing client breaks.
2. **Unit tests** · extend `send-cart-order-slice-0.test.ts` with
   cases for: coords present + match, coords present + mismatch
   (refused), coords absent (G4 fallback preserved), coords present
   but seller lat/lng missing (fail closed with "delivery_not_possible").
3. **G3-UI** · map picker or geocoder + coord confirmation. Needs
   separate approval naming the geocoder/provider ("use OSM Nominatim"
   or "use native browser geolocation only") because it introduces a
   dependency choice.

## Status

| Sub-gate | Verdict | What's needed to clear |
|---|---|---|
| G3-Server | NOT YET IMPLEMENTED | Owner says "wire G3 server distance check" |
| G3-UI | NOT YET IMPLEMENTED | Owner authorises geocoder/map provider |
| G4 | DONE · 2026-11-18 | `_actions.ts` ~line 2805 |
| G7 | DONE · 2026-11-18 | `_actions.ts` ~line 2940 (product item loop) |
| MIG-352 | WITHDRAWN · never needed · see above | — |

## Non-goals

- Routing-API distance (Mapbox / Google Directions). The straight-line
  haversine with the sealed 1.25× road correction is the sealed model.
- Server-side geocoding on write. The server trusts coords because the
  buyer confirmed them in a map picker — it does not re-geocode.
- Speculative deliveries beyond the sealed bike-delivery rate card.
