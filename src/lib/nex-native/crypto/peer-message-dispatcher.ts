// src/lib/nex-native/crypto/peer-message-dispatcher.ts
//
// NEX device-key chat · single-entry-point client dispatcher.
// Owner-authorised 2026-11-10 · integration of the already-built
// crypto primitives (device-key, shared-secret, fan-out-planner,
// device-key-cache-v2) into the encrypted send path.
// -----------------------------------------------------------------
// Scope:
//   1. Resolve recipient active device-key list via server endpoint
//      (/api/nex-native/peer-message/device-keys/[peerAccountId]
//      · server applies retired_at filter when mig 323 is present).
//   2. Feed into fan-out-planner.planFanOut() for the deterministic
//      N-row plan.
//   3. For each row · derive the per-pair shared secret via
//      shared-secret.getSharedSecret + encrypt the plaintext with
//      shared-secret.sealWithSharedSecret.
//   4. Collect (ciphertext, nonce, recipient_device_id,
//      sender_device_id) tuples.
//   5. POST the N-row batch to the batch endpoint in a single call.
//
// Invariants preserved:
//   · I-1 · no server retention of readable content · only ciphertext
//     is shipped · plaintext never leaves this process.
//   · I-2 · the batch endpoint writes rows atomically · no queue /
//     stash / forward is introduced · one logical send → one HTTP POST.
//   · I-3 · plaintext send path is NOT invoked here · the dispatcher
//     refuses to run when the peer has no active device keys.
//   · I-4 · the fan-out plan is deterministic so retries land on the
//     same rows · the batch endpoint is idempotent on message_group_id.
//   · I-5 · no rollback restores private content · the dispatcher is
//     stateless · a crash mid-dispatch leaves no server-side artefact.
//   · I-6 · the batch endpoint writes all N rows atomically.
//
// Pure logic · delegates crypto to sealed primitives · imports
// nothing from attachment-envelope (attachments flow via a separate
// encrypted-attachment-uploader).

"use client";

import naclUtil from "tweetnacl-util";
import { ensureDeviceKey, publicKeyBase64 } from "./device-key";
import {
  generateNonce,
  getSharedSecret,
  sealWithSharedSecret,
} from "./shared-secret";
import {
  planFanOut,
  type FanOutDevice,
  type FanOutRow,
} from "./fan-out-planner";

export interface DispatchOptions {
  conversationId: string;
  senderAccountId: string;
  recipientAccountId: string;
  plaintext: string;
  replyToId?: string | null;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentMeta?: unknown;
  /** Optional fetch override · test injection point. */
  fetchImpl?: typeof fetch;
  /** Optional device-list override · when provided the dispatcher
   *  skips the device-keys endpoint call and uses these lists
   *  verbatim · used by unit tests to keep the dispatcher pure. */
  peerDevicesOverride?: FanOutDevice[];
  senderDevicesOverride?: FanOutDevice[];
}

export interface DispatchBatchRow {
  conversation_id: string;
  sender_account_id: string;
  ciphertext_b64: string;
  nonce_b64: string;
  sender_public_key: string;
  sender_device_id: string;
  recipient_account_id: string;
  recipient_device_id: string;
  reply_to_id: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_meta: unknown;
}

export type DispatchResult =
  | {
      ok: true;
      message_group_id: string;
      rows_written: number;
    }
  | {
      ok: false;
      error:
        | "no_peer_devices"
        | "no_sender_devices"
        | "device_keys_fetch_failed"
        | "encrypt_failed"
        | "http_failed"
        | "not_wired";
      detail?: string;
    };

interface DeviceKeyEndpointResponse {
  ok: true;
  devices: Array<{ device_id: string; public_key: string }>;
  expires_at: string;
}

