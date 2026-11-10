# NEX Chat Migrations 323-329 · Dependency Graph + Apply/Rollback Order
## 2026-11-10 · PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY

**Status.** Companion to the seven PROPOSAL migration files that
implement the D1–D6 chat architecture sealed in
`chat-decisions-locked-2026-11-10.md`. All seven files are drafts.
Nothing is authorised for sandbox or production apply by this document.
Each migration requires a SEPARATE owner word-trigger (e.g.
`apply 323 sandbox`) before it may run.

**Repo.** `C:/Users/Victus/nexapp` (GitHub `Philip2024394/nexapp`).

**Target.** Sandbox Supabase `kdstoyyeygcopkogqsyv`. Production
`ijvqdvsvwtwxzcqmoqit` stays sealed.

---

## 1. Migration inventory

| Mig | File | Decision | Shape | Reversible |
|---|---|---|---|---|
| 323 | `323_nex_device_key_retired_at_PROPOSAL.sql` | D1 + D2 | ALTER TABLE add column + partial index | Yes |
| 324 | `324_nex_peer_message_delivery_status_PROPOSAL.sql` | D3 | ALTER TABLE add column + CHECK + index | Yes |
| 325 | `325_nex_chat_adoption_metric_PROPOSAL.sql` | D4 | CREATE MATERIALIZED VIEW | Yes |
| 326 | `326_nex_peer_message_expiry_sweep_PROPOSAL.sql` | D3 | CREATE FUNCTION (SECURITY DEFINER) | Yes |
| 327 | `327_nex_ciphertext_orphan_scan_PROPOSAL.sql` | D5 | CREATE TABLE + RLS deny policies | Yes |
| 328 | `328_nex_peer_message_encrypted_check_NOT_VALID_PROPOSAL.sql` | D6 Phase 1 | ADD CONSTRAINT ... NOT VALID | Yes |
| 329 | `329_nex_peer_message_encrypted_check_VALIDATE_PROPOSAL.sql` | D6 Phase 3 | VALIDATE CONSTRAINT | Yes (two options) |

---

## 2. Dependency graph (ASCII)

```
Pre-existing (already applied / authored):
  mig 092  nex_account_device_key           (device-key table)
  mig 093  nex_peer_message_encrypted       (encrypted/ciphertext/delivered_at columns)
  mig 094  nex_purge_delivered_encrypted    (SECURITY DEFINER purge fn)
  mig 295  nex_peer_chat_ciphertext_bucket  (RLS · bucket created out-of-band)

New (PROPOSAL):

  mig 092 ──────┬─▶ mig 323 (retired_at + nex_device_key_active)
                │
                └─▶ mig 325 (adoption view · reads retired_at)

  mig 093 ──────┬─▶ mig 324 (delivery_status column)
                │           │
                │           └─▶ mig 326 (expire-undelivered fn · reads delivery_status)
                │
                ├─▶ mig 325 (adoption view · reads encrypted/sent_at)
                │
                └─▶ mig 328 (NOT VALID CHECK encrypted=true)
                             │
                             └─▶ mig 329 (VALIDATE CONSTRAINT)

  mig 295 ──────▶ mig 327 (orphan-scan marker table · conceptual dep · DDL does not reference 295)
```

### Edge rationale

- **092 → 323** · 323 adds a column to the table 092 created.
- **092 → 325** · 325's eligible-pairs CTE uses `retired_at IS NULL`,
  a column 323 adds. **Therefore 323 must apply before 325.**
- **093 → 324** · 324 adds a column to the table 093 modified.
- **093 → 325** · 325 reads `encrypted` and `sent_at` from
  `nex_peer_message` (both pre-existing or 093-added).
- **324 → 326** · 326's UPDATE sets `delivery_status`.
- **093 → 328** · 328 adds a CHECK on the `encrypted` column.
- **328 → 329** · 329 validates a constraint 328 added.
- **295 → 327** · logical only · 327 stores pointers into the bucket
  295's RLS covers. DDL does not reference 295.

