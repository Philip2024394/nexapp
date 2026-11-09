// src/lib/nex-native/chat/__tests__/local-history-store.test.ts
//
// Phase 2 Sprint 5 (DRAFT) · tests the IndexedDB chat history store using
// `fake-indexeddb` (already in devDependencies).

import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";

import {
  appendLocalMessage,
  getConversationMessages,
  deleteConversationHistory,
  wipeAllLocalHistory,
  exportAllLocalMessages,
  type LocalMessageRecord,
} from "../local-history-store";

const CONV_A = "conv-a";
const CONV_B = "conv-b";
const DEVICE_1 = "device-1";
const DEVICE_2 = "device-2";

function makeMsg(partial: Partial<LocalMessageRecord> = {}): LocalMessageRecord {
  const base: LocalMessageRecord = {
    id: Math.random().toString(36).slice(2),
    conversation_id: CONV_A,
    sender_device_id: DEVICE_1,
    recipient_device_id: DEVICE_2,
    plaintext: "hello",
    attachment_ids: [],
    received_at: Date.now(),
    sent_at: Date.now(),
  };
  return { ...base, ...partial };
}

beforeEach(async () => {
  await wipeAllLocalHistory();
});

describe("appendLocalMessage", () => {
  it("appends a new message · returns true", async () => {
    const msg = makeMsg();
    const inserted = await appendLocalMessage(msg);
    expect(inserted).toBe(true);
  });

  it("idempotent · second append with same id returns false", async () => {
    const msg = makeMsg({ id: "fixed-id" });
    await appendLocalMessage(msg);
    const second = await appendLocalMessage(msg);
    expect(second).toBe(false);
  });
});

describe("getConversationMessages", () => {
  it("returns messages in ascending time order", async () => {
    await appendLocalMessage(makeMsg({ id: "m1", received_at: 100 }));
    await appendLocalMessage(makeMsg({ id: "m2", received_at: 200 }));
    await appendLocalMessage(makeMsg({ id: "m3", received_at: 150 }));

    const msgs = await getConversationMessages(CONV_A, 10);
    expect(msgs.map((m) => m.id)).toEqual(["m1", "m3", "m2"]);
  });

  it("scopes by conversation_id", async () => {
    await appendLocalMessage(makeMsg({ id: "a1", conversation_id: CONV_A, received_at: 100 }));
    await appendLocalMessage(makeMsg({ id: "b1", conversation_id: CONV_B, received_at: 100 }));
    const msgs = await getConversationMessages(CONV_A);
    expect(msgs.map((m) => m.id)).toEqual(["a1"]);
  });

  it("respects limit", async () => {
    for (let i = 0; i < 20; i++) {
      await appendLocalMessage(makeMsg({ id: `m${i}`, received_at: i }));
    }
    const msgs = await getConversationMessages(CONV_A, 5);
    expect(msgs).toHaveLength(5);
  });

  it("respects beforeReceivedAt pagination boundary", async () => {
    for (let i = 0; i < 10; i++) {
      await appendLocalMessage(makeMsg({ id: `m${i}`, received_at: i * 10 }));
    }
    const msgs = await getConversationMessages(CONV_A, 100, 50);
    // Returns messages with received_at < 50 · m0 through m4
    expect(msgs.map((m) => m.id)).toEqual(["m0", "m1", "m2", "m3", "m4"]);
  });
});

describe("deleteConversationHistory", () => {
  it("returns number deleted · scoped to conversation", async () => {
    await appendLocalMessage(makeMsg({ id: "a1", conversation_id: CONV_A }));
    await appendLocalMessage(makeMsg({ id: "a2", conversation_id: CONV_A }));
    await appendLocalMessage(makeMsg({ id: "b1", conversation_id: CONV_B }));

    const deleted = await deleteConversationHistory(CONV_A);
    expect(deleted).toBe(2);

    const bMessages = await getConversationMessages(CONV_B);
    expect(bMessages).toHaveLength(1);
  });
});

describe("exportAllLocalMessages", () => {
  it("returns all stored messages · no server call", async () => {
    await appendLocalMessage(makeMsg({ id: "a1" }));
    await appendLocalMessage(makeMsg({ id: "a2" }));
    const all = await exportAllLocalMessages();
    expect(all).toHaveLength(2);
    expect(new Set(all.map((m) => m.id))).toEqual(new Set(["a1", "a2"]));
  });
});

describe("wipeAllLocalHistory", () => {
  it("clears the entire store", async () => {
    await appendLocalMessage(makeMsg({ id: "a1", conversation_id: CONV_A }));
    await appendLocalMessage(makeMsg({ id: "b1", conversation_id: CONV_B }));
    await wipeAllLocalHistory();
    expect(await exportAllLocalMessages()).toHaveLength(0);
  });
});
