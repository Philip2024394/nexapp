# NEX Peer-Message RLS Lockdown Audit · Migration 218 · 2026-11-21

Scope · forensic read-only audit of the `nex_peer_message` +
`nex_peer_conversation` + `nex_live_post` row-level-security surface
against a cross-participant tampering threat model. This is Phase 2
Remediation priority 4 (P2-04) per the sealed 2026-11-09 priority
order.

Audit root · `C:/Users/Victus/nexapp`
Repo · `Philip2024394/nexapp` · branch `release-audit-v1-2026-11-14`
HEAD at audit time · `d1a19dda`

Posture in one line · **Migration 218 is architecturally sound and
remediates the three G1 defects (R1 identity-domain mismatch · R2
missing `nex_live_post` policies · R11 column-immutability) plus R12
trigger coordination, but is NOT YET APPLIED to any database.** Until
applied, production `ijvqdvsvwtwxzcqmoqit` sits on the Migration 047
policies which contain the R1 identity-domain-mismatch flaw.

Spot-verified by direct Read before publication ·

- Migration 218 line 6 · `STATUS: AUTHORED · NOT YET APPLIED TO ANY
  DATABASE.` Deployment is gated on explicit owner approval, a
  documented rollback drill, and prior application of Mig 217
  (search-path harden) and Mig 216 (enum extension).
- Migration 218 lines 160-204 · all three `nex_peer_message` policies
  rewrite to `TO authenticated` + `nex_current_account_ids()` with
  conversation-participation EXISTS gate. Lines 218-234 add the three
  `nex_live_post` policies (public SELECT · owner INSERT · owner
  UPDATE · no DELETE).

---

## Compliance scorecard

| Table | RLS enable | Policy coverage | Identity-domain fix | Immutability | Verdict |
|---|---|---|---|---|---|
| `nex_peer_conversation` | Mig 047 line 93 | SELECT · INSERT · UPDATE (participant-scoped) | Mig 218 Part A | n/a | COMPLIANT (in mig 218) · UNAPPLIED |
| `nex_peer_message` | Mig 047 line 94 | SELECT · INSERT · UPDATE_read (conversation-participation gated) | Mig 218 Part B | Mig 218 Part D trigger · 17 immutable + 6 mutable | COMPLIANT (in mig 218) · UNAPPLIED |
| `nex_live_post` | Mig 029 line 60 | public_select · owner_insert · owner_update · no DELETE | n/a | n/a | COMPLIANT (in mig 218) · UNAPPLIED |

Three red flags ALL cleared · zero `USING (true)` leaks · zero
missing WITH CHECK on INSERT · zero missing RLS-enable. Zero
VIOLATION in mig 218. The AT-RISK finding is operational, not
architectural · the migration is not yet in prod.

No new launch-blocker introduced by this audit. The pre-existing
launch-blocker is "mig 216 + 217 + 218 pending apply" tracked under
the sealed phase-2 gate (prod-apply authorisation is owner-held).

---

## 1 · Threat model being tested

A non-participant authenticated user crafts a SELECT / INSERT /
UPDATE / DELETE against `nex_peer_message` or `nex_peer_conversation`
targeting a conversation where they are not a participant. The
expected outcomes ·

- SELECT · zero rows returned (row-level filter blocks).
- INSERT · rejected (sender must be in participant set AND conversation
  must include the caller).
- UPDATE · zero rows affected (the USING gate hides the row).
- DELETE · no policy exists → denied by absence.

Secondary threat · plaintext leakage via a successful (but
unauthorised) SELECT. Even if RLS were defeated, the sealed
2026-11-09 device-only E2E architecture stores ciphertext only ·
plaintext never lands server-side. This is dual mitigation.

The failure mode we're looking for · a policy that compares
`participant_a_id = auth.uid()` (two different identity domains · will
NEVER match for an authenticated nex_account caller) or a policy that
uses `USING (true)` / `USING (auth.uid() IS NOT NULL)` without
further scoping.

