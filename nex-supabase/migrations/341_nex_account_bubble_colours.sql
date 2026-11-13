-- 341_nex_account_bubble_colours.sql
-- -----------------------------------------------------------------------------
-- NEX Chat Settings · cross-device bubble colour persistence.
-- Owner-authorised 2026-11-12 for drafting only · NOT YET AUTHORISED TO APPLY.
-- -----------------------------------------------------------------------------
-- Purpose · make the viewer's custom outgoing + incoming bubble
-- colours follow their account across devices. Today the Free Chat
-- bubble-customize surface saves to a cookie only, so a user who
-- customises on phone sees the theme defaults on desktop.
--
-- Two nullable 7-character hex columns · NULL = fall back to the
-- active theme's defaults (`nex_chat_theme.accent_hex` /
-- `nex_chat_theme.bubble_rim_hex`). Nullable semantics guarantees
-- backward compatibility: a user who has not opened the customiser
-- never sees a colour change.
--
-- Shape · '#RRGGBB' lowercase, 7 chars total, CHECK-constrained.
--
-- Scope-restricted:
--   · Adds TWO nullable text columns to nex_account.
--   · No backfill · all existing rows start NULL (theme defaults
--     continue to paint).
--   · CHECK constraint enforces strict hex format so malformed
--     values are rejected at the DB tier.
--   · No RLS policy change · the columns live inside the same
--     policies that already gate nex_account read/update.
--   · No indexes · always read with the account row by primary key.
--
-- Rollback compatibility:
--   · Dropping the columns restores the pre-migration state exactly ·
--     bubble-customize cookie remains as the local-only persistence
--     path.
--   · See 341_nex_account_bubble_colours_rollback.sql.
--
-- Downstream consumers (must ship alongside the apply, but service
-- layer also catches missing-column errors and falls back to cookie
-- so degraded order is non-breaking):
--   · src/lib/nex-native/bubble-colours-service.ts (new) ·
--     getBubbleColours + setBubbleColours.
--   · src/app/nex-native/free-chat/_customize-actions.ts ·
--     saveBubbleCustomizationAction writes through to DB in addition
--     to the cookie. Cookie remains as a client-side cache for
--     offline paints.
--   · src/app/nex-native/settings/chat-settings/page.tsx · reads
--     bubble colours and passes to the inline swatch preview on the
--     Bubble colours card.
--
-- NOT YET APPLIED to sandbox or production. Requires separate explicit
-- owner authorisation naming sandbox ref kdstoyyeygcopkogqsyv before
-- apply. Production project ijvqdvsvwtwxzcqmoqit remains sealed.

BEGIN;

ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS bubble_self_hex text,
  ADD COLUMN IF NOT EXISTS bubble_peer_hex text;

ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_bubble_self_hex_valid
    CHECK (
      bubble_self_hex IS NULL
      OR bubble_self_hex ~ '^#[0-9a-f]{6}$'
    );

ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_bubble_peer_hex_valid
    CHECK (
      bubble_peer_hex IS NULL
      OR bubble_peer_hex ~ '^#[0-9a-f]{6}$'
    );

COMMENT ON COLUMN nex_account.bubble_self_hex IS
  'Owner-sealed 2026-11-12 · account-level override for the viewer''s '
  'OUTGOING (sent) message bubble fill colour. NULL = fall back to the '
  'active theme''s accent_hex. Lowercase #RRGGBB.';

COMMENT ON COLUMN nex_account.bubble_peer_hex IS
  'Owner-sealed 2026-11-12 · account-level override for the viewer''s '
  'INCOMING (received) message bubble fill colour, as the VIEWER sees '
  'it. NULL = fall back to the active theme''s bubble_rim_hex. '
  'Lowercase #RRGGBB. Note: this is a per-VIEWER preference · each '
  'account picks the incoming colour they want on their own device, '
  'it does not change what the sender sees.';

INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '341',
  'nex_account.bubble_self_hex + bubble_peer_hex · cross-device bubble colours',
  'Owner directive 2026-11-12 Chat Settings Control Centre. Two '
  'nullable text columns (hex-format CHECKs) on nex_account · no '
  'backfill · NULL preserves today''s behaviour (theme defaults). '
  'Consumed by bubble-colours-service and the free-chat bubble-'
  'customize surface which upgrades from cookie-only to '
  'cookie+DB persistence.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
