// src/lib/nex-native/location/payload.ts
//
// NEX Location Sharing · Phase 1A · payload types + encode/decode.
// Owner-authorised 2026-11-05.
// -----------------------------------------------------------------------------
// The payload is the plaintext object encrypted on the sender's device
// before broadcast. Discriminated union lets the recipient switch on
// `kind` to render the correct bubble.
//
// IMPORTANT invariants:
//   · For "nearby" the ORIGINAL GPS coordinates NEVER appear here. Only
//     the sender-device-computed (fuzzed) cell centre with applied jitter.
//   · For "area" no coordinates appear AT ALL. Only area_code + label +
//     country_iso resolved locally against the bundled dataset.
//   · `captured_at` is the GPS acquisition time on the sender device ·
//     IMMUTABLE across retries · recipient reads this to render honest
//     staleness copy ("Captured 20 hours ago") without breaking the
//     per-attempt freshness window on `broadcast_at` (envelope field).

export type LocationPayload =
  | {
      readonly kind: "exact";
      readonly lat: number;
      readonly lng: number;
      readonly accuracy_m: number;
      readonly captured_at: string; // ISO 8601
      readonly v: 1;
    }
  | {
      readonly kind: "nearby";
      readonly cell_center_lat: number;
      readonly cell_center_lng: number;
      readonly cell_size_m: 250;
      readonly jitter_applied: true;
      readonly captured_at: string;
      readonly v: 1;
    }
  | {
      readonly kind: "area";
      readonly area_code: string;
      readonly area_label: string;
      readonly country_iso: string;
      readonly captured_at: string;
      readonly v: 1;
    };

/** Encode a payload to a Uint8Array for NaCl box. Canonical JSON · fields
 *  sorted · no indentation · so the sender device and any future server
 *  decoder agree on byte representation. */
export function encodePayload(payload: LocationPayload): Uint8Array {
  const canonical = sortedStringify(payload);
  return new TextEncoder().encode(canonical);
}

/** Decode raw Uint8Array back to a payload. Returns null if the shape is
 *  invalid · callers should silently drop invalid bodies rather than
 *  throwing (keeps the surface defensive against malformed broadcasts). */
export function decodePayload(bytes: Uint8Array): LocationPayload | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed: unknown = JSON.parse(text);
    if (!isValidPayload(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Runtime validation · narrows unknown to LocationPayload. Fields that
 *  match the spec exactly · rejects everything else. */
export function isValidPayload(x: unknown): x is LocationPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.v !== 1) return false;
  if (typeof o.captured_at !== "string") return false;
  if (o.kind === "exact") {
    return (
      isFiniteNumber(o.lat) &&
      o.lat as number >= -90 &&
      (o.lat as number) <= 90 &&
      isFiniteNumber(o.lng) &&
      (o.lng as number) >= -180 &&
      (o.lng as number) <= 180 &&
      isFiniteNumber(o.accuracy_m) &&
      (o.accuracy_m as number) >= 0
    );
  }
  if (o.kind === "nearby") {
    return (
      isFiniteNumber(o.cell_center_lat) &&
      isFiniteNumber(o.cell_center_lng) &&
      o.cell_size_m === 250 &&
      o.jitter_applied === true
    );
  }
  if (o.kind === "area") {
    return (
      typeof o.area_code === "string" &&
      (o.area_code as string).length > 0 &&
      typeof o.area_label === "string" &&
      (o.area_label as string).length > 0 &&
      typeof o.country_iso === "string" &&
      (o.country_iso as string).length === 2
    );
  }
  return false;
}

function isFiniteNumber(x: unknown): boolean {
  return typeof x === "number" && Number.isFinite(x);
}

/** Deterministic JSON stringify · keys sorted alphabetically at every
 *  level · guarantees byte-identical output for identical content so the
 *  encrypted payload is stable for a given input. */
function sortedStringify(x: unknown): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) {
    return "[" + x.map(sortedStringify).join(",") + "]";
  }
  const obj = x as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map(
    (k) => JSON.stringify(k) + ":" + sortedStringify(obj[k]),
  );
  return "{" + parts.join(",") + "}";
}
