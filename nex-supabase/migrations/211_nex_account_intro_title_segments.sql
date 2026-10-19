-- 211_nex_account_intro_title_segments.sql
--
-- Per-selection text styling for the intro title overlay.
-- Owner-authorised 2026-10-20 · "ship segments".
-- =============================================================================
-- Replaces the single-colour / single-size model of migration 209
-- with a per-character attribute array stored as JSONB. The existing
-- intro_title_text column stays as the authoritative source for the
-- raw characters (so backward compatibility is clean · a NULL segments
-- array means "use the single-colour fallback from migration 209").
--
-- Segment shape (serialised form · what the client sends on Save):
--   [
--     { "text": "Welcome ", "color": "#FFFFFF", "size": "m" },
--     { "text": "Crispy",   "color": "#FF4FA0", "size": "l"  },
--     { "text": " Chicken", "color": "#FFFFFF", "size": "m" }
--   ]
--
-- Rules:
--   · Concatenating segment.text == intro_title_text exactly
--   · color is 7-char hex (#RRGGBB) · optional per segment (falls
--     back to intro_title_color which falls back to #FFFFFF)
--   · size is one of (s,m,l,xl) · optional per segment (falls back
--     to intro_title_size which falls back to m)
--   · When the array is NULL or empty, the renderer uses the global
--     intro_title_color + intro_title_size for every character
--     (preserves the single-colour UX for users who never discover
--     the per-selection feature).

BEGIN;

ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS intro_title_segments jsonb;

-- JSONB array shape · very lightweight sanity check at the DB level ·
-- real validation happens in the server action which also enforces
-- the concatenation-equals-title_text invariant.
ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_intro_title_segments_is_array
  CHECK (intro_title_segments IS NULL
         OR jsonb_typeof(intro_title_segments) = 'array');

COMMIT;
