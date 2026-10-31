"use client";

// src/app/nex-native/dev/message-panel-fixture/page.tsx
//
// Dev-only fixture to render the Live MessagePanel with a known-good
// target so screenshots can be captured without a live Supabase
// session. The real server action calls DO fire if the viewer is
// signed in and the handle resolves · otherwise they return the
// usual {kind:"unauthenticated"} or {kind:"unknown-handle"} shapes
// and the panel renders the matching UI state.

import * as React from "react";
import { MessagePanel } from "@/components/nex-native/live-commerce/MessagePanel";
import type { InviteTarget } from "@/lib/nex-native/live-broadcast/invite-target";

const SAMPLE_TARGET: InviteTarget = {
  accountId: "00000000-0000-0000-0000-000000000001",
  nexHandle: "nex-00001",
  displayName: "Sari Dewi",
  avatarUrl: null,
  country: "ID",
};

export default function MessagePanelFixturePage(): React.JSX.Element {
  const [open, setOpen] = React.useState(true);
  return (
    <main
      style={{
        position: "relative",
        minHeight: "100dvh",
        background: "var(--nex-world-background-base, #020914)",
        color: "#F2F5F8",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: 24,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
        NEX Live · MessagePanel · dev fixture
      </h1>
      <p style={{ fontSize: 12, color: "#8BA9D1", marginTop: 8 }}>
        Dev-only · not reachable in production navigation. Renders the
        panel against a sample target so screenshots can be captured.
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          marginTop: 16,
          background: "#00AFFF",
          color: "#FFF",
          border: "none",
          padding: "10px 14px",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        {open ? "Close panel" : "Open panel"}
      </button>
      <MessagePanel
        open={open}
        onClose={() => setOpen(false)}
        target={SAMPLE_TARGET}
        isGuest={false}
        signInHref="/nex-native/sign-in"
      />
    </main>
  );
}
