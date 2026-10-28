# office.industrial_safety.safety_signs — Safety Signs

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.industrial_safety.safety_signs` · EN "Safety Signs" · ID "Rambu Keselamatan"
- Synonyms: warning signs, hazard signs, mandatory signs, fire-safety signs
- Parent: Office → Industrial Safety → Safety Signs

## D2 Required
product name, sign_type enum (`prohibition|warning|mandatory|safe_condition|fire_safety|supplementary`), iso_7010_code (if applicable — e.g. "P001", "W012") [VERIFIED ISO 7010], ansi_z535_code (if applicable) [VERIFIED ANSI Z535], material (`rigid_pvc|aluminium|vinyl_adhesive|photoluminescent`), size_mm.

## D3 Optional
language, bilingual (bool), photoluminescent (bool — glow-in-the-dark), uv_resistant, outdoor_rated (bool), pack_count.

## D4 Technical specs
width_mm, height_mm, thickness_mm, weight_g, pack_count.

## D5 Variant axes
- `size_mm` typically separate SKU.
- `material` can be variant (max 4).
- `pack_count` (max 5).

## D6 Media
Min 1 / Max 4.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- ISO 7010 pictogram catalogue is the global authority [VERIFIED].
- Photoluminescent signs: ISO 17398 performance class.
- Fire-safety signs: BS EN ISO 7010 superseded BS 5499 in EU.

## D9 Search attributes
Facets: sign_type, iso_7010_code (search), material, size, outdoor_rated, pack_count, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Rambu Keselamatan | Safety Sign |
| Tanda Peringatan | Warning Sign |
| Tanda Larangan | Prohibition Sign |

## D12 Unresolved
- Hybrid ANSI/ISO signage — many sellers mix pictograms. Propose: canonical field = `iso_7010_code`; store ANSI as supplementary.
