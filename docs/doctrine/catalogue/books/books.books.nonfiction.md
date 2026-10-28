# books.books.nonfiction — Nonfiction Books

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.books.nonfiction`
- EN: "Nonfiction Books" · ID: "Buku Nonfiksi"
- Synonyms: factual books, essays, biographies
- Parent: Books → Books → Nonfiction

## D2 Required
| field | type | source |
|---|---|---|
| title | text | [VERIFIED Shopify aa_books.yml] |
| author | text multi | [VERIFIED Google #784] |
| language | ISO 639-1 | [VERIFIED] |
| binding | enum | [VERIFIED] |
| condition | enum | [CONVENTION] |
| isbn_13 | 13 digits | [VERIFIED ISO 2108] |
| subject | BISAC code | [VERIFIED BISAC NON000000 branch] |

## D3 Optional
- subtitle, publisher, publication_year, edition, page_count, series, summary, translator, editor_role, bibliography_included (bool), index_included (bool), awards.

## D4 Technical specs
width_mm, height_mm, spine_mm, weight_g, page_count — all number [CONVENTION].

## D5 Variant axes
- None default. Signed/unsigned permitted (max 2).

## D6 Media rules
- Min 2 / Max 8. Required: front, back. Optional: spine, TOC page, sample spread.

## D7 Commercial
- Fixed pricing. Returnable `yes` for new. Media-rate shipping where available.

## D8 Compliance
- None by default. Content advisory optional [NEX_PROPOSAL].

## D9 Search attributes
Facets: subject (BISAC), language, binding, condition, author, publisher, year range, price. Sort: price, newest, relevance.

## D10 Non-physical
N/A — see `digital_products.ebooks.nonfiction` for e-books.

## D11 i18n
| ID | EN |
|---|---|
| Buku Nonfiksi | Nonfiction |
| Biografi | Biography |
| Memoar | Memoir |
| Esai | Essays |

## D12 Unresolved
- BISAC taxonomy depth — do we expose full BISAC subcodes to buyers or collapse to top-level? Recommend top-level + text subject tag.
- Translated-work provenance (original language, translator's name) — mandatory or optional? Propose optional.
