# office.warehouse.work_platforms — Work Platforms

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.warehouse.work_platforms` · EN "Work Platforms" · ID "Platform Kerja"
- Synonyms: step stools, mobile platforms, warehouse ladders, podium ladders
- Parent: Office → Warehouse Equipment → Work Platforms

## D2 Required
product name, brand, platform_type enum (`step_stool|podium_ladder|mobile_platform|rolling_ladder|fixed_platform`), working_height_mm, load_class (EN 131 Class I professional / II trade / III domestic) [VERIFIED EN 131], platform_dimensions_mm, material (`aluminium|steel|fibreglass`).

## D3 Optional
foldable, lockable_wheels (bool), handrail (bool), guard_rail_height_mm, max_user_weight_kg.

## D4 Technical specs
width_mm, depth_mm, height_closed_mm, height_open_mm, working_height_mm, weight_kg, max_user_weight_kg.

## D5 Variant axes
- `height` typically separate SKU.

## D6 Media
Min 3 / Max 6.

## D7 Commercial
Fixed. Returnable yes if sealed. Freight for large models.

## D8 Compliance
- EN 131 (EU ladder) [VERIFIED].
- EN 14183 step stool.
- ANSI A14 (US).
- OSHA 1910.23 (fixed platforms, US).

## D9 Search attributes
Facets: platform_type, working_height, load_class, material, foldable, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Tangga Kerja | Work Ladder |
| Platform Kerja | Work Platform |

## D12 Unresolved
- EN 131 class claim verification.
