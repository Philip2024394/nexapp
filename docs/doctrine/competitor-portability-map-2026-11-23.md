# Competitor Portability Map — Seller Data Export Reality

**As of**: 2026-11-23
**Scope**: What a seller can take WITH them if they leave each platform. Read-only research; no code, no scraping bypass instructions. Honest UNKNOWN/UNSUPPORTED marks where primary sources did not confirm.

---

## 1. WhatsApp (consumer app)

- **Data types exportable**:
  - *Request Account Info report*: account registration details, profile name/photo, phone number, privacy settings, contacts list reference, groups membership and settings, message count statistics, blocked contacts, linked devices, Terms/ToS acceptance dates. Delivered as ZIP (HTML + JSON) within ~3 days of request.
  - *Export chat* (per chat): plaintext `.txt` transcript with optional media attachments, triggered from a single chat via the share menu. Local, per-conversation only.
- **Method**:
  - Settings -> Account -> Request account info -> Request report (ZIP delivered in-app).
  - Chat -> Chat info -> Export chat (per-chat share flow).
- **Permissions/consent**: Must be the account holder on the device; report binds to the SIM/phone number on the account.
- **NOT exportable**: Full chat message bodies via Request Account Info (metadata only), call content, call logs, media library in bulk, contacts' profile data, backups readable outside WhatsApp's encrypted format, other users' message data.
- **Primary source**: https://faq.whatsapp.com/1181414235111106 ("Request account information")
- **Verified**: 2026-11-23
- **Verdict for NEX import**: PARTIAL — a NEX importer can read per-chat `.txt` exports (seller-driven, one chat at a time). Bulk history import is UNSUPPORTED because consumer WhatsApp does not emit a machine-readable chat archive at account level.

---

## 2. WhatsApp Business (SMB app + Cloud API)

- **Data types exportable**:
  - *SMB Android/iOS app*: per-chat text export (same share-sheet mechanism as consumer); local chat backup to Google Drive / iCloud in WhatsApp's proprietary encrypted format (not a portable archive).
  - *Cloud API (Meta Business Platform)*: live message send/receive via webhooks; **Message History Sync** is available via the History API for businesses onboarding from SMB app to Cloud API (seller-initiated, consent-gated), and a separate history webhook for media sent within the prior ~2 weeks of the query. Cloud API message retention cap on Meta's servers is 30 days (operational buffer, not an archive).
  - *Catalog*: products are managed via the Meta Commerce Manager / Catalog API; a seller with Cloud API/BSP access can read catalog items programmatically. The **SMB app itself provides no official in-app "export catalog to CSV"** button.
  - *Labels / business profile*: readable through the SMB Business Management API surface in some BSP integrations; no official CSV export in the SMB app UI.
- **Method**:
  - SMB app: Chat -> menu -> Export chat.
  - Cloud API: `POST /{PHONE_NUMBER_ID}/smb_app_data` to initiate history sync; history delivered via `messages` and `history` webhooks.
  - Catalog: Graph API `GET /{catalog_id}/products` (requires `catalog_management` permission + Business verification).
- **Permissions/consent**: Business Manager admin role; verified business; user initiates on-device migration consent for SMB-to-Cloud history sync; App Review approval for catalog scopes.
- **NOT exportable**: Historical chat bodies older than SMB-app on-device store once migrated off; media older than ~2 weeks via Cloud API history; chats of end-users who did not consent to migration; "followers" (concept does not exist on WhatsApp); call content.
- **Primary source**:
  - https://developers.facebook.com/docs/whatsapp/cloud-api/guides/sync-message-history-via-smb-app
  - https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components#history-object
  - https://developers.facebook.com/docs/whatsapp/business-management-api/catalog
- **Verified**: 2026-11-23
- **Verdict for NEX import**: PARTIAL — Cloud API sellers can hand NEX a one-time history sync + live catalog read. SMB-app-only sellers (the majority of Indonesia SMBs) have UNSUPPORTED bulk export and will need per-chat `.txt` import + manual catalog recreation.

---

## 3. Shopee

- **Data types exportable**:
  - *Product list*: Seller Centre -> Products -> My Products -> Batch Tools -> Mass Update -> generate "Sales Info" template -> download (Excel). Covers SKU, title, price, stock, variations.
  - *Orders*: Seller Centre -> Orders -> My Orders -> select status + date range -> Export -> download from export history (Excel). Date range per export is capped (historically ~3 months per file).
  - *Income / payouts*: Seller Wallet -> Transaction History -> export statement (Excel/PDF).
  - *Open Platform v2 API*: `product.get_item_list`, `order.get_order_list`, `payment.get_escrow_detail`, chat (`sellerchat.get_message`) — available to sellers with an approved partner app.
- **Method**: UI exports above; or Shopee Open Platform v2 REST API after app registration + shop authorization (OAuth-style shop authorization URL).
- **Permissions/consent**: Seller Centre account; for Open Platform, a registered partner app + shop-level authorization grant (shop admin signs the auth URL).
- **NOT exportable**: Buyer contact details (phone/email are masked; Shopee forbids off-platform contact — Sept 2024 "Off-Shopee Communication" policy); follower list; review authors' identities; conversation archives in a portable standard (chat API returns messages but no bulk "give me every chat as a ZIP"); historical banned/removed listings.
- **Primary source**:
  - https://open.shopee.com/documents (Open Platform v2 index)
  - https://seller.shopee.com.my/edu/article/14098 (Mass Update export guide)
  - https://seller.shopee.sg/support/article/1004 (Off-Shopee communication policy — enforcement)
