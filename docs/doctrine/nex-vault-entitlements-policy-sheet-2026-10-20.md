# NEX Vault Entitlements Policy Sheet

**Status:** 🔒 **LOCKED** · owner-signed 2026-10-20 (DECISIONS only · implementation NOT authorised)
**Author:** Claude (compiled from read-only audit)
**Date:** 2026-10-20
**Locked at:** 2026-10-20 · owner authorisation message captured in §G
**Blocks:** All pricing-page / packages work that advertises Vault
**Supersedes:** nothing (first policy sheet for Vault entitlements)

> **What this lock means:** The eight §B decisions below are the
> owner-signed destination for NEX Vault entitlements. Future
> changes to any §B row require a new owner-signed revision.
>
> **What this lock does NOT mean:** no §C work-item (W1–W12) is
> scheduled or implemented. No migration is applied. No code is
> written. No Vault copy ships to any public surface. S1 (the
> pricing data layer) is only *unblocked* in principle — it needs
> a separate owner authorisation before any code is written. See
> §G for the owner's authorisation message in full.

---

## Purpose

Before any pricing surface, packages page, upsell copy, or trial
offering can **advertise** Vault, NEX must have authoritative
answers to five questions:

1. What's the storage allowance?
2. What file-size limits apply per upload?
3. How long is content retained?
4. What encryption guarantees can we honestly make?
5. What happens to stored content when a subscription expires?

This sheet (a) documents what the Vault code **actually does today**,
verified against the source, (b) proposes values for owner review,
and (c) lists the code work required to make the proposed policy
truthful before any public claim.

> No value in this sheet is binding until the owner locks each
> decision point in writing. The pricing data layer (S1), country
> persistence (S2), and `/packages` page (S3) remain blocked until
> this sheet is locked.
>
> **Load-bearing doctrine (owner-authorised 2026-10-20):** A written
> policy and a completed checklist do not prove that the controls
> work. Each required work item (§C W1–W12) needs **implementation
> evidence AND tests** before NEX makes the corresponding
> customer-facing claim. Locking a row in §B is permission to
> schedule the work; it is NOT permission to advertise the
> guarantee. Advertisement follows evidence, not intention.
>
> **Three owner-sealed principles (2026-10-20):**
>
> 1. **Vault must protect both the customer's DATA and their
>    ability to UNDERSTAND and RECOVER that data.** A control that
>    silently destroys recoverable data is not a security control,
>    it's a hazard. Every destructive operation needs a working
>    recovery path, a working notification path, and an
>    independent verification path.
> 2. **Subscription expiry must never be confused with deletion.**
>    "Vault is locked" ≠ "files have been deleted." Copy,
>    implementation, and audit log must all preserve the
>    distinction at every transition.
> 3. **Security claims must describe what the software actually
>    guarantees.** No broad "end-to-end encrypted" claim while a
>    plaintext-at-rest path exists. No "all vault access is
>    audited" claim while direct database and service-role access
>    bypass the log. No "always available" claim while access is
>    conditional on an active subscription. Honest-copy > ambitious
>    copy, every time.

---

## Section A · Implementation reality (verified 2026-10-20)

Every row in this table is cited to the current code. Nothing is
inferred.

| Area | What the code does | Evidence |
|---|---|---|
| **Storage cap** | **No cap enforced.** `nex_vault_file.byte_size` is tracked as metadata only. Zero quota / allowance / storage-limit constants or server-side checks. | `src/lib/nex-native/vault/envelope-service.ts:22`: *"Zero commercial code · no bisnis, tier, plan, subscription, entitlement, quota, or allowance references anywhere."* `pin-rate-limit.ts:29` repeats the same disclaimer. |
| **Per-file size limit** | **No server-side limit.** Client may upload any size. | No `max_file_size` constant found in any vault module. |
| **Encryption at rest** | ✅ **End-to-end verified.** VMK generated client-side via `crypto.getRandomValues()`; held in tab-scoped memory; zeroised on lock. Server only ever receives opaque AES-256-GCM ciphertext. Per-file K_f wrapped under VMK (60-byte envelope: 12-byte nonce ‖ 32-byte ciphertext ‖ 16-byte tag). | `vault/key-hierarchy.ts:20` *"The server never sees VMK plaintext, K_f plaintext, KEK, PIN, recovery passphrase, WebAuthn PRF output, or device private key."* `vault/client/vault-session.ts:6` *"Never persisted to localStorage · sessionStorage · cookies · URL · or server-side session data."* `ciphertext-structural-validator.ts:211` *"The server receives OPAQUE CIPHERTEXT ONLY · never decrypts, never inspects."* |
| **Metadata privacy** | ⚠️ **File bytes are opaque. Metadata is NOT.** The DB stores `byte_size`, `encryption_algorithm`, bucket path, creation timestamp — all readable by anyone with service-role Supabase access (NEX ops / staff). | Migration 141 defines `nex_vault_file` columns including `byte_size`, `encryption_algorithm`, `bucket_path`. |
| **Algorithm** | AES-256-GCM, hardcoded `aes-256-gcm/v1`, enforced at every write. | `key-hierarchy.ts:60` + `ciphertext-structural-validator.ts:67`. |
| **Device envelopes** | Expire 24h after creation. Used for cross-device setup/auth only; NOT the Vault data itself. | `envelope-service.ts:259` (comment) + `:351` (`expires_at.is.null,expires_at.gt.now`). |
| **Vault data retention** | ⚠️ **No TTL. No grace period. No auto-delete.** Content remains in `nex_vault_file` + storage indefinitely until the user explicitly deletes or the account is deleted. | No `retention`, `expire`, `purge`, `cleanup`, `delete_after`, `grace_period`, or `archive` constants found in vault modules. |
| **Chat → Vault attachment path (Phase A.1)** | ⚠️ **PLAINTEXT AT REST (by design, staged).** When a chat attachment is moved to Vault, the server fetches the public chat-attachment bytes and uploads them to the PRIVATE `nex-vault-files` bucket **as plaintext** (migration_state=`"legacy"`). Encryption happens later via the sealed Phase A.6 client-side migration runner on next vault unlock. The server never decrypts, but the plaintext bytes DO transit the server during the move and sit at rest in the private bucket until A.6 encrypts them. | `src/lib/nex-native/vault-persistence-service.ts:103-196` + `vault-file-service.ts:128-146` *"Every new Vault file enters the system as plaintext in the private Vault bucket. The sealed A.6 client-side migration runner encrypts it to `encrypted` on next Vault unlock."* |
| **Chat → Vault message bodies** | ✅ **E2E preserved.** The move operation copies CIPHERTEXT envelopes under the sealed per-device wrapping scheme. No plaintext transit. | `vault-entry-service.ts:152-199` (metadata-only move; ciphertext preserved as-is). |
| **Download path** | ✅ **E2E verified.** Server issues presigned URLs to opaque bytes; never decrypts, never streams plaintext (post Phase A.6). During Phase A.1 the "opaque bytes" MAY be plaintext (per row above). | `vault-file-service.ts:268-285` `createSignedDownloadUrl()`. |
| **Key recovery path (WebAuthn-PRF, passphrase)** | ✅ **E2E verified.** Passphrase / PRF output / KEK NEVER leave the browser. Server receives only opaque `wrapped_vmk_hex` + salt + Argon2 params. Device portability uses NaCl box (X25519 ECDH); server is a passive relay. | `vault/client/recovery-rotation.ts:76-262` + `vault/client/device-portability.ts:128-195`. |
| **Share / export path** | ❓ **Does not exist today.** No `exportVault`, `downloadAll`, `vault-zip`, or share-single-item surface found. No code path can leak plaintext because none exists. | Grep returned zero matches. |
| **Vault logging / telemetry** | ✅ **Clean.** Three `console.warn()` sites log failure messages only — no byte content, no key material. No analytics / posthog / mixpanel / segment calls inside vault modules. | `vault-file-service.ts:250`, `vault-persistence-service.ts:174-177, 186-189`. |
| **Account deletion** | ✅ **CASCADE verified.** `nex_vault_file.account_id` has `ON DELETE CASCADE`. All vault tables cleared when the account row is deleted. Storage-bucket objects are a separate concern (see §C risk 4). | Migration 141:128 + :203–210. |
| **Trial** | 7-day window from `vault_trial_used_at`. One per account. `effectiveVaultAccess()` returns false after window elapses. | `vault-service.ts:10` *"VAULT_TRIAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000"* + `:29-31`. |
| **Trial-expiry data behaviour** | ⚠️ **Access revoked, data preserved.** User loses the ability to unlock Vault after day 7; the files remain in the DB/storage. No cleanup job. No warning to the user that resubscription would restore access. | `vault-service.ts:34` returns false; no deletion path exists. |
| **`vault_tier` column (subscription gate)** | 🔴 **BROKEN SCAFFOLDING.** `vault-service.ts:23` reads `account.vault_tier`, but **no migration defines that column**. The read evaluates to `null` at runtime — the conditional branch is dead code. Access decisions fall through to the trial-only branch. | Migration 207 adds `vault_trial_used_at` but NOT `vault_tier`. Code references the column but DB has no such column. |
| **Recovery (PIN forgot)** | WebAuthn-PRF + recovery passphrase paths exist. VMK stays wrapped under recovery credentials; no data loss. | `device-portability.ts:247–388` handles cross-device recovery. |
| **UI copy today** | *"100% PRIVATE"* / *"End-to-end encrypted, with no access from us. Only you hold the key"* / *"Cloud Backup"* / *"Always Available"*. | `vault/intro/page.tsx:14, 43-47, 286, 433`. |

