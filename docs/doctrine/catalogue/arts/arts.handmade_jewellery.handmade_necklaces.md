# arts.handmade_jewellery.handmade_necklaces — Handmade Necklaces

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.handmade_jewellery.handmade_necklaces` · EN "Handmade Necklaces" · ID "Kalung Buatan Tangan"
- Synonyms: artisan necklaces, pendants (handmade), chokers, chain necklaces
- Parent: Arts → Handmade Jewellery → Handmade Necklaces

## D2 Required
product name, maker_or_atelier, metal_type, metal_fineness, length_cm, chain_style enum (`cable|curb|figaro|rope|box|snake|wheat|bead_strung|cord`), clasp_type (`lobster|spring_ring|toggle|magnetic|hook|slide`), has_pendant (bool).

## D3 Optional
model, pendant_description, pendant_dimensions_mm, gemstone_type (if applicable), extension_chain_included (bool), extension_length_cm, hallmark_assay_office.

## D4 Technical specs
length_cm, chain_width_mm, weight_g, pendant_width_mm, pendant_height_mm.

## D5 Variant axes
- `length_cm` (max 6 — e.g. 40/45/50/55/60/70).
- `metal_type` can be variant.

## D6 Media
Min 4 / Max 10. Full necklace, clasp close-up, pendant close-up, on-model reference.

## D7 Commercial
Fixed. Returnable yes if unused.

## D8 Compliance
Same as rings.

## D9 Search attributes
Facets: metal_type, length_cm, chain_style, clasp_type, has_pendant, maker, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Kalung | Necklace |
| Liontin | Pendant |

## D12 Unresolved
- Chain-style naming is translator-sensitive; preserve EN canonical + ID alias.
