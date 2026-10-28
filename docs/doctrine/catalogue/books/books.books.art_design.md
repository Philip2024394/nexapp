# books.books.art_design — Art & Design Books

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.books.art_design` · EN "Art & Design" · ID "Buku Seni & Desain"
- Synonyms: coffee-table books, monographs, catalogues raisonnés, design books
- Parent: Books → Books → Art & Design

## D2 Required
title, author, language, binding, condition, isbn_13, art_or_design_discipline enum (`painting|sculpture|photography|architecture|graphic_design|product_design|fashion_design|interior_design|art_history|art_theory`).

## D3 Optional
subtitle, publisher, publication_year, edition, page_count, artist_or_designer_featured (text), is_monograph (bool), is_catalogue_raisonne (bool), format (`coffee_table|monograph|textbook|portfolio`), summary.

## D4 Technical specs
width_mm, height_mm, spine_mm, weight_g (often 2–5kg), page_count.

## D5 Variant axes
None. Signed boolean permitted (common for photographer/designer monographs).

## D6 Media
Min 3 / Max 10. Front, back + 1-2 interior spreads mandatory [NEX_PROPOSAL — print quality is the product].

## D7 Commercial
Fixed. Returnable yes (new). **Shipping class should default to oversized** — these are the heaviest book type. [CONVENTION — Taschen XL etc.]

## D8 Compliance
Nude/mature imagery in art books — content advisory may be required per jurisdiction. [UNRESOLVED]

## D9 Search attributes
Facets: discipline, artist_featured, publisher, year, condition, format, language, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Buku Seni | Art Book |
| Buku Desain | Design Book |
| Monograf | Monograph |
| Fotografi | Photography |

## D12 Unresolved
- Nude-figure art books — age-check? Content advisory? Depends on NEX adult-content policy.
- Catalogues raisonnés often >5kg — need shipping-cost default guidance.
