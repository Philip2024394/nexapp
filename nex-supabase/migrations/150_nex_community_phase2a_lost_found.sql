-- nex-supabase/migrations/150_nex_community_phase2a_lost_found.sql
--
-- NEX Community Noticeboard · Phase 2A · Lost & Found detail + photos.
-- Founder-authorised 2026-10-11.
--
-- WHAT THIS DOES
--   1. `nex_community_lost_found_detail` — kind-specific columns for
--      cards where `nex_community_card.kind = 'lost_found'`:
--        · lost_or_found    'lost' or 'found'
--        · subject_kind     'pet' / 'item' / 'document' / 'other'
--        · approximate_area free text (no exact address)
--        · seen_at          author's best estimate (lost: last seen; found: when found)
--        · contact_mode     'nex_chat' only (Phase 2A sealed to this)
--   2. `nex_community_card_photo` — photo pipeline table used by
--      Lost & Found cards. 2 photos per card max, 2MB max per photo,
--      bytes column enforces size, display_order lets author pick
--      the primary image.
--   3. Supabase storage bucket name reserved: `nex-community-photos`
--      (bucket itself is created by application code / platform; the
--      schema records the storage_path only).
--
-- WHY
--   Phase 2A pilots photos in Lost & Found ONLY (owner-authorised
--   2026-10-11). Keeps Safety photo-free (sealed Phase 1 doctrine).
--   Future kinds that may use photos (Events venue cover image, Life
--   & News memorial image) extend this table.
--
--   Contact mode is sealed to 'nex_chat' in Phase 2A — the detail
--   page exposes a "Message about this card" button that opens the
--   existing peer-chat flow between finder and owner. No phone-number
--   exposure. Future contact modes (nex_relay, in_person) require a
--   new migration + explicit authorisation.
--
-- INVARIANTS SEALED WITH THIS MIGRATION
--   · Max 2 photos per card (CHECK + UNIQUE display_order 0 or 1).
--   · Max 2MB per photo (bytes CHECK).
--   · contact_mode is a closed enum (only 'nex_chat' in Phase 2A).
--   · Photos are tied to card lifecycle (ON DELETE CASCADE); when
--     a card expires or is removed, photo rows die with it.
--   · Safety cards NEVER have photo rows (nex_community_card_photo
--     requires card_id from nex_community_card, which never contains
--     kind='safety' per 148 CHECK).

BEGIN;

-- 1 · Lost & Found kind-specific detail.
CREATE TABLE IF NOT EXISTS nex_community_lost_found_detail (
  card_id              uuid PRIMARY KEY REFERENCES nex_community_card(id) ON DELETE CASCADE,
  lost_or_found        text NOT NULL,
  subject_kind         text NOT NULL,
  approximate_area_text text,
  seen_at              timestamptz,
  contact_mode         text NOT NULL DEFAULT 'nex_chat',

  CONSTRAINT ck_lf_lost_or_found CHECK (lost_or_found IN ('lost','found')),
  CONSTRAINT ck_lf_subject_kind  CHECK (subject_kind IN ('pet','item','document','other')),
  CONSTRAINT ck_lf_area_len      CHECK (approximate_area_text IS NULL OR length(approximate_area_text) <= 200),
  CONSTRAINT ck_lf_contact_mode  CHECK (contact_mode IN ('nex_chat'))
);
CREATE INDEX IF NOT EXISTS idx_lf_subject_kind
  ON nex_community_lost_found_detail (subject_kind);


-- 2 · Photo table (super-table scoped; Phase 2A used only by Lost & Found).
CREATE TABLE IF NOT EXISTS nex_community_card_photo (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id         uuid NOT NULL REFERENCES nex_community_card(id) ON DELETE CASCADE,

  -- Storage path inside the `nex-community-photos` Supabase bucket.
  -- Convention: `<card_id>/<display_order>-<uuid>.webp`.
  storage_path    text NOT NULL,
  display_order   smallint NOT NULL,

  width_px        int,
  height_px       int,
  bytes           int NOT NULL,

  uploaded_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_photo_bytes          CHECK (bytes BETWEEN 1 AND 2097152),  -- 2 MB
  CONSTRAINT ck_photo_display_order  CHECK (display_order IN (0, 1)),       -- 2 photos max
  CONSTRAINT ck_photo_storage_path   CHECK (length(storage_path) BETWEEN 1 AND 400),
  CONSTRAINT uq_photo_card_order     UNIQUE (card_id, display_order)
);
CREATE INDEX IF NOT EXISTS idx_photo_card_order
  ON nex_community_card_photo (card_id, display_order);


-- 3 · Add two rate-limit actions for Lost & Found.
--     The existing nex_community_rate_limit table CHECK already lists
--     the five Phase 1 actions. Phase 2A needs two more.
ALTER TABLE nex_community_rate_limit
  DROP CONSTRAINT IF EXISTS ck_rl_action;
ALTER TABLE nex_community_rate_limit
  ADD CONSTRAINT ck_rl_action CHECK (action IN (
    'notice_create','notice_update','notice_confirm','notice_resolve','notice_report',
    'card_create','card_update','card_confirm','card_resolve','card_report',
    'card_photo_upload'
  ));


COMMIT;
