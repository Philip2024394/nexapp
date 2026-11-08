# NEX Backup & Restore Readiness · 2026-11-08

Owner directive · "do not claim backups are working until an actual restore
test has been performed." This document maps the territory. No restore drill
has been executed. All claims below are DOCUMENTARY only.

Repository · `C:/Users/Victus/nexapp` · branch `nex-ireland-build-2026-11-06`
· HEAD at time of writing `451f780b`.

---

## 1 · Scope of what NEX actually backs up today

NEX does NOT run its own backup process. There is no `pg_dump`, no
scheduled snapshot, no object-store sync. Full inventory:

| Area | Mechanism | Owned by |
|---|---|---|
| Primary Postgres (production) | Supabase project `ijvqdvsvwtwxzcqmoqit` default backup | Supabase |
| Primary Postgres (sandbox) | Supabase project `kdstoyyeygcopkogqsyv` default backup | Supabase |
| Supabase Storage (public buckets) | Supabase Storage replication | Supabase |
| Supabase Storage (private buckets · vault, chat attachments, music media) | Supabase Storage replication | Supabase |
| Secrets (service role key, DB URL) | `.env.local` on dev workstation · NOT backed up | Owner |
| Migrations source of truth | Git (`nex-supabase/migrations/*.sql`) | GitHub `Philip2024394/nexapp` |

Repo-side grep confirms absence of a backup runner:
- `scripts/`: no file named `backup`, `pg_dump`, `snapshot`, `restore`,
  `wal`, `archive` executes one of those operations. The 21 files that
  mention those tokens (via `Grep` for `backup|pg_dump|restore|snapshot`)
  are design docs, README notes, test scripts, or variable names in audit
  tooling — none perform a backup.
- `scripts/_tmp/`: only ad-hoc artefacts (PNG screenshots, dewi avatar
  helpers, HQ acceptance JSON, Irish Pride publish scripts, stage3a tests).
  No backup dumps.

Conclusion · NEX relies entirely on Supabase's platform-level backups
plus Git for migration source. There is no application-level export.

---

## 2 · Supabase default backup assumptions

**TIER ASSUMPTION · not verified from this session.** The owner must
confirm which paid tier each project is on; the behaviour below differs
sharply between Free / Pro / Team / Enterprise.

| Tier | Automated backups | Point-in-Time Recovery (PITR) | Retention |
|---|---|---|---|
| Free | Daily logical backups, best-effort | No | 7 days typical |
| Pro | Daily logical backups | Opt-in paid add-on (per-second recovery) | 7 days (longer with PITR add-on) |
| Team / Enterprise | Daily + PITR default | Yes | Configurable up to 28 days |

**What this means for `ijvqdvsvwtwxzcqmoqit` (production):**
- If on Free · last-24h data could already be gone if a corruption
  happens shortly before the daily snapshot. HIGH RISK for a product
  about to ship.
- If on Pro without PITR add-on · daily snapshot restore is the only
  option. RPO = up to 24h.
- If on Pro with PITR · can recover to any point in the retention window
  (typically 7 days). RPO = seconds.

Supabase Storage replication is separate · Supabase documents it as
"regionally replicated object storage" but a disastrous bucket DELETE
is NOT recoverable via Postgres snapshot restore. Media that lives
only in Storage (vault files, chat attachments, music MP3s, HQ-uploaded
images) needs its own policy.

**Owner action needed:**
1. Confirm current tier for `ijvqdvsvwtwxzcqmoqit` and
   `kdstoyyeygcopkogqsyv`.
2. If PITR not enabled on production · enable it OR authorise a
   work item to build an application-level export job.
3. Document the Supabase support contact window for restore requests.

---

## 3 · Cascading deletes inventory

`ON DELETE CASCADE` is present in 162 occurrences across 81 migration
files (of 319 total migrations). The highest-blast-radius parent rows
are `nex_account`, `nex_business`, `nex_product`, `nex_conversation`,
and `nex_live_session`. If a parent row is deleted during a restore
or dedup operation, Postgres will cascade the delete through every
listed FK before the transaction commits.

Key risks grouped by parent table:

### Parent · `nex_account`
Deleting a `nex_account` row cascades to (non-exhaustive · 60+ FKs
confirmed via grep):

