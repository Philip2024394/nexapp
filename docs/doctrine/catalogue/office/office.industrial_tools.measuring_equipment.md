# office.industrial_tools.measuring_equipment — Measuring Equipment

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.industrial_tools.measuring_equipment` · EN "Measuring Equipment" · ID "Alat Ukur"
- Synonyms: multimeters, scales (industrial), gauges, levels, laser distance meters
- Parent: Office → Industrial Tools → Measuring Equipment
- **Umbrella leaf.**

## D2 Required
product name, brand, measuring_type enum (`multimeter|scale|gauge|level|laser_distance|thermometer_infrared|humidity_meter|sound_level_meter|clamp_meter|oscilloscope`), measurement_range, accuracy, unit, power_source (`battery|mains|battery_rechargeable`).

## D3 Optional
model, max_measurement, display (`analog|digital|dual`), auto_ranging (bool), data_logging (bool), bluetooth (bool), ip_rating.

## D4 Technical specs
dimensions_mm, weight_g, measurement_range, accuracy, battery_type.

## D5 Variant axes
- `measurement_range` typically separate SKU.

## D6 Media
Min 2 / Max 6.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- ISO/IEC 17025 calibration (if claimed) [VERIFIED].
- Electrical safety for mains-powered instruments.
- Laser class for laser distance meters (IEC 60825-1).

## D9 Search attributes
Facets: measuring_type, measurement_range, accuracy, display, power_source, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Alat Ukur | Measuring Instrument |
| Multimeter | Multimeter |

## D12 Unresolved
- Umbrella — may split by instrument class post-launch.
- Industrial scales — trade-approval (e.g. NTEP, OIML R76) is a legal requirement for commerce weighing — flag.
