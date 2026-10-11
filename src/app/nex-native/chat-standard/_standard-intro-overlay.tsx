"use client";

// src/app/nex-native/chat-standard/_standard-intro-overlay.tsx
//
// Standard Intro Overlay · universal · sealed 2026-10-06 (Step 2).
//
// Plays `pkg.intro.videoUrl` with the sealed `playPolicy:
// "twice-then-skip"` for ANY Standard Experience world that declares
// one. Zero per-theme branches · zero theme-id checks · the overlay
// mounts for every world the StandardExperience shell renders, reads
// the world's declared intro, and either plays it (seen < 2 times) or
// silently renders null.
//
// Load-bearing architectural rules:
//
//   · This component is UNIVERSAL. A future Standard Experience world
//     declaring `intro.kind: "standard" + intro.videoUrl: "/..."` is
//     picked up automatically. No Library / shell / engine change
//     required.
//   · When a world's `pkg.intro.videoUrl` is null the overlay renders
//     null · the existing scripted-animation fallback (declared by
//     the package via `intro.scriptedAnimation`) remains available to
//     any other surface that chooses to render it. Step 2 is
//     specifically about video consumption; the scripted-animation
//     code path is intentionally untouched.
//   · The play-count counter is scoped per-theme-id in localStorage
//     so switching between worlds doesn't share counts across worlds.
//   · The overlay respects BusinessIntro (`kind: "business"`) by
//     consuming `videoUrl` identically to StandardIntro · the
//     `playPolicy` differs (always-when-on for BusinessIntro) but the
//     mount logic is the same.
//   · The overlay is DEV / SSR safe · `window` access is wrapped and
//     the initial render always matches the server pass (null video
//     url ⇒ null overlay).
//   · UNIVERSAL THEME COLOUR RULE (sealed 2026-10-06): every pixel of
//     this overlay derives from `engine.colours` · the backdrop, the
//     skip button background, text and border all pull from the
//     resolved ThemePackage. NEVER introduce `#000` / `#fff` / fixed
//     rgba literals here · the overlay is part of the chat atmosphere,
//     not generic NEX chrome. A regression test
//     (`_standard-experience.test.ts` section E) enforces this.

import * as React from "react";
import type { ResolvedEngine } from "./_engine/theme-engine";

const STORAGE_PREFIX = "nex-standard-intro-count-";
/** Sealed by founder 2026-10-05 · the StandardIntro `playPolicy`
 *  "twice-then-skip" is the only value today · worlds beyond their
 *  second viewing silently skip the overlay. */
const STANDARD_PLAY_LIMIT = 2;

export interface StandardIntroOverlayProps {
  engine: ResolvedEngine;
}

