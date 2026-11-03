"use client";

// src/app/nex-native/chat/peer/[accountId]/_media-capture.tsx
//
// Hidden file inputs for the Camera / Video / Voice options in the
// composer's Add-media modal. Each input carries the right accept +
// capture attributes so mobile OSes open the native camera / video
// recorder / voice memo tool, and desktop falls back to a normal
// file picker.
//
// On file selection, the input submits a hidden <form> bound to
// uploadPeerAttachmentAction · the server action uploads to storage,
// then redirects back to the peer chat surface with the resulting
// URL + kind on the query string. The composer picks that up as a
// pending attachment.
//
// Bridge 65 · sealed 2026-09-29 · progress overlay. Between "file
// chosen" and the redirect landing, we render a full-screen
// spinner + "Uploading…" overlay so the user knows something is
// happening (was silent before · felt broken). The overlay unmounts
// naturally when Next re-renders after the redirect.
//
// This component exposes an imperative handle so the media modal can
// call `open("camera" | "video" | "voice")` without needing to know
// about the file inputs directly.

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { uploadEncryptedAttachment } from "@/lib/nex-native/crypto/encrypted-attachment-upload";
import { stashEncryptedAttachmentKey } from "@/lib/nex-native/crypto/encrypted-attachment-stash";
import { getMyDataUsagePrefsAction } from "@/app/nex-native/settings/data-usage/_actions";

// Stage A · owner-authorised 2026-11-03 · "document" joins the
// Capture family so the composer's Add-media modal can route PDFs /
// Office docs / zip archives / etc. through the same upload pipeline
// as camera / video / voice. Document uses the plaintext fallback
// path (Bridge 88 deferral intact in v1 · Stage A2 flips all four
// to encrypted together) and accepts any MIME so the OS picker is
// unrestricted.
export type CaptureKind = "camera" | "video" | "voice" | "document";

export interface MediaCaptureHandle {
  open(kind: CaptureKind): void;
}

interface Props {
  /** Server Action bound with peerAccountId · takes a FormData with
   *  a single "attachment_file" field. Used for the PLAINTEXT
   *  fallback path when encrypted upload is disabled or fails. */
  uploadAction: (formData: FormData) => Promise<never> | void | Promise<void>;
  /** Bridge 88 · when true, route the file through the client-side
   *  encrypted upload path (nacl.secretbox + POST ciphertext) instead
   *  of the plaintext server action. Silent fallback to the plaintext
   *  action on any failure. Disable for NEX1 (no E2E per doctrine). */
  encryptedUploadEnabled?: boolean;
}

const KIND_COPY: Record<CaptureKind, { verb: string; icon: string }> = {
  camera: { verb: "Uploading photo", icon: "📸" },
  video: { verb: "Uploading video", icon: "🎥" },
  voice: { verb: "Uploading voice note", icon: "🎙" },
  document: { verb: "Uploading document", icon: "📄" },
};

