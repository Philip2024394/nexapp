"use client";

// src/app/nex-native/chat/peer/[accountId]/_media-capture.tsx
//
// Hidden file inputs for the Camera / Video / Voice / Document options
// in the composer's Add-media modal. Each input carries the right accept
// + capture attributes so mobile OSes open the native camera / video
// recorder / voice memo tool, and desktop falls back to a normal
// file picker.
//
// Phase 1 fail-closed (owner-authorised 2026-11-07):
//   · When `encryptedUploadEnabled=true`, every attachment attempt is
//     routed through `attemptEncryptedAttachment`. Outcomes are:
//       - "encrypted"  → caller's attachment-ready hook fires (the
//                        stashKeyAndRedirect flow unchanged from v1).
//       - "blocked"    → explicit-choice prompt rendered. The user MUST
//                        tap Retry, Send-as-standard (when allowed), or
//                        Cancel. No silent plaintext fallback.
//       - "cancelled"  → no-op (prompt dismissed).
//   · When `encryptedUploadEnabled=false` (e.g. NEX1 support chat), the
//     plaintext path runs as before · no prompt (plaintext IS the
//     intended behaviour on that surface).
//
// Imperative handle exposes:
//   · open(kind)                         — opens the file picker
//   · sendRecordedFile({kind, file})     — routes a MediaRecorder-captured
//                                          File through the same gate as
//                                          a picked file (closes the
//                                          recorderSend bypass path).

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { stashEncryptedAttachmentKey } from "@/lib/nex-native/crypto/encrypted-attachment-stash";
import { getMyDataUsagePrefsAction } from "@/lib/nex-native/data-usage/actions";
import { attemptEncryptedAttachment } from "@/lib/nex-native/chat/attempt-encrypted-attachment";
import {
  BLOCK_COPY,
  type AttachmentBlockedOutcome,
} from "@/lib/nex-native/chat/attachment-encryption-outcome";

export type CaptureKind = "camera" | "video" | "voice" | "document";

export interface MediaCaptureHandle {
  open(kind: CaptureKind): void;
  /** Phase 1 · route a recorder-produced File through the same
   *  encryption / block flow as a picker-produced File. The recorder
   *  path USED to post the File directly to the plaintext upload
   *  action · that was a bypass. */
  sendRecordedFile(args: { kind: CaptureKind; file: File }): void;
}

interface Props {
  /** Server Action bound with peerAccountId · takes a FormData with
   *  a single "attachment_file" field. Used for:
   *   (a) chats where encryptedUploadEnabled is false (plaintext by
   *       design · NEX1 support),
   *   (b) the explicit "Send as standard" user choice from the block
   *       prompt. NEVER triggered by a silent fallthrough. */
  uploadAction: (formData: FormData) => Promise<never> | void | Promise<void>;
  /** When true, the capture flow routes files through the client-side
   *  encrypted upload path with fail-closed outcomes. Disable for
   *  NEX1 (no E2E per doctrine). */
  encryptedUploadEnabled?: boolean;
}

const KIND_COPY: Record<CaptureKind, { verb: string; icon: string }> = {
  camera: { verb: "Uploading photo", icon: "📸" },
  video: { verb: "Uploading video", icon: "🎥" },
  voice: { verb: "Uploading voice note", icon: "🎙" },
  document: { verb: "Uploading document", icon: "📄" },
};

// ─── Shared · size + MIME pre-check (defence in depth) ────────────────
// Same bounds as peer-message-service.NEX_PEER_ATTACHMENT_MAX_BYTES +
// classifyPeerAttachmentMime. Exported for the test suite.
export const MEDIA_MAX_BYTES = 25 * 1024 * 1024;

export type ClientValidationError =
  | "size-exceeded"
  | "missing-mime"
  | "kind-mismatch";

export function validateFileBeforeUpload(
  file: File,
  kind: CaptureKind,
): ClientValidationError | null {
  if (file.size > MEDIA_MAX_BYTES) return "size-exceeded";
  if (!file.type || file.type.length === 0) return "missing-mime";
  const typeLower = file.type.toLowerCase();
  if (kind === "camera" && !typeLower.startsWith("image/")) {
    // Images picked via the camera input path · anything non-image is
    // a mismatch. Document input is unrestricted elsewhere.
    return "kind-mismatch";
  }
  if (kind === "video" && !typeLower.startsWith("video/")) {
    return "kind-mismatch";
  }
  if (kind === "voice" && !typeLower.startsWith("audio/")) {
    return "kind-mismatch";
  }
  // Document · intentionally any MIME passes (even image/video/audio
  // picked from the Document tile · server classifies).
  return null;
}

