"use client";

// src/app/nex-native/free-chat/_canvas-client.tsx
//
// NEX · Free Chat · chat canvas + first-visit theme row.
// Owner-authorised 2026-10-21 (iteration 53).
// -----------------------------------------------------------------------------
// Extracted from page.tsx so the chat canvas can own:
//   · the currently-applied wallpaper (via a theme tile tap)
//   · the first-visit theme row (shown until the user engages)
//
// Server page.tsx reads the two cookies on each request and passes
// their resolved values as props so there is NO flash-of-row on
// returning visitors:
//   nex-free-chat-wallpaper=<theme-id>  · persists the pick
//   nex-free-chat-row-dismissed=1       · hides the row on return
//
// Cookies are written client-side via document.cookie when the user
// engages a tile · they are intentionally NOT HttpOnly because this
// surface has no server-side mutation (preview only). Guests + signed-
// in users use the same cookie path.

import * as React from "react";
import Link from "next/link";
import {
  FREE_CHAT_THEMES,
  freeChatBackgroundCss,
  hexWithAlpha,
  resolveFreeChatAccentHex,
  resolveFreeChatWallpaperUrl,
  type FreeChatTheme,
  type OutgoingDeliveryStatus,
} from "./_types";

export interface SeedMessage {
  readonly id: string;
  readonly text: string;
  readonly fromPeer: boolean;
  readonly time: string;
  readonly senderName?: string;
  readonly deliveryStatus?: OutgoingDeliveryStatus;
}

export interface FreeChatCanvasClientProps {
  readonly seedMessages: ReadonlyArray<SeedMessage>;
  /** Server-resolved from cookie · null when no choice yet. */
  readonly initialThemeId: string | null;
  /** Server-resolved from cookie · true means hide the row. */
  readonly initialRowDismissed: boolean;
}

const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanBubble: "rgba(0, 175, 255, 0.12)",
  selfGrayGlass: "rgba(55, 65, 81, 0.35)",
  selfCyanHairline: "rgba(255, 255, 255, 0.65)",
  orange: "#FF7200",
  orangeInk: "#1A0808",
};

const COOKIE_WALLPAPER = "nex-free-chat-wallpaper";
const COOKIE_ROW_DISMISSED = "nex-free-chat-row-dismissed";
const COOKIE_MAX_AGE_DAYS = 365;

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

// Owner directive 2026-10-21 (iteration 66-83) · stage machine for
// the first-visit flow:
//   picker   · 2x3 theme grid (+ Keep/View action bar when a theme is
//              applied) · default landing state
//   setup    · after Keep Theme · picker container morphs into a chat
//              name + location setup form · action bar hidden
//   congrats · after Save · full-canvas overlay with confetti burst +
//              "Congratulations · Account Active" (iteration 83) ·
//              auto-advances to invite after 2.5s
//   invite   · "Let's invite your friends" prompt · 3 share CTAs
//              (WhatsApp, NEX, iMessage) + Done button
//   done     · after invite Done · row dismissed + cookie written ·
//              next visit skips everything
type FreeChatStage = "picker" | "setup" | "congrats" | "invite" | "done";

// Owner directive 2026-10-21 (iteration 68) · during the setup stage
// the chat canvas shows ONE focused bubble from Nex (the sealed seed
// messages are hidden) so the user's attention is on the setup form,
// not on the welcome content they've already scanned.
const SETUP_STAGE_MESSAGES: ReadonlyArray<SeedMessage> = [
  {
    id: "setup-nex",
    fromPeer: true,
    text:
      "Love the theme! Wait until your friends see it 😮\n\nBut first we need to finish set up.",
    time: "15:04",
    senderName: "Nex",
  },
];

// Owner directive 2026-10-21 (iteration 90) · during the invite stage
// the peer bubble shifts to the owner-authored congrats + what's-next
// script. Keeps the user focused on the two CTAs below (Invite Friends
// and Add NEX to Home Screen) without re-reading the earlier picker-
// stage welcome copy.
const INVITE_STAGE_MESSAGES: ReadonlyArray<SeedMessage> = [
  {
    id: "invite-nex",
    fromPeer: true,
    text:
      "🎉 Congratulations! Your NEX account is now active.\n\n" +
      "You're ready to connect, chat and grow your network.\n\n" +
      "What's next?\n\n" +
      "Invite friends — share your NEX ID and start connecting.\n\n" +
      "Your NEX journey starts here. Real People. Real Chats. Real Business.",
    time: "15:05",
    senderName: "Nex",
  },
];

