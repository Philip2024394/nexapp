"use client";

// src/components/nex-native/product-create/ProductImagesEditor.tsx
//
// Owner-authorised 2026-10-31. Replaces the previous
// ImageGallerySection + MainImageUploader split with a single editor
// that renders the owner-sealed visual contract:
//
//   1 LARGE "MAIN" preview container with dashed/broken border
//   when empty · mirrors slot 1.
//
//   4 THUMBNAIL slots in a row below, same dashed/broken-border
//   style when empty · each has upload + small X delete pin + ◀ ▶
//   reorder arrows.
//
//   The first filled slot IS the main image · the main preview above
//   mirrors it. Moving an image between the 4 slots gives the owner
//   explicit control over which image is "main".
//
//   File-upload only · NO URL input anywhere (owner directive
//   2026-10-31 "we dont use url for image").
//
//   Each uploaded image goes to the shared /api/nex-native/product/
//   upload-image route (nex-business-assets bucket · 4 MB · png / jpg
//   / webp). The 4 MB + format rule is surfaced as helper copy under
//   the heading per owner directive.
//
// Data contract:
//   The editor exposes a fixed-length-4 string array. Empty slots are
//   represented as "" (empty string). The parent form splits on save:
//     · nex_product.image_url   = value[0]  (empty → null)
//     · nex_product.gallery_urls = value.slice(1).filter(nonempty)

import * as React from "react";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const INK = "#102033";
const INK_DIM = "#4A6080";
const INK_MUTE = "#8BA9D1";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const RIM_DASH = "rgba(0, 175, 255, 0.35)";
const BG = "#FFFFFF";
const RED = "#C8102E";

export const PRODUCT_IMAGE_SLOT_COUNT = 4;
export const PRODUCT_IMAGE_FILE_FORMATS = "PNG · JPG · WebP";
export const PRODUCT_IMAGE_MAX_MB = 4;

/** Fixed-length-4 image URL slot array. Position 0 is the main image. */
export type ProductImagesValue = readonly [string, string, string, string];

export const EMPTY_PRODUCT_IMAGES: ProductImagesValue = ["", "", "", ""];

/** Build a 4-slot value from the stored (image_url, gallery_urls) pair.
 *  Preserves any 2nd/3rd/4th gallery entries; silently drops a 5th+. */
export function productImagesFromStored(
  imageUrl: string | null,
  galleryUrls: readonly string[] | null,
): ProductImagesValue {
  const slot0 = (imageUrl ?? "").trim();
  const gall = Array.isArray(galleryUrls)
    ? galleryUrls.filter((u) => typeof u === "string" && u.trim().length > 0).slice(0, 3)
    : [];
  return [
    slot0,
    gall[0] ?? "",
    gall[1] ?? "",
    gall[2] ?? "",
  ] as const;
}

/** Split a 4-slot value back into (main_image_url, gallery_urls). */
export function productImagesToStored(value: ProductImagesValue): {
  readonly image_url: string | null;
  readonly gallery_urls: readonly string[];
} {
  const mainRaw = (value[0] ?? "").trim();
  const image_url = mainRaw.length > 0 ? mainRaw : null;
  const gallery_urls = value.slice(1).filter((u) => u.trim().length > 0);
  return { image_url, gallery_urls };
}

export interface ProductImagesEditorProps {
  readonly value: ProductImagesValue;
  readonly onChange: (next: ProductImagesValue) => void;
  readonly businessId?: string | null;
}

