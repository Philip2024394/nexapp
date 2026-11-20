-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
-- Drafted 2026-11-17 · CORRECTED 2026-11-17 after owner review.
--
-- TARGET
-- ------
-- Close FAQ draft-leak defense-in-depth on nex_business.info_pages.
--
-- CORRECTION NOTE (why v1 of this proposal was wrong)
-- ---------------------------------------------------
-- v1 proposed `REVOKE SELECT (info_pages) ON nex_business FROM anon;`
-- against the Supabase default table-level SELECT grant. In PostgreSQL,
-- column-level privileges are ADDITIVE to table-level privileges · if a
-- role has table-level SELECT, revoking SELECT on a single column does
-- NOT subtract that column from reads. Reference: PostgreSQL docs
-- `GRANT` / `REVOKE` · "Depending on the type of object, the initial
-- default privileges may include granting some privileges to PUBLIC" ·
-- the column restriction only takes effect when the table-level grant
-- is absent. v1 would therefore have been a no-op.
--
-- Scope of the real leak (independent of DB grants)
-- -------------------------------------------------
-- Server-side trace completed 2026-11-17:
--
--   · info-pages-service.ts · getInfoPages / updateInfoPages · nexSupabaseAdmin
--   · shop-cover-service.ts · getShopCoverContent · nexSupabaseAdmin
--   · cover-content-loader.ts · consumes a caller-fetched row · no live callers
--
-- All reads go through service_role. There is NO anon/authenticated reader
-- of info_pages in src/ at drafting time. BUT the server-fetched raw
-- object was being passed to a "use client" component (BurgerMenu) on the
-- public route /nex-native/[businessSlug]/page.tsx, which means the full
-- draft payload (unanswered starter questions, disabled rows, disabled
-- custom buttons) was SERIALISED into the RSC/HTML stream and visible to
-- anonymous visitors via a network/HTML inspection — regardless of what
-- the component chose to render.
--
-- LOCAL FIX (ALREADY APPLIED IN THIS PASS, NO DB AUTHORISATION NEEDED)
-- --------------------------------------------------------------------
-- A server-side projection has been added:
--
--   src/lib/nex-native/info-pages-service.ts · projectPublicInfoPages()
--
-- and wired at:
--
--   src/app/nex-native/[businessSlug]/page.tsx (BurgerMenu content prop)
--
-- so unpublished FAQ rows + disabled/unlabelled custom buttons are
-- stripped BEFORE serialisation. Regression tests at
-- src/lib/nex-native/__tests__/info-pages-service-projection.test.ts
-- (17 tests covering publish filter, custom-button filter, text-page
-- passthrough, enabled-record passthrough, brand-new-shop starter-bank
-- scenario, and malformed-row tolerance).
--
-- The projection is the PRIMARY defence. The DB change below is
-- DEFENSE-IN-DEPTH against a future contributor adding a browser-side
-- or route-handler anon-key read of info_pages.
--
-- =========================================================================
-- THIS SQL IS A DEFENSE-IN-DEPTH PROPOSAL · NOT MINIMUM-NECESSARY
-- =========================================================================
--
-- Approach B · corrected · column-allowlist
-- -----------------------------------------
-- To actually bar anon/authenticated reads of info_pages:
--
--   (1) REVOKE SELECT ON nex_business FROM anon, authenticated
--       (removes the table-level blanket grant)
--
--   (2) GRANT SELECT (<allowlist-of-columns-EXCLUDING-info_pages>)
--       ON nex_business TO anon, authenticated
--
--       The allowlist must enumerate every column currently consumed by
--       anon/authenticated reads. The existing RLS policy
--       `nex_business_public_read USING (true)` keeps the directory
--       projection working for signed-out visitors.
--
--   (3) service_role keeps full table-level SELECT (default).
--
-- WHY THIS SQL IS NOT YET SAFE TO APPLY
-- -------------------------------------
-- The allowlist below is a DRAFT · it was built by scanning migration
-- files 002-289 for nex_business columns and filtering OUT info_pages.
-- Before this is safe for sandbox apply we need:
--
--   · A verified column enumeration against the LIVE sandbox schema
--     (information_schema.columns · not just migration files, which may
--     have drifted vs. the actual DB state).
--   · A verified consumer inventory that proves no anon/authenticated
--     reader is using `SELECT *` or a SELECT column list that would be
--     silently truncated by the allowlist (PostgREST + Supabase client
--     typically select explicit columns, but a `select("*")` call would
--     start missing info_pages silently, not error).
--   · Confirmation that no view / RPC / SECURITY DEFINER function
--     projects info_pages to anon/authenticated via a side door.
--   · Confirmation that no role inherits anon/authenticated and holds
--     a grant that would re-open the column (Supabase has the
--     anon → authenticator path; PUBLIC pseudo-role defaults do not
--     grant table SELECT unless the migration author set them).
--   · Confirmation of PUBLIC pseudo-role privileges (REVOKE from anon
--     does not touch PUBLIC-granted rights).
--
-- Until each of those checks is captured against the sandbox DB and the
-- allowlist is proven complete, this proposal remains UNAUTHORISED.
--
-- The projection fix above protects the single live leak surface, so
-- this DB change is NOT required to close the gap · it is purely a
-- "future-proof the schema against a new anon-key reader" measure.

