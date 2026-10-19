"use client";

// src/app/nex-native/chat-standard/_surfaces/_emoji-sticker-picker.tsx
//
// Phase 2A.0 · Standard emoji + sticker picker surface.
//
// Two tabs: Emoji + Stickers. Both read their visual treatment from
// the engine. Stickers are rendered by the engine's SVG generator
// unless the theme supplies explicit URLs.
//
// Universal functionality: pick an emoji → onPickEmoji(glyph);
// pick a sticker → onPickSticker(slug). Caller decides what sending
// means.

import * as React from "react";
import type { ResolvedEngine } from "../_engine/theme-engine";

const BASE_EMOJI = [
  "😀",
  "😂",
  "🥹",
  "😍",
  "🤯",
  "😎",
  "🤔",
  "👍",
  "❤️",
  "🫧",
  "🌊",
  "🐚",
  "🐟",
  "✨",
  "🙌",
  "🔥",
];

export interface StandardPickerThemeEmoji {
  slug: string;
  imageUrl: string;
  label: string;
}
export interface StandardPickerThemeSticker {
  slug: string;
  imageUrl: string;
  label: string;
  stickerType: string;
  aspectRatio: number;
}

export interface StandardEmojiStickerPickerProps {
  engine: ResolvedEngine;
  onPickEmoji: (glyph: string) => void;
  onPickSticker: (slug: string) => void;
  /** Owner directive 2026-10-19 · when provided and non-empty the
   *  emoji tab renders image-based tiles (sourced from
   *  nex_theme_emoji rows or the filesystem fallback in
   *  theme-asset-fallback.ts). Picking fires onPickEmoji with the
   *  slug wrapped as `[emoji:<slug>]` so the message body carries
   *  the asset reference instead of a bare Unicode glyph · peer
   *  surfaces that know how to render `[emoji:…]` paint the image
   *  inline. When empty, the sealed Unicode BASE_EMOJI array
   *  renders exactly as before. */
  themeEmojis?: readonly StandardPickerThemeEmoji[];
  /** Same model for stickers · when non-empty, the Stickers tab
   *  paints the image URLs instead of the engine's SVG generator
   *  slugs. */
  themeStickers?: readonly StandardPickerThemeSticker[];
}

export function StandardEmojiStickerPicker({
  engine,
  onPickEmoji,
  onPickSticker,
  themeEmojis,
  themeStickers,
}: StandardEmojiStickerPickerProps): React.JSX.Element {
  const [tab, setTab] = React.useState<"emoji" | "stickers">("emoji");
  const emoji = engine.emojiTreatment();
  const stickers = engine.stickerTreatment();
  const colours = engine.colours;

  return (
    <div
      data-nex-se-emoji-sticker-picker
      style={{
        padding: 10,
        borderRadius: 14,
        background: `rgba(2,9,20,0.72)`,
        border: `1px solid ${colours.primary}66`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <TabButton
          label="Emoji"
          active={tab === "emoji"}
          accent={colours.primary}
          onClick={() => setTab("emoji")}
        />
        <TabButton
          label="Stickers"
          active={tab === "stickers"}
          accent={colours.primary}
          onClick={() => setTab("stickers")}
        />
      </div>
      {tab === "emoji" ? (
        themeEmojis && themeEmojis.length > 0 ? (
          /* Owner directive 2026-10-19 · image-based tiles · one
             button per DB/fallback row. Picking fires onPickEmoji
             with `[emoji:<slug>]` so a later peer-chat consumer can
             paint the image inline. In this preview the handler
             appends the token to the composer text as a placeholder
             · behaviour mirrors the Unicode path's "insert glyph". */
          <div
            data-nex-se-picker-mode="image"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(auto-fill, minmax(${emoji.tileSize + 12}px, 1fr))`,
              gap: 6,
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {themeEmojis.map((e) => (
              <button
                key={e.slug}
                type="button"
                onClick={() => onPickEmoji(`[emoji:${e.slug}]`)}
                aria-label={e.label || `Pick ${e.slug}`}
                title={e.label || e.slug}
                data-nex-se-picker-emoji-slug={e.slug}
                style={{
                  padding: 4,
                  background: emoji.tileStyle.background,
                  border: `1px solid ${colours.primary}33`,
                  borderRadius: emoji.tileStyle.borderRadius ?? 10,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  aspectRatio: "1 / 1",
                }}
              >
                <img
                  src={e.imageUrl}
                  alt={e.label || e.slug}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </button>
            ))}
          </div>
        ) : (
          <div
            data-nex-se-picker-mode="unicode"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(auto-fill, minmax(${emoji.tileSize + 8}px, 1fr))`,
              gap: 6,
              maxHeight: 180,
              overflowY: "auto",
            }}
          >
            {BASE_EMOJI.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onPickEmoji(g)}
                aria-label={`Pick ${g}`}
                style={{
                  ...emoji.tileStyle,
                  background: emoji.tileStyle.background,
                  border: emoji.tileStyle.border,
                  boxShadow: emoji.tileStyle.boxShadow,
                  borderRadius: emoji.tileStyle.borderRadius,
                  cursor: "pointer",
                  fontSize: Math.round(emoji.tileSize * 0.55),
                  padding: 0,
                  color: colours.highlight,
                  filter: emoji.colorFilter ?? undefined,
                  animation: emoji.pickAnimation
                    ? `${emoji.pickAnimation} 240ms ease-out`
                    : undefined,
                }}
              >
                {g}
              </button>
            ))}
          </div>
        )
      ) : themeStickers && themeStickers.length > 0 ? (
        /* Owner directive 2026-10-19 · image-based stickers from DB
           / fallback. When present they win over the engine's SVG
           generator so uploaded sticker art replaces the generic
           procedural set. */
        <div
          data-nex-se-picker-mode="image"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
            gap: 8,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {themeStickers.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => onPickSticker(s.slug)}
              aria-label={s.label || `Send ${s.slug} sticker`}
              title={s.label || s.slug}
              data-nex-se-picker-sticker-slug={s.slug}
              style={{
                padding: 6,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${colours.primary}22`,
                borderRadius: 10,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
              }}
            >
              <img
                src={s.imageUrl}
                alt={s.label || s.slug}
                style={{
                  width: "100%",
                  height: 60,
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </button>
          ))}
        </div>
      ) : (
        <div
          data-nex-se-picker-mode="svg"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
            gap: 8,
            maxHeight: 180,
            overflowY: "auto",
          }}
        >
          {stickers.slugs.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => onPickSticker(slug)}
              aria-label={`Send ${slug} sticker`}
              style={{
                padding: 6,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${colours.primary}22`,
                borderRadius: 10,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
              }}
            >
              {stickers.render(slug, 56)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  label,
  active,
  accent,
  onClick,
}: {
  label: string;
  active: boolean;
  accent: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        background: active ? `${accent}33` : "transparent",
        border: `1px solid ${active ? accent : "rgba(255,255,255,0.1)"}`,
        color: active ? "#fff" : "rgba(255,255,255,0.6)",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
