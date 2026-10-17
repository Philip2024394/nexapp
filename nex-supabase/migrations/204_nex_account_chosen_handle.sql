-- ============================================================================
-- NEX-native Migration 204 · nex_account.chosen_handle
-- ============================================================================
--
-- Purpose:
--   Add a user-chosen, human-readable NEX display name alongside the
--   sealed system-allocated nex_handle (migration 013). The chosen_handle:
--     · Is a DISPLAY LABEL · not a unique identifier
--     · Allows duplicates globally (NO unique index)
--     · Is nullable (existing accounts opt in later via Settings)
--     · Supports international scripts (Unicode letters + numbers + marks)
--     · Rejects emojis, control chars, format chars at the application layer
--     · Stored in NFC-normalised form by the application layer
--
-- Doctrine:
--   · Sealed nex_handle (migration 013) is NOT touched. The permanent
--     public identity nex-XXXXX remains the attribution/relationship
--     key. Display names are decorative; identity is permanent.
--   · The chosen_handle is a display/discovery label only · never a
--     uniqueness carrier, never a URL anchor, never a search key.
--
-- DB-vs-application boundary (deliberate · explicit · documented):
--   This CHECK constraint is STRUCTURAL ONLY. It enforces:
--     - Length bounds (1-256 Unicode scalar values)
--     - No ASCII/POSIX control characters
--     - No leading/trailing POSIX whitespace
--     - No doubled POSIX whitespace
--     - A small system-critical reserved-name list
--   It does NOT validate Unicode letter/number categories, emoji
--   sequences, format characters, grapheme boundaries, per-grapheme
--   combining-mark counts, or NFC normalisation. PostgreSQL regex and
--   character classes are NOT equivalent to JavaScript \p{Property}
--   semantics. Semantic validation lives in TypeScript at:
--     · src/lib/nex-native/handle-normalise.ts
--     · src/lib/nex-native/handle-reserved-names.ts
--   The authorised application write paths are:
--     · createNexAccountAction (signup)
--     · updateChosenHandleAction (Settings)
--   The service-layer runtime guard is:
--     · accountService.createAccount (calls assertValidChosenHandle)
--     · accountService.updateChosenHandle (calls assertValidChosenHandle)
--
-- OPS WARNING · direct Supabase service-role writes bypass the semantic
-- layer. If you INSERT or UPDATE nex_account.chosen_handle outside the
-- application (SQL console, admin scripts, future triggers), you MUST
-- call validateChosenHandle() from handle-normalise.ts first. The CHECK
-- below only prevents byte-level garbage; it does NOT enforce the full
-- Unicode policy. A privileged bypass can store emojis, zero-width
-- joiners, or non-NFC values; chat headers will render whatever is
-- stored. Recovery: UPDATE nex_account SET chosen_handle = NULL WHERE ...
--
-- Length policy (asymmetric by design):
--   · APPLICATION (strict): max 32 graphemes, max 4 marks per grapheme,
--     max 160 code points. Enforced in handle-normalise.ts.
--   · DATABASE (loose): max 256 code points. Deliberately wider than the
--     application so this CHECK can NEVER reject a name the application
--     accepted. Serves as a denial-of-service byte-level guard, not a
--     semantic length enforcer.
--
-- Rollback: FORWARD-ONLY. This migration does NOT include a destructive
--   rollback script. Dropping the column after launch would destroy
--   saved chosen names. A permanent rollback requires a subsequent
--   migration with a data-export step first, authored and reviewed
--   when needed.
-- ============================================================================

BEGIN;

-- 1 · Add the nullable column.
ALTER TABLE nex_account
  ADD COLUMN chosen_handle text;

-- 2 · Structural CHECK · length + control chars + whitespace invariants.
--     Deliberately NOT a Unicode-semantic validator.
ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_chosen_handle_structure
  CHECK (
    chosen_handle IS NULL
    OR (
      -- Length counted in characters (code points) via PostgreSQL
      -- length(text). Loose 1-256 ceiling: wider than application's
      -- strict 160-code-point cap, so this CHECK cannot reject an
      -- application-accepted value. Lower bound 1 is a floor; the
      -- application enforces >=3 graphemes which guarantees >=3 code
      -- points.
      length(chosen_handle) BETWEEN 1 AND 256
      -- Reject POSIX control characters. [[:cntrl:]] in PostgreSQL
      -- matches ASCII 0x00-0x1F and 0x7F (plus locale-dependent C1
      -- controls on some builds). NOT equivalent to JavaScript \p{Cc}
      -- but a reasonable byte-level sanity floor.
      AND chosen_handle !~ '[[:cntrl:]]'
      -- No leading / trailing / doubled POSIX whitespace. [[:space:]]
      -- in PostgreSQL covers at minimum HT, LF, VT, FF, CR, space.
      -- Behaviour on non-ASCII whitespace is implementation-dependent
      -- and NOT equivalent to JavaScript \s · the application layer
      -- rejects non-U+0020 whitespace on raw input before this CHECK
      -- ever sees it.
      AND chosen_handle !~ '^[[:space:]]'
      AND chosen_handle !~ '[[:space:]]$'
      AND chosen_handle !~ '[[:space:]][[:space:]]'
    )
  );

-- 3 · Reserved-name CHECK · case-insensitive against the normalised
--     value. Matches the DB_SYSTEM_RESERVED Set exported from
--     src/lib/nex-native/handle-reserved-names.ts. Any change here
--     MUST be mirrored there (regression tests enforce this).
ALTER TABLE nex_account
  ADD CONSTRAINT nex_account_chosen_handle_not_reserved
  CHECK (
    chosen_handle IS NULL
    OR lower(chosen_handle) NOT IN (
      'nex','admin','root','api','auth','official','support','help',
      'www','app','system','null','undefined',
      'nex admin','nex support','nex help','nex official',
      'nex team','nex api','nex staff'
    )
  );

-- 4 · Column comment · documentation for Supabase inspector + future
--     migrations.
COMMENT ON COLUMN nex_account.chosen_handle IS
  'User-chosen NEX display name · migration 204 · nullable, non-unique. '
  'Stored in NFC form; semantic validation (letters/numbers/marks + '
  'spaces + hyphen/underscore/apostrophe/period, no emojis, 3-32 '
  'graphemes, <=4 marks per grapheme, <=160 code points) lives in '
  'src/lib/nex-native/handle-normalise.ts. The CHECK constraint on '
  'this column is structural only · it does NOT replace application '
  'validation. Separate from sealed nex_handle (migration 013, '
  'system-allocated nex-XXXXX permanent identity, UNIQUE).';

-- 5 · Record migration (pattern per migrations 013, 017, 024, 197).
--     INSERT is the LAST statement before COMMIT so a failed schema
--     change rolls back the history row with the transaction.
INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '204',
    'nex_account.chosen_handle · user-chosen display name (non-unique)',
    'Adds nullable text column, structural CHECK (length 1-256 code '
    'points, no control chars, no leading/trailing/double POSIX '
    'whitespace), and a reserved-name CHECK matching '
    'handle-reserved-names.ts DB_SYSTEM_RESERVED. NO unique index · '
    'display names allow duplicates by design (permanent nex_handle '
    'is the unique identity). NO availability-check RPC. NO rate-'
    'limit infrastructure. Semantic Unicode validation lives in the '
    'application layer per Path A owner decision 2026-10-17. Sealed '
    'nex_handle (013) and nex_allocate_handle RPC are NOT touched. '
    'Forward-only · see migration header for rollback stance and '
    'ops warning on direct service-role writes.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
