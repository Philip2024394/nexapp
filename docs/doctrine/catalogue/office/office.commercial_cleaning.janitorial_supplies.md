# office.commercial_cleaning.janitorial_supplies — Janitorial Supplies

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.commercial_cleaning.janitorial_supplies` · EN "Janitorial Supplies" · ID "Perlengkapan Kebersihan"
- Synonyms: mops, buckets, brooms, dustpans, caddies, dispensers
- Parent: Office → Commercial Cleaning → Janitorial Supplies
- **Umbrella leaf.**

## D2 Required
product name, item_type enum (`mop_handle|mop_head|bucket|wringer|broom|dustpan|caddy|dispenser_soap|dispenser_paper|duster|microfibre_cloth`), material, colour (where applicable), pack_count.

## D3 Optional
model, colour_coded_system (red/yellow/blue/green), capacity_litres (buckets), washable (bool), lint_free (bool).

## D4 Technical specs
dimensions, weight_g, pack_count.

## D5 Variant axes
- `colour` (max 6 — colour-coded cleaning system standard).
- `pack_count` (max 5).

## D6 Media
Min 1 / Max 4.

## D7 Commercial
Fixed. Bulk pricing.

## D8 Compliance
Colour-coded cleaning system (red = toilets, yellow = washroom, blue = low-risk, green = kitchen) — convention, not standard [CONVENTION HSE guidance].

## D9 Search attributes
Facets: item_type, colour, pack_count, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Alat Kebersihan | Cleaning Tool |
| Pel | Mop |
| Sapu | Broom |

## D12 Unresolved
- Umbrella — post-launch split by sub-category.
