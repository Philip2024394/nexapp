# Package B · Independent Review · Combined v4 (whitespace + 4cap) PREVIEW

- **Date**: 2026-11-19
- **Reviewer**: Package B · OFFLINE source review only
- **Target (snapshot)**:
  - `nex-supabase/candidate-migrations/CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW.sql`
  - `nex-supabase/candidate-migrations/CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW_rollback.sql`
- **Evidence tier**: SOURCE_REVIEW (no safe executable harness ran; byte
  presence of regex literal + absence of `&amp;` confirmed by targeted
  `grep -c` only).

---

## 1 · Diff-against-baseline (mig-356 vs combined v4)

Mig-356 function body lives in `nex-supabase/migrations/356_nex_group_call_invite_v2.sql:142-373`. Combined v4 body lives in v4 preview lines 105-305.

Region-by-region diff:

| Region | mig-356 lines | v4 lines | Verdict |
|---|---|---|---|
| Signature + RETURNS TABLE | 142-156 | 105-119 | IDENTICAL |
| `LANGUAGE/SECURITY DEFINER/search_path` | 157-159 | 120-122 | IDENTICAL |
| DECLARE block variables | 161-169 | 124-132 | IDENTICAL (8 vars, same order + types) |
| Caller identity (auth.uid + account lookup) | 176-188 | 135-147 | IDENTICAL semantics; v4 drops a comment line but the SQL is equivalent |
| **attachment_url guard** | 196-199 (`length(btrim(x)) = 0`, ERRCODE 22023) | 156-160 (regex `!~*`, ERRCODE 22023) | **INTENDED CHANGE (a)** |
| Invitee/self/media validation | 202-215 | 163-176 | IDENTICAL |
| Session ownership / INSERT | 218-240 | 179-201 | IDENTICAL |
| **PERFORM 1 FROM nex_group_call_session FOR UPDATE** | ABSENT | 216-219 | **INTENDED CHANGE (b)** |
| Participant BEGIN/INSERT/EXCEPTION unique_violation | 243-267 | 222-246 | IDENTICAL |
| Peer conversation ordered-pair get-or-create | 270-299 | 249-278 | IDENTICAL |
| Peer message INSERT (attachment_type='call_invite') | 302-317 | 281-296 | IDENTICAL |
| RETURN QUERY shape | 319-324 | 298-303 | IDENTICAL |
| REVOKE ALL FROM PUBLIC | 329-331 | 308-310 | IDENTICAL |
| REVOKE EXECUTE FROM anon | 338-340 | 312-314 | IDENTICAL |
| REVOKE EXECUTE FROM service_role | 358-360 | 316-318 | IDENTICAL |
| GRANT EXECUTE TO authenticated | 362-364 | 320-322 | IDENTICAL |
| INSERT INTO nex_migration_history | 367-373 (version '356') | **ABSENT** (deliberate · documented in file) | ACCEPTED |

- **ONLY the two intended regions differ.** No other semantic drift
  detected in the body.
- **Signature** (arg order + types + defaults + RETURNS TABLE shape)
  preserved byte-for-byte.
- **Permission envelope** preserved byte-for-byte including both
  explicit REVOKE EXECUTE statements (anon + service_role) and the
  `GRANT EXECUTE … TO authenticated`.
- **DROP FUNCTION IF EXISTS** at v4 lines 92-100 targets the exact
  7-param signature `(UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID)` —
  this matches the mig-356 forward CREATE signature. No old function
  will survive the DROP.

NOTE: mig-356 line 131 shows an EARLIER DROP targeting an 8-param
signature `(UUID, UUID, TEXT, TEXT, JSONB, TEXT, UUID)` — that was
mig-353's shape, dropped by mig-356. The v4 DROP of the 7-param shape
is correct for dropping whatever mig-356 (or any prior v3 candidate)
left behind. No stale overload will be kept alive.

**Verdict · §1: PASS.**

---

## 2 · Regex fidelity vs `_LANE_G_ACCEPT_HREF_PATTERN`

JS contract (`src/lib/nex-native/peer-message-service.ts:768-769`):

```
/^\/nex-native\/call\/preview\?session=[0-9a-f-]{36}&accept=1$/i
```

v4 SQL literal (file line 157), as directly read:

```
'^/nex-native/call/preview\?session=[0-9a-f-]{36}&accept=1$'
```

Per-token comparison:

- `^` ... `$` anchors: PRESENT on both sides.
- Literal `/nex-native/call/preview`: byte-identical.
- `\?`: escaped ONCE in the SQL literal. In a plain `'...'` Postgres
  string literal (no `E''` prefix), there is no backslash processing,
  so `\?` arrives at the ERE engine as backslash-question-mark. POSIX
  ERE treats `\?` as "match literal `?`" — equivalent to the JS
  behaviour. OK.
- `session=`: byte-identical.
- `[0-9a-f-]{36}`: byte-identical character class; hyphen at end means
  literal `-`. OK. 36-char fixed length accommodates the UUID
  `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` shape (32 hex + 4 hyphens =
  36 chars).
