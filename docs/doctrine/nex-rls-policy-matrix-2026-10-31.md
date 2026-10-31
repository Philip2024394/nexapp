# NEX · RLS Policy Matrix + 6-Scenario Access Model · 2026-10-31

**Status**: DRAFT · the KEY deliverable owner specifically called out: *"The most important deliverable is not another summary. It is the exact table classification and RLS matrix. That will tell us whether the shared NEX platform can safely support Ireland and Indonesia without one country's private records leaking into the other."*
**Scope**: full matrix of country-owned tables × operations × policy templates, with safeguard-gate decomposition and 6 end-to-end access-model walkthroughs.
**Hard rule**: nothing in this doc applies to any database. Doctrine only.

---

## 0 · Reader orientation

The matrix is intentionally verbose. Each policy decomposes into named "safety gates" so the owner can inspect each gate independently. Where a gate's underlying column does not yet exist (e.g. `moderation_status` doesn't exist on `nex_business` today), the policy flags it as **PRE-REQ** and names the migration that must land first.

Columns in the matrix:
- **Table** · the target table
- **Op** · SELECT / INSERT / UPDATE / DELETE
- **Base rule** · the primary gate
- **Required AND-gates** · safeguards that must simultaneously pass
- **Pre-reqs** · columns/tables that must exist before this policy can be written

---

## 1 · The 7 safeguard gates (CI-2 decomposition)

Every SELECT policy on a visibility-bearing country-owned table ANDs these gates with the primary country-or-visibility branch:

| Gate | Signal | Columns / tables it reads |
|---|---|---|
| **G-published** | Record is in a published lifecycle state | `is_published`, `status`, `lifecycle_state` (table-dependent) |
| **G-moderation** | Record is not moderation-blocked | `moderation_status != 'blocked'` (PRE-REQ · column to be added) |
| **G-privacy** | Author's account is discoverable | JOIN `nex_account_profile.is_discoverable`, `profile_visibility` |
| **G-blocking** | Viewer is not blocked by author · author not blocked by viewer | PRE-REQ · `nex_account_block` table (not yet created) |
| **G-age** | Viewer meets any applicable age bar on the content | PRE-REQ · age column on content tables + `nex_account.date_of_birth` |
| **G-content-scope** | This content type supports this visibility scope at all | enum CHECK + per-table CHECK constraint |
| **G-relationship** | For FRIENDS/FOLLOWERS visibility, the required edge exists | JOIN `nex_friend_edge` · `nex_follow_edge` (CI-6 relationship table) |

**Not every table triggers all 7 gates.** Business discovery, for example, does not have an age bar. The matrix spells out which gates apply where.

---

## 2 · Policy template · SELECT (visibility-bearing table)

```sql
CREATE POLICY <tbl>_country_or_visibility_select
  ON public.<tbl>
  FOR SELECT
  TO authenticated
  USING (
    -- Base: NEVER evaluate anything if setting is missing (fail-closed)
    current_setting('nex.app_country', true) IS NOT NULL
    AND current_setting('nex.app_country', true) <> ''
    AND (
      -- Branch A · same-country match
      (
        country = current_setting('nex.app_country', true)
        AND <g-published>
        AND <g-moderation>
        AND <g-privacy>
        AND <g-blocking>
        AND <g-age-if-applicable>
      )
      OR
      -- Branch B · cross-country via visibility
      (
        <g-content-scope>  -- this type supports a cross-country scope
        AND visibility IN ('WORLDWIDE','SELECTED_COUNTRIES','FOLLOWERS','FRIENDS')
        AND <visibility-specific gate>
          -- WORLDWIDE          · always true
          -- SELECTED_COUNTRIES · current_setting('nex.app_country') = ANY(selected_countries)
          -- FOLLOWERS          · author's followers include viewer
          -- FRIENDS            · mutual-follow edge exists
        AND <g-published>
        AND <g-moderation>
        AND <g-privacy>
        AND <g-blocking>
        AND <g-age-if-applicable>
      )
    )
  );
```

**Both branches require the full safety stack.** The OR is between COUNTRY-MATCH and VISIBILITY-PERMITS. It is NOT between SAFETY-ON and SAFETY-OFF.

---

## 3 · Policy template · INSERT / UPDATE / DELETE (strict country-match · owner CI-2 "writes remain strict")

