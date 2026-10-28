# office.commercial_cleaning.cleaning_chemicals — Cleaning Chemicals

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.commercial_cleaning.cleaning_chemicals` · EN "Cleaning Chemicals" · ID "Bahan Kimia Pembersih"
- Synonyms: detergents, disinfectants, degreasers, floor cleaners, bleach
- Parent: Office → Commercial Cleaning → Cleaning Chemicals

## D2 Required
product name, brand, chemical_type enum (`detergent|disinfectant|degreaser|descaler|bleach|sanitiser_food_grade|solvent|acid_cleaner|alkaline_cleaner|surface_cleaner`), concentration_or_ready_to_use (bool), ph_range (acid|neutral|alkaline), volume_or_weight, container_type (`bottle|jerrycan|drum|sachet|cartridge`), sds_available (bool).

## D3 Optional
model, dilution_ratio, surface_compatibility, fragrance, biodegradable_certified (bool), ecolabel_certified (bool), food_safe (bool), active_ingredient_percent.

## D4 Technical specs
volume_ml OR weight_g, container_type, ph (number), density_g_per_ml.

## D5 Variant axes
- `volume_or_weight` typically separate SKU.

## D6 Media
Min 2 / Max 5. Front with label visible.

## D7 Commercial
Fixed. Returnable yes if sealed only.

## D8 Compliance
- **BLOCKER (HAZMAT)**: GHS pictograms + hazard statements mandatory on label [VERIFIED UN GHS].
- UN number for shipping (dangerous-goods classification).
- SDS/MSDS mandatory per OSHA 1910.1200 (US), CLP (EU), SNI 7268 (ID).
- IATA DGR for air shipping — many cleaning chemicals are restricted/forbidden [VERIFIED IATA].
- Food-safe claim: NSF C1/C2 or equivalent.

## D9 Search attributes
Facets: chemical_type, concentration, ph_range, volume, container_type, biodegradable, food_safe, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Pembersih | Cleaner |
| Disinfektan | Disinfectant |
| Pemutih | Bleach |

## D12 Unresolved
- **BLOCKER**: HAZMAT shipping compliance — needs clear seller declarations before NEX surfaces listings. SDS upload may be mandatory.
- Air-shipping restrictions — seller must disclose.
- BPOM registration for antimicrobial claims in ID.
