// src/app/nex-native/settings/blocked/_actions.ts
//
// NEX Settings · Blocked contacts · server actions · Stage 1 sealed
// 2026-10-15.
//
// Scoped actions file for the Blocked contacts page. Isolated from
// the top-level `src/app/nex-native/_actions.ts` so this Settings
// batch does not touch unrelated dirty work in that file.
//
// Ownership + permission enforcement lives in the sealed
// `friend-service.unblockAccount`:
//   · requires an existing edge
//   · requires `status === 'blocked'`
//   · requires `requested_by === actor` (only the original blocker
//     can lift the block)
// We do NOT re-implement any of those checks here · the sealed service
// is the single source of truth.

"use server";

import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { unblockAccount } from "@/lib/nex-native/friend-service";

export type UnblockActionResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "invalid_request" | "service_error"; message?: string };

/**
 * Unblock an account that the current session has previously blocked.
 * All server-side authorisation is delegated to the sealed
 * `friend-service.unblockAccount`:
 *   · UUID canonical-pair + self-check
 *   · "only the blocker can unblock" check
 *   · "edge must exist + status must be 'blocked'" check
 *
 * On success the Blocked contacts path is revalidated so the row
 * disappears from the list on the next render.
 */
export async function unblockAccountAction(
  formData: FormData,
): Promise<UnblockActionResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return { ok: false, reason: "unauthorized" };
  }

  const otherAccountId = formData.get("other_account_id");
  if (typeof otherAccountId !== "string" || otherAccountId.length === 0) {
    return { ok: false, reason: "invalid_request" };
  }

  try {
    await unblockAccount(session.account.id, otherAccountId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "service_error", message };
  }

  revalidatePath("/nex-native/settings/blocked");
  return { ok: true };
}
