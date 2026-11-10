// src/lib/nex-native/crypto/fan-out-planner.ts
//
// NEX device-key chat · pure fan-out row planner.
// Owner-authorised 2026-11-10 (independent component · does NOT
// depend on any of the six open decisions in
// device-key-chat-decisions-2026-11-10.md).
// -----------------------------------------------------------------
// Given a sender's message intent + a list of recipient device
// public keys, compute the N-row fan-out plan:
//   · one row per recipient device
//   · one self-echo row per OTHER sender device (sibling browsers of
//     the current sender device)
//
// Pure function. No I/O, no DB, no crypto. Takes already-fetched
// device lists and returns a deterministically ordered plan that
// higher-level code can zip with ciphertext/nonce to produce the
// actual insert rows.
//
// Deterministic ordering for test friendliness:
//   1. Recipient devices first, sorted by recipient_device_id.
//   2. Self-echo rows next, sorted by sender's other-device_id.
//
// Self-echo rule:
//   · The sender's current device (the one running this code) is
//     NOT a target · the sender already knows its own plaintext and
//     renders optimistically. Writing a self-echo row for the current
//     device would just be unused storage.
//   · Every OTHER device owned by the sender gets a self-echo row so
//     the sender's second-browser can render history after a reload.

export type FanOutRole = "peer" | "self";

export interface FanOutDevice {
  account_id: string;
  device_id: string;
  public_key: string;
}

export interface FanOutRow {
  role: FanOutRole;
  recipient_account_id: string;
  recipient_device_id: string;
  recipient_public_key: string;
}

export interface FanOutPlanInput {
  sender_account_id: string;
  /** The device_id of the browser calling this function · will be
   *  excluded from the self-echo list so the sender does not write
   *  a redundant row addressed to itself. */
  sender_device_id: string;
  /** All peer devices registered for the recipient account. One row
   *  per entry will be produced. */
  peer_devices: FanOutDevice[];
  /** All sender's OWN devices (including the current one). The
   *  current device is removed by this function; every other sender
   *  device becomes a self-echo row. */
  sender_devices: FanOutDevice[];
}

export interface FanOutPlan {
  rows: FanOutRow[];
  peer_row_count: number;
  self_row_count: number;
}

/** Produce a deterministically ordered fan-out plan.
 *
 *  Invariants:
 *   · order is (peer rows sorted by recipient_device_id) then
 *     (self-echo rows sorted by recipient_device_id)
 *   · the sender's current device never appears as a row
 *   · duplicate device_id entries on either side are deduplicated
 *     (first wins) so a buggy upstream list cannot create double
 *     writes */
export function planFanOut(input: FanOutPlanInput): FanOutPlan {
  const peerRows: FanOutRow[] = [];
  const peerSeen = new Set<string>();
  for (const d of input.peer_devices) {
    if (peerSeen.has(d.device_id)) continue;
    peerSeen.add(d.device_id);
    peerRows.push({
      role: "peer",
      recipient_account_id: d.account_id,
      recipient_device_id: d.device_id,
      recipient_public_key: d.public_key,
    });
  }
  peerRows.sort((a, b) =>
    a.recipient_device_id < b.recipient_device_id ? -1 :
    a.recipient_device_id > b.recipient_device_id ? 1 : 0,
  );

  const selfRows: FanOutRow[] = [];
  const selfSeen = new Set<string>();
  for (const d of input.sender_devices) {
    if (d.device_id === input.sender_device_id) continue;
    if (selfSeen.has(d.device_id)) continue;
    selfSeen.add(d.device_id);
    selfRows.push({
      role: "self",
      recipient_account_id: d.account_id,
      recipient_device_id: d.device_id,
      recipient_public_key: d.public_key,
    });
  }
  selfRows.sort((a, b) =>
    a.recipient_device_id < b.recipient_device_id ? -1 :
    a.recipient_device_id > b.recipient_device_id ? 1 : 0,
  );

  return {
    rows: [...peerRows, ...selfRows],
    peer_row_count: peerRows.length,
    self_row_count: selfRows.length,
  };
}
