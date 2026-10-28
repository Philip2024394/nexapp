# office.packaging_shipping.cardboard_boxes — Cardboard Boxes

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.packaging_shipping.cardboard_boxes` · EN "Cardboard Boxes" · ID "Kardus"
- Synonyms: shipping cartons, corrugated boxes, mailer boxes
- Parent: Office → Packaging & Shipping → Cardboard Boxes

## D2 Required
product name, box_style enum (`rsc|fol|hsc|die_cut_mailer|lid_and_base|telescope|flute_type_only`) [VERIFIED ASTM D5118], flute_type enum (`a|b|c|e|f|bc_double_wall|aaa_triple_wall`) [VERIFIED FEFCO], internal_dimensions_wdh_mm, bursting_strength_or_ect, pack_count.

## D3 Optional
colour (kraft|white|brown), printed (bool), fsc_certified (bool), recycled_content_percent, max_weight_capacity_kg.

## D4 Technical specs
internal_width_mm, internal_depth_mm, internal_height_mm, external dims, bursting_strength_kpa (Mullen) OR edge_crush_test_lb_in (ECT) [VERIFIED TAPPI T-810], pack_count, pack_weight_kg.

## D5 Variant axes
- `internal_dimensions_wdh_mm` typically separate SKU.
- `pack_count` (max 5) can be variant.

## D6 Media
Min 2 / Max 5. Flat + assembled.

## D7 Commercial
Fixed. Returnable yes if sealed. Bulk shipping discounts.

## D8 Compliance
- IATA/ICAO regulatory boxes (UN-tested packaging) require UN mark + specific testing per 49 CFR / ICAO TI [UNRESOLVED — restrict to certified listings only].
- FSC/PEFC claims need certificate.

## D9 Search attributes
Facets: box_style, flute_type, internal_dims, ECT/Mullen range, colour, pack_count, price. Sort: price per box.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Kardus | Cardboard Box |
| Dus | Carton |

## D12 Unresolved
- UN-rated hazmat packaging — different compliance regime; may need separate sub-leaf.
- Price-per-box derived field.
