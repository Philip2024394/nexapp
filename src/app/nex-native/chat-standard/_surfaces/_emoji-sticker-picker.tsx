"use client";

// src/app/nex-native/chat-standard/_surfaces/_emoji-sticker-picker.tsx
//
// NEX unified library picker · owner-authorised 2026-10-19.
// -----------------------------------------------------------------------------
// Four-tab surface shared across every chat theme:
//
//   · Emoji   · Unicode base set + the FULL cross-theme image emoji
//                pool (owner directive · "one great library and same
//                for all chat themes" · merged via
//                `getAllBuiltInEmoji()` in theme-asset-fallback.ts).
//   · Stickers· The FULL cross-theme image sticker pool.
//   · GIFS    · NEX-shipped GIF library · served from
//                /public/nex-chat/gif/ · zero third-party network calls.
//   · Files   · Recently sent files (from `nex:picker-mru:file`) +
//                a "Pick new file" button.
//
// Each tab has:
//   · Search input at top (debounced for Giphy · live-filter for
//     local catalogs).
//   · Recent section at top · reads from the per-category MRU store.
//   · Full list below.
//   · Close × button (unchanged from the previous iteration).
//
// Picking an item fires the appropriate callback AND pushes to the
// MRU store so it climbs to the top of the recent list on next open.

import * as React from "react";
import type { ResolvedEngine } from "../_engine/theme-engine";
import {
  getAllBuiltInEmoji,
  getAllBuiltInStickers,
  emojiMatchesKeyword,
  emojiIsYellow,
} from "@/lib/nex-native/theme-asset-fallback";
import {
  pushRecent,
  readRecent,
  type PickerCategory,
} from "./_picker-mru";
import {
  trendingGifs,
  searchGifs,
  type GiphyGif,
} from "./_picker-giphy";

/* BASE_EMOJI Unicode fallback set retired 2026-10-19 · owner
 * directive · "remove the unicode stickers from emoji Unicode" · the
 * Emoji tab now shows only the cross-theme image emoji pool. */

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

/** Recently-sent-file metadata · the owner of the picker (the
 *  parent chat surface) is the one that KNOWS what's been sent, so
 *  it passes this list in via `recentFiles`. Having the parent own
 *  it means the picker doesn't need to parse past messages itself. */
export interface StandardPickerRecentFile {
  id: string;
  name: string;
  mime: string;
  /** Blob/HTTP URL · in preview mode this is a `blob:` URL from
   *  `URL.createObjectURL` · in prod it's the final storage URL. */
  previewUrl: string;
  sentAtMs: number;
}

export interface StandardEmojiStickerPickerProps {
  engine: ResolvedEngine;
  onPickEmoji: (glyph: string) => void;
  onPickSticker: (slug: string) => void;
  onPickThemeEmoji?: (emoji: StandardPickerThemeEmoji) => void;
  onPickThemeSticker?: (sticker: StandardPickerThemeSticker) => void;
  /** Owner directive 2026-10-19 · emitted when a Giphy GIF is picked.
   *  Parent encodes it as a message body (e.g. `[giphy:<id>|<url>|<ar>]`)
   *  and the bubble renderer paints it inline. */
  onPickGiphy?: (gif: GiphyGif) => void;
  /** Fires when the user picks a brand-new file via the Files tab's
   *  device picker · the parent stages it in `pendingAttachments` the
   *  same way the 3-dot menu's file picker does. */
  onPickFiles?: (files: FileList) => void;
  /** Fires when the user re-sends a previously staged file from the
   *  Files tab's recents list · parent re-stages it. */
  onPickRecentFile?: (file: StandardPickerRecentFile) => void;
  recentFiles?: readonly StandardPickerRecentFile[];
  themeEmojis?: readonly StandardPickerThemeEmoji[];
  themeStickers?: readonly StandardPickerThemeSticker[];
  onClose?: () => void;
  /** Owner directive 2026-10-19 · surfaces like the intro-video title
   *  settings don't need the Files tab (plain text input only). Pass
   *  `showFilesTab={false}` to hide the tab + prevent switching to it.
   *  Defaults to true for the chat composer where files are relevant. */
  showFilesTab?: boolean;
  /** Owner directive 2026-10-19 · intro-video overlay only accepts
   *  emoji (slug tokens rendered as inline images). Pass
   *  `showStickersTab={false}` to hide the Stickers tab. Defaults to
   *  true for the chat composer. */
  showStickersTab?: boolean;
  /** Owner directive 2026-10-19 · intro-video overlay only accepts
   *  emoji. Pass `showGiphyTab={false}` to hide the GIFS tab.
   *  Defaults to true for the chat composer. */
  showGiphyTab?: boolean;
}