export function FreeChatCanvasClient({
  seedMessages,
  initialThemeId,
  initialRowDismissed,
}: FreeChatCanvasClientProps): React.JSX.Element {
  // Owner directive 2026-10-22 (afternoon) · when the server resolver
  // couldn't find a saved wallpaper cookie, pre-seed the picker to the
  // NEX default tile ("nex-default", isDefault:true) so the user lands
  // with ONE theme already selected · the heartbeat glow fires on
  // that tile AND the "Keep theme" + "View Themes" action bar shows
  // immediately below the picker (gated on themeId !== null). Prior
  // behaviour left themeId null until the user tapped a tile · the
  // action bar was invisible on first paint.
  const [themeId, setThemeId] = React.useState<string | null>(
    initialThemeId ?? "nex-default",
  );
  const [stage, setStage] = React.useState<FreeChatStage>(
    initialRowDismissed ? "done" : "picker",
  );
  const rowDismissed = stage === "done";

  const activeWallpaperUrl = React.useMemo(
    () => resolveFreeChatWallpaperUrl(themeId),
    [themeId],
  );

  // Owner directive 2026-10-21 · per-theme bubble accent · both peer
  // and self bubbles tint to this colour · bubble SHAPE / RADIUS /
  // DESIGN are untouched · only the fill + rim + sender-name colours
  // swap. Falls back to NEX cyan when no theme is picked.
  const activeAccentHex = React.useMemo(
    () => resolveFreeChatAccentHex(themeId),
    [themeId],
  );
  const peerFill = React.useMemo(
    () => hexWithAlpha(activeAccentHex, 0.12),
    [activeAccentHex],
  );
  const peerRim = React.useMemo(
    () => hexWithAlpha(activeAccentHex, 0.42),
    [activeAccentHex],
  );
  const selfFill = React.useMemo(
    () => hexWithAlpha(activeAccentHex, 0.16),
    [activeAccentHex],
  );
  const selfRim = React.useMemo(
    () => hexWithAlpha(activeAccentHex, 0.72),
    [activeAccentHex],
  );

  // Owner directive 2026-10-21 (iteration 54) · wallpaper paints the
  // ENTIRE phone frame (header + canvas + composer), not just the
  // chat canvas. The server page sets the initial background on
  // <main data-nex-free-chat-root> from the cookie-resolved URL (no
  // hydration flash). This effect takes over post-hydration whenever
  // the user picks a different tile, writing the new background to
  // the same <main> element.
  React.useEffect(() => {
    const main = document.querySelector<HTMLElement>(
      "[data-nex-free-chat-root]",
    );
    if (!main) return;
    main.style.background = freeChatBackgroundCss(activeWallpaperUrl, NEX.bg);
  }, [activeWallpaperUrl]);

  // Owner directive 2026-10-21 (iteration 62) · auto-scroll the chat
  // canvas to the BOTTOM on mount so the first-visit picker row (and
  // the latest bubble) is visible without the user needing to scroll
  // manually · chat convention (bottom-anchored stream) matches
  // WhatsApp / iMessage / Signal.
  const canvasRef = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [rowDismissed, themeId]);

  // Owner directive 2026-10-21 (iteration 56) · picking a theme NO
  // LONGER dismisses the row · it only applies the wallpaper + records
  // the pick in the cookie so the choice survives a reload. The row
  // dismisses only when the user explicitly commits via "Keep Theme"
  // (handleKeepTheme) or routes to the library via "View themes"
  // (handleViewAll). This gives the user time to try different tiles
  // before locking the choice in.
  const handlePickTheme = React.useCallback((picked: FreeChatTheme) => {
    setThemeId(picked.id);
    writeCookie(COOKIE_WALLPAPER, picked.id);
    // Owner directive 2026-10-22 · broadcast theme change to sibling
    // composer so the sealed JokerKeypad recolours to the new theme's
    // accent on the same tap. Custom event lets composer + canvas
    // stay siblings instead of forcing a shared parent state tree.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("nex-free-chat-theme", {
          detail: { themeId: picked.id },
        }),
      );
    }
  }, []);

  // Owner directive 2026-10-21 (iteration 66) · Keep Theme no longer
  // dismisses the row immediately · it transitions the picker
  // container into the chat-setup form (name + location). The dismiss
  // cookie is written only after the user saves the setup OR routes
  // to View Themes.
  const handleKeepTheme = React.useCallback(() => {
    setStage("setup");
  }, []);

  const handleViewAll = React.useCallback(() => {
    setStage("done");
    writeCookie(COOKIE_ROW_DISMISSED, "1");
    // Navigation happens via the <Link> href — no router.push needed.
  }, []);

  // Owner directive 2026-10-21 (iteration 83) · Save advances to the
  // congrats stage first · congrats auto-advances to invite · invite
  // Done commits the dismiss cookie.
  const handleSetupSave = React.useCallback((_name: string, _coords: GeoCoords | null) => {
    setStage("congrats");
  }, []);

  const handleCongratsFinish = React.useCallback(() => {
    setStage("invite");
  }, []);

  const handleInviteDone = React.useCallback(() => {
    setStage("done");
    writeCookie(COOKIE_ROW_DISMISSED, "1");
  }, []);

  return (
    <>
    <section
      ref={canvasRef as React.RefObject<HTMLElement>}
      data-nex-free-chat-canvas
      data-nex-free-chat-canvas-theme={themeId ?? "none"}
      aria-label="Chat messages"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: "20px 14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        // Owner directive 2026-10-21 (iteration 54) · canvas is now
        // transparent so the <main> wallpaper shows through across the
        // full phone-frame height. Bubbles keep their own glass
        // backdrop-filter so they stay legible against the wallpaper.
        background: "transparent",
      }}
    >
      {(stage === "setup"
        ? SETUP_STAGE_MESSAGES
        : stage === "invite"
        ? INVITE_STAGE_MESSAGES
        : seedMessages
      ).map((m) => {
        const metaColor = m.fromPeer
          ? NEX.textMute
          : "rgba(242, 245, 248, 0.72)";
        return (
          <article
            key={m.id}
            data-nex-free-chat-bubble={m.id}
            data-nex-free-chat-bubble-from={m.fromPeer ? "peer" : "self"}
            data-nex-free-chat-bubble-delivery={m.deliveryStatus ?? undefined}
            style={{
              maxWidth: "80%",
              alignSelf: m.fromPeer ? "flex-start" : "flex-end",
              padding: "8px 14px 10px",
              borderRadius: 18,
              borderBottomLeftRadius: m.fromPeer ? 6 : 18,
              borderBottomRightRadius: m.fromPeer ? 18 : 6,
              background: m.fromPeer ? peerFill : selfFill,
              color: NEX.text,
              border: `1px solid ${m.fromPeer ? peerRim : selfRim}`,
              backdropFilter: "blur(10px) saturate(140%)",
              WebkitBackdropFilter: "blur(10px) saturate(140%)",
              fontSize: 14,
              lineHeight: 1.4,
              boxShadow: "0 6px 14px -8px rgba(0,0,0,0.6)",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <div
              data-nex-free-chat-bubble-meta
              style={{
                display: "inline-flex",
                alignItems: "baseline",
                gap: 6,
                alignSelf: "flex-end",
                fontSize: 10,
                color: metaColor,
                lineHeight: 1,
              }}
            >
              {m.fromPeer && m.senderName && (
                <span
                  data-nex-free-chat-bubble-sender
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: activeAccentHex,
                    letterSpacing: 0.2,
                  }}
                >
                  {m.senderName}
                </span>
              )}
              <span>{m.time}</span>
              {!m.fromPeer && m.deliveryStatus && (
                <DeliveryDot status={m.deliveryStatus} />
              )}
            </div>
            {/* Owner directive 2026-10-21 (iteration 55) · bubble text
                honours embedded newlines so multi-sentence peer bubbles
                (e.g. the welcome bubble combining the greeting + the
                "pick a theme" line) render as a single bubble with the
                paragraph break preserved. `pre-wrap` keeps normal word
                wrapping intact for long lines. */}
            <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
            {/* Owner directive 2026-10-21 (iteration 92) · invite stage
                merges its action buttons INTO the congrats bubble ·
                small WhatsApp + iMessage share buttons at the bottom
                of the message, plus a text-link Done so the user can
                dismiss without sharing. */}
            {m.id === "invite-nex" && stage === "invite" && (
              <InviteBubbleActions onDone={handleInviteDone} />
            )}
          </article>
        );
      })}

      {/* Picker stage · owner directive 2026-10-21 (iteration 66) ·
          2x3 theme tile grid · active tile heartbeat-glows · stays
          visible even after the user picks a tile so they can swap. */}
      {stage === "picker" && (
        <FirstVisitThemeGrid
          themes={FREE_CHAT_THEMES}
          activeThemeId={themeId}
          onPick={handlePickTheme}
          onViewAll={handleViewAll}
        />
      )}

      {/* Keep Theme / View Themes action bar · owner directive
          2026-10-21 (iteration 60) · visible only during the picker
          stage AND only after a theme is picked. Keep Theme now
          transitions the picker container into the chat-setup form
          (iteration 66) · View Themes routes to the library. */}
      {stage === "picker" && themeId !== null && (
        <PickedThemeActionBar
          onKeep={handleKeepTheme}
          onViewAll={handleViewAll}
        />
      )}

      {/* Setup stage · owner directive 2026-10-21 (iteration 66) ·
          after Keep Theme the picker container morphs into this form:
          chat name input (length-limited) + "Use my location" button
          (geolocation API · phone or desktop) + Save CTA. Save
          advances to the invite stage (iteration 82). */}
      {stage === "setup" && <ChatSetupContainer onSave={handleSetupSave} />}

      {/* Congrats stage · owner directive 2026-10-21 (iteration 83) ·
          full-canvas overlay with confetti exploding from center +
          "Congratulations · Account Active" text · auto-advances to
          invite after 2.5s. */}
      {stage === "congrats" && (
        <CongratsOverlay onFinish={handleCongratsFinish} />
      )}

      {/* Owner directive 2026-10-21 (iteration 92) · the InviteFriends
          container was retired · its content (share buttons + Done)
          now lives INSIDE the congrats bubble above as inline actions. */}
    </section>
    {/* Owner directive 2026-10-23 (Step D rollout per doctrine
        nex-free-chat-showcase-themes-free-forever-2026-10-23 §6 ·
        animation polish is NOT blocked). ONLY mounts when the ACTIVE
        theme is theme-2 (the space wallpaper · free-chat-theme-2.png
        · verified by viewing the asset · the top-row 3rd tile right).
        Other themes continue to render exactly as sealed · zero
        regression. */}
    {themeId === "theme-2" && (
      <HeroPlanetPassBy accentHex={activeAccentHex} />
    )}
    {/* Owner directive 2026-10-23 · theme-1 (pink moonlit cherry-
        blossom lake wallpaper) · butterflies flying around the top
        area. Scoped STRICTLY to theme-1 · every other theme untouched. */}
    {themeId === "theme-1" && (
      <ButterflyFlyby />
    )}
    </>
  );
}

/* ─── HeroPlanetPassBy ───────────────────────────────────────────
   Owner directive 2026-10-23 · "planet should start dot and ask it
   travels from right hero area towards left its getting bigger and
   flies through any card past the camera guy".

   Mounted ONLY when active theme is theme-2 (the space wallpaper).

   Trajectory:
   · Starts as a 4px dot on the right edge of the hero area
   · Travels diagonally down-and-left across the frame
   · Scales 0.05 → 4.0 as it moves · at the end the planet is
     larger than the frame, flying "past the camera" and off-screen
     to the lower-left
   · Super-high zIndex (90 ambient / 91 one-shot) so the planet
     paints OVER every chat card, bubble, and composer chrome
     ("flies through any card past the camera guy")

   Dual-mode:
   · Ambient loop · 22s cycle auto-plays while mounted so returning
     visitors always see motion
   · One-shot Fire · the 🚀 pill triggers a faster 7s pass that
     stacks over the ambient loop · each tap is a fresh dot-to-huge

   Reduced-motion fallback · pauses translate + scale, keeps the
   planet static at mid-hero as a quiet focal point.

   Asset: /nex-native/planets/planet-approach-1.png (owner-supplied
   2026-10-15 · same PNG used by the sealed NexPlanetApproachClient
   so visual language stays consistent across surfaces).
*/
const HERO_PLANET_SRC = "/nex-native/planets/planet-approach-1.png";
// Owner directive 2026-10-23 · "2 images 1 of space shuttle and
// other satellite · separated and reduced to realistic size · floating
// movement · view between the overlay cards". Split + tight-cropped
// via Pillow from the owner-supplied PNG · zIndex sits ABOVE the
// wallpaper + BELOW the planet so they drift behind the planet but
// remain visible between chat cards.
const HERO_SHUTTLE_SRC = "/nex-native/planets/space-shuttle.png";
const HERO_SATELLITE_SRC = "/nex-native/planets/satellite.png";
// Owner-supplied Moon + Jupiter · split via Pillow + alpha extracted
// from luminance (owner image shipped on black canvas despite the
// filename · threshold removes the bg, soft falloff keeps the orb
// edge glow). Celestial bodies hang quietly at corners · very slow
// drift so they feel like distant planets, not kinetic objects.
const HERO_MOON_SRC = "/nex-native/planets/moon.png";
const HERO_JUPITER_SRC = "/nex-native/planets/jupiter.png";

