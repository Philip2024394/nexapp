# NEX Theme Commerce · Save Receipt to Vault · deferred to Stage 5

**Status:** Decision recorded 2026-10-14 · implementation deferred to Stage 5 · not yet authorised.

## The decision

An optional "Save receipt to Vault" affordance will be offered on the Stage-5 purchase-complete surface. It uses the **existing** Vault file API (`nex_vault_file` table + the `nex-vault-files` storage bucket) to persist a per-purchase PDF receipt that the owner can later open from `/vault/home/documents`.

## What this decision is NOT

- It is **not** authorisation to implement anything now.
- It is **not** a change to Vault doctrine. The Vault doctrine stands as sealed:
  - `nex_vault_entry` · hides specific conversations/friends (SA6 ABSOLUTE: server observes `moved_at` only).
  - `nex_vault_file` · owner-scoped private file storage (currently access-controlled; Phase A will add client-side encryption).
  - `nex_vault_setup` + `nex_vault_key_envelope` + attempts tables · key material + rate-limit substrate.
  - `nex_vault_conversation_envelope` · wraps K_c per device for canonical conversations.
- It is **not** a new Vault table. No `nex_vault_receipt`, `nex_vault_order`, `nex_vault_purchase`.
- It is **not** a mixing of Vault encryption with payment verification. Payment verification stays on the public-schema side (`nex_theme_purchase.state` transitions, service-role writes, webhook adapter). Vault remains a client-crypto-first user-owned store.

## Why Vault cannot be used as the source of truth for purchase evidence

- Vault's SA6 ABSOLUTE says "no server-side observation of Vault access patterns." Payment webhook verification **requires** server-side observation of state transitions.
- Payment events (verify, refund) must be queryable by admin/webhook code paths to drive entitlement decisions in `canActivate()`. Vault rows are opaque or client-encrypted.
- Receipts are a derived artefact of the purchase row, not the authoritative source. Storing a receipt in Vault is a convenience for the owner, not a replacement for the server-side ledger.

## Stage-5 implementation sketch (for future reference only, not now)

After a `nex_theme_purchase` transitions `pending → verified`, the Stage-5 purchase-success route can:
1. Render a receipt page with the purchase + ownership details.
2. Offer a **"Save receipt to Vault"** button.
3. On click: client renders the receipt to PDF, calls the existing Vault upload action to store it as `nex_vault_file(category='documents')` with a filename like `NEX-receipt-<theme_id>-<yyyy-mm-dd>.pdf`.
4. No new table. No new bucket. No new RLS. No change to Vault doctrine.

## Guardrails that must hold whenever Stage 5 lands

- The purchase row remains the source of truth. The Vault file is a copy, not the ledger.
- A failed Vault upload must never block the purchase or its ownership grant. Vault save is best-effort.
- The Stage-5 UI must be honest: if the Vault bucket is write-protected (Phase A pre-encryption window), the button is disabled with a clear "Vault file encryption not yet enabled" state. Never fake a successful save.
- No code path uses the Vault receipt file to prove ownership. Ownership proof comes from `canActivate()` against `nex_theme_ownership` + `nex_account.tier` + subscription state.

## References

- Vault doctrine · `nex-supabase/migrations/128_nex_vault_entry.sql` · `129_nex_vault_file.sql` · `142_nex_vault_envelope_tables.sql` · `143_nex_vault_conversation_envelope.sql`
- Theme commerce schema · migrations 191 (catalogue extension) · 192 (commission) · 193 (purchase) · 194 (ownership + refund revocation) · 195 (per-business theme) · 196 (bespoke-owner column privacy) · all unapplied
- Stage-2 security review that surfaced the Vault compatibility question · internal review turn 2026-10-14
