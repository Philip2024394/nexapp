// src/app/nex-native/call/g/[sessionId]/_use-connection-quality.ts
//
// NEX Group Call · connection-quality polling hook + pure mapper.
// Owner-authorised Phase 2 wiring 2026-10-19.
// -----------------------------------------------------------------------------
// Reads real WebRTC statistics from the sealed `collectStats` module
// (byte-identical from D:/trades) and classifies them into the sealed
// Phase 1 `CallsConnectionQuality` type for the master `ConnectionFooter`.
//
// Owner-authorisation constraints honoured:
//   · Pure additive · zero changes to signalling / SDP / media capture
//   · Interval-DELTA packetsLost (NOT cumulative total · WebRTC's
//     packetsLost is a monotonically-increasing counter)
//   · Honest `null` when stats unavailable, no peers, or still
//     connecting · the ConnectionFooter renders "Measuring…"
//   · Distinguishes connectionState: "connecting"/"new" → null (not
//     yet live), "disconnected" → "reconnecting" (ICE may recover),
//     "failed"/"closed" → null (end-of-life, not an infinite spinner)
//   · Clean teardown on unmount via useEffect return
//   · Stale-update guard via a mounted-ref so a late poll from a
//     disposed call never updates React state
//
// Thresholds are INITIAL PRODUCT DEFAULTS · industry-common for mobile
// video (Zoom / Meet / Teams use similar ranges). Not a universal
// guarantee of call quality · owner may tune via the exported
// `QUALITY_THRESHOLDS` constant below.

"use client";

import * as React from "react";
import {
  collectStats,
  type CallStats,
} from "@/lib/nex-calling/measurement";
import type { CallsConnectionQuality } from "@/lib/nex-native/calls-chrome/types";

/** Documented initial-default thresholds · derivation is honest ·
 *  owner may tune without touching the mapping logic. */
export const QUALITY_THRESHOLDS = {
  /** RTT above this (ms) · classified as poor. */
  rttPoorMs: 500,
  /** RTT above this (ms) · classified as fair. */
  rttFairMs: 200,
  /** DELTA packet-loss rate per interval · above this (fraction) · poor. */
  lossPoorRate: 0.05, // 5%
  /** DELTA packet-loss rate per interval · above this (fraction) · fair. */
  lossFairRate: 0.02, // 2%
  /** Polling interval (ms) · 3s per owner authorisation. */
  pollIntervalMs: 3000,
} as const;

/** Owner-review follow-up 2026-10-19 · we no longer approximate
 *  packets-expected from bytesReceivedDelta / 1200 (RTP packet
 *  sizes vary · that approximation was unreliable · owner-flagged).
 *  We now read `packetsReceived` directly from pc.getStats() via
 *  the helper below. The sealed measurement.ts module stays byte-
 *  identical · we just do a parallel light-weight stats read in the
 *  hook.
 *
 *  Returns null when the stats report carries no inbound-rtp entry
 *  with a `packetsReceived` field · caller handles null honestly
 *  (skips the loss factor for that peer in that interval · does
 *  NOT fabricate a loss rate).
 */
export async function collectReceivedPackets(
  pc: RTCPeerConnection,
): Promise<number | null> {
  try {
    const stats = await pc.getStats();
    let total: number | null = null;
    stats.forEach((r) => {
      const rr = r as Record<string, unknown>;
      if (r.type === "inbound-rtp" && typeof rr.packetsReceived === "number") {
        total = (total ?? 0) + (rr.packetsReceived as number);
      }
    });
    return total;
  } catch {
    return null;
  }
}

/** Previous-snapshot cache · keyed by peer id · drives the DELTA
 *  calculation. Stored as a Map so stale peer ids can be pruned when
 *  peers drop out of the call. Owner-review follow-up 2026-10-19 ·
 *  `packetsReceived` is now the HONEST baseline for loss-rate
 *  derivation (replaces the retired bytesReceivedDelta/1200
 *  approximation). */
export interface PreviousSnapshotCache {
  readonly packetsLost: number;
  readonly packetsReceived: number | null;
  readonly timestampMs: number;
}

/** Snapshot input to `deriveQuality` · a `CallStats` from the sealed
 *  module plus `packetsReceived` read in parallel by the hook via
 *  `collectReceivedPackets()`. Null `packetsReceived` means the
 *  inbound-rtp stat for that peer didn't expose the field in this
 *  poll · mapper handles that honestly (skips the loss factor,
 *  doesn't fabricate a rate). */
export interface QualitySnapshot extends CallStats {
  readonly packetsReceived: number | null;
}

