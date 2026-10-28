# books.collectibles.collectible_publications — Collectible Publications

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.collectibles.collectible_publications` · EN "Collectible Publications" · ID "Publikasi Koleksi"
- Synonyms: vintage magazines, comic books, zines (collectible), newspapers (historical)
- Parent: Books → Books & Media Collectibles → Collectible Publications

## D2 Required
title, publisher, publication_year, publication_date (if periodical), publication_type enum (`magazine|comic|newspaper|zine|catalogue|programme|other`), language, condition_grade.

## D3 Optional
issue_number, volume, edition_or_variant, cover_artist (comics), featured_person (magazines — e.g. "Beatles cover"), bagged_and_boarded (bool for comics), grading_service enum (`cgc|cbcs|pgx|ungraded`), grading_cert_number, grading_grade (numeric 0.5–10.0 per Overstreet/CGC) [VERIFIED Overstreet grading].

## D4 Technical specs
width_mm, height_mm, page_count, weight_g.

## D5 Variant axes
None — each copy one-of-one.

## D6 Media
Min 4 / Max 15. Required: cover, back, interior sample, close-ups of any defects, grading slab if graded.

## D7 Commercial
Fixed. Returnable: default `no`. Tracked + insured shipping.

## D8 Compliance
- Historical newspapers / wartime publications may have content requiring editorial sensitivity.
- Vintage adult magazines — age-check and jurisdictional [UNRESOLVED — depends on NEX adult-content policy].

## D9 Search attributes
Facets: publication_type, publisher, publication_year, grading_grade range, grading_service, condition_grade, price. Sort: price, year.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Majalah Koleksi | Collectible Magazine |
| Komik Lama | Vintage Comic |
| Zine | Zine |

## D12 Unresolved
- Grading-service numeric scale differs slightly across CGC/CBCS/PGX — propose storing grading_grade as number + grading_service as context.
- Adult-content classification for vintage publications. Flag for founder.
