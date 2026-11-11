// src/components/nex-native/skeletons/chat-conversation-skeleton.tsx
//
// Cycle 22 Priority 4 · shape-matching skeleton for the peer-chat
// route. Renders the real header + message-bubble placeholder shapes
// (two incoming, one outgoing) + composer bar. Zero fake copy · no
// names, no message text. The user sees an empty chat shape
// shimmering, which reads as "chat is opening" rather than "loading".

import type * as React from "react";
import { SkeletonShell, SkeletonBlock, SkeletonCircle } from "./_shared";

export function ChatConversationSkeleton(): React.JSX.Element {
  return (
    <SkeletonShell>
      {/* Header · avatar + name/subtitle on the left · right cluster */}
      <div
        style={{
          padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px 10px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid color-mix(in srgb, var(--nex-world-text-primary, #2A1F0F) 6%, transparent)",
        }}
      >
        <SkeletonCircle size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <SkeletonBlock width="55%" height={14} radius={6} />
          <SkeletonBlock width="35%" height={10} radius={5} marginTop={6} />
        </div>
        <SkeletonCircle size={32} />
        <SkeletonCircle size={32} />
      </div>

      {/* Message column · two incoming bubbles (left-aligned, white),
          one outgoing (right-aligned, amber-tinted). Shapes only. */}
      <div
        style={{
          flex: 1,
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <SkeletonBlock width="60%" height={44} radius={18} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <SkeletonBlock width="42%" height={28} radius={18} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <SkeletonBlock
            width="52%"
            height={36}
            radius={18}
            style={{
              background:
                "color-mix(in srgb, var(--nex-world-secondary, #D4A24F) 22%, transparent)",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <SkeletonBlock width="48%" height={32} radius={18} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <SkeletonBlock
            width="38%"
            height={28}
            radius={18}
            style={{
              background:
                "color-mix(in srgb, var(--nex-world-secondary, #D4A24F) 22%, transparent)",
            }}
          />
        </div>
      </div>

      {/* Composer · attach "+" circle · pill input · send circle */}
      <div
        style={{
          padding: "10px 10px calc(env(safe-area-inset-bottom, 0px) + 10px)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderTop:
            "1px solid color-mix(in srgb, var(--nex-world-text-primary, #2A1F0F) 6%, transparent)",
        }}
      >
        <SkeletonCircle size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <SkeletonBlock width="100%" height={40} radius={999} />
        </div>
        <SkeletonCircle size={32} />
      </div>
    </SkeletonShell>
  );
}