---

## 3. Apply order (strict forward sequence)

### 3.1 Required order (sandbox)

1. **323** · additive · safe first.
2. **324** · additive · independent of 323 but required before 326.
3. **325** · depends on 323 AND 324 (via 093). Not strictly required
   before 326/327/328 but owner-sealed D4 gate wants adoption telemetry
   live BEFORE 328 ships so the burn-in is observable.
4. **326** · depends on 324. Not required before 327/328 but the
   D3 ownership expects sweep live before orphan sweep (327) becomes
   relevant.
5. **327** · depends on 295 (operationally). Can apply before or after
   326. Owner-sealed order places it after 326.
6. **328** · depends on 093. Apply ONLY after D4 code-level freeze
   (`NEX_CHAT_PLAINTEXT_FREEZE=1`) has been live long enough that new
   plaintext writes are impossible from the code path.
7. **329** · **GATE**: requires mig 328 to have been live ≥14 days in
   sandbox AND ≥7 days in production, with zero observed plaintext
   writes. Separate owner word-trigger `validate 329 sandbox` and
   `validate 329 production`.

### 3.2 Independent / parallelisable

- **323 ↔ 324** · no dependency · either may apply first.
- **325 depends on both 323 and 324** · must come after both.
- **326 depends on 324 only** · can apply independently of 325 / 327.
- **327 depends on nothing in 323-329** · can apply in parallel with
  323-326.

### 3.3 Recommended sandbox sequence (minimises cross-interaction)

```
323 → 324 → 326 → 327 → 325 → (burn-in D4 freeze) → 328 → (14+7d burn-in) → 329
```

This sequence lands all schema changes first, then the sweep infra,
then the telemetry, then the enforcement constraint with its burn-in.

---

## 4. Rollback order (emergency reverse sequence)

If a mid-programme halt is required, roll back in **strict reverse
order of apply**. Each migration's `-- Rollback:` section at the
bottom of its SQL file is authoritative. Rollbacks follow Invariant
I-5 · no rollback re-materialises private content.

### 4.1 Reverse order

```
329 → 328 → 325 → 327 → 326 → 324 → 323
```

- **329 first** · demote VALIDATED → NOT VALID (Option B) OR drop
  constraint entirely (Option A). Option B is the safer intermediate
  stop; Option A is only if 328 is also being rolled back.
- **328** · drop `nex_peer_message_encrypted_true` constraint.
- **325** · drop materialized view (independent · safe any time but
  ordered before 324/323 which it reads).
- **327** · drop `nex_ciphertext_orphan_scan` + RLS policies. Stop
  the cron caller first.
- **326** · drop sweep function. Idempotent · pending rows just stop
  being flipped to expired.
- **324** · drop `delivery_status` column + CHECK + partial index.
  delivered_at is NOT dropped (pre-existed from mig 093).
- **323** · drop `retired_at` column + `nex_device_key_active` index.

### 4.2 Partial-rollback safety matrix

| Scenario | Safe halt point | Rollback needed |
|---|---|---|
| Adoption not reaching 95% | After 325 | None · leave 323/324/325/326/327 applied · do not advance to 328 |
| Observed plaintext write after 328 | After 328 | Roll back 328 only · investigate code-side freeze (D4) · 323-327 stay |
| VALIDATE fails in 329 preflight | Before 329 apply | Do not apply 329 · investigate residual encrypted=false rows |
| Sweep function misbehaving | After 326 | Roll back 326 only · 323/324/325/327 stay |
| Orphan-scan leaking | After 327 | Roll back 327 · stop cron first |

### 4.3 What a rollback cannot do (I-5)

- Cannot restore a decrypted plaintext body that was never on the
  server.
- Cannot restore a pending row that was swept to `expired` (the row
  itself remains; only its status flipped).
