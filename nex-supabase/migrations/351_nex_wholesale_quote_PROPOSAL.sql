-- =============================================================================
-- Migration 351 · nex_wholesale_quote · freight-on-request quotes
-- STATUS: PROPOSAL · NOT AUTHORISED FOR APPLY · no auto-apply, no PR, no deploy
-- Target when applied: sandbox kdstoyyeygcopkogqsyv ONLY
-- Prod ijvqdvsvwtwxzcqmoqit remains sealed · no production apply authorised
-- Authored 2026-11-18 during wholesale catalogue scaffold (Phase W).
-- =============================================================================
--
-- CONTEXT · master prompt §3
--   NEX wholesale deliberately does NOT maintain country-by-country shipping
--   tables. Freight is quoted per order by the seller once the buyer has an
--   approved shortlist, and the buyer must EXPLICITLY accept the quote
--   before any payment is enabled.
--
--   The chat handoff for "contact seller to place an order" is the existing
--   nex_peer_message system. This table is NOT a chat replacement · it is a
--   structured sibling row that both parties can track by status, and that
--   locks in the exact goods+freight+transit terms being agreed.
--
--   This migration is PROPOSAL-only. Phase W buyer-card UI currently
--   displays the freight copy ("Freight excluded — quote required") as a
--   static read; no row of this type is written yet.
--
-- DEPENDENCIES
--   · nex_business (owner lookup)         · exists in sandbox + prod
--   · nex_account  (buyer identity)       · exists in sandbox + prod
--   · nex_product  (goods identity)       · exists in sandbox + prod
--   · nex_wholesale_buyer_approval        · migration 350 PROPOSAL
--
--   This migration should be applied AFTER 350. The buyer-approval row is
--   referenced indirectly via (business_id, buyer_account_id) rather than a
--   FK into the approval table, so this migration will apply standalone
--   too — but the server-action that writes a quote MUST re-check the
--   approval before inserting.
--
-- SECURITY PROPERTIES
--   · public schema, RLS enabled + FORCE.
--   · Owner (seller) can SELECT/INSERT/UPDATE rows for their business.
--   · Buyer can SELECT own row and UPDATE only `buyer_accepted_at` /
--     `buyer_rejected_at` / `buyer_note` fields via a check in the server
--     action (RLS allows the UPDATE; the action enforces the field set).
--   · No DELETE for anyone · quote history is immutable audit.
--   · REVOKE ALL FROM anon · GRANT scoped to authenticated.
--   · No SECURITY DEFINER RPC introduced here.
--
-- PRICE STORAGE
--   All money is integer pence/minor units. Currency is carried by the
--   enclosing product row (nex_product.currency); the quote mirrors it at
--   write-time so that later currency changes on the product do not
--   silently rewrite a historical quote's effective price.
--
-- STATUS LIFECYCLE
--   draft      · seller preparing, not yet sent.
--   quoted     · seller sent quote to buyer. quoted_at set.
--   accepted   · buyer accepted. buyer_accepted_at set. Downstream payment
--                enable is gated on this row being 'accepted' AND unexpired.
--   rejected   · buyer declined. buyer_rejected_at set.
--   expired    · quoted_at + <expiry window> passed without acceptance.
--                Expiry is enforced by a partial index + application check
--                — this migration does NOT install a cron.
--   cancelled  · seller withdrew the quote after sending but before accept.
--
-- OPEN QUESTIONS FOR OWNER DECISION
--   Q1 · Quote expiry default. Proposal: 14 days. Overridable per quote.
--   Q2 · Duties/VAT disposition enum values. Proposal: ('seller_pays',
--        'buyer_pays', 'unspecified'). "DDP" / "DAP" shorthand is kept OUT
--        to avoid Incoterms misuse; the seller writes exact terms in
--        `terms_note` if the deal is DDP/DAP.
--   Q3 · Whether a single wholesale order can span multiple products.
--        Proposal: NO for Phase W · quote.product_id is required. A
--        multi-line order requires a separate migration and changes the
--        legacy snapshot-doctrine commitment (sealed 2026-11-10).
--   Q4 · Should buyer-accept be allowed only once per quote (no flip-flop)?
--        Proposal: YES — once accepted or rejected, the row is terminal
--        from the buyer side. Seller can issue a new quote by creating a
--        new row.
--
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · Table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nex_wholesale_quote (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  business_id               uuid        NOT NULL
                                        REFERENCES public.nex_business(id)
                                        ON DELETE CASCADE,
  buyer_account_id          uuid        NOT NULL
                                        REFERENCES public.nex_account(id)
                                        ON DELETE CASCADE,
  product_id                uuid        NOT NULL
                                        REFERENCES public.nex_product(id)
                                        ON DELETE RESTRICT,

  -- Buyer-facing terms · locked at quote time.
  quantity                  integer     NOT NULL CHECK (quantity > 0),
  currency                  text        NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  goods_unit_price_pence    bigint      NOT NULL CHECK (goods_unit_price_pence >= 0),
  goods_subtotal_pence      bigint      NOT NULL CHECK (goods_subtotal_pence >= 0),

  -- Freight · quoted, not computed.
  freight_pence             bigint      CHECK (freight_pence IS NULL OR freight_pence >= 0),
  freight_method            text        CHECK (
                                          freight_method IS NULL OR
                                          length(trim(freight_method)) BETWEEN 1 AND 120
                                        ),
  transit_days_min          integer     CHECK (transit_days_min IS NULL OR transit_days_min >= 0),
  transit_days_max          integer     CHECK (transit_days_max IS NULL OR transit_days_max >= 0),

  -- Duties/VAT disposition at agreed terms.
  duties_disposition        text        CHECK (
                                          duties_disposition IS NULL OR
                                          duties_disposition IN ('seller_pays','buyer_pays','unspecified')
                                        ),

  -- Free-form narrative terms the seller + buyer agreed on. No HTML, trimmed.
  terms_note                text        CHECK (
                                          terms_note IS NULL OR
                                          (length(trim(terms_note)) BETWEEN 1 AND 2000)
                                        ),

  -- Lifecycle.
  status                    text        NOT NULL DEFAULT 'draft'
                                        CHECK (status IN ('draft','quoted','accepted','rejected','expired','cancelled')),
  quoted_at                 timestamptz,
  buyer_accepted_at         timestamptz,
  buyer_rejected_at         timestamptz,
  cancelled_at              timestamptz,
  expires_at                timestamptz,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  -- State coherence. Each terminal status requires its matching timestamp.
  CONSTRAINT nex_wholesale_quote_quoted_requires_timestamp
    CHECK (status <> 'quoted'    OR quoted_at         IS NOT NULL),
  CONSTRAINT nex_wholesale_quote_accepted_requires_timestamp
    CHECK (status <> 'accepted'  OR buyer_accepted_at IS NOT NULL),
  CONSTRAINT nex_wholesale_quote_rejected_requires_timestamp
    CHECK (status <> 'rejected'  OR buyer_rejected_at IS NOT NULL),
  CONSTRAINT nex_wholesale_quote_cancelled_requires_timestamp
    CHECK (status <> 'cancelled' OR cancelled_at      IS NOT NULL),

  -- Transit range sanity.
  CONSTRAINT nex_wholesale_quote_transit_range
    CHECK (
      transit_days_min IS NULL OR transit_days_max IS NULL OR
      transit_days_min <= transit_days_max
    )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · Indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS nex_wholesale_quote_owner_live_ix
  ON public.nex_wholesale_quote (business_id, status)
  WHERE status IN ('quoted', 'accepted');

CREATE INDEX IF NOT EXISTS nex_wholesale_quote_buyer_inbox_ix
  ON public.nex_wholesale_quote (buyer_account_id, status, quoted_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS nex_wholesale_quote_expires_ix
  ON public.nex_wholesale_quote (expires_at)
  WHERE status = 'quoted' AND expires_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.nex_wholesale_quote_touch_updated_at()
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

DROP TRIGGER IF EXISTS nex_wholesale_quote_touch
  ON public.nex_wholesale_quote;

CREATE TRIGGER nex_wholesale_quote_touch
  BEFORE UPDATE ON public.nex_wholesale_quote
  FOR EACH ROW
  EXECUTE FUNCTION public.nex_wholesale_quote_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.nex_wholesale_quote ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_wholesale_quote FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_wholesale_quote_owner_select
  ON public.nex_wholesale_quote;
CREATE POLICY nex_wholesale_quote_owner_select
  ON public.nex_wholesale_quote
  FOR SELECT
  TO authenticated
  USING (
    (SELECT owner_account_id FROM public.nex_business WHERE id = business_id)
      = public.nex_resolve_account_id_from_jwt()
  );

DROP POLICY IF EXISTS nex_wholesale_quote_owner_insert
  ON public.nex_wholesale_quote;
CREATE POLICY nex_wholesale_quote_owner_insert
  ON public.nex_wholesale_quote
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT owner_account_id FROM public.nex_business WHERE id = business_id)
      = public.nex_resolve_account_id_from_jwt()
  );

