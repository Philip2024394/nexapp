"use client";

// src/app/nex-native/live-commerce/live-finished-preview/_preview-client.tsx
//
// Preview-only client wrapper for the sealed LiveFinishedRecap
// component. Mounts the recap with mock stats so the owner can
// inspect the visual without running a real broadcast. On dismiss
// (auto-fire after 8 s OR tap) the recap re-mounts so iteration is
// one tap away · the production surface navigates away instead
// (/nex-native/live-commerce/feed · see enter-broadcast-room/
// _go-live-client.tsx).

import * as React from "react";
import { LiveFinishedRecap } from "../enter-broadcast-room/_live-finished-recap";

// Owner-tweakable mock stats. Change these inline to see different
// durations / peak counts render.
const MOCK_START_AT_MS_AGO = 32 * 60_000 + 14_000; // 32 min 14 sec
const MOCK_PEAK_VIEWERS = 7;
const MOCK_DISPLAY_NAME = "Your Shop";

export function LiveFinishedPreviewClient(): React.JSX.Element {
  const [cycle, setCycle] = React.useState(0);

  // Compute start/end once per re-mount so the duration label is
  // stable across the recap's own 100-ms countdown tick (otherwise
  // the duration string would drift up every tick).
  const timers = React.useMemo(() => {
    const endedAt = Date.now();
    const startedAt = endedAt - MOCK_START_AT_MS_AGO;
    return { startedAt, endedAt };
  }, [cycle]);

  return (
    <main
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        background: "#020914",
      }}
    >
      <LiveFinishedRecap
        startedAt={timers.startedAt}
        endedAt={timers.endedAt}
        peakViewers={MOCK_PEAK_VIEWERS}
        selfAvatarUrl={null}
        selfDisplayName={MOCK_DISPLAY_NAME}
        onDismiss={() => setCycle((c) => c + 1)}
      />
    </main>
  );
}