- `001_nex_migration_history_and_account.sql:55` · `supabase_user_id` (auth.users)
- `025_nex_friend_edge.sql:38-40` · friend graph
- `033_nex_account_relationship_prefs.sql:28-29`
- `042_nex_account_profile.sql:50` · profile record
- `043_nex_webauthn_credential.sql:47` · ALL passkeys
- `047_nex_peer_chat.sql:50,51,76` · ALL peer conversations + sender rows
- `070_nex_report.sql:29,30` · moderation history
- `074_nex_liked_product.sql:27`
- `078_nex_cart.sql:15`
- `087_nex_product_ladder.sql:119` · buyer ladder state
- `088_nex_product_share_grant.sql:52,53`
- `092_nex_account_device_key.sql:29` · E2E device keys
- `098_nex_account_push_subscription.sql:19`
- `102_bridge99_provisional_state.sql:181,240`
- `105_nex_bridge99_first_send_dedup.sql:87`
- `103_nex_welcome_outbox.sql:118`
- `120_nex_affiliate_account.sql:37`
- `124_nex_affiliate_marketplace.sql:47`
- `128_nex_vault_entry.sql:58` · ALL vault entries
- `129_nex_vault_file.sql:55` · ALL vault files
- `131_nex_call_log.sql:29`
- `132_nex_call_link.sql:33`
- `133_nex_group_call.sql:40,64`
- `135_nex_theme_intro.sql:80`
- `139_nex_phase_1_security.sql:84,146,200` · security state
- `142_nex_vault_envelope_tables.sql:91,190,286,317,345` · vault envelopes
- `143_nex_vault_conversation_envelope.sql` (3 FKs)
- `146_nex_community_watch_core.sql:135,183,268,290-291,311,347`
- `148_nex_community_phase2a_card_primitives.sql:69,129,145,158`
- `198_nex_account_notification_prefs.sql:25`
- `208_nex_discovery_signal.sql:68`
- `215_nex_friend_request.sql:40`
- `219_nex_live_session_and_featured_product.sql:129`
- `222_nex_live_engagement.sql:69`
- `223_nex_uploaded_video.sql:67`
- `224_nex_emergency_schema.sql:83,169,255,281,387`
- `225_nex_emergency_profile.sql:375,376`
- `226_nex_live_participation.sql:82`
- `227_nex_watch_listing.sql:138`
- `228_nex_watch_listing_entitlement.sql:95`
- `231_nex_watch_listing_deletion_audit.sql:68`
- `232_nex_watch_listing_rate_limit.sql:52`
- `234_nex_live_jail.sql:30,31`
- `235_nex_music_track.sql:18` · ALL creator music
- `236_nex_music_active_slot_and_idempotency.sql:158,198`
- `237_nex_follow_graph.sql:35,36`
- `240_nex_account_music_rights_ack.sql:49`
- `242_nex_creator_support_settings.sql:87`
- `258_nex_billing_foundation.sql:244,351` · billing + subscription
- `268_nex_community_member_flag.sql:40`
- `275_nex_creator_activation.sql:73`
- `301_nex_hq_direct_channel.sql:76`

**Risk** · a dedup or restore operation that re-inserts an account
with the same UUID then later finds a conflicting row and DELETEs it
can obliterate the user's vault, keys, conversations, listings, and
billing state in one statement. The soft-delete design in
`nex_account_mark_deleted` (migration 296) exists specifically to
avoid triggering these cascades · see §7.

### Parent · `nex_business`
Cascades (non-exhaustive):
- `028_nex_banner.sql:43`
- `029_nex_live_post.sql:39`
- `036_nex_email_marketing.sql:46`
- `039_nex_generated_site.sql:34`
- `066_nex_menu.sql:37,51`
- `087_nex_product_ladder.sql:50,120`
- `088_nex_product_share_grant.sql:55`
- `107_nex_product_section.sql:48`
- `111_nex_gallery_image.sql:45`
- `112_nex_service.sql:41`
- `124_nex_affiliate_marketplace.sql:48`
- `152_nex_community_phase2b_business_welcome.sql:78`
- `159_nex_business_promo.sql:27`
- `195_nex_business_theme.sql:58`
- `213_nex_accommodation_unit.sql:72`

### Parent · `nex_product`
- `035_nex_product_variant.sql:29`
- `074_nex_liked_product.sql:28`
- `088_nex_product_share_grant.sql:56`
- `219_nex_live_session_and_featured_product.sql:177`

### Parent · `nex_conversation` / `nex_peer_conversation`
- `004_nex_conversation_and_message.sql:73`
- `011_nex_generation_job.sql:50`
- `047_nex_peer_chat.sql:75`
- `105_nex_bridge99_first_send_dedup.sql:88`
- `298_nex_peer_chat_envelope_overlay.sql:40`