DROP POLICY IF EXISTS nex_wholesale_quote_owner_update
  ON public.nex_wholesale_quote;
CREATE POLICY nex_wholesale_quote_owner_update
  ON public.nex_wholesale_quote
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

DROP POLICY IF EXISTS nex_wholesale_quote_buyer_select
  ON public.nex_wholesale_quote;
CREATE POLICY nex_wholesale_quote_buyer_select
  ON public.nex_wholesale_quote
  FOR SELECT
  TO authenticated
  USING (buyer_account_id = public.nex_resolve_account_id_from_jwt());

DROP POLICY IF EXISTS nex_wholesale_quote_buyer_update
  ON public.nex_wholesale_quote;
CREATE POLICY nex_wholesale_quote_buyer_update
  ON public.nex_wholesale_quote
  FOR UPDATE
  TO authenticated
  USING (buyer_account_id = public.nex_resolve_account_id_from_jwt())
  WITH CHECK (buyer_account_id = public.nex_resolve_account_id_from_jwt());
-- NB: RLS limits WHICH ROWS an authenticated buyer may update (their own
-- row). PostgreSQL has no column-level WITH CHECK that can compare OLD
-- vs NEW values; the column-level restriction is enforced by the trigger
-- `nex_wholesale_quote_buyer_column_guard_t` installed below. This
-- separates DB enforcement (trigger) from application enforcement
-- (server action) so neither relies on the other.

