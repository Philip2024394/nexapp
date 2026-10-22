// src/lib/nex-native/contact-picker-service.ts
//
// Real-data source for the Contact-picker sheet (the slide-up list
// shown from the chat composer). Mirrors the pattern already used
// by /nex-native/contacts/page.tsx: friend-service → account-service
// → account-profile-service. Shape of each row matches what the UI
// ContactPickerSheet consumes so the client can swap mock data for
// server data without changing its rendering code.

import "server-only";
import * as friendService from "./friend-service";
import * as accountService from "./account-service";
import * as accountProfileService from "./account-profile-service";
import type { NexUuid } from "./types";

export type ContactPickerPresence = "online" | "away" | "offline";

/** Row shape consumed by ContactPickerSheet. Kept intentionally close
 *  to the client-side MockContact so swapping the data source does
 *  not force a UI change. Fields the real schema does not expose
 *  yet (presence, hasActiveStatus, unreadCount) carry honest defaults:
 *   - presence   : "offline" until a presence service lands
 *   - unreadCount: 0 until peer-message read-receipts are queried
 *   - hasActiveStatus: false until status-service wiring arrives */
export interface ContactPickerRow {
  readonly id: NexUuid;
  readonly nexHandle: string;
  readonly displayName: string;
  readonly profession: string;
  readonly city: string | null;
  readonly presence: ContactPickerPresence;
  readonly lastSeenMinsAgo: number | null;
  readonly hasShop: boolean;
  readonly shopName: string | null;
  readonly isVerified: boolean;
  readonly hasActiveStatus: boolean;
  readonly unreadCount: number;
  readonly initials: string;
}

/** Compute 1–2 character initials from a display name. Falls back
 *  to "NX" when the input is empty. Mirrors the free-chat mock
 *  convention so avatars read the same whether the row is mock or real. */
function initialsOf(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter((s) => s.length > 0);
  if (parts.length === 0) return "NX";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Return the viewer's connect-able contacts for the picker. Today
 *  that means accepted-friend accounts (nex_friend_edge status =
 *  'accepted'); when nex_presence / unread services land, this is
 *  where they get stitched in. Returns an empty array when the
 *  viewer has no friends yet · callers render an honest empty state. */
export async function listContactPickerRowsForViewer(
  viewerAccountId: NexUuid,
): Promise<ContactPickerRow[]> {
  const friendIds = await friendService.listFriends(viewerAccountId);
  if (friendIds.length === 0) return [];

  const accounts = await Promise.all(
    friendIds.map((id) => accountService.getAccountById(id).catch(() => null)),
  );
  const profiles = await Promise.all(
    friendIds.map((id) =>
      accountProfileService.getProfileByAccountId(id).catch(() => null),
    ),
  );

  const rows: ContactPickerRow[] = [];
  for (let i = 0; i < accounts.length; i++) {
    const a = accounts[i];
    if (!a) continue;
    const p = profiles[i] ?? null;
    const displayName = a.display_name ?? "friend";
    rows.push({
      id: a.id,
      nexHandle: a.nex_handle ?? "nex-?????",
      displayName,
      profession: (p?.profession ?? "").trim() || "NEX member",
      city: null,
      presence: "offline",
      lastSeenMinsAgo: null,
      hasShop: false,
      shopName: null,
      isVerified: false,
      hasActiveStatus: false,
      unreadCount: 0,
      initials: initialsOf(displayName),
    });
  }
  return rows;
}
