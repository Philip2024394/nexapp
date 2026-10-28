# books.school_supplies.pens — Pens

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.school_supplies.pens` · EN "Pens" · ID "Pulpen"
- Synonyms: ballpoint pens, gel pens, rollerball pens, fountain pens, markers (excl. highlighters — separate)
- Parent: Books → School Supplies → Pens

## D2 Required
product name, brand, condition (`new`), ink_type enum (`ballpoint|gel|rollerball|fountain|hybrid`) [VERIFIED Shopify writing-instruments], tip_width_mm number (common 0.3/0.38/0.5/0.7/1.0) [VERIFIED ISO 12757], ink_colour.

## D3 Optional
model, retractable (bool), refillable (bool), grip_type (`rubber|smooth|contoured`), barrel_colour, barrel_material, pack_count.

## D4 Technical specs
tip_width_mm number, ink_capacity_ml number (optional), pen_length_mm, pen_diameter_mm, weight_g, pack_count.

## D5 Variant axes
- `ink_colour` (max 24) [CONVENTION]
- `tip_width_mm` (max 10)
- `pack_count` (max 10)
- Pack-count sometimes separate SKU, sometimes variant — propose variant default [NEX_PROPOSAL].

## D6 Media
Min 2 / Max 6. Full pen, close-up of tip, writing sample image optional.

## D7 Commercial
Fixed. Returnable yes if unopened. Bulk/pack pricing common.

## D8 Compliance
- Fountain-pen ink may contain substances requiring GHS labelling at bulk-bottle scale — but cartridge/single-pen scale usually exempt [UNRESOLVED — jurisdictional].
- Air shipping of fountain-pen bulk ink can be restricted [UNRESOLVED].

## D9 Search attributes
Facets: ink_type, tip_width, ink_colour, brand, retractable, refillable, price. Sort: price, best-seller.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Pulpen | Ballpoint |
| Pena Gel | Gel Pen |
| Pena | Pen (generic) |
| Spidol | Marker |

## D12 Unresolved
- "Hybrid" ink category not universal — some vendors call it "emulsion ink". Propose keep "hybrid" as canonical, map vendor terms via synonyms.
- Luxury fountain pens (Montblanc etc.) may belong in Office Stationery.Writing Supplies rather than School. Resolve by brand-recommended-channel at catalogue curation time.
