"use client";

// src/app/nex-native/create/upload-video/_upload-client.tsx
//
// Owner-authorised 2026-11-05 iter 24 · world-class ship · minimal
// functional client for the Create → Video journey.
//
// Flow:
//   1. User picks a video file.
//   2. Client probes duration/width/height via <video>.loadedmetadata.
//   3. Client enforces client-side gates (size + duration) to avoid
//      wasting an upload on a known-bad file.
//   4. User fills title (required) + caption (optional).
//   5. User confirms rights ownership checkbox (required).
//   6. Submit · the form posts to uploadVideoAction · success →
//      redirect to /nex-feed/<newId>. Failure → toast.
//
// Styling follows the sealed NEX black-glass + gold-accent vocabulary.

import * as React from "react";
import Link from "next/link";
import { uploadVideoAction, type UploadVideoActionResult } from "./_actions";

export interface UploadVideoClientProps {
  readonly selfDisplayName: string;
  readonly maxBytesPerUpload: number;
  readonly maxDurationSeconds: number;
}

interface ProbeResult {
  readonly durationSeconds: number;
  readonly width: number;
  readonly height: number;
  readonly objectUrl: string;
}

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "rgba(2,9,20,0.7)",
  border: "rgba(255,255,255,0.14)",
  text: "#F2F5F8",
  dim: "#B5C3D6",
  mute: "#7D9BC0",
  gold: "var(--nex-world-secondary, #C6A15B)",
  orange: "#FF7200",
  orangeInk: "#1A0808",
  danger: "#A60000",
};

