# arts.craft_materials.craft_tools — Craft Tools (Umbrella)

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.craft_materials.craft_tools` · EN "Craft Tools" · ID "Alat Kerajinan"
- Synonyms: craft scissors, hobby knives, hole punches, die cutters, embossing tools, mats, rulers (craft)
- Parent: Arts → Craft Materials → Craft Tools
- **Umbrella leaf.**

## D2 Required
product name, tool_type enum (`craft_scissors|hobby_knife|rotary_cutter|guillotine_cutter|hole_punch|shape_punch|die_cutter_manual|die_cutter_electric|embossing_tool|cutting_mat|craft_ruler|bone_folder|awl|craft_gun`), material, dimensions_or_size.

## D3 Optional
model, blade_count (die cutters), cutting_depth_mm, usb_power (electric die cutters), self_healing (mats), grid_marked (mats).

## D4 Technical specs
dimensions, weight_g, blade_count.

## D5 Variant axes
- `size` typically separate SKU.

## D6 Media
Min 2 / Max 5.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- **Bladed items**: age-gate 18+ in several jurisdictions.
- Electric die cutters: electrical safety IEC 62368-1.

## D9 Search attributes
Facets: tool_type, dimensions, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Alat Kerajinan | Craft Tool |
| Gunting Kerajinan | Craft Scissors |
| Pisau Hobi | Hobby Knife |

## D12 Unresolved
- Umbrella — may split post-launch.
