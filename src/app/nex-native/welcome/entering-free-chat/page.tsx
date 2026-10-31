// src/app/nex-native/welcome/entering-free-chat/page.tsx
//
// NEX · Free Chat splash · intermediary route.
// Owner-authorised 2026-10-21 (iteration 21).
// -----------------------------------------------------------------------------
// Reached from the "Free NEX Chat" welcome card. Renders a full-bleed
// NEX "Neon Global Connections" splash image for 2 seconds, then the
// client component forwards to /nex-native/themes/nex-bubbles (the
// sealed standard chat preview surface).
//
// Scope:
//   · Guest-safe · no session required.
//   · No DB connection · no cookies written here.
//   · No sealed-primitive change · the destination surface
//     (/themes/nex-bubbles) is untouched.
//   · Images are already copied to /public/nex-native/.

import type * as React from "react";
import { FreeChatSplashClient } from "./_splash-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  text: "#F2F5F8",
};

export default function EnteringFreeChatSplashPage(): React.ReactElement {
  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        data-nex-entering-free-chat-splash
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          // 100dvh guarantees mobile viewport fill (the frame IS the
          // viewport on mobile). On desktop the parent `.nex-native-
          // frame` has an explicit 909px height clamp, so height: 100%
          // matches the frame exactly.
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          overflow: "hidden",
          // Guard against focus-rings / tap outlines during the 2s
          // hold. The splash is non-interactive by design.
          WebkitTapHighlightColor: "transparent",
        }}
        aria-label="Opening NEX Chat"
      >
        {/* Owner directive 2026-10-21 (iteration 26 corrected) · splash
            must fill the APP SCREEN · which means inside the phone
            frame on desktop and the full viewport on mobile.
            `position: absolute` anchors the image to the main (whose
            own size matches the frame on desktop + viewport on mobile).
            `100%` × `100%` + object-fit:cover keeps the artwork
            correctly cropped at both sizes. */}
        <img
          src="/nex-native/entering-free-chat-splash.png"
          alt=""
          aria-hidden
          data-nex-entering-free-chat-splash-image
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center center",
            zIndex: 0,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        {/* Client timer · 2s then router.push to the chat preview. */}
        <FreeChatSplashClient />
      </main>
    </>
  );
}
