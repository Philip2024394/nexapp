# office.business_tech.business_networking — Business Networking

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `office.business_tech.business_networking` · EN "Business Networking" · ID "Jaringan Bisnis"
- Synonyms: switches, routers, access points, firewalls (hardware), network cables (patch)
- Parent: Office → Business Technology → Business Networking

## D2 Required
product name, brand, networking_type enum (`switch_unmanaged|switch_managed|switch_poe|router_business|wifi_access_point|firewall_appliance|modem_business|patch_cable|cable_termination_hardware`), port_count (where applicable), ethernet_speed (`fast_ethernet_100|gigabit|2_5g|5g|10g_multirate|25g|40g`), wifi_standard (if AP: `wifi_5|wifi_6|wifi_6e|wifi_7`), poe_budget_w (if PoE).

## D3 Optional
model, management_type (`unmanaged|smart|managed_cli|cloud_managed`), ssid_count (APs), mu_mimo_support, firewall_throughput_gbps, nat_sessions, warranty_months.

## D4 Technical specs
dimensions, weight_kg, port_count, ethernet_speed, poe_budget_w, voltage_v, power_w.

## D5 Variant axes
- `port_count` typically separate SKU.
- `poe_budget_w` separate SKU.

## D6 Media
Min 2 / Max 6.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- IEEE 802.3 Ethernet [VERIFIED]; IEEE 802.11 Wi-Fi [VERIFIED].
- Radio type-approval per country (SRD / Postel ID / FCC / ETSI) — critical for AP sales [UNRESOLVED].
- Electrical IEC 62368-1.
- Switches ≥ Class II safety isolation.

## D9 Search attributes
Facets: networking_type, port_count, ethernet_speed, wifi_standard, poe_budget, management_type, brand, price.

## D10 Non-physical
N/A — subscription licenses excluded.

## D11 i18n
| ID | EN |
|---|---|
| Switch Jaringan | Network Switch |
| Router Bisnis | Business Router |
| Access Point | Access Point |

## D12 Unresolved
- Radio-type-approval varies: Wi-Fi 6E / 7 bands not yet approved in some countries including ID (6GHz) — seller must declare approval status.
- Firewall/cloud-managed subscription — hardware only; subscription separate.
