# office.office_equipment.laminators — Laminators

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.office_equipment.laminators` · EN "Laminators" · ID "Mesin Laminating"
- Synonyms: pouch laminators, roll laminators
- Parent: Office → Office Equipment → Laminators

## D2 Required
product name, brand, model, laminator_type enum (`pouch|roll`), max_pouch_width_mm, max_pouch_thickness_mic (microns, typical 75–250), voltage.

## D3 Optional
warm_up_time_sec, lamination_speed_mm_per_min, cold_lamination_capable (bool), auto_shutoff (bool), reverse_function_jam_release (bool).

## D4 Technical specs
width_mm, depth_mm, height_mm, weight_kg, voltage_v, power_w, max_pouch_width_mm, max_pouch_thickness_mic, warm_up_sec.

## D5 Variant axes
- `max_pouch_width_mm` typically separate SKU.

## D6 Media
Min 2 / Max 5.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- Electrical IEC 62368-1 / IEC 60335.
- Hot surface — safety label.

## D9 Search attributes
Facets: laminator_type, max_pouch_width, max_pouch_thickness, warm_up_sec, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Mesin Laminating | Laminator |

## D12 Unresolved
- Pouch consumables — belong in a separate `office_equipment.consumables` leaf.