/** Fetch active device keys for an account via the server endpoint. */
async function fetchDeviceKeys(
  accountId: string,
  fetchImpl: typeof fetch,
): Promise<FanOutDevice[] | null> {
  try {
    const resp = await fetchImpl(
      `/api/nex-native/peer-message/device-keys/${encodeURIComponent(accountId)}`,
      { method: "GET", headers: { accept: "application/json" } },
    );
    if (!resp.ok) return null;
    const json = (await resp.json()) as DeviceKeyEndpointResponse | { ok: false };
    if (!json || !("ok" in json) || !json.ok) return null;
    return json.devices.map((d) => ({
      account_id: accountId,
      device_id: d.device_id,
      public_key: d.public_key,
    }));
  } catch {
    return null;
  }
}

/** Single entry-point for sending an E2E-encrypted peer message. */
export async function dispatchEncryptedPeerMessage(
  opts: DispatchOptions,
): Promise<DispatchResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;

  // Step 1 · device-key lists.
  const peerDevices =
    opts.peerDevicesOverride ??
    (await fetchDeviceKeys(opts.recipientAccountId, fetchImpl));
  if (!peerDevices) {
    return { ok: false, error: "device_keys_fetch_failed" };
  }
  if (peerDevices.length === 0) {
    return { ok: false, error: "no_peer_devices" };
  }
  const senderDevices =
    opts.senderDevicesOverride ??
    (await fetchDeviceKeys(opts.senderAccountId, fetchImpl));
  if (!senderDevices) {
    return { ok: false, error: "device_keys_fetch_failed" };
  }

  // Step 2 · ensure sender's own keypair exists + plan the fan-out.
  const self = await ensureDeviceKey();
  const selfPubB64 = publicKeyBase64(self.publicKey);

  const plan = planFanOut({
    sender_account_id: opts.senderAccountId,
    sender_device_id: self.deviceId,
    peer_devices: peerDevices,
    sender_devices: senderDevices,
  });

  if (plan.peer_row_count === 0) {
    return { ok: false, error: "no_peer_devices" };
  }

  // Step 3 + 4 · encrypt once per planned row.
  const messageGroupId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const plaintextBytes = naclUtil.decodeUTF8(opts.plaintext);
  const batchRows: DispatchBatchRow[] = [];

  try {
    for (const row of plan.rows as FanOutRow[]) {
      const secret = getSharedSecret(
        self.secretKey,
        row.recipient_account_id,
        row.recipient_device_id,
        row.recipient_public_key,
      );
      const nonce = generateNonce();
      const ct = sealWithSharedSecret(plaintextBytes, nonce, secret);
      batchRows.push({
        conversation_id: opts.conversationId,
        sender_account_id: opts.senderAccountId,
        ciphertext_b64: naclUtil.encodeBase64(ct),
        nonce_b64: naclUtil.encodeBase64(nonce),
        sender_public_key: selfPubB64,
        sender_device_id: self.deviceId,
        recipient_account_id: row.recipient_account_id,
        recipient_device_id: row.recipient_device_id,
        reply_to_id: opts.replyToId ?? null,
        attachment_url: opts.attachmentUrl ?? null,
        attachment_type: opts.attachmentType ?? null,
        attachment_meta: opts.attachmentMeta ?? null,
      });
    }
  } catch (e) {
    return {
      ok: false,
      error: "encrypt_failed",
      detail: (e as Error).message,
    };
  }

  // Step 5 · POST the batch.
  try {
    const resp = await fetchImpl(
      "/api/nex-native/peer-message/encrypted/batch",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message_group_id: messageGroupId,
          rows: batchRows,
        }),
      },
    );
    if (!resp.ok) {
      return {
        ok: false,
        error: "http_failed",
        detail: `${resp.status} ${resp.statusText}`,
      };
    }
    const json = (await resp.json()) as {
      ok: boolean;
      message_group_id?: string;
      rows_written?: number;
      error?: string;
    };
    if (!json.ok) {
      return { ok: false, error: "http_failed", detail: json.error };
    }
    return {
      ok: true,
      message_group_id: json.message_group_id ?? messageGroupId,
      rows_written: json.rows_written ?? batchRows.length,
    };
  } catch (e) {
    return {
      ok: false,
      error: "http_failed",
      detail: (e as Error).message,
    };
  }
}
