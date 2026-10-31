"use client";

// src/app/nex-native/live-commerce/jail-preview/_preview-client.tsx
//
// Owner directive 2026-10-28 · preview the viewer-side jail overlay
// in isolation. Taps re-mount the overlay so iteration is one tap
// away. In production the overlay fires inside the sealed
// `/live-commerce/[sessionId]` viewer page when a jail Realtime
// event lands.

import * as React from "react";
import { JailOverlay } from "@/components/nex-native/live-commerce/JailOverlay";

const DURATION_MS = 10 * 60 * 1000; // Sealed · 10 minutes
const DISMISS_AFTER_MS = 8_000; // Owner-sealed 2026-10-28

export function JailPreviewClient(): React.JSX.Element {
  const [cycle, setCycle] = React.useState(0);
  const [overlayVisible, setOverlayVisible] = React.useState(true);

  /* Owner troubleshoot 2026-10-29 · "A tree hydrated but some
     attributes of the server rendered HTML didn't match the client
     properties" · root cause was `startedAtMs = useMemo(() =>
     Date.now())` running on BOTH server + client with ~1-s drift,
     plus the overlay's internal `nowMs` ticking against that drifted
     timestamp. The sealed overlay signature expects a server-issued
     epoch, so we honour it: on SSR + first client render we render
     nothing (startedAtMs stays null), then a client-only effect sets
     it after hydration · the overlay mounts cleanly with matching
     SSR + client state. */
  const [startedAtMs, setStartedAtMs] = React.useState<number | null>(null);
  React.useEffect(() => {
    setStartedAtMs(Date.now());
    setOverlayVisible(true);
  }, [cycle]);

  return (
    <main
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        background: "var(--nex-world-background-base, #020914)",
        color: "#F2F5F8",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Behind-overlay mock surface · shows what the viewer would
          see once the overlay dismisses (phase 2 · muted composer
          state will replace this in the next edit). */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          color: "rgba(255, 255, 255, 0.7)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.18em",
            color: "#00AFFF",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Preview
        </div>
        <h1
          style={{
            margin: "0 0 10px",
            fontSize: 22,
            fontWeight: 900,
            color: "#F2F5F8",
          }}
        >
          Jail Overlay
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 13,
            lineHeight: 1.55,
            color: "#8BA9D1",
            maxWidth: 320,
          }}
        >
          Full-bleed takeover with lock + headline + 10-minute
          countdown + 8-second dismiss bar. Tap the overlay (or wait
          8 s) to return to this preview surface. Tap “Replay” to
          see it again.
        </p>
        <button
          type="button"
          onClick={() => {
            setCycle((c) => c + 1);
            setOverlayVisible(true);
          }}
          style={{
            minHeight: 44,
            padding: "0 20px",
            borderRadius: 12,
            background: "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)",
            border: "none",
            color: "#FFFFFF",
            fontSize: 13.5,
            fontWeight: 800,
            letterSpacing: "0.03em",
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 2px 6px -2px rgba(16, 32, 51, 0.4)",
          }}
        >
          Replay overlay
        </button>
      </div>

      {overlayVisible && startedAtMs !== null && (
        <JailOverlay
          key={cycle}
          startedAtMs={startedAtMs}
          durationMs={DURATION_MS}
          dismissAfterMs={DISMISS_AFTER_MS}
          onDismiss={() => setOverlayVisible(false)}
          /* Owner directive 2026-10-29 · owner-supplied MP4 copied
             to public/ at `/nex-jail-background.mp4`. Plays as a
             full-bleed looping background behind the lock + text +
             countdown + progress bar. */
          videoSrc="/nex-jail-background.mp4"
        />
      )}
    </main>
  );
}
