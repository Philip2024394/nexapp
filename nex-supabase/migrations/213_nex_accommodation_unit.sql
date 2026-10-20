-- ============================================================================
-- NEX-native Migration 213 · Phase A1 · nex_accommodation_unit
-- ============================================================================
--
-- Owner-authorised 2026-10-21. Closes the Phase A1 inversion: accommodation
-- subtypes (villa · homestay · kost) are already selectable at /welcome
-- via the sealed vertical picker, but no backing table existed for their
-- real listings. This migration adds that table so owners can create,
-- edit, pause (via is_available), and archive real rooms.
--
-- Design patterns · copied verbatim from the sealed existing primitives
-- so this does NOT introduce new architecture:
--
--   · Status enum draft|live|archived · identical shape to nex_product
--     (migration 003) and nex_menu_item (migration 066). The sealed
--     product-lifecycle doctrine applies: `paused` is deliberately
--     unimplemented · do NOT equate `draft` or `archived` with pause.
--
--   · `is_available` boolean · identical to nex_menu_item (066:61) ·
--     the clean temporary-off mechanism for a listing that stays live
--     but is unavailable right now (same room, booked for the week).
--     Public visibility filter is `status='live' AND is_available=true`
--     (matches menu_item · migration 066:78).
--
--   · RLS pattern · identical to nex_product (003:75-130) · public reads
--     live rows only · owners read all statuses for their businesses ·
--     owners insert/update only on their business rows · DELETE is
--     service-role only (lifecycle via status='archived').
--
--   · Timestamps + updated_at trigger · reuse `nex_touch_updated_at()`
--     function from migration 002.
--
-- What this migration is NOT (preservation anchors):
--
--   · Not a booking system · nex_accommodation_unit carries capacity +
--     bedrooms + bathrooms + amenities + optional price-per-night, but
--     NO reservation state, NO availability calendar, NO payment
--     integration. Enquiries flow through the existing peer-chat
--     primitive (not through this table).
--
--   · Not a replacement for the sealed R8 DemoRoomDesigns gate · the
--     gate on /[businessSlug]/page.tsx continues to render demo-room
--     guidance for owners viewing their own shop with zero real
--     listings. Once this table has a row, the gate's fifth-condition
--     extension (added in the same cycle) suppresses the demo so real
--     rooms take over.
--
--   · Not a cross-vertical table · it is specific to accommodation.
--     Future verticals (hotel-chain multi-property, etc.) attach their
--     own primitives rather than fold into this one.
--
-- CRITICAL doctrine preserved:
--
--   · "NEX never handles payments" · this migration does NOT add any
--     payment column or booking-confirmation state.
--   · Phase A1 accommodation subtypes only (villa · homestay · kost) ·
--     the vertical picker + preset chain enforces the subtype at
--     business creation · this table does NOT re-enforce subtype
--     (business.profile.primary.subtype is the source of truth).
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '213';
--     DROP TABLE IF EXISTS nex_accommodation_unit;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_accommodation_unit (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,
  name                    text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  description             text CHECK (description IS NULL OR length(description) <= 2000),
  -- Capacity + room counts · defensive bounds mirror nex_menu_item spice_level
  -- (small-integer with CHECK) · prevent 10,000-bedroom nonsense.
  capacity                integer NOT NULL DEFAULT 2 CHECK (capacity BETWEEN 1 AND 50),
  bedrooms                integer NOT NULL DEFAULT 1 CHECK (bedrooms BETWEEN 0 AND 20),
  bathrooms               integer NOT NULL DEFAULT 1 CHECK (bathrooms BETWEEN 0 AND 20),
  -- Amenities · free-form array · normalised to lowercase-hyphen by the
  -- service layer · matches nex_menu_item.dietary_tags pattern (066:63).
  amenities               text[] NOT NULL DEFAULT ARRAY[]::text[],
  -- Price · optional at creation · owners may list without pricing and
  -- negotiate per enquiry (consistent with "NEX never handles payments"
  -- doctrine · the price here is purely display, never transacted).
  price_per_night_pence   integer CHECK (price_per_night_pence IS NULL OR price_per_night_pence >= 0),
  currency                text NOT NULL DEFAULT 'IDR' CHECK (length(currency) = 3),
  -- Media · single hero image + optional gallery · pattern lifted from
  -- nex_product (migrations 015 + 016) · same signed-url semantics.
  image_url               text,
  gallery_urls            text[] NOT NULL DEFAULT ARRAY[]::text[]
                           CHECK (array_length(gallery_urls, 1) IS NULL
                                  OR array_length(gallery_urls, 1) <= 10),
  -- Lifecycle · identical to nex_product + nex_menu_item · sealed enum.
  status                  text NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'live', 'archived')),
  -- Clean temporary-off · identical to nex_menu_item.is_available (066:61).
  is_available            boolean NOT NULL DEFAULT true,
  sort_order              integer NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_accommodation_unit_business
  ON nex_accommodation_unit (business_id, sort_order);

