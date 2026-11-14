"use client";

// src/app/nex-native/chat/peer/[accountId]/_private-attachment-display.tsx
//
// P1.T07 · recipient UI · owner-authorised 2026-11-13.
// -----------------------------------------------------------------------------
// Displays an attachment sent via the explicit "Send as standard" path
// (P1.T06 + P1.T07). These attachments live in the sealed PRIVATE
// bucket (`nex-peer-chat-ciphertext` under the `std/` prefix) and are
// reachable ONLY via the participant-gated signed-URL mint endpoint.
//
// Invariants (owner-sealed):
//   · The storage_path is NEVER rendered as a public hyperlink.
//   · The bytes are plaintext (no decryption step) · but access is
//     participant-gated via the signed URL (900s TTL).
//   · A wrong recipient / expired session gets a non-revealing failure
//     surfaced via the chip's retry state (404 from the mint endpoint
//     collapses to "couldn't load, tap to retry").
//   · Retries always re-mint the signed URL · never reuse a stale one.
//   · For image/video/audio we render the signed URL directly in the
//     native tag · the browser fetches it as a time-limited URL · we
//     revoke no object URLs because none are created (the signed URL
//     is a live Supabase signed URL, not a blob).
//   · For documents we show a download chip that triggers a browser
//     download using the original filename (available only AFTER the
//     resolver succeeds · the storage_path alone does NOT reveal the
//     filename).

import * as React from "react";
import { resolveCiphertextFetchUrl } from "@/lib/nex-native/crypto/attachment-url-resolver";

export interface PrivateAttachmentDisplayProps {
  readonly storagePath: string;
  readonly kind: "image" | "video" | "audio" | "document";
  readonly contentType?: string | null;
  readonly sizeBytes?: number | null;
  /** Server-visible filename hint · persisted on the message row by
   *  sendPeerMessageAction. Shown ONLY on the document chip label
   *  after the signed URL has been minted (same policy as the
   *  encrypted-document chip · idle label does not expose it). */
  readonly filename?: string | null;
  readonly onOpenImage?: (url: string) => void;
}

type ResolveState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; signedUrl: string }
  | { kind: "failed" };

export function PrivateAttachmentDisplay({
  storagePath,
  kind,
  contentType,
  sizeBytes,
  filename,
  onOpenImage,
}: PrivateAttachmentDisplayProps): React.JSX.Element {
  const [state, setState] = React.useState<ResolveState>({ kind: "idle" });

  const mint = React.useCallback(async () => {
    setState({ kind: "loading" });
    const signed = await resolveCiphertextFetchUrl({ storage_path: storagePath });
    if (!signed) {
      setState({ kind: "failed" });
      return;
    }
    setState({ kind: "ready", signedUrl: signed });
  }, [storagePath]);

  // Images, videos, and audio auto-mint on mount so the bubble shows
  // the media without a click. Documents stay click-to-download to
  // avoid pulling large bytes onto every scroll.
  React.useEffect(() => {
    if (kind === "document") return;
    void mint();
    // Intentional · we mint once per mount for non-document kinds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // ─── Document chip · click-to-download ───────────────────────────
  if (kind === "document") {
    return (
      <DocumentChip
        state={state}
        onClick={() => {
          if (state.kind === "loading") return;
          void (async () => {
            setState({ kind: "loading" });
            const signed = await resolveCiphertextFetchUrl({
              storage_path: storagePath,
            });
            if (!signed) {
              setState({ kind: "failed" });
              return;
            }
            try {
              const resp = await fetch(signed);
              if (!resp.ok) {
                setState({ kind: "failed" });
                return;
              }
              const blob = await resp.blob();
              const blobUrl = URL.createObjectURL(blob);
              try {
                const anchor = document.createElement("a");
                anchor.href = blobUrl;
                anchor.download = sanitiseFilename(filename);
                anchor.rel = "noopener";
                anchor.style.display = "none";
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
                setState({ kind: "ready", signedUrl: signed });
              } finally {
                setTimeout(() => {
                  try {
                    URL.revokeObjectURL(blobUrl);
                  } catch {
                    /* ignore */
                  }
                }, 0);
              }
            } catch {
              setState({ kind: "failed" });
            }
          })();
        }}
        filename={filename}
        sizeBytes={sizeBytes}
      />
    );
  }

  // ─── Image / Video / Audio · auto-rendered signed URL ──────────────
  if (state.kind === "loading" || state.kind === "idle") {
    return (
      <MediaPlaceholder label="Loading…" kind={kind} />
    );
  }
  if (state.kind === "failed") {
    return (
      <button
        type="button"
        data-nex-private-attach-retry
        onClick={() => void mint()}
        style={retryStyle(kind)}
      >
        Couldn&apos;t load · Tap to retry
      </button>
    );
  }

  const url = state.signedUrl;
  if (kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt="attachment"
        onClick={onOpenImage ? () => onOpenImage(url) : undefined}
        data-nex-private-attach
        data-nex-private-attach-kind="image"
        style={{
          maxWidth: "100%",
          maxHeight: 360,
          borderRadius: 10,
          display: "block",
          cursor: onOpenImage ? "zoom-in" : "default",
        }}
      />
    );
  }
  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        data-nex-private-attach
        data-nex-private-attach-kind="video"
        style={{ maxWidth: "100%", borderRadius: 10, display: "block" }}
      />
    );
  }
  // audio
  return (
    <audio
      src={url}
      controls
      data-nex-private-attach
      data-nex-private-attach-kind="audio"
      style={{ width: "100%" }}
    />
  );
}

