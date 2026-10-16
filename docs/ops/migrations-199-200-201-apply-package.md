# Migration Apply Package · 199 / 200 / 201 · R9 + R10 + R14

**Status:** READY FOR OWNER APPROVAL — not yet applied.
**Prepared:** 2026-10-15.
**Target project:** `ijvqdvsvwtwxzcqmoqit` (sealed per `CLAUDE.md § 8`).
**Prepared by:** Settings implementation workstream.
**Stops at:** the live-write approval gate. Nothing in this package
touches the live database.

---

## 1 · Target identity

Before any `psql` or Supabase SQL Editor action, verify:

| Fact | Expected value |
|---|---|
| Project ref | `ijvqdvsvwtwxzcqmoqit` |
| Project URL | `https://ijvqdvsvwtwxzcqmoqit.supabase.co` |
| Pooler host | `aws-0-eu-west-1.pooler.supabase.com` |
| Env var that routes code there | `NEXT_PUBLIC_NEX_SUPABASE_URL` |
| Env var that routes psql there | `DATABASE_URL` |

**Identity gate (run this first; stop if the output disagrees):**

```sql
select current_database() as db,
       current_user       as role,
       inet_server_addr() as host;

-- Expected: db shape is Supabase-managed; role is 'postgres' or the
-- pooler role you authenticated as; host resolves inside aws-0-eu-west-1.
```

Then confirm NEX schema is present:

```sql
select count(*) from nex_account;         -- expect: > 0
select count(*) from nex_peer_message;    -- expect: > 0
```

If either returns `ERROR: relation does not exist`, you are pointed at
the wrong database — **STOP**.

---

## 2 · Dependencies and ordering

| Migration | Depends on | Independent of 199/200/201 siblings? |
|---|---|---|
| 199 | `nex_account` table (migration 001). `nex_session.last_seen_at` (migration 139) referenced in comments but not required. | YES — can apply alone. |
| 200 | `nex_account` table. Referenced-only (not required): `nex_account_profile.is_discoverable` (migration 134). | YES — can apply alone. |
| 201 | `nex_account` table. | YES — can apply alone. |

**Recommended order:** 199 → 200 → 201. All three sit on `nex_account`
with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so order is not
semantically load-bearing, but applying in the authored order keeps the
`nex_migration_history` sequence monotonic and keeps the per-session
summary clean.

**Already applied in the current session:**
- 198 (notification preferences) · applied 2026-10-15 to
  `ijvqdvsvwtwxzcqmoqit`. No conflict with 199/200/201.

---

## 3 · Exact schema changes

### Migration 199 · R9 chat/presence preferences

```
nex_account:
  + read_receipts_enabled       boolean  NOT NULL DEFAULT TRUE
  + typing_indicator_enabled    boolean  NOT NULL DEFAULT TRUE
  + last_seen_visibility        text     NOT NULL DEFAULT 'nobody'
      CHECK IN ('everyone','contacts','nobody')
  + online_status_visibility    text     NOT NULL DEFAULT 'nobody'
      CHECK IN ('everyone','contacts','nobody')
```

No new tables. No indexes. No triggers. No functions.

### Migration 200 · R10 privacy preferences

```
nex_account:
  + profile_visibility  text  NOT NULL DEFAULT 'public'
      CHECK IN ('public','contacts','private')
  + who_can_message     text  NOT NULL DEFAULT 'everyone'
      CHECK IN ('everyone','contacts')
```

No new tables. No indexes. No triggers. No functions.
**`is_discoverable` is NOT touched** — it stays on `nex_account_profile`
as a separate axis (Socials/directory surfacing vs. profile reading).

### Migration 201 · R14 data-usage preferences

```
nex_account:
  + auto_download_images  text  NOT NULL DEFAULT 'always'
      CHECK IN ('always','wifi_only','never')
  + auto_download_videos  text  NOT NULL DEFAULT 'wifi_only'
      CHECK IN ('always','wifi_only','never')
  + auto_download_audio   text  NOT NULL DEFAULT 'always'
      CHECK IN ('always','wifi_only','never')
  + upload_quality        text  NOT NULL DEFAULT 'standard'
      CHECK IN ('standard','hd')
```

No new tables. No indexes. No triggers. No functions.

---

## 4 · RLS / policies

**None of 199/200/201 add, drop, or alter any RLS policy.** `nex_account`
already carries the sealed `supabase_user_id = auth.uid()` ownership
pattern from migration 001, and that policy covers the new columns
automatically because RLS evaluates on row visibility — new columns on
an existing row are gated by the existing policy.