### Parent · `nex_live_session`
- `219_nex_live_session_and_featured_product.sql:176`
- `222_nex_live_engagement.sql:66`
- `226_nex_live_participation.sql:79`
- `234_nex_live_jail.sql:32`

### Parent · `auth.users` (Supabase Auth)
- `001_nex_migration_history_and_account.sql:55` · nex_account cascades
  if the Auth user is deleted. Any restore that drops and re-creates
  Auth users would wipe their nex_account rows and transitively
  everything above.

### Parent · `nex_incident`
- `300_nex_incident.sql:104` · `nex_incident_event` cascades · deleting
  an incident loses its full lifecycle trail. Low criticality.

### Parent · emergency and watch/music subsystems
- `224_nex_emergency_schema.sql:167,212,327` · emergency_incident cascades
- `228_nex_watch_listing_entitlement.sql:93`, `231_…:68` etc.

---

## 4 · Restore test · what CAN be verified in sandbox

Using `kdstoyyeygcopkogqsyv` only, the following are safe to exercise
WITHOUT owner infra escalation (all still require explicit owner
authorisation before execution · see §6):

1. **Logical snapshot drill** · take a `pg_dump --schema=public,nex`
   of the sandbox project. Create a throwaway Supabase project. Restore
   the dump. Verify row counts match for `nex_account`, `nex_business`,
   `nex_product`, `nex_live_session`, `nex_peer_message`,
   `nex_security_audit_log`, `nex_incident`. Document the elapsed time.
2. **Single-row cascade drill** · pick ONE sandbox test account
   (not a mock-persona · an ephemeral seeded row). Verify its FK
   fan-out via `pg_catalog.pg_constraint`. DELETE the account row.
   Observe which tables shed rows (sandbox only). Compare against §3's
   expectations. Roll back the transaction instead of committing · the
   whole drill must run inside `BEGIN; … ROLLBACK;`.
3. **Storage bucket inventory** · list the sandbox buckets' object
   counts and byte totals. Document which buckets are
   application-critical vs. CDN / public.
4. **RLS behaviour under restore** · after the logical restore above,
   re-apply migrations 290-301 and verify RLS grants are preserved.
   This is the most-missed gotcha of logical-restore drills.

Each of these produces evidence but DOES NOT prove production can be
restored. The production evidence requires §5.

---

## 5 · Restore test · what REQUIRES owner infra access

Cannot be run from this agent session. Each needs the owner directly:

1. **PITR verification on production** · log into Supabase console for
   `ijvqdvsvwtwxzcqmoqit`, confirm whether PITR is enabled, read the
   retention window, attempt a dry-run restore to a new project for
   a specific timestamp window. Compare row counts afterwards.
2. **Supabase support restore drill** · open a non-urgent support
   ticket requesting a restore of production state from 24h ago into
   a parallel project. Record: response time, actual recovery point
   delivered, row-count delta. This is the ONLY way to verify Supabase
   will deliver on the recovery promise before an incident.
3. **Storage object-recovery drill** · delete a disposable test file
   from a sandbox-equivalent production bucket (not an actual user
   file!). Request restore from support. Measure RPO/RTO.
4. **Secret-rotation drill** · the service-role key is the keys-to-
   the-kingdom credential. Rotate it in the Supabase console and
   observe which production surfaces break before Vercel env vars are
   updated. This tests "if the key is leaked, how fast can we recover"
   · cannot be run without owner authorisation + a maintenance window.

---

## 6 · Owner approvals required before any restore drill

No drill executes without explicit per-drill authorisation naming:

- Target project ID (must NOT be `ijvqdvsvwtwxzcqmoqit` unless the drill
  is explicitly authorised for production).
- Exact SQL / console actions in the drill script.
- Expected row-count deltas · if any production row count would change,
  the drill is production-destructive and requires a separate approval
  under Safety Constitution §3-§5.
- Rollback path · for every mutating step, the prior state must be
  recoverable. `BEGIN; … ROLLBACK;` is the default; any
  `COMMIT`-requiring step needs a separate recovery recipe.
- Who reviews the output · an un-reviewed drill that passes silently
  is not evidence of anything.

Canonical rules (Safety Constitution §3-§5, CLAUDE.md §4): "a request
to build, fix, finish, test, commit, or prepare code does NOT
authorise a push" and "do not apply database migrations without
separate explicit approval." Both extend to restore drills.

---

## 7 · Deletion workflow — idempotency vs destructiveness

The sealed account-deletion workflow at
`src/lib/nex-native/account-deletion-service.ts` is composed of 5
steps (attempted-audit, session-invalidate, soft-delete, audit-erase,
Auth-delete, completed-audit). Key properties:

