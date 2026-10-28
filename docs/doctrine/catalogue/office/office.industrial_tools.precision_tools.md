# office.industrial_tools.precision_tools — Precision Tools

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.industrial_tools.precision_tools` · EN "Precision Tools" · ID "Alat Presisi"
- Synonyms: micrometers, calipers (precision-grade), dial indicators, gauge blocks
- Parent: Office → Industrial Tools → Precision Tools

## D2 Required
product name, brand, tool_type enum (`micrometer|caliper|dial_indicator|height_gauge|gauge_block|feeler_gauge|protractor_precision`), measurement_range (e.g. "0-25mm"), resolution_or_graduation, accuracy_tolerance, unit (`metric|imperial|dual`).

## D3 Optional
model, display_type (`vernier|dial|digital`), battery_type (digital), ip_rating (coolant-proof), case_included (bool), calibration_cert_included (bool), calibration_cert_authority.

## D4 Technical specs
measurement_range_mm (or _inch), resolution_mm, accuracy_mm, operating_temp_range_c, weight_g.

## D5 Variant axes
- `measurement_range` typically separate SKU.
- `display_type` can be variant.

## D6 Media
Min 2 / Max 6.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- ISO 3611 micrometers [VERIFIED]; ISO 13385 calipers.
- Calibration traceability per ISO/IEC 17025 if cert claimed.

## D9 Search attributes
Facets: tool_type, measurement_range, resolution, display_type, brand, calibration_cert_included, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Mikrometer | Micrometer |
| Jangka Sorong | Caliper |

## D12 Unresolved
- Calibration-cert verification policy.
