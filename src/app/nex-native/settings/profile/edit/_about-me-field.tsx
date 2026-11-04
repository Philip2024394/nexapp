"use client";

// src/app/nex-native/settings/profile/edit/_about-me-field.tsx
//
// About-me textarea with char counter + soft line-count advisory.
// Owner directive 2026-11-04 · "7 lines of text or 500 · with counter".
// Server-side rule: 500 char hard cap. 7-line target is a soft advisory
// (lines aren't a reliable server concept — width wrapping varies).

import { useState } from "react";

const MAX_CHARS = 500;
const SOFT_LINES = 7;
const GOLD = "#C6A15B";
const SAGE = "#AFC5B5";
const WARN = "#FF9A3C";

interface Props {
  readonly defaultValue: string;
}

export function AboutMeField({ defaultValue }: Props): React.ReactElement {
  const [value, setValue] = useState(defaultValue.slice(0, MAX_CHARS));
  const charCount = value.length;
  const lineCount = value === "" ? 0 : value.split(/\r?\n/).length;
  const overLines = lineCount > SOFT_LINES;
  const nearChars = charCount > MAX_CHARS - 50;
  const counterColor = nearChars ? WARN : overLines ? WARN : `${SAGE}B3`;

  return (
    <>
      <textarea
        name="about_me"
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, MAX_CHARS))}
        maxLength={MAX_CHARS}
        rows={5}
        placeholder="A few sentences · what you're into, what you're looking for, anything you want people to know."
        style={{ minHeight: 112 }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 11,
          color: counterColor,
          marginTop: -2,
        }}
      >
        <span>
          {overLines ? (
            <>
              <span style={{ color: WARN }}>{lineCount} lines</span>
              <span style={{ color: `${SAGE}B3` }}> · aim for ≤ {SOFT_LINES}</span>
            </>
          ) : (
            <span style={{ color: `${SAGE}B3` }}>
              {lineCount === 0 ? "" : `${lineCount} ${lineCount === 1 ? "line" : "lines"}`}
            </span>
          )}
        </span>
        <span style={{ fontWeight: nearChars ? 700 : 500 }}>
          {charCount} / {MAX_CHARS}
          {charCount === MAX_CHARS ? (
            <span style={{ color: GOLD, marginLeft: 4 }}>· max</span>
          ) : null}
        </span>
      </div>
    </>
  );
}
