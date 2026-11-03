// src/lib/nex-native/billing/vault-quota.ts
//
// NEX Billing · Vault storage quota reservation (D4 · owner-recommended).
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED).
//
// Atomic quota check + reservation for Vault uploads · wraps the actual
// `nex_vault_file` INSERT inside a `withAccountLock` transaction so two
// concurrent uploads cannot both pass the quota check and then both
// insert past the cap.
//
// Pure "service" layer · knows nothing about Supabase storage, HTTP, or
// session · receives:
//   · the store (locked already OR a store whose withAccountLock we use)
//   · the account id
//   · the per-tier cap (resolved via entitlement helper)
//   · the file byteSize
//   · an `insert(txStore)` callback that performs the actual
//     `nex_vault_file` INSERT, inside the SAME transaction as the quota
//     check (so the SUM read + INSERT see each other).
//
// REHEARSAL · R-13 (Gate 1): confirm SUM(byte_size) returns the right
// aggregate inside a FOR UPDATE transaction, and that the INSERT inside
// the callback is visible to the SUM when retried under concurrent load.

import "server-only";
import type {
  SupabaseBillingStore,
} from "./supabase-store";
import { VAULT_STORAGE_CAP_BYTES } from "./enforcement";
import type { VaultTier } from "./types";

export interface ReserveVaultCapInput {
  readonly nexAccountId: string;
  readonly addingBytes: number;
  readonly tier: VaultTier;
}

export type ReserveVaultCapResult =
  | {
      readonly ok: true;
      readonly currentUsedBytes: number;
      readonly projectedBytes: number;
      readonly capBytes: number;
    }
  | {
      readonly ok: false;
      readonly code:
        | "cap_exceeded"
        | "no_entitlement"
        | "unsupported_tier"
        | "value_out_of_range";
      readonly reason: string;
      readonly capBytes?: number;
      readonly currentUsedBytes?: number;
    };

/** Reserve capacity for a new Vault file. Caller must perform the actual
 *  `nex_vault_file` INSERT inside the same lock window · pass the INSERT
 *  as the `insert` callback OR perform the INSERT yourself using the
 *  SupabaseBillingStore passed to the inner function (which runs inside
 *  the locked transaction).
 *
 *  Design note · we expose two APIs:
 *    · `reserveVaultCap()` · just checks + returns the decision · the
 *      caller then performs the INSERT and commits.
 *    · `withVaultCapReservation()` · wraps the INSERT inside the lock. */
export async function reserveVaultCap(
  input: ReserveVaultCapInput,
  store: SupabaseBillingStore,
): Promise<ReserveVaultCapResult> {
  if (!Number.isFinite(input.addingBytes) || input.addingBytes <= 0) {
    return {
      ok: false,
      code: "value_out_of_range",
      reason: `addingBytes must be positive · got ${input.addingBytes}`,
    };
  }
  if (!(input.tier in VAULT_STORAGE_CAP_BYTES)) {
    return {
      ok: false,
      code: "unsupported_tier",
      reason: `vault tier '${input.tier}' is not recognised`,
    };
  }
  const cap = VAULT_STORAGE_CAP_BYTES[input.tier];
  if (cap === 0) {
    return {
      ok: false,
      code: "no_entitlement",
      reason: "vault tier 'gratis' has no storage allocation",
    };
  }

  return store.withAccountLock(input.nexAccountId, async (txStore) => {
    const used = await _sumVaultUsageBytes(txStore, input.nexAccountId);
    const projected = used + input.addingBytes;
    if (projected > cap) {
      return {
        ok: false as const,
        code: "cap_exceeded" as const,
        reason: `Vault ${input.tier} caps at ${cap} bytes (decimal) · current ${used} + ${input.addingBytes} would reach ${projected}`,
        capBytes: cap,
        currentUsedBytes: used,
      };
    }
    return {
      ok: true as const,
      currentUsedBytes: used,
      projectedBytes: projected,
      capBytes: cap,
    };
  });
}

/** Run the INSERT inside the lock · caller returns the inserted row.
 *  Does the quota check AND the INSERT under the same lock · guarantees
 *  atomic reservation (two concurrent callers for the same account
 *  serialise). */
export async function withVaultCapReservation<InsertResult>(
  input: ReserveVaultCapInput,
  store: SupabaseBillingStore,
  insert: (txStore: SupabaseBillingStore) => Promise<InsertResult>,
): Promise<ReserveVaultCapResult | { ok: true; insertResult: InsertResult }> {
  if (!Number.isFinite(input.addingBytes) || input.addingBytes <= 0) {
    return {
      ok: false,
      code: "value_out_of_range",
      reason: `addingBytes must be positive · got ${input.addingBytes}`,
    };
  }
  if (!(input.tier in VAULT_STORAGE_CAP_BYTES)) {
    return {
      ok: false,
      code: "unsupported_tier",
      reason: `vault tier '${input.tier}' is not recognised`,
    };
  }
  const cap = VAULT_STORAGE_CAP_BYTES[input.tier];
  if (cap === 0) {
    return {
      ok: false,
      code: "no_entitlement",
      reason: "vault tier 'gratis' has no storage allocation",
    };
  }

  return store.withAccountLock(input.nexAccountId, async (txStore) => {
    const used = await _sumVaultUsageBytes(txStore, input.nexAccountId);
    const projected = used + input.addingBytes;
    if (projected > cap) {
      return {
        ok: false as const,
        code: "cap_exceeded" as const,
        reason: `Vault ${input.tier} caps at ${cap} bytes · current ${used} + ${input.addingBytes} would reach ${projected}`,
        capBytes: cap,
        currentUsedBytes: used,
      };
    }
    const insertResult = await insert(txStore);
    return { ok: true as const, insertResult };
  });
}

/** Internal · SUM byte_size from nex_vault_file for the account. Runs
 *  inside the lock-holding transaction. We select a direct SUM so the
 *  cost is a single aggregate scan on the per-account index.
 *
 *  REHEARSAL R-13 · verify SUM returns the correct aggregate shape
 *  (bigint cast to number). */
async function _sumVaultUsageBytes(
  txStore: SupabaseBillingStore,
  accountId: string,
): Promise<number> {
  // We use the adapter's private query method via a thin trampoline that
  // avoids leaking the method signature. Added to the class for internal
  // use only.
  const sum = await (
    txStore as unknown as {
      _rawQuery: <R extends Record<string, unknown>>(
        text: string,
        values: readonly unknown[],
      ) => Promise<{ rows: R[]; rowCount: number }>;
    }
  )._rawQuery<{ sum: string | number | null }>(
    "SELECT COALESCE(SUM(byte_size), 0)::bigint AS sum FROM nex_vault_file WHERE account_id = $1",
    [accountId],
  );
  const raw = sum.rows[0]?.sum ?? 0;
  return typeof raw === "number" ? raw : Number(raw);
}
