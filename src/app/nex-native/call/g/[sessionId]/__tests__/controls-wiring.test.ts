// src/app/nex-native/call/g/[sessionId]/__tests__/controls-wiring.test.ts
//
// NEX Group Call · live control wiring + engine behaviour tests.
// Owner-authorised Phase 1A build 2026-10-19.
// -----------------------------------------------------------------------------
// The Priority 2B audit found zero automated coverage for the live
// group-call controls (Mute · Camera · Leave · End for all). This
// file closes that gap with three complementary layers:
//
//   A · SOURCE-LEVEL WIRING GUARDS · prove the in-file Controls
//       component is wired to the engine + server actions + router
//       as the implementation claims. Catches a developer rewiring
//       onLeave to skip the server action, or dropping the host-only
//       guard on End-for-all, without a render harness.
//
//   B · ENGINE STATE MACHINE · exercises GroupCallEngine's public
//       setMuted / setCameraOff / isMuted / isCameraOff API, including
//       the "no local stream yet" safe guard and idempotency.
//
//   C · ENGINE TRACK MUTATION · with a mocked MediaStream injected
//       into the engine (bypassing getUserMedia which requires a
//       browser context), confirms setMuted actually flips every
//       audio track's `enabled` flag and setCameraOff flips every
//       video track's `enabled` flag. The mutation is a two-line
//       implementation but this test proves the contract rather
//       than inferring it from code inspection.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { GroupCallEngine } from "../../../../../../lib/nex-native/calls/group-call-engine";

const CLIENT_SOURCE_PATH = path.resolve(
  __dirname,
  "..",
  "_group-call-client.tsx",
);
const CLIENT_SOURCE = fs.readFileSync(CLIENT_SOURCE_PATH, "utf8");

// ─── Layer A · SOURCE-LEVEL WIRING GUARDS ────────────────────────────