### Audit of current UI copy vs code reality

| UI phrase | Reality | Honesty verdict |
|---|---|---|
| "End-to-end encrypted · only you hold the key" | TRUE at the file-bytes layer (post Phase A.6) + for message bodies and keys. **PARTIALLY FALSE for chat-attachment copies in Phase A.1** — those sit at rest in the private vault bucket as plaintext until A.6 encrypts them. The server never decrypts, but the plaintext DOES transit through the server and persist until the user next unlocks Vault. | ⚠️ Needs explicit qualifier for Phase A.1 OR deferral of the E2E copy until A.6 fully ships. |
| "Cloud Backup" | TRUE. Files are server-stored. | ✅ Honest (does not promise encryption at rest). |
| "100% PRIVATE" | PARTIALLY true. File bytes are opaque for keys/messages but potentially plaintext at rest for chat-attachment copies in Phase A.1. File **metadata** (size, bucket path, display name, mime type, timestamps, folder path) is readable by anyone with service-role DB access — **no database-level query audit exists** to detect such access. | ⚠️ Needs qualifying copy. See B6/B7. |
| "Always Available" | CONDITIONAL. Available during trial or paid subscription only. Access revoked silently after trial expiry — files persist invisibly. | ⚠️ Misleading. Either remove or qualify. |
| (No current UI claim about storage limits) | — | No gap, since no claim is made. The policy sheet SHOULD lock a value before a claim is made. |

### §A supplementary · Metadata access control reality (F2 deep audit)

- **RLS is ENABLED on all 8 vault tables** (`nex_vault_entry`, `nex_vault_file`, `nex_vault_setup`, `nex_vault_key_envelope`, `nex_vault_pin_attempt`, `nex_vault_recovery_attempt`, `nex_vault_file_migration_attempt`, `nex_vault_conversation_envelope`) — migrations 128, 129, 140, 142, 143. Owner-scoped `SELECT` policies on every table.
- **Service-role bypasses RLS** (standard Supabase pattern). All vault writes + most reads happen via `nexSupabaseAdmin` — ~50+ code paths. Each path enforces owner scope at the application layer (`.eq("account_id", session.account.id)`), but this is a code-level guarantee, not a database-level one.
- **No database-level query audit log for vault tables.** No `pgaudit`, no per-table triggers, no `nex_vault_audit_log`. Supabase account-level query logs exist for infrastructure debugging but are not inspectable by NEX staff policy enforcement.
- **Application-level audit is partial:** `vault_unlock` + `vault_setup` events are logged to `nex_sign_in_event` (migration 139). Changes to `nex_vault_setup`, `nex_vault_key_envelope`, or `nex_vault_file` metadata are NOT logged.
- **Backup bucket** (`D:/nex-backups`, Supabase scheduled dumps) is NOT schema-level encrypted — relies on Supabase infrastructure encryption at rest, which is a vendor guarantee, not an application-enforced one.
- **Analytics / telemetry:** no PostHog / Mixpanel / Segment calls inside vault modules. Zero out-of-band metadata leaks via analytics SDKs.

**Verdict:** access controls are **PARTIAL** — present and sensible at the application layer, absent at the database audit layer. A staff member with service-role credentials could run `SELECT * FROM nex_vault_file WHERE account_id = ...` and NEX would have no record of the query. See W10 in §C.

---

## Section B · Proposed entitlement values · owner locks each

Each row below presents the current reality, options, and a
recommended default. Owner approves per row.

### B1 · Storage allowance

- **Reality today:** unlimited (no cap enforced in code).
- **Options:**
  - *(a)* **5 GB** per Business account. Conservative, easy to
    scale server cost projections against, matches sub-£10/month
    price point.
  - *(b)* **25 GB** per Business account. Generous first-launch
    allowance, differentiates clearly from "a few photos" cloud.
    Higher storage cost per user.
  - *(c)* **Unlimited (fair-use)** — honest to current behaviour
    but creates no economic ceiling and leaves NEX exposed to
    outlier accounts.
- **Recommendation:** *(a)* 5 GB at launch. Easy to raise later;
  hard to lower once advertised. Must add server-side enforcement
  BEFORE advertising. See §C work-item W1.
- **Owner locked decision (2026-10-20):** *(a)* 5 GB per Business
  account. "This is a reasonable launch proposal, not a claim
  that 5 GB is already enforced. Count actual stored bytes
  server-side, account for concurrent uploads, and prevent quota
  bypass through retries or duplicate requests."
- **Locked wording (owner-signed 2026-10-20):** *"B1 — (a) 5 GB
  per Business account, subject to server-side enforcement and
  verification before advertising."*
- **OWNER FINAL DECISION (LOCKED 2026-10-20):** `[x] (a) 5 GB  [ ] (b) 25 GB  [ ] (c) Unlimited fair-use  [ ] (other: ___)`

### B2 · Per-file upload size limit

- **Reality today:** no limit (any size).
- **Options:**
  - *(a)* **50 MB per file.** Covers documents, photos, short
    audio. Blocks accidental drag-drop of a 4K video the user
    didn't mean to upload.
  - *(b)* **500 MB per file.** Allows short videos / large
    archives. Doubles the memory headroom needed on the client to
    encrypt.
  - *(c)* **No per-file limit, only overall storage cap.**
- **Recommendation:** *(a)* 50 MB at launch. Phase B can lift it
  for Business accounts if customer feedback demands.
- **Owner locked decision (2026-10-20):** *(a)* 50 MB per file.
  "Enforce the limit at the server upload boundary, including any
  presigned-upload or alternate upload path. Confirm whether the
  limit means 50 MB decimal or 50 MiB and use the same definition
  in the UI and API."
