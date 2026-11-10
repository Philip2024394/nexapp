# RLS Proposal Tightening — 2026-11-10

**Input:** 26 `P-RLS-*_PROPOSAL.sql` drafts from `nex-supabase/migrations/`.
**Classification:** `docs/audit/rls-classification-2026-11-10.md` (16 GAP-P0 · 11 GAP-P1 · 2 GAP-P2 · 7 SYS).
**Scope:** Validate each draft against actual schema + access patterns.
Tighten drafts that are structurally correct but mis-reference columns
or policy-targets. **No migrations applied. No prod touch.**

## Access-pattern model (context for every proposal)

Every NEX-native service touching these tables reads/writes via one of:

- `nexSupabaseAdmin` (service-role key · bypasses RLS)
- `withClient` from `@/lib/nex/db` (direct `pg` connection via
  `NEX_POSTGRES_URL` · runs as the Postgres role in the URL, which
  does NOT inherit Supabase auth.uid())

**Neither path uses a session-scoped Supabase client against these
tables.** No browser code calls `.from("nex_trusted_contact")` or
`.from("nex_community_notice")` etc. directly.

Consequence: these RLS policies are **defence-in-depth against future
grants / future client-direct paths / rogue admin**. They will NOT
break any current call site because every current call site bypasses
RLS via service-role or a direct-pg owner-role connection.

## Drafts kept as-is (no change)

The following 18 drafts were correct and remain unchanged:

- `P-RLS-nex_trusted_contact_PROPOSAL.sql` (owner-scoped FOR ALL)
- `P-RLS-nex_pilot_operator_audit_PROPOSAL.sql` (REVOKE + zero policies)
- `P-RLS-nex_business_outreach_queue_PROPOSAL.sql` (REVOKE + zero)
- `P-RLS-nex_business_outreach_suppression_PROPOSAL.sql` (REVOKE + zero)
- `P-RLS-nex_community_membership_PROPOSAL.sql` (owner-scoped SELECT only)
- `P-RLS-nex_community_notice_PROPOSAL.sql` (zone SELECT + author INSERT/UPDATE)
- `P-RLS-nex_community_notice_update_PROPOSAL.sql`
- `P-RLS-nex_community_notice_confirmation_PROPOSAL.sql`
- `P-RLS-nex_community_notice_report_PROPOSAL.sql`
- `P-RLS-nex_community_card_PROPOSAL.sql`
- `P-RLS-nex_community_card_update_PROPOSAL.sql`
- `P-RLS-nex_community_card_confirmation_PROPOSAL.sql`
- `P-RLS-nex_community_card_report_PROPOSAL.sql`
- `P-RLS-nex_liked_product_PROPOSAL.sql` (owner-scoped SELECT + INSERT + DELETE)
- `P-RLS-nex_support_ticket_PROPOSAL.sql`
- `P-RLS-nex_support_message_PROPOSAL.sql`
- `P-RLS-nex_emergency_location_update_PROPOSAL.sql` (REVOKE + zero)
- `P-RLS-nex_emergency_responder_optin_PROPOSAL.sql` (REVOKE + zero)
- `P-RLS-nex_menu_section_PROPOSAL.sql` (public SELECT + deny write)
- `P-RLS-nex_menu_item_PROPOSAL.sql` (public SELECT live-only + owner-SELECT-all + deny client write)
- `P-RLS-nex_source_registry_PROPOSAL.sql` (REVOKE + zero)

## Drafts tightened (5)

### 1. `P-RLS-nex_emergency_incident_PROPOSAL.sql`

**Problem:** draft referenced `triggered_by_account_id`. Actual mig
224 column is `requester_account_id`.

**Fix:** policy now reads `requester_account_id IN (SELECT id FROM
nex_account WHERE supabase_user_id = auth.uid())`. Policy name renamed
to `nex_emergency_incident_requester_select` for clarity.

### 2. `P-RLS-nex_incident_recipient_PROPOSAL.sql`

**Problems:**
- Referenced `i.id` on nex.emergency_incident (actual PK is `incident_id`).
- Referenced `triggered_by_account_id` (actual: `requester_account_id`).

**Fix:** join rewritten to
`i.incident_id = nex.incident_recipient.incident_id` and
`a.id = i.requester_account_id`.

### 3. `P-RLS-nex_emergency_fanout_log_PROPOSAL.sql`

**Same problems** as incident_recipient. **Same fix.** Policy renamed
to `nex_emergency_fanout_log_requester_select`.

### 4. `P-RLS-nex_business_claim_PROPOSAL.sql`

