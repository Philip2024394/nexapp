# NEX Country Isolation Plan · 2026-10-31

**Status**: DRAFT · **PARTIALLY SUPERSEDED 2026-10-31 by** `nex-global-content-and-country-discovery-2026-10-31.md` + `nex-global-content-system-audit-2026-10-31.md`. The write-side country-lock stands. The hard-match read-side RLS is replaced by visibility-OR-country semantics. See the two superseding docs for the reconciled model. CI-1..CI-8 are REISSUED as CI-1..CI-12 at the end of the global content doctrine.
---
**Owner directive**: D-7 of `nex-two-apps-architecture-review-2026-10-31.md`.
**Hard safeguard (D-2 conditions)**: isolation must be REAL, not a country selector in the interface. A country column alone is NOT security.

This doc classifies every `public.nex_*` table (99 at time of writing), proposes RLS + storage + server-action enforcement, and lists the cross-country tests that must pass before Ireland or Indonesia goes live.

---

## 0 · Threat model

An authenticated user signed into the Ireland deployment must not be able to:
- Read a non-public record owned by Indonesia (private business data, private directory entries, private product metadata, private media)
- Create / update / delete any Indonesia-owned record
- Enumerate Indonesia-owned IDs even if the ID is guessable
- Learn metadata about Indonesia (counts, listings, filters) that would help build a map of the other country's user base

Public records (verified-business storefronts, published products, public music) MAY be visible cross-country · they are explicitly public and intended for discovery.

HQ admins bypass country gates via `service_role` after `requireHqAdmin()`. This is NOT elevation from a country app · HQ is a separate deployment.

**Attack vectors to close**:
1. Direct Supabase REST / RPC calls bypassing the client UI
2. Service-role tokens leaking from one deployment into another
3. Server actions that forget the country filter
4. Signed URLs minted in one country still readable from the other
5. Audit log / counter / aggregation tables leaking cross-country numbers
6. The `current_setting('nex.app_country')` NOT being set because a deployment forgot the per-request initialisation step → policy evaluates against NULL → may unexpectedly MATCH or MISS, depending on the policy's `IS` semantics. Policies must be written to fail-closed when the setting is NULL.

---

## 1 · Table classification · 99 tables

Legend:
- **GLOBAL** — one row, no country tag; readable/writable from any deployment subject to row-level ownership rules (owner id, etc.).
- **COUNTRY-OWNED** — must carry a `country text` column; RLS filters reads + writes to `current_setting('nex.app_country')`.
- **MIXED / NEEDS DECISION** — classification depends on an owner call.

### Identity (GLOBAL · one person · one account)

| Table | Why GLOBAL |
|---|---|
| `nex_account` | Users exist once · can roam. Primary country stored in a nullable `primary_country` column (owner decision below) but RLS does NOT gate account reads by country. |
| `nex_account_profile` | Same |
| `nex_account_custom_intro` | Same |
| `nex_account_device_key`, `nex_account_push_subscription`, `nex_webauthn_credential` | Devices · auth |
| `nex_account_notification_prefs`, `nex_account_relationship_prefs` | User preferences |
| `nex_account_risk_signal` | Platform-wide fraud signals |
| `nex_handle_counter` | Monotonic counter |
| `nex_session`, `nex_session_registry`, `nex_sign_in_event` | Auth session state |
| `nex_account_music_rights_ack` | Rights ack is a user action, not a country record |

### Business + Commerce (COUNTRY-OWNED)

| Table | Isolation strategy |
|---|---|
| `nex_business` | New `country` NOT NULL col · immutable after insert · RLS SELECT/INSERT/UPDATE/DELETE gated |
| `nex_product` | Inherits country from its business via FK trigger OR carries its own country col for query speed |
| `nex_product_ladder`, `nex_product_section`, `nex_product_variant`, `nex_product_share_grant` | Country via product join |
| `nex_order`, `nex_order_event`, `nex_cart`, `nex_liked_product`, `nex_buyer_tier_progress` | Buyer intent · country-owned |
| `nex_menu_item`, `nex_menu_section` | Food vertical · country-owned |
| `nex_service` | Service vertical · country-owned |
| `nex_affiliate_account`, `nex_affiliate_promotion` | Country of affiliate operation |
| `nex_banner` | Country-targeted ads/announcements |
| `nex_profession` | Profession dropdown is global reference data (REVISIT · see §MIXED below) |

