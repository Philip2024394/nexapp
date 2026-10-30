"use client";

// src/components/nex-native/product-create/ColorsEditor.tsx
//
// Owner-authorised 2026-10-31 (initial) + 2026-10-31 (redesign).
//
// Owner feedback: "Variants we need redesign i am confused when i
// select color nothing happens." Previous version had 28×28 palette
// swatches and dropped a dense 4-field form below on each tap · easy
// to miss, easy to misread.
//
// New shape (seller-first):
//   · Big 44×44 tappable swatches arranged in a wrapping grid · tap
//     toggles selection with instant visual confirmation (border +
//     check mark + name chip).
//   · Below the palette: a native colour picker + "Add" for custom
//     hex colours that aren't in the standard set.
//   · Below that: "Your colours (N)" section with a VISUAL CARD per
//     selected colour · circle swatch (or image thumbnail if uploaded)
//     + colour name + three plain action buttons: "+ Image", "+ Price",
//     "× Remove". Price input only appears after "+ Price" is tapped.
//
// Image upload path and data contract unchanged.

import * as React from "react";
import {
  STANDARD_COLOR_PALETTE,
  normaliseHex,
} from "@/lib/nex-native/catalogue/colors-spec";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const INK = "#102033";
const INK_DIM = "#4A6080";
const INK_MUTE = "#8BA9D1";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const BG = "#FFFFFF";
const RED = "#C8102E";

export const COLORS_MAX_ENTRIES = 20;

export interface ColorEntryDraft {
  readonly name: string;
  readonly hex: string;        // normalised #RRGGBB uppercase
  readonly priceMajor: string; // optional override · "" = base price
  readonly imageUrl: string;   // optional
}

export interface ColorsEditorValue {
  readonly entries: readonly ColorEntryDraft[];
}

export const EMPTY_COLORS: ColorsEditorValue = { entries: [] };

export interface ColorsEditorProps {
  readonly value: ColorsEditorValue;
  readonly onChange: (next: ColorsEditorValue) => void;
  readonly businessId?: string | null;
  readonly baseCurrency?: string;
}