`GRANT` / `REVOKE` on `nex_account` is unchanged. No new roles.

---

## 5 · Preconditions

Before applying, verify in order:

1. **Identity** · § 1 above. Confirm `ijvqdvsvwtwxzcqmoqit`.
2. **Migration 198 applied** — guarantees we are on the current sealed
   baseline. Check:
   ```sql
   select name from nex_migration_history where name like '198%';
   -- expect: '198_nex_account_notification_prefs'
   ```
3. **No in-flight DDL on `nex_account`.** Run:
   ```sql
   select pid, state, query
   from pg_stat_activity
   where query ilike '%nex_account%'
     and state != 'idle';
   -- expect: no rows (or only your own session).
   ```
4. **Baseline row count snapshot:**
   ```sql
   select count(*) as before_count from nex_account;
   -- Record the number. The three migrations must not change it.
   ```
5. **Column pre-check** — these columns must NOT already exist (unless a
   partial re-run is intentional). Any pre-existing column that collides
   is an inconsistent state and requires owner decision before applying:
   ```sql
   select column_name
   from information_schema.columns
   where table_schema='public'
     and table_name='nex_account'
     and column_name in (
       'read_receipts_enabled','typing_indicator_enabled',
       'last_seen_visibility','online_status_visibility',
       'profile_visibility','who_can_message',
       'auto_download_images','auto_download_videos',
       'auto_download_audio','upload_quality'
     );
   -- expect: zero rows on first apply.
   ```

---

## 6 · Apply method

Each migration is a plain SQL file in `nex-supabase/migrations/`. Apply
through the Supabase SQL Editor (preferred for low-volume DDL) or psql
pointed at the pooler. The three files are:

- `nex-supabase/migrations/199_nex_account_chat_privacy_prefs.sql`
- `nex-supabase/migrations/200_nex_account_privacy_prefs.sql`
- `nex-supabase/migrations/201_nex_account_data_usage_prefs.sql`

**Transaction model:** each file is a single logical change (ADD COLUMN
+ guarded CHECK). Wrap each in its own transaction:

```sql
begin;
\i nex-supabase/migrations/199_nex_account_chat_privacy_prefs.sql
-- verify (see § 7)
commit;  -- or rollback if verification fails
```

Repeat for 200 and 201 as **separate** transactions. Do not fold the
three into one — a verification failure on 200 should not undo the
clean 199 apply.

**Idempotency:** all three use `ADD COLUMN IF NOT EXISTS` and
`do $$ ... if not exists ... end $$;` guards on the CHECK constraints,
so re-running a file is safe. The constraint-exists guards key off
`pg_constraint.conname`.

**After each successful commit, append to `nex_migration_history`:**

```sql
insert into nex_migration_history (name, applied_at)
values ('199_nex_account_chat_privacy_prefs', now())
on conflict (name) do nothing;
-- Repeat with '200_nex_account_privacy_prefs' and
-- '201_nex_account_data_usage_prefs' after their respective commits.
```

---

## 7 · Verification queries

Run **after each migration** before committing its transaction. If any
expectation fails, rollback and report to owner.

### After 199

```sql
-- Columns present?
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='nex_account'
  and column_name in (
    'read_receipts_enabled','typing_indicator_enabled',
    'last_seen_visibility','online_status_visibility'
  )
order by column_name;
-- Expected: 4 rows, data_type matches (boolean + text), is_nullable=NO.

-- CHECK constraints wired?
select conname
from pg_constraint
where conname in (
  'nex_account_last_seen_visibility_check',
  'nex_account_online_status_visibility_check'
);
-- Expected: 2 rows.

-- Row count unchanged?
select count(*) from nex_account;
-- Expected: equals the baseline recorded in § 5 step 4.

-- Backfill is implicit via DEFAULT · check a sample row has the defaults.
select read_receipts_enabled, typing_indicator_enabled,
       last_seen_visibility, online_status_visibility
from nex_account
limit 3;
-- Expected: TRUE, TRUE, 'nobody', 'nobody' for pre-existing rows.
```

### After 200

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='nex_account'
  and column_name in ('profile_visibility','who_can_message');
-- Expected: 2 rows, both text, both NOT NULL.

select conname
from pg_constraint
where conname in (
  'nex_account_profile_visibility_check',
  'nex_account_who_can_message_check'
);
-- Expected: 2 rows.

