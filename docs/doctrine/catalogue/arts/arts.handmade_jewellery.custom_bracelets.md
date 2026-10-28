# arts.handmade_jewellery.custom_bracelets — Custom Bracelets

> Batch B1 · 2026-10-28 · listing_class = `made_to_order`

## D1 Identity
- `leaf_id`: `arts.handmade_jewellery.custom_bracelets` · EN "Custom Bracelets" · ID "Gelang Kustom"
- Synonyms: name bracelets, charm bracelets, bead bracelets (custom), friendship bracelets
- Parent: Arts → Handmade Jewellery → Custom Bracelets

## D2 Required
product name, maker_or_atelier, bracelet_type enum (`bangle|cuff|link_chain|bead_strung|cord_knotted|wrap|tennis`), metal_type (if metal), wrist_size_cm_range, buyer_input_fields multi (`name|monogram|birthstone|charms`), lead_time_days.

## D3 Optional
model, closure_type, adjustable (bool), charm_count_available, gemstone_options, length_adjustment_range_cm.

## D4 Technical specs
wrist_size_cm_range, bracelet_length_cm, bracelet_width_mm, weight_g.

## D5 Variant axes
- `wrist_size` (max 10).
- `metal_type` can be variant.

## D6 Media
Min 3 / Max 8.

## D7 Commercial
Fixed. **Non-returnable** (personalised).

## D8 Compliance
- ISO 9202 fineness (if metal) [VERIFIED].
- Personalisation returns policy.

## D9 Search attributes
Facets: bracelet_type, metal_type, wrist_size, buyer_input_fields, maker, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Gelang Kustom | Custom Bracelet |
| Gelang Nama | Name Bracelet |

## D12 Unresolved
- Personalisation returns policy consistency with other `made_to_order` leaves.
