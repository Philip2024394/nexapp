# arts.art_collectibles.prints — Fine Art Prints

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.art_collectibles.prints` · EN "Prints" · ID "Cetakan Seni"
- Synonyms: giclée prints, screen prints, lithographs, etchings, woodcuts, limited-edition prints
- Parent: Arts → Art & Collectibles → Prints

## D2 Required
title_of_work, artist_name, year_published, print_technique enum (`giclee|screen_print_serigraph|lithograph_offset|lithograph_stone|etching|woodcut|linocut|aquatint|monotype|monoprint|digital_print_fine_art`), edition_size (number or `open_edition`), edition_number (text like "12/50" or `ap` or `hc` or `pp`) [VERIFIED edition convention], paper_substrate, paper_size, is_signed (bool).

## D3 Optional
width_cm, height_cm, framed_or_unframed, hand_coloured (bool), provenance, printer_credit, publisher_credit.

## D4 Technical specs
width_cm, height_cm, paper_size, weight_g.

## D5 Variant axes
- Each edition number is individually listed, not a variant.
- `framed_or_unframed` can be variant (max 3).

## D6 Media
Min 5 / Max 15. Full, edition-number close-up, signature close-up.

## D7 Commercial
Fixed. Returnable yes if unused unless specific framed/custom. Insured + tracked for high-value.

## D8 Compliance
- Droit de suite (if sold on secondary market for living artist).
- Edition-size integrity — must match artist/publisher record.

## D9 Search attributes
Facets: print_technique, edition_size, artist, year_published, framed_or_unframed, is_signed, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Cetak Seni | Fine Art Print |
| Litograf | Lithograph |
| Etsa | Etching |

## D12 Unresolved
- Open-edition "fine art print" distinction from mass-produced posters — needs editorial boundary.
