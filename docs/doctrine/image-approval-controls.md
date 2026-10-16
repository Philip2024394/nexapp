# Image approval controls — readiness checklist

Phase 1 shipped the queue structure, the resolver, and a READ-ONLY admin
inspector. This document captures what the approve/reject action layer
needs to add before it can safely write.

## Required controls

### 1 · Reviewer identity (reuse existing)

- Server action must call `resolveNexAppSessionFromContext()` and
  `nexSupabaseAdmin.auth.admin.getUserById()` to confirm the caller is
  `dev-admin@nex-native.local` (same pattern as `/admin/tier`).
- Reject with 403 if not; redirect to `/home` from the page level.
- Write `reviewed_by = session.account.supabase_user_id` on the
  business_media_review row at decision time.

### 2 · Timestamps + audit trail

- `reviewed_at` must be set to `now()` at decision time.
- `updated_at` is auto-updated on every state change.
- Historical review decisions must be preserved · no DELETE on review
  rows. The `review_state` enum includes 'rejected' and 'merged' for
  terminal states; the row stays in place.

### 3 · Rejection reasons

- `review_notes` text field is nullable but should be REQUIRED (server
  action enforces) when `review_state → rejected` so the audit trail
  carries the "why".
- No notes required for 'approved' (the approval itself is the record).
- For 'quarantined → pending' transitions (admin un-quarantines after
  resolving a match), optional notes.

### 4 · Permission checks on EVERY mutating action

- `approve` server action:
  1. isDevAdmin() → 403 if false
  2. Load current review row by review_id → 404 if missing
  3. Load current review_state → reject if not in ('pending', 'quarantined')
  4. If candidate_canonical_business_id IS NULL at approve time → reject
     with "must resolve match first"
  5. INSERT or UPDATE business_media (approved=true), capture media_id
  6. UPDATE review row: review_state='approved', reviewed_by,
     reviewed_at, approved_media_id, updated_at
  7. All in a transaction.

- `reject` server action:
  1. isDevAdmin() → 403 if false
  2. Load current review row → 404 if missing
  3. review_notes required (server validates length > 0)
  4. UPDATE review row: review_state='rejected', reviewed_by,
     reviewed_at, review_notes, updated_at
  5. No business_media row created or modified.

- `quarantine` (voluntary from pending) + `requeue` (quarantined → pending):
  Same auth + validation pattern.

- `resolve-match` server action:
  1. isDevAdmin() → 403 if false
  2. Load review row → 404 if missing
  3. Accept `candidate_canonical_business_id` as parameter
  4. Confirm the proposed canonical row exists in business_canonical
  5. UPDATE review row: candidate_canonical_business_id, updated_at
  6. Review state stays 'quarantined' until admin separately approves.

### 5 · Rate limiting

- Not required for a human admin at the current scale. If a batch
  "approve N" action is added later, enforce per-session rate limits
  server-side.

### 6 · UI constraints

- Dashboard page is read-only until all mutating actions are implemented
  and have server-side auth + validation tests.
- Approve/reject buttons MUST NOT appear in the UI until the server
  actions are landed. The current page intentionally omits them.
- Links to the raw `source_url` on review rows should open in a NEW
  TAB with `rel="noopener noreferrer"` — admin inspects the candidate
  image on the source domain, not through NEX.
- The source_url must NOT be rendered as `<img src>` on the admin page
  (would send a hotlink referrer to the source domain and might expose
  the admin's IP). Only render as text + "open in new tab" link.

### 7 · Audit log (future · optional)

- A dedicated `nex.business_media_review_audit` append-only log of every
  state transition. Not required for Phase 2; the row's own
  updated_at + reviewed_* columns are sufficient for the first wave.

## Risks blocked until approve/reject lands

- **No admin action** means approvals today require manual SQL
  (documented in the admin page footer). This is intentional: landing
  the queue structure without the action layer forces explicit
  authorization for every approval during the pilot.
- **No batch approvals.** The current pattern is one row at a time.
  Batch tooling is a separate work item.
- **No un-approval (revoke).** Once approved, the only way to hide an
  image again is to flip `business_media.approved = false` or
  `source_registry.can_display = false`. A reject-after-approve
  workflow needs explicit design.

## Phase sequence to safely enable approve/reject

1. Review this doc.
2. Author `src/app/nex-native/admin/image-review/_actions.ts` with the
   five server actions above.
3. Author tests covering:
   - Auth required (403 without session, 403 with wrong email).
   - State-transition validation (can't approve a 'rejected' row).
   - Required field validation (rejection without notes fails).
   - Transactional integrity (business_media + review row in one txn).
   - Correct candidate_canonical_business_id presence check.
4. Add approve/reject/requeue buttons to the admin page.
5. Approve one test row end-to-end against a known ID canonical row
   (needs explicit founder authorisation to execute).
