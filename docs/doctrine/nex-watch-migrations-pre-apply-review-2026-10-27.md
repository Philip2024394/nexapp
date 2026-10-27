# NEX Watch-Listing Migrations · Supabase Pre-Apply Review · 2026-10-27

> Candidate A prep · founder-authorised 2026-10-27 · Read-only review · Classification per Protocol §6: **researched** (not approved, not implemented, not applied).
>
> Produced by 1 read-only Explore subagent. No DB queries ran. SQL + repo code inspection only.

## Context
- **Target**: Supabase project `ijvqdvsvwtwxzcqmoqit` (NEX production)
- **Current state**: migrations 227–233 authored + applied to **LOCAL** `nex_dev` @ `localhost:5433` only
- **Authorisation**: NOT given to apply to Supabase. This review surfaces risks + required decisions BEFORE the apply.
- **Scope**: 7 migrations introducing watch-listing v1 schema + directory projection v2

---

## Migration summary table

| # | File | Purpose | Objects created | Destructive ops | RLS | Risk |
|---|---|---|---|---|---|---|
| 227 | `nex_watch_listing` | Watch listing table · sibling to nex_product | 1 table + 5 indexes + 1 trigger fn + 4 RLS policies | none | yes | low |
| 228 | `nex_watch_listing_entitlement` | Entitlement ledger · Rp 30K per 30-days audit trail | 1 table + 4 indexes + 1 RLS policy | none | yes | low |
| 229 | `watch_listing_directory_v` | Option Y view · eligible paid listings projection | 1 view + 2 GRANTs | none | inherited | low |
| 230 | `nex_watch_listing_search_tsv` | Full-text search · tsvector + GIN index | 1 column + 1 GIN index | none | no | medium (lock duration) |
| 231 | `nex_watch_listing_deletion_audit` | R3 retention audit log · right-to-erasure compliance | 1 table + 3 indexes + 1 RLS policy | none | yes | low |
| 232 | `nex_watch_listing_rate_limit` | R5 rate limit · DB-backed atomic increment | 1 table + 2 indexes + 1 SECURITY DEFINER fn + REVOKEs | none | inherited | low |
| 233 | `nex_live_post_directory_v` | G3 amendment · eligible paid live posts projection | 1 view + 1 GRANT | none | inherited | low |

**No migration contains destructive operations** · all are additive (CREATE TABLE / CREATE VIEW / CREATE INDEX / CREATE FUNCTION / CREATE POLICY).

---

## Per-migration deep review

### 227 · nex_watch_listing

**Summary**: Authoritative persistence layer for individually-sold watch listings. Sibling to `nex_product` (NOT modified).

**Objects created**:
- `nex_watch_listing` table (53 columns)
  - Core: id, owner_account_id (NOT NULL, FK nex_account), business_id (NULL, FK nex_business)
  - Lifecycle: status (draft|published|expired|removed), entitlement_expires_at, published_at, removed_at
  - Pricing: price_pence, currency, pricing_mode (chat|price_only|shop_product|auction)
  - Watch spec: 35 columns (brand, model_name, condition, movement, etc.)
  - Media: video_url, cover_image_url, gallery_image_urls
  - Timestamps: created_at, updated_at (DEFAULT now())
- **Indexes (5)**: owner, business, published_window (hot path for 229 view), retention, brand_model
- **Trigger function**: `nex_watch_listing_touch_updated_at()` · BEFORE UPDATE
- **RLS policies (4)**:
  - public SELECT · anon + authenticated · only where status='published' AND entitlement_expires_at > now()
  - owner SELECT all · authenticated owner
  - owner INSERT · authenticated · identity + business ownership checks
  - owner UPDATE · same checks
  - DELETE · service-role only (no authenticated policy)

**Dependencies**: nex_account (001), nex_business (002), nex_current_account_ids() + nex_current_owned_business_ids() from 010, migration 217 search_path hardening.

**Constraints**: 6 (status enum, pricing_mode enum, price validity, published preconditions, removed preconditions, description ≤ 1000 chars).

**Lock risk**: SHORT (empty table CREATE + 5 non-concurrent indexes).

**Risk**: LOW. Prerequisite verification is the only gate.

### 228 · nex_watch_listing_entitlement

**Summary**: Immutable audit ledger of paid entitlement windows. One row per successful payment event.

**Objects**: table (14 columns) + 4 indexes + 1 RLS policy. Idempotency keys: `internal_event_id` UNIQUE + `(provider, payment_reference)` UNIQUE partial.

