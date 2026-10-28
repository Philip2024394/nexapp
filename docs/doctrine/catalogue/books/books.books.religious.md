# books.books.religious — Religious & Spiritual Books

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.books.religious` · EN "Religious & Spiritual" · ID "Buku Agama & Spiritual"
- Synonyms: scripture, devotional, theological
- Parent: Books → Books → Religious & Spiritual

## D2 Required
title, author, language, binding, condition, isbn_13 (if post-2007), religion enum (`islam|christianity|catholicism|buddhism|hinduism|judaism|sikhism|interfaith|other`) [VERIFIED BISAC REL* top-level].

## D3 Optional
subtitle, publisher, publication_year, edition, page_count, tradition_or_denomination text, language_of_original_scripture (e.g. "Arabic", "Hebrew", "Pali"), translation_or_commentary (bool), summary.

## D4 Technical specs
width_mm, height_mm, spine_mm, weight_g, page_count. Scripture editions often leather-bound, higher weight.

## D5 Variant axes
Binding = separate ISBN. Signed boolean permitted.

## D6 Media
Min 2 / Max 8.

## D7 Commercial
Fixed. Returnable yes (new).

## D8 Compliance
- **Content sensitivity**: must respect religious-sensitivity guidelines in listing copy [NEX_PROPOSAL — editorial policy].
- No hazmat/battery.

## D9 Search attributes
Facets: religion, tradition_or_denomination, language, binding, condition, publisher, year, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Buku Agama | Religious Book |
| Al-Quran | Quran |
| Alkitab | Bible |
| Buku Doa | Prayer Book |

## D12 Unresolved
- Depiction / commentary of sacred texts — jurisdictional sensitivity (ID blasphemy law).
- "Hadith authenticity" claims — buyer-facing claim governance not clear. Propose seller-declared only + editorial disclaimer.
- Overlap with children (religious children's books) — assign to Children when primary audience is children.
