"use client";

// src/components/nex-native/product-create/ImageGallerySection.tsx
//
// Owner-authorised 2026-10-30 (initial) + 2026-10-31 (file-uploads) +
// 2026-10-31 (URL input REMOVED — "we dont use url for image").
//
// File-upload-only multi-image gallery editor:
//   · "+ Upload from device" button — opens the OS file picker, posts
//     the chosen file to /api/nex-native/product/upload-image which
//     stores it under nex-business-assets/products/<businessId>/…
//     and returns a public URL. Up to 4 MB per file, png/jpg/webp.
//   · Reorder — up/down arrow buttons per row swap with the adjacent
//     entry.
//   · Set as main — promotes a gallery entry into the parent form's
//     main image slot (via the `onSetAsMain` callback).
//   · Remove — strips the URL from the list. Does NOT clean up the
//     bucket object (storage GC is a separate concern per the sealed
//     gallery-image-service pattern).
//
// There is NO URL-paste path. Sellers always upload from device. If
// a seller already hosts an image elsewhere they must re-upload it.
//
// Shape of persisted data: nex_product.gallery_urls text[]. No new
// migration required.

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
  /** Business UUID required for file uploads. When absent the file
   *  picker is disabled (URL paste still works). */
  readonly businessId?: string | null;
  /** Optional callback invoked when the seller clicks "Set as main"
   *  on a gallery row. Receives the gallery URL. Parent form swaps
   *  this URL into the main image slot. If not provided, the Set-as-
   *  main button is hidden. */
  readonly onSetAsMain?: (url: string) => void;
}

export function ImageGallerySection({ value, onChange, businessId, onSetAsMain }: ImageGallerySectionProps): React.JSX.Element {
  const atCap = value.length >= GALLERY_MAX_ENTRIES;
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const moveUp = (i: number) => {
    if (i <= 0) return;
    const copy = [...value];
    [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]!];
    onChange(copy);
  };
  const moveDown = (i: number) => {
    if (i >= value.length - 1) return;
    const copy = [...value];
    [copy[i], copy[i + 1]] = [copy[i + 1], copy[i]!];
    onChange(copy);
  };

  const uploadFile = async (file: File) => {
    if (!businessId) {
      setUploadError("Pick a business first before uploading product images.");
      return;
    }
    if (atCap) {
      setUploadError(`Gallery is at the ${GALLERY_MAX_ENTRIES}-image cap.`);
      return;
    }
    setUploading(true);
    setUploadError(null);
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
        setUploadError(`Upload failed · ${code}: ${message}`);
        return;
      }
      onChange([...value, json.data.url]);
    } catch (e) {
      setUploadError(`Upload failed · ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
  };

  return (
    <section aria-labelledby="nex-gallery-heading" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h2 id="nex-gallery-heading" style={{ fontSize: 15, fontWeight: 800, margin: 0, color: INK }}>
          Gallery
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: INK_DIM }}>
            {value.length}/{GALLERY_MAX_ENTRIES}
          </span>
        </h2>
        <p style={{ fontSize: 11.5, color: INK_DIM, margin: 0 }}>
          Upload additional product images from your device. Reorder with the arrows. Click Set as main to promote.
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onPickFile}
          style={{ display: "none" }}
          id="nex-gallery-file-input"
        />
        <label
          htmlFor="nex-gallery-file-input"
          aria-disabled={atCap || uploading || !businessId}
          style={{
            padding: "9px 14px",
            borderRadius: 999,
            border: `1.5px solid ${ACCENT}`,
            background: ACCENT,
            color: "#031018",
            fontWeight: 800,
            fontSize: 13,
            cursor: atCap || uploading || !businessId ? "not-allowed" : "pointer",
            opacity: atCap || uploading || !businessId ? 0.5 : 1,
            fontFamily: NEX_FONT_SANS,
          }}
        >
          {uploading ? "Uploading…" : "+ Upload image"}
        </label>
      </div>

      {!businessId ? (
        <p style={{ fontSize: 11, color: INK_DIM, margin: 0, fontStyle: "italic" }}>
          File upload disabled until the business is selected.
        </p>
      ) : null}
      {uploadError ? (
        <div role="alert" style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(200,16,46,0.08)", color: RED, fontSize: 12, fontWeight: 700 }}>
          {uploadError}
        </div>
      ) : null}

      {value.length === 0 ? (
        <div style={emptyStyle}>No gallery images yet.</div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {value.map((url, i) => (
          <GalleryRow
            key={`${i}-${url}`}
            index={i}
            total={value.length}
            value={url}
            onRemove={() => removeAt(i)}
            onMoveUp={() => moveUp(i)}
            onMoveDown={() => moveDown(i)}
            onSetAsMain={onSetAsMain ? () => onSetAsMain(url.trim()) : null}
          />
        ))}
      </div>
    </section>
  );
}

interface RowProps {
  readonly index: number;
  readonly total: number;
  readonly value: string;
  readonly onRemove: () => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onSetAsMain: (() => void) | null;
}

function GalleryRow({ value, onRemove, onMoveUp, onMoveDown, onSetAsMain, index, total }: RowProps): React.JSX.Element {
  // URL input removed 2026-10-31 · "we dont use url for image". Rows
  // now show only the uploaded image + reorder + Set as main + Remove.
  const canSetAsMain = onSetAsMain !== null && value.trim().length > 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "28px 72px 1fr auto",
        gap: 10,
        alignItems: "center",
        padding: 8,
        borderRadius: 10,
        border: `1.5px solid ${RIM}`,
        background: BG,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label={`Move row ${index + 1} up`}
          style={arrowBtnStyle(index === 0)}
        >
          ▲
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label={`Move row ${index + 1} down`}
          style={arrowBtnStyle(index === total - 1)}
        >
          ▼
        </button>
      </div>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 8,
          background: `url(${value}) center/cover`,
          flexShrink: 0,
          border: `1px solid ${RIM}`,
        }}
        aria-label={`Image ${index + 1} preview`}
      />
      <div style={{ fontSize: 12, color: INK_DIM, fontWeight: 600 }}>
        Image {index + 1}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {canSetAsMain ? (
          <button
            type="button"
            onClick={() => onSetAsMain!()}
            style={pillBtnStyle(ACCENT, "rgba(0,175,255,0.35)", "rgba(0,175,255,0.08)")}
          >
            Set as main
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove image"
          style={pillBtnStyle(RED, "rgba(200,16,46,0.35)", "transparent")}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function arrowBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 24,
    height: 20,
    padding: 0,
    borderRadius: 4,
    border: `1px solid ${RIM}`,
    background: disabled ? "rgba(74, 96, 128, 0.05)" : BG,
    color: disabled ? INK_DIM : INK,
    fontSize: 10,
    lineHeight: 1,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
  };
}

function pillBtnStyle(color: string, borderColor: string, bg: string): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1.5px solid ${borderColor}`,
    background: bg,
    color,
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: NEX_FONT_SANS,
    whiteSpace: "nowrap",
  };
}

const emptyStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: `1.5px dashed ${RIM}`,
  color: INK_DIM,
  fontSize: 12.5,
  fontStyle: "italic",
};
