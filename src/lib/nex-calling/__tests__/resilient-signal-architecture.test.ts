// src/lib/nex-calling/__tests__/resilient-signal-architecture.test.ts
//
// NEX Calling · architectural isolation + contract tests for ResilientSignal.
// Owner-authorised Phase 3 build 2026-10-19.
// -----------------------------------------------------------------------------
// Phase 3 investigation finding (isolated per directive):
//
//   `ResilientSignal` targets a DIFFERENT signalling architecture than
//   the live group-call and peer-call clients:
//
//     · ResilientSignal · EventSource + HTTP endpoints at opts.signalBase
//                         (/hello POST + /stream/{identity} SSE). Likely
//                         consumer is scripts/nex-calling/signal.mjs
//                         (sealed port from D:/trades).
//
//     · Live group/peer · Supabase Realtime via openNexChannel() +
//                         openSignallingChannel() (`nex:signal:{...}`,
//                         `nex:group:{...}` broadcast + presence
//                         channels). Supabase's realtime-js client
//                         has its OWN reconnection logic baked in.
//
//   These two transports are NOT compatible drop-in replacements.
//   Wrapping the Supabase channel in a ResilientSignal would create
//   DUPLICATE retry paths and mix WebSocket/SSE transport semantics ·
//   explicitly flagged as a hazard by the Phase 3 directive.
//
// This file documents the architectural separation + verifies the
// public contract of ResilientSignal so neither surface drifts
// unnoticed. Integration into the live clients is DEFERRED to a
// future owner decision: either (a) keep both for different purposes,
// (b) retire ResilientSignal if no live consumer emerges, or
// (c) migrate the live clients to EventSource (a large architecture
// change outside autonomous build authority).

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { ResilientSignal, type SignalConnState } from "../resilient-signal";

const DIR = path.resolve(__dirname, "..");
const SIGNAL = fs.readFileSync(path.join(DIR, "resilient-signal.ts"), "utf8");

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const GROUP_PEER = fs.readFileSync(
  path.join(REPO_ROOT, "src/lib/nex-native/calls/group-peer.ts"),
  "utf8",
);
const GROUP_ENGINE = fs.readFileSync(
  path.join(REPO_ROOT, "src/lib/nex-native/calls/group-call-engine.ts"),
  "utf8",
);
const REALTIME_SIGNALLING = fs.readFileSync(
  path.join(REPO_ROOT, "src/lib/nex-native/realtime/signalling.ts"),
  "utf8",
);
const REALTIME_CHANNEL = fs.readFileSync(
  path.join(REPO_ROOT, "src/lib/nex-native/realtime/channel.ts"),
  "utf8",
);

// ─── A · ResilientSignal public contract (what it IS) ────────────────

