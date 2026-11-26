-- 368_nex_account_region_pref.sql
-- -----------------------------------------------------------------------------
-- NEX Single-App country model · explicit user region preference column.
-- Owner-authorised 2026-11-27 for DRAFTING ONLY · NOT YET AUTHORISED TO APPLY.
-- -----------------------------------------------------------------------------
-- Purpose · unblock NAV-SINGLE-APP-04 (country change via account) and
-- NAV-SINGLE-APP-05 (cross-country RLS verification). The region
-- resolver at `src/lib/nex-native/commercial/region-resolver.ts:7-8`
-- documents the resolution order:
--
--   1. Account-stored preference (nex_account.region_pref · nullable
--      · NOT YET MIGRATED · future state)   ← this migration lands (1)
--   2. Accept-Language header country hint         ← already live, NAV-03 VERIFIED
--   3. Vercel/Cloudflare IP country header         ← already live, NAV-02 VERIFIED
--   4. NEX_APP_COUNTRY env fallback                 ← already live
--   5. Hard fallback · IE                           ← already live
--
-- Semantics:
--   · NULL (default)  ·  no stored preference. Resolver skips tier 1
--                        and uses tier 2+ as today. Preserves current
--                        behaviour for every existing account row.
--   · 'IE'|'GB'|'US'|'ID' · explicit CheckoutRegion. Resolver returns
--                        this value from tier 1 and ignores header /
--                        env fallback for that session.
--   · Any other ISO 3166-1 alpha-2 · passes to
--                        `normaliseToCheckoutRegion(raw)` which maps
--                        EU/EEA → IE etc. per the sealed table.
--
--   Enforcing an enum CHECK is DELIBERATELY NOT INCLUDED because the
--   resolver tolerates any raw country code and normalises. A tighter
--   CHECK would require coordinating updates every time the market set
--   expands (e.g. adding JP/AU/CA/IN/PH). The resolver's
--   `normaliseToCheckoutRegion` returns null for unknown input, and
--   `resolveCheckoutRegion` falls through to tier 2 in that case —
--   safer than a hard reject at the DB level.
--
-- Scope-restricted:
--   · Adds ONE nullable text column (default NULL) to nex_account.
--   · No existing row semantics change: NULL = today's behaviour.
--   · No RLS policy change · the column is readable + updatable under
--     the existing nex_account row-level policies.
--   · No indexes · column only read via the account row primary key.
--   · No CHECK constraint (see rationale above).
--
-- RLS cross-country isolation (NAV-SINGLE-APP-05) is NOT changed by
-- this migration. nex_business rows remain owner-gated by
-- `account_id = auth.uid()`; nex_order rows likewise. A viewer who
-- updates their own `region_pref` cannot read another account's
-- business or order rows under any value of this column — RLS is
-- orthogonal to region, and region does not appear in any sealed
-- policy expression. The NAV-05 test verifies this explicitly by
-- minting two fixture accounts (IE + ID), updating each one's
-- region_pref, and confirming neither reads the other's rows.
--
-- Rollback compatibility:
--   · Dropping the column restores the pre-migration state exactly.
--   · Consumers degrade to the resolver's existing tier-2+ chain.
--   · See 368_nex_account_region_pref_rollback.sql.
--
-- Downstream consumers (code already present, honours the fallback):
--   · src/lib/nex-native/commercial/region-resolver.ts (resolver pure,
--     caller-passes `accountRegionPref` string|null — no change needed).
--   · src/lib/nex-native/commercial/regional-pricing.ts:302 (comment
--     already references this column).
--   · src/app/api/nex-native/billing/checkout/shop/route.ts:90 (comment
--     already references this column as "not yet migrated").
--
-- Follow-up (separate owner-authorised task, NOT in this migration):
--   · A server action `setAccountRegionPref(region)` that validates
--     the input and writes nex_account.region_pref for the
--     authenticated viewer. Owner-gated UI (likely settings profile
--     or business-details page). Until that ships, the column is
--     accessible via admin tooling only.
--
-- NOT YET APPLIED to sandbox or production. Requires separate explicit
-- owner authorisation naming sandbox ref kdstoyyeygcopkogqsyv before
-- apply. Production project ijvqdvsvwtwxzcqmoqit remains sealed.
-- Approval phrase candidate: APPROVE NEX_ACCOUNT REGION_PREF MIGRATION SANDBOX.

BEGIN;

ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS region_pref text DEFAULT NULL;

COMMENT ON COLUMN nex_account.region_pref IS
  'Owner-sealed 2026-11-27 · explicit CheckoutRegion preference '
  '("IE" / "GB" / "US" / "ID") or any ISO 3166-1 alpha-2 country code. '
  'NULL = no preference, resolver uses Accept-Language → edge IP → env → IE. '
  'Read by src/lib/nex-native/commercial/region-resolver.ts (tier 1).';

INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '368',
  'nex_account.region_pref · explicit user region preference',
  'Owner directive 2026-11-27 unblocks NAV-SINGLE-APP-04/05. One '
  'nullable text column default NULL on nex_account · no backfill '
  'needed · default preserves today''s resolver chain for every account. '
  'Consumed by region-resolver tier 1. RLS unchanged.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
