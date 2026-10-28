# office.packaging_shipping.shipping_labels — Shipping Labels

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.packaging_shipping.shipping_labels` · EN "Shipping Labels" · ID "Label Pengiriman"
- Synonyms: thermal labels, 4×6 labels, courier labels
- Parent: Office → Packaging & Shipping → Shipping Labels

## D2 Required
product name, label_width_mm, label_height_mm, labels_per_roll_or_pack, printing_tech enum (`direct_thermal|thermal_transfer|laser_sheet|inkjet_sheet|plain_adhesive`), adhesive_type.

## D3 Optional
compatible_printers (text — e.g. "Zebra ZD420, Dymo LabelWriter"), fanfold (bool), roll_core_diameter_mm, outside_diameter_mm, perforated (bool), waterproof (bool), tear_resistant (bool).

## D4 Technical specs
label_width_mm, label_height_mm, labels_per_roll_or_pack, pack_count, roll_core_mm.

## D5 Variant axes
- `label_size` typically separate SKU.
- `pack_count` (max 5).

## D6 Media
Min 1 / Max 4.

## D7 Commercial
Fixed. Bulk pricing.

## D8 Compliance
Thermal labels not for laser printers — mis-use causes smoke. Buyer-safety copy.

## D9 Search attributes
Facets: label_width, label_height, printing_tech, compatible_printer, pack_count, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Label Pengiriman | Shipping Label |
| Label Thermal | Thermal Label |

## D12 Unresolved
- Printer-compatibility free-text — curate common list to improve search.
