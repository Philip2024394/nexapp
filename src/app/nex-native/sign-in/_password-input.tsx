"use client";

// src/app/nex-native/sign-in/_password-input.tsx
//
// Sign-in password input with inline eye toggle. Rendered as the
// `input` child of the sign-in page's IconInput wrapper (which is
// itself a flex-row <label>), so the input + eye button sit as
// sibling flex children next to the shared lock icon on the left.

import * as React from "react";

export function SignInPasswordInput(): React.ReactElement {
  const [visible, setVisible] = React.useState(false);
  return (
    <>
      <input
        required
        type={visible ? "text" : "password"}
        name="password"
        minLength={6}
        placeholder="Password"
        autoComplete="current-password"
        aria-label="Password"
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: "none",
          color: "#1A1512",
          fontSize: 14,
          padding: "12px 2px",
          outline: "none",
          fontFamily: "inherit",
        }}
      />
      {/* Owner directive 2026-11-27 · 3D eye instead of a flat blue
          SVG. Uses the native color-emoji glyph which renders as a
          glossy 3D icon on Windows 11 / macOS / iOS / Android (Segoe
          UI Emoji / Apple Color Emoji / Noto Color Emoji). No new
          asset shipped. Hidden state uses the see-no-evil glyph so
          the action-icon convention (icon shows the ACTION, not the
          state) is preserved: eye = tap to see, monkey = tap to hide. */}
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        data-nex-sign-in-password-toggle
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          fontSize: 22,
          lineHeight: 1,
          fontFamily:
            '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
        }}
      >
        <span aria-hidden>{visible ? "🙈" : "👁️"}</span>
      </button>
    </>
  );
}
