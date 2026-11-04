// Slice 1 · message-list · day grouping + time formatter.

import { describe, test, expect } from "vitest";
import {
  deriveTickState,
  formatBubbleTime,
  groupByLocalDay,
} from "../_message-list-client";
import type { NexPeerMessageRow } from "@/lib/nex-native/peer-message-service";

function row(
  overrides: Partial<NexPeerMessageRow> & { sent_at: string },
): NexPeerMessageRow {
  return {
    id: "id",
    conversation_id: "c",
    sender_account_id: "s",
    body: "hi",
    read_at: null,
    reply_to_id: null,
    deleted_for_everyone: false,
    deleted_at: null,
    attachment_url: null,
    attachment_type: null,
    attachment_meta: null,
    reactions: {},
    reactions_order: [],
    ...overrides,
  } as NexPeerMessageRow;
}

describe("groupByLocalDay", () => {
  const now = new Date("2026-11-05T12:00:00Z").getTime();

  test("empty list → zero groups", () => {
    expect(groupByLocalDay([], now)).toEqual([]);
  });

  test("groups today / yesterday / earlier · labels + order preserved", () => {
    const today = row({ id: "a", sent_at: "2026-11-05T09:00:00Z" });
    const yesterday = row({ id: "b", sent_at: "2026-11-04T09:00:00Z" });
    const earlier = row({ id: "c", sent_at: "2026-10-30T09:00:00Z" });
    const groups = groupByLocalDay([earlier, yesterday, today], now);
    expect(groups.length).toBe(3);
    const labels = groups.map((g) => g.label);
    // Order preserved · earliest first because we iterate input in order.
    expect(labels).toContain("Today");
    expect(labels).toContain("Yesterday");
  });

  test("same-day rows stay in one bucket", () => {
    const a = row({ id: "a", sent_at: "2026-11-05T08:00:00Z" });
    const b = row({ id: "b", sent_at: "2026-11-05T09:00:00Z" });
    const groups = groupByLocalDay([a, b], now);
    expect(groups.length).toBe(1);
    expect(groups[0]!.rows.length).toBe(2);
  });

  test("invalid sent_at lands in 'Earlier' bucket (never silently dropped)", () => {
    const bad = row({ id: "x", sent_at: "not a date" });
    const groups = groupByLocalDay([bad], now);
    expect(groups.length).toBe(1);
    expect(groups[0]!.label).toBe("Earlier");
    expect(groups[0]!.rows[0]!.id).toBe("x");
  });
});

describe("deriveTickState", () => {
  test("neither delivered_at nor read_at → sent", () => {
    expect(deriveTickState({ read_at: null, delivered_at: null })).toBe("sent");
  });
  test("delivered_at set, read_at null → delivered", () => {
    expect(
      deriveTickState({ read_at: null, delivered_at: "2026-11-05T09:00Z" }),
    ).toBe("delivered");
  });
  test("read_at set → read (wins over delivered)", () => {
    expect(
      deriveTickState({
        read_at: "2026-11-05T09:10Z",
        delivered_at: "2026-11-05T09:00Z",
      }),
    ).toBe("read");
  });
  test("delivered_at undefined (plaintext row) → sent/read based on read_at only", () => {
    expect(deriveTickState({ read_at: null })).toBe("sent");
    expect(deriveTickState({ read_at: "2026-11-05T09:10Z" })).toBe("read");
  });
});

describe("formatBubbleTime", () => {
  test("HH:mm 24h", () => {
    // Timezone-dependent · just assert shape is HH:mm.
    const s = formatBubbleTime("2026-11-05T09:30:00Z");
    expect(s).toMatch(/^[0-2]\d:\d{2}$/);
  });
  test("invalid returns empty string", () => {
    expect(formatBubbleTime("garbage")).toBe("");
  });
});
