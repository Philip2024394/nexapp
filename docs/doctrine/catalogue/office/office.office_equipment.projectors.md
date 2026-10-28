# office.office_equipment.projectors — Projectors

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.office_equipment.projectors` · EN "Projectors" · ID "Proyektor"
- Synonyms: data projectors, LCD projectors, DLP projectors, laser projectors
- Parent: Office → Office Equipment → Projectors

## D2 Required
product name, brand, model, projection_tech enum (`dlp|lcd|lcos|laser_dlp|led_dlp`) [VERIFIED], brightness_iso_lumens (int, per ISO 21118) [VERIFIED ISO 21118], native_resolution enum (`svga|xga|wxga|720p|1080p|wuxga|4k`), throw_ratio text (e.g. "1.5:1"), connectivity multi (`hdmi|vga|usb|wifi|lan`).

## D3 Optional
contrast_ratio, lamp_life_hours, max_image_size_inches, keystone_correction (bool), zoom_ratio, lens_shift (bool), built_in_speakers (bool), speaker_watts, warranty_months.

## D4 Technical specs
width_mm, depth_mm, height_mm, weight_kg, voltage_v, power_w, brightness_iso_lumens, throw_distance_range_m.

## D5 Variant axes
- `native_resolution` or `brightness_tier` typically separate SKU.

## D6 Media
Min 3 / Max 8. Front, back ports, lens close-up.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- Laser-based projectors: IEC 60825-1 laser safety class [VERIFIED].
- Electrical IEC 62368-1.
- EMC per region.

## D9 Search attributes
Facets: projection_tech, brightness_iso_lumens range, native_resolution, throw_ratio, connectivity, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Proyektor | Projector |

## D12 Unresolved
- "ANSI lumens" vs "ISO lumens" — ISO 21118 is the current standard. Older listings use ANSI. Propose: canonical field = brightness_iso_lumens; store ANSI as alias.
- "LED lumens" marketing claims (ratio ~2-10x ISO lumens) are misleading — NEX_PROPOSAL: forbid "LED lumens" in title/body.
