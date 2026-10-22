// src/lib/nex-native/status-p2p/types.ts
//
// NEX Status P2P · shared message + list-item types.
//
// Scope (strict):
//   · Pure TypeScript types · no runtime imports · safe anywhere.
//   · Mirrors the on-wire payload that owner (StatusServeHost) and
//     viewer (StatusFetchClient) exchange over a pairwise WebRTC
//     data channel.
//
// Non-scope:
//   · No signalling type · signalling piggy-backs on the generic
//     CallSignal transport in `../realtime/signalling.ts`.
//   · No encryption envelope · pilot is plaintext over DTLS/SRTP
//     courtesy of WebRTC's built-in transport encryption. End-to-end
//     content encryption is a Phase 2 slice.

import type { StatusOverlay } from "../status-storage/types";

/**
 * One row returned by the owner in response to a `status-list-request`.
 *
 * The viewer uses this to render a chapter list before fetching any
 * blob · the blob is only transferred on explicit `status-request`.
 */
export interface StatusListItem {
  statusId: string;
  kind: "image" | "video";
  overlays: StatusOverlay[];
  postedAtMs: number;
  expiresAtMs: number;
  mediaMimeType: string;
  mediaSizeBytes: number;
}

/**
 * Chunk size on the owner side. The viewer accepts any chunk size the
 * owner picks · this constant is exported so the owner-side host and
 * tests agree on the segmentation default. 16KB stays well under the
 * default SCTP message cap on all mainstream browsers.
 */
export const STATUS_P2P_CHUNK_BYTES = 16 * 1024;

/**
 * Discriminated union of every message exchanged on the pairwise
 * WebRTC data channel. All messages are JSON-encoded except for
 * `status-chunk`, whose `chunk` payload is an ArrayBuffer handled by
 * serialising the metadata header + the binary separately.
 *
 * On-wire framing:
 *   · JSON frames → `JSON.stringify(message)`.
 *   · Binary frames → an ArrayBuffer whose first 4 bytes encode the
 *     length of a UTF-8 JSON header (`{statusId, index, totalChunks}`)
 *     followed by the header bytes, followed by the chunk payload.
 */
export type StatusP2PMessage =
  | { type: "status-list-request" }
  | { type: "status-list-response"; items: StatusListItem[] }
  | { type: "status-request"; statusId: string }
  | {
      type: "status-chunk";
      statusId: string;
      index: number;
      totalChunks: number;
      chunk: ArrayBuffer;
    }
  | { type: "status-end"; statusId: string };

/**
 * Binary chunk header · what we embed in the pre-chunk prefix bytes.
 * Kept narrow so the encoder/decoder on both sides stays trivial.
 */
export interface StatusChunkHeader {
  type: "status-chunk";
  statusId: string;
  index: number;
  totalChunks: number;
}

/**
 * Encode a chunk into the on-wire ArrayBuffer framing used by both
 * owner and viewer sides.
 *
 * Layout:
 *   bytes 0..3   · uint32-be header length
 *   bytes 4..H   · UTF-8 JSON of StatusChunkHeader
 *   bytes H..end · raw chunk bytes
 */
export function encodeChunkFrame(
  header: StatusChunkHeader,
  chunk: ArrayBuffer,
): ArrayBuffer {
  const headerJson = JSON.stringify(header);
  const headerBytes = new TextEncoder().encode(headerJson);
  const total = 4 + headerBytes.byteLength + chunk.byteLength;
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  view.setUint32(0, headerBytes.byteLength, false);
  const u8 = new Uint8Array(out);
  u8.set(headerBytes, 4);
  u8.set(new Uint8Array(chunk), 4 + headerBytes.byteLength);
  return out;
}

/**
 * Decode an on-wire ArrayBuffer chunk frame back into the structured
 * message. Returns null if the buffer is malformed · callers treat
 * null as "ignore stale/garbled frame".
 */
export function decodeChunkFrame(
  buffer: ArrayBuffer,
): { header: StatusChunkHeader; chunk: ArrayBuffer } | null {
  if (buffer.byteLength < 4) return null;
  const view = new DataView(buffer);
  const headerLen = view.getUint32(0, false);
  if (headerLen <= 0 || 4 + headerLen > buffer.byteLength) return null;
  const headerBytes = new Uint8Array(buffer, 4, headerLen);
  let header: StatusChunkHeader;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(headerBytes)) as
      | StatusChunkHeader
      | null;
    if (
      !parsed ||
      parsed.type !== "status-chunk" ||
      typeof parsed.statusId !== "string" ||
      typeof parsed.index !== "number" ||
      typeof parsed.totalChunks !== "number"
    ) {
      return null;
    }
    header = parsed;
  } catch {
    return null;
  }
  const chunk = buffer.slice(4 + headerLen);
  return { header, chunk };
}
