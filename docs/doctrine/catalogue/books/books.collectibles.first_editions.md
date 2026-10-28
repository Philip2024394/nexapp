# books.collectibles.first_editions — First Editions

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.collectibles.first_editions` · EN "First Editions" · ID "Edisi Pertama"
- Synonyms: 1st edition, 1st printing, true first
- Parent: Books → Books & Media Collectibles → First Editions

## D2 Required
title, author, publisher, publication_year, place_of_publication, printing (number line / stated edition / dust-jacket price), state_identifiers (text), condition_grade (`fine|near_fine|very_good|good|fair|poor`), dust_jacket_present (bool), dust_jacket_condition_grade.

## D3 Optional
isbn_13, binding, language, signed (bool), inscription_present (bool), book_club_edition (bool — important disqualifier), bibliographic_reference.

## D4 Technical specs
width_mm, height_mm, spine_mm, weight_g, page_count.

## D5 Variant axes
None — each copy is one-of-one.

## D6 Media
Min 6 / Max 20. Required: front, back, spine, title page, copyright page (showing number line / printing), dust-jacket front flap (showing price if applicable), any inscriptions.

## D7 Commercial
Fixed. Returnable: default `no`. Tracked + insured shipping.

## D8 Compliance
Same as rare_books (CITES, export control for antiquarian).

## D9 Search attributes
Facets: author, publication_year, publisher, condition_grade, dust_jacket_condition_grade, signed, price. Sort: price, year.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Edisi Pertama | First Edition |
| Cetakan Pertama | First Printing |

## D12 Unresolved
- "True first" vs "first UK edition" vs "first US edition" — collector-specific vocab. Propose: let seller declare in `state_identifiers` free text.
- Book-club edition is a common buyer-trap flag — proposed as explicit boolean to protect buyers.
