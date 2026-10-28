# books.collectibles.rare_books — Rare Books

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.collectibles.rare_books` · EN "Rare Books" · ID "Buku Langka"
- Synonyms: antiquarian books, scarce books, out-of-print rarities
- Parent: Books → Books & Media Collectibles → Rare Books

## D2 Required
title, author, publisher, publication_year, language, binding, condition_grade enum (`fine|near_fine|very_good|good|fair|poor`) [VERIFIED ILAB/ABA grading], provenance_statement (text — seller's own authority declaration).

## D3 Optional
isbn_13 (often absent for pre-1972), place_of_publication, printing (first/second), state, dust_jacket_present (bool), dust_jacket_condition_grade, inscription_present (bool), signed (bool), signed_by, bookplate_present (bool), repairs_notes, previous_owners, bibliographic_reference.

## D4 Technical specs
width_mm, height_mm, spine_mm, weight_g, page_count. Pre-ISBN sizes often given in traditional format (quarto/octavo/duodecimo) [CONVENTION] — convert to mm for consistency.

## D5 Variant axes
- One-of-one items — NO variants. Each copy is a distinct listing.

## D6 Media
Min 5 / Max 20. Required: front cover, back cover, spine, title page, copyright/publisher page, any inscriptions, any defects. [NEX_PROPOSAL — buyers evaluate authenticity via multiple angles.]

## D7 Commercial
Fixed. Returnable: default `no` (collectible) — seller may offer "subject to inspection" return window [CONVENTION ILAB].
Shipping: tracked + insured mandatory for high-value items [NEX_PROPOSAL].

## D8 Compliance
- **CITES**: antiquarian books with ivory covers / exotic skin bindings may be restricted [UNRESOLVED — case-by-case].
- Export control: some countries (ID, Italy, Egypt) restrict export of books over threshold age [UNRESOLVED — jurisdictional].

## D9 Search attributes
Facets: condition_grade, publication_year range, binding, author, publisher, signed, price range.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Buku Langka | Rare Book |
| Buku Antik | Antiquarian Book |

## D12 Unresolved
- Authentication liability — NEX cannot authenticate books. Honest copy: "as described by seller". High-value guidance (>Rp X) encourages SafeTrade third-party inspection path [NEX_PROPOSAL — mirror of watches].
- Export-control cross-border for antiquarian books (>50y, >100y thresholds vary).