select profile_visibility, who_can_message
from nex_account limit 3;
-- Expected: 'public', 'everyone' for pre-existing rows.
```

### After 201

```sql
select column_name, column_default
from information_schema.columns
where table_schema='public' and table_name='nex_account'
  and column_name in (
    'auto_download_images','auto_download_videos',
    'auto_download_audio','upload_quality'
  )
order by column_name;
-- Expected: 4 rows, defaults 'always' / 'wifi_only' / 'always' / 'standard'.

select conname
from pg_constraint
where conname in (
  'nex_account_auto_download_images_check',
  'nex_account_auto_download_videos_check',
  'nex_account_auto_download_audio_check',
  'nex_account_upload_quality_check'
);
-- Expected: 4 rows.
```

### Final cross-check (all three)

```sql
select name, applied_at
from nex_migration_history
where name in (
  '199_nex_account_chat_privacy_prefs',
  '200_nex_account_privacy_prefs',
  '201_nex_account_data_usage_prefs'
)
order by name;
-- Expected: 3 rows with the three names and recent timestamps.
```

Also run (lightweight sanity) a representative sealed read path to
prove the new columns are serving code without crash:

```sql
-- The chat-preferences-service reads these columns.
select id, read_receipts_enabled, typing_indicator_enabled,
       last_seen_visibility, online_status_visibility,
       profile_visibility, who_can_message,
       auto_download_images, auto_download_videos,
       auto_download_audio, upload_quality
from nex_account
limit 1;
-- Expected: 1 row, no column reference errors.
```

---

## 8 · Rollback limitations

**Within the apply window (before commit):** rollback is clean —
`rollback;` on the open transaction discards the ADD COLUMN + CHECK and
nothing in the row data has moved.

**After commit, within the same session:** no in-transaction rollback.
To revert, run:

```sql
begin;
alter table nex_account
  drop column if exists read_receipts_enabled,
  drop column if exists typing_indicator_enabled,
  drop column if exists last_seen_visibility,
  drop column if exists online_status_visibility;
-- Also drop CHECK constraints (CASCADE from column drop; explicit for clarity):
alter table nex_account
  drop constraint if exists nex_account_last_seen_visibility_check,
  drop constraint if exists nex_account_online_status_visibility_check;
