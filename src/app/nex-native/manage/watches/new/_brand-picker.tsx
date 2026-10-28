"use client";

// src/app/nex-native/manage/watches/new/_brand-picker.tsx
//
// Owner directive 2026-10-26 (Round 3g):
//   · Dropdown + autocomplete across the curated WATCH_BRANDS list.
//   · When the brand is not in the list, pick "Other brand" and type
//     a custom label hard-capped at 2 words.
//   · The input never visually overflows past the surrounding field.
//
// Behaviour:
//   · Type to filter · up to 10 matches dropdown.
//   · Click a match → selected, dropdown closes.
//   · Last row in the dropdown is always "Use custom: '{typed}'" when
//     the typed text is non-empty and NOT in the curated list.
//   · Selecting custom reveals a second input gated by
//     `clampCustomBrand()` (2-word max).
//
// Preservation: uses the sealed NEX keypad on every text input.

import * as React from "react";
import { NexInput } from "@/lib/nex-native/nex-keyboard/nex-input";
import {
  WATCH_BRAND_NAMES,
  clampCustomBrand,
  filterWatchBrands,
} from "@/lib/nex-native/watch-catalog/watch-brands";

const NEX = {
  text: "#0A1526",
  textDim: "#4A5F7C",
  cyan: "#00AFFF",
  rowBg: "rgba(255,255,255,0.04)",
  rowBorder: "rgba(255,255,255,0.08)",
  dropdownBg: "#0F1E34",
  dropdownBorder: "rgba(0,175,255,0.42)",
  dropdownRowHover: "rgba(0,175,255,0.12)",
  gold: "#FFC24B",
  shadow: "0 8px 20px -8px rgba(0, 20, 60, 0.5)",
} as const;

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: NEX.rowBg,
  border: `1px solid ${NEX.rowBorder}`,
  color: "#F2F5F8",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  lineHeight: 1.4,
  outline: "none",
  fontFamily: "inherit",
  maxWidth: "100%",
  boxSizing: "border-box",
};

export interface BrandPickerProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly isCustom: boolean;
  readonly onIsCustomChange: (next: boolean) => void;
}

