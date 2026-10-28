# books.books.business — Business Books

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.books.business` · EN "Business Books" · ID "Buku Bisnis"
- Synonyms: management books, entrepreneurship books, finance books
- Parent: Books → Books → Business

## D2 Required
title, author, language (ISO 639-1), binding, condition, isbn_13, business_subject enum [VERIFIED BISAC BUS* branch — management/entrepreneurship/finance/marketing/economics/leadership].

## D3 Optional
subtitle, publisher, publication_year, edition, page_count, summary, bibliography_included, foreword_author, series.

## D4 Technical specs
width_mm, height_mm, spine_mm, weight_g, page_count. [CONVENTION trim-size]

## D5 Variant axes
None. Signed boolean permitted (max 2).

## D6 Media rules
Min 2 / Max 8. Front + back required.

## D7 Commercial
Fixed. Returnable yes (new). Media-rate shipping.

## D8 Compliance
None default. "Investment advice" disclaimer sometimes required by jurisdiction [UNRESOLVED — jurisdiction-dependent].

## D9 Search attributes
Facets: business_subject, author, publisher, year, condition, binding, language, price. Sort: newest, best-seller [UNRESOLVED], relevance.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Buku Bisnis | Business |
| Manajemen | Management |
| Kewirausahaan | Entrepreneurship |
| Keuangan | Finance |

## D12 Unresolved
- Jurisdictional disclaimer for "financial advice" categorisation — flag for review before enabling investment-advice sub-leaf.
- Overlap with Professional Reference → Professional Guides — resolved via BISAC subject (finance = business; CPA/CFA study = professional guides).
