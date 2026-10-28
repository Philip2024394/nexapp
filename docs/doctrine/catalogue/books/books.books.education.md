# books.books.education — Education Books (Textbooks)

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.books.education` · EN "Education" · ID "Buku Pelajaran"
- Synonyms: textbooks, schoolbooks, academic books, study guides
- Parent: Books → Books → Education

## D2 Required
title, author, language, binding, condition, isbn_13, curriculum_level enum (`primary|lower_secondary|upper_secondary|higher_ed|professional`) [VERIFIED Shopify educational.yml + ISCED 2011], subject (text — Mathematics, Physics, etc.).

## D3 Optional
subtitle, publisher, publication_year, edition, page_count, grade (e.g. "Grade 7", "Kelas 7"), curriculum (e.g. "Kurikulum Merdeka", "IB", "Cambridge IGCSE") [NEX_PROPOSAL — Indonesia curriculum vocab], solutions_included (bool), workbook_included (bool).

## D4 Technical specs
width_mm, height_mm, spine_mm, weight_g, page_count.

## D5 Variant axes
- `edition` typically denotes separate ISBN (not variant).
- `student_edition` vs `teacher_edition` — permitted variant, max 2 [CONVENTION].

## D6 Media
Min 2 / Max 10. Front + back + sample inside page. [NEX_PROPOSAL — inside page helps buyers confirm curriculum fit.]

## D7 Commercial
Fixed. Returnable yes (new). Shipping media-rate.

## D8 Compliance
None hazmat/battery. Curriculum alignment claims should match publisher imprint [UNRESOLVED — enforcement model].

## D9 Search attributes
Facets: curriculum_level, grade, subject, curriculum, language, condition, binding, publisher, year, price. Sort: newest edition, price.

## D10 Non-physical
N/A — digital textbooks are separate `digital_products.ebooks.education` leaf.

## D11 i18n
| ID | EN |
|---|---|
| Buku Pelajaran | Textbook |
| Buku Sekolah | School Book |
| Buku Kuliah | University Book |
| Kurikulum Merdeka | Merdeka Curriculum |

## D12 Unresolved
- Indonesia-specific curriculum enumeration (Merdeka, K13, 2013 revisi) — needs ID education expert review.
- "Teacher's edition" risk — teacher solutions can be sensitive; needs policy (no listing without evidence of educator status? too strict?).
- International-edition grey-market issue — ISBN-13 shared across editions is a known publisher dispute area.
