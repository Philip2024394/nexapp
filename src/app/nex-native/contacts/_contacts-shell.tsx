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
  bg: "#020914",
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
      {/* Full-bleed background · owner-supplied earth asset.
          Positioned absolutely so page content scrolls over it.
          aria-hidden · decorative only.
          2026-10-17 · the full-bleed `objectFit: cover` placement
          made the Earth planet appear as a "floating orb" below the
          header text. Owner directive · reduce its visual weight.
          Fix: pin the image to the top strip (height 180px) so the
          planet sits in the very top-right corner above/beside the
          header and the rest of the page is clean navy. */}
      <img
        src="/nex-native/contacts/neon-earth-bg.png"
        alt=""
        aria-hidden
        data-nex-contacts-bg-image
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          // Owner directive 2026-10-17 · "background image should be
          // full height page and width · revert to last size showing
          // more hero area". Full-bleed · covers the whole viewport.
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "top center",
          zIndex: 0,
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
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
