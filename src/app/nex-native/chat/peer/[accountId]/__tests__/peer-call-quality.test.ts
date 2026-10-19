// src/app/nex-native/chat/peer/[accountId]/__tests__/peer-call-quality.test.ts
//
// NEX Peer Call · 1:1 connection-quality contract tests.
// Owner-authorised Phase 4 build 2026-10-19 (Phase 2 Slice 3).
// -----------------------------------------------------------------------------
// Verifies:
//
//   · PeerCall exposes the additive getPeerConnection() getter (same
//     contract shape as GroupPeer).
//   · The new _use-peer-call-quality.ts hook reuses the SEALED group-
//     call deriveQuality / collectReceivedPackets / QUALITY_THRESHOLDS
//     helpers (one source of truth · no copy-pasted thresholds).
//   · The hook returns null when: no PC, disabled, or stats fail.
//   · The underlying deriveQuality is unchanged (regression hint ·
//     this file does NOT re-test the mapper itself; the group-call
//     test suite already does that comprehensively).

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  deriveQuality,
  QUALITY_THRESHOLDS,
  type PreviousSnapshotCache,
  type QualitySnapshot,
} from "../../../../call/g/[sessionId]/_use-connection-quality";

const DIR = path.resolve(__dirname, "..");
const HOOK = fs.readFileSync(path.join(DIR, "_use-peer-call-quality.ts"), "utf8");

const REPO_ROOT = path.resolve(__dirname, "../../../../../../..");
const PEER_CALL = fs.readFileSync(
  path.join(REPO_ROOT, "src/lib/nex-native/calls/peer-call.ts"),
  "utf8",
);

// ─── A · PeerCall · additive getPeerConnection() getter ──────────────

describe("A · PeerCall exposes an additive, read-only getPeerConnection()", () => {
  it("declares getPeerConnection(): RTCPeerConnection | null", () => {
    expect(PEER_CALL).toMatch(/getPeerConnection\(\)\s*:\s*RTCPeerConnection\s*\|\s*null/);
  });

  it("returns null when the call has been closed (sealed invariant)", () => {
    expect(PEER_CALL).toMatch(/getPeerConnection\(\)[\s\S]{0,300}if\s*\(\s*this\.closed\s*\)\s*return\s*null/);
  });

  it("Phase 4 doctrine comment documents the honest invariants", () => {
    expect(PEER_CALL.toLowerCase()).toMatch(/phase 4 wiring/);
    expect(PEER_CALL.toLowerCase()).toMatch(/additive read-only getter/);
  });
});

// ─── B · Hook · reuses sealed helpers (no drift) ─────────────────────

