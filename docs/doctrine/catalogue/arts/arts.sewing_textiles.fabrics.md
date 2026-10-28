# arts.sewing_textiles.fabrics — Fabrics

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.sewing_textiles.fabrics` · EN "Fabrics" · ID "Kain"
- Synonyms: cloth, textile yardage, quilting cottons, batik, denim, silk, cotton
- Parent: Arts → Sewing & Textiles → Fabrics

## D2 Required
product name, fabric_type enum (`cotton|cotton_blend|polyester|linen|silk|wool|rayon_viscose|denim|batik|chiffon|satin|velvet|canvas_duck|fleece|jersey_knit|french_terry|neoprene|faux_leather`), composition_percent (text — e.g. "100% cotton" or "95% cotton 5% elastane"), width_cm, weight_g_per_m2 (or yd²), sold_by (`per_metre|per_yard|per_fat_quarter|per_bolt|per_half_metre`), colour_or_pattern.

## D3 Optional
model/collection, print_or_pattern_name, country_of_origin, pre_washed (bool), stretch (`no|two_way|four_way`), weave_type, care_instructions (ISO 3758 symbols) [VERIFIED].

## D4 Technical specs
width_cm, weight_g_per_m2, thread_count (if applicable).

## D5 Variant axes
- `colour_or_pattern` (max 20).
- `length_sold` is quantity, not variant.

## D6 Media
Min 2 / Max 8. Flat shot, draped shot, close-up weave.

## D7 Commercial
Variable — per-metre pricing [CONVENTION]. Returnable yes if not cut; cut lengths typically final sale.

## D8 Compliance
- OEKO-TEX Standard 100 (chemical safety claim) [VERIFIED].
- Flammability for fabrics marketed for children's sleepwear (16 CFR 1615/1616 US) — jurisdictional.
- Trade act label requirements (fibre content, origin, care) per US TFPIA / EU 1007/2011.

## D9 Search attributes
Facets: fabric_type, composition, width, weight_gsm, colour_or_pattern, stretch, pre_washed, price_per_metre. Sort: price per metre.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Kain | Fabric |
| Kain Katun | Cotton Fabric |
| Batik | Batik |

## D12 Unresolved
- Price-per-metre normalisation across sold_by units.
- Batik authenticity (hand-written tulis vs stamp vs print) — subcategorise? Flag — significant cultural value for ID.