### Live / Broadcasts (COUNTRY-OWNED)

All sealed Live tables inherit the broadcaster's country.

| Table | |
|---|---|
| `nex_live_session`, `nex_live_post`, `nex_live_participation`, `nex_live_engagement`, `nex_live_featured_product`, `nex_live_jail` | Broadcaster-anchored · country required |

### Community (COUNTRY-OWNED · already address-anchored)

Community notices + cards are 2km-radius address-anchored per sealed doctrine. Country derives from the address.

| Table | |
|---|---|
| `nex_community_card`, `nex_community_card_confirmation`, `nex_community_card_photo`, `nex_community_card_report`, `nex_community_card_update` | |
| `nex_community_business_welcome_detail`, `nex_community_lost_found_detail` | |
| `nex_community_notice`, `nex_community_notice_confirmation`, `nex_community_notice_report`, `nex_community_notice_update` | |
| `nex_community_membership`, `nex_community_rate_limit`, `nex_community_zone` | |

### Reports / Trust / Moderation (COUNTRY-OWNED)

Jurisdiction-sensitive. Takedown rules differ.

| Table | |
|---|---|
| `nex_report` | Country of the subject record · governs which legal regime applies |

### Content (GLOBAL · user-owned)

Owner-anchored content that follows the user, not the country.

| Table | Why GLOBAL |
|---|---|
| `nex_music_track`, `nex_music_publish_idempotency`, `nex_creator_active_music`, `nex_creator_support_settings` | Creator music is personal · a creator's library follows them |
| `nex_uploaded_video` | Owner-anchored personal video (though broadcasts land in `nex_live_*` which IS country-owned) |
| `nex_gallery_image` | REVISIT · if tied to a business it should be COUNTRY-OWNED |
| `nex_theme_emoji`, `nex_theme_sticker`, `nex_theme_view_counter`, `nex_theme_intro_seen` | Chat theme product · global commerce |
| `nex_chat_theme` | Sealed global commerce product · do not touch |

### Peer-to-peer messaging + calls (GLOBAL · cross-country allowed)

Explicitly: an Irish user CAN chat with an Indonesian user. The message is between two people, not a country record.

| Table | |
|---|---|
| `nex_conversation`, `nex_conversation_participant`, `nex_message` | |
| `nex_peer_conversation`, `nex_peer_message` | |
| `nex_call_link`, `nex_call_log`, `nex_group_call_participant`, `nex_group_call_session` | |
| `nex_friend_edge`, `nex_friend_request` | |

### Vault (GLOBAL · personal encrypted storage)

Per the sealed Vault doctrine · personal and account-anchored.

| Table | |
|---|---|
| `nex_vault_*` (all 8) | |

### Email / Marketing (GLOBAL · platform ops)

| Table | |
|---|---|
| `nex_email_campaign`, `nex_email_list`, `nex_email_send_log`, `nex_email_subscriber` | Platform-wide marketing |

### Operational (GLOBAL · platform infrastructure)

| Table | |
|---|---|
| `nex_migration_history`, `nex_surface_health_event`, `nex_collection_fetch_errors`, `nex_collection_url_queue`, `nex_welcome_outbox`, `nex_bridge99_first_send_intent`, `nex_color_palette`, `nex_vertical`, `nex_generated_site`, `nex_generation_job`, `nex_ledger_entry`, `nex_ledger_line` | |

### MIXED / NEEDS OWNER DECISION

