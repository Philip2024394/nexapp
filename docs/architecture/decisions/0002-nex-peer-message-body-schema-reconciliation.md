# ADR-0002 · `nex_peer_message.body` schema reconciliation under device-only E2E doctrine

**Status:** DECISION-READY · implementation NOT YET AUTHORISED
**Decision date:** — (awaiting owner selection of Option A / B / C)
**Supersedes:** — (first ADR to address this)
**Superseded by:** —

---

## 1 · Context

The `nex_peer_message` table carries two eras of peer-to-peer messages under one row shape:

1. **Legacy plaintext rows** (`encrypted = false`) — body is readable text; `ciphertext`, `nonce`, `sender_public_key`, `sender_device_id`, `recipient_device_id`, `message_group_id` are all `NULL`. Shape constraint `nex_peer_message_encrypted_shape` enforces this co-ordination (mig 093).
2. **Encrypted rows** (`encrypted = true`) — body carries the **sentinel string** `(encrypted)` because the column is `NOT NULL` with a `CHECK (length(body) BETWEEN 0 AND 4000)` constraint (mig 093); the real payload is in `ciphertext` + `nonce`, decrypted on the client via `nacl.box.after()`.

### 1.1 · Why the sentinel exists

From `migrations/093_nex_peer_message_encrypted.sql:22-26`:

> *Body column: kept NOT NULL for backward compat but relaxed to allow the placeholder '(encrypted)' when `encrypted=true` so the existing services + shell don't crash on legacy queries. Clients decrypt + replace on hydration.*

The sentinel is a compatibility shim introduced in Bridge 76 (2025 era) when the E2E encryption rollout had to coexist with services that selected `body` directly without checking `encrypted`.

### 1.2 · Why it is now debt

Owner-sealed decisions have evolved past the compatibility window:

- **Device-only E2E chat doctrine** (sealed 2026-11-09): private peer chat is end-to-end only; plaintext body persistence is prohibited server-side.
- **Plaintext freeze guard** (`NEX_CHAT_PLAINTEXT_FREEZE` default ON, 2026-11-13): the server refuses to accept plaintext send paths; the `/api/nex-native/attachment/standard` route returns `410 Gone` by default.
- **D6 constraint ladder** (sealed 2026-11-10):
  - Mig 328 (authored, not applied): `CHECK (encrypted = true) NOT VALID` — new inserts must be encrypted; legacy rows grandfathered (I-4 preservation).
  - Mig 329 (authored, not applied): `VALIDATE CONSTRAINT` — promotes 328 to full invariant after 14-day sandbox + 7-day prod burn-in with zero plaintext writes.

Once mig 329 is applied and legacy `encrypted=false` rows are resolved, every row in the table is encrypted. The `body` column then holds the constant sentinel `(encrypted)` on every row — a `NOT NULL` column whose only legal value is a literal string.

**That is schema debt.** The column signals semantics it does not carry. New engineers reading the schema reasonably infer that `body` contains the message; it does not.

### 1.3 · What depends on the current shape

Callers that read `body` today (grep `nex_peer_message` + select patterns):

- `src/lib/nex-native/peer-message-service.ts` — select lists include `body` for hydration.
- Legacy outbox / Bridge services that predate the client-side envelope.
- Any dev-impersonation surface that may probe raw messages for diagnostics.

Services that write `body` today:

- Encrypted send paths insert the literal string `(encrypted)` into `body`.
- Legacy plaintext send paths (frozen under D4) would have written the user text.

A change to `body`'s NOT-NULL / sentinel contract touches both reader and writer paths.

---

## 2 · Decision (OPTIONS — awaiting owner selection)

Three options are tracked. Each preserves the sealed device-only E2E doctrine and the D6 constraint ladder. None of them change the ciphertext columns.

### Option A · Keep the sentinel (STATUS QUO, formalise with a CHECK)

- `body` remains `NOT NULL`.
- Add a CHECK: `body = '(encrypted)' OR encrypted = false`.
- Readers unchanged.
- Writers unchanged.
- No migration beyond the CHECK add.

