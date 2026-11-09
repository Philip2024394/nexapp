"use client";

// src/app/nex-native/nex-1/_client.tsx
//
// NEX 1 support-chat client · owner-sealed 2026-11-09.
//
// Shows the welcome bubble on first render + a composer input.
// Send is visually disabled until the support reply transport is
// wired · no fake round-trip, no mocked typing indicator.

import * as React from "react";

const PALETTE = {
  bubbleBg: "rgba(10, 28, 20, 0.9)",
  bubbleBorder: "rgba(198, 161, 91, 0.45)",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  accent: "#C6A15B",
  composerBg: "rgba(0,0,0,0.4)",
  composerBorder: "rgba(198, 161, 91, 0.25)",
};

const WELCOME_MESSAGE =
  "Welcome to NEX Support. Our team is here to help with any issue or question about the NEX app. Please note: NEX does not provide support for payment-provider issues — for payment questions, please contact your payment provider directly.";

export function Nex1ChatClient(): React.ReactElement {
  const [draft, setDraft] = React.useState("");

  return (
    <>
      <main
        data-nex-1-messages
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "16px 14px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <WelcomeBubble message={WELCOME_MESSAGE} />
      </main>

      <form
        data-nex-1-composer
        onSubmit={(e) => {
          e.preventDefault();
          /* transport not wired · see page.tsx header */
        }}
        style={{
          flexShrink: 0,
          padding:
            "10px 12px calc(env(safe-area-inset-bottom, 0px) + 10px)",
          borderTop: `1px solid ${PALETTE.composerBorder}`,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          aria-label="Message NEX Support"
          data-nex-1-input
          style={{
            flex: 1,
            minWidth: 0,
            padding: "10px 12px",
            borderRadius: 999,
            background: PALETTE.composerBg,
            border: `1px solid ${PALETTE.composerBorder}`,
            color: PALETTE.text,
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled
          data-nex-1-send
          aria-label="Send message"
          title="Support reply channel is being wired · check back soon"
          style={{
            flexShrink: 0,
            minWidth: 56,
            padding: "10px 14px",
            borderRadius: 999,
            background: "rgba(198, 161, 91, 0.3)",
            color: "#061710",
            border: "none",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 0.4,
            cursor: "not-allowed",
            opacity: 0.7,
          }}
        >
          Send
        </button>
      </form>
    </>
  );
}

function WelcomeBubble({ message }: { readonly message: string }): React.ReactElement {
  return (
    <div
      data-nex-1-welcome-bubble
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        maxWidth: "88%",
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: PALETTE.accent,
          color: "#061710",
          display: "grid",
          placeItems: "center",
          fontSize: 15,
          fontWeight: 900,
          marginBottom: 2,
        }}
      >
        1
      </span>
      <div
        style={{
          padding: "12px 14px",
          borderRadius: "14px 14px 14px 4px",
          background: PALETTE.bubbleBg,
          border: `1px solid ${PALETTE.bubbleBorder}`,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: PALETTE.accent,
            marginBottom: 6,
          }}
        >
          NEX Support
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.55,
            color: PALETTE.text,
          }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}
