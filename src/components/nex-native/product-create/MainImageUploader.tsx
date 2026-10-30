"use client";

// src/components/nex-native/product-create/MainImageUploader.tsx
//
// Owner-authorised 2026-10-31. Replaces the "Main image URL" text
// input with a file-upload-only slot. NEX no longer accepts URL-paste
// for product images — every image must be uploaded from the seller's
// device via /api/nex-native/product/upload-image.
//
// Visual: single slot. When empty, a cyan "Upload main image" button.
// When set, a 160×160 preview + Replace + Remove buttons.

import * as React from "react";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const BG = "#FFFFFF";
const RED = "#C8102E";

export interface MainImageUploaderProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly businessId?: string | null;
}

export function MainImageUploader({ value, onChange, businessId }: MainImageUploaderProps): React.JSX.Element {
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const hasImage = value.trim().length > 0;

  const uploadFile = async (file: File) => {
    if (!businessId) {
      setError("Pick a business first before uploading the main image.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.set("business_id", businessId);
      form.set("file", file);
      const res = await fetch("/api/nex-native/product/upload-image", {
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
      onChange(json.data.url);
    } catch (e) {
      setError(`Upload failed · ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <section aria-labelledby="nex-main-image-heading" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h2 id="nex-main-image-heading" style={{ fontSize: 15, fontWeight: 800, margin: 0, color: INK }}>
        Main image
      </h2>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadFile(f);
        }}
        style={{ display: "none" }}
      />

      {hasImage ? (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 10, borderRadius: 10, border: `1.5px solid ${RIM}`, background: BG }}>
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: 10,
              background: `url(${value}) center/cover`,
              border: `1.5px solid ${RIM}`,
              flexShrink: 0,
            }}
            aria-label="Main product image preview"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
              onClick={() => onChange("")}
              style={pillBtnStyle(RED, "transparent", false)}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !businessId}
          style={{
            alignSelf: "flex-start",
            padding: "10px 16px",
            borderRadius: 999,
            border: `1.5px solid ${ACCENT}`,
            background: ACCENT,
            color: "#031018",
            fontWeight: 800,
            fontSize: 14,
            cursor: uploading || !businessId ? "not-allowed" : "pointer",
            opacity: uploading || !businessId ? 0.5 : 1,
            fontFamily: NEX_FONT_SANS,
          }}
        >
          {uploading ? "Uploading…" : "+ Upload main image"}
        </button>
      )}

      {!businessId ? (
        <p style={{ fontSize: 11, color: INK_DIM, margin: 0, fontStyle: "italic" }}>
          Main image upload disabled until the business is selected.
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
    fontSize: 11.5,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontFamily: NEX_FONT_SANS,
    whiteSpace: "nowrap",
  };
}
