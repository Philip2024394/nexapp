// src/app/nex-native/contacts/_mock-accepted-contacts.ts
//
// Owner directive 2026-10-23 · "i just saved 1 contact to business
// but is not showing in the business page contacts" · the mock
// Confirm flow in PendingInvitesSection removes the invite from
// Waiting but the My Contacts list is server-rendered · it has no
// way to see client-side accepts. This module is a client-only
// store of mock-accepted contacts (localStorage-backed) that
// ContactsList merges into its visible rows.
//
// When the real `nex_friend_request.accept` server action lands,
// swap this store for the server-returned contact edge · the
// ContactsList merge logic stays the same shape.

export type MockAcceptedCategory = "friends" | "business";

export interface MockAcceptedContact {
  readonly id: string; // same as the originating invite id (stable key)
  readonly nexId: string;
  readonly displayName: string;
  readonly initials: string;
  readonly profession: string | null;
  readonly city: string | null;
  readonly isVerified: boolean;
  readonly avatarUrl: string | null;
  readonly hasShop: boolean;
  readonly shopHref: string | null;
  readonly category: MockAcceptedCategory;
  /** ISO · when the user confirmed. Used for sorting newest-first. */
  readonly acceptedAt: string;
}

const STORAGE_KEY = "nex-contacts-mock-accepted-v1";
const EVENT_NAME = "nex-contacts-mock-accepted-changed";

export function loadAccepted(): ReadonlyArray<MockAcceptedContact> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is MockAcceptedContact =>
        row &&
        typeof row.id === "string" &&
        typeof row.nexId === "string" &&
        typeof row.displayName === "string" &&
        (row.category === "friends" || row.category === "business"),
    );
  } catch {
    return [];
  }
}

function persistAccepted(list: ReadonlyArray<MockAcceptedContact>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota · ignored */
  }
  // Same-window listeners don't get `storage` events · dispatch a
  // custom event so the ContactsList re-renders without polling.
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function addAccepted(contact: MockAcceptedContact): void {
  const current = loadAccepted();
  // De-dupe by id · overwrite any older entry with the same id.
  const next = [contact, ...current.filter((c) => c.id !== contact.id)];
  persistAccepted(next);
}

export function removeAccepted(id: string): void {
  const current = loadAccepted();
  persistAccepted(current.filter((c) => c.id !== id));
}

export const MOCK_ACCEPTED_EVENT = EVENT_NAME;
