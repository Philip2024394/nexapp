"use client";

// src/lib/nex-native/nex-planet-approach-client.tsx
//
// NEX · Planet Approach ambient animation + vertical control panel.
// -----------------------------------------------------------------------------
// 2026-10-15 · owner-authorised cinematic effect for the two free NEX
// chat themes (NEX Original · NEX Blue Centre).
//
// What it does
// ------------
// 1. Renders a floating 3-dot (⋮) trigger button pinned to the lower-
//    right of the chat viewport.
// 2. Tapping ⋮ reveals a VERTICAL control panel that slides up from
//    the trigger · same pattern as the Joker motion panel in
//    `_universal-chat-controls.tsx` (confirmed by owner directive
//    "same animation vertical as joker theme").
// 3. The panel currently contains ONE control: a planet-approach
//    animation toggle. Tapping it starts the approach-and-fly-by
//    sequence · the planet begins as a distant speck at the centre
//    of the viewport, grows larger as it approaches the "camera",
//    then rushes past the viewer and exits off-screen.
// 4. The animation plays once per tap. Users can replay it by
//    tapping the toggle again.
//
// Design intent
// -------------
// · Pure CSS keyframe scale + translate · GPU-accelerated transform.
// · Respects `prefers-reduced-motion` (replaces the flight with a
//   fade so the planet is still "shown" but not kinetic).
// · The planet image is OWNER-SUPPLIED at /public/nex-native/
//   planets/planet-approach-1.png · the component only references it
//   via `src=` so a drop-in replacement is a one-file change.

import * as React from "react";

const PLANET_IMG = "/nex-native/planets/planet-approach-1.png";
const APPROACH_SEC = 6;

export interface NexPlanetApproachClientProps {
  /** Deep base colour · drives the 3-dot button background. Defaults
   *  to NEX deep navy. */
  readonly deep?: string;
  /** Theme accent colour · drives the "on" state of the toggle.
   *  Defaults to NEX brand cyan. */
  readonly accent?: string;
  /** Highlight colour · drives the glyph colour on the dark button.
   *  Defaults to NEX off-white. */
  readonly highlight?: string;
}

