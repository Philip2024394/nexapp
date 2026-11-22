-- 366_nex_notification.sql
--
-- NEX · durable in-app notification inbox.
-- Owner directive 2026-11-23 · "Connect the notifications drawer to
-- real app-wide notifications ... Persistent read/unread across
-- reloads/sessions ... Introduce a durable notification model and
-- delivery mechanism."
--
-- Follow-up directive 2026-11-23b · expand source enum to cover the
-- actually-implemented producers: contact requests (migration 215
-- `nex_friend_request`), peer messages, product inquiries. Verified
-- paid orders ride the existing Stripe + PayPal webhooks.
--
-- Status gates:
--   · Sandbox `kdstoyyeygcopkogqsyv` apply gated behind
--     scripts/apply-migration-366-sandbox.mjs which refuses any
--     non-sandbox pooler ref.
--   · Production `ijvqdvsvwtwxzcqmoqit` apply requires a separately
--     named approval. This migration MUST NOT run against prod from
--     any dev path.
--
-- Scope of the table:
--   · Store SERVER-ORIGIN notifications. The drawer reads the signed-in
--     user's rows and marks them read on tap.
--   · Independent of push delivery · a row is written here even when
--     the push fan-out fails or the user has push disabled. Push
--     success does NOT establish that someone saw the message ·
--     durable in-app records are the source of truth for "did the
--     recipient have a chance to see this".
--   · NEVER store:
--       - private chat message bodies (device-only E2E · sealed
--         Phase 2 doctrine 2026-11-09)
--       - bank details / payment credentials
--       - full order line-items (order_id reference is the only link)
--       - buyer notes / addresses / phone
--
-- source enum (verified against actual producers):
--   ACTIVE PRODUCERS (writer wired in this change):
--     'order_paid'        · Stripe/PayPal webhook after verified settlement
--     'contact_request'   · createFriendRequestAction (migration 215)
--     'contact_accepted'  · acceptFriendRequestAction (original sender gets a row)
--     'message'           · sendPeerMessageAction (grouped by conversation)
--     'inquiry'           · sendProductInquiryAction (grouped by product+buyer)
--   RESERVED (schema-forward only · NO writer today · do NOT claim live):
--     'system'            · generic server-origin event
--     'admin_announcement'· HQ announcement writer not yet built
--     'order_cancelled'   · writer gated on sellerCancelOrderAction wiring
--     'order_shipped'     · writer gated on dispatch-service wiring
--     'follow'            · writer gated on future follow feature
--
-- source_ref dedup scheme (per producer · the only exactly-once-created
-- guarantee this schema offers, via the UNIQUE partial index below):
--   order_paid       → 'order:<order_id>:paid'
--   contact_request  → 'friend_request:<request_id>'
--   contact_accepted → 'friend_request:<request_id>:accepted'
--   message          → 'msg:<conversation_id>'
--   inquiry          → 'inquiry:<product_id>:<buyer_account_id>'
--
-- Grouping + unread reset:
--   · Writers UPSERT via ON CONFLICT (recipient_account_id, source_ref)
--     DO UPDATE SET read_at = NULL, created_at = now(), title/subtitle
--     refreshed. New activity on an already-read group row atomically
--     flips it back to unread.
--
-- RLS:
--   · recipient-read: SELECT allowed when auth.uid() = recipient_account_id
--   · recipient-mark-read: UPDATE allowed only when auth.uid() =
--     recipient_account_id; column-level GRANT below pins the write
--     scope to `read_at` only.
--   · writes: service_role only (no anon / no authenticated INSERT).
--
-- Honest concurrency guarantees:
--   · Inbox row creation: exactly-once-created per (recipient, source_ref)
--     via UNIQUE partial index + ON CONFLICT writes.
--   · Grouping + unread reset: UPSERT ON CONFLICT DO UPDATE is atomic;
--     concurrent new-activity writes to the same group resolve to a
--     single row with the later created_at and read_at = NULL.
--   · Push dispatch: at-least-once from the webhook/action layer.
--     Exactly-once push is NOT guaranteed by this schema · callers
--     that need it must dedup at the provider-event-id layer BEFORE
--     calling the writer (see Stripe/PayPal webhook route notes).

BEGIN;

CREATE TABLE IF NOT EXISTS public.nex_notification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_account_id uuid NOT NULL REFERENCES public.nex_account(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_ref text NULL,
  category text NOT NULL,
  title text NOT NULL,
  subtitle text NOT NULL,
  href text NOT NULL,
  thumbnail_url text NULL,
  sender_account_id uuid NULL REFERENCES public.nex_account(id) ON DELETE SET NULL,
  profile_href text NULL,
  sender_has_shop boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz NULL,
  CONSTRAINT nex_notification_title_len CHECK (char_length(title) BETWEEN 1 AND 80),
  CONSTRAINT nex_notification_subtitle_len CHECK (char_length(subtitle) BETWEEN 1 AND 160),
  CONSTRAINT nex_notification_href_len CHECK (char_length(href) BETWEEN 1 AND 500),
  CONSTRAINT nex_notification_source_values CHECK (
    source IN (
      'order_paid',
      'contact_request',
      'contact_accepted',
      'message',
      'inquiry',
      'system',
      'admin_announcement',
      'order_cancelled',
      'order_shipped',
      'follow'
    )
  ),
  CONSTRAINT nex_notification_category_values CHECK (
    category IN ('chats', 'shop', 'orders', 'follows', 'system')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS nex_notification_recipient_source_ref_uniq
  ON public.nex_notification (recipient_account_id, source_ref)
  WHERE source_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS nex_notification_recipient_created_idx
  ON public.nex_notification (recipient_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS nex_notification_recipient_unread_idx
  ON public.nex_notification (recipient_account_id)
  WHERE read_at IS NULL;

ALTER TABLE public.nex_notification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_notification_recipient_select ON public.nex_notification;
CREATE POLICY nex_notification_recipient_select
  ON public.nex_notification
  FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_account_id);

DROP POLICY IF EXISTS nex_notification_recipient_mark_read ON public.nex_notification;
CREATE POLICY nex_notification_recipient_mark_read
  ON public.nex_notification
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_account_id)
  WITH CHECK (auth.uid() = recipient_account_id);

REVOKE ALL ON public.nex_notification FROM authenticated;
GRANT SELECT ON public.nex_notification TO authenticated;
GRANT UPDATE (read_at) ON public.nex_notification TO authenticated;

REVOKE ALL ON public.nex_notification FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nex_notification TO service_role;

INSERT INTO public.nex_migration_history (version, description, applied_at)
VALUES (
  '366',
  'durable in-app notification inbox (nex_notification + RLS + column grants)',
  now()
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
