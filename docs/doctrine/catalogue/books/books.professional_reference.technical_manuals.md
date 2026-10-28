# books.professional_reference.technical_manuals — Technical Manuals

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.professional_reference.technical_manuals` · EN "Technical Manuals" · ID "Manual Teknis"
- Synonyms: service manuals, repair manuals, operations manuals
- Parent: Books → Professional Reference → Technical Manuals

## D2 Required
title, publisher, language, binding, condition, equipment_covered (text), manual_type enum (`service|operation|repair|installation|parts_catalogue|user`).

## D3 Optional
author (often corporate), isbn_13 (often absent for proprietary manuals), publication_year, edition, part_number, page_count, revision_level, applicable_models (multi text).

## D4 Technical specs
width_mm, height_mm, spine_mm, weight_g, page_count.

## D5 Variant axes
- `edition` typically separate SKU.
- `applicable_model` can be variant (max 10).

## D6 Media
Min 2 / Max 6. Front cover, back cover, title page showing part number.

## D7 Commercial
Fixed. Returnable yes (new).

## D8 Compliance
- Copyright: manufacturer manuals often restricted — proof-of-authorised-reseller sometimes required [UNRESOLVED — enforcement policy].

## D9 Search attributes
Facets: equipment_covered, manual_type, publisher, year, condition, language, price.

## D10 Non-physical
N/A — digital manuals = `digital_products.manuals`.

## D11 i18n
| ID | EN |
|---|---|
| Manual Teknis | Technical Manual |
| Manual Servis | Service Manual |
| Buku Petunjuk | Instruction Manual |

## D12 Unresolved
- Haynes/Chilton auto manuals — common grey area; mostly OK as these are published books with ISBNs.
- OEM service manuals — manufacturer IP enforcement risk.
