// src/app/nex-native/call/g/[sessionId]/__tests__/connection-quality.test.ts
//
// NEX Group Call · Phase 2 wiring tests · owner-authorised 2026-10-19.
// Review follow-up 2026-10-19 · honest packetsReceived · first-sample
// baseline · null-packetsReceived skip (owner-flagged edge cases).
// -----------------------------------------------------------------------------
// Covers the honest-mapping invariants:
//   · null when snapshots empty (ConnectionFooter → "Measuring…")
//   · null when all peers connecting / new (no stats to classify)
//   · null when stats arrive but RTT + loss-rate are both unavailable
//   · reconnecting when any peer disconnected AND no peer connected
//   · DELTA (not cumulative) packet-loss computation across polls
//   · HONEST loss rate from real packetsReceived (NOT the retired
//     bytesReceivedDelta/1200 approximation)
//   · First-sample baseline · no loss contribution from a single poll
//   · Null packetsReceived · loss factor SKIPPED, RTT alone drives label
//   · good / fair / poor transitions at the sealed thresholds
//   · failed / closed end-of-life does NOT emit infinite reconnecting
//
// Tests target the pure `deriveQuality` export · no React tree, no
// real RTCPeerConnection, no setInterval.

import { describe, it, expect } from "vitest";
import {
  deriveQuality,
  QUALITY_THRESHOLDS,
  type PreviousSnapshotCache,
  type QualitySnapshot,
} from "../_use-connection-quality";

/** Builder · minimal QualitySnapshot stub · all fields explicit so
 *  each test case is readable without a mental model of the engine. */
function snap(overrides: Partial<QualitySnapshot>): QualitySnapshot {
  return {
    callId: "test-session",
    identity: "self",
    peer: "peer-1",
    role: "caller",
    path: "p2p",
    connectionState: "connected",
    iceLocalType: "host",
    iceRemoteType: "host",
    bytesSent: 0,
    bytesReceived: 0,
    packetsLost: 0,
    packetsReceived: 0,
    jitterMs: null,
    roundTripMs: null,
    networkType: null,
    audioCodec: null,
    videoCodec: null,
    videoResolution: null,
    timestampMs: 1_700_000_000_000,
    ...overrides,
  };
}

