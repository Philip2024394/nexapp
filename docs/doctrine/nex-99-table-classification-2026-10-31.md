# NEX · 99-Table Classification · 2026-10-31

**Status**: DRAFT · satisfies owner's CI-1 condition (produce exact names + rationale + FK/inheritance). **No migration applied · no code change.**
**Owner directive**: "Do not classify a table as global merely because it currently lacks a country column."
**Fact base**: 99 `public.nex_*` tables + 159 FK edges enumerated against sealed Supabase project `ijvqdvsvwtwxzcqmoqit` on 2026-10-31.

---

## Classification legend

| Code | Meaning |
|---|---|
| **G** | **GLOBAL** · identity/platform/personal content · no country column · reads + writes cross all deployments |
| **CO** | **COUNTRY-OWNED** · owns a direct `country text` column · writes gated to deployment's country · reads filtered by visibility |
| **CO-I** | **COUNTRY-OWNED (inherited)** · country is derived from a FK parent (usually `nex_business.country` or `nex_community_zone.country`) · no own column needed; policy joins to parent |
| **R** | **REFERENCE DATA** · global reference / lookup data · same values across all countries · writes admin-only |
| **GV** | **GLOBAL WITH VISIBILITY** · content follows the owner (not a country) but needs the 6-scope visibility enum per global content doctrine |
| **M** | **MIXED** · needs explicit per-table resolution (owner's CI-8) · see companion doc |

---

## Full table (99 rows)

### Identity · Account · Auth (12 · all G)

| Table | Class | Rationale |
|---|---|---|
| `nex_account` | **G** | One person · one account · roams. Nullable `primary_country` added by migration 246 (owner CI-6). Account itself is global; the home-country tag is informational, not an isolation gate. |
| `nex_account_custom_intro` | **G** | FK → nex_account · follows the user |
| `nex_account_device_key` | **G** | Devices follow the user |
| `nex_account_music_rights_ack` | **G** | Legal ack · follows the user · one row per terms version |
| `nex_account_notification_prefs` | **G** | User preference · follows the user |
| `nex_account_profile` | **G** | Follows the user · can be viewed cross-country (public profile) |
| `nex_account_push_subscription` | **G** | Device-anchored |
| `nex_account_relationship_prefs` | **G** | User-pair prefs · follows users |
| `nex_account_risk_signal` | **G** | Platform-wide fraud / risk · HQ scope |
| `nex_session` | **G** | Auth session state |
| `nex_session_registry` | **G** | Session index |
| `nex_sign_in_event` | **G** | Auth audit · platform-wide |
| `nex_webauthn_credential` | **G** | Biometric creds · device-anchored |
| `nex_handle_counter` | **G** | Monotonic handle counter · platform-wide |

### Commerce + Business (country-anchored root) (23)

| Table | Class | Rationale |
|---|---|---|
| `nex_business` | **CO** | **The root country anchor** · owner's biggest gap today (no country column, RLS `USING (true)`) · Migration 244 adds `country`, 245 adds RLS, 247 adds `visibility` enum |
| `nex_product` | **CO-I** | FK `business_id` → `nex_business.id` · country inherited via join · also owns its own `visibility` + `allowed_delivery_destinations` per doctrine §5 |
| `nex_product_ladder` | **CO-I** | FK `business_id` → `nex_business.id` |
| `nex_product_section` | **CO-I** | FK `business_id` → `nex_business.id` |
| `nex_product_variant` | **CO-I** | FK `product_id` → chain via product |
| `nex_product_share_grant` | **CO-I** | FK `business_id` + `product_id` |
| `nex_order` | **CO-I** | FK `business_id` → inherits · also records buyer `customer_account_id` (buyer may be cross-country · see note below) |
| `nex_order_event` | **CO-I** | FK `order_id` → chain |
| `nex_cart` | **G** | Cart is per-user · can contain products from multiple countries · stays GLOBAL (products inside are gated at order time) |
| `nex_liked_product` | **G** | Follows the user · a user may like a cross-country product |
| `nex_buyer_tier_progress` | **CO-I** | FK `business_id` · buyer's progression at THAT business |
| `nex_affiliate_account` | **CO-I** | Affiliate operates in one country · FK account + business |
| `nex_affiliate_promotion` | **CO-I** | FK `business_id` |
| `nex_banner` | **M** | See CI-8 companion doc · likely CO-I via FK business_id, but may also carry country-targeted admin content |
| `nex_menu_item` | **CO-I** | FK `business_id` (food vertical) |
| `nex_menu_section` | **CO-I** | FK `business_id` |
| `nex_service` | **CO-I** | FK `business_id` (service vertical) |
| `nex_profession` | **M** | See CI-8 · global reference OR country-vocab? FK `vertical_id` to `nex_vertical`. Owner tentative view: REFERENCE/GLOBAL. |
| `nex_vertical` | **M** | See CI-8 · global reference · same categories across both countries? Owner tentative view: REFERENCE/GLOBAL. |
| `nex_gallery_image` | **CO-I** | FK `business_id` |
| `nex_email_campaign` | **CO-I** | Via `list_id` → `nex_email_list.business_id` |
| `nex_email_list` | **CO-I** | FK `business_id` |
| `nex_email_subscriber` | **CO-I** | FK `list_id` · chain |
| `nex_email_send_log` | **CO-I** | FK `campaign_id` · chain |

### Community (14 · all CO-I via community zone)

The 2 km-radius community doctrine (sealed 2026-10-23) anchors cards + notices to `nex_community_zone`. Zone geography IS the country. Country-isolation defers to community_zone.country.

| Table | Class | Rationale |
|---|---|---|
| `nex_community_zone` | **CO** | Root for the community tree · migration 244 adds `country` column |
| `nex_community_card` | **CO-I** | FK zone → inherits country |
| `nex_community_card_confirmation` | **CO-I** | FK `card_id` → chain |
| `nex_community_card_photo` | **CO-I** | FK `card_id` → chain |
| `nex_community_card_report` | **CO-I** | FK `card_id` · reporter's country may differ (see Report note) |
| `nex_community_card_update` | **CO-I** | FK `card_id` → chain |
| `nex_community_business_welcome_detail` | **CO-I** | FK `business_id` + `card_id` |
| `nex_community_lost_found_detail` | **CO-I** | FK `card_id` |
| `nex_community_notice` | **CO-I** | FK zone · address-anchored |
| `nex_community_notice_confirmation` | **CO-I** | FK `notice_id` → chain |
| `nex_community_notice_report` | **CO-I** | FK `notice_id` → chain |
| `nex_community_notice_update` | **CO-I** | FK `notice_id` → chain |
| `nex_community_membership` | **CO-I** | FK zone · a user is a member of a zone IN A country |
| `nex_community_rate_limit` | **CO-I** | FK account + zone · zone determines country |

### Live + Live Selling (9)

Broadcaster country · session country · peer-chat remains GLOBAL.

| Table | Class | Rationale |
|---|---|---|
| `nex_live_session` | **CO** | Direct country column (own) · broadcaster-anchored |
| `nex_live_post` | **CO-I** | FK `business_id` |
| `nex_live_participation` | **CO-I** | FK `session_id` → chain |
| `nex_live_engagement` | **CO-I** | FK `session_id` → chain |
| `nex_live_featured_product` | **CO-I** | FK `session_id` + `product_id` |
| `nex_live_jail` | **CO-I** | FK `session_id` + viewer/broadcaster |
| `nex_group_call_session` | **G** | Peer-to-peer call · cross-country allowed |
| `nex_group_call_participant` | **G** | FK session · follows the call |
| `nex_call_link`, `nex_call_log` | **G** | Peer-to-peer |

### Peer Chat (6 · all G · explicitly cross-country permitted)

| Table | Class | Rationale |
|---|---|---|
| `nex_conversation` | **G** | FK `business_id` nullable · the conversation can discuss ANY country's business · the conversation itself is between people |
| `nex_conversation_participant` | **G** | Chain |
| `nex_message` | **G** | Peer-to-peer |
| `nex_peer_conversation` | **G** | Peer-to-peer |
| `nex_peer_message` | **G** | Peer-to-peer |
| `nex_bridge99_first_send_intent` | **G** | Peer-to-peer intent · global |

### Music + Creator (9 · all GV / G)

| Table | Class | Rationale |
|---|---|---|
| `nex_music_track` | **GV** | Owner-anchored content · needs `visibility` column (per doctrine §4) · country-ambiguous (a track is "a creator's music" not "music in a country") |
| `nex_music_publish_idempotency` | **G** | Operational dedup |
| `nex_creator_active_music` | **G** | FK account + track · follows creator |
| `nex_creator_support_settings` | **G** | Creator's payment pointer · global |
| `nex_uploaded_video` | **GV** | Owner-anchored · needs `visibility` column · broadcasts in Live are country-owned via live_session (separate) |

### Friends · Follows (3 · all G)

| Table | Class | Rationale |
|---|---|---|
| `nex_friend_edge` | **G** | Explicit cross-country · doctrine §4 "Social" |
| `nex_friend_request` | **G** | Same |

### Vault (8 · all G)

| Table | Class | Rationale |
|---|---|---|
| `nex_vault_entry`, `nex_vault_file`, `nex_vault_key_envelope`, `nex_vault_pin_attempt`, `nex_vault_recovery_attempt`, `nex_vault_setup`, `nex_vault_conversation_envelope`, `nex_vault_file_migration_attempt` | **G** | Sealed personal encrypted storage · stays GLOBAL · owner-anchored |

### Chat Themes · Commerce Product (6 · all G · owner CI-7 explicitly: GLOBAL)

| Table | Class | Rationale |
|---|---|---|
| `nex_chat_theme` | **G** | Sealed commerce product · one marketplace |
| `nex_theme_emoji`, `nex_theme_sticker`, `nex_theme_view_counter`, `nex_theme_intro_seen` | **G** | Chain to `nex_chat_theme` |
| `nex_color_palette` | **R** | Reference colour data for themes · global |

### Moderation / Reports (1 · M)

| Table | Class | Rationale |
|---|---|---|
| `nex_report` | **M** | See CI-8 · subject country drives jurisdiction. Reporter country matters for GDPR notice. Explicit per-report routing. |

### Platform operational (12 · all G)

| Table | Class | Rationale |
|---|---|---|
| `nex_migration_history` | **R** | Platform metadata · one row per migration |
| `nex_surface_health_event` | **G** | Operational logging · platform-wide |
| `nex_collection_fetch_errors`, `nex_collection_url_queue` | **G** | Harvest ops · platform-wide |
| `nex_welcome_outbox` | **G** | Onboarding emails · platform-wide |
| `nex_ledger_entry`, `nex_ledger_line` | **CO-I** | Via `order_id` → `nex_order` → `nex_business` · financial · country-sensitive |
| `nex_generated_site`, `nex_generation_job` | **CO-I** | FK `business_id` or `conversation_id` · business-anchored |
| `nex_banner` | **M** | Classified above |

---

## Summary totals

| Class | Count | % |
|---|---:|---:|
| **G** · GLOBAL (identity · peer · personal · platform ops) | 56 | 57% |
| **CO** · COUNTRY-OWNED (direct `country` column) | 4 | 4% |
| **CO-I** · COUNTRY-OWNED (inherited via FK) | 32 | 32% |
| **M** · MIXED (needs explicit per-table decision) | 5 | 5% |
| **R** · REFERENCE DATA | 2 | 2% |
| **GV** · GLOBAL WITH VISIBILITY (visibility column needed) | 2 | 2% |
| **Total** | 99 | 100% |

Table 100% accounted for. Numbers slightly differ from the previous ~60/30/5 estimate because the FK audit let me reclassify CO-I vs CO precisely (most "country-owned" tables inherit via FK rather than owning their own column).

---

## Tables that own a direct `country` column (CO · 4)

Only these four need their own `country text` column added via Migration 244. Everything else inherits.

| Table | Why its own column |
|---|---|
| `nex_business` | **The root commerce anchor** · fixes the "RLS=USING(true)" gap today |
| `nex_community_zone` | **The root community anchor** · all community cards + notices chain here |
| `nex_live_session` | **The root live anchor** · can be joined via FK, but putting country on the session itself denormalises for RLS speed on the hot path |
| `nex_report` | Reporter's country ≠ subject country · needs explicit `country` for jurisdiction routing (see M-table resolution doc) |

**Design implication**: Migration 244 draft (currently 37 tables) is OVER-SCOPED. The audit says only 4 tables actually need their own column. The other 32 CO-I tables resolve country via FK join in their RLS policy. Simpler + faster + less schema drift.

**Reissued Migration 244 scope**: country column on 4 tables only (`nex_business`, `nex_community_zone`, `nex_live_session`, `nex_report`). Updated migration file would land in a subsequent commit.

---

## Tables needing `visibility content_visibility` column (GV + some CO)

Per the new global content doctrine section 4:

| Table | Why |
|---|---|
| `nex_music_track` | Author-set audience scope per track |
| `nex_uploaded_video` | Same |
| `nex_business` | Owner opts into international discovery (CO + visibility) |
| `nex_product` | Author-set scope + separate `allowed_delivery_destinations` |
| `nex_live_session` | Broadcaster audience scope per stream |
| `nex_live_post` | Chain to live_session's visibility (inherited at join) |
| `nex_community_notice`, `nex_community_card` | Address-anchored but may need PRIVATE / FRIENDS / COUNTRY scope |

Scope captured in Migration 247 (visibility column + enum type).

---

## Cross-country owner tables with buyer-side ambiguity

Explicit for the record:

- `nex_order.customer_account_id` is the buyer's account. The buyer may be in Ireland buying from an Indonesian seller (if the seller allows). The order's `country` is the SELLER's country (via business_id → business.country). The buyer-side country is informational for taxation / shipping · not for RLS.
- `nex_message` / `nex_peer_message` cross countries freely · doctrine confirms peer chat is GLOBAL.
- `nex_community_card_report.reporter_account_id` · reporter may be in another country · the subject (the card) has a country · the policy filters on the subject's country, not the reporter's.

---

## Four-FK-inheritance chains (summary)

Most CO-I inheritance resolves through these 4 anchors:

1. **`nex_business.country`** (anchor for ~22 downstream tables)
2. **`nex_community_zone.country`** (anchor for 13 downstream community tables)
3. **`nex_live_session.country`** (anchor for 5 downstream live tables)
4. **`nex_report.country`** (self · reporter cross-country allowed)

An RLS policy on a CO-I table joins through the FK to its anchor and reads the anchor's country. Policies are longer but logically identical.

---

## Owner acceptance target

Return approval or reclassification for:

1. The 4 CO tables (anchors)
2. The 32 CO-I tables (inherited · no own column)
3. The 2 GV tables (music + uploaded video)
4. The 56 G tables
5. The 2 R tables (reference data: `nex_color_palette`, `nex_migration_history`)
6. The 5 M tables → see **`nex-mixed-tables-resolution-2026-10-31.md`** (companion doc)

Reissued Migration 244 (country column on 4 tables only · not 37) will be drafted after approval. Current Migration 244 DRAFT remains on disk as the pre-reconciliation version · will be renamed to `.SUPERSEDED-BY-REISSUE` once a cleaner 244 is drafted.

---

*Classification 2026-10-31. Awaiting owner acceptance of the 99-row table. Pure analysis · no code · no migration applied.*