delete from nex_migration_history where name='199_nex_account_chat_privacy_prefs';
commit;
```

Repeat with 200 and 201 column sets as applicable.

**Rollback is only safe BEFORE application code starts writing non-default
values to these columns.** Once a user has set, e.g.,
`read_receipts_enabled = FALSE` through the Settings UI, dropping the
column loses that user intent silently. The three settings pages (Chat
Settings, Privacy, Data Usage) are present in the code tree but the
server actions still fail-closed and only serve defaults until the
columns exist. If owner wants to roll back AFTER the settings UI has
been live for any period, the correct sequence is:

1. Disable the three Settings surfaces (flip `comingSoon` back to TRUE
   in `_sections.ts`).
2. Snapshot `nex_account` so non-default values are preserved as
   evidence.
3. Then drop the columns.

**No PITR is included in this package.** The owner's Supabase project
has whatever point-in-time-recovery window is configured at the
project level — verify PITR state before applying if that is relevant
to risk tolerance.

---

## 9 · Code already shipped against these migrations

All three migrations are **pre-wired** in source. Applying them to the
live database flips the code paths from "fail-closed defaults for all
users" to "respect per-user preferences." The specific pre-wired call
sites are:

| Code site | Reads which columns | Behaviour pre-apply | Behaviour post-apply |
|---|---|---|---|
| `src/lib/nex-native/chat-preferences-service.ts` · `getChatPreferencesSafe` | 199's 4 columns | Returns `PRIVACY_MAXIMUM_PREFS` for every account (service query fails because columns don't exist, catches, returns max-privacy shape). Receipts off, typing off, presence hidden for everyone. | Returns the row's stored prefs. First-apply defaults = receipts ON, typing ON, presence NOBODY. |
| `src/lib/nex-native/peer-message-service.ts` · `markPeerMessagesRead` + `markPeerMessageDelivered` | 199's `read_receipts_enabled` | No-op for every account. | Writes `read_at` / `delivered_at` for accounts with receipts ON. |
| `src/app/api/nex-native/peer-message/since/route.ts` | 199's `read_receipts_enabled` | Strips `read_at` for every outbound payload. | Strips `read_at` only when the viewer has receipts OFF. |
| `src/app/nex-native/chat/peer/[accountId]/_typing-client.tsx` | 199's `typing_indicator_enabled` (via server-resolved prop) | Prop defaults TRUE at the parent (fail-closed on service error), so typing works. **See behavioural impact below.** | Prop reflects the server-resolved value. |
| `src/app/nex-native/chat/peer/[accountId]/_presence-client.tsx` | 199's `online_status_visibility` | Server-resolved prop defaults FALSE for `publishPresence` on service error (fail-closed), so no one publishes. | Publishes when `online_status_visibility != 'nobody'`. |
| `src/app/nex-native/u/[handle]/page.tsx` | 200's `profile_visibility` | `resolveProfileVisibilityForViewer` fail-closed returns `visible:false, response:'404'`. Every non-self profile 404s. **See behavioural impact below.** | Visibility resolved per sender vs. recipient contact relationship. First-apply default = `public` → every profile visible. |
| `src/lib/nex-native/peer-conversation-service.ts` · `getOrCreatePeerConversationAsSender` | 200's `who_can_message` | Only called from paths that opt into the gated wrapper. Legacy symmetric creator preserved. | Gates sender against recipient's `who_can_message`. First-apply default = `everyone`. |
| `src/lib/nex-native/crypto/encrypted-attachment-upload.ts` | 201's `upload_quality` (via server-resolved prop) | Defaults to `'standard'` compression when prop absent. | Honours the server-resolved value. |

### ⚠ Behavioural impact pre-apply (now)

The three settings pages are shipped. Right now, with 199/200/201
UNAPPLIED, the fail-closed services mean:

- **R10 profile_visibility** · `getPrivacyPreferencesSafe` returns the
  privacy-maximum shape (`profile_visibility='private'`). The
  `/u/[handle]` gate then 404s every non-self visit. **This is why the
  live write gate matters.** The code is pre-wired; the DB apply flips
  non-self profile reads from "all 404" to "all public" (the default).

- **R9 online_status_visibility** · same story — presence publishing is
  OFF for everyone until the column exists and defaults to a visible
  value. (Default is `'nobody'`, so even post-apply, presence stays off
  by default until users opt in — this is doctrine, not a bug.)

- **R9 read_receipts_enabled** · currently no-op for all accounts, so
  receipts are universally off. Post-apply default is TRUE, so receipts
  flip on for everyone (reciprocal WhatsApp expectation).

- **R9 typing_indicator_enabled** · `_typing-client` prop defaults TRUE
  (backward-compat), so typing works today. Post-apply, server-resolved
  prefs will honour the per-user value. First-apply default = TRUE, so
  no behaviour change for existing users.

- **R14 auto_download / upload_quality** · defaults match historic
  behaviour, so no user-visible change post-apply.

If owner wants `/u/[handle]` to be publicly accessible to non-signed-in
viewers today, that requires applying 200 — the code is already shipped
and will 404 everyone otherwise.

---

## 10 · Approval gate

**Before applying:**

1. ☐ Owner confirms target `ijvqdvsvwtwxzcqmoqit`.
2. ☐ Owner has reviewed the three SQL files in `nex-supabase/migrations/`.
3. ☐ Owner has reviewed § 3 (schema changes) and § 9 (behavioural impact).
4. ☐ Owner has authorised the apply window.
5. ☐ Operator is logged into Supabase SQL Editor or psql pointing at
     the sealed project (verified via § 1).

**After applying:**

6. ☐ All verification queries in § 7 pass.
7. ☐ `nex_migration_history` carries the three new rows.
8. ☐ One manual smoke test: visit `/nex-native/settings/chat-settings`,
     `/privacy`, `/data-usage` from a signed-in test account → three
     pages render, toggles persist, reload reflects persisted state.
9. ☐ Visit `/u/<test-account-handle>` from a signed-in different account
     → profile visible (default `public`).

**Stop here. This document does not authorise application. It describes
exactly what will happen when a separate explicit authorisation is given.**

---

## 11 · If authorisation is withheld

The code paths continue to serve fail-closed defaults. The three
Settings pages render but save server actions return
`error: "preferences_unavailable"` immediately. R9/R10/R14 remain
functionally offline from a user POV. This is the correct behaviour
until the DB apply happens — nothing is broken by leaving the migrations
unapplied, but the three Settings cards cannot be considered live.