-- No DELETE policy for anyone · quote rows are retained for audit.

-- ─────────────────────────────────────────────────────────────────────────────
-- 4b · Buyer-column trigger guard (defence-in-depth for buyer UPDATE)
-- ─────────────────────────────────────────────────────────────────────────────
-- Added 2026-11-18 after the W21 review: RLS alone cannot prevent a
-- directly-authenticated buyer (anon-key + buyer JWT, bypassing the
-- server action) from updating seller-controlled columns on their own
-- row. This trigger enforces the exact buyer-mutable column set at the
-- DB level.
--
-- Semantics
--   · When v_actor_id IS NULL (service-role / maintenance callers that
--     do not carry a JWT) the trigger short-circuits · RLS is bypassed
--     by those callers anyway and application code is trusted to enforce
--     discipline.
--   · When v_actor_id = business owner · the trigger short-circuits
--     (seller may freely edit their quote under the owner UPDATE policy).
--   · Otherwise the caller is treated as the buyer · every
--     seller-controlled / identity-anchoring / lifecycle-timestamp
--     column must equal its OLD value, and `status` may only move
--     from 'quoted' to 'accepted' or 'rejected'.
--
-- Columns a buyer MAY modify
--   · status (only the quoted → accepted|rejected transition, above)
--   · buyer_accepted_at
--   · buyer_rejected_at
--   · updated_at (populated by the touch trigger regardless)
--
-- Columns a buyer MAY NOT modify (any divergence raises)
--   · business_id, buyer_account_id, product_id, quantity, currency,
--     goods_unit_price_pence, goods_subtotal_pence, freight_pence,
--     freight_method, transit_days_min, transit_days_max,
--     duties_disposition, terms_note, quoted_at, cancelled_at,
--     expires_at, created_at.

CREATE OR REPLACE FUNCTION public.nex_wholesale_quote_buyer_column_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id uuid := public.nex_resolve_account_id_from_jwt();
  v_owner_id uuid;
