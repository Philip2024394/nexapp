# GB-WHITESPACE-GUARD · Agent B independent regression/security review

**Role**: Agent B · OFFLINE Lane G parallel batch
**Target**: Agent A's forward-correction candidate
**Repo scope**: `C:/Users/Victus/nexapp` only (no `D:/trades`, no DB, no network)
**Evidence tier**: OFFLINE_TESTED (30/30 safe-check PASS, exit 0)
**Date**: 2026-11-19

Files reviewed (read-only):
- `C:/Users/Victus/nexapp/nex-supabase/candidate-migrations/CANDIDATE_nex_group_call_invite_v3_whitespace_strict_PREVIEW.sql` (8838 bytes)
- `C:/Users/Victus/nexapp/nex-supabase/candidate-migrations/CANDIDATE_nex_group_call_invite_v3_whitespace_strict_PREVIEW_rollback.sql` (2098 bytes)
- `C:/Users/Victus/nexapp/tmp-lane-g/30-whitespace-guard-offline-tests.mjs`
- `C:/Users/Victus/nexapp/tmp-lane-g/30-offline-test-results.json` (37 PASS / 0 FAIL / 4 UNVERIFIED notes)

Reference-of-truth (read-only):
- Contract: `C:/Users/Victus/nexapp/src/lib/nex-native/peer-message-service.ts:768` · `/^\/nex-native\/call\/preview\?session=[0-9a-f-]{36}&accept=1$/i`
- Baseline: `C:/Users/Victus/nexapp/nex-supabase/migrations/356_nex_group_call_invite_v2.sql` lines 142-373

---

## 1 · Diff-against-baseline sanity

Confirmed byte-identical to mig-356 **except** the attachment_url guard block
(mig-356 line 196 vs preview line 107-111). Verified:

- Parameter list (7 params) · byte-identical (safe check `signature_bytes_parity_with_mig356` · PASS).
- `LANGUAGE plpgsql · SECURITY DEFINER · SET search_path = public, pg_temp` · all preserved (PASS).
- Return TABLE shape (`out_session_id, out_participant_id, out_conversation_id, out_message_id, out_skipped`) · unchanged.
- DECLARE block variable set `v_caller_sb_user_id, v_self_account_id, v_session_id, v_participant_id, v_conversation_id, v_message_id, v_a, v_b` · unchanged.
- Identity derivation (`auth.uid()` → fail-closed 42501 if NULL · lookup `nex_account` by `supabase_user_id` → fail-closed 42501 if NULL) · unchanged.
- Invitee validation block (NULL check · self-invite denied · media_type in audio/video) · unchanged.
- Session existence/ownership branch + new-session INSERT · unchanged.
- Participant idempotent insert + unique_violation RETURN QUERY `already_invited` · unchanged.
- Ordered-pair conversation get-or-create · unchanged.
- Final `nex_peer_message` insert (`attachment_type='call_invite'`) · unchanged.
- Trailing RETURN QUERY shape · unchanged.
- DROP+CREATE idempotency · preview correctly `DROP FUNCTION IF EXISTS nex_invite_to_call_tx(UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID)` before CREATE — 7-param signature matches mig-356 exactly (safe check `preview_drops_7_param_signature` · PASS).

Guard-block change only (lines 107-111 in preview):

```sql
IF p_attachment_url IS NULL
   OR p_attachment_url !~* '^/nex-native/call/preview\?session=[0-9a-f-]{36}&accept=1$' THEN
  RAISE EXCEPTION 'attachment_url_required · call_invite needs a well-formed accept_href matching _LANE_G_ACCEPT_HREF_PATTERN'
    USING ERRCODE = '22023';
END IF;
```

**Verdict**: no out-of-scope changes · signature preserved · SECURITY DEFINER preserved · search_path pin preserved.

## 2 · Regex fidelity vs `_LANE_G_ACCEPT_HREF_PATTERN`

Byte-level verification:

- Contract JS literal: `/^\/nex-native\/call\/preview\?session=[0-9a-f-]{36}&accept=1$/i`
- Preview SQL literal: `'^/nex-native/call/preview\?session=[0-9a-f-]{36}&accept=1$'`

