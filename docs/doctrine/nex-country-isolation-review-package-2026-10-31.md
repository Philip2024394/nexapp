# NEX · Country Isolation Review Package · 2026-10-31

**Status**: review artefact for owner inspection · consolidates the seven deliverables requested in the owner's `NEX OWNER DECISION — COUNTRY CLASSIFICATION REVIEW` (2026-10-31).
**Hard boundary**: this document is doctrine only. No migration applied · no production push · no deployment · no changes to the application · all commits remain local.
**Owner authorisation posture**:
- 99-table classification accepted as working baseline, subject to the final technical review in this doc.
- 5 mixed-tables accepted provisionally, access matrix in §2 below.
- 4-anchor Migration 244 revised DRAFT prepared · DRAFT only · not applied.
- Migrations 245-248 not drafted beyond proposals in `nex-migrations-244-to-248-individually-2026-10-31.md`.
- Chat Themes untouched (CI-7).
- Technical debt kept as a parallel workstream (`nex-technical-debt-workstream-2026-10-31.md` · TD-1..TD-4 pending).

Companion docs this review consolidates:
- `nex-99-table-classification-2026-10-31.md` (full table + visibility addendum)
- `nex-mixed-tables-resolution-2026-10-31.md`
- `nex-migrations-244-to-248-individually-2026-10-31.md`
- `nex-global-content-and-country-discovery-2026-10-31.md` (incl. §13 four safeguards)
- `nex-rls-policy-matrix-2026-10-31.md` (seven safety gates + six scenarios)

---

## 1 · Compact 99-table review

### 1.0 · Legend (abbreviation meanings)

| Code | Full meaning | Where country lives | Visibility column? |
|---|---|---|---|
| **G** | **GLOBAL** · identity / peer / personal / platform operations | nowhere · no country concept | no |
| **CO** | **COUNTRY-OWNED, direct** · the table carries its OWN `country text` column | on the row itself (`<table>.country`) | some (per §1.3) |
| **CO-I** | **COUNTRY-OWNED, INHERITED** · the row has no own country column; country is derived at policy-evaluation time by joining to a FK parent that is **CO** or another **CO-I** | derived via FK chain, terminating at a CO anchor | some (per §1.3) |
| **R** | **REFERENCE DATA** · global lookup values; same across all countries; admin-only writes | nowhere · reference data is country-independent | no |
| **GV** | **GLOBAL WITH VISIBILITY** · content follows the OWNER (an account) rather than a country, but needs the 6-scope `visibility` enum from the global content doctrine | nowhere · owner-anchored | yes |
| **M** | **MIXED, resolved** · needs an explicit per-table decision (CI-8) · see §2 of this doc | per §2 | per §2 |

Visibility column, when present, is the enum type `content_visibility` with six scopes: `PRIVATE`, `FRIENDS`, `FOLLOWERS`, `COUNTRY`, `SELECTED_COUNTRIES`, `WORLDWIDE`. `nex_product` additionally carries `discovery_visibility` + `international_sales_enabled` + `allowed_delivery_destinations` per owner CI-10 (three independent fields, see §13.3 of the global content doctrine).

### 1.1 · All 99 tables · classification + inheritance

Columns:
- **Class**: G / CO / CO-I / R / GV / M.
- **FK → anchor**: for CO-I rows, the FK column (and the anchor it chains to). For CO rows, "self". For G / R, "n/a".
- **Vis.**: ✓ (adds `visibility`) · ✗ (no visibility column). Per owner safeguard CI-1 (§13.1 global content doctrine), visibility is NOT universal.
- **Default**: default scope on backfill when Vis. = ✓.

#### Identity · Account · Auth (14 · all G)

| # | Table | Class | FK → anchor | Vis. |
|---:|---|---|---|---|
| 1 | `nex_account` | G | n/a | ✗ |
| 2 | `nex_account_custom_intro` | G | n/a (owner-anchored, no country) | ✗ |
| 3 | `nex_account_device_key` | G | n/a | ✗ |
| 4 | `nex_account_music_rights_ack` | G | n/a | ✗ |
| 5 | `nex_account_notification_prefs` | G | n/a | ✗ |
| 6 | `nex_account_profile` | G | n/a | ✗ (existing `profile_visibility` is a separate sealed concept, not the content enum) |
| 7 | `nex_account_push_subscription` | G | n/a | ✗ |
| 8 | `nex_account_relationship_prefs` | G | n/a | ✗ |
| 9 | `nex_account_risk_signal` | G | n/a | ✗ |
| 10 | `nex_handle_counter` | G | n/a | ✗ |
| 11 | `nex_session` | G | n/a | ✗ |
| 12 | `nex_session_registry` | G | n/a | ✗ |
| 13 | `nex_sign_in_event` | G | n/a | ✗ |
| 14 | `nex_webauthn_credential` | G | n/a | ✗ |

#### Business · Commerce (24)