describe("B · _use-peer-call-quality reuses the sealed group-call helpers", () => {
  it("imports collectStats from the sealed measurement module", () => {
    expect(HOOK).toMatch(/import\s*\{\s*collectStats\s*\}\s*from\s*["'`]@\/lib\/nex-calling\/measurement["'`]/);
  });

  it("imports deriveQuality + collectReceivedPackets + QUALITY_THRESHOLDS from the group-call hook (single source of truth)", () => {
    expect(HOOK).toMatch(/collectReceivedPackets/);
    expect(HOOK).toMatch(/deriveQuality/);
    expect(HOOK).toMatch(/QUALITY_THRESHOLDS/);
    expect(HOOK).toMatch(/from\s*["'`]@\/app\/nex-native\/call\/g\/\[sessionId\]\/_use-connection-quality["'`]/);
  });

  it("does NOT duplicate the quality thresholds locally (regression guard)", () => {
    // The hook must not redefine rttPoorMs / rttFairMs / lossPoorRate /
    // lossFairRate / pollIntervalMs · all come from QUALITY_THRESHOLDS.
    expect(HOOK).not.toMatch(/rttPoorMs\s*:\s*\d/);
    expect(HOOK).not.toMatch(/rttFairMs\s*:\s*\d/);
    expect(HOOK).not.toMatch(/lossPoorRate\s*:\s*\d/);
    expect(HOOK).not.toMatch(/lossFairRate\s*:\s*\d/);
    // Only reference, never assign.
    expect(HOOK).toMatch(/QUALITY_THRESHOLDS\.pollIntervalMs/);
  });
});

// ─── C · Hook · public API contract ──────────────────────────────────

describe("C · _use-peer-call-quality · public API contract", () => {
  it("exports UsePeerCallQualityOptions with getPeerConnection + peerAccountId + enabled?", () => {
    expect(HOOK).toMatch(/export interface UsePeerCallQualityOptions/);
    expect(HOOK).toMatch(/getPeerConnection:\s*\(\)\s*=>\s*RTCPeerConnection\s*\|\s*null/);
    expect(HOOK).toMatch(/peerAccountId:\s*string/);
    expect(HOOK).toMatch(/enabled\?:\s*boolean/);
  });

  it("exports usePeerCallQuality(options) → CallsConnectionQuality | null", () => {
    expect(HOOK).toMatch(/export function usePeerCallQuality/);
    expect(HOOK).toMatch(/CallsConnectionQuality\s*\|\s*null/);
  });

  it("returns null when no PC is available (idle / pre-call / closed)", () => {
    // The hook's poll callback early-returns + setQuality(null) when
    // getPeerConnection() returns null · documented invariant.
    expect(HOOK).toMatch(/if\s*\(\s*!pc\s*\)\s*\{[\s\S]{0,200}setQuality\(null\)/);
  });

  it("tears down the poll interval on unmount / dependency change", () => {
    expect(HOOK).toMatch(/return\s*\(\)\s*=>\s*\{[\s\S]{0,200}clearInterval\(interval\)/);
  });

  it("skips state updates after unmount (mountedRef + cancelled guard · stale polls can't update React)", () => {
    expect(HOOK).toMatch(/mountedRef/);
    expect(HOOK).toMatch(/const\s+mountedRef\s*=\s*React\.useRef\(true\)/);
    // Both the cancelled flag and the mountedRef are checked before setQuality.
    expect(HOOK).toMatch(/let\s+cancelled\s*=\s*false/);
  });

  it("resets state to null when the hook is disabled (prevents stale-label after call end)", () => {
    expect(HOOK).toMatch(/if\s*\(\s*!enabled\s*\)\s*\{[\s\S]{0,200}setQuality\(null\)[\s\S]{0,200}previousRef\.current\s*=\s*new\s+Map\(\)/);
  });

  it("catches stats failures and sets quality to null (no fabrication)", () => {
    expect(HOOK).toMatch(/catch\s*\{\s*[\s\S]{0,200}setQuality\(null\)/);
  });
});

// ─── D · Sanity · the shared mapper still handles single-peer input ─

describe("D · deriveQuality (sealed · reused) handles the 1-element snapshot array a peer-call hook feeds in", () => {
  function makeSnapshot(partial: Partial<QualitySnapshot>): QualitySnapshot {
    const base: QualitySnapshot = {
      peer: "peer-abc",
      connectionState: "connected",
      roundTripMs: 50,
      packetsLost: 0,
      packetsReceived: 100,
      timestampMs: Date.now(),
    };
    return { ...base, ...partial };
  }

  it("empty snapshot array → null quality (no fabrication)", () => {
    const { quality } = deriveQuality([], new Map());
    expect(quality).toBeNull();
  });

  it("single CONNECTED peer with 50ms RTT · first sample · classifies as 'good' (RTT-only)", () => {
    const { quality } = deriveQuality([makeSnapshot({})], new Map());
    expect(quality).toBe("good");
  });

  it("single peer in 'new' connectionState → null (pre-live)", () => {
    const { quality } = deriveQuality(
      [makeSnapshot({ connectionState: "new" })],
      new Map(),
    );
    expect(quality).toBeNull();
  });

  it("single peer in 'failed' connectionState → null (end-of-life, no infinite spinner)", () => {
    const { quality } = deriveQuality(
      [makeSnapshot({ connectionState: "failed" })],
      new Map(),
    );
    expect(quality).toBeNull();
  });

  it("single peer in 'disconnected' connectionState → 'reconnecting'", () => {
    const { quality } = deriveQuality(
      [makeSnapshot({ connectionState: "disconnected" })],
      new Map(),
    );
    expect(quality).toBe("reconnecting");
  });

  it("second sample with 10% packet loss delta → 'poor'", () => {
    const prev: PreviousSnapshotCache = {
      packetsLost: 0,
      packetsReceived: 100,
      timestampMs: Date.now() - 3000,
    };
    const previousMap = new Map([["peer-abc", prev]]);
    const current = makeSnapshot({
      roundTripMs: 50,
      packetsLost: 20,       // +20
      packetsReceived: 200,  // +100 · lost rate = 20/120 ≈ 16.7% · poor
    });
    const { quality } = deriveQuality([current], previousMap);
    expect(quality).toBe("poor");
  });
});

// ─── E · Thresholds pinned via the shared constant (regression guard) ─

describe("E · QUALITY_THRESHOLDS is the single source of truth for peer + group alike", () => {
  it("rttPoorMs = 500ms, rttFairMs = 200ms", () => {
    expect(QUALITY_THRESHOLDS.rttPoorMs).toBe(500);
    expect(QUALITY_THRESHOLDS.rttFairMs).toBe(200);
  });

  it("lossPoorRate = 0.05 (5%), lossFairRate = 0.02 (2%)", () => {
    expect(QUALITY_THRESHOLDS.lossPoorRate).toBe(0.05);
    expect(QUALITY_THRESHOLDS.lossFairRate).toBe(0.02);
  });

  it("pollIntervalMs = 3000 (3s · owner-sealed)", () => {
    expect(QUALITY_THRESHOLDS.pollIntervalMs).toBe(3000);
  });
});
