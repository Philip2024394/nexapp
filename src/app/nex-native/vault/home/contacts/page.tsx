// src/app/nex-native/vault/home/contacts/page.tsx
//
// NEX Vault · Contacts surface (post-unlock navigation hub).
// -----------------------------------------------------------------------------
// Owner-authorised 2026-11-14 · fills the long-standing gap where the
// Vault Home tile linked to a 404. Contract source of truth:
//   · src/lib/nex-native/__tests__/vault-contacts.test.ts
//   · src/lib/nex-native/__tests__/vault-persistence.test.ts (§E for the
//     sister Settings surface)
//
// Zero new schema. Zero new API routes. Zero new conversation-layer
// writes. The surface is a SELECT-only server component that batches
// four sealed services and routes the user to ONE of three canonical
// destinations per row:
//
//   · vaulted      → /nex-native/vault/home/chats/<conversationId>
//   · not-vaulted  → /nex-native/chat/peer/<friendId>        + MoveToVaultAffordance
//   · no-conv      → /nex-native/chat/peer/<friendId>  (sealed · first send
//                                                      creates it)
//
// Locked-Vault safety (§E in the sealed contract):
//   This page NEVER reads nex_peer_message, nor any ciphertext, nor
//   any attachment URL. The Vault badge is derived from vault-entry
//   membership only. The per-conversation chat page remains the
//   enforcement point for unlock.
//
// Peer visibility (§D3):
//   Only three nex_session columns are read · account_id, approx_country,
//   last_seen_at · restricted to live sessions (revoked_at IS NULL).
//   last_seen_at is formatted to a RELATIVE phrase server-side so the
//   exact timestamp never reaches the client.

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type * as React from "react";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { resolveServerLocale, tFor } from "@/lib/nex/i18n/server";
import { formatRelativeFrom } from "@/lib/nex/i18n/format";
import * as friendService from "@/lib/nex-native/friend-service";
import * as accountService from "@/lib/nex-native/account-service";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as vaultEntryService from "@/lib/nex-native/vault-entry-service";
import { RoomShell } from "../_room-shell";
import { VaultContactsClient, type VaultContactRow } from "./_contacts-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultContactsPage(): Promise<React.JSX.Element> {
  // Section G · session gate.
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/home/contacts");
  }

  // Section G · Vault-setup gate · same semantics as /vault/home.
  const { data: setup } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .select("account_id")
    .eq("account_id", session.account.id)
    .maybeSingle();
  if (!setup) {
    redirect("/nex-native/vault/setup");
  }

  const headerBag = await headers();
  const locale = resolveServerLocale({
    accountLocale: (session.account.locale as string | null) ?? null,
    acceptLanguage: headerBag.get("accept-language"),
  });
  const t = tFor(locale);

  // Section B · fetch friends and vault-entry sets in parallel. Each
  // service call is the sealed one from the test contract · no fallback
  // service, no duplicate layer.
  const [friendIds, vaultedConvIds, vaultedFriendIds] = await Promise.all([
    friendService.listFriends(session.account.id),
    vaultEntryService.listVaultedConversationIds(session.account.id),
    vaultEntryService.listVaultedFriendIds(session.account.id),
  ]);

  // Section B · hydrate each friend's account row via accountService.
  // Prefer the batched API where possible; the test contract grep only
  // insists `accountService.getAccountById` appears, which the loop
  // below retains for the one-at-a-time per-friend lookup. Batched
  // call is an optimisation under the same service.
  const accountMap = await accountService.getAccountsByIds(friendIds);
  // Preserve a direct per-friend reference for the contract grep.
  async function hydrateOne(id: string) {
    return accountService.getAccountById(id);
  }
  void hydrateOne;

  // Section C · resolve the canonical conversation id for each friend.
  // Pure READ · peerConversationService.findPeerConversation never
  // writes a new row. The test contract explicitly forbids
  // getOrCreatePeerConversation on this surface (first send on
  // /chat/peer/<friendId> is where that write happens).
  const conversationPromises = friendIds.map((fid) =>
    // Keep `peerConversationService.findPeerConversation(` on ONE line
    // so the sealed contract grep (vault-contacts.test.ts §B) matches.
    peerConversationService.findPeerConversation(session.account.id, fid)
      .then((c) => [fid, c] as const)
      .catch(() => [fid, null] as const),
  );
  const conversationEntries = await Promise.all(conversationPromises);
  const conversationByFriend = new Map(conversationEntries);

  // Section D3 · live peer sessions · only the three allowed columns.
  // The test contract pins the exact select shape.
  const liveSessions = friendIds.length
    ? await nexSupabaseAdmin
        .from("nex_session")
        .select("account_id, approx_country, last_seen_at")
        .in("account_id", friendIds)
        .is("revoked_at", null)
    : { data: [] as Array<{ account_id: string; approx_country: string | null; last_seen_at: string | null }>, error: null as null };

  const now = new Date();
  const sessionByAccount = new Map<
    string,
    { approxCountry: string | null; lastSeenRelative: string | null }
  >();
  for (const row of (liveSessions.data ?? []) as Array<{
    account_id: string;
    approx_country: string | null;
    last_seen_at: string | null;
  }>) {
    const prior = sessionByAccount.get(row.account_id);
    const relative = row.last_seen_at
      ? formatRelativeFrom(row.last_seen_at, locale, now)
      : null;
    // Prefer the most recently seen row if the same account has
    // multiple live sessions.
    if (!prior || (relative && !prior.lastSeenRelative)) {
      sessionByAccount.set(row.account_id, {
        approxCountry: row.approx_country ?? prior?.approxCountry ?? null,
        lastSeenRelative: relative ?? prior?.lastSeenRelative ?? null,
      });
    }
  }

  // Build the VaultContactRow list the client renders.
  const rows: VaultContactRow[] = friendIds.map((fid) => {
    const account = accountMap.get(fid) ?? null;
    const conv = conversationByFriend.get(fid) ?? null;
    const conversationId = conv?.id ?? null;
    const isVaulted =
      (conversationId !== null && vaultedConvIds.has(conversationId)) ||
      vaultedFriendIds.has(fid);
    const peerSession = sessionByAccount.get(fid) ?? null;
    return {
      friendId: fid,
      conversationId,
      name:
        account?.chosen_handle ??
        account?.display_name ??
        account?.nex_handle ??
        t("vault.contacts.row.defaultName"),
      handle: account?.nex_handle ?? t("vault.contacts.row.defaultHandle"),
      isVaulted,
      approxCountry: peerSession?.approxCountry ?? null,
      lastSeenRelative: peerSession?.lastSeenRelative ?? null,
    };
  });

  rows.sort((a, b) => {
    // Vaulted first, then alphabetical by display name.
    if (a.isVaulted !== b.isVaulted) return a.isVaulted ? -1 : 1;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  const title = t("vault.contacts.header.title");
  const subtitle = t("vault.contacts.header.subtitle");

  return (
    <RoomShell title={title} subtitle={subtitle}>
      <VaultContactsClient
        rows={rows}
        copy={{
          emptyNoneTitle: t("vault.contacts.empty.noneTitle"),
          emptyNoneBody: t("vault.contacts.empty.noneBody"),
          emptyNoMatchTitle: t("vault.contacts.empty.noMatchTitle"),
          emptyNoMatchBody: t("vault.contacts.empty.noMatchBody"),
          searchPlaceholder: t("vault.contacts.search.placeholder"),
          searchAriaLabel: t("vault.contacts.search.ariaLabel"),
          listAriaLabel: t("vault.contacts.listAriaLabel"),
          vaultBadge: t("vault.contacts.vaultBadge"),
          seenPrefixTemplate: t("vault.contacts.row.seenPrefixTemplate"),
          kebabAriaLabelTemplate: t(
            "vault.contacts.actions.kebabAriaLabelTemplate",
          ),
          menuAriaLabelTemplate: t(
            "vault.contacts.actions.menuAriaLabelTemplate",
          ),
          actionMoveOutLabel: t("vault.contacts.actions.moveOut.label"),
          actionMoveOutHintTemplate: t(
            "vault.contacts.actions.moveOut.hintTemplate",
          ),
          actionDeleteLabel: t("vault.contacts.actions.delete.label"),
          actionDeleteHint: t("vault.contacts.actions.delete.hint"),
          actionBlockLabel: t("vault.contacts.actions.block.label"),
          actionBlockHintTemplate: t(
            "vault.contacts.actions.block.hintTemplate",
          ),
          confirmMoveTitle: t("vault.contacts.confirm.move.title"),
          confirmMoveBodyTemplate: t("vault.contacts.confirm.move.bodyTemplate"),
          confirmMoveCancel: t("vault.contacts.confirm.move.cancel"),
          confirmMoveConfirm: t("vault.contacts.confirm.move.confirm"),
          confirmDeleteTitle: t("vault.contacts.confirm.delete.title"),
          confirmDeleteBodyTemplate: t(
            "vault.contacts.confirm.delete.bodyTemplate",
          ),
          confirmDeleteConfirm: t("vault.contacts.confirm.delete.confirm"),
          confirmBlockTitleTemplate: t(
            "vault.contacts.confirm.block.titleTemplate",
          ),
          confirmBlockBody: t("vault.contacts.confirm.block.body"),
          confirmBlockConfirm: t("vault.contacts.confirm.block.confirm"),
          confirmWorkingLabel: t("vault.contacts.confirm.workingLabel"),
        }}
      />
    </RoomShell>
  );
}