function HeroPlanetPassBy({
  accentHex,
}: {
  readonly accentHex: string;
}): React.JSX.Element {
  const [fireCount, setFireCount] = React.useState(0);
  const fire = React.useCallback(() => setFireCount((n) => n + 1), []);

  return (
    <>
      <style>{`
        /* Owner directive 2026-10-23 · "use the same angle as on the
           planet movement as them [prototype theme-3 page] but on our
           theme now". Keyframe values copied verbatim from the sealed
           NexPlanetApproachClient (src/lib/nex-native/nex-planet-
           approach-client.tsx) · starts as a 0.04 speck at the
           viewport centre, scales + translates diagonally toward the
           lower-left, exits off-screen at scale 2.4. The outer
           translate(-50%, -50%) anchors the planet by its own centre
           so the scale expands around the sphere instead of its
           top-left corner. */
        @keyframes nex-hero-planet-pass {
          0%   { transform: translate(-50%, -50%) translate3d(   0,   0, 0) scale(0.04); opacity: 0; }
          8%   { opacity: 0.8; }
          35%  { transform: translate(-50%, -50%) translate3d( -6vw,  4vh, 0) scale(0.22); opacity: 1; }
          65%  { transform: translate(-50%, -50%) translate3d(-22vw, 14vh, 0) scale(0.65); opacity: 1; }
          82%  { transform: translate(-50%, -50%) translate3d(-55vw, 28vh, 0) scale(1.20); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate3d(-120vw, 60vh, 0) scale(2.40); opacity: 0; }
        }
        /* Owner directive 2026-10-23 · shuttle drifts slowly across
           the upper-middle of the frame left → right over 48s · subtle
           bob + micro-rotation give it a realistic "coasting through
           orbit" feel. Keeps the shuttle readable without stealing
           focus from the chat. */
        @keyframes nex-hero-shuttle-drift {
          0%   { transform: translate3d(-40vw, 0, 0) rotate(-2deg); opacity: 0; }
          8%   { opacity: 0.85; }
          50%  { transform: translate3d(40vw, 2vh, 0) rotate(2deg); opacity: 0.85; }
          92%  { opacity: 0.85; }
          100% { transform: translate3d(140vw, 0, 0) rotate(-2deg); opacity: 0; }
        }
        /* Satellite drifts opposite direction (right → left) across
           the lower-middle · 58s loop · slower cadence pairs with the
           shuttle so the pair never stacks on screen simultaneously
           in the same place. */
        @keyframes nex-hero-satellite-drift {
          0%   { transform: translate3d(140vw, 0, 0) rotate(2deg); opacity: 0; }
          8%   { opacity: 0.85; }
          50%  { transform: translate3d(40vw, -2vh, 0) rotate(-2deg); opacity: 0.85; }
          92%  { opacity: 0.85; }
          100% { transform: translate3d(-40vw, 0, 0) rotate(-6deg); opacity: 0; }
        }
        /* Owner directive 2026-10-23 · Moon + Jupiter · ambient
           distant-planet drift. Very subtle motion (barely-visible
           parallax + slow rotation) so they feel like celestial
           bodies hanging in space rather than kinetic objects.
           ~100s cycle for Moon · ~140s for Jupiter so they never
           synchronise. */
        @keyframes nex-hero-moon-float {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
          50%      { transform: translate3d(5vw, 2vh, 0) rotate(4deg); }
        }
        @keyframes nex-hero-jupiter-float {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
          50%      { transform: translate3d(-4vw, -3vh, 0) rotate(-3deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-hero-planet-ambient],
          [data-nex-hero-planet-oneshot] {
            animation: none !important;
            opacity: 0.5 !important;
            transform: translate(-50%, -50%) scale(1) !important;
          }
          [data-nex-hero-shuttle],
          [data-nex-hero-satellite],
          [data-nex-hero-moon],
          [data-nex-hero-jupiter] {
            animation: none !important;
          }
        }
      `}</style>

      {/* Moon · top-left corner · partially off-screen so it reads as
          "a moon on the horizon" rather than dominating the frame.
          zIndex 1 · behind shuttle/satellite (zIndex 2) and behind
          chat bubbles · depth cue for "we are in deep space". */}
      <img
        src={HERO_MOON_SRC}
        alt=""
        aria-hidden
        data-nex-hero-moon
        draggable={false}
        style={{
          position: "absolute",
          top: "4%",
          left: "-6%",
          width: 110,
          height: 110,
          objectFit: "contain",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 1,
          willChange: "transform",
          animation: "nex-hero-moon-float 100s ease-in-out infinite",
          opacity: 0.9,
          filter: "drop-shadow(0 0 18px rgba(180,195,220,0.35))",
        }}
      />

      {/* Jupiter · bottom-right corner · same partially-off-screen
          treatment · bigger than the Moon (gas giant · nearer sun).
          Opposite drift direction so the pair feels organic. */}
      <img
        src={HERO_JUPITER_SRC}
        alt=""
        aria-hidden
        data-nex-hero-jupiter
        draggable={false}
        style={{
          position: "absolute",
          top: "70%",
          right: "-8%",
          width: 150,
          height: 150,
          objectFit: "contain",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 1,
          willChange: "transform",
          animation: "nex-hero-jupiter-float 140s ease-in-out infinite",
          opacity: 0.92,
          filter: "drop-shadow(0 0 22px rgba(205,140,80,0.35))",
        }}
      />

      {/* Owner directive 2026-10-23 · space shuttle drifts across the
          upper third · "view between the overlay cards now" = sits in
          the wallpaper layer so chat bubbles with glass backdrop
          paint over it. Realistic size (120×40 · 3:1 aspect from
          source). 48s loop · zIndex 2 (above wallpaper, below the
          planet at 90). */}
      <img
        src={HERO_SHUTTLE_SRC}
        alt=""
        aria-hidden
        data-nex-hero-shuttle
        draggable={false}
        style={{
          position: "absolute",
          top: "32%",
          left: 0,
          width: 120,
          height: 40,
          objectFit: "contain",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 2,
          willChange: "transform, opacity",
          animation:
            "nex-hero-shuttle-drift 48s cubic-bezier(0.4, 0, 0.6, 1) 3s infinite",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))",
        }}
      />

      {/* Satellite drifts the opposite direction across the lower
          third · 58s cycle. Same wallpaper-layer treatment. Realistic
          size (110×40 · ~2.75:1 aspect from source). */}
      <img
        src={HERO_SATELLITE_SRC}
        alt=""
        aria-hidden
        data-nex-hero-satellite
        draggable={false}
        style={{
          position: "absolute",
          top: "62%",
          left: 0,
          width: 110,
          height: 40,
          objectFit: "contain",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 2,
          willChange: "transform, opacity",
          animation:
            "nex-hero-satellite-drift 58s cubic-bezier(0.4, 0, 0.6, 1) 12s infinite",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))",
        }}
      />

      {/* Ambient loop · auto-plays while mounted · 10s cycle so the
          sealed 6s one-shot trajectory shape stays faithful (we add
          a 4s gap-opacity-0 tail that lets the planet "disappear"
          before the next loop starts). */}
      <img
        src={HERO_PLANET_SRC}
        alt=""
        aria-hidden
        data-nex-hero-planet-ambient
        draggable={false}
        style={{
          position: "absolute",
          // Owner directive 2026-10-23 · "move up 30px and move to the
          // right 30px". Mount origin lifted a further 30px (top: 15%
          // − 30) and shifted right a further 30px (left: 50% + 30)
          // from the previous near-header start. Keyframe trajectory
          // unchanged · same diagonal sweep from the new anchor.
          top: "calc(15% - 30px)",
          left: "calc(50% + 30px)",
          width: 240,
          height: 240,
          objectFit: "contain",
          pointerEvents: "none",
          userSelect: "none",
          // zIndex 90 · OVER chat bubbles + welcome card + composer ·
          // doctrine "flies through any card past the camera guy".
          zIndex: 90,
          willChange: "transform, opacity",
          transformOrigin: "50% 50%",
          animation:
            "nex-hero-planet-pass 10s cubic-bezier(0.4, 0, 0.3, 1) 1s infinite",
          filter: `drop-shadow(0 0 32px ${accentHex}66)`,
        }}
      />

      {/* One-shot · 6s matches the sealed NexPlanetApproachClient
          APPROACH_SEC constant · each 🚀 Fire tap re-mounts via the
          fireCount key so the keyframe restarts cleanly. */}
      {fireCount > 0 && (
        <img
          key={`oneshot-${fireCount}`}
          src={HERO_PLANET_SRC}
          alt=""
          aria-hidden
          data-nex-hero-planet-oneshot
          draggable={false}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 240,
            height: 240,
            objectFit: "contain",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 91,
            willChange: "transform, opacity",
            transformOrigin: "50% 50%",
            animation:
              "nex-hero-planet-pass 6s cubic-bezier(0.4, 0, 0.3, 1) forwards",
            filter: `drop-shadow(0 0 36px ${accentHex}aa)`,
          }}
        />
      )}

      {/* 🚀 Fire pill · floating top-right · high zIndex so nothing
          can cover it. Pure prototype convenience · the ambient
          planet runs regardless. */}
      <button
        type="button"
        onClick={fire}
        aria-label="Fire planet pass-by"
        data-nex-hero-planet-fire
        style={{
          position: "absolute",
          top: 68,
          right: 12,
          zIndex: 70,
          minHeight: 36,
          padding: "0 14px",
          borderRadius: 999,
          background: accentHex,
          color: "#002813",
          border: "2px solid #FFFFFF",
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: 0.4,
          cursor: "pointer",
          fontFamily: "inherit",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          boxShadow: `0 4px 14px ${accentHex}cc, 0 0 0 2px #00281355`,
          lineHeight: 1,
        }}
      >
        🚀 Fire
      </button>
    </>
  );
}