function validationErrorCopy(err: ClientValidationError, file: File, kind: CaptureKind): string {
  if (err === "size-exceeded") {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `File is ${mb} MB. The 25 MB cap applies to every attachment.`;
  }
  if (err === "missing-mime") {
    return "That file doesn't carry a recognised type. Try another file.";
  }
  const label = kind === "camera" ? "photo" : kind;
  return `This file doesn't look like a ${label}. Pick a different file.`;
}

// ─── Component ─────────────────────────────────────────────────────────

export const MediaCapture = React.forwardRef<MediaCaptureHandle, Props>(
  function MediaCapture({ uploadAction, encryptedUploadEnabled }, ref) {
    const cameraFormRef = React.useRef<HTMLFormElement | null>(null);
    const videoFormRef = React.useRef<HTMLFormElement | null>(null);
    const voiceFormRef = React.useRef<HTMLFormElement | null>(null);
    const documentFormRef = React.useRef<HTMLFormElement | null>(null);
    const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
    const videoInputRef = React.useRef<HTMLInputElement | null>(null);
    const voiceInputRef = React.useRef<HTMLInputElement | null>(null);
    const documentInputRef = React.useRef<HTMLInputElement | null>(null);

    const [uploading, setUploading] = React.useState<CaptureKind | null>(null);
    const [mounted, setMounted] = React.useState(false);
    const [uploadQuality, setUploadQuality] = React.useState<
      "standard" | "hd"
    >("standard");
    const [validationError, setValidationError] = React.useState<string | null>(
      null,
    );
    // Phase 1 · block prompt state. When an encryption attempt returns
    // a "blocked" outcome, we park the file + reason here and render
    // the prompt. There is NO automatic upload while blocked is set.
    const [blocked, setBlocked] = React.useState<AttachmentBlockedOutcome | null>(
      null,
    );

    React.useEffect(() => setMounted(true), []);
    React.useEffect(() => {
      let cancelled = false;
      void (async () => {
        try {
          const res = await getMyDataUsagePrefsAction();
          if (!cancelled && res.ok) {
            setUploadQuality(res.prefs.upload_quality);
          }
        } catch {
          /* keep sealed default */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []);

    const router = useRouter();
    const pathname = usePathname();

    // ── Core: attempt encrypted path · DO NOT fall back silently ──
    const runEncryptedAttempt = React.useCallback(
      async (kind: CaptureKind, file: File) => {
        setUploading(kind);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("nex-peer-upload-start", { detail: { kind } }),
          );
        }
        const outcome = await attemptEncryptedAttachment({
          file,
          captureKind: kind,
          uploadQuality,
        });
        if (outcome.kind === "encrypted") {
          stashEncryptedAttachmentKey(outcome.storageUrl, {
            contentKey: Array.from(outcome.contentKey),
            contentNonce: Array.from(outcome.contentNonce),
            contentType: outcome.contentType,
            sizeBytes: outcome.sizeBytes,
            kind: outcome.attachmentKind,
          });
          const qs = new URLSearchParams({
            attachment_url: outcome.storageUrl,
            attachment_type: outcome.attachmentKind,
            attachment_encrypted: "1",
          });
          router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
          setUploading(null);
          return;
        }
        if (outcome.kind === "blocked") {
          // STOP · render prompt · do NOT upload plaintext.
          setUploading(null);
          setBlocked(outcome);
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("nex-peer-upload-blocked", {
                detail: { reason: outcome.reason, kind: outcome.captureKind },
              }),
            );
          }
          return;
        }
        // cancelled (shouldn't happen from attemptEncryptedAttachment,
        // but keep the branch for exhaustiveness)
        setUploading(null);
      },
      [pathname, router, uploadQuality],
    );

    // ── Plaintext path (used ONLY when encryption is off by design
    //    OR when the user explicitly taps "Send as standard") ──
    const runPlaintextSubmit = React.useCallback(
      (kind: CaptureKind) => {
        setUploading(kind);
        const formRef =
          kind === "camera"
            ? cameraFormRef
            : kind === "video"
              ? videoFormRef
              : kind === "voice"
                ? voiceFormRef
                : documentFormRef;
        formRef.current?.requestSubmit();
      },
      [],
    );

    const runPlaintextWithFile = React.useCallback(
      async (kind: CaptureKind, file: File) => {
        setUploading(kind);
        // Build FormData manually · the recorder path has no form
        // DOM; we invoke uploadAction directly. Server Action's
        // NEXT_REDIRECT throw bubbles · benign.
        const fd = new FormData();
        fd.set("attachment_file", file);
        try {
          await Promise.resolve(uploadAction(fd));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes("NEXT_REDIRECT")) {
            console.error("uploadAction failed:", e);
          }
        }
      },
      [uploadAction],
    );

    // ── Dispatch entry point: picker OR recorder, same gate ──
    const dispatchAttachmentAttempt = React.useCallback(
      (kind: CaptureKind, file: File) => {
        const err = validateFileBeforeUpload(file, kind);
        if (err) {
          setValidationError(validationErrorCopy(err, file, kind));
          return;
        }
        setValidationError(null);
        if (encryptedUploadEnabled) {
          void runEncryptedAttempt(kind, file);
          return;
        }
        // Design-time plaintext surface (NEX1 support, etc.). For
        // picker-sourced files, this uses the hidden form. For
        // recorder-sourced files, we POST directly.
        void runPlaintextWithFile(kind, file);
      },
      [encryptedUploadEnabled, runEncryptedAttempt, runPlaintextWithFile],
    );

    React.useImperativeHandle(
      ref,
      () => ({
        open(kind: CaptureKind) {
          const inputRef =
            kind === "camera"
              ? cameraInputRef
              : kind === "video"
                ? videoInputRef
                : kind === "voice"
                  ? voiceInputRef
                  : documentInputRef;
          inputRef.current?.click();
        },
        sendRecordedFile({ kind, file }) {
          dispatchAttachmentAttempt(kind, file);
        },
      }),
      [dispatchAttachmentAttempt],
    );

    const onFileChosen =
      (kind: CaptureKind) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.currentTarget.files;
        if (!files || files.length === 0) return;
        const file = files[0]!;
        // Reset the input so re-picking the same file re-fires change.
        e.currentTarget.value = "";
        dispatchAttachmentAttempt(kind, file);
      };

    // ── Block prompt choice handlers ──
    const onPromptRetry = React.useCallback(() => {
      if (!blocked) return;
      const { captureKind, file } = blocked;
      setBlocked(null);
      void runEncryptedAttempt(captureKind, file);
    }, [blocked, runEncryptedAttempt]);

    const onPromptSendStandard = React.useCallback(() => {
      if (!blocked) return;
      const copy = BLOCK_COPY[blocked.reason];
      if (!copy.allowSendStandard) {
        // Defence in depth · UI wouldn't render the button, but if
        // something taps it anyway we refuse.
        return;
      }
      const { captureKind, file } = blocked;
      setBlocked(null);
      void runPlaintextWithFile(captureKind, file);
    }, [blocked, runPlaintextWithFile]);

    const onPromptCancel = React.useCallback(() => {
      setBlocked(null);
      setUploading(null);
    }, []);

    return (
      <>
        <div aria-hidden style={{ position: "absolute", width: 0, height: 0 }}>
          <form ref={cameraFormRef} action={uploadAction}>
            <input
              ref={cameraInputRef}
              name="attachment_file"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileChosen("camera")}
              style={{ display: "none" }}
            />
          </form>
          <form ref={videoFormRef} action={uploadAction}>
            <input
              ref={videoInputRef}
              name="attachment_file"
              type="file"
              accept="video/*"
              capture="environment"
              onChange={onFileChosen("video")}
              style={{ display: "none" }}
            />
          </form>
          <form ref={voiceFormRef} action={uploadAction}>
            <input
              ref={voiceInputRef}
              name="attachment_file"
              type="file"
              accept="audio/*"
              capture
              onChange={onFileChosen("voice")}
              style={{ display: "none" }}
            />
          </form>
          <form ref={documentFormRef} action={uploadAction}>
            <input
              ref={documentInputRef}
              name="attachment_file"
              type="file"
              accept="*/*"
              onChange={onFileChosen("document")}
              style={{ display: "none" }}
            />
          </form>
        </div>

        {mounted &&
          uploading &&
          !blocked &&
          createPortal(<UploadOverlay kind={uploading} />, document.body)}

        {mounted &&
          validationError &&
          createPortal(
            <ValidationErrorToast
              message={validationError}
              onDismiss={() => setValidationError(null)}
            />,
            document.body,
          )}

        {mounted &&
          blocked &&
          createPortal(
            <AttachmentBlockPrompt
              outcome={blocked}
              onRetry={onPromptRetry}
              onSendStandard={onPromptSendStandard}
              onCancel={onPromptCancel}
            />,
            document.body,
          )}
      </>
    );
  },
);

