# arts.craft_materials.paper — Craft Paper

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.craft_materials.paper` · EN "Craft Paper" · ID "Kertas Kerajinan"
- Synonyms: cardstock, origami paper, washi, scrapbook paper, decorative paper, mulberry paper
- Parent: Arts → Craft Materials → Paper
- **Boundary**: office paper = `office_stationery.paper`. This leaf = decorative / art-use paper.

## D2 Required
product name, paper_type enum (`cardstock|origami|washi_tape|washi_paper|scrapbook|mulberry|crepe|tissue|parchment|calligraphy|decorative_print|handmade_paper`), paper_size (ISO 216 or custom), paper_weight_gsm, pack_count, colour_or_pattern.

## D3 Optional
model, acid_free (bool), lignin_free (bool), fsc_certified (bool), textured (bool), double_sided (bool), finish (`matte|gloss|metallic|holographic`).

## D4 Technical specs
width_mm, height_mm, paper_gsm, pack_count.

## D5 Variant axes
- `colour_or_pattern` (max 40 for pattern-packs).
- `paper_size` typically separate SKU.
- `pack_count` (max 5).

## D6 Media
Min 2 / Max 6.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
Acid-free / lignin-free claim is important for archival use — seller-declared.

## D9 Search attributes
Facets: paper_type, paper_size, paper_gsm, pack_count, colour_or_pattern, acid_free, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Kertas Origami | Origami Paper |
| Kertas Washi | Washi Paper |
| Kertas Scrapbook | Scrapbook Paper |

## D12 Unresolved
- Overlap with office paper — treat as distinct via paper_type enum.
