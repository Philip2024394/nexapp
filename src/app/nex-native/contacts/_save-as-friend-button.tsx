"use client";

// src/app/nex-native/contacts/_save-as-friend-button.tsx
//
// Save-as-friend one-tap action button.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Drop-in client button that promotes a business contact to a friend
// invite via saveAsFriendAction. Idempotent on the server (sealed
// nex_friend_edge path) so repeated taps are safe. After the first
// successful tap the button swaps to "Invite sent" and disables so
// nothing further happens until the recipient accepts (or declines)
// through the existing invite flow.

import * as React from "react";
import { saveAsFriendAction } from "./_save-as-friend-action";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const INK_MUTED = "#7D9BC0";

export function SaveAsFriendButton({
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
    | { kind: "sent"; status: "pending" | "accepted" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onClick() {
    if (state.kind === "sending" || state.kind === "sent") return;
    setState({ kind: "sending" });
    const result = await saveAsFriendAction(contactAccountId);
    if (result.ok) {
      setState({ kind: "sent", status: result.status });
    } else {
      setState({ kind: "error", message: result.error });
    }
  }

  const disabled = state.kind === "sending" || state.kind === "sent";
  const label = (() => {
    if (state.kind === "sending") return "Sending…";
    if (state.kind === "sent") {
      return state.status === "accepted" ? "Friends ✓" : "Invite sent ✓";
    }
    if (state.kind === "error") return "Retry";
    return compact ? "Save as friend" : `Save ${contactDisplayName} as friend`;
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
        data-nex-save-as-friend={contactAccountId}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: compact ? "5px 10px" : "8px 14px",
          borderRadius: 999,
          border: "none",
          background: disabled ? "rgba(198, 161, 91, 0.35)" : GOLD,
          color: "#1A120A",
          fontSize: compact ? 10.5 : 11.5,
          fontWeight: 900,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: disabled ? "default" : "pointer",
          opacity: state.kind === "sending" ? 0.7 : 1,
          fontFamily: "inherit",
        }}
      >
        <span aria-hidden style={{ fontSize: 13 }}>👋</span>
        {label}
      </button>
      {state.kind === "error" ? (
        <span style={{ fontSize: 10, color: "#FF6B6B" }}>
          {state.message}
        </span>
      ) : state.kind === "sent" && state.status === "pending" ? (
        <span style={{ fontSize: 9.5, color: INK_MUTED }}>
          They&rsquo;ll see your invite next time they open contacts.
        </span>
      ) : null}
    </div>
  );
}
