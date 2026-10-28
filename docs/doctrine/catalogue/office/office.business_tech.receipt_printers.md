# office.business_tech.receipt_printers — Receipt Printers

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.business_tech.receipt_printers` · EN "Receipt Printers" · ID "Printer Struk"
- Synonyms: thermal receipt printers, POS printers, kitchen printers
- Parent: Office → Business Technology → Receipt Printers

## D2 Required
product name, brand, print_tech enum (`direct_thermal|impact_dot_matrix`), paper_width_mm (`58|80|112`), connectivity multi (`usb|ethernet|wifi|bluetooth|rs232`), print_speed_mm_per_s, cutter_type (`auto|manual|none`), voltage_v.

## D3 Optional
model, paper_roll_outer_diameter_mm, drop_in_paper_loading (bool), kitchen_rated (bool — high temp/humidity), esc_pos_compatible (bool), cash_drawer_kickout (bool), warranty_months.

## D4 Technical specs
dimensions_mm, weight_kg, paper_width_mm, print_speed_mm_per_s, voltage.

## D5 Variant axes
- `paper_width_mm` typically separate SKU.
- `connectivity` can be variant.

## D6 Media
Min 2 / Max 6.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- Electrical IEC 62368-1.
- ESC/POS is de-facto standard — not formally certified but widely expected.

## D9 Search attributes
Facets: print_tech, paper_width, connectivity, cutter_type, kitchen_rated, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Printer Struk | Receipt Printer |
| Printer Thermal | Thermal Printer |

## D12 Unresolved
- Thermal-paper consumables are a separate leaf (packaging/shipping-labels adjacent).
