// src/lib/nex-native/location/fuzz.ts
//
// NEX Location Sharing · Phase 1A · 250m grid-cell fuzzing + jitter.
// Owner-authorised 2026-11-05.
// -----------------------------------------------------------------------------
// Transforms a sender's exact GPS into a (cell_center_lat, cell_center_lng)
// where only the jittered center ever leaves the device. The original
// GPS coordinates are passed in, used to compute the cell, and then
// DISCARDED · callers MUST NOT serialise the input coords anywhere.
//
// Key design:
//   · 250m cells (sealed; condition from owner).
//   · Per-session random origin salt (8 CSPRNG bytes) so an attacker who
//     captures multiple shares across sessions cannot align cell grids.
//   · Per-share jitter offset (uniform random within ±45% of cell size)
//     so repeat shares from the exact same spot produce different cell
//     centers within the same cell. Prevents cell-center alignment attack.
//   · Rate limit: 1 Nearby share / 15 min per (sender, peer) · client-side
//     enforcement via timestamp check in session storage.
//
// This module is PURE · no side effects · no browser APIs · fully
// unit-testable with injected salt + jitter bytes.

const CELL_SIZE_M = 250 as const;
const METERS_PER_DEGREE_LAT = 111_320; // approx WGS84 at equator

export interface SessionSalt {
  /** 8 CSPRNG bytes · deterministic per (sender, conversation) · rotates
   *  after 1h idle or on user "reset fuzz" action. */
  readonly bytes: Uint8Array;
}

export interface FuzzInput {
  readonly lat: number;
  readonly lng: number;
  readonly salt: SessionSalt;
  /** 8 CSPRNG bytes · fresh per share · drives jitter offset within cell. */
  readonly jitterSeed: Uint8Array;
}

export interface FuzzOutput {
  readonly cellCenterLat: number;
  readonly cellCenterLng: number;
  /** Always 250 in v1A · included so callers can pass through to payload. */
  readonly cellSizeM: 250;
}

/** Compute the jittered cell center for a sender's GPS. The returned
 *  numbers are the ONLY coordinates that may leave the device. */
export function fuzzToCell(input: FuzzInput): FuzzOutput {
  const { lat, lng, salt, jitterSeed } = input;

  // Cell size in degrees · latitude is constant, longitude depends on lat.
  const latRad = (lat * Math.PI) / 180;
  const cellLatDeg = CELL_SIZE_M / METERS_PER_DEGREE_LAT;
  const cellLngDeg =
    CELL_SIZE_M / (METERS_PER_DEGREE_LAT * Math.max(Math.cos(latRad), 1e-6));

  // Per-session grid origin offset in [0, 1) derived from salt bytes 0-3
  // (lng) and 4-7 (lat). Full 32-bit precision each.
  const originX = bytesToUnitInterval(salt.bytes, 0);
  const originY = bytesToUnitInterval(salt.bytes, 4);

  // Snap to cell.
  const cellX = Math.floor((lng - originX * cellLngDeg) / cellLngDeg);
  const cellY = Math.floor((lat - originY * cellLatDeg) / cellLatDeg);

  // Cell center in geographic coordinates.
  const centerLng = (cellX + 0.5 + originX) * cellLngDeg;
  const centerLat = (cellY + 0.5 + originY) * cellLatDeg;

  // Per-share jitter · uniform within [-0.45, +0.45] of cell size. The
  // 0.45 (vs 0.5) keeps the jittered center strictly inside the cell so
  // the cell structure stays hidden.
  const jitterX = (bytesToUnitInterval(jitterSeed, 0) - 0.5) * 0.9;
  const jitterY = (bytesToUnitInterval(jitterSeed, 4) - 0.5) * 0.9;

  const cellCenterLng = centerLng + jitterX * cellLngDeg;
  const cellCenterLat = centerLat + jitterY * cellLatDeg;

  return {
    cellCenterLat,
    cellCenterLng,
    cellSizeM: CELL_SIZE_M,
  };
}

/** Rate limit · returns true if a Nearby share is permitted right now.
 *  Caller supplies the last-share timestamp (from session storage) and
 *  the current time · pure function · no side effects. */
export function nearbyRateLimit(args: {
  readonly lastShareAtMs: number | null;
  readonly nowMs: number;
  readonly windowMs?: number;
}): { allowed: boolean; retryAfterMs: number } {
  const windowMs = args.windowMs ?? 15 * 60 * 1000;
  if (args.lastShareAtMs === null) {
    return { allowed: true, retryAfterMs: 0 };
  }
  const since = args.nowMs - args.lastShareAtMs;
  if (since >= windowMs) return { allowed: true, retryAfterMs: 0 };
  return { allowed: false, retryAfterMs: windowMs - since };
}

/** Generate a fresh session salt · uses crypto.getRandomValues. Caller
 *  persists the result in IndexedDB. */
export function generateSessionSalt(): SessionSalt {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return { bytes };
}

/** Generate a per-share jitter seed. */
export function generateJitterSeed(): Uint8Array {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/** Read a 4-byte slice and return a value in [0, 1). */
function bytesToUnitInterval(bytes: Uint8Array, offset: number): number {
  if (bytes.length < offset + 4) {
    throw new Error("bytesToUnitInterval: insufficient bytes");
  }
  const u32 =
    bytes[offset]! * 0x1_00_00_00 +
    bytes[offset + 1]! * 0x1_00_00 +
    bytes[offset + 2]! * 0x1_00 +
    bytes[offset + 3]!;
  return u32 / 0x1_00_00_00_00;
}
