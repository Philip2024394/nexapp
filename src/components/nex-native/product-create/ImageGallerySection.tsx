"use client";

// src/components/nex-native/product-create/ImageGallerySection.tsx
//
// Owner-authorised 2026-10-30 (Product Upload World-Class brief) ·
// multi-image gallery editor for the shared Create + Edit forms. Phase
// 1 contract: URL-based (paste a hosted image URL). File-upload
// swap-in is a separate deliverable — the storage layer
// (updateProductGalleryUrls) already enforces http/https, 1024-char
// limit, and the 10-entry cap, so we align the UI to those bounds now.
//
// Shape of persisted data: nex_product.gallery_urls text[] (already
// exists on the row — no migration required).
//
// Visual contract (deliberately minimal):
//
//   ┌────────────────────────────────────────────────────┐
//   │  Gallery (0/10)                                    │
//   │  ┌─────────────┬───────────────┐                  │
//   │  │ [preview]   │ https://cdn/… │  [Remove]        │
//   │  └─────────────┴───────────────┘                  │
//   │  … up to 10 rows …                                 │
//   │  [+ Add image URL]                                 │
//   └────────────────────────────────────────────────────┘

import * as React from "react";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const BG = "#FFFFFF";
const RED = "#C8102E";

export const GALLERY_MAX_ENTRIES = 10;

export interface ImageGallerySectionProps {
  readonly value: readonly string[];
  readonly onChange: (next: readonly string[]) => void;
}

export function ImageGallerySection({ value, onChange }: ImageGallerySectionProps): React.JSX.Element {
  const atCap = value.length >= GALLERY_MAX_ENTRIES;

  const updateAt = (i: number, next: string) => {
    const copy = [...value];
    copy[i] = next;
    onChange(copy);
  };
  const removeAt = (i: number) => {
    const copy = value.filter((_, idx) => idx !== i);
    onChange(copy);
  };
  const addEmpty = () => {
    if (atCap) return;
    onChange([...value, ""]);
  };

  return (
    <section aria-labelledby="nex-gallery-heading" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 id="nex-gallery-heading" style={{ fontSize: 15, fontWeight: 800, margin: 0, color: INK }}>
          Gallery
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: INK_DIM }}>
            {value.length}/{GALLERY_MAX_ENTRIES}
          </span>
        </h2>
        <p style={{ fontSize: 11.5, color: INK_DIM, margin: 0 }}>
          Additional product images shown alongside the main image.
        </p>
      </div>

      {value.length === 0 ? (
        <div style={emptyStyle}>
          No gallery images yet.
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {value.map((url, i) => (
          <GalleryRow
            key={i}
            index={i}
            value={url}
            onChange={(next) => updateAt(i, next)}
            onRemove={() => removeAt(i)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addEmpty}
        disabled={atCap}
        style={{
          alignSelf: "flex-start",
          padding: "9px 14px",
          borderRadius: 999,
          border: `1.5px solid ${ACCENT}`,
          background: "transparent",
          color: ACCENT,
          fontWeight: 800,
          fontSize: 13,
          cursor: atCap ? "not-allowed" : "pointer",
          opacity: atCap ? 0.5 : 1,
          fontFamily: NEX_FONT_SANS,
        }}
      >
        {atCap ? "Gallery full" : "+ Add image URL"}
      </button>
    </section>
  );
}

interface RowProps {
  readonly index: number;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly onRemove: () => void;
}

function GalleryRow({ value, onChange, onRemove }: RowProps): React.JSX.Element {
  const trimmed = value.trim();
  const looksValid = /^https?:\/\//i.test(trimmed) && trimmed.length <= 1024;
  const showError = trimmed.length > 0 && !looksValid;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "60px 1fr auto",
        gap: 10,
        alignItems: "center",
        padding: 8,
        borderRadius: 10,
        border: `1.5px solid ${showError ? "rgba(200,16,46,0.4)" : RIM}`,
        background: BG,
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 8,
          background: looksValid ? `url(${trimmed}) center/cover` : "#E8EEF5",
          flexShrink: 0,
        }}
        aria-hidden
      />
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… (http or https, max 1024 chars)"
          maxLength={1200}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: `1.5px solid ${RIM}`,
            background: BG,
            color: INK,
            fontSize: 13,
            outline: "none",
            width: "100%",
            boxSizing: "border-box",
            fontFamily: NEX_FONT_SANS,
          }}
        />
        {showError ? (
          <span style={{ fontSize: 11, color: RED, fontWeight: 700 }}>
            URL must start with http:// or https:// and be ≤ 1024 chars
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove image"
        style={{
          padding: "8px 12px",
          borderRadius: 999,
          border: `1.5px solid rgba(200,16,46,0.35)`,
          background: "transparent",
          color: RED,
          fontWeight: 800,
          fontSize: 12,
          cursor: "pointer",
          fontFamily: NEX_FONT_SANS,
        }}
      >
        Remove
      </button>
    </div>
  );
}

const emptyStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: `1.5px dashed ${RIM}`,
  color: INK_DIM,
  fontSize: 12.5,
  fontStyle: "italic",
};