// ─── Chat Setup container (post-Keep-Theme) ─────────────────────
//
// Owner directive 2026-10-21 (iteration 66) · after the user commits
// their theme via Keep Theme, the Choose Theme container morphs into
// this form so the user can:
//   · enter a chat name (length-controlled · max 20 chars · live
//     counter displayed next to the label)
//   · set their location via geolocation (works on phone AND desktop
//     via the same navigator.geolocation API · user grants permission
//     when the button is tapped)
//   · Save commits the setup + dismisses the entire row
//
// v1 scope · the name + coords live in client state only; nothing is
// persisted to the server yet (free-chat is a preview surface). A
// future slice can wire these into a server action.

export interface GeoCoords {
  readonly latitude: number;
  readonly longitude: number;
}

const CHAT_NAME_MAX = 12;

function ChatSetupContainer({
  onSave,
}: {
  readonly onSave: (name: string, coords: GeoCoords | null) => void;
}): React.JSX.Element {
  const [name, setName] = React.useState("");
  const [coords, setCoords] = React.useState<GeoCoords | null>(null);
  const [locationState, setLocationState] = React.useState<
    "idle" | "requesting" | "granted" | "denied" | "unsupported"
  >("idle");

  // Owner directive 2026-10-21 (iteration 70) · auto-generate a 6-digit
  // NEX ID the moment the setup container mounts · displayed under
  // "Create Chat Account" + synced to the header subtitle + the
  // ControlDrawer identity bar (via DOM query + MutationObserver so
  // the drawer gets the new value whenever the user opens it). The ID
  // is a preview-only placeholder; the real `nex_handle` is minted by
  // the server when the account is persisted (not wired on this
  // surface yet).
  const nexId = React.useMemo(
    () => String(Math.floor(100000 + Math.random() * 900000)),
    [],
  );

  const trimmedName = name.trim();
  const DARK_RED = "#8B1A1A";
  const DARK_RED_GLOW = "rgba(139, 26, 26, 0.55)";
  const [attemptedSave, setAttemptedSave] = React.useState(false);

  // Owner directive 2026-10-21 (iteration 73) · Copy ID button sits
  // on the right of the NEX ID block · writes the raw ID (just the
  // 6 digits · caller can decide whether to prefix "NEX - " when
  // pasting) to the clipboard · brief "Copied" confirmation chip.
  const [copyFeedback, setCopyFeedback] = React.useState<"idle" | "copied">(
    "idle",
  );
  const copyNexId = React.useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(nexId).then(() => {
      setCopyFeedback("copied");
      window.setTimeout(() => setCopyFeedback("idle"), 1400);
    }).catch(() => {});
  }, [nexId]);

  // Owner directive 2026-10-21 (iteration 74) · profile image upload ·
  // modern pattern: circular preview on the left (shows the uploaded
  // image or a NEX placeholder) + Upload Photo button on the right ·
  // small hint text listing accepted formats + max size · uploading a
  // new file revokes the previous blob URL (frees memory) and swaps
  // the preview in place. v1 scope · client-only state · no upload
  // to a server bucket yet (that lands when the account is persisted).
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const [avatarError, setAvatarError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
  const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";
  const AVATAR_ACCEPT_HINT = "JPEG · PNG · WEBP · max 5 MB";

  const handleAvatarPick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAvatarChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset the input value so picking the same file twice fires change again.
      e.target.value = "";
      if (!file) return;
      if (!AVATAR_ACCEPT.split(",").includes(file.type)) {
        setAvatarError("Pick a JPEG, PNG or WEBP image");
        return;
      }
      if (file.size > AVATAR_MAX_BYTES) {
        setAvatarError("Image is larger than 5 MB");
        return;
      }
      // Revoke the previous blob URL before replacing · stops the
      // browser leaking memory on repeated uploads.
      setAvatarPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setAvatarError(null);
    },
    [AVATAR_ACCEPT, AVATAR_MAX_BYTES],
  );

  // Clean up the blob URL when the setup container unmounts (user
  // saves OR routes away). Otherwise the URL would leak until the tab
  // closes.
  React.useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  // Owner directive 2026-10-21 (iteration 81) · full-form validation.
  // Every field (avatar + chat name + location) must be completed
  // before the user can save. Save button stays clickable even when
  // invalid · tapping it flags `attemptedSave`, which paints a dark
  // red glow on every missing field. The glow persists until the
  // user fixes each one. Declared AFTER avatarPreview + coords so
  // the TDZ error from iteration 81's initial placement is avoided.
  const errors = {
    avatar: avatarPreview === null,
    name: trimmedName.length === 0 || trimmedName.length > CHAT_NAME_MAX,
    location: coords === null,
  } as const;
  const hasAnyError = errors.avatar || errors.name || errors.location;
  const showAvatarError = attemptedSave && errors.avatar;
  const showNameError = attemptedSave && errors.name;
  const showLocationError = attemptedSave && errors.location;
  const canSave = !hasAnyError;

  const handleSaveClick = React.useCallback(() => {
    if (hasAnyError) {
      setAttemptedSave(true);
      return;
    }
    onSave(trimmedName, coords);
  }, [hasAnyError, onSave, trimmedName, coords]);

  // Owner directive 2026-10-21 (iteration 75) · sync the uploaded
  // avatar into the header's NEX ping badge slot (sealed primitive
  // untouched · we inject a round overlay DIV on top). Overlay carries
  // its own border so the user sees a clear "this is now your image"
  // affordance replacing the generic NEX badge. On unmount we remove
  // the overlay so the next visit reads cleanly.
  React.useEffect(() => {
    const slot = document.querySelector<HTMLElement>(
      "[data-nex-free-chat-header-avatar-slot]",
    );
    if (!slot) return;
    let overlay = slot.querySelector<HTMLElement>(
      "[data-nex-free-chat-header-avatar-overlay]",
    );
    if (avatarPreview) {
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.setAttribute(
          "data-nex-free-chat-header-avatar-overlay",
          "true",
        );
        overlay.style.position = "absolute";
        overlay.style.inset = "0";
        overlay.style.borderRadius = "50%";
        overlay.style.backgroundSize = "cover";
        overlay.style.backgroundPosition = "center";
        overlay.style.backgroundRepeat = "no-repeat";
        overlay.style.border = `2px solid ${NEX.cyan}`;
        overlay.style.boxShadow = `0 0 10px -2px rgba(0, 175, 255, 0.55)`;
        overlay.style.pointerEvents = "none";
        overlay.style.zIndex = "2";
        slot.appendChild(overlay);
      }
      overlay.style.backgroundImage = `url("${avatarPreview}")`;
    } else if (overlay) {
      overlay.remove();
    }
  }, [avatarPreview]);
  React.useEffect(() => {
    return () => {
      const slot = document.querySelector<HTMLElement>(
        "[data-nex-free-chat-header-avatar-slot]",
      );
      const overlay = slot?.querySelector<HTMLElement>(
        "[data-nex-free-chat-header-avatar-overlay]",
      );
      overlay?.remove();
    };
  }, []);

  // Owner directive 2026-10-21 (iteration 70) · header sync pattern:
  //   · wordmark · follows the user's typed name (iteration 69 rule
  //     unchanged · empty → "NEX" · typing → that text)
  //   · subtitle · shows the auto-generated NEX ID while setup is in
  //     progress → "NEX - 347433" format · reverts to "NEX - Guest"
  //     on unmount
  //   · drawer identity bar · same NEX ID landing in the sealed
  //     ControlDrawer anon identity row · MutationObserver watches
  //     for the drawer being opened (portal mount) and keeps the
  //     label in sync
  const applyDrawerAnonLabel = React.useCallback(() => {
    const label = document.querySelector<HTMLElement>(
      "[data-nex-control-drawer-anon] > div > span:first-child",
    );
    const hint = document.querySelector<HTMLElement>(
      "[data-nex-control-drawer-anon] > div > span:nth-child(2)",
    );
    if (label) label.textContent = `NEX - ${nexId}`;
    if (hint) hint.textContent = "your preview account";
  }, [nexId]);

  React.useEffect(() => {
    const wordmark = document.querySelector<HTMLElement>(
      "[data-nex-free-chat-header-wordmark]",
    );
    const subtitle = document.querySelector<HTMLElement>(
      "[data-nex-free-chat-header-subtitle]",
    );
    if (wordmark) {
      wordmark.textContent = trimmedName.length > 0 ? trimmedName : "NEX";
    }
    if (subtitle) {
      subtitle.textContent = `NEX - ${nexId}`;
    }
    // Keep the drawer in sync too · harmless no-op if closed.
    applyDrawerAnonLabel();
  }, [trimmedName, nexId, applyDrawerAnonLabel]);

  // Watch the DOM for the ControlDrawer being opened (sealed primitive
  // mounts its content via portal when `open=true`). Each time the
  // anon identity row appears, re-apply the NEX ID label.
  React.useEffect(() => {
    applyDrawerAnonLabel();
    const observer = new MutationObserver(() => {
      applyDrawerAnonLabel();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [applyDrawerAnonLabel]);

  // Restore defaults on unmount (Save → done, or user navigates away).
  React.useEffect(() => {
    return () => {
      const wordmark = document.querySelector<HTMLElement>(
        "[data-nex-free-chat-header-wordmark]",
      );
      const subtitle = document.querySelector<HTMLElement>(
        "[data-nex-free-chat-header-subtitle]",
      );
      if (wordmark) wordmark.textContent = "NEX";
      if (subtitle) subtitle.textContent = "NEX - Guest";
      const label = document.querySelector<HTMLElement>(
        "[data-nex-control-drawer-anon] > div > span:first-child",
      );
      const hint = document.querySelector<HTMLElement>(
        "[data-nex-control-drawer-anon] > div > span:nth-child(2)",
      );
      if (label) label.textContent = "Sign in to NEX";
      if (hint) hint.textContent = "to access your account";
    };
  }, []);

  const requestLocation = React.useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationState("unsupported");
      return;
    }
    setLocationState("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLocationState("granted");
      },
      () => {
        setLocationState("denied");
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 10_000,
      },
    );
  }, []);

  return (
    <section
      data-nex-free-chat-chat-setup
      aria-label="Set up your chat"
      style={{
        marginTop: 8,
        padding: "12px 12px",
        background: "rgba(2, 9, 20, 0.65)",
        border: `1px solid rgba(0, 175, 255, 0.22)`,
        borderRadius: 12,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "0 2px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
          <h3
            data-nex-free-chat-chat-setup-title
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: NEX.cyan,
              lineHeight: 1,
            }}
          >
            NEX ID
          </h3>
          <span
            data-nex-free-chat-chat-setup-nex-id-value
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: 1,
              color: NEX.text,
              lineHeight: 1,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace',
            }}
          >
            {nexId}
          </span>
        </div>

        <button
          type="button"
          onClick={copyNexId}
          data-nex-free-chat-chat-setup-copy-id
          data-nex-free-chat-chat-setup-copy-id-state={copyFeedback}
          aria-label="Copy NEX ID"
          /* Owner directive 2026-10-21 (iteration 79) · solid black
             fill with white label · reads as a dedicated utility
             button distinct from the brand-colored primary CTAs
             elsewhere. "Copied" state keeps the green confirmation. */
          style={{
            flexShrink: 0,
            minHeight: 32,
            padding: "0 12px",
            borderRadius: 8,
            background:
              copyFeedback === "copied"
                ? "rgba(22, 214, 107, 0.14)"
                : "#000000",
            border: `1px solid ${
              copyFeedback === "copied"
                ? "rgba(22, 214, 107, 0.55)"
                : "#000000"
            }`,
            color:
              copyFeedback === "copied" ? "#16D66B" : "#FFFFFF",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "inherit",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            WebkitTapHighlightColor: "transparent",
            transition: "background 150ms ease, color 150ms ease",
          }}
        >
          {copyFeedback === "copied" ? "✓ Copied" : "Copy ID"}
        </button>
      </div>

      {/* Profile image upload · owner directive 2026-10-21 (iteration 74) ·
          circular preview + Upload button + format hint. Uploading a
          new image revokes the previous blob URL and swaps the
          preview. */}
      <div
        data-nex-free-chat-chat-setup-avatar
        data-nex-free-chat-chat-setup-avatar-error={showAvatarError ? "true" : "false"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px",
          background: "rgba(2, 9, 20, 0.45)",
          border: `1px solid ${
            showAvatarError ? DARK_RED : "rgba(0, 175, 255, 0.14)"
          }`,
          borderRadius: 10,
          boxShadow: showAvatarError
            ? `0 0 0 2px ${DARK_RED}, 0 0 16px -2px ${DARK_RED_GLOW}`
            : "none",
          transition: "box-shadow 180ms ease, border-color 180ms ease",
        }}
      >
        {/* Preview circle */}
        <div
          data-nex-free-chat-chat-setup-avatar-preview
          aria-hidden
          style={{
            flexShrink: 0,
            width: 56,
            height: 56,
            borderRadius: "50%",
            overflow: "hidden",
            background: avatarPreview
              ? `url("${avatarPreview}") center / cover no-repeat, #0A1526`
              : "linear-gradient(135deg, #0A1526 0%, #06111F 100%)",
            border: `1.5px solid ${
              avatarPreview ? NEX.cyan : "rgba(0, 175, 255, 0.28)"
            }`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: NEX.textMute,
            fontSize: 22,
            boxShadow: "inset 0 0 12px rgba(0, 0, 0, 0.3)",
          }}
        >
          {!avatarPreview && <span aria-hidden>👤</span>}
        </div>

        {/* Right column · button + hint + error */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            type="button"
            onClick={handleAvatarPick}
            data-nex-free-chat-chat-setup-avatar-upload
            style={{
              alignSelf: "flex-start",
              minHeight: 32,
              padding: "0 12px",
              borderRadius: 8,
              background: NEX.orange,
              color: NEX.orangeInk,
              border: `1px solid ${NEX.orange}`,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              WebkitTapHighlightColor: "transparent",
              boxShadow: `0 4px 10px -6px ${NEX.orange}`,
            }}
          >
            {avatarPreview ? "Change Photo" : "Upload Photo"}
          </button>
          <span
            data-nex-free-chat-chat-setup-avatar-hint
            style={{
              fontSize: 10,
              color: avatarError ? "#F23A4F" : NEX.textMute,
              letterSpacing: 0.2,
            }}
          >
            {avatarError ?? AVATAR_ACCEPT_HINT}
          </span>
        </div>

        {/* Hidden file input · triggered by the Upload Photo button */}
        <input
          ref={fileInputRef}
          type="file"
          accept={AVATAR_ACCEPT}
          onChange={handleAvatarChange}
          data-nex-free-chat-chat-setup-avatar-input
          style={{ display: "none" }}
        />
      </div>

      {/* Name row · label + counter */}
      <label
        htmlFor="nex-free-chat-chat-name"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <span
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontSize: 11,
            color: NEX.textDim,
          }}
        >
          <span>Chat name</span>
          <span
            data-nex-free-chat-chat-name-counter
            style={{
              fontSize: 10,
              color:
                trimmedName.length > CHAT_NAME_MAX
                  ? "#F23A4F"
                  : NEX.textMute,
            }}
          >
            {trimmedName.length} / {CHAT_NAME_MAX}
          </span>
        </span>
        <input
          id="nex-free-chat-chat-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, CHAT_NAME_MAX))}
          maxLength={CHAT_NAME_MAX}
          placeholder="e.g. Alex"
          /* Owner directive 2026-10-21 (iteration 76) · Chrome's
             autofill applied a white/yellow background to this field
             the moment the user typed into it. Three defences stacked:
               1. autoComplete="off" (short-circuits most browsers'
                  autofill heuristics)
               2. name/id named non-autofillable so autofill can't
                  match the field to a known data category
               3. the <style> block below overrides the WebKit autofill
                  styles with the sealed dark input palette */
          /* `new-password` is the most reliable Chrome/Edge anti-
             autofill token - "off" is widely ignored by Chromium. */
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          /* Owner directive 2026-10-21 (iteration 78 follow-up) ·
             auto-focus the field as soon as the setup container
             opens so the native cyan caret is visible + blinking
             immediately · no "where do I type?" hesitation. */
          autoFocus
          name="nex-free-chat-display-name"
          data-nex-free-chat-chat-name-input
          data-nex-free-chat-chat-name-error={showNameError ? "true" : "false"}
          /* Owner directive 2026-10-21 (iteration 78) · minimal line
             input + iteration 81 · dark red underline + glow when
             the user attempts Save without a value. */
          style={{
            width: "100%",
            padding: "6px 2px",
            background: "transparent",
            color: NEX.text,
            fontSize: 15,
            border: "none",
            borderBottom: `${showNameError ? 2 : 1}px solid ${
              showNameError ? DARK_RED : "rgba(0, 175, 255, 0.42)"
            }`,
            borderRadius: 0,
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
            caretColor: NEX.cyan,
            boxShadow: showNameError
              ? `0 2px 10px -2px ${DARK_RED_GLOW}`
              : "none",
            transition: "border-color 180ms ease, box-shadow 180ms ease",
          }}
        />
        <style>{`
          /* Thicker cyan underline on focus so the active state reads
             as a lit text field without a filled container. */
          [data-nex-free-chat-chat-name-input]:focus {
            border-bottom-color: #00AFFF !important;
            border-bottom-width: 2px !important;
            padding-bottom: 5px !important;
          }
          /* WebKit autofill override · Chrome paints a yellow/white
             background on autofilled fields and the "transparent"
             inset shadow (iteration 78) let it bleed through. Switch
             to a SOLID dark navy inset so the field stays dark even
             while the browser believes it is autofilled. The sealed
             line-input visual (no filled container) still reads
             correctly on first touch · the subtle dark fill only
             appears if the browser forces an autofill. */
          [data-nex-free-chat-chat-name-input]:-webkit-autofill,
          [data-nex-free-chat-chat-name-input]:-webkit-autofill:hover,
          [data-nex-free-chat-chat-name-input]:-webkit-autofill:focus,
          [data-nex-free-chat-chat-name-input]:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 1000px #071525 inset !important;
            -webkit-text-fill-color: #F2F5F8 !important;
            caret-color: #00AFFF !important;
            transition: background-color 5000s ease-in-out 0s;
          }
        `}</style>
      </label>

      {/* Location row · button + status chip */}
      <div
        data-nex-free-chat-chat-location-row
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: NEX.textDim,
          }}
        >
          Location
        </span>
        <button
          type="button"
          onClick={requestLocation}
          disabled={locationState === "requesting"}
          data-nex-free-chat-chat-location-button
          data-nex-free-chat-chat-location-state={locationState}
          /* Owner directive 2026-10-21 (iteration 80) · granted state
             drops the pill container entirely · just the ✓ check +
             coords read as plain inline text (left-aligned, no fill,
             no border, no shadow). Pre-granted keeps the solid orange
             CTA (iteration 69 rule). */
          style={
            locationState === "granted"
              ? {
                  width: "100%",
                  minHeight: 0,
                  padding: "4px 2px",
                  borderRadius: 0,
                  background: "transparent",
                  border: "none",
                  color: "#16D66B",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 0.2,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 6,
                  WebkitTapHighlightColor: "transparent",
                  boxShadow: "none",
                  textAlign: "left",
                }
              : {
                  width: "100%",
                  minHeight: 40,
                  padding: "0 12px",
                  borderRadius: 10,
                  background: NEX.orange,
                  border: `${showLocationError ? 2 : 1}px solid ${
                    showLocationError ? DARK_RED : NEX.orange
                  }`,
                  color: NEX.orangeInk,
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  cursor:
                    locationState === "requesting" ? "wait" : "pointer",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  WebkitTapHighlightColor: "transparent",
                  boxShadow: showLocationError
                    ? `0 0 0 2px ${DARK_RED}, 0 0 16px -2px ${DARK_RED_GLOW}`
                    : `0 6px 14px -8px ${NEX.orange}`,
                  transition:
                    "background 150ms ease, border-color 180ms ease, box-shadow 180ms ease",
                }
          }
        >
          {locationState === "idle" && <>📍 Use my location</>}
          {locationState === "requesting" && <>Requesting…</>}
          {locationState === "granted" && coords && (
            <>
              ✓ Location set ·{" "}
              {coords.latitude.toFixed(3)}, {coords.longitude.toFixed(3)}
            </>
          )}
          {locationState === "denied" && (
            <>⚠ Permission denied · tap to retry</>
          )}
          {locationState === "unsupported" && (
            <>Not supported on this device</>
          )}
        </button>
      </div>

      {/* Owner directive 2026-10-21 (iteration 81) · validation hint
          · appears only when the user has already tapped Save and
          some fields are still missing. The individual field glows
          are the primary signal; this one-liner names what is
          missing so the user doesn't have to scan the form. */}
      {attemptedSave && hasAnyError && (
        <div
          data-nex-free-chat-chat-setup-error-summary
          role="alert"
          style={{
            marginTop: -2,
            padding: "6px 10px",
            background: "rgba(139, 26, 26, 0.14)",
            border: `1px solid ${DARK_RED}`,
            borderRadius: 8,
            color: "#FFC2C2",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.2,
          }}
        >
          Please complete:{" "}
          {[
            errors.avatar && "profile photo",
            errors.name && "chat name",
            errors.location && "location",
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}

      {/* Save CTA · owner directive 2026-10-21 (iteration 81) · the
          button is ALWAYS clickable so the user can discover what is
          missing via the error-summary + per-field glows. Internal
          `handleSaveClick` either commits (when valid) or trips the
          validation flag (when invalid). */}
      <button
        type="button"
        onClick={handleSaveClick}
        data-nex-free-chat-chat-setup-save
        data-nex-free-chat-chat-setup-save-can-save={canSave ? "true" : "false"}
        style={{
          marginTop: 2,
          minHeight: 44,
          padding: "0 14px",
          borderRadius: 10,
          background: canSave ? NEX.cyan : "rgba(0, 175, 255, 0.2)",
          color: canSave ? "#0a0608" : NEX.textMute,
          border: `1px solid ${canSave ? NEX.cyan : "rgba(0, 175, 255, 0.3)"}`,
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 0.3,
          cursor: "pointer",
          fontFamily: "inherit",
          WebkitTapHighlightColor: "transparent",
          transition: "background 150ms ease, color 150ms ease",
        }}
      >
        Save
      </button>
    </section>
  );
}

// ─── Congrats overlay (post-Save) ────────────────────────────────
//
// Owner directive 2026-10-21 (iteration 83) · immediately after the
// user commits Save on the setup form, a full-canvas overlay burst
// of confetti erupts from the center alongside a "Congratulations ·
// Account Active" message. The overlay auto-dismisses after 2.5s
// (long enough to read, short enough to not feel sticky) and the
// parent stage machine advances to the invite surface.
//
// Pure CSS confetti · no new dependency · 50 pieces with random
// angles / distances / sizes / colours · each flies from the center
// outward via the `nex-free-chat-confetti-fly` keyframe (translating
// to a per-piece CSS variable target with scale + rotate + fade).

function CongratsOverlay({
  onFinish,
}: {
  readonly onFinish: () => void;
}): React.JSX.Element {
  // Auto-advance after 2.5s · covers the 1.5s confetti sweep + a
  // short readable moment of the "Account Active" headline.
  React.useEffect(() => {
    const timer = window.setTimeout(onFinish, 2500);
    return () => window.clearTimeout(timer);
  }, [onFinish]);

  const pieces = React.useMemo(() => {
    const colors = [
      NEX.cyan,
      "#FF7200",
      "#16D66B",
      "#F23A4F",
      "#FFD700",
      "#FFFFFF",
      "#FF4FD7",
    ];
    return Array.from({ length: 56 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 56 + (Math.random() - 0.5) * 0.4;
      const distance = 110 + Math.random() * 170;
      return {
        key: i,
        color: colors[i % colors.length],
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        size: 4 + Math.random() * 7,
        rotate: Math.random() * 720 - 360,
        delay: Math.floor(Math.random() * 220),
        circle: i % 3 === 0,
      };
    });
  }, []);

  return (
    <div
      data-nex-free-chat-congrats
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(2, 9, 20, 0.68)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        pointerEvents: "auto",
      }}
    >
      <style>{`
        @keyframes nex-free-chat-confetti-fly {
          0% {
            transform: translate(-50%, -50%) rotate(0deg) scale(0.3);
            opacity: 1;
          }
          15% { opacity: 1; }
          100% {
            transform:
              translate(calc(-50% + var(--nex-dx)), calc(-50% + var(--nex-dy)))
              rotate(var(--nex-rot)) scale(1);
            opacity: 0;
          }
        }
        @keyframes nex-free-chat-congrats-pop {
          0%   { transform: scale(0.6); opacity: 0; }
          55%  { transform: scale(1.08); opacity: 1; }
          80%  { transform: scale(1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes nex-free-chat-congrats-emoji-bounce {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
      `}</style>

      {/* Confetti layer · each piece anchored at 50/50 and animates
          outward via its own translate target carried in CSS vars. */}
      {pieces.map((p) => (
        <span
          key={p.key}
          aria-hidden
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.circle ? "50%" : "2px",
            animation: `nex-free-chat-confetti-fly 1500ms ${p.delay}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...({
              "--nex-dx": `${p.dx}px`,
              "--nex-dy": `${p.dy}px`,
              "--nex-rot": `${p.rotate}deg`,
            } as React.CSSProperties),
            boxShadow: `0 0 6px -2px ${p.color}`,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Headline · pops in on top of the confetti burst */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "22px 28px",
          textAlign: "center",
          animation: "nex-free-chat-congrats-pop 650ms 100ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        <div
          style={{
            fontSize: 44,
            lineHeight: 1,
            marginBottom: 10,
            animation:
              "nex-free-chat-congrats-emoji-bounce 1200ms 650ms ease-in-out infinite",
          }}
        >
          🎉
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            color: NEX.text,
            letterSpacing: 0.3,
            textShadow: "0 2px 10px rgba(0, 0, 0, 0.65)",
          }}
        >
          Congratulations
        </h2>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 13,
            color: NEX.cyan,
            fontWeight: 800,
            letterSpacing: 1.6,
            textTransform: "uppercase",
          }}
        >
          Account Active
        </p>
      </div>
    </div>
  );
}

// ─── Invite Friends container (post-Save) ───────────────────────
//
// Owner directive 2026-10-21 (iteration 82) · after the user commits
// their setup via Save, the ChatSetupContainer unmounts and this
// InviteFriendsContainer takes its place: a short celebratory prompt
// nudging the user to share their new chat with friends. User can:
//   · tap "Invite Friends" · fires Web Share API (navigator.share) ·
//     falls back to clipboard-copy of a share URL on unsupported
//     browsers (desktop Firefox etc.) · after share OR copy succeeds,
//     the Done path advances the stage
//   · tap "Maybe later" / "Done" · dismisses without sharing
// Both paths call onDone which commits the dismiss cookie upstream.

function InviteBubbleActions({
  onDone,
}: {
  readonly onDone: () => void;
}): React.JSX.Element {
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/nex-native/free-chat`
      : "/nex-native/free-chat";
  const shareBody =
    `🌎✨ I've got something new to show you!\n\n` +
    `Come check out my new chat theme on NEX 💙🚀 Chat, explore and discover a whole new world at your fingertips!\n\n` +
    `Join me here 👇\n${shareUrl}`;

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareBody)}`;
  const imessageHref = `sms:&body=${encodeURIComponent(shareBody)}`;

  // Owner directive 2026-10-21 (iteration 92) · small-footprint
  // inline actions sitting at the bottom of the invite-nex congrats
  // bubble · 32px pill buttons for WhatsApp + iMessage + a text-link
  // Done. Fits inside the bubble without the extra panel chrome.
  return (
    <div
      data-nex-free-chat-invite-friends
      aria-label="Invite friends to NEX"
      style={{
        marginTop: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Owner directive 2026-10-21 (iteration 93) · Done text link
          retired · tapping either share pill fires onDone (dismisses
          the row + sets the cookie) so the user doesn't need a
          separate close affordance. The share link still navigates
          to its destination; onDone runs in the microtask queue so
          the navigation starts before the stage change. */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => window.setTimeout(onDone, 0)}
          aria-label="Share via WhatsApp"
          data-nex-free-chat-invite-share="whatsapp"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            minHeight: 30,
            padding: "0 10px",
            borderRadius: 999,
            background: "#25D366",
            color: "#042416",
            border: "1px solid #25D366",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.3,
            textDecoration: "none",
            fontFamily: "inherit",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <WhatsAppIcon />
          <span>WhatsApp</span>
        </a>
        <a
          href={imessageHref}
          onClick={() => window.setTimeout(onDone, 0)}
          aria-label="Share via iMessage"
          data-nex-free-chat-invite-share="imessage"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            minHeight: 30,
            padding: "0 10px",
            borderRadius: 999,
            background: "#007AFF",
            color: "#FFFFFF",
            border: "1px solid #007AFF",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.3,
            textDecoration: "none",
            fontFamily: "inherit",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <IMessageIcon />
          <span>iMessage</span>
        </a>
      </div>
    </div>
  );
}

// Removed `ShareChannelButton` (iteration 92) · the invite surface
// now renders two small inline <a> share pills directly inside the
// congrats bubble (see `InviteBubbleActions`) · the full-size
// channel-tile pattern is no longer used.

function WhatsAppIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 32 32" fill="currentColor" aria-hidden>
      <path d="M16 .3C7.4.3.4 7.3.4 15.9c0 2.8.7 5.5 2.1 7.9L.3 31.7l8.1-2.1a15.6 15.6 0 0 0 7.6 1.9c8.6 0 15.6-7 15.6-15.6S24.6.3 16 .3Zm0 28.5c-2.4 0-4.7-.6-6.8-1.9l-.5-.3-4.8 1.3 1.3-4.7-.3-.5a12.9 12.9 0 1 1 24-6.7A12.9 12.9 0 0 1 16 28.8Zm7.1-9.6c-.4-.2-2.3-1.1-2.6-1.3-.4-.1-.6-.2-.9.2-.3.4-1 1.3-1.3 1.5-.2.3-.4.3-.8.1-.4-.2-1.6-.6-3-1.9-1.1-1-1.9-2.2-2.1-2.5-.2-.4 0-.6.2-.8l.5-.6c.2-.2.2-.4.3-.6.1-.2.1-.5 0-.7l-.9-2.1c-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.4-1.1 1.1-1.1 2.7 0 1.6 1.1 3.1 1.3 3.3.2.2 2.2 3.4 5.4 4.8.8.3 1.4.5 1.8.6.8.3 1.5.2 2 .1.6-.1 2.3-.9 2.6-1.8.3-.9.3-1.6.2-1.8-.1-.2-.4-.3-.8-.4Z" />
    </svg>
  );
}

function IMessageIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 32 32" fill="currentColor" aria-hidden>
      <path d="M16 3C8.3 3 2 8.5 2 15.3c0 3.8 2 7.3 5.3 9.6V30l5-2.7c1.2.3 2.5.4 3.7.4 7.7 0 14-5.5 14-12.4C30 8.5 23.7 3 16 3Zm0 22.3c-1.3 0-2.6-.2-3.8-.5l-.3-.1-3 1.6v-3l-.2-.2c-3-1.9-4.7-4.9-4.7-8 0-5.4 5.2-9.8 11.9-9.8s12 4.4 12 9.8-5.3 10-11.9 10Z" />
    </svg>
  );
}

// Removed `NexShareIcon` (iteration 91) · NEX share chip retired per
// owner directive · WhatsApp + iMessage are the only channels now.

// ─── Picked-theme action bar (Keep / View all) ──────────────────

function PickedThemeActionBar({
  onKeep,
  onViewAll,
}: {
  readonly onKeep: () => void;
  readonly onViewAll: () => void;
}): React.JSX.Element {
  return (
    <div
      data-nex-free-chat-picked-theme-action-bar
      role="group"
      aria-label="Confirm or change chat theme"
      style={{
        marginTop: 8,
        padding: "10px 10px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        background: "rgba(2, 9, 20, 0.65)",
        border: `1px solid rgba(0, 175, 255, 0.22)`,
        borderRadius: 12,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <button
        type="button"
        onClick={onKeep}
        aria-label="Keep this theme"
        data-nex-free-chat-picked-theme-keep
        style={{
          minHeight: 40,
          padding: "0 12px",
          borderRadius: 10,
          background: NEX.cyan,
          color: "#0a0608",
          border: `1px solid ${NEX.cyan}`,
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 0.3,
          cursor: "pointer",
          fontFamily: "inherit",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        Keep Theme
      </button>
      <Link
        href="/nex-native/chat-themes-library"
        aria-label="View all chat themes"
        onClick={onViewAll}
        data-nex-free-chat-picked-theme-view-all
        style={{
          minHeight: 40,
          padding: "0 12px",
          borderRadius: 10,
          background: "transparent",
          color: NEX.text,
          border: `1px solid rgba(0, 175, 255, 0.42)`,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 0.3,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "inherit",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        View Themes
      </Link>
    </div>
  );
}

/* ─── ButterflyFlyby ──────────────────────────────────────────────
   Owner directive 2026-10-23 · "add butterfly flying in randomly on
   the screen up around the top and flying off the screen · create
   realistic butterfly wing movements and flying path".

   Mounted ONLY when active theme is theme-1 (pink moonlit cherry-
   blossom lake · the middle tile of the top row).

   Design:
   · Three butterflies, each a <Butterfly> instance with its own
     flight path keyframe + delay + duration (so they feel random,
     not synchronised).
   · Each butterfly cycles through 3 wing poses (open · angled · up)
     via opacity-swapping · ~300ms per cycle = ~10 flaps per second,
     which matches real-world butterfly wing-flap rate.
   · Flight paths stay in the top third of the frame · gentle sine-
     wave bob · enter from one edge, exit the opposite edge.
   · Pure CSS keyframes · zero JS runtime cost after mount.
   · Respects prefers-reduced-motion · pauses the wing flap +
     parks the butterfly mid-flight.

   Asset: 3 PNGs under /nex-native/butterflies/ · split + rembg-
   extracted from the owner-supplied pose reference sheet. */
const BUTTERFLY_POSES = [
  "/nex-native/butterflies/pose-1.png",
  "/nex-native/butterflies/pose-2.png",
  "/nex-native/butterflies/pose-3.png",
] as const;

function ButterflyFlyby(): React.JSX.Element {
  return (
    <>
      <style>{`
        /* Wing-flap · 3 frames at ~10fps · each frame visible for
           ~1/3 of the 300ms cycle. Runs continuously through every
           flight phase AND the perch · butterflies at rest DO flap
           their wings occasionally so this reads as "settled, still
           alive". */
        @keyframes nex-butterfly-flap-1 {
          0%, 33.33%  { opacity: 1; }
          33.34%, 100% { opacity: 0; }
        }
        @keyframes nex-butterfly-flap-2 {
          0%, 33.33%, 66.67%, 100% { opacity: 0; }
          33.34%, 66.66%            { opacity: 1; }
        }
        @keyframes nex-butterfly-flap-3 {
          0%, 66.66%, 100% { opacity: 0; }
          66.67%, 99.99%   { opacity: 1; }
        }

        /* Owner-choreographed journey 2026-10-23 · one butterfly ·
           total duration 50s · five phases.

           Phase 1 (0-32%, ~16s) · fly in SLOWLY from bottom-right ·
           random meandering path across the screen · exit on the left
           Phase 2 (32-42%, 5s) · off-screen reset ·
             butterfly invisible while repositioning top-left
           Phase 3 (42-60%, 9s) · fly back IN from top-left (hero
             position) · random path rising up to the magnifying
             glass in the header (top-right)
           Phase 4 (60-85%, ~13s) · PERCH on the magnifying glass
             (85vw, 5vh in frame-relative coordinates) · wings keep
             flapping occasionally
           Phase 5 (85-100%, ~7s) · fly OFF upward out of the screen

           Magnifying-glass perch coordinates verified against the
           sealed free-chat header: 420×909 frame · search button
           sits at ~top: 42px, right: 62px · translates to roughly
           85vw / 5vh in the butterfly's translate3d space. */
        @keyframes nex-butterfly-journey {
          /* Phase 1 · bottom-right fly-in → cross → exit left */
          0%   { transform: translate3d(110vw, 52vh, 0) rotate(2deg);  opacity: 0; }
          3%   { opacity: 1; }
          6%   { transform: translate3d(88vw,  45vh, 0) rotate(-4deg); }
          10%  { transform: translate3d(72vw,  52vh, 0) rotate(5deg);  }
          15%  { transform: translate3d(55vw,  38vh, 0) rotate(-6deg); }
          20%  { transform: translate3d(38vw,  47vh, 0) rotate(4deg);  }
          25%  { transform: translate3d(20vw,  35vh, 0) rotate(-5deg); }
          29%  { opacity: 1; }
          32%  { transform: translate3d(-18vw, 42vh, 0) rotate(3deg);  opacity: 0; }

          /* Phase 2 · off-screen reset (invisible teleport) */
          37%  { transform: translate3d(-18vw, 10vh, 0); opacity: 0; }
          41%  { transform: translate3d(-10vw, 8vh,  0); opacity: 0; }

          /* Phase 3 · top-left re-entry · random meander up to the
             magnifying-glass area */
          44%  { transform: translate3d(-2vw,  7vh,  0) rotate(-3deg); opacity: 1; }
          48%  { transform: translate3d(15vw,  12vh, 0) rotate(4deg);  }
          52%  { transform: translate3d(32vw,  6vh,  0) rotate(-5deg); }
          56%  { transform: translate3d(52vw,  10vh, 0) rotate(3deg);  }
          60%  { transform: translate3d(70vw,  6vh,  0) rotate(-2deg); }

          /* Phase 4 · arrive + PERCH on magnifying glass (85vw, 5vh) */
          63%  { transform: translate3d(82vw,  5.5vh, 0) rotate(0deg); }
          66%  { transform: translate3d(85vw,  5vh,  0) rotate(0deg);  }
          85%  { transform: translate3d(85vw,  5vh,  0) rotate(0deg);  opacity: 1; }

          /* Phase 5 · fly off upward · out of frame */
          90%  { transform: translate3d(88vw,  -2vh, 0) rotate(6deg);  opacity: 1; }
          95%  { transform: translate3d(96vw,  -14vh, 0) rotate(12deg); opacity: 0.6; }
          100% { transform: translate3d(110vw, -28vh, 0) rotate(18deg); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          [data-nex-butterfly],
          [data-nex-butterfly-frame] {
            animation: none !important;
          }
          [data-nex-butterfly] {
            /* Park at the magnifying-glass perch · wings on frame 1 */
            transform: translate3d(85vw, 5vh, 0) !important;
            opacity: 0.8 !important;
          }
          [data-nex-butterfly-frame="1"] { opacity: 1 !important; }
          [data-nex-butterfly-frame="2"],
          [data-nex-butterfly-frame="3"] { opacity: 0 !important; }
        }
      `}</style>
      {/* Owner directive 2026-10-23 · one choreographed butterfly ·
          replaces the earlier 3-butterfly staggered fleet. Full 50s
          journey · bottom-right in → exit left → top-left re-enter →
          perch on magnifying glass → fly off upward. Repeats infinite. */}
      <Butterfly size={38} delay={1} duration={50} />
    </>
  );
}

function Butterfly({
  size,
  delay,
  duration,
}: {
  readonly size: number;
  readonly delay: number;
  readonly duration: number;
}): React.JSX.Element {
  return (
    <div
      aria-hidden
      data-nex-butterfly="journey"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: size,
        height: size,
        pointerEvents: "none",
        userSelect: "none",
        zIndex: 3,
        willChange: "transform, opacity",
        animation: `nex-butterfly-journey ${duration}s cubic-bezier(0.4, 0, 0.4, 1) ${delay}s infinite`,
      }}
    >
      {BUTTERFLY_POSES.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          aria-hidden
          data-nex-butterfly-frame={i + 1}
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: i === 0 ? 1 : 0,
            willChange: "opacity",
            animation: `nex-butterfly-flap-${i + 1} 300ms steps(1, end) infinite`,
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))",
          }}
        />
      ))}
    </div>
  );
}

// ─── First-visit theme grid (2 rows × 3 columns) ─────────────────

function FirstVisitThemeGrid({
  themes,
  activeThemeId,
  onPick,
  onViewAll,
}: {
  readonly themes: ReadonlyArray<FreeChatTheme>;
  readonly activeThemeId: string | null;
  readonly onPick: (theme: FreeChatTheme) => void;
  readonly onViewAll: () => void;
}): React.JSX.Element {
  return (
    <div
      data-nex-free-chat-first-visit-row
      aria-label="Pick a chat background theme"
      style={{
        marginTop: 8,
        padding: "10px 10px 12px",
        background: "rgba(2, 9, 20, 0.55)",
        border: `1px solid rgba(0, 175, 255, 0.14)`,
        borderRadius: 12,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      {/* Owner directive 2026-10-21 (iteration 64) · "Choose Theme"
          header sits above the 5-tile grid so the picker reads as a
          deliberate call to action, not an orphaned row. Styled as a
          small eyebrow label (uppercase · cyan · tracked) matching
          the section-title convention used elsewhere in NEX chrome. */}
      <h3
        data-nex-free-chat-first-visit-title
        style={{
          margin: "0 2px 10px",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: NEX.cyan,
          lineHeight: 1,
        }}
      >
        Choose Theme
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridAutoRows: "1fr",
          gap: 8,
        }}
      >
      {/* Owner directive 2026-10-21 (iteration 63) · the active tile
          pulses with a cyan heartbeat glow via the `nex-free-chat-tile-
          heartbeat` keyframe (declared below). Inlined <style> keeps
          the animation scoped to this surface so it never affects any
          other theme-tile elsewhere in the app. */}
      <style>{`
        @keyframes nex-free-chat-tile-heartbeat {
          0%, 100% {
            box-shadow:
              0 0 0 0 rgba(0, 175, 255, 0.6),
              0 0 8px 1px rgba(0, 175, 255, 0.45);
          }
          50% {
            box-shadow:
              0 0 0 4px rgba(0, 175, 255, 0.0),
              0 0 18px 3px rgba(0, 175, 255, 0.9);
          }
        }
        [data-nex-free-chat-first-visit-tile-active="true"] {
          animation: nex-free-chat-tile-heartbeat 1400ms ease-in-out infinite;
        }
      `}</style>
      {themes.map((t) => (
        <ThemeTile
          key={t.id}
          theme={t}
          // Owner directive 2026-10-22 (afternoon) · when no theme has
          // been picked yet (activeThemeId null · first-visit state),
          // the tile flagged isDefault:true glows via the heartbeat
          // keyframe so the NEX brand tile reads as "already chosen"
          // without the user having to tap it first.
          isActive={
            activeThemeId === null
              ? t.isDefault === true
              : activeThemeId === t.id
          }
          onPress={() => onPick(t)}
        />
      ))}
      <Link
        href="/nex-native/chat-themes-library"
        aria-label="View all chat themes"
        data-nex-free-chat-first-visit-view-all
        onClick={onViewAll}
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 10,
          background: "rgba(0, 175, 255, 0.14)",
          border: `1px solid rgba(0, 175, 255, 0.42)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          textDecoration: "none",
          color: NEX.cyan,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.3,
          textTransform: "uppercase",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1 }}>⊞</span>
        <span>View</span>
      </Link>
      </div>
    </div>
  );
}

