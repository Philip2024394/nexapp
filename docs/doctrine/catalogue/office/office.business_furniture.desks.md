# office.business_furniture.desks — Office Desks

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.business_furniture.desks` · EN "Office Desks" · ID "Meja Kantor"
- Synonyms: writing desks, workstations, sit-stand desks, executive desks
- Parent: Office → Business Furniture → Desks

## D2 Required
product name, brand, desk_type enum (`writing|executive|workstation|sit_stand_manual|sit_stand_electric|corner|standing_only|reception`), top_material, frame_material, dimensions_wdh_mm, max_load_capacity_kg.

## D3 Optional
model, cable_management (bool), drawer_count, drawer_lockable (bool), monitor_arm_grommet (bool), colour, finish, warranty_months, assembly_required (bool), country_of_origin.

## D4 Technical specs
width_mm, depth_mm, height_mm (or height_range_min_max_mm for sit-stand), weight_kg, max_load_capacity_kg, lift_capacity_kg (sit-stand electric), lift_speed_mm_per_s.

## D5 Variant axes
- `top_colour_or_finish` (max 8).
- `top_width_mm` or `top_size_combo` (max 5).

## D6 Media
Min 4 / Max 10. Front, side profile, cable management, underside.

## D7 Commercial
Fixed. Returnable yes if unassembled + sealed. Freight shipping (large/heavy).

## D8 Compliance
- BIFMA X5.5 (desk strength/durability) [VERIFIED].
- Electric sit-stand: motor safety IEC 60335; EMC per region.
- Formaldehyde emissions on engineered-wood tops (CARB P2 / E1 / E0) [UNRESOLVED enforcement].

## D9 Search attributes
Facets: desk_type, width range, depth range, top_material, frame_material, colour, max_load, brand, price. Sort: price, width.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Meja Kantor | Office Desk |
| Meja Kerja | Work Desk |
| Meja Berdiri | Standing Desk |

## D12 Unresolved
- Formaldehyde emission disclosure — not uniform across markets. Propose seller-declared certification claim.
- CARB P2 is US-focused — ID has SNI standards for formaldehyde but less marketed.