| Table | Question |
|---|---|
| `nex_profession` | Global reference data (job list)? Or will the two countries have different vocabularies? Current state: appears global. Confirm. |
| `nex_vertical` | Business vertical taxonomy — same question |
| `nex_banner` | If country-specific marketing content → COUNTRY-OWNED. If platform-wide announcements → GLOBAL. |
| `nex_account.primary_country` | Add a nullable column so we can route users to their home deployment and know their market, without breaking cross-country chat. Default NULL → user hasn't declared, resolved from signup deployment. |
| Cross-country peer chat moderation | A UK user harasses an ID user. Which country handles the report? → carry a `reporting_country` field on `nex_report`. Legal has final say. |

**Totals**: ~60 GLOBAL · ~30 COUNTRY-OWNED · ~5 MIXED-needs-decision.

---

## 2 · RLS pattern

### Database setup (one-time)

```sql
-- Supabase: every connection sets its country at session start via
-- the custom session parameter. The deployment's server-side request
-- pipeline runs this BEFORE any query hits the business tables.
ALTER DATABASE postgres SET nex.app_country = '';  -- empty default
```

### Per-connection initialisation (deployment code)

Every request handler sets:

```sql
SELECT set_config('nex.app_country', $1, true);
-- $1 = 'IE' | 'ID' | '' (empty for HQ)
```

The `true` third arg means "transaction-local" — automatically cleared at commit. This prevents setting-leak between pooled connections.

### Standard RLS policy (template)

```sql
-- Example: nex_business
ALTER TABLE public.nex_business ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_business_country_select
  ON public.nex_business
  FOR SELECT
  TO authenticated
  USING (
    -- Fail-CLOSED on NULL setting. If the deployment forgot to set
    -- nex.app_country, the policy evaluates to NULL → denies.
    current_setting('nex.app_country', true) IS NOT NULL
    AND current_setting('nex.app_country', true) <> ''
    AND country = current_setting('nex.app_country', true)
  );

CREATE POLICY nex_business_country_insert
  ON public.nex_business
  FOR INSERT
  TO authenticated
  WITH CHECK (
    current_setting('nex.app_country', true) IS NOT NULL
    AND current_setting('nex.app_country', true) <> ''
    AND country = current_setting('nex.app_country', true)
  );

CREATE POLICY nex_business_country_update
  ON public.nex_business
  FOR UPDATE
  TO authenticated
  USING (country = current_setting('nex.app_country', true))
  WITH CHECK (country = current_setting('nex.app_country', true));

CREATE POLICY nex_business_country_delete
  ON public.nex_business
  FOR DELETE
  TO authenticated
  USING (country = current_setting('nex.app_country', true));

-- service_role bypasses RLS by default · HQ queries work unchanged
```

### Server-action defence-in-depth

Every server action that writes a COUNTRY-OWNED record MUST:

```ts
const country = resolveCountryForApp();      // from NEX_APP_COUNTRY env
if (!country) throw new Error("deployment missing NEX_APP_COUNTRY");

// Explicit · never trust the client payload for country
const row = { ...input, country };

// Pass the country to the admin client's SET before the write
await nexSupabaseAdmin.rpc('set_app_country', { country });
```

The `set_app_country` RPC wraps `set_config('nex.app_country', $1, true)` so the admin client (which uses pooled connections) still gets the setting enforced per-request.

### Public reads (cross-country) · explicit opt-in

Published / verified / shared_live content MAY be exposed cross-country via a dedicated policy that does NOT gate on country:

```sql
CREATE POLICY nex_business_public_discovery
  ON public.nex_business
  FOR SELECT
  TO authenticated
  USING (is_published = true AND visibility = 'public');
```

Public policies and country policies combine with OR (standard PG RLS). Private rows need both: `visibility='public' OR country=current_country`.

---

## 3 · Storage buckets

Four live buckets at time of writing:

