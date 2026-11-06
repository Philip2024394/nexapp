// src/app/nex-native/chat/peer/[accountId]/_use-peer-call-quality.ts
//
// NEX Peer Call · 1:1 connection-quality polling hook.
// Owner-authorised Phase 4 wiring 2026-10-19 (Phase 2 Slice 3).
// -----------------------------------------------------------------------------
// Reuses the SEALED group-call quality pipeline:
//
//   · collectStats()            · from @/lib/nex-calling/measurement
//   · collectReceivedPackets()  · from the group-call hook
//   · deriveQuality() (pure)    · from the group-call hook
//
// A 1:1 call has exactly ONE RTCPeerConnection. The hook adapts the
// group-call pattern by polling a single PC and wrapping the result
// in a 1-element array before handing it to the shared mapper. This
// keeps the derivation logic in exactly one place · drift between
// the group and 1:1 quality indicators becomes impossible.
//
// Honest invariants (sealed inherited from the group-call hook):
//   · Returns null when: no PC, pre-live, or stats unavailable.
//   · Reports "reconnecting" only while the PC is actually in
//     RTCPeerConnection.connectionState === "disconnected" ·
//     "failed"/"closed" collapse to null (no infinite spinner).
//   · Interval-DELTA packet loss (never cumulative) · first sample
//     establishes baseline and does NOT contribute to loss rate.
//   · Clean teardown on unmount · stale polls can never update
//     React state after the hook unmounts.
//   · Browser lacking `pc.getStats()` → returns null (the sealed
//     measurement module handles this gracefully; the UI shows
//     "Measuring…").

"use client";

import * as React from "react";
import { collectStats } from "@/lib/nex-calling/measurement";
import {
  collectReceivedPackets,
  deriveQuality,
  QUALITY_THRESHOLDS,
  type PreviousSnapshotCache,
  type QualitySnapshot,
} from "@/lib/nex-native/calls-chrome/connection-quality-hook";
import type { CallsConnectionQuality } from "@/lib/nex-native/calls-chrome/types";

export interface UsePeerCallQualityOptions {
  /** Returns the current 1:1 RTCPeerConnection, or null when the
   *  call is torn down / pre-offer / closed. Pass PeerCall's
   *  getPeerConnection method bound to the live instance:
   *    `getPeerConnection: () => callRef.current?.getPeerConnection() ?? null`
   *
   *  Returning null is EXPECTED behaviour (idle / closed) · the hook
   *  simply skips the poll and returns null quality. */
  readonly getPeerConnection: () => RTCPeerConnection | null;
  /** Stable peer identifier used by the sealed `collectStats` module.
   *  For a 1:1 call this is the counterparty's account id. */
  readonly peerAccountId: string;
  /** Enables / disables polling. When the call is not in an active
   *  state (idle, dialling, ringing, ended) the host should pass
   *  false so the hook does not spin up a poll cycle. Defaults
   *  to true. */
  readonly enabled?: boolean;
}

export function usePeerCallQuality(
  opts: UsePeerCallQualityOptions,
): CallsConnectionQuality | null {
  const [quality, setQuality] = React.useState<CallsConnectionQuality | null>(null);
  const previousRef = React.useRef<ReadonlyMap<string, PreviousSnapshotCache>>(new Map());
  const mountedRef = React.useRef(true);
  const enabled = opts.enabled ?? true;
  const { getPeerConnection, peerAccountId } = opts;

  React.useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      // Explicitly reset to null when the host disables the hook ·
      // keeps the UI from showing a stale label after a call ends.
      setQuality(null);
      previousRef.current = new Map();
      return undefined;
    }

    let cancelled = false;
    const interval = setInterval(() => {
      void (async () => {
        if (cancelled || !mountedRef.current) return;
        const pc = getPeerConnection();
        if (!pc) {
          // No live PC · honest null · do not update previous cache.
          if (!cancelled && mountedRef.current) setQuality(null);
          return;
        }
        try {
          const [stats, pktReceived] = await Promise.all([
            collectStats(pc, peerAccountId),
            collectReceivedPackets(pc),
          ]);
          if (cancelled || !mountedRef.current) return;
          const snapshot: QualitySnapshot = {
            ...stats,
            packetsReceived: pktReceived,
          };
          const { quality: next, nextPrevious } = deriveQuality(
            [snapshot],
            previousRef.current,
          );
          previousRef.current = nextPrevious;
          setQuality(next);
        } catch {
          // Any stats failure → honest null (never fabricate).
          if (!cancelled && mountedRef.current) setQuality(null);
        }
      })();
    }, QUALITY_THRESHOLDS.pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, getPeerConnection, peerAccountId]);

  return quality;
}
