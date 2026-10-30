"use client";

// src/components/nex-native/music/MusicDescriptionAffordance.tsx
//
// Owner-authorised 2026-10-30 · the "description" affordance for the
// music post. Current design (owner directive · "remove the container
// and make the shade very little more dark · when user selects the
// bar for description can the text show on the shade cover"):
//   · A thin white bar sits just above the track-name row.
//   · Tapping the bar flips it yellow + glow and SHADES THE SHELL
//     with a slightly deeper dim. The description text itself lives
//     DIRECTLY on the shade — no frosted panel, no header label.
//   · Tap anywhere outside the text (or the yellow bar, or Escape)
//     closes the reveal.
// Shared by:
//   · the preview page (`/nex-native/create/upload-music/preview/
//     [trackId]`) — Hendra's self-view
//   · the feed music slide (`/nex-native/nex-feed/music-<id>`) —
//     any viewer when the server shell exposes the description.
//
// Pure UI · owns no business logic. Returns null when there is no
// description to show (visible absence is honest).

import * as React from "react";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

export interface MusicDescriptionAffordanceProps {
  readonly description: string | null | undefined;
  /** Owner-authorised 2026-10-30 · optional controlled-mode open
   *  state. When both are provided, the parent owns the open flag
   *  (used so the shell can suppress the Up-Next banner while the
   *  description panel is up). When omitted, falls back to internal
   *  uncontrolled state for standalone use. */
  readonly open?: boolean;
  readonly onOpenChange?: (next: boolean) => void;
}

export function MusicDescriptionAffordance(
  props: MusicDescriptionAffordanceProps,
): React.JSX.Element | null {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = props.open !== undefined;
  const open = isControlled ? props.open === true : internalOpen;
  const setOpen = React.useCallback(
    (next: boolean | ((prev: boolean) => boolean)): void => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: boolean) => boolean)(open)
          : next;
      if (isControlled) {
        props.onOpenChange?.(resolved);
      } else {
        setInternalOpen(resolved);
      }
    },
    [isControlled, props, open],
  );
  const text = (props.description ?? "").trim();
  if (text.length === 0) return null;

  // Escape key dismiss when the reveal is open.
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <>
      {/* Trigger bar · 6 px thick × 60 px wide, fully rounded ends,
          sits just above the title row. The outer <button> keeps a
          44 px tap target around the thin visible bar for a11y and
          uses pointer-events: none so the invisible margin doesn't
          intercept the scrub-dot drag. */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        data-nex-music-description-trigger
        data-nex-music-description-open={open ? "true" : "false"}
        aria-label={
          open ? "Close the description" : "Read the story behind this track"
        }
        aria-expanded={open}
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 170px)",
          // zIndex 28 keeps the bar on top of everything else so it
          // remains the one tap target that can close the reveal.
          zIndex: 28,
          pointerEvents: "none",
          width: 80,
          height: 44,
          padding: 0,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: NEX_FONT_SANS,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "block",
            width: 60,
            height: 6,
            borderRadius: 999,
            background: open ? "#FFD700" : "#FFFFFF",
            boxShadow: open
              ? "0 0 14px rgba(255, 215, 0, 0.85), 0 0 28px rgba(255, 215, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.55)"
              : "0 0 10px rgba(255, 255, 255, 0.55), 0 1px 2px rgba(0, 0, 0, 0.55)",
            transition:
              "background 180ms ease-out, box-shadow 180ms ease-out",
            pointerEvents: "auto",
          }}
        />
      </button>

      {/* Open-state reveal · the shade itself carries the text now
          (no frosted panel). Two layers:
            · Dim layer at z=22 shades the page chrome · sits BELOW
              the player so the scrub dot keeps animating.
            · Cover layer at z=26 adds a touch more darkness, holds
              the description text, and catches outside taps to
              close. */}
      {open && (
        <>
          <div
            data-nex-music-description-dim
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 22,
              background: "rgba(2, 9, 20, 0.42)",
              pointerEvents: "none",
              animation: "nex-music-desc-dim-in 180ms ease-out",
            }}
          />
          <div
            data-nex-music-description-cover
            role="dialog"
            aria-modal="true"
            aria-label="Track description"
            onClick={() => setOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 26,
              background: "rgba(2, 9, 20, 0.42)",
              fontFamily: NEX_FONT_SANS,
              animation: "nex-music-desc-cover-in 180ms ease-out",
            }}
          >
            <style>{`
              @keyframes nex-music-desc-text-in {
                0% { transform: translateY(8px); opacity: 0; }
                100% { transform: translateY(0); opacity: 1; }
              }
              @keyframes nex-music-desc-dim-in {
                0% { background: rgba(2, 9, 20, 0); }
                100% { background: rgba(2, 9, 20, 0.42); }
              }
              @keyframes nex-music-desc-cover-in {
                0% { background: rgba(2, 9, 20, 0); }
                100% { background: rgba(2, 9, 20, 0.42); }
              }
            `}</style>
            <div
              data-nex-music-description-text
              onClick={(e) => e.stopPropagation()}
              style={{
                // Owner directive 2026-10-30 · "we allow from 25 px
                // under header text start down to position now end
                // of text · this amount of text is max · never
                // scrolling". Fixed box: 25 px padding at the top
                // for breathing space · same left/right rails as
                // before · overflow: hidden means overflowing text
                // simply clips (no scrollbar). "This amount of text
                // is max" = whatever fits in the 260 px window.
                position: "absolute",
                left: 25,
                right: 65,
                bottom: "calc(env(safe-area-inset-bottom, 0px) + 218px)",
                maxHeight: 260,
                paddingTop: 25,
                overflow: "hidden",
                color: "#F0F6FF",
                fontSize: 13,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                textShadow:
                  "0 1px 2px rgba(0, 0, 0, 0.9), 0 0 10px rgba(0, 0, 0, 0.55)",
                animation:
                  "nex-music-desc-text-in 220ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {text}
            </div>
          </div>
        </>
      )}
    </>
  );
}
