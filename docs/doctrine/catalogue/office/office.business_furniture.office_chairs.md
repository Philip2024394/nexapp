# office.business_furniture.office_chairs — Office Chairs

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.business_furniture.office_chairs` · EN "Office Chairs" · ID "Kursi Kantor"
- Synonyms: task chairs, executive chairs, ergonomic chairs, mesh chairs
- Parent: Office → Business Furniture → Office Chairs

## D2 Required
product name, brand, chair_type enum (`task|executive|ergonomic|mesh|conference|drafting|gaming_office|visitor`), weight_capacity_kg, upholstery_material, has_wheels (bool), has_armrests (bool).

## D3 Optional
model, armrests_adjustable (bool, axes 2d/3d/4d), lumbar_support (`fixed|adjustable|none`), reclining (bool), tilt_tension_adjustable (bool), seat_height_range_mm, headrest (`fixed|adjustable|none`), footrest (bool), colour, warranty_months, assembly_required (bool).

## D4 Technical specs
width_mm, depth_mm, min_height_mm, max_height_mm, seat_width_mm, seat_depth_mm, weight_kg, weight_capacity_kg.

## D5 Variant axes
- `colour` (max 8).
- `size` (M/L for ergonomic) (max 3).

## D6 Media
Min 4 / Max 10. Front, side, back, close-up of casters + mechanism.

## D7 Commercial
Fixed. Returnable yes if sealed. Freight.

## D8 Compliance
- BIFMA X5.1 (chair durability + safety) [VERIFIED].
- ISO 24496 (office chairs) [VERIFIED].
- EN 1335 (EU office chair ergonomics) [VERIFIED].
- Hazmat: gas-strut shipping is restricted (compressed gas) — air shipping often forbidden [UNRESOLVED — case-by-case].

## D9 Search attributes
Facets: chair_type, weight_capacity, armrest_adjustable, lumbar_support, upholstery_material, colour, brand, price. Sort: price, weight_capacity.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Kursi Kantor | Office Chair |
| Kursi Ergonomis | Ergonomic Chair |
| Kursi Direktur | Executive Chair |

## D12 Unresolved
- **Gas-strut shipping restriction** — compressed-gas lift mechanism may be restricted by air carriers. Flag for seller shipping copy.
- Weight-capacity rating accuracy — safety-sensitive; propose "as declared by manufacturer".
