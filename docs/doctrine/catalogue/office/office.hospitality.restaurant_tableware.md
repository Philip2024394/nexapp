# office.hospitality.restaurant_tableware — Restaurant Tableware

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.hospitality.restaurant_tableware` · EN "Restaurant Tableware" · ID "Peralatan Makan Restoran"
- Synonyms: dinnerware, plates, bowls, cutlery, glassware (hospitality grade), serving ware
- Parent: Office → Hospitality & Catering → Restaurant Tableware

## D2 Required
product name, brand, item_type enum (`plate|bowl|cup|mug|cutlery_knife|cutlery_fork|cutlery_spoon|cutlery_set|glassware|serving_dish|platter|ramekin|teapot`), material (`porcelain|ceramic|melamine|stoneware|bone_china|tempered_glass|crystal_glass|stainless_steel|silver_plated`), dimensions_mm, pack_count.

## D3 Optional
model, dishwasher_safe (bool), microwave_safe (bool), oven_safe (bool), food_safe (bool), bpa_free (bool), colour, finish.

## D4 Technical specs
diameter_mm (plates/bowls), height_mm, capacity_ml (cups/bowls), weight_g, pack_count.

## D5 Variant axes
- `pack_count` (max 10).
- `colour` or `finish` (max 8).
- `size` (max 5).

## D6 Media
Min 2 / Max 6.

## D7 Commercial
Fixed. Returnable yes if sealed. Fragile — packaging note.

## D8 Compliance
- EN 1388 food-contact ceramic (lead/cadmium limit) [VERIFIED].
- FDA 21 CFR 109 (US food-contact).
- SNI for ID.
- Melamine formaldehyde migration — EN 10/2011 EU plastic food-contact [VERIFIED].

## D9 Search attributes
Facets: item_type, material, pack_count, dishwasher_safe, colour, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Piring | Plate |
| Mangkuk | Bowl |
| Gelas | Glass |
| Alat Makan | Cutlery |

## D12 Unresolved
- Food-safe/dishwasher-safe claims — seller-declared.
- Lead/cadmium testing for imported ceramic — certification mandatory in some markets.