/** Pure mapper · derives a `CallsConnectionQuality` from an array of
 *  per-peer snapshots PLUS the previous snapshot cache. Exported so
 *  the unit tests can exercise it directly without a live React
 *  tree or a real RTCPeerConnection.
 *
 *  Returns null when:
 *    · the snapshot array is empty (no peers yet),
 *    · every peer is in "new" / "connecting" / "failed" / "closed"
 *      state (nothing live to measure),
 *    · OR all required fields (RTT and loss rate) are unavailable
 *      across every live peer (stats pipeline not yet producing).
 *
 *  Honest loss-rate derivation:
 *    · DELTA packetsLost + DELTA packetsReceived per interval,
 *    · rate = packetsLostDelta / (packetsLostDelta + packetsReceivedDelta),
 *    · first-sample has no baseline · we track its totals but do
 *      NOT contribute to the loss rate (owner-sealed invariant),
 *    · a peer where packetsReceived is null in either the current
 *      or previous snapshot has its loss factor SKIPPED for that
 *      interval · we never divide by a fabricated denominator.
 */
export function deriveQuality(
  snapshots: ReadonlyArray<QualitySnapshot>,
  previous: ReadonlyMap<string, PreviousSnapshotCache>,
): {
  readonly quality: CallsConnectionQuality | null;
  readonly nextPrevious: ReadonlyMap<string, PreviousSnapshotCache>;
} {
  const nextPrevious = new Map<string, PreviousSnapshotCache>();
  if (snapshots.length === 0) {
    return { quality: null, nextPrevious };
  }

  // Does any peer report an in-flight connecting / recovering state?
  // Mapping is honest · "connecting" and "new" collapse to null
  // (initial setup · ConnectionFooter shows "Measuring…"),
  // "disconnected" collapses to "reconnecting" (ICE may recover),
  // "failed" and "closed" are end-of-life · we DO NOT emit
  // "reconnecting" indefinitely for a dead connection, we fall
  // through to null.
  let anyLive = false;
  let anyDisconnected = false;
  let worstRtt: number | null = null;
  let totalLostDelta = 0;
  let totalReceivedDelta = 0;
  let anyHasRtt = false;
  let anyHasLossRate = false;

  for (const s of snapshots) {
    const prev = previous.get(s.peer) ?? null;
    // Record this snapshot's totals for the next-poll baseline ·
    // ALWAYS, even for non-connected peers, so when a peer finishes
    // connecting we have a sane baseline.
    nextPrevious.set(s.peer, {
      packetsLost: s.packetsLost,
      packetsReceived: s.packetsReceived,
      timestampMs: s.timestampMs,
    });

    if (
      s.connectionState === "closed" ||
      s.connectionState === "failed"
    ) {
      // End-of-life peer · do not count toward anyLive · do not count
      // toward anyDisconnected (we never emit "reconnecting" for
      // these per owner-authorisation constraint 4).
      continue;
    }
    if (s.connectionState === "disconnected") {
      anyDisconnected = true;
      continue;
    }
    if (
      s.connectionState === "new" ||
      s.connectionState === "connecting"
    ) {
      // Pre-live · no stats to classify from yet.
      continue;
    }
    // connectionState === "connected" from here on.
    anyLive = true;
    if (s.roundTripMs !== null) {
      anyHasRtt = true;
      if (worstRtt === null || s.roundTripMs > worstRtt) {
        worstRtt = s.roundTripMs;
      }
    }

    // Honest loss-rate derivation · requires:
    //   · a previous snapshot to establish a DELTA baseline,
    //   · packetsReceived populated in BOTH current and previous
    //     snapshots (otherwise we skip the factor for this peer).
    // The first-sample case naturally produces NO loss contribution
    // because `prev === null`; the second sample onward contributes.
    if (
      prev !== null &&
      prev.packetsReceived !== null &&
      s.packetsReceived !== null
    ) {
      const lostDelta = Math.max(0, s.packetsLost - prev.packetsLost);
      const receivedDelta = Math.max(
        0,
        s.packetsReceived - prev.packetsReceived,
      );
      // Only count when SOME packets flowed in the interval · zero
      // received across an interval means the stats pipeline paused
      // (or the peer stopped sending) · dividing by zero or
      // reporting 100% loss would both be wrong.
      if (lostDelta + receivedDelta > 0) {
        anyHasLossRate = true;
        totalLostDelta += lostDelta;
        totalReceivedDelta += receivedDelta;
      }
    }
  }

  // Honest reconnecting state · only when at least one peer is
  // actively disconnected AND no peer is fully connected yet
  // (otherwise we'd be hiding a working call behind one bad leg).
  if (!anyLive && anyDisconnected) {
    return { quality: "reconnecting", nextPrevious };
  }

  // No live peer AND no disconnected peer → quiet state · null.
  if (!anyLive) {
    return { quality: null, nextPrevious };
  }

  // We have at least one connected peer · but if we have NEITHER
  // RTT NOR a derivable loss rate, we can't label quality honestly.
  // Owner-review follow-up 2026-10-19 · null → ConnectionFooter
  // shows "Measuring…" per the sealed invariant.
  if (!anyHasRtt && !anyHasLossRate) {
    return { quality: null, nextPrevious };
  }

  // Semantic honesty note (owner review 2026-10-19) · when we reach
  // this point on the FIRST sample for every peer, `anyHasLossRate`
  // is false (no DELTA baseline exists yet · we never derive loss
  // from a single poll) and classification is RTT-only. A resulting
  // "good" label means "RTT meets the good threshold at this
  // moment" · it does NOT claim loss has been assessed. The sealed
  // Phase 1 ConnectionFooter contract (`quality: good|fair|poor|
  // reconnecting | null`) carries no "provisional" flag · adding
  // one is out of scope for this slice. On the next poll (3s later),
  // if `packetsReceived` is available, the loss factor contributes
  // and the label may re-classify (e.g., "good" → "poor" if we
  // discover heavy loss). This is the owner-authorised trade-off:
  // responsive first signal from RTT, confirmed by subsequent polls.

  // Honest loss-rate · only computed when we actually have packet
  // deltas. If no peers contributed, lossRate stays at 0 and the
  // RTT alone drives the label (owner-authorised fallback when loss
  // measurements aren't available).
  const lossRate =
    totalReceivedDelta + totalLostDelta > 0
      ? totalLostDelta / (totalLostDelta + totalReceivedDelta)
      : 0;

  const rttPoor = worstRtt !== null && worstRtt > QUALITY_THRESHOLDS.rttPoorMs;
  const rttFair = worstRtt !== null && worstRtt > QUALITY_THRESHOLDS.rttFairMs;
  const lossPoor = anyHasLossRate && lossRate > QUALITY_THRESHOLDS.lossPoorRate;
  const lossFair = anyHasLossRate && lossRate > QUALITY_THRESHOLDS.lossFairRate;

  if (rttPoor || lossPoor) {
    return { quality: "poor", nextPrevious };
  }
  if (rttFair || lossFair) {
    return { quality: "fair", nextPrevious };
  }
  return { quality: "good", nextPrevious };
}

