// src/lib/nex-native/crypto/legacy-plaintext-catalog.ts
//
// NEX device-key chat · legacy plaintext NON-DESTRUCTIVE catalog.
// Owner-authorised 2026-11-10 (independent component · does NOT
// depend on any of the six open decisions in
// device-key-chat-decisions-2026-11-10.md).
// -----------------------------------------------------------------
// Pure READ-ONLY accounting. Counts rows in `nex_peer_message` where
// `encrypted = false` for conversations involving the supplied
// account. Returns the honest count so a future UI can tell the
// user "N plaintext rows on your account; here are your options."
//
// Sealed invariants honoured:
//   · I-1 · no server retention of plaintext introduced here · we
//     only READ rows that already exist.
//   · I-4 · no historical deletion without separate authorisation ·
//     this module NEVER writes, updates, or deletes. The caller
//     surface (UI) is also required to never auto-delete.
//   · I-5 · no rollback restores private content · this module has
//     no rollback to perform · it is a counter.
//
// Scope statement:
//   · The UI surface that consumes this count is OUT OF SCOPE for
//     the 2026-11-10 implementation batch. This file is the
//     accounting primitive only.
//   · "Involving the account" is interpreted as rows where the
//     account is the sender_account_id. The receiver-side rows on
//     the same conversation are counted against the receiver's own
//     account when they ask (equivalent symmetry). This avoids
//     double-counting when both participants ask simultaneously.
//     A fuller "both sides of the conversation" variant can be added
//     later if owner requires it; it would be a separate exported
//     function so this primitive stays honest.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";

/** Honest result · the exact number of legacy plaintext rows this
 *  account has authored. When the DB errors, callers get the error
 *  so they can surface it truthfully instead of displaying a stale
 *  zero. */
export interface LegacyPlaintextCount {
  ok: true;
  count: number;
}

export interface LegacyPlaintextCountError {
  ok: false;
  error: string;
}

export type LegacyPlaintextCountResult =
  | LegacyPlaintextCount
  | LegacyPlaintextCountError;

/** Count the account's legacy `encrypted=false` rows.
 *
 *  Purely read-only · no writes, no deletes, no rewrites. The query
 *  uses the service-role client because the caller is typically a
 *  server action that has already verified the requester owns the
 *  account; in that server context the column-scoped filter is what
 *  constrains access.
 *
 *  The RLS table policy also guards the row-level visibility for
 *  anon/authenticated callers via `sender_account_id` participation
 *  checks; the service-role path bypasses RLS and the explicit
 *  `.eq("sender_account_id", accountId)` is what scopes the count.
 *
 *  Returns `{ ok: true, count }` on success. Returns
 *  `{ ok: false, error }` on failure so callers can surface honestly. */
export async function countLegacyPlaintextRows(
  accountId: string,
): Promise<LegacyPlaintextCountResult> {
  if (!accountId || typeof accountId !== "string") {
    return {
      ok: false,
      error: "legacy-plaintext-catalog.count: accountId required",
    };
  }
  const { count, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("id", { count: "exact", head: true })
    .eq("sender_account_id", accountId)
    .eq("encrypted", false);
  if (error) {
    return {
      ok: false,
      error: `legacy-plaintext-catalog.count: ${error.message}`,
    };
  }
  return { ok: true, count: count ?? 0 };
}
