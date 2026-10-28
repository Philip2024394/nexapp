# office.business_tech.access_control — Access Control

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.business_tech.access_control` · EN "Access Control" · ID "Kontrol Akses"
- Synonyms: card readers, biometric readers, electric strikes, maglocks, intercoms
- Parent: Office → Business Technology → Access Control

## D2 Required
product name, brand, access_type enum (`card_reader_only|biometric_fingerprint|biometric_facial|keypad_pin|multi_factor|smart_lock|electric_strike|magnetic_lock|intercom`), credential_tech multi (`rfid_125khz|rfid_13_56mhz|mifare|desfire|hid|nfc|ble`), connectivity (`wiegand|rs485|tcp_ip|standalone`), voltage_v.

## D3 Optional
model, user_capacity, event_log_capacity, cloud_management (bool), app_support (bool), ip_rating, operating_temp_range, pin_length, fail_safe_or_fail_secure.

## D4 Technical specs
dimensions_mm, weight_g, voltage, user_capacity, holding_force_kg (maglocks).

## D5 Variant axes
- `access_type` typically separate SKU.

## D6 Media
Min 2 / Max 6.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- Electrical IEC 62368-1.
- ISO/IEC 14443 RFID [VERIFIED].
- **BLOCKER (privacy)**: biometric devices trigger privacy copy requirements (data retention, revocation path). Listing must disclose if biometric templates stored locally or cloud.
- Fail-safe vs fail-secure — fire-code implications per jurisdiction.

## D9 Search attributes
Facets: access_type, credential_tech, connectivity, user_capacity, biometric (bool), brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Kontrol Akses | Access Control |
| Pembaca Sidik Jari | Fingerprint Reader |
| Kunci Pintar | Smart Lock |

## D12 Unresolved
- **Biometric-privacy overlay**: ID personal-data protection law (UU PDP) and GDPR apply. Seller + NEX must honour privacy requirements. Flag for founder — require explicit copy template.
