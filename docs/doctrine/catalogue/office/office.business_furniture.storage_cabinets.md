# office.business_furniture.storage_cabinets — Storage Cabinets

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.business_furniture.storage_cabinets` · EN "Storage Cabinets" · ID "Lemari Penyimpanan"
- Synonyms: filing cabinets, locker cabinets, document safes, pedestals, cupboards
- Parent: Office → Business Furniture → Storage Cabinets

## D2 Required
product name, brand, cabinet_type enum (`filing_cabinet|lateral_file|pedestal|locker|office_cupboard|document_safe|fireproof_safe`), door_count, drawer_count, lock_type enum (`none|standard_key|combination|digital_keypad|biometric`), capacity_internal_litres, material (`steel|wood|engineered_wood`).

## D3 Optional
model, fire_rating_minutes (safes only — e.g. UL 72 Class 350/125) [VERIFIED UL 72], suspension_file_rails (bool), anti_tilt_mechanism (bool), colour, warranty_months, assembly_required.

## D4 Technical specs
width_mm, depth_mm, height_mm, weight_kg, drawer_internal_width_mm, drawer_internal_depth_mm, fire_rating_minutes (if applicable).

## D5 Variant axes
- `drawer_count` or `size` typically separate SKU.
- `colour` (max 6).

## D6 Media
Min 3 / Max 8.

## D7 Commercial
Fixed. Returnable yes if sealed. Freight (heavy).

## D8 Compliance
- BIFMA X5.9 (storage) [VERIFIED].
- Anti-tilt required by BIFMA for tall cabinets.
- Fire rating (safes): UL 72, EN 1047 — must be certification-backed [UNRESOLVED verification].
- Formaldehyde if engineered wood.

## D9 Search attributes
Facets: cabinet_type, drawer_count range, lock_type, material, colour, fire_rating (safes), brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Lemari Arsip | Filing Cabinet |
| Lemari Besi | Steel Cabinet |
| Brankas | Safe |

## D12 Unresolved
- Fire-safety claims — must match certification. Trust-sensitive.
- Biometric locks: biometric-data privacy copy requirement (per Business Tech access_control dossier).
