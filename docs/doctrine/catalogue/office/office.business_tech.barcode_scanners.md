# office.business_tech.barcode_scanners — Barcode Scanners

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.business_tech.barcode_scanners` · EN "Barcode Scanners" · ID "Scanner Barcode"
- Synonyms: barcode readers, barcode guns, QR scanners
- Parent: Office → Business Technology → Barcode Scanners

## D2 Required
product name, brand, scanner_type enum (`handheld_1d|handheld_2d|presentation|fixed_mount|wearable|mobile_computer`), symbologies_supported multi (`ean_13|upc_a|code_39|code_128|data_matrix|qr|pdf417`), connectivity (`usb_wired|bluetooth|wifi|rs232`), laser_class (if laser).

## D3 Optional
model, scan_speed_cps, scan_range_mm, drop_tested_m, ip_rating, battery_type (cordless), battery_life_hours, charging_cradle_included (bool).

## D4 Technical specs
dimensions, weight_g, scan_range_mm, battery_capacity_mah.

## D5 Variant axes
- `connectivity` typically separate SKU.
- `scanner_type` separate SKU.

## D6 Media
Min 2 / Max 6.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- Laser class per IEC 60825-1 (if laser scanner).
- ISO/IEC 15420 EAN-13 and other symbology standards [VERIFIED].
- Bluetooth/Wi-Fi: radio type-approval per country.

## D9 Search attributes
Facets: scanner_type, symbologies_supported, connectivity, drop_tested, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Scanner Barcode | Barcode Scanner |
| Pembaca QR | QR Reader |

## D12 Unresolved
- Radio type-approval variance by country.