```sql
-- INSERT
CREATE POLICY <tbl>_country_insert
  ON public.<tbl>
  FOR INSERT
  TO authenticated
  WITH CHECK (
    current_setting('nex.app_country', true) IS NOT NULL
    AND current_setting('nex.app_country', true) <> ''
    AND country = current_setting('nex.app_country', true)
    AND <g-content-scope>              -- scope valid for this type
    AND <g-visibility-default-safe>    -- new rows can't be WORLDWIDE unless author opts in explicitly
  );

-- UPDATE
CREATE POLICY <tbl>_country_update
  ON public.<tbl>
  FOR UPDATE
  TO authenticated
  USING (
    current_setting('nex.app_country', true) = country
    AND <ownership-check: author = auth.uid-mapped-account OR HQ bypass>
  )
  WITH CHECK (
    country = current_setting('nex.app_country', true)
    -- Country column is IMMUTABLE through this gate.
    -- The pre-update country must equal the post-update country.
    AND <g-content-scope>
  );

-- DELETE
CREATE POLICY <tbl>_country_delete
  ON public.<tbl>
  FOR DELETE
  TO authenticated
  USING (
    current_setting('nex.app_country', true) = country
    AND <ownership-check>
  );
```

**Writes do NOT consult visibility.** Visibility is a read-side concept. INSERT/UPDATE/DELETE care only about `(country, ownership)`.

---

## 4 · The matrix · per-table / per-op

### 4.1 · `nex_business` (CO · owns `country` + `visibility` columns)

| Op | Policy | Gates | Pre-reqs |
|---|---|---|---|
| SELECT | country-or-visibility branches | published (new col) · moderation (new col) · privacy (join to profile) · blocking (new table) | migrations 244 · 247 · + separate moderation + blocking migrations |
| INSERT | strict country-match (write-side) + ownership (`owner_account_id = auth.uid-mapped`) | content-scope (visibility is one of 6 valid scopes) · default visibility=COUNTRY | 244 · 247 |
| UPDATE | strict country-match + ownership | country IMMUTABLE | 244 |
| DELETE | strict country-match + ownership | — | 244 |

**Current state problem (owner-flagged)**: `nex_business` RLS today is `USING (true)` (migration 002:71). This is replaced wholesale by the 4 policies above.

### 4.2 · `nex_product` (CO-I via business + three product-specific fields)

| Op | Policy | Gates | Pre-reqs |
|---|---|---|---|
| SELECT | branch A: `business.country = app_country` (JOIN) · branch B: `discovery_visibility` permits cross-country | published (`status='live'`) · moderation (new) · privacy (seller account) · blocking · age (where applicable) | 244 · 247 · moderation + blocking tables |
| INSERT | strict · the inserted product's business must have `country = app_country` | content-scope · default `discovery_visibility='COUNTRY'`, `international_sales_enabled=false`, `allowed_delivery_destinations='{}'` | 244 · 247 |
| UPDATE | strict · business.country match + seller is business owner | business_id IMMUTABLE through this gate | 244 |
| DELETE | strict · business.country match + seller is owner | — | 244 |

**Checkout gate** (separate · evaluated at order creation):
```sql
-- At CheckoutAction time, server runs:
SELECT 1 FROM public.nex_product p
JOIN public.nex_business b ON b.id = p.business_id
WHERE p.id = $product_id
  AND p.status = 'live'
  AND (
    p.discovery_visibility != 'PRIVATE'
    AND (
      b.country = $buyer_country                     -- domestic
      OR (p.international_sales_enabled = true
          AND $buyer_country = ANY(p.allowed_delivery_destinations))
    )
  );
```

Buyer sees product · buyer taps Buy · server returns `{ok:false, reason:"not-available-in-your-country"}` if the gate fails. UI shows honest copy.

### 4.3 · `nex_music_track` (GV · owns `visibility` · no country column)

Music follows the creator. The read gate uses visibility only (no country branch).