export function ColorsEditor({ value, onChange, businessId, baseCurrency }: ColorsEditorProps): React.JSX.Element {
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadingHex, setUploadingHex] = React.useState<string | null>(null);
  const atCap = value.entries.length >= COLORS_MAX_ENTRIES;

  const setEntries = (next: readonly ColorEntryDraft[]) => onChange({ entries: next });

  const toggleStandard = (swatch: { name: string; hex: string }) => {
    const idx = value.entries.findIndex((e) => e.hex === swatch.hex);
    if (idx >= 0) {
      // Already selected → remove it (toggle off)
      setEntries(value.entries.filter((_, i) => i !== idx));
      return;
    }
    if (atCap) return;
    setEntries([
      ...value.entries,
      { name: swatch.name, hex: swatch.hex, priceMajor: "", imageUrl: "" },
    ]);
  };

  const addCustom = (hex: string, name: string) => {
    if (atCap) return;
    if (value.entries.some((e) => e.hex === hex)) return;
    setEntries([
      ...value.entries,
      { name: name.trim() || "Custom", hex, priceMajor: "", imageUrl: "" },
    ]);
  };

  const updateEntry = (hex: string, patch: Partial<ColorEntryDraft>) => {
    setEntries(value.entries.map((e) => (e.hex === hex ? { ...e, ...patch } : e)));
  };

  const removeEntry = (hex: string) => {
    setEntries(value.entries.filter((e) => e.hex !== hex));
  };

  const uploadImageFor = async (hex: string, file: File) => {
    if (!businessId) {
      setUploadError("Pick a business first before uploading colour images.");
      return;
    }
    setUploadError(null);
    setUploadingHex(hex);
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
      updateEntry(hex, { imageUrl: json.data.url });
    } catch (e) {
      setUploadError(`Upload failed · ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploadingHex(null);
    }
  };

  const selectedHexSet = new Set(value.entries.map((e) => e.hex));

  return (
    <section aria-labelledby="nex-colors-heading" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2 id="nex-colors-heading" style={{ fontSize: 15, fontWeight: 800, margin: 0, color: INK }}>
          Colour variants
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: INK_DIM }}>
            {value.entries.length}/{COLORS_MAX_ENTRIES}
          </span>
        </h2>
        <p style={{ fontSize: 11.5, color: INK_DIM, margin: "4px 0 0", lineHeight: 1.5 }}>
          Tap a colour below to add it. Then add an image or a price override per colour (both optional).
        </p>
      </div>

      {/* ── Standard palette (big swatches, instant feedback) ───── */}
      <div style={blockStyle}>
        <h3 style={subHeadingStyle}>Standard colours</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))",
            gap: 8,
          }}
        >
          {STANDARD_COLOR_PALETTE.map((s) => {
            const selected = selectedHexSet.has(s.hex);
            return (
              <button
                key={s.hex}
                type="button"
                onClick={() => toggleStandard(s)}
                aria-pressed={selected}
                aria-label={`${selected ? "Remove" : "Add"} ${s.name}`}
                title={`${s.name} ${s.hex}`}
                disabled={!selected && atCap}
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "1 / 1",
                  padding: 0,
                  borderRadius: 12,
                  background: s.hex,
                  border: selected ? `3px solid ${ACCENT}` : `2px solid rgba(16,32,51,0.18)`,
                  cursor: !selected && atCap ? "not-allowed" : "pointer",
                  opacity: !selected && atCap ? 0.4 : 1,
                  boxShadow: selected ? `0 0 0 2px rgba(0,175,255,0.25)` : "none",
                  transition: "border 100ms, box-shadow 100ms",
                }}
              >
                {selected ? (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: ACCENT,
                      color: "#031018",
                      fontSize: 11,
                      fontWeight: 900,
                      lineHeight: "18px",
                      textAlign: "center",
                      border: "2px solid #FFFFFF",
                    }}
                  >
                    ✓
                  </span>
                ) : null}
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    bottom: -16,
                    left: 0,
                    right: 0,
                    fontSize: 10,
                    fontWeight: 700,
                    color: INK_DIM,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.name}
                </span>
              </button>
            );
          })}
        </div>
        {/* bottom-space so the name labels under swatches don't overlap the next block */}
        <div style={{ height: 10 }} />
      </div>

      {/* ── Custom colour picker ─────────────────────────────────── */}
      <CustomColourPicker
        disabled={atCap}
        selectedHexes={selectedHexSet}
        onAdd={addCustom}
      />

      {uploadError ? (
        <div role="alert" style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(200,16,46,0.08)", color: RED, fontSize: 12, fontWeight: 700 }}>
          {uploadError}
        </div>
      ) : null}

      {/* ── Selected colours · one card per entry ────────────────── */}
      {value.entries.length === 0 ? (
        <div style={emptyStyle}>
          <strong style={{ color: INK }}>No colours selected yet.</strong>
          <br />
          Tap a swatch above to add it.
        </div>
      ) : (
        <div style={blockStyle}>
          <h3 style={subHeadingStyle}>Your selected colours · {value.entries.length}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {value.entries.map((e) => (
              <ColorCard
                key={e.hex}
                entry={e}
                baseCurrency={baseCurrency}
                uploading={uploadingHex === e.hex}
                onPickFile={(file) => void uploadImageFor(e.hex, file)}
                onClearImage={() => updateEntry(e.hex, { imageUrl: "" })}
                onPriceChange={(v) => updateEntry(e.hex, { priceMajor: v })}
                onRename={(v) => updateEntry(e.hex, { name: v })}
                onRemove={() => removeEntry(e.hex)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CustomColourPicker(props: {
  disabled: boolean;
  selectedHexes: Set<string>;
  onAdd: (hex: string, name: string) => void;
}): React.JSX.Element {
  const [hex, setHex] = React.useState("#102033");
  const [name, setName] = React.useState("");

  const normalisedHex = normaliseHex(hex) ?? hex;
  const canAdd =
    !props.disabled
    && name.trim().length > 0
    && /^#[0-9A-Fa-f]{6}$/.test(normalisedHex)
    && !props.selectedHexes.has(normalisedHex);

  return (
    <div style={blockStyle}>
      <h3 style={subHeadingStyle}>Not in the palette? Pick a custom colour</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <input
          type="color"
          value={hex}
          onChange={(e) => setHex(e.target.value.toUpperCase())}
          disabled={props.disabled}
          aria-label="Custom colour picker"
          style={{
            width: 44,
            height: 44,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: props.disabled ? "not-allowed" : "pointer",
          }}
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Colour name (required)"
          maxLength={60}
          disabled={props.disabled}
          style={textInputStyle}
        />
        <button
          type="button"
          onClick={() => {
            if (!canAdd) return;
            props.onAdd(normalisedHex, name.trim());
            setName("");
          }}
          disabled={!canAdd}
          style={{
            padding: "9px 16px",
            borderRadius: 999,
            border: `1.5px solid ${ACCENT}`,
            background: canAdd ? ACCENT : "transparent",
            color: canAdd ? "#031018" : ACCENT,
            fontWeight: 800,
            fontSize: 13,
            cursor: canAdd ? "pointer" : "not-allowed",
            opacity: canAdd ? 1 : 0.5,
            fontFamily: NEX_FONT_SANS,
          }}
        >
          + Add
        </button>
      </div>
    </div>
  );
}

function ColorCard(props: {
  entry: ColorEntryDraft;
  baseCurrency?: string;
  uploading: boolean;
  onPickFile: (file: File) => void;
  onClearImage: () => void;
  onPriceChange: (v: string) => void;
  onRename: (v: string) => void;
  onRemove: () => void;
}): React.JSX.Element {
  const { entry, baseCurrency, uploading } = props;
  const hasImage = entry.imageUrl.trim().length > 0;
  const hasPrice = entry.priceMajor.trim().length > 0;
  const [editingPrice, setEditingPrice] = React.useState(hasPrice);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div
      style={{
        padding: 10,
        borderRadius: 12,
        border: `1.5px solid ${RIM}`,
        background: BG,
        display: "grid",
        gridTemplateColumns: "72px 1fr auto",
        gap: 12,
        alignItems: "center",
      }}
    >
      {/* 72px preview · image if uploaded, otherwise a hex circle */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: hasImage ? 10 : "50%",
          background: hasImage ? `url(${entry.imageUrl}) center/cover` : entry.hex,
          border: `1.5px solid rgba(16,32,51,0.14)`,
          flexShrink: 0,
        }}
        aria-label={hasImage ? `${entry.name} image` : `${entry.name} ${entry.hex}`}
      />

      {/* Middle column · name + status + actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <input
          type="text"
          value={entry.name}
          onChange={(e) => props.onRename(e.target.value)}
          maxLength={60}
          style={{ ...textInputStyle, fontWeight: 800, fontSize: 14, padding: "6px 10px" }}
        />
        <div style={{ fontSize: 11.5, color: INK_DIM }}>
          {hasImage ? "Image uploaded" : "Shows as colour circle"}
          {hasPrice ? ` · override ${baseCurrency ?? ""} ${entry.priceMajor}` : " · base price"}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) props.onPickFile(f);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          style={{ display: "none" }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={pillBtn(ACCENT, "rgba(0,175,255,0.08)", uploading)}
          >
            {uploading ? "Uploading…" : hasImage ? "Replace image" : "+ Image"}
          </button>
          {hasImage ? (
            <button
              type="button"
              onClick={props.onClearImage}
              style={pillBtn(INK_DIM, "transparent", false)}
            >
              Clear image
            </button>
          ) : null}
          {!editingPrice ? (
            <button
              type="button"
              onClick={() => setEditingPrice(true)}
              style={pillBtn(ACCENT, "rgba(0,175,255,0.08)", false)}
            >
              + Price
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11, color: INK_DIM, fontWeight: 700 }}>{baseCurrency ?? "Price"}</span>
              <input
                type="number"
                value={entry.priceMajor}
                onChange={(e) => props.onPriceChange(e.target.value)}
                min={0}
                step="0.01"
                placeholder="override"
                style={{ ...textInputStyle, width: 110, padding: "6px 8px", fontSize: 12 }}
              />
              {hasPrice ? (
                <button
                  type="button"
                  onClick={() => { props.onPriceChange(""); setEditingPrice(false); }}
                  style={pillBtn(INK_DIM, "transparent", false)}
                >
                  Clear
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* × remove pin */}
      <button
        type="button"
        onClick={props.onRemove}
        aria-label={`Remove ${entry.name}`}
        style={{
          width: 28,
          height: 28,
          padding: 0,
          borderRadius: "50%",
          border: "none",
          background: "rgba(200,16,46,0.1)",
          color: RED,
          fontSize: 16,
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
    </div>
  );
}

const blockStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: `1.5px solid ${RIM}`,
  background: BG,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const subHeadingStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  margin: 0,
  color: INK_DIM,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};
const textInputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: `1.5px solid ${RIM}`,
  background: BG,
  color: INK,
  fontSize: 13,
  outline: "none",
  flex: "1 1 160px",
  minWidth: 100,
  boxSizing: "border-box",
  fontFamily: NEX_FONT_SANS,
};
const emptyStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 10,
  border: `2px dashed rgba(0, 175, 255, 0.35)`,
  color: INK_MUTE,
  fontSize: 12.5,
  textAlign: "center",
  lineHeight: 1.6,
};
function pillBtn(color: string, bg: string, disabled: boolean): React.CSSProperties {
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
    whiteSpace: "nowrap",
  };
}
