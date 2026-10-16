# NEX Vault · Business Entitlement + Expiry Policy

**Date sealed**: 2026-10-15
**Owner**: Philip
**Status**: APPROVED · supersedes prior "zero commercial code" statement on Vault only
**Scope**: Vault surface only (`src/app/nex-native/vault/**`, `src/app/api/nex-native/vault/**`, `src/lib/nex-native/vault/**`, `src/lib/nex-native/vault-*.ts`)

---

## What this document supersedes

The following prior statements are **narrowly superseded** (Vault entitlement only · other commercial-code boundaries are unchanged):

- `src/app/api/nex-native/vault/setup/route.ts:31-32` — comment "Zero commercial code · no bisnis / tier / plan / subscription / entitlement / quota / allowance references." must be replaced with a reference to this policy when implementation of P0.1 is authorised.
- `docs/doctrine/nex-package-feature-entitlement-map-2026-10-14.md:407` — statement "there is no Vault Business entitlement in this codebase · sealed design, not an oversight" is reversed. Vault IS a Business-package entitlement from this policy forward.

Nothing else in the entitlement-map document, tier-gate (`src/lib/nex-native/tier-gate.ts`), or any other Vault-adjacent sealed boundary is affected.

---

## P0.1 · Vault is a Business-package entitlement

Vault is available **only** to accounts with a **specific, active Business-package entitlement**. Enforcement must be:

1. **Server-side on every protected operation** — no UI-only gating. Specifically:
    - `src/app/nex-native/vault/page.tsx` (entry server component)
    - `src/app/nex-native/vault/intro/page.tsx` (first-time landing)
    - `src/app/nex-native/vault/setup/page.tsx` (setup wizard)
    - `src/app/nex-native/vault/home/**/*.tsx` (every home surface)
    - All 26 API routes under `src/app/api/nex-native/vault/**`
    - All 5 server actions in `src/app/nex-native/vault/_actions.ts`
    - Service-layer helpers in `src/lib/nex-native/vault*/*.ts`

2. **Granular** — the policy must NOT assume every Business tier includes Vault. The specific package SKU(s) that unlock Vault must be an explicit allow-list, reusing the existing `nex_account.subscription_plan` and `nex_account.tier` columns where they correctly represent the purchased package.

3. **Gratis + non-Vault-Business tiers blocked** — these accounts must receive a dedicated 403 / redirect to a `/nex-native/vault/upsell` surface that explains the entitlement. They must not be able to call Vault APIs directly either.

4. **No "free fallback"** — if the entitlement check cannot be completed (DB unreachable, column missing, etc.), the default is DENY, not ALLOW.

---

## P0.2 · Expired entitlement = lock access, preserve data

When a user's Vault entitlement lapses (`bisnis_expires_at` passes, subscription cancelled, SKU downgraded, revoked, etc.):

1. **Vault access is disabled immediately** — same gate as P0.1 denies entry.
2. **Protected API operations return 403** — identical to never-entitled users.
3. **Owner is warned** — via a to-be-designed notification path. No silent lapse.
4. **Encrypted data is preserved intact**:
    - `nex_vault_setup` row stays. `nex_vault_file` rows stay (ciphertext). `nex_vault_entry` rows stay. `nex_vault_key_envelope` rows stay.
    - **Zero automatic deletion.** No "grace period after which we delete." Expiry locks the door; it does not empty the room.
5. **Access resumes on renewal** — restoring entitlement restores access to the exact prior state. No re-setup required.
6. **No hidden grace period that continues granting full Vault access** — the moment entitlement expires server-side, the gate denies. UI may show a short "renewal grace window" purely for messaging, but it must NOT ungate the API or let the client decrypt new content.
7. **Data-export policy for expired accounts is a separate design task** — not implemented in P1. A future, clearly-disclosed export path for users who cannot renew. The default must never be "pay to recover your own data" without the user understanding this at purchase time.

---

## P0.3 · Privacy by default · search + notifications

Until the actual search and notification subsystems have been identified in the codebase and audited:

