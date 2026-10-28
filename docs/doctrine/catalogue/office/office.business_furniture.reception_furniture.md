# office.business_furniture.reception_furniture — Reception Furniture

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.business_furniture.reception_furniture` · EN "Reception Furniture" · ID "Furnitur Resepsionis"
- Synonyms: reception desks, lobby sofas, waiting chairs, lobby benches
- Parent: Office → Business Furniture → Reception Furniture
- **Umbrella leaf.**

## D2 Required
product name, brand, item_type enum (`reception_desk|lobby_sofa|waiting_chair|lobby_bench|coffee_table|reception_counter`), seating_capacity (for sofas/benches), dimensions_wdh_mm, upholstery_material (where applicable).

## D3 Optional
model, finish, colour, has_lockable_storage (reception desks), accessible_counter_height (bool), warranty_months, assembly_required.

## D4 Technical specs
width_mm, depth_mm, height_mm, weight_kg, weight_capacity_kg (seating).

## D5 Variant axes
- `colour`/`fabric` (max 10).
- `size` (max 3).

## D6 Media
Min 3 / Max 10.

## D7 Commercial
Fixed. Returnable yes if sealed. Freight.

## D8 Compliance
- BIFMA where applicable.
- Flame-retardancy standards (CAL TB117, BS 5852) for upholstered seating [UNRESOLVED jurisdictional].

## D9 Search attributes
Facets: item_type, seating_capacity, upholstery, colour, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Meja Resepsionis | Reception Desk |
| Sofa Tunggu | Waiting Sofa |

## D12 Unresolved
- Umbrella — may split post-launch.
- Fire-safety ratings for commercial seating — jurisdictional variance.