describe("A · live group-call client wires each control to the engine + server actions", () => {
  it("imports GroupCallEngine (the real engine, not a mock or placeholder)", () => {
    expect(CLIENT_SOURCE).toMatch(/import\s*\{[^}]*GroupCallEngine[^}]*\}\s*from\s*["'`]@\/lib\/nex-native\/calls\/group-call-engine["'`]/);
  });

  it("imports leaveGroupCallAction + endGroupCallAction server actions", () => {
    expect(CLIENT_SOURCE).toMatch(/leaveGroupCallAction/);
    expect(CLIENT_SOURCE).toMatch(/endGroupCallAction/);
  });

  it("declares muted + cameraOff React state", () => {
    expect(CLIENT_SOURCE).toMatch(/const\s*\[\s*muted\s*,\s*setMuted\s*\]\s*=\s*React\.useState/);
    expect(CLIENT_SOURCE).toMatch(/const\s*\[\s*cameraOff\s*,\s*setCameraOff\s*\]\s*=\s*React\.useState/);
  });

  it("onToggleMute flips state AND calls engine.setMuted with the new value", () => {
    // The implementation toggles via `const next = !muted; setMuted(next); engine.setMuted(next)`.
    // Catches a regression that updates React state without pushing to the engine.
    expect(CLIENT_SOURCE).toMatch(/function\s+onToggleMute[\s\S]{0,300}engineRef\.current\?\.setMuted\s*\(\s*next\s*\)/);
    expect(CLIENT_SOURCE).toMatch(/function\s+onToggleMute[\s\S]{0,200}setMuted\s*\(\s*next\s*\)/);
  });

  it("onToggleCamera flips state AND calls engine.setCameraOff with the new value", () => {
    expect(CLIENT_SOURCE).toMatch(/function\s+onToggleCamera[\s\S]{0,300}engineRef\.current\?\.setCameraOff\s*\(\s*next\s*\)/);
    expect(CLIENT_SOURCE).toMatch(/function\s+onToggleCamera[\s\S]{0,200}setCameraOff\s*\(\s*next\s*\)/);
  });

  it("onLeave awaits engine.leave() before invoking the server action, then navigates", () => {
    // Ordering matters: tear down local media + peers FIRST, then tell the server, then navigate.
    // If someone reorders these the user can be routed before cleanup finishes and the local
    // camera stays on. The one-line regex locks the sequence.
    expect(CLIENT_SOURCE).toMatch(
      /async function\s+onLeave[\s\S]{0,500}await\s+e\.leave\(\)[\s\S]{0,200}await\s+leaveGroupCallAction\(\s*props\.sessionId\s*\)[\s\S]{0,200}router\.push\s*\(\s*["'`]\/nex-native\/calls["'`]\s*\)/,
    );
  });

  it("onEndForAll awaits engine.leave() then endGroupCallAction then router.push", () => {
    expect(CLIENT_SOURCE).toMatch(
      /async function\s+onEndForAll[\s\S]{0,500}await\s+e\.leave\(\)[\s\S]{0,200}await\s+endGroupCallAction\(\s*props\.sessionId\s*\)[\s\S]{0,200}router\.push\s*\(\s*["'`]\/nex-native\/calls["'`]\s*\)/,
    );
  });

  it("End-for-all button is gated by {isHost && joined && ...} host-only guard", () => {
    // Regression guard · if someone drops the isHost check, every participant could end the call.
    expect(CLIENT_SOURCE).toMatch(/\{isHost\s*&&\s*joined\s*&&[\s\S]{0,200}label=["'`]End for all["'`]/);
  });

  it("Camera button is gated by mediaType === 'video' (not shown in voice-only calls)", () => {
    expect(CLIENT_SOURCE).toMatch(/\{mediaType\s*===\s*["'`]video["'`]\s*&&[\s\S]{0,200}onClick=\{\s*onCamera\s*\}/);
  });

  it("Phase 2 Slice 1 · mounts ConnectionFooter driven by useConnectionQuality (quality may be null)", () => {
    expect(CLIENT_SOURCE).toMatch(/useConnectionQuality/);
    expect(CLIENT_SOURCE).toMatch(/<ConnectionFooter\s+quality=\{\s*quality\s*\}/);
  });
});

// ─── Layer B · ENGINE STATE MACHINE ──────────────────────────────────

describe("B · GroupCallEngine · mute / camera state machine (no browser needed)", () => {
  function makeEngine() {
    return new GroupCallEngine({
      sessionId: "test-session",
      selfAccountId: "self-abc",
      selfDisplayName: "Self",
      mediaType: "video",
      handlers: {},
    });
  }

  it("starts in a muted=false / cameraOff=false state", () => {
    const e = makeEngine();
    expect(e.isMuted()).toBe(false);
    expect(e.isCameraOff()).toBe(false);
  });

  it("setMuted(true) updates isMuted(), does not crash before localStream exists", () => {
    const e = makeEngine();
    expect(() => e.setMuted(true)).not.toThrow();
    expect(e.isMuted()).toBe(true);
  });

  it("setCameraOff(true) updates isCameraOff(), does not crash before localStream exists", () => {
    const e = makeEngine();
    expect(() => e.setCameraOff(true)).not.toThrow();
    expect(e.isCameraOff()).toBe(true);
  });

  it("setMuted + setCameraOff are independent", () => {
    const e = makeEngine();
    e.setMuted(true);
    expect(e.isCameraOff()).toBe(false);
    e.setCameraOff(true);
    expect(e.isMuted()).toBe(true);
    e.setMuted(false);
    expect(e.isMuted()).toBe(false);
    expect(e.isCameraOff()).toBe(true);
  });

  it("rapid toggle sequence lands in the last-set state", () => {
    const e = makeEngine();
    e.setMuted(true);
    e.setMuted(false);
    e.setMuted(true);
    e.setMuted(false);
    expect(e.isMuted()).toBe(false);
  });

  it("getAllPeerConnections returns an empty array before any peer is created", () => {
    const e = makeEngine();
    expect(e.getAllPeerConnections()).toEqual([]);
  });

  it("getLocalStream returns null before start()", () => {
    const e = makeEngine();
    expect(e.getLocalStream()).toBeNull();
  });

  it("getState starts in 'idle'", () => {
    const e = makeEngine();
    expect(e.getState()).toBe("idle");
  });

  it("getRemoteStreams returns [] before any remote peer is attached", () => {
    const e = makeEngine();
    expect(e.getRemoteStreams()).toEqual([]);
  });
});

// ─── Layer C · ENGINE TRACK MUTATION (mocked MediaStream) ───────────

describe("C · GroupCallEngine · setMuted + setCameraOff mutate real track.enabled flags", () => {
  // Build a minimal MediaStream-ish object with mock audio + video tracks.
  // The engine iterates getAudioTracks() / getVideoTracks() and sets
  // `t.enabled = !muted` / `t.enabled = !off`. We verify the mutation
  // reaches the actual track objects.
  function mockTrack(kind: "audio" | "video") {
    return {
      kind,
      enabled: true,
      // stop() is called during leave() · noop here.
      stop: vi.fn(),
    } as unknown as MediaStreamTrack;
  }

  function mockStream(audio: MediaStreamTrack[], video: MediaStreamTrack[]) {
    const all = [...audio, ...video];
    return {
      getAudioTracks: () => audio,
      getVideoTracks: () => video,
      getTracks: () => all,
    } as unknown as MediaStream;
  }

  function makeEngineWithStream(audioCount: number, videoCount: number) {
    const audioTracks = Array.from({ length: audioCount }, () => mockTrack("audio"));
    const videoTracks = Array.from({ length: videoCount }, () => mockTrack("video"));
    const stream = mockStream(audioTracks, videoTracks);
    const engine = new GroupCallEngine({
      sessionId: "test-session",
      selfAccountId: "self-abc",
      selfDisplayName: "Self",
      mediaType: "video",
      handlers: {},
    });
    // Private-field injection · the engine's localStream is populated
    // by start() → getUserMedia. Here we inject a mock so the mutation
    // methods have something to iterate without needing a browser.
    (engine as unknown as { localStream: MediaStream }).localStream = stream;
    return { engine, audioTracks, videoTracks, stream };
  }

  it("setMuted(true) sets every audio track's enabled flag to FALSE", () => {
    const { engine, audioTracks, videoTracks } = makeEngineWithStream(2, 1);
    engine.setMuted(true);
    expect(audioTracks.every((t) => t.enabled === false)).toBe(true);
    // Video tracks are untouched.
    expect(videoTracks.every((t) => t.enabled === true)).toBe(true);
  });

  it("setMuted(false) re-enables every audio track", () => {
    const { engine, audioTracks } = makeEngineWithStream(2, 1);
    engine.setMuted(true);
    engine.setMuted(false);
    expect(audioTracks.every((t) => t.enabled === true)).toBe(true);
  });

  it("setCameraOff(true) sets every video track's enabled flag to FALSE", () => {
    const { engine, audioTracks, videoTracks } = makeEngineWithStream(1, 2);
    engine.setCameraOff(true);
    expect(videoTracks.every((t) => t.enabled === false)).toBe(true);
    // Audio tracks are untouched.
    expect(audioTracks.every((t) => t.enabled === true)).toBe(true);
  });

  it("setCameraOff(false) re-enables every video track", () => {
    const { engine, videoTracks } = makeEngineWithStream(1, 2);
    engine.setCameraOff(true);
    engine.setCameraOff(false);
    expect(videoTracks.every((t) => t.enabled === true)).toBe(true);
  });

  it("handles a stream with zero audio tracks (voice-off / video-only) without crashing", () => {
    const { engine } = makeEngineWithStream(0, 1);
    expect(() => engine.setMuted(true)).not.toThrow();
    expect(engine.isMuted()).toBe(true);
  });

  it("handles a stream with zero video tracks (audio-only call) without crashing", () => {
    const { engine } = makeEngineWithStream(1, 0);
    expect(() => engine.setCameraOff(true)).not.toThrow();
    expect(engine.isCameraOff()).toBe(true);
  });
});

// ─── Layer D · ENGINE leave() cleanup ────────────────────────────────

describe("D · GroupCallEngine · leave() stops local tracks and ends state", () => {
  function mockTrackWithStop() {
    return {
      kind: "audio" as const,
      enabled: true,
      stop: vi.fn(),
    } as unknown as MediaStreamTrack & { stop: ReturnType<typeof vi.fn> };
  }

  let originalConsoleError: typeof console.error;
  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = () => {};
  });
  afterEach(() => {
    console.error = originalConsoleError;
  });

  it("leave() calls stop() on every local track + fires onRemoteStreams([]) + state → 'ended'", async () => {
    const audio = [mockTrackWithStop(), mockTrackWithStop()];
    const video = [mockTrackWithStop()];
    const stream = {
      getAudioTracks: () => audio,
      getVideoTracks: () => video,
      getTracks: () => [...audio, ...video],
    } as unknown as MediaStream;

    const remoteStreamCalls: Array<ReadonlyArray<unknown>> = [];
    const stateCalls: string[] = [];
    const engine = new GroupCallEngine({
      sessionId: "test-session",
      selfAccountId: "self-abc",
      selfDisplayName: "Self",
      mediaType: "video",
      handlers: {
        onRemoteStreams: (streams) => { remoteStreamCalls.push(streams); },
        onStateChange: (s) => { stateCalls.push(s); },
      },
    });
    (engine as unknown as { localStream: MediaStream }).localStream = stream;

    await engine.leave();

    // Every track stop() was called.
    for (const t of [...audio, ...video]) {
      expect((t as unknown as { stop: ReturnType<typeof vi.fn> }).stop).toHaveBeenCalledTimes(1);
    }
    // Remote-streams listeners get a [] fire so the UI drops any stale tiles.
    expect(remoteStreamCalls.at(-1)).toEqual([]);
    // Final state is "ended".
    expect(stateCalls.at(-1)).toBe("ended");
    expect(engine.getState()).toBe("ended");
    // Local stream reference is dropped.
    expect(engine.getLocalStream()).toBeNull();
  });

  it("leave() called twice is idempotent (closed guard prevents double teardown)", async () => {
    const audio = [mockTrackWithStop()];
    const stream = {
      getAudioTracks: () => audio,
      getVideoTracks: () => [],
      getTracks: () => audio,
    } as unknown as MediaStream;
    const engine = new GroupCallEngine({
      sessionId: "test-session",
      selfAccountId: "self-abc",
      selfDisplayName: "Self",
      mediaType: "audio",
      handlers: {},
    });
    (engine as unknown as { localStream: MediaStream }).localStream = stream;

    await engine.leave();
    await engine.leave(); // second call must be a no-op

    expect((audio[0] as unknown as { stop: ReturnType<typeof vi.fn> }).stop).toHaveBeenCalledTimes(1);
  });
});
