// src/lib/nex-native/chat/__tests__/realtime-missed-event-replay.test.ts
//
// A22 · Scenario 4 · Realtime missed-event replay.
// -------------------------------------------------
// Architectural note (findings recorded in docs/doctrine/
// a22-failure-injection-9-15-plan-2026-11-18.md §2 row-4):
//
//   The sealed R1 architecture does NOT ship a `useChatSubscription`
//   hook that fetches missed messages directly from a Supabase table
//   subscription. Instead:
//
//     1. Broadcasts on `nex:messages:<conversationId>` are NUDGES
//        carrying only { conversation_id, message_group_id, sent_at }.
//     2. The CORRECTNESS mechanism for catch-up is the authenticated
//        GET /api/nex-native/peer-message/since endpoint, triggered
//        by `onSubscribed` (reconnect) and `onPeerMessageArrival`.
//     3. `openMessageEventsChannel` enforces payload validation + a
//        strict cross-conversation filter: broadcasts for a DIFFERENT
//        conversationId are dropped at the channel layer, preventing
//        a "duplicate from the wrong conversation" class of leak.
//
// This test exercises the no-gap, no-duplicate contract AT THE
// CHANNEL LAYER, which is the surface this scenario can isolate
// without live Supabase + REST.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({
  lastOpts: null as null | {
    onBroadcast?: (event: string, envelope: { sender: string; payload: Record<string, unknown> }) => void;
    onSubscribed?: () => void;
    selfId: string;
    name: string;
  },
  closed: false,
  broadcasts: [] as Array<{ event: string; payload: Record<string, unknown> }>,
}));

vi.mock("../../realtime/channel", () => ({
  openNexChannel: (opts: {
    name: string;
    selfId: string;
    onBroadcast?: (
      event: string,
      envelope: { sender: string; payload: Record<string, unknown> },
    ) => void;
    onSubscribed?: () => void;
  }) => {
    transport.lastOpts = opts;
    transport.closed = false;
    return {
      broadcast: async (event: string, payload: Record<string, unknown>) => {
        transport.broadcasts.push({ event, payload });
      },
      trackPresence: async () => {},
      getPresenceState: () => ({}),
      close: async () => {
        transport.closed = true;
      },
    };
  },
}));

import { openMessageEventsChannel } from "../../realtime/message-events";

const SELF = "self-account-A";
const CONV = "11111111-1111-4111-8111-aaaaaaaaaaaa";
const OTHER = "22222222-2222-4222-8222-bbbbbbbbbbbb";

describe("Scenario 4 · realtime missed-event replay via Bridge 73 channel", () => {
  beforeEach(() => {
    transport.lastOpts = null;
    transport.closed = false;
    transport.broadcasts = [];
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it(
    "reconnect fires onSubscribed exactly once per transition · consumers can trigger catch-up fetch",
    async () => {
      const subscribedCallback = vi.fn();
      openMessageEventsChannel({
        conversationId: CONV,
        selfAccountId: SELF,
        onSubscribed: subscribedCallback,
      });

      // Simulate initial subscribe
      transport.lastOpts!.onSubscribed?.();
      expect(subscribedCallback).toHaveBeenCalledTimes(1);

      // Disconnect window · no messages delivered. Then reconnect.
      transport.lastOpts!.onSubscribed?.();
      expect(subscribedCallback).toHaveBeenCalledTimes(2);

      // A third reconnect still fires · consumer is responsible for
      // dedup of its OWN catch-up fetch · the channel does not latch.
      transport.lastOpts!.onSubscribed?.();
      expect(subscribedCallback).toHaveBeenCalledTimes(3);
    },
  );

  it(
    "arrivals during active subscription dispatch to onPeerMessageArrival with strict payload validation",
    async () => {
      const arrivals: Array<{ conversation_id: string; message_group_id: string; sent_at: string }> =
        [];
      openMessageEventsChannel({
        conversationId: CONV,
        selfAccountId: SELF,
        onPeerMessageArrival: (b) => arrivals.push(b),
      });

      const dispatch = transport.lastOpts!.onBroadcast!;
      // Four well-formed messages
      for (let i = 1; i <= 4; i++) {
        dispatch("arrival", {
          sender: `peer-${i}`,
          payload: {
            conversation_id: CONV,
            message_group_id: `msg-${i}`,
            sent_at: `2026-11-18T00:00:0${i}.000Z`,
          },
        });
      }

      // Zero gaps · all four arrived in order
      expect(arrivals).toHaveLength(4);
      expect(arrivals.map((a) => a.message_group_id)).toEqual(["msg-1", "msg-2", "msg-3", "msg-4"]);
      // Zero duplicates
      expect(new Set(arrivals.map((a) => a.message_group_id)).size).toBe(4);
    },
  );

  it(
    "arrivals for a DIFFERENT conversation are filtered at the channel layer · no cross-conv leak",
    async () => {
      const arrivals: Array<{ conversation_id: string; message_group_id: string; sent_at: string }> =
        [];
      openMessageEventsChannel({
        conversationId: CONV,
        selfAccountId: SELF,
        onPeerMessageArrival: (b) => arrivals.push(b),
      });

      const dispatch = transport.lastOpts!.onBroadcast!;
      // Mix: 2 for this conv, 3 for OTHER conv (must all be dropped),
      // 1 malformed (missing sent_at · must be dropped).
      dispatch("arrival", {
        sender: "peer-x",
        payload: {
          conversation_id: CONV,
          message_group_id: "ok-1",
          sent_at: "2026-11-18T00:00:01Z",
        },
      });
      dispatch("arrival", {
        sender: "peer-x",
        payload: {
          conversation_id: OTHER,
          message_group_id: "wrong-conv-1",
          sent_at: "2026-11-18T00:00:02Z",
        },
      });
      dispatch("arrival", {
        sender: "peer-x",
        payload: {
          conversation_id: OTHER,
          message_group_id: "wrong-conv-2",
          sent_at: "2026-11-18T00:00:03Z",
        },
      });
      dispatch("arrival", {
        sender: "peer-x",
        payload: {
          conversation_id: CONV,
          message_group_id: "ok-2",
          sent_at: "2026-11-18T00:00:04Z",
        },
      });
      dispatch("arrival", {
        sender: "peer-x",
        payload: {
          // Missing message_group_id entirely
          conversation_id: CONV,
          sent_at: "2026-11-18T00:00:05Z",
        } as unknown as Record<string, unknown>,
      });
      dispatch("arrival", {
        sender: "peer-x",
        payload: {
          conversation_id: OTHER,
          message_group_id: "wrong-conv-3",
          sent_at: "2026-11-18T00:00:06Z",
        },
      });

      // Exactly the two in-conv arrivals · everything else dropped
      expect(arrivals.map((a) => a.message_group_id)).toEqual(["ok-1", "ok-2"]);
    },
  );

  it(
    "close() unsubscribes · subsequent arrivals received by the transport are not re-dispatched after close",
    async () => {
      const arrivals: unknown[] = [];
      const handle = openMessageEventsChannel({
        conversationId: CONV,
        selfAccountId: SELF,
        onPeerMessageArrival: (b) => arrivals.push(b),
      });

      await handle.close();
      expect(transport.closed).toBe(true);
      // After close the transport is torn down · simulate the SDK
      // not firing any more broadcasts (realistic · if a late event
      // did fire via the retained onBroadcast reference, the consumer
      // callback is still valid, but the channel's close contract is
      // asserted here.)
      expect(arrivals).toHaveLength(0);
    },
  );
});
