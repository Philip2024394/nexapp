# books.books.travel_guides — Travel Guides

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.books.travel_guides` · EN "Travel Guides" · ID "Buku Panduan Wisata"
- Synonyms: travel books, guidebooks, phrase books
- Parent: Books → Books → Travel Guides

## D2 Required
title, author, language, binding, condition, isbn_13, destination (text — country, region, or city), publication_year (critical — travel data decays).

## D3 Optional
subtitle, publisher, edition, page_count, series (e.g. "Lonely Planet", "Rough Guides"), has_maps (bool), has_phrasebook_section (bool), travel_type (`backpacker|family|luxury|adventure|business`), season_covered.

## D4 Technical specs
width_mm, height_mm, spine_mm, weight_g, page_count. Pocket-size common.

## D5 Variant axes
None. Edition = separate ISBN.

## D6 Media
Min 2 / Max 8. Front, back + sample interior map.

## D7 Commercial
Fixed. Returnable yes (new). Shipping media-rate.

## D8 Compliance
None.

## D9 Search attributes
Facets: destination, series, publication_year (recency filter critical), language, condition, travel_type, price. Sort: newest first (default).

## D10 Non-physical
N/A — digital guides are `digital_products.ebooks.travel`.

## D11 i18n
| ID | EN |
|---|---|
| Buku Panduan | Guidebook |
| Panduan Wisata | Travel Guide |
| Buku Peta | Map Book |
| Phrasebook | Phrasebook |

## D12 Unresolved
- Should NEX warn buyers when guide is >5 years old (data staleness)? NEX_PROPOSAL — automatic UI chip based on publication_year.
- Phrasebook distinct from language-learning books? Propose: phrasebooks here; full language courses go to Education.
