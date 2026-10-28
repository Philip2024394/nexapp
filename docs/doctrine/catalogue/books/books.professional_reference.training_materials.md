# books.professional_reference.training_materials — Training Materials

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.professional_reference.training_materials` · EN "Training Materials" · ID "Materi Pelatihan"
- Synonyms: training manuals, workbooks (professional), course binders, exam prep (professional)
- Parent: Books → Professional Reference → Training Materials

## D2 Required
title, publisher or training_body, language, condition, binding, certification_pathway (text — e.g. "PMP", "CFA Level 1", "AWS Solutions Architect").

## D3 Optional
author, isbn_13, publication_year, edition (critical for current exam syllabi), page_count, mock_exam_included (bool), online_access_code_included (bool), expiry_date_of_access_code.

## D4 Technical specs
width_mm, height_mm, spine_mm, weight_g, page_count.

## D5 Variant axes
- `edition` typically separate SKU.

## D6 Media
Min 2 / Max 6.

## D7 Commercial
Fixed. Returnable yes (new) unless access code redeemed [UNRESOLVED — needs policy for codes].

## D8 Compliance
- Access-code redemption: once redeemed, cannot be resold. Buyer-warning copy mandatory [NEX_PROPOSAL].

## D9 Search attributes
Facets: certification_pathway, publisher, year/edition (recency filter — critical), language, condition, price.

## D10 Non-physical
N/A — pure online courses = `digital_products.courses`.

## D11 i18n
| ID | EN |
|---|---|
| Materi Pelatihan | Training Material |
| Buku Persiapan Ujian | Exam Prep Book |

## D12 Unresolved
- **Access-code policy**: how to prevent resale of redeemed codes? Current proposal: seller declares status; buyer warned.
- Overlap with `books.education` for certification textbooks that are also general education (e.g. accounting textbooks).