**Dependencies**: 227 (FK ON DELETE CASCADE).

**RLS**: authenticated owner SELECT own rows only. No INSERT/UPDATE/DELETE for authenticated (service-role only via server actions).

**Risk**: LOW. Apply order: 227 → 228 mandatory.

### 229 · watch_listing_directory_v (VIEW)

**Summary**: Projection of eligible paid individual watch listings for the NEX directory. Option Y (one tile per eligible paid listing).

**Objects**: 1 view (security_invoker=true) + 2 GRANTs (SELECT to anon + authenticated).

**Dependencies**: 227 (underlying table + published-window index).

**Scope boundary**: Deliberately excludes moderation-hold predicate (future). Excludes chat-mode listings (price_pence > 0 filter).

**RLS**: Inherited (security_invoker=true).

**Risk**: NONE for apply (VIEW only, no data).

### 230 · nex_watch_listing_search_tsv

**Summary**: Adds generated full-text search column + GIN index. Enables real `websearch_to_tsquery` search in v1.

**Objects**: `search_tsv tsvector GENERATED ALWAYS AS ... STORED` + GIN index. Weighted: A (brand, model_name) > B (reference_number) > C (description) > D (watch_type, movement, dial_color). Config: 'simple' for brand/model (precision); 'english' for description (stemming).

**Lock risk**: MEDIUM. Adding GENERATED STORED column + non-concurrent GIN index. On empty Supabase table: seconds. On populated table: 5–10 minutes of write contention.

**Risk**: MEDIUM. Recommend applying during maintenance window if table has data.

### 231 · nex_watch_listing_deletion_audit

**Summary**: R3 remediation · durable audit log of retention-cleanup passes. Supports "right to erasure" claims + partial-failure diagnosis.

**Objects**: table (9 columns) + 3 indexes + 1 RLS policy. `listing_id` is NULLABLE (FK ON DELETE SET NULL) because row persists after the listing is hard-deleted.

**RLS**: authenticated owner SELECT own audit history. No INSERT/UPDATE/DELETE for authenticated.

**Risk**: LOW. Service layer (watch-retention-service.ts) writes explicitly.

### 232 · nex_watch_listing_rate_limit

**Summary**: R5 remediation · DB-backed per-account rate limiting. Atomic increment via SECURITY DEFINER function.

**Objects**: table (6 columns) + 2 indexes + SECURITY DEFINER function `nex_watch_listing_increment_rate_limit(account_id, action, window_start) RETURNS integer`. Function uses INSERT ... ON CONFLICT UPSERT (atomic). REVOKE EXECUTE from public/anon/authenticated · service-role only via RPC. Table has RLS enabled with no policies (all via RPC).

**Dependencies**: 010 + 217 hardening (search_path pattern).

**Risk**: LOW. Cross-instance correctness guaranteed by UNIQUE + ON CONFLICT.

### 233 · nex_live_post_directory_v (VIEW)

**Summary**: Directory Integration Fix · view-only projection of eligible paid live posts. Sibling to 229.

**Objects**: 1 view (security_invoker=true) + 1 GRANT. Joins nex_live_session (status='open', business_id NOT NULL) + nex_live_featured_product (ended_featuring_at IS NULL) + nex_product (price_pence > 0).

**Dependencies**: 001, 002, 003, 219 (nex_live_session + nex_live_featured_product).

**Scope boundary**: Does NOT invent a new entitlement rail. Uses existing fields to infer eligibility (Business-tier broadcaster + priced featured product = paid-tier publication). Future amendment may require explicit nex_live_post_entitlement table.

**RLS**: Inherited.

**Risk**: LOW. Apply after 219 confirmed.

---

## Cross-migration dependency graph

```
001 (nex_account) ─┐
                   ├─→ 002 (nex_business) ─┐
                   ├─→ 003 (nex_product) ──┐
                   ├─→ 010 (helpers)       │
                   │       ↓               │
                   │   217 (hardening)     │
                   │       ↓               │
      ┌────────────┴───────┤               │
      │                    ├─→ 227 ─┬─→ 228
      │                    │        ├─→ 229
      │                    │        ├─→ 230
      │                    │        ├─→ 231
      │                    ├────────→ 232
      │        219 ────────────────→ 233
```