BEGIN
  -- Service-role / unauthenticated maintenance callers: trigger does not
  -- apply. RLS is already bypassed for these roles and application code
  -- is trusted to enforce column discipline through the server actions.
  IF v_actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT owner_account_id INTO v_owner_id
    FROM public.nex_business
    WHERE id = NEW.business_id;

  -- Seller / owner path: unrestricted column discipline. The owner
  -- UPDATE policy gates row visibility; the owner may legitimately
  -- revise any field on their own quote.
  IF v_actor_id = v_owner_id THEN
    RETURN NEW;
  END IF;

  -- Buyer path: enforce exact column discipline.
  IF NEW.business_id            IS DISTINCT FROM OLD.business_id            THEN RAISE EXCEPTION 'nex_wholesale_quote: buyer may not modify business_id'; END IF;
  IF NEW.buyer_account_id       IS DISTINCT FROM OLD.buyer_account_id       THEN RAISE EXCEPTION 'nex_wholesale_quote: buyer may not modify buyer_account_id'; END IF;
  IF NEW.product_id             IS DISTINCT FROM OLD.product_id             THEN RAISE EXCEPTION 'nex_wholesale_quote: buyer may not modify product_id'; END IF;
  IF NEW.quantity               IS DISTINCT FROM OLD.quantity               THEN RAISE EXCEPTION 'nex_wholesale_quote: buyer may not modify quantity'; END IF;
  IF NEW.currency               IS DISTINCT FROM OLD.currency               THEN RAISE EXCEPTION 'nex_wholesale_quote: buyer may not modify currency'; END IF;
  IF NEW.goods_unit_price_pence IS DISTINCT FROM OLD.goods_unit_price_pence THEN RAISE EXCEPTION 'nex_wholesale_quote: buyer may not modify goods_unit_price_pence'; END IF;
  IF NEW.goods_subtotal_pence   IS DISTINCT FROM OLD.goods_subtotal_pence   THEN RAISE EXCEPTION 'nex_wholesale_quote: buyer may not modify goods_subtotal_pence'; END IF;
  IF NEW.freight_pence          IS DISTINCT FROM OLD.freight_pence          THEN RAISE EXCEPTION 'nex_wholesale_quote: buyer may not modify freight_pence'; END IF;
  IF NEW.freight_method         IS DISTINCT FROM OLD.freight_method         THEN RAISE EXCEPTION 'nex_wholesale_quote: buyer may not modify freight_method'; END IF;
  IF NEW.transit_days_min       IS DISTINCT FROM OLD.transit_days_min       THEN RAISE EXCEPTION 'nex_wholesale_quote: buyer may not modify transit_days_min'; END IF;
  IF NEW.transit_days_max       IS DISTINCT FROM OLD.transit_days_max       THEN RAISE EXCEPTION 'nex_wholesale_quote: buyer may not modify transit_days_max'; END IF;
  IF NEW.duties_disposition     IS DISTINCT FROM OLD.duties_disposition     THEN RAISE EXCEPTION 'nex_wholesale_quote: buyer may not modify duties_disposition'; END IF;
  IF NEW.terms_note             IS DISTINCT FROM OLD.terms_note             THEN RAISE EXCEPTION 'nex_wholesale_quote: buyer may not modify terms_note'; END IF;
  IF NEW.quoted_at              IS DISTINCT FROM OLD.quoted_at              THEN RAISE EXCEPTION 'nex_wholesale_quote: buyer may not modify quoted_at'; END IF;
  IF NEW.cancelled_at           IS DISTINCT FROM OLD.cancelled_at           THEN RAISE EXCEPTION 'nex_wholesale_quote: buyer may not modify cancelled_at'; END IF;
  IF NEW.expires_at             IS DISTINCT FROM OLD.expires_at             THEN RAISE EXCEPTION 'nex_wholesale_quote: buyer may not modify expires_at'; END IF;
  IF NEW.created_at             IS DISTINCT FROM OLD.created_at             THEN RAISE EXCEPTION 'nex_wholesale_quote: buyer may not modify created_at'; END IF;

  -- Status transition discipline: buyer may only move quoted → accepted
  -- or quoted → rejected. Anything else is a protocol violation.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status <> 'quoted' THEN
      RAISE EXCEPTION 'nex_wholesale_quote: buyer may only transition from status=quoted (was %)', OLD.status;
    END IF;
    IF NEW.status NOT IN ('accepted','rejected') THEN
      RAISE EXCEPTION 'nex_wholesale_quote: buyer may only transition to accepted or rejected (got %)', NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS nex_wholesale_quote_buyer_column_guard_t
  ON public.nex_wholesale_quote;

CREATE TRIGGER nex_wholesale_quote_buyer_column_guard_t
  BEFORE UPDATE ON public.nex_wholesale_quote
  FOR EACH ROW
  EXECUTE FUNCTION public.nex_wholesale_quote_buyer_column_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 · Grants
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON TABLE public.nex_wholesale_quote FROM PUBLIC;
REVOKE ALL ON TABLE public.nex_wholesale_quote FROM anon;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.nex_wholesale_quote
  TO authenticated;

COMMENT ON TABLE public.nex_wholesale_quote IS
  'Per-order freight-on-request quotes for NEX wholesale. Seller writes '
  'goods+freight+transit terms; buyer accepts/rejects explicitly before '
  'any payment is enabled. Added 2026-11-18 as migration 351 PROPOSAL. '
  'Money stored as integer pence/minor units. Currency mirrored from the '
  'source product at quote time.';

COMMIT;

-- =============================================================================
-- END · Migration 351 PROPOSAL
-- Apply command (when authorised, sandbox only):
--   node scripts/apply-migration-351-sandbox.mjs
-- Preconditions: migration 350 PROPOSAL applied (same sandbox).
-- =============================================================================
