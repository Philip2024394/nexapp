// src/app/nex-native/library/backgrounds/_chat-preview.tsx
//
// Chat-bubble preview · shows how the selected asset would look as the
// chat wallpaper. Owner directive 2026-11-11.

import type * as React from "react";

interface Props {
  readonly imageUrl: string;
  readonly tintHex: string | null;
}

export function ChatPreview({ imageUrl, tintHex }: Props): React.JSX.Element {
  const rim = tintHex ?? "#C6A15B";
  return (
    <div
      aria-label="Chat preview"
      data-nex-library-preview="chat"
      style={{
        position: "relative",
        aspectRatio: "9 / 16",
        maxHeight: 420,
        margin: "0 auto",
        borderRadius: 16,
        overflow: "hidden",
        background: "#0A1526",
        boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
        border: `2px solid ${rim}66`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      {/* Two sample bubbles · one incoming, one outgoing */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <div
          style={{
            alignSelf: "flex-start",
            maxWidth: "75%",
            padding: "8px 12px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.92)",
            color: "#111",
            fontSize: 12,
            fontWeight: 600,
            border: `1px solid ${rim}88`,
            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
          }}
        >
          Preview message
        </div>
        <div
          style={{
            alignSelf: "flex-end",
            maxWidth: "75%",
            padding: "8px 12px",
            borderRadius: 14,
            background: rim,
            color: "#111",
            fontSize: 12,
            fontWeight: 700,
            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
          }}
        >
          Looks great!
        </div>
      </div>
    </div>
  );
}
