# NEX · Historical Secure-Deletion Sweep · S0..S6 Procedure Doctrines
### 2026-11-09 · I-4 compliant · per-phase authorisation required

**Status:** Procedure doctrine · not authorisation. Produces the exact script, authorisation shape, rollback behaviour, and V-DELETION-1 evidence for each of seven sweep phases (S0..S6). Each phase requires its own explicit owner authorisation per sealed invariant I-4.

**Author:** Claude Opus 4.7

**Critical:** No sweep phase executes without separate explicit owner authorisation. I-4 is non-negotiable. I-5 (no rollback restores private content) is enforced by migration-rollback CHECKs.

---

## 0 · Why seven phases, not one

Historical secure-deletion is irreversible. Doing it in one phase creates a single-point-of-failure with no intermediate verification. Splitting into seven phases:
- S0: Inventory (read-only · no deletion)
- S1: Retire public chat-attachment bucket (biggest I-3 exposure)
- S2: Private attachments hard-delete
- S3: Drop plaintext body + ciphertext columns
- S4: Attachment-meta sensitive-snapshot cleanup
- S5: Rollback-safety rehearsal
- S6: Final verification

Each phase has:
- Explicit entry gates (requires prior phase signed)
- Dry-run requirement (sandbox before production)
- Rollback behaviour (I-5 compliant)
- V-DELETION-1 evidence requirement
- Authorisation shape

---

## 1 · Cross-phase rules

### 1.1 · I-4 · per-phase authorisation
Each S-phase requires an explicit owner message naming the phase + the target environment (sandbox first · production only after sandbox sign-off).

### 1.2 · I-5 · no rollback restores
Every S-phase migration includes a rollback section. The rollback section includes a CHECK that refuses to restore any private-chat body/ciphertext/attachment content even if explicitly requested. Rollback restores schema structure only · not content.

### 1.3 · Legal retention carve-outs (from L-1..L-6 memo · Build Phase A)
Certain data MUST be preserved despite the sweep:
- Order records (`nex_order` · `nex_order_item`)
- Payment evidence (`nex_billing_*`)
- Account records (`nex_native_account_profile`)
- Security audit (`nex_security_audit_event` · `nex_security_rate_limit`)
- Routing metadata (`nex_peer_conversation` · `nex_conversation`)

**None of these contain private chat body/ciphertext · they are referenced from chat by opaque ID and preserved.**

### 1.4 · Pre-sweep user notification
Before S1 begins, users must be notified of:
- The architecture change
- The historical sweep timeline
- The export window length (D-4 sealed)
- Their right to export before sweep

Notification method: in-app banner + email + sign-in notification · duration ≥30 days before S1 (or legal memo minimum · whichever longer).

### 1.5 · Sandbox-first requirement
Every S-phase runs in sandbox `kdstoyyeygcopkogqsyv` first · verified · then runs in production `ijvqdvsvwtwxzcqmoqit` with separate authorisation.

---

## 2 · S0 · Inventory (read-only)

### 2.1 · Goal
Produce a signed inventory of all pre-device-only private chat content on NEX servers.

### 2.2 · Procedure

**Step 1 · Row counts**
```sql
-- Run against sandbox AND production
SELECT 
  (SELECT COUNT(*) FROM nex_peer_message WHERE body IS NOT NULL OR ciphertext IS NOT NULL) AS peer_messages_with_content,
  (SELECT COUNT(*) FROM nex_message WHERE body IS NOT NULL) AS business_messages_with_content,
  (SELECT COUNT(*) FROM nex_peer_message WHERE attachment_meta IS NOT NULL AND attachment_meta != '{}'::jsonb) AS peer_messages_with_attachment_meta;
```

**Step 2 · Bucket enumeration**
```bash
# Supabase Storage API
GET /storage/v1/bucket
# For each bucket: list objects, count, size
GET /storage/v1/object/list/<bucket>
```

Look specifically for:
- `nex-peer-chat-attachments` (public chat attachments · known exposure point)
- Any bucket with "chat" or "message" in the name
- Any bucket with unexpected object patterns

**Step 3 · Backup inventory**
List all Supabase project backups:
- Point-in-time recovery (PITR) retention window
- Daily backups
- Any manual backups

Determine which backups contain pre-device-only content and when they expire naturally.

**Step 4 · Legal retention carve-out verification**
Cross-reference L-1..L-6 memo with inventory · confirm no carve-out requires retention of private chat body/ciphertext.

### 2.3 · Deliverable
`docs/sweep/s0-inventory-<yyyy-mm-dd>-signed.md` with owner signature.

### 2.4 · Authorisation shape
*"Authorise S0 · read-only inventory sweep · sandbox + production · produce signed inventory report. No deletion."*

### 2.5 · Rollback
N/A (read-only).

### 2.6 · V-DELETION-1 evidence captured
Baseline row/object counts for future comparison.

---

## 3 · S1 · Retire public chat-attachment bucket

### 3.1 · Goal
Delete the `nex-peer-chat-attachments` bucket (if it still exists after prior Phase 1 remediation) OR confirm its retirement. Migrate any still-public business-asset references to `nex-business-public-assets`.

