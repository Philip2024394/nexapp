# office.office_equipment.presentation_equipment — Presentation Equipment

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.office_equipment.presentation_equipment` · EN "Presentation Equipment" · ID "Peralatan Presentasi"
- Synonyms: whiteboards, flipcharts, laser pointers, presenter clickers
- Parent: Office → Office Equipment → Presentation Equipment
- **Umbrella leaf.**

## D2 Required
product name, brand, item_type enum (`whiteboard|chalkboard|flipchart|flipchart_easel|presenter_remote|laser_pointer|digital_whiteboard|display_easel`), colour (if whiteboard: `white|green|black`), surface_size_mm.

## D3 Optional
model, mounting (`wall|stand|mobile_cart|magnetic|portable`), magnetic (bool), dry_erase (bool), gridded (bool), has_tray (bool), battery_type (presenter remotes), wireless_range_m (presenter remotes), laser_class.

## D4 Technical specs
width_mm, height_mm, weight_kg.

## D5 Variant axes
- `surface_size` (max 6) when applicable.
- `colour` (max 4).

## D6 Media
Min 2 / Max 6.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- Laser pointers: IEC 60825-1 class 1/2/3R [VERIFIED]. Jurisdictional ban on high-class laser pointers.
- Remote presenters with wireless: radio type-approval per country.
- Batteries UN 38.3 if lithium primary.

## D9 Search attributes
Facets: item_type, surface_size (where applicable), mounting, magnetic, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Papan Tulis | Whiteboard |
| Flipchart | Flipchart |
| Laser Pointer | Laser Pointer |

## D12 Unresolved
- **Umbrella risk**: wide item range. Post-launch split: `boards`, `presenter_tools`.
- Smart whiteboards (interactive displays) may belong to Business Tech instead.
