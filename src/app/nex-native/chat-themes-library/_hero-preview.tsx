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
  /** Owner directive 2026-11-11 · optional black-overlay opacity on
   *  the wallpaper (0–1). The preview modal exposes this via a scale
   *  bar under the phone so the user can judge how the theme reads at
   *  different shade levels before applying. */
  readonly wallpaperDarken?: number;
  /** Optional aspect-ratio override for the device · lets the preview
   *  modal render a shorter phone silhouette than the sealed 9/18
   *  entry-page shape. */
  readonly aspectRatio?: string;
}

export function HeroPreview({
  theme,
  maxWidthCss,
  wallpaperDarken = 0,
  aspectRatio,
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
          aspectRatio: aspectRatio ?? "9 / 18",
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
          {/* Owner directive 2026-11-11 · darken overlay driven by the
              preview scale bar · live-previews how the theme reads at
              varying shade levels before the user applies it. */}
          {wallpaperDarken > 0 ? (
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background: `rgba(0, 0, 0, ${Math.min(1, Math.max(0, wallpaperDarken))})`,
                zIndex: 0,
                pointerEvents: "none",
              }}
            />
          ) : null}
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

          {/* Overlay header · owner directive 2026-11-11 · mirrors the
              sealed FreeChatHeader shape. 48px avatar slot carrying a
              NexPingBadge-style ring (2px gold rim · soft pulse halo
              when "online"), portrait avatar overlaid at 42×42 inside
              the rim · name + "online" subtitle · ⋯ on the right. */}
          <header
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "28px 12px 10px",
              color: INK,
            }}
          >
            {/* Owner directive 2026-11-11 · all theme-preview pings use
                GREEN rim + GREEN pulse + GREEN inside (no-avatar state).
                Mirrors the sealed presence-online colour used across the
                live chat surfaces. */}
            <span
              aria-hidden
              data-nex-hero-preview-ping
              style={{
                position: "relative",
                width: 48,
                height: 48,
                flexShrink: 0,
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  inset: -3,
                  borderRadius: "50%",
                  border: "2px solid #16D66B",
                  opacity: 0.55,
                  animation: "nex-hero-ping 1.8s ease-out infinite",
                }}
              />
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "2px solid #16D66B",
                  background: "rgba(22, 214, 107, 0.2)",
                  boxShadow: "0 0 12px rgba(22, 214, 107, 0.55)",
                }}
              />
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: 3,
                  left: 3,
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle at 35% 30%, #16D66B 0%, #0F9B4E 60%, #05311A 100%)",
                  color: INK,
                  fontSize: 15,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textShadow: "0 1px 2px rgba(0,0,0,0.65)",
                }}
              >
                S
              </span>
            </span>
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
          <style>{`
            @keyframes nex-hero-ping {
              0%   { transform: scale(1);   opacity: 0.55; }
              70%  { transform: scale(1.35); opacity: 0;    }
              100% { transform: scale(1.35); opacity: 0;    }
            }
          `}</style>

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
            {/* Peer bubble · owner directive 2026-11-11 · includes HH:MM
                timestamp pinned bottom-right (matches the sealed standard
                bubble in chat-standard/_surfaces/_bubble.tsx). */}
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  maxWidth: "78%",
                  padding: "8px 11px 6px",
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
                <div>Fancy a cup of tea?</div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    fontSize: 9,
                    opacity: 0.7,
                    marginTop: 2,
                    letterSpacing: "0.02em",
                  }}
                >
                  09:42
                </div>
              </div>
            </div>
            {/* Owner bubble · owner directive 2026-11-11 · black-tinted
                smoked glass so the user's own bubble is visually distinct
                from the peer's accent-tinted bubble. */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div
                style={{
                  maxWidth: "78%",
                  padding: "8px 11px 6px",
                  borderRadius: 16,
                  borderBottomRightRadius: 4,
                  background: "rgba(0, 0, 0, 0.42)",
                  border: `1px solid color-mix(in srgb, ${ACCENT} 55%, transparent)`,
                  color: INK,
                  fontSize: 12,
                  lineHeight: 1.4,
                  backdropFilter: "blur(8px) saturate(140%)",
                  WebkitBackdropFilter: "blur(8px) saturate(140%)",
                  boxShadow: "0 4px 10px -6px rgba(0,0,0,0.6)",
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
                }}
              >
                <div>Grand, I&apos;ll put the kettle on.</div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 9,
                    opacity: 0.85,
                    marginTop: 2,
                    letterSpacing: "0.02em",
                  }}
                >
                  <span>09:43</span>
                  <span
                    aria-hidden
                    style={{
                      display: "inline-flex",
                      color: ACCENT,
                      fontSize: 11,
                      lineHeight: 1,
                      letterSpacing: "-0.25em",
                      paddingRight: "0.25em",
                      fontWeight: 700,
                    }}
                  >
                    ✓✓
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Composer footer · owner directive 2026-11-11 · no footer
              container · composer floats directly on the wallpaper.
              Matches the real NEX free-chat composer architecture. */}
          <footer
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding:
                "6px 8px calc(env(safe-area-inset-bottom, 0px) + 10px)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#FF7200",
                border: "1px solid #FF7200",
                color: "#FFFFFF",
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 300,
                lineHeight: 1,
                boxShadow: "0 2px 8px rgba(255, 114, 0, 0.35)",
              }}
            >
              +
            </span>
            <div
              style={{
                position: "relative",
                flex: 1,
                minWidth: 0,
                height: 28,
                padding: "0 36px 0 32px",
                borderRadius: 999,
                // Owner directive 2026-11-11 · slight tinted-black pill ·
                // soft smoked-glass over any wallpaper, works on both
                // bright and dark themes.
                background: "rgba(0, 0, 0, 0.22)",
                backdropFilter: "blur(8px) saturate(140%)",
                WebkitBackdropFilter: "blur(8px) saturate(140%)",
                border: "1px solid rgba(212, 162, 79, 0.42)",
                color: "rgba(255, 255, 255, 0.82)",
                fontSize: 11,
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                textShadow: "0 1px 2px rgba(0,0,0,0.6)",
              }}
            >
              {/* Emoji icon · real sealed asset used by the live chat
                  composer (/nex-free-chat/composer-emoji.png) · owner
                  directive 2026-11-11 · evoke the actual live chat
                  emoji, not a stand-in. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/nex-free-chat/composer-emoji.png"
                alt=""
                aria-hidden
                draggable={false}
                style={{
                  position: "absolute",
                  left: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 24,
                  height: 24,
                  objectFit: "contain",
                  pointerEvents: "none",
                }}
              />
              <span style={{ opacity: 0.75 }}>Say something…</span>
              {/* Orange round send · inside the pill on the right */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  right: 2,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "#FF7200",
                  color: "#FFFFFF",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  boxShadow: "0 2px 6px rgba(255,114,0,0.45)",
                }}
              >
                →
              </span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
