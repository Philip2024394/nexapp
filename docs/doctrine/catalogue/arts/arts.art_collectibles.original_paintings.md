# arts.art_collectibles.original_paintings — Original Paintings

> Batch B1 · 2026-10-28 · listing_class = `one_of_one`

## D1 Identity
- `leaf_id`: `arts.art_collectibles.original_paintings` · EN "Original Paintings" · ID "Lukisan Asli"
- Synonyms: original artwork, one-off paintings, hand-painted artworks
- Parent: Arts → Art & Collectibles → Original Paintings
- **listing_class = `one_of_one`** — quantity inherently = 1.

## D2 Required
title_of_work, artist_name, year_created, medium (`oil_on_canvas|acrylic_on_canvas|watercolour|mixed_media|oil_on_board|other`), width_cm, height_cm, is_signed (bool), is_dated (bool), coa_included (bool), framed_or_unframed.

## D3 Optional
depth_cm (stretched canvas), condition_notes, provenance_history, exhibition_history, artist_biography, series_name, signature_location, verso_notes, insurance_valuation.

## D4 Technical specs
width_cm, height_cm, depth_cm, weight_kg (packaged for shipping).

## D5 Variant axes
- **None** — one-of-one.

## D6 Media
Min 6 / Max 20. Front overall, close-up detail, signature, verso, provenance docs, CoA if present.

## D7 Commercial
Fixed. **Non-returnable** typical (collectible). Insured + specialist shipping (crate for large works). Qty=1 enforced [NEX_PROPOSAL].

## D8 Compliance
- **Artist Resale Right (droit de suite)** — may trigger royalty obligations in EU, UK, AU for living artists / within 70y after death. Depends on seller jurisdiction + sale value [UNRESOLVED — needs doctrine].
- Export control for artworks of national significance (ID, Italy etc.) — age thresholds vary.
- ISO 9706 permanence of paper (for works on paper) [VERIFIED].
- Certificate of Authenticity convention — artist-signed CoA is customary [CONVENTION].

## D9 Search attributes
Facets: medium, size range, year_created, artist_name, framed_or_unframed, is_signed, coa_included, price.

## D10 Non-physical
N/A — this is physical artwork. Digital art NFTs are separate (not in B1 scope, no NEX NFT support).

## D11 i18n
| ID | EN |
|---|---|
| Lukisan Asli | Original Painting |
| Lukisan Minyak | Oil Painting |
| Lukisan Cat Air | Watercolour |

## D12 Unresolved
- **BLOCKER (droit de suite)**: resale-right royalty — jurisdictional. Needs seller declaration or NEX disclosure copy.
- Export-control age thresholds vary per country.
- CoA fraud risk — NEX cannot authenticate. Honest copy "as described by seller".
