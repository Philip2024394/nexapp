# UNAPPLIED candidate migrations · REVIEW REQUIRED

This directory is **not** scanned by any `scripts/apply-migration-*.mjs`
helper. Files here are reviewable *design candidates* for migrations
that will be applied only after a separate, named owner authorisation.

**None of these files are on any production or sandbox apply path.**
`scripts/apply-all-P-RLS-sandbox.mjs` and the per-migration apply
scripts all look at `nex-supabase/migrations/` — this sibling
directory is deliberately out of their scope.

## Two-variant convention (sealed 2026-11-19 · Round 16)

A quarantined candidate that we want to be able to review as an
APPLY-READY artefact without ever risking an accidental apply lives
here in **two** variants:

1. **Rollback-wrapped variant** · filename starts with `C` + a
   candidate number (e.g. `C001_...sql`). The SQL body is wrapped in
   `BEGIN; … ROLLBACK;` so that a hand-run against ANY DB — sandbox,
   production, or any other target reachable from the operator's
   machine — produces no net effect. This is the baseline anchor of
   the design.
2. **Apply-version PREVIEW** · filename uses the next free numeric
   prefix (e.g. `353_..._PREVIEW.sql`) and ends in `_PREVIEW.sql`.
   Content is byte-for-byte the same function body as the C-prefixed
   sibling, but wrapped in `BEGIN; … COMMIT;` and augmented with the
   `nex_migration_history` INSERT a real apply would need. A matching
   `_PREVIEW_rollback.sql` lives beside it. An
   `apply-migration-<n>-sandbox.mjs.PREVIEW` script lives beside both.
   The `_PREVIEW` tails and the `.PREVIEW` script-extension keep the
   artefacts outside every filename glob the rest of the codebase
   uses.

The two variants exist so the owner can review the EXACT SQL,
rollback, and apply-script that would run — side-by-side with the
guaranteed-safe quarantined anchor — without that review ever being
one typo away from a destructive apply.

## How to apply (after separate authorisation)

1. Owner approves the specific candidate by its exact filename and
   target DB (sandbox `kdstoyyeygcopkogqsyv` or prod
   `ijvqdvsvwtwxzcqmoqit`).
2. Promote the apply-version PREVIEW:
   - Move `<n>_<name>_PREVIEW.sql` to
     `nex-supabase/migrations/<n>_<name>.sql` (strip the `_PREVIEW`
     tail of the filename · SQL body unchanged).
   - Move `<n>_<name>_PREVIEW_rollback.sql` to
     `nex-supabase/migrations/<n>_<name>_rollback.sql`.
   - Move `apply-migration-<n>-sandbox.mjs.PREVIEW` to
     `scripts/apply-migration-<n>-sandbox.mjs`.
3. Confirm the destination numeric prefix is still free at the time
   of approval · renumber if it has been taken.
4. The TypeScript wrapper (if any) in
   `src/lib/nex-native/calls/*.transactional-candidate.ts` must
   remain disabled behind a feature flag until the RPC is confirmed
   deployed on the target DB · otherwise the production code path
   would depend on an RPC that does not exist. The flag flip is a
   SEPARATE authorisation.
5. The C-prefixed rollback-wrapped sibling **stays here** as the
   historical review anchor · it is NOT moved and NOT deleted when
   the apply-version is promoted.

## Fixtures must use supported registration (sealed 2026-11-19 · Round 16)

A sandbox run that needs disposable user identities **must NOT** write
raw `nex_account` INSERTs. It must create the identity through the
supported registration path so auth triggers, RLS bootstrap, and any
future mandatory-column defaults all fire correctly:

