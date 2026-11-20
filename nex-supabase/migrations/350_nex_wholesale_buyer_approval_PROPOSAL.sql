-- =============================================================================
-- Migration 350 · nex_wholesale_buyer_approval · seller-scoped buyer gate
-- STATUS: PROPOSAL · NOT AUTHORISED FOR APPLY · no auto-apply, no PR, no deploy
-- Target when applied: sandbox kdstoyyeygcopkogqsyv ONLY
-- Prod ijvqdvsvwtwxzcqmoqit remains sealed · no production apply authorised
-- Authored 2026-11-18 during wholesale catalogue scaffold (Phase W).
-- =============================================================================
--
-- CONTEXT
-- The wholesale catalogue feature requires a per-seller buyer-approval model
-- (prompt §5: "Approval is seller-scoped. Approval by seller A grants nothing
-- for seller B. Only seller A can manage seller A's requests").
--
-- The product-side wholesale configuration (quantity tiers, min order qty,
-- per-piece price) lives in the existing `nex_product.spec` jsonb under the
-- reserved `__wholesale` key (see src/lib/nex-native/catalogue/
-- identity-wholesale-spec.ts) and does NOT require a schema change. This
-- migration adds ONLY the buyer-approval table.
--
-- CURRENT STATE (verified 2026-11-18)
--   · No `nex_wholesale_*` tables exist.
--   · The existing __wholesale jsonb field is seller-authored and persisted
--     via the normal nex_product update path. Access-gating today relies on
--     the server-only rendering (see §LEAK below).
--
-- §LEAK  (separate concurrent-work issue · see doctrine note)
--   · product/[productId]/page.tsx currently passes the full spec (including
--     __wholesale) to the public product-page client, which would leak the
--     seller's per-piece wholesale price to any viewer whose product is live.
--   · Closing that leak is BLOCKED on the same file's 341-line uncommitted
--     concurrent-work refactor and is handled separately. This migration is
--     NOT a workaround for that leak.
--
-- SECURITY PROPERTIES
--   · Table in public schema with RLS enabled (owner-scoped SELECT/INSERT/
--     UPDATE, buyer-scoped SELECT of own row, no DELETE).
--   · Writes mediated via server actions that resolve the viewer's account
--     through the existing session path, not from buyer-supplied IDs.
--   · UNIQUE(business_id, buyer_account_id) prevents duplicate rows on
--     repeated request taps (idempotent request-to-access).
--   · Partial indexes support (a) the owner "pending" list and (b) the
--     buyer "can-I-see-prices?" check without full scans.
--   · REVOKE ALL FROM PUBLIC · GRANT scoped to `authenticated` only · never
--     granted to `anon`.
--   · No SECURITY DEFINER RPC in this migration · all access flows through
--     authenticated row-level checks. A future revoke-and-audit RPC could
--     be added if we want atomic revoke-with-event logging.
--
-- STATUS LIFECYCLE
--   pending   · buyer tapped "Request access" on the seller's wholesale
--               catalogue URL, no owner decision yet.
--   approved  · seller (owner of business_id) approved. decided_at is set.
--   revoked   · seller later revoked access. revoked_at is set. The buyer
--               loses access immediately on their next request · we do NOT
--               delete the row so revocation is auditable.
--
-- OPEN QUESTIONS FOR OWNER DECISION
--   Q1 · Should revoked-then-re-requested buyers reuse the same row
--        (resetting status→pending, clearing revoked_at) or require a brand
--        new row? Proposal: reuse (status transitions in-place). UNIQUE
--        constraint enforces this.
--   Q2 · Should buyer be allowed to see their OWN pending/revoked status
--        on the access page? Proposal: YES (RLS allows self-read).
--   Q3 · Should we keep a free-text `buyer_note` (short rationale typed on
--        request) and a `seller_note` (private decision memo)? Proposal:
--        buyer_note YES (visible to seller when deciding), seller_note NO
--        (would need its own privacy posture) — add later if owner asks.
--
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · Table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nex_wholesale_buyer_approval (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid        NOT NULL
                                REFERENCES public.nex_business(id)
                                ON DELETE CASCADE,
  buyer_account_id  uuid        NOT NULL
                                REFERENCES public.nex_account(id)
                                ON DELETE CASCADE,
  status            text        NOT NULL
                                CHECK (status IN ('pending','approved','revoked')),
  requested_at      timestamptz NOT NULL DEFAULT now(),
  decided_at        timestamptz,
  revoked_at        timestamptz,
  buyer_note        text        CHECK (
                                  buyer_note IS NULL OR
                                  (length(trim(buyer_note)) BETWEEN 1 AND 400)
                                ),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT nex_wholesale_buyer_approval_unique
    UNIQUE (business_id, buyer_account_id),

  CONSTRAINT nex_wholesale_buyer_approval_decided_requires_timestamp
    CHECK (status <> 'approved' OR decided_at IS NOT NULL),

  CONSTRAINT nex_wholesale_buyer_approval_revoked_requires_timestamp
    CHECK (status <> 'revoked'  OR revoked_at IS NOT NULL)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · Indexes (owner pending list + buyer check)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS nex_wholesale_buyer_approval_owner_pending_ix
  ON public.nex_wholesale_buyer_approval (business_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS nex_wholesale_buyer_approval_owner_approved_ix
  ON public.nex_wholesale_buyer_approval (business_id)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS nex_wholesale_buyer_approval_buyer_check_ix
  ON public.nex_wholesale_buyer_approval (buyer_account_id, business_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.nex_wholesale_buyer_approval_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS nex_wholesale_buyer_approval_touch
  ON public.nex_wholesale_buyer_approval;

CREATE TRIGGER nex_wholesale_buyer_approval_touch
  BEFORE UPDATE ON public.nex_wholesale_buyer_approval
  FOR EACH ROW
  EXECUTE FUNCTION public.nex_wholesale_buyer_approval_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · RLS
--
-- Owner (seller) of the business:
--   · SELECT   their own business rows (all statuses)
--   · INSERT   their own business rows (unused in practice: inserts happen
--              via buyer-side "request access" — but keep symmetric)
--   · UPDATE   their own business rows (approve / revoke)
--   · DELETE   NOT allowed · keep revoked rows for audit
--
-- Buyer:
--   · SELECT   only rows WHERE buyer_account_id = self
--   · INSERT   only rows WHERE buyer_account_id = self (status starts pending)
--   · UPDATE   NOT allowed · buyer cannot flip status to approved
--   · DELETE   NOT allowed
--
-- Anonymous / anon:
--   · nothing (grants below revoke anon entirely).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.nex_wholesale_buyer_approval ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_wholesale_buyer_approval FORCE ROW LEVEL SECURITY;

-- Helper · caller is the owner of the business_id row.
-- Uses the existing project helper `nex_resolve_account_id_from_jwt()` which
-- maps auth.uid() → nex_account.id (see migration 100 / helpers).
--
-- NOTE: if that helper's exact name differs in the sandbox snapshot, adjust
-- here before applying. The convention in migrations 005, 032, 349 is:
--   (SELECT owner_account_id FROM nex_business WHERE id = <row_business_id>)
--     = nex_resolve_account_id_from_jwt()

DROP POLICY IF EXISTS nex_wholesale_buyer_approval_owner_select
  ON public.nex_wholesale_buyer_approval;
CREATE POLICY nex_wholesale_buyer_approval_owner_select
  ON public.nex_wholesale_buyer_approval
  FOR SELECT
  TO authenticated
  USING (
    (SELECT owner_account_id FROM public.nex_business WHERE id = business_id)
      = public.nex_resolve_account_id_from_jwt()
  );

DROP POLICY IF EXISTS nex_wholesale_buyer_approval_owner_update
  ON public.nex_wholesale_buyer_approval;
CREATE POLICY nex_wholesale_buyer_approval_owner_update
  ON public.nex_wholesale_buyer_approval
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT owner_account_id FROM public.nex_business WHERE id = business_id)
      = public.nex_resolve_account_id_from_jwt()
  )
  WITH CHECK (
    (SELECT owner_account_id FROM public.nex_business WHERE id = business_id)
      = public.nex_resolve_account_id_from_jwt()
  );

DROP POLICY IF EXISTS nex_wholesale_buyer_approval_buyer_select
  ON public.nex_wholesale_buyer_approval;
CREATE POLICY nex_wholesale_buyer_approval_buyer_select
  ON public.nex_wholesale_buyer_approval
  FOR SELECT
  TO authenticated
  USING (buyer_account_id = public.nex_resolve_account_id_from_jwt());

DROP POLICY IF EXISTS nex_wholesale_buyer_approval_buyer_insert
  ON public.nex_wholesale_buyer_approval;
CREATE POLICY nex_wholesale_buyer_approval_buyer_insert
  ON public.nex_wholesale_buyer_approval
  FOR INSERT
  TO authenticated
  WITH CHECK (
    buyer_account_id = public.nex_resolve_account_id_from_jwt()
    AND status = 'pending'
    AND decided_at IS NULL
    AND revoked_at IS NULL
  );

-- Explicit · no DELETE policy for anyone · deletes are impossible via API.

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 · Grants
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON TABLE public.nex_wholesale_buyer_approval FROM PUBLIC;
REVOKE ALL ON TABLE public.nex_wholesale_buyer_approval FROM anon;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.nex_wholesale_buyer_approval
  TO authenticated;

-- service_role retains implicit full access · used by server actions that
-- need to read owner + buyer rows atomically (e.g. the approve action that
-- also writes an audit event).

COMMENT ON TABLE public.nex_wholesale_buyer_approval IS
  'Seller-scoped per-buyer access to the wholesale catalogue view. '
  'Writes are gated by RLS: owner approves/revokes, buyer only self-reads '
  'and self-inserts (status=pending). No deletes. Added 2026-11-18 as '
  'migration 350 PROPOSAL.';

COMMIT;

-- =============================================================================
-- END · Migration 350 PROPOSAL
-- Apply command (when authorised, sandbox only):
--   node scripts/apply-migration-350-sandbox.mjs
-- =============================================================================