- `&accept=1`: byte-identical. **Grepped `&amp;` count = 0.** No
  HTML-entity substitution. SHOW-STOPPER cleared.
- `!~*` (case-insensitive negated match): matches JS `/…/i` +
  negation via `!test(input)`. OK.
- `IS NULL OR …`: NULL short-circuits BEFORE the `!~*`, preventing
  the NULL-regex-returns-NULL footgun. OK.

**Verdict · §2: PASS.**

---

## 3 · Lock placement correctness

`PERFORM 1 FROM nex_group_call_session WHERE id = v_session_id FOR UPDATE;` sits at v4 lines 216-219.

- (a) AFTER session ownership-check / INSERT returning v_session_id:
  session block ends at line 201 · PERFORM at 216 · **YES**.
- (b) BEFORE participant INSERT: participant INSERT begins at line
  223 · **YES**.
- (c) AFTER all input validation: regex guard (156-160), invitee NULL
  (163), self-invite (168), media_type (173) — all above 216. **YES**.
- Row-level only (`WHERE id = v_session_id`), NOT `LOCK TABLE
  nex_group_call_session`. Lock scope narrow. OK.
- No `NOWAIT` / `SKIP LOCKED` modifier. Blocking semantics match
  Agent C's DESIGN model. OK.

**Verdict · §3: PASS.**

---

## 4 · Cap-coverage completeness

The lock protects ONLY writers that enter via `nex_invite_to_call_tx`.
Grep of the whole repo (excluding tests, candidate-migrations,
evidence/) for `.from("nex_group_call_participant").insert(` surfaces
**three additional live INSERT paths** that bypass the new FOR UPDATE:

1. **`src/lib/nex-native/calls/invite-service.ts:285-293`**
   `createCallInviteOrchestrated` → direct admin-client INSERT after a
   direct session INSERT (line 263). This is the CURRENT live
   nexapp invite path. It does NOT call `nex_invite_to_call_tx`.

2. **`src/lib/nex-native/calls/group-call-service.ts:102-107`**
   `createGroupCallSession` → loops `participantsToInsert` (host +
   up to 3 guests) and INSERTs each row directly via admin client.
   Host-bootstrap and multi-invitee creation.

3. **`src/lib/nex-native/calls/group-call-service.ts:177-186`**
   `joinGroupCallSession` → when UPDATE finds no pre-invite row,
   INSERTs a fresh participant row directly. Fired on the callee's
   "accept" action.

Each bypass path concurrently racing itself (or another bypass path)
on the SAME `session_id` can still produce a trigger-count race that
mig-133's `SELECT COUNT(*)` cannot serialise alone. The v4 FOR UPDATE
closes GB-4CAP **only for RPC callers**, which — critically — is
**no one in current production code**. The RPC-calling wrapper
(`invite-service.transactional-candidate.ts:102`) is UNAPPLIED
candidate code only.

Flagged: **GB-4CAP coverage is PARTIAL in practice.** The three
bypass paths listed above must EITHER (A) migrate to call
`nex_invite_to_call_tx`, OR (B) acquire the same session FOR UPDATE
in a dedicated RPC wrapper, OR (C) be deprecated. This review does
NOT auto-resolve · the coordinator must decide.

mig-133 BEFORE INSERT cap trigger body (migrations/133_nex_group_call.sql:83-102)
is UNCHANGED by v4 — v4 does not touch mig-133. Defence-in-depth
belt stays intact.

Trigger invariant: `SELECT COUNT(*) WHERE session_id = NEW.session_id`
counts rows IRRESPECTIVE of `left_at`. v4 does not modify this; the
"4 rows ever" invariant is preserved as the v4 file explicitly
documents in its header "Known gaps that remain OPEN" section.

**Verdict · §4: CAP-COVERAGE = PARTIAL · documented above.**

---

## 5 · Dedup + unique_violation preservation

v4 lines 222-246 vs mig-356 lines 243-267: BEGIN block body +
EXCEPTION branch body are byte-equivalent. Position: v4 places the
dedup block IMMEDIATELY after the new FOR UPDATE (line 219 → line 222);
mig-356 places it immediately after the session block. Both land
with `v_session_id` populated.

After acquiring the FOR UPDATE, a retried invite for the same
`(v_session_id, p_invitee_account_id)` still hits the UNIQUE index
`nex_group_call_participant_unique_in_session` (mig-133 lines 70-71)
and still enters the EXCEPTION branch. `RETURN QUERY SELECT … 'already_invited' RETURN;` behaviour preserved.

**Verdict · §5: PASS.**

---

## 6 · Error-code consistency

| Error | mig-356 ERRCODE | v4 ERRCODE | Verdict |
|---|---|---|---|
| caller_identity_required (auth.uid NULL) | 42501 | 42501 | OK |
| caller_account_not_found | 42501 | 42501 | OK |
| attachment_url malformed | 22023 (via btrim guard) | 22023 (via regex guard) | OK |
| invitee_account_id_required | 22023 | 22023 | OK |
| self_invite_denied | 22023 | 22023 | OK |
| invalid_media_type | 22023 | 22023 | OK |
| session_not_owned | 42501 | 42501 | OK |

