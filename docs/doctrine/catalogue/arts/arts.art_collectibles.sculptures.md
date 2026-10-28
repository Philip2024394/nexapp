# arts.art_collectibles.sculptures — Sculptures

> Batch B1 · 2026-10-28 · listing_class = `one_of_one`

## D1 Identity
- `leaf_id`: `arts.art_collectibles.sculptures` · EN "Sculptures" · ID "Patung"
- Synonyms: 3D artworks, carvings, cast sculptures, metal sculptures, ceramic sculptures (fine art)
- Parent: Arts → Art & Collectibles → Sculptures
- **listing_class = `one_of_one`** (unless cast series — then edition number).

## D2 Required
title_of_work, artist_name, year_created, medium_or_material (`bronze_cast|marble_carved|wood_carved|stone_carved|ceramic|mixed_media|resin|found_object`), width_cm, depth_cm, height_cm, weight_kg, edition_type (`unique|edition_of_X|artist_proof|hc`), is_signed (bool), coa_included (bool).

## D3 Optional
edition_number (if cast series — e.g. "3/8"), base_or_plinth_included (bool), condition_notes, provenance_history, insurance_valuation.

## D4 Technical specs
width_cm, depth_cm, height_cm, weight_kg (shipping weight).

## D5 Variant axes
- None (unique) OR edition_number is individually listed (not variant).

## D6 Media
Min 8 / Max 20. Multiple 360° angles, close-ups, signature, provenance.

## D7 Commercial
Fixed. Non-returnable typical. **Specialist shipping** mandatory (crating + insurance) — flag large/heavy for freight.

## D8 Compliance
- Droit de suite (same as paintings).
- Export control for culturally significant pieces.
- CITES for ivory / coral / certain woods / tortoiseshell.
- Shipping fragile/heavy — buyer-advisory copy.

## D9 Search attributes
Facets: medium, edition_type, size range, year_created, artist, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Patung | Sculpture |
| Patung Perunggu | Bronze Sculpture |
| Ukiran Kayu | Wood Carving |

## D12 Unresolved
- Cast-series editioning convention preservation.
- Heavy-item freight quotes typically require seller→buyer custom quote; outside listing fixed price.