| Bucket | Current scope | Country gate needed? |
|---|---|---|
| `nex-business-assets` | Public-read · business logos / QR codes / creator QR | **Yes** · country prefix in object key: `IE/{businessId}/...` vs `ID/{businessId}/...`. New RLS on storage.objects filters by prefix. |
| `nex-chat-theme-hero` | Public-read · chat theme marketplace | **No** · global commerce product |
| `nex-music-media` | Private · owner-only signed URLs | **No** · music is global · owner-scoped already |
| `nex-peer-chat-attachments` | Public-read · chat attachments | **No** · peer-to-peer messages are cross-country allowed |

Business asset migration path: when a business is created under deployment IE, uploads go to `nex-business-assets/IE/{businessId}/...`. For legacy objects (pre-split), add a one-time migration to prefix existing paths with the business's country column once migration 244 lands.

---

## 4 · API routes and server actions

Every route/action handling country-owned data must:
1. Resolve country from `resolveCountryForApp()` (env-driven · reject if NULL)
2. Set `nex.app_country` on the DB client for the request
3. Explicitly filter by country in queries (defence-in-depth; RLS is the primary gate)
4. Reject payload-supplied country fields (always derive server-side)

**HQ-only API routes** must:
1. Call `requireHqAdmin(session.account.id)` first
2. Use `service_role` client (bypasses RLS by design)
3. Explicitly scope queries by the country they're displaying (so an Indonesia dashboard doesn't accidentally render Ireland data)

---

## 5 · HQ administrative access

HQ runs under `NEX_APP_IDENTITY=hq`, has `NEX_APP_COUNTRY` unset, and uses the `service_role` key for queries. The RLS gate is explicitly bypassed by service_role (standard PG behaviour).

Every HQ server action:
```ts
await requireHqAdmin(session.account.id);  // throws on non-admin
const country = request.body.filter_country ?? null;  // allow filter
const query = nexSupabaseAdmin.from('nex_business').select('*');
if (country) query.eq('country', country);
```

HQ owner can explicitly filter by country to view a single deployment, or omit the filter for cross-deployment aggregates.

---

## 6 · Cross-country access tests (must pass before go-live)

### Test fixtures

- `nex-50001` Dewi Anggraini · signed up in Indonesia (`primary_country=ID`)
- `nex-50014` Hendra Gunawan · signed up in Indonesia (`primary_country=ID`)
- `nex-50012` Sari Permata · signed up in Indonesia
- `nex-99901` Sari Dewi (dev admin · nex_handle override)
- Create: `nex-ie-001` Mairead O'Reilly · signed up in Ireland (`primary_country=IE`) — needs seed
- Create: `biz-ie-001` an Irish business owned by Mairead · `country='IE'`
- Create: `biz-id-001` an Indonesian business owned by Dewi · `country='ID'`

### Required tests (automated · vitest)

| # | Test | Expected |
|---|---|---|
| 1 | Mairead signs in to NEX IE · reads `nex_business` · gets `biz-ie-001`, NOT `biz-id-001` | ✓ |
| 2 | Mairead signs in to NEX IE · tries to UPDATE `biz-id-001` directly via REST | ✗ RLS deny |
| 3 | Mairead signs in to NEX IE · tries to INSERT a business with `country='ID'` | ✗ RLS WITH CHECK fails |
| 4 | Dewi signs in to NEX ID · reads `nex_business` · gets `biz-id-001`, NOT `biz-ie-001` | ✓ |
| 5 | Mairead + Dewi exchange peer-chat messages across deployments | ✓ (peer chat is GLOBAL) |
| 6 | HQ admin reads `nex_business` with no country filter | gets both biz-ie-001 and biz-id-001 ✓ |
| 7 | HQ admin reads `nex_business` with `.eq('country','ID')` | gets biz-id-001 only ✓ |
| 8 | A new NEX IE deployment forgets to set `nex.app_country` · reads `nex_business` | ✗ All rows denied (fail-closed) |
| 9 | Mairead signs in to NEX IE · tries to fetch `nex-business-assets/ID/{businessId}/logo.png` via public URL | ✗ Storage RLS deny |
| 10 | Mairead signs in to NEX IE · tries to list objects in `nex-business-assets/ID/` prefix | ✗ Deny |
| 11 | HQ overview page counts (biz_count_ie, biz_count_id) match the actual DB totals per country | ✓ |
| 12 | A verified-public Indonesian business shows up on the IE discovery feed (if we expose cross-country discovery) | ✓ with public policy |

