-- 369_nex_account_shop_install_prefs.sql
-- -----------------------------------------------------------------------------
-- NEX branded shop install · signed-in dismissal + install reconciliation.
-- Owner-authorised 2026-11-27 for DRAFTING ONLY · NOT YET AUTHORISED TO APPLY.
-- Revised 2026-11-27 (cycle 2) per owner review · four changes:
--   (i)   RLS fixed · nex_account.id is NOT auth.uid() in NEX · all
--         four policies now use nex_current_account_ids() from
--         migration 010, matching the sealed pattern on nex_business /
--         nex_order / nex_conversation_participant.
--   (ii)  shop_slug CHECK tightened to the EXACT regex + 1..64 length
--         enforced on nex_business.slug (migration 002) so cross-shop
--         collision + malformed slug storage are impossible.
--   (iii) nex_touch_updated_at BEFORE UPDATE trigger attached · matches
--         nex_business (002) · removes the "application writes
--         updated_at on upsert" drift surface called out in review.
--   (iv)  Sync merge contract documented ("most-advanced wins")
--         so the server-side action and the client hook cannot
--         overwrite a more progressed state with stale local data.
-- -----------------------------------------------------------------------------
-- Purpose · bring the per-customer × per-shop install dismissal + install
-- state (currently guest-only, persisted in `localStorage`) into a
-- server-side account-scoped surface so signed-in viewers see
-- consistent slide-in / branded-button suppression across devices.
--
-- Current client state (guest-only · preserved unchanged):
--   · src/components/nex-native/shop-install/use-shop-install-flow.ts
--     stores installed flags under `localStorage["nex_shop_installed_flags_v1"]`
--     as `{ [shopSlug: string]: true }` (one-shot flag).
--   · The same module stores dismissal records under
--     `localStorage["nex_shop_install_prefs_v1"]` as
--     `{ [shopSlug]: { dismissals: 0|1|2, firstDismissAt?: number|null,
--       suppressed?: boolean } }`, implementing Spec §C state machine
--     (0 → show · 1 → hide 5 min · 2 → permanent · install → permanent).
--
-- Account ownership model (verified before correcting RLS):
--   · `public.nex_account.id` is a `gen_random_uuid()` surrogate · it
--     is NOT equal to `auth.uid()`. The link column is
--     `nex_account.supabase_user_id REFERENCES auth.users(id)` (seen
--     in migration 001).
--   · Migration 010 ships the SECURITY DEFINER STABLE helper
--     `nex_current_account_ids() RETURNS SETOF uuid` which resolves
--     `SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()`.
--   · Sealed sibling tables (`nex_business`, `nex_order`,
--     `nex_conversation_participant`, and every table rewritten by
--     migration 010) consistently use
--     `<account_id_col> IN (SELECT nex_current_account_ids())` as the
--     ownership gate. This migration adopts the same pattern.
--   · Observation (NOT fixed here): migration 366 `nex_notification`
--     policies at lines 140 and 148 use `auth.uid() = recipient_account_id`
--     which appears incompatible with the ownership model documented
--     above — recipient_account_id is a `nex_account.id` UUID, not an
--     auth UID. Flagging for a separate owner-approved review; this
--     migration does not touch it.
--
-- What this migration lands:
--   · One account-scoped table that mirrors the two client-side shapes
--     above so a signed-in viewer's dismissal and install state follow
--     their account rather than the browser profile.
--   · RLS so only the account owner can read / insert / update / delete
--     their own rows. No cross-account read path. No admin-override
--     policy (support tooling bypasses via service-role).
--   · `nex_touch_updated_at` BEFORE UPDATE trigger · matches the sealed
--     nex_business + nex_account_region_pref conventions.
--
-- Sync merge contract (binding for src/lib/nex-native/shop-install/
-- sync-shop-install-prefs.ts, which this migration enables):
--   Rule · "most-advanced wins". When the client (localStorage) and
--   the server row disagree the merged value is:
--     · dismissals        := MAX(local.dismissals, server.dismissals)
--     · first_dismiss_at  := the EARLIER of the two non-null values
--                            (COALESCE(LEAST(...), <whichever is set>))
--                            · null only when both are null (dismissals=0)
--     · suppressed        := local.suppressed OR server.suppressed
--     · installed         := local.installed OR server.installed
--   Rationale: the Spec §C state machine is monotonic — once a user
--   has suppressed a slide-in or recorded an install, future UX must
--   not re-prompt them. The merge rule guarantees that stale device-
--   local data can never regress a more-progressed server state back
--   to dismissals=0 or suppressed=false.
--
--   Post-merge, the signed-in client writes the merged record BOTH
--   to localStorage (so the local state machine's hydration still
--   reflects it on next load) AND to this table via upsert ON
--   CONFLICT (account_id, shop_slug) DO UPDATE SET … WHERE the SET
--   expressions themselves use GREATEST / OR to preserve monotonicity
--   even under concurrent writes from two devices.
--
-- Semantics (identical to the client-side state machine):
--   · `dismissals`: 0 / 1 / 2 · permanent stop at 2 per Spec §C.
--   · `first_dismiss_at`: wall-clock timestamp of the FIRST dismissal ·
--      null when dismissals = 0; required when dismissals ≥ 1 (enforced
--      by CHECK). Gates the 5-minute re-show window.
--   · `suppressed`: permanent suppression · set when the user installs
--      the shop OR dismisses a second time (Spec §C/§E).
--   · `installed`: mirror of the INSTALLED_FLAGS_KEY localStorage map
--      entry · set true on `appinstalled` for THIS shop. Decoupled from
--      `suppressed` so a future UX can distinguish "user installed" vs
--      "user dismissed twice" if the spec evolves.
--
-- Key choices + rationale:
--   · `shop_slug` is plain `text` (not an FK to nex_business.slug)
--      because:
--      - The dismissal + install state must survive a merchant rename,
--        a temporary shop takedown, and even a shop deletion.
--        nex_business ON DELETE RESTRICT makes deletion a governed
--        operation, but a service-role hard-delete could still orphan
--        rows if an FK ON DELETE CASCADE were in place — so deliberate
--        decoupling.
--      - A slug is the stable identity used by the client + by the
--        branded manifest route.
--      - The CHECK regex below is byte-for-byte the nex_business.slug
--        regex (migration 002:35) and the 1..64 length is likewise
--        identical, so a valid NEX shop slug and a valid value in
--        this column are the same set · cross-shop or malformed-input
--        collisions cannot occur.
--   · PRIMARY KEY `(account_id, shop_slug)` guarantees one row per
--      account × shop pair · upserts use this key.
--   · No surrogate `id uuid` column because no other table references
--      these rows and the composite key is the natural identity.
--   · `dismissals` is `smallint` (not `integer`) · the domain is
--      {0,1,2}; smallint signals the intent and halves the row width.
--   · `created_at` / `updated_at` as `timestamptz NOT NULL DEFAULT now()`
--      with `trg_nex_account_shop_install_prefs_touch_updated_at`
--      running `nex_touch_updated_at` BEFORE UPDATE · matches sealed
--      nex_business convention; removes the review-flagged drift where
--      the app would be responsible for updated_at.
--
-- RLS:
--   · ENABLE ROW LEVEL SECURITY · service-role bypass works for admin
--      tooling but every normal client path goes through the
--      authenticated role.
--   · SELECT / INSERT / UPDATE / DELETE policies all gated by
--      `account_id IN (SELECT nex_current_account_ids())` · the sealed
--      NEX ownership pattern from migration 010. One row == one
--      account's state; no cross-account read path.
--   · No admin-override policy · support tooling that needs to wipe
--      install prefs runs under service-role and bypasses RLS.
--   · Verification expectation (post-apply): two fixture accounts
--      upsert distinct shop_slug rows; each can read only its own
--      row; attempting SELECT / UPDATE / DELETE across accounts
--      returns 0 rows. Test lives at
--      tests/integration/nex-account-shop-install-prefs-rls.spec.ts
--      (authored alongside the application sync action in this cycle).
--
-- Account + shop lifecycle:
--   · `account_id ON DELETE CASCADE` matches the sealed convention in
--      nex_notification (366:87) and the sibling nex_account-scoped
--      tables · deleting an account removes its install prefs too,
--      which is the intended retention rule (no stranded state).
--   · `shop_slug` has no FK, so shop lifecycle events (rename, takedown,
--      deletion) do not touch rows in this table. If a shop is later
--      renamed to a new slug, the old slug's dismissal record becomes
--      dormant; the new slug has a fresh record. This is the intended
--      behaviour per Spec §C (the dismissal is scoped to the shop
--      identity the user actually saw).
--
-- Scope-restricted:
--   · Creates ONE table + four policies + one UPDATE trigger.
--   · No functions newly defined (uses sealed nex_current_account_ids
--      and nex_touch_updated_at).
--   · No pre-existing table altered.
--   · No backfill · guest localStorage records stay local; the first
--      sign-in action after rollout calls the application-layer sync
--      action which upserts whatever the client has using the
--      monotonic merge rule above.
--
-- Downstream consumers (authored alongside this migration in the
-- same cycle so the feature is not storage-only):
--   · src/lib/nex-native/shop-install/sync-shop-install-prefs.ts ·
--      server action implementing the merge rule. Tolerates table
--      absence (PG42P01 relation does not exist) → silent degrade to
--      guest-only path so the code can ship before apply.
--   · src/components/nex-native/shop-install/use-shop-install-flow.ts
--      hook wrapper `useSignedInShopInstallSync` that layers the
--      server state over localStorage for signed-in viewers only.
--
-- Rollback compatibility:
--   · See 369_nex_account_shop_install_prefs_rollback.sql.
--   · The rollback is DATA-DESTRUCTIVE · it deletes every signed-in
--      customer's saved dismissal + install state. The rollback file
--      documents the backup/recovery procedure (pg_dump …).
--   · After rollback, the application code still runs — the sync
--      action tolerates table absence — but signed-in viewers lose
--      cross-device continuity for any state recorded between apply
--      and rollback, and may see prompts they had already dismissed
--      on a sibling device.
--
-- NOT YET APPLIED to sandbox or production. Requires separate explicit
-- owner authorisation naming sandbox ref kdstoyyeygcopkogqsyv before
-- apply. Production project ijvqdvsvwtwxzcqmoqit remains sealed.
-- Approval phrase candidate:
--   APPROVE NEX_ACCOUNT SHOP_INSTALL_PREFS MIGRATION SANDBOX (REVISED 2026-11-27).