- **Soft-delete via `nex_account_mark_deleted`** (migration 296) ·
  does NOT remove the `nex_account` row · sets `deleted_at = now()`
  and scrubs `display_name` / `nex_handle`. This is the deliberate
  choice to NOT trigger the 60+ cascade FKs from §3. Idempotent · the
  WHERE clause includes `and deleted_at is null`, so a re-run is a
  no-op.
- **`nex_security_audit_erase_actor`** (migration 294) · pseudonymises
  historical audit rows. Idempotent · the UPDATE touches rows by
  `actor_account_id = _account_id` and after the first pass there are
  none left to re-write.
- **Supabase Auth `deleteUser`** (external) · THIS step hard-deletes
  the `auth.users` row, which DOES cascade through
  `nex_account.supabase_user_id ON DELETE CASCADE`
  (`001_nex_migration_history_and_account.sql:55`). But by the time
  Auth delete runs, the nex_account row's identity has already been
  scrubbed via step 3, so the cascade-deleted row is already an
  anonymised shell. Note · this means the soft-delete + audit-erase
  MUST land BEFORE the Auth delete, or the real identity cascades out.
  The service's step ordering enforces this · lines 118-178 of
  `account-deletion-service.ts`.

### Could a restore accidentally un-delete an account?

Yes · partially. Scenarios:

1. **Logical restore from a snapshot taken before the soft-delete** ·
   the restored `nex_account` row re-appears with `deleted_at = null`
   and the original `display_name` + `nex_handle`. The Auth user is
   already gone, so `supabase_user_id` points nowhere · the account
   is a ghost row. GDPR implication · the user's
   display_name / handle re-appears in the DB even though they
   requested deletion. Any export or share grant touching the restored
   row re-leaks the identity.
2. **PITR to a timestamp between soft-delete and Auth-delete** · the
   row is scrubbed to "Deleted account" but the FK to `auth.users` is
   still valid. Auth-delete has to run again. Idempotent per §7's
   idempotency contract.
3. **Audit erasure reversibility** · the pseudonymisation is
   irreversible in the audit rows themselves (`actor_identity` is
   replaced with `erased:<random>` · no mapping is stored). A snapshot
   restore of the audit table would bring the pre-erasure
   `acct:<uuid>` strings back. If PII minimisation is the regulatory
   driver for erasure, a restore defeats it.

**Recommendation** · before any production restore that could include
previously-deleted accounts:
1. Enumerate `nex_account WHERE deleted_at IS NOT NULL AT snapshot-time`.
2. Compare to current `deleted_at IS NOT NULL`.
3. For any restored-to-alive account, re-run the soft-delete step
   (idempotent) and re-run `nex_security_audit_erase_actor` (also
   idempotent) under a new erased identity.
4. Document the delta in the restore ticket.

A runbook codifying the three steps above is needed · it does NOT
exist in the repo yet · creating it is a separate authorised work
item.

---

## 8 · Open questions for the owner

1. Which paid tier is `ijvqdvsvwtwxzcqmoqit` on? (Determines whether
   PITR is available.)
2. Who holds the Supabase account owner credentials
   (`asknexapp@gmail.com`) · is there a documented recovery path if
   that account is lost?
3. Is there a secondary region or export destination for Storage
   objects (vault media, chat attachments)? Supabase Storage
   replication is intra-region.
4. Should the Auth-user deletion step be made conditional on the audit
   erasure having succeeded? Currently it proceeds even if erasure
   returned `function_not_available`
   (`account-deletion-service.ts:149-157`).
5. Is there an audit of which production Storage buckets contain
   encrypted-at-rest content (vault, music media) vs plaintext content
   (public catalog images, avatars)? Bucket-level backup priority
   should follow that split.

---

## 9 · Verdict

**Backup posture is UNVERIFIED.** No production restore has been
attempted. We have:
- No application-level backup mechanism.
- Full reliance on Supabase default backup (tier assumptions unverified).
- A clear cascading-delete surface (§3) that makes any wrong-row
  deletion catastrophic.
- A sealed soft-delete workflow (§7) that avoids triggering cascades
  for the deletion path, but no equivalent guardrail on restore.

**Next concrete steps:**
1. Owner confirms Supabase tier and PITR state (10 minutes in console).
2. Owner authorises a sandbox logical-restore drill (§4.1) to establish
   an operator baseline.
3. Separate authorisation for a production PITR verification (§5.1)
   under a maintenance window.

Only after §5.1 completes successfully can anyone claim NEX "backups
work" without violating the owner's directive.
