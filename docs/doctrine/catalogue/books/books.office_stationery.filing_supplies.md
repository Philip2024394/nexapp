# books.office_stationery.filing_supplies — Filing Supplies

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.office_stationery.filing_supplies` · EN "Filing Supplies" · ID "Perlengkapan Arsip"
- Synonyms: folders, binders, hanging files, dividers, document pouches
- Parent: Books → Office Stationery → Filing Supplies

## D2 Required
product name, brand, filing_type enum (`manila_folder|hanging_file|ring_binder|lever_arch|box_file|document_sleeve|divider_set|expanding_file`), size (A4|A3|foolscap|letter|legal), capacity (sheets or ring diameter mm for binders).

## D3 Optional
material, colour, binder_rings_count (2|3|4), ring_diameter_mm (16|25|40|50|65|75), pack_count, label_pocket (bool), fastener_type.

## D4 Technical specs
outer_dimensions_mm, capacity_sheets (equivalent 80gsm), weight_g, ring_diameter_mm (binders), pack_count.

## D5 Variant axes
- `colour` (max 15)
- `ring_diameter_mm` (max 7, binders only)
- `size` (max 5)

## D6 Media
Min 1 / Max 5.

## D7 Commercial
Fixed. Returnable yes if unused. Pack discounts common.

## D8 Compliance
None.

## D9 Search attributes
Facets: filing_type, size, capacity range, colour, brand, pack_count, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Map | Folder |
| Binder | Binder |
| Ordner | Lever-arch file (ID common) |
| Pembatas | Divider |

## D12 Unresolved
- "Ordner" (Dutch/German-origin ID term) — alias for lever-arch file. Confirm vocab.
- Overlap with Business Furniture → Storage Cabinets — stays separate; filing supplies = consumables; cabinets = furniture.
