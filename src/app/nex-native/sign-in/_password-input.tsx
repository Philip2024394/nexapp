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
          color: "#F2F5F8",
          fontSize: 14,
          padding: "12px 2px",
          outline: "none",
          fontFamily: "inherit",
        }}
      />
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
          color: "#00AFFF",
          padding: 0,
        }}
      >
        {visible ? <EyeOff /> : <Eye />}
      </button>
    </>
  );
}

function Eye(): React.ReactElement {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx={12} cy={12} r={3} />
    </svg>
  );
}

function EyeOff(): React.ReactElement {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a19.7 19.7 0 0 1 4.22-5.19" />
      <path d="M9.9 5.24A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a19.55 19.55 0 0 1-2.79 3.78" />
      <line x1={1} y1={1} x2={23} y2={23} />
    </svg>
  );
}
