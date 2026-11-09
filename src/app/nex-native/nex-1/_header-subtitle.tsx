"use client";

// src/app/nex-native/nex-1/_header-subtitle.tsx
//
// Owner directive 2026-11-10 revision 2 · header displays the short
// sequential ticket number (e.g. "Ticket #146") instead of the full
// NX1-YYYYMMDD-XXXX string. Value is written to localStorage by
// _client.tsx after the server returns a ticket; this component just
// reads + displays it. A fresh visit before the chat loads shows
// "Ticket …" as a placeholder.

import * as React from "react";

const STORAGE_KEY = "nex-1-ticket-sequence";

export function Nex1HeaderSubtitle(): React.ReactElement {
  const [seq, setSeq] = React.useState<string>("");

  React.useEffect(() => {
    const read = () => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        setSeq(saved && saved.length > 0 ? saved : "");
      } catch {
        setSeq("");
      }
    };
    read();
    // Poll briefly so the subtitle updates once the client component
    // writes the real ticket number after first server load.
    const interval = window.setInterval(read, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <span
      data-nex-1-ticket-number
      style={{
        fontSize: 11,
        color: "#B5C3D6",
        letterSpacing: 0.4,
        fontWeight: 700,
      }}
    >
      Ticket {seq ? `#${seq}` : "…"}
    </span>
  );
}
