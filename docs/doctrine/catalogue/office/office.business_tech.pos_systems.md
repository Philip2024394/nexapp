# office.business_tech.pos_systems — POS Systems

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.business_tech.pos_systems` · EN "POS Systems" · ID "Sistem POS"
- Synonyms: point-of-sale systems, cash register systems, EPOS terminals
- Parent: Office → Business Technology → POS Systems

## D2 Required
product name, brand, pos_hardware_type enum (`all_in_one_terminal|tablet_pos_stand|mobile_mpos|customer_display|cash_drawer|hospitality_pos|retail_pos`), screen_size_inches (if terminal), connectivity multi (`usb|ethernet|wifi|bluetooth|rs232`), voltage_v, operating_system (`android|windows|ios|proprietary|none`).

## D3 Optional
model, pci_pts_certified (bool), emv_certified (bool), card_reader_integrated (bool), nfc_contactless (bool), battery_life_hours (mobile), printer_integrated (bool), warranty_months.

## D4 Technical specs
width_mm, depth_mm, height_mm, weight_kg, screen_size_inches, voltage, battery_capacity_mah (mobile).

## D5 Variant axes
- `pos_hardware_type` typically separate SKU.
- `screen_size_inches` can be variant.

## D6 Media
Min 3 / Max 8.

## D7 Commercial
Fixed. Returnable yes if sealed. **IMPORTANT NEX policy** — see D12.

## D8 Compliance
- PCI PTS v6 (payment terminal security) [VERIFIED].
- EMV certification for card acceptance.
- Electrical IEC 62368-1.

## D9 Search attributes
Facets: pos_hardware_type, screen_size, operating_system, connectivity, pci_pts_certified, brand, price.

## D10 Non-physical
N/A — software/subscriptions not covered here.

## D11 i18n
| ID | EN |
|---|---|
| Sistem Kasir | Cash Register System |
| Mesin EDC | EDC Machine |

## D12 Unresolved
- **BLOCKER (NEX policy)**: NEX never handles funds. POS hardware is sold as **hardware only** — NEX must not advertise or integrate with payment-processing accounts. Buyer takes own merchant services.
- Lithium-battery (mobile mPOS) UN 38.3.
- Trade-approval (OIML, NTEP) for weighing-POS combinations.