describe("A · ResilientSignal public contract", () => {
  it("exports the SignalConnState union with the four states", () => {
    expect(SIGNAL).toMatch(/export type SignalConnState\s*=\s*["']connecting["']\s*\|\s*["']open["']\s*\|\s*["']reconnecting["']\s*\|\s*["']closed["']/);
  });

  it("constructor accepts identity + signalBase + onMessage + optional callbacks", () => {
    expect(SIGNAL).toMatch(/export interface ResilientSignalOptions\s*\{[\s\S]{0,400}identity:\s*string[\s\S]{0,80}signalBase:\s*string[\s\S]{0,80}onMessage:/);
  });

  it("declares exponential-backoff reconnect constants (1s initial, 30s cap, factor 2, jitter)", () => {
    expect(SIGNAL).toMatch(/RECONNECT_INITIAL_MS\s*=\s*1000/);
    expect(SIGNAL).toMatch(/RECONNECT_MAX_MS\s*=\s*30_000/);
    expect(SIGNAL).toMatch(/RECONNECT_BACKOFF_FACTOR\s*=\s*2/);
    expect(SIGNAL).toMatch(/JITTER_MS\s*=\s*500/);
  });

  it("intentional close() DOES NOT reconnect (sealed invariant)", () => {
    expect(SIGNAL).toMatch(/close\(\)[\s\S]{0,200}this\.closed\s*=\s*true/);
    // The connect() path short-circuits when closed.
    expect(SIGNAL).toMatch(/private connect\(\)[\s\S]{0,100}if\s*\(\s*this\.closed\s*\)\s*return/);
    // The scheduleReconnect path short-circuits when closed.
    expect(SIGNAL).toMatch(/private scheduleReconnect\(\)[\s\S]{0,100}if\s*\(\s*this\.closed\s*\)\s*return/);
  });

  it("re-hello happens on EVERY reconnect attempt (presence recovery)", () => {
    expect(SIGNAL.toLowerCase()).toMatch(/re-hello/);
    expect(SIGNAL).toMatch(/fetch\(`\$\{this\.opts\.signalBase\}\/hello`/);
  });
});

// ─── B · ResilientSignal targets EventSource + HTTP, NOT Supabase ───

describe("B · ResilientSignal transport is EventSource + HTTP (incompatible with Supabase Realtime)", () => {
  it("ResilientSignal uses EventSource (SSE), NOT Supabase broadcast channels", () => {
    expect(SIGNAL).toMatch(/new EventSource\(url\)/);
    expect(SIGNAL).not.toMatch(/openNexChannel|openSignallingChannel|supabase/i);
  });

  it("ResilientSignal targets a configurable HTTP endpoint (signalBase)", () => {
    expect(SIGNAL).toMatch(/signalBase:\s*string/);
    expect(SIGNAL).toMatch(/\$\{this\.opts\.signalBase\}\/stream\/\$\{encodeURIComponent\(this\.opts\.identity\)\}/);
  });
});

// ─── C · Live group-call clients use Supabase Realtime (sealed) ──────

describe("C · live group-call + peer-call clients use Supabase Realtime · not ResilientSignal", () => {
  it("group-peer.ts imports openSignallingChannel from the realtime layer", () => {
    expect(GROUP_PEER).toMatch(/openSignallingChannel/);
    expect(GROUP_PEER).toMatch(/from\s*["'`]\.\.\/realtime\/signalling["'`]/);
    expect(GROUP_PEER).not.toMatch(/ResilientSignal|resilient-signal/);
  });

  it("group-call-engine.ts imports openNexChannel from the realtime layer", () => {
    expect(GROUP_ENGINE).toMatch(/openNexChannel/);
    expect(GROUP_ENGINE).toMatch(/from\s*["'`]\.\.\/realtime\/channel["'`]/);
    expect(GROUP_ENGINE).not.toMatch(/ResilientSignal|resilient-signal/);
  });

  it("realtime/channel.ts uses the Supabase client (its own reconnection logic)", () => {
    expect(REALTIME_CHANNEL).toMatch(/RealtimeChannel/);
    expect(REALTIME_CHANNEL).toMatch(/supabase-js/);
  });

  it("realtime/signalling.ts rides the sealed Supabase channel abstraction", () => {
    expect(REALTIME_SIGNALLING).toMatch(/openNexChannel/);
    expect(REALTIME_SIGNALLING).toMatch(/from\s*["'`]\.\/channel["'`]/);
  });
});

// ─── D · Architectural doctrine · no cross-wiring without a plan ────

describe("D · ResilientSignal MUST NOT be wrapped around the Supabase layer without an authorised architecture plan", () => {
  it("no file in src/lib/nex-native/calls OR src/app/nex-native/call imports ResilientSignal", () => {
    const roots = [
      path.join(REPO_ROOT, "src/lib/nex-native/calls"),
      path.join(REPO_ROOT, "src/app/nex-native/call"),
    ];
    function walk(dir: string, acc: string[]) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.name === "__tests__") continue;
        if (entry.isDirectory()) walk(full, acc);
        else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
          const src = fs.readFileSync(full, "utf8");
          if (/\bResilientSignal\b|resilient-signal/.test(src)) acc.push(full);
        }
      }
    }
    const matches: string[] = [];
    for (const r of roots) walk(r, matches);
    expect(matches, `Live call clients must not consume ResilientSignal · found in:\n${matches.join("\n")}`)
      .toEqual([]);
  });
});

// ─── E · Instantiation smoke (constructor + close idempotency) ───────

describe("E · ResilientSignal · instantiation smoke (uses global EventSource stub)", () => {
  it("constructs + exposes getState() + close() does not throw", () => {
    // We stub EventSource globally so the constructor can run without
    // a real browser. The connect() call will try to fetch /hello and
    // open the stream · we don't care about either side-effect, just
    // that the class API shape is preserved.
    class StubEventSource {
      onopen: (() => void) | null = null;
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      close(): void { /* noop */ }
    }
    // Also stub fetch so the /hello POST doesn't attempt a real network call.
    const originalFetch = globalThis.fetch;
    const originalEventSource = (globalThis as unknown as { EventSource?: unknown }).EventSource;
    (globalThis as unknown as { EventSource: unknown }).EventSource = StubEventSource as unknown;
    globalThis.fetch = (async () => new Response(null, { status: 200 })) as typeof fetch;
    try {
      const seen: SignalConnState[] = [];
      const s = new ResilientSignal({
        identity: "self-abc",
        signalBase: "http://localhost:9999",
        onMessage: () => {},
        onConnectionState: (state) => seen.push(state),
      });
      // Initial state is "connecting" (field initialiser) · the first
      // setState("connecting") is a no-op per the sealed de-dupe guard
      // (`if (this.state === next) return;`), so onConnectionState does
      // NOT fire for the initial state. getState() still returns it.
      expect(s.getState()).toBe("connecting");
      expect(seen).not.toContain("connecting"); // no spurious notification
      expect(() => s.close()).not.toThrow();
      expect(s.getState()).toBe("closed");
      expect(seen).toContain("closed"); // close() fires the transition
      // close() called twice must stay idempotent.
      expect(() => s.close()).not.toThrow();
      // State remains "closed" (no spurious transitions on second close).
      expect(s.getState()).toBe("closed");
    } finally {
      if (originalEventSource === undefined) {
        delete (globalThis as unknown as Record<string, unknown>).EventSource;
      } else {
        (globalThis as unknown as { EventSource: unknown }).EventSource = originalEventSource;
      }
      globalThis.fetch = originalFetch;
    }
  });
});
