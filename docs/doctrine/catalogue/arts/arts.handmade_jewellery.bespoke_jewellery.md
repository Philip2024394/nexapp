# arts.handmade_jewellery.bespoke_jewellery — Bespoke Jewellery

> Batch B1 · 2026-10-28 · listing_class = `made_to_order`

## D1 Identity
- `leaf_id`: `arts.handmade_jewellery.bespoke_jewellery` · EN "Bespoke Jewellery" · ID "Perhiasan Pesanan"
- Synonyms: fine jewellery (custom), engagement rings (bespoke), high-value custom pieces
- Parent: Arts → Handmade Jewellery → Bespoke Jewellery

## D2 Required
product name, maker_or_atelier, piece_type (text — e.g. "engagement ring"), metal_type, metal_fineness, gemstone_primary (type, carat), gemstone_certification (`gia|igi|ags|ssef|aglabs|none`), kimberley_process_compliance (diamond-specific) (bool), lead_time_days.

## D3 Optional
model, side_stones, hallmark_assay_office, insurance_valuation_included (bool), certificate_number, treatment_disclosed.

## D4 Technical specs
metal_weight_g, primary_gemstone_ct, primary_gemstone_cut_grade, primary_gemstone_colour_grade, primary_gemstone_clarity_grade (per GIA 4Cs for diamonds).

## D5 Variant axes
- Typically none — each piece is unique.

## D6 Media
Min 6 / Max 20. Multiple angles, certification document photo.

## D7 Commercial
Fixed deposit + balance (needs commercial model — see D12). **Non-returnable** typical.

## D8 Compliance
- **BLOCKER (high-value authenticity)**: Certification required for stones ≥0.5ct typical.
- **Kimberley Process** for rough + certain polished diamonds (international trade).
- CITES for coral/ivory/tortoiseshell/certain pearls.
- Hallmark per jurisdiction.
- Insurance valuation often required by insurers.

## D9 Search attributes
Facets: piece_type, metal_type, primary_gemstone_type, carat range, certification, maker, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Perhiasan Kustom | Custom Jewellery |
| Cincin Tunangan | Engagement Ring |

## D12 Unresolved
- **BLOCKER (high-value)**: Dispute-resolution and inspection path. SafeTrade 3rd-party inspection recommended for high-value transactions.
- Deposit + balance payment model — but NEX never handles funds. Buyer-seller direct arrangement; NEX provides SafeTrade copy.
- Conflict-mineral disclosure (gold mining) — ethical sourcing.
