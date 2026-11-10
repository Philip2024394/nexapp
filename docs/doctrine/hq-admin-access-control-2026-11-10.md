# HQ-admin access-control · decision paper · 2026-11-10

**Status:** Decision paper for owner review. No code change. No
migration. No commit. No push. No deploy. Papers-only output per
authorisation 2026-11-10.

**Primary code paths examined:**

- `src/lib/nex-native/hq-authorization.ts` · `requireHqAdmin` /
  `requireHqReviewer` helpers · fail-closed · reads `nex_account.hq_role`
  via service-role client.
- `src/lib/nex-native/supabase-admin.ts` · `nexSupabaseAdmin` is the
  service-role client used by every HQ server page + action.
- `src/app/nex-native/hq/members/page.tsx` + sibling HQ pages (chats,
  shops, vault, support-tickets, security-audit, security-recovery,
  alerts, communities, members/[accountId]/...) · all call
  `requireHqAdmin(session.account.id)` and then read data via
  `nexSupabaseAdmin`.
- `nex-supabase/migrations/206_nex_account_hq_role.sql` · the
  `hq_role` column (nullable text; `reviewer` | `admin`).
- `nex-supabase/migrations/315_nex_support_ticket.sql` ·
  `support_admin_grant` table · opt-in admin grant per account_id.
- `docs/audit/rls-classification-2026-11-10.md` · flags that no
  HQ-admin RLS policies have been drafted on the sensitive tables.
- `nex-supabase/migrations/P-RLS-nex_pilot_operator_audit_PROPOSAL.sql`
  · existing shape of a proposal migration we would mirror.

---

## 1 · Current state

- `nex_account.hq_role` (migration 206) is a nullable text column
  constrained to `('reviewer','admin')`. Only two subjects in this
  universe are HQ-privileged: any row with `hq_role = 'admin'` passes
  `requireHqAdmin`; reviewer is strictly weaker (not sufficient for
  HQ-admin pages).
- `requireHqAdmin` is **the only gate** between an HTTP request to
  `/nex-native/hq/*` and the service-role Supabase read. It runs
  independently on every HQ page and every HQ server action (per
  sealed doctrine inside `hq-authorization.ts` lines 20–24 ·
  "page gating is NOT sufficient · each action re-verifies").
- Every HQ page we sampled (`members/page.tsx`, `members/chats/page.tsx`,
  `members/[accountId]/traffic/page.tsx`, `support-tickets/page.tsx`,
  `security-audit/page.tsx`) follows the identical pattern:

  ```ts
  const session = await resolveSessionWithDevOverride();
  if (!session) notFound();
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) notFound();
  // ... then data reads via nexSupabaseAdmin (service-role · RLS bypassed)
  ```

- `nexSupabaseAdmin` is a single process-wide client built from the
  `NEX_SUPABASE_SERVICE_ROLE_KEY`. Supabase service-role bypasses RLS
  on every table.
- **No DB-level admin policy exists on any sensitive table.** The
  2026-11-10 RLS classification report flags 16 GAP-P0 tables including
  `nex_trusted_contact`, `nex_peer_message`, `nex_business_claim`,
  `nex_community_notice_report`. The admin read path to any of those
  tables goes exclusively through `nexSupabaseAdmin`, not through a
  session-scoped client.
