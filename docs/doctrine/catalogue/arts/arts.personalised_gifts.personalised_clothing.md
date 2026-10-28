# arts.personalised_gifts.personalised_clothing — Personalised Clothing

> Batch B1 · 2026-10-28 · listing_class = `made_to_order`

## D1 Identity
- `leaf_id`: `arts.personalised_gifts.personalised_clothing` · EN "Personalised Clothing" · ID "Pakaian Personalisasi"
- Synonyms: custom t-shirts, monogrammed garments, embroidered clothing, screen-printed shirts
- Parent: Arts → Personalised Gifts → Personalised Clothing
- **listing_class = `made_to_order`**.

## D2 Required
product name, garment_type (text — "t-shirt", "hoodie", "polo"), size, size_chart_reference, print_method (`dtg|screen_print|vinyl|embroidery|sublimation`), colour, buyer_input_fields multi (`text|design_upload|monogram`), lead_time_days.

## D3 Optional
model, blank_brand (e.g. Gildan 5000, Bella+Canvas 3001), fabric_composition, placement_options (`front|back|sleeve|left_chest|wrap_around`), colour_count (screen print).

## D4 Technical specs
size_chart (W × L mm per size), fabric_weight_g_per_m2, print_area_mm.

## D5 Variant axes
- `size` (max 10).
- `colour` (max 15).

## D6 Media
Min 4 / Max 10. Garment, print area, size chart image.

## D7 Commercial
Fixed. **Non-returnable** (personalised).

## D8 Compliance
- Apparel size-chart overlay — buyers need accurate chart.
- Textile labelling (fibre content, origin, care).

## D9 Search attributes
Facets: garment_type, print_method, size, colour, maker, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Kaos Kustom | Custom T-shirt |
| Kaos Bordir | Embroidered Shirt |

## D12 Unresolved
- Apparel-size-chart overlay — needs structured spec. Flag.