BEGIN;

CREATE TABLE IF NOT EXISTS public.nex_account_shop_install_prefs (
  account_id uuid NOT NULL REFERENCES public.nex_account(id) ON DELETE CASCADE,
  shop_slug text NOT NULL,
  dismissals smallint NOT NULL DEFAULT 0,
  first_dismiss_at timestamptz NULL,
  suppressed boolean NOT NULL DEFAULT false,
  installed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_account_shop_install_prefs_pk
    PRIMARY KEY (account_id, shop_slug),
  -- Byte-for-byte mirror of nex_business.slug CHECK (migration 002:35).
  -- 1..64 chars · lowercase alphanumerics + hyphens · can't start/end
  -- with a hyphen. Guarantees that every row stores a slug that could
  -- have come from a real NEX shop · malformed input is rejected at
  -- the DB level.
  CONSTRAINT nex_account_shop_install_prefs_shop_slug_fmt
    CHECK (shop_slug ~ '^[a-z0-9]([-a-z0-9]{0,62}[a-z0-9])?$'),
  CONSTRAINT nex_account_shop_install_prefs_dismissals_range
    CHECK (dismissals BETWEEN 0 AND 2),
  CONSTRAINT nex_account_shop_install_prefs_first_dismiss_required
    CHECK (
      (dismissals = 0 AND first_dismiss_at IS NULL)
      OR (dismissals >= 1 AND first_dismiss_at IS NOT NULL)
    )
);