- Cannot restore a ciphertext storage object that a FUTURE sweep
  caller (not part of 323-329) deleted. The orphan-scan table only
  records that a deletion happened.

---

## 5. Gates summary (per decision)

| Decision | DB migration | Code boundary | Env flag | Owner word-trigger required |
|---|---|---|---|---|
| D1 | none (092 already supports in-place rotation) | `device-key-cache-v2.ts invalidate()` | none | none (already in place) |
| D2 | 323 | fan-out reader filters `retired_at IS NULL` | none | `apply 323 sandbox` |
| D3 | 324 + 326 | delivery-ack POST flips `delivery_status` + `delivered_at` | none | `apply 324 sandbox`, `apply 326 sandbox` |
| D4 | 325 (telemetry) | `peer-message-service` refuses plaintext when flag set | `NEX_CHAT_PLAINTEXT_FREEZE=1` | `apply 325 sandbox`, separate Vercel env flip, separate deploy |
| D5 | 327 | `/api/nex-native/cron/orphan-sweep` reads marker table | `NEX_CRON_SECRET` | `apply 327 sandbox`, bucket creation separate |
| D6 Phase 1 | 328 | relies on D4 code-level freeze being adopted | — | `apply 328 sandbox` (NOT before D4 burn-in) |
| D6 Phase 3 | 329 | — | — | `validate 329 sandbox` AFTER 14d burn-in · `validate 329 production` AFTER additional 7d |

---

## 6. Preflight checks (owner must see output before authorising apply)

### 6.1 Before 323

```sql
-- Confirm mig 092 is in place.
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'nex_account_device_key'
 ORDER BY ordinal_position;
```

### 6.2 Before 324

```sql
-- Confirm mig 093 is in place AND delivered_at exists.
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'nex_peer_message'
   AND column_name IN ('encrypted','delivered_at','ciphertext','nonce')
 ORDER BY column_name;
-- Expected: 4 rows.
```

### 6.3 Before 325

```sql
-- Confirm 323 and 324 applied.
SELECT version FROM nex_migration_history WHERE version IN ('323','324');
-- Expected: 2 rows.
```

### 6.4 Before 326

```sql
-- Confirm 324 applied.
SELECT version FROM nex_migration_history WHERE version = '324';
```

### 6.5 Before 327

```sql
-- Confirm bucket exists (out-of-band via Supabase Storage API).
SELECT id, public FROM storage.buckets WHERE id = 'nex-peer-chat-ciphertext';
-- Expected: 1 row with public=false.
```

### 6.6 Before 328

```sql
-- Confirm 093 in place AND D4 code-level freeze has been deployed to
-- the environment being targeted. (Deploy evidence is OUT-OF-DB.)
SELECT count(*) AS encrypted_false_rows_last_24h
  FROM nex_peer_message
 WHERE encrypted = false
   AND sent_at >= now() - interval '24 hours';
-- Expected: 0 for ≥7 consecutive days before authorising 328 apply.
```

### 6.7 Before 329 · **HARD GATE**

```sql
-- MUST return 0 OR owner-accepted exception memo attached to apply auth.
SELECT count(*) AS plaintext_rows_remaining
  FROM nex_peer_message
 WHERE encrypted = false;

-- MUST show 14d since 328 applied in sandbox (and 7d since prod apply).
SELECT version, applied_at
  FROM nex_migration_history
 WHERE version = '328';
```

---

## 7. What this dependency document does NOT authorise

- Any migration apply (sandbox or production).
- Bucket creation for 327's dependency on 295.
- Any env flag flip (`NEX_CHAT_PLAINTEXT_FREEZE`, `NEX_CRON_SECRET`).
- Any Vercel deploy or GitHub push.
- Any production touch of any kind.
- Any public privacy claim (I-6).
- Any deletion of legacy plaintext rows (I-4).

Each item above requires its own separate explicit owner word-trigger
per CLAUDE.md §4 and §5 (Push + Production gates) and per the
Priority 1 architecture invariants I-1 through I-6.
