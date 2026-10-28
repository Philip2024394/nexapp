# office.office_equipment.printers — Printers

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.office_equipment.printers` · EN "Printers" · ID "Printer"
- Synonyms: laser printer, inkjet printer, multifunction printer, MFP, 3D printer (**excluded — separate leaf**)
- Parent: Office → Office Equipment → Printers

## D2 Required
product name, brand, model, print_technology enum (`laser_mono|laser_colour|inkjet|thermal_transfer|dot_matrix|dye_sublimation`) [VERIFIED Shopify electronics-office], functions enum multi (`print|copy|scan|fax`), connectivity enum multi (`usb|ethernet|wifi|bluetooth|mobile_print`), max_paper_size (A4|A3|letter|legal), voltage (V), region/plug_type.

## D3 Optional
duplex_capable (bool), colour_capable (bool), print_speed_ppm (A4), monthly_duty_cycle_pages (int), recommended_monthly_pages (int), tray_capacity_sheets, max_resolution_dpi, consumables_model_numbers (text), warranty_months.

## D4 Technical specs
width_mm, depth_mm, height_mm, weight_kg, voltage_v, power_w, print_speed_ppm, duty_cycle_pages, resolution_dpi, tray_capacity_sheets.

## D5 Variant axes
- `colour_or_mono` typically = separate SKU.
- Rare — single-SKU default.

## D6 Media
Min 4 / Max 10. Front, back (ports visible), control panel, paper tray open.

## D7 Commercial
Fixed. Returnable yes if sealed; opened = seller-defined window. Standard-ground shipping (heavy items may need freight).

## D8 Compliance
- Electrical safety: IEC 60950-1 (legacy) / IEC 62368-1 [VERIFIED].
- EMC: FCC Part 15 (US) / CE EMC (EU) / SNI (ID).
- Energy efficiency: ENERGY STAR for US buyers [CONVENTION].
- Battery: typically none in corded printers; mobile printers = UN 38.3 if lithium.

## D9 Search attributes
Facets: print_technology, functions, colour_capable, max_paper_size, connectivity, brand, price range. Sort: price, speed.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Printer | Printer |
| Printer Laser | Laser Printer |
| Printer Multifungsi | Multifunction / MFP |

## D12 Unresolved
- 3D printers are a distinct category — recommend separate leaf (potentially `office.industrial_tools.3d_printers` or new leaf).
- Consumables (toner, ink) belong to a separate `office_equipment.consumables` leaf [NEX_PROPOSAL] — not currently in this B1 taxonomy; flag.