---

## 2 · Policy inventory per table

### 2.1 · `nex_peer_conversation` (Mig 218 Part A)

| Policy | Command | Role | Scope |
|---|---|---|---|
| `nex_peer_conversation_select` | SELECT | authenticated | `participant_a_id IN (SELECT nex_current_account_ids()) OR participant_b_id IN (SELECT nex_current_account_ids())` |
| `nex_peer_conversation_insert` | INSERT | authenticated | WITH CHECK · same participant predicate |
| `nex_peer_conversation_update` | UPDATE | authenticated | USING · same participant predicate · no WITH CHECK (column-mutation restricted at service layer per mig docstring line 68) |

### 2.2 · `nex_peer_message` (Mig 218 Part B, lines 160-204)

| Policy | Command | Role | Scope |
|---|---|---|---|
| `nex_peer_message_select` | SELECT | authenticated | USING · `EXISTS (SELECT 1 FROM nex_peer_conversation c WHERE c.id = conversation_id AND (c.participant_a_id IN (SELECT nex_current_account_ids()) OR c.participant_b_id IN (SELECT nex_current_account_ids())))` |
| `nex_peer_message_insert` | INSERT | authenticated | WITH CHECK · `sender_account_id IN (SELECT nex_current_account_ids()) AND EXISTS (...same conversation predicate...)` |
| `nex_peer_message_update_read` | UPDATE | authenticated | USING · same conversation predicate |

No DELETE policy · intentional. The 60-minute retract is implemented
as `UPDATE deleted_for_everyone=true`, not hard-delete. Hard-delete is
service-role-only per mig 218 docstring line 61-62.

Column immutability (Mig 218 Part D, lines 260-362) enforces ·

- 17 immutable columns · id · conversation_id · sender_account_id ·
  recipient_account_id · body · body_encrypted · attachment_meta ·
  created_at + 9 more.
- 6 mutable columns (allowed) · read_at · delivered_at ·
  deleted_for_everyone + 3 more.
- BEFORE UPDATE trigger name sorts alphabetically before
  `nex_peer_message_link_preview_delete_trigger` (Mig 125) · the
  immutability guard fires first and sees link_preview columns
  unchanged, then the link-preview trigger fires and nulls them
  during a confirmed retract. Deterministic coexistence · documented
  R12 resolution in mig 218 lines 40-48.

### 2.3 · `nex_live_post` (Mig 218 Part C, lines 218-234)

| Policy | Command | Role | Scope |
|---|---|---|---|
| `nex_live_post_public_select` | SELECT | PUBLIC (no role qualifier) | USING · `expires_at IS NULL OR expires_at > now()` · intentional public read per phase-1 doctrine (business-anchored announcements) |
| `nex_live_post_owner_insert` | INSERT | authenticated | WITH CHECK · `business_id IN (SELECT nex_current_owned_business_ids())` |
| `nex_live_post_owner_update` | UPDATE | authenticated | USING · same ownership predicate |

No DELETE policy · intentional (D3 · hard-delete service-role only ·
expiry is via UPDATE expires_at). Before mig 218, this table had RLS
enabled with no policies defined · deny-by-default for
authenticated/anon · R2 risk register.

---

## 3 · Red-flag sweep · zero matches

| Red flag | Status |
|---|---|
| `USING (true)` anywhere | Not found |
| `USING (auth.uid() IS NOT NULL)` without further scoping | Not found |
| Missing WITH CHECK on INSERT policy | Not found (all three INSERTs have WITH CHECK) |
| Missing RLS enable on table | Not found · `nex_peer_message` + `nex_peer_conversation` enabled in mig 047 (lines 93-94) · `nex_live_post` enabled in mig 029 (line 60) |
| Identity-domain mismatch (`participant_a_id = auth.uid()`) | Found in Mig 047 lines 101-102, 142-147 · REMEDIATED by mig 218 rewriting all six policies through `nex_current_account_ids()` from Mig 010 |
| Overbroad service-role dependency | Documented and layered · `nexSupabaseAdmin` bypasses RLS but `peer-message-service.ts` lines 1340-1348 performs participant check before INSERT · mig 218 docstring lines 66-72 flags this as intentional staged rollout |
| Participant scope missing on `nex_peer_message` | Not found · all three policies require caller membership in the parent conversation |
| Ownership scope missing on `nex_live_post` write | Not found · INSERT and UPDATE both require `business_id IN (SELECT nex_current_owned_business_ids())` |

