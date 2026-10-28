# arts.painting_drawing.drawing_pencils — Drawing Pencils

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.painting_drawing.drawing_pencils` · EN "Drawing Pencils" · ID "Pensil Gambar"
- Synonyms: graphite pencils, charcoal pencils, coloured pencils, pastel pencils, water-soluble pencils
- Parent: Arts → Painting & Drawing → Drawing Pencils

## D2 Required
product name, brand, pencil_subtype enum (`graphite|charcoal|coloured|pastel|watercolour_pencil|mechanical_art`), hardness_grade (graphite: 9H..9B+F+HB) OR colour_name (coloured), set_or_single, pack_count.

## D3 Optional
model, is_wax_based or is_oil_based (coloured), lightfastness_rating, barrel_shape (`round|hex|triangular`), tin_included (bool).

## D4 Technical specs
length_mm, diameter_mm, pack_count, lead_diameter_mm.

## D5 Variant axes
- `hardness_grade` or `colour_name` typically separate SKU.
- `pack_count` can be variant (max 6).

## D6 Media
Min 2 / Max 5.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- ASTM D4236 art-material hazard labelling [VERIFIED].
- ACMI AP label for non-toxic.
- Non-toxic certification often claimed for school/youth use.

## D9 Search attributes
Facets: pencil_subtype, hardness_grade or colour, pack_count, lightfastness, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Pensil Gambar | Drawing Pencil |
| Pensil Warna | Coloured Pencil |
| Pensil Arang | Charcoal Pencil |

## D12 Unresolved
- Pastel pencils vs pastel sticks — pastels sticks go to Craft Materials.
