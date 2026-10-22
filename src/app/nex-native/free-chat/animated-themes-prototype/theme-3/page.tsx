// src/app/nex-native/free-chat/animated-themes-prototype/theme-3/page.tsx
//
// Owner-approved 2026-10-23 (Step C of the three-step plan) ·
// isolated animated prototype of theme-3. Does NOT touch the live
// /nex-native/free-chat picker or canvas. This route is a read-only
// preview surface so the owner can review the proposed animation
// before any rollout.
//
// Policy references:
//   · docs/doctrine/nex-free-chat-showcase-themes-free-forever-2026-10-23.md
//     (§6 · animation polish is NOT blocked, must be subtle, must
//     respect prefers-reduced-motion)
//
// What this prototype does:
//   1. Full-screen wallpaper for theme-3 (/nex-themes/free-chat-
//      theme-3.png), rendered inside the sealed .nex-native-frame
//      so review happens at the real mobile silhouette (420×909 on
//      desktop · device-width on phones).
//   2. Three subtle motion layers:
//        · "Ken Burns" slow pan + zoom on the wallpaper (12s loop,
//           1.00 → 1.04 scale, −0.5% → +0.5% translate X/Y)
//        · "Ambient shimmer" · a very low-opacity accent-tinted
//           radial-gradient overlay that drifts across the surface
//           (18s loop · opacity 0.12 → 0.22 → 0.12)
//        · "Breath" on a floating sample chat bubble (6s loop,
//           opacity 0.95 → 1.00 → 0.95)
//      Each layer is a CSS @keyframes animation · zero JS runtime
//      cost · stops entirely when @media (prefers-reduced-motion:
//      reduce) matches (all three animations set to `none` under
//      that media query).
//   3. A side-by-side toggle at the top so the owner can flip
//      between "animated" and "static" renders of the same tile
//      without reloading. Toggle is pure client state · nothing
//      persists.
//
// What this prototype does NOT do:
//   · Change _types.ts · the live FREE_CHAT_THEMES list stays
//     exactly as sealed.
//   · Change _canvas-client.tsx or the first-visit flow.
//   · Register this surface in the sitemap or any navigation.
//   · Set any cookie or write to any DB.

"use client";

import * as React from "react";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const THEME_3 = {
  id: "theme-3",
  wallpaperUrl: "/nex-themes/free-chat-theme-3.png",
  accentHex: "#16D66B",
} as const;

const C = {
  bgDeep: "#020914",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  textFaint: "#526B89",
};

export default function Theme3AnimatedPrototypePage(): React.JSX.Element {
  const [animated, setAnimated] = React.useState(true);

  return (
    <div
      className="nex-native-frame"
      data-nex-animated-theme-3-prototype
      style={{
        fontFamily: NEX_FONT_SANS,
        color: C.text,
        background: C.bgDeep,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ─── Wallpaper layer ─── */}
      <div
        aria-hidden
        data-nex-animated-theme-3-wallpaper
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${THEME_3.wallpaperUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
          animation: animated
            ? "nex-prototype-ken-burns 12s ease-in-out infinite alternate"
            : "none",
          willChange: animated ? "transform" : undefined,
          transformOrigin: "center center",
        }}
      />

      {/* ─── Ambient shimmer overlay ─── */}
      <div
        aria-hidden
        data-nex-animated-theme-3-shimmer
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 30% 20%, ${THEME_3.accentHex}26, transparent 60%)`,
          mixBlendMode: "screen",
          animation: animated
            ? "nex-prototype-shimmer 18s ease-in-out infinite"
            : "none",
          opacity: animated ? undefined : 0.12,
          pointerEvents: "none",
        }}
      />

      {/* ─── Dark fade from the bottom so the floating sample bubble
             stays legible against bright wallpaper regions ─── */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ─── Header strip with the toggle + status ─── */}
      <header
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 14px 10px",
          background: "rgba(2,9,20,0.55)",
          backdropFilter: "blur(10px) saturate(140%)",
          WebkitBackdropFilter: "blur(10px) saturate(140%)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.8,
            color: THEME_3.accentHex,
            textTransform: "uppercase",
            flex: 1,
          }}
        >
          Prototype · Theme 3 · Animation review
        </div>
        <button
          type="button"
          onClick={() => setAnimated((v) => !v)}
          aria-pressed={animated}
          data-nex-animated-theme-3-toggle
          style={{
            minHeight: 32,
            padding: "0 14px",
            borderRadius: 999,
            background: animated ? THEME_3.accentHex : "transparent",
            color: animated ? "#002813" : C.text,
            border: `1.5px solid ${THEME_3.accentHex}`,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 0.3,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {animated ? "Animated · ON" : "Animated · OFF"}
        </button>
      </header>

      {/* ─── Floating sample chat bubble so the owner sees the
             animation IN context (not just as an empty wallpaper
             preview) ─── */}
      <main
        style={{
          position: "relative",
          zIndex: 2,
          flex: 1,
          padding: "140px 16px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          justifyContent: "flex-end",
          minHeight: 0,
        }}
      >
        <article
          data-nex-animated-theme-3-bubble
          style={{
            maxWidth: "80%",
            alignSelf: "flex-start",
            padding: "10px 14px 12px",
            borderRadius: 18,
            borderBottomLeftRadius: 6,
            background: `rgba(22,214,107,0.14)`,
            border: `1px solid rgba(22,214,107,0.42)`,
            color: C.text,
            backdropFilter: "blur(10px) saturate(140%)",
            WebkitBackdropFilter: "blur(10px) saturate(140%)",
            fontSize: 14,
            lineHeight: 1.4,
            animation: animated
              ? "nex-prototype-bubble-breath 6s ease-in-out infinite"
              : "none",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: THEME_3.accentHex,
              letterSpacing: 0.2,
              marginBottom: 2,
            }}
          >
            Nex
          </div>
          <div style={{ whiteSpace: "pre-wrap" }}>
            Welcome to the Theme&nbsp;3 preview 🌿{"\n\n"}
            This is a prototype · subtle animation runs in the
            background. Toggle the pill above to compare animated vs
            static side-by-side. Nothing on the live free-chat page
            has changed.
          </div>
        </article>
        <div
          style={{
            alignSelf: "center",
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(2,9,20,0.65)",
            border: `1px solid ${THEME_3.accentHex}44`,
            fontSize: 10,
            color: C.textMute,
            letterSpacing: 0.3,
          }}
        >
          Prototype only · live picker untouched · animation respects
          reduced-motion
        </div>
      </main>

      {/* ─── CSS keyframes · scoped inline so this prototype carries
             zero cross-surface risk. @media
             (prefers-reduced-motion: reduce) disables all three
             animations at the system level · the toggle button is
             an in-prototype override for owner review. ─── */}
      <style>{`
        @keyframes nex-prototype-ken-burns {
          0%   { transform: scale(1.00) translate(-0.5%, -0.5%); }
          100% { transform: scale(1.04) translate( 0.5%,  0.5%); }
        }
        @keyframes nex-prototype-shimmer {
          0%   { opacity: 0.12; transform: translate(0%, 0%); }
          50%  { opacity: 0.22; transform: translate(2%, 1%); }
          100% { opacity: 0.12; transform: translate(0%, 0%); }
        }
        @keyframes nex-prototype-bubble-breath {
          0%, 100% { opacity: 0.95; }
          50%      { opacity: 1.00; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-animated-theme-3-wallpaper],
          [data-nex-animated-theme-3-shimmer],
          [data-nex-animated-theme-3-bubble] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
