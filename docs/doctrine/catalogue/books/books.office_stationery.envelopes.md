# books.office_stationery.envelopes — Envelopes

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.office_stationery.envelopes` · EN "Envelopes" · ID "Amplop"
- Synonyms: mailing envelopes, letter envelopes, DL envelopes
- Parent: Books → Office Stationery → Envelopes

## D2 Required
product name, brand, envelope_size enum ISO 269 (`C3|C4|C5|C5/6|C6|DL|custom`) [VERIFIED ISO 269], closure_type enum (`gummed|self_seal|peel_and_seal|wallet`), window (`none|address_window|double_window`), colour, pack_count.

## D3 Optional
paper_gsm_g_m2, security_tint (bool), finish (`laid|smooth|textured`), opacity_rating, inside_colour, outside_colour, use_case (`business|wedding|invitation|catalogue`).

## D4 Technical specs
envelope_width_mm, envelope_height_mm, paper_gsm, pack_count, pack_weight_g.

## D5 Variant axes
- `envelope_size` typically = separate SKU.
- `pack_count` (max 5) can be variant.
- `colour` (max 10) can be variant.

## D6 Media
Min 1 / Max 4.

## D7 Commercial
Fixed. Returnable yes if unopened.

## D8 Compliance
Postal-regulation window-position compliance (US USPS / UK Royal Mail / Pos Indonesia) — seller-declared only [UNRESOLVED verification].

## D9 Search attributes
Facets: envelope_size, closure_type, window, colour, paper_gsm, use_case, pack_count, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Amplop | Envelope |
| Amplop Jendela | Window Envelope |
| Amplop Lamaran | Application Envelope (ID specific) |

## D12 Unresolved
- "Amplop Lamaran" (ID specific application-form envelope) vs standard — treat as a specific product in the colour axis.