**Apply order (mandatory)**:
1. Verify 001, 002, 003, 010 exist in Supabase
2. Verify 217 applied (hardening)
3. Verify 219 applied (live session foundation)
4. 227 → 228 (sequential)
5. 229, 230, 231 in any order after 227
6. 232 independent, recommended after 227
7. 233 anytime after 219

---

## Supabase-specific concerns

### Extensions
- No required extensions beyond built-ins. ✓ No blockers.

### Prerequisites must exist in Supabase (BLOCKING)
- 001 nex_account · VERIFY
- 002 nex_business · VERIFY
- 003 nex_product · VERIFY (needed for 233)
- 010 SECURITY DEFINER helpers · VERIFY nex_current_account_ids() + nex_current_owned_business_ids() exist
- 217 search_path hardening · VERIFY applied
- 219 nex_live_session + nex_live_featured_product · VERIFY exist (needed for 233)

If ANY of these are missing in Supabase, the migrations will fail at FK creation or RLS policy evaluation.

### RLS role enforcement
Supabase enforces RLS per role (anon, authenticated, service_role). All role interactions verified correct in RLS matrix below.

### Postgres version
Supabase runs 14+ · ✓ compatible with GENERATED ALWAYS AS STORED (Postgres 12+).

---

## Service layer integration audit

### Watch-listing-service.ts (verified)
- createWatchListing() · inserts to 227 with owner + business checks
- grantWatchListingEntitlement() · atomic insert to 228 + update 227.entitlement_expires_at
- searchWatchListings() · queries 227 via websearch_to_tsquery on search_tsv (230)
- readWatchListingDirectory() · selects from 229 view
- readWatchListingById() · selects from 227

**Status**: ✓ No mismatches between service layer and migrations.

### DEV_PAYMENT production guard (Audit #80)
- Guard module: `watch-listing-dev-mock-guard.ts`
- Invariants: NODE_ENV='production' → always REJECT (no flag override). NODE_ENV≠'production' → reject by default; only allow if `NEX_WATCHES_DEV_MOCK_PAYMENT_ALLOWED='1'` (EXACT match).
- Enforcement: `grantWatchListingEntitlementMockAction` calls `isDevMockPaymentAllowed()` before granting.
- Status: ✓ Guard intact. Even if migrations are applied, the mock path cannot fire in production.

### Rate limiting (Audit R5, Task #90)
- Config + service + migration 232 provides atomic RPC enforcement.
- Status: ✓ Rate limit table + RLS + enforcement path intact.

### Image URL allowlist (Audit R4, Task #89)
- Module: `watch-image-origin.ts`.
- Allowlist sources: `NEX_SUPABASE_URL`, `NEXT_PUBLIC_NEX_SUPABASE_URL`, `NEX_WATCHES_IMAGE_CDN_ORIGIN`, dev-only `localhost`/`127.0.0.1`.
- Enforcement: `createWatchListingAction` calls `assertApprovedImageUrl()` + `evaluateImageOriginList()`.
- Status: ✓ Allowlist boundary at service entry point.

---

## RLS matrix (summary)

| Table | Role | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|---|
| nex_watch_listing | anon | ✓ (live) | ✗ | ✗ | ✗ |
| nex_watch_listing | authenticated (owner) | ✓ (all own) | ✓ (own) | ✓ (own) | ✗ |
| nex_watch_listing | authenticated (other) | ✓ (live) | ✗ | ✗ | ✗ |
| nex_watch_listing | service_role | ✓ | ✓ | ✓ | ✓ |
| nex_watch_listing_entitlement | anon | ✗ | ✗ | ✗ | ✗ |
| nex_watch_listing_entitlement | authenticated (owner) | ✓ (own) | ✗ | ✗ | ✗ |
| nex_watch_listing_entitlement | authenticated (other) | ✗ | ✗ | ✗ | ✗ |
| nex_watch_listing_entitlement | service_role | ✓ | ✓ | ✓ | ✓ |
| nex_watch_listing_deletion_audit | anon | ✗ | ✗ | ✗ | ✗ |
| nex_watch_listing_deletion_audit | authenticated (owner) | ✓ (own) | ✗ | ✗ | ✗ |
| nex_watch_listing_deletion_audit | authenticated (other) | ✗ | ✗ | ✗ | ✗ |
| nex_watch_listing_deletion_audit | service_role | ✓ | ✓ | ✓ | ✓ |
| nex_watch_listing_rate_limit | authenticated | ✗ | ✗ | ✗ | ✗ |
| nex_watch_listing_rate_limit | service_role (RPC only) | ✓ | ✓ | ✓ | ✓ |
| watch_listing_directory_v | anon | ✓ (inherited) | ✗ | ✗ | ✗ |
| watch_listing_directory_v | authenticated | ✓ (inherited) | ✗ | ✗ | ✗ |
| nex_live_post_directory_v | anon | ✓ (inherited) | ✗ | ✗ | ✗ |
| nex_live_post_directory_v | authenticated | ✓ (inherited) | ✗ | ✗ | ✗ |