export const MediaCapture = React.forwardRef<MediaCaptureHandle, Props>(
  function MediaCapture({ uploadAction, encryptedUploadEnabled }, ref) {
    const cameraFormRef = React.useRef<HTMLFormElement | null>(null);
    const videoFormRef = React.useRef<HTMLFormElement | null>(null);
    const voiceFormRef = React.useRef<HTMLFormElement | null>(null);
    // Stage A · owner-authorised 2026-11-03 · dedicated document form
    // + input · routes through the plaintext path (classifyPeerAttach-
    // mentMime now returns 'document' for non-media MIMEs) · Bridge 88
    // posture intact in v1.
    const documentFormRef = React.useRef<HTMLFormElement | null>(null);
    const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
    const videoInputRef = React.useRef<HTMLInputElement | null>(null);
    const voiceInputRef = React.useRef<HTMLInputElement | null>(null);
    const documentInputRef = React.useRef<HTMLInputElement | null>(null);

    const [uploading, setUploading] = React.useState<CaptureKind | null>(null);
    const [mounted, setMounted] = React.useState(false);
    // R14 Stage 6b (code-only · 2026-10-16) · the viewer's upload-
    // quality preference drives encrypted-attachment-upload's
    // client-side image compression. We resolve once on mount via
    // the sealed server action · "standard" is the safe default when
    // the migration is not yet applied OR when the fetch races the
    // first upload (the enforcement-anchor test proves
    // `opts.uploadQuality ?? "standard"` on the service side).
    const [uploadQuality, setUploadQuality] = React.useState<
      "standard" | "hd"
    >("standard");
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
          /* keep the sealed default · fail-safe */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []);

    const router = useRouter();
    const pathname = usePathname();

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
      }),
      [],
    );

    // Stage A · owner-authorised 2026-11-03 · surface a transient
    // human message when client-side validation rejects a file BEFORE
    // we burn bandwidth hitting the upload endpoint. Clears on next
    // file-select so the user never sees a stale error.
    const [validationError, setValidationError] = React.useState<string | null>(
      null,
    );

    const onFileChosen =
      (
        formRef: React.RefObject<HTMLFormElement | null>,
        kind: CaptureKind,
      ) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.currentTarget.files;
        if (!files || files.length === 0) return;
        setValidationError(null);
        const file = files[0]!;
        // Stage A · client-side size + MIME pre-check · mirrors the
        // sealed server-side bounds in peer-message-service
        // (NEX_PEER_ATTACHMENT_MAX_BYTES + classifyPeerAttachmentMime)
        // so the user sees a human message on the composer surface
        // instead of waiting for a redirect-with-upload_error.
        //
        // Rules:
        //   · 25 MB hard cap (same as the bucket + encrypted route)
        //   · empty MIME rejected (classifyPeerAttachmentMime returns
        //     null for empty · would fail server-side anyway)
        //   · kind-specific accept hints · "camera" expects image/*,
        //     "video" expects video/*, "voice" expects audio/* · the
        //     file input `accept` already filters, this is a
        //     defence-in-depth check for drag-drop / clipboard paths.
        const MAX_BYTES = 25 * 1024 * 1024;
        if (file.size > MAX_BYTES) {
          const mb = (file.size / (1024 * 1024)).toFixed(1);
          setValidationError(
            `File is ${mb} MB. The 25 MB cap applies to every attachment.`,
          );
          // Reset the input so re-picking the same file re-fires change.
          e.currentTarget.value = "";
          return;
        }
        if (!file.type || file.type.length === 0) {
          setValidationError(
            "That file doesn't carry a recognised type. Try another file.",
          );
          e.currentTarget.value = "";
          return;
        }
        const typeLower = file.type.toLowerCase();
        const kindMatches = (() => {
          if (kind === "camera") return typeLower.startsWith("image/");
          if (kind === "video") return typeLower.startsWith("video/");
          if (kind === "voice") return typeLower.startsWith("audio/");
          // Document · anything that isn't image/video/audio is fine ·
          // this intentionally mirrors classifyPeerAttachmentMime.
          return !typeLower.startsWith("image/") &&
            !typeLower.startsWith("video/") &&
            !typeLower.startsWith("audio/")
            ? true
            : // If the user picked an image via the Document tile the
              // server will classify it as image + render as a photo ·
              // allow it rather than reject.
              true;
        })();
        if (!kindMatches) {
          setValidationError(
            `This file doesn't look like a ${kind === "camera" ? "photo" : kind}. Pick a different file.`,
          );
          e.currentTarget.value = "";
          return;
        }
        setUploading(kind);
        // Stage A · owner-authorised 2026-11-03 · broadcast an upload-
        // start event so the composer can render an inline indeterminate
        // progress bar alongside the sealed full-screen overlay. The
        // Server Action's redirect-based upload path cannot expose
        // byte-level progress without rework; the inline bar is
        // honestly indeterminate (no fake percentage ticker).
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("nex-peer-upload-start", { detail: { kind } }),
          );
        }

        // Bridge 88 · encrypted-upload path when enabled. Reads the
        // file client-side, encrypts with nacl.secretbox + a random
        // content key, POSTs ciphertext to the encrypted endpoint,
        // stashes the content key in sessionStorage keyed by the
        // returned URL, then router.replaces() so the composer picks
        // up the attachment (with attachment_encrypted=1 flag).
        //
        // Silent fallback to the plaintext form action on any failure
        // so a hiccup in the encrypted path doesn't block sending.
        //
        // Stage A · 2026-11-03 · documents SKIP the encrypted path
        // entirely · classifyMime inside uploadEncryptedAttachment
        // rejects non-media MIMEs, so calling it would always throw
        // and silent-fall-back · routing directly to plaintext saves
        // one abandoned encryption attempt. Bridge 88 posture
        // unchanged · Stage A2 will encrypt all four kinds together.
        if (encryptedUploadEnabled && kind !== "document") {
          void (async () => {
            try {
              const enc = await uploadEncryptedAttachment({
                file,
                uploadQuality,
              });
              stashEncryptedAttachmentKey(enc.storageUrl, {
                contentKey: Array.from(enc.contentKey),
                contentNonce: Array.from(enc.contentNonce),
                contentType: enc.contentType,
                sizeBytes: enc.sizeBytes,
                kind: enc.kind,
              });
              const qs = new URLSearchParams({
                attachment_url: enc.storageUrl,
                attachment_type: enc.kind,
                attachment_encrypted: "1",
              });
              router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
              setUploading(null);
            } catch {
              // Fall back to the plaintext server action.
              formRef.current?.requestSubmit();
            }
          })();
          return;
        }
        formRef.current?.requestSubmit();
      };

    return (
      <>
        <div aria-hidden style={{ position: "absolute", width: 0, height: 0 }}>
          {/* Camera · rear camera on iOS/Android · file picker on desktop */}
          <form ref={cameraFormRef} action={uploadAction}>
            <input
              ref={cameraInputRef}
              name="attachment_file"
              type="file"
              accept="image/*"
              // The `capture` attribute is a hint · Chrome/Safari on
              // Android/iOS open the camera; desktop shows the picker.
              capture="environment"
              onChange={onFileChosen(cameraFormRef, "camera")}
              style={{ display: "none" }}
            />
          </form>
          {/* Video · rear camera video recorder on mobile */}
          <form ref={videoFormRef} action={uploadAction}>
            <input
              ref={videoInputRef}
              name="attachment_file"
              type="file"
              accept="video/*"
              capture="environment"
              onChange={onFileChosen(videoFormRef, "video")}
              style={{ display: "none" }}
            />
          </form>
          {/* Voice · mic capture on mobile · falls back to audio file
              picker on desktop (users can drop a pre-recorded clip in). */}
          <form ref={voiceFormRef} action={uploadAction}>
            <input
              ref={voiceInputRef}
              name="attachment_file"
              type="file"
              accept="audio/*"
              capture
              onChange={onFileChosen(voiceFormRef, "voice")}
              style={{ display: "none" }}
            />
          </form>
          {/* Document · any non-media file (PDF, Office doc, zip, text,
              etc.). No `capture` attribute · opens the OS file picker
              on every platform. Routes through the plaintext path
              because uploadEncryptedAttachment rejects non-media MIMEs
              (classifyMime returns null for documents). Bridge 88
              posture intact in v1 · Stage A2 flips all four types
              together. Stage A · owner-authorised 2026-11-03. */}
          <form ref={documentFormRef} action={uploadAction}>
            <input
              ref={documentInputRef}
              name="attachment_file"
              type="file"
              accept="*/*"
              onChange={onFileChosen(documentFormRef, "document")}
              style={{ display: "none" }}
            />
          </form>
        </div>

        {/* Bridge 65 · full-screen upload overlay · appears the moment
           a file is picked · unmounts when Next re-renders after the
           server action's redirect. Portal so it always sits above
           the chat layout regardless of stacking context. */}
        {mounted &&
          uploading &&
          createPortal(
            <UploadOverlay kind={uploading} />,
            document.body,
          )}
        {/* Stage A · owner-authorised 2026-11-03 · client-side
            validation toast · appears for ~4s when a pre-check
            rejects a file (size cap, missing MIME, kind mismatch).
            Portal so it sits above the chat composer even when the
            modal is still fading out. */}
        {mounted &&
          validationError &&
          createPortal(
            <ValidationErrorToast
              message={validationError}
              onDismiss={() => setValidationError(null)}
            />,
            document.body,
          )}
      </>
    );
  },
);

// Stage A · owner-authorised 2026-11-03 · transient validation toast.
// Auto-dismisses after 4s so the user isn't blocked, but tappable to
// clear immediately. Positioned bottom-centre above the composer.
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