BEGIN;

-- (1) Remove the blanket table-level SELECT grant from the two session
--     roles. Without this, any anon/authenticated client that lists
--     info_pages in the column list continues to see it.
REVOKE SELECT ON nex_business FROM anon;
REVOKE SELECT ON nex_business FROM authenticated;

-- (2) Re-grant SELECT on the safe allowlist. This list was assembled by
--     scanning migrations 002-289 for `ADD COLUMN IF NOT EXISTS` on
--     nex_business and filtering out info_pages. REQUIRES verification
--     against the live sandbox schema before apply · the list may be
--     incomplete, out-of-date, or include columns that themselves should
--     be masked (e.g. verified_note, documentary_evidence).
--
-- VERIFICATION QUERY (run in sandbox BEFORE adopting this allowlist):
--   SELECT column_name
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'nex_business'
--    ORDER BY ordinal_position;
--
-- Replace the list below with the verified columns MINUS info_pages
-- (and MINUS any other sensitive column that surfaces in review).

GRANT SELECT (
  -- Identity + routing
  id,
  owner_account_id,
  display_name,
  slug,
  -- Core profile (migration 014)
  description,
  logo_url,
  hours,
  address,
  public_phone,
  public_email,
  website_url,
  -- Status (migration 022)
  status_message,
  status_message_expires_at,
  -- Payment-offline (migration 018)
  payment_instructions,
  accepts_cod,
  accepts_pickup,
  -- Social handles (migration 026)
  instagram_handle,
  facebook_handle,
  tiktok_handle,
  linkedin_handle,
  x_handle,
  -- Market reach (migration 060)
  market_reach,
  -- Seller details (migration 061)
  year_established,
  staff_count,
  samples_available,
  accepts_oem,
  min_order_quantity,
  local_postage_included,
  seller_kind,
  languages,
  additional_details,
  -- Activity (migration 063)
  last_seller_activity_at,
  is_away,
  away_until,
  away_message,
  archived_at,
  -- Category + search (migration 065)
  business_category,
  search_keywords,
  -- Payment methods (migration 068)
  accepted_payment_methods,
  -- City + hours display (migration 072)
  city,
  hours_display,
  -- Safe trade (migration 073)
  safe_trade_activated,
  -- Return policy (migration 076)
  return_policy,
  -- Events + gallery (migration 080)
  events_profile,
  venue_gallery,
  -- Location (migration 082)
  location_lat,
  location_lng,
  -- Verified (migration 083) · NOTE: verified_note stays allowlisted
  -- for the directory badge · review if content is ever sensitive.
  verified_at,
  verified_note,
  -- Cover (migrations 100, 101, 212)
  cover_layout_id,
  social_links,
  shop_cover_image_url,
  shop_cover_tint_hex,
  -- Shipping scope (migration 108)
  shipping_scope,
  -- info_pages (migration 109) · DELIBERATELY OMITTED
  -- QR code (migration 110)
  qr_code_image_url,
  -- Profession link (migration 115)
  profession_id,
  -- Profile + overrides (migration 126) · NOTE: documentary_evidence
  -- may need its own review before being exposed to anon.
  profile,
  capability_overrides,
  content_overrides,
  terminology_overrides,
  documentary_evidence,
  cta_preference,
  -- Food (migrations 158, 161)
  offers_eat_in,
  cuisine_type,
  dietary_flags,
  delivery_platforms,
  -- Export detail (migration 160)
  exports_to_countries,
  -- Canonical rich location (migration 178)
  street_line,
  neighbourhood,
  -- Canonical email qualification (migration 202) · NOTE: these fields
  -- are owner-facing / outreach-internal. Review before anon-exposing.
  email,
  email_source_url,
  email_verified_at,
  email_status,
  qualification_status,
  email_last_attempted_at,
  -- Operating country (migration 286)
  operating_country_code,
  -- Shipping methods + dispatch (migration 289)
  shipping_methods
  -- END OF ALLOWLIST · info_pages EXCLUDED BY DESIGN
) ON nex_business TO anon;