type Tab = "emoji" | "sticker" | "giphy" | "file";

export function StandardEmojiStickerPicker({
  engine,
  onPickEmoji,
  onPickSticker,
  onPickThemeEmoji,
  onPickThemeSticker,
  onPickGiphy,
  onPickFiles,
  onPickRecentFile,
  recentFiles,
  themeEmojis,
  themeStickers,
  onClose,
  showFilesTab = true,
  showStickersTab = true,
  showGiphyTab = true,
}: StandardEmojiStickerPickerProps): React.JSX.Element {
  const [tab, setTab] = React.useState<Tab>("emoji");
  const [query, setQuery] = React.useState("");
  const emoji = engine.emojiTreatment();
  const colours = engine.colours;

  // ─── Universal catalogs · owner directive · "same for all chat
  // themes". The picker always shows the cross-theme pool · a theme
  // that supplies its own `themeEmojis` prop effectively adds that
  // set on top (via the normal override, kept for backward compat).
  const universalEmoji = React.useMemo(() => getAllBuiltInEmoji(), []);
  const universalStickers = React.useMemo(() => getAllBuiltInStickers(), []);

  const allEmoji: StandardPickerThemeEmoji[] = React.useMemo(() => {
    const seen = new Set<string>();
    const result: StandardPickerThemeEmoji[] = [];
    for (const e of universalEmoji) {
      if (seen.has(e.slug)) continue;
      seen.add(e.slug);
      result.push({ slug: e.slug, imageUrl: e.image_url, label: e.label });
    }
    for (const e of themeEmojis ?? []) {
      if (seen.has(e.slug)) continue;
      seen.add(e.slug);
      result.push(e);
    }
    return result;
  }, [universalEmoji, themeEmojis]);

  const allStickers: StandardPickerThemeSticker[] = React.useMemo(() => {
    const seen = new Set<string>();
    const result: StandardPickerThemeSticker[] = [];
    for (const s of universalStickers) {
      if (seen.has(s.slug)) continue;
      seen.add(s.slug);
      result.push({
        slug: s.slug,
        imageUrl: s.image_url,
        label: s.label,
        stickerType: s.sticker_type,
        aspectRatio: s.aspect_ratio,
      });
    }
    for (const s of themeStickers ?? []) {
      if (seen.has(s.slug)) continue;
      seen.add(s.slug);
      result.push(s);
    }
    return result;
  }, [universalStickers, themeStickers]);

  // ─── MRU per tab · re-read on tab change so a pick registered in
  // one open session surfaces at top the next time the tab opens.
  const [recentEmoji, setRecentEmoji] = React.useState<string[]>([]);
  const [recentSticker, setRecentSticker] = React.useState<string[]>([]);
  const [recentGiphy, setRecentGiphy] = React.useState<string[]>([]);
  React.useEffect(() => {
    setRecentEmoji(readRecent("emoji"));
    setRecentSticker(readRecent("sticker"));
    setRecentGiphy(readRecent("giphy"));
  }, [tab]);

  const recordPick = React.useCallback(
    (category: PickerCategory, identity: string) => {
      pushRecent(category, identity);
      /* Mirror into the local state so the user sees the pick jump
         to the top immediately (next open re-reads from storage). */
      if (category === "emoji")
        setRecentEmoji((prev) => [
          identity,
          ...prev.filter((v) => v !== identity),
        ]);
      else if (category === "sticker")
        setRecentSticker((prev) => [
          identity,
          ...prev.filter((v) => v !== identity),
        ]);
      else if (category === "giphy")
        setRecentGiphy((prev) => [
          identity,
          ...prev.filter((v) => v !== identity),
        ]);
    },
    [],
  );

  // ─── Giphy state (lazy-loaded on tab open) ────────────────────────
  const [gifs, setGifs] = React.useState<GiphyGif[]>([]);
  const [giphyLoading, setGiphyLoading] = React.useState(false);
  const giphyAbortRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => {
    if (tab !== "giphy") return;
    // trendingGifs/searchGifs serve the NEX built-in GIF library only ·
    // zero external network calls.
    const run = async () => {
      setGiphyLoading(true);
      try {
        const next = query.trim().length === 0
          ? await trendingGifs()
          : await searchGifs(query);
        setGifs(next);
      } finally {
        setGiphyLoading(false);
      }
    };
    const t = window.setTimeout(run, query.trim() ? 300 : 0);
    return () => {
      window.clearTimeout(t);
      giphyAbortRef.current?.abort();
    };
  }, [tab, query]);

  // ─── Reset the search when switching tabs so one tab's query
  // doesn't leak context into another.
  React.useEffect(() => {
    setQuery("");
  }, [tab]);

  return (
    <div
      data-nex-se-emoji-sticker-picker
      style={{
        padding: 10,
        borderRadius: 14,
        background: `rgba(2,9,20,0.82)`,
        border: `1px solid ${colours.primary}66`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Tabs row + close */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <TabButton label="Emoji" active={tab === "emoji"} accent={colours.primary} onClick={() => setTab("emoji")} />
        {showStickersTab && (
          <TabButton label="Stickers" active={tab === "sticker"} accent={colours.primary} onClick={() => setTab("sticker")} />
        )}
        {showGiphyTab && (
          <TabButton label="GIFS" active={tab === "giphy"} accent={colours.primary} onClick={() => setTab("giphy")} />
        )}
        {showFilesTab && (
          <TabButton label="Files" active={tab === "file"} accent={colours.primary} onClick={() => setTab("file")} />
        )}
        {onClose && (
          <button
            type="button"
            aria-label="Close emoji + sticker picker"
            data-nex-se-picker-close
            onClick={onClose}
            style={{
              marginLeft: "auto",
              width: 28,
              height: 28,
              padding: 0,
              borderRadius: 999,
              border: `1px solid ${colours.primary}66`,
              background: "rgba(0,0,0,0.55)",
              color: "#FFFFFF",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              fontSize: 16,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Search · hidden on Files tab when there's a device picker */}
      {tab !== "file" && (
        <input
          type="search"
          value={query}
          onChange={(ev) => setQuery(ev.target.value)}
          placeholder={
            tab === "emoji"
              ? "Search emoji…"
              : tab === "sticker"
                ? "Search stickers…"
                : "Search NEX GIFs…"
          }
          data-nex-se-picker-search
          data-nex-se-picker-search-tab={tab}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${colours.primary}33`,
            color: colours.highlight,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      )}

      {tab === "emoji" && (
        <EmojiTab
          allEmoji={allEmoji}
          query={query}
          recent={recentEmoji}
          emojiTreatment={emoji}
          accent={colours.primary}
          onPickUnicode={(g) => {
            recordPick("emoji", g);
            onPickEmoji(g);
          }}
          onPickTheme={(e) => {
            if (!onPickThemeEmoji) return;
            recordPick("emoji", `:${e.slug}:`);
            onPickThemeEmoji(e);
          }}
        />
      )}

      {tab === "sticker" && (
        <StickerTab
          allStickers={allStickers}
          query={query}
          recent={recentSticker}
          accent={colours.primary}
          onPick={(s) => {
            if (onPickThemeSticker) {
              recordPick("sticker", `:${s.slug}:`);
              onPickThemeSticker(s);
            } else {
              onPickSticker(s.slug);
            }
          }}
        />
      )}

      {tab === "giphy" && (
        <GiphyTab
          gifs={gifs}
          loading={giphyLoading}
          recent={recentGiphy}
          accent={colours.primary}
          onPick={(g) => {
            if (!onPickGiphy) return;
            recordPick("giphy", g.id);
            onPickGiphy(g);
          }}
        />
      )}

      {tab === "file" && showFilesTab && (
        <FilesTab
          recentFiles={recentFiles ?? []}
          accent={colours.primary}
          onPickFiles={(files) => onPickFiles?.(files)}
          onPickRecentFile={(f) => onPickRecentFile?.(f)}
        />
      )}
    </div>
  );
}

// ───────────────────────── Tab button ─────────────────────────────

function TabButton({
  label, active, accent, onClick,
}: { label: string; active: boolean; accent: string; onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-nex-se-picker-tab={label.toLowerCase()}
      data-nex-se-picker-tab-active={active ? "true" : "false"}
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        background: active ? `${accent}33` : "transparent",
        border: `1px solid ${active ? accent : "rgba(255,255,255,0.1)"}`,
        color: active ? "#fff" : "rgba(255,255,255,0.6)",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.04em",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

function SectionLabel({ label }: { label: string }): React.JSX.Element {
  return (
    <div
      style={{
        fontSize: 9,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.5)",
        fontWeight: 800,
        padding: "4px 2px 2px",
      }}
    >
      {label}
    </div>
  );
}

// ───────────────────────── Emoji tab ──────────────────────────────

function EmojiTab({
  allEmoji, query, recent, emojiTreatment, accent, onPickUnicode, onPickTheme,
}: {
  allEmoji: StandardPickerThemeEmoji[];
  query: string;
  recent: string[];
  emojiTreatment: { tileSize: number; tileStyle: React.CSSProperties };
  accent: string;
  onPickUnicode: (g: string) => void;
  onPickTheme: (e: StandardPickerThemeEmoji) => void;
}): React.JSX.Element {
  const q = query.trim().toLowerCase();
  /* Owner directive 2026-10-20 · "emojis must be scanned for search bar
   * search · maybe user wants happy / sad / crying etc · we must show
   * results with yellow emoji showing first". Three-tier match: slug
   * prefix, then label substring, then the shared keyword map (which
   * carries emotion/concept tokens for glossy3d + cakegirl). Results
   * are stable-sorted so yellow (glossy3d) tiles float to the top. */
  const filteredImages = React.useMemo(() => {
    if (!q) return allEmoji;
    const matched = allEmoji.filter(
      (e) =>
        e.slug.toLowerCase().includes(q) ||
        (e.label ?? "").toLowerCase().includes(q) ||
        emojiMatchesKeyword(e.slug, q),
    );
    // Stable yellow-first sort · preserves original order within each
    // bucket so repeat searches return the same list.
    return matched
      .map((e, i) => ({ e, i, yellow: emojiIsYellow(e.slug) }))
      .sort((a, b) => {
        if (a.yellow !== b.yellow) return a.yellow ? -1 : 1;
        return a.i - b.i;
      })
      .map((x) => x.e);
  }, [allEmoji, q]);
  /* Owner directive 2026-10-19 · Unicode BASE_EMOJI fallback retired
     from the Emoji tab · `filteredBase` + its render are gone · the
     Unicode glyph set is no longer surfaced for new picks. Existing
     recent entries that happen to be Unicode glyphs still render in
     the Recent section via the ImageEmojiGrid __unicode fallback for
     backward compatibility with MRU written before this change. */

  const recentEmoji = React.useMemo(() => {
    const map = new Map(allEmoji.map((e) => [`:${e.slug}:`, e]));
    return recent
      .map((id) => {
        /* Owner directive 2026-10-19 · recent entries stored as
         * ":slug:" ALWAYS resolve to an image emoji · if the slug
         * isn't in allEmoji (stale pick before registration landed)
         * synthesize the entry with the known /nex-themes/food/emoji/
         * URL instead of falling back to a unicode-string pick that
         * would insert the raw ":slug:" into chat / title text. */
        if (id.startsWith(":")) {
          const resolved = map.get(id);
          if (resolved) return resolved;
          const slugMatch = /^:([a-z0-9][a-z0-9_-]*):$/i.exec(id);
          if (!slugMatch) return null;
          const slug = slugMatch[1];
          return {
            slug,
            imageUrl: `/nex-themes/food/emoji/${slug}.png`,
            label: slug,
          } as StandardPickerThemeEmoji;
        }
        return { slug: id, imageUrl: "", label: id, __unicode: id } as unknown as StandardPickerThemeEmoji & { __unicode: string };
      })
      .filter(Boolean) as Array<StandardPickerThemeEmoji & { __unicode?: string }>;
  }, [recent, allEmoji]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        maxHeight: 320,
        overflowY: "auto",
      }}
    >
      {recentEmoji.length > 0 && q.length === 0 && (
        <>
          <SectionLabel label="Recent" />
          <ImageEmojiGrid
            items={recentEmoji}
            tileSize={emojiTreatment.tileSize}
            onPick={(e) => {
              if ((e as { __unicode?: string }).__unicode) {
                onPickUnicode((e as { __unicode?: string }).__unicode!);
              } else {
                onPickTheme(e);
              }
            }}
          />
          <SectionLabel label="All emoji" />
        </>
      )}
      {filteredImages.length > 0 ? (
        <ImageEmojiGrid
          items={filteredImages}
          tileSize={emojiTreatment.tileSize}
          onPick={onPickTheme}
        />
      ) : (
        /* Owner directive 2026-10-19 · "remove the unicode stickers
           from emoji Unicode" · the sealed BASE_EMOJI Unicode fallback
           section is retired · the Emoji tab now shows ONLY the
           cross-theme image emoji pool. When the search filter clears
           everything, an honest empty state renders instead of
           falling through to Unicode glyphs. */
        <EmptyState label="No emoji match that search" accent={accent} />
      )}
    </div>
  );
}

function ImageEmojiGrid({
  items, tileSize, onPick,
}: {
  items: StandardPickerThemeEmoji[];
  tileSize: number;
  onPick: (e: StandardPickerThemeEmoji) => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize + 12}px, 1fr))`,
        gap: 6,
      }}
    >
      {items.map((e, idx) => (
        <button
          key={`${e.slug}-${idx}`}
          type="button"
          onClick={() => onPick(e)}
          aria-label={e.label || `Pick ${e.slug}`}
          title={e.label || e.slug}
          data-nex-se-picker-emoji-slug={e.slug}
          style={{
            padding: 2,
            background: "transparent",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            aspectRatio: "1 / 1",
          }}
        >
          {e.imageUrl ? (
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
          ) : (
            <span style={{ fontSize: 24 }}>
              {(e as { __unicode?: string }).__unicode}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────── Sticker tab ────────────────────────────

function StickerTab({
  allStickers, query, recent, accent, onPick,
}: {
  allStickers: StandardPickerThemeSticker[];
  query: string;
  recent: string[];
  accent: string;
  onPick: (s: StandardPickerThemeSticker) => void;
}): React.JSX.Element {
  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      q
        ? allStickers.filter(
            (s) =>
              s.slug.toLowerCase().includes(q) ||
              (s.label ?? "").toLowerCase().includes(q),
          )
        : allStickers,
    [allStickers, q],
  );
  const recentStickers = React.useMemo(() => {
    const map = new Map(allStickers.map((s) => [`:${s.slug}:`, s]));
    return recent.map((id) => map.get(id)).filter(Boolean) as StandardPickerThemeSticker[];
  }, [recent, allStickers]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        maxHeight: 420,
        overflowY: "auto",
      }}
    >
      {recentStickers.length > 0 && q.length === 0 && (
        <>
          <SectionLabel label="Recent" />
          <StickerGrid items={recentStickers} onPick={onPick} />
          <SectionLabel label="All stickers" />
        </>
      )}
      {filtered.length > 0 ? (
        <StickerGrid items={filtered} onPick={onPick} />
      ) : (
        <EmptyState label="No stickers match that search" accent={accent} />
      )}
    </div>
  );
}

function StickerGrid({
  items, onPick,
}: {
  items: StandardPickerThemeSticker[];
  onPick: (s: StandardPickerThemeSticker) => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 10,
        padding: 2,
      }}
    >
      {items.map((s, idx) => (
        <button
          key={`${s.slug}-${idx}`}
          type="button"
          onClick={() => onPick(s)}
          aria-label={s.label || `Send ${s.slug}`}
          title={s.label || s.slug}
          data-nex-se-picker-sticker-slug={s.slug}
          style={{
            padding: 2,
            background: "transparent",
            border: "none",
            borderRadius: 6,
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
              aspectRatio: `${s.aspectRatio}`,
              objectFit: "contain",
              display: "block",
            }}
          />
        </button>
      ))}
    </div>
  );
}

// ───────────────────────── Giphy tab ──────────────────────────────

function GiphyTab({
  gifs, loading, recent, accent, onPick,
}: {
  gifs: GiphyGif[];
  loading: boolean;
  recent: string[];
  accent: string;
  onPick: (g: GiphyGif) => void;
}): React.JSX.Element {
  const recentGifs = React.useMemo(
    () => gifs.filter((g) => recent.includes(g.id)),
    [gifs, recent],
  );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        maxHeight: 420,
        overflowY: "auto",
      }}
    >
      {loading && (
        <div
          style={{
            padding: 20,
            textAlign: "center",
            color: "rgba(255,255,255,0.55)",
            fontSize: 12,
          }}
        >
          Loading GIFs…
        </div>
      )}
      {!loading && recentGifs.length > 0 && (
        <>
          <SectionLabel label="Recent" />
          <GiphyGrid items={recentGifs} onPick={onPick} />
          <SectionLabel label="Results" />
        </>
      )}
      {!loading && gifs.length > 0 && <GiphyGrid items={gifs} onPick={onPick} />}
      {!loading && gifs.length === 0 && (
        <EmptyState label="No GIFs found · try a different search." accent={accent} />
      )}
    </div>
  );
}

function GiphyGrid({
  items, onPick,
}: {
  items: GiphyGif[];
  onPick: (g: GiphyGif) => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 8,
        padding: 2,
      }}
    >
      {items.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => onPick(g)}
          aria-label={g.title || "Send GIF"}
          title={g.title}
          data-nex-se-picker-giphy-id={g.id}
          data-nex-se-picker-giphy-builtin={g.builtIn ? "true" : "false"}
          style={{
            padding: 0,
            background: "transparent",
            border: "none",
            borderRadius: 8,
            overflow: "hidden",
            cursor: "pointer",
            display: "block",
            position: "relative",
          }}
        >
          <img
            src={g.previewUrl}
            alt={g.title || "GIF"}
            style={{
              width: "100%",
              aspectRatio: `${g.aspectRatio}`,
              objectFit: "cover",
              display: "block",
              borderRadius: 8,
            }}
          />
        </button>
      ))}
    </div>
  );
}