function ThemeTile({
  theme,
  isActive,
  onPress,
}: {
  readonly theme: FreeChatTheme;
  readonly isActive: boolean;
  readonly onPress: () => void;
}): React.JSX.Element {
  const hasImage = theme.wallpaperUrl !== null;
  // Owner directive 2026-10-21 (iteration 59) · three visual states:
  //   · image theme    · tile paints the wallpaper
  //   · NEX default    · tile paints the NEX navy page preview (same
  //                      colour the page reverts to) + "NEX" label +
  //                      cyan border accent so it reads as the brand
  //                      default, not an empty slot
  //   · placeholder    · black tile with the numeric label (unchanged)
  const isDefault = theme.isDefault === true;
  const background = hasImage
    ? `url("${theme.wallpaperUrl}") center / cover no-repeat, #000`
    : isDefault
    ? NEX.bg
    : "#000";
  // Owner directive 2026-10-21 (iteration 63) · active tile uses a
  // bright cyan rim at full opacity so it still reads as "selected"
  // even when the heartbeat keyframe is at the trough of its pulse.
  const border = isActive
    ? `2px solid ${NEX.cyan}`
    : isDefault
    ? `1.5px solid ${NEX.cyanSoft}`
    : `1px solid rgba(0, 175, 255, 0.28)`;
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`Apply ${theme.label}`}
      aria-pressed={isActive}
      data-nex-free-chat-first-visit-tile={theme.id}
      data-nex-free-chat-first-visit-tile-default={isDefault ? "true" : "false"}
      data-nex-free-chat-first-visit-tile-active={isActive ? "true" : "false"}
      style={{
        width: "100%",
        aspectRatio: "1 / 1",
        padding: 0,
        borderRadius: 10,
        overflow: "hidden",
        border,
        background,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: isDefault ? NEX.cyan : NEX.textDim,
        fontSize: isDefault ? 15 : 26,
        fontWeight: 800,
        letterSpacing: isDefault ? 2 : 0.5,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {isDefault && (
        <span data-nex-free-chat-first-visit-tile-default-label>NEX</span>
      )}
      {!hasImage && !isDefault && (
        <span data-nex-free-chat-first-visit-tile-placeholder>
          {theme.placeholderLabel}
        </span>
      )}
    </button>
  );
}

// ─── Delivery dot (inlined · matches live surface) ───────────────

const DELIVERY_DOT = {
  delivered: "#FF7200",
  read: "#16D66B",
} as const;

function DeliveryDot({
  status,
}: {
  status: "delivered" | "read";
}): React.JSX.Element {
  const fill = DELIVERY_DOT[status];
  return (
    <svg
      width={9}
      height={9}
      viewBox="0 0 9 9"
      aria-label={`Message ${status}`}
      data-nex-free-chat-bubble-delivery-dot={status}
    >
      <circle cx={4.5} cy={4.5} r={4} fill={fill} />
    </svg>
  );
}
