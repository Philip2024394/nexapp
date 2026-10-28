# arts.handmade_home.handmade_furniture — Handmade Furniture

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.handmade_home.handmade_furniture` · EN "Handmade Furniture" · ID "Furnitur Buatan Tangan"
- Synonyms: artisan furniture, bespoke furniture, one-off furniture
- Parent: Arts → Handmade Home Goods → Handmade Furniture

## D2 Required
product name, maker_or_atelier, furniture_type (text — e.g. "coffee table", "bookshelf", "sideboard"), dimensions_wdh_mm, primary_material, finish, lead_time_days (critical for made-to-order).

## D3 Optional
model, is_one_of_a_kind (bool), is_made_to_order (bool), wood_species_latin, country_of_origin, assembly_required, warranty_months, provenance_notes.

## D4 Technical specs
width_mm, depth_mm, height_mm, weight_kg, max_load_capacity_kg.

## D5 Variant axes
- `finish` or `wood_species` (max 6).
- `size` (max 3).

## D6 Media
Min 4 / Max 15. Front, side, back, close-up of finish, provenance mark.

## D7 Commercial
Fixed. **Non-returnable** for one-of-a-kind + made-to-order (declaration mandatory). Freight.

## D8 Compliance
- CITES for restricted wood species (rosewood, Dalbergia spp.) [UNRESOLVED — must declare species for restricted wood].
- Formaldehyde emissions on engineered wood.

## D9 Search attributes
Facets: furniture_type, primary_material, dimensions, maker, lead_time, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Furnitur Buatan Tangan | Handmade Furniture |
| Furnitur Pengrajin | Artisan Furniture |

## D12 Unresolved
- **Lead-time + non-returnable** interaction: honest copy mandatory before buyer commits.
- Restricted wood (rosewood etc.) — CITES documentation path.
- One-of-one vs made-to-order boundary.
