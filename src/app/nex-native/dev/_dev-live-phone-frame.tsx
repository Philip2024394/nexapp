// src/app/nex-native/dev/_dev-live-phone-frame.tsx
//
// Mobile-first phone frame shared by `/dev/live-seller` and
// `/dev/live-viewer`. On mobile viewports (≤500 px) the frame
// collapses to full-bleed so a real phone sees the viewer exactly
// as it would on prod. On desktop viewports the frame clamps the
// viewer to 390 × ~845 and centres it on a dark backdrop so the
// owner can compare roles side by side at mobile dimensions.

import type * as React from "react";

// Owner directive 2026-10-26 (fix-size) · dev-persona frame matches
// the sealed consumer .nex-native-frame · 360×780, 9/19.5 aspect,
// bg #020914 (same as .nex-native-stage so page + phone read as one
// surface).
const DESKTOP_BREAKPOINT_PX = 500;
const PHONE_WIDTH_PX = 360;
const PHONE_ASPECT = "9 / 19.5";

export function DevLivePhoneFrame({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <style>{`
        /* Owner directive 2026-10-26 · dev route is wrapped in
         * nex-admin-root which opts OUT of the sealed .nex-native-
         * stage/frame styling. We apply the hero background + sealed
         * phone silhouette directly on these two divs so the dev-
         * persona preview is pixel-identical to the regular viewer
         * (/nex-native/videos/[videoId]). */
        [data-nex-dev-live-outer] {
          position: fixed;
          inset: 0;
          background: #020914 url("/nex-desktop-hero.png") center center / cover no-repeat;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        [data-nex-dev-live-frame] {
          position: relative;
          width: 100%;
          height: 100%;
          background: #020914;
          overflow: hidden;
        }
        @media (min-width: ${DESKTOP_BREAKPOINT_PX}px) {
          [data-nex-dev-live-frame] {
            /* Match the sealed .nex-native-frame exactly: 360×780,
             * 32 px radius, 4 px black bezel + outer shadow + inner
             * hairline, same height-cap math. */
            width: min(${PHONE_WIDTH_PX}px, calc((100dvh - 32px) * 9 / 19.5));
            height: min(780px, calc(100dvh - 32px));
            aspect-ratio: ${PHONE_ASPECT};
            border-radius: 32px;
            box-shadow:
              0 0 0 4px #000000,
              0 24px 60px -14px rgba(0, 0, 0, 0.9),
              0 0 0 1px rgba(255, 255, 255, 0.06);
          }
        }
      `}</style>
      <div data-nex-dev-live-outer>
        <div data-nex-dev-live-frame>{children}</div>
      </div>
    </>
  );
}
