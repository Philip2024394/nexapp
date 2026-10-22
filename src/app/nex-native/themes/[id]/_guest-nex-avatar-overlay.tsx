// src/app/nex-native/themes/[id]/_guest-nex-avatar-overlay.tsx
//
// NEX · Theme Preview · guest avatar overlay.
// Owner-authorised 2026-10-21 (iteration 23).
// -----------------------------------------------------------------------------
// For GUEST viewers of the theme preview, overlay a NexPingBadge (NEX
// branded 56px blue-rim ping) at the top-left of the preview area so
// the free-chat header reads as "NEX" until the user creates an
// account. Signed-in users never mount this overlay · their normal
// peer-avatar chat header is unchanged.
//
// Positioning rationale:
//   · Matches the sealed ChatIdentityHeader avatar footprint (56px
//     at ~18px from the left edge + ~32px safe-area-top offset) so
//     the overlay sits on top of the primary avatar area.
//   · `position: absolute` anchors to the nearest positioned ancestor
//     · in the theme-preview chain that's the PortraitBloomShell /
//     theme root (both are relative). On desktop this keeps the
//     overlay INSIDE the global phone frame (per nex-native.css:183).
//   · zIndex 60 sits ABOVE the chat chrome avatar but BELOW the
//     GuestSignupBanner (zIndex 90) so the sticky "Create free NEX"
//     stays the primary surface.
//
// This is a scoped guest-only overlay · it does NOT fork or
// reimplement the sealed Chat Master Layout primitives.

import type * as React from "react";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";

export function GuestNexAvatarOverlay(): React.ReactElement {
  return (
    <div
      data-nex-theme-guest-avatar-overlay
      aria-hidden
      style={{
        position: "absolute",
        top: "calc(env(safe-area-inset-top, 0px) + 32px)",
        left: 18,
        zIndex: 60,
        pointerEvents: "none",
      }}
    >
      <NexPingBadge
        size={56}
        accent="#00AFFF"
        dataTestId="theme-preview-guest-nex"
      />
    </div>
  );
}