**Problem:** draft referenced `claimant_account_id` (does not exist).
Actual mig 176 column is `claimed_by_account_id`, type `text`
(cross-DB string — the comment on the column says "Supabase
nex_account.id").

**Fix:** policy now reads
`claimed_by_account_id IS NOT NULL AND claimed_by_account_id =
(SELECT id::text FROM nex_account WHERE supabase_user_id = auth.uid())`.
Includes `::text` cast because nex_account.id is uuid.

### 5. `P-RLS-nex_business_canonical_PROPOSAL.sql`

**Problem:** draft used `lifecycle_state IN ('LIVE','PUBLISHED','VERIFIED')`.
Actual check constraint `ck_bc_lifecycle_state` only allows:
`DISCOVERED · ENRICHED · VERIFIED · OWNER_CLAIMED · OWNER_VERIFIED · DORMANT · SUPERSEDED`.
`'LIVE'` and `'PUBLISHED'` would never match any row (silent full-deny).

**Fix:** publishable set is now
`('ENRICHED','VERIFIED','OWNER_CLAIMED','OWNER_VERIFIED')`. Owner may
further narrow via view (future work).

## Access patterns the policies would BREAK (owner decision needed)

### A. `nex_liked_product` seller-insight fan-out

`src/lib/nex-native/seller-insights/seller-insight-service.ts:403`
reads `nex_liked_product` across **all buyers** for a seller's
products. This uses `nexSupabaseAdmin` (service-role · bypasses RLS)
so the owner-only policy does NOT block it. **If** this aggregation
is ever ported to a session-scoped Supabase client, the seller would
be denied reads on their customers' likes. Keep it on service-role.

### B. Community HQ moderation

`src/app/nex-native/hq/communities/page.tsx` reads
`nex_community_zone` and `nex_community_membership`. Uses
`nexSupabaseAdmin`. The owner-only membership policy would deny this
in a session-scoped path. HQ admin UI must stay on service-role or
add explicit HQ-admin RLS policy (not drafted here · out of scope).

### C. `nex_community_notice` zone-scoped read

Today `listNotices()` uses `nexSupabaseAdmin` so sees all rows. The
RLS policy requires the reader to have a `nex_community_membership`
row before it will return notices. **Any future session-scoped
listing call** would return empty for users with no membership · that
is the intended privacy contract, not a bug.

### D. `nex.business_canonical` directory read

Current directory read path goes via `NEX_POSTGRES_URL` with a role
that bypasses RLS (direct pg). If the directory ever switches to a
session-scoped Supabase client, non-publishable rows (`DISCOVERED`,
`DORMANT`, `SUPERSEDED`) will be hidden. Acceptable: that matches
intent.

### E. `nex_menu_item` draft visibility to owner

Owner-SELECT-all policy relies on a `nex_business.owner_account_id`
JOIN that in turn depends on `nex_account.supabase_user_id`. If a
business owner lacks a `supabase_user_id` link (legacy row), they
cannot see their own drafts via RLS. Service-role writes continue to
work. Check for any owner with NULL `supabase_user_id` before apply.

## Top 5 risks if policies apply without the app-side changes documented here

1. **ID mismatch in emergency join (pre-tightening):** the old drafts
   joined `i.id` on `nex.emergency_incident`. The PK is
   `incident_id`. SELECT would silently return empty, masking legitimate
   responder visibility. Tightening resolved this.

2. **`claimant_account_id` typo (pre-tightening):** the old business-claim
   draft would have failed apply with `column "claimant_account_id"
   does not exist`. Tightening resolved this. Separate residual risk:
   because `claimed_by_account_id` is `text` (cross-DB foreign key, not
   enforced), a future migration may want to tighten to uuid; the
   policy must be updated at the same time.

3. **`lifecycle_state` silent full-deny (pre-tightening):** the old
   business_canonical draft matched no rows. Public directory reads
   via a hypothetical session-scoped client would return empty. Users
   would see an empty directory with no error. Tightening resolved this.

4. **Service-role bypass is load-bearing:** every policy assumes
   service-role is the sole legitimate writer. If a developer adds a
   browser-direct Supabase insert path (bypassing the server action
   layer), the RLS writes will be denied in dev · appearing as a
   generic "row-level security" error. Add a guide note to the
   ADR/CLAUDE.md before apply: "NEX-native writes go through server
   actions. Browser-direct INSERT is denied by design."

5. **No HQ-admin bypass:** none of the proposals create an HQ-admin
   RLS policy. HQ admin read/write currently goes via service-role
   only. If HQ UI ever moves to session-scoped Supabase, every HQ
   admin will see empty tables unless a `requireHqAdmin`-style RLS
   policy is added. This is NOT drafted in this pass — out of scope.

## Validation test

`src/lib/nex-native/__tests__/rls-policy-validation.test.ts` reads
each PROPOSAL file and asserts, for each sensitivity class:

- Universal: header `NOT YET AUTHORISED`, `BEGIN`/`COMMIT`, `Rollback`, ≤80 lines.
- P0 owner-scoped: policy body references `auth.uid()` + the expected
  owner column; forbidden strings (e.g., `triggered_by_account_id`,
  `claimant_account_id`, `USING (true)`) absent from SQL (comments
  stripped).
- P0 service-role-only: REVOKE from anon + authenticated present, no
  CREATE POLICY.
- P1 public-read: public SELECT policy + `WITH CHECK (false)` on client writes.
- Bulk: all 26 expected files exist, filename convention enforced,
  none has a numeric migration prefix.

**Run:** `npx vitest run src/lib/nex-native/__tests__/rls-policy-validation.test.ts`

**Result 2026-11-10:** 81 / 81 passing.

## Guardrails preserved

- Every proposal retains the `NOT YET AUTHORISED · DO NOT APPLY` header.
- No migration file touched outside the P-RLS proposal set.
- No apply, no commit, no push, no deploy from this pass.
- Sandbox-only envelope on any future authorisation: target
  `kdstoyyeygcopkogqsyv`. Production `ijvqdvsvwtwxzcqmoqit` remains
  sealed per 2026-11-10 memory.