- **Locked wording (owner-signed 2026-10-20):** *"B2 — (a) 50 MB
  per file = exactly 50,000,000 bytes (decimal). The interface,
  API validation, storage accounting and tests must all use the
  same exact byte limit."*
- **Byte-definition sub-decision (LOCKED 2026-10-20):**
  **50 MB DECIMAL = 50,000,000 bytes.** Owner's rationale:
  *"easier to communicate to customers."* The MiB alternative
  (52,428,800 bytes) is rejected. **Required consistency:** UI
  display + API server-side limit + storage accounting + unit
  tests ALL use the same literal `50_000_000` constant · no
  mixing MB-decimal and MiB anywhere in the stack.
- **OWNER FINAL DECISION (LOCKED 2026-10-20):** `[x] (a) 50 MB  [ ] (b) 500 MB  [ ] (c) no per-file  [ ] (other: ___)`

### B3 · Retention when the account is active + subscribed

- **Reality today:** indefinite (no TTL).
- **Proposed:** **For as long as the Business subscription is
  active AND the account is active.** No TTL on individual files.
  Owner-only deletion via the Vault UI.
- **Owner locked decision (2026-10-20):** Accept. "Explicitly
  document account deletion, accidental deletion, backup
  behaviour and recovery limitations. The current database
  cascade does not by itself prove that corresponding
  storage-bucket objects are deleted."
- **Locked wording (owner-signed 2026-10-20):** *"B3 — Accept
  the proposed retention rule, subject to verified object
  cleanup and documented account-deletion behaviour."*
- **W-dependency reminder:** W9 (storage-bucket cleanup verification)
  must land before this row's lock yields a customer claim about
  "deletion = gone from NEX."
- **OWNER FINAL DECISION (LOCKED 2026-10-20):** `[x] Accept proposed  [ ] Other (specify): ___`

### B4 · Subscription-expiry grace period

- **Reality today:** access revoked instantly when trial window
  elapses; data preserved silently.
- **Options:** when the Business subscription expires:
  - *(a)* **30-day read-only grace.** User can download their
    Vault content but cannot upload. After 30 days without renewal,
    files are permanently deleted and the user is notified at the
    start and end of the grace period.
  - *(b)* **90-day read-only grace** + same deletion rule.
  - *(c)* **Indefinite preservation + indefinite read-lock.** User
    data is kept forever but un-downloadable until subscription
    renews. Keeps users hostage; probably not fair.
  - *(d)* **Instant deletion on expiry.** Harsh; user with a lapsed
    card could lose irreplaceable files. Flag as unacceptable.
- **Recommendation:** *(a)* 30-day read-only grace. Balances
  honesty, user protection, and storage cost. Requires W4 + W5
  below.
- **Owner locked decision (2026-10-20):** *(a)* 30-day read-only
  grace **with explicit safeguard** — deletion only runs when the
  deletion-safeguard gate passes (see "Fail-safe deletion gate"
  below). The day-0 / day-20 / day-30 communication structure in
  the table above is approved as a DIRECTION; the deletion copy
  is NOT locked verbatim because the ZIP/export route does not
  exist and the migration runner has not been audited
  line-by-line. Owner-stated principle: *"If the retrieval or
  deletion checks fail, raise an operational alert and prevent
  silent destructive expiry."*
- **Locked wording (owner-signed 2026-10-20):** *"B4 — (a)
  30-day read-only grace. Exact local-time expiry and warning
  messages required. Automated deletion remains disabled until
  W4/W5, W9, the export route and required recovery tests are
  verified."*

#### B4 · Fail-safe deletion gate (owner-authorised 2026-10-20)

**Rule:** When the W4 scheduler reaches a scheduled deletion date
for an account, it MUST NOT delete until the following six
pre-conditions are all green. If any pre-condition fails, the
scheduler SUSPENDS the deletion, raises an operational alert, and
notifies the affected customer. The deletion is retried only after
the failing condition is resolved.

