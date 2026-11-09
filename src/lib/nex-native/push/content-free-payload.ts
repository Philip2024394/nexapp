// src/lib/nex-native/push/content-free-payload.ts
//
// Phase 2 Sprint 10 (DRAFT · not applied) · push notification payload
// builder. Produces a wake-up ping ONLY. Never contains message body,
// preview text, sender name, attachment info, or any PII.
//
// Sealed invariant service:
//   · I-1 · push notification payload is the LAST server-side touch
//     before a device receives data. If it leaks even a sender name,
//     the privacy claim fails at the lock-screen.
//   · The payload tells the device "wake up · check conversation X
//     for a new message." The device then pulls the actual message
//     via the WebRTC data channel. The lock-screen notification shown
//     to the user says generic text like "You have a new message".
//
// This module does NOT:
//   · Register for push (that's a client-side responsibility)
//   · Modify public/sw.js (sibling legacy product)
//   · Decide whether to send a push (service-layer decision)

import "server-only";

/** Content-free wake-up payload sent via APNS/FCM. */
export interface ContentFreePushPayload {
  /** Marker · identifies this as a NEX wake-up ping. */
  type: "nex_wakeup";
  /** Which conversation has something new · device looks up details. */
  conversation_id: string;
  /** Monotonic counter for dedup · NOT a timestamp that could identify
   *  patterns across users. */
  wakeup_sequence: number;
  /** Protocol version · enables future wake-up format changes without
   *  silently dropping old devices. */
  v: 1;
}

/** Keys that MUST NEVER appear in a push payload. If any match is
 *  found at build-time, buildPayload throws · defence against future
 *  copy-paste accidents introducing content. */
export const FORBIDDEN_PAYLOAD_KEYS: readonly string[] = [
  "body",
  "message",
  "text",
  "content",
  "preview",
  "ciphertext",
  "plaintext",
  "attachment",
  "sender_name",
  "sender_email",
  "sender_phone",
  "subject",
];

export interface BuildPayloadInput {
  conversation_id: string;
  wakeup_sequence: number;
}

/**
 * Build a content-free wake-up payload. Pure · deterministic.
 * Throws if the output contains any forbidden key (defence-in-depth).
 */
export function buildContentFreePushPayload(
  input: BuildPayloadInput,
): ContentFreePushPayload {
  if (!input.conversation_id || typeof input.conversation_id !== "string") {
    throw new Error("conversation_id required");
  }
  if (
    !Number.isInteger(input.wakeup_sequence) ||
    input.wakeup_sequence < 0 ||
    input.wakeup_sequence > Number.MAX_SAFE_INTEGER
  ) {
    throw new Error("wakeup_sequence must be a non-negative safe integer");
  }
  const payload: ContentFreePushPayload = {
    type: "nex_wakeup",
    conversation_id: input.conversation_id,
    wakeup_sequence: input.wakeup_sequence,
    v: 1,
  };
  assertNoForbiddenKeys(payload);
  return payload;
}

export function assertNoForbiddenKeys(payload: object): void {
  const keys = new Set(Object.keys(payload).map((k) => k.toLowerCase()));
  for (const forbidden of FORBIDDEN_PAYLOAD_KEYS) {
    if (keys.has(forbidden)) {
      throw new Error(`Forbidden key in push payload · "${forbidden}" · sealed I-1 violation`);
    }
  }
}

/**
 * Build an APNS (iOS) envelope · wraps the content-free payload in the
 * APNS "aps" + custom-data shape. The `alert` field is a generic string ·
 * never contains the conversation id (visible on lock screen) · never
 * contains any sender/content identifiable material.
 */
export function buildApnsEnvelope(payload: ContentFreePushPayload): {
  aps: { alert: string; "content-available": 1; sound: string };
  nex: ContentFreePushPayload;
} {
  return {
    aps: {
      alert: "You have a new message",
      "content-available": 1,
      sound: "default",
    },
    nex: payload,
  };
}

/**
 * Build an FCM (Android) envelope. Same discipline · the human-visible
 * `notification.body` is generic.
 */
export function buildFcmEnvelope(payload: ContentFreePushPayload): {
  notification: { title: string; body: string };
  data: Record<string, string>;
} {
  return {
    notification: {
      title: "NEX",
      body: "You have a new message",
    },
    data: {
      type: payload.type,
      conversation_id: payload.conversation_id,
      wakeup_sequence: String(payload.wakeup_sequence),
      v: String(payload.v),
    },
  };
}
