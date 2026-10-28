# office.material_handling.slings — Slings

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.material_handling.slings` · EN "Slings" · ID "Sling / Tali Angkat"
- Synonyms: web slings, round slings, chain slings, wire-rope slings
- Parent: Office → Material Handling → Slings

## D2 Required
product name, brand, sling_type enum (`web_flat|round|chain|wire_rope`), material (`polyester|nylon|chain_g80|chain_g100|wire_rope_6x19|wire_rope_6x36`), wll_kg (straight vertical), length_m, colour (per EN convention: `violet=1t`, `green=2t`, `yellow=3t`, `grey=4t`, `red=5t`, `brown=6t`, `blue=8t`, `orange=10t`) [VERIFIED EN 1492-2 colour code].

## D3 Optional
model, end_fittings (`eye_each_end|hook_each_end|master_link`), min_breaking_force_kg, safety_factor, outer_sleeve_material, cert_included (bool).

## D4 Technical specs
wll_kg, length_m, width_mm (web), min_breaking_force_kg, weight_kg.

## D5 Variant axes
- `wll_kg`/`colour` typically separate SKU.
- `length_m` can be variant (max 10).

## D6 Media
Min 2 / Max 6. Full sling, close-up of WLL tag.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- EN 1492-1 (web); EN 1492-2 (round) [VERIFIED].
- EN 818 (chain slings).
- Colour-code enforcement — mandatory per EN; mis-coloured sling = safety hazard.

## D9 Search attributes
Facets: sling_type, material, wll_kg, length_m, colour, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Sling Angkat | Lifting Sling |
| Webbing Sling | Web Sling |

## D12 Unresolved
- Colour-code mis-match detection — propose automated validation on upload (wll_kg vs colour per EN table).
