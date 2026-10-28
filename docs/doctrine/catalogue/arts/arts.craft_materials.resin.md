# arts.craft_materials.resin — Resin (Craft)

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.craft_materials.resin` · EN "Resin" · ID "Resin"
- Synonyms: epoxy resin, UV resin, polyester resin, art resin
- Parent: Arts → Craft Materials → Resin

## D2 Required
product name, brand, resin_type enum (`epoxy_two_part|uv_cure_single_part|polyester|polyurethane`), volume_ml_or_weight_g, mixing_ratio (if two-part — e.g. "2:1 by volume"), cure_time_hours, sds_available (bool).

## D3 Optional
model, hardness_shore_d_after_cure, viscosity_cps, pot_life_minutes, max_pour_depth_mm, uv_resistant (bool), low_voc (bool), food_safe_after_cure (bool).

## D4 Technical specs
volume_ml_or_weight_g, mixing_ratio, cure_time_hours, pot_life_minutes.

## D5 Variant axes
- `volume_ml` typically separate SKU.

## D6 Media
Min 2 / Max 5.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- **BLOCKER (HAZMAT)**: GHS pictograms + hazard statements mandatory. UN number for shipping.
- IATA DGR for air shipping restrictions.
- SDS/MSDS mandatory.
- ASTM D4236 art-material hazard labelling.
- Food-safe-after-cure claims subject to FDA 21 CFR 175.300 or EU 10/2011.

## D9 Search attributes
Facets: resin_type, volume_ml, mixing_ratio, cure_time, uv_resistant, food_safe, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Resin | Resin |
| Resin Epoxy | Epoxy Resin |
| Resin UV | UV Resin |

## D12 Unresolved
- **HAZMAT shipping restrictions** — air-forbidden for many resin products.
- Food-safe-after-cure claims — regulatory, cannot be seller-asserted without data.
