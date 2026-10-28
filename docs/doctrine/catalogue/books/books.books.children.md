# books.books.children — Children's Books

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.books.children` · EN "Children's Books" · ID "Buku Anak"
- Synonyms: picture books, board books, kids' books, YA books
- Parent: Books → Books → Children's Books

## D2 Required
title, author, language, binding, condition, isbn_13, age_range (`0-2|3-5|6-8|9-12|13-17`) [VERIFIED Google #784 age range convention].

## D3 Optional
subtitle, publisher, publication_year, illustrator, series_name, series_number, reading_level (Lexile / AR), summary, awards (e.g. Caldecott), is_board_book (bool), has_activity_components (bool — pop-ups, stickers), audio_cd_included (bool).

## D4 Technical specs
width_mm, height_mm, spine_mm, weight_g, page_count.

## D5 Variant axes
Binding = separate ISBN. No variants typical.

## D6 Media
Min 3 / Max 10. Required: front, back, interior spread. [NEX_PROPOSAL — interior spread essential for buyer to judge age-appropriateness.]

## D7 Commercial
Fixed. Returnable yes (new). Media-rate shipping.

## D8 Compliance
- **If includes toys/components**: ASTM F963 (US) [VERIFIED] / EN 71 (EU) [VERIFIED] / SNI ISO 8124 (ID) [VERIFIED].
- **CPSIA (US)**: children's products <12y require lead/phthalate compliance [VERIFIED CPSC].
- **Small parts choking**: must label age 3+ if small parts present.
- Battery: typically none; sound-book coin cells need button-battery warning per ASTM F3444.

## D9 Search attributes
Facets: age_range, language, binding (board-book flag), condition, illustrator, publisher, series, price. Sort: newest, best-seller.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Buku Anak | Children's Book |
| Buku Papan | Board Book |
| Buku Bergambar | Picture Book |
| Buku Remaja | YA / Teen Book |

## D12 Unresolved
- Sound-books / book-with-plush treated as book-leaf or toy-leaf? Propose: book if ISBN present and primary intent is reading. Flag for founder.
- Age-range cross-border variance (ID vs US vs EU standards). Propose publishing seller-declared age + displaying both ID and global labels.
