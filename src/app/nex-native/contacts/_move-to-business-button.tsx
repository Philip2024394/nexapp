"use client";

// src/app/nex-native/contacts/_move-to-business-button.tsx
//
// Move-friend-to-business one-tap action button.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Drop-in client button that demotes a friend contact back to the
// Business bucket via moveToBusinessAction. Symmetric counterpart of
// SaveAsFriendButton. Idempotent on the server · repeated taps are
// safe. After the first successful tap, the button flips to "Moved ✓"
// and disables so nothing further happens.

import * as React from "react";
import { moveToBusinessAction } from "./_move-to-business-action";

const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const BORDER = "rgba(198, 161, 91, 0.35)";

export function MoveToBusinessButton({
  contactAccountId,
  contactDisplayName,
  compact = false,
}: {
  readonly contactAccountId: string;
  readonly contactDisplayName: string;
  readonly compact?: boolean;
}): React.JSX.Element {
  const [state, setState] = React.useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "moved" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onClick() {
    if (state.kind === "sending" || state.kind === "moved") return;
    setState({ kind: "sending" });
    const result = await moveToBusinessAction(contactAccountId);
    if (result.ok) {
      setState({ kind: "moved" });
    } else {
      setState({ kind: "error", message: result.error });
    }
  }

  const disabled = state.kind === "sending" || state.kind === "moved";
  const label = (() => {
    if (state.kind === "sending") return "Moving…";
    if (state.kind === "moved") return "Moved to Business ✓";
    if (state.kind === "error") return "Retry";
    return compact ? "Move to Business" : `Move ${contactDisplayName} to Business`;
  })();

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        data-nex-move-to-business={contactAccountId}
        /* Secondary styling — this is the demote action · less
           prominent than Save-as-Friend's solid gold pill · outlined
           muted pill so it doesn't compete visually with the primary
           promote action. */
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: compact ? "5px 10px" : "8px 14px",
          borderRadius: 999,
          border: `1px solid ${BORDER}`,
          background: "transparent",
          color: INK_DIM,
          fontSize: compact ? 10.5 : 11.5,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: disabled ? "default" : "pointer",
          opacity: state.kind === "sending" ? 0.7 : 1,
          fontFamily: "inherit",
        }}
      >
        <span aria-hidden style={{ fontSize: 13 }}>🏪</span>
        {label}
      </button>
      {state.kind === "error" ? (
        <span style={{ fontSize: 10, color: "#FF6B6B" }}>
          {state.message}
        </span>
      ) : state.kind === "moved" ? (
        <span style={{ fontSize: 9.5, color: INK_MUTED }}>
          They&rsquo;ll appear in your Business tab from here on.
          Reversible via Save as Friend.
        </span>
      ) : null}
    </div>
  );
}
