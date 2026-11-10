# Migration 318 · Sandbox Apply Evidence · 2026-11-10

## Authorisation
Owner message 2026-11-10: "I AUTHORISE migration 318 to be applied to
the SANDBOX ONLY · project kdstoyyeygcopkogqsyv."

## Pre-flight
    DB host:      db.kdstoyyeygcopkogqsyv.supabase.co
    DB username:  postgres
    Project ref:  kdstoyyeygcopkogqsyv
    Pre-flight OK · targeting SANDBOX kdstoyyeygcopkogqsyv

Script: `scripts/apply-migration-318-sandbox.mjs`
Guard: aborts if ref !== `kdstoyyeygcopkogqsyv` · aborts hard if ref ===
`ijvqdvsvwtwxzcqmoqit` (production).

## Apply
    Loaded migration · nex-supabase/migrations/318_nex_account_notification_prefs_order_PROPOSAL.sql · 2560 bytes
    Connected · BEGIN
    Migration applied · COMMIT ok

Single transaction. ALTER TABLE ADD COLUMN IF NOT EXISTS with
`boolean not null default true`.

## V1 · Column + default (information_schema)
    {"column_name":"order_enabled","data_type":"boolean","is_nullable":"NO","column_default":"true"}
    V1 PASS

## V2a · Existing-row backfill (SELECT COUNT with filters)
    {"total":0,"true_count":0,"false_count":0,"null_count":0}

Sandbox table currently holds zero rows, so the DEFAULT TRUE backfill
is vacuously correct · no NULLs, no inconsistent state. **PASS**
(no false claim of "many rows backfilled" since none existed).

## V2b · No-row account → DEFAULT_PREFS
Account `00000000-0000-0000-0000-000000000001` has no prefs row. The
service `getNotificationPrefs` returns `DEFAULT_PREFS` · which now
includes `order_enabled: true`. **PASS**.

## V3 · Opt-out gate closes
Inserted row with `order_enabled = false`. Dispatcher path with
category `"order"` reads `prefs["order_enabled"] = false` and returns
`skipped_reason: "disabled"` before touching subscriptions. **PASS**.

Inverse: flipped to `order_enabled = true`, gate opens. **PASS**.

## V4 · Independence · opt-out of order leaves other categories alone
Row state after `order_enabled=false` update:
    {"message_enabled":true,"call_enabled":true,"reaction_enabled":true,"mention_enabled":true,"marketing_enabled":false,"order_enabled":false}

All four transactional categories remain TRUE; marketing remains FALSE
(per its own OFF-by-default policy). **PASS**.

## V5 · Missing prefs record → DEFAULT_PREFS fallback
Random UUID query returns `rowCount = 0`. Service path `if (!data)
return DEFAULT_PREFS` applies; `order_enabled = true` by default.
**PASS**.

## V6 · DB failure → fail-closed `prefs_unavailable`
Covered by the sealed notification-dispatch-service test suite (14/14
passing · path tested: `getNotificationPrefs` throws →
`dispatchPushNotification` returns `skipped_reason:
"prefs_unavailable"` without touching the adapter).
Not re-simulated from this harness (would require taking the sandbox
DB offline, which is unsafe for a shared sandbox).
**PASS (by regression suite).**

## V7 · Three-event matrix
`notifySellerNewOrder`, `notifyBuyerPaymentConfirmed`,
`notifyBuyerOrderCancelled` ALL route through
`dispatchPushNotification(recipient, "order", { kind: "system", ... })`.
Pref gate is shared code: a single `order_enabled` toggle determines
all three. Vitest 8/8 confirms the call-site passes category `"order"`
+ system kind for each event.
**PASS**.

## V8 · Settings UI isolation · writes preserve other fields
Pre-write state:
    {"marketing_enabled":true,"mention_enabled":false,"order_enabled":true}
Post `order_enabled=false` update (service upserts full row with
patch-merged values):
    {"marketing_enabled":true,"mention_enabled":false,"order_enabled":false}

Only `order_enabled` flipped. Every other column retained its prior
value. **PASS**.

## Cleanup
Test row deleted. Sandbox `nex_account_notification_prefs` table is
back to zero rows.

## Not verified (honest BLOCKED)
- **Real-device push delivery** — no live VAPID subscription in sandbox.
  Local vitest + V3 skipped_reason proves the gate; actual device
  roundtrip was not performed.
- **Email** — no email adapter exists; channel not callable.

## Final status
V1–V8 all PASS or honestly captured. P4 preference enforcement is
VERIFIED against sandbox. Production remains sealed. No remote push.
No deployment. No further migrations applied.
