# RLS P0 Caller Trace — 2026-11-10

**Scope:** For every GAP-P0 table in the classification audit, trace every
live caller in `src/` and verify the proposed RLS policy matches the
actual access pattern.

**Method:** Read-only grep sweep of `src/`. No DB query. No apply. No
migration file edited (zero FAIL findings required a schema fix; the
tightening pass dated 2026-11-10 already resolved the three column /
PK / lifecycle_state mismatches that previously existed).

**Inputs read:**
- `docs/audit/rls-classification-2026-11-10.md`
- `docs/audit/rls-tightening-2026-11-10.md`
- 15 P-RLS-\*\_PROPOSAL.sql files in `nex-supabase/migrations/`

---

## Access-pattern model (recap)

Every live NEX-native caller touching these tables reaches the DB via one
of three paths:

1. **`nexSupabaseAdmin`** (from `src/lib/nex-native/supabase-admin.ts`) —
   Supabase REST client holding the service-role key. **Bypasses RLS.**
2. **`withClient`** (from `src/lib/nex/db.ts`) — a direct `pg` pool
   connected via `NEX_POSTGRES_URL`. Runs as the pooler role which, in
   the current NEX configuration, is admin-equivalent and **bypasses
   RLS** too (no `auth.uid()` inheritance; policies evaluated against a
   NULL JWT would deny, but the role simply does not go through RLS).
3. **Direct `pg.Client`** (`new Client({ connectionString: conn })`) via
   the same `NEX_POSTGRES_URL` — identical RLS semantics to `withClient`.

No file in `src/` calls any of the 16 P0 tables through a session-scoped
Supabase client (`createServerClient`, `createBrowserClient`, or the
`nexSupabase` anon-key helper). **The RLS policies are therefore
defence-in-depth** against future grants, client-direct paths, or
rogue-admin JWTs. They will not break any current caller.

---

## Overall summary

| Verdict | Count | Tables |
|---|---|---|
| **PASS** (policy matches live access pattern) | 15 | all P0 tables with a proposal |
| **WARN** | 1 | `nex.support_admin_grant` — P0 scope item has no proposal drafted (classification marks it GAP-P1, so excluded from the 26-proposal set) |
| **FAIL** | 0 | — |
| **Proposals updated in this pass** | 0 | all 15 drafted proposals are schema-correct after the 2026-11-10 tightening pass |

Totals: **15 PASS / 1 WARN / 0 FAIL** across the 16 P0 scope entries.

---

## Table of contents

