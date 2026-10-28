# books.office_stationery.writing_supplies — Writing Supplies (umbrella)

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.office_stationery.writing_supplies` · EN "Writing Supplies" · ID "Perlengkapan Menulis"
- Synonyms: markers, highlighters, erasers, sharpeners, correction fluid, ink refills
- Parent: Books → Office Stationery → Writing Supplies
- **This is an umbrella leaf.** Downstream specialisation may be required post-launch.

## D2 Required
product name, brand, item_type enum (`highlighter|permanent_marker|whiteboard_marker|chalk_marker|eraser|sharpener|correction_fluid|correction_tape|ink_refill|ruler|stapler|stapler_remover|hole_punch|tape_dispenser`), colour (where applicable), pack_count.

## D3 Optional
model, tip_type (chisel|bullet|fine for markers), ink_colour, ink_capacity_ml, erasable (bool), low_odour (bool), xylene_free (bool).

## D4 Technical specs
length_mm, weight_g, pack_count, ink_capacity_ml.

## D5 Variant axes
- `colour` (max 24, markers/highlighters)
- `pack_count` (max 10)

## D6 Media
Min 1 / Max 5.

## D7 Commercial
Fixed. Returnable yes if unopened.

## D8 Compliance
- Permanent markers may contain xylene / toluene — GHS label if bulk refill.
- Non-toxic certification (ACMI AP) commonly claimed for school-safe markers.
- Air shipping of solvent-markers can be restricted at bulk scale.

## D9 Search attributes
Facets: item_type (primary), colour, brand, pack_count, erasable, price. Sort: price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Stabilo | Highlighter |
| Spidol | Marker |
| Penghapus | Eraser |
| Rautan | Sharpener |

## D12 Unresolved
- **Umbrella risk**: this leaf is heterogeneous (markers to staplers). Post-launch: split into `markers`, `writing_accessories`, `desk_tools`. Register note.
- Overlap with `school_supplies.pens` (hybrid markers). Resolve by primary intended use.