GRANT SELECT (
  id,
  owner_account_id,
  display_name,
  slug,
  description,
  logo_url,
  hours,
  address,
  public_phone,
  public_email,
  website_url,
  status_message,
  status_message_expires_at,
  payment_instructions,
  accepts_cod,
  accepts_pickup,
  instagram_handle,
  facebook_handle,
  tiktok_handle,
  linkedin_handle,
  x_handle,
  market_reach,
  year_established,
  staff_count,
  samples_available,
  accepts_oem,
  min_order_quantity,
  local_postage_included,
  seller_kind,
  languages,
  additional_details,
  last_seller_activity_at,
  is_away,
  away_until,
  away_message,
  archived_at,
  business_category,
  search_keywords,
  accepted_payment_methods,
  city,
  hours_display,
  safe_trade_activated,
  return_policy,
  events_profile,
  venue_gallery,
  location_lat,
  location_lng,
  verified_at,
  verified_note,
  cover_layout_id,
  social_links,
  shop_cover_image_url,
  shop_cover_tint_hex,
  shipping_scope,
  qr_code_image_url,
  profession_id,
  profile,
  capability_overrides,
  content_overrides,
  terminology_overrides,
  documentary_evidence,
  cta_preference,
  offers_eat_in,
  cuisine_type,
  dietary_flags,
  delivery_platforms,
  exports_to_countries,
  street_line,
  neighbourhood,
  email,
  email_source_url,
  email_verified_at,
  email_status,
  qualification_status,
  email_last_attempted_at,
  operating_country_code,
  shipping_methods
) ON nex_business TO authenticated;

-- (3) service_role keeps table-level SELECT by default · explicit
--     GRANT here is documentation + belt-and-braces.
GRANT SELECT ON nex_business TO service_role;

COMMENT ON COLUMN nex_business.info_pages IS
  'Seller-authored tray content (jsonb). Column SELECT NOT granted to anon / authenticated · read only via service role (nexSupabaseAdmin). Live defence against draft leak is the server-side projectPublicInfoPages() projection · this DB-level mask is defence-in-depth.';

COMMIT;

-- ROLLBACK (restores the original over-permissive state · do NOT run
-- except as an explicit recovery step)
-- --------------------------------------------------------------------
--   BEGIN;
--     GRANT SELECT ON nex_business TO anon;
--     GRANT SELECT ON nex_business TO authenticated;
--     -- The per-column grants above remain and are redundant with the
--     -- table-level grant · no DROP required, they will just be unused.
--     COMMENT ON COLUMN nex_business.info_pages IS NULL;
--   COMMIT;
--
-- NOTE: rollback does NOT restore pre-existing exposure beyond the
-- original state · the pre-existing state already leaked drafts.
-- Rolling back is a reversibility option, not a safety guarantee.
--
-- POST-APPLY VERIFICATION (sandbox only · kdstoyyeygcopkogqsyv)
-- -------------------------------------------------------------
-- A. Service-role still reads info_pages:
--      SET ROLE service_role;
--      SELECT info_pages FROM nex_business LIMIT 1;  -- returns jsonb
--      RESET ROLE;
--
-- B. Anon is masked at the column level:
--      SET ROLE anon;
--      SELECT info_pages FROM nex_business LIMIT 1;
--      -- expected: ERROR: permission denied for column info_pages
--      SELECT display_name, slug, city FROM nex_business LIMIT 1;
--      -- expected: row returned
--      RESET ROLE;
--
-- C. Authenticated is masked at the column level:
--      SET ROLE authenticated;
--      SELECT info_pages FROM nex_business LIMIT 1;
--      -- expected: ERROR: permission denied for column info_pages
--      RESET ROLE;
--
-- D. The projection path still works end-to-end:
--    · Open /nex-native/manage/shop/faq as the owner · draft an answer ·
--      save · confirm the row persists.
--    · Open /nex-native/<slug> as an anonymous browser · view-source +
--      network tab · confirm the HTML / RSC payload contains ONLY
--      answered published FAQ rows.
--    · Open /chat/peer/<ownerAccount> as a customer · confirm the
--      Quick-answers strip renders published rows.
--
-- AUTHORISATION REQUIRED (not yet granted)
-- ----------------------------------------
-- Before apply · owner must:
--   1. Confirm the information_schema.columns enumeration above
--      matches the sandbox schema · amend the allowlist to match.
--   2. Decide whether the comment-flagged columns (documentary_evidence,
--      email_*, verified_note, profile overrides, qualification_status)
--      should ALSO be revoked from anon/authenticated by the same
--      migration · this proposal only guards info_pages.
--   3. Issue a fresh, explicitly worded authorisation naming the
--      sandbox project ref (kdstoyyeygcopkogqsyv). Production
--      (ijvqdvsvwtwxzcqmoqit) remains sealed and is NOT in scope.
