# Migration 318 · Sandbox Verification Procedure · P4 · 2026-11-10

**Status:** Prepared · not run yet. Requires owner authorisation.

## Target

- Sandbox Supabase project ref: `kdstoyyeygcopkogqsyv`
- Production `ijvqdvsvwtwxzcqmoqit` remains sealed. These steps MUST
  refuse to run against production.

## Hard rule

> **Sandbox migration success is NOT proof of end-to-end notification
> enforcement.** Every step below must pass. A single failure blocks
> code-level cutover.

## Deployment sequence (apply order is mandatory)

1. **Apply migration 318 to sandbox ONLY** via
   `scripts/apply-migration-<n>-sandbox.mjs` pattern used by prior
   migrations. The script MUST print the connection's project ref
   and abort if it is not `kdstoyyeygcopkogqsyv`.
2. **Verify the column + default against the actual sandbox DB**
   (step V1 below) before touching any TS.
3. **Update the preference service**
   (`notification-preferences-service.ts`): add `"order"` to the
   union, `order_enabled` to the interface, `true` to `DEFAULT_PREFS`,
   the `categoryField` case, the `getNotificationPrefs` row mapping
   with `?? true` coalescing to cover the deploy-order window, and
   the `updateNotificationPrefs` upsert row build.
4. **Switch the three event paths**
   (`order-notification-service.ts`): replace the direct
   `listPushSubscriptions + adapter.send` fanout with
   `dispatchPushNotification(recipient, "order", { kind: "system",
   title, body, data })` for all three events.
5. **Verify disabling `order_enabled` prevents push delivery**
   (step V3).
6. **Verify disabling `order_enabled` does NOT disable** message,
   call, reaction, mention, marketing (step V4).
7. **Verify missing preference records + DB failures behave correctly**
   (steps V5 + V6).
8. **Verify settings UI + existing preferences remain intact** (step V7).

---

## Verification steps

Each step has an expected observable and a pass/fail criterion.
Capture evidence (SQL output, log line, HTTP response) for each.
A step that CANNOT be verified is recorded as `UNVERIFIED`, never
coerced to pass.

### V1 · Column + default exist · sandbox DB

```sql
-- Run against sandbox pooler. Abort if current_setting
-- doesn't name the sandbox project ref.
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'nex_account_notification_prefs'
  and column_name = 'order_enabled';
```

Pass criteria:
- One row returned.
- `data_type = boolean`, `is_nullable = NO`, `column_default = true`.

### V2a · Existing account defaults (pre-migration row)

Pick an account that had a prefs row before migration 318:

```sql
-- Any account with an existing row:
select account_id, order_enabled
from nex_account_notification_prefs
limit 5;
```

Pass criteria: every row shows `order_enabled = true`. Prior
`message_enabled` / `call_enabled` / `reaction_enabled` /
`mention_enabled` / `marketing_enabled` values are unchanged
(compare against a pre-migration snapshot captured at step 1).

### V2b · New-account defaults (no row yet)

Pick an account that has NO row in the prefs table:

```sql
-- Confirm no row exists:
select 1 from nex_account_notification_prefs
where account_id = '<new-account-uuid>';
```

Then in TS console / test:

```ts
const prefs = await getNotificationPrefs("<new-account-uuid>");
// Expected: { message_enabled: true, call_enabled: true,
//   reaction_enabled: true, mention_enabled: true,
//   marketing_enabled: false, order_enabled: true }
```

Pass criteria: `order_enabled: true` by DEFAULT_PREFS fallback.

### V3 · Opting OUT suppresses order push

Set a row to `order_enabled = false`:

```sql
update nex_account_notification_prefs
set order_enabled = false
where account_id = '<test-buyer-uuid>';
```

Trigger each event (new_order, payment_confirmed, order_cancelled)
in sandbox with the test account as recipient. Dispatch returns
`{ attempted: 0, delivered: 0, skipped_reason: "disabled" }` for
every event.

Pass criteria:
- adapter.send is never called (confirm via test fixture or push-log).
- Dispatch return value matches.
- No notification lands on the test device.

### V4 · Opting OUT does NOT disable other categories

With the same account at `order_enabled = false` from V3, trigger
a peer-message push (category `"message"`). Confirm it IS delivered
(assuming the test account has `message_enabled = true` and a
subscription).

Pass criteria: `message` category dispatch returns
`{ attempted >= 1, delivered >= 1 }`. The message push lands on
the test device.

Repeat for `call`, `reaction`, `mention` using their respective
test triggers (incoming-call signal, reaction toggle, future mention).

### V5 · Missing preference record · defaults apply

Delete the prefs row for a test account:

```sql
delete from nex_account_notification_prefs
where account_id = '<test-account-uuid>';
```

Trigger a payment_confirmed event for that account. Expected:
dispatch reads row-absent, applies `DEFAULT_PREFS.order_enabled =
true`, attempts fanout to any subscriptions.

Pass criteria:
- `getNotificationPrefs` returns `DEFAULT_PREFS`.
- Dispatch result shows `attempted >= 0` (depending on
  subscriptions; what matters is that `skipped_reason` is NOT
  `"disabled"`).

### V6 · Preference DB failure · fail-closed

Simulate a DB outage. Options:
- Revoke the dispatch service's grant temporarily with a sandbox
  owner role.
- Or run the dispatch against a test-fixture instance where
  `getNotificationPrefs` is monkey-patched to throw.

Trigger an event. Expected: dispatch returns
`skipped_reason: "prefs_unavailable"` · no push goes out.

Pass criteria:
- adapter.send never called.
- Honest skipped_reason emitted.

### V7 · All three event types respect the order preference

Combined matrix test:

| Event | Recipient | order_enabled | Expected |
|---|---|---|---|
| new_order | seller | true | delivered |
| new_order | seller | false | skipped_reason=disabled |
| payment_confirmed | buyer | true | delivered |
| payment_confirmed | buyer | false | skipped_reason=disabled |
| order_cancelled | buyer | true | delivered |
| order_cancelled | buyer | false | skipped_reason=disabled |

Six rows, all must match.

### V8 · Settings UI + existing prefs intact

Open `/nex-native/settings/notifications` as the test account.
Pass criteria:
- A new toggle appears for order notifications, labelled to match
  the other category rows.
- Flipping it writes only `order_enabled`. Confirm by
  SELECT-ing the row before and after; every other column retains
  its prior value.
- Existing toggle for each other category reads and writes
  correctly.

---

## Rollback consequences (final)

If migration 318 is rolled back after users have saved
`order_enabled = false`:

- The column is dropped with the migration-reversal SQL. All stored
  opt-outs are lost.
- Users previously opted out start receiving order notifications
  again (DEFAULT_PREFS fallback = true + no column to override).
- Code must be rolled back in lock-step: revert the TS edits, revert
  the dispatcher switch in `order-notification-service.ts`. The
  service falls back to the direct-fanout code path already shipped.
- No ledger / PII / commerce-flow impact.

Mitigation if production rollback is ever needed (production remains
sealed today):

```sql
-- Preserve opt-outs before drop:
create table nex_account_notification_prefs_order_backup_<yyyy_mm_dd>
  as
  select account_id, order_enabled, now() as snapshot_at
  from nex_account_notification_prefs
  where order_enabled = false;
```

Restore on re-migration by UPDATE from the backup.

---

## Final launch gate

Only after V1–V8 all PASS and are evidence-captured does P4
acquire the full `preference-aware` status. Until then, P4 ships
with the direct-fanout service and `preference enforcement` is
honestly reported as `pending migration 318 verification`.

Production apply, deploy, and remote push are separately gated.
