"use client";

// src/app/nex-native/settings/blocked/_contact-row-button.tsx
//
// Block / Unblock button for one contact row on the Contacts connection
// page. Owner-sealed 2026-11-13.
//
// Uses React.useTransition so the row's visual state flips immediately
// while the sealed friend-service.{block,unblock}Account write runs
// server-side. On error the local state reverts and a short message
// appears beneath the card via data-* attribute (styled by the parent).

import * as React from "react";
import { blockAccountAction, unblockAccountAction } from "./_actions";

const CONTROL_BG = "#1D2432";
const CONTROL_INK = "#F3E3C6";
const CONTROL_ACTIVE = "#FF7200";
const BLOCKED_COLOUR = "#D82A2A";

export function ContactRowButton({
  otherAccountId,
  isBlocked,
}: {
  otherAccountId: string;
  isBlocked: boolean;
}): React.JSX.Element {
  const [pending, startTransition] = React.useTransition();
  const [optimistic, setOptimistic] = React.useState<boolean>(isBlocked);
  // Reconcile when the server-side value shifts underneath us.
  React.useEffect(() => {
    setOptimistic(isBlocked);
  }, [isBlocked]);

  function handleClick() {
    const next = !optimistic;
    setOptimistic(next);
    const fd = new FormData();
    fd.set("other_account_id", otherAccountId);
    startTransition(async () => {
      const action = next ? blockAccountAction : unblockAccountAction;
      const result = await action(fd);
      if (!result.ok) {
        // Revert optimistic flip · server rejected (self-block, race,
        // stale edge, etc). Parent row data-attribute still reads
        // from the server · UI reverts on next render.
        setOptimistic(!next);
      }
    });
  }

  const label = optimistic ? "Blocked" : "Block";
  const background = optimistic ? BLOCKED_COLOUR : CONTROL_BG;
  const colour = optimistic ? "#FFFFFF" : CONTROL_INK;
  const accent = optimistic ? "#FFFFFF" : CONTROL_ACTIVE;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={optimistic}
      aria-label={`${otherAccountId} · currently ${optimistic ? "blocked" : "not blocked"} · tap to ${optimistic ? "unblock" : "block"}`}
      data-nex-contacts-connection-toggle={optimistic ? "blocked" : "ok"}
      style={{
        position: "absolute",
        bottom: 10,
        right: 12,
        minWidth: 56,
        height: 24,
        padding: "0 10px 0 24px",
        borderRadius: 999,
        border: "none",
        cursor: pending ? "default" : "pointer",
        background,
        color: colour,
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "0.1em",
        textAlign: "right",
        opacity: pending ? 0.7 : 1,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 2,
          left: optimistic ? 32 : 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: accent,
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          transition: "left 160ms ease, background 160ms ease",
        }}
      />
      {label.toUpperCase()}
    </button>
  );
}