- **Verified**: 2026-11-23
- **Verdict for NEX import**: PARTIAL — product catalog and order history are importable (CSV path + API path). Chat is technically readable via API but **buyer identity is masked** and off-platform contact is policy-banned, so a seller cannot legally hand NEX the buyer phone list. Followers: UNSUPPORTED.

---

## 4. Tokopedia

- **Data types exportable**:
  - *Product list*: Seller dashboard -> Produk Saya -> Download (Excel). Covers SKU, variation, price, stock.
  - *Orders*: Seller dashboard -> Pesanan -> filter + Download Laporan (CSV/Excel) up to the date-range cap.
  - *Income / settlements*: Saldo Penghasilan -> Riwayat -> export statement.
  - *Official API* (Tokopedia Open API, now part of the GoTo Developer platform): Product API (`/v3/products/fs/{fs_id}/product`), Order API (`/v2/order/list`), Logistics, Finance — **restricted to approved Official Store / partner integrations**, not open self-serve for every seller.
- **Method**: UI exports; or Tokopedia Open API after partnership approval + `fs_id` (fulfillment service ID) issuance.
- **Permissions/consent**: Seller account owner; for API, formal partnership + signed integration agreement (closed onboarding, not a public developer portal of the Shopee style).
- **NOT exportable**: Buyer phone/email (masked; Tokopedia "Customer Communication Policy" prohibits redirecting buyers off-platform and sharing personal contact details, enforced up to 50 AHR deduction and permanent chat lockout on shop deactivation); chat history in a bulk portable archive; reviewer identities; follower list.
- **Primary source**:
  - https://developer.tokopedia.com/openapi/guide/ (Open API guide)
  - https://seller-id.tokopedia.com/university/essay?knowledge_id=1536982430189328&lang=en (Customer Communication Policy)
  - https://seller-id.tokopedia.com/university/essay?knowledge_id=7753801411282690 (Seller Enforcement Policy)
- **Verified**: 2026-11-23
- **Verdict for NEX import**: PARTIAL for approved partners (products + orders); UNSUPPORTED for the typical small seller who has no API approval — they get only the UI Excel exports. Contact-list portability is explicitly policy-blocked.

---

## 5. Lazada

- **Data types exportable**:
  - *Open Platform v1 API* (post Seller Center -> Open Platform migration): Product API (`/products/get`, `/product/create`, `/product/update`), Order API (`/orders/get`, `/order/items/get`), Finance API (`/finance/transaction/detail/get`), Seller API (`/seller/get`, `/seller/metrics/get`), Chat/IM API (bidirectional message list + templated replies), Review API.
  - *Seller Center UI*: Products -> Manage Products -> Export; Orders -> export by date range (Excel).
- **Method**: Seller Center UI exports; or Lazada Open Platform REST after app registration at open.lazada.com + per-country shop authorization callback (returns access/refresh tokens per country site: SG/MY/TH/ID/PH/VN).
- **Permissions/consent**: Seller Center credentials; for API, registered developer app and seller-granted shop authorization token per country site.
- **NOT exportable**: Follower list (no documented `/followers/get` endpoint as of this verification); buyer PII (masked); bulk chat archive as a standard export file (the Chat API returns messages but is session/live-oriented, not bulk historical dump); platform-held marketing audience lists.
- **Primary source**:
  - https://open.lazada.com/apps/doc/api (API index)
  - https://open.lazada.com/apps/doc/doc?nodeId=10556&docId=108148 (Seller API reference)
  - https://open.lazada.com/apps/doc/doc?nodeId=10543&docId=108139 (Open Platform migration from Seller Center)
- **Verified**: 2026-11-23
- **Verdict for NEX import**: PARTIAL — products, orders, finance are portable via API/UI. Chat is UNKNOWN as a bulk portable archive (API returns live threads, no documented bulk export endpoint found in this verification). Followers: UNSUPPORTED.

---

## Cross-platform summary (2 paragraphs)

Every platform in this map lets a seller walk away with their **own business records** — SKUs, orders, payouts — either via a Seller Centre UI export (Shopee, Tokopedia, Lazada) or via an approved partner API (Shopee Open Platform v2, Tokopedia Open API, Lazada Open Platform). WhatsApp Business via Meta Cloud API is the outlier that also offers a one-time **message history sync** (seller-initiated, consent-gated), but only for businesses onboarded onto the Cloud API path; SMB-app-only sellers have no official bulk chat or catalog export and depend on per-chat `.txt` shares or third-party browser extensions (out of scope here). WhatsApp consumer's "Request Account Info" is metadata-only — it does not contain message bodies.

The consistent gap across all five is **relational data**: buyer identities, follower lists, and chat-based customer relationships are either masked, policy-blocked (Shopee's Off-Shopee rule, Tokopedia's Customer Communication Policy), or simply not exposed as a bulk-exportable archive. This confirms Pattern P2 from the competitive wedges memo: platforms let you take your own stock-keeping records, but the audience they introduced you to stays locked behind the platform. A NEX importer can realistically ingest products + orders from all five, partial chat only from WhatsApp Cloud API, and essentially no portable buyer-audience from the marketplaces. Marks that remain UNKNOWN (Lazada bulk chat export, Tokopedia non-partner API access) are honest gaps — primary sources did not confirm availability during this verification pass.

---

*Document saved at: C:/Users/Victus/nexapp/docs/doctrine/competitor-portability-map-2026-11-23.md*