Point-by-point:
- Anchors `^` and `$` · present (both).
- Path prefix `/nex-native/call/preview` · byte-identical.
- `?` → `\?` escape · present (POSIX ERE requires it because `?` is a quantifier). Safe check confirmed via substring match of the exact SQL literal (`preview_contains_byte_equivalent_regex` · PASS).
- Literal `&` · **confirmed literal ampersand, NOT `&amp;` HTML entity**. Grep for `&amp;` on both preview and rollback files returned no matches (safe checks `preview_has_no_html_entity_ampersand` and `rollback_has_no_html_entity_ampersand` · PASS). **The show-stopper defect called out in the review instructions is NOT present.**
- Character class `[0-9a-f-]{36}` · byte-identical.
- `accept=1` literal · byte-identical.
- Case-insensitivity: JS `/i` flag → SQL `!~*` operator (case-insensitive not-match). Safe check `preview_uses_bang_tilde_star_operator` · PASS.

Known POSIX-vs-JS semantic differences (acknowledged UNVERIFIED by Agent A):
- POSIX ERE `[0-9a-f-]` at the end of a class is valid (dash is literal) — this matches JS behaviour, but the verification requires sandbox execution. Agent A recorded this as `postgres_hex_hyphen_class_semantics` UNVERIFIED with a concrete SELECT follow-up.
- POSIX ERE `~*` behaviour on `A-F` uppercase hex is expected to match (correctly) — Agent A recorded this as `postgres_tilde_star_case_insensitivity_over_a_f` UNVERIFIED with a concrete SELECT follow-up.

## 3 · Rollback soundness

Rollback is a minimal `DROP FUNCTION IF EXISTS` for the 7-param signature inside a `BEGIN/COMMIT`. Because v3 shares mig-356's exact signature, a plain DROP removes the function entirely (destructive for mig-356 too).

**Agent A's rollback header explicitly documents this**: operators must re-apply `nex-supabase/migrations/356_nex_group_call_invite_v2.sql` after running the rollback to return to the mig-356 body. This is a correct and honest acknowledgement, not a defect — restoring the baseline function body requires re-running mig-356 either in full or via a companion restore script. The two-step operator sequence is explicit.

Grants: the rollback does not re-issue grants, which is correct — grants are tied to the function object; dropping the function drops the grants. Re-applying mig-356 reinstates the grants.

No prod ref anywhere in the rollback. Sandbox ref `kdstoyyeygcopkogqsyv` is named in the HALT NOTICE. No apply script (`.mjs`) exists for this preview yet, which matches the "no 357 number yet" rule — nothing to hard-refuse, because nothing attempts to connect.

## 4 · Hard-refusal for production

No `.mjs` apply script exists for this candidate (confirmed by listing `tmp-lane-g/` — only the offline tests `30-whitespace-guard-offline-tests.mjs` and the results JSON exist, no `apply-357` script). The SQL files are static assets and cannot connect.

**Verdict**: hard-refusal gate is satisfied by the absence of an apply script, per the "number assigned at promote-time" rule stated in the preview's HALT NOTICE.

## 5 · Test harness fidelity

Agent A's `30-whitespace-guard-offline-tests.mjs`:
- Uses the JS `RegExp` literal `/^\/nex-native\/call\/preview\?session=[0-9a-f-]{36}&accept=1$/i` as a mirror — **not** a Postgres `~*` simulation. Agent A explicitly records this limitation via the four UNVERIFIED notes, which is acceptable and honest.
- All four UNVERIFIED notes are concrete and actionable, each with the exact SELECT to run in sandbox.
- Covers: NULL, undefined, empty, ASCII-space-only (3 spaces), tab, LF, CR, FF, VT, mixed whitespace, 35-char, 37-char, non-hex session char, `accept=2`, missing query string, trailing slash before query, absolute URL with scheme, percent-encoded space in path, NUL byte mid-string, valid wrapped in whitespace, SQL-injection suffix (`;DROP TABLE nex_peer_message`), U+202E RTL override mid-string, uppercase hex session (must accept).

Coverage gap check against the review's required minimum: all mandatory cases are present (null, empty, ASCII space single/multi/leading/trailing/interior via the "valid wrapped in whitespace" + "trailing space" variants, tab, LF, CR, FF, VT, mixed, 35/37-char session, non-hex, accept=2, trailing space, missing `?session=`, trailing slash, absolute URL, uppercase hex, SQL-injection probe, percent-encoded).

