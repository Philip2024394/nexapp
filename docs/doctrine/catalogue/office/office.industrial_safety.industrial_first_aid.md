# office.industrial_safety.industrial_first_aid — Industrial First Aid

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.industrial_safety.industrial_first_aid` · EN "Industrial First Aid" · ID "P3K Industri"
- Synonyms: first aid kits, trauma kits, emergency medical kits (industrial)
- Parent: Office → Industrial Safety → Industrial First Aid

## D2 Required
product name, brand, kit_type enum (`workplace_general|high_risk_industrial|vehicle|burn_specific|eye_wash_station`), standard_compliance (`din_13157|din_13169|ansi_z308_1|iso_11321|workplace_regulation_id`) [VERIFIED], workforce_size_coverage (small/medium/large), contents_count, perishable_contents_present (bool).

## D3 Optional
model, carry_case_material, wall_mountable (bool), expiry_date (if perishables), refill_pack_available (bool), language_of_instructions.

## D4 Technical specs
dimensions_mm, weight_g, contents_count, workforce_size_coverage (number of persons).

## D5 Variant axes
- `kit_size` or `workforce_coverage` typically separate SKU.

## D6 Media
Min 3 / Max 8. Case closed, case open with contents, labelled contents list.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- DIN 13157 (DE small workplace); DIN 13169 (DE large workplace) [VERIFIED].
- ANSI Z308.1 (US) [VERIFIED].
- Perishable items (bandages, saline, medications) — expiry date mandatory [NEX_PROPOSAL: display on listing].
- **Medicinal-ingredient regulatory overlap**: kits containing OTC meds may trigger drug-registration rules (ID: BPOM) [UNRESOLVED].

## D9 Search attributes
Facets: kit_type, standard_compliance, workforce_coverage, expiry (not-expired filter), brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Kotak P3K | First Aid Kit |
| P3K | First Aid |

## D12 Unresolved
- Medicinal-ingredient regulatory — kits with meds may need BPOM registration in ID. Flag.
- Expiry-date filter — propose auto-flag kits with items expiring <6 months.
