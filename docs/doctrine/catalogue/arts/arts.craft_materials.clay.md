# arts.craft_materials.clay — Clay (Craft)

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.craft_materials.clay` · EN "Clay" · ID "Tanah Liat / Lempung Kerajinan"
- Synonyms: polymer clay, air-dry clay, pottery clay, stoneware, porcelain clay, play clay
- Parent: Arts → Craft Materials → Clay

## D2 Required
product name, brand, clay_type enum (`polymer|air_dry|oven_bake_polymer|kiln_fire_stoneware|kiln_fire_porcelain|kiln_fire_earthenware|epoxy_clay|paper_clay|play_dough_non_hardening`), weight_g, colour.

## D3 Optional
model, firing_temp_c (kiln clays), bake_temp_c + bake_time_min (polymer), suitable_for_wheel (bool), suitable_for_handbuilding (bool), food_safe_after_firing (bool), oven_safe, dishwasher_safe.

## D4 Technical specs
weight_g, firing_temp_c, bake_temp_c, bake_time_min, shrinkage_percent.

## D5 Variant axes
- `colour` (max 30).
- `weight_g` (max 5).

## D6 Media
Min 2 / Max 5.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- ASTM D4236 art-material labelling.
- Polymer clay — ACMI AP non-toxic typically claimed.
- Food-safe-after-firing claim subject to lead/cadmium testing (EN 1388 / FDA).

## D9 Search attributes
Facets: clay_type, colour, weight_g, firing/bake_temp, suitable_for_wheel, food_safe_after_firing, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Tanah Liat | Clay |
| Clay Polymer | Polymer Clay |

## D12 Unresolved
- Food-safe-after-firing claims — regulatory evidence required.
