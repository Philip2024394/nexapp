"use client";

// src/components/nex-native/media-engine/NexPerfOverlay.tsx
//
// NEX Media Engine · dev-only perf overlay · owner-authorised 2026-11-01
// (P0-1 of the shared Media Engine).
// --------------------------------------------------------------------
// A floating panel that displays the last few swipe performance spans
// in dev mode. Subscribes to the shared `perf-marks.ts` ring buffer ·
// renders span tables for Worldwide / Ireland / Indonesia / future
// feeds using ONE component.
//
// Visibility:
//   · dev-mode ONLY · the component unmounts itself in production
//     (`process.env.NODE_ENV === "production"` → returns null)
//   · toggle visibility via `Alt+P` key chord
//   · initial state: HIDDEN by default (owner-authorised 2026-11-02 ·
//     overlay was obscuring music + video feed chrome during normal
//     dev viewing · opt-in via Alt+P when timing data is actively
//     needed). Shown state persists for the session once revealed.
//
// Privacy:
//   · does NOT log URLs, track IDs, account IDs
//   · displays only phase names + timestamps + feed-kind + country-code
//   · correlation IDs are the random v4 UUIDs from perf-marks.ts
//
// Owner directive 2026-11-01 §4: "Provide a development-only
// performance display" · this component is that display.

import * as React from "react";
import {
  subscribePerfMarks,
  getPerfMarksSnapshot,
  measurePerfSpan,
  type PerfPhase,
} from "@/lib/nex-native/media-engine/perf-marks";

const DEV_ONLY = process.env.NODE_ENV !== "production";

// ─── Span definitions · what to compute per swipe ───────────────────

interface SpanDef {
  readonly label: string;
  readonly from: PerfPhase;
  readonly to: PerfPhase;
}

const MUSIC_SPANS: readonly SpanDef[] = [
  { label: "swipe→nav", from: "swipe-start", to: "nav-begin" },
  { label: "nav→visible", from: "nav-begin", to: "slide-visible" },
  { label: "swipe→visible", from: "swipe-start", to: "slide-visible" },
  { label: "slide→cover", from: "slide-visible", to: "cover-loaded" },
  { label: "cover→decoded", from: "cover-loaded", to: "cover-decoded" },
  { label: "slide→audio-ready", from: "slide-visible", to: "audio-canplay" },
  { label: "play→audible", from: "audio-play-requested", to: "audio-first-audible" },
];

const VIDEO_SPANS: readonly SpanDef[] = [
  { label: "swipe→nav", from: "swipe-start", to: "nav-begin" },
  { label: "nav→visible", from: "nav-begin", to: "slide-visible" },
  { label: "swipe→visible", from: "swipe-start", to: "slide-visible" },
  { label: "slide→poster", from: "slide-visible", to: "poster-loaded" },
  { label: "slide→loadeddata", from: "slide-visible", to: "video-loadeddata" },
  { label: "slide→first-frame", from: "slide-visible", to: "video-first-frame" },
];

// ─── Panel ─────────────────────────────────────────────────────────

export function NexPerfOverlay(): React.JSX.Element | null {
  // Hard gate for production. The component tree ships to prod but
  // this short-circuit means zero cost at render time.
  if (!DEV_ONLY) return null;

  // Owner-authorised 2026-11-02 · hidden by default. Opt-in via Alt+P.
  // The sessionStorage flag now records the SHOWN state (not hidden),
  // so once a dev presses Alt+P the overlay stays visible for the
  // session until they press Alt+P again. Older `nex-perf-overlay-hidden`
  // flags are ignored.
  const [visible, setVisible] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("nex-perf-overlay-shown") === "true";
  });

  const [, forceRender] = React.useReducer((x: number) => x + 1, 0);

  // Subscribe to new marks · re-render the panel.
  React.useEffect(() => {
    const unsub = subscribePerfMarks(() => forceRender());
    return unsub;
  }, []);

  // Keyboard toggle: Alt+P.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "p" || e.key === "P")) {
        setVisible((v) => {
          const next = !v;
          if (typeof window !== "undefined") {
            if (next) {
              window.sessionStorage.setItem("nex-perf-overlay-shown", "true");
            } else {
              window.sessionStorage.removeItem("nex-perf-overlay-shown");
            }
          }
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!visible) return null;

  // Build the recent-swipes list from the ring buffer.
  const marks = getPerfMarksSnapshot();
  const swipes = buildSwipes(marks);
  const recent = swipes.slice(-8).reverse();

  return (
    <div
      data-nex-perf-overlay
      role="status"
      aria-label="NEX Media Engine performance overlay"
      style={{
        position: "fixed",
        right: 8,
        bottom: 8,
        zIndex: 999999,
        maxWidth: 480,
        maxHeight: "70vh",
        overflow: "auto",
        padding: 10,
        background: "rgba(0, 0, 0, 0.82)",
        color: "#F2F5F8",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: 11,
        lineHeight: 1.35,
        borderRadius: 10,
        border: "1px solid rgba(0, 175, 255, 0.3)",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
          fontSize: 10,
          color: "#8BA9D1",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        <span>NEX Media Engine · perf · dev-only · Alt+P hides</span>
        <span>{recent.length} swipe{recent.length === 1 ? "" : "s"}</span>
      </div>
      {recent.length === 0 ? (
        <div style={{ opacity: 0.6 }}>
          Waiting for swipes. Pointer-down on a feed slide to populate.
        </div>
      ) : (
        recent.map((swipe) => (
          <SwipeBlock key={swipe.correlationId} swipe={swipe} />
        ))
      )}
    </div>
  );
}

// ─── Swipe assembly ────────────────────────────────────────────────

interface SwipeRecord {
  readonly correlationId: string;
  readonly feedKind: "music" | "video";
  readonly feedMode: "worldwide" | "country";
  readonly countryCode?: string;
}

function buildSwipes(
  marks: readonly ReturnType<typeof getPerfMarksSnapshot>[number][],
): readonly SwipeRecord[] {
  const seen = new Map<string, SwipeRecord>();
  for (const m of marks) {
    if (seen.has(m.context.swipeCorrelationId)) continue;
    seen.set(m.context.swipeCorrelationId, {
      correlationId: m.context.swipeCorrelationId,
      feedKind: m.context.feedKind,
      feedMode: m.context.feedMode,
      countryCode: m.context.countryCode,
    });
  }
  return Array.from(seen.values());
}

function SwipeBlock({ swipe }: { readonly swipe: SwipeRecord }): React.JSX.Element {
  const spans = swipe.feedKind === "music" ? MUSIC_SPANS : VIDEO_SPANS;
  const label =
    swipe.feedKind +
    " · " +
    (swipe.feedMode === "country" ? (swipe.countryCode ?? "country") : "worldwide");
  return (
    <div
      style={{
        marginTop: 6,
        paddingTop: 6,
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 2,
          color: "#C6A15B",
          fontWeight: 700,
        }}
      >
        <span>{label}</span>
        <span style={{ color: "#8BA9D1", fontWeight: 400 }}>
          {swipe.correlationId.slice(0, 8)}
        </span>
      </div>
      {spans.map((span) => {
        const ms = measurePerfSpan(span.from, span.to, swipe.correlationId);
        return (
          <div
            key={span.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingLeft: 8,
              color: ms === null ? "rgba(242, 245, 248, 0.42)" : "#F2F5F8",
            }}
          >
            <span>{span.label}</span>
            <span>{ms === null ? "—" : ms.toFixed(0) + " ms"}</span>
          </div>
        );
      })}
    </div>
  );
}
