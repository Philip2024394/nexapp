-- 343_nex_account_bubble_appearance.sql
-- -----------------------------------------------------------------------------
-- NEX Chat Settings · bubble appearance persistence (glass-to-solid).
-- Owner-sealed 2026-11-13 Themes+ Phase A visual design surface.
-- DRAFTED ONLY · NOT YET AUTHORISED TO APPLY.
-- -----------------------------------------------------------------------------
-- Purpose · persist the per-channel "glass-to-solid" appearance value
-- the Bubble Colours UI lets the viewer slide between. Pairs with the
-- hex columns introduced by migration 341.
--
-- Semantics:
--   0   · fully glass · bubble fill alpha low, strong backdrop blur,
--          colour visible as a tint rather than a block
--   50  · semi-transparent · bubble fill alpha ~0.55
--   100 · solid colour · bubble fill opaque (today's default)
--
-- The UI renders intermediate alpha + blur between those anchors so
-- any 0..100 value produces a consistent gradient of appearance.
--
-- Scope-restricted:
--   · Adds TWO nullable smallint columns to nex_account.
--   · CHECK constrains each to [0, 100] when present.
--   · No backfill · NULL preserves today's behaviour (theme defaults
--     resolve to solid).
--   · No RLS policy change · same gates as existing nex_account
--     columns.
--
-- Rollback compatibility:
--   · Rollback drops the columns · appearance state falls back to
--     local-only (whatever the client UI stores in state).
--   · See 343_rollback.sql.
--
-- Downstream consumer (lands when authorised):
--   · src/lib/nex-native/bubble-colours-service.ts · getBubbleColours
--     returns `selfAppearance` + `peerAppearance` · setBubbleColours
--     accepts both and writes through.
--   · src/app/nex-native/settings/chat-settings/_appearance-client.tsx
--     reads the server-side value on first paint · updates via the
--     save action.
--
-- NOT YET APPLIED. Requires separate explicit owner authorisation
-- naming sandbox ref kdstoyyeygcopkogqsyv. Production project
-- ijvqdvsvwtwxzcqmoqit remains sealed.

BEGIN;

ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS bubble_self_appearance smallint,
  ADD COLUMN IF NOT EXISTS bubble_peer_appearance smallint;

ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_bubble_self_appearance_valid
  CHECK (
    bubble_self_appearance IS NULL
    OR (bubble_self_appearance >= 0 AND bubble_self_appearance <= 100)
  );

ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_bubble_peer_appearance_valid
  CHECK (
    bubble_peer_appearance IS NULL
    OR (bubble_peer_appearance >= 0 AND bubble_peer_appearance <= 100)
  );

COMMENT ON COLUMN nex_account.bubble_self_appearance IS
  'Owner-sealed 2026-11-13 · outgoing bubble glass-to-solid appearance '
  'in 0..100. NULL = fall back to theme default (effectively 100 = solid). '
  'Paired with bubble_self_hex (mig 341).';

COMMENT ON COLUMN nex_account.bubble_peer_appearance IS
  'Owner-sealed 2026-11-13 · incoming bubble glass-to-solid appearance '
  'in 0..100, from the VIEWER''s perspective. NULL = fall back to theme '
  'default. Paired with bubble_peer_hex (mig 341).';

INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '343',
  'nex_account bubble appearance (glass-to-solid 0..100) for both channels',
  'Owner directive 2026-11-13 Themes+ Phase A · visual bubble design. '
  'Two nullable smallint columns · CHECK 0..100 · no backfill. Consumed '
  'by bubble-colours-service + chat-settings appearance client.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