| # | Table | Class | FK → anchor | Vis. |
|---:|---|---|---|---|
| 15 | `nex_business` | **CO** | self | ✓ default `COUNTRY` |
| 16 | `nex_product` | CO-I | `business_id` → `nex_business` | ✓ default `COUNTRY` (plus `international_sales_enabled` + `allowed_delivery_destinations` triple per CI-10) |
| 17 | `nex_product_ladder` | CO-I | `business_id` → `nex_business` | ✗ (child of product/business, inherits) |
| 18 | `nex_product_section` | CO-I | `business_id` → `nex_business` | ✗ (child, inherits) |
| 19 | `nex_product_variant` | CO-I | `product_id` → `nex_product` → `nex_business` | ✗ (child, inherits) |
| 20 | `nex_product_share_grant` | CO-I | `business_id` + `product_id` → `nex_business` | ✗ (grant metadata) |
| 21 | `nex_order` | CO-I | `business_id` → `nex_business` (seller side; buyer is `customer_account_id`, informational only for RLS) | ✗ (transactional record, not content) |
| 22 | `nex_order_event` | CO-I | `order_id` → `nex_order` → `nex_business` | ✗ (chain) |
| 23 | `nex_cart` | G | owner account; may contain cross-country products | ✗ |
| 24 | `nex_liked_product` | G | owner account; cross-country allowed | ✗ |
| 25 | `nex_buyer_tier_progress` | CO-I | `business_id` → `nex_business` | ✗ (progression metric) |
| 26 | `nex_affiliate_account` | CO-I | `account_id` + `business_id` → `nex_business` | ✗ |
| 27 | `nex_affiliate_promotion` | CO-I | `business_id` → `nex_business` | ✗ |
| 28 | `nex_banner` | **M → CO-I** | `business_id` (or `product_id`) → `nex_business` + edge: platform-wide orphan | ✗ (banners are inherited from parent business/product) |
| 29 | `nex_menu_item` | CO-I | `business_id` → `nex_business` | ✗ |
| 30 | `nex_menu_section` | CO-I | `business_id` → `nex_business` | ✗ |
| 31 | `nex_service` | CO-I | `business_id` → `nex_business` | ✗ |
| 32 | `nex_profession` | **M → R** | n/a | ✗ |
| 33 | `nex_vertical` | **M → R** | n/a | ✗ |
| 34 | `nex_gallery_image` | CO-I | `business_id` → `nex_business` | ✗ (child, inherits) |
| 35 | `nex_email_campaign` | CO-I | `list_id` → `nex_email_list` → `nex_business` | ✗ (operational) |
| 36 | `nex_email_list` | CO-I | `business_id` → `nex_business` | ✗ (operational) |
| 37 | `nex_email_subscriber` | CO-I | `list_id` → `nex_email_list` → `nex_business` | ✗ (operational) |
| 38 | `nex_email_send_log` | CO-I | `campaign_id` → `nex_email_campaign` → chain | ✗ (operational) |

#### Community (14)

| # | Table | Class | FK → anchor | Vis. |
|---:|---|---|---|---|
| 39 | `nex_community_zone` | **CO** | self | ✗ (zones themselves are not published content; they are reference anchors) |
| 40 | `nex_community_card` | CO-I | `zone_id` → `nex_community_zone` | ✓ default `COUNTRY` |
| 41 | `nex_community_card_confirmation` | CO-I | `card_id` → `nex_community_card` → zone | ✗ (child) |
| 42 | `nex_community_card_photo` | CO-I | `card_id` → chain | ✗ (child) |
| 43 | `nex_community_card_report` | CO-I | `card_id` → chain; reporter cross-country allowed | ✗ (moderation metadata) |
| 44 | `nex_community_card_update` | CO-I | `card_id` → chain | ✗ (child) |
| 45 | `nex_community_business_welcome_detail` | CO-I | `business_id` + `card_id` → chain | ✗ (child) |
| 46 | `nex_community_lost_found_detail` | CO-I | `card_id` → chain | ✗ (child) |
| 47 | `nex_community_notice` | CO-I | `zone_id` → `nex_community_zone` | ✓ default `COUNTRY` |
| 48 | `nex_community_notice_confirmation` | CO-I | `notice_id` → chain | ✗ (child) |
| 49 | `nex_community_notice_report` | CO-I | `notice_id` → chain | ✗ (moderation metadata) |
| 50 | `nex_community_notice_update` | CO-I | `notice_id` → chain | ✗ (child) |
| 51 | `nex_community_membership` | CO-I | `zone_id` → `nex_community_zone` | ✗ (membership record) |
| 52 | `nex_community_rate_limit` | CO-I | `account_id` + `zone_id` → chain | ✗ (operational) |

#### Live + Live Selling (9)

| # | Table | Class | FK → anchor | Vis. |
|---:|---|---|---|---|
| 53 | `nex_live_session` | **CO** | self (broadcaster-anchored) | ✓ default `COUNTRY` |
| 54 | `nex_live_post` | CO-I | `business_id` → `nex_business` + often `session_id` → `nex_live_session` | ✓ default `COUNTRY` |
| 55 | `nex_live_participation` | CO-I | `session_id` → `nex_live_session` | ✗ (participation record) |
| 56 | `nex_live_engagement` | CO-I | `session_id` → `nex_live_session` | ✗ (engagement metric) |
| 57 | `nex_live_featured_product` | CO-I | `session_id` + `product_id` → chain | ✗ (child) |
| 58 | `nex_live_jail` | CO-I | `session_id` → `nex_live_session` | ✗ (moderation state) |
| 59 | `nex_group_call_session` | G | peer-to-peer, cross-country allowed | ✗ |
| 60 | `nex_group_call_participant` | G | `session_id` → `nex_group_call_session` | ✗ |
| 61 | `nex_call_link` | G | n/a | ✗ |
| 62 | `nex_call_log` | G | n/a | ✗ |

(Row 61+62 share one bullet in the earlier doc; they are two separate tables, counted separately here.)