export function BrandPicker(props: BrandPickerProps): React.JSX.Element {
  const [query, setQuery] = React.useState<string>(props.isCustom ? "" : props.value);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click.
  React.useEffect(() => {
    if (!open) return;
    const handler = (ev: MouseEvent) => {
      if (!containerRef.current) return;
      if (ev.target instanceof Node && !containerRef.current.contains(ev.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  // Mirror selected value back into the query when the selected value
  // changes from outside (e.g., reset).
  React.useEffect(() => {
    if (!props.isCustom) setQuery(props.value);
  }, [props.value, props.isCustom]);

  const matches = React.useMemo(() => filterWatchBrands(query, 10), [query]);
  const trimmed = query.trim();
  const isExactMatch =
    trimmed.length > 0 &&
    WATCH_BRAND_NAMES.some((n) => n.toLowerCase() === trimmed.toLowerCase());

  const pickBrand = (name: string): void => {
    props.onIsCustomChange(false);
    props.onChange(name);
    setQuery(name);
    setOpen(false);
  };

  const pickCustom = (): void => {
    const clamped = clampCustomBrand(trimmed || props.value);
    props.onIsCustomChange(true);
    props.onChange(clamped);
    setQuery("");
    setOpen(false);
  };

  const onCustomChange = (next: string): void => {
    props.onChange(clampCustomBrand(next));
  };

  return (
    <div ref={containerRef} data-nex-watch-brand-picker style={{ position: "relative" }}>
      {/* Main search / selected input */}
      <NexInput
        value={query}
        onChange={(v) => {
          setQuery(v);
          setOpen(true);
          if (props.isCustom) props.onIsCustomChange(false);
        }}
        onFocus={() => setOpen(true)}
        placeholder='Start typing a brand · e.g. "Rolex"'
        maxLength={60}
        forceKeypadActive={true}
        style={inputStyle}
        data-nex-watch-brand-picker-input
      />
      {/* Dropdown · absolute-positioned over following content */}
      {open ? (
        <div
          role="listbox"
          data-nex-watch-brand-picker-dropdown
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: NEX.dropdownBg,
            border: `1px solid ${NEX.dropdownBorder}`,
            borderRadius: 10,
            maxHeight: 240,
            overflowY: "auto",
            zIndex: 40,
            boxShadow: NEX.shadow,
          }}
        >
          {matches.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 12, color: NEX.textDim }}>
              No brand matches "{trimmed}". Use custom below.
            </div>
          ) : (
            matches.map((name) => (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={name.toLowerCase() === trimmed.toLowerCase()}
                onMouseDown={(ev) => {
                  ev.preventDefault(); // keep focus
                  pickBrand(name);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background:
                    name.toLowerCase() === trimmed.toLowerCase()
                      ? NEX.dropdownRowHover
                      : "transparent",
                  border: "none",
                  padding: "9px 12px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "#F2F5F8",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {name}
              </button>
            ))
          )}
          {/* Custom option · only shown when the typed text is non-
              empty and not already an exact match. */}
          {trimmed.length > 0 && !isExactMatch ? (
            <button
              type="button"
              role="option"
              onMouseDown={(ev) => {
                ev.preventDefault();
                pickCustom();
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "rgba(255,194,75,0.08)",
                border: "none",
                borderTop: `1px solid ${NEX.dropdownBorder}`,
                padding: "10px 12px",
                fontSize: 12.5,
                fontWeight: 800,
                color: NEX.gold,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              + Use custom brand: "{clampCustomBrand(trimmed)}"
              <div style={{ fontSize: 10, fontWeight: 600, color: NEX.textDim, marginTop: 2 }}>
                Max 2 words.
              </div>
            </button>
          ) : (
            <button
              type="button"
              role="option"
              onMouseDown={(ev) => {
                ev.preventDefault();
                props.onIsCustomChange(true);
                props.onChange("");
                setQuery("");
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "rgba(255,194,75,0.06)",
                border: "none",
                borderTop: `1px solid ${NEX.dropdownBorder}`,
                padding: "10px 12px",
                fontSize: 12.5,
                fontWeight: 800,
                color: NEX.gold,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Other brand · type my own
            </button>
          )}
        </div>
      ) : null}

      {/* Custom brand input · revealed once "Other" is picked */}
      {props.isCustom ? (
        <div
          data-nex-watch-brand-picker-custom
          style={{
            marginTop: 8,
            padding: "10px 12px",
            background: "rgba(255,194,75,0.08)",
            border: `1px dashed ${NEX.gold}`,
            borderRadius: 10,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: NEX.gold,
              marginBottom: 6,
            }}
          >
            Custom brand · 2 words max
          </div>
          <NexInput
            value={props.value}
            onChange={onCustomChange}
            placeholder='e.g. "Beijing Factory"'
            maxLength={40}
            forceKeypadActive={true}
            style={inputStyle}
            data-nex-watch-brand-picker-custom-input
          />
          <div style={{ fontSize: 10.5, color: NEX.textDim, marginTop: 4 }}>
            {props.value.split(/\s+/).filter(Boolean).length} / 2 words · extra words
            are trimmed automatically.
          </div>
          <button
            type="button"
            onClick={() => {
              props.onIsCustomChange(false);
              props.onChange("");
              setQuery("");
            }}
            style={{
              marginTop: 8,
              background: "transparent",
              border: "none",
              color: NEX.cyan,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: "pointer",
              padding: 0,
              fontFamily: "inherit",
              textDecoration: "underline",
            }}
          >
            ← back to brand list
          </button>
        </div>
      ) : null}
    </div>
  );
}
