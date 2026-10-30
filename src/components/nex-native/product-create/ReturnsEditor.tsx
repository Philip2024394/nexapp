"use client";

// src/components/nex-native/product-create/ReturnsEditor.tsx
//
// Owner-authorised 2026-10-31 (SIMPLIFIED per owner directive).
//
// Owner-exact spec: "Returns Policy" title · 3 small circle chips
// for 7/14/30-day quick-select · a big dark textarea for the seller
// to write their own policy. Tapping a chip auto-populates the
// textarea with the seller-friendly template; the seller can then
// reword it freely.

import * as React from "react";
import { policyTemplateForDays } from "@/lib/nex-native/catalogue/returns-spec";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const INK = "#102033";
const INK_DIM = "#4A6080";
const INK_MUTE = "#8BA9D1";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const BG = "#FFFFFF";
const DARK = "#0A1526";
const DARK_FG = "#F4F7FC";

export type DaysOption = 7 | 14 | 30 | null;

export interface ReturnsDraft {
  readonly policyText: string;
  readonly daysOption: DaysOption;
}

export const EMPTY_RETURNS: ReturnsDraft = {
  policyText: "",
  daysOption: null,
};

export interface ReturnsEditorProps {
  readonly value: ReturnsDraft;
  readonly onChange: (next: ReturnsDraft) => void;
  /** Unused in the simplified shape · kept for form-client call-site
   *  compatibility until the parent form stops forwarding it. */
  readonly destinationIsos?: readonly string[];
}

export function ReturnsEditor({ value, onChange }: ReturnsEditorProps): React.JSX.Element {
  const setPolicyText = (next: string) => onChange({ ...value, policyText: next });

  const pickDays = (days: 7 | 14 | 30) => {
    // Tapping a chip ALWAYS writes a fresh template · simplest
    // predictable behaviour. Re-tapping the same chip clears it so
    // the seller has an escape hatch.
    if (value.daysOption === days) {
      onChange({ policyText: "", daysOption: null });
      return;
    }
    onChange({ policyText: policyTemplateForDays(days), daysOption: days });
  };

  return (
    <section aria-labelledby="nex-returns-heading" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <h2 id="nex-returns-heading" style={{ fontSize: 15, fontWeight: 800, margin: 0, color: INK }}>
          Returns Policy
        </h2>
        <p style={{ fontSize: 12, color: INK_DIM, margin: "4px 0 0", lineHeight: 1.5 }}>
          Pick a window below to drop in a template, or write your own policy from scratch.
        </p>
      </div>

      {/* 3 small circle chips */}
      <div style={{ display: "flex", gap: 10 }}>
        {([7, 14, 30] as const).map((d) => {
          const active = value.daysOption === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => pickDays(d)}
              aria-pressed={active}
              aria-label={`Use ${d}-day return window`}
              style={{
                width: 56,
                height: 56,
                padding: 0,
                borderRadius: "50%",
                border: active ? `3px solid ${ACCENT}` : `2px solid rgba(16,32,51,0.18)`,
                background: active ? ACCENT : BG,
                color: active ? "#031018" : INK,
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: NEX_FONT_SANS,
                lineHeight: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: active ? `0 0 0 2px rgba(0,175,255,0.25)` : "none",
                transition: "all 100ms",
              }}
            >
              <span>{d}</span>
              <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.8, marginTop: 2 }}>DAYS</span>
            </button>
          );
        })}
      </div>

      {/* Big dark textarea for the policy text */}
      <textarea
        value={value.policyText}
        onChange={(e) => setPolicyText(e.target.value)}
        placeholder="Pick a window above to drop in a template, or type your own policy here."
        maxLength={2000}
        rows={6}
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          border: `2px solid ${DARK}`,
          background: DARK,
          color: DARK_FG,
          fontSize: 13.5,
          lineHeight: 1.55,
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
          resize: "vertical",
          minHeight: 120,
          fontFamily: NEX_FONT_SANS,
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: INK_MUTE }}>
          {value.policyText.length} / 2000 characters
        </span>
        {value.policyText.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange({ policyText: "", daysOption: null })}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: `1.5px solid ${INK_MUTE}`,
              background: "transparent",
              color: INK_MUTE,
              fontWeight: 700,
              fontSize: 11,
              cursor: "pointer",
              fontFamily: NEX_FONT_SANS,
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
    </section>
  );
}
