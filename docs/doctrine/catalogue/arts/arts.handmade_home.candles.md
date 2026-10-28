# arts.handmade_home.candles — Candles (Handmade)

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.handmade_home.candles` · EN "Candles" · ID "Lilin"
- Synonyms: scented candles, pillar candles, soy candles, beeswax candles, tealights (handmade)
- Parent: Arts → Handmade Home Goods → Candles

## D2 Required
product name, maker_or_atelier, candle_form enum (`pillar|container_jar|tealight|votive|taper|wax_melt|birthday|floating`), wax_type (`soy|beeswax|paraffin|coconut|palm|blend`), fragrance_type (`unscented|essential_oil|fragrance_oil`), scent_name (if scented), fragrance_disclosure (text — list potential allergens per IFRA 26 allergens), dimensions_or_jar_size, estimated_burn_time_hours.

## D3 Optional
model, wick_material (`cotton|wood|hemp`), fragrance_percent_load, dye_free (bool), vegan (bool), hand_poured (bool), is_one_of_a_kind.

## D4 Technical specs
diameter_mm, height_mm, weight_g, estimated_burn_time_hours, melt_temp_c.

## D5 Variant axes
- `scent_name` (max 20).
- `size` (max 4).

## D6 Media
Min 2 / Max 6.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- EN 15493 candle fire safety [VERIFIED]; ASTM F2417 [VERIFIED].
- IFRA fragrance safety guidelines.
- Allergen disclosure: EU Cosmetics Reg 1223/2009 lists 26 allergens; copy mandatory if present ≥0.001%.
- **Flammable item** — courier restrictions; air shipping often restricted.

## D9 Search attributes
Facets: candle_form, wax_type, fragrance_type, scent_name, burn_time, vegan, dye_free, maker, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Lilin Aromaterapi | Scented Candle |
| Lilin Soya | Soy Candle |

## D12 Unresolved
- **Flammable shipping** — air carriers restrict.
- Fragrance allergen disclosure — mandatory enforcement.
