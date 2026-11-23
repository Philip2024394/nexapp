# Competitor Portability Map — Part 2

**As of:** 2026-11-23
**Scope:** WeChat (consumer), LINE, KakaoTalk / Kakao for Business, Instagram Shopping (Meta), Facebook Marketplace, TikTok Shop.
**Purpose:** Enumerate what a seller or user can actually export out of each competitor, and whether that export can be ingested by NEX. UNSUPPORTED / UNKNOWN marked honestly — no guessing.

---

## 1. WeChat (consumer)

- **Data types exportable:**
  - Chat history (one-to-one and group) via WeChat Desktop "Backup & Restore" to a local PC/Mac — proprietary encrypted container, **not** a readable file format.
  - No official export of Mini Program merchant data (orders, customers, product catalog) to a portable format for the merchant.
- **Method:** WeChat Mobile → `Me → Settings → Chats → Chat History Backup & Migration → Migrate to Computer` (requires WeChat Desktop on same LAN). Produces a proprietary `.bak` / internal store readable only by another WeChat install.
- **Permissions/consent:** Account holder on device; same LAN; requires same WeChat ID on destination install. Mini Program operator data is governed by Tencent / WeChat Open Platform agreements — no self-service merchant export documented.
- **NOT exportable:**
  - Standard CSV/JSON of messages.
  - Contacts list as a portable vCard/CSV.
  - Mini Program buyer list, order history, product catalog as a merchant-accessible export.
  - Moments posts as a bulk archive.
- **Primary source:** <https://help.wechat.com/> (Backup & Restore help); third-party summary <https://devicemag.com/wechat-upload-chat-history/>.
- **Verified:** 2026-11-23
- **Verdict for NEX import:** **UNSUPPORTED.** Proprietary binary backup is not ingestible. A merchant leaving WeChat/Mini Program effectively leaves their buyer data behind.

---

## 2. LINE

- **Data types exportable:**
  - Personal LINE chats: export as plain `.txt` per conversation (no CSV, no media inline — media listed as `[Photo]` etc.).
  - LINE Official Account chat history: CSV download, but **gated behind the paid "Chat Pro" add-on (¥3,000 / month before tax, launched 4 March 2025)**. Free plan retains history for 6 months with no CSV download.
  - Friends/followers of an Official Account: aggregate counts only; no per-user handle export for consumer use.
- **Method:**
  - Personal: chat `☰ → Settings → Export chat history` (per chat).
  - Official Account (paid): LINE Official Account Manager → `Chats → Chat settings → Basic → Chat history backup → Create new → Download`. One generation per week.
- **Permissions/consent:** Account holder. For OA, admin role plus active Chat Pro subscription.
- **NOT exportable:**
  - Friends list / follower list as portable contacts (phone/email) — LINE deliberately does not expose user IDs externally.
  - Rich media inline with text export.
  - Pre-6-month OA history on the free tier.
- **Primary source:**
  - <https://help.line.me/line/smartphone/sp?contentId=20007388&lang=en> (personal chat text export)
  - <https://www.lycbiz.jp/en/news/line-official-account/20250108/> (Chat Pro launch, pricing, CSV behind paywall)
- **Verified:** 2026-11-23
- **Verdict for NEX import:** **PARTIAL.** OA CSV (paid-tier sellers only) is ingestible as a conversation archive; personal `.txt` is ingestible as read-only history. Follower list is **not** portable — buyers must re-opt-in on NEX.

---

## 3. KakaoTalk / Kakao for Business

- **Data types exportable:**
  - Per-chat message export: plain `.txt` ("Export Messages → Send Text Only" or "Save All Messages to Internal Storage"). Media not included.
  - KakaoTalk Cloud Backup: proprietary encrypted container for restore only — not a readable user export.
- **Method:** Open chat → gear icon → `Export Chat`. Backup: `Settings → Chats → Chat Backup → Back Up Now` (stored in Kakao Cloud; restore only).
- **Permissions/consent:** Account holder on the device.
- **NOT exportable:**
  - Friends list as portable contacts.
  - KakaoTalk Channel (business follower) list as handles/phone numbers.
  - Kakao for Business / Kakao Biz Center: **no public documentation found** of a self-service merchant export for customer lists, order data, or channel subscriber data as CSV. Behaviour is **UNKNOWN**; absence of documentation suggests UNSUPPORTED but we won't claim that without a primary source.
- **Primary source:**
  - <https://cs.kakao.com/helps_html/1073182396?locale=en> (chat save)
  - Kakao for Business export: **no primary source found → UNKNOWN**.
- **Verified:** 2026-11-23
- **Verdict for NEX import:** **PARTIAL (personal `.txt`) / UNKNOWN (business).** Treat business-side portability as unverified until a Kakao for Business admin console screenshot is produced.

---

## 4. Instagram Shopping (Meta)

- **Data types exportable:**
  - "Download Your Information" (DYI) at the account level: posts, stories, DMs (1-to-1 and group, including deleted-not-guaranteed), comments, likes, followers list with timestamps, following list, saved posts, search history, account changes. HTML or JSON. Link expires ~4 days after email.
  - **Product catalog** via Commerce Manager / Catalog Manager: CSV data feed download (same schema as CSV feed upload). Supports bulk edit round-trip.
- **Method:**
  - DYI: `Settings → Accounts Center → Your information and permissions → Download your information → Create export`.
  - Catalog: Commerce Manager → `Catalog → Data Sources → [feed] → Download file` (or Facebook/Meta Business Suite equivalent).