- If an HQ page were ever switched from `nexSupabaseAdmin` to a
  session-scoped Supabase client (the user's own JWT), it would see
  empty tables because no RLS policy currently grants admins SELECT.
- `nex.support_admin_grant` (migration 315) is a second,
  **feature-scoped** admin grant mechanism specific to support tickets.
  Admins must appear in this table independently of their `hq_role`
  before they can read/reply to tickets. This is deliberate opt-in per
  surface · but it does not generalise to the other 15 sensitive tables.

## 2 · The problem

1. **Service-role overreach.** Every HQ render path has the full
   service-role key available. A code-injection bug in a single HQ page
   component (or any helper it imports) could read any row in any table.
   There is no DB-level distinction between "admin operating a
   dashboard" and "system doing background work".
2. **No RLS backstop.** If `requireHqAdmin` itself is ever bypassed
   (import-ordering bug, middleware skip, an un-gated route accidentally
   shipped), the data is unprotected because RLS is not enforcing a
   second line of defence.
3. **Weak admin-read auditability.** `recordAuditEvent` is called for
   the **authz success/denial** on HQ gates (in `hq-authorization.ts`
   lines 161–189), but there is NO table-level audit for individual
   admin reads. We cannot answer "which admin read this
   `nex_trusted_contact` row at 14:03?" after the fact. The existing
   `nex_pilot_operator_audit` table demonstrates the pattern we would
   want (operator_identity + action) but it is not integrated into HQ
   reads.
4. **Policy sprawl risk if left to accumulate.** Each new sensitive
   table added without an admin policy template means future "admin
   dual-track" work gets larger, not smaller.

## 3 · Design options

### Option A · Keep service-role · tighten the app-layer gate (status quo+)

- Keep `nexSupabaseAdmin` as the single HQ data-access client.
- Harden `requireHqAdmin` discipline (lint rule requiring that any file
  under `src/app/nex-native/hq/**` imports `requireHqAdmin` AT the top
  AND has a test in `__tests__/hq-gate-coverage.test.ts` covering it).
- Zero DB migration. Zero RLS change.

### Option B · Dual-track RLS · admin overlay policies on every sensitive table

- Add an RLS SELECT policy to every GAP-P0 table of the form:

  ```sql
  CREATE POLICY "<table>_admin_read"
  ON <table> FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM nex_account a
      WHERE a.supabase_user_id = auth.uid()
        AND a.hq_role = 'admin'
    )
  );
  ```

- HQ server pages switch from `nexSupabaseAdmin` to a session-scoped
  Supabase client (the browser-session JWT that already gated the page).
- Service-role still works for background jobs and admin WRITES (we
  do NOT grant admins arbitrary write via RLS · writes remain
  service-role-gated through the sealed server-action layer).
- Reviewer role can be given a narrower policy (future: SELECT without
  the enforcement-decision tables).
- Keep `nex_pilot_operator_audit` and `nex_security_audit_log`
  **service-role-only** (admins must NOT be able to read the audit
  record of themselves or of other admins · prevents an evidence-wipe
  loop).

### Option C · PostgreSQL role separation · dedicated `nex_hq_admin` DB role

- `CREATE ROLE nex_hq_admin` at the Postgres level.
- Grant `SELECT` on each sensitive table (via a migration) to that role.
- NEX acquires a second service key tied specifically to `nex_hq_admin`
  (Supabase does not natively support this today · would require
  per-connection `SET LOCAL ROLE` after authenticating with a privileged
  key OR a custom JWT claim pipeline).
- HQ pages switch to a client built from this second key.
- Service-role remains for background infrastructure only.

## 4 · Attribute comparison

### Attack surface if the admin session is compromised

- **Option A:** Attacker who hijacks an admin session renders HQ pages
  via the service-role client → reads **every table** including the
  audit log itself, including rows the admin role would have been
  specifically denied.
- **Option B:** Attacker who hijacks an admin session can SELECT rows
  the admin policy permits, but is bounded by:
  - Tables with no admin policy are unreadable (defence-in-depth).
  - Writes still require the service-role path (enforcement server
    actions on the server · session JWT cannot forge).
  - `nex_security_audit_log` and `nex_pilot_operator_audit` remain
    service-role-only → audit cannot be tampered with via admin-JWT
    replay.
- **Option C:** Smallest surface · the `nex_hq_admin` role grants are
  explicit at the Postgres level, so even a bug in RLS cannot escalate
  beyond what GRANT allowed. But implementation cost is highest.

### Audit traceability (can we tell which admin read this row)

- **Option A:** Only via `recordAuditEvent` inside `requireHqAdmin`,
  which logs the ACT of gating but not the specific rows read. Row-level
  reads under service-role are invisible to the audit log.
- **Option B:** With RLS, `auth.uid()` is available server-side. We can
  add a SECURITY DEFINER read-wrapper RPC per table that INSERTs a
  `nex_security_audit_log` row before returning rows → makes admin
  reads attributable. Without the wrapper, RLS still beats service-role
  for traceability because the access surface is narrower.
- **Option C:** PostgreSQL logging (pgaudit extension) can log every
  SELECT performed by the `nex_hq_admin` role. Highest fidelity.

### Migration burden

- **Option A:** 0 migrations. One lint rule and one test-coverage
  tightening.
- **Option B:** One proposal migration (
  `P-RLS-HQ-admin-overlay-PROPOSAL.sql`) adding ~16 SELECT policies
  (one per GAP-P0 table) plus a helper function
  `nex_is_hq_admin(uuid)` to avoid repeating the sub-select.
- **Option C:** Two migrations (role create + GRANT matrix) plus
  non-trivial SDK plumbing to establish the second key.

### Operational impact (HQ code changes)

- **Option A:** None.
- **Option B:** Every HQ page + reader (sampled set: `_reader.ts` under
  `/hq/members`, `security-audit/_reader.ts`, `/hq/communities/*` et al.
  · ~30 files) switches from `nexSupabaseAdmin` to a session-scoped
  client factory. Writes stay service-role. Background jobs stay
  service-role.
- **Option C:** Same scope as B, but the new client factory must manage
  key rotation for a second key and ensure background jobs cannot
  accidentally pick up the admin key.

## 5 · Audit requirements (mandatory regardless of option chosen)

The owner-sealed security-audit doctrine (migration 292 · `recordAuditEvent`)
is the single source of truth for admin-action auditability. Independently
of A/B/C, the following must hold for EVERY sensitive admin read listed
in §6:

1. Every read action writes a `nex_security_audit_log` row before
   returning data (migration 292 RPC pattern).
2. The sanitiser strips message plaintext, bearer tokens, raw IPs,
   attachment payloads, and any field classified as PII per the sealed
   audit doctrine. Current `metadata` jsonb column must be validated
   against an allow-list at the writer (per migration 292 header line
   26: "the application layer enforces a per-event allow-list before
   INSERT · unknown keys are stripped").
3. `event` uses the stable `security.<namespace>.<action>` prefix so
   the migration-293 reconciler can pair attempted/completed events.
4. `actor_account_id` is the HQ admin's `nex_account.id`, NOT the
   target subject's id. Both the admin and the subject should be
   recorded (admin as `actor_account_id`, subject as `target_type` +
   `target_id`).
5. Audit failures do not block the admin read (fire-and-forget, per
   existing `hq-authorization.ts` pattern) · but a sustained audit
   outage must trigger an operational alert in a separate monitor.

These requirements are not satisfied today for the row-level reads
listed in §6 · they are satisfied only for the authz gate itself.

## 6 · Sensitive operations list (admin can do · subject cannot opt in)

Each entry below is a distinct operation that, on authorisation,
reads or writes data a normal account could never reach. Every one of
these MUST (independent of Option A/B/C) write a sanitised audit row:

1. **Read `nex_trusted_contact` for another user** (emergency-help
   trusted contacts · subject identity + relationship label).
2. **Read `nex_peer_message` metadata** · the chat-privacy doctrine
   forbids plaintext access entirely. Admin surface MUST be
   metadata-only (participant IDs, timestamps, delivery flags) and
   MUST NOT touch the message body column even if the schema allows it.
3. **Read attachment metadata** (`attachment_meta` on
   `nex_peer_message`; the sealed device-only doctrine forbids any
   plaintext attachment persistence · admin may only ever see
   content-type + size + ciphertext existence flags).
4. **Delete / merge canonical directory rows** on `nex.business_canonical`
   (migration 167) · two canonical rows for the same real-world
   business merged into one · lifecycle_log row written.
5. **Review `nex.business_media_review` + approve/reject images**
   (migration 189).
6. **Transition `nex.business_claim` state** · approve or reject a
   claim.
7. **Write `nex_account`** · role elevation (set `hq_role`),
   suspension (future `suspended_at` column if ever added), tier
   override. Any write on `nex_account` by an admin is an enforcement
   event.
8. **Read or redact `nex_community_notice_report` rows** · identifies
   reporter + reported. Audit row must mask the reporter identity
   downstream per the sealed safety doctrine.
9. **Read `nex_incident` critical/warn rows** (surfaces on
   `/hq/alerts`) · already audit-logged via the HQ gate.
10. **Reply inside `nex.support_message` as admin** · requires the
    `support_admin_grant` opt-in table (migration 315) in addition to
    `hq_role='admin'`. Appended messages carry `sender_kind='admin'`
    and the admin's `sender_account_id` · already attributable.

For the device-only chat and attachment surfaces (items 2 and 3), the
audit row MUST NEVER contain any excerpt of the message body / attachment
payload, even for diagnostic purposes. The sanitiser is the only
authority on this.

## 7 · Recommendation

**Option B (dual-track RLS)** — gives the DB-level backstop that Option
A lacks, at a fraction of the plumbing cost of Option C, and preserves
the existing service-role path for background jobs and writes.

## 8 · Migration plan if B is approved

**Deliverable:** one proposal migration
`nex-supabase/migrations/P-RLS-HQ-admin-overlay-PROPOSAL.sql`.

**Shape (sketch · not for apply · no SQL to run):**

```sql
-- PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY
-- Drafted 2026-11-10 by HQ-admin access-control doctrine paper.
BEGIN;

-- Helper · centralise the admin check so each policy is a one-liner.
CREATE OR REPLACE FUNCTION nex_is_hq_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM nex_account a
    WHERE a.supabase_user_id = _uid
      AND a.hq_role = 'admin'
  );
$$;

-- Repeat for each GAP-P0 sensitive table. Example:
ALTER TABLE nex_trusted_contact ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nex_trusted_contact_admin_read"
  ON nex_trusted_contact FOR SELECT
  TO authenticated
  USING (nex_is_hq_admin(auth.uid()));

-- ... 15 more tables ...

COMMIT;
```

**Scope control:**

- `nex_pilot_operator_audit` stays **service-role-only** · admins must
  never read the operator audit via their own JWT (would let a
  compromised admin erase their own breadcrumbs).
- `nex_security_audit_log` stays **service-role-only** for the same
  reason. Admin dashboards that surface audit entries should go through
  a read-only RPC (`nex_hq_audit_log_search`) that logs the read
  itself.
- Authored tables with admin-only WRITE semantics (business_canonical
  merges, claim approvals) keep writes service-role · policies ADDED
  are SELECT-only. Writes go through sealed server-actions that
  independently re-check `requireHqAdmin` + sanitise.
- The migration applies to SANDBOX ONLY on first apply. Production
  application requires a separate explicit owner authorisation
  (Safety Constitution §5), and a follow-on test migration asserting
  that `select from nex_trusted_contact` returns zero rows for a
  non-admin JWT and non-zero for an admin JWT.

**Rollback:** `DROP POLICY` per table + `DROP FUNCTION
nex_is_hq_admin`. Non-destructive to data.

**Code changes paired with Option B (NOT in this paper · would be a
separate Phase):**

1. New factory `nexSupabaseAsAdminSession(session)` returning a
   session-scoped Supabase client that uses the admin's JWT.
2. Every HQ page `_reader.ts` migrates to that factory; writes stay
   on `nexSupabaseAdmin`.
3. Per-table audit wrappers on the ~10 sensitive reads in §6.
4. A new test file `rls-admin-overlay.test.ts` asserting that a
   non-admin JWT gets zero rows from every GAP-P0 table under the new
   policy.
