# arts.sewing_textiles.sewing_machines — Sewing Machines

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.sewing_textiles.sewing_machines` · EN "Sewing Machines" · ID "Mesin Jahit"
- Synonyms: domestic sewing machines, overlockers/sergers, embroidery machines, industrial sewing machines
- Parent: Arts → Sewing & Textiles → Sewing Machines

## D2 Required
product name, brand, model, machine_type enum (`mechanical|computerised|overlock_serger|coverstitch|embroidery|combo_sewing_embroidery|industrial_straight|industrial_overlock|industrial_blind_stitch`), stitch_count_builtin, voltage_v, max_stitch_speed_spm.

## D3 Optional
needle_system, max_stitch_width_mm, max_stitch_length_mm, free_arm (bool), auto_threader (bool), auto_tension (bool), computer_display (bool), accessories_included (text), warranty_months.

## D4 Technical specs
width_mm, depth_mm, height_mm, weight_kg, voltage, power_w, max_stitch_speed_spm.

## D5 Variant axes
- `model` typically separate SKU.
- `colour` (max 4) can be variant.

## D6 Media
Min 4 / Max 10.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- IEC 60335-2-28 sewing machine safety [VERIFIED].
- EMC per region.

## D9 Search attributes
Facets: machine_type, stitch_count_builtin, max_stitch_speed, computer_display, auto_threader, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Mesin Jahit | Sewing Machine |
| Mesin Obras | Overlock / Serger |
| Mesin Bordir | Embroidery Machine |

## D12 Unresolved
- Industrial vs domestic classification — different buyer workflows.
