# books.school_supplies.pencils — Pencils

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.school_supplies.pencils` · EN "Pencils" · ID "Pensil"
- Synonyms: graphite pencils, mechanical pencils, lead pencils
- Parent: Books → School Supplies → Pencils

## D2 Required
product name, brand, condition (`new`), pencil_type enum (`wood_cased|mechanical`) [VERIFIED Shopify writing-instruments], hardness_grade enum (`9H..9B` + `HB` + `F`) [VERIFIED convention — ISO 9177 adjacent] (or lead_size_mm for mechanical: 0.3|0.5|0.7|0.9|1.1|2.0).

## D3 Optional
pack_count, pre_sharpened (bool, wood_cased only), eraser_tip (bool), barrel_colour, barrel_material, body_grip, has_clip (mechanical).

## D4 Technical specs
length_mm, diameter_mm, weight_g, pack_count, lead_size_mm (mechanical).

## D5 Variant axes
- `hardness_grade` (max 15)
- `pack_count` (max 10)
- `lead_size_mm` (max 6, mechanical only)

## D6 Media
Min 2 / Max 5.

## D7 Commercial
Fixed. Returnable yes if unopened.

## D8 Compliance
- Lead-tip may trigger small-parts choking hazard under 3y labelling. Pencils marketed to children <3y should be chubby/triangular.
- Non-toxic certification (AP seal, EN 71-3) commonly claimed [VERIFIED ACMI AP seal].

## D9 Search attributes
Facets: pencil_type, hardness_grade, lead_size, brand, pack_count, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Pensil | Pencil |
| Pensil Mekanik | Mechanical Pencil |
| Pensil Grafit | Graphite Pencil |

## D12 Unresolved
- Coloured pencils → separate leaf under Arts (`arts.painting_drawing.drawing_pencils`) or here? Propose: school-pencils here = graphite only; coloured goes to Arts.
- Charcoal pencils → Arts leaf.