- Create the Supabase auth user via
  `nexSupabaseAdmin.auth.admin.createUser({ email, password,
  email_confirm: true, user_metadata: { is_test_fixture: true,
  purpose: "...", created_at_iso: ... } })`. The placeholder email
  convention `fixture-<purpose>-<token>@fixture.nex-native.local`
  mirrors the visitor-bootstrap route's `visitor-...@visitor.nex-
  native.local` convention (see
  `src/app/api/nex-native/chat/visitor-session/route.ts`).
- Let `nex_account` auto-provision on the fixture's first authenticated
  API call via `resolveNexAppSession → createAccount` (same path real
  users take). Do NOT reach around this with a direct INSERT.
- Delete the fixture at end-of-run with
  `nexSupabaseAdmin.auth.admin.deleteUser(userId)` — the same cleanup
  the visitor-session route already uses for its own fallback. Log the
  deleted user id in the run receipt.

This directory and its approval gate **do not** authorise fixture
creation in any database; they only document the shape fixtures must
take when a future sandbox approval includes a fixture lifecycle.

## Current contents

### §16.33 Lane G-B · inviteToCall atomicity

- `C001_nex_group_call_invite_transactional.sql` — SECURITY DEFINER
  RPC `nex_invite_to_call_tx` that wraps the four current
  `inviteToCall` writes (session + participant + pair-conversation +
  call_invite message) in a single Postgres function. Addresses the
  §16.31 / §16.32 documented atomicity gap. **UNAPPLIED · REVIEW
  REQUIRED · wrapped in BEGIN;…ROLLBACK; · rollback-wrapped anchor
  variant.**
- `353_nex_group_call_invite_transactional_PREVIEW.sql` —
  apply-version PREVIEW sibling of `C001_...sql` · same function body
  · wrapped in `BEGIN; … COMMIT;` · adds the `nex_migration_history`
  INSERT (column list corrected round 17 to match live
  `(version, description, notes)` schema). **UNAPPLIED · REVIEW
  REQUIRED.**
- `353_nex_group_call_invite_transactional_PREVIEW_rollback.sql` —
  matching rollback preview · `DROP FUNCTION` + `DELETE FROM
  nex_migration_history` for the row the forward migration writes.
  **UNAPPLIED · REVIEW REQUIRED.**
- `apply-migration-353-sandbox.mjs.PREVIEW` — apply-script preview
  with hard refusal of production ref `ijvqdvsvwtwxzcqmoqit` and
  mandatory sandbox ref `kdstoyyeygcopkogqsyv`. Deliberately reads
  the POST-PROMOTION path · a run against the PREVIEW filename will
  fail at `readFileSync`. The `.PREVIEW` extension keeps it outside
  the `apply-migration-*.mjs` glob convention. **UNAPPLIED · REVIEW
  REQUIRED.**

### §16.35 Lane E · E-ATOM · sendCartOrderAction atomicity

- `C002_nex_cart_order_create_transactional.sql` — SECURITY DEFINER
  RPC `nex_create_cart_order_tx` that wraps the cart-snapshot peer-
  message write AND the representative-product `nex_order` write in
  a single Postgres function. Preserves the pre-minted order UUID,
  send_intent_id dedup, server-authoritative price snapshot, and the
  representative-product rule (pure menu_item carts skip the order
  branch). Addresses the §16.13 / §16.27 documented atomicity gap.
  **UNAPPLIED · REVIEW REQUIRED · wrapped in BEGIN;…ROLLBACK; ·
  rollback-wrapped anchor variant.**
- `354_nex_cart_order_create_transactional_PREVIEW.sql` —
  apply-version PREVIEW sibling · byte-for-byte same function body ·
  wrapped in `BEGIN; … COMMIT;` · adds the `nex_migration_history`
  INSERT. **UNAPPLIED · REVIEW REQUIRED.**
- `354_nex_cart_order_create_transactional_PREVIEW_rollback.sql` —
  matching rollback preview · `DROP FUNCTION` + `DELETE FROM
  nex_migration_history`. **UNAPPLIED · REVIEW REQUIRED.**
- `apply-migration-354-sandbox.mjs.PREVIEW` — apply-script preview ·
  same hard-refuse guards as 353. **UNAPPLIED · REVIEW REQUIRED.**
- Paired TypeScript wrapper (unactivated · lives outside this folder):
  `src/lib/nex-native/calls/send-cart-order.transactional-candidate.ts`
  · imported only by the mocked spec tests at
  `src/lib/nex-native/calls/__tests__/send-cart-order-transactional-candidate.test.ts`.
  Production code does NOT import it until a feature flag
  (planned `NEX_CART_ORDER_TX=1`) is live.

### §16.35 Lane E · E-PRIVACY · Path A Phase A schema

- `C003_nex_order_path_a_separation_phase_a.sql` — Phase A schema
  for the sealed 2026-11-09 chat/order separation doctrine. Adds
  five nullable columns on `nex_order` (`delivery_address`,
  `delivery_quote`, `subtotal_pence`, `payment_method_hint`,
  `payment_confirmed_at`), makes `nex_order.product_id` nullable for
  future multi-item orders, creates `nex_order_item` child table
  (empty until Phase B), and extends `nex_peer_message.attachment_type`
  CHECK to include `'order_reference'`. Zero existing-data mutations ·
  no write-path switches (that is Phase B · separately authorised). 
  **UNAPPLIED · REVIEW REQUIRED · wrapped in BEGIN;…ROLLBACK; ·
  rollback-wrapped anchor variant.**
- `355_nex_order_path_a_separation_phase_a_PREVIEW.sql` —
  apply-version PREVIEW sibling · same DDL · wrapped in
  `BEGIN; … COMMIT;` · adds the `nex_migration_history` row.
  **UNAPPLIED · REVIEW REQUIRED.**
- `355_nex_order_path_a_separation_phase_a_PREVIEW_rollback.sql` —
  matching rollback preview · drops the new table + columns + enum
  entry · guards against rolling back after Phase B populates data
  (RAISE if `nex_order_item` has any row OR any `nex_order` has NULL
  `product_id`). **UNAPPLIED · REVIEW REQUIRED.**
- `apply-migration-355-sandbox.mjs.PREVIEW` — apply-script preview ·
  same hard-refuse guards as 353/354 · post-apply verification
  queries the new columns, the child-table shape, the enum CHECK,
  and the migration-history row. **UNAPPLIED · REVIEW REQUIRED.**