**Summary**: All public-facing tables + views enforce RLS correctly. Entitlement + deletion audit + rate-limit tables properly gated to owners + service-role.

---

## Pre-apply checklist (founder must confirm)

1. **Supabase prerequisites verified**: 001, 002, 003, 010, 217, 219 all exist in `ijvqdvsvwtwxzcqmoqit`.
2. **Apply order decision**: Apply in sequence 227 → 228 → 229 → 230 → 231 → 232, then 233 separately.
3. **Maintenance window**: Migration 230 (tsvector + GIN) may lock writes for 5–10 minutes on a large table. Plan during off-peak.
4. **Storage bucket**: Decide watch-image bucket name (e.g. `nex-watch-media`) + configure `NEX_WATCHES_IMAGE_CDN_ORIGIN` if using CDN.
5. **Public vs. signed URLs**: Decide if watch images are public-read or signed-URL-required.
6. **Stripe webhook endpoint** (future): Payment-provider webhook URL + secret for `grantWatchListingEntitlementAction`. Signature verification ready at `watch-payment-webhook.ts`.
7. **Rate limit thresholds**: Verify `watch-listing-rate-limit-config.ts` thresholds match owner's policy.
8. **Rollback drill**: Test `DROP TABLE nex_watch_listing CASCADE` in a sandbox.
9. **Doctrine seals**: Verify no outstanding sealed-doctrine prerequisite blocks.
10. **Comms plan**: No existing nex_business columns affected · no live-table migration.

---

## Honest limitations of this review

- Did NOT run migrations against Supabase · pure SQL + repo code read.
- Did NOT inspect Supabase current schema state · assumes 001/002/003/010/217/219 exist.
- Did NOT verify Supabase storage bucket configuration.
- Did NOT verify payment-provider integration (Stripe webhook unimplemented).
- Post-apply monitoring plan is a separate document.

---

## Recommendation

**READY TO APPLY with conditions**:

1. **Prerequisite verification (BLOCKING)**: Before running any migration, founder + operator MUST verify in Supabase console that 001, 002, 003, 010, 217, 219 are all applied. If any missing, STOP.

2. **Apply sequence**: 227 → wait 2 min → 228, 229, 230, 231, 232 → 233. Recommend applying all 7 in a single batch so schema is consistent.

3. **Lock window**: Migration 230 may block writes briefly. Apply during maintenance window or when watch-listing traffic is minimal.

4. **Post-apply verification**:
   - `SELECT COUNT(*) FROM nex_watch_listing` · expect 0 on first apply
   - `SELECT proname FROM pg_proc WHERE proname = 'nex_watch_listing_increment_rate_limit'` · expect 1 row
   - `SELECT COUNT(*) FROM pg_views WHERE viewname IN ('watch_listing_directory_v', 'nex_live_post_directory_v')` · expect 2 rows
   - From Vercel, test `/nex-native/watches` (should render empty state)

5. **Service layer readiness**:
   - Verify watch-listing-service.ts is deployed to production before activating upload UI.
   - Verify watch-listing-rate-limit-service.ts is wired into `createWatchListingAction`.
   - Verify watch-image-origin.ts allowlist is configured.
   - Verify DEV_PAYMENT production guard is in place.

6. **Owner sign-off gates**:
   - Storage bucket name + ACL strategy (public vs. signed URLs)
   - Rate limit thresholds
   - Stripe webhook endpoint (deferred to separate entitlement-grant amendment)

**Risk summary**: **LOW**. All 7 migrations are additive. RLS correct. Service layer ready. DEV_PAYMENT guard in place. Online-DDL on migration 230 is the only operational concern (acceptable in maintenance window).

**Founder approval required**: Confirm prerequisites verified in Supabase, storage bucket decision, rate-limit policy, apply timeline. No code changes, no migration applies, no Supabase writes have occurred as part of this review.

---

*End of review. Research-only. No code was changed. No files were created apart from this doctrine document. Repository state is unchanged. No Supabase writes.*
