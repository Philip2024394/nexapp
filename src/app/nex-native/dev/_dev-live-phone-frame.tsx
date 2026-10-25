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
        [data-nex-dev-live-outer] {
          position: fixed;
          inset: 0;
          background: #020914;
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
            width: ${PHONE_WIDTH_PX}px;
            height: auto;
            aspect-ratio: ${PHONE_ASPECT};
            max-height: calc(100vh - 24px);
            border-radius: 24px;
            box-shadow:
              0 0 0 2px rgba(255, 255, 255, 0.06),
              0 24px 60px -16px rgba(0, 0, 0, 0.8);
          }
        }
      `}</style>
      <div data-nex-dev-live-outer>
        <div data-nex-dev-live-frame>{children}</div>
      </div>
    </>
  );
}
