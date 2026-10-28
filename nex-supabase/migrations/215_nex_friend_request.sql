-- 215_nex_friend_request.sql
--
-- Owner directive 2026-10-23 · wire the mock-complete Contacts page
-- (`/nex-native/contacts` · Connect-by-NEX-ID + inbound invitations +
-- Save-Contact category modal) to a real backend.
--
-- NEW TABLE · lives separately from the existing `nex_friend_edge`
-- (which handles the accepted-friendship record) because the pending
-- lifecycle has concepts the edge table doesn't model:
--   · 24h expiry from creation
--   · 72h cooldown after expiry/pass/cancel (sender re-invite block)
--   · Accepted category · `friends` | `business` · drives which
--     downstream record is created on accept (nex_friend_edge for
--     friends · nex_peer_conversation for business)
--   · Doctrine · sender NEVER sees explicit decline vs timeout ·
--     `passed` and `expired` are indistinguishable to the sender
--     (listPendingOutgoing omits non-pending rows)
--
-- Status transitions enforced by the service layer (friend-request-
-- service.ts) because PG CHECK can't express cross-row constraints
-- or the "cooldown prevents new row" rule:
--
--     pending  → accepted   (recipient taps Confirm → category chosen)
--     pending  → cancelled  (sender dismisses before recipient acts)
--     pending  → passed     (recipient explicitly declines · currently
--                            no UI for this · recipient lets it expire)
--     pending  → expired    (24h passed without action · service sweep
--                            OR per-query check)
--     * terminal states persist for 72h for the cooldown window ·
--       `cooldown_ends_at` carries the exact timestamp
--
-- RLS · sender sees own outbound · recipient sees own inbound ·
-- neither can read the other side's state transitions.

CREATE TABLE IF NOT EXISTS public.nex_friend_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sender · always a signed-in nex_account.
  sender_account_id uuid NOT NULL
    REFERENCES public.nex_account(id) ON DELETE CASCADE,

  -- Recipient · we store the handle the sender typed (nex-10842 form)
  -- AND the resolved account id. Separating these lets us:
  --   · Reject at insert time if the handle doesn't resolve (service
  --     looks up account_id first)
  --   · Keep the invite record even if the recipient later renames
  --     or deletes their account (handle stays as audit trail)
  recipient_nex_handle text NOT NULL
    CHECK (recipient_nex_handle ~ '^nex-\d+$'),
  recipient_account_id uuid
    REFERENCES public.nex_account(id) ON DELETE SET NULL,

  status text NOT NULL
    CHECK (status IN ('pending','accepted','passed','expired','cancelled')),

  -- 24h window · computed at insert (now() + interval '24 hours').
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,

  -- 72h cooldown window after a terminal state. Null while pending ·
  -- set when status flips to accepted/passed/expired/cancelled.
  cooldown_ends_at timestamptz,

  -- Accept-specific fields · only populated when status = accepted.
  accepted_category text
    CHECK (accepted_category IN ('friends','business')),
  accepted_at       timestamptz,
  -- Cancel-specific · when the SENDER dismissed before any response.
  cancelled_at      timestamptz,

  -- Sanity: expiry must be after creation.
  CHECK (expires_at > created_at),

  -- Status-field coherence · service must set these together.
  CHECK ((status = 'accepted') = (accepted_at IS NOT NULL)),
  CHECK ((status = 'accepted') = (accepted_category IS NOT NULL)),
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);

COMMENT ON TABLE  public.nex_friend_request IS
  'Pending friend/business connect invitations · 24h expiry · 72h cooldown · owner directive 2026-10-23';
COMMENT ON COLUMN public.nex_friend_request.accepted_category IS
  'friends → inserts into nex_friend_edge · business → opens nex_peer_conversation';
COMMENT ON COLUMN public.nex_friend_request.cooldown_ends_at IS
  'Terminal-state records persist for the cooldown · service rejects re-invites until now() > cooldown_ends_at';

-- Prevent sender from creating a second pending invite to the same
-- handle while the first is still live. Partial unique index on the
-- lowered handle so NEX-10842 and nex-10842 collide. The service
-- enforces cooldown separately against terminal rows.
CREATE UNIQUE INDEX IF NOT EXISTS nex_friend_request_unique_pending
  ON public.nex_friend_request (sender_account_id, lower(recipient_nex_handle))
  WHERE status = 'pending';

-- Hot read paths · the UI lists pending by account.
CREATE INDEX IF NOT EXISTS nex_friend_request_sender_pending_idx
  ON public.nex_friend_request (sender_account_id, status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS nex_friend_request_recipient_pending_idx
  ON public.nex_friend_request (recipient_account_id, status)
  WHERE status = 'pending' AND recipient_account_id IS NOT NULL;

-- Cooldown lookup · "has this sender invited this handle in the last
-- 72h, pending or terminal?". Covers the Connect-form guard.
CREATE INDEX IF NOT EXISTS nex_friend_request_cooldown_lookup_idx
  ON public.nex_friend_request (sender_account_id, lower(recipient_nex_handle), cooldown_ends_at);

-- Row-Level Security · owners of each side see only their own rows.
ALTER TABLE public.nex_friend_request ENABLE ROW LEVEL SECURITY;

-- Senders · SELECT their own outbound regardless of status.
CREATE POLICY nex_friend_request_sender_select
  ON public.nex_friend_request FOR SELECT
  USING (
    sender_account_id IN (
      SELECT id FROM public.nex_account
      WHERE supabase_user_id = auth.uid()
    )
  );

-- Recipients · SELECT their own inbound regardless of status.
CREATE POLICY nex_friend_request_recipient_select
  ON public.nex_friend_request FOR SELECT
  USING (
    recipient_account_id IN (
      SELECT id FROM public.nex_account
      WHERE supabase_user_id = auth.uid()
    )
  );

-- Senders · INSERT a new invite (must set their own sender_account_id).
CREATE POLICY nex_friend_request_sender_insert
  ON public.nex_friend_request FOR INSERT
  WITH CHECK (
    sender_account_id IN (
      SELECT id FROM public.nex_account
      WHERE supabase_user_id = auth.uid()
    )
  );

-- Senders · UPDATE their own outbound (cancel).
CREATE POLICY nex_friend_request_sender_update
  ON public.nex_friend_request FOR UPDATE
  USING (
    sender_account_id IN (
      SELECT id FROM public.nex_account
      WHERE supabase_user_id = auth.uid()
    )
  );

-- Recipients · UPDATE their own inbound (accept / pass).
CREATE POLICY nex_friend_request_recipient_update
  ON public.nex_friend_request FOR UPDATE
  USING (
    recipient_account_id IN (
      SELECT id FROM public.nex_account
      WHERE supabase_user_id = auth.uid()
    )
  );

-- GRANT the service-role & authenticated role · service-role writes
-- directly, authenticated reads via the policies above.
GRANT SELECT, INSERT, UPDATE ON public.nex_friend_request TO authenticated;
GRANT ALL ON public.nex_friend_request TO service_role;
