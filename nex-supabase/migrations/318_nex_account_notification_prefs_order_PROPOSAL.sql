-- Migration 318 · order_enabled notification preference · P4 · 2026-11-10
-- =========================================================================
-- STATUS: PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- =========================================================================
--
-- Adds a sixth notification category column to the sealed
-- nex_account_notification_prefs table (mig 198).
--
-- Why this migration:
--   · P4 order event notifications (new-order to seller · payment-
--     confirmed to buyer · cancellation to buyer) currently bypass
--     the sealed category gate in dispatchPushNotification because
--     no "order" category exists.
--   · This migration adds order_enabled with a sensible transactional
--     default (TRUE) so users can still opt-OUT but the default
--     matches purchase-confirmation UX (users WANT these events).
--
-- Defaults rationale:
--   · TRUE · aligns with message/call/reaction/mention defaults ·
--     these are transactional business events the user needs to see
--     to track their commerce. Marketing-style promotional pings do
--     NOT ride this category · those stay on marketing_enabled (OFF
--     by default). Changing TRUE → FALSE requires an owner-signed
--     consent-doctrine revision.
--
-- Non-breaking · additive · no data migration needed:
--   · `alter table ... add column if not exists ... default true ...
--     not null` · existing rows pick up TRUE immediately.
--   · All existing dispatch call sites keep working · they use the
--     existing categories.
--
-- Post-apply code changes (follow-up commit):
--   · NotificationCategory union adds "order"
--   · NotificationPrefs interface adds order_enabled
--   · DEFAULT_PREFS adds order_enabled: true
--   · categoryField maps "order" → "order_enabled"
--   · order-notification-service switches from the direct subscription
--     fanout to dispatchPushNotification(..., "order", { kind: "system", ... })
--
-- Apply target: SANDBOX ONLY (kdstoyyeygcopkogqsyv) · production
-- (ijvqdvsvwtwxzcqmoqit) stays sealed per the 2026-11-10 seal.

alter table nex_account_notification_prefs
  add column if not exists order_enabled boolean not null default true;

comment on column nex_account_notification_prefs.order_enabled is
  'Transactional order notifications (new-order to seller · payment-confirmed to buyer · cancellation to buyer). Defaults TRUE because these are purchase-confirmation events users need to track their commerce. Users may opt-OUT via /nex-native/settings/notifications. Sealed 2026-11-10 P4.';
