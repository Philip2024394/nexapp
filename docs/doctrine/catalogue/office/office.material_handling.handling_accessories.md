# office.material_handling.handling_accessories — Handling Accessories

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.material_handling.handling_accessories` · EN "Handling Accessories" · ID "Aksesori Material Handling"
- Synonyms: strapping tools, drum movers (small), pallet strapping, lifting cups
- Parent: Office → Material Handling → Handling Accessories
- **Umbrella leaf.**

## D2 Required
product name, item_type enum (`strapping_tool|strapping_coil|drum_lifter|suction_lifter|pallet_strap|tie_down|ratchet_strap|cargo_net`), wll_or_capacity (where applicable), material.

## D3 Optional
width_mm (strapping), length_m (strapping/strap), colour, hook_type (for straps), buckle_type.

## D4 Technical specs
wll_or_capacity, dimensions, weight_g.

## D5 Variant axes
- `size` typically separate SKU.
- `colour` (max 6).

## D6 Media
Min 1 / Max 4.

## D7 Commercial
Fixed. Bulk pricing.

## D8 Compliance
Ratchet straps: EN 12195-2 lashing standard [VERIFIED].

## D9 Search attributes
Facets: item_type, wll_or_capacity, material, dimensions, colour, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Tali Pengikat | Tie-Down Strap |
| Strap Ratchet | Ratchet Strap |

## D12 Unresolved
- Umbrella — low-confidence; may split post-launch.
