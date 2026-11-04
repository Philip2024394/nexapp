// src/lib/nex-native/location/broadcast.ts
//
// NEX Location Sharing · Phase 1A · Realtime broadcast wrapper.
// Owner-authorised 2026-11-05.
// -----------------------------------------------------------------------------
// Thin wrapper around openNexChannel() scoped to nex:loc:{conversationId}.
// Envelope carries one ciphertext per recipient device so unauthorised
// subscribers (hypothetical · the channel name is UUIDv4 random) receive
// opaque bytes with no decryption capability.
//
// Payload persistence: NONE. Supabase Realtime broadcasts are ephemeral
// per the sealed wrapper config ({broadcast: {self:false, ack:false}}).
// Nothing survives server-side beyond the broadcast moment.
//
// Honest delivery posture:
//   · No ACK in Phase 1A · sender bubble shows "waiting" state until
//     either (a) user manually re-sends and recipient comes online, OR
//     (b) TTL expires and bubble shows "delivery timed out".
//   · The owner emphasised: a successful broadcast call is NOT proof of
//     delivery. We never flip a bubble to "delivered" without evidence.

"use client";

import {
  openNexChannel,
  type NexChannelHandle,
  type BroadcastEnvelope,
} from "@/lib/nex-native/realtime/channel";

export interface LocationRecipientCiphertext {
  readonly recipient_device_id: string;
  readonly ciphertext_b64: string;
  readonly nonce_b64: string;
}

export interface LocationBroadcastEnvelope {
  /** Stable id across retries · uuidv4 · lets recipient de-dupe retries
   *  (same logical share rebroadcast still produces different nonces,
   *  but logical_id can be used client-side to collapse bubble state). */
  readonly logical_id: string;
  readonly sender_account_id: string;
  readonly sender_device_id: string;
  readonly sender_public_key_b64: string;
  readonly recipients: ReadonlyArray<LocationRecipientCiphertext>;
  /** ISO 8601 · UPDATED per retry attempt · recipient freshness window
   *  applies to THIS field, not the payload's captured_at. */
  readonly broadcast_at: string;
}

export interface OpenLocationChannelOptions {
  readonly conversationId: string;
  readonly selfAccountId: string;
  readonly onBroadcast?: (envelope: LocationBroadcastEnvelope) => void;
  readonly onError?: (err: string) => void;
}

export interface LocationChannelHandle {
  broadcast(envelope: LocationBroadcastEnvelope): Promise<void>;
  close(): Promise<void>;
}

/** Open a location channel for a conversation · subscribes for receive
 *  + returns a broadcast handle · caller MUST call close() on unmount. */
export function openLocationChannel(
  opts: OpenLocationChannelOptions,
): LocationChannelHandle {
  const channelName = `loc:${opts.conversationId}`;
  const handle: NexChannelHandle = openNexChannel({
    name: channelName,
    selfId: opts.selfAccountId,
    onBroadcast: (_event, msg: BroadcastEnvelope) => {
      if (!opts.onBroadcast) return;
      const envelope = msg.payload as unknown;
      if (!isValidEnvelope(envelope)) return;
      opts.onBroadcast(envelope);
    },
    onError: (err) => opts.onError?.(err),
  });

  return {
    async broadcast(envelope: LocationBroadcastEnvelope): Promise<void> {
      if (!isValidEnvelope(envelope)) {
        throw new Error("broadcast: invalid envelope shape");
      }
      await handle.broadcast(
        "location",
        envelope as unknown as Record<string, unknown>,
      );
    },
    async close(): Promise<void> {
      await handle.close();
    },
  };
}

function isValidEnvelope(x: unknown): x is LocationBroadcastEnvelope {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (
    typeof o.logical_id !== "string" ||
    typeof o.sender_account_id !== "string" ||
    typeof o.sender_device_id !== "string" ||
    typeof o.sender_public_key_b64 !== "string" ||
    typeof o.broadcast_at !== "string"
  ) {
    return false;
  }
  if (!Array.isArray(o.recipients)) return false;
  for (const r of o.recipients as unknown[]) {
    if (!r || typeof r !== "object") return false;
    const ro = r as Record<string, unknown>;
    if (
      typeof ro.recipient_device_id !== "string" ||
      typeof ro.ciphertext_b64 !== "string" ||
      typeof ro.nonce_b64 !== "string"
    ) {
      return false;
    }
  }
  return true;
}
