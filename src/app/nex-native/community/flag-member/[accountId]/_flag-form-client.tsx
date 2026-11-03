"use client";

// Client · reason textarea with char counter + submit guard.
// Enforces the sealed CHECK (reason BETWEEN 10 AND 500 chars) at the
// UI layer so the user sees the constraint before submitting. Server
// re-validates and redirects with error on violation.

import * as React from "react";

const C = {
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  danger: "#FF4D5E",
};

const MIN = 10;
const MAX = 500;

export function FlagMemberFormClient(): React.ReactElement {
  const [reason, setReason] = React.useState("");
  const trimmed = reason.trim();
  const canSubmit = trimmed.length >= MIN && trimmed.length <= MAX;
  const charLabel = `${trimmed.length} / ${MAX}`;
  const tooShort = trimmed.length > 0 && trimmed.length < MIN;

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        background: C.panel,
        border: `1px solid ${C.borderSoft}`,
      }}
    >
      <label
        htmlFor="flag-reason"
        style={{
          display: "block",
          fontSize: 11,
          letterSpacing: "0.14em",
          color: C.secondary,
          textTransform: "uppercase",
          fontWeight: 800,
          marginBottom: 8,
        }}
      >
        Why are you flagging this member?
      </label>
      <textarea
        id="flag-reason"
        name="reason"
        required
        minLength={MIN}
        maxLength={MAX}
        rows={5}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={`At least ${MIN} characters. Be specific (e.g. "says they live in Dublin but keeps asking what shops are open in Cork · doesn't seem to actually be from Dublin").`}
        aria-describedby="flag-reason-help"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.25)",
          border: `1px solid ${tooShort ? C.danger : C.borderSoft}`,
          color: C.textPrimary,
          fontSize: 14,
          lineHeight: 1.55,
          resize: "vertical",
          fontFamily: "inherit",
          outline: "none",
        }}
      />
      <div
        id="flag-reason-help"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 6,
          fontSize: 11,
          color: tooShort ? C.danger : C.textMuted,
        }}
      >
        <span>
          {tooShort
            ? `At least ${MIN} characters required.`
            : `Minimum ${MIN} · maximum ${MAX} characters.`}
        </span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{charLabel}</span>
      </div>
      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          marginTop: 16,
          width: "100%",
          padding: "14px 20px",
          borderRadius: 999,
          background: canSubmit ? C.danger : "rgba(255,77,94,0.3)",
          color: canSubmit ? "#FFF" : "rgba(255,255,255,0.5)",
          border: "none",
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: "0.02em",
          cursor: canSubmit ? "pointer" : "not-allowed",
          textTransform: "uppercase",
          transition: "background 150ms ease",
        }}
      >
        Submit flag
      </button>
      <p
        style={{
          marginTop: 10,
          fontSize: 11,
          color: C.textMuted,
          lineHeight: 1.55,
          textAlign: "center",
          opacity: 0.85,
        }}
      >
        Your identity stays private · only NEX staff see who flagged whom.
      </p>
    </div>
  );
}