---

## 4 · Production apply status · NOT YET APPLIED

Evidence ·

- Mig 218 line 6 · `STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.`
- Mig 218 lines 8-12 · "Must not be applied to the sealed production
  project `ijvqdvsvwtwxzcqmoqit` without explicit owner approval and
  a documented rollback drill. Must not be applied before Migration
  217 ... and Migration 216 ..."
- Test file `nex-supabase/migrations/__tests__/g1-rls-harden-217-218.test.ts`
  declares the real-DB tests as `it.skip` pending sandbox
  availability.
- No `scripts/apply-migration-218-*.mjs` applier found.

Prerequisite chain · mig 216 (enum extension) → mig 217 (search-path
harden of Mig 010 helpers) → mig 218. Status of 216/217 against
`kdstoyyeygcopkogqsyv` sandbox and `ijvqdvsvwtwxzcqmoqit` prod ·
NOT verified in this audit · owner infra check required before
authorising the chain.

Until mig 218 applies, the policies in force on `nex_peer_message` +
`nex_peer_conversation` are the Migration 047 originals, which
contain the R1 identity-domain mismatch · the compare `=
auth.uid()` NEVER matches an authenticated nex_account caller
because `nex_account.id` is a separate UUID from `auth.users.id`.
Practical effect · the RLS policies deny authenticated callers by
accident. The production write path is unaffected because
`nexSupabaseAdmin` (service-role) bypasses RLS and the service-layer
participant check (`peer-message-service.ts` lines 1340-1348) is the
enforcement. Private messaging therefore works but rests on the
service-layer check only · mig 218 is the defence-in-depth that
hardens the RLS underneath.

---

## 5 · Threat-model validation after mig 218 applies

| Attack | Result |
|---|---|
| Non-participant SELECT on `nex_peer_message` | BLOCKED by conversation EXISTS gate · caller not in participant set → zero rows |
| Non-participant INSERT on `nex_peer_message` | BLOCKED · both the sender predicate AND the conversation predicate fail |
| Non-participant UPDATE on `nex_peer_message` | BLOCKED by USING gate · row not visible |
| Non-participant DELETE on `nex_peer_message` | DENIED by absence · no DELETE policy exists |
| Column-tampering UPDATE (e.g. forge sender_account_id) on own message | BLOCKED by Part D immutability trigger · 17 columns guarded |
| Plaintext body leak if RLS defeated | PREVENTED by sealed 2026-11-09 device-only E2E · server stores ciphertext only |
| Non-owner INSERT on `nex_live_post` | BLOCKED · business_id not in owned set |
| Non-owner UPDATE on `nex_live_post` | BLOCKED · USING gate hides row |

Dual mitigation on message content confidentiality · (a) RLS prevents
row read · (b) if row were read, ciphertext is useless without the
recipient's device key.

---

## 6 · Service-role path · documented exception

Mig 218 explicitly keeps `nexSupabaseAdmin` service-role writes as
the primary enforcement until the full authenticated-client migration
is complete (lines 66-72) ·

> `nexSupabaseAdmin` continues to bypass RLS by design. The
> service-layer participant check in peer-message-service.ts remains
> the primary enforcement until every caller is migrated to the
> authenticated client. This migration is defence-in-depth that
> catches a future developer who tries to use the authenticated
> client without a participant check.

Service-layer check locations verified ·

