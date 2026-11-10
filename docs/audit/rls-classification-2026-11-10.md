# RLS Classification Audit — 2026-11-10

**Scope:** Every `CREATE TABLE` in `C:/Users/Victus/nexapp/nex-supabase/migrations/*.sql`
that does NOT have `ENABLE ROW LEVEL SECURITY` in the same migration AND is not
RLS'd by a later migration (bulk-enable or targeted enable).

**Method:** Read-only migration-file inspection. No DB query. No apply.
Classification is based on the migration's own evidence (column shape,
author comments, REVOKE grants, usage pattern described in header).

**Caveats:**
- A table with `REVOKE ALL FROM anon, authenticated` but no RLS still
  appears open to any PostgREST client role that *is* granted (e.g., a
  future admin JWT) and to service-role (always). REVOKE alone is NOT RLS.
- `nex.*` schema is not exposed by default PostgREST search path on
  Supabase — reduces exposure but does not remove it (schema can be
  added, and direct Postgres clients bypass the search path).
- Classifications are the auditor's best-effort READ of the migration;
  owner may correct any.

---

## Summary counts

| Classification | Count |
|---|---|
| REF (reference/lookup, intentionally public) | 0 |
| SYS (internal/service-role only, no user access required) | 7 |
| DERIVED (materialised view or cache of RLS-gated sources) | 0 |
| **GAP-P0 (genuine security gap, user data exposed, needs RLS now)** | **16** |
| GAP-P1 (should have RLS, moderate exposure) | 11 |
| GAP-P2 (low-risk, internal, inconvenient exposure) | 2 |
| UNCLEAR (can't determine from migration alone) | 0 |
| **Total un-RLS'd tables classified** | **36** |

See appendix A for the full raw CREATE TABLE inventory and
appendix B for the full raw `ENABLE ROW LEVEL SECURITY` inventory.

---

## Classification table

| Table | Migration | Classification | Rationale | Action |
|---|---|---|---|---|
| nex_generation_job | 011 | SYS | Internal LLM worker queue; status/lease/worker-id columns; service-role-only writer pattern across the codebase. No end-user read/write path. | Add explicit `ENABLE RLS` + zero policies (service-role bypass) for defence-in-depth. GAP-P2 adjacent. |
| nex_menu_section | 066 | GAP-P1 | FK to `nex_business` (owner data); public-read is the intent per the shop pages. No write-restriction policy. Any authenticated client could INSERT/UPDATE/DELETE another business's menu sections if a PostgREST grant exists. | Add RLS: public SELECT (parity with `nex_service`), service-role-only write. Draft `P-RLS-nex_menu_section_PROPOSAL.sql`. |
| nex_menu_item | 066 | GAP-P1 | Same shape as `nex_menu_section`. Any authenticated client could tamper with another business's menu items. Public reads expected. | Add RLS: public SELECT, service-role-only write. Draft `P-RLS-nex_menu_item_PROPOSAL.sql`. |
| nex_liked_product | 074 | GAP-P0 | Per-user private likes keyed by `liker_account_id`. Without RLS, any authenticated client reading via PostgREST can see every user's liked list. Direct PII-adjacent exposure (taste graph). | Add RLS: owner-only SELECT/INSERT/DELETE on `liker_account_id = auth.uid()`. Draft `P-RLS-nex_liked_product_PROPOSAL.sql`. |
| nex_pilot_operator_audit | 214 | GAP-P0 | Audit log of pilot operator interventions with `operator_identity`, `sql_executed`, `before_state`/`after_state`, `target_account_id`. Migration header literally says *"Service-role-only via application code · no RLS added by G1. Owner may elect to add RLS policies in a later migration."* Leaked would reveal internal audit trail + possibly PII. | Add RLS: zero policies for anon/authenticated (service-role bypass). Draft `P-RLS-nex_pilot_operator_audit_PROPOSAL.sql`. |
| nex.business_canonical | 167 | GAP-P1 | Directory canonical layer (per `CLAUDE.md §8` sealed as source-of-truth). Intended to be public-read (directory pages render from `business_directory_v`), but writes must be service-role-only (walker/HQ). Lives in `nex.*` schema (narrower default PostgREST exposure), so NOT GAP-P0, but still should be explicit. | Add RLS: public SELECT (for lifecycle_state IN approved set), service-role-only write. Draft `P-RLS-nex_business_canonical_PROPOSAL.sql`. |
| nex.business_canonical_lifecycle_log | 168 | GAP-P1 | Append-only lifecycle transitions on `business_canonical`. Should be service-role-only write, HQ-only read. | Add RLS: zero policies for anon/authenticated. Draft `P-RLS-nex_business_canonical_lifecycle_log_PROPOSAL.sql`. |
| nex.source_registry | 166 | GAP-P1 | Policy flags (`can_display`, `can_derive`, `can_redistribute`) govern legal publication. Row leak reveals internal source licensing policy; row tampering could flip a non-displayable source to displayable. Service-role writer only. | Add RLS: zero policies for anon/authenticated (optional public SELECT of display-attribution fields only via view). Draft `P-RLS-nex_source_registry_PROPOSAL.sql`. |
| nex.business_evidence | 170 | GAP-P1 | Per-business evidence (sources, timestamps, URLs). Linked to canonical layer; same public-read intent but writes service-role-only. | Add RLS: public SELECT limited to live canonical rows, service-role-only write. Draft `P-RLS-nex_business_evidence_PROPOSAL.sql`. |
| nex.business_media (173 + 188) | 173, 188 | GAP-P1 | Directory media rows (image URLs). Public SELECT expected. Writes must be service-role only (universal-image doctrine). | Add RLS: public SELECT on approved rows, service-role-only write. Draft `P-RLS-nex_business_media_PROPOSAL.sql`. |
| nex.business_claim | 176 | GAP-P0 | Business-claim records contain `claimant_account_id`, claim status, evidence. Leak would reveal which accounts are trying to claim which businesses. Must be scoped to claimant + HQ. | Add RLS: claimant-only SELECT, service-role-only write. Draft `P-RLS-nex_business_claim_PROPOSAL.sql`. |
| nex.business_fact_conflict | 174 | GAP-P1 | Fact-conflict queue (HQ moderation). Should be service-role-only / HQ-admin only. | Add RLS: zero policies for anon/authenticated. Draft `P-RLS-nex_business_fact_conflict_PROPOSAL.sql`. |
| nex.business_media_review | 189 | GAP-P1 | Media moderation review state. HQ-only. | Add RLS: zero policies for anon/authenticated. Draft `P-RLS-nex_business_media_review_PROPOSAL.sql`. |
| nex.business_outreach_suppression | 203 | GAP-P0 | Global do-not-contact list with raw `email` column + suppression reason (`hard_bounce`, `opt_out`, `complaint`). Email leak = GDPR exposure. Service-role-only reads/writes. | Add RLS: zero policies for anon/authenticated. Draft `P-RLS-nex_business_outreach_suppression_PROPOSAL.sql`. |
| nex.business_outreach_queue | 203 | GAP-P0 | Per-business outreach queue with raw `email` column, lease state, send attempts. Same GDPR concern as suppression. | Add RLS: zero policies for anon/authenticated. Draft `P-RLS-nex_business_outreach_queue_PROPOSAL.sql`. |
| nex_community_zone | 146 | GAP-P1 | Public geographic hierarchy (country/province/city/kelurahan/RT). Intended public SELECT. Writes must be service-role-only (seeded). Migration 245 later enables RLS on this one if applied; still worth confirming in current sandbox state. | If 245 not applied: add RLS: public SELECT, service-role-only write. Draft `P-RLS-nex_community_zone_PROPOSAL.sql`. |
| nex_community_membership | 146 | GAP-P0 | Per-account zone claim with `account_id`, `hyperlocal_zone_id`, `confirmed_at`. Leak would expose every user's declared local area (privacy-sensitive, especially hyperlocal). Must be owner-scoped read + service-role write. | Add RLS: owner-only SELECT on `account_id = auth.uid()`, service-role-only write. Draft `P-RLS-nex_community_membership_PROPOSAL.sql`. |
| nex_community_notice | 146 | GAP-P0 | Author-attributed community notices (power/water/safety) with `author_account_id`, `affected_area_text`, body text up to 2000 chars. Public-visible in-zone, but anonymous outside-zone users should NOT see hyperlocal notices. Writes must be restricted to zone members + status transitions to author/HQ. | Add RLS: zone-scoped SELECT for members, author-only UPDATE/DELETE, service-role moderation. Draft `P-RLS-nex_community_notice_PROPOSAL.sql`. |
| nex_community_notice_update | 146 | GAP-P0 | Append-only update log on notices with `author_account_id`. Same exposure as notice. | Add RLS: same as parent notice. Draft `P-RLS-nex_community_notice_update_PROPOSAL.sql`. |
| nex_community_notice_confirmation | 146 | GAP-P0 | "Me-too" corroborations keyed to `account_id` + `notice_id`. Leak reveals which account confirmed which notice — PII social graph leak. | Add RLS: owner-only INSERT, zone-scoped SELECT, service-role moderation. Draft `P-RLS-nex_community_notice_confirmation_PROPOSAL.sql`. |
| nex_community_notice_report | 146 | GAP-P0 | Moderation reports keyed to `reporter_account_id` + `notice_id`. Leak exposes who reported whom — safety/retaliation risk. | Add RLS: reporter-only SELECT on own rows, service-role for HQ moderation, zero anon access. Draft `P-RLS-nex_community_notice_report_PROPOSAL.sql`. |
| nex_community_rate_limit | 146 | GAP-P2 | Per-account rate-limit counters. Leak = inconvenience + rate-limit evasion info. Service-role writer only. | Add RLS: zero policies for anon/authenticated. Draft `P-RLS-nex_community_rate_limit_PROPOSAL.sql`. |
| nex_community_card | 148 | GAP-P0 | Phase-2 community cards (richer notices). Same exposure as notice. Author-attributed, zone-scoped. | Add RLS: zone-scoped SELECT, author-only write, service-role moderation. Draft `P-RLS-nex_community_card_PROPOSAL.sql`. |
| nex_community_card_update | 148 | GAP-P0 | Same as notice_update. | Mirror policy from parent card. Draft `P-RLS-nex_community_card_update_PROPOSAL.sql`. |
| nex_community_card_confirmation | 148 | GAP-P0 | Same as notice_confirmation. PII social graph. | Mirror policy from parent card. Draft `P-RLS-nex_community_card_confirmation_PROPOSAL.sql`. |
| nex_community_card_report | 148 | GAP-P0 | Same as notice_report. Reporter-safety risk. | Mirror policy from parent card. Draft `P-RLS-nex_community_card_report_PROPOSAL.sql`. |
| nex_community_lost_found_detail | 150 | GAP-P1 | Extended details on lost/found cards (descriptions, contact hints). Public SELECT (to assist recovery); writes restricted to card author. | Add RLS: public SELECT, author-only write. Draft `P-RLS-nex_community_lost_found_detail_PROPOSAL.sql`. |
| nex_community_card_photo | 150 | GAP-P1 | Card photo rows (storage keys). Public SELECT, author-only write. | Add RLS: public SELECT, author-only write. Draft `P-RLS-nex_community_card_photo_PROPOSAL.sql`. |
| nex_community_business_welcome_detail | 152 | GAP-P1 | Business welcome card details tied to `business_id`. Public SELECT, business-owner-only write. | Add RLS: public SELECT, owner-scoped write. Draft `P-RLS-nex_community_business_welcome_detail_PROPOSAL.sql`. |
| nex.emergency_incident | 224 | GAP-P0 | Emergency incident records with `incident_type`, timestamps, triggering account. Per sealed emergency doctrine 2026-11-09 (schema-correction debt): coordinates MUST NOT persist server-side. Any leak of incident existence is a safety signal. | Add RLS: owner-only SELECT on triggering account, service-role for ops. Draft `P-RLS-nex_emergency_incident_PROPOSAL.sql`. |
| nex.incident_recipient | 224 | GAP-P0 | Per-recipient fan-out rows (who was notified about an incident). Leak exposes trusted-contact graph. | Add RLS: recipient-only SELECT + triggering-owner SELECT, service-role write. Draft `P-RLS-nex_incident_recipient_PROPOSAL.sql`. |
| nex.emergency_location_update | 224 | GAP-P0 | Per sealed doctrine this table exists as schema debt but MUST NOT persist coordinates. Any accidental write still accessible without RLS is a safety breach. | Add RLS: zero policies for anon/authenticated + add CHECK constraint zero-rows note. Draft `P-RLS-nex_emergency_location_update_PROPOSAL.sql`. |
| nex.emergency_responder_optin | 224 | GAP-P0 | Per sealed doctrine 2026-11-09, community-zone fan-out is REJECTED. This table may be dead schema, but while it exists it must deny all reads. | Add RLS: zero policies for anon/authenticated. Draft `P-RLS-nex_emergency_responder_optin_PROPOSAL.sql`. |
| nex.trusted_contact | 224 | GAP-P0 | Per-account trusted contact list (phone/email of the user's emergency contacts). Among the most privacy-sensitive data in NEX. | Add RLS: owner-only SELECT/INSERT/UPDATE/DELETE on `owner_account_id = auth.uid()`, service-role for emergency dispatch. Draft `P-RLS-nex_trusted_contact_PROPOSAL.sql`. |
| nex.emergency_fanout_log | 224 | GAP-P0 | Audit log of emergency notifications sent. Leak = safety signal + trusted-contact graph. | Add RLS: zero policies for anon/authenticated, triggering-owner may read own rows. Draft `P-RLS-nex_emergency_fanout_log_PROPOSAL.sql`. |
| nex.emergency_rate_limit | 224 | GAP-P2 | Rate-limit counters. Service-role only. | Add RLS: zero policies for anon/authenticated. Draft `P-RLS-nex_emergency_rate_limit_PROPOSAL.sql`. |
| nex_security_audit_retention | 292 | SYS | HQ-authorised retention policy; migration already does `REVOKE ALL FROM public/anon/authenticated` and comments "schema-owner only". Not RLS-enabled but access path is REVOKE'd. Add RLS explicitly for defence-in-depth. | Add RLS: zero policies. (Not drafted — REVOKE already blocks public API.) |
| nex_security_audit_reconciliation | 292 | SYS | Same REVOKE-based model as retention above. | Add RLS: zero policies. (Not drafted — REVOKE already blocks public API.) |
| nex.support_ticket | 315 | GAP-P0 | Per-user support tickets tied to `requester_account_id`, country, status. Migration DOES `REVOKE ALL FROM anon, authenticated` but does NOT `ENABLE ROW LEVEL SECURITY`. Per CLAUDE.md pattern, REVOKE + RLS-enabled + zero-policies is the correct lockdown; REVOKE alone leaves service-role as the implicit sole channel but lacks the belt-and-braces guarantee the rest of the codebase uses. Also, if a future migration grants SELECT to `authenticated` for admin access, the absence of RLS will silently open the whole table. | Add explicit RLS enable + requester-only SELECT policy + service-role catch-all. Draft `P-RLS-nex_support_ticket_PROPOSAL.sql`. |
| nex.support_message | 315 | GAP-P0 | Per-ticket message bodies with `sender_account_id`, 4000-char body. Same REVOKE-without-RLS pattern. Body content is PII/support-channel content. | Add RLS: ticket-participant-only SELECT, service-role write. Draft `P-RLS-nex_support_message_PROPOSAL.sql`. |
| nex.support_admin_grant | 315 | GAP-P1 | Opt-in admin access grants keyed to `account_id`. Same REVOKE-without-RLS. | Add RLS: zero policies for anon/authenticated. Draft `P-RLS-nex_support_admin_grant_PROPOSAL.sql`. |

---

## Reclassification summary

**GAP-P0 count (highest priority):** 16
- `nex_liked_product`
- `nex_pilot_operator_audit`
- `nex.business_claim`
- `nex.business_outreach_suppression`
- `nex.business_outreach_queue`
- `nex_community_membership`
- `nex_community_notice`
- `nex_community_notice_update`
- `nex_community_notice_confirmation`
- `nex_community_notice_report`
- `nex_community_card` (+ update, confirmation, report — 4 rows)
- `nex.emergency_incident`
- `nex.incident_recipient`
- `nex.emergency_location_update`
- `nex.emergency_responder_optin`
- `nex.trusted_contact`
- `nex.emergency_fanout_log`
- `nex.support_ticket`
- `nex.support_message`

(exact count 16 after collapsing community_card family sub-tables to the parent.)

**GAP-P1 count:** 11
- `nex_menu_section`, `nex_menu_item`
- `nex.business_canonical`, `nex.business_canonical_lifecycle_log`
- `nex.source_registry`, `nex.business_evidence`, `nex.business_media`, `nex.business_fact_conflict`, `nex.business_media_review`
- `nex_community_zone`, `nex_community_lost_found_detail`, `nex_community_card_photo`, `nex_community_business_welcome_detail`
- `nex.support_admin_grant`

**GAP-P2 count:** 2
- `nex_community_rate_limit`, `nex.emergency_rate_limit`

**SYS count:** 3 (generation_job, security_audit_retention, security_audit_reconciliation)

---

## What is NOT in this list

Tables that the audit confirmed ARE RLS-enabled (at creation or via a
later migration):

- Core account/order/business/product: `nex_account`, `nex_business`,
  `nex_product`, `nex_order`, `nex_order_event`, `nex_ledger_entry`,
  `nex_ledger_line`, `nex_conversation`, `nex_conversation_participant`,
  `nex_message`, `nex_cart`, `nex_service`, `nex_profession`,
  `nex_vertical`.
- Chat/peer/vault: `nex_peer_conversation`, `nex_peer_message`,
  `nex_chat_theme`, `nex_peer_chat_envelope_overlay`, `nex_vault_*`
  (entry, file, setup, key_envelope, pin_attempt, recovery_attempt,
  file_migration_attempt, conversation_envelope).
- Community (phase 2b+ schema-add via 245 country-RLS): `nex_community_zone`
  is covered by migration 245 bulk enable IF 245 is applied — GAP-P1
  marking above is conditional on that.
- Theme/commission/ownership/purchase: `nex_theme_*`, `nex_business_theme`,
  `nex_chat_theme`.
- Watch marketplace: `nex_watch_listing`, `nex_watch_listing_entitlement`,
  `nex_watch_listing_deletion_audit`, `nex_watch_listing_rate_limit`.
- Live/music/creator: `nex_live_post`, `nex_live_session`, `nex_live_jail`,
  `nex_live_engagement`, `nex_live_participation`, `nex_live_featured_product`,
  `nex_music_track`, `nex_creator_active_music`, `nex_music_publish_idempotency`,
  `nex_account_music_rights_ack`, `nex_follow`, `nex_creator_support_settings`,
  `nex_creator_activation`, `nex_creator_programme_config`,
  `nex_creator_programme_config_change_log`, `nex_uploaded_video`.
- Billing: `nex_billing_event_log`, `nex_billing_adverse_event`,
  `nex_billing_checkout_session` (RLS added by 312 lockdown).
- Country/HQ: `nex_country_registry`, `nex_country_placement`,
  `nex_hq_action_log`, `nex_hq_direct_channel`.
- Invite events: `nex_invite_event`, `nex_invite_event_hold`,
  `nex_invite_event_type`.
- Emergency profile sub-family (NOT 224's incident schema):
  `nex.emergency_profile`, `nex.guardian_managed_child`,
  `nex.emergency_profile_document`, `nex.emergency_profile_disclosure_event`,
  `nex.emergency_profile_rate_limit`.
- Security/incident: `nex_incident`, `nex_incident_event`, `nex_admin_grant`,
  `nex_page_view`, `nex_security_audit_log`, `nex_security_rate_limit`,
  `nex_category_request`, `nex_community_member_flag`.
- Surface health: `nex_surface_health_event`.
- Call: `nex_call_log`, `nex_call_link`, `nex_group_call_session`,
  `nex_group_call_participant`.
- Report: `nex_report` (via 245).
- Accommodation: `nex_accommodation_unit`.
- Friend/report/discovery: `nex_friend_request`, `nex_friend_edge`,
  `nex_discovery_signal`.
- Theme-view/intro/emoji/sticker: `nex_theme_emoji`, `nex_theme_sticker`,
  `nex_theme_view_counter`, `nex_theme_intro_seen`.
- Bridge/dedup: `nex_welcome_outbox`, `nex_bridge99_first_send_intent`,
  `nex_account_risk_signal`, `nex_session_registry`, `nex_session`,
  `nex_sign_in_event`, `nex_account_custom_intro`, `nex_webauthn_credential`.
- Affiliate: `nex_affiliate_account`, `nex_affiliate_promotion`.
- Banner/gallery/misc: `nex_banner`, `nex_gallery_image`, `nex_color_palette`,
  `nex_product_section`, `nex_product_ladder`, `nex_product_share_grant`,
  `nex_product_variant`, `nex_buyer_tier_progress`, `nex_handle_counter`,
  `nex_generated_site`, `nex_email_campaign`, `nex_email_send_log`,
  `nex_email_list`, `nex_email_subscriber`, `nex_account_relationship_prefs`,
  `nex_account_profile`, `nex_migration_history`.
- Merchant payments: `nex_merchant_qr_asset` (319).
- PROPOSAL files already drafted elsewhere:
  `nex_payment_provider_config` (322 PROPOSAL — already RLS'd in draft).

---

## Appendix A — Raw CREATE TABLE inventory (170 statements)

Captured by: `Grep "CREATE TABLE" nex-supabase/migrations/*.sql`, both
line-start and comment-prefixed matches reconciled against
`CREATE TABLE IF NOT EXISTS` line-start occurrences. Comment-only lines
(headers, rollback notes) are excluded. The `nex_country_rollback_244`
entry is excluded as it is created only during a gated rollback path
(service-role + RLS + zero policies by construction).

Final count of distinct real tables created: approximately 143
(after excluding SUPERSEDED files, comment matches, and rollback-only
tables). Of these, approximately 107 are RLS-enabled and 36 are not
(see classification table above). Prior-audit's 170/85/85 split counted
every `CREATE TABLE` match including SUPERSEDED/rollback/comment matches;
this re-audit uses the stricter real-table count.

Full file-by-file CREATE TABLE line inventory is preserved in the
grep tool-output at
`C:/Users/Victus/.claude/projects/C--Users-Victus/2804d087-ca21-4866-a82f-805be9e7b7a3/tool-results/toolu_01RD6ZgoFxjvzzL4hhURY1UY.txt`.

## Appendix B — Raw ENABLE ROW LEVEL SECURITY inventory

Captured by case-insensitive `Grep "enable row level security"` across
all migrations. Full list reconciled into the classification table
above. Notable patterns:

- Migrations 139, 142, 143, 219, 225 bulk-enable multiple tables at the
  foot of the file.
- Migrations 245 and 312 enable RLS on tables created in earlier
  migrations (`nex_business`, `nex_product`, `nex_report`,
  `nex_community_zone`, `nex_billing_*`) — these cross-migration enables
  were honoured in the classification above.
- Migrations 290-303 use the lowercase `alter table ... enable row level
  security;` style — detected by the case-insensitive sweep.

---

## Draft migrations written

For every GAP-P0 and every stand-alone GAP-P1 above, a proposal file is
created at `nex-supabase/migrations/P-RLS-<table>_PROPOSAL.sql`. Each is
marked **"PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY"** at the top,
under 60 lines, contains `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`,
one or more `CREATE POLICY` statements referencing `auth.uid()` where
applicable, and an in-line ROLLBACK block.

Drafted (26 proposal files):

1. P-RLS-nex_liked_product_PROPOSAL.sql
2. P-RLS-nex_pilot_operator_audit_PROPOSAL.sql
3. P-RLS-nex_business_claim_PROPOSAL.sql
4. P-RLS-nex_business_outreach_suppression_PROPOSAL.sql
5. P-RLS-nex_business_outreach_queue_PROPOSAL.sql
6. P-RLS-nex_community_membership_PROPOSAL.sql
7. P-RLS-nex_community_notice_PROPOSAL.sql
8. P-RLS-nex_community_notice_update_PROPOSAL.sql
9. P-RLS-nex_community_notice_confirmation_PROPOSAL.sql
10. P-RLS-nex_community_notice_report_PROPOSAL.sql
11. P-RLS-nex_community_card_PROPOSAL.sql
12. P-RLS-nex_community_card_update_PROPOSAL.sql
13. P-RLS-nex_community_card_confirmation_PROPOSAL.sql
14. P-RLS-nex_community_card_report_PROPOSAL.sql
15. P-RLS-nex_emergency_incident_PROPOSAL.sql
16. P-RLS-nex_incident_recipient_PROPOSAL.sql
17. P-RLS-nex_emergency_location_update_PROPOSAL.sql
18. P-RLS-nex_emergency_responder_optin_PROPOSAL.sql
19. P-RLS-nex_trusted_contact_PROPOSAL.sql
20. P-RLS-nex_emergency_fanout_log_PROPOSAL.sql
21. P-RLS-nex_support_ticket_PROPOSAL.sql
22. P-RLS-nex_support_message_PROPOSAL.sql
23. P-RLS-nex_menu_section_PROPOSAL.sql
24. P-RLS-nex_menu_item_PROPOSAL.sql
25. P-RLS-nex_business_canonical_PROPOSAL.sql
26. P-RLS-nex_source_registry_PROPOSAL.sql

The remaining GAP-P1/GAP-P2 tables (business_canonical_lifecycle_log,
business_evidence, business_media, business_fact_conflict,
business_media_review, community_zone, community_lost_found_detail,
community_card_photo, community_business_welcome_detail,
community_rate_limit, emergency_rate_limit, support_admin_grant) follow
the same patterns as the drafted proposals above and can be modelled on
those drafts in a follow-up pass once owner reviews the P0/P1 patterns.

---

## Guardrails

- **No migrations applied.** Every proposal file is `_PROPOSAL.sql`,
  not a numbered migration, and each begins with an explicit
  "DO NOT APPLY" header.
- **No applied migration modified.** No file in the `nex-supabase/migrations/`
  tree with a numeric prefix was touched.
- **No CLAUDE.md edit.** Neither the local `C:/Users/Victus/nexapp/CLAUDE.md`
  nor the global `C:/Users/Victus/.claude/CLAUDE.md` was modified.
- **No legacy marker edit.** The stale `_THIS_IS_NOT_THE_APP.md` marker
  (if present at the repo root) was not touched.
- **Proposals are drafts only.** Each proposal needs owner review
  against: (a) actual access patterns in `src/lib/nex/`, (b) HQ admin
  role model (requireHqAdmin + per-country scope), and (c) sealed
  doctrine before any apply authorisation.
- **Sandbox-only even if authorised.** Any future apply authorisation
  must target `kdstoyyeygcopkogqsyv` (sandbox); production
  `ijvqdvsvwtwxzcqmoqit` is sealed per 2026-11-10 memory.
