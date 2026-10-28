# office.industrial_safety.respiratory_equipment — Respiratory Equipment

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.industrial_safety.respiratory_equipment` · EN "Respiratory Equipment" · ID "Peralatan Pernapasan"
- Synonyms: dust masks, filter masks, half-face respirators, full-face respirators, SCBA
- Parent: Office → Industrial Safety → Respiratory Equipment

## D2 Required
product name, brand, respirator_type enum (`disposable_ffp|half_face_reusable|full_face_reusable|papr|scba`), filter_class enum (`ffp1|ffp2|ffp3|p1|p2|p3|n95|n99|n100|r95|p95`) [VERIFIED EN 149 / NIOSH], certification_body (e.g. CE 0121, NIOSH), use_scope enum (`industrial|medical|dual`), size.

## D3 Optional
model, exhalation_valve (bool), charcoal_layer (bool), replaceable_filters (bool), compatible_filter_models, strap_type (`head|ear|neck`), fit_tested (bool), warranty_months.

## D4 Technical specs
dimensions, weight_g, filter_efficiency_percent, breathing_resistance_pa.

## D5 Variant axes
- `size` (S/M/L) typical.
- `filter_class` separate SKU.

## D6 Media
Min 2 / Max 6.

## D7 Commercial
Fixed. Returnable yes if sealed only (hygiene).

## D8 Compliance
- **BLOCKER (regulatory overlap)**: Medical masks fall under medical-device regulation (US FDA, EU MDR, SNI 8914). Industrial N95/FFP2 may be sold as general industrial PPE. **Dual-use claims trigger medical-device rules.**
- EN 149 (EU disposable half-mask) [VERIFIED]; NIOSH 42 CFR 84 (US) [VERIFIED]; EN 136/140 reusable; EN 143 particle filters; EN 14387 gas/combination filters.
- Fit-testing recommendation per OSHA 1910.134.
- Counterfeit risk extreme (COVID-era). Seller must display cert.

## D9 Search attributes
Facets: respirator_type, filter_class, certification_body, use_scope, size, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Masker Pernapasan | Respirator |
| Masker N95 | N95 Mask |
| Respirator | Respirator |

## D12 Unresolved
- **Medical vs industrial scope** — must be declared. False medical claim = regulatory violation.
- Counterfeit filter-class claims — buyer-protection critical.