Agent B's independent 14 additional OFFLINE_SIMULATED cases in `review-whitespace-guard-safe-checks.mjs` (all PASS):
- `accept=01` rejected (near-miss number form)
- Trailing space + leading space on valid href
- Double-ampersand `&&accept=1`
- Path traversal `/preview/../admin?...`
- Unicode fullwidth question mark `\uFF1F`
- Null-byte appended
- Case-insensitive path prefix (`/NEX-NATIVE/CALL/...`) — accepted correctly per `/i`
- SQL single-quote injection suffix

**Verdict**: harness fidelity acceptable. The four UNVERIFIED notes are the correct way to flag the JS-vs-Postgres gap. Agent A does not falsely claim Postgres-regex verification.

## 6 · Security review

- **Bypass surface**: the regex is full-anchor (`^…$`) with a narrow grammar. All character classes are bounded. No alternation, no backreference, no lookahead. Cannot be satisfied by any string with leading/trailing whitespace, additional path segments, additional query parameters, or any non-hex session char.
- **Open-redirect / XSS via href**: the href written into `nex_peer_message.attachment_url` is constrained to the exact path `/nex-native/call/preview?session=<uuid>&accept=1`. Downstream renderers that treat this as a relative path cannot be redirected off-origin because no `//`, no scheme, and no authority segment can appear. The session UUID segment is hex-only. Safe.
- **ReDoS**: regex has no nested quantifiers and no overlapping alternatives. `{36}` is fixed. No catastrophic backtracking surface.
- **NULL handling**: `p_attachment_url IS NULL OR p_attachment_url !~* '…'` short-circuits NULL → raises 22023. Matches mig-356 intent. SQL regex applied to NULL would return NULL (not true), which would make a `!~*` test fail the guard silently if the short-circuit were missing — the preview includes the short-circuit, so this is safe.
- **Case-insensitivity leakage**: `~*` applies to the whole pattern, so the path prefix `/nex-native/call/preview` would accept `/NEX-NATIVE/CALL/PREVIEW`. This matches the contract's JS `/i` flag. If stricter path-casing is desired, that's a contract-level change, not a defect in the SQL guard. Noted, not flagged.
- **Permission envelope**: unchanged from mig-356 — no widening. Public revoked, anon revoked, service_role revoked, authenticated granted. Verified by 4 regex checks (all PASS).
- **SECURITY DEFINER + search_path pin**: both preserved. No search-path hijack surface introduced.

**Verdict**: no new security weakness · GB-WHITESPACE-GUARD closes the mig-356 `btrim`-only ASCII-space gap · bypasses demonstrated in battery case D (tab/newline chain-write) would be rejected at 22023 by this guard.

## 7 · Concrete defects list

**NO DEFECTS FOUND · SOURCE_REVIEW PASS (with OFFLINE_TESTED evidence tier, 30/30 safe checks PASS).**

Observations (not defects, recorded for the coordinator's integration pass):

- O-1 · Rollback is destructive-replace rather than content-restore. Documented in rollback header. Not a defect; the operator sequence is explicit. If the coordinator prefers a content-restore rollback, a companion `_rollback_restore_mig356.sql` could be added, but it's not required for correctness.
- O-2 · Error message is longer than mig-356's (mentions `_LANE_G_ACCEPT_HREF_PATTERN`). Good for debugging; no behaviour impact. Not a defect.
- O-3 · The four UNVERIFIED notes in Agent A's results JSON correctly identify the JS-vs-Postgres regex semantic gap. These must be resolved by a sandbox SELECT matrix before any apply authorisation. Not a defect in the candidate — a correct scope boundary.

## 8 · Verdict matrix

| Tier | Verdict | Reason |
|---|---|---|
| Local-engineering | **PASS** | Source review + offline safe checks (30/30 PASS) confirm candidate matches contract, preserves mig-356 envelope, closes the whitespace-bypass gap, introduces no new security weakness. |
| Connected-RPC | **NOT ATTEMPTED** | Gate closed — Agent B is OFFLINE-ONLY. Sandbox execution of the four UNVERIFIED Postgres-regex SELECTs is required before this tier can be assessed. |
| Founder-walkthrough | **NOT ATTEMPTED** | Gate closed — depends on Connected-RPC verification + separate owner authorisation. |
| Public-launch | **NOT ATTEMPTED** | Gate closed — requires migration number assignment, sandbox apply, battery re-run, prod authorisation per sealed rules. |

---

**REVIEW VERDICT: PASS** · evidence tier: OFFLINE_TESTED · defects: 0