1. [`nex.trusted_contact`](#1-nextrusted_contact)
2. [`nex.emergency_incident`](#2-nexemergency_incident)
3. [`nex.incident_recipient`](#3-nexincident_recipient)
4. [`nex.emergency_fanout_log`](#4-nexemergency_fanout_log)
5. [`nex.emergency_location_update`](#5-nexemergency_location_update)
6. [`nex.support_ticket`](#6-nexsupport_ticket)
7. [`nex.support_message`](#7-nexsupport_message)
8. [`nex.support_admin_grant`](#8-nexsupport_admin_grant)
9. [`nex_liked_product`](#9-nex_liked_product)
10. [`nex_pilot_operator_audit`](#10-nex_pilot_operator_audit)
11. [`nex.business_claim`](#11-nexbusiness_claim)
12. [`nex.business_outreach_queue`](#12-nexbusiness_outreach_queue)
13. [`nex.business_outreach_suppression`](#13-nexbusiness_outreach_suppression)
14. [`nex_community_notice` (+ update/confirmation/report)](#14-nex_community_notice-family)
15. [`nex_community_card` (+ update/confirmation/report)](#15-nex_community_card-family)
16. [`nex_community_membership`](#16-nex_community_membership)

---

## 1. `nex.trusted_contact`

- **Proposal policy summary** · owner-only FOR ALL on `owner_account_id = auth.uid()`-joined `nex_account`; service_role grant preserved.
- **Caller inventory:**

| File | Op | Client |
|---|---|---|
| `src/lib/nex-native/emergency/trusted-contacts-service.ts` (addContact / removeContact / listContacts / updateContact / setEnabled / isContact) | SELECT / INSERT / UPDATE / DELETE | `withClient` |
| `src/lib/nex-native/emergency/recipient-resolver.ts:136` (layer-1 fan-out read) | SELECT | `withClient` |

- **Fit:** PASS. Every caller bypasses RLS via the pooler role. The policy enforces owner-only CRUD for any future session-scoped reader; the service continues to run unchanged.
- **Tightening:** none required. Column `owner_account_id` matches mig 224 line 280.

---

## 2. `nex.emergency_incident`

- **Proposal policy summary** · requester-only SELECT on `requester_account_id = auth.uid()`-joined `nex_account`; service_role writes.
- **Caller inventory:**

| File | Op | Client |
|---|---|---|
| `src/lib/nex-native/emergency/incident-service.ts` (createIncident / getIncident / listIncidentsForRequester / updateStatus / recordCancel / recordResolve) | SELECT / INSERT / UPDATE | `withClient` |
| `src/lib/nex-native/emergency/recipient-resolver.ts:225-ish` (status hydration) | SELECT | `withClient` |

- **Fit:** PASS. Service-role (via pooler) bypasses the policy. No session-scoped reader today.
- **Tightening:** none. Already corrected in the 2026-11-10 tightening pass: the proposal uses the real column `requester_account_id` (not the pre-tightening `triggered_by_account_id`).

---

## 3. `nex.incident_recipient`

- **Proposal policy summary** · SELECT allowed if `recipient_account_id = auth.uid()` OR the `nex.emergency_incident.requester_account_id` matches `auth.uid()`; join key is `i.incident_id` (the real PK).
- **Caller inventory:**

| File | Op | Client |
|---|---|---|
| `src/lib/nex-native/emergency/recipient-resolver.ts:236` (writeRecipientRows · INSERT ON CONFLICT) | INSERT | `withClient` |
| `src/lib/nex-native/emergency/recipient-resolver.ts` (hydration SELECTs) | SELECT | `withClient` |

- **Fit:** PASS. Pooler-role writes bypass RLS. Policy is correctly scoped for any future session-scoped reader (both recipient and requester views supported).
- **Tightening:** none. Already corrected: old draft used `i.id`; new draft uses `i.incident_id`.

---

## 4. `nex.emergency_fanout_log`

- **Proposal policy summary** · requester-only SELECT via join on `nex.emergency_incident.requester_account_id`; service_role writes.
- **Caller inventory:**

| File | Op | Client |
|---|---|---|
| `src/lib/nex-native/emergency/_fanout-audit-log.ts:110` (INSERT ON CONFLICT (idempotency_key)) | INSERT | `withClient` |
| `src/lib/nex-native/emergency/_fanout-audit-log.ts:171` (audit-tail SELECT) | SELECT | `withClient` |

- **Fit:** PASS. Pooler-role writes bypass RLS. Policy correctly joins on real PK `incident_id`.
- **Tightening:** none. Already corrected: same join-key fix as #3.

---

## 5. `nex.emergency_location_update`

- **Proposal policy summary** · RLS enabled; zero policies for authenticated; REVOKE from anon/authenticated; `service_role` has SELECT only (not INSERT) to enforce the sealed emergency doctrine 2026-11-09 "no server-side coordinate persistence".
- **Caller inventory:** **NONE live.** Grep of `src/` returns only the rls-policy-validation test. This is schema-correction debt per the sealed emergency doctrine 2026-11-09; the table exists but no code writes to it.
- **Fit:** PASS. Policy aligns with the sealed doctrine: deny by default; even service_role is write-forbidden until the table is dropped in a future migration.
- **Tightening:** none. Proposal matches the doctrine.

---

## 6. `nex.support_ticket`

- **Proposal policy summary** · ENABLE RLS (migration 315 already REVOKEs but does not enable RLS); requester-only SELECT on `requester_account_id = auth.uid()`-joined `nex_account`; service_role writes (default via bypass).
- **Caller inventory:**

| File | Op | Client |
|---|---|---|
| `src/lib/nex-native/support/ticket-service.ts` (getMyActiveTicket, createOrResumeTicket, getTicketForAdmin, listTicketsForAdmin, setTicketMuted, postUserMessage, postAdminReply, postAutoReply, resolveTicket, deleteTicket) | SELECT / INSERT / UPDATE / DELETE | `withClient` |
| `src/lib/nex-native/support/actions.ts` (server-action wrappers) | indirect via ticket-service | — |
| `src/app/nex-native/hq/support-tickets/page.tsx` (HQ admin page) | indirect via `listTicketsForAdmin` server action | — |

- **Fit:** PASS. All reads/writes go through `withClient` (pooler · bypasses RLS). HQ page is a server component invoking server actions — never a session-scoped Supabase client. Column `requester_account_id` matches mig 315 line 53.
- **Tightening:** none.

---

## 7. `nex.support_message`

- **Proposal policy summary** · ENABLE RLS; participant-only SELECT via join on `nex.support_ticket.requester_account_id = auth.uid()`-joined `nex_account`; service_role writes.
- **Caller inventory:**

| File | Op | Client |
|---|---|---|
| `src/lib/nex-native/support/ticket-service.ts:~340-420` (getMessages, postUserMessage, postAdminReply, postAutoReply) | SELECT / INSERT | `withClient` |

- **Fit:** PASS. Join column `ticket_id` matches mig 315 line 95. Policy correctly links the message row to the ticket's `requester_account_id`.
- **Tightening:** none.

---

## 8. `nex.support_admin_grant`

- **Proposal policy summary** · **NOT DRAFTED.** Classification marks this table GAP-P1, so it was excluded from the 26-proposal P-RLS set. Task scope item #8 lists it under the P0 block. This is a drafting gap.
- **Caller inventory:**

| File | Op | Client |
|---|---|---|
| `src/lib/nex-native/support/ticket-service.ts:303` (`SELECT 1 FROM nex.support_admin_grant WHERE account_id = $1` — admin-gate predicate) | SELECT | `withClient` |
| `src/lib/nex-native/support/ticket-service.ts:314` (`INSERT INTO nex.support_admin_grant (account_id)` — grant seeding) | INSERT | `withClient` |
| `src/app/nex-native/hq/support-tickets/page.tsx:5,124` (comment-only reference) | — | — |

- **Fit:** WARN. Not FAIL: the table has mig 315 `REVOKE ALL FROM anon, authenticated` already applied-in-draft, which is a defence-in-depth layer identical in effect to zero-policy RLS for current callers (all service-role). But the scope list explicitly includes this table at P0 severity, and no `P-RLS-nex_support_admin_grant_PROPOSAL.sql` exists. **Recommendation:** owner may wish to request a follow-up draft modelled on `P-RLS-nex_pilot_operator_audit_PROPOSAL.sql` (RLS enable + zero policies + service_role grant). That is a one-line follow-up when GAP-P1 drafts are authored.
- **Tightening:** N/A — no file to edit.

---

## 9. `nex_liked_product`

- **Proposal policy summary** · owner-only SELECT + INSERT + DELETE on `liker_account_id = auth.uid()`-joined `nex_account`. No UPDATE policy (likes are not editable).
- **Caller inventory:**

| File | Op | Client |
|---|---|---|
| `src/lib/nex-native/liked-product-service.ts:23/44/62/80/104` (like / unlike / isLiked / count / list) | SELECT / INSERT / DELETE | `nexSupabaseAdmin` |
| `src/lib/nex-native/seller-insights/seller-insight-service.ts:130/403` (seller fan-out aggregation over all buyers' likes on a seller's products) | SELECT | `nexSupabaseAdmin` |

- **Fit:** PASS. Both callers use service-role · bypass RLS. **Note documented in the tightening pass:** if the seller-insight aggregation is ever ported to a session-scoped Supabase client, the owner-only SELECT policy would deny it (the seller would be reading rows owned by buyers). The pattern must stay on service-role per the tightening note §A. No action required today.
- **Tightening:** none.

---

## 10. `nex_pilot_operator_audit`

- **Proposal policy summary** · RLS enable + zero policies for anon/authenticated + REVOKE all + explicit service_role grant. Pure service-role lockdown — matches mig 214's own header comment.
- **Caller inventory:** **NONE live.** Grep of `src/` returns only test files + the proposal/audit markdown under `src/lib/nex-native/business-trial/`. The audit table is written by the pilot operator tooling (not resolved to a specific `src/` writer at this time).
- **Fit:** PASS. Defense-in-depth lockdown that matches the migration author's own stated intent. Would not break any present caller.
- **Tightening:** none.

---

## 11. `nex.business_claim`

- **Proposal policy summary** · ENABLE RLS; claimant-only SELECT via `claimed_by_account_id = auth.uid()::text` — `claimed_by_account_id` is `text` (cross-DB FK string), so policy casts the uuid to text. NULL rows (unverified claims) hidden from authenticated readers; service_role writes.
- **Caller inventory:**

| File | Op | Client |
|---|---|---|
| `src/lib/nex-native/claims/claim-service.ts:180-461` (createClaim / verifyClaim / revokeClaim · 3-table transaction with business_canonical + lifecycle_log) | SELECT / INSERT / UPDATE | direct `pg.Client` via `connectionString` from `NEX_POSTGRES_URL` |
| `src/lib/nex-native/directory/thumbnail-entitlement.ts:209` (load owner facts) | SELECT | `withClient` |
| `src/lib/nex-native/directory/owner-claim/actions.ts:618/254/613` (claim lookup for owner invite flow) | SELECT | direct `pg.Client` via `connectionString` from `NEX_POSTGRES_URL` |
| `src/lib/nex-native/business-media/owner-upload-service.ts:141` (VERIFIED-claim gate before upload) | SELECT | `withClient` |

- **Fit:** PASS. All four callers reach Postgres through the pooler (either `withClient` or `new pg.Client({ connectionString: NEX_POSTGRES_URL })`). None use a session-scoped Supabase client. Column `claimed_by_account_id` matches mig 176 line 125; cast is correct.
- **Tightening:** none. Already corrected in the 2026-11-10 pass (pre-tightening draft used `claimant_account_id`, which does not exist).

---

## 12. `nex.business_outreach_queue`

- **Proposal policy summary** · RLS enable + zero policies for anon/authenticated + REVOKE + service_role grant. Pure service-role lockdown (GDPR exposure if raw email leaked).
- **Caller inventory:**

| File | Op | Client |
|---|---|---|
| `src/lib/nex-native/outreach/outreach-queue.ts:194/265/300/363/414/582` (enqueue / lease / mark-sent / mark-failed / retry / etc.) | SELECT / INSERT / UPDATE | `withClient` |

- **Fit:** PASS. Outreach worker runs server-side via `withClient` · bypasses RLS. No session-scoped path.
- **Tightening:** none.

---

## 13. `nex.business_outreach_suppression`

- **Proposal policy summary** · RLS enable + zero policies for anon/authenticated + REVOKE + service_role grant. Same lockdown as #12.
- **Caller inventory:**

| File | Op | Client |
|---|---|---|
| `src/lib/nex-native/outreach/outreach-eligibility.ts:64/77/156` (suppression-check predicate) | SELECT | `withClient` |
| `src/lib/nex-native/outreach/outreach-suppression.ts:71-ish` (add-to-suppression) | INSERT / SELECT | `withClient` |

- **Fit:** PASS. Service-role path only.
- **Tightening:** none.

---

## 14. `nex_community_notice` family

Four tables share one ownership / membership policy pattern:
`nex_community_notice`, `nex_community_notice_update`,
`nex_community_notice_confirmation`, `nex_community_notice_report`.

- **Proposal policy summary** (`_notice`): zone-scoped SELECT via
  `nex_community_membership` join on either `hyperlocal_zone_id` or
  `district_zone_id`; author-only INSERT (`author_account_id =
  auth.uid()`); author-only UPDATE.
- **Proposal policy summary** (`_update`): zone-scoped SELECT via
  parent notice + membership join; author-of-parent-notice INSERT.
- **Proposal policy summary** (`_confirmation`): owner-only SELECT +
  INSERT + DELETE on `account_id`.
- **Proposal policy summary** (`_report`): reporter-only SELECT +
  INSERT on `reporter_account_id`.
- **Caller inventory:**

| File | Op | Client |
|---|---|---|
| `src/lib/nex-native/community/notice-service.ts:47/65/115/161/180/225/244/260/308` (listNotices, createNotice, addUpdate, confirmNotice, unconfirmNotice, listConfirmations, listUpdates, reportNotice) | SELECT / INSERT / UPDATE / DELETE | `nexSupabaseAdmin` |

- **Fit:** PASS. All community notice/update/confirmation/report reads + writes use `nexSupabaseAdmin` service-role · bypass RLS. Columns match mig 146: `hyperlocal_zone_id`, `district_zone_id`, `author_account_id`, `account_id`, `reporter_account_id`, `notice_id` all verified against the real CREATE TABLE in `146_nex_community_watch_core.sql`.
- **Tightening note (documented in §C of the tightening pass):** today `listNotices` sees every row via service-role; if it ever moves to a session-scoped read, users without a `nex_community_membership` row return empty. That is the intended privacy contract, not a bug.
- **Tightening:** none.

---

## 15. `nex_community_card` family

Four tables share the same pattern as #14: `nex_community_card`,
`nex_community_card_update`, `nex_community_card_confirmation`,
`nex_community_card_report`.

- **Proposal policy summaries** · identical pattern to notice family
  (zone-scoped SELECT via membership · author/reporter/owner-scoped
  writes).
- **Caller inventory:**

| File | Op | Client |
|---|---|---|
| `src/lib/nex-native/community/lost-found-service.ts:56/74/137/243/284/323` (listCards, createCard, confirmCard, addCardUpdate, unconfirmCard, reportCard) | SELECT / INSERT / UPDATE / DELETE | `nexSupabaseAdmin` |
| `src/lib/nex-native/community/business-discovery-service.ts:261/279/289` (business welcome card lifecycle) | SELECT / INSERT / DELETE | `nexSupabaseAdmin` |

- **Fit:** PASS. Columns match mig 148 lines 67-69 (`hyperlocal_zone_id`, `district_zone_id`, `author_account_id`). All service-role.
- **Tightening:** none.

---

## 16. `nex_community_membership`

- **Proposal policy summary** · owner-only SELECT on `account_id = auth.uid()`-joined `nex_account`. No client INSERT/UPDATE/DELETE policies — writes via service-role server actions.
- **Caller inventory:**

| File | Op | Client |
|---|---|---|
| `src/lib/nex-native/community/membership-service.ts:38/88/116/156/174` (claimMembership, getMyMembership, listMembers, countMembers, cancelMembership) | SELECT / INSERT / UPDATE / DELETE | `nexSupabaseAdmin` |
| `src/lib/nex-native/community/member-service.ts:75/89/100/118/159/180/219/...` (add/remove/flag/approve member flows) | SELECT / INSERT / UPDATE / DELETE | `nexSupabaseAdmin` |
| `src/app/nex-native/hq/communities/page.tsx` + `[zoneId]/page.tsx` (HQ moderation page · reads membership counts) | SELECT | `nexSupabaseAdmin` |

- **Fit:** PASS. Every caller is service-role · bypasses RLS. HQ pages use `nexSupabaseAdmin` directly (not a session client), consistent with the HQ-admin memo. The owner-only SELECT policy would, if HQ pages ever flipped to a session client, return empty · see tightening note §B.
- **Tightening:** none.

---

## Cross-cutting findings

### HQ admin pages: compliance with service-role-only memo

Verified:

- `src/app/nex-native/hq/communities/page.tsx` · uses `nexSupabaseAdmin`.
- `src/app/nex-native/hq/communities/[zoneId]/page.tsx` · uses `nexSupabaseAdmin`.
- `src/app/nex-native/hq/support-tickets/page.tsx` · pure server component that invokes server-action wrappers from `src/lib/nex-native/support/actions.ts`, which call `ticket-service.ts` (`withClient` · pooler). Admin-gate predicate reads `nex.support_admin_grant` via `withClient`.

**No HQ-admin page uses a session-scoped Supabase client against a P0 table.** No FAIL findings here.

### Service-role bypass is load-bearing

Every policy in the 15 drafted proposals assumes service-role (via
`nexSupabaseAdmin`) or the pooler role (via `withClient` /
`pg.Client`) is the sole legitimate writer. If a future PR adds a
browser-direct Supabase insert against any of these tables, RLS will
deny it. This matches the tightening-pass risk-5 note and the general
NEX-native doctrine that writes go through server actions.

### Drafting gap on `nex.support_admin_grant`

Scope item #8 (P0 in the task brief) has no drafted proposal because
the classification file rates this table GAP-P1. A one-file draft
modelled on `P-RLS-nex_pilot_operator_audit_PROPOSAL.sql` would close
the gap. Not drafted in this pass (out of scope: the brief is "verify
each proposed RLS policy"; there is no proposal to verify here, hence
the WARN rather than a FAIL).

### No proposal files edited

All 15 proposal files in P0 scope are column-correct, PK-correct, and
match the sealed migrations. The 2026-11-10 tightening pass already
resolved the three structural errors that existed in earlier drafts
(`triggered_by_account_id` → `requester_account_id`; `i.id` →
`i.incident_id`; `claimant_account_id` → `claimed_by_account_id` with
`::text` cast; `'LIVE'/'PUBLISHED'` lifecycle states → real check-
constraint members — the last one is business_canonical, which is
GAP-P1, not P0).

---

## Guardrails preserved

- **Read-only sweep.** No file under `nex-supabase/migrations/` or any
  P-RLS proposal was edited.
- **No migration applied.** Every proposal retains the `NOT YET
  AUTHORISED · DO NOT APPLY` header.
- **No commit · no push.**
- **Sandbox-only envelope.** When authorised, apply targets
  `kdstoyyeygcopkogqsyv`. Production `ijvqdvsvwtwxzcqmoqit` is sealed
  per the 2026-11-10 memory.
- **CLAUDE.md untouched.** Neither the project-local nor the global
  CLAUDE.md was modified.