| Op | Policy | Gates | Pre-reqs |
|---|---|---|---|
| SELECT | branch A: owner-only (`owner_account_id = auth.uid-mapped`) · branch B: `visibility != 'PRIVATE'` AND relationship/visibility checks | published (not applicable — music tracks have no publication state separate from `visibility != 'PRIVATE'`) · moderation (NEW) · blocking · age (future NSFW tracks) | 247 · moderation + blocking |
| INSERT | owner-only (`owner_account_id = auth.uid-mapped`) · default `visibility='PRIVATE'` | content-scope · all 6 scopes valid for music | 247 |
| UPDATE | owner-only | — | — |
| DELETE | owner-only | — | — |

**No country column** — music is global. No `app_country` gate.

### 4.4 · `nex_uploaded_video` (GV · same shape as music track)

Identical pattern to §4.3. `visibility`-driven. No country column. Owner-anchored.

### 4.5 · `nex_live_session` (CO · owns `country` + `visibility`)

| Op | Policy | Gates | Pre-reqs |
|---|---|---|---|
| SELECT | country-or-visibility branches | status='open' (existing `status` column) · moderation (new) · broadcaster privacy · blocking · age (18+ streams) | 244 · 247 · moderation · blocking |
| INSERT | strict country-match + broadcaster is `broadcaster_account_id = auth.uid-mapped` | content-scope · default visibility=COUNTRY | 244 · 247 |
| UPDATE | strict + broadcaster | country + broadcaster IMMUTABLE | 244 |
| DELETE | strict + broadcaster | — | 244 |

### 4.6 · `nex_live_post` (CO-I via session · inherits visibility from session unless overridden)

| Op | Policy | Gates | Pre-reqs |
|---|---|---|---|
| SELECT | JOIN parent session · country branch via `session.country = app_country` · visibility branch via session + optional per-post override | matches §4.5 | 244 · 247 |
| INSERT | strict · session.country must match app_country · author is business owner (indirect) | content-scope | 244 |
| UPDATE | strict + ownership | session_id IMMUTABLE | 244 |
| DELETE | strict + ownership | — | 244 |

### 4.7 · `nex_community_zone` (CO · owns `country`)

