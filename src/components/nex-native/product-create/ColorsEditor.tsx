"use client";

// src/components/nex-native/product-create/ColorsEditor.tsx
//
// Owner-authorised 2026-10-31. Colour-variant editor with:
//   · 24-swatch standard palette (quick-pick strip)
//   · Native <input type="color"> hex picker (fallback: text #RRGGBB)
//   · Per-colour row with name + hex + image upload + price override
//   · Image upload reuses the shared /api/nex-native/product/upload-image
//     route (same bucket + ownership gates as the main gallery)
//
// Progressive disclosure within each row: when the seller provides an
// image, the thumbnail replaces the hex swatch so they can see at a
// glance that this colour will render as an image on the shop surface.
// When no image is provided, the hex swatch remains as the visual
// anchor.
//
// Compliance posture:
//   · Image + colour name + hex are seller-declared. NEX does not
//     verify colour accuracy or that the image depicts the labelled
//     colour.

import * as React from "react";
import {
  STANDARD_COLOR_PALETTE,
  normaliseHex,
} from "@/lib/nex-native/catalogue/colors-spec";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const BG = "#FFFFFF";
const RED = "#C8102E";

export const COLORS_MAX_ENTRIES = 20;

export interface ColorEntryDraft {
  readonly name: string;
  readonly hex: string;           // normalised #RRGGBB uppercase
  readonly priceMajor: string;    // optional override (major currency string)
  readonly imageUrl: string;      // optional
}

export interface ColorsEditorValue {
  readonly entries: readonly ColorEntryDraft[];
}

export const EMPTY_COLORS: ColorsEditorValue = { entries: [] };

const EMPTY_ENTRY: ColorEntryDraft = { name: "", hex: "#000000", priceMajor: "", imageUrl: "" };

export interface ColorsEditorProps {
  readonly value: ColorsEditorValue;
  readonly onChange: (next: ColorsEditorValue) => void;
  readonly businessId?: string | null;
  readonly baseCurrency?: string;
}