export function ProductImagesEditor({ value, onChange, businessId }: ProductImagesEditorProps): React.JSX.Element {
  const [error, setError] = React.useState<string | null>(null);
  const [uploadingSlot, setUploadingSlot] = React.useState<number | null>(null);
  const fileInputRefs = [
    React.useRef<HTMLInputElement | null>(null),
    React.useRef<HTMLInputElement | null>(null),
    React.useRef<HTMLInputElement | null>(null),
    React.useRef<HTMLInputElement | null>(null),
  ] as const;

  const setSlot = (i: number, url: string) => {
    const next: [string, string, string, string] = [...value] as [string, string, string, string];
    next[i] = url;
    onChange(next);
  };

  const swap = (a: number, b: number) => {
    if (a < 0 || b < 0 || a >= PRODUCT_IMAGE_SLOT_COUNT || b >= PRODUCT_IMAGE_SLOT_COUNT) return;
    const next: [string, string, string, string] = [...value] as [string, string, string, string];
    [next[a], next[b]] = [next[b], next[a]!];
    onChange(next);
  };

  const uploadFile = async (slot: number, file: File) => {
    if (!businessId) {
      setError("Pick a business first before uploading images.");
      return;
    }
    setError(null);
    setUploadingSlot(slot);
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
      setSlot(slot, json.data.url);
    } catch (e) {
      setError(`Upload failed · ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploadingSlot(null);
      const ref = fileInputRefs[slot]?.current;
      if (ref) ref.value = "";
    }
  };

  const mainImage = value[0];
  const filledCount = value.filter((u) => u.trim().length > 0).length;

  return (
    <section aria-labelledby="nex-images-heading" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <h2 id="nex-images-heading" style={{ fontSize: 15, fontWeight: 800, margin: 0, color: INK }}>
          Product images
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: INK_DIM }}>
            {filledCount}/{PRODUCT_IMAGE_SLOT_COUNT}
          </span>
        </h2>
        <p style={{ fontSize: 11.5, color: INK_DIM, margin: "4px 0 0", lineHeight: 1.5 }}>
          {PRODUCT_IMAGE_FILE_FORMATS} · ≤ {PRODUCT_IMAGE_MAX_MB} MB per image. The first image is your main image.
          Reorder with the ◀ ▶ arrows to change which image shows up top.
        </p>
      </div>

      {/* ── MAIN preview · mirrors slot 0 ────────────────────────── */}
      <MainPreview url={mainImage} />

      {/* ── 4 thumbnail slots ────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
        }}
      >
        {([0, 1, 2, 3] as const).map((i) => (
          <ThumbSlot
            key={i}
            index={i}
            url={value[i]}
            uploading={uploadingSlot === i}
            disabled={!businessId}
            inputRef={fileInputRefs[i]!}
            onPick={(file) => uploadFile(i, file)}
            onDelete={() => setSlot(i, "")}
            onMoveLeft={i > 0 ? () => swap(i, i - 1) : null}
            onMoveRight={i < PRODUCT_IMAGE_SLOT_COUNT - 1 ? () => swap(i, i + 1) : null}
          />
        ))}
      </div>

      {!businessId ? (
        <p style={{ fontSize: 11, color: INK_DIM, margin: 0, fontStyle: "italic" }}>
          Image upload disabled until the business is selected.
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

function MainPreview({ url }: { url: string }): React.JSX.Element {
  const hasImage = url.trim().length > 0;
  return (
    <div
      aria-label="Main image preview"
      style={{
        // Owner directive 2026-10-31 · smaller main container. Caps at
        // 180px and sits centred so the thumbnail row dominates the
        // seller's attention (the thumbs are where the editing happens).
        width: 180,
        height: 180,
        alignSelf: "center",
        borderRadius: 12,
        border: hasImage ? `1.5px solid ${RIM}` : `2px dashed ${RIM_DASH}`,
        background: hasImage ? `url(${url}) center/cover` : "#F7F9FC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: INK_MUTE,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {hasImage ? null : <span>Main · empty</span>}
    </div>
  );
}

interface ThumbSlotProps {
  readonly index: number;
  readonly url: string;
  readonly uploading: boolean;
  readonly disabled: boolean;
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly onPick: (file: File) => void;
  readonly onDelete: () => void;
  readonly onMoveLeft: (() => void) | null;
  readonly onMoveRight: (() => void) | null;
}

function ThumbSlot({ index, url, uploading, disabled, inputRef, onPick, onDelete, onMoveLeft, onMoveRight }: ThumbSlotProps): React.JSX.Element {
  const hasImage = url.trim().length > 0;
  const isMain = index === 0 && hasImage;

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onPick(f);
  };

  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        borderRadius: 10,
        border: hasImage ? `1.5px solid ${isMain ? ACCENT : RIM}` : `2px dashed ${RIM_DASH}`,
        background: hasImage ? `url(${url}) center/cover` : "#F7F9FC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onFileChange}
        style={{ display: "none" }}
      />

      {hasImage ? (
        <>
          {/* Slot number badge (top-left) */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 4,
              left: 4,
              padding: "2px 6px",
              borderRadius: 999,
              background: isMain ? ACCENT : "rgba(16, 32, 51, 0.65)",
              color: isMain ? "#031018" : "#FFFFFF",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {isMain ? "Main" : index + 1}
          </span>
          {/* Small X delete pin (top-right) */}
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete image ${index + 1}`}
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 22,
              height: 22,
              padding: 0,
              borderRadius: "50%",
              border: "none",
              background: "rgba(16, 32, 51, 0.75)",
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 900,
              cursor: "pointer",
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
          {/* Reorder arrows (bottom row) */}
          <div
            style={{
              position: "absolute",
              bottom: 4,
              left: 4,
              right: 4,
              display: "flex",
              justifyContent: "space-between",
              gap: 4,
              pointerEvents: "none",
            }}
          >
            <button
              type="button"
              onClick={() => onMoveLeft?.()}
              disabled={!onMoveLeft}
              aria-label={`Move image ${index + 1} left`}
              style={arrowBtn(onMoveLeft === null)}
            >
              ◀
            </button>
            <button
              type="button"
              onClick={() => onMoveRight?.()}
              disabled={!onMoveRight}
              aria-label={`Move image ${index + 1} right`}
              style={arrowBtn(onMoveRight === null)}
            >
              ▶
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          aria-label={`Upload image to slot ${index + 1}`}
          style={{
            width: "100%",
            height: "100%",
            padding: 0,
            border: "none",
            background: "transparent",
            color: INK_MUTE,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: disabled || uploading ? "not-allowed" : "pointer",
            fontFamily: NEX_FONT_SANS,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: 24, color: ACCENT, opacity: 0.6 }}>+</span>
          <span>{uploading ? "Uploading…" : `Slot ${index + 1}`}</span>
        </button>
      )}
    </div>
  );
}

function arrowBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 24,
    height: 24,
    padding: 0,
    borderRadius: "50%",
    border: "none",
    background: disabled ? "rgba(16, 32, 51, 0.35)" : "rgba(16, 32, 51, 0.75)",
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    lineHeight: 1,
    opacity: disabled ? 0.4 : 1,
    pointerEvents: "auto",
  };
}