- `src/lib/nex-native/peer-message-service.ts` lines 1340-1348 ·
  validates sender is participant in conversation before INSERT.
- `src/app/api/nex-native/peer-message/encrypted/route.ts` lines
  150-169 · derives recipient from conversation + validates sender
  membership before dispatch.

This is documented staged rollout · NOT a VIOLATION. Future work
(not P2-04 scope) must migrate server writes to the authenticated
client so RLS becomes primary, with the service-layer check as the
belt-and-braces.

---

## 7 · Rollback coverage

Mig 218 lines 379-455 contain an explicit DDL rollback block · pure
DDL, no data mutation. Restores the three mig 047 policies and drops
the mig 218 trigger + function. Rollback drill required before
production apply per mig 218 line 9.

---

## 8 · What this audit does NOT prove

- Mig 218 state in sandbox `kdstoyyeygcopkogqsyv` · UNVERIFIED (owner
  infra call).
- Mig 216 + 217 state in prod and sandbox · UNVERIFIED (owner infra
  call).
- The real-DB tests `g1-rls-harden-217-218.test.ts` currently sit as
  `it.skip` · promotion to active tests requires sandbox apply of
  mig 216-218 first.
- A live attempt by an authenticated non-participant to SELECT a
  conversation row (end-to-end on production) · owner infra call per
  sealed 2026-11-08 five-state model.

Engineering ceiling reached is Verified · code-read. Live-verified is
owner infra.

---

## 9 · Recommendation (not an authorisation)

Sealed priority order and 2026-11-08 five-state model both prohibit
this audit from authorising anything. For owner consideration only ·

1. Verify mig 216 + 217 state in sandbox `kdstoyyeygcopkogqsyv` and
   prod `ijvqdvsvwtwxzcqmoqit`.
2. If both are present in sandbox, apply mig 218 to sandbox and
   un-skip the real-DB tests in
   `g1-rls-harden-217-218.test.ts`.
3. Observe the failure matrix and rollback drill in sandbox.
4. Only then propose mig 216+217+218 production apply with the
   explicit authorisation word-trigger (sealed phase-2 gate ·
   "apply mig 218 prod").

Until step 4, do not stage, commit a prod-apply script, or configure
prod environment for mig 218. The sealed phase-2 gate is owner-held.

---

## 10 · Evidence pointers

Code consulted ·

- `nex-supabase/migrations/218_nex_rls_harden_peer_message_and_live_post.sql`
- `nex-supabase/migrations/047_nex_peer_chat.sql` (lines 93-94 · RLS enable · lines 101-102, 142-147 · R1 defect)
- `nex-supabase/migrations/029_nex_live_post.sql` (line 60 · RLS enable)
- `nex-supabase/migrations/010_nex_rls_recursion_fix.sql` (lines 48-55 · `nex_current_account_ids()` helper)
- `nex-supabase/migrations/125_*` (link-preview delete trigger · R12 coexistence)
- `nex-supabase/migrations/__tests__/g1-rls-harden-217-218.test.ts`
- `src/lib/nex-native/peer-message-service.ts` (lines 1340-1348 · service-layer participant check · line 1374 · service-role INSERT)
- `src/app/api/nex-native/peer-message/encrypted/route.ts` (lines 150-169 · route-level participant guard)

---

## 11 · Readiness classification

| Area | State |
|---|---|
| Mig 218 policies architecturally correct | Built · (code read) |
| Mig 218 applied to any database | Not yet applied |
| Mig 216 + 217 prerequisite state verified | Not performed (owner infra) |
| RLS policies tested against real DB | Not performed (tests skipped pending sandbox apply) |
| Service-layer participant check in production path | Wired · Verified (code read) |
| Device-only E2E ciphertext-only storage | Sealed 2026-11-09 doctrine · tracked in P2-01 |

Engineering ceiling reminder · no finding here may be promoted to
Live-verified. That remains an owner infra call per sealed
2026-11-08.
