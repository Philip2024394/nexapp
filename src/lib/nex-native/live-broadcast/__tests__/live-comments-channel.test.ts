// src/lib/nex-native/live-broadcast/__tests__/live-comments-channel.test.ts
//
// Phase 2 · Live interaction · comments channel tests.
// Covers the client-side normalisation + payload-validation contract.

import { describe, test, expect, vi, beforeEach } from "vitest";

const { openChannelMock, lastBroadcasts, lastOnBroadcast } = vi.hoisted(() => {
  const broadcasts: Array<{ event: string; payload: unknown }> = [];
  const state: {
    handler: ((event: string, envelope: { sender: string; payload: unknown }) => void) | null;
  } = { handler: null };
  const mock = vi.fn((opts: {
    onBroadcast?: (event: string, envelope: { sender: string; payload: unknown }) => void;
  }) => {
    if (opts.onBroadcast) state.handler = opts.onBroadcast;
    return {
      broadcast: async (event: string, payload: unknown) => {
        broadcasts.push({ event, payload });
      },
      trackPresence: async () => {},
      getPresenceState: () => ({}),
      close: async () => {},
    };
  });
  return {
    openChannelMock: mock,
    lastBroadcasts: broadcasts,
    lastOnBroadcast: state,
  };
});

vi.mock("../../realtime/channel", () => ({
  openNexChannel: openChannelMock,
}));

const SESSION = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SELF = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  openChannelMock.mockClear();
  lastBroadcasts.length = 0;
  lastOnBroadcast.handler = null;
});