describe("deriveQuality · pure mapper", () => {
  it("returns null when no snapshots (no peers yet)", () => {
    const { quality } = deriveQuality([], new Map());
    expect(quality).toBeNull();
  });

  it("returns null when every peer is in 'new' or 'connecting' state", () => {
    const snapshots = [
      snap({ peer: "p1", connectionState: "new" }),
      snap({ peer: "p2", connectionState: "connecting" }),
    ];
    const { quality } = deriveQuality(snapshots, new Map());
    expect(quality).toBeNull();
  });

  it("returns null when a connected peer has no RTT and no loss rate", () => {
    const snapshots = [
      snap({
        peer: "p1",
        connectionState: "connected",
        roundTripMs: null,
        packetsLost: 0,
        packetsReceived: null,
      }),
    ];
    const { quality } = deriveQuality(snapshots, new Map());
    expect(quality).toBeNull();
  });

  it("returns 'reconnecting' when a peer is disconnected AND no peer is connected", () => {
    const snapshots = [snap({ peer: "p1", connectionState: "disconnected" })];
    const { quality } = deriveQuality(snapshots, new Map());
    expect(quality).toBe("reconnecting");
  });

  it("does NOT emit 'reconnecting' for failed or closed peers (end-of-life)", () => {
    const snapshots = [
      snap({ peer: "p1", connectionState: "failed" }),
      snap({ peer: "p2", connectionState: "closed" }),
    ];
    const { quality } = deriveQuality(snapshots, new Map());
    expect(quality).toBeNull();
  });

  it("maps RTT below fair threshold + no loss delta → 'good'", () => {
    // Second-sample scenario: baseline + current, zero loss delta.
    const baseline = snap({
      peer: "p1",
      connectionState: "connected",
      packetsLost: 0,
      packetsReceived: 1000,
    });
    const r1 = deriveQuality([baseline], new Map());
    const current = snap({
      peer: "p1",
      connectionState: "connected",
      roundTripMs: QUALITY_THRESHOLDS.rttFairMs - 1,
      packetsLost: 0,
      packetsReceived: 1500,
    });
    const r2 = deriveQuality([current], r1.nextPrevious);
    expect(r2.quality).toBe("good");
  });

  it("maps RTT above fair + below poor → 'fair'", () => {
    const snapshots = [
      snap({
        peer: "p1",
        connectionState: "connected",
        roundTripMs: QUALITY_THRESHOLDS.rttFairMs + 50,
      }),
    ];
    const { quality } = deriveQuality(snapshots, new Map());
    expect(quality).toBe("fair");
  });

  it("maps RTT above poor threshold → 'poor'", () => {
    const snapshots = [
      snap({
        peer: "p1",
        connectionState: "connected",
        roundTripMs: QUALITY_THRESHOLDS.rttPoorMs + 100,
      }),
    ];
    const { quality } = deriveQuality(snapshots, new Map());
    expect(quality).toBe("poor");
  });

  // ─── Owner-review follow-up 2026-10-19 · honest packet-loss rate
  // from REAL packetsReceived (not the retired bytesReceivedDelta
  // approximation).

  it("computes HONEST loss rate from real packetsReceived delta · 10% loss → 'poor'", () => {
    // Baseline: peer at packetsLost=10, packetsReceived=1000.
    const baseline = snap({
      peer: "p1",
      connectionState: "connected",
      packetsLost: 10,
      packetsReceived: 1000,
    });
    const r1 = deriveQuality([baseline], new Map());
    // Current: packetsLost advanced by 20, packetsReceived advanced
    // by 180. Loss rate = 20 / (20+180) = 10% → above poor threshold.
    const current = snap({
      peer: "p1",
      connectionState: "connected",
      roundTripMs: 100, // excellent RTT · loss alone drives label
      packetsLost: 30,
      packetsReceived: 1180,
    });
    const r2 = deriveQuality([current], r1.nextPrevious);
    expect(r2.quality).toBe("poor");
  });

  it("3% loss delta → 'fair' (not 'poor')", () => {
    const baseline = snap({
      peer: "p1",
      connectionState: "connected",
      packetsLost: 0,
      packetsReceived: 1000,
    });
    const r1 = deriveQuality([baseline], new Map());
    // Delta: 3 lost, 97 received → 3 / 100 = 3% → fair range.
    const current = snap({
      peer: "p1",
      connectionState: "connected",
      roundTripMs: 100,
      packetsLost: 3,
      packetsReceived: 1097,
    });
    const r2 = deriveQuality([current], r1.nextPrevious);
    expect(r2.quality).toBe("fair");
  });

  // ─── Owner-flagged concern #2 · first-sample baseline handling.

  it("first sample · NEVER emits 'poor' from loss (no baseline yet)", () => {
    // Owner concern: "cumulative packet-loss counters need a valid
    // baseline before interval loss can be calculated". Even if the
    // peer reports huge cumulative packetsLost, the FIRST poll must
    // not treat that as recent loss · it establishes the baseline.
    const snapshots = [
      snap({
        peer: "p1",
        connectionState: "connected",
        roundTripMs: 100, // good RTT
        packetsLost: 10_000, // huge cumulative pre-existing loss
        packetsReceived: 50_000,
      }),
    ];
    const { quality, nextPrevious } = deriveQuality(snapshots, new Map());
    // Honest · no delta baseline · label is based on RTT alone → 'good'.
    expect(quality).toBe("good");
    // Baseline is now in the cache for the next poll.
    const cached = nextPrevious.get("p1");
    expect(cached?.packetsLost).toBe(10_000);
    expect(cached?.packetsReceived).toBe(50_000);
  });

  // ─── Owner-flagged concern #1 · null packetsReceived skip.

  it("null packetsReceived · loss factor SKIPPED · RTT alone drives label", () => {
    // Current browser returns no inbound-rtp.packetsReceived (unusual
    // but possible in some codec paths). Must not fabricate a rate.
    const baseline = snap({
      peer: "p1",
      connectionState: "connected",
      packetsLost: 10,
      packetsReceived: null, // not reported by this peer
    });
    const r1 = deriveQuality([baseline], new Map());
    const current = snap({
      peer: "p1",
      connectionState: "connected",
      roundTripMs: QUALITY_THRESHOLDS.rttFairMs + 50, // 'fair' territory
      packetsLost: 500, // appears to jump but we can't honestly compute rate
      packetsReceived: null,
    });
    const r2 = deriveQuality([current], r1.nextPrevious);
    // Loss factor skipped · RTT alone → 'fair' (not falsely 'poor').
    expect(r2.quality).toBe("fair");
  });

  it("skips loss factor when EITHER baseline OR current packetsReceived is null", () => {
    // Baseline has it, current loses it (e.g., stats pipeline hiccup).
    const baseline = snap({
      peer: "p1",
      connectionState: "connected",
      packetsLost: 0,
      packetsReceived: 1000,
    });
    const r1 = deriveQuality([baseline], new Map());
    const current = snap({
      peer: "p1",
      connectionState: "connected",
      roundTripMs: 100, // good RTT
      packetsLost: 500, // large bump but we have no packetsReceived in current
      packetsReceived: null,
    });
    const r2 = deriveQuality([current], r1.nextPrevious);
    // Loss skipped · RTT good → 'good'. We don't invent a 100% loss
    // just because the counter went up without a denominator.
    expect(r2.quality).toBe("good");
  });

  it("zero received-packets in interval · loss factor skipped (don't divide by zero)", () => {
    const baseline = snap({
      peer: "p1",
      connectionState: "connected",
      packetsLost: 0,
      packetsReceived: 1000,
    });
    const r1 = deriveQuality([baseline], new Map());
    // No packets received AND no new loss in the interval (quiet)
    // · loss factor skipped. RTT drives label.
    const current = snap({
      peer: "p1",
      connectionState: "connected",
      roundTripMs: 100,
      packetsLost: 0,
      packetsReceived: 1000,
    });
    const r2 = deriveQuality([current], r1.nextPrevious);
    expect(r2.quality).toBe("good");
  });

  it("prunes previous-snapshot cache to only the peers in the current poll", () => {
    const seedPrev = new Map<string, PreviousSnapshotCache>([
      [
        "removed-peer",
        {
          packetsLost: 10,
          packetsReceived: 1000,
          timestampMs: 0,
        },
      ],
    ]);
    const snapshots = [
      snap({
        peer: "p1",
        connectionState: "connected",
        roundTripMs: 100,
      }),
    ];
    const { nextPrevious } = deriveQuality(snapshots, seedPrev);
    expect(nextPrevious.has("removed-peer")).toBe(false);
    expect(nextPrevious.has("p1")).toBe(true);
  });

  it("worst-RTT across peers drives the quality label (not average)", () => {
    const snapshots = [
      snap({
        peer: "good-peer",
        connectionState: "connected",
        roundTripMs: 50,
      }),
      snap({
        peer: "bad-peer",
        connectionState: "connected",
        roundTripMs: QUALITY_THRESHOLDS.rttPoorMs + 100,
      }),
    ];
    const { quality } = deriveQuality(snapshots, new Map());
    expect(quality).toBe("poor");
  });
});
