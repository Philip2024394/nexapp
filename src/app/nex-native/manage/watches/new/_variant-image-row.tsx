"use client";

// src/app/nex-native/manage/watches/new/_variant-image-row.tsx
//
// Stage A2 · 2026-10-28 · variant image row with owner-sealed UX spec:
//   · One uploaded image per variant
//   · Horizontal thumbnail row on the listing card
//   · Tap a thumbnail → highlight with background glow (theme-accent rim)
//   · Enlarged container opens over the row (sealed R3f modal pattern:
//     dim backdrop · siblings hidden · tap outside / ✕ to close)
//   · Max 5 variants (per sealed decision 2026-10-28)
//   · Same-price variants (Buy Now price unchanged on selection)
//   · File constraints: image/*, ≤ 2 MB, 1:1 square recommended
//
// Stage A storage: variant images live in client-side state as object
// URLs. Not persisted to Supabase in this stage · the parent passes a
// callback so the enclosing form can read them for the preview. Stage B
// will add a `variants` JSONB column on nex_watch_listing + upload the
// files to the nex-media bucket at `variants/<listing_id>/<n>.webp`.

import * as React from "react";
import { NexInput } from "@/lib/nex-native/nex-keyboard/nex-input";

/* ─── Types ─────────────────────────────────────────────────────── */

export interface Variant {
  readonly id: string;
  readonly label: string;
  readonly imageUrl: string;
  readonly byteSize: number;
}

export interface VariantImageRowProps {
  readonly variants: readonly Variant[];
  readonly onChange: (next: readonly Variant[]) => void;
  readonly max?: number;
}

const DEFAULT_MAX = 5;
const MAX_BYTES = 2 * 1024 * 1024;

/* ─── Palette ───────────────────────────────────────────────────── */

const PAL = {
  text: "#F2F5F8",
  textDim: "#C8D4E8",
  textFaint: "#7D9BC0",
  cyan: "#00AFFF",
  warn: "#FF7200",
  tileBg: "rgba(255,255,255,0.03)",
  tileBorder: "rgba(255,255,255,0.08)",
  thumbBorder: "rgba(255,255,255,0.14)",
  thumbBorderActive: "rgba(0,175,255,0.9)",
  thumbGlow: "0 0 0 2px rgba(0,175,255,0.9), 0 0 24px rgba(0,175,255,0.4)",
  addBg: "rgba(0,175,255,0.08)",
  addBorder: "rgba(0,175,255,0.5)",
  backdrop: "rgba(2,9,20,0.86)",
  modalPanel: "rgba(10,22,40,0.98)",
  modalRim: "rgba(0,175,255,0.35)",
  danger: "#FF4F4F",
} as const;

/* ─── Component ─────────────────────────────────────────────────── */

