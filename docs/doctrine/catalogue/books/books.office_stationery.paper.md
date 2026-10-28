# books.office_stationery.paper — Office Paper

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.office_stationery.paper` · EN "Office Paper" · ID "Kertas Kantor"
- Synonyms: copy paper, printer paper, A4 paper, reams
- Parent: Books → Office Stationery → Paper

## D2 Required
product name, brand, paper_size enum ISO 216 (`A4|A3|A5|B4|B5|letter|legal|tabloid`) [VERIFIED ISO 216], gsm_g_per_m2 (common 70/75/80/90/100/120) [VERIFIED ISO 536], sheet_count (per ream), colour (`white|cream|coloured`).

## D3 Optional
brightness_rating (CIE/ISO), opacity, paper_colour_specific (if coloured), finish (`uncoated|coated_matte|coated_gloss`), fsc_certified (bool), recycled_content_percent, pack_count (number of reams), use_case (`copier|inkjet|laser|photo|multipurpose`).

## D4 Technical specs
sheet_length_mm, sheet_width_mm, gsm_g_per_m2, brightness_percent, sheet_count, pack_count, pack_weight_kg.

## D5 Variant axes
- `paper_size` (max 8) × `gsm` (max 7) × `pack_count` (max 5) — but typically each combo = separate SKU, not variant.
- `colour` (max 20 for coloured range) when applicable.

## D6 Media
Min 1 / Max 4. Pack-front showing specs is sufficient.

## D7 Commercial
Fixed. Returnable yes if sealed. Heavy — standard-ground shipping; multi-pack discounts common.

## D8 Compliance
- FSC / PEFC claim = requires certificate [UNRESOLVED verification method].
- Recycled content claims subject to ISO 14021.

## D9 Search attributes
Facets: paper_size, gsm, use_case, brightness range, colour, brand, fsc_certified, pack_count, price. Sort: price per sheet.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Kertas | Paper |
| Kertas Fotokopi | Copy Paper |
| Kertas HVS | Office/Bond Paper (ID common) |
| Rim | Ream |

## D12 Unresolved
- "HVS" (Houtvrij Schrijfpapier, Dutch-origin ID term for wood-free bond paper) — treat as alias for 70/80gsm uncoated bond.
- Price-per-sheet sort — needs derived field (price / (sheet_count × pack_count)).