/** React hook · polls `collectStats()` on every live peer connection
 *  returned by `getPeerConnections` and publishes a
 *  `CallsConnectionQuality | null` into component state.
 *
 *  Caller supplies the peer-connection accessor so the hook does not
 *  need to know about `GroupCallEngine` directly · keeps the hook
 *  testable with mock accessors AND reusable from the 1:1 peer-call
 *  surface if we wire that later.
 *
 *  Lifecycle contract:
 *    · interval registered on mount only when `enabled === true`,
 *    · cleared on unmount or when enabled flips false,
 *    · guarded by a mounted-ref so late async poll results from a
 *      disposed call never trigger `setState`. */
export function useConnectionQuality({
  enabled,
  getPeerConnections,
  identity,
  callId,
  role,
}: {
  readonly enabled: boolean;
  readonly getPeerConnections: () => ReadonlyArray<{
    readonly peerAccountId: string;
    readonly pc: RTCPeerConnection;
  }>;
  readonly identity: string;
  readonly callId: string;
  readonly role: "caller" | "callee";
}): CallsConnectionQuality | null {
  const [quality, setQuality] = React.useState<CallsConnectionQuality | null>(
    null,
  );
  const mountedRef = React.useRef(true);
  const previousRef = React.useRef<ReadonlyMap<string, PreviousSnapshotCache>>(
    new Map(),
  );

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      setQuality(null);
      previousRef.current = new Map();
      return;
    }

    let cancelled = false;
    const tick = async () => {
      const peers = getPeerConnections();
      // Snapshot each live PC · tolerate individual failures (one bad
      // peer should not prevent other peers from reporting). Each
      // peer gets:
      //   · a sealed-module CallStats snapshot (RTT · packetsLost ·
      //     connectionState · path · codecs · etc.)
      //   · a direct packetsReceived read via `collectReceivedPackets`
      //     (owner-review follow-up 2026-10-19 · replaces the retired
      //     bytesReceivedDelta/1200 approximation · keeps the sealed
      //     measurement.ts module byte-identical).
      const snapshots: QualitySnapshot[] = [];
      for (const { peerAccountId, pc } of peers) {
        try {
          const [stats, packetsReceived] = await Promise.all([
            collectStats(pc, {
              callId,
              identity,
              peer: peerAccountId,
              role,
            }),
            collectReceivedPackets(pc),
          ]);
          snapshots.push({ ...stats, packetsReceived });
        } catch {
          /* skip this peer · honest · don't fabricate a stat */
        }
      }
      if (cancelled || !mountedRef.current) return;
      const { quality: next, nextPrevious } = deriveQuality(
        snapshots,
        previousRef.current,
      );
      previousRef.current = nextPrevious;
      setQuality(next);
    };

    // Fire once immediately so the UI isn't frozen at "Measuring…"
    // for 3 seconds after mount, then poll on the sealed interval.
    void tick();
    const id = setInterval(() => void tick(), QUALITY_THRESHOLDS.pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, getPeerConnections, identity, callId, role]);

  return quality;
}
