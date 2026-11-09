"use client";

// src/app/nex-native/nex-1/_header-subtitle.tsx
//
// Owner directive 2026-11-10 · header now shows a ticket number
// instead of a generic "Support · online" status. Ticket number is
// client-generated on mount and persisted to localStorage so a
// mid-flight refresh keeps the same number.
//
// Honest scope · the ticket number is LOCAL only. Phase 2 of this
// workstream wires ticket persistence to a HQ tickets table + admin
// reply flow. Until then, support tickets are not visible server-side.

import * as React from "react";

const STORAGE_KEY = "nex-1-ticket-number";

function generateTicketNumber(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear().toString();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  // 4 random alphanumeric chars so collisions are unlikely at low volumes.
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NX1-${yyyy}${mm}${dd}-${rand}`;
}

export function Nex1HeaderSubtitle(): React.ReactElement {
  const [ticket, setTicket] = React.useState<string>("");

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && saved.length > 0) {
        setTicket(saved);
        return;
      }
      const next = generateTicketNumber();
      window.localStorage.setItem(STORAGE_KEY, next);
      setTicket(next);
    } catch {
      setTicket(generateTicketNumber());
    }
  }, []);

  return (
    <span
      data-nex-1-ticket-number
      style={{
        fontSize: 10,
        color: "#B5C3D6",
        letterSpacing: 0.4,
        fontFamily:
          "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
      }}
    >
      Ticket {ticket || "assigning…"}
    </span>
  );
}
