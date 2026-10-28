# arts.craft_materials.beads — Beads

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.craft_materials.beads` · EN "Beads" · ID "Manik-Manik"
- Synonyms: seed beads, delica beads, pony beads, glass beads, acrylic beads
- Parent: Arts → Craft Materials → Beads

## D2 Required
product name, bead_type enum (`seed_round|seed_delica|seed_charlotte|cube|bugle|pony|crystal_bicone|crystal_rondelle|lampwork|wood|ceramic|acrylic|metal|rhinestone`), material (`glass|crystal|acrylic|wood|ceramic|metal|stone`), size (format `11/0` / `6/0` / mm diameter), colour_or_finish, pack_count_or_weight_g.

## D3 Optional
model, finish (`matte|opaque|transparent|silver_lined|galvanized|duracoat`), hole_size_mm, grade (if gemstone), czech_or_japanese (brand hint).

## D4 Technical specs
diameter_mm, hole_size_mm, pack_count or weight_g.

## D5 Variant axes
- `colour_or_finish` (max 50) — bead colour ranges are vast.
- `size` (max 10).

## D6 Media
Min 2 / Max 6. Close-up swatch + packaging.

## D7 Commercial
Fixed. Bulk pricing.

## D8 Compliance
- **CHILDREN'S PRODUCT**: beads <6mm are small-parts choking hazard for <3y. Age-labelling mandatory.
- EN 71-3 chemical safety for toys.

## D9 Search attributes
Facets: bead_type, material, size, colour, finish, pack_count, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Manik-manik | Beads |
| Manik Kaca | Glass Beads |
| Manik Kristal | Crystal Beads |

## D12 Unresolved
- Small-parts hazard — age-gate copy mandatory when primary buyer intent is child-facing craft.
