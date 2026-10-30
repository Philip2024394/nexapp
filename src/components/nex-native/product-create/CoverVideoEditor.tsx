"use client";

// src/components/nex-native/product-create/CoverVideoEditor.tsx
//
// Owner-authorised 2026-10-31. One cover video per product, ≤ 30 s,
// shown alongside the main image slot.
//
// Client contract:
//   1. Seller picks a file.
//   2. Client creates a URL.createObjectURL blob, loads a hidden
//      <video> element, waits for loadedmetadata, reads
//      video.duration.
//   3. If duration > 30 s → refuse and show an error. No upload.
//   4. Otherwise POST multipart to /api/nex-native/product/upload-
//      cover-video with the file. On success store the returned URL
//      + duration_seconds.
//   5. On render: show a <video controls preload="metadata"> with the
//      stored URL + a "Remove" button.
//
// Only one video per product. "Replace" overwrites the stored URL
// (the previous storage object becomes orphaned; cleanup is the §4
// outstanding storage-cleanup concern — out of scope for this build).

import * as React from "react";
import { COVER_VIDEO_MAX_DURATION_SECONDS } from "@/lib/nex-native/catalogue/cover-video-spec";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const BG = "#FFFFFF";
const RED = "#C8102E";

export interface CoverVideoDraft {
  readonly url: string;             // "" when none
  readonly durationSeconds: number; // 0 when none
  readonly objectPath: string;      // "" when none
}

export const EMPTY_COVER_VIDEO: CoverVideoDraft = { url: "", durationSeconds: 0, objectPath: "" };

export interface CoverVideoEditorProps {
  readonly value: CoverVideoDraft;
  readonly onChange: (next: CoverVideoDraft) => void;
  readonly businessId?: string | null;
}

/** Read duration via a hidden <video>. Resolves to -1 on load failure
 *  so the caller can reject the file honestly. */
function probeVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.muted = true;
    const cleanup = () => {
      URL.revokeObjectURL(url);
      el.src = "";
    };
    el.onloadedmetadata = () => {
      const d = Number.isFinite(el.duration) ? el.duration : -1;
      cleanup();
      resolve(d);
    };
    el.onerror = () => {
      cleanup();
      resolve(-1);
    };
    el.src = url;
  });
}

export function CoverVideoEditor({ value, onChange, businessId }: CoverVideoEditorProps): React.JSX.Element {
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const hasVideo = value.url.length > 0;

  const uploadFile = async (file: File) => {
    if (!businessId) {
      setError("Pick a business first before uploading a cover video.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      // Client-side duration guard (sealed trust boundary — see
      // cover-video-spec.ts comments). Reject >30 s files BEFORE
      // sending the bytes to the server.
      const duration = await probeVideoDuration(file);
      if (duration < 0) {
        setError("Could not read the video. Please pick a different file.");
        return;
      }
      if (duration > COVER_VIDEO_MAX_DURATION_SECONDS) {
        setError(`Cover videos must be ≤ ${COVER_VIDEO_MAX_DURATION_SECONDS} seconds. This one is ${Math.round(duration)} s.`);
        return;
      }
      const form = new FormData();
      form.set("business_id", businessId);
      form.set("file", file);
      const res = await fetch("/api/nex-native/product/upload-cover-video", {
        method: "POST",
        body: form,
      });
      const json = (await res.json().catch(() => null)) as
        | { ok: true; data: { url: string; objectPath: string } }
        | { ok: false; code: string; message?: string }
        | null;
      if (!json || !res.ok || !json.ok) {
        const code = json && !json.ok ? json.code : `http-${res.status}`;
        const message = json && !json.ok ? json.message ?? code : `HTTP ${res.status}`;
        setError(`Upload failed · ${code}: ${message}`);
        return;
      }
      onChange({
        url: json.data.url,
        objectPath: json.data.objectPath,
        durationSeconds: Math.min(Math.round(duration), COVER_VIDEO_MAX_DURATION_SECONDS),
      });
    } catch (e) {
      setError(`Upload failed · ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeVideo = () => {
    onChange(EMPTY_COVER_VIDEO);
    setError(null);
  };

  return (
    <section aria-labelledby="nex-cover-video-heading" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <h2 id="nex-cover-video-heading" style={{ fontSize: 15, fontWeight: 800, margin: 0, color: INK }}>
          Cover video <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: INK_DIM }}>
            optional · 1 only · ≤ {COVER_VIDEO_MAX_DURATION_SECONDS}s
          </span>
        </h2>
        <p style={{ fontSize: 11.5, color: INK_DIM, margin: "4px 0 0", lineHeight: 1.5 }}>
          MP4 · WebM · MOV · ≤ 60 MB · ≤ {COVER_VIDEO_MAX_DURATION_SECONDS} seconds
        </p>
        <p style={{ fontSize: 11.5, color: INK_DIM, margin: "4px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
          The video will replace your main image on the shop page.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadFile(f);
        }}
        style={{ display: "none" }}
      />

      {hasVideo ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, borderRadius: 10, border: `1.5px solid ${RIM}`, background: BG }}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={value.url}
            controls
            preload="metadata"
            style={{ width: "100%", maxHeight: 300, borderRadius: 8, background: "#000" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: INK_DIM }}>
              Declared duration: {value.durationSeconds} s
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !businessId}
                style={pillBtnStyle(ACCENT, "rgba(0,175,255,0.08)", uploading || !businessId)}
              >
                {uploading ? "Uploading…" : "Replace"}
              </button>
              <button
                type="button"
                onClick={removeVideo}
                style={pillBtnStyle(RED, "transparent", false)}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !businessId}
          style={{
            alignSelf: "flex-start",
            padding: "9px 14px",
            borderRadius: 999,
            border: `1.5px solid ${ACCENT}`,
            background: ACCENT,
            color: "#031018",
            fontWeight: 800,
            fontSize: 13,
            cursor: uploading || !businessId ? "not-allowed" : "pointer",
            opacity: uploading || !businessId ? 0.5 : 1,
            fontFamily: NEX_FONT_SANS,
          }}
        >
          {uploading ? "Uploading…" : "+ Upload cover video"}
        </button>
      )}

      {!businessId ? (
        <p style={{ fontSize: 11, color: INK_DIM, margin: 0, fontStyle: "italic" }}>
          Video upload disabled until the business is selected.
        </p>
      ) : null}
      {error ? (
        <div role="alert" style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(200,16,46,0.08)", color: RED, fontSize: 12, fontWeight: 700 }}>
          {error}
        </div>
      ) : null}
    </section>
  );
}

function pillBtnStyle(color: string, bg: string, disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: `1.5px solid ${color}`,
    background: bg,
    color,
    fontWeight: 800,
    fontSize: 11,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontFamily: NEX_FONT_SANS,
  };
}