1. **Default-deny posture for new integrations.** Any new surface added to NEX that reads conversation lists, message content, contact names, file names, or attachment content MUST filter out Vault-held entries. The vault-filtered helpers in `src/lib/nex-native/vault-entry-service.ts:294-332` (`listMainInboxConversationsForAccount`, `listMainContactsFriendIdsForAccount`) are the ONLY approved reads of these datasets for non-Vault surfaces.
2. **Audit before launch.** Before Vault is declared "complete," a dedicated audit must identify every planned or implemented search / notification integration and verify it uses the vault-filtered helpers. Items in Q3 of the 2026-10-15 audit were marked UNKNOWN precisely because these subsystems were not found; "not found" is NOT "safe" — it's "unverified."
3. **No notification previews containing Vault-origin content.** Push / in-app / email notification previews must not render Vault-conversation message bodies, Vault file names, or vaulted-contact names.
4. **Vault-held conversations never surface in autocomplete, mentions, invite flows, or group pickers.**

---

## The 60-second return window · load-bearing clarification

(For P5 implementation · recorded here so the policy is complete.)

The 60-second return window is **not** "keep Vault unlocked for 60 seconds." It is:

- **Immediate**: on leaving `/nex-native/vault/**`, the active VMK and all `K_c` material in memory are cleared, and the private DOM content is concealed.
- **Short-lived re-entry authorisation**: a securely held, time-bounded sentinel allows the user to re-enter Vault without the full PIN flow if **all** of the following are still true:
    1. Within 60 seconds of exit.
    2. Device + session + authentication posture unchanged.
    3. Entitlement still valid (P0.1).
    4. No explicit lock command was issued.
    5. No backgrounding / device lock event happened.
- **After 60 s**: normal PIN unlock required.
- **Background or device-lock**: conceal immediately; never rely on the timer to protect a hidden page. The re-entry sentinel is also invalidated.
- **Loss of entitlement OR explicit lock**: sentinel invalidated immediately.

Clearing the VMK and keeping a re-entry sentinel are different operations. The implementation must not keep the decryption key alive to make re-entry convenient.

---

## What this policy does NOT change

- **Any other commercial-code boundary in nexapp.** This narrow reversal applies ONLY to Vault entitlement.
- **The sealed Vault crypto architecture** · VMK · K_c · AES-GCM · PIN + passphrase + WebAuthn envelopes · zeroise-after-use · RLS at DB · ownership checks · step-up freshness. All sealed and untouched.
- **The one-sided hide semantics of move-to-Vault** · the non-Vault peer's experience is unchanged (migration `128_nex_vault_entry.sql:12-15`).
- **Recovery mechanism** · PIN + recovery passphrase. No new backdoor.
- **"Both lost = unrecoverable" guarantee** · owner holds the keys. No master-key reset path.

---

## Implementation sequence for Vault (owner-approved order)

1. **This document** — recorded, approved. ✅
2. **P1** — attachment encryption at Vault layer (NEXT · read-only plan to follow in-session · owner approval required before any code).
3. **P1b** — Save-to-Vault manual affordance from ordinary chat + Retrieve-from-Vault manual affordance into a chosen conversation, with explicit "leaving Vault boundary" dialog.
4. **P2** — entitlement gate (P0.1) wired to every protected surface + expiry policy enforcement (P0.2).
5. **P3** — 60-second return window per the clarification above (P5 in prior report).
6. **P4** — full end-to-end verification across all gates and transitions.

Each phase requires separate owner authorisation. No phase self-authorises the next.

---

## What Claude must NOT do (restated)

- Do not rebuild the existing Vault architecture.
- Do not weaken authentication, RLS, ownership checks, or key recovery.
- Do not make Vault available to free accounts as a fallback at any point.
- Do not silently delete data when Business access expires.
- Do not claim attachment encryption works until ciphertext storage AND decryption have been verified end-to-end.
- Do not create or execute database migrations until the required schema changes have been reviewed and separately approved.
- Do not commit or push without explicit owner approval.
