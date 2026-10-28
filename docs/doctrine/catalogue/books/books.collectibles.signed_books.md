# books.collectibles.signed_books — Signed Books

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.collectibles.signed_books` · EN "Signed Books" · ID "Buku Bertanda Tangan"
- Synonyms: autographed books, inscribed books
- Parent: Books → Books & Media Collectibles → Signed Books

## D2 Required
title, author, publisher, publication_year, isbn_13 (if applicable), condition_grade, signature_type enum (`signed_only|inscribed|dedication|association`), signed_by (person name), authentication_type enum (`seller_attestation|coa_from_publisher|coa_from_authentication_service|no_authentication`).

## D3 Optional
inscription_text, place_signed, date_signed, authentication_service_name (PSA/JSA/Beckett), authentication_cert_number, provenance_notes.

## D4 Technical specs
Standard book dims.

## D5 Variant axes
None.

## D6 Media
Min 5 / Max 15. Required: front, back, spine, title page, signature close-up, any inscription, CoA if present.

## D7 Commercial
Fixed. Returnable: default `no` for authenticated; buyer-protection guidance [NEX_PROPOSAL].

## D8 Compliance / Verification
- **BLOCKER**: Signature authentication liability. NEX cannot authenticate signatures. All claims must be seller-declared. Suggested: display `authentication_type` prominently on listing.
- Fraud risk is highest in this leaf of all books. SafeTrade inspection path recommended for high-value [NEX_PROPOSAL].

## D9 Search attributes
Facets: author (signer), authentication_type, condition_grade, year, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Buku Bertanda Tangan | Signed Book |
| Tanda Tangan Asli | Autograph |

## D12 Unresolved
- **BLOCKER**: Does NEX display an "authentication tier" badge based on authentication_type? Proposed yes.
- Facsimile signatures (printed from original) are often sold as "signed" — define policy. Propose: must be labelled explicitly in signature_type (new value `facsimile_printed`).
