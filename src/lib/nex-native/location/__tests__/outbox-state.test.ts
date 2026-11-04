// Phase 1A outbox state machine · unit tests (pure helper only).

import { describe, test, expect } from "vitest";
import { stepOutboxEntry, type OutboxEntry } from "../outbox";

function entry(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  const created = new Date("2026-11-05T12:00:00.000Z").toISOString();
  const expires = new Date("2026-11-05T13:00:00.000Z").toISOString();
  return {
    logical_id: "test",
    conversation_id: "c",
    peer_account_id: "p",
    self_account_id: "s",
    envelope: {
      logical_id: "test",
      sender_account_id: "s",
      sender_device_id: "d",
      sender_public_key_b64: "k",
      recipients: [],
      broadcast_at: created,
    },
    summary: { kind: "exact" },
    created_at: created,
    expires_at: expires,
    retry_count: 0,
    last_attempt_at: null,
    status: "pending",
    ...overrides,
  };
}

describe("stepOutboxEntry", () => {
  test("first attempt moves pending → retrying", () => {
    const e = entry();
    const next = stepOutboxEntry(e, { nowMs: new Date(e.created_at).getTime() + 1_000 });
    expect(next.status).toBe("retrying");
    expect(next.retry_count).toBe(1);
  });
  test("5th attempt moves to expired", () => {
    const e = entry({ retry_count: 4 });
    const next = stepOutboxEntry(e, {
      nowMs: new Date(e.created_at).getTime() + 1_000,
    });
    expect(next.status).toBe("expired");
  });
  test("past-TTL immediately expires", () => {
    const e = entry();
    const beyondTtl = new Date(e.expires_at).getTime() + 60_000;
    const next = stepOutboxEntry(e, { nowMs: beyondTtl });
    expect(next.status).toBe("expired");
  });
});