| # | Pre-condition | Verification signal |
|---|---|---|
| **1** | **Download-everything path exists AND succeeded for this account.** The user was offered a working ZIP export at day 0 and the server has a success record (or an explicit user-declined signal). | W5/W6 implementation + per-account export audit row in `nex_vault_audit_log` (W10). |
| **2** | **Legacy-migration safely complete OR no legacy rows remain.** No `nex_vault_file.migration_state = "legacy"` rows for this account. (Legacy = plaintext at rest; must be either encrypted or exported before deletion.) | `SELECT COUNT(*) FROM nex_vault_file WHERE account_id = $1 AND migration_state = 'legacy'` = 0. |
| **3** | **Storage-bucket cleanup verified as working.** W9 landed and a staging-run log shows CASCADE delete + bucket prune work together. | W9 completion evidence. |
| **4** | **W10 audit-log write succeeds** for the deletion transition. (If audit fails, don't delete.) | Successful insert into `nex_vault_audit_log` BEFORE the delete DML runs. |
| **5** | **Day-0 and day-20 notification emails delivered.** No bounced / undelivered state. Customer actually knows deletion is coming. | Email-service delivery receipt per account. |
| **6** | **No active owner-report / support ticket on this account** that would make silent deletion harmful. | Query against the ops-ticketing table (TBD · may belong to W4). |

**Fail-safe behaviour (owner-sealed):**
- If any pre-condition is RED: `vault_access` stays `read_only`.
  No file deletion runs for this account on this cycle.
- Operational alert fires: owner-side notification naming the
  account_id and the failed pre-condition.
- Customer receives: *"We paused the scheduled deletion of your
  NEX Vault files because [reason]. Your files are still safe.
  We'll contact you within [N] business days to resolve."*
- Retry is manual (owner-approved) OR scheduled after the failing
  pre-condition reports green for 48 hours.
- Under NO circumstance does a silent deletion run while a
  safeguard is failing. The owner's explicit words:
  *"A customer must not lose their only recoverable copy because
  a timer expired."*

**W-dependency expansion:** W4's deliverable now INCLUDES
implementing this gate, not just the scheduler clock. W4 cannot
be marked done without a passing test that proves each
pre-condition correctly suspends the deletion when red.

- **OWNER FINAL DECISION (LOCKED 2026-10-20):** `[x] (a) 30-day read-only  [ ] (b) 90-day read-only  [ ] (c) indefinite read-lock  [ ] (d) instant delete  [ ] (other: ___)`

#### B4 · Explicit transition-point copy (F3 refinement · owner-flagged 2026-10-20)

The owner flagged that "loss of access ≠ deletion of data" must be
unambiguous at BOTH the implementation AND the copy layer. Three
transitions must be inspectable and separately communicated:

| Day | Implementation state | Email + in-app copy (verbatim · lock as-is) |
|---|---|---|
| **Day 0** · subscription expiry | `vault_tier = null` (W3 sets it); access flipped to `vault_access = "read_only"` (W4); upload API returns 402; download API still returns 200. **No file deletion yet.** | Email subject: *"Your NEX Vault is now read-only"*. Body: *"Your Business NEX Chat subscription ended on [date]. **Your Vault files are safe.** You can still download everything until [day-30 date, local time]. After that, the files will be permanently deleted. Renew any time before [day-30 date] to restore full access. [Renew] [Download everything]"*. In-app banner on `/vault/*`: *"Read-only · [N] days left to renew or download. [Renew] [Download everything]"*. |
| **Day 20** · reminder | Same read-only state. Banner persists; no new state change. | Email subject: *"10 days left · your NEX Vault files"*. Body: *"Your Vault is still safe but will be deleted on [day-30 date] unless you renew. [Renew] [Download everything]"*. |
| **Day 30** · deletion | W4 scheduled job deletes `nex_vault_file` rows + storage objects + envelopes for the account. Transition logged to `nex_vault_audit_log` (W10). Account itself NOT deleted — only Vault contents. | Email subject: *"Your NEX Vault files have been deleted"*. Body: *"As planned, your Vault files were permanently deleted on [date] because your Business subscription had not been renewed. **Your NEX account is unaffected** — Chat Themes, friends, and chat history remain. If you resubscribe to Business NEX Chat, you'll get a fresh Vault but previous files cannot be recovered."*. |

**Load-bearing distinctions:**
- "Read-only" is NOT "deleted." Copy MUST say *"Your files are safe."* at day 0.
- Day 30 is a hard transition, not fuzzy. Owner's chosen value (30 / 90 / other) MUST be shown in local time with the specific date.
- The user's NEX account itself is NOT deleted — only Vault contents. This must be stated explicitly at day 30.
- A *"Download everything"* path (W5) MUST exist from day 0 through day 30 and MUST be prominent in each email. **AUDIT NOTE 2026-10-20:** this endpoint does NOT exist today (F1 audit P4 confirmed zero bulk-export / vault-zip code). The copy references `[Download everything]` as a mandatory button; that button must be built (W5) and verified against real encrypted + plaintext-at-rest files BEFORE the copy ships.

**Scheduled transitions must be inspectable:** W4 writes a row to
`nex_vault_audit_log` (W10) at each transition, naming the
`account_id`, `transition` (`"read_only"` or `"deleted"`), the
cause (`"subscription_expired"`), and the row-count affected.
This log is the primary evidence that the control works.

### B5 · Trial-expiry data behaviour (free 7-day trial)

- **Reality today:** access revoked, data preserved indefinitely
  with no user communication.
- **Options:**
  - *(a)* **Mirror B4** — 30-day read-only grace, then delete.
  - *(b)* **Instant lock on day 7, delete on day 37.** 30-day
    deletion countdown.
  - *(c)* **Keep trial data forever even if user never
    subscribes.** Storage cost grows without revenue.
- **Recommendation:** *(b)* at launch. Instant lock keeps the
  trial-subscribe funnel honest; 30-day countdown gives the user
  time to recover their files.
- **Owner locked decision (2026-10-20):** *(b)* 7-day trial,
  read-only / download access for 30 additional days, deletion
  planned for day 37 **gated by the same B4 fail-safe deletion
  gate** (see §B4 pre-conditions). Mandatory acknowledgement
  checkbox before activation. **Date-display refinement:**
  derive from a defined expiry TIMESTAMP and display in the
  account's chosen time zone. Avoid "day 37" phrasing where the
  user needs an exact date and time.
- **Locked wording (owner-signed 2026-10-20):** *"B5 — (b)
  Seven-day trial; read-only/download grace through day 37.
  Mandatory acknowledgement before activation. No destructive
  expiry until retrieval, migration and deletion safeguards pass
  verification."*
- **Fail-safe deletion gate applies at day 37** · same six
  pre-conditions as §B4. If any pre-condition is RED on day 37,
  deletion is suspended, owner is alerted, customer is notified.
- **Copy refinement required before T1-T3 lock:** replace *"[day-37 date, local time]"* placeholders with an actual
  expiry timestamp binding and the account's locale/timezone
  formatting rule. The implementation (W6) MUST pass a timestamp
  from `vault_trial_used_at + 7d + 30d` and the UI MUST render it
  via the sealed `resolveClientLang()` / timezone pipe. Owner's
  stated principle: *"Avoid ambiguous wording such as 'day 37'
  when the user needs an exact date and time."*
- **OWNER FINAL DECISION (LOCKED 2026-10-20):** `[ ] (a)  [x] (b)  [ ] (c)  [ ] (other: ___)`

#### B5 · Explicit trial-copy requirements (F4 refinement · owner-flagged 2026-10-20)

The 7-day limit and the post-expiry data fate must appear at THREE
copy touchpoints, in plain language, not buried in fine print.
Draft copy below assumes option (b) is chosen; adapt dates if a
different option is locked.

**T1 · Trial activation screen (BEFORE the user starts the trial):**

> **Try Business NEX Chat free for 7 days.**
>
> You get full Business features and Vault for 7 days.
>
> After day 7, your Vault is locked but your files are safe for
> 30 more days. If you don't subscribe by **[day-37 date, local time]**,
> **your Vault files are permanently deleted**. You can download
> everything any time before that date.
>
> You can start this free trial once per NEX account.
>
> [ Start 7-day free trial ]   [ Not now ]

Checkbox below the CTA: *"I understand my Vault files will be
deleted on [day-37 date] if I don't subscribe."* **Must be ticked
before the trial activates.** (W6)

**T2 · In-trial countdown (visible on `/vault/*` from day 5):**

Banner wording:
- Day 5: *"2 days left in your free trial. Subscribe to keep Vault open."*
- Day 6: *"1 day left. Your Vault locks tomorrow — subscribe now to keep uploading."*
- Day 7, 00:00 account-local: Vault switches to read-only.

**T3 · Post-expiry (day 7 onwards):**

Email + in-app banner mirror B4 copy pattern:

| Day | Email + banner |
|---|---|
| **Day 7** · trial expiry | *"Your free trial has ended · your Vault is now read-only. **Your files are safe** · you have 30 days to download them or subscribe before they are deleted. [Subscribe] [Download everything]"* |
| **Day 27** · reminder | *"10 days left · your Vault files"* (same template as B4 day 20) |
| **Day 37** · deletion | *"Your trial Vault files have been deleted"* (same template as B4 day 30, with "trial" substituted) |

**Load-bearing requirements:**
- The trial-activation checkbox is a hard gate — `activateVaultTrial()` must reject without acknowledgment (W6 implementation).
- "Days left" counter must be computed from `vault_trial_used_at + 7 days` in the user's local timezone and shown as a specific calendar date, not as "X days from now" alone.
- A *"Download everything"* ZIP endpoint (W6) must exist from day 7 through day 37 and must be reachable even when Vault is locked (read-only grace). **AUDIT NOTE 2026-10-20:** this endpoint does NOT exist today (F1 audit P4 confirmed zero bulk-export / vault-zip code). The T1-T3 copy drafts above REFERENCE a `[Download everything]` button; that button must be built (W5 + W6) and tested with real encrypted + plaintext-at-rest files BEFORE the copy ships. Shipping the copy before the button exists is a release blocker.
- At no point may the UI suggest the user has lost data when they have only lost ACCESS. "Deleted" and "locked" are not synonyms.

### B6 · Encryption claim the packages page MAY make

- **Reality today (verified by F1 audit 2026-10-20):**
  - ✅ **Message bodies, VMK, keys, passphrases**: never touch the
    server in plaintext. AES-256-GCM. Server receives opaque
    ciphertext only. End-to-end verified.
  - ✅ **Download path**: presigned URLs to opaque bytes · server
    never decrypts.
  - ✅ **Key recovery / device portability**: ECDH + AES-GCM
    client-only · server is a passive relay.
  - ⚠️ **Chat → Vault attachment copies (Phase A.1)**: plaintext
    bytes transit the server during move and sit at rest in the
    private `nex-vault-files` bucket until the user next unlocks
    Vault, at which point the sealed A.6 client-side migration
    runner encrypts them. **This is NOT an E2E claim NEX can make
    today for a user who has not yet unlocked Vault post-move.**
  - ⚠️ **File metadata** (name, size, mime type, folder path,
    timestamps): plaintext in `nex_vault_file`. Readable by anyone
    with service-role access.

- **Options:**
  - *(a)* **Full-honesty copy** (defensible immediately):
    > *"File **contents** are encrypted with AES-256-GCM. Your
    > decryption key is generated and stored only in your browser —
    > NEX staff cannot read your files. **File names, sizes, and
    > timestamps are visible to NEX engineers for incident
    > response.** Chat attachments you move into Vault are
    > encrypted the next time you unlock your Vault."*
  - *(b)* **Short + wait for A.6**: wait until Phase A.6 ships
    (chat-attachment copies encrypted at ingest) and until W10
    (metadata audit log) ships, THEN use the shorter copy *"End-
    to-end encrypted. Only you hold the key. All vault access is
    audited."*
  - *(c)* **Omit all encryption copy** at launch · let the Vault
    UI's own in-product disclosure handle it when the user is
    actually using Vault. Packages page says only *"Vault access"*
    and defers specifics to Vault's own help page.
  - *(d)* Owner authors own copy.
- **Recommendation:** *(a)* if launching before W10 + A.6 landing;
  *(b)* if launching after both. Do NOT ship copy stronger than
  (a) until the gaps it names are closed.
- **Owner locked decision (2026-10-20):** *(c)* **Omit
  encryption claims from public packages marketing until the full
  attachment migration and required security controls are
  verified.** Owner-stated rejection of option (a): *"The
  statement 'NEX staff cannot read your files' conflicts with
  the finding that some attachment copies are plaintext at rest
  before migration. The proposed caveat helps, but it does not
  make the broad statement accurate for every file."*
- **Locked wording (owner-signed 2026-10-20):** *"B6 — (c)
  Omit encryption/security claims from public packages copy
  until W12, W10 and the relevant verification evidence are
  complete. Existing Vault UI claims require a separate
  corrective change."*
- **IMPORTANT SIDE-EFFECT (owner-flagged):** choosing (c) for
  packages copy does NOT make the EXISTING Vault UI claims
  acceptable. The current `vault/intro/page.tsx` strings
  (*"100% PRIVATE"*, *"Always Available"*) must be removed OR
  qualified via a **separately authorised** corrective UI
  change. See W7 for the sealed in-product copy correction
  (which was already in scope but is now explicitly
  non-dependent on B6).
- **OWNER FINAL DECISION (LOCKED 2026-10-20):** `[ ] (a) full-honesty  [ ] (b) short + wait  [x] (c) omit  [ ] (d) own copy: ___`

### B7 · Metadata privacy policy (feeds B6)

- **Reality today (verified by F2 audit 2026-10-20):**
  - ✅ **RLS enabled on all 8 vault tables.** Owner-scoped SELECT
    policies restrict authenticated clients to their own rows.
  - ⚠️ **Service-role bypasses RLS by Supabase default.** ~50+
    code paths use `nexSupabaseAdmin`. Each enforces owner scope
    at the application layer (`.eq("account_id", session.account.id)`),
    but this is a code-level guarantee, not a database-level one.
  - 🔴 **No database-level query audit log for vault tables.** No
    pgaudit, no triggers, no `nex_vault_audit_log`. A NEX staff
    member with service-role credentials could run a raw SELECT
    on `nex_vault_file` and no record of the query would exist.
  - ✅ **Application-level `vault_unlock` / `vault_setup` events**
    are logged to `nex_sign_in_event` (migration 139). But
    metadata changes (file renames, moves, deletions) are NOT
    tracked.
  - ⚠️ **Backup bucket** relies on Supabase infrastructure-level
    encryption at rest; no schema-level encryption mandate.

- **The current B7 proposal (policy only) is INSUFFICIENT per
  owner directive 2026-10-20.** A policy that cannot be enforced
  or audited is a promise NEX cannot honour. Three parts must
  land together:

  1. **Written policy** (the words NEX publishes):
     > *"NEX staff will only query vault metadata tables
     > (`nex_vault_file`, `nex_vault_setup`,
     > `nex_vault_key_envelope`, `nex_vault_pin_attempt`,
     > `nex_vault_recovery_attempt`, `nex_vault_conversation_envelope`,
     > `nex_vault_entry`, `nex_vault_file_migration_attempt`)
     > during active incident response initiated by an owner
     > report or a security alert. Routine analytics, support
     > triage, and marketing never query these tables."*

  2. **Technical enforcement + auditability** (W10 · new work
     item added below):
     - Add `nex_vault_audit_log` table recording every
       SELECT / INSERT / UPDATE / DELETE on vault metadata
       tables, who executed it (service account vs admin tool
       vs unknown), the row count, and a timestamp.
     - Add application-layer logging in `nexSupabaseAdmin`
       wrapper so vault-table queries emit a row to the audit
       log automatically.
     - Add a monthly audit review process (owner- or
       delegate-conducted) that reconciles non-incident queries
       against documented reasons.

  3. **Scope restriction on service-role usage** (W11 ·
     optional second-stage work): investigate whether vault
     metadata reads can be scoped to a separate read-only
     service role, so even accidental over-querying becomes
     evident. Deferred as optional until W10 reveals the
     volume of legitimate access.

- **Options:**
  - *(a)* **Accept all three** (policy + W10 + eventual W11).
    B6 copy may claim "all vault access is audited" once W10
    lands.
  - *(b)* **Accept policy + W10, defer W11**. Honest for Phase B.
  - *(c)* **Accept policy only, defer W10**. B6 copy must then
    NOT claim audit coverage. B6 must stay at option (a)
    full-honesty indefinitely.
  - *(d)* **Defer all three.** B6 may make no metadata-privacy
    claim at all · B6 copy option (c) ("omit") becomes mandatory.
- **Owner locked decision (2026-10-20):** *(b)* **Written policy
  + W10, defer W11 pending findings.** Owner-stated technical
  correction (critical): *"I would not approve W10's current
  claim that a wrapper automatically logs every database SELECT,
  INSERT, UPDATE and DELETE. It can only capture operations that
  actually pass through the audited paths. W10 must distinguish
  application-level audit events from direct database access and
  service-role operations. Identify how the latter are detected
  or restricted, then test coverage and document any residual
  gaps. If full coverage cannot be proven, NEX must not claim
  that all Vault access is audited."* W10 has been rewritten in
  §C below to reflect this scope — the sheet's earlier
  "automatic audit of all access" phrasing was technically wrong
  and is now corrected.
- **Locked wording (owner-signed 2026-10-20):** *"B7 — (b)
  Written metadata-access policy plus W10. W10 scope must be
  technically honest and tested; no claim of complete audit
  coverage until direct database and service-role access are
  addressed. W11 deferred."*
- **OWNER FINAL DECISION (LOCKED 2026-10-20):** `[ ] (a) all three  [x] (b) policy + W10  [ ] (c) policy only  [ ] (d) defer all  [ ] (other: ___)`

### B8 · Business-vs-trial Vault separation

- **Reality today:** `effectiveVaultAccess()` returns true for the
  7-day trial window OR any non-"gratis" `vault_tier` value (dead
  code — column doesn't exist).
- **Proposed:** When Business NEX Chat subscription is active →
  Vault access is granted via `nex_account.vault_tier = 'business'`.
  When subscription expires → B4 grace period kicks in. Trial is
  separate: single 7-day window per account, triggered by
  `activateVaultTrial()`.
- **Owner locked decision (2026-10-20):** Accept. "Paid Business
  entitlement and trial entitlement must be independent, explicit
  states. A trial must not accidentally grant permanent access,
  and the broken `vault_tier` scaffolding must be corrected
  through a reviewed migration and subscription-write path."
- **Locked wording (owner-signed 2026-10-20):** *"B8 — Accept
  the proposed separation, subject to W3 and entitlement tests
  before any public Business/Vault claim."*
- **OWNER FINAL DECISION (LOCKED 2026-10-20):** `[x] Accept proposed  [ ] Other (specify): ___`

---

## Section C · Code work required BEFORE Vault can be advertised

Each item below must land before the corresponding owner decision
above becomes true in the live app. None of this is in scope for
this policy sheet — the sheet locks the destination; the work is
sequenced separately.

| ID | Work | Blocks |
|---|---|---|
| **W1** | Add server-side storage-allowance enforcement. Reject upload when `SUM(byte_size) + new.byte_size > tier_cap`. | B1 |
| **W2** | Add server-side per-file size limit at the upload boundary. | B2 |
| **W3** | Add `vault_tier` column migration (`nex_account.vault_tier text null CHECK (vault_tier IN ('gratis','business'))`). Set to `'business'` by the Business-subscription write path, back to `null` on expiry. Rewire `effectiveVaultAccess()` accordingly. **This fixes the broken scaffolding at `vault-service.ts:23`.** | B4, B8 |
| **W4** | Implement grace-period scheduler (cron / scheduled function) that: (a) marks accounts whose Business subscription expired as `vault_access = 'read_only'` at day 0; (b) deletes vault files + envelopes at day 30 **GATED by the six-pre-condition fail-safe deletion gate defined in §B4 — if any pre-condition is RED on the scheduled deletion date, the scheduler SUSPENDS the deletion, raises an operational alert, and notifies the customer; destructive expiry never runs silently while a safeguard is failing**; (c) sends two emails (day 0 + day 20). W4 cannot be marked done without passing tests proving each of the six pre-conditions correctly suspends the deletion when red. | B4, B5 |
| **W5** | UI banner on `/vault/*` when `vault_access === 'read_only'` — explains the 30-day countdown, offers one-tap renewal, offers one-tap "download everything" ZIP. | B4, B5 |
| **W6** | Trial-countdown UI (days left + warning on day 5 and day 6) + instant-lock + 30-day deletion countdown + "download everything" ZIP on trial expiry. **Trial-day-37 deletion is GATED by the same six-pre-condition fail-safe deletion gate defined in §B4** — RED pre-conditions suspend deletion, alert owner, notify customer. **Date-display rule:** derive from `vault_trial_used_at + 7d + 30d` TIMESTAMP; render via sealed i18n timezone pipe; never display literal "day 37" phrasing where an actual date and time is required. | B5 |
| **W7** | Fix UI copy on `vault/intro/page.tsx` — update *"100% PRIVATE"* and *"Always Available"* to match whatever is locked in B6 + B4. | B6 |
| **W8** | Document + enforce the metadata privacy policy (B7). Includes DB query log or policy sign-off audit. | B7 |
| **W9** | Decide whether orphaned storage-bucket objects are swept after `ON DELETE CASCADE` (migration 141 clears the DB rows but doesn't guarantee the Supabase storage bucket is pruned). | B3, B4, B5 |
| **W10** | **NEW (F2 audit · expanded + CORRECTED 2026-10-20 per owner).** The earlier version of this row claimed the audit log would record "every SELECT / INSERT / UPDATE / DELETE touching any `nex_vault_*` table" via a `nexSupabaseAdmin` wrapper. **That claim was technically wrong and is now retracted.** A wrapper can only capture operations that pass THROUGH the wrapper · it cannot see raw `psql` sessions, Supabase SQL-editor queries, direct service-role calls from other code paths, or ops tooling that uses the Supabase REST API directly. The true scope is: **W10 captures APPLICATION-LAYER vault-table access that passes through the audited wrapper · DIRECT database access and out-of-band service-role operations are OUTSIDE W10's coverage** and must be addressed by complementary controls (W11 scoped read role · restricting Supabase SQL-editor access by role · policy + staff off-boarding for service-role credentials · dashboard access logs if available from Supabase). **W10 deliverables (minimum):** (A) `nex_vault_audit_log` migration (append-only). (B) Thin audit wrapper in `src/lib/nex-native/vault/` that logs every call from NEX application code to a `nex_vault_*` table. (C) **Honest scope statement** inside the audit log's own schema comment: "This log records application-layer vault-table access via the sealed wrapper. Direct database access, Supabase SQL-editor queries, and out-of-band service-role operations are OUT OF SCOPE for this log and must be governed by complementary controls." (D) **Coverage test** demonstrating that bypass paths (direct `psql`, Supabase dashboard SQL, a raw `.from("nex_vault_file")` call outside the wrapper) are DETECTABLE as a documented gap, not silently absent. (E) **Five sub-decisions** (unchanged from previous version, still required): (1) Reader scope · (2) Retention · (3) Failure behaviour · (4) Tamper protection · (5) Monthly review process. **NEX must NOT claim "all Vault access is audited" until the direct-access gap is closed by W11 or a documented residual-risk acknowledgement.** B6 copy option (b) ("All vault access is audited") is unavailable until that gap is closed. | B6 (b), B7 (a)(b) |
| **W11** | *Optional / deferred.* Investigate whether vault metadata reads can use a separate read-only Supabase role so even accidental over-querying surfaces as a role mismatch. Deferred until W10 reveals legitimate-query volume. | B7 (a) |
| **W12** | **NEW (F1 audit).** Finish the sealed Phase A.6 client-side migration runner so chat-attachment copies no longer sit at rest as plaintext in the private vault bucket. Required before B6 copy option (b) is defensible. See `src/lib/nex-native/vault/client/legacy-migration.ts`. | B6 (b) |

---

## Section D · What ships on `/packages` once this sheet is locked

Per the sealed Owner directive 2026-10-20 ("Omit Vault from the
Business card entirely" until entitlements are defined and the
code work above has landed) **AND** per the owner's 2026-10-20
post-audit preference ("omit Vault from public packages until the
required security work is complete"):

- **Default position until W1 + W2 + W3 + W4 + W5 + W6 + W7 + W10 +
  W12 have shipped:** `/packages` Business card OMITS Vault
  entirely. No Vault bullet, no "secure storage" phrase, no
  "coming soon" placeholder. The Business card lists identity,
  customer chat, products/services, business presence · Vault is
  silent.
- **If the owner at any later point authorises partial Vault
  copy BEFORE all nine work items have shipped:** the copy MUST
  carry the Phase A.1 caveat verbatim per B6 option (a). W12 (the
  Phase A.6 migration completion) is a HARD prerequisite for ANY
  stronger copy.
- **If all nine work items (W1 + W2 + W3 + W4 + W5 + W6 + W7 +
  W10 + W12) have shipped AND the sheet is locked AND
  implementation evidence has been reviewed:** the Business card
  may include a single line matching the B6 copy option chosen,
  plus a short "What's included" bullet list derived from B1 + B2
  + B4 verbatim.
- **At no stage** may `/packages` promise storage, retention,
  encryption, or trial behaviour that the code does not verifiably
  honour. This is the universal doctrine applied specifically to
  the packages surface.

---

## Section D-pre · Legacy-migration audit (owner-flagged 2026-10-20)

Before B6 copy option (b) ("End-to-end encrypted. Only you hold the
key. All vault access is audited.") can be considered defensible,
the sealed Phase A.6 client-side migration runner at
`src/lib/nex-native/vault/client/legacy-migration.ts` must be
audited independently. Required findings:

1. **Migration states** · what intermediate states exist between
   `legacy` (plaintext at rest) and `encrypted` (ciphertext at
   rest)? Any partial state where the DB claims one thing but
   storage holds another?
2. **Failure handling** · if encryption fails mid-flight, does
   plaintext remain in the bucket? Is the DB row left in a
   consistent state?
3. **Retry behaviour** · if the user re-opens Vault after a
   failed migration, does the runner retry? Does it duplicate
   writes? Does it ever leave orphan ciphertext alongside the
   plaintext?
4. **Partial-migration safety** · if the user migrates 50 of 100
   files then closes the tab, are the 50 encrypted files safely
   decryptable with the current VMK? Are the remaining 50 still
   intact as plaintext?
5. **Observability** · are migration transitions logged (to
   `nex_vault_file_migration_attempt` per the schema)? Can an
   owner-side query confirm "zero legacy rows remain for this
   account"?

This audit is NOT in the current F1 report (F1 confirmed the
runner exists and is the sealed mechanism; it did not line-by-line
verify its correctness). Scheduling: before any §B lock that
depends on W12.

---

## Section E · Decision checklist (LOCKED 2026-10-20)

- [x] **B1 · Storage allowance** chosen: **(a) 5 GB per Business account**
- [x] **B2 · Per-file size limit** chosen: **(a) 50 MB = 50,000,000 bytes (decimal)**
- [x] **B3 · Active-subscription retention** accepted
- [x] **B4 · Subscription-expiry grace period** chosen: **(a) 30-day read-only** · deletion gated by fail-safe gate
    - [ ] B4 transition copy (day 0 / day 20 / day 30) **DIRECTION approved; verbatim copy NOT locked** · pending W5 download-everything + W12 migration verification
- [x] **B5 · Trial-expiry data behaviour** chosen: **(b) 7-day trial + 30-day read-only/download grace** · dates derived from TIMESTAMP + account timezone
    - [ ] B5 activation-screen copy T1 **DIRECTION approved; verbatim copy NOT locked** · pending timestamp binding + sealed i18n timezone pipe (W6)
    - [ ] B5 in-trial countdown T2 **DIRECTION approved; verbatim copy NOT locked** · pending W6
    - [ ] B5 post-expiry copy T3 **DIRECTION approved; verbatim copy NOT locked** · pending W5+W6+W12
- [x] **B6 · Packages-page encryption copy** chosen: **(c) OMIT** until W12 + W10 + verification evidence
- [x] **B7 · Metadata privacy policy** chosen: **(b) Written policy + technically-honest W10** · defer W11
- [x] **B8 · Business-vs-trial separation** accepted · pending W3 entitlement tests

**All eight §B rows LOCKED 2026-10-20 per owner authorisation
(full text in §G).** The copy sub-rows under B4 and B5 remain
open because their verbatim text depends on W-items that are not
yet implemented — direction is locked, exact wording awaits the
code it describes.

Separately · the work-items in §C are **scheduling** decisions, not
part of the policy lock. The owner approves W1-W12 one at a time
when the implementation slice is authorised.

Once the eight §B rows (plus sub-rows for B4 + B5) are ticked, the
sheet is **LOCKED** and **S1 (pricing data layer) may begin** —
owner-authorised 2026-10-20 — because S1 is a pure TypeScript
module with no UI and makes no customer-facing Vault claim. S2
(country persistence, requires a migration) and S3 (public
packages page) are **separate per-slice gates**:

- **S1** · unblocked when the policy is locked. No customer-facing
  Vault claim, no migration, no UI.
- **S2** · requires separate owner authorisation. Includes
  migration 213 (`nex_account.country_iso2`) + `createNexAccountAction`
  persistence. S2 does NOT touch Vault copy.
- **S3** · the public packages page. **Blocked** until the §B
  rows that gate Vault-related copy have landed with implementation
  evidence. Specifically: if §B6 is locked at option (c) *"omit"*,
  S3 may ship with Vault omitted (per §D default position); any
  stronger Vault copy on S3 requires W1 + W2 + W3 + W4 + W5 + W6 +
  W7 + W10 + W12 evidence per §D. The public packages page must
  not advertise Vault until the required controls and evidence
  are in place.

This resolves the earlier inconsistency between §E and the "What
this sheet does NOT do" section (owner-sealed 2026-10-20): S1
proceeds on policy-lock alone; S2 and S3 retain their own gates.

**Reminder (universal doctrine):** locking a §B row = permission to
SCHEDULE the matching §C work. Advertising the guarantee to
customers requires the §C work to have landed with implementation
evidence and tests. Policy ≠ working controls.

**Evidence-linking requirement (owner-sealed 2026-10-20):** a
checklist is NOT complete merely because every box is ticked. Each
tick must link to one of:
- An approved policy decision (link to a specific §B row with the
  option chosen).
- A passing test (link to the test file + run output).
- A verified control (link to the migration + a staging-run log
  proving the enforcement fires).
- An explicitly accepted residual risk (one sentence from the
  owner acknowledging what is NOT yet closed and why launch may
  proceed anyway).

The lock event itself is the OWNER-SIGNED record that evidence
has been reviewed per row. Any §B tick without one of the four
forms of evidence above is a draft tick, not a lock.

---

## Section F · Owner-flagged review attention points (2026-10-20 · DEEPENED)

**Status note:** When this section was first added (earlier on
2026-10-20) it listed the four points as GAPS in the draft. After
the owner authorised deeper audits, F1 (E2E complete-path) and F2
(metadata access controls) were performed and their findings are
now folded into §A (reality rows), B6/B7 (updated options), and
new work-items W10 / W11 / W12 in §C. F3 (B4 transition copy) and
F4 (B5 trial copy) are now explicit sub-sections under each
decision row. The owner's four attention points remain the review
compass; the text below is retained unchanged as the review
discipline the owner will apply.



The owner highlighted four points to pay particular attention to
before locking any §B row. Each is flagged against the row(s) it
most affects. The current draft is INCOMPLETE against them and
should NOT be considered review-ready until the gaps are addressed
or acknowledged.

### F1 · End-to-end encryption · verify the COMPLETE data path (affects B6)

The audit on 2026-10-20 verified the UPLOAD path (VMK client-only,
K_f wrapped under VMK, server receives opaque ciphertext). It did
NOT verify:

- **Download path** · when the user retrieves a file, is decryption
  guaranteed client-side? Could any server endpoint hold or
  reconstruct the plaintext?
- **Key recovery path** · when WebAuthn-PRF or recovery passphrase
  is triggered, is the VMK re-wrapped entirely client-side? Does
  the server observe any intermediate secret?
- **Chat → Vault copy** · when a message or attachment is moved
  from ordinary chat into Vault, is the content re-encrypted
  client-side under the new K_f? Or does the server perform the
  re-encryption, briefly handling plaintext?
- **Share / export** · does any "share this file" or "export vault
  contents" path exist that transits plaintext through the server?

An encrypted primary upload does not automatically prove every
Vault operation is end-to-end encrypted. B6 copy may only claim
E2E for operations proven to be E2E end-to-end.

### F2 · Metadata privacy · access controls + auditability (affects B7)

The current B7 proposal is a WRITTEN POLICY ("staff will only query
during incident response"). The owner flagged that policy alone is
not enough. Also required:

- **Access controls** · who/what has service-role Supabase access
  to `nex_vault_file`, `nex_vault_setup`, `nex_vault_key_envelope`,
  `nex_vault_conversation_envelope`? Does RLS gate these? Is there
  a separate restricted schema? Are automated analytics / support
  tools scoped away from these tables?
- **Auditability** · is a query log maintained? Can a staff
  SELECT on vault metadata be reconstructed after the fact? Who
  reviews the log?
- **Enforcement** · what is the consequence of unauthorised access?

A policy that NEX cannot enforce or audit is a promise NEX cannot
honour. B7 needs an audit of the current state before the proposed
copy is honest.

### F3 · Subscription expiry · access loss ≠ data deletion (affects B4)

The current B4 proposal distinguishes 30-day read-only grace from
day-30 deletion, but the implementation gap is wider than the
sheet acknowledges:

- The UI copy must make the distinction unambiguous. "Your Vault
  is locked" ≠ "your files have been deleted." Users should never
  have to guess whether their data still exists.
- The scheduled job (W4) must emit a verifiable TRANSITION log:
  day 0 expiry → read-only; day 30 → deletion. Each transition
  must be inspectable.
- The grace-period emails (W4) must say explicitly what will
  happen and when, with the exact day-30 deletion date in local
  time.

A customer's subscription expiring must never silently imply that
their stored files have been destroyed.

### F4 · Trial expiry · explicit limit + explicit data fate (affects B5)

The current B5 proposal is "instant lock on day 7, delete on day
37." The owner flagged that the trial copy must make BOTH halves
unmissable:

- The 7-day limit must be stated at trial activation, not buried
  in fine print.
- What happens to data between day 7 and day 37 (locked but
  preserved) must be stated.
- What happens after day 37 (permanently deleted) must be stated.
- Users must have a verifiable "download everything before day 37"
  path (W6).

B5 is not lockable until the trial-activation copy, in-trial
countdown copy, and post-expiry copy are drafted and reviewed.

### F5 · Universal doctrine (affects every row)

> A written policy and a completed §E checklist do NOT prove the
> controls work. Each §C work item requires implementation
> evidence AND tests before NEX makes the corresponding
> customer-facing claim. The §B lock = permission to schedule;
> customer-facing advertisement = after §C implementation evidence
> lands.

---

## Section G · Lock record (owner-signed 2026-10-20)

**Lock event:** The eight §B decisions were LOCKED on 2026-10-20
under the owner's authorisation message titled *"LOCK AS
RECORDED. Authorize only the policy-lock action described in the
final review."* Reproduced verbatim below for provenance.

### Owner authorisation (verbatim)

> **LOCK AS RECORDED.**
>
> Authorize only the policy-lock action described in the final
> review.
>
> 1. Change the NEX Vault Entitlements Policy status from DRAFT
>    to LOCKED.
> 2. Tick all eight final decision boxes B1–B8 exactly as
>    recorded in the review.
> 3. Preserve the three sealed owner principles verbatim.
> 4. Update MEMORY.md to reflect the locked policy decisions and
>    all existing safeguards, gates, and outstanding verification
>    requirements.
> 5. Verify the final document and memory update, then report the
>    exact files changed and the resulting policy status.
>
> **STRICT SCOPE:**
> - Do not write or modify application code.
> - Do not schedule or implement W1–W12.
> - Do not start S1; wait for separate explicit authorization.
> - Do not apply migration 213 or any other migration.
> - Do not access or modify production Supabase data.
> - Do not add Vault claims to public pages or packages.
> - Do not alter the independent Phase A1 release hold.
> - Do not mark any control as implemented or verified merely
>   because the policy is locked.
>
> The six-precondition fail-safe deletion gate, the W10
> audit-scope limitation, the W12 migration-verification
> requirement, and the requirement for a tested download-everything
> path must remain explicit.

### What this lock DOES

- Records the eight §B decisions as owner-signed.
- Records the sub-decisions attached to each B row (byte
  definition, fail-safe deletion gate pre-conditions, Vault copy
  omission, W10 scope correction) as owner-signed.
- Unblocks S1 **in principle** · S1 still needs a separate
  "START S1" authorisation before any code is written.
- Preserves the three sealed owner principles verbatim (data +
  recovery protection; expiry ≠ deletion; security claims match
  reality) at the top of this sheet.

### What this lock does NOT do

Per the owner's STRICT SCOPE above, this lock:

- Does NOT schedule or implement W1 through W12.
- Does NOT start S1.
- Does NOT apply any migration (including 213).
- Does NOT touch production Supabase.
- Does NOT add any Vault claim to public pages or packages.
- Does NOT alter the independent Phase A1 release hold.
- Does NOT mark any control as implemented or verified.

### Verification requirements that remain explicit

The following constraints survive the lock and apply to every
future authorisation downstream of this sheet:

1. **Six-precondition fail-safe deletion gate (§B4):** every
   scheduled Vault deletion MUST verify all six pre-conditions
   (download succeeded · no legacy rows · bucket cleanup
   verified · W10 audit write succeeded · notifications
   delivered · no active ticket). Any RED pre-condition
   SUSPENDS deletion, raises an operational alert, notifies the
   customer. No silent destructive expiry.
2. **W10 audit-scope limitation (§B7 + §C W10):** W10 captures
   application-layer vault-table access via the sealed wrapper.
   Direct DB access, Supabase SQL-editor queries, and out-of-band
   service-role operations are OUT OF SCOPE and must be
   addressed by complementary controls. NEX must NOT claim
   "all vault access is audited" until the direct-access gap is
   closed.
3. **W12 Phase A.6 migration verification (§D-pre):** the
   `vault/client/legacy-migration.ts` runner must be audited
   line-by-line for migration states, failure handling, retry
   behaviour, partial-migration safety, and observability
   BEFORE any §B6 copy stronger than "omit" ships.
4. **Tested download-everything path (§B4 pre-condition 1,
   §B5 T1-T3, §C W5+W6):** the bulk-export ZIP endpoint does
   NOT exist today. It must be built AND tested against real
   encrypted + plaintext-at-rest files BEFORE any destructive
   expiry runs for any account.

### Downstream gates (reaffirmed)

- **S1** (pricing data layer): unblocked by this lock in
  principle · needs separate "START S1" authorisation.
- **S2** (country persistence + migration 213): separate per-slice
  authorisation.
- **S3** (public packages page): Vault copy blocked until the
  work-items in §D have shipped with evidence. Default position
  per §D: Vault OMITTED from the Business card entirely.
- **W1–W12**: each needs separate authorisation. Lock ≠ schedule.
- **Phase A1 release hold:** independent · unaffected by this
  lock.
- **vault/intro/page.tsx misleading copy ("100% PRIVATE" /
  "Always Available"):** must be removed or qualified via
  separately authorised UI change. This is NOT contingent on B6.

---

## What this sheet does NOT do

- It does **not** schedule the code work (W1–W9). That's a separate
  authorisation per slice.
- It does **not** approve any pricing-page UI (S3), the S2
  migration + country persistence, or any payment integration.
  **(Correction 2026-10-20 per owner):** S1 (the internal
  pricing data layer · pure TypeScript, no UI, no customer-facing
  Vault claim) IS unblocked when this sheet is locked. S2 and S3
  are separate per-slice authorisations. The earlier wording
  "S1 → S2 → S3 are blocked until this sheet is locked AND W3 is
  scheduled" was an over-conservative gate on S1 that the owner
  has retired · it unnecessarily coupled internal pricing data
  to a database migration. S2 and S3 gates remain in force.
- It does **not** change the sealed Vault cryptographic
  architecture (VMK · K_c · K_f · AES-GCM · WebAuthn · PIN ·
  recovery). Those remain untouched by any pricing / entitlement
  decision above.
- It does **not** retire the sealed `/settings/tier` 7-tier ladder
  (owner directive 2026-10-20).