COMMENT ON TABLE public.nex_account_shop_install_prefs IS
  'Owner-sealed 2026-11-27 · account-scoped mirror of the per-shop '
  'install dismissal + install state previously stored only in '
  'localStorage. One row per (account_id, shop_slug). Guest viewers '
  'continue to use localStorage; signed-in viewers reconcile through '
  'this table via sync-shop-install-prefs under the monotonic '
  '"most-advanced wins" merge rule documented in the forward migration '
  'header.';

COMMENT ON COLUMN public.nex_account_shop_install_prefs.shop_slug IS
  'Canonical NEX shop slug · byte-for-byte same CHECK as '
  'nex_business.slug (1..64 chars · lowercase alphanumerics + '
  'hyphens). NOT an FK so dismissal history survives rename / '
  'takedown / service-role deletion.';

COMMENT ON COLUMN public.nex_account_shop_install_prefs.dismissals IS
  '0 · 1 · 2 (permanent stop at 2 per Spec §C). Enforced range CHECK.';

COMMENT ON COLUMN public.nex_account_shop_install_prefs.first_dismiss_at IS
  'Wall-clock timestamp of the FIRST dismissal · required when '
  'dismissals ≥ 1 · null when dismissals = 0. Gates the 5-minute '
  're-show window implemented in useShopInstallDismissal.';

