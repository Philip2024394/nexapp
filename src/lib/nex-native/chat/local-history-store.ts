// src/lib/nex-native/chat/local-history-store.ts
//
// Phase 2 Sprint 5 (DRAFT · not applied) · device-local IndexedDB
// abstraction for chat history.
//
// Sealed-invariant context:
//   · I-1 · This module stores MESSAGE CONTENT on the user's device
//     only. NEX servers see nothing from here. The history NEVER
//     ships to any NEX endpoint.
//   · I-6 · Lost device = lost history. NEX cannot recover. The user's
//     own export is the only backup (Sprint 9).
//
// Schema (`nex-chat` database · bumped on migration):
//   messages:  keyPath "id" · indexes by
//     [conversation_id, received_at]  (default list order)
//     [conversation_id, sender_device_id, received_at] (dedup helper)
//
// Uses the `idb` package (already in dependencies).

"use client";

import { openDB, type IDBPDatabase, type DBSchema } from "idb";

export interface LocalMessageRecord {
  /** Server-side message envelope ID · stable across re-deliveries. */
  id: string;
  conversation_id: string;
  sender_device_id: string;
  recipient_device_id: string;
  /** Decrypted plaintext body (device-local only). */
  plaintext: string;
  /** Opaque attachment handles · see Sprint 6. */
  attachment_ids: string[];
  /** When received locally · NOT when sent by the peer. */
  received_at: number;
  /** Epoch ms from the signed message header · for display. */
  sent_at: number;
}

interface NexChatSchema extends DBSchema {
  messages: {
    key: string;
    value: LocalMessageRecord;
    indexes: {
      "by-conversation-received": [string, number];
      "by-dedup": [string, string, number];
    };
  };
}

const DB_NAME = "nex-chat";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<NexChatSchema>> | null = null;

export async function getLocalHistoryDb(): Promise<IDBPDatabase<NexChatSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<NexChatSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore("messages", { keyPath: "id" });
        store.createIndex("by-conversation-received", [
          "conversation_id",
          "received_at",
        ]);
        store.createIndex("by-dedup", [
          "conversation_id",
          "sender_device_id",
          "received_at",
        ]);
      },
    });
  }
  return dbPromise;
}

/**
 * Append a message to local history. Idempotent on `id`.
 * Returns true if inserted · false if a row with the same id already
 * existed (no-op · sealed append-only semantics preserved).
 */
export async function appendLocalMessage(record: LocalMessageRecord): Promise<boolean> {
  const db = await getLocalHistoryDb();
  const existing = await db.get("messages", record.id);
  if (existing) return false;
  await db.put("messages", record);
  return true;
}

export async function getConversationMessages(
  conversationId: string,
  limit = 100,
  beforeReceivedAt?: number,
): Promise<LocalMessageRecord[]> {
  const db = await getLocalHistoryDb();
  const range = beforeReceivedAt !== undefined
    ? IDBKeyRange.bound(
        [conversationId, 0],
        [conversationId, beforeReceivedAt],
        false,
        true,
      )
    : IDBKeyRange.bound(
        [conversationId, 0],
        [conversationId, Number.POSITIVE_INFINITY],
      );
  const tx = db.transaction("messages");
  const index = tx.store.index("by-conversation-received");
  const out: LocalMessageRecord[] = [];
  let cursor = await index.openCursor(range, "prev");
  while (cursor && out.length < limit) {
    out.push(cursor.value);
    cursor = await cursor.continue();
  }
  await tx.done;
  return out.reverse();
}

/**
 * Delete a conversation's history from the device. One-way · cannot be
 * recovered server-side.
 */
export async function deleteConversationHistory(conversationId: string): Promise<number> {
  const db = await getLocalHistoryDb();
  const tx = db.transaction("messages", "readwrite");
  const index = tx.store.index("by-conversation-received");
  const range = IDBKeyRange.bound(
    [conversationId, 0],
    [conversationId, Number.POSITIVE_INFINITY],
  );
  let cursor = await index.openCursor(range);
  let count = 0;
  while (cursor) {
    await cursor.delete();
    count += 1;
    cursor = await cursor.continue();
  }
  await tx.done;
  return count;
}

/** Full-device wipe · invoked by account-delete or user "forget-all" action. */
export async function wipeAllLocalHistory(): Promise<void> {
  const db = await getLocalHistoryDb();
  await db.clear("messages");
}

/** Export all local messages · used by Sprint 9 export feature. */
export async function exportAllLocalMessages(): Promise<LocalMessageRecord[]> {
  const db = await getLocalHistoryDb();
  return db.getAll("messages");
}
