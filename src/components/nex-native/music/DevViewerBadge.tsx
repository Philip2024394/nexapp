// src/components/nex-native/music/DevViewerBadge.tsx
//
// Owner directive 2026-10-30 · "add to hendra pages the yellow badge
// for its hendra viewing and blue for user is viewing so i know for
// dev who is watching the screen i see". Dev-only chip, pinned top-
// left of the viewport, so during manual testing the active session
// role is unmistakable at a glance.
//
// Non-visual guarantees:
//   · Caller is responsible for gating on NODE_ENV. This component
//     renders whatever `kind` it is passed — it does NOT check the
//     environment itself. The server shell decides.
//   · pointer-events: none so the badge never swallows player taps.
//   · zIndex sits above every music chrome layer (shell = 20,
//     actions-stack = 24, overlay = 23) but below the library
//     overlay (= 100) so it remains visible on the base view and
//     yields to full-screen sheets.

import * as React from "react";

export type DevViewerBadgeKind = "owner" | "viewer";

export interface DevViewerBadgeProps {
  readonly kind: DevViewerBadgeKind;
}

export function DevViewerBadge(props: DevViewerBadgeProps): React.JSX.Element {
  const isOwner = props.kind === "owner";
  const bg = isOwner ? "#FFD700" : "#00AFFF";
  const ink = isOwner ? "#1A1200" : "#031018";
  const label = isOwner ? "VIEWING · OWNER" : "VIEWING · USER";
  return (
    <div
      data-nex-music-dev-viewer-badge
      data-nex-music-dev-viewer-badge-kind={props.kind}
      role="status"
      aria-label={isOwner ? "Dev: viewing as owner" : "Dev: viewing as user"}
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 6px)",
        left: 6,
        zIndex: 40,
        padding: "4px 8px",
        borderRadius: 999,
        background: bg,
        color: ink,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.4)",
        border: "1.5px solid rgba(0, 0, 0, 0.2)",
        pointerEvents: "none",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {label}
    </div>
  );
}