export function ColorsEditor({ value, onChange, businessId, baseCurrency }: ColorsEditorProps): React.JSX.Element {
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadingIndex, setUploadingIndex] = React.useState<number | null>(null);
  const atCap = value.entries.length >= COLORS_MAX_ENTRIES;

  const addEntry = (seed?: Partial<ColorEntryDraft>) => {
    if (atCap) return;
    onChange({ entries: [...value.entries, { ...EMPTY_ENTRY, ...seed }] });
  };
  const updateAt = (i: number, next: ColorEntryDraft) => {
    const copy = [...value.entries];
    copy[i] = next;
    onChange({ entries: copy });
  };
  const removeAt = (i: number) => {
    onChange({ entries: value.entries.filter((_, idx) => idx !== i) });
  };
  const moveUp = (i: number) => {
    if (i <= 0) return;
    const copy = [...value.entries];
    [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]!];
    onChange({ entries: copy });
  };
  const moveDown = (i: number) => {
    if (i >= value.entries.length - 1) return;
    const copy = [...value.entries];
    [copy[i], copy[i + 1]] = [copy[i + 1], copy[i]!];
    onChange({ entries: copy });
  };

  const uploadFileFor = async (i: number, file: File) => {
    if (!businessId) {
      setUploadError("Pick a business first before uploading colour images.");
      return;
    }
    setUploadingIndex(i);
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
      updateAt(i, { ...value.entries[i]!, imageUrl: json.data.url });
    } catch (e) {
      setUploadError(`Upload failed · ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploadingIndex(null);
    }
  };

  const pickStandard = (swatch: { name: string; hex: string }) => {
    const existingIdx = value.entries.findIndex((e) => e.hex === swatch.hex);
    if (existingIdx >= 0) return; // already in list
    addEntry({ name: swatch.name, hex: swatch.hex });
  };

  return (
    <section aria-labelledby="nex-colors-heading" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h2 id="nex-colors-heading" style={{ fontSize: 15, fontWeight: 800, margin: 0, color: INK }}>
          Colour variants
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: INK_DIM }}>
            {value.entries.length}/{COLORS_MAX_ENTRIES}
          </span>
        </h2>
        <p style={{ fontSize: 12, color: INK_DIM, margin: "4px 0 0", lineHeight: 1.5 }}>
          Pick from the standard palette, or pick a custom colour. Add an image per colour to show it as a thumbnail — leave blank to show the colour circle. Add a price override to charge differently for this colour.
        </p>
      </div>

      {/* Standard palette strip */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {STANDARD_COLOR_PALETTE.map((s) => {
          const already = value.entries.some((e) => e.hex === s.hex);
          return (
            <button
              key={s.hex}
              type="button"
              onClick={() => pickStandard(s)}
              aria-label={`Add ${s.name}`}
              title={`${s.name} ${s.hex}`}
              disabled={already || atCap}
              style={{
                position: "relative",
                width: 28,
                height: 28,
                padding: 0,
                borderRadius: "50%",
                background: s.hex,
                border: `1.5px solid ${already ? ACCENT : "rgba(16,32,51,0.14)"}`,
                cursor: already || atCap ? "default" : "pointer",
                opacity: atCap ? 0.4 : 1,
                boxShadow: already ? `0 0 0 1.5px rgba(0,175,255,0.3)` : "none",
              }}
            >
              {already ? (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: luminance(s.hex) > 0.6 ? "#102033" : "#FFFFFF",
                    fontWeight: 900,
                    fontSize: 14,
                    pointerEvents: "none",
                  }}
                >
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Custom-colour picker */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <CustomHexPicker onPick={(hex, name) => addEntry({ hex, name })} disabled={atCap} />
        {atCap ? (
          <span style={{ fontSize: 11, color: INK_DIM, fontStyle: "italic" }}>Palette is at the {COLORS_MAX_ENTRIES} colour cap.</span>
        ) : null}
      </div>

      {uploadError ? (
        <div role="alert" style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(200,16,46,0.08)", color: RED, fontSize: 12, fontWeight: 700 }}>
          {uploadError}
        </div>
      ) : null}

      {/* Picked rows */}
      {value.entries.length === 0 ? (
        <div style={emptyStyle}>No colours yet. Pick from the palette above or add a custom one.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {value.entries.map((entry, i) => (
            <ColorRow
              key={`${entry.hex}-${i}`}
              value={entry}
              index={i}
              total={value.entries.length}
              baseCurrency={baseCurrency}
              uploading={uploadingIndex === i}
              onChange={(next) => updateAt(i, next)}
              onRemove={() => removeAt(i)}
              onMoveUp={() => moveUp(i)}
              onMoveDown={() => moveDown(i)}
              onPickFile={(file) => void uploadFileFor(i, file)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CustomHexPicker(props: { onPick: (hex: string, name: string) => void; disabled: boolean }): React.JSX.Element {
  const [hex, setHex] = React.useState<string>("#102033");
  const [name, setName] = React.useState<string>("");
  const canAdd = !props.disabled && name.trim().length > 0 && /^#[0-9A-Fa-f]{6}$/.test(hex);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, border: `1.5px solid ${RIM}`, borderRadius: 10, background: BG }}>
      <input
        type="color"
        value={hex}
        onChange={(e) => setHex(e.target.value.toUpperCase())}
        disabled={props.disabled}
        aria-label="Pick custom colour"
        style={{ width: 36, height: 36, border: "none", background: "transparent", cursor: props.disabled ? "not-allowed" : "pointer", padding: 0 }}
      />
      <input
        type="text"
        value={hex}
        onChange={(e) => {
          const normalised = normaliseHex(e.target.value);
          if (normalised) setHex(normalised);
          else setHex(e.target.value);
        }}
        placeholder="#RRGGBB"
        maxLength={7}
        disabled={props.disabled}
        style={{ width: 90, padding: "6px 8px", borderRadius: 6, border: `1px solid ${RIM}`, fontSize: 12, fontFamily: "monospace" }}
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Colour name"
        maxLength={60}
        disabled={props.disabled}
        style={{ width: 140, padding: "6px 8px", borderRadius: 6, border: `1px solid ${RIM}`, fontSize: 12, fontFamily: NEX_FONT_SANS }}
      />
      <button
        type="button"
        onClick={() => {
          if (!canAdd) return;
          const final = normaliseHex(hex) ?? hex;
          props.onPick(final, name.trim());
          setName("");
        }}
        disabled={!canAdd}
        style={{
          padding: "6px 12px",
          borderRadius: 999,
          border: `1.5px solid ${ACCENT}`,
          background: canAdd ? ACCENT : "transparent",
          color: canAdd ? "#031018" : ACCENT,
          fontWeight: 800,
          fontSize: 12,
          cursor: canAdd ? "pointer" : "not-allowed",
          opacity: canAdd ? 1 : 0.5,
        }}
      >
        + Add
      </button>
    </div>
  );
}

function ColorRow(props: {
  readonly value: ColorEntryDraft;
  readonly index: number;
  readonly total: number;
  readonly baseCurrency?: string;
  readonly uploading: boolean;
  readonly onChange: (next: ColorEntryDraft) => void;
  readonly onRemove: () => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onPickFile: (file: File) => void;
}): React.JSX.Element {
  const { value, index, total, uploading, onChange, onRemove, onMoveUp, onMoveDown, onPickFile } = props;
  const set = <K extends keyof ColorEntryDraft>(k: K, v: ColorEntryDraft[K]) => onChange({ ...value, [k]: v });
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        border: `1.5px solid ${RIM}`,
        background: BG,
        display: "grid",
        gridTemplateColumns: "28px 56px 1fr auto",
        gap: 10,
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <button type="button" onClick={onMoveUp} disabled={index === 0} aria-label="Move up" style={arrowStyle(index === 0)}>▲</button>
        <button type="button" onClick={onMoveDown} disabled={index === total - 1} aria-label="Move down" style={arrowStyle(index === total - 1)}>▼</button>
      </div>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: value.imageUrl ? 8 : "50%",
          background: value.imageUrl ? `url(${value.imageUrl}) center/cover` : value.hex,
          border: `1.5px solid rgba(16,32,51,0.12)`,
        }}
        aria-label={value.imageUrl ? `${value.name} image preview` : `${value.name} ${value.hex}`}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, minWidth: 0 }}>
        <Field label="Colour name">
          <input type="text" value={value.name} onChange={(e) => set("name", e.target.value)} maxLength={60} style={inputStyle} />
        </Field>
        <Field label="Hex">
          <input
            type="text"
            value={value.hex}
            onChange={(e) => {
              const n = normaliseHex(e.target.value);
              set("hex", n ?? e.target.value);
            }}
            maxLength={7}
            style={{ ...inputStyle, fontFamily: "monospace" }}
          />
        </Field>
        <Field label={`Price override (${props.baseCurrency ?? "base"})`}>
          <input
            type="number"
            value={value.priceMajor}
            onChange={(e) => set("priceMajor", e.target.value)}
            min={0}
            step="0.01"
            placeholder="leave blank = base price"
            style={inputStyle}
          />
        </Field>
        <Field label="Image for this colour">
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickFile(f);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={smallBtnStyle(ACCENT, "rgba(0,175,255,0.08)")}
            >
              {uploading ? "Uploading…" : value.imageUrl ? "Replace" : "Upload"}
            </button>
            {value.imageUrl ? (
              <button
                type="button"
                onClick={() => set("imageUrl", "")}
                style={smallBtnStyle(RED, "transparent")}
              >
                Clear
              </button>
            ) : null}
          </div>
        </Field>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove colour"
        style={{
          padding: "8px 10px",
          borderRadius: 999,
          border: `1.5px solid rgba(200,16,46,0.35)`,
          background: "transparent",
          color: RED,
          fontWeight: 800,
          fontSize: 11,
          cursor: "pointer",
          fontFamily: NEX_FONT_SANS,
          whiteSpace: "nowrap",
        }}
      >
        Remove
      </button>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: INK_DIM, textTransform: "uppercase", letterSpacing: "0.04em" }}>{props.label}</span>
      {props.children}
    </label>
  );
}

function arrowStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 24,
    height: 20,
    padding: 0,
    borderRadius: 4,
    border: `1px solid ${RIM}`,
    background: disabled ? "rgba(74,96,128,0.05)" : BG,
    color: disabled ? INK_DIM : INK,
    fontSize: 10,
    lineHeight: 1,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
  };
}

function smallBtnStyle(color: string, bg: string): React.CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 999,
    border: `1.5px solid ${color}`,
    background: bg,
    color,
    fontWeight: 800,
    fontSize: 10.5,
    cursor: "pointer",
    fontFamily: NEX_FONT_SANS,
    whiteSpace: "nowrap",
  };
}

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 6,
  border: `1.5px solid ${RIM}`,
  background: BG,
  color: INK,
  fontSize: 12,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: NEX_FONT_SANS,
};

const emptyStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: `1.5px dashed ${RIM}`,
  color: INK_DIM,
  fontSize: 12,
  fontStyle: "italic",
};

/** Relative-luminance approximation for pick-contrast on the ✓ check.
 *  Not WCAG-grade; just enough to pick a light vs dark glyph colour. */
function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