No new ERRCODE introduced. No regression.

**Verdict · §6: PASS.**

---

## 7 · Rollback review

Rollback file: `CANDIDATE_nex_group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW_rollback.sql`.

- DROP (lines 51-59): targets the same 7-param signature. Correct.
- CREATE (lines 62-233): function body matches mig-356 lines 142-324
  semantically. Reintroduces `length(btrim(p_attachment_url)) = 0`
  guard at line 106; does NOT include the `PERFORM 1 … FOR UPDATE`
  statement. Correct.
- Permissions envelope (lines 236-250): byte-equivalent to mig-356
  permission envelope. Correct.
- Rollback header comments (lines 16-33) contain the explicit human-
  readable warning:
  > "WARNING · reintroducing the mig-356 body REOPENS two known defects"
  with bullet enumeration of GB-WHITESPACE-GUARD + GB-4CAP. Correct.
- No fabricated `nex_migration_history` DELETE. Correct — history
  edit is deliberately left to the operator.
- Label honesty (lines 10-13): states clearly "This file is an OFFLINE
  rollback draft. It is NOT verified-rollback." Correct.

Minor observation (not a defect): the rollback CREATE omits mig-356's
inline comments explaining fail-closed rationale (mig-356 lines 171-175,
190-195). These are comment-only; omission does not change executable
semantics. The rollback remains behaviourally equivalent.

**Verdict · §7: ROLLBACK = SOUND.**

---

## 8 · Security review

- Regex grammar is extremely narrow — full-anchor `^…$` + fixed-prefix
  + 36-char `[0-9a-f-]` + fixed-suffix. No scheme allowed. No authority
  allowed. No `..`, `%`, `#`, `?` beyond the single literal `\?` in
  position after `preview`. Open-redirect risk at downstream rendering
  is bounded — any href that passes the guard is structurally a
  relative URL beginning with `/nex-native/call/preview`.
- XSS risk: the regex rejects `<`, `>`, `"`, `'`, `=` except in the
  two literal positions `session=` and `accept=1`. The hex-hyphen
  class rejects any script character. Downstream rendering remains
  subject to its own escaping discipline, but the guard adds
  defence-in-depth.
- ReDoS: no nested quantifier. `[0-9a-f-]{36}` is a fixed-count class.
  No catastrophic backtracking. OK.
- NULL short-circuit: `p_attachment_url IS NULL OR …` ensures NULL
  never reaches the `~*` operator. In PL/pgSQL, `NULL ~* 'x'` would
  evaluate NULL, and `IF NULL THEN RAISE …` would NOT raise, silently
  bypassing the guard. The `IS NULL OR` branch forces NULL into the
  TRUE side of the OR, raising 22023 as intended. OK.
- Identity trust: `SECURITY DEFINER` + `auth.uid()`-derived identity
  preserved. No `p_self_account_id` parameter (the §16.41 supplied-
  identity vulnerability is INAPPLICABLE to this signature).
- Grants: REVOKE ALL FROM PUBLIC + REVOKE EXECUTE FROM anon + REVOKE
  EXECUTE FROM service_role + GRANT EXECUTE TO authenticated —
  byte-identical to mig-356. No widening.

**Verdict · §8: PASS.**

---

## 9 · Verdict matrix

- **Local-engineering**: PASS (combined v4 is a surgical additive
  rewrite; two intended changes only; no collateral drift; both the
  forward and rollback preserve signature, permission envelope,
  dedup block, error codes, and RETURN shape).
- **Connected-RPC**: NOT ATTEMPTED · gate closed · no DB.
- **Founder-walkthrough**: NOT ATTEMPTED · gate closed.
- **Public-launch**: NOT ATTEMPTED · gate closed.

---

## 10 · Concrete defects list

**NO DEFECTS FOUND IN THE COMBINED V4 FILE ITSELF.**

The v4 forward + rollback are consistent with their stated scope.

**Open risk flagged (not a v4 defect · a product-scope note):**
GB-4CAP coverage is PARTIAL in production flows because no live code
path currently calls the `nex_invite_to_call_tx` RPC. The three direct-
INSERT paths listed in §4 continue to race the mig-133 trigger. The
v4 lock becomes effective ONLY after `invite-service.ts` (and
optionally `group-call-service.ts` host-bootstrap + join) are rewired
to the RPC. The coordinator should decide whether to:
  (i) apply v4 AND rewire callers in the same promotion gate, or
  (ii) apply v4 now and schedule caller rewiring separately (in
       which case GB-4CAP remains partially open).

---

**REVIEW VERDICT: PASS** · evidence tier: SOURCE_REVIEW · defects: 0 · cap-coverage: PARTIAL · rollback: SOUND
