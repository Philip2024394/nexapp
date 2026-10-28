# office.packaging_shipping.bubble_wrap — Bubble Wrap

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.packaging_shipping.bubble_wrap` · EN "Bubble Wrap" · ID "Bubble Wrap / Plastik Gelembung"
- Synonyms: air bubble film, cushion wrap
- Parent: Office → Packaging & Shipping → Bubble Wrap

## D2 Required
product name, bubble_size_mm (common 10/20/25), roll_width_mm, roll_length_m, perforated (bool).

## D3 Optional
layers (`single|double|triple`), anti_static (bool), coloured (bool), colour, recycled_content_percent.

## D4 Technical specs
bubble_size_mm, roll_width_mm, roll_length_m, roll_weight_kg.

## D5 Variant axes
- `roll_length_m` (max 5 variants).
- `roll_width_mm` (max 5 variants).

## D6 Media
Min 1 / Max 4.

## D7 Commercial
Fixed. Bulk pricing.

## D8 Compliance
Anti-static grade for electronics — surface-resistance claim must match test method.

## D9 Search attributes
Facets: bubble_size, roll_width, roll_length, anti_static, colour, price. Sort: price per metre.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Bubble Wrap | Bubble Wrap |
| Plastik Gelembung | Bubble Plastic |

## D12 Unresolved
- Price-per-metre derived field.
