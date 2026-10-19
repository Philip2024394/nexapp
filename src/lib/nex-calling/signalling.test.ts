// src/lib/nex-calling/signalling.test.ts
//
// NEX Calling · Signalling routing integration tests · Philip 2026-08-27.
// Phase 7 realignment 2026-10-19 · explicit opt-in via NEX_SIGNAL_UP=1.
//
// This is an INTEGRATION suite that requires a running `signal.mjs`
// server over HTTP + SSE. Running it without the server previously
// produced four unconditional test failures every time
// `npm run test` executed (per the Priority 2 baseline).
//
// New opt-in contract (sealed 2026-10-19):
//
//   · Default behaviour · the whole describe block is SKIPPED when
//     the opt-in flag is not set. `npm run test` reports a clean
//     skip, NOT a failure.
//   · Opt-in · set `NEX_SIGNAL_UP=1` (and optionally
//     `NEX_CALL_SIGNAL_URL`) to run the real integration tests:
//
//         # 1 · in one terminal · start the signal server
//         node scripts/nex-calling/signal.mjs
//
//         # 2 · in another · run the integration suite
//         NEX_SIGNAL_UP=1 npx vitest run src/lib/nex-calling/signalling.test.ts
//
// This matches the Phase 7 directive · "Prefer an explicit opt-in
// integration-test configuration or a documented lifecycle hook
// rather than requiring developers to remember an undocumented
// background process."

import { describe, it, expect, beforeAll } from "vitest";

const SIGNAL_OPT_IN = process.env.NEX_SIGNAL_UP === "1";
const SIGNAL_BASE = process.env.NEX_CALL_SIGNAL_URL ?? "http://localhost:8090";

// When opt-in is set, probe once to confirm reachability. The probe
// result is a secondary guard · if the opt-in flag is set but the
// server is actually down, we fail LOUDLY so the author of the
// integration-run doesn't think they're testing something they aren't.
let signalUp = false;
beforeAll(async () => {
  if (!SIGNAL_OPT_IN) return;
  try {
    const r = await fetch(`${SIGNAL_BASE}/health`);
    signalUp = r.ok;
  } catch { signalUp = false; }
  if (!signalUp) {
    throw new Error(
      `NEX_SIGNAL_UP=1 was set but signal.mjs is not reachable at ${SIGNAL_BASE} ·` +
      ` start with: node scripts/nex-calling/signal.mjs`,
    );
  }
});

describe.skipIf(!SIGNAL_OPT_IN)("nex-calling · signalling routing · integration (opt-in NEX_SIGNAL_UP=1)", () => {
  it("responds to /health", async () => {
    const r = await fetch(`${SIGNAL_BASE}/health`);
    expect(r.ok).toBe(true);
    const j = await r.json();
    expect(j).toHaveProperty("ok", true);
    expect(j).toHaveProperty("uptime_sec");
  });

  it("accepts /hello and reports presence", async () => {
    const id = `test-${Date.now()}-hello`;
    const r = await fetch(`${SIGNAL_BASE}/hello`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identity: id }),
    });
    expect(r.ok).toBe(true);
  });

  it("routes /send from A to B and delivers via SSE stream", async () => {
    const a = `test-${Date.now()}-A`;
    const b = `test-${Date.now()}-B`;
    // both hello
    await fetch(`${SIGNAL_BASE}/hello`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity: a }) });
    await fetch(`${SIGNAL_BASE}/hello`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity: b }) });

    // B opens SSE stream and waits for one message
    const bStream = await openStream(`${SIGNAL_BASE}/stream/${encodeURIComponent(b)}`);
    const gotMessage = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => { bStream.abort(); reject(new Error("timeout waiting for delivered message")); }, 4000);
      bStream.on((msg) => {
        // Skip presence broadcast; wait for the sdp-offer we send below.
        if (msg?.type === "sdp-offer") { clearTimeout(timer); bStream.abort(); resolve(msg); }
      });
    });

    // A sends sdp-offer to B
    const sendRes = await fetch(`${SIGNAL_BASE}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: a, to: b, type: "sdp-offer", payload: { sdp: "fake-sdp", callId: "test-call" } }),
    });
    expect(sendRes.ok).toBe(true);

    const delivered = await gotMessage;
    expect(delivered.type).toBe("sdp-offer");
    expect(delivered.from).toBe(a);
    expect(delivered.payload?.sdp).toBe("fake-sdp");
  });

  it("/presence lists online identities", async () => {
    const r = await fetch(`${SIGNAL_BASE}/presence`);
    expect(r.ok).toBe(true);
    const j = await r.json();
    expect(j).toHaveProperty("online");
    expect(Array.isArray(j.online)).toBe(true);
  });
});

// ── minimal SSE helper for node fetch streaming ─────────────────────────
async function openStream(url: string): Promise<{ on: (fn: (msg: any) => void) => void; abort: () => void }> {
  const controller = new AbortController();
  const r = await fetch(url, { signal: controller.signal });
  if (!r.ok || !r.body) throw new Error(`SSE open failed: ${r.status}`);
  const listeners: Array<(msg: any) => void> = [];
  (async () => {
    const reader = r.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        for (;;) {
          const nlnl = buf.indexOf("\n\n");
          if (nlnl < 0) break;
          const chunk = buf.slice(0, nlnl);
          buf = buf.slice(nlnl + 2);
          const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          try {
            const msg = JSON.parse(dataLine.slice(5).trim());
            for (const fn of listeners) fn(msg);
          } catch { /* ignore */ }
        }
      }
    } catch { /* aborted */ }
  })().catch(() => { /* silent */ });
  return {
    on: (fn) => listeners.push(fn),
    abort: () => controller.abort(),
  };
}