// ───────────────────────── Files tab ──────────────────────────────

function FilesTab({
  recentFiles, accent, onPickFiles, onPickRecentFile,
}: {
  recentFiles: readonly StandardPickerRecentFile[];
  accent: string;
  onPickFiles: (files: FileList) => void;
  onPickRecentFile: (file: StandardPickerRecentFile) => void;
}): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxHeight: 420,
        overflowY: "auto",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="*/*"
        multiple
        hidden
        onChange={(ev) => {
          if (ev.target.files && ev.target.files.length > 0) {
            onPickFiles(ev.target.files);
          }
          ev.currentTarget.value = "";
        }}
        data-nex-se-picker-file-input
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          background: `${accent}22`,
          border: `1px solid ${accent}66`,
          color: "#F2F5F8",
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.04em",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "center",
        }}
      >
        + Pick new file
      </button>
      {recentFiles.length > 0 && (
        <>
          <SectionLabel label="Recent files" />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recentFiles.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onPickRecentFile(f)}
                data-nex-se-picker-recent-file={f.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 6,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${accent}33`,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  color: "#F2F5F8",
                }}
              >
                {f.mime.startsWith("image/") ? (
                  <img
                    src={f.previewUrl}
                    alt={f.name}
                    style={{
                      width: 36,
                      height: 36,
                      objectFit: "cover",
                      borderRadius: 6,
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <span
                    aria-hidden
                    style={{
                      width: 36,
                      height: 36,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 6,
                      background: "rgba(0,0,0,0.35)",
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      flexShrink: 0,
                    }}
                  >
                    {(f.name.split(".").pop() ?? "file").slice(0, 4)}
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {f.name}
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.65 }}>
                    {f.mime || "file"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ───────────────────────── Empty state ────────────────────────────

function EmptyState({
  label, accent,
}: { label: string; accent: string }): React.JSX.Element {
  return (
    <div
      style={{
        padding: 20,
        textAlign: "center",
        color: "rgba(255,255,255,0.65)",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.5,
        border: `1px dashed ${accent}44`,
        borderRadius: 10,
      }}
    >
      {label}
    </div>
  );
}