describe("openLiveCommentsChannel", () => {
  test("subscribes with the per-session channel name", async () => {
    const { openLiveCommentsChannel } = await import("../live-comments-channel");
    openLiveCommentsChannel({
      sessionId: SESSION,
      role: "viewer",
      selfAccountId: SELF,
    });
    const call = openChannelMock.mock.calls[0]![0] as { name: string; selfId: string };
    expect(call.name).toBe(`nex:live-comments:${SESSION}`);
    expect(call.selfId).toBe(SELF);
  });

  test("post · trims whitespace and caps at 280 chars", async () => {
    const { openLiveCommentsChannel, LIVE_COMMENT_MAX_LENGTH } = await import("../live-comments-channel");
    const h = openLiveCommentsChannel({
      sessionId: SESSION,
      role: "viewer",
      selfAccountId: SELF,
    });
    expect(LIVE_COMMENT_MAX_LENGTH).toBe(280);
    h.post("   hello world   ");
    expect(lastBroadcasts).toHaveLength(1);
    const payload = lastBroadcasts[0]!.payload as { text: string };
    expect(payload.text).toBe("hello world");

    h.post("x".repeat(500));
    const overLong = lastBroadcasts[1]!.payload as { text: string };
    expect(overLong.text.length).toBe(280);
  });

  test("post · empty / whitespace-only is a no-op (no broadcast fires)", async () => {
    const { openLiveCommentsChannel } = await import("../live-comments-channel");
    const h = openLiveCommentsChannel({
      sessionId: SESSION,
      role: "viewer",
      selfAccountId: SELF,
    });
    h.post("");
    h.post("   ");
    h.post("\n\t  \n");
    expect(lastBroadcasts).toHaveLength(0);
  });

  test("onComment · ignores malformed payloads", async () => {
    const { openLiveCommentsChannel } = await import("../live-comments-channel");
    const received: unknown[] = [];
    openLiveCommentsChannel({
      sessionId: SESSION,
      role: "viewer",
      selfAccountId: SELF,
      onComment: (p) => received.push(p),
    });
    const emit = (payload: unknown) => {
      lastOnBroadcast.handler?.("comment", { sender: "x", payload });
    };
    emit(null);
    emit("not-an-object");
    emit({ text: "no author" });
    emit({ authorAccountId: 123, text: "wrong type", clientSentAt: "x" });
    emit({ authorAccountId: "a", text: "x" }); // missing clientSentAt
    expect(received).toHaveLength(0);
  });

  test("onComment · caps text at 280 chars even if a non-NEX client pushes more", async () => {
    const { openLiveCommentsChannel } = await import("../live-comments-channel");
    const received: Array<{ text: string }> = [];
    openLiveCommentsChannel({
      sessionId: SESSION,
      role: "viewer",
      selfAccountId: SELF,
      onComment: (p) => received.push(p),
    });
    lastOnBroadcast.handler?.("comment", {
      sender: "x",
      payload: {
        authorAccountId: "a",
        text: "x".repeat(500),
        clientSentAt: "2026-10-24T22:00:00Z",
      },
    });
    expect(received[0]!.text.length).toBe(280);
  });

  test("onComment · well-formed payload passes through verbatim", async () => {
    const { openLiveCommentsChannel } = await import("../live-comments-channel");
    const received: Array<{ text: string; authorAccountId: string }> = [];
    openLiveCommentsChannel({
      sessionId: SESSION,
      role: "viewer",
      selfAccountId: SELF,
      onComment: (p) => received.push(p),
    });
    lastOnBroadcast.handler?.("comment", {
      sender: "x",
      payload: {
        authorAccountId: "22222222-2222-2222-2222-222222222222",
        text: "hello",
        clientSentAt: "2026-10-24T22:00:00Z",
      },
    });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({
      authorAccountId: "22222222-2222-2222-2222-222222222222",
      text: "hello",
      clientSentAt: "2026-10-24T22:00:00Z",
    });
  });

  // -------------------------------------------------------------------
  // Owner spec 2026-10-24 · reply context on the comments payload.
  // -------------------------------------------------------------------
  test("post · attaches reply context on wire when provided", async () => {
    const { openLiveCommentsChannel } = await import("../live-comments-channel");
    const h = openLiveCommentsChannel({
      sessionId: SESSION,
      role: "viewer",
      selfAccountId: SELF,
    });
    h.post("yes black is available", {
      replyToAuthorAccountId: "33333333-3333-3333-3333-333333333333",
      replyToTextPreview: "Is this available in black?",
    });
    expect(lastBroadcasts).toHaveLength(1);
    const payload = lastBroadcasts[0]!.payload as Record<string, string>;
    expect(payload.replyToAuthorAccountId).toBe(
      "33333333-3333-3333-3333-333333333333",
    );
    expect(payload.replyToTextPreview).toBe("Is this available in black?");
  });

  test("post · reply context without BOTH fields is dropped (both-or-neither)", async () => {
    const { openLiveCommentsChannel } = await import("../live-comments-channel");
    const h = openLiveCommentsChannel({
      sessionId: SESSION,
      role: "viewer",
      selfAccountId: SELF,
    });
    // Partial · missing preview → sent as plain comment.
    h.post("hello", {
      replyToAuthorAccountId: "33333333-3333-3333-3333-333333333333",
      replyToTextPreview: "",
    });
    expect(lastBroadcasts).toHaveLength(1);
    const payload = lastBroadcasts[0]!.payload as Record<string, string | undefined>;
    expect(payload.replyToAuthorAccountId).toBeUndefined();
    expect(payload.replyToTextPreview).toBeUndefined();
  });

  test("post · caps reply preview at 60 chars on the wire", async () => {
    const { openLiveCommentsChannel, LIVE_COMMENT_REPLY_PREVIEW_MAX_LENGTH } =
      await import("../live-comments-channel");
    const h = openLiveCommentsChannel({
      sessionId: SESSION,
      role: "viewer",
      selfAccountId: SELF,
    });
    expect(LIVE_COMMENT_REPLY_PREVIEW_MAX_LENGTH).toBe(60);
    h.post("reply", {
      replyToAuthorAccountId: "a",
      replyToTextPreview: "x".repeat(200),
    });
    const payload = lastBroadcasts[0]!.payload as Record<string, string>;
    expect(payload.replyToTextPreview.length).toBe(60);
  });

  test("onComment · drops malformed reply context but keeps the comment", async () => {
    const { openLiveCommentsChannel } = await import("../live-comments-channel");
    const received: Array<{
      text: string;
      replyToAuthorAccountId?: string;
      replyToTextPreview?: string;
    }> = [];
    openLiveCommentsChannel({
      sessionId: SESSION,
      role: "viewer",
      selfAccountId: SELF,
      onComment: (p) => received.push(p),
    });
    // Reply-author is non-string · the whole reply context is dropped
    // but the plain comment is still delivered.
    lastOnBroadcast.handler?.("comment", {
      sender: "x",
      payload: {
        authorAccountId: "a",
        text: "hi",
        clientSentAt: "2026-10-24T22:00:00Z",
        replyToAuthorAccountId: 42, // wrong type
        replyToTextPreview: "preview",
      },
    });
    expect(received).toHaveLength(1);
    expect(received[0]!.text).toBe("hi");
    expect(received[0]!.replyToAuthorAccountId).toBeUndefined();
    expect(received[0]!.replyToTextPreview).toBeUndefined();
  });

  test("onComment · valid reply context is admitted", async () => {
    const { openLiveCommentsChannel } = await import("../live-comments-channel");
    const received: Array<{
      replyToAuthorAccountId?: string;
      replyToTextPreview?: string;
    }> = [];
    openLiveCommentsChannel({
      sessionId: SESSION,
      role: "viewer",
      selfAccountId: SELF,
      onComment: (p) => received.push(p),
    });
    lastOnBroadcast.handler?.("comment", {
      sender: "x",
      payload: {
        authorAccountId: "a",
        text: "yes black is available",
        clientSentAt: "2026-10-24T22:00:00Z",
        replyToAuthorAccountId: "b",
        replyToTextPreview: "Is this available in black?",
      },
    });
    expect(received[0]!.replyToAuthorAccountId).toBe("b");
    expect(received[0]!.replyToTextPreview).toBe(
      "Is this available in black?",
    );
  });
});