// ─── Block prompt (explicit-choice) ─────────────────────────────────────
// The user MUST tap one of the buttons. There is no auto-dismiss, no
// click-outside-to-close. Silent fallback is impossible from here ·
// no code path in this module calls plaintext submit without a tap.

export function AttachmentBlockPrompt({
  outcome,
  onRetry,
  onSendStandard,
  onCancel,
}: {
  outcome: AttachmentBlockedOutcome;
  onRetry: () => void;
  onSendStandard: () => void;
  onCancel: () => void;
}) {
  const copy = BLOCK_COPY[outcome.reason];
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="nex-attachment-block-title"
      aria-describedby="nex-attachment-block-body"
      data-nex-attachment-block-prompt={outcome.reason}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(2,9,20,0.78)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          padding: 24,
          borderRadius: 18,
          background:
            "linear-gradient(180deg, rgba(6,15,28,0.96) 0%, rgba(3,10,20,0.99) 100%)",
          border: "1px solid rgba(255,120,120,0.35)",
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(255,80,80,0.12)",
          color: "#F4F7FC",
        }}
      >
        <div
          aria-hidden
          style={{
            fontSize: 32,
            marginBottom: 8,
            lineHeight: 1,
          }}
        >
          🔒
        </div>
        <h2
          id="nex-attachment-block-title"
          style={{
            fontSize: 18,
            fontWeight: 800,
            margin: "6px 0 10px",
            letterSpacing: "-0.01em",
            color: "#F8FAFC",
          }}
        >
          {copy.title}
        </h2>
        <p
          id="nex-attachment-block-body"
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            margin: "0 0 20px",
            color: "#C9DBE9",
          }}
        >
          {copy.body}
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {copy.allowRetry && (
            <button
              type="button"
              onClick={onRetry}
              data-nex-attachment-block-retry
              style={{
                padding: "11px 14px",
                borderRadius: 12,
                border: "none",
                background: "#00AFFF",
                color: "#02101E",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          )}
          {copy.allowSendStandard && (
            <button
              type="button"
              onClick={onSendStandard}
              data-nex-attachment-block-send-standard
              style={{
                padding: "11px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "transparent",
                color: "#F4F7FC",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Send as standard message (not encrypted)
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            data-nex-attachment-block-cancel
            style={{
              padding: "11px 14px",
              borderRadius: 12,
              border: "none",
              background: "transparent",
              color: "#8BA9D1",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Existing validation toast + upload overlay (unchanged shape) ──────

function ValidationErrorToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  React.useEffect(() => {
    const t = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(t);
  }, [onDismiss]);
  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onDismiss}
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: "min(92vw, 420px)",
        padding: "10px 16px",
        borderRadius: 12,
        background: "rgba(166, 0, 0, 0.92)",
        color: "#F2F5F8",
        fontSize: 13,
        fontWeight: 600,
        boxShadow: "0 10px 24px rgba(0, 0, 0, 0.4)",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        cursor: "pointer",
        zIndex: 9999,
        textAlign: "center",
      }}
    >
      {message}
    </div>
  );
}

function UploadOverlay({ kind }: { kind: CaptureKind }) {
  const { verb, icon } = KIND_COPY[kind];
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(2,9,20,0.72)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "grid",
        placeItems: "center",
        animation: "nex-upload-fade 180ms ease-out both",
      }}
    >
      <style>{`
        @keyframes nex-upload-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nex-upload-spin { to { transform: rotate(360deg); } }
        @keyframes nex-upload-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
      `}</style>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          padding: "28px 36px",
          borderRadius: 20,
          background:
            "linear-gradient(180deg, rgba(6,15,28,0.92) 0%, rgba(3,10,20,0.98) 100%)",
          border: "1px solid rgba(0,175,255,0.35)",
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,175,255,0.18)",
          minWidth: 220,
        }}
      >
        <div
          aria-hidden
          style={{
            fontSize: 40,
            lineHeight: 1,
            animation: "nex-upload-bob 1400ms ease-in-out infinite",
          }}
        >
          {icon}
        </div>
        <div
          aria-hidden
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "3px solid rgba(0,175,255,0.25)",
            borderTopColor: "#00AFFF",
            animation: "nex-upload-spin 700ms linear infinite",
          }}
        />
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#F4F7FC",
            letterSpacing: "0.02em",
            textAlign: "center",
          }}
        >
          {verb}…
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#8BA9D1",
            textAlign: "center",
            maxWidth: 240,
            lineHeight: 1.5,
          }}
        >
          Please don&apos;t close the app · this only takes a few seconds
        </div>
      </div>
    </div>
  );
}
