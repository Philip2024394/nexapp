# books.office_stationery.desk_organisers — Desk Organisers

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.office_stationery.desk_organisers` · EN "Desk Organisers" · ID "Rak Meja Kerja"
- Synonyms: pen holders, letter trays, desk caddies, drawer organisers
- Parent: Books → Office Stationery → Desk Organisers

## D2 Required
product name, brand, organiser_type enum (`pen_holder|letter_tray|desktop_file|drawer_divider|mail_sorter|multi_compartment|monitor_stand_shelf`), primary_material (`wood|metal|plastic|acrylic|leather|fabric`), colour.

## D3 Optional
model, compartment_count, dimensions_mm, weight_g, stackable (bool), rotating (bool), expandable (bool).

## D4 Technical specs
width_mm, depth_mm, height_mm, weight_g, compartment_count.

## D5 Variant axes
- `colour` (max 10)
- `primary_material` (max 5) — but typically separate SKU.

## D6 Media
Min 2 / Max 6.

## D7 Commercial
Fixed. Returnable yes if unused.

## D8 Compliance
None.

## D9 Search attributes
Facets: organiser_type, primary_material, colour, brand, compartment_count, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Rak Meja | Desk Shelf |
| Tempat Pulpen | Pen Holder |
| Pengatur Laci | Drawer Organiser |

## D12 Unresolved
- Overlap with Home → Home-Office furniture (different department). Resolve: standalone/portable = this leaf; built-in = home-office furniture.