#### Peer Chat (6 · explicitly cross-country permitted)

| # | Table | Class | FK → anchor | Vis. |
|---:|---|---|---|---|
| 63 | `nex_conversation` | G | n/a (business_id nullable; the conversation is between people) | ✗ |
| 64 | `nex_conversation_participant` | G | `conversation_id` → `nex_conversation` | ✗ |
| 65 | `nex_message` | G | n/a | ✗ |
| 66 | `nex_peer_conversation` | G | n/a | ✗ |
| 67 | `nex_peer_message` | G | n/a | ✗ |
| 68 | `nex_bridge99_first_send_intent` | G | n/a | ✗ |

#### Music + Creator (5)

| # | Table | Class | FK → anchor | Vis. |
|---:|---|---|---|---|
| 69 | `nex_music_track` | **GV** | owner account (not a country) | ✓ default `PRIVATE` |
| 70 | `nex_music_publish_idempotency` | G | n/a (operational dedup) | ✗ |
| 71 | `nex_creator_active_music` | G | `account_id` + `track_id` → owner | ✗ |
| 72 | `nex_creator_support_settings` | G | owner account (creator's own payment pointer) | ✗ |
| 73 | `nex_uploaded_video` | **GV** | owner account | ✓ default `PRIVATE` |

#### Friends · Follows (2 · all G)

| # | Table | Class | FK → anchor | Vis. |
|---:|---|---|---|---|
| 74 | `nex_friend_edge` | G | n/a | ✗ |
| 75 | `nex_friend_request` | G | n/a | ✗ |

#### Vault (8 · all G · sealed personal encrypted storage)

| # | Table | Class | FK → anchor | Vis. |
|---:|---|---|---|---|
| 76 | `nex_vault_entry` | G | n/a | ✗ |
| 77 | `nex_vault_file` | G | n/a | ✗ |
| 78 | `nex_vault_key_envelope` | G | n/a | ✗ |
| 79 | `nex_vault_pin_attempt` | G | n/a | ✗ |
| 80 | `nex_vault_recovery_attempt` | G | n/a | ✗ |
| 81 | `nex_vault_setup` | G | n/a | ✗ |
| 82 | `nex_vault_conversation_envelope` | G | n/a | ✗ |
| 83 | `nex_vault_file_migration_attempt` | G | n/a | ✗ |

#### Chat Themes · Commerce product (5 · all G · owner CI-7)

| # | Table | Class | FK → anchor | Vis. |
|---:|---|---|---|---|
| 84 | `nex_chat_theme` | G | n/a (one global marketplace) | ✗ |
| 85 | `nex_theme_emoji` | G | `theme_id` → `nex_chat_theme` | ✗ |
| 86 | `nex_theme_sticker` | G | `theme_id` → `nex_chat_theme` | ✗ |
| 87 | `nex_theme_view_counter` | G | `theme_id` → `nex_chat_theme` | ✗ |
| 88 | `nex_theme_intro_seen` | G | `theme_id` + account | ✗ |

#### Reference data (2 · all R)

| # | Table | Class | FK → anchor | Vis. |
|---:|---|---|---|---|
| 89 | `nex_color_palette` | R | n/a | ✗ |
| 90 | `nex_migration_history` | R | n/a (platform metadata) | ✗ |

#### Moderation (1 · M → CO)

| # | Table | Class | FK → anchor | Vis. |
|---:|---|---|---|---|
| 91 | `nex_report` | **CO** | self (country stores SUBJECT's jurisdiction, not reporter's; set at write time by server action) | ✗ (moderation reports are never discoverable content; see §2.4) |

#### Platform operational (8 · all G or CO-I via FK)

| # | Table | Class | FK → anchor | Vis. |
|---:|---|---|---|---|
| 92 | `nex_surface_health_event` | G | n/a (platform-wide observability) | ✗ |
| 93 | `nex_collection_fetch_errors` | G | n/a (harvest ops) | ✗ |
| 94 | `nex_collection_url_queue` | G | n/a (harvest ops) | ✗ |
| 95 | `nex_welcome_outbox` | G | n/a (onboarding emails) | ✗ |
| 96 | `nex_ledger_entry` | CO-I | `order_id` → `nex_order` → `nex_business` | ✗ (financial) |
| 97 | `nex_ledger_line` | CO-I | `entry_id` → `nex_ledger_entry` → chain | ✗ (financial) |
| 98 | `nex_generated_site` | CO-I | `business_id` → `nex_business` | ✗ (business-anchored) |
| 99 | `nex_generation_job` | CO-I | `business_id` → `nex_business` | ✗ (business-anchored) |

### 1.2 · Totals

| Class | Count | % |
|---|---:|---:|
| G (GLOBAL) | 56 | 57% |
| CO (own country column) | 4 | 4% |
| CO-I (inherited via FK) | 32 | 32% |
| M (resolved → see §2) | 5 | 5% |
| R (reference) | 2 | 2% |
| GV (owner-anchored, needs visibility) | 2 | 2% |
| **Total** | **99** | **100%** |

Visibility column receivers: 8 tables (`nex_business`, `nex_product`, `nex_music_track`, `nex_uploaded_video`, `nex_live_session`, `nex_live_post`, `nex_community_notice`, `nex_community_card`). 91 tables explicitly do not receive it (reference / transactional / peer-chat / vault / chat-themes / operational / child-tables).

### 1.3 · Visibility column assignments (CI-1 safeguard)

The 8 tables that receive `content_visibility` are **not** chosen "for consistency with CO-ness"; they are chosen because they are the only tables where **a human author explicitly selects an audience per record**. Children, transactional records, moderation metadata, and operational tables inherit scope from their anchor and never receive the column.

Rule: "author chooses the scope" → gets `visibility`. Any other reason → does not.

### 1.4 · Country column assignments

Only 4 tables carry `country` as a direct column:

- `nex_business` (root commerce anchor)
- `nex_community_zone` (root community anchor)
- `nex_live_session` (root live anchor)
- `nex_report` (moderation jurisdiction, stored at write)

Full justification for each in §3 below.

### 1.5 · "What must never receive a column"

Owner directive verbatim: *"Do not add country or visibility fields simply for consistency."*

Tables that **must never** receive either column:

- `nex_account*` family (14 identity rows) — a user is one global person; adding country would fragment identity.
- `nex_cart`, `nex_liked_product`, `nex_friend_edge`, `nex_friend_request` — these cross countries by design; a cart may contain cross-country products.
- `nex_message`, `nex_peer_message`, `nex_peer_conversation`, `nex_conversation`, `nex_conversation_participant`, `nex_group_call_*`, `nex_call_log`, `nex_call_link`, `nex_bridge99_first_send_intent` — peer chat is explicitly cross-country permitted.
- `nex_vault_*` (8 rows) — sealed personal encrypted storage, owner-anchored, no country concept.
- `nex_chat_theme*` (5 rows) — sealed commerce product, one marketplace (CI-7).
- `nex_color_palette`, `nex_migration_history` — reference data.
- Operational: `nex_surface_health_event`, `nex_collection_*`, `nex_welcome_outbox`, `nex_handle_counter`, `nex_session*`, `nex_sign_in_event`, `nex_webauthn_credential`.

---

## 2 · Five mixed-tables · access matrix

Per owner directive: *"Provide the exact record ownership, read permissions, write permissions and administrative access model for each. Moderation reports must not become discoverable content."*

### 2.1 · `nex_profession` · reference / global

| Dimension | Rule |
|---|---|
| Record ownership | None — reference data owned by the platform |
| INSERT | HQ admin only (service_role after `requireHqAdmin`); application code never writes |
| UPDATE | HQ admin only |
| DELETE | HQ admin only (soft delete preferred; FKs may exist from business profiles) |
| SELECT · same deployment | All authenticated users, both countries |
| SELECT · cross-deployment | All authenticated users read the same global list |
| Service role | Full access |
| Country column | None |
| Visibility column | None |

**Why global**: "Yoga Instructor" has the same semantic meaning in Ireland and Indonesia. The i18n label is a separate concern, handled at the display layer (not RLS). If a vocabulary ever needs to differ per country, that is a NEW companion table (`nex_profession_country_vocab`), not a country column on this table.

### 2.2 · `nex_vertical` · reference / global

| Dimension | Rule |
|---|---|
| Record ownership | None — reference data owned by the platform |
| INSERT / UPDATE / DELETE | HQ admin only |
| SELECT · same deployment | All authenticated users, both countries |
| SELECT · cross-deployment | All authenticated users read the same global list |
| Service role | Full access |
| Country column | None |
| Visibility column | None |

**Why global**: "Food", "Products", "Services", "Accommodation" are the top-level business taxonomy; the Phase A1 doctrine (sealed 2026-10-20) treats these as universal verticals. Country-specific sub-categories would cascade badly into `nex_profession` and the business profile; keep flat.

### 2.3 · `nex_banner` · CO-I via FK (business or product)

| Dimension | Rule |
|---|---|
| Record ownership | Business owner (`business_id` → `nex_business`) OR, for a product-anchored banner, inherited from product's business |
| INSERT | Authenticated owner of the referenced business; writer's deployment must match the business's country |
| UPDATE | Same (owner of the anchor business) |
| DELETE | Same |
| SELECT · same deployment | Visible to all authenticated users whose `nex.app_country` matches the anchor business's country, subject to the business's own publication state |
| SELECT · cross-deployment | Not visible unless the anchoring business has `visibility='WORLDWIDE'` and all seven safety gates (G1-G7) pass |
| Service role | Full access |
| Country column | None (inherited via FK join) |
| Visibility column | None (inherits from anchor; a banner never advertises itself across a country boundary independently of its anchoring business) |

**Platform-wide-orphan edge case** (open owner question): if a banner has NO `business_id` AND NO `product_id`, the current audit shows this is unused today. Options when owner authorises platform-wide banners later:
- (a) explicit `is_platform_wide boolean DEFAULT false` column with a dedicated RLS branch allowing cross-country reads;
- (b) require all banners to anchor to something (reject orphan inserts).

**Recommendation**: option (b) today; raise option (a) when the first real platform-wide banner use case appears. No code change required today.

### 2.4 · `nex_report` · moderation · CO · subject-jurisdiction

Explicit owner constraint: *"Moderation reports must not become discoverable content. A worldwide post does not make its moderation reports worldwide."*

| Dimension | Rule |
|---|---|
| Record ownership | Platform (HQ moderation) |
| INSERT | Any authenticated reporter from any deployment; **the server action writes `country = subject's country` by looking up the subject at write time** (not the reporter's deployment country) |
| UPDATE | HQ moderators only (service_role after `requireHqAdmin`); fields like `moderation_status`, `reviewed_by`, `reviewed_at` |
| DELETE | HQ moderators only; soft-delete preferred |
| SELECT · reporter | Reporter can see their own filed reports via a scoped view (not direct table read) |
| SELECT · subject | Subject never sees who reported them; may see aggregated "your account has pending reports" via a scoped RPC, not the table |
| SELECT · same deployment | Not permitted. A regular authenticated user cannot read `nex_report` directly at all. All access goes through scoped RPCs or HQ |
| SELECT · cross-deployment | Not permitted. HQ moderators access through service_role, not through a cross-country app-level read |
| Service role (HQ) | Full access, scoped by `requireHqAdmin` |
| Country column | **Yes · set by server action to subject's jurisdiction** |
| Visibility column | **No** · reports are never author-published content |

**Policy sketch**:
```sql
-- No SELECT policy for authenticated role on nex_report.
-- Reads happen through:
--   (a) HQ service_role path (bypasses RLS), gated at application level by requireHqAdmin
--   (b) scoped RPC `rpc_report_my_filings()` that returns the authenticated caller's own reports only

ALTER TABLE public.nex_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_report FORCE ROW LEVEL SECURITY;

-- INSERT: reporter can insert if country column is set correctly
CREATE POLICY nex_report_insert_by_reporter ON public.nex_report
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_account_id = auth.uid()
    AND country IS NOT NULL
    AND country <> ''
    -- country is set by the server action; the policy only asserts non-empty
    -- the server action is responsible for computing subject-jurisdiction correctly
  );

-- No SELECT policy for authenticated → no row visible to any non-HQ caller.
-- Service role bypasses RLS; HQ is gated at application level.
```

Why this model protects against the owner's named risk: cross-country discovery, filter enumeration, and the "worldwide post → worldwide report" leak are all impossible because **no authenticated role has a SELECT path to the table at all**. The reporter sees their own filings only via an RPC, which can return a redacted view (status / timestamps / reason category) rather than the raw row.

### 2.5 · Chat Themes · G · sealed commerce (CI-7)

Five tables: `nex_chat_theme`, `nex_theme_emoji`, `nex_theme_sticker`, `nex_theme_view_counter`, `nex_theme_intro_seen`.

| Dimension | Rule |
|---|---|
| Record ownership | Platform (themes catalogue); each ownership (purchase) is per-account |
| INSERT / UPDATE / DELETE on catalogue | HQ only; the sealed commerce engine is the single writer; no application-level writes change this |
| SELECT · same deployment | All authenticated users |
| SELECT · cross-deployment | All authenticated users read the same global catalogue |
| Service role | Full access |
| Country column | **No** (CI-7 sealed) |
| Visibility column | **No** |
| Regional pricing | Handled at the pricing layer per `nex_pricing_baseline_2026_10_20`; if pricing ever requires a per-country `jsonb` on `nex_chat_theme`, that is a **separate** CI change, authored and authorised independently (not folded into this country-isolation programme) |

**Explicit boundary**: this programme does not touch any of the five chat-theme tables; does not change design tokens; does not change the sealed master chat layout.

---

## 3 · Four-anchor explanation

Owner directive: *"List the four exact tables and explain: why each is an anchor · which dependent tables inherit country ownership · why the other 33 tables no longer need direct changes · how existing records are handled."*

### 3.1 · The four anchors

**Anchor A — `nex_business`**
- **Why an anchor**: it is the single root of all commerce. 22 tables chain to it either directly (16) or via `nex_product` (6).
- **Why its own column**: three reasons. First, the "USING (true)" RLS gap today is on this table — fixing it is the central point of the entire isolation plan. Second, every commerce-side query filters by business, so a direct column is faster than a join. Third, migration 248 (storage prefixes) needs to look up a business's country without joining through a chain.
- **Dependents inheriting via `nex_business.country`**: `nex_product`, `nex_product_ladder`, `nex_product_section`, `nex_product_share_grant`, `nex_product_variant` (via `nex_product`), `nex_order`, `nex_order_event` (via `nex_order`), `nex_buyer_tier_progress`, `nex_affiliate_account`, `nex_affiliate_promotion`, `nex_banner` (when `business_id` is set), `nex_menu_item`, `nex_menu_section`, `nex_service`, `nex_gallery_image`, `nex_email_campaign` (via `nex_email_list`), `nex_email_list`, `nex_email_subscriber`, `nex_email_send_log`, `nex_live_post` (business arm), `nex_ledger_entry` (via `nex_order`), `nex_ledger_line` (via entry), `nex_generated_site`, `nex_generation_job`. **22 dependents** (plus `nex_community_business_welcome_detail` which anchors through both business and community).

**Anchor B — `nex_community_zone`**
- **Why an anchor**: all community cards, notices, and their children chain to a zone. A zone is defined by a geographic address, so the zone IS the country. Putting country on the zone (rather than deriving it from a PostGIS lookup at every policy evaluation) is a correctness and performance win.
- **Why its own column**: the alternative is to resolve country from the address every time a card or notice is read, which (a) requires a PostGIS tile index and (b) couples RLS to geo-code resolution — brittle and slow.
- **Dependents inheriting via `nex_community_zone.country`**: `nex_community_card`, `nex_community_notice`, and all their 11 child tables (`_confirmation`, `_photo`, `_report`, `_update`, `_business_welcome_detail`, `_lost_found_detail`, `_notice_confirmation`, `_notice_report`, `_notice_update`, `_membership`, `_rate_limit`). **13 dependents**.

**Anchor C — `nex_live_session`**
- **Why an anchor**: broadcaster country is session country, and the live-selling child tables (`_participation`, `_engagement`, `_featured_product`, `_jail`) all chain to the session.
- **Why its own column**: live is a hot path. Policies on `_engagement` would otherwise join through `_session` on every row. Keeping country directly on `_session` (and letting child policies join only once to `_session`) keeps the hot-path cheap.
- **Dependents inheriting via `nex_live_session.country`**: `nex_live_participation`, `nex_live_engagement`, `nex_live_featured_product`, `nex_live_jail`, and `nex_live_post` (which also inherits from business). **5 dependents**.

**Anchor D — `nex_report`**
- **Why an anchor**: unlike the other three, this is NOT a parent of a tree. It is a single-row concept where country is a per-row property with jurisdictional meaning (the subject's country, not the reporter's). The server action writes it.
- **Why its own column**: an RLS policy cannot look up the subject (which may be a card, a notice, a business, a message, a product — different tables) at policy time with any sanity. Store country on the row itself, computed once at insert.
- **Dependents**: none. `nex_report` is a leaf.

### 3.2 · Why the other 33 CO-I tables need no direct schema change

Each CO-I table's policy resolves country at policy-evaluation time via a FK join to one of the four anchors (A/B/C/D). Three design implications:

- **No `country` column** on the CO-I table — avoids schema drift and avoids a backfill operation per CO-I table.
- **No `country` field in the application code** — the application reads/writes the row by its FK; the policy performs the country check.
- **Policy join cost is predictable** — each CO-I policy touches exactly one anchor (not a transitive chain). For deep CO-I chains (`nex_product_variant → nex_product → nex_business`) the policy pulls `nex_business.country` through the chain in one query. Postgres handles this with the FK indexes we already have.

### 3.3 · How existing records are handled

- **Migration 244** adds the four columns as `NULL`. Zero data modification, zero behaviour change. All existing rows have `country IS NULL`.
- **Migration 246** backfills the four anchor tables with `'ID'` for every existing row. This is safe because 100% of production-shaped data today was created under dev-impersonation of Indonesian personas (`nex-99901`, `nex-50001`..`nex-50024`). The audit query in `nex-migrations-244-to-248-individually-2026-10-31.md` §Migration 246 enumerates the row counts; before applying 246 we confirm 0 Irish-origin rows.
- **Migration 247** adds the `visibility` column to the 8 content tables with `DEFAULT 'COUNTRY'`. All existing rows default to country-local scope → zero exposure change.
- **Migration 245** applies the country-aware RLS. **This is the only migration whose apply reduces visibility of data.** Everything before it is additive. Everything after it (248) deals with storage objects, not table rows.
- **No existing record is deleted, rewritten, or lost** at any step. Backfill is reversible via the rollback blocks already documented in the migrations proposal doc.

---

## 4 · Migration dependency order 244 → 246 → 247 → 245 → 248

Owner directive: *"Preserve the corrected order. Explain the dependency between each migration and why 246 must precede 245."*

### 4.1 · What each migration does

| # | Does | Does NOT |
|---|---|---|
| **244** | Add nullable `country text` column to the 4 anchor tables | No backfill · no RLS · no behaviour change |
| **246** | UPDATE every existing row in the 4 anchor tables to `country='ID'` | No column change · no RLS · no new rows |
| **247** | CREATE TYPE `content_visibility`; add `visibility` + `selected_countries` columns to 8 content tables, with default `'COUNTRY'` (or `'PRIVATE'` for music + video) | No RLS · no backfill of visibility (defaults already apply) |
| **245** | Replace `USING (true)` on `nex_business`; install country-match + visibility-OR-country RLS across 4 CO + ~32 CO-I tables | No column change · no backfill · behaviour **changes** here |
| **248** | Storage prefix policies on `nex-business-assets`; path-rename plan for existing objects | No application-table change |

### 4.2 · Why this order and not filename order

Numerical filename order (244, 245, 246, 247, 248) would apply RLS before the backfill, which would make every row in the four anchor tables (country IS NULL) **invisible to every reader** including the business's own owner, because the RLS predicate `country = current_setting('nex.app_country')` is `NULL = 'ID'` → `NULL` (unknown) → row excluded under RLS fail-closed semantics. The whole platform would go dark on apply.

Numerical order would also apply RLS before the `visibility` column exists; the policy's second branch `visibility = 'WORLDWIDE'` would reference a column that doesn't exist yet → migration fails.

### 4.3 · Why each step depends on the previous

- **246 depends on 244**: cannot UPDATE a column that doesn't exist.
- **247 depends on 244**: adding `visibility` only makes semantic sense once country exists; also 247's enum values reference country concepts (`COUNTRY`, `SELECTED_COUNTRIES`). Not a hard SQL dependency but a semantic one.
- **245 depends on 246**: as above — RLS cannot apply before backfill is 100% complete, else existing rows become invisible.
- **245 depends on 247**: the RLS predicates reference the `visibility` column and the `content_visibility` enum.
- **248 depends on 244 + 246**: the storage path rename reads `nex_business.country` to compute each business's prefix; column must exist AND be populated.

### 4.4 · The dependency, drawn

```
244 (col) ──► 246 (backfill) ──┐
   │                           ├──► 245 (RLS) ──► 248 (storage)
   └────────► 247 (visibility) ─┘
```

RLS is the pinch point. Everything else is additive and reversible.

### 4.5 · Per-migration authorisation

Each of the five migrations requires separate owner authorisation before it is applied to any database. Owner's wording: *"This authorises preparation of a local draft only. It does not authorise migration application."*

---

## 5 · RLS and discovery verification

Owner directive: *"Show the actual proposed policies and explain how they enforce (strict writes · country-matched reads · explicit cross-country discovery · privacy / blocking / moderation / lifecycle / age restrictions · restricted moderation-report access · safe service-role operations · secure transaction-scoped country context without connection-pool leakage)."*

Full policy templates and the six scenario walkthroughs live in `nex-rls-policy-matrix-2026-10-31.md`. The seven safety gates there (G-published, G-moderation, G-privacy, G-blocking, G-age, G-content-scope, G-relationship) are referenced below but not re-expanded.

### 5.1 · Write-side (strict · owner CI-2)

```sql
-- Applies to every CO + CO-I table's INSERT / UPDATE / DELETE
WITH CHECK (
  current_setting('nex.app_country', true) IS NOT NULL
  AND current_setting('nex.app_country', true) <> ''
  AND country = current_setting('nex.app_country', true)
)
```

For CO-I tables, `country = current_setting(...)` is replaced by `EXISTS (SELECT 1 FROM <anchor> WHERE id = <fk> AND country = current_setting(...))`.

- UPDATE policies include the same `WITH CHECK` so a row's country cannot be mutated to a different country (owner CI-9: country is immutable through UPDATE).
- DELETE is permitted only for rows that satisfy the same `USING` clause plus any additional author-ownership check (`owner_account_id = auth.uid()` or an equivalent).

### 5.2 · Read-side (visibility-OR-country · owner safeguard 13.2)

```sql
USING (
  -- Branch 1: same country match
  (
    country = current_setting('nex.app_country', true)
    AND <G1 published> AND <G2 moderation OK> AND <G3 privacy OK>
    AND <G4 not blocked> AND <G5 age OK>
  )
  OR
  -- Branch 2: cross-country discovery permitted
  (
    visibility = 'WORLDWIDE'
    AND <G1 published> AND <G2 moderation OK> AND <G3 privacy OK>
    AND <G4 not blocked> AND <G5 age OK>
    AND <G6 content-scope OK> AND <G7 relationship OK>
  )
)
```

Branches evaluate **the same safety stack** — the OR is between country-match and visibility-permits, never between safety-on and safety-off (owner safeguard 13.2 verbatim).

### 5.3 · Six scenarios · pass/fail outcomes

Full walkthroughs with exact SQL evaluation live in `nex-rls-policy-matrix-2026-10-31.md` §5. The expected outcomes:

| # | Scenario | Expected result |
|---|---|---|
| 1 | Irish user discovering an Indonesian seller's **WORLDWIDE** product with `international_sales_enabled=true` | ✅ visible, orderable |
| 2 | Irish user discovering an Indonesian seller's **COUNTRY** product | ❌ invisible (country branch denies, visibility branch denies) |
| 3 | Indonesian user viewing the same Indonesian seller | ✅ visible under country branch |
| 4 | Any user attempting to INSERT into `nex_business` with no `nex.app_country` set | ❌ denied (fail-closed) |
| 5 | HQ admin via service_role listing all businesses across both countries | ✅ bypasses RLS, gated at app level by `requireHqAdmin` |
| 6 | Irish user filing a moderation report on an Indonesian post | ✅ insert accepted; `country='ID'` set by server action; report never discoverable; reporter identity private; HQ queue receives it |

### 5.4 · Service-role safety

Service role bypasses RLS by design. The programme's safety on service role is:
- `requireHqAdmin(accountId)` at application level before any service-role call.
- HQ deployment is the only one with `NEX_SUPABASE_SERVICE_ROLE_KEY` set in environment variables.
- Ireland and Indonesia deployments do not have the service-role key; cannot bypass even if they wanted to.

### 5.5 · Connection-pool safety (new · owner CI-2)

`current_setting('nex.app_country')` is set using `SET LOCAL` inside a transaction, which is transaction-scoped and does not leak to the next transaction on the pooled connection. Each request opens a transaction, sets `nex.app_country`, performs its query, commits. If a request forgets to set it, the policy evaluates `current_setting('nex.app_country', true)` as `NULL`, both read branches fail-closed, no rows return.

Test: pool a request from the Ireland deployment, immediately pool a request from the Indonesia deployment reusing the same connection. Confirm the second request's `current_setting('nex.app_country')` resolves to `'ID'` (not leaked `'IE'` from the first). This test is in the migration 245 verification set.

### 5.6 · Pre-req gaps (five-migration reconciliation)

My RLS matrix doc (`nex-rls-policy-matrix-2026-10-31.md` §6) identified three safety features referenced by G-moderation, G-blocking, and G-age gates that do not yet exist in the schema:

- **moderation_status column** on the 8 visibility-receiving tables → referenced by G-moderation.
- **nex_account_block table** → referenced by G-blocking.
- **age-gate columns** on `nex_account` or on content tables → referenced by G-age.

Owner's decision preserves the five-migration order (244 → 246 → 247 → 245 → 248). To honour that boundary, I propose folding the gap schema into the existing migrations instead of creating 249/250/251:

| Gap | Fold into | How |
|---|---|---|
| `moderation_status content_moderation_status` enum column on the 8 visibility tables | **247** (same migration that creates the content enum) | Add `CREATE TYPE content_moderation_status AS ENUM ('ok','pending','holdback','taken_down')` and `ALTER TABLE … ADD COLUMN moderation_status content_moderation_status NOT NULL DEFAULT 'ok'` on the same 8 tables |
| Age-gate columns on `nex_account` (`primary_country` + `date_of_birth NULL` to start, `age_verified_at NULL`) | **246** (same migration that backfills country; account enrichment is already in scope here) | Add nullable columns; backfill `primary_country` with `'ID'` for existing accounts; `date_of_birth` and `age_verified_at` stay NULL until collected |
| `nex_account_block` table | **DEFER** — this is a NEW table, not a column change; blocking is not a shipped feature today. The RLS policy's G-blocking gate uses `TRUE` (a no-op) until this table exists | A future migration adds the table AND switches G-blocking to a real EXISTS check. Not part of this five-migration programme |

Net effect:
- The five-migration order is preserved (244 → 246 → 247 → 245 → 248).
- 246 and 247 absorb a small amount of extra scope (one extra enum type, one extra column type, a handful of ALTER TABLE statements, two new nullable columns on `nex_account`).
- G-blocking remains a stubbed `TRUE` until the block-table feature lands separately — this is honest and does not weaken any other gate.
- No 249/250/251 are drafted.

Owner acceptance target: approve folding, or authorise 249/250/251 as separate migrations.

---

## 6 · Technical debt

Per owner directive, TD-1 through TD-4 stay in `nex-technical-debt-workstream-2026-10-31.md` as a parallel programme. This review does **not**:
- Expand the country-isolation scope by including TD fixes.
- Mix TD fixes into the five-migration sequence.
- Touch any file involved in a TD cluster.

Typecheck filter remains per-session: when drafting migration SQL, the filter catches regressions in files that this programme touches; the 1,245 pre-existing errors in files this programme does not touch remain owned by the TD workstream.

---

## 7 · Hard boundaries honoured by this review

| Boundary | State |
|---|---|
| No production migration application | ✅ No migration applied |
| No push | ✅ All commits local (9 ahead of origin/main) |
| No deployment | ✅ No Vercel action |
| No destructive database change | ✅ No DDL applied |
| No changes to Chat Themes | ✅ CI-7 preserved |
| No changes to sealed design tokens | ✅ |
| No changes to HQ auth gate | ✅ |
| No country-specific application work | ✅ Ireland and Indonesia deployments not configured |
| All commits remain local | ✅ |

---

## 8 · Country desktop/tablet background images (doctrine reference only)

Owner provided two assets for the two country deployments. Registered here as doctrine references; not wired into application code at this stage.

| Country | Primary surface | File | Applies to |
|---|---|---|---|
| Ireland (IE) | Desktop + tablet background | `C:/Users/Victus/Downloads/NEX Irish Sunset Studio.png` (2,612,648 bytes) | Desktop + tablet orientations of the Ireland deployment |
| Indonesia (ID) | Desktop + tablet background | `C:/Users/Victus/Downloads/NEX Indonesian Sunset Studio.png` (2,811,164 bytes) | Desktop + tablet orientations of the Indonesia deployment |

**Boundary**: these images are not yet imported into the repo (`public/` tree) nor referenced from any component. Importing + wiring is a separate step that requires:
- Owner authorisation to add binaries to the repository (or to Supabase Storage).
- Decision on CDN/storage path.
- Decision on mobile orientation (do the images down-crop acceptably on phone, or is a separate mobile asset needed?).
- Decision on how the Ireland/Indonesia background is selected — purely from deployment-env `NEX_APP_IDENTITY=ireland|indonesia`, or settable per-user as a themeing choice.

Current status: paths captured. No binary moved. No code change. Ready to wire once the schema + RLS design is approved.

---

## 9 · Owner acceptance package

Return approve / modify / defer for each:

| # | Deliverable | Return |
|---|---|---|
| V-1 | 99-table review in §1 is correct and complete (not merely consistent with the prior doc) | approve / request-change |
| V-2 | 5 mixed-tables matrix in §2 (profession/vertical=R · banner=CO-I · report=CO subject-jurisdiction with no SELECT policy · chat themes=G untouched) | approve / modify |
| V-3 | Four-anchor explanation in §3 is correct (A nex_business, B nex_community_zone, C nex_live_session, D nex_report) | approve / add-anchor / remove-anchor |
| V-4 | Migration 244 revised DRAFT at 4-anchor scope (prepared in a separate commit — see Received Items) | approve / modify |
| V-5 | Migration dependency order in §4 (244 → 246 → 247 → 245 → 248) with the explicit reason 246 precedes 245 | approve / modify |
| V-6 | RLS summary in §5 and the full matrix doc are the authoritative policy design for owner inspection | approve / request-rewrite |
| V-7 | Fold `moderation_status` into 247 + fold age-gate columns into 246 + defer `nex_account_block` as a separate future migration — preserves owner's 5-migration order | approve / **authorise 249/250/251 as separate migrations instead** / defer blocking indefinitely |
| V-8 | Background images registered as doctrine references (no wiring yet) · wiring is a separate authorisation gate | approve / modify |
| V-9 | TD-1..TD-4 stay in `nex-technical-debt-workstream-2026-10-31.md` as a parallel programme | already acknowledged |

---

*Review package 2026-10-31 · Doctrine artefact · No code · No migration applied · No push. Awaiting V-1..V-9.*