-- Partial index for the hot read path · matches the public RLS predicate
-- so SELECT ... WHERE business_id = ? AND status='live' AND is_available=true
-- hits an index-only scan.
CREATE INDEX IF NOT EXISTS idx_nex_accommodation_unit_live_available
  ON nex_accommodation_unit (business_id)
  WHERE status = 'live' AND is_available = true;

-- updated_at trigger · reuses nex_touch_updated_at() from migration 002.
CREATE TRIGGER nex_accommodation_unit_touch_updated_at
  BEFORE UPDATE ON nex_accommodation_unit
  FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security · identical to nex_product (003:75-130)
-- ---------------------------------------------------------------------------
ALTER TABLE nex_accommodation_unit ENABLE ROW LEVEL SECURITY;

-- Public reads only LIVE + AVAILABLE rooms.
CREATE POLICY nex_accommodation_unit_public_read_live
  ON nex_accommodation_unit
  FOR SELECT
  TO anon, authenticated
  USING (status = 'live' AND is_available = true);

-- Owner (via business) reads all their rooms including drafts + archived.
CREATE POLICY nex_accommodation_unit_owner_read
  ON nex_accommodation_unit
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM nex_business b
      JOIN nex_account a ON a.id = b.owner_account_id
      WHERE a.supabase_user_id = auth.uid()
    )
  );

-- Owner insert on their business's rooms.
CREATE POLICY nex_accommodation_unit_owner_insert
  ON nex_accommodation_unit
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT b.id FROM nex_business b
      JOIN nex_account a ON a.id = b.owner_account_id
      WHERE a.supabase_user_id = auth.uid()
    )
  );

-- Owner update on their business's rooms.
CREATE POLICY nex_accommodation_unit_owner_update
  ON nex_accommodation_unit
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM nex_business b
      JOIN nex_account a ON a.id = b.owner_account_id
      WHERE a.supabase_user_id = auth.uid()
    )
  );

-- DELETE only via service-role · lifecycle via status='archived' instead.

-- ---------------------------------------------------------------------------
-- Comments · doctrine anchors
-- ---------------------------------------------------------------------------
COMMENT ON TABLE nex_accommodation_unit IS
  'Phase A1 accommodation listings · villa + homestay + kost · sealed 2026-10-21 (migration 213). Mirrors nex_product + nex_menu_item lifecycle (status enum + is_available boolean). NEVER a booking table · enquiries flow through peer chat per sealed "NEX never handles payments" doctrine.';
COMMENT ON COLUMN nex_accommodation_unit.status IS
  'Sealed enum: draft (not visible to customers) · live (public, subject to is_available) · archived (retired but retained for enquiry history). Matches nex_product.status + nex_menu_item.status · the sealed product-lifecycle doctrine applies: `paused` is deliberately unimplemented · use is_available for temporary-off, archived for permanent retirement.';
COMMENT ON COLUMN nex_accommodation_unit.is_available IS
  'Clean temporary-off mechanism · identical to nex_menu_item.is_available (066:61). true = bookable right now · false = temporarily unavailable (still visible but customers see "unavailable" state). Separate from status · an archived room has lost its listing · an is_available=false room is just paused.';
COMMENT ON COLUMN nex_accommodation_unit.amenities IS
  'Free-form array normalised to lowercase-hyphen by the service layer · wi-fi, kitchen, pool, bbq, parking, air-con, hot-water. Shape matches nex_menu_item.dietary_tags pattern.';
COMMENT ON COLUMN nex_accommodation_unit.price_per_night_pence IS
  'Optional display price · NEVER transacted · "NEX never handles payments" doctrine. Owners may list without pricing and negotiate per enquiry in chat.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '213',
    'Phase A1 · nex_accommodation_unit · villa + homestay + kost listing persistence · mirrors nex_product + nex_menu_item lifecycle',
    'Owner-authorised 2026-10-21. Closes the Phase A1 inversion where accommodation subtypes were signup-reachable but had no listing backend. AUTHOR-ONLY under the authorisation that produced this file · migration application is a separate action requiring explicit owner authorisation per Safety Constitution §5.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification (run these AFTER authorised apply · NOT part of
-- the author-only authorisation):
--
--   SELECT * FROM nex_migration_history WHERE version = '213';
--     -- expect: 1 row · description starts with "Phase A1 · nex_accommodation_unit"
--
--   SELECT COUNT(*) FROM nex_accommodation_unit;
--     -- expect: 0
--
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'nex_accommodation_unit'
--    ORDER BY ordinal_position;
--
--   SELECT policyname, cmd, roles::text[]
--     FROM pg_policies WHERE tablename = 'nex_accommodation_unit';
--     -- expect: 4 policies · public_read_live, owner_read, owner_insert,
--     --         owner_update · DELETE service-role only (no policy)
-- ============================================================================
