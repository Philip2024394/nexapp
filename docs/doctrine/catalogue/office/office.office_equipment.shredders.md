# office.office_equipment.shredders — Shredders

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.office_equipment.shredders` · EN "Shredders" · ID "Mesin Penghancur Kertas"
- Synonyms: paper shredders, cross-cut shredders, micro-cut shredders
- Parent: Office → Office Equipment → Shredders

## D2 Required
product name, brand, model, cut_type enum (`strip|cross_cut|micro_cut`), din_66399_security_level enum (`P-1|P-2|P-3|P-4|P-5|P-6|P-7`) [VERIFIED DIN 66399], sheet_capacity_per_pass, bin_capacity_litres, voltage.

## D3 Optional
run_time_minutes, cool_down_minutes_required, continuous_operation (bool), max_sheet_width_mm, auto_feed_capacity, destroys_cards (bool), destroys_cds (bool), destroys_staples (bool), noise_db, warranty_months.

## D4 Technical specs
width_mm, depth_mm, height_mm, weight_kg, voltage_v, power_w, sheet_capacity_per_pass, bin_capacity_litres, cut_width_mm, cut_length_mm.

## D5 Variant axes
- `din_66399_security_level` typically separate SKU.

## D6 Media
Min 3 / Max 8. Front, bin pulled out, feed slot close-up.

## D7 Commercial
Fixed. Returnable yes if sealed. Standard-ground.

## D8 Compliance
- Electrical safety IEC 62368-1.
- DIN 66399 is the explicit security standard — misuse of the P-level is a buyer-trust failure. Seller claim must match certification.
- EMC: FCC/CE/SNI.

## D9 Search attributes
Facets: cut_type, din_66399_security_level, sheet_capacity range, bin_capacity range, brand, auto_feed, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Penghancur Kertas | Paper Shredder |
| Mesin Shredder | Shredder Machine |

## D12 Unresolved
- DIN level verification — seller claim only. Flag that false claims = severe trust failure (data destruction promise). NEX_PROPOSAL: display security level prominently with "as declared by seller" note.
