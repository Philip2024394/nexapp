# arts.painting_drawing.brushes — Brushes (Art)

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.painting_drawing.brushes` · EN "Brushes" · ID "Kuas Lukis"
- Synonyms: paintbrushes, artist brushes, watercolour brushes, oil brushes
- Parent: Arts → Painting & Drawing → Brushes

## D2 Required
product name, brand, brush_shape enum (`round|flat|filbert|bright|fan|angular|rigger|mop|wash|detail`), brush_size (per-mfr convention 10/0 to 24+) [CONVENTION], bristle_type enum (`synthetic|natural_hog|natural_sable|natural_squirrel|natural_mongoose|natural_ox|mixed`), handle_length (`short|long`), medium_suited enum multi (`oil|acrylic|watercolour|gouache|ink|universal`).

## D3 Optional
model, ferrule_material, handle_material, cruelty_free (bool).

## D4 Technical specs
total_length_mm, bristle_length_mm, bristle_width_mm, weight_g.

## D5 Variant axes
- `brush_size` typically separate SKU.
- `set_vs_single` (if sold as set).

## D6 Media
Min 2 / Max 5. Full brush + close-up of ferrule/bristles.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
Natural bristles: CITES not typically triggered; squirrel/mongoose may be regulated in some jurisdictions.

## D9 Search attributes
Facets: brush_shape, brush_size, bristle_type, handle_length, medium_suited, cruelty_free, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Kuas | Brush |
| Kuas Bulu Asli | Natural Hair Brush |

## D12 Unresolved
- Size convention varies by manufacturer. Propose: store numeric_size (manufacturer value) + bristle_width_mm (measured).
