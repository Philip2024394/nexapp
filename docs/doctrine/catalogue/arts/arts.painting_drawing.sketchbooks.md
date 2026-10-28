# arts.painting_drawing.sketchbooks — Sketchbooks

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.painting_drawing.sketchbooks` · EN "Sketchbooks" · ID "Buku Sketsa"
- Synonyms: sketch pads, drawing pads, watercolour pads, mixed-media pads, panoramic sketchbooks
- Parent: Arts → Painting & Drawing → Sketchbooks

## D2 Required
product name, brand, pad_type enum (`sketchbook_hardbound|sketchpad_glued|sketchpad_spiral|watercolour_pad|marker_pad|mixed_media_pad|toned_paper_pad`), paper_size enum ISO 216 or custom, paper_weight_gsm, page_count, binding.

## D3 Optional
model, paper_colour (`white|cream|toned_grey|toned_tan|black`), paper_texture (`smooth|cold_press|hot_press|rough|vellum`), acid_free (bool), is_recycled (bool), fsc_certified (bool), has_elastic_closure, has_pocket.

## D4 Technical specs
width_mm, height_mm, paper_gsm, page_count, pad_weight_g.

## D5 Variant axes
- `paper_size` typically separate SKU.
- `page_count` can be variant.

## D6 Media
Min 2 / Max 6. Front, open-flat interior.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
FSC claim verification.

## D9 Search attributes
Facets: pad_type, paper_size, paper_weight_gsm, page_count, paper_colour, paper_texture, acid_free, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Buku Sketsa | Sketchbook |
| Buku Gambar | Drawing Book |

## D12 Unresolved
- Overlap with notebooks under School Supplies — this leaf is specifically for art-quality paper.
