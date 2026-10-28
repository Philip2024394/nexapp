# arts.painting_drawing.canvases — Canvases

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.painting_drawing.canvases` · EN "Canvases" · ID "Kanvas Lukis"
- Synonyms: stretched canvases, canvas rolls, canvas boards, canvas panels
- Parent: Arts → Painting & Drawing → Canvases

## D2 Required
product name, brand, canvas_type enum (`stretched|roll|panel|canvas_board|loose_cut`), width_mm, height_mm (or roll_length_m for roll), canvas_material (`cotton_duck|linen|polyester|cotton_linen_blend`), canvas_weight_oz_per_yd2 (common 7/10/12), priming (`gessoed_universal|gessoed_oil_only|unprimed`).

## D3 Optional
model, depth_mm (stretched; typical 20mm thin, 38mm deep, 50mm museum), stretcher_type (`pine|poplar|aluminium|back_stapled`), surface_texture (`fine|medium|rough`), acid_free (bool).

## D4 Technical specs
width_mm, height_mm, depth_mm (if stretched), canvas_weight_g_per_m2 (or oz/yd²), roll_length_m, roll_width_mm.

## D5 Variant axes
- `width_mm × height_mm` typically separate SKU.
- `depth_mm` can be variant (max 3).

## D6 Media
Min 2 / Max 5.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
None.

## D9 Search attributes
Facets: canvas_type, dimensions, canvas_material, canvas_weight, priming, depth, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Kanvas | Canvas |
| Kanvas Rentang | Stretched Canvas |
| Rol Kanvas | Canvas Roll |

## D12 Unresolved
- Oz/yd² vs g/m² convention — both widely used. Propose canonical g/m² + display oz/yd² for US buyers.