function MediaPlaceholder({
  label,
  kind,
}: {
  label: string;
  kind: "image" | "video" | "audio";
}): React.JSX.Element {
  return (
    <div
      data-nex-private-attach-placeholder
      data-nex-private-attach-kind={kind}
      style={{
        width: "100%",
        aspectRatio: kind === "audio" ? "5 / 1" : "3 / 2",
        borderRadius: 10,
        background:
          "linear-gradient(135deg, rgba(0,175,255,0.08), rgba(4,20,36,0.55))",
        border: "1px solid rgba(0,175,255,0.25)",
        display: "grid",
        placeItems: "center",
        color: "rgba(139,169,209,0.8)",
        fontSize: 12,
        letterSpacing: "0.05em",
      }}
    >
      🔒 {label}
    </div>
  );
}

function retryStyle(
  kind: "image" | "video" | "audio",
): React.CSSProperties {
  return {
    width: "100%",
    aspectRatio: kind === "audio" ? "5 / 1" : "3 / 2",
    borderRadius: 10,
    background: "rgba(127, 29, 29, 0.35)",
    border: "1px solid rgba(255,100,100,0.5)",
    color: "#FFEAEA",
    fontSize: 12,
    letterSpacing: "0.05em",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

function DocumentChip({
  state,
  onClick,
  filename,
  sizeBytes,
}: {
  state: ResolveState;
  onClick: () => void;
  filename?: string | null;
  sizeBytes?: number | null;
}): React.JSX.Element {
  const label = React.useMemo(() => {
    if (state.kind === "loading") return "Downloading…";
    if (state.kind === "failed") return "Couldn't fetch · Tap to retry";
    const size = formatSize(sizeBytes ?? null);
    const name = state.kind === "ready" && filename ? filename : null;
    if (name) return size ? `${name} · ${size}` : name;
    return size
      ? `Private document · ${size} · Tap to download`
      : "Private document · Tap to download";
  }, [state.kind, filename, sizeBytes]);

  return (
    <button
      type="button"
      data-nex-private-attach
      data-nex-private-attach-kind="document"
      data-nex-private-attach-state={state.kind}
      onClick={onClick}
      disabled={state.kind === "loading"}
      aria-label={label}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 12,
        background:
          "linear-gradient(135deg, rgba(0,175,255,0.08), rgba(4,20,36,0.55))",
        border:
          state.kind === "failed"
            ? "1px solid rgba(255,100,100,0.5)"
            : "1px solid rgba(0,175,255,0.25)",
        color: "#F2F5F8",
        fontFamily: "inherit",
        fontSize: 13,
        textAlign: "left",
        cursor: state.kind === "loading" ? "default" : "pointer",
        marginBottom: 4,
      }}
    >
      <span aria-hidden style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>
        {state.kind === "loading" ? "⏳" : "📄"}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span
        aria-hidden
        style={{
          fontSize: 18,
          lineHeight: 1,
          flexShrink: 0,
          opacity: state.kind === "loading" ? 0.4 : 0.8,
        }}
      >
        ⬇
      </span>
    </button>
  );
}

export function sanitiseFilename(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "attachment";
  const stripped = raw
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[\\/]/g, "_")
    .trim();
  if (stripped.length === 0) return "attachment";
  return stripped.length > 256 ? stripped.slice(0, 256) : stripped;
}

export function formatSize(sizeBytes: number | null): string | null {
  if (!sizeBytes || sizeBytes <= 0) return null;
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  const mb = sizeBytes / (1024 * 1024);
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}
