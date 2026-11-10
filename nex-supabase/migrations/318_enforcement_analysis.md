# Migration 318 · Enforcement Analysis · P4 · 2026-11-10

**Status:** PROPOSAL · not applied · not authorised

## What the migration adds

```sql
alter table nex_account_notification_prefs
  add column if not exists order_enabled boolean not null default true;
```

One column, defaulted `TRUE`, non-breaking additive change. No RLS
policy additions — the existing owner-rw policy on
`nex_account_notification_prefs` already covers the column (RLS is
per-row, not per-column).

## How `order_enabled` gets enforced end-to-end

Enforcement rides the sealed notification stack (migrations 098 +
198) exactly like the other five categories. Nothing bespoke.

### 1 · Pref read site (`notification-preferences-service.ts`)

Three-line addition to the sealed service:

| Edit | File | Change |
|---|---|---|
| Union | `NotificationCategory` | add `\| "order"` |
| Interface | `NotificationPrefs` | add `readonly order_enabled: boolean` |
| Defaults | `DEFAULT_PREFS` | add `order_enabled: true` |
| Mapping | `categoryField` | add `case "order": return "order_enabled"` |
| Row mapping | `getNotificationPrefs` return | add `order_enabled: row.order_enabled` |
| Upsert | `updateNotificationPrefs` row build | add `order_enabled: next.order_enabled` |

Row absence remains handled by `DEFAULT_PREFS` (the column is already
NOT NULL + DEFAULT TRUE on the DB side, so once migration 318 applies,
every existing row picks up `order_enabled: true` immediately · new
accounts get `true` at row insert).

### 2 · Dispatch site (`notification-dispatch-service.ts`)

No code changes needed. The sealed `dispatchPushNotification` function
is already category-agnostic — it reads
`prefs[categoryField(category)]`, so adding a new category to the union
+ map propagates automatically.

Fail-closed rule still applies: if `getNotificationPrefs` throws, the
dispatch returns `skipped_reason: "prefs_unavailable"` and no push
goes out. An explicit `order_enabled = false` ALWAYS wins against a
service outage.

### 3 · Order service call site (`order-notification-service.ts`)

Post-migration follow-up replaces the direct `listPushSubscriptions +
adapter.send` fanout with:

```ts
await dispatchPushNotification(
  recipientAccountId,
  "order",
  {
    kind: "system",
    title,
    body,
    data: { orderId, url: deepLink, eventKind: kind },
  },
);
```

Result: `order` category pushes now ride the exact same gate as
`message` / `call` / `reaction` / `mention`. No bespoke pref check,
no bespoke bypass.

### 4 · Settings UI

`/nex-native/settings/notifications` already renders the prefs
form from `NotificationPrefs`. Adding `order_enabled` to the
interface automatically surfaces a toggle (tested path when `mention`
was added). Users can opt-OUT at any time.

## Security implications

- **No new RLS surface.** The existing per-account `_owner_rw`
  policy on `nex_account_notification_prefs` covers reads and
  writes for the whole row. A user can only read/write their OWN
  prefs row.
- **Service-role bypass unchanged.** `nexSupabaseAdmin` continues
  to read any account's prefs for dispatch — the dispatch service
  is the only server-side consumer and it was already trusted
  with every other category.
- **Fail-closed path unchanged.** Adding a column cannot regress
  the sealed fail-closed semantics in `dispatchPushNotification`.
- **Default rationale.** `TRUE` by default matches
  `message/call/reaction/mention` (all defaulted ON). Orders are
  transactional (payment confirmation, cancellation, new-order
  pings) — users need these to run their commerce. Marketing
  (OFF by default) is the exception because consent best practice
  requires explicit opt-IN; orders do not fit that bucket.

## Rollback plan

Non-destructive:

```sql
alter table nex_account_notification_prefs
  drop column if exists order_enabled;
```

Code rollback: revert the six small edits in `notification-
preferences-service.ts` + the follow-up switch in `order-
notification-service.ts`. No data loss · the column existed only
to carry a toggle.

If users have already saved `false` preferences and we rollback,
their explicit opt-OUT is lost (column dropped). Mitigation: do
NOT rollback after shipping unless absolutely required · prefer
flipping defaults or adding a kill-switch.

## Apply gate

Not applied until owner approves the SQL + this analysis. Target
is SANDBOX `kdstoyyeygcopkogqsyv` ONLY. Production
`ijvqdvsvwtwxzcqmoqit` remains sealed per the 2026-11-10 doctrine.
