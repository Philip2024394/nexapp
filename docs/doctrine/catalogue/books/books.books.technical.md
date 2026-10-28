# books.books.technical — Technical Books

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.books.technical` · EN "Technical Books" · ID "Buku Teknik"
- Synonyms: engineering books, programming books, science textbooks (adult)
- Parent: Books → Books → Technical

## D2 Required
title, author, language, binding, condition, isbn_13, technical_domain enum (`computing|electrical|mechanical|civil|chemical|biomedical|aerospace|materials|mathematics|physics|chemistry|biology|other`) [VERIFIED BISAC TEC/SCI/COM top-level].

## D3 Optional
subtitle, publisher, publication_year, edition (critical for technical — often required), page_count, solutions_manual_included (bool), accompanying_cd_dvd (bool), download_code_included (bool), summary, series.

## D4 Technical specs
width_mm, height_mm, spine_mm, weight_g, page_count. Often >1kg so shipping cost significant.

## D5 Variant axes
None. Edition = separate ISBN.

## D6 Media
Min 2 / Max 10.

## D7 Commercial
Fixed. Returnable yes (new).

## D8 Compliance
None.

## D9 Search attributes
Facets: technical_domain, author, publisher, edition, year, condition, binding, language, price.

## D10 Non-physical
N/A — digital technical textbooks are `digital_products.ebooks.technical`.

## D11 i18n
| ID | EN |
|---|---|
| Buku Teknik | Technical |
| Buku Pemrograman | Programming |
| Buku Teknik Elektro | Electrical Engineering |

## D12 Unresolved
- International edition grey-market issue (same content, different ISBN, publisher pricing dispute) — needs policy if NEX allows cross-border listings.
- Overlap with Professional Reference → Technical Manuals: this leaf = *educational textbook*; manuals leaf = *reference manual*.