export function UploadVideoClient({
  selfDisplayName,
  maxBytesPerUpload,
  maxDurationSeconds,
}: UploadVideoClientProps): React.JSX.Element {
  const [file, setFile] = React.useState<File | null>(null);
  const [probe, setProbe] = React.useState<ProbeResult | null>(null);
  const [probing, setProbing] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [caption, setCaption] = React.useState("");
  const [rightsOwned, setRightsOwned] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    // Revoke the preview blob URL on unmount / replacement.
    return () => {
      if (probe) URL.revokeObjectURL(probe.objectUrl);
    };
  }, [probe]);

  const onPickFile = React.useCallback(
    async (next: File | null) => {
      setError(null);
      if (probe) URL.revokeObjectURL(probe.objectUrl);
      setProbe(null);
      setFile(next);
      if (!next) return;
      if (next.size > maxBytesPerUpload) {
        setError(
          `File too large · ${(next.size / 1_048_576).toFixed(1)} MB (limit ${(maxBytesPerUpload / 1_048_576).toFixed(0)} MB)`,
        );
        setFile(null);
        return;
      }
      setProbing(true);
      const url = URL.createObjectURL(next);
      try {
        const info = await probeVideo(url);
        if (info.durationSeconds > maxDurationSeconds) {
          setError(
            `Video too long · ${info.durationSeconds.toFixed(1)}s (limit ${maxDurationSeconds}s)`,
          );
          setFile(null);
          URL.revokeObjectURL(url);
        } else {
          setProbe({ ...info, objectUrl: url });
        }
      } catch {
        setError("Couldn't read this video · try MP4 / MOV / WEBM");
        setFile(null);
        URL.revokeObjectURL(url);
      } finally {
        setProbing(false);
      }
    },
    [maxBytesPerUpload, maxDurationSeconds, probe],
  );

  const canSubmit =
    !!file &&
    !!probe &&
    title.trim().length > 0 &&
    rightsOwned &&
    !submitting;

  const onSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSubmit || !file || !probe) return;
      setSubmitting(true);
      setError(null);
      const fd = new FormData();
      fd.set("video", file);
      fd.set("title", title.trim());
      fd.set("caption", caption.trim());
      fd.set("duration", String(probe.durationSeconds));
      fd.set("width", String(probe.width));
      fd.set("height", String(probe.height));
      fd.set("country", "IE");
      fd.set("rights", "owner_content");
      let result: UploadVideoActionResult | null = null;
      try {
        result = await uploadVideoAction(fd);
      } catch {
        // Redirect throws · success path never reaches here.
        return;
      }
      setSubmitting(false);
      if (result && !result.ok) {
        setError(explain(result));
      }
    },
    [canSubmit, caption, file, probe, title],
  );

  return (
    <main
      data-nex-upload-video-page
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
      }}
    >
      <header
        style={{
          padding:
            "calc(env(safe-area-inset-top, 0px) + 16px) 16px 14px 16px",
          borderBottom: `1px solid ${NEX.border}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link
          href="/nex-native/create"
          aria-label="Back to Create"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#000000",
            border: `1px solid ${NEX.border}`,
            color: "#FFFFFF",
            textDecoration: "none",
            fontSize: 18,
            boxShadow:
              `0 6px 18px rgba(0,0,0,0.55), inset 0 0 0 1px color-mix(in srgb, ${NEX.gold} 24%, transparent)`,
          }}
        >
          ←
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.1 }}>
            Upload video
          </div>
          <div style={{ fontSize: 12, color: NEX.dim, marginTop: 2 }}>
            Up to {maxDurationSeconds}s · as {selfDisplayName}
          </div>
        </div>
      </header>

      <form onSubmit={onSubmit} style={{ padding: 16 }}>
        <div
          onClick={() => fileInputRef.current?.click()}
          data-nex-upload-video-drop
          style={{
            background: NEX.panel,
            border: `1px dashed ${NEX.border}`,
            borderRadius: 14,
            padding: 20,
            textAlign: "center",
            cursor: "pointer",
            marginBottom: 16,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={(e) => onPickFile(e.currentTarget.files?.[0] ?? null)}
            style={{ display: "none" }}
          />
          {probe ? (
            <>
              <video
                src={probe.objectUrl}
                controls
                playsInline
                muted
                style={{
                  width: "100%",
                  maxHeight: 360,
                  borderRadius: 10,
                  background: "#000",
                }}
              />
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: NEX.dim,
                }}
              >
                {probe.durationSeconds.toFixed(1)}s · {probe.width}×
                {probe.height}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPickFile(null);
                }}
                style={{
                  marginTop: 10,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "transparent",
                  border: `1px solid ${NEX.border}`,
                  color: NEX.text,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Replace
              </button>
            </>
          ) : probing ? (
            <div style={{ color: NEX.dim }}>Reading your video…</div>
          ) : (
            <>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: NEX.gold,
                  marginBottom: 6,
                }}
              >
                Tap to pick a video
              </div>
              <div style={{ fontSize: 12, color: NEX.mute }}>
                MP4 · MOV · WEBM · up to {maxDurationSeconds}s ·{" "}
                {(maxBytesPerUpload / 1_048_576).toFixed(0)} MB
              </div>
            </>
          )}
        </div>

        <label style={fieldLabelStyle}>
          Title <span style={{ color: NEX.danger }}>*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          maxLength={120}
          placeholder="Name your video"
          style={fieldInputStyle}
        />

        <label style={fieldLabelStyle}>Caption</label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.currentTarget.value)}
          maxLength={500}
          placeholder="Optional · what's this video about?"
          rows={3}
          style={{ ...fieldInputStyle, resize: "vertical", minHeight: 72 }}
        />

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            margin: "16px 0",
            fontSize: 13,
            color: NEX.dim,
            lineHeight: 1.4,
          }}
        >
          <input
            type="checkbox"
            checked={rightsOwned}
            onChange={(e) => setRightsOwned(e.currentTarget.checked)}
            style={{ marginTop: 3, accentColor: NEX.gold }}
          />
          <span>
            I confirm I own or have permission to publish this video. No
            copyrighted music, footage, or logos without rights.
          </span>
        </label>

        {error ? (
          <div
            role="alert"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(166,0,0,0.12)",
              border: `1px solid rgba(166,0,0,0.42)`,
              color: "#FFBABA",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 999,
            background: NEX.orange,
            color: NEX.orangeInk,
            fontWeight: 800,
            fontSize: 15,
            border: "none",
            cursor: canSubmit ? "pointer" : "default",
            opacity: canSubmit ? 1 : 0.4,
            boxShadow: canSubmit
              ? `0 6px 18px -6px ${NEX.orange}`
              : "none",
          }}
        >
          {submitting ? "Uploading…" : "Publish to NEX Live"}
        </button>
      </form>
    </main>
  );
}

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--nex-world-muted-ink, #B5C3D6)",
  margin: "12px 0 6px",
};

const fieldInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  background: "rgba(2,9,20,0.6)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 12,
  color: "#F2F5F8",
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

function probeVideo(
  url: string,
): Promise<{ durationSeconds: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onerror = null;
      video.src = "";
    };
    video.onloadedmetadata = () => {
      const result = {
        durationSeconds: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      };
      cleanup();
      resolve(result);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("probe-failed"));
    };
    video.src = url;
  });
}

function explain(result: UploadVideoActionResult): string {
  if (result.ok) return "";
  switch (result.reason) {
    case "no-session":
      return "You need to sign in to upload.";
    case "no-file":
      return "Pick a video first.";
    case "file-too-large":
      return "Video too large.";
    case "duration-too-long":
      return "Video too long.";
    case "duration-missing":
      return "We couldn't read the video length.";
    case "bad-mime":
      return "Only MP4, MOV, or WEBM are accepted.";
    case "empty-title":
      return "Give your video a title.";
    case "storage-failed":
      return `Upload failed · ${result.detail ?? "storage error"}`;
    case "publish-failed":
      return `Publish failed · ${result.detail ?? "db error"}`;
    default:
      return "Something went wrong · try again.";
  }
}
