// src/lib/nex-native/location/outbox.ts
//
// NEX Location Sharing · Phase 1A · device-local encrypted outbox.
// Owner-authorised 2026-11-05.
// -----------------------------------------------------------------------------
// IndexedDB-backed store of encrypted envelopes pending delivery. Lets
// the sender retry when the recipient comes online, with a user-visible
// TTL and a hard retry cap.
//
// What lives here:
//   · Encrypted envelopes (ALREADY ciphertext · addressed to recipient
//     devices · opaque to anyone without the private key).
//   · Bookkeeping metadata · logical_id · timestamps · retry count · status.
//   · Session salt per (self_account_id, conversation_id) for the
//     fuzz grid · see fuzz.ts.
//
// What does NOT live here:
//   · Plaintext coordinates.
//   · Full LocationPayload objects.
//   · Anything that could be read without the recipient device's key.

"use client";

import { openDB, type IDBPDatabase } from "idb";
import type { LocationBroadcastEnvelope } from "./broadcast";

const DB_NAME = "nex-native-location";
const DB_VERSION = 1;
const STORE_OUTBOX = "outbox";
const STORE_SESSIONS = "sessions";

export type OutboxStatus = "pending" | "retrying" | "expired" | "cancelled";

export interface OutboxEntry {
  readonly logical_id: string;
  readonly conversation_id: string;
  readonly peer_account_id: string;
  readonly self_account_id: string;
  readonly envelope: LocationBroadcastEnvelope;
  /** Opaque summary for sender-side UI only · { kind: "exact"|"nearby"|"area" } ·
   *  never transmitted · never contains coordinates. */
  readonly summary: { readonly kind: "exact" | "nearby" | "area" };
  readonly created_at: string;
  readonly expires_at: string;
  readonly retry_count: number;
  readonly last_attempt_at: string | null;
  readonly status: OutboxStatus;
}

export interface SessionSaltRow {
  /** `${selfAccountId}:${conversationId}` */
  readonly key: string;
  readonly salt_b64: string;
  readonly created_at: string;
  readonly last_used_at: string;
  readonly rotates_at: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(instance) {
        if (!instance.objectStoreNames.contains(STORE_OUTBOX)) {
          const s = instance.createObjectStore(STORE_OUTBOX, {
            keyPath: "logical_id",
          });
          s.createIndex("by_peer", "peer_account_id");
          s.createIndex("by_conv", "conversation_id");
          s.createIndex("by_status", "status");
        }
        if (!instance.objectStoreNames.contains(STORE_SESSIONS)) {
          instance.createObjectStore(STORE_SESSIONS, { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export async function putOutboxEntry(entry: OutboxEntry): Promise<void> {
  const d = await db();
  await d.put(STORE_OUTBOX, entry);
}

export async function getOutboxEntry(
  logicalId: string,
): Promise<OutboxEntry | undefined> {
  const d = await db();
  return (await d.get(STORE_OUTBOX, logicalId)) as OutboxEntry | undefined;
}

export async function deleteOutboxEntry(logicalId: string): Promise<void> {
  const d = await db();
  await d.delete(STORE_OUTBOX, logicalId);
}

export async function listOutboxByConversation(
  conversationId: string,
): Promise<OutboxEntry[]> {
  const d = await db();
  const rows = (await d.getAllFromIndex(
    STORE_OUTBOX,
    "by_conv",
    conversationId,
  )) as OutboxEntry[];
  return rows.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export async function listOutboxPending(): Promise<OutboxEntry[]> {
  const d = await db();
  return [
    ...((await d.getAllFromIndex(
      STORE_OUTBOX,
      "by_status",
      "pending",
    )) as OutboxEntry[]),
    ...((await d.getAllFromIndex(
      STORE_OUTBOX,
      "by_status",
      "retrying",
    )) as OutboxEntry[]),
  ];
}

export async function getSessionSalt(
  key: string,
): Promise<SessionSaltRow | undefined> {
  const d = await db();
  return (await d.get(STORE_SESSIONS, key)) as SessionSaltRow | undefined;
}

export async function putSessionSalt(row: SessionSaltRow): Promise<void> {
  const d = await db();
  await d.put(STORE_SESSIONS, row);
}

/** Pure helper · computes the next outbox-entry state after a retry
 *  attempt. Caller writes the returned entry back. Kept pure so tests
 *  can exercise the state machine without IDB. */
export function stepOutboxEntry(
  entry: OutboxEntry,
  args: {
    readonly nowMs: number;
    readonly maxRetries?: number;
  },
): OutboxEntry {
  const maxRetries = args.maxRetries ?? 5;
  const nowIso = new Date(args.nowMs).toISOString();
  const expiresAtMs = new Date(entry.expires_at).getTime();

  if (args.nowMs > expiresAtMs) {
    return { ...entry, status: "expired", last_attempt_at: nowIso };
  }
  if (entry.retry_count + 1 >= maxRetries) {
    return {
      ...entry,
      retry_count: entry.retry_count + 1,
      status: "expired",
      last_attempt_at: nowIso,
    };
  }
  return {
    ...entry,
    retry_count: entry.retry_count + 1,
    status: "retrying",
    last_attempt_at: nowIso,
  };
}

/** TTL options the UI exposes · owner-locked set. */
export const TTL_OPTIONS = {
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
} as const;
export type TtlKey = keyof typeof TTL_OPTIONS;
