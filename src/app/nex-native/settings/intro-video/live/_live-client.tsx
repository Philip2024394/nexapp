"use client";

// src/app/nex-native/settings/intro-video/live/_live-client.tsx
//
// NEX · My Intro Video · live preview client · owner-authorised
// 2026-10-20.
// -----------------------------------------------------------------------------
// Full-screen playback of the user's saved intro · composes the SAME
// sealed TitleOverlay + OpeningHoursOverlay primitives the editor's
// in-page preview uses (exported from
// src/app/nex-native/settings/intro-video/_intro-video-client.tsx)
// so the "live" view is byte-identical to what the editor shows ·
// no drift, one source of truth.
//
// Behaviour:
//   · Video autoplays once (loop OFF · we want the dry-run to end).
//   · On `ended` OR Skip tap → router.push("/nex-native/profile/me").
//   · If the user has NO video but has a wallpaper, the wallpaper
//     shows for ~3s as a static scrim (same hero gradient pattern
//     the editor uses when video_url is null) then auto-advances.
//   · Skip button sits top-right · cyan-outlined rounded chip ·
//     always visible so the user never feels trapped.

import * as React from "react";
import { useRouter } from "next/navigation";
import type {
  IntroSettings,
  IntroTitlePosition,
} from "@/lib/nex-native/intro-settings-service";
import {
  TitleOverlay,
  segmentsToAttrs,
  type CharAttr,
} from "../_intro-video-client";
import type {
  IntroOverlayFontId,
  IntroOverlaySizeId,
} from "../_overlay-fonts";

const NEX = {
  bg: "#020914",
  cyan: "#00AFFF",
  textPrimary: "#F2F5F8",
  textMute: "#7D9BC0",
};

/** Fallback-advance duration when there's no video to play (wallpaper
 *  only). Owner directive 2026-10-20 · "visitor should see something
 *  that doesn't trap them · 3s is enough to register the wallpaper
 *  then move on to the profile." */
const NO_VIDEO_ADVANCE_MS = 3000;

const DEFAULT_TITLE_FONT: IntroOverlayFontId = "classic";
const DEFAULT_TITLE_SIZE: IntroOverlaySizeId = "m";
const DEFAULT_TITLE_COLOR = "#FFFFFF";
const DEFAULT_TITLE_ALIGN: "left" | "center" | "right" = "center";
const DEFAULT_TITLE_POSITION: IntroTitlePosition = "hero";

export function LiveIntroClient({
  intro,
  destinationHref,
}: {
  intro: IntroSettings;
  /** Owner directive 2026-10-20 · after the intro plays, land on the
   *  user's current chat theme preview · the full visitor experience
   *  (intro + chat). Server resolves this from `nex_account.chat_theme`
   *  with a /chat inbox fallback when no active theme is set. */
  destinationHref: string;
}): React.JSX.Element {
  const router = useRouter();
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const dismissedRef = React.useRef(false);

  const dismiss = React.useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    router.push(destinationHref);
  }, [router, destinationHref]);

  // No-video advance timer · only fires when there's a wallpaper
  // but no video_url to drive the `ended` event.
  React.useEffect(() => {
    if (intro.video_url) return;
    const id = window.setTimeout(() => dismiss(), NO_VIDEO_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [intro.video_url, dismiss]);

  const titleText = (intro.title_text ?? "").trim();
  // Convert the stored segments back into the per-character attrs
  // array the sealed TitleOverlay primitive consumes · fail-soft when
  // segments are null (no segment customisation · one global style).
  const titleAttrs: CharAttr[] = React.useMemo(
    () => segmentsToAttrs(intro.title_segments, titleText),
    [intro.title_segments, titleText],
  );

  const fontId = (intro.title_font ?? DEFAULT_TITLE_FONT) as IntroOverlayFontId;
  const sizeId = (intro.title_size ?? DEFAULT_TITLE_SIZE) as IntroOverlaySizeId;
  const color = intro.title_color ?? DEFAULT_TITLE_COLOR;
  const align = (intro.title_align ?? DEFAULT_TITLE_ALIGN) as
    | "left"
    | "center"
    | "right";
  const position: IntroTitlePosition =
    intro.title_position ?? DEFAULT_TITLE_POSITION;

  return (
    <main
      data-nex-intro-video-live
      style={{
        /* Owner directive 2026-10-20 · overlay respects the phone-
           frame container on desktop rather than escaping to full
           viewport. On mobile viewport = frame so the visual output
           is identical. Matches the sealed theme-preview pattern. */
        position: "absolute",
        inset: 0,
        background: NEX.bg,
        color: NEX.textPrimary,
        overflow: "hidden",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "stretch",
      }}
    >
      {/* 1 · Backdrop · wallpaper first (so even without video the
            visitor sees the user's chosen background), then the
            video layers on top. */}
      {intro.wallpaper_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={intro.wallpaper_url}
          alt=""
          data-nex-intro-video-live-wallpaper
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            pointerEvents: "none",
          }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(0,175,255,0.18), rgba(2,9,20,0.95))",
          }}
        />
      )}

      {/* 2 · Video · autoplay, muted (browsers block audio on autoplay
            without a gesture · consistent with the editor preview),
            `onEnded` dismisses to /profile/me. */}
      {intro.video_url ? (
        <video
          ref={videoRef}
          src={intro.video_url}
          autoPlay
          muted
          playsInline
          onEnded={dismiss}
          data-nex-intro-video-live-video
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : null}

      {/* 3 · Title overlay · reuses the exact same primitive the
            editor's preview panel uses. */}
      {titleText.length > 0 && (
        <TitleOverlay
          text={titleText}
          attrs={titleAttrs}
          position={position}
          fontId={fontId}
          sizeId={sizeId}
          color={color}
          align={align}
          highlight={intro.title_highlight}
        />
      )}

      {/* 4 · Skip chip · top-right · cyan outlined · small corner
            rounds matching the editor footer buttons. Always visible
            so a user can bail at any time. */}
      <button
        type="button"
        onClick={dismiss}
        data-nex-intro-video-live-skip
        aria-label="Skip intro"
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0) + 14px)",
          right: 14,
          padding: "8px 14px",
          borderRadius: 12,
          border: `1.5px solid ${NEX.cyan}`,
          background: "rgba(2, 9, 20, 0.6)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          color: NEX.cyan,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: "pointer",
          fontFamily: "inherit",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          zIndex: 20,
        }}
      >
        Skip
        <span aria-hidden style={{ fontSize: 10 }}>▸</span>
      </button>
    </main>
  );
}