All 12 tests must pass before Ireland or Indonesia goes live. Tests live at `src/lib/nex-countries/__tests__/isolation.test.ts` (to be created).

---

## 7 · Migration + rollback strategy

### Proposed migrations (DRAFT · not applied)

| # | Purpose | Reversible? |
|---|---|---|
| 244 | Add `country text` nullable column to all COUNTRY-OWNED tables · no default · no backfill yet | Yes · DROP COLUMN |
| 245 | Backfill `country` for existing dev data · pick ID for existing dev rows (all current data created under dev-impersonation of Indonesian personas) | Yes · UPDATE back to NULL |
| 246 | Add `NOT NULL` + `CHECK (country IN ('IE','ID'))` constraints · requires 245 complete | Yes · drop constraints |
| 247 | RLS policies per the template in §2 · four per table (SELECT/INSERT/UPDATE/DELETE) · public-discovery policies added where applicable | Yes · DROP POLICY |
| 248 | Storage object RLS: country-prefix enforcement on `nex-business-assets` · migrate existing paths | **Semi-reversible** · existing paths get prefixed; rollback requires reverse rename |

Each migration applies independently with explicit owner authorisation. Order matters: 244 → 245 → 246 → 247 → 248.

### Rollback drill (owner-only)

1. Unset `NEX_APP_COUNTRY` on all deployments (serve nothing until next step)
2. Apply rollback of 247 (drop country-gated policies, keep base RLS)
3. Apply rollback of 246 (drop NOT NULL, drop CHECK)
4. Leave 244-245 in place (nullable column is harmless)

Rollback does NOT un-split data · businesses created in Ireland stay tagged `country='IE'`. The user-visible effect is: cross-country reads work again until a new 247 is drafted.

---

## 8 · Legal / compliance pointers (not scoped here)

Each country has its own regime. Engineering provides the data-isolation primitives; legal counsel defines the policies.

- **Ireland** · EU · GDPR (right to erasure · data portability · DPA notifications · 72h breach reporting)
- **Indonesia** · UU PDP 2022 · data localisation expectations · consent model differs
- **Takedown** · DMCA (US-anchored) vs IE/EU hosting notice-and-takedown vs UU ITE 11/2008 for ID content moderation
- **Age-of-consent** · 16 EU · 21 for marriage in ID (platform age gates are a separate decision)
- **Payments** · sealed hold "NEX never handles payments" means per-country QR / PayPal / provider lists only · no custody

A `docs/doctrine/nex-compliance-plan-{IE,ID}-2026-??-??.md` doc should be commissioned once this isolation plan is approved. Not scoped here.

---

## 9 · Owner decisions requested

| # | Decision |
|---|---|
| CI-1 | Approve the GLOBAL / COUNTRY-OWNED / MIXED classification in §1 (or request specific reclassifications) |
| CI-2 | Approve the fail-closed RLS pattern using `current_setting('nex.app_country')` with explicit NULL / empty check |
| CI-3 | Approve the storage-prefix approach for `nex-business-assets` (vs separate buckets per country) |
| CI-4 | Approve the five-migration sequence 244 → 248 as DRAFT · each needing separate authorisation to apply |
| CI-5 | Approve the 12 isolation tests as the minimum pass-fail bar before Ireland or Indonesia goes live |
| CI-6 | Add `primary_country` nullable column to `nex_account`? (default NULL · resolved at signup from the deployment the user came through) |
| CI-7 | Chat Themes stay GLOBAL (one marketplace across both countries)? Owner confirms sealed-commerce boundary unchanged. |
| CI-8 | Resolve the 5 MIXED tables (`nex_profession`, `nex_vertical`, `nex_banner`, moderation routing, chat theme boundary) |

---

