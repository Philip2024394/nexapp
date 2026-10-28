# arts.art_collectibles.limited_editions — Limited Editions (Catch-all)

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.art_collectibles.limited_editions` · EN "Limited Editions" · ID "Edisi Terbatas"
- Synonyms: artist multiples, limited-run collectibles, art editions
- Parent: Arts → Art & Collectibles → Limited Editions
- **Catch-all leaf**: items that are editioned but don't fit cleanly into `prints` or `photography` (e.g. sculpture multiples, artist books, cast objects, posters-as-art).

## D2 Required
title_of_work, artist_name, year_published, item_type (text), medium_or_material, edition_size, edition_number, is_signed (bool), coa_included (bool).

## D3 Optional
dimensions_mm, weight_g, publisher, provenance, framed_or_mounted.

## D4 Technical specs
dimensions_mm, weight_g.

## D5 Variant axes
- Each edition number is a listing instance.

## D6 Media
Min 5 / Max 15.

## D7 Commercial
Fixed. Returnable yes if unused.

## D8 Compliance
Droit de suite where applicable.

## D9 Search attributes
Facets: item_type, medium, edition_size, year_published, artist, is_signed, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Edisi Terbatas | Limited Edition |

## D12 Unresolved
- **Duplicate-with-prints-photography**: catch-all overlaps with those two leaves. Pre-launch: define boundary — this leaf = "editioned fine art that is NOT print or photo". Example: sculpture multiples (3D), artist books, cast ceramics.
