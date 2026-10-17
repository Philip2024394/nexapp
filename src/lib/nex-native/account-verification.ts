// src/lib/nex-native/account-verification.ts
//
// NEX account verification signal · sealed 2026-10-17.
// -------------------------------------------------------------------
// Resolves whether an account should display the blue "verified"
// checkmark on their canonical profile. Owner-sealed rule
// (your Option 1 answer 2026-10-17 · verbatim):
//
//   "Only when linked to an active Safe Trade VERIFIED business"
//
// Reuses the sealed per-business Safe Trade resolver · no new
// verification system is invented. An account is verified when at
// least one `nex_business` row with `owner_account_id = accountId`
// resolves to `safe-trade-status === "VERIFIED"`. VERIFIED today
// means: claimed account + ≥1 completed trade + 0 open disputes.
// Until the dispute-tracking schema ships the resolver returns
// `NEW` (not `VERIFIED`) for most sellers · so verification will
// stay rare until that lands · which is correct (honest-null).
//
// Non-sellers get `false` · they have no `nex_business` row with
// their account as owner · no fabricated verification claim.
//
// This module is read-only · never writes any verification state ·
// no client can mark itself verified (per the sealed build prompt).

import "server-only";
import * as businessService from "./business-service";
import { resolveSafeTradeStatus } from "./safe-trade-status";
import type { NexUuid } from "./types";

/**
 * Returns `true` when `accountId` owns at least one `nex_business`
 * row whose sealed Safe Trade status resolves to `"VERIFIED"`.
 * Fail-closed: any service-layer error returns `false` · we never
 * silently promote an account to verified when the signal cannot be
 * trusted.
 */
export async function isAccountVerified(accountId: NexUuid): Promise<boolean> {
  try {
    const businesses = await businessService.listBusinessesByOwner(accountId);
    for (const b of businesses) {
      const snapshot = resolveSafeTradeStatus(b);
      if (snapshot.status === "VERIFIED") return true;
    }
    return false;
  } catch {
    // Fail-closed · verification signal is a trust claim · when the
    // underlying data cannot be read we must not fabricate it.
    return false;
  }
}
