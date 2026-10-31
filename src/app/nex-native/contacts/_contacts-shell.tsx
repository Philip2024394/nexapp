// src/app/nex-native/contacts/_contacts-shell.tsx
//
// Full-bleed background shell for the Contacts hub. Owner-supplied
// "Neon Earth on a Starry Horizon" PNG lives at
// `public/nex-native/contacts/neon-earth-bg.png`. The image loads
// via a decorative <img> absolute-positioned behind the content so
// the page scroll doesn't drag the background with it (fixed background
// attachment is unreliable on mobile Safari).
//
// Solid navy fallback (#020914) renders before + under the image
// so the page never flashes white during load.
//
// Server Component · no hooks · pure layout wrapper.

import type * as React from "react";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  textPrimary: "#F2F5F8",
};

interface ContactsShellProps {
  readonly children: React.ReactNode;
}

export function ContactsShell({ children }: ContactsShellProps) {
  return (
    <main
      data-nex-contacts-root
      style={{
        position: "relative",
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.textPrimary,
        overflow: "hidden",
      }}
    >
      {/* Owner directive 2026-10-23 · "remove the background image" ·
          the earth-horizon PNG is retired · the page sits on solid
          NEX navy. Decorative image removed from the DOM to save
          download bytes on first paint. */}
      {/* Content column · relative so it stacks above the background.
          Owner directive 2026-10-17 (revised · later same day) ·
          "nex contacts … move down from header little" · top padding
          bumped from +10px → +28px above the safe-area inset so the
          NEX CONTACTS title sits a little lower from the viewport
          top rather than being pressed against the status-bar edge.
          Cards-stay-tight directive preserved via gap: 10. */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 480,
          margin: "0 auto",
          padding: "calc(env(safe-area-inset-top, 0) + 28px) 14px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {children}
      </div>
    </main>
  );
}