| Op | Policy | Gates | Pre-reqs |
|---|---|---|---|
| SELECT | country-match (zones are not themselves "content" with visibility · they're geographic primitives) | — | 244 |
| INSERT | HQ-only (zones are administrator-defined) | — | 244 |
| UPDATE | HQ-only | — | 244 |
| DELETE | HQ-only | — | 244 |

**No visibility column on zone itself.** Zones are reference data at the geographic level · the visibility is on the content anchored to a zone.

### 4.8 · `nex_community_notice` + `nex_community_card` (CO-I via zone · own `visibility`)

| Op | Policy | Gates | Pre-reqs |
|---|---|---|---|
| SELECT | JOIN parent zone for country · visibility branch for cross-zone / cross-country | published · moderation · author privacy · blocking · age · zone-active | 244 · 247 · moderation · blocking |
| INSERT | strict · zone.country = app_country · author = `author_account_id` | content-scope · default visibility=COUNTRY | 244 · 247 |
| UPDATE | strict + author | zone_id + author IMMUTABLE | 244 |
| DELETE | strict + author | — | 244 |

### 4.9 · `nex_community_*` child tables (CO-I via parent)

All community child tables (confirmation, photo, report, update, business welcome detail, lost found detail, membership, rate limit) inherit country via FK and inherit visibility (where relevant) from parent.

Pattern: SELECT policy JOINs through to the parent notice/card. INSERT uses strict country-match via the parent lookup.

### 4.10 · `nex_report` (CO · own `country` set to SUBJECT'S country · owner CI-8)

| Op | Policy | Gates | Pre-reqs |
|---|---|---|---|
| SELECT | **country-match OR HQ reviewer** (HQ reviewers see all countries) | — | 244 |
| INSERT | writes allowed from any deployment · country is derived server-side from subject lookup | reporter identity · subject exists · one-report-per-reporter-per-subject-per-24h (sealed-ish rate limit) | 244 |
| UPDATE | HQ-reviewer only (reviewed_by must have hq_role) | status transitions | 244 · HQ role (migration 206 applied) |
| DELETE | HQ-admin only | — | 244 |

**Reporter is any country · subject's country drives jurisdiction · HQ sees everything.**

### 4.11 · `nex_order` + `nex_order_event` (CO-I via business · transactional · no visibility)

| Op | Policy | Gates | Pre-reqs |
|---|---|---|---|
| SELECT | `business.country = app_country` branch · PLUS `customer_account_id = auth.uid-mapped` (buyer sees own orders cross-country) | — | 244 |
| INSERT | strict · business.country = app_country AT ORDER-CREATION time · checkout gate from §4.2 enforced in server action | — | 244 |
| UPDATE | strict · business.country match + ownership (seller or HQ) | — | 244 |
| DELETE | HQ only (orders are financial records) | — | 244 |

Buyer sees their own orders regardless of their current country deployment — this is correct (an Irish buyer travelling in Indonesia can still see their Irish orders).

### 4.12 · `nex_message` + peer-chat tables (G · no country · no visibility column)

Peer chat is explicitly global per CI-7 confirmation. RLS unchanged:
- SELECT: participant check (viewer is in `nex_conversation_participant` for this message's conversation)
- INSERT: participant check
- UPDATE: author-only (edits)
- DELETE: author-only

No country gate. No visibility column. Owner-authored content viewable only by conversation participants.

### 4.13 · Tables that get ZERO country or visibility changes

91 tables per the classification doc. RLS stays whatever it is today. Of note:
- All `nex_vault_*` tables (sealed personal storage)
- All chat theme tables (sealed commerce product)
- `nex_profession`, `nex_vertical`, `nex_color_palette` (reference data · public read)
- `nex_migration_history` (platform metadata)
- Operational tables (`nex_collection_*`, `nex_surface_health_event`, etc.)

---

## 5 · The six access-model scenarios (owner-specified)

Each scenario shows: who's acting · the query · the policy branches evaluated · the expected result.

### Scenario 1 · IE user discovers ID creator's WORLDWIDE post

**Actor**: Mairead (IE user · logged into NEX Ireland deployment).
**Content**: `nex_music_track` row owned by Dewi (ID creator) · `visibility='WORLDWIDE'` · `moderation_status='clean'` · author account `is_discoverable=true` · Mairead not blocked by Dewi.

**Deployment sets `nex.app_country='IE'` per request.**

Query:
```sql
SELECT id, title, artist, cover_image_url
FROM public.nex_music_track
WHERE visibility != 'PRIVATE'
ORDER BY like_count DESC
LIMIT 20;
```

Policy evaluation (per §4.3 · music):
- Branch A (owner-only): `owner_account_id != Mairead.id` → **false** · skip
- Branch B (visibility):
  - `visibility != 'PRIVATE'` → true (WORLDWIDE)
  - content-scope: music supports WORLDWIDE → true
  - moderation_status != 'blocked' → true
  - Dewi's `is_discoverable=true` → true
  - Mairead not blocked by Dewi → true
  - age OK → true
- **Result: VISIBLE**

Expected: **row returned** ✓

### Scenario 2 · IE user tries to discover ID creator's COUNTRY-only post

**Actor**: Mairead (IE).
**Content**: Dewi's `nex_music_track` · `visibility='COUNTRY'` · other safety gates pass.

But music has NO country column (§4.3) · so what does `visibility='COUNTRY'` mean for music? It means "available to viewers in the same country as the author's `primary_country`". Enforcement: JOIN to `nex_account.primary_country` of the author.

Query: same as Scenario 1.

Policy:
- Branch A: skip (not owner)
- Branch B:
  - `visibility != 'PRIVATE'` → true
  - content-scope: music supports COUNTRY → true
  - visibility-specific gate: `author.primary_country = Mairead.app_country` → `'ID' = 'IE'` → **false**
- **Result: DENIED by visibility-specific gate**

Expected: **row NOT returned** ✓

### Scenario 3 · ID user tries to UPDATE an IE-owned business record

**Actor**: Dewi (ID · logged into NEX Indonesia deployment).
**Content**: An IE business owned by Mairead · `nex_business` row with `country='IE'`.

Dewi runs:
```sql
UPDATE public.nex_business
SET display_name = 'Taken over'
WHERE id = '<Mairead-business-id>';
```

Deployment sets `nex.app_country='ID'`.

Policy evaluation (per §4.1 · UPDATE):
- USING clause: `current_setting('nex.app_country') = country` → `'ID' = 'IE'` → **false**
- **Zero rows match the USING clause → zero rows updated**

Expected: **0 rows updated · no error** (standard RLS behaviour) ✓

### Scenario 4 · Worldwide product listing does not permit international checkout

**Actor**: Mairead (IE buyer).
**Content**: Indonesian product `nex_product` row · `discovery_visibility='WORLDWIDE'` · `international_sales_enabled=false` · `allowed_delivery_destinations='{ID}'`.

**Step 1 · Discovery query** (SELECT):
```sql
SELECT id, name, price_pence, cover_url FROM public.nex_product
WHERE discovery_visibility != 'PRIVATE' ORDER BY ...;
```
- Policy branch B (per §4.2) passes · `discovery_visibility='WORLDWIDE'` + safety gates ✓
- **Product visible in IE deployment** ✓

**Step 2 · Checkout attempt** (server action, not RLS):
```ts
const result = await checkoutAction({ productId, buyerCountry: 'IE' });
```
Server-side evaluation (per §4.2 checkout gate):
- `product.discovery_visibility != 'PRIVATE'` → true
- Buyer country ≠ product.business.country → true (IE ≠ ID)
- `product.international_sales_enabled=false` → **false** · FAIL
- **Return `{ok:false, reason:"international-sales-disabled"}`**

UI: product tile shows a disabled Buy button with "Not available for shipping to Ireland" copy.

Expected: **product visible · checkout blocked · honest reason displayed** ✓

### Scenario 5 · Blocked user cannot read blocker's otherwise-public content

**Actor**: Alice.
**Content**: Bob's `nex_music_track` · `visibility='WORLDWIDE'` · safety gates would normally pass.
**Pre-condition**: Bob has blocked Alice (row in `nex_account_block`).

Query: Alice runs the discovery query from Scenario 1.

Policy evaluation:
- Branch A: skip (not owner)
- Branch B:
  - visibility=WORLDWIDE → true
  - content-scope → true
  - moderation → true
  - privacy → true
  - **blocking: `EXISTS (SELECT 1 FROM nex_account_block WHERE blocker=Bob AND blocked=Alice) → true · gate FAILS**
- **Result: DENIED by blocking gate**

Expected: **row NOT returned even though visibility is WORLDWIDE** ✓

### Scenario 6 · Unpublished / moderation-restricted post cannot be discovered via WORLDWIDE flag

**Actor**: anyone.
**Content**: A `nex_business` row owner has set to `visibility='WORLDWIDE'` BUT `moderation_status='pending_review'` (just reported · under review).

Query: discovery query against businesses.

Policy evaluation:
- Branch A (country-match): say country matches → branch continues
  - `moderation_status != 'blocked'` → `'pending_review' != 'blocked'` → true · continues
  - But what about `pending_review` — is this treated as "restricted"? OWNER DECISION HERE.
- Branch B (cross-country via visibility=WORLDWIDE):
  - Same moderation evaluation

**Owner decision point**: should `moderation_status='pending_review'` block discovery, or does only `moderation_status='blocked'` block? Doctrine's current wording: "`NOT moderation_blocked`". **Narrow reading**: only `blocked` fails. **Wide reading**: anything other than `clean` fails.

**Recommended default** (safer): `moderation_status IN ('clean')` is the only state where discovery proceeds. `pending_review` fails · `blocked` fails · `withdrawn` fails.

Expected: **row NOT returned while moderation_status != 'clean' regardless of visibility value** ✓

Owner authorises either the narrow or wide reading for the Migration 247 column CHECK.

---

## 6 · The pre-req gaps (safeguards reference columns that don't exist yet)

Several safeguard gates reference columns + tables that haven't been drafted. The current migration sequence must EXPAND to cover these before 245 can safely apply.

| Pre-req | What it adds | Migration |
|---|---|---|
| `moderation_status` enum on content tables | 'clean', 'pending_review', 'blocked', 'withdrawn' + CHECK | **NEW · Migration 249** · after 247 |
| `nex_account_block` table | (blocker_account_id, blocked_account_id, created_at) | **NEW · Migration 250** · after 244 |
| Age-gate columns | `min_viewer_age int NULL` on music + video + live | **NEW · Migration 251** · optional · owner authorises per-type |
| `nex_follow_edge` (FOLLOWERS visibility scope) | already exists via `nex_friend_edge` + any sealed Follow architecture (see sealed memory) | verify sealed `nex_follow` tables are applied |

**Updated full migration sequence**:
1. 244 · country column on 4 anchors
2. 250 · blocking table (independent · can apply anytime after 206)
3. 246 · backfill 'ID' on existing rows
4. 247 · visibility enum + columns on 8 tables (+ discovery_visibility triple on nex_product)
5. 249 · moderation_status column on visibility-bearing tables
6. 251 · age-gate columns (owner-authorised per-type)
7. 245 · RLS policies · the big one · references everything above
8. 248 · storage prefix + storage.objects RLS

**No migration 245 can land until 249 + 250 are drafted and applied.** The safeguard gates reference columns that MUST exist first.

---

## 7 · Service-role bypass + HQ pattern (CI-2 safeguard · "test service-role")

- **service_role** bypasses RLS by Postgres default (RLS does not apply to service_role).
- HQ server actions use the `nexSupabaseAdmin` client (service_role token) AFTER calling `requireHqAdmin(session.account.id)` (migration 206 applied).
- Every HQ server action MUST independently re-verify admin role · page-level gating is defence-in-depth, not sufficient (sealed HQ doctrine).

**No path for a country-app server action to escalate to service_role.** The service_role key is scoped per deployment:
- Ireland deployment · service_role key · but every Ireland server action sets `nex.app_country='IE'` BEFORE queries, so even service-role writes are country-tagged
- HQ deployment · service_role key · does NOT set `nex.app_country` · intentional bypass for cross-country admin
- Indonesia deployment · service_role key · parallel to Ireland

**Connection pooling risk** (CI-2 safeguard · "test connection-pool behaviour"):

Supabase connections are pooled. `set_config('nex.app_country', $1, true)` uses the `is_local=true` flag which scopes the setting to the current TRANSACTION. On commit, the setting is cleared. On the next connection checkout, no stale country.

**Test**: issue 2 sequential requests from different deployments on the same pooled client. Second request's RLS evaluation uses the second deployment's country, never the first's. Verification via unit tests (CI-5 extension).

---

## 8 · Writes · the OWNER CI-2 "writes stay strict" invariant

Writes NEVER consult visibility. Writes NEVER accept a client-supplied country. The server action:

1. Reads `NEX_APP_COUNTRY` env (immutable per deployment)
2. Calls `set_config('nex.app_country', $country, true)` on the DB client
3. Prepares the write with `country = $country` explicitly stamped server-side
4. The RLS WITH CHECK clause additionally verifies `country = current_setting('nex.app_country')`

**Three layers**: env → explicit server stamp → RLS verification. A missing layer still blocks a bad write.

---

## 9 · Updated migration dependency graph

```
   206 (hq_role) ─────┐
                      │
    244 (country) ────┤
                      │
   250 (blocking) ────┤
                      │
    246 (backfill) ───┤
                      │
    247 (visibility) ─┤
                      │
    249 (moderation) ─┤
                      ├──► 245 (RLS policies)
                      │
    251 (age) ────────┤
                      │
                      └──► 248 (storage RLS)
```

245 is downstream of EVERYTHING. 248 is downstream of 245 (storage uses country + visibility already).

---

## 10 · Owner acceptance targets

Return approve / request change for:

| # | Decision |
|---|---|
| M-1 | Approve the 7-gate safeguard decomposition (section 1) |
| M-2 | Approve the SELECT template with both branches ALWAYS requiring all safety gates |
| M-3 | Approve the "narrow" reading of moderation (only `moderation_status='clean'` allows discovery) OR specify the exact allowed set |
| M-4 | Approve the 6 scenario walkthroughs as the pre-code acceptance tests |
| M-5 | Approve the EXPANDED migration sequence (now 8 migrations · 244 + 246 + 247 + 249 + 250 + 251 + 245 + 248) |
| M-6 | Approve the service-role / connection-pool model (§7) |
| M-7 | Authorise draft of Migrations 249 (moderation) + 250 (blocking) + 251 (age-gate) as separate design docs |

**No migration draft or apply until M-1..M-7 return.**

---

*RLS policy matrix recorded 2026-10-31 · satisfies owner's "the most important deliverable is not another summary". No code change · no migration applied · no production touched. Awaiting M-1..M-7 before any migration drafting resumes.*