COMMENT ON COLUMN public.nex_account_shop_install_prefs.suppressed IS
  'Permanent suppression · set on second dismiss OR on install per '
  'Spec §C/§E. Monotonic (never flips back to false via sync).';

COMMENT ON COLUMN public.nex_account_shop_install_prefs.installed IS
  'Mirror of localStorage["nex_shop_installed_flags_v1"][slug] · set '
  'true when `appinstalled` fires for this shop in any signed-in '
  'session. Monotonic (never flips back to false via sync).';

-- updated_at auto-maintenance · uses the sealed nex_touch_updated_at
-- function defined in migration 002. Matches nex_business convention.
CREATE TRIGGER trg_nex_account_shop_install_prefs_touch_updated_at
  BEFORE UPDATE ON public.nex_account_shop_install_prefs
  FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at();

ALTER TABLE public.nex_account_shop_install_prefs
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_account_shop_install_prefs_owner_select
  ON public.nex_account_shop_install_prefs;
CREATE POLICY nex_account_shop_install_prefs_owner_select
  ON public.nex_account_shop_install_prefs
  FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT nex_current_account_ids()));

DROP POLICY IF EXISTS nex_account_shop_install_prefs_owner_insert
  ON public.nex_account_shop_install_prefs;
CREATE POLICY nex_account_shop_install_prefs_owner_insert
  ON public.nex_account_shop_install_prefs
  FOR INSERT
  TO authenticated
  WITH CHECK (account_id IN (SELECT nex_current_account_ids()));

DROP POLICY IF EXISTS nex_account_shop_install_prefs_owner_update
  ON public.nex_account_shop_install_prefs;
CREATE POLICY nex_account_shop_install_prefs_owner_update
  ON public.nex_account_shop_install_prefs
  FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT nex_current_account_ids()))
  WITH CHECK (account_id IN (SELECT nex_current_account_ids()));

DROP POLICY IF EXISTS nex_account_shop_install_prefs_owner_delete
  ON public.nex_account_shop_install_prefs;
CREATE POLICY nex_account_shop_install_prefs_owner_delete
  ON public.nex_account_shop_install_prefs
  FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT nex_current_account_ids()));

INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '369',
  'nex_account_shop_install_prefs · signed-in dismissal + install mirror',
  'Owner directive 2026-11-27 (revised cycle 2) unblocks server-side '
  'reconciliation of the branded shop install slide-in / button '
  'suppression state (currently guest-only via localStorage). One '
  'account-scoped table · composite PK (account_id, shop_slug) · RLS '
  'owner-only on all verbs via nex_current_account_ids() · no new '
  'functions · no backfill · shop_slug CHECK mirrors '
  'nex_business.slug · nex_touch_updated_at trigger attached.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
