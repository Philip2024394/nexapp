# office.hospitality.food_prep — Food Prep (Umbrella)

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.hospitality.food_prep` · EN "Food Prep" · ID "Persiapan Makanan"
- Synonyms: chef knives, cutting boards, prep tables, mixing bowls, food containers (hospitality)
- Parent: Office → Hospitality & Catering → Food Prep
- **Umbrella leaf.**

## D2 Required
product name, item_type enum (`chef_knife|paring_knife|cleaver|boning_knife|cutting_board|prep_table_stainless|mixing_bowl|food_container|measuring_cup|measuring_jug|food_scale|peeler|strainer`), material, food_safe (bool), dimensions_or_capacity.

## D3 Optional
blade_length_mm (knives), handle_material, blade_steel_grade, hrc_hardness (knives), dishwasher_safe, nsf_certified.

## D4 Technical specs
dimensions_mm, weight_g, capacity_ml.

## D5 Variant axes
- `size` or `capacity` typically separate SKU.

## D6 Media
Min 2 / Max 6.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- NSF/ANSI 51 food-equipment materials [VERIFIED].
- **Bladed items**: age-gate 18+ in many jurisdictions (UK, DE etc.) [UNRESOLVED].
- Cutting boards: material-specific food-contact rules.

## D9 Search attributes
Facets: item_type, material, food_safe, dishwasher_safe, size/capacity, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Pisau Chef | Chef Knife |
| Talenan | Cutting Board |
| Meja Dapur | Prep Table |

## D12 Unresolved
- Age-gate for knives — jurisdictional.
- Umbrella — split post-launch.
