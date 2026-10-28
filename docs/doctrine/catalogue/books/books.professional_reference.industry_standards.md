# books.professional_reference.industry_standards — Industry Standards

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.professional_reference.industry_standards` · EN "Industry Standards" · ID "Standar Industri"
- Synonyms: codes, specifications, standards documents (printed)
- Parent: Books → Professional Reference → Industry Standards

## D2 Required
title, standard_body (`ISO|IEC|ANSI|ASTM|BSI|DIN|JIS|SNI|other`), standard_number, publication_year, edition_or_revision, language, condition.

## D3 Optional
isbn_13 (standards often lack ISBN), status (`active|withdrawn|superseded`), supersedes (standard number), superseded_by (standard number), page_count, binding, part_number.

## D4 Technical specs
width_mm, height_mm, spine_mm, weight_g, page_count.

## D5 Variant axes
- `edition_or_revision` typically separate SKU.

## D6 Media
Min 1 / Max 4.

## D7 Commercial
Fixed. Returnable yes (new) [UNRESOLVED — many standards bodies restrict returns per their licence].

## D8 Compliance / Licensing
- **BLOCKER**: ISO/IEC/ANSI publications are copyright-protected. Resale of **used** copies is generally lawful (first-sale doctrine, US) but **new** copies may require authorised-distributor status.
- Standards bodies' Terms often restrict electronic copying & redistribution; printed copies generally transferable.
- Expired/withdrawn standards may still be sold but should be labelled "status: withdrawn" for buyer awareness.

## D9 Search attributes
Facets: standard_body, standard_number (search), publication_year, status, language, condition, price.

## D10 Non-physical
N/A — digital standards licence = separate `digital_products.standards_licence` leaf; NOT a book.

## D11 i18n
| ID | EN |
|---|---|
| Standar Industri | Industry Standard |
| SNI | SNI (Standar Nasional Indonesia) |
| ISO | ISO |

## D12 Unresolved
- **BLOCKER**: distributor-authorisation policy. Does NEX require seller to prove authorised-distributor status for new standards? Flag for founder.
- Withdrawn/superseded flag — propose auto-generated chip on listing display.
- Multiple editions of same standard — buyers may need the specific superseded edition for legal/historical reasons; preserve edition_or_revision rigour.
