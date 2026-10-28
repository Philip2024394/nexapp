# office.packaging_shipping.mailing_bags — Mailing Bags

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.packaging_shipping.mailing_bags` · EN "Mailing Bags" · ID "Kantong Pengiriman"
- Synonyms: poly mailers, courier bags, postal bags
- Parent: Office → Packaging & Shipping → Mailing Bags

## D2 Required
product name, material (`ldpe|hdpe|coex|biodegradable|recycled_paper|tyvek`), external_dimensions_wh_mm, thickness_microns, closure_type (`self_seal|peel_strip|tie|zip`), colour, pack_count.

## D3 Optional
tear_strength_rating, waterproof (bool), opaque (bool), has_return_strip (bool), recycled_content_percent, biodegradable_certified (bool, which cert).

## D4 Technical specs
external_width_mm, external_height_mm, thickness_microns, pack_count, pack_weight_g.

## D5 Variant axes
- `size` typically separate SKU.
- `colour` (max 10), `pack_count` (max 5).

## D6 Media
Min 1 / Max 4.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- Biodegradable claims — must match specific cert (TÜV OK Compost, DIN CERTCO, BPI) [UNRESOLVED verification].

## D9 Search attributes
Facets: material, dimensions, thickness, closure_type, colour, pack_count, biodegradable, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Kantong Pengiriman | Mailing Bag |
| Plastik Packing | Packing Plastic |

## D12 Unresolved
- Biodegradable certification enforcement.
