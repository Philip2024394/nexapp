// Phase 1A fuzz · unit tests · deterministic jitter + cell size.

import { describe, test, expect } from "vitest";
import {
  fuzzToCell,
  nearbyRateLimit,
  type SessionSalt,
} from "../fuzz";

function salt(bytes: number[]): SessionSalt {
  return { bytes: new Uint8Array(bytes) };
}

describe("fuzzToCell · 250m grid", () => {
  const zeroSalt = salt([0, 0, 0, 0, 0, 0, 0, 0]);
  const zeroJitter = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
  const maxJitter = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]);

  test("Dublin GPS produces a cell inside Dublin area (~500m radius)", () => {
    const dublin = { lat: 53.3498, lng: -6.26 };
    const out = fuzzToCell({
      ...dublin,
      salt: zeroSalt,
      jitterSeed: zeroJitter,
    });
    expect(Math.abs(out.cellCenterLat - dublin.lat)).toBeLessThan(0.005);
    expect(Math.abs(out.cellCenterLng - dublin.lng)).toBeLessThan(0.008);
    expect(out.cellSizeM).toBe(250);
  });

  test("different jitter seeds produce different cell centers within same cell", () => {
    const dublin = { lat: 53.3498, lng: -6.26 };
    const a = fuzzToCell({ ...dublin, salt: zeroSalt, jitterSeed: zeroJitter });
    const b = fuzzToCell({ ...dublin, salt: zeroSalt, jitterSeed: maxJitter });
    expect(a.cellCenterLat).not.toBe(b.cellCenterLat);
    expect(a.cellCenterLng).not.toBe(b.cellCenterLng);
    // Jittered centers still within one cell · ~250m lat diff cap.
    const latDeg = 250 / 111_320;
    expect(Math.abs(a.cellCenterLat - b.cellCenterLat)).toBeLessThan(latDeg);
  });

  test("different session salts produce different cells for same spot", () => {
    const dublin = { lat: 53.3498, lng: -6.26 };
    const saltA = salt([0, 0, 0, 0, 0, 0, 0, 0]);
    const saltB = salt([255, 128, 64, 32, 200, 100, 50, 25]);
    const a = fuzzToCell({ ...dublin, salt: saltA, jitterSeed: zeroJitter });
    const b = fuzzToCell({ ...dublin, salt: saltB, jitterSeed: zeroJitter });
    // At minimum the cell center differs · prevents cross-session alignment.
    expect(a.cellCenterLat !== b.cellCenterLat || a.cellCenterLng !== b.cellCenterLng).toBe(true);
  });

  test("latitude-dependent cell size does not break at high latitudes", () => {
    const tromso = { lat: 69.65, lng: 18.95 };
    const out = fuzzToCell({
      ...tromso,
      salt: zeroSalt,
      jitterSeed: zeroJitter,
    });
    expect(Number.isFinite(out.cellCenterLat)).toBe(true);
    expect(Number.isFinite(out.cellCenterLng)).toBe(true);
  });
});

describe("nearbyRateLimit", () => {
  test("first share always allowed", () => {
    const r = nearbyRateLimit({ lastShareAtMs: null, nowMs: 1_000 });
    expect(r.allowed).toBe(true);
  });

  test("blocks within 15 min window", () => {
    const r = nearbyRateLimit({
      lastShareAtMs: 1_000_000,
      nowMs: 1_000_000 + 5 * 60_000,
    });
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  test("permits after 15 min window", () => {
    const r = nearbyRateLimit({
      lastShareAtMs: 1_000_000,
      nowMs: 1_000_000 + 16 * 60_000,
    });
    expect(r.allowed).toBe(true);
  });
});
