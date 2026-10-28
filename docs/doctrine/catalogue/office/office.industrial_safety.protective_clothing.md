# office.industrial_safety.protective_clothing — Protective Clothing

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.industrial_safety.protective_clothing` · EN "Protective Clothing" · ID "Pakaian Pelindung"
- Synonyms: PPE, hi-vis, coveralls, chemical suits, flame-resistant clothing
- Parent: Office → Industrial Safety → Protective Clothing

## D2 Required
product name, brand, garment_type enum (`hi_vis_vest|hi_vis_jacket|hi_vis_trousers|coverall|chemical_suit|flame_resistant_jacket|cut_resistant_sleeve|lab_coat|apron_industrial`), ppe_category enum (`I|II|III`) [VERIFIED EU PPE Regulation 2016/425], hazard_rating (text — e.g. "EN ISO 20471 Class 2"), size, colour, material.

## D3 Optional
model, standards_claimed (multi — e.g. `EN_ISO_20471`, `EN_ISO_11612`, `EN_388`, `ANSI_107`), ce_type_examination_cert, certification_body, waterproof, breathable, retroreflective_strips.

## D4 Technical specs
size (XS–5XL), weight_g, material_composition.

## D5 Variant axes
- `size` (max 10).
- `colour` (max 8).

## D6 Media
Min 3 / Max 8. Front, back, close-up of certification label.

## D7 Commercial
Fixed. Returnable yes if sealed. Hygiene return policy applies.

## D8 Compliance
- **PPE Category III (life-threatening risks)**: EU type-examination (Module B) by Notified Body + Module D/C2 production control. Seller claims must be backed by certs.
- EN ISO 20471 (hi-vis clothing) [VERIFIED]; EN ISO 11612 (heat/flame); EN 388 (mechanical hazard).
- ANSI/ISEA 107 (US hi-vis) [VERIFIED].
- SNI equivalents for ID.

## D9 Search attributes
Facets: garment_type, ppe_category, hazard_rating, standards_claimed, size, colour, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Rompi Hi-Vis | Hi-Vis Vest |
| Pakaian Pelindung | PPE Clothing |
| Wearpack | Coverall |

## D12 Unresolved
- **BLOCKER**: PPE CE marking claims verification. Fake CE-marked PPE is widespread. Suggested: require certification body + cert number in listing; display prominently; "as declared by seller" note.
- Decorative "hi-vis" vs certified hi-vis — propose explicit `certified` boolean + mandatory standard claim.