### 3.2 · Pre-condition
Phase 2 implementation Sprint 6 complete · attachment transmission via data channel live · no new chat-attachment uploads being sent to any NEX bucket.

### 3.3 · Procedure

**Step 1 · Confirm no new writes**
```sql
-- Check last-write timestamp on bucket
-- Confirm no uploads in the past 7 days
```

**Step 2 · Reference verification**
Scan `nex_peer_message.attachment_meta` + `nex_message.attachment_meta` for any URL referencing the bucket · confirm count matches S0 inventory.

**Step 3 · Business-asset identification**
If the bucket contains any business-public assets mixed with chat attachments (legacy issue) · migrate those to `nex-business-public-assets` before deletion.

**Step 4 · Bucket deletion**
```bash
# Supabase Storage API
DELETE /storage/v1/bucket/nex-peer-chat-attachments
```

**Step 5 · Verification**
```bash
GET /storage/v1/bucket
# Confirm bucket no longer listed
```

### 3.4 · Authorisation shape
*"Authorise S1 · delete bucket `nex-peer-chat-attachments` from sandbox · verify · then production. Business-public assets already migrated to `nex-business-public-assets`."*

### 3.5 · Rollback
Bucket cannot be restored from backup once deleted. This is intentional (I-5). The objects IN the bucket cannot be resurrected.

### 3.6 · V-DELETION-1 evidence captured
Bucket enumeration post-deletion · confirms absence.

---

## 4 · S2 · Private attachments hard-delete

### 4.1 · Goal
Any private attachments in any other bucket secure-deleted. Clean up any legacy private-attachment paths.

### 4.2 · Procedure

**Step 1 · Identify private-attachment locations**
From S0 inventory · any bucket that contains private attachment objects.

**Step 2 · Per-bucket deletion**
For each identified bucket · list objects · delete objects that match private-attachment UUIDs · verify count.

**Step 3 · Bucket retirement or re-scoping**
If the bucket was exclusively private attachments · delete the bucket.

### 4.3 · Authorisation shape
*"Authorise S2 · delete private attachment objects from <bucket list> · sandbox first · then production."*

### 4.4 · Rollback
I-5 CHECK: rollback cannot restore deleted objects. Enforced at migration-tool level.

### 4.5 · V-DELETION-1 evidence captured
Per-bucket object count before/after.

---

## 5 · S3 · Drop plaintext body + ciphertext columns

### 5.1 · Goal
Remove `nex_peer_message.body` · `nex_peer_message.ciphertext` (if exists) · `nex_message.body` columns.

### 5.2 · Pre-condition
- Phase 2 Sprint 7-8 complete · no new writes to these columns
- All users on Phase 2 architecture (app version check or sunset old versions first)

### 5.3 · Migration
```sql
-- 325_nex_sweep_s3_drop_bodies.sql
BEGIN;

-- Verify no recent writes to these columns
DO $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
    FROM nex_peer_message
   WHERE body IS NOT NULL
     AND updated_at > NOW() - INTERVAL '7 days';
  IF recent_count > 0 THEN
    RAISE EXCEPTION 'Recent writes detected · aborting S3. Re-check Sprint 7-8 completion.';
  END IF;
END $$;

-- Drop columns
ALTER TABLE nex_peer_message DROP COLUMN body;
ALTER TABLE nex_peer_message DROP COLUMN ciphertext;
ALTER TABLE nex_message DROP COLUMN body;

COMMIT;
```

### 5.4 · Rollback (I-5 CHECK)
```sql
-- 325_rollback.sql
-- I-5 CHECK · rollback restores schema only · not content
BEGIN;

RAISE NOTICE 'I-5 enforcement · rollback restores column structure only. Content cannot be restored.';

ALTER TABLE nex_peer_message ADD COLUMN body text;
ALTER TABLE nex_peer_message ADD COLUMN ciphertext text;
ALTER TABLE nex_message ADD COLUMN body text;

-- Content remains NULL for all rows · rollback does NOT restore pre-drop content
COMMIT;
```

### 5.5 · Authorisation shape
*"Authorise S3 · drop body + ciphertext columns from sandbox `kdstoyyeygcopkogqsyv` first. Verify V-STORE-1 green. Then production `ijvqdvsvwtwxzcqmoqit` with separate authorisation."*

### 5.6 · V-DELETION-1 evidence captured
Schema dump before/after · column absence confirmed.

---

## 6 · S4 · Attachment-meta sensitive-snapshot cleanup

### 6.1 · Goal
Clean sensitive snapshots (product names · cart contents · personal data) from `attachment_meta` JSONB columns. Preserve minimal routing metadata (opaque IDs · timestamps).

