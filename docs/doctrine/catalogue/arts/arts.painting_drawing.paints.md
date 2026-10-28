# arts.painting_drawing.paints — Paints (Art Materials)

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.painting_drawing.paints` · EN "Paints" · ID "Cat Lukis"
- Synonyms: oil paint, acrylic paint, watercolour, gouache, tempera, ink (art)
- Parent: Arts → Painting & Drawing → Paints

## D2 Required
product name, brand, medium enum (`oil|acrylic|watercolour|gouache|tempera|ink|enamel|spray_art|fluid_acrylic`), colour_name, colour_index_code (CI pigment code — e.g. "PR122") [VERIFIED ISO 787 pigments], volume_ml, container_type (`tube|jar|bottle|cake|pan|stick`).

## D3 Optional
model, series_or_line, student_vs_artist (`student|artist|professional`), lightfastness_rating (`i|ii|iii|iv|v`, ASTM D4303) [VERIFIED], opacity (`transparent|semi_transparent|semi_opaque|opaque`), binder, drying_time_hours (oil), hazard_rating (ACMI).

## D4 Technical specs
volume_ml, pigment_concentration, viscosity_rating, drying_time_h.

## D5 Variant axes
- `colour_name` typically separate SKU.
- `volume_ml` can be variant (max 6).

## D6 Media
Min 2 / Max 6. Tube/container with colour swatch; swatch painted sample.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- ASTM D4236 art-material hazard labelling [VERIFIED].
- ACMI AP (non-toxic) / CL (caution label).
- Solvent-based paints (oil, enamel, spray) — HAZMAT shipping restrictions [UNRESOLVED air transport].
- Spray paint: GHS pictograms + UN 1950 aerosol.

## D9 Search attributes
Facets: medium, colour_name/colour_index, volume_ml, student_vs_artist, lightfastness, opacity, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Cat Minyak | Oil Paint |
| Cat Akrilik | Acrylic Paint |
| Cat Air | Watercolour |
| Gouache | Gouache |

## D12 Unresolved
- Solvent-based paint shipping restrictions.
- Lightfastness claim verification.
