# NEX Chat Decisions · LOCKED · 2026-11-10

**Owner-approved 2026-11-10 (cycle 5 → cycle 6).** Supersedes:
- `chat-decisions-owner-paper-2026-11-10.md` (the recommended-defaults paper)
- `device-key-chat-decisions-2026-11-10.md` (prior draft)
- `device-key-chat-architecture-plan-2026-11-10.md` is the implementation plan.

All six chat decisions + Stripe tolerance + HQ admin design are now
APPROVED as the design direction for implementation. These approvals
authorise DESIGN AND LOCAL IMPLEMENTATION only. They do NOT authorise:
- Applying migrations.
- Creating or modifying Supabase buckets.
- Modifying sandbox or production databases.
- Migrating or deleting legacy plaintext chat data.
- GitHub push.
- Vercel deployment.
- Production changes.

The six invariants I-1 to I-6 remain non-negotiable.

---

## D1 · Bare key rotation · APPROVED

Rotation of a device public key is BARE: when the owner rotates, a new
public key replaces the previous one in-place in `nex_device_key`. The
OLD `revoked_at` is NOT surfaced in the public key lookup. Senders
only ever see the current active key for a recipient device.

**Implementation consequence:**
- `nex_device_key` schema already supports in-place update (mig 092).
- `device-key-cache-v2.ts` already has `invalidate(accountId)` · callers
  flush the cache after a rotation event.
- No new migration needed for D1.

---

## D2 · Server-side retired-device filter · APPROVED

When a sender fetches the recipient's device-key list for fan-out, the
filter runs SERVER-SIDE (service-role reads `nex_device_key WHERE
retired_at IS NULL`). Clients never see retired-device metadata.

**Implementation consequence:**
- A follow-up migration (proposed as mig 323 in the plan) adds a
  `retired_at timestamptz NULL` column + partial index.
- `fan-out-planner.ts` is already deterministic on the input list of
  active keys — no change needed once the filter lands.

---

## D3 · 30-day undelivered ciphertext cap · APPROVED

Ciphertext fan-out rows that remain undelivered after **30 days** are
automatically expired by a scheduled sweep. Expiry = row stays in
`nex_peer_message` but `delivery_status` flips to `expired` so the
sender's audit UI shows "recipient device never came online" (NOT a
NEX message · a structural status).

**Implementation consequence:**
- Follow-up mig (326 in the plan) adds `delivery_status` enum + sweep
  function.
- No plaintext is ever introduced. The ciphertext blob is still a
  ciphertext blob after expiry · the recipient's device can still
  decrypt if it comes online within the storage retention window.

**Delivery + recovery policy** (explicit, per owner's safeguard):
- Senders see "delivered" when the recipient device marks the row
  decrypted-locally.
- Senders see "pending" while awaiting any recipient device.
- After 30 days with no delivery, senders see "expired" · they can
  re-send if they still have the ciphertext material · NEX never
  attempts to re-encrypt because it never held plaintext.

---

## D4 · Adoption-gated freeze trigger · APPROVED

NEX stops writing new `encrypted=false` rows to `nex_peer_message` when
BOTH conditions are met:
1. **Adoption gate**: ≥95% of conversations between accounts that both
   have active device keys have moved to encrypted sends (measured
   over the preceding 14 days).
2. **Owner word-trigger**: explicit owner instruction `freeze plaintext sends`.

**Implementation consequence:**
- A per-deployment env var `NEX_CHAT_PLAINTEXT_FREEZE=1` controls the
  send path · when set, `peer-message-service` refuses to write
  `encrypted=false` rows and returns `plaintext_sends_frozen` to the
  caller.
- Adoption metric computed by a read-only query helper (no persistence
  · telemetry only · service-role only).
- Owner word-trigger: flipping the env var requires a deploy, which
  requires a separate owner authorisation (Vercel deploy gate).

---

## D5 · Daily sweep · 48-hour orphan handling · APPROVED

A daily cron sweeps for orphan ciphertext storage objects (objects in
`nex-peer-chat-ciphertext` bucket not referenced by any live
`nex_peer_message` row), with a **48-hour grace window** before a
confirmed orphan is deleted.

**Implementation consequence:**
- Follow-up mig (327 in the plan) adds a `nex_ciphertext_orphan_scan`
  marker table so the sweep is idempotent + resumable.
- vercel.json cron entry added for `/api/nex-native/cron/orphan-sweep`
  (daily · guarded by NEX_CRON_SECRET).
- Deletion is HARD delete of the storage object · NOT the DB row ·
  because the DB row is the source of truth for "message exists".

---

## D6 · 14-day sandbox + 7-day production burn-in before CHECK · APPROVED

The database-level CHECK that enforces `encrypted = true` on every new
`nex_peer_message` row lands in TWO phases:
- Phase 1: 14 days in sandbox with the CHECK in a NON-ENFORCING mode
  (`NOT VALID` constraint · observed only in query plans) while the
  freeze (D4) is fully adopted.
- Phase 2: 7 additional days in PRODUCTION with the CHECK still
  non-enforcing. If the observed plaintext-write rate is zero, flip
  to enforcing.
- Phase 3: owner-gated `apply mig 328` turns `NOT VALID` into enforced.

---

## Stripe · 5-min tolerance · APPROVED (Option B · IMPLEMENTED cycle 6)

- `verifyStripeSignature` accepts `toleranceSeconds` parameter.
- Default `STRIPE_DEFAULT_TOLERANCE_SECONDS = 300`.
- Rejects signatures with `|now - t|` outside the window even when
  HMAC is correct.
- 3 new tests pin the behaviour (old-rejected, future-rejected,
  inside-window-accepted). Hardcoded `1700000000` across both test
  files refreshed to `Math.floor(Date.now() / 1000)`.

---

## HQ admin · Dual-track RLS overlay · APPROVED (Option B)

- PROPOSAL migration drafted (`P-RLS-HQ-admin-overlay_PROPOSAL.sql`).
- Adds `nex_is_hq_admin()` SQL function + admin SELECT overlay
  policies on every sensitive user-data table.
- `nex_pilot_operator_audit` + `nex_security_audit_log` explicitly
  excluded. Admin JWT replay must not erase breadcrumbs.

---

## Legacy plaintext transition · non-destructive plan only

- Phase 0 catalog implemented: `legacy-plaintext-catalog.ts`.
- Phases 1 (UI inventory) · 2 (client-side re-encrypt) · 3 (user-
  driven retention) are DESIGNED NOT EXECUTED.
- NEX never initiates plaintext deletion.
- NEX never gains access to plaintext.
- Recovery: re-encrypt is client-idempotent; crash mid-operation
  leaves source untouched; accidental user delete is NOT recoverable
  (consistent with I-4).

---

## Summary

| Decision | Status | State |
|---|---|---|
| D1 | APPROVED | No code change needed |
| D2 | APPROVED | Mig 323 proposed · unapplied |
| D3 | APPROVED | Mig 326 proposed · unapplied |
| D4 | APPROVED | Env-var gated · unwired |
| D5 | APPROVED | Mig 327 + cron proposed · unapplied |
| D6 | APPROVED | Migs 328/329 proposed · unapplied |
| Stripe tolerance | APPROVED | IMPLEMENTED |
| HQ admin RLS | APPROVED | PROPOSAL drafted |
| Worldwide identity | APPROVED | Agent implementing |
| Legacy transition | APPROVED (plan) | Phase 0 implemented · Phases 1-3 unexecuted |

Each unapplied item still requires separate owner authorisation to
apply / deploy / push.