export function VariantImageRow(
  props: VariantImageRowProps,
): React.JSX.Element {
  const max = props.max ?? DEFAULT_MAX;
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [enlargedId, setEnlargedId] = React.useState<string | null>(null);
  const [draftLabel, setDraftLabel] = React.useState("");
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const pendingFileRef = React.useRef<File | null>(null);

  const canAddMore = props.variants.length < max;

  /* Clean up object URLs on unmount to prevent memory leaks. */
  React.useEffect(() => {
    return () => {
      for (const v of props.variants) {
        if (v.imageUrl.startsWith("blob:")) {
          URL.revokeObjectURL(v.imageUrl);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPickFile = (): void => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const onFileChosen = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError("Image must be 2 MB or smaller.");
      return;
    }
    pendingFileRef.current = file;
    setDraftLabel("");
    setEnlargedId("__new__");
  };

  const onConfirmNewVariant = (): void => {
    const file = pendingFileRef.current;
    const trimmed = draftLabel.trim();
    if (!file || !trimmed) return;
    const url = URL.createObjectURL(file);
    const id = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const next: Variant = { id, label: trimmed, imageUrl: url, byteSize: file.size };
    props.onChange([...props.variants, next]);
    pendingFileRef.current = null;
    setDraftLabel("");
    setEnlargedId(null);
    setSelectedId(id);
  };

  const onRemoveVariant = (id: string): void => {
    const removed = props.variants.find((v) => v.id === id);
    if (removed?.imageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(removed.imageUrl);
    }
    props.onChange(props.variants.filter((v) => v.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (enlargedId === id) setEnlargedId(null);
  };

  const onSelectVariant = (id: string): void => {
    setSelectedId(id);
    setEnlargedId(id);
  };

  const enlargedVariant =
    enlargedId && enlargedId !== "__new__"
      ? props.variants.find((v) => v.id === enlargedId) ?? null
      : null;
  const addingNew = enlargedId === "__new__";

  /* ─── Render ──────────────────────────────────────────────────── */

  return (
    <section
      data-nex-variant-row
      aria-label="Colour / variant images"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12.5, color: PAL.textDim }}>
          Optional · add 2–5 images if this watch comes in multiple colours or straps.
        </div>
        <div style={{ fontSize: 11, color: PAL.textFaint, fontWeight: 700 }}>
          {props.variants.length} / {max}
        </div>
      </div>

      {/* Scrollable thumbnail row. Horizontal scroll on overflow so
          thumbnails stay large enough to tap on mobile. */}
      <div
        data-nex-variant-row-scroller
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 10,
          overflowX: "auto",
          padding: "4px 2px 8px",
          scrollbarWidth: "thin",
        }}
      >
        {props.variants.map((v) => {
          const active = selectedId === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelectVariant(v.id)}
              aria-pressed={active ? "true" : "false"}
              data-nex-variant-thumb={v.id}
              data-nex-variant-thumb-active={active ? "true" : "false"}
              style={{
                position: "relative",
                flex: "0 0 auto",
                width: 72,
                height: 72,
                borderRadius: 14,
                padding: 0,
                background: PAL.tileBg,
                border: `1.5px solid ${active ? PAL.thumbBorderActive : PAL.thumbBorder}`,
                cursor: "pointer",
                overflow: "hidden",
                boxShadow: active ? PAL.thumbGlow : "none",
                transition:
                  "border-color 160ms ease-out, box-shadow 200ms ease-out",
                fontFamily: "inherit",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.imageUrl}
                alt={v.label}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 4,
                  right: 4,
                  bottom: 4,
                  padding: "2px 4px",
                  borderRadius: 6,
                  background: "rgba(0,0,0,0.55)",
                  color: "#FFFFFF",
                  fontSize: 9.5,
                  fontWeight: 800,
                  textAlign: "center",
                  letterSpacing: "0.02em",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                {v.label}
              </span>
            </button>
          );
        })}

        {/* Add tile. */}
        {canAddMore ? (
          <button
            type="button"
            onClick={onPickFile}
            aria-label="Add variant image"
            data-nex-variant-add
            style={{
              flex: "0 0 auto",
              width: 72,
              height: 72,
              borderRadius: 14,
              background: PAL.addBg,
              border: `1.5px dashed ${PAL.addBorder}`,
              color: PAL.cyan,
              fontSize: 24,
              fontWeight: 300,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "inherit",
            }}
          >
            +
          </button>
        ) : null}
      </div>

      {uploadError ? (
        <div
          role="alert"
          style={{
            fontSize: 11.5,
            color: PAL.warn,
            background: "rgba(255,114,0,0.08)",
            border: `1px solid rgba(255,114,0,0.3)`,
            borderRadius: 10,
            padding: "8px 12px",
          }}
        >
          {uploadError}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileChosen}
        style={{ display: "none" }}
      />

      {/* ─── Enlarged modal · sealed R3f pattern ──────────────────── */}
      {enlargedVariant || addingNew ? (
        <div
          data-nex-variant-modal
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (addingNew) return; // modal is capturing input; use explicit buttons
            setEnlargedId(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: PAL.backdrop,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 360,
              maxHeight: "90vh",
              borderRadius: 18,
              background: PAL.modalPanel,
              border: `1px solid ${PAL.modalRim}`,
              boxShadow: "0 20px 60px -10px rgba(0,0,0,0.6)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (addingNew) {
                  pendingFileRef.current = null;
                  setDraftLabel("");
                }
                setEnlargedId(null);
              }}
              aria-label="Close"
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.1)",
                border: "none",
                color: PAL.text,
                fontSize: 16,
                lineHeight: 1,
                cursor: "pointer",
                fontFamily: "inherit",
                zIndex: 2,
              }}
            >
              ×
            </button>

            {/* Enlarged image · existing variant */}
            {enlargedVariant ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={enlargedVariant.imageUrl}
                  alt={enlargedVariant.label}
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    objectFit: "cover",
                    display: "block",
                    background: "#000",
                  }}
                />
                <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: PAL.text }}>
                    {enlargedVariant.label}
                  </div>
                  <div style={{ fontSize: 11, color: PAL.textFaint }}>
                    {(enlargedVariant.byteSize / 1024).toFixed(0)} KB · tap outside to close
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveVariant(enlargedVariant.id)}
                    style={{
                      marginTop: 4,
                      minHeight: 40,
                      borderRadius: 10,
                      background: "transparent",
                      border: `1px solid rgba(255,79,79,0.5)`,
                      color: PAL.danger,
                      fontSize: 12.5,
                      fontWeight: 800,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      letterSpacing: "0.02em",
                    }}
                  >
                    Remove this variant
                  </button>
                </div>
              </>
            ) : null}

            {/* New-variant naming step. */}
            {addingNew ? (
              <div style={{ padding: "40px 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: PAL.text }}>
                  Name this variant
                </div>
                <div style={{ fontSize: 11.5, color: PAL.textDim, lineHeight: 1.5 }}>
                  Short label the buyer sees under the thumbnail · e.g. &ldquo;Navy strap&rdquo;,
                  &ldquo;Rose gold&rdquo;, &ldquo;42 mm&rdquo;.
                </div>
                <NexInput
                  value={draftLabel}
                  onChange={setDraftLabel}
                  placeholder="Variant label"
                  maxLength={24}
                  forceKeypadActive={true}
                  style={{
                    width: "100%",
                    minHeight: 44,
                    padding: "0 12px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${PAL.tileBorder}`,
                    color: PAL.text,
                    fontSize: 14,
                    fontFamily: "inherit",
                  }}
                />
                <button
                  type="button"
                  disabled={draftLabel.trim().length === 0}
                  onClick={onConfirmNewVariant}
                  style={{
                    marginTop: 4,
                    minHeight: 44,
                    borderRadius: 10,
                    background:
                      draftLabel.trim().length > 0
                        ? "linear-gradient(135deg, #00AFFF 0%, #0066CC 100%)"
                        : "rgba(0,175,255,0.3)",
                    border: "none",
                    color: "#FFFFFF",
                    fontSize: 13.5,
                    fontWeight: 900,
                    cursor: draftLabel.trim().length > 0 ? "pointer" : "not-allowed",
                    opacity: draftLabel.trim().length > 0 ? 1 : 0.6,
                    fontFamily: "inherit",
                    letterSpacing: "0.02em",
                  }}
                >
                  Add variant
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