export function NexPlanetApproachClient({
  deep = "var(--nex-world-background-base, #020914)",
  accent = "#00AFFF",
  highlight = "#F4F7FC",
}: NexPlanetApproachClientProps): React.ReactElement {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [playbackCount, setPlaybackCount] = React.useState(0);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  // Watch prefers-reduced-motion so the approach animation respects
  // the user's OS preference.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Trigger one playback · increment counter so the keyframed element
  // remounts with a fresh animation each time.
  const triggerApproach = React.useCallback(() => {
    setPlaybackCount((prev) => prev + 1);
  }, []);

  const CHROME_RIGHT = 14;
  const CHROME_BOTTOM = 14;
  const PANEL_BOTTOM = CHROME_BOTTOM + 40 + 8;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes nex-planet-approach {
              0%   { transform: translate(-50%, -50%) translate3d(0, 0, 0) scale(0.04); opacity: 0; }
              8%   { opacity: 0.8; }
              35%  { transform: translate(-50%, -50%) translate3d(-6vw, 4vh, 0) scale(0.22); opacity: 1; }
              65%  { transform: translate(-50%, -50%) translate3d(-22vw, 14vh, 0) scale(0.65); opacity: 1; }
              82%  { transform: translate(-50%, -50%) translate3d(-55vw, 28vh, 0) scale(1.2); opacity: 1; }
              100% { transform: translate(-50%, -50%) translate3d(-120vw, 60vh, 0) scale(2.4); opacity: 0; }
            }
            @keyframes nex-planet-approach-reduced {
              0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
              40%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
              90%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
              100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
            }
            @keyframes nex-planet-spin-approach {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
          `,
        }}
      />

      {/* Animation runtime · remounts on each playback trigger via
          the `key` so the keyframe restarts cleanly. */}
      {playbackCount > 0 && (
        <ApproachingPlanet
          key={playbackCount}
          reducedMotion={reducedMotion}
        />
      )}

      {/* Vertical control panel · same vertical-column pattern as the
          Joker motion panel (`_universal-chat-controls.tsx` lines
          179-204). Slides up from the 3-dots trigger. */}
      <div
        aria-hidden={!menuOpen}
        data-nex-planet-panel={menuOpen ? "open" : "closed"}
        style={{
          position: "fixed",
          right: CHROME_RIGHT,
          bottom: `calc(env(safe-area-inset-bottom, 0) + ${PANEL_BOTTOM}px)`,
          zIndex: 60,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "center",
          opacity: menuOpen ? 1 : 0,
          transform: menuOpen ? "translateY(0)" : "translateY(16px)",
          pointerEvents: menuOpen ? "auto" : "none",
          transition:
            "opacity 220ms ease-out, transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
        }}
      >
        <button
          type="button"
          aria-label="Trigger planet approach animation"
          data-nex-planet-approach-trigger
          onClick={() => {
            triggerApproach();
            // Keep panel open so the user can replay without
            // re-opening.
          }}
          style={{
            position: "relative",
            width: 44,
            height: 44,
            borderRadius: 999,
            background: `linear-gradient(180deg, ${accent}, ${accent}cc)`,
            border: `1px solid ${accent}`,
            color: deep,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            fontFamily: "inherit",
            padding: 0,
            fontSize: 20,
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            boxShadow: `0 6px 18px -6px ${accent}99`,
            transition: "transform 160ms ease",
          }}
        >
          {/* Planet thumbnail inside the button */}
          <img
            src={PLANET_IMG}
            alt=""
            aria-hidden
            style={{
              display: "block",
              width: 28,
              height: 28,
              objectFit: "contain",
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
            }}
          />
        </button>
      </div>

      {/* 3-dots trigger · pinned bottom-right of the viewport. */}
      <button
        type="button"
        aria-label={menuOpen ? "Close animation menu" : "Open animation menu"}
        aria-expanded={menuOpen}
        data-nex-planet-three-dots
        onClick={() => setMenuOpen((v) => !v)}
        style={{
          position: "fixed",
          right: CHROME_RIGHT,
          bottom: `calc(env(safe-area-inset-bottom, 0) + ${CHROME_BOTTOM}px)`,
          zIndex: 60,
          width: 40,
          height: 40,
          borderRadius: 999,
          background: `linear-gradient(180deg, ${deep}dd, ${deep}aa)`,
          border: `1px solid ${highlight}30`,
          color: highlight,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          fontFamily: "inherit",
          padding: 0,
          fontSize: 18,
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          boxShadow: "0 6px 14px -6px rgba(0,0,0,0.7)",
          transition: "transform 160ms ease, background 160ms ease",
          lineHeight: 1,
          letterSpacing: 2,
          fontWeight: 900,
        }}
      >
        ⋮
      </button>
    </>
  );
}

function ApproachingPlanet({
  reducedMotion,
}: {
  reducedMotion: boolean;
}): React.ReactElement {
  // The planet starts at the geometric centre of the viewport (far-away
  // point) and animates toward the lower-left corner while scaling up.
  // The outer wrapper sits at 50% / 50% and uses translate(-50%, -50%)
  // to anchor by centre so the scaling expands around the planet's own
  // centre rather than its top-left corner.
  const animation = reducedMotion
    ? `nex-planet-approach-reduced ${APPROACH_SEC}s ease-in-out forwards`
    : `nex-planet-approach ${APPROACH_SEC}s cubic-bezier(0.4, 0, 0.3, 1) forwards`;
  return (
    <div
      aria-hidden
      data-nex-planet-approach-stage
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 25,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <img
        src={PLANET_IMG}
        alt=""
        aria-hidden
        data-nex-planet-approach-sprite
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 240,
          height: 240,
          transformOrigin: "50% 50%",
          willChange: "transform, opacity",
          animation,
          filter: "drop-shadow(0 0 32px rgba(255, 110, 60, 0.45))",
        }}
      />
      {/* Secondary spin layer · subtle slow spin while the planet
          travels so it doesn't look like a flat sticker. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            [data-nex-planet-approach-sprite] {
              animation-fill-mode: forwards;
            }
          `,
        }}
      />
    </div>
  );
}
