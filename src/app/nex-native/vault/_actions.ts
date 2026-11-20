// src/app/nex-native/vault/_actions.ts
//
// Vault Server Actions · Stage 3 · founder-sealed vault-build-plan-2026-10-03.
//
// Thin wrappers over vault-entry-service that:
//   1. Resolve the viewer via resolveNexAppSessionFromContext (NO
//      acceptance of account id from the client; the viewer is always
//      session.account.id).
//   2. Call the service with the viewer id baked in.
//   3. Revalidate the inbox + friends paths + Vault chats so the UI
//      updates without a hard reload.
//
// Confirmation copy for each action lives in UI (long-press menus /
// confirm dialogs). These actions assume the user has already confirmed
// in the UI; they execute without further prompting.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
// 2026-11-20 · dev-impersonation parity backfill. The 2026-11-12
// upload-bounce-to-sign-in bug was caused by a vault/manage server
// action that resolved sessions via the legacy path; this import
// closes the same gap for vault mutation actions. Aliased to keep
// every call-site in this file unchanged.
import { resolveSessionWithDevOverride as resolveNexAppSessionFromContext } from "@/lib/nex-native/app/dev-impersonation";
import * as vaultEntryService from "@/lib/nex-native/vault-entry-service";
// P1b-C 2026-10-15 · surface attachment-copy counts to the UI so the
// user never sees unqualified success when some attachments failed.
import type { VaultAttachmentCopyResult } from "@/lib/nex-native/vault-persistence-service";

async function viewerAccountIdOrRedirect(): Promise<string> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in");
  }
  return session.account.id;
}

function revalidateAfterVaultChange(): void {
  revalidatePath("/nex-native/chat");
  revalidatePath("/nex-native/chat/inbox");
  revalidatePath("/nex-native/friends");
  revalidatePath("/nex-native/vault/home");
  revalidatePath("/nex-native/vault/home/chats");
}

/**
 * B.6A · list the vaulted friend account IDs for the authenticated
 * viewer. Used by the sealed universal incoming-call hub to decide
 * whether to hide the peer identity when Vault is locked.
 *
 * Returns the account ids as opaque strings · reveals NO Vault
 * content (no last-message, no attachment names, no peer display
 * name). Owner-scoped · routes through the sealed vault-entry-
 * service and the authenticated session.
 */
export async function listVaultedFriendIdsForViewerAction(): Promise<
  { ok: true; friendIds: string[] } | { ok: false; reason: string }
> {
  try {
    const me = await viewerAccountIdOrRedirect();
    const friends = await vaultEntryService.listVaultedFriendIdsForAccount(me);
    const convs = await vaultEntryService.listVaultedConversationsForAccount(me);
    // Include both friend-vault targets AND conversation-vault peer
    // ids · the hub applies the "hide peer identity" rule when the
    // caller is a vaulted-friend OR a vaulted-conversation peer, so
    // this one list covers both signal sources.
    const set = new Set<string>(friends);
    for (const v of convs) set.add(v.peerAccountId);
    return { ok: true, friendIds: [...set] };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

export async function moveConversationToVaultAction(
  conversationId: string,
): Promise<
  | { ok: true; attachments: VaultAttachmentCopyResult }
  | { ok: false; reason: string }
> {
  // P1b-C 2026-10-15 · the sealed service already returns a rich
  // VaultAttachmentCopyResult with total / copied / skipped / failed
  // counts (vault-entry-service.moveConversationToVault). This action
  // previously discarded that payload, which let the UI claim
  // "moved to Vault" even when some attachments silently failed. We
  // now surface the counts verbatim so the UI can distinguish full
  // success from partial preservation. The entry row itself is NOT
  // surfaced · the UI never needs it, and keeping the payload shape
  // minimal avoids leaking Vault metadata into the client bundle.
  try {
    const me = await viewerAccountIdOrRedirect();
    const result = await vaultEntryService.moveConversationToVault(
      me,
      conversationId,
    );
    revalidateAfterVaultChange();
    return { ok: true, attachments: result.attachments };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

export async function moveFriendToVaultAction(
  friendAccountId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const me = await viewerAccountIdOrRedirect();
    await vaultEntryService.moveFriendToVault(me, friendAccountId);
    revalidateAfterVaultChange();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

export async function removeConversationFromVaultAction(
  conversationId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const me = await viewerAccountIdOrRedirect();
    await vaultEntryService.removeConversationFromVault(me, conversationId);
    revalidateAfterVaultChange();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

export async function removeFriendFromVaultAction(
  friendAccountId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const me = await viewerAccountIdOrRedirect();
    await vaultEntryService.removeFriendFromVault(me, friendAccountId);
    revalidateAfterVaultChange();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}