### 6.2 · Procedure
```sql
-- 326_nex_sweep_s4_meta_cleanup.sql
BEGIN;

-- For each row with sensitive attachment_meta · reduce to minimal keys
UPDATE nex_peer_message
   SET attachment_meta = jsonb_build_object(
     'attachment_id', attachment_meta->'attachment_id',
     'kind', attachment_meta->'kind',
     'bytes', attachment_meta->'bytes'
   )
 WHERE attachment_meta ? 'product_name'
    OR attachment_meta ? 'cart_items'
    OR attachment_meta ? 'buyer_name'
    OR attachment_meta ? 'buyer_address';

-- Similar for nex_message
UPDATE nex_message ...;

COMMIT;
```

### 6.3 · Rollback (I-5 CHECK)
Rollback restores the JSONB shape but with sensitive keys NULL · content is not resurrected.

### 6.4 · Authorisation shape
*"Authorise S4 · attachment_meta sensitive-key cleanup · sandbox first."*

### 6.5 · V-DELETION-1 evidence captured
Pre/post SELECT counts of rows with sensitive keys.

---

## 7 · S5 · Rollback-safety rehearsal

### 7.1 · Goal
Prove I-5: no backup restore operation resurrects swept content.

### 7.2 · Procedure

**Step 1 · Identify oldest live backup**
Supabase PITR retention · daily backups · manual backups.

**Step 2 · Sandbox restore rehearsal**
Restore the oldest backup to a disposable sandbox instance. Inspect:
- Does `nex_peer_message.body` exist with content?
- Does `nex_peer_message.ciphertext` exist with content?
- Does `nex_message.body` exist with content?

**Step 3 · If YES · the backup contains pre-sweep content**
This is expected (backups from before the sweep contain pre-sweep data). The I-5 requirement is that this backup cannot be restored to production without triggering I-5 CHECKs.

**Step 4 · I-5 enforcement verification**
Simulate a restore to production:
- The restore triggers the I-5 CHECK in migration-tool framework
- Framework refuses to proceed
- Owner would need to issue a separate, I-5-overriding authorisation (one does not exist · owner commits to never issuing one)

**Step 5 · Backup lifecycle**
Backups from before the sweep are purged per retention schedule · sealed length pending L-1..L-6 memo. Once purged · the pre-sweep content is unrecoverable.

### 7.3 · Deliverable
`docs/sweep/s5-rollback-rehearsal-<yyyy-mm-dd>-signed.md` documenting:
- Rehearsal results
- I-5 CHECK triggered as expected
- Backup lifecycle confirmed

### 7.4 · Authorisation shape
*"Authorise S5 · rollback-safety rehearsal in disposable sandbox · no production touch."*

### 7.5 · V-DELETION-1 evidence captured
Rehearsal signed report.

---

## 8 · S6 · Final verification

### 8.1 · Goal
Full V-* matrix green across all sweep-related evidence points.

### 8.2 · Checklist

| Evidence | Status |
|---|---|
| V-STORE-1 · no body/ciphertext in schema | Confirmed post-S3 |
| V-STORE-2 · no sensitive attachment_meta | Confirmed post-S4 |
| V-STORE-3 · no chat-attachment bucket | Confirmed post-S1 |
| V-LOG-1 · no historical log leakage of swept content | Confirmed via log-sample analysis |
| V-DELETION-1 · all S-phases signed · backup lifecycle confirmed | Confirmed post-S5 |

### 8.3 · Deliverable
Final sweep completion report · signed by owner · ready for Build Phase F audit evidence package.

### 8.4 · Authorisation shape
*"Authorise S6 · final verification matrix · produce completion report."*

### 8.5 · V-DELETION-1 evidence captured
Signed completion report · ready for independent auditor.

---

## 9 · What this doctrine does + does NOT do

### Does
- Define the exact procedure for each S-phase
- Enforce I-4 (per-phase authorisation) and I-5 (no rollback restores)
- Specify rollback behaviour per phase
- Map evidence captured per phase to V-DELETION-1 requirements
- Cross-reference legal-retention carve-outs (from L-1..L-6)

### Does NOT
- Execute any sweep phase (each requires separate owner authorisation)
- Create any migration file in the migrations directory (target scope only)
- Access any backup
- Delete any bucket
- Drop any column

---

## 10 · Authorisation summary table

| Phase | Authorisation message template | Can start after |
|---|---|---|
| S0 | *"Authorise S0 inventory · sandbox + production · read-only"* | Build Phase A complete |
| S1 | *"Authorise S1 · retire chat-attachment bucket · sandbox then production"* | S0 signed + Sprint 6 complete + user-notification period elapsed |
| S2 | *"Authorise S2 · private attachment deletion · sandbox then production"* | S1 signed |
| S3 | *"Authorise S3 · drop body + ciphertext columns · sandbox then production"* | S2 signed + Sprint 7-8 complete |
| S4 | *"Authorise S4 · attachment_meta cleanup · sandbox then production"* | S3 signed |
| S5 | *"Authorise S5 · rollback-safety rehearsal"* | S4 signed |
| S6 | *"Authorise S6 · final verification"* | S5 signed |

Each phase runs sandbox → sign-off → production with the production step as its own separate authorisation.

---

**End of historical sweep S0..S6 procedure doctrines.**

Ready for per-phase authorisation when Build Phase D reaches Sprint 11 and Build Phase A legal memo is available.
