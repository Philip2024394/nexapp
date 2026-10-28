# office.material_handling.lifting_equipment — Lifting Equipment

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.material_handling.lifting_equipment` · EN "Lifting Equipment" · ID "Alat Angkat"
- Synonyms: lifting gear, chain blocks, lever hoists, load binders, shackles
- Parent: Office → Material Handling → Lifting Equipment

## D2 Required
product name, brand, lifting_type enum (`chain_block|lever_hoist|load_binder|eyebolt|shackle|hook|turnbuckle|wire_rope_assembly`), swl_wll_kg (safe working load / working load limit), proof_load_tested (bool), standards_compliance multi (`en_1492|iso_4309|en_13889`).

## D3 Optional
model, material grade, test_cert_available (bool), colour_code (indicates WLL per EN convention), chain_grade (`g80|g100`), wire_rope_construction, warranty_months.

## D4 Technical specs
swl_wll_kg, proof_load_kg, breaking_load_kg (if stated), dimensions, weight_kg.

## D5 Variant axes
- `swl_wll_kg` typically separate SKU.

## D6 Media
Min 3 / Max 6. Full item, close-up of WLL stamp.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- **BLOCKER**: Lifting-equipment regulatory (LOLER UK; OSHA 1910.184 US; EU Machinery Directive). Periodic inspection required by law in many jurisdictions.
- EN 1492-1 web slings; EN 1492-2 round slings; ISO 4309 wire-rope inspection [VERIFIED].
- CE marking required for EU.
- Mandatory data plate / tag with WLL.

## D9 Search attributes
Facets: lifting_type, swl_wll_kg range, standards_compliance, chain_grade, brand, price. Sort: WLL.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Alat Angkat | Lifting Equipment |
| Katrol Rantai | Chain Block |
| Takel | Hoist |

## D12 Unresolved
- Test certificate — some buyers require certs. Propose optional PDF upload (via future doc-attachment leaf, not now).
- Expired/second-hand lifting gear — buyer-safety: must declare inspection date. Flag.