- **Permissions/consent:** Account holder (DYI); Catalog admin / Business Manager role (catalog feed).
- **NOT exportable:**
  - Followers list **as contacts** (no phone/email) — only Instagram handles. Not reachable off-platform directly.
  - Shop checkout history / payouts (since native US checkout was discontinued August 2025, this is largely moot).
  - Product tags on posts outside the 21 markets that retained product tagging after 10 August 2023.
- **Context (current state, verified):**
  - Instagram Shop tab removed globally Feb 2023.
  - Product tagging restricted to ~21 markets as of 10 August 2023.
  - Native in-app checkout sunset August 2025 — Shopping now funnels to external site or Meta catalog.
- **Primary source:**
  - DYI: <https://help.instagram.com/181231772500920>
  - Catalog feed: <https://www.facebook.com/business/help/125074381480892> (Meta Commerce Manager catalog data feed).
- **Verified:** 2026-11-23
- **Verdict for NEX import:** **PARTIAL.** Product catalog CSV → ingestible as NEX shop products. DMs JSON → ingestible as read-only history. Followers → handles only; **not re-contactable** on NEX without each follower re-opting in.

---

## 5. Facebook Marketplace

- **Data types exportable:**
  - Via Facebook "Download Your Information": Marketplace listings, Marketplace messages (threads with buyers), saved items, activity. HTML or JSON.
  - No dedicated Marketplace "sales report" export UI; sales data is entangled in Messenger threads unless shipping-checkout was used.
- **Method:** `Settings & Privacy → Settings → Your Facebook Information → Download Your Information → select Marketplace + Messages → Create File`. Delivery can take hours to days.
- **Permissions/consent:** Account holder only; Facebook treats Marketplace messages and financial data as personal/private.
- **NOT exportable:**
  - Buyer phone numbers / emails (unless shared inside a message body).
  - Deleted messages / deleted listings (not guaranteed).
  - A structured sales ledger — the DYI dump is activity logs + message JSON, not an accounting report.
  - Any appeal trail for algorithmic bans (confirmed by ProPublica reporting).
- **Primary source:**
  - <https://www.facebook.com/help/212802592074644> (Download Your Information).
  - <https://www.facebook.com/help/1561675224151366> (DYI data categories).
- **Verified:** 2026-11-23
- **Verdict for NEX import:** **PARTIAL.** Listing JSON → ingestible as NEX product drafts (fields are sparse). Buyer thread JSON → ingestible as history. Buyer identity → handles only, **not** re-contactable.

---

## 6. TikTok Shop

- **Data types exportable:**
  - **Products:** bulk export via Seller Center → `Products → Batch Tool → Bulk Edit Products → Download (Select products → All Information → Generate Template)`. CSV. Up to 1,000 rows per file recommended.
  - **Orders:** Seller Center → `Orders → Manage Orders → Export Orders`. CSV / Excel. Up to 200,000 orders per export job.
  - **Finance:** statements and payout CSVs under `Finance → Statements`.
  - **Affiliate / Creator analytics:** `Affiliate Center → Analytics → Performance → Export` for creator, product, video, LIVE list exports (90-day window).
- **Method:** Seller Center UI (per module). Partner API available for authorised ISVs; not generally self-serve.
- **Permissions/consent:** Shop owner or staff account with the relevant role.
- **NOT exportable:**
  - Shop **followers / fans** as a contact list — no CSV of handles-plus-contact-info is offered natively; third-party scrapers exist but violate TOS.
  - Buyer phone numbers / emails outside what the fulfilment carrier exposes.
  - Message threads with buyers in a structured CSV (TikTok Shop Chat has no documented bulk export).
  - Historical banned-account data (consistent with pattern P5 — no appeal trail).
- **Primary source:**
  - <https://seller-us.tiktok.com/university/essay?knowledge_id=885076015728386&lang=en> (Exporting Orders)
  - <https://seller-us.tiktok.com/university/essay?knowledge_id=3352441858344747&lang=en> (Manage Creators / Affiliate exports)
- **Verified:** 2026-11-23
- **Verdict for NEX import:** **PARTIAL.** Products CSV and Orders CSV → cleanly ingestible as NEX shop catalog and order history. Followers/fans → **NOT portable**; this is the central lock-in. Chat threads → UNSUPPORTED.

---

## Summary

Across these six platforms, the portability pattern is remarkably consistent: a seller can usually get their **own** content back out (product catalogs, order lists, chat text archives) but cannot take **the audience** with them. Instagram and TikTok Shop give up a usable product/order CSV, Facebook Marketplace gives up a listing+message JSON dump, LINE Official Account gives up CSV chat history only on the paid Chat Pro tier (¥3,000/mo, enforced April 2025). WeChat gives up almost nothing portable — its desktop "backup" is a proprietary encrypted container for restoring into another WeChat install, not a readable export. Kakao for Business merchant portability is **UNKNOWN**: no primary-source documentation of a self-serve customer/channel export was located.

Follower / friend lists are the universal hard stop. None of the six platforms let a seller export their audience as reachable contacts (phone, email, or any identifier the seller can message off-platform). Handles can be enumerated in Instagram DYI and (via scraping) in TikTok Shop, but handles are platform-scoped and cannot be dialled into NEX without each individual buyer re-opting in on NEX. This is what makes NEX's "merchant-direct audience" proposition structurally defensible: competitors deliberately engineer audience lock-in by withholding contactable follower exports, so any migration path from these platforms to NEX can carry product catalogs and historical records but must rebuild the audience through fresh opt-in.

**Confirmation:** Doc saved to `C:/Users/Victus/nexapp/docs/doctrine/competitor-portability-map-part2-2026-11-23.md`.
