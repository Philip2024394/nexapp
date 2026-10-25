"use server";

// src/app/nex-native/live-commerce/_invite-target-action.ts
//
// NEX Live · fetch an InviteTarget for a given account id.
// -----------------------------------------------------------------------------
// Owner directive 2026-10-25 · the Live MessagePanel resolves the
// broadcaster's public NEX identity (nex_handle + display_name +
// avatar_url + country) via this action BEFORE calling the existing
// `createFriendRequestAction(nexHandle, text)` server action from
// `src/app/nex-native/contacts/_friend-request-actions.ts`.
//
// This action does NOT:
//   · Author any new invitation record.
//   · Change the invitation service.
//   · Create a parallel Live-only invitation path.
// It is a READ-ONLY identity resolver.

import { resolveInviteTarget } from "@/lib/nex-native/live-broadcast/invite-target";
import type { InviteTarget } from "@/lib/nex-native/live-broadcast/invite-target";
import type { NexUuid } from "@/lib/nex-native/types";

export type GetLiveInviteTargetResult =
  | { readonly kind: "ok"; readonly target: InviteTarget }
  | { readonly kind: "not-invitable"; readonly reason: "no-handle" | "account-not-found" }
  | { readonly kind: "error"; readonly message: string };

export async function getLiveInviteTargetAction(
  accountId: NexUuid,
): Promise<GetLiveInviteTargetResult> {
  if (typeof accountId !== "string" || accountId.length === 0) {
    return { kind: "not-invitable", reason: "account-not-found" };
  }
  try {
    const target = await resolveInviteTarget(accountId);
    if (!target) {
      return { kind: "not-invitable", reason: "no-handle" };
    }
    return { kind: "ok", target };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
