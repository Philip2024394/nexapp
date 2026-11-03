// src/app/nex-native/chat-themes-library/_hero-preview.tsx
//
// NEX Chat Themes Library · hero phone-frame preview.
// Owner-authorised 2026-11-03 (revision 2 · no glass bars · overlay
// elements float directly on the wallpaper to match the sealed
// /nex-native/free-chat overlay look).
// -----------------------------------------------------------------------------
// A compact device-mockup showing the actively-selected theme in a
// chat context. The avatar + name header AND the composer pill sit
// DIRECTLY on the wallpaper · no full-width glass gradient bars ·
// mirrors the real free-chat page (which removed its own header
// backdrop blur per the 2026-10-21 iteration-32 directive).
//
// Colours route through `--nex-world-*` CSS variables · on Ireland
// the accent reads Gold, Worldwide / Indonesia inherit NEX cyan.

"use client";

import * as React from "react";
import type { LibraryTheme } from "./_catalog";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const ACCENT = "var(--nex-world-secondary, #C6A15B)";
const PRIMARY = "var(--nex-world-primary, #123D2B)";
const FRAME_BEZEL = "rgba(10, 14, 22, 0.95)";
const COMPOSER_BG = "rgba(2, 20, 15, 0.72)";

export interface HeroPreviewProps {
  readonly theme: LibraryTheme;
  /** Optional CSS width expression · lets callers constrain the
   *  device by viewport height too (e.g. the full-screen Preview
   *  modal, which shrinks the phone when the viewport is short so
   *  the Buy footer never pushes it off-screen). Default keeps the
   *  sealed entry-page sizing. */
  readonly maxWidthCss?: string;
}

export function HeroPreview({
  theme,
  maxWidthCss,
}: HeroPreviewProps): React.JSX.Element {
  const widthCss = maxWidthCss ?? "min(78vw, 300px)";
  return (
    <div
      data-nex-library-hero
      style={{
        display: "flex",
        justifyContent: "center",
        paddingTop: 4,
      }}
    >
      <div
        data-nex-library-hero-device
        style={{
          position: "relative",
          width: widthCss,
          aspectRatio: "9 / 18",
          borderRadius: 36,
          padding: 6,
          background: FRAME_BEZEL,
          boxShadow:
            "0 24px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.06)",
        }}
      >
        {/* Screen · rounded display inside the bezel. Owner directive
            2026-11-03 · wallpaper rendered via <img object-fit:cover>
            inside the overflow-hidden clip so corners are pixel-clean
            at every border-radius · no seam between the image and the
            bezel. */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: 30,
            overflow: "hidden",
            backgroundColor: "#000",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={theme.wallpaperUrl}
            alt=""
            aria-hidden
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              zIndex: 0,
            }}
          />
          {/* Status notch · minimal pill */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 6,
              left: "50%",
              transform: "translateX(-50%)",
              width: 70,
              height: 14,
              borderRadius: 7,
              background: "rgba(0, 0, 0, 0.75)",
              zIndex: 2,
            }}
          />

          {/* Overlay header · floats directly on the wallpaper · no
              glass bar · avatar + name + subtitle only. Matches the
              sealed /nex-native/free-chat header (iteration 32 removed
              the panel bg + backdrop blur + bottom border there too).
              position:relative + zIndex:1 keeps chrome above the
              z-index:0 wallpaper <img> below. */}
          <header
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "28px 12px 10px",
              color: INK,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${PRIMARY}, ${ACCENT})`,
                border: `2px solid ${ACCENT}`,
                flexShrink: 0,
                boxShadow: `0 0 10px color-mix(in srgb, ${ACCENT} 45%, transparent)`,
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  color: INK,
                  textShadow: "0 1px 3px rgba(0, 0, 0, 0.75)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Siobhán
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: INK_DIM,
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.75)",
                }}
              >
                online
              </p>
            </div>
            <span
              aria-hidden
              style={{
                fontSize: 20,
                color: INK,
                lineHeight: 1,
                textShadow: "0 1px 3px rgba(0, 0, 0, 0.75)",
              }}
            >
              ⋯
            </span>
          </header>

          {/* Bubble stream · one peer, one self · bottom-anchored */}
          <section
            style={{
              position: "relative",
              zIndex: 1,
              flex: 1,
              padding: "12px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              justifyContent: "flex-end",
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  maxWidth: "78%",
                  padding: "8px 11px",
                  borderRadius: 16,
                  borderBottomLeftRadius: 4,
                  background: `color-mix(in srgb, ${ACCENT} 14%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${ACCENT} 45%, transparent)`,
                  color: INK,
                  fontSize: 12,
                  lineHeight: 1.4,
                  backdropFilter: "blur(8px) saturate(140%)",
                  WebkitBackdropFilter: "blur(8px) saturate(140%)",
                  boxShadow: "0 4px 10px -6px rgba(0,0,0,0.6)",
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
                }}
              >
                Fancy a cup of tea?
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div
                style={{
                  maxWidth: "78%",
                  padding: "8px 11px",
                  borderRadius: 16,
                  borderBottomRightRadius: 4,
                  background: `color-mix(in srgb, ${ACCENT} 18%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${ACCENT} 72%, transparent)`,
                  color: INK,
                  fontSize: 12,
                  lineHeight: 1.4,
                  backdropFilter: "blur(8px) saturate(140%)",
                  WebkitBackdropFilter: "blur(8px) saturate(140%)",
                  boxShadow: "0 4px 10px -6px rgba(0,0,0,0.6)",
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
                }}
              >
                Grand, I&apos;ll put the kettle on.
              </div>
            </div>
          </section>

          {/* Composer footer · single floating pill · no full-width
              glass bar · matches the sealed ChatComposerPill shape
              (translucent navy pill + accent rim + round send). */}
          <footer
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px calc(env(safe-area-inset-bottom, 0px) + 10px)",
            }}
          >
            <div
              style={{
                flex: 1,
                minHeight: 36,
                padding: "7px 14px",
                borderRadius: 18,
                background: COMPOSER_BG,
                border: `1px solid color-mix(in srgb, ${ACCENT} 55%, transparent)`,
                color: INK_DIM,
                fontSize: 11,
                lineHeight: 1.3,
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
                display: "flex",
                alignItems: "center",
                boxShadow: `0 0 10px color-mix(in srgb, ${ACCENT} 20%, transparent)`,
              }}
            >
              Type a message…
            </div>
            <button
              type="button"
              aria-label="Send"
              disabled
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: ACCENT,
                color: "#0a1a0a",
                border: "none",
                cursor: "default",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                fontWeight: 800,
                boxShadow: `0 0 14px color-mix(in srgb, ${ACCENT} 55%, transparent)`,
              }}
            >
              →
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
