# office.industrial_tools.workshop_machinery — Workshop Machinery

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.industrial_tools.workshop_machinery` · EN "Workshop Machinery" · ID "Mesin Bengkel"
- Synonyms: lathes, milling machines, drill presses, bench grinders (large), compressors
- Parent: Office → Industrial Tools → Workshop Machinery

## D2 Required
product name, brand, machine_type enum (`lathe|milling_machine|drill_press|bench_grinder|air_compressor|welding_machine|pipe_bender|hydraulic_press`), motor_power_w, voltage_v, phase (`single|three`), max_working_capacity.

## D3 Optional
model, cnc_capable (bool), controller_type, cooling_system, dust_extraction (bool), noise_db, warranty_months, weight_kg (heavy — ship note).

## D4 Technical specs
dimensions_wdh_mm, weight_kg, motor_power_w, voltage, phase, max_working_capacity.

## D5 Variant axes
- `motor_power` or `max_working_capacity` typically separate SKU.

## D6 Media
Min 4 / Max 10. Full machine, control panel, workpiece engagement.

## D7 Commercial
Fixed. Returnable yes if sealed (practically rare for heavy machinery). Freight (often >100kg).

## D8 Compliance
- IEC 62841 power tools; ISO 12100 machinery safety; ISO 13849 safety-related control [VERIFIED].
- CE marking mandatory for EU; SNI for ID.
- Three-phase delivery requires compatible premises; buyer-advisory copy.

## D9 Search attributes
Facets: machine_type, motor_power, voltage, phase, max_working_capacity, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Mesin Bubut | Lathe |
| Mesin Bor | Drill Press |
| Mesin Las | Welding Machine |

## D12 Unresolved
- Heavy-machinery shipping / logistics — freight-only; seller must declare pickup/delivery capabilities.
- Three-phase requirement — buyer may not have 3-phase supply; needs clear advisory.