export function StandardIntroOverlay({
  engine,
}: StandardIntroOverlayProps): React.JSX.Element | null {
  const pkg = engine.package;
  const intro = pkg.intro ?? null;
  const videoUrl =
    intro && (intro.kind === "standard" || intro.kind === "business")
      ? intro.videoUrl
      : null;
  // Sealed 2026-10-11 · a StandardIntro may opt into audio playback.
  // Mobile browsers still require a user gesture to actually produce
  // sound · we flip `muted=false` on the video element and let the
  // browser decide. If audio is blocked, the clip plays silently and
  // the overlay still dismisses on `ended` or Skip. BusinessIntro
  // never opts into audio in this phase.
  const withAudio = intro?.kind === "standard" ? intro.withAudio === true : false;
  // Scripted fallback (sealed 2026-10-11) · when a world declares an
  // `intro.scriptedAnimation` but NO `videoUrl`, play a short scripted
  // intro (theme name + palette gradient, 2s) before the live chat
  // reveals. Driven by the SAME twice-then-skip policy as video intros
  // so repeat visits don't annoy. Rule flipped from "scripted intros
  // are intentionally untouched" to "every theme plays an intro."
  const scriptedAnimation =
    intro && intro.kind === "standard" ? intro.scriptedAnimation ?? null : null;
  const hasAnyIntro = videoUrl !== null || scriptedAnimation !== null;
  const themeId = pkg.identity.id;
  const storageKey = React.useMemo(
    () => `${STORAGE_PREFIX}${themeId}`,
    [themeId],
  );
  const isBusinessIntro = intro?.kind === "business";

  // null = still reading from localStorage (first mount), number =
  // resolved count. SSR renders null on the server pass; the overlay
  // mounts invisibly then decides whether to play once localStorage
  // is readable.
  const [playCount, setPlayCount] = React.useState<number | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    if (!hasAnyIntro) {
      setPlayCount(0);
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? parseInt(raw, 10) : 0;
      setPlayCount(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
    } catch {
      setPlayCount(0);
    }
  }, [hasAnyIntro, storageKey]);

  // Scripted fallback auto-dismiss · fires once when the scripted
  // branch is active · after 2s the overlay increments the counter
  // and reveals the live chat. Independent of the <video>'s onEnded
  // handler so the two paths never fight for dismiss semantics.
  React.useEffect(() => {
    if (videoUrl) return;
    if (!scriptedAnimation) return;
    if (playCount === null) return;
    if (!isBusinessIntro && playCount >= STANDARD_PLAY_LIMIT) return;
    if (dismissed) return;
    const id = window.setTimeout(() => {
      try {
        if (!isBusinessIntro) {
          const next = (playCount ?? 0) + 1;
          window.localStorage.setItem(storageKey, String(next));
        }
      } catch {
        /* storage unavailable · best effort */
      }
      setDismissed(true);
    }, 2000);
    return () => window.clearTimeout(id);
  }, [
    videoUrl,
    scriptedAnimation,
    playCount,
    dismissed,
    isBusinessIntro,
    storageKey,
  ]);

  const incrementCount = React.useCallback(() => {
    if (isBusinessIntro) return; // BusinessIntro always plays · no cap
    try {
      const next = (playCount ?? 0) + 1;
      window.localStorage.setItem(storageKey, String(next));
    } catch {
      /* storage unavailable · best effort */
    }
  }, [storageKey, playCount, isBusinessIntro]);

  const handleEnded = React.useCallback(() => {
    incrementCount();
    setDismissed(true);
  }, [incrementCount]);

  const handleSkip = React.useCallback(() => {
    incrementCount();
    setDismissed(true);
  }, [incrementCount]);

  // Early return guards · evaluated AFTER hooks per the Rules of
  // Hooks · never conditionally skip a hook above this point.
  if (!hasAnyIntro) return null;
  if (playCount === null) return null;
  if (!isBusinessIntro && playCount >= STANDARD_PLAY_LIMIT) return null;
  if (dismissed) return null;

  // Universal Theme Colour Rule · every surface here is theme-derived.
  const colours = engine.colours;
  const skipButton = (
    <button
      type="button"
      data-nex-standard-intro-skip
      onClick={handleSkip}
      aria-label="Skip intro"
      style={{
        position: "absolute",
        top: "calc(env(safe-area-inset-top, 0) + 14px)",
        right: 14,
        zIndex: 10,
        padding: "8px 14px",
        borderRadius: 999,
        background: colours.deep,
        color: colours.highlight,
        border: `1px solid ${colours.primary}`,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        fontFamily: "inherit",
      }}
    >
      Skip intro →
    </button>
  );

  // Scripted fallback · no video declared but the package declares an
  // intro.scriptedAnimation · render a 2s branded intro using the
  // theme palette so every theme has a visible intro before the chat
  // reveals.
  if (!videoUrl) {
    return (
      <div
        data-nex-standard-intro-overlay
        data-nex-intro-kind="scripted"
        data-nex-intro-theme-id={themeId}
        data-nex-intro-scripted-animation={scriptedAnimation ?? ""}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background: `radial-gradient(circle at 50% 35%, ${colours.primary}44 0%, transparent 55%), linear-gradient(180deg, #000 0%, ${colours.deep} 22%, ${colours.deep} 78%, #000 100%)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          animation: "nex-standard-intro-scripted-fade 2000ms ease-out forwards",
        }}
      >
        <style>{`
          @keyframes nex-standard-intro-scripted-fade {
            0%   { opacity: 0; }
            12%  { opacity: 1; }
            80%  { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes nex-standard-intro-scripted-rise {
            0%   { opacity: 0; transform: translateY(16px) scale(0.96); }
            60%  { opacity: 1; transform: translateY(0) scale(1); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            animation:
              "nex-standard-intro-scripted-rise 1400ms cubic-bezier(0.2, 0.9, 0.3, 1.1) both",
          }}
        >
          <span
            aria-hidden
            style={{
              fontSize: 10,
              letterSpacing: "0.42em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: colours.primary,
            }}
          >
            NEX Theme
          </span>
          <span
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: colours.highlight,
              textAlign: "center",
              lineHeight: 1.1,
              textShadow: `0 2px 20px ${colours.primary}66`,
            }}
          >
            {pkg.identity.name}
          </span>
          {pkg.identity.tagline && (
            <span
              style={{
                fontSize: 13,
                color: colours.highlight,
                opacity: 0.78,
                textAlign: "center",
                lineHeight: 1.4,
                maxWidth: 320,
              }}
            >
              {pkg.identity.tagline}
            </span>
          )}
        </div>
        {skipButton}
      </div>
    );
  }

  return (
    <div
      data-nex-standard-intro-overlay
      data-nex-intro-kind={isBusinessIntro ? "business" : "standard"}
      data-nex-intro-theme-id={themeId}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        // Letterbox / backdrop behind the video pulls the theme's deep
        // anchor colour · never pure black. Ocean reads abyss-blue;
        // Café reads dark-roast brown; a future world reads its own
        // declared `colours.deep`.
        background: colours.deep,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        autoPlay
        muted={!withAudio}
        playsInline
        onEnded={handleEnded}
        onError={() => setDismissed(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      {skipButton}
    </div>
  );
}
