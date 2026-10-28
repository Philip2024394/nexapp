# books.school_supplies.geometry_sets — Geometry Sets

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.school_supplies.geometry_sets` · EN "Geometry Sets" · ID "Alat Geometri"
- Synonyms: math sets, compass sets, drawing sets
- Parent: Books → School Supplies → Geometry Sets

## D2 Required
product name, brand, condition (`new`), piece_count (int), case_included (bool), primary_material (`metal|plastic|mixed`).

## D3 Optional
model, included_items multi-select (`compass|protractor|set_square_45|set_square_60|ruler_15cm|ruler_30cm|divider|eraser|pencil|sharpener|stencil`), ruler_graduation (`metric|imperial|dual`), compass_lock_type.

## D4 Technical specs
case_dims (W×D×H mm), weight_g, piece_count.

## D5 Variant axes
- `piece_count` (small 6-piece, 8-piece, 10+-piece) — if offered as variants max 4.
- `case_colour` (max 6).

## D6 Media
Min 2 / Max 5. Case closed, case open with pieces visible.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- Compass point = sharp — age labelling. Metal compass typically marketed to 10y+ [CONVENTION EN 71].

## D9 Search attributes
Facets: piece_count, primary_material, case_included, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Alat Geometri | Geometry Set |
| Jangka | Compass |
| Busur Derajat | Protractor |
| Penggaris | Ruler |

## D12 Unresolved
- Protractor-only / compass-only sellers — fallback: enable `includes` filter; if only one item, listing may belong to a parent "math-tools" leaf (not yet proposed).
