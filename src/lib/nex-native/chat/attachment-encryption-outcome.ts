// src/lib/nex-native/chat/attachment-encryption-outcome.ts
//
// NEX Chat · attachment encryption outcome types (Phase 1 fail-closed).
// Owner-authorised 2026-11-07.
// -----------------------------------------------------------------------------
// Single-source-of-truth types for the encryption attempt outcome. The
// capture surface + the composer both import from this module so their
// branching stays identical and the tests can exercise the exact
// shapes.
//
// Core principle (owner-sealed 2026-11-07):
//   Encryption failure must never silently become an unencrypted upload.
//
// The outcome discriminator is `kind`. There are exactly three terminal
// states:
//
//   · "encrypted"  · ciphertext was uploaded, caller may proceed to send.
//   · "blocked"    · encryption did not complete. The attachment has NOT
//                    been uploaded via any path. Caller must present the
//                    user with an explicit choice (retry, send as standard,
//                    cancel) · the user picks; the client does NOT choose.
//   · "cancelled"  · the user cancelled before a send. No upload occurred.
//
// There is NO fourth state where the client silently downgrades to
// plaintext. The caller MAY offer a user-triggered plaintext path via the
// "blocked" prompt, but it must be an explicit tap, not a fallthrough.

export type AttachmentBlockReason =
  /** The encryption helper (encryptFileBytes / nacl.secretbox) threw.
   *  Caller shows "Encryption didn't complete. Your attachment hasn't
   *  been sent." with Retry / Send as standard / Cancel. */
  | "encrypt-threw"
  /** Encryption succeeded but the POST to the ciphertext endpoint
   *  returned a non-2xx. Caller shows the same prompt as encrypt-threw
   *  · Retry is the most likely to succeed. */
  | "upload-failed"
  /** The attachment's MIME is not supported by the current encrypted
   *  pipeline (documents · PDFs, DOC, zips, etc.). Phase 3 will close
   *  this gap. Until then the caller shows "Documents aren't encrypted
   *  yet" with Send-as-standard / Cancel. No Retry (it would fail). */
  | "unsupported-mime"
  /** The caller's own device_key is missing · the key material hasn't
   *  landed in this browser yet. Caller offers Retry (wait for key) /
   *  Send as standard / Cancel. */
  | "sender-key-missing"
  /** The recipient has no active device_key · no device can decrypt
   *  what we'd upload. Caller offers Send as standard / Cancel. */
  | "recipient-key-missing"
  /** The encryption attempt took too long · typically a wedged nacl
   *  path or a hung upload. Caller offers Retry / Cancel. */
  | "timeout"
  /** The encrypted upload route returned a well-formed success but
   *  the storage URL was empty or malformed · defensive. Caller
   *  offers Retry / Cancel. No Send-as-standard (something is
   *  fundamentally wrong). */
  | "invalid-output";

export interface AttachmentEncryptedOutcome {
  readonly kind: "encrypted";
  readonly storageUrl: string;
  readonly storagePath: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly attachmentKind: "image" | "video" | "audio";
  readonly contentKey: Uint8Array;
  readonly contentNonce: Uint8Array;
}

export interface AttachmentBlockedOutcome {
  readonly kind: "blocked";
  readonly reason: AttachmentBlockReason;
  readonly captureKind: "camera" | "video" | "voice" | "document";
  /** Preserved for the retry path. The caller passes this back into
   *  the encryption helper when the user taps Retry. */
  readonly file: File;
  /** Optional telemetry · never shown to the user. Internal detail
   *  (HTTP status, exception name) may appear here but the UI message
   *  comes from a separate copy table so we don't leak it. */
  readonly telemetry?: string;
}

export interface AttachmentCancelledOutcome {
  readonly kind: "cancelled";
}

export type AttachmentEncryptionOutcome =
  | AttachmentEncryptedOutcome
  | AttachmentBlockedOutcome
  | AttachmentCancelledOutcome;

/** User-facing copy for every block reason. Kept here so the composer
 *  surface renders the same text the tests assert against. Copy is
 *  deliberately plain · no jargon, no raw error text. Never mentions
 *  internal implementation (nacl, secretbox, storage URL, etc.). */
export const BLOCK_COPY: Record<
  AttachmentBlockReason,
  { title: string; body: string; allowRetry: boolean; allowSendStandard: boolean }
> = {
  "encrypt-threw": {
    title: "We couldn't encrypt this attachment",
    body:
      "Your attachment has NOT been sent. You can try again, send it as a standard message (not encrypted), or cancel.",
    allowRetry: true,
    allowSendStandard: true,
  },
  "upload-failed": {
    title: "Upload didn't complete",
    body:
      "The encrypted upload didn't reach the server. Your attachment has NOT been sent. Try again, send it as a standard message (not encrypted), or cancel.",
    allowRetry: true,
    allowSendStandard: true,
  },
  "unsupported-mime": {
    title: "Documents aren't encrypted yet",
    body:
      "Encrypted document attachments are coming in a future update. For now you can send this as a standard message (not encrypted), or cancel.",
    allowRetry: false,
    allowSendStandard: true,
  },
  "sender-key-missing": {
    title: "Your device isn't ready yet",
    body:
      "Your encryption key hasn't finished setting up on this device. Your attachment has NOT been sent. Try again in a moment, send it as a standard message (not encrypted), or cancel.",
    allowRetry: true,
    allowSendStandard: true,
  },
  "recipient-key-missing": {
    title: "This contact's device isn't ready",
    body:
      "They haven't opened NEX on a device that supports encrypted attachments yet. Your attachment has NOT been sent. You can send it as a standard message (not encrypted), or cancel.",
    allowRetry: false,
    allowSendStandard: true,
  },
  timeout: {
    title: "That took too long",
    body:
      "The encryption step didn't complete in time. Your attachment has NOT been sent. Try again or cancel.",
    allowRetry: true,
    allowSendStandard: false,
  },
  "invalid-output": {
    title: "Something didn't look right",
    body:
      "The upload came back incomplete. Your attachment has NOT been sent. Try again or cancel.",
    allowRetry: true,
    allowSendStandard: false,
  },
};