**When to choose:** if minimising reader/writer blast radius is more valuable than the semantic noise of the sentinel.

### Option B · Allow NULL body on encrypted rows

- Drop `body NOT NULL`.
- Update the shape constraint: when `encrypted = true`, `body` may be NULL or the sentinel.
- Update every reader to tolerate `body IS NULL` on encrypted rows (should already render from decrypted ciphertext).
- Writers may omit `body` on encrypted inserts.

**When to choose:** if the encrypted invariant is now strong enough that readers can be audited and the sentinel purged incrementally.

### Option C · Replace with a strongly-typed enum state

- Add a `body_state` column with `('plaintext_legacy', 'encrypted_ciphertext')`.
- Backfill: all current `encrypted=true` rows → `'encrypted_ciphertext'`; all `encrypted=false` rows → `'plaintext_legacy'`.
- Drop the sentinel entirely once mig 329 VALIDATES (every row is encrypted). `body` can then be hard-null for encrypted rows.
- Readers tolerate NULL and switch on `body_state`.

**When to choose:** if the team wants the schema to speak the doctrine explicitly and is willing to touch every reader.

---

## 3 · Alternatives considered and rejected

- **Delete all legacy plaintext rows** — rejected: would discard legitimate historical conversations the users still see in-app. Separate owner authorisation required (the I-4 preservation constraint in migs 328/329 explicitly preserves legacy rows).
- **Rename the column to `body_or_sentinel`** — rejected: cosmetic only, worse than status quo.
- **Pivot to a separate `encrypted_message` table** — rejected: would fork the codepath; adds a join or union to every message read; not compatible with the fan-out insert pattern.

---

## 4 · Consequences

### Option A
- **Pro:** zero reader/writer change. Low risk.
- **Con:** schema noise persists; new engineers must learn the sentinel convention.
- **Con:** the CHECK adds enforcement cost on every INSERT / UPDATE touching `body`.

### Option B
- **Pro:** removes the sentinel; body truthfully NULL when there's no plaintext.
- **Con:** every caller that touches `body` must be audited and made null-safe.
- **Con:** requires a reader-side regression spec per launch pillar before migration can apply.

### Option C
- **Pro:** schema explicitly encodes the doctrine.
- **Con:** adds a column; requires backfill; largest migration of the three.
- **Con:** forces a reader audit before the backfill can run.

---

## 5 · Preconditions (same for any option)

- Mig 328 applied in sandbox for ≥14 days.
- Mig 329 applied in sandbox for the owner-stated burn-in window.
- Legacy plaintext row count against production known (currently blocked under F-16 legacy-row policy).
- All readers of `body` inventoried (listed in §1.3 above; full audit is a prerequisite for B or C).

---

## 6 · Scope and boundaries

- This ADR DOES NOT apply any migration.
- This ADR DOES NOT change the `nex_peer_message` row shape.
- This ADR DOES NOT change the sealed device-only E2E chat doctrine.
- This ADR DOES NOT change the plaintext-freeze guard.
- This ADR DOES NOT propose a new `encrypted_message` table.
- This ADR DOES NOT propose deletion of legacy plaintext rows.
- This ADR DOES NOT propose a `body` column rename.
- Production remains sealed. Sandbox remains unchanged.

Owner action required: select Option A, B, or C. The implementation migration will be filed under a new number in the `nex-supabase/migrations/` ladder as a separate authorisation step.

---

## 7 · Trace back

- `nex-supabase/migrations/093_nex_peer_message_encrypted.sql` — original sentinel introduction.
- `nex-supabase/migrations/328_nex_peer_message_encrypted_check_NOT_VALID_PROPOSAL.sql` — Phase 1 constraint.
- `nex-supabase/migrations/329_nex_peer_message_encrypted_check_VALIDATE_PROPOSAL.sql` — Phase 3 VALIDATE.
- Owner memory `project_nex_merchant_payments_sealed_2026_11_10` and `project_nex_supabase_backend_architecture_sealed_2026_11_09` — doctrine seals that motivated this reconciliation.
- Master plan `nex-founder-foundation-to-near-live-master-plan-2026-11-24.md` §12A.2 row 1.3.
