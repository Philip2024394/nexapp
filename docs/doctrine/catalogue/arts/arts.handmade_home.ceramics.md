# arts.handmade_home.ceramics — Ceramics (Handmade)

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.handmade_home.ceramics` · EN "Ceramics" · ID "Keramik Buatan Tangan"
- Synonyms: pottery, stoneware, porcelain, earthenware
- Parent: Arts → Handmade Home Goods → Ceramics

## D2 Required
product name, maker_or_atelier, ceramic_type enum (`stoneware|porcelain|earthenware|raku|terracotta|unglazed`), object_type (`mug|cup|bowl|plate|vase|teapot|planter|tile|other`), dimensions_mm, finish (`glazed|unglazed|partial_glaze`), food_safe (bool), microwave_safe (bool), dishwasher_safe (bool).

## D3 Optional
model, firing_temp_c, lead_cadmium_tested (bool), hand_signed, kiln_type, country_of_origin, oven_safe, is_one_of_a_kind.

## D4 Technical specs
width_mm, height_mm, depth_mm, capacity_ml (vessels), weight_g, firing_temp_c.

## D5 Variant axes
- `colour` or `glaze` (max 10).
- `size` (max 4).

## D6 Media
Min 3 / Max 8.

## D7 Commercial
Fixed. Fragile — insured shipping recommended. Returnable yes unless one-of-a-kind.

## D8 Compliance
- EN 1388 food-contact ceramic (lead/cadmium limits) [VERIFIED].
- FDA 21 CFR 109; SNI for ID.
- Hand-painted food-contact ceramics specifically regulated.

## D9 Search attributes
Facets: ceramic_type, object_type, finish, food_safe, dishwasher_safe, microwave_safe, maker, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Keramik | Ceramic |
| Gerabah | Earthenware |
| Porselen | Porcelain |

## D12 Unresolved
- Food-safe claim verification — lead/cadmium testing cost often prohibitive for small makers; copy must honour "as described by maker".
