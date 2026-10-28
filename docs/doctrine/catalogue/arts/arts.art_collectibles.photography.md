# arts.art_collectibles.photography — Fine Art Photography

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.art_collectibles.photography` · EN "Photography" · ID "Fotografi Seni"
- Synonyms: fine art photo prints, silver gelatin, C-type prints, platinum prints, giclée photography
- Parent: Arts → Art & Collectibles → Photography

## D2 Required
title_of_work, photographer_name, year_shot, year_printed (may differ), print_process enum (`silver_gelatin|c_type_chromogenic|platinum_palladium|cyanotype|giclee_photo|archival_pigment|dye_sublimation|instant_polaroid`), print_size, edition_size, edition_number, is_signed (bool), is_mounted (bool).

## D3 Optional
width_cm, height_cm, paper_or_substrate, framed_or_unframed, hand_printed_by_artist (bool), provenance, series_name.

## D4 Technical specs
width_cm, height_cm, weight_g.

## D5 Variant axes
- Edition numbers individually listed.
- `framed_or_unframed` (max 3).

## D6 Media
Min 5 / Max 15. Full, edition-number close-up, signature close-up (verso usually).

## D7 Commercial
Fixed. Insured + tracked.

## D8 Compliance
- Droit de suite.
- Archival-quality claims (acid-free paper, pigment stability) — ISO 18909 light-fastness for digital prints.

## D9 Search attributes
Facets: print_process, edition_size, print_size, photographer, year, framed_or_unframed, price.

## D10 Non-physical
N/A — digital photo files sold under licence are separate.

## D11 i18n
| ID | EN |
|---|---|
| Fotografi Seni | Fine Art Photography |
| Cetak Perak Gelatin | Silver Gelatin Print |

## D12 Unresolved
- Year-shot vs year-printed convention — both honoured.
