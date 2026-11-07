# NEX Chat · Disappearing Messages · Architecture

**Owner-sealed** · 2026-11-07
**Status** · design complete · account-default UI + service shipped (commit this cycle) · per-message `disappearing_at` + purge job prepared but not wired · owner approval required per phase.

## Core principles (owner-locked 2026-11-07)

1. **Device-centred** · the server never gains new plaintext storage of message content. Timers are metadata on existing message rows; message bodies continue to use the existing ciphertext/retention model.
2. **No unnecessary retention** · if a message is set to disappear, the server removes it when the timer elapses (ciphertext + attachment).
3. **Sender-owned default** · YOUR default applies to messages YOU send. Contacts' own sends use their own default. Per-chat overrides deferred to a later phase.
4. **Honest UX** · the settings page says exactly which phase is live; selecting "immediately after view" today saves the preference but activates only when the per-message column + read-stamp wire-in lands.

## Phase map

| Phase | Deliverable | Status |
|---|---|---|
| **0 · Preference storage** | `nex_account.default_disappearing_messages_seconds` column + service + UI sub-page | ✅ COMMITTED this cycle (migration 282 prepared, not applied; UI works via sealed OFF default) |
| **1 · Per-message timer column** | `nex_peer_message.disappearing_at timestamptz` + index | 📋 Prepared in this doc (migration 283 outlined below) · NOT yet drafted in-tree |
| **2 · Send-time stamping** | `peer-message-service.sendPeerMessage` reads sender's default and stamps `disappearing_at` | 🔲 Needs Phase 1 applied |
| **3 · After-view stamping** | `markPeerMessagesRead` stamps `disappearing_at = read_at + 30s` for messages with sentinel -1 | 🔲 Needs Phase 1 applied |
| **4 · Purge job** | SQL function `nex_purge_expired_peer_messages()` + scheduled run (pg_cron OR external) | 🔲 Needs Phase 1 applied |
| **5 · Per-chat override** | `nex_peer_conversation.disappearing_mode` column + per-chat picker UI | 🔲 Separate authorisation |
| **6 · Live countdown** | Client-side bubble renderer showing "expires in Nm" ticking down | 🔲 Separate authorisation |

## Sentinel values (owner-locked)

Stored as integer seconds in `default_disappearing_messages_seconds`:

| Value | Meaning | UI label |
|---|---|---|
| `0` | OFF · keep forever | Off |
| `-1` | Immediately after view · stamp `disappearing_at = read_at + 30s grace` | Immediately after view |
| `300` | 5 minutes after send | 5 minutes |
| `1800` | 30 minutes after send | 30 minutes |
| `3600` | 1 hour after send | 1 hour |
| `86400` | 24 hours after send | 24 hours |
| `604800` | 7 days after send | 7 days |

CHECK constraint: `default_disappearing_messages_seconds >= -1` · future positive values permitted for extensibility.

## Phase 1 migration draft (NOT APPLIED)

```sql
-- 283_nex_peer_message_disappearing_at.sql · DRAFT · DO NOT APPLY
-- -----------------------------------------------------------------------------
alter table nex_peer_message
  add column if not exists disappearing_at timestamptz;

create index if not exists nex_peer_message_disappearing_at_idx
  on nex_peer_message (disappearing_at)
  where disappearing_at is not null;

comment on column nex_peer_message.disappearing_at is
  'Owner-sealed 2026-11-07 · when non-null, the row is eligible for
   deletion by the purge job at or after this timestamp. Set at send
   time by peer-message-service based on the sender''s default timer.
   Null = message is permanent (default disappearing is OFF).';
```

## Phase 2 wire-in (send-time stamping)

In `peer-message-service.sendPeerMessage`, after resolving the sender's account:

```ts
import {
  computeExpiresAtAtSendTime,
  getDisappearingDefaultSafe,
} from "./disappearing-messages-service";

const senderDefault = await getDisappearingDefaultSafe(senderAccountId);
const disappearingAt = computeExpiresAtAtSendTime(senderDefault, new Date());

// Include in the insert payload:
//   disappearing_at: disappearingAt
```

## Phase 3 wire-in (after-view stamping)

In `peer-message-service.markPeerMessagesRead`, when a message is being marked read AND its current `disappearing_at` is null AND the sender's default was `-1`:

```ts
import {
  AFTER_VIEW_GRACE_SECONDS,
  computeExpiresAtAtReadTime,
} from "./disappearing-messages-service";

// For each message being marked read:
//   if message.disappearing_at is null:
//     look up sender's current default (cached per batch)
//     if sender default === -1:
//       stamp disappearing_at = new Date() + 30s grace
```

Edge case: the sender may change their default AFTER sending. We honour the default AT THE TIME OF SEND for positive-integer values (timer runs from send) but the `-1` sentinel is resolved AT THE TIME OF READ. This matches WhatsApp-style semantics where a mid-flight preference change doesn't retroactively affect already-sent messages.

## Phase 4 purge job

Preferred: Supabase cron (pg_cron extension) running every 60 seconds:

```sql
create or replace function public.nex_purge_expired_peer_messages()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n int;
begin
  delete from nex_peer_message
  where disappearing_at is not null
    and disappearing_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Schedule via pg_cron:
--   select cron.schedule('nex-purge-expired-peer-messages', '* * * * *',
--     $$select public.nex_purge_expired_peer_messages()$$);
```

Alternative if pg_cron is unavailable: an external scheduler (Vercel cron, GitHub Actions on schedule, or NEX-internal cron) calls a signed server action that invokes the SQL function.

**Attachment cleanup**: existing Bridge 78 purge sweeps attachments on message-row delete. No new attachment code required · the DELETE above fires the sealed cascade.

## Phase 5 per-chat override (deferred)

Would add `nex_peer_conversation.disappearing_mode text NULL` with an enum of `('default','off','5m','30m','1h','24h','7d','after_view')`. The send path would read the override FIRST, falling back to the sender's account default. UI = a per-chat gear icon → short modal.

## Honest limits (document in UI copy when shipped)

- **Device-local copies** · recipients' native apps may persist a local copy independent of server retention. NEX cannot force-remove messages from devices that have already received them.
- **Screenshots** · "disappearing" does not mean "unscreenshottable". Phase 5 of the Chat Settings Hub roadmap (screenshot & copy protection) addresses that separately.
- **Partial-read scenarios** · "immediately after view" uses the first `read_at` timestamp. A user with multiple devices sees the message disappear on all devices once any device reads it.
- **Server outages** · if the purge job fails to run, messages may persist past their intended expiry. The cron is monitored via standard Supabase observability (owner-configured).

## Owner-authorisation gates before next phase ships

- [ ] Review + approve migration 282 for production application
- [ ] Draft + review migration 283 (per-message `disappearing_at` column)
- [ ] Review + approve migration 283 for production application
- [ ] Approve `peer-message-service` send-time stamping wire-in
- [ ] Approve `markPeerMessagesRead` after-view stamping wire-in
- [ ] Decide pg_cron vs external scheduler for the purge job
- [ ] Approve purge job for production enablement
