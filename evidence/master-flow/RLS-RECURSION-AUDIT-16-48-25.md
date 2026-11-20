# RLS Recursion Audit — Agent B (NEX Gate A Connected Matrix §16.48.25)

**Date:** 2026-11-20
**Scope:** Read-only audit of `C:/Users/Victus/nexapp/nex-supabase/migrations/` for RLS recursion antipatterns matching the `42P17` error observed on `nex_group_call_participant`.
**Mode:** Read-only. No files modified. No database connection.

## Methodology

Enumerated every `.sql` file under `nex-supabase/migrations/` via Glob (446 files). For each file, extracted every `CREATE POLICY <name> ON <table> ... ;` statement via a tolerant regex, then parsed each policy body (USING / WITH CHECK) for `FROM <t>` / `JOIN <t>` references, building a directed graph `table → set(tables referenced in its policies)`. **Shape 1** = any policy whose body references its own target table. **Shape 2** = any cycle of length ≥ 2 in the policy-reference graph (both endpoints must themselves be policy-bearing tables). References to `nex_account` via `supabase_user_id = auth.uid()` are only flagged when `nex_account`'s own policies subquery back — `nex_account`'s sole policy (`nex_account_self_read`, migration 001) uses `supabase_user_id = auth.uid()` with no subquery, so those references do not form cycles. SECURITY DEFINER helper calls (e.g. `nex_current_account_ids()`, `nex_current_participant_conversation_ids()`, `nex_is_participant_in_session()`) are not table references and are excluded by design (that is the fix pattern, not the antipattern). Regex captured 307 of 333 textual `CREATE POLICY` occurrences; the 26 uncaptured were individually inspected and are either (a) inside `-- ... CREATE POLICY ...` rollback comments, (b) inside `EXECUTE format($pol$ ... $pol$)` DO-blocks whose bodies filter only by `current_setting('nex.app_country', ...)`, or (c) `storage.objects` policies filtered solely by `bucket_id` + `storage.foldername(name)` — none contain self- or cross-table subqueries.

## Findings table

| file:line | table | policy name | shape | notes |
|---|---|---|---|---|
| 133_nex_group_call.sql:139 | nex_group_call_participant | nex_group_call_participant_select_scoped | Shape 1 (self-reference) | **Already in §16.48.25 scope** — the triggering bug. Rewritten by migration 360 via `nex_is_participant_in_session()` SECURITY DEFINER helper. |
| 133_nex_group_call.sql:109 ↔ 133_nex_group_call.sql:139/160 | nex_group_call_session ↔ nex_group_call_participant | nex_group_call_session_select_participants ↔ nex_group_call_participant_select_scoped / nex_group_call_participant_update_scoped | Shape 2 (cross-reference pair) | **Already in §16.48.25 scope** — transitive recursion path (b) → (a) → (a). SELECT half rewritten by migration 360; UPDATE-side policy (`nex_group_call_participant_update_scoped`, line 160) still references `nex_group_call_session` but the reverse SELECT branch is now non-recursive, so the cycle is broken. See note under NEW findings. |
| 004_nex_conversation_and_message.sql:121 ↔ 004_nex_conversation_and_message.sql:135 | nex_conversation ↔ nex_conversation_participant | nex_conversation_participant_read ↔ nex_conversation_participant_self_read | Shape 2 (historical, already fixed) | **Not in §16.48.25 scope but already remediated** by migration 010 (`nex_rls_recursion_fix.sql`), which drops both policies and recreates them using SECURITY DEFINER helpers (`nex_current_participant_conversation_ids()`, `nex_conversations_of_my_businesses()`, `nex_current_account_ids()`). Migration 010's header explicitly documents this exact Shape-2 pattern as "the standard Supabase pattern for cross-table RLS without recursion." No live recursion today. |

## Separation: already-covered vs. new

- **Already in §16.48.25 scope (migration 133 hits):** 2 findings — one Shape 1 and one Shape 2 pair. Both are the policies migration 360 was authored to rewrite.
- **Already remediated historically (not §16.48.25):** 1 finding — the migration 004 `nex_conversation` ↔ `nex_conversation_participant` cross-pair, fixed by migration 010. Textual grep still matches the original 004 statements, but Postgres sees the migration-010 rewrites because migration 010 ran `DROP POLICY IF EXISTS` on each before recreating it.
- **NEW findings requiring action:** 0.

## Rationale for the "0 new findings" conclusion

The §16.48.25 scope already covers the only live recursive policies on the schema. The migration-004 pair was flagged by the mechanical textual audit, but it is a false-positive-for-liveness: migration 010 is a later migration that supersedes those exact policy definitions with non-recursive SECURITY DEFINER-helper implementations. Policy names are unique per table in Postgres, and `DROP POLICY IF EXISTS` followed by `CREATE POLICY` with the same name is the standard forward-rewrite idiom; the current state of the database reflects migration 010, not migration 004.

The remaining 303 captured policies either:
1. Reference only `nex_account WHERE supabase_user_id = auth.uid()` (safe — `nex_account`'s own policy has no subquery), or
2. Call a SECURITY DEFINER helper (safe — helpers bypass RLS during their own execution), or
3. Use scalar predicates only (`auth.uid()` directly, `bucket_id = '...'`, `storage.foldername(name)`, `current_setting('nex.app_country', ...)`, `is_published = true`, `is_active = true`, `expires_at > now()`, etc.), or
4. Reference a different table whose own policies do not reference back (verified by graph cycle detection).

Noteworthy one-way cross-table references that were checked and cleared (not Shape 2):
- `nex_peer_message` → `nex_peer_conversation` (migration 218): `nex_peer_conversation`'s policies reference only the SECURITY DEFINER helper `nex_current_account_ids()`, not `nex_peer_message`. One-way, safe.
- `nex_live_post` policies → `nex_current_owned_business_ids()` helper: not a table reference.
- `nex_vault_file`, `nex_chat_theme`, `nex_business`, etc. → `nex_account`: one-way, safe (migration 001 `nex_account_self_read` is scalar).

## Residual observation (informational, not a finding)

`nex_group_call_participant_update_scoped` (133:160-168) references `nex_group_call_session`. After migration 360's rewrite, `nex_group_call_session_select_participants` no longer re-enters `nex_group_call_participant` recursively (it uses `nex_is_participant_in_session()`), so the UPDATE policy's cross-reference no longer completes a cycle. This is not a Shape-2 recursion today. Flagging only so a reader of 360 does not assume the UPDATE policy was altered — it was not, and it does not need to be.

## Conclusion

- **Total files scanned:** 446 `.sql` files under `nex-supabase/migrations/`.
- **Total `CREATE POLICY` statements examined:** 333 textual occurrences (307 captured by the primary regex + 26 inspected individually).
- **Total recursion findings:** 2 live (both in migration 133, both in §16.48.25 scope and addressed by migration 360) + 1 historical (migration 004, fully remediated by migration 010 since Wave 3.1).
- **New findings outside §16.48.25:** 0.
- **Action requested of Agent B:** none (audit is read-only and scope is clean).

Fixed nothing. No files other than this report were created. Migration 133, migration 010, migration 360, and every other existing migration remain untouched. No database connection made.