## 10 · State at end of this doc

- **Nothing applied.** Migrations 244 → 248 remain DRAFT once drafted.
- **No deployment created.** Three Vercel projects remain a plan.
- **No code wired.** The world-resolver remains in its current (soon-superseded) DB-reading shape until decisions CI-1..CI-8 land.
- **All sealed holds intact.** Chat Themes, Vault, music system, directory spine, dev-impersonation, payments-never, universal keypad, design tokens — all untouched.

Owner's directive verbatim: *"Do not proceed beyond the approved doctrine and implementation planning until the country-isolation design and proposed migrations are presented for owner review."* Compliance confirmed.

---

*Doctrine drafted 2026-10-31 by Claude Code. Awaiting owner responses to CI-1..CI-8.*

---

## ADDENDUM · Owner decisions received 2026-10-31

All eight CI decisions have been returned by the owner. Summary:

| # | Owner's decision | Conditions attached |
|---|---|---|
| CI-1 | APPROVE WITH REVIEW | Must provide exact table names + ownership rationale + FK/inheritance implications before classification is final |
| CI-2 | APPROVE WITH CONDITIONS | Fail-closed · explicitly reject NULL/empty · verify connection-pool safety · prevent context leaking between requests · test every role path · no reliance on client-supplied country |
| CI-3 | APPROVE | Country prefixes inside `nex-business-assets` · storage policies must enforce prefix + validate user permissions · "a folder name by itself is not security" |
| CI-4 | APPROVE PROPOSAL ONLY | Each migration presented individually (purpose · tables · backfill · RLS · rollback · risks · verification) · each production apply requires separate authorisation |
| CI-5 | APPROVE | 12 isolation tests + MORE: storage isolation · service-role country checks · API/server-action isolation · HQ cross-country admin · connection-pool context isolation. All need actual test results before go-live. |
| CI-6 | APPROVE | Nullable `primary_country` on `nex_account` · user's selected primary country (not current location) · do not force onto existing accounts · distinct from app identity / current location / content origin / selected discovery country |
| CI-7 | APPROVE | Chat Themes remain GLOBAL · sealed engine untouched |
| CI-8 | REQUIRE TABLE-BY-TABLE | No blanket rule · each of `nex_profession` / `nex_vertical` / `nex_banner` / moderation routing / Chat Themes needs its own ownership model |

### Companion docs addressing the conditions

- **CI-1** · `nex-99-table-classification-2026-10-31.md` · exact 99-row table with FK inheritance
- **CI-8** · `nex-mixed-tables-resolution-2026-10-31.md` · explicit per-table decision for the 5 M-tables
- **CI-4** · `nex-migrations-244-to-248-individually-2026-10-31.md` · one section per migration (purpose · tables · backfill · RLS · rollback · risks · verification)
- **Technical debt** (owner-flagged separately) · `nex-technical-debt-workstream-2026-10-31.md` · 1,245 TS errors tracked as separate programme

### Reissued Migration 244 scope

The original 37-table scope is REDUCED to 4 anchor tables based on the FK audit:
1. `nex_business`
2. `nex_community_zone`
3. `nex_live_session`
4. `nex_report`

The other ~32 CO-I tables inherit country via FK join in their RLS policy (Migration 245) · no own column needed · simpler schema · faster writes.

### Correct migration apply order (not filename order)

244 → 246 → 247 → 245 → 248 · each with separate owner authorisation.

### What remains blocked

No application-level work on NEX Ireland / NEX Indonesia begins until:
- Owner acceptance of the 99-table classification (CI-1 condition met via the companion doc · needs final sign-off)
- Owner acceptance of the 5 M-tables resolution (CI-8 condition met via the companion doc · needs final sign-off)
- Owner authorisation to re-draft Migration 244 with the reduced 4-table scope
- Each subsequent migration (245 · 246 · 247 · 248) gets its own authorisation gate

All six prior commits (`1a1e552` through `6cfd996`) + this addendum commit remain **local only**. No push. No production apply.
