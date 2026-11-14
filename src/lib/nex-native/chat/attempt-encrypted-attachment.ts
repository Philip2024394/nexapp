// src/lib/nex-native/chat/attempt-encrypted-attachment.ts
//
// NEX Chat · encrypted attachment attempt with fail-closed outcomes.
// Owner-authorised 2026-11-07 (Chat Phase 1).
// -----------------------------------------------------------------------------
// Thin wrapper over `uploadEncryptedAttachment` that converts every
// failure mode into a typed outcome (see attachment-encryption-outcome.ts).
// The capture surface + the composer recorder path both call this
// function · neither contains an `else` branch that calls the plaintext
// uploadAction silently. If they want plaintext they must honour the
// user's explicit tap on "Send as standard" in the block prompt.

"use client";

import {
  uploadEncryptedAttachment,
  type UploadEncryptedAttachmentOptions,
} from "@/lib/nex-native/crypto/encrypted-attachment-upload";
import type {
  AttachmentBlockReason,
  AttachmentEncryptionOutcome,
} from "./attachment-encryption-outcome";

export interface AttemptOptions {
  readonly file: File;
  readonly captureKind: "camera" | "video" | "voice" | "document";
  readonly uploadQuality: "standard" | "hd";
  /** Hard ceiling on the attempt · defaults to 60 seconds. If the
   *  encryption + upload don't resolve inside this window we return
   *  a "timeout" blocked outcome instead of hanging the user. */
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;

function classifyError(err: unknown): AttachmentBlockReason {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const lower = msg.toLowerCase();
  if (lower.startsWith("unsupported attachment mime")) return "unsupported-mime";
  if (lower.includes("encrypted upload failed")) return "upload-failed";
  if (lower.includes("unknown_upload_error")) return "invalid-output";
  // Anything else · we treat as a crypto-layer throw (nacl, random
  // generator, arrayBuffer read, etc.). "encrypt-threw" is the
  // conservative label.
  return "encrypt-threw";
}

export async function attemptEncryptedAttachment(
  opts: AttemptOptions,
): Promise<AttachmentEncryptionOutcome> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // P1.T04 Phase 3 · 2026-11-13 · owner-authorised. Documents now flow
  // through the full encrypted pipeline (see SUPPORTED_DOCUMENT_MIMES
  // in encrypted-attachment-upload.ts). The earlier short-circuit that
  // returned "unsupported-mime" for every document has been removed.
  // The uploader's classifyMime continues to return null for genuinely
  // unknown MIMEs · those still reach the "unsupported-mime" block
  // prompt via the thrown error in the uploader.

  const uploadOpts: UploadEncryptedAttachmentOptions = {
    file: opts.file,
    uploadQuality: opts.uploadQuality,
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<AttachmentEncryptionOutcome>((resolve) => {
    timer = setTimeout(() => {
      resolve({
        kind: "blocked",
        reason: "timeout",
        captureKind: opts.captureKind,
        file: opts.file,
        telemetry: `timeout-after-${timeoutMs}ms`,
      });
    }, timeoutMs);
  });

  const attemptPromise = (async (): Promise<AttachmentEncryptionOutcome> => {
    try {
      const result = await uploadEncryptedAttachment(uploadOpts);
      if (!result.storageUrl || !result.storagePath) {
        return {
          kind: "blocked",
          reason: "invalid-output",
          captureKind: opts.captureKind,
          file: opts.file,
          telemetry: "upload returned empty URL or path",
        };
      }
      return {
        kind: "encrypted",
        storageUrl: result.storageUrl,
        storagePath: result.storagePath,
        contentType: result.contentType,
        sizeBytes: result.sizeBytes,
        attachmentKind: result.kind,
        contentKey: result.contentKey,
        contentNonce: result.contentNonce,
        // Phase 3 · for documents only · the uploader also encrypted
        // the UTF-8 filename with the same content key. Image / video
        // / audio attachments leave these undefined.
        encryptedFilename: result.encryptedFilename,
        filenameNonce: result.filenameNonce,
      };
    } catch (err) {
      return {
        kind: "blocked",
        reason: classifyError(err),
        captureKind: opts.captureKind,
        file: opts.file,
        telemetry: err instanceof Error ? err.name : "non-error-thrown",
      };
    }
  })();

  const outcome = await Promise.race([attemptPromise, timeoutPromise]);
  if (timer) clearTimeout(timer);
  return outcome;
}
