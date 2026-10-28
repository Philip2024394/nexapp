# arts.handmade_jewellery.artisan_rings — Artisan Rings

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.handmade_jewellery.artisan_rings` · EN "Artisan Rings" · ID "Cincin Pengrajin"
- Synonyms: handmade rings, silver rings, gold rings (handmade), gemstone rings
- Parent: Arts → Handmade Jewellery → Artisan Rings

## D2 Required
product name, maker_or_atelier, metal_type (`silver|gold|platinum|titanium|stainless_steel|brass|copper|mixed_metal`), metal_fineness (hallmark — `925|750|585|999|950_pt` per ISO 9202) [VERIFIED ISO 9202], ring_size_system (`iso_us|iso_uk|iso_eu`) [VERIFIED ISO 8653], ring_size, has_gemstone (bool), gemstone_type (if present).

## D3 Optional
model, hallmark_assay_office, gemstone_weight_ct, gemstone_cut, gemstone_colour, gemstone_clarity, treatment_disclosed (bool), rhodium_plated (bool), engraving_available (bool), lead_time_days (if made-to-order).

## D4 Technical specs
ring_size (per system), band_width_mm, band_thickness_mm, weight_g, gemstone_weight_ct.

## D5 Variant axes
- `ring_size` (max 20).
- `metal_type` can be variant.

## D6 Media
Min 4 / Max 10. Front, side profile, hallmark close-up, on-finger reference.

## D7 Commercial
Fixed. Returnable yes if unused unless personalised. Tracked + insured shipping for high-value.

## D8 Compliance
- **Precious-metal hallmark**: EU jurisdictions require assay-office hallmark for metal fineness claims. UK Hallmarking Act 1973; CIBJO. ID has no mandatory hallmarking but SNI exists.
- Kimberley Process for diamonds (if large).
- CITES for coral / ivory / certain shells.

## D9 Search attributes
Facets: metal_type, metal_fineness, ring_size, has_gemstone, gemstone_type, maker, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Cincin Perak | Silver Ring |
| Cincin Emas | Gold Ring |
| Cincin Pengrajin | Artisan Ring |

## D12 Unresolved
- **Hallmark jurisdictional variance**. Seller declaration vs assay cert.
- Gemstone-treatment disclosure (heated, filled, dyed) — common fraud risk.
