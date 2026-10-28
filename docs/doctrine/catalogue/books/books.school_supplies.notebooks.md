# books.school_supplies.notebooks — Notebooks

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.school_supplies.notebooks` · EN "Notebooks" · ID "Buku Tulis"
- Synonyms: exercise books, writing books, journals (plain), composition books
- Parent: Books → School Supplies → Notebooks

## D2 Required
title (or product name), brand, condition (`new` default — used notebooks rarely sold), paper_size enum ISO 216 (`A4|A5|A6|B5|letter|legal|custom`) [VERIFIED ISO 216], ruling enum (`ruled|squared|dotted|blank|cornell|music_staff`) [CONVENTION Shopify school-supplies].

## D3 Optional
page_count, cover_type (`soft|hard|flexi`), binding (`spiral|stitched|glued|discbound`), paper_colour, paper_gsm, cover_colour, cover_design, has_elastic_closure, has_bookmark_ribbon, has_pen_loop, label.

## D4 Technical specs
| field | unit | source |
|---|---|---|
| width | mm | [VERIFIED ISO 216] |
| height | mm | [VERIFIED ISO 216] |
| page_count | integer | [CONVENTION] |
| paper_gsm | g/m² | [VERIFIED ISO 536] |
| line_spacing | mm | [CONVENTION — 7/8mm standard school ruling] |

## D5 Variant axes
- `cover_colour` (max 20) [CONVENTION]
- `paper_size` (max 7)
- `ruling` (max 6)
- Max SKU count per listing: 60 (3 axes × their caps, capped) [NEX_PROPOSAL]

## D6 Media
Min 2 / Max 6. Front cover, open-flat interior (shows ruling), spine.

## D7 Commercial
Fixed. Returnable yes if unused + unopened. Multi-pack pricing common (3-pack / 5-pack / 10-pack).

## D8 Compliance
None. Eco-claims (FSC, recycled) require certification [UNRESOLVED — verification method].

## D9 Search attributes
Facets: paper_size, ruling, binding, page_count range, cover_type, brand, price. Sort: price, newest.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Buku Tulis | Notebook |
| Buku Garis | Ruled Notebook |
| Buku Kotak | Squared/Grid Notebook |
| Spiral | Spiral-bound |

## D12 Unresolved
- Hard-cover journal (Moleskine-style) vs utility school notebook — same leaf or split? Propose single leaf with ruling+binding axes to distinguish.
- FSC/recycled verification policy — seller-declared only vs certificate upload. Flag.
