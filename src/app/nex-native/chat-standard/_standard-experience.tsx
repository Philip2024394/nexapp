"use client";

// src/app/nex-native/chat-standard/_standard-experience.tsx
//
// Phase 2A.0 · Standard NEX Experience · composition.
//
// Mounts the five founder-chosen surfaces (bubbles, composer,
// emoji+stickers, ambient animation, shop+product cards) with the
// supplied Theme Engine. All features are universal. Only the engine
// changes between themes.
//
// Explicit non-goals in 2A.0:
//   · reactions / buttons / navigation / loading / empty states ·
//     notifications / micro-interactions · calls · video calls
//   · live chat / real session / real WebRTC
//
// Those arrive in 2A.1+ once the first five surfaces are reviewed and
// the engine is stress-tested on Ocean.

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ResolvedEngine } from "./_engine/theme-engine";
import type { IntroSettings as UserIntroOverlay } from "@/lib/nex-native/intro-settings-service";
import { ChatIdentityHeader } from "@/lib/nex-native/chat-chrome/chat-identity-header";
import { StandardAmbientLayer } from "./_surfaces/_ambient-layer";
import { StandardBubble } from "./_surfaces/_bubble";
import { StandardComposer } from "./_surfaces/_composer";
import { StandardEmojiStickerPicker } from "./_surfaces/_emoji-sticker-picker";
import { type StandardShopProduct } from "./_surfaces/_shop-slider";
// Owner-authorised 2026-10-19 · the Shop sheet on live-world theme
// previews renders the 5-way category chooser (Products · Services ·
// Food · Accommodation · Affiliate) in place of the mock-products
// slider. Convergence with the DB-driven path's `?shop_setup=1`
// behaviour (see src/app/nex-native/chat/_shop-grid-modal.tsx).
import { StandardShopChooser } from "./_surfaces/_shop-chooser";
// Step 2 (sealed 2026-10-06) · universal ThemePackage asset
// consumption · the intro-video overlay plays `pkg.intro.videoUrl`
// twice-then-skip for every Standard Experience world without any
// per-theme code.
import { StandardIntroOverlay } from "./_standard-intro-overlay";
import { JokerKeypad } from "./_joker-keypad";

export interface StandardExperienceFixturePeer {
  accountId: string;
  displayName: string;
  /** Subline rendered under the display name · null hides the row
   *  rather than printing a placeholder. 2026-10-18 · nullable so
   *  theme-derived identities with no tagline don't fake copy. */
  tagline: string | null;
  avatarUrl?: string | null;
  /** Universal rule · peer avatar always carries a green rim. When
   *  `isOnline` is true an outer pulsing ring (ping) animates around
   *  it. Fixture defaults to true in the preview. */
  isOnline?: boolean;
}

export interface StandardExperienceSeedMessage {
  id: string;
  mine: boolean;
  body: string;
}

export interface StandardExperienceThemeEmoji {
  slug: string;
  imageUrl: string;
  label: string;
}
export interface StandardExperienceThemeSticker {
  slug: string;
  imageUrl: string;
  label: string;
  stickerType: string;
  aspectRatio: number;
}

export interface StandardExperienceProps {
  engine: ResolvedEngine;
  peer: StandardExperienceFixturePeer;
  seedMessages: StandardExperienceSeedMessage[];
  products: StandardShopProduct[];
  /** Preview-mode composer: appends locally to a fixture message list.
   *  Live-mode would wire a server action here. */
  onSendLocalMessage: (body: string) => void;
  localMessages: StandardExperienceSeedMessage[];
  /** Overlay a procedurally-generated wallpaper if the theme package
   *  has no asset. The acceptance test says Ocean must feel Ocean
   *  WITHOUT the wallpaper, so this is deliberately low-weight. */
  wallpaperFallback?: "theme-gradient" | "none";
  /** Owner directive 2026-10-19 · DB-backed (or filesystem-fallback)
   *  theme emoji/sticker rows. Threaded through to the composer
   *  picker so uploaded theme-specific assets replace the hardcoded
   *  Unicode base emoji + the engine's SVG sticker generator. Empty
   *  arrays preserve the sealed defaults. */
  themeEmojis?: readonly StandardExperienceThemeEmoji[];
  themeStickers?: readonly StandardExperienceThemeSticker[];
  /** Owner directive 2026-10-20 · when the Standard Experience is
   *  mounted on the theme-preview surface (/nex-native/themes/[id]),
   *  the intro overlay must play every time · the sealed "twice-then-
   *  skip" counter is correct for real chat sessions but wrong when
   *  the user is auditioning themes. Preview surfaces pass true. Real
   *  chat surfaces omit this (defaults to false → counter policy
   *  applies). */
  alwaysPlayIntro?: boolean;
  /** Owner directive 2026-10-20 · the signed-in viewer's PERSONAL
   *  saved IntroSettings · passed through to StandardIntroOverlay so
   *  the viewer's title + typography + segments render on top of the
   *  theme intro video. Null (or omitted) for guest viewers or
   *  signed-in viewers with no intro saved · the overlay then plays
   *  the theme intro unmodified. */
  userIntroOverlay?: UserIntroOverlay | null;
}

export function StandardExperience({
  engine,
  peer,
  seedMessages,
  products,
  onSendLocalMessage,
  localMessages,
  wallpaperFallback = "theme-gradient",
  themeEmojis,
  themeStickers,
  alwaysPlayIntro = false,
  userIntroOverlay = null,
}: StandardExperienceProps): React.JSX.Element {
  const [composerText, setComposerText] = React.useState("");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  // Owner directive 2026-10-19 · staged image emoji / sticker chips
  // inside the composer pill · mirrors the sealed pendingEmoji
  // pattern from _universal-composer-footer.tsx. Setters are wired
  // from BOTH the StandardEmojiStickerPicker (over-composer sheet)
  // AND the JokerKeypad's inline emoji/sticker drawers so the user
  // can land a food emoji from either surface and see it stage in
  // the input before pressing Send.
  const [pendingEmoji, setPendingEmoji] = React.useState<
    StandardExperienceThemeEmoji | null
  >(null);
  const [pendingSticker, setPendingSticker] = React.useState<
    StandardExperienceThemeSticker | null
  >(null);
  /* Owner directive 2026-10-19 · attachments staged by the lower-
     right 3-dot menu's Camera + File-Attach buttons · each entry
     carries the raw File (for a real upload path later) plus a
     browser-generated preview URL for images. Stored in composer
     state so the chips sit INSIDE the composer pill alongside
     emoji + sticker chips. */
  type PendingAttachment = {
    id: string;
    file: File;
    name: string;
    mime: string;
    sizeBytes: number;
    previewUrl: string | null;
  };
  const [pendingAttachments, setPendingAttachments] = React.useState<
    PendingAttachment[]
  >([]);
  /* Owner directive 2026-10-19 · recent-files list for the unified
     picker's Files tab · tracks every file this session has sent so
     the user can quickly re-send recent attachments. Capped at 20
     per the picker-mru convention. */
  const [recentFiles, setRecentFiles] = React.useState<
    Array<{
      id: string;
      name: string;
      mime: string;
      previewUrl: string;
      sentAtMs: number;
    }>
  >([]);
  const handleFilesPicked = React.useCallback((files: FileList) => {
    const next: PendingAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files.item(i);
      if (!file) continue;
      const isImage = (file.type || "").startsWith("image/");
      const previewUrl = isImage ? URL.createObjectURL(file) : null;
      next.push({
        id: `att-${Date.now()}-${i}-${file.name}`,
        file,
        name: file.name,
        mime: file.type || "application/octet-stream",
        sizeBytes: file.size,
        previewUrl,
      });
    }
    if (next.length > 0) {
      setPendingAttachments((prev) => [...prev, ...next]);
    }
  }, []);
  const removePendingAttachment = React.useCallback((id: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) {
        /* Revoke the object URL so the preview blob can be GC'd. */
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((a) => a.id !== id);
    });
  }, []);
  /* Clean up any dangling object URLs when the component unmounts. */
  React.useEffect(
    () => () => {
      for (const a of pendingAttachments) {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // Shop slider is hidden by default on every theme · tapping the Shop
  // icon in the header slides it up from below the composer. Universal
  // rule across all themes · the Standard Experience owns this
  // behaviour so no world package has to opt in.
  const [shopOpen, setShopOpen] = React.useState(false);
  // Floating 3-dots at bottom-right · tap to reveal Call / Video /
  // Mic icons sliding in to the LEFT. Universal rule across themes.
  const [callActionsOpen, setCallActionsOpen] = React.useState(false);
  // + button in the composer footer opens a centered floating menu
  // with Contacts / Add Product / Animations. Universal rule.
  const [plusMenuOpen, setPlusMenuOpen] = React.useState(false);
  // Owner directive 2026-10-18 · themed keypad opens on tap of the
  // composer input · same JokerKeypad as the viewer path · recolours
  // via engine.colours.primary.
  const [keypadOpen, setKeypadOpen] = React.useState(false);
  const [lastReactId, setLastReactId] = React.useState<string | null>(null);
  const colours = engine.colours;

  // Owner directive 2026-10-18 · stable per-mount reference for the
  // bubble sent-at timestamps · ensures Date.now() is called ONCE so
  // re-renders don't shuffle the preview times. Each message gets a
  // monotonically increasing offset (older → newer) so the chat reads
  // like a real conversation.
  const mountNow = React.useMemo(() => Date.now(), []);

  // Owner directive 2026-10-18 · "chat theme chat must be able
  // scrolling up or down". Scroll the messages container to the
  // bottom on mount + after each new message · gives the "sticks
  // to bottom" affordance that `justify-content: flex-end` used to
  // provide (that CSS pattern broke scroll on overflow).
  const messagesRef = React.useRef<HTMLDivElement | null>(null);
  const allMessagesLength = seedMessages.length + localMessages.length;
  React.useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [allMessagesLength]);
  // Preview seed reactions keyed by message id. Lifted to component
  // state 2026-10-19 so the react-trigger on each bubble can route
  // picks from the main emoji+sticker panel back as new reactions.
  const [messageReactions, setMessageReactions] = React.useState<
    Record<string, Record<string, number>>
  >(() => ({
    s1: { "❤️": 2 },
    s3: { "👍": 1, "🔥": 1 },
    s4: { "😍": 1 },
  }));
  /* Owner directive 2026-10-19 · when non-null, the next pick from
     StandardEmojiStickerPicker is routed to this message as a new
     reaction instead of being staged in the composer. Set when the
     user taps the smiley icon on a bubble · cleared after one pick
     or when the picker is dismissed. */
  const [reactingToMessageId, setReactingToMessageId] = React.useState<
    string | null
  >(null);
  const openReactionPickerFor = React.useCallback((messageId: string) => {
    setReactingToMessageId(messageId);
    setPickerOpen(true);
  }, []);
  const addReaction = React.useCallback(
    (messageId: string, key: string) => {
      setMessageReactions((prev) => {
        const existing = prev[messageId] ?? {};
        return {
          ...prev,
          [messageId]: {
            ...existing,
            [key]: (existing[key] ?? 0) + 1,
          },
        };
      });
    },
    [],
  );
  /* Owner directive 2026-10-19 · long-press on a reaction chip opens
     a Delete Emoji yes/no prompt · yes fires here and clears the key
     entirely from the message's reaction map (chip disappears). */
  const removeReaction = React.useCallback(
    (messageId: string, key: string) => {
      setMessageReactions((prev) => {
        const existing = prev[messageId];
        if (!existing || !(key in existing)) return prev;
        const next = { ...existing };
        delete next[key];
        return { ...prev, [messageId]: next };
      });
    },
    [],
  );

  const handleSend = React.useCallback(() => {
    const trimmed = composerText.trim();
    // Owner directive 2026-10-19 · flush order · attachments first
    // (each as its own bubble), then sticker (its own bubble), then
    // text + optional trailing emoji together. Each staged asset
    // lives in its own bubble so the message log reads the same way
    // UniversalComposerFooter + the sealed peer chat render staged
    // assets. Clears all state after.
    for (const att of pendingAttachments) {
      const safeName = att.name.replace(/\|/g, "_");
      const safeMime = att.mime.replace(/\|/g, "_");
      /* Encode as [file:name|mime|previewUrl] so the bubble renderer
         can resolve the preview blob or render a type-chip. Preview
         URL is a blob: URL in preview mode; a real upload path
         would swap this for the final storage URL. */
      onSendLocalMessage(
        `[file:${safeName}|${safeMime}|${att.previewUrl ?? ""}]`,
      );
      /* Owner directive 2026-10-19 · surface the sent file in the
         unified picker's Files tab Recent list. De-dupe by id so
         re-sending the same file doesn't bloat the list · cap at
         20 entries total. */
      setRecentFiles((prev) => {
        const filtered = prev.filter((p) => p.id !== att.id);
        return [
          {
            id: att.id,
            name: att.name,
            mime: att.mime,
            previewUrl: att.previewUrl ?? "",
            sentAtMs: Date.now(),
          },
          ...filtered,
        ].slice(0, 20);
      });
    }
    if (pendingSticker) {
      /* Owner directive 2026-10-19 · image-sticker encoding carries
         slug + imageUrl + aspectRatio so the bubble renderer always
         has what it needs to paint the image · no catalog-lookup
         fallback → no "[sticker:slug]" text leaking to the chat. */
      onSendLocalMessage(
        `[sticker:${pendingSticker.slug}|${pendingSticker.imageUrl}|${pendingSticker.aspectRatio.toFixed(3)}]`,
      );
    }
    if (trimmed || pendingEmoji) {
      /* Owner directive 2026-10-19 · image-emoji encoding carries
         slug + imageUrl so the bubble renderer never falls back to
         raw "[emoji:slug]" text. */
      const emojiToken = pendingEmoji
        ? `[emoji:${pendingEmoji.slug}|${pendingEmoji.imageUrl}]`
        : "";
      const body = pendingEmoji
        ? trimmed
          ? `${trimmed} ${emojiToken}`
          : emojiToken
        : trimmed;
      onSendLocalMessage(body);
    }
    setComposerText("");
    setPendingEmoji(null);
    setPendingSticker(null);
    setPendingAttachments([]);
  }, [
    composerText,
    pendingEmoji,
    pendingSticker,
    pendingAttachments,
    onSendLocalMessage,
  ]);

  const handleEmojiPick = React.useCallback(
    (g: string) => {
      /* Owner directive 2026-10-19 · when a bubble's react-trigger
         opened the picker, the next pick becomes a reaction on
         that bubble instead of composer text. */
      if (reactingToMessageId) {
        addReaction(reactingToMessageId, g);
        setReactingToMessageId(null);
        setPickerOpen(false);
        return;
      }
      setComposerText((v) => v + g);
    },
    [reactingToMessageId, addReaction],
  );

  // Owner directive 2026-10-19 · staged image emoji · tapping an
  // image tile (picker OR keypad drawer) sets the pending chip
  // instead of appending literal "[emoji:slug]" text to the input.
  // In reaction mode, the pick is instead encoded as a ":slug:"
  // reaction key on the targeted bubble.
  const handleThemeEmojiPick = React.useCallback(
    (e: StandardExperienceThemeEmoji) => {
      if (reactingToMessageId) {
        addReaction(reactingToMessageId, `:${e.slug}:`);
        setReactingToMessageId(null);
        setPickerOpen(false);
        return;
      }
      setPendingEmoji(e);
      setPickerOpen(false);
    },
    [reactingToMessageId, addReaction],
  );

  const handleStickerPick = React.useCallback(
    (slug: string) => {
      // Unicode-only picker path · stickers are URL-based elsewhere.
      // Kept for the engine-SVG sticker set (Joker + any future
      // package that ships procedural stickers).
      if (reactingToMessageId) {
        addReaction(reactingToMessageId, `:${slug}:`);
        setReactingToMessageId(null);
        setPickerOpen(false);
        return;
      }
      onSendLocalMessage(`[sticker:${slug}]`);
      setPickerOpen(false);
    },
    [reactingToMessageId, addReaction, onSendLocalMessage],
  );

  // Owner directive 2026-10-19 · staged image sticker · same model
  // as handleThemeEmojiPick · chip renders in composer, Send
  // flushes it as its own bubble. In reaction mode, encoded as
  // ":slug:" reaction key on the targeted bubble.
  const handleThemeStickerPick = React.useCallback(
    (s: StandardExperienceThemeSticker) => {
      if (reactingToMessageId) {
        addReaction(reactingToMessageId, `:${s.slug}:`);
        setReactingToMessageId(null);
        setPickerOpen(false);
        return;
      }
      setPendingSticker(s);
      setPickerOpen(false);
    },
    [reactingToMessageId, addReaction],
  );

  const stickers = engine.stickerTreatment();

  const allMessages = React.useMemo(
    () => [...seedMessages, ...localMessages],
    [seedMessages, localMessages],
  );

  // Trigger a reaction animation when the newest peer message arrives.
  React.useEffect(() => {
    const last = allMessages[allMessages.length - 1];
    if (last && !last.mine) {
      setLastReactId(last.id);
      const id = window.setTimeout(() => setLastReactId(null), 1000);
      return () => window.clearTimeout(id);
    }
  }, [allMessages]);

  // Step 2 (sealed 2026-10-06) · universal consumption of
  // `pkg.wallpaperUrl`. When the ThemePackage declares a wallpaper
  // asset, the shell renders it as the background image for every
  // world · ambient effects continue to sit above it exactly as
  // before. When the package declares `null`, the existing
  // gradient-based fallback renders unchanged (preserves the sealed
  // "remove the wallpaper, does it still feel Ocean?" acceptance
  // test). Zero per-theme branches · zero id checks · the behaviour
  // is universal across every Standard Experience world.
  const packageWallpaperUrl = engine.package.wallpaperUrl ?? null;
  const backgroundStyle: React.CSSProperties = packageWallpaperUrl
    ? {
        backgroundImage: `url("${packageWallpaperUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        // Underlay in the engine's deep token so a transient image
        // load failure doesn't flash to white · never a hardcoded
        // colour.
        backgroundColor: colours.deep,
      }
    : {
        background:
          wallpaperFallback === "theme-gradient"
            ? `radial-gradient(ellipse at 50% 10%, ${colours.secondary}, ${colours.deep} 65%, #000 100%)`
            : // Even with the "wallpaper off" acceptance test, we provide
              // a very dark theme-tinted base rather than pure #000. This
              // is not a wallpaper — it's the colour of water at depth,
              // emitted by the Theme Engine's deep token. The ambient
              // layer then provides all motion / light / bubbles on top.
              `linear-gradient(180deg, #000 0%, ${colours.deep} 18%, ${colours.deep} 82%, #000 100%)`,
      };

  return (
    <>
      <style>{engine.stylesheet}</style>
      {/* Step 2 · universal intro-video overlay · plays
          `pkg.intro.videoUrl` twice-then-skip for any world that
          declares one · renders null for every world without a video.
          Sealed 2026-10-06. */}
      <StandardIntroOverlay
        engine={engine}
        alwaysPlay={alwaysPlayIntro}
        userIntroOverlay={userIntroOverlay}
      />
      <div
        data-nex-standard-experience
        data-theme-id={engine.package.identity.id}
        data-personality={engine.personality}
        data-nex-wallpaper-mode={packageWallpaperUrl ? "image" : "fallback"}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          ...backgroundStyle,
          color: colours.highlight,
          display: "flex",
          flexDirection: "column",
          fontFamily: "inherit",
        }}
      >
        {/* Ambient layer sits above the wallpaper, below everything else. */}
        <StandardAmbientLayer engine={engine} />

        {/* Header · universal · 3 right-side action icons (Home / Cart
            / Shop). The Shop icon toggles the slide-up shop sheet
            below. Rule applies to every theme without exception. */}
        <StandardHeader
          peer={peer}
          engine={engine}
          shopOpen={shopOpen}
          onToggleShop={() => setShopOpen((v) => !v)}
        />

        {/* Messages · scrollable region.
            Owner directive 2026-10-18 · "chat theme chat must be able
            scrolling up or down". Dropped `justify-content: flex-end`
            at the overflow container level · that pattern pushes
            overflowing content above the viewport where many browsers
            don't allow scrolling. The flex-end behaviour is preserved
            via an INNER wrapper that uses min-height: 100% + justify-
            content: flex-end · so short conversations stick to the
            bottom AND long conversations scroll naturally. */}
        <div
          ref={messagesRef}
          data-nex-se-messages
          style={{
            position: "relative",
            zIndex: 5,
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding:
              "10px 14px calc(env(safe-area-inset-bottom, 0) + 128px)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              /* Owner directive 2026-10-18 · drop justify-content:
                 flex-end so overflow stays positive · scroll works
                 natively. Short conversations now sit top-down · the
                 shell scrolls to bottom on mount via the useEffect
                 below so visually it STILL reads as "newest at the
                 bottom" without the broken-scroll quirk. */
            }}
          >
          {allMessages.map((m, idx) => {
            if (m.body.startsWith("[giphy:")) {
              /* Owner directive 2026-10-19 · GIPHY bubble ·
                 encoded as [giphy:id|fullUrl|aspectRatio]. Rendered
                 naked (same convention as stickers) with a soft
                 drop-shadow for lift over the wallpaper. */
              const inner = m.body.slice(7, -1);
              const [id = "", fullUrl = "", arStr = "1"] = inner.split("|");
              const ar = Number.parseFloat(arStr) || 1;
              return (
                <div
                  key={m.id}
                  data-nex-se-bubble-giphy={id}
                  style={{
                    alignSelf: m.mine ? "flex-end" : "flex-start",
                    maxWidth: "60%",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                  }}
                >
                  {fullUrl ? (
                    <img
                      src={fullUrl}
                      alt="GIF"
                      style={{
                        maxWidth: "100%",
                        height: "auto",
                        display: "block",
                        aspectRatio: `${ar}`,
                        borderRadius: 12,
                        filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.35))",
                      }}
                    />
                  ) : null}
                </div>
              );
            }
            if (m.body.startsWith("[file:")) {
              /* Owner directive 2026-10-19 · file-attachment bubble ·
                 body encoded as `[file:name|mime|previewUrl]`. Image
                 types render the preview; other types show a type
                 chip + filename. Each bubble is its own standalone
                 asset, same convention as stickers. */
              const inner = m.body.slice(6, -1); // strip "[file:" and "]"
              const [name = "", mime = "", previewUrl = ""] = inner.split("|");
              const isImage = mime.startsWith("image/");
              return (
                <div
                  key={m.id}
                  data-nex-se-bubble-file={name}
                  data-nex-se-bubble-file-mime={mime}
                  style={{
                    alignSelf: m.mine ? "flex-end" : "flex-start",
                    maxWidth: "70%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: 8,
                    borderRadius: 14,
                    background: m.mine
                      ? `${colours.primary}22`
                      : "rgba(255,255,255,0.08)",
                    border: `1px solid ${colours.primary}44`,
                    color: colours.highlight,
                  }}
                >
                  {isImage && previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={name}
                      style={{
                        maxWidth: "100%",
                        height: "auto",
                        display: "block",
                        borderRadius: 10,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 36,
                          height: 36,
                          display: "grid",
                          placeItems: "center",
                          background: "rgba(0,0,0,0.35)",
                          borderRadius: 8,
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {(name.split(".").pop() ?? "file").slice(0, 4)}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {name}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            opacity: 0.65,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {mime || "file"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            if (m.body.startsWith("[sticker:")) {
              /* Owner directive 2026-10-19 · sticker tokens are
                 "[sticker:slug]" (legacy) or "[sticker:slug|url|aspect]"
                 (new · carries image URL + aspect directly so no
                 catalog lookup can fail silently to raw text). */
              const payload = m.body.slice(9, -1);
              const parts = payload.split("|");
              const slug = parts[0] ?? "";
              const inlineUrl = parts[1] ?? "";
              const inlineAspect = Number(parts[2]) || 1;
              const uploaded = themeStickers?.find((s) => s.slug === slug);
              const resolvedUrl = inlineUrl || uploaded?.imageUrl || "";
              const resolvedAspect =
                inlineAspect ||
                uploaded?.aspectRatio ||
                1;
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.mine ? "flex-end" : "flex-start",
                    maxWidth: "60%",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                  }}
                >
                  {resolvedUrl ? (
                    <img
                      src={resolvedUrl}
                      alt={uploaded?.label || slug}
                      data-nex-se-bubble-sticker-slug={slug}
                      style={{
                        maxWidth: "100%",
                        height: "auto",
                        display: "block",
                        aspectRatio: `${resolvedAspect}`,
                        filter:
                          "drop-shadow(0 4px 10px rgba(0,0,0,0.35))",
                      }}
                    />
                  ) : (
                    stickers.render(slug, 96)
                  )}
                </div>
              );
            }
            /* Owner directive 2026-10-19 · image-emoji bubble ·
               body encoding is either "[emoji:slug]" (legacy) or
               "[emoji:slug|url]" (new · carries image URL inline so
               no catalog lookup can silently fall back to raw text).
               Supports mixed body "text [emoji:slug|url]" so a bubble
               can carry caption + trailing emoji together. */
            const emojiMatch = m.body.match(/\[emoji:([^\]|]+)(?:\|([^\]]+))?\]/);
            if (emojiMatch) {
              const slug = emojiMatch[1];
              const inlineUrl = emojiMatch[2] ?? "";
              const captionBody = m.body
                .replace(/\s*\[emoji:[^\]]+\]\s*/, "")
                .trim();
              const uploaded = themeEmojis?.find((e) => e.slug === slug);
              const resolvedUrl = inlineUrl || uploaded?.imageUrl || "";
              if (resolvedUrl) {
                return (
                  <div
                    key={m.id}
                    data-nex-se-bubble-emoji-slug={slug}
                    style={{
                      alignSelf: m.mine ? "flex-end" : "flex-start",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: captionBody ? "6px 10px" : 0,
                      background: captionBody
                        ? m.mine
                          ? `${colours.primary}22`
                          : "rgba(255,255,255,0.08)"
                        : "transparent",
                      borderRadius: captionBody ? 14 : 0,
                      maxWidth: "70%",
                    }}
                  >
                    {captionBody && (
                      <span style={{ fontSize: 14, color: "inherit" }}>
                        {captionBody}
                      </span>
                    )}
                    <img
                      src={resolvedUrl}
                      alt={uploaded?.label || slug}
                      style={{
                        width: 80,
                        height: 80,
                        objectFit: "contain",
                        display: "block",
                        flexShrink: 0,
                      }}
                    />
                  </div>
                );
              }
            }
            /* Owner directive 2026-10-18 · bubble feature-match with
               Joker · each bubble carries peer avatar (peer-side only)
               + sent-at timestamp + delivery ticks (mine-side only ·
               all preview mine messages are "read") + reaction row
               (visual-only mock from PREVIEW_REACTIONS). Timestamps
               walk back from mountNow in 90s increments so the oldest
               seed message reads oldest · locally-sent messages (idx
               past SEED_MESSAGES length) read as "just now". */
            const minutesAgo = Math.max(0, allMessages.length - idx - 1) * 1.5;
            const sentAtMs = mountNow - minutesAgo * 60_000;
            return (
              <StandardBubble
                key={m.id}
                engine={engine}
                mine={m.mine}
                reacting={lastReactId === m.id}
                idle={true}
                peerAvatarUrl={peer.avatarUrl ?? null}
                peerName={peer.displayName}
                sentAtMs={sentAtMs}
                delivery={m.mine ? "read" : undefined}
                reactions={messageReactions[m.id]}
                onReactTrigger={() => openReactionPickerFor(m.id)}
                onRemoveReaction={(key) => removeReaction(m.id, key)}
                themeEmojis={themeEmojis}
                themeStickers={themeStickers}
              >
                {m.body}
              </StandardBubble>
            );
          })}
          </div>
        </div>

        {/* Shop sheet · UNIVERSAL RULE across every theme ·
            - CONNECTED to the bottom of the phone screen (flush with
              the bottom edge · no gap · not a floating panel).
            - Slides UP from the bottom of the screen when the Shop
              icon in the header is tapped.
            - Rounded corners ONLY on the top (left + right at top);
              bottom corners are square because the sheet is flush with
              the screen edge.
            - Full width (left: 0 · right: 0) · does NOT push chat
              bubbles up (bubbles stay anchored, sheet covers them
              from the bottom).
            Theming (background + border + shadow) inherits from engine
            colours so each world gets its own tinted sheet with zero
            world-specific branches. */}
        <div
          aria-hidden={!shopOpen}
          data-nex-se-shop-sheet={shopOpen ? "open" : "closed"}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            // UNIVERSAL RULE sealed 2026-10-05 · the shop sheet opens
            // to EXACTLY 70% of the stage height on every theme ·
            // never more, never less · gives the chat column
            // breathing room above and keeps the sheet reachable with
            // the thumb.
            height: "70%",
            zIndex: 7,
            padding: "14px 12px calc(env(safe-area-inset-bottom, 0) + 14px)",
            borderRadius: "24px 24px 0 0",
            background: `linear-gradient(180deg, ${colours.deep}f0, ${colours.deep})`,
            borderTop: `1px solid ${colours.primary}66`,
            boxShadow: `0 -12px 32px rgba(0,0,0,0.55), 0 -2px 6px ${colours.primary}33`,
            backdropFilter: "blur(10px) saturate(1.1)",
            WebkitBackdropFilter: "blur(10px) saturate(1.1)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            transform: `translateY(${shopOpen ? "0%" : "100%"})`,
            transition:
              "transform 320ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
            pointerEvents: shopOpen ? "auto" : "none",
          }}
        >
          {/* Grab-handle · a thin top bar universal to every theme so
              the sheet reads as a draggable bottom sheet. */}
          <div
            aria-hidden
            style={{
              width: 44,
              height: 4,
              borderRadius: 999,
              background: `${colours.highlight}55`,
              margin: "0 auto 10px",
              flexShrink: 0,
            }}
          />
          {/* Shop sheet body · fills the remaining sheet height (70%
              stage minus the grab handle) and scrolls vertically
              within. Owner directive 2026-10-19 · live-world
              previews render the 5-way shop-category chooser
              (Products · Services · Food · Accommodation ·
              Affiliate) here instead of the mock-products slider,
              matching the DB-driven preview path's default
              `?shop_setup=1` behaviour. The `products` prop is
              still accepted upstream so the API surface of this
              component doesn't break for other callers · it just
              isn't rendered here any more. */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <StandardShopChooser engine={engine} />
          </div>
        </div>

        {/* Owner directive 2026-10-19 · emoji + sticker picker is now
            a TRUE OVERLAY · zIndex 20 clears the FloatingCallActions
            stack (zIndex 9) + the shop sheet (zIndex 7) + the +
            menu + the drawer kebab, so the panel is never obscured
            by the floating right-side buttons. Positioned absolute
            above the composer with safe-area-aware offset so it
            sits just above the input pill. onClose fires the picker-
            dismiss path shared with the composer's 😊 toggle. */}
        {pickerOpen && (
          <div
            data-nex-se-picker-overlay
            style={{
              position: "absolute",
              left: 10,
              right: 10,
              bottom: "calc(env(safe-area-inset-bottom, 0) + 64px)",
              zIndex: 20,
            }}
          >
            <StandardEmojiStickerPicker
              engine={engine}
              onPickEmoji={handleEmojiPick}
              onPickSticker={handleStickerPick}
              onPickThemeEmoji={handleThemeEmojiPick}
              onPickThemeSticker={handleThemeStickerPick}
              onPickGiphy={(g) => {
                if (reactingToMessageId) {
                  addReaction(reactingToMessageId, `:giphy-${g.id}:`);
                  setReactingToMessageId(null);
                  setPickerOpen(false);
                  return;
                }
                /* Owner directive 2026-10-19 · GIPHY picks encode as a
                   `[giphy:<id>|<fullUrl>|<aspectRatio>]` message body
                   · bubble renderer handles the inline <img> render. */
                onSendLocalMessage(
                  `[giphy:${g.id}|${g.fullUrl}|${g.aspectRatio.toFixed(3)}]`,
                );
                setPickerOpen(false);
              }}
              onPickFiles={(files) => {
                handleFilesPicked(files);
                setPickerOpen(false);
              }}
              onPickRecentFile={(f) => {
                /* Re-stage the recent file into pendingAttachments
                   via the same shape handleFilesPicked uses · the
                   previewUrl + metadata are already resolved. */
                setPendingAttachments((prev) => [
                  ...prev,
                  {
                    id: `att-${Date.now()}-${f.id}`,
                    /* Preview-honest · the recent-file entry doesn't
                       carry the original File handle (that was GC'd)
                       so we fabricate a lightweight File-like stub.
                       In production this will carry a storage URL +
                       size + mime from the sealed upload record. */
                    file: new File([], f.name, { type: f.mime }),
                    name: f.name,
                    mime: f.mime,
                    sizeBytes: 0,
                    previewUrl: f.previewUrl,
                  },
                ]);
                setPickerOpen(false);
              }}
              recentFiles={recentFiles}
              themeEmojis={themeEmojis}
              themeStickers={themeStickers}
              onClose={() => {
                setPickerOpen(false);
                setReactingToMessageId(null);
              }}
            />
          </div>
        )}

        {/* Composer footer · UNIVERSAL RULE R3 revision 2 sealed
            2026-10-05 (Prototype 5 pattern) ·
            INSIDE the input pill (left → right):
              😊 emoji · │ divider · 📷 camera · 📎 attach · text input
            OUTSIDE the input, right side:
              ▶ round send button · + round plus button
            3-dots stays alone on the floating lower-right (see
            FloatingCallActions below). */}
        <div
          style={{
            position: "relative",
            zIndex: 6,
            padding:
              "8px 10px calc(env(safe-area-inset-bottom, 0) + 10px)",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <StandardComposer
              engine={engine}
              value={composerText}
              onChange={setComposerText}
              onSend={handleSend}
              placeholder={
                pendingEmoji ||
                pendingSticker ||
                pendingAttachments.length > 0
                  ? "Add a caption…"
                  : `Say something in ${engine.package.identity.name}…`
              }
              onEmojiToggle={() => {
                setPickerOpen((v) => !v);
                /* Owner directive 2026-10-19 · tapping the composer
                   emoji toggle resets reaction-mode so a subsequent
                   pick lands in the composer, not on whatever bubble
                   was last tapped. */
                setReactingToMessageId(null);
              }}
              emojiToggleActive={pickerOpen}
              pendingAttachments={pendingAttachments.map((a) => ({
                id: a.id,
                name: a.name,
                mime: a.mime,
                sizeBytes: a.sizeBytes,
                previewUrl: a.previewUrl,
              }))}
              onRemoveAttachment={removePendingAttachment}
              pendingEmoji={pendingEmoji}
              onClearPendingEmoji={() => setPendingEmoji(null)}
              pendingSticker={pendingSticker}
              onClearPendingSticker={() => setPendingSticker(null)}
              /* Owner directive 2026-10-18 · suppress native keyboard
                 so the themed JokerKeypad opens instead · same
                 behaviour as the viewer path. */
              suppressNativeKeyboard
              onFocusInput={() => setKeypadOpen(true)}
            />
          </div>
          {/* Owner directive 2026-10-18 · send lives INSIDE the
              composer pill now (StandardComposer renders it as a
              right-side 32px trailing circle). The outer
              ComposerSendButton is retired on preview surfaces to
              avoid double-send-buttons. Plus (+) stays outside. */}
          <ComposerPlusButton
            engine={engine}
            plusOpen={plusMenuOpen}
            onTogglePlus={() => setPlusMenuOpen((v) => !v)}
          />
        </div>

        {/* UNIVERSAL RULE sealed 2026-10-05 · floating 3-dots on the
            lower-right of the stage · tap to reveal Call / Video /
            Mic icons sliding in to the left. */}
        <FloatingCallActions
          engine={engine}
          open={callActionsOpen}
          onToggle={() => setCallActionsOpen((v) => !v)}
          onFilesPicked={(files) => {
            handleFilesPicked(files);
            /* Collapse the 3-dot menu after a selection so the
               composer chip is immediately visible to the user. */
            setCallActionsOpen(false);
          }}
        />

        {/* UNIVERSAL RULE · + button opens a centered floating menu
            with Contacts / Product / Animation / Settings. Backdrop
            click dismisses. zIndex 10 so it floats above every other
            overlay. The trigger lives in FloatingCallActions above. */}
        <FloatingPlusMenu
          engine={engine}
          open={plusMenuOpen}
          onClose={() => setPlusMenuOpen(false)}
        />

        {/* Owner directive 2026-10-18 · "all chat themes must have
            their own keypad in theme color". The Joker-pattern
            keypad opens on tap of the composer input · the theme's
            primary colour drives the keypad recolour via the
            accentColor prop. */}
        <JokerKeypad
          open={keypadOpen}
          value={composerText}
          onChange={setComposerText}
          onSend={() => {
            handleSend();
            setKeypadOpen(false);
          }}
          onClose={() => setKeypadOpen(false)}
          themeId={engine.package.identity.id}
          accentColor={engine.package.colours.primary}
          /* Owner directive 2026-10-19 · the keypad's inline emoji
             and sticker drawers now stage picks into the composer's
             pendingEmoji / pendingSticker state (same chip-in-pill
             pattern as the external picker) instead of silently
             no-op'ing. Both callbacks accept the full BuiltIn*
             shape so the chip can render the image URL. */
          onPickEmoji={(e) =>
            handleThemeEmojiPick({
              slug: e.slug,
              imageUrl: e.image_url,
              label: e.label,
            })
          }
          onPickSticker={(s) =>
            handleThemeStickerPick({
              slug: s.slug,
              imageUrl: s.image_url,
              label: s.label,
              stickerType: s.sticker_type,
              aspectRatio: s.aspect_ratio,
            })
          }
          /* Owner directive 2026-10-20 · "all keypads have emoji +
             stickers + giphy library" · GIFs picked from the keypad's
             giphy drawer send as their own bubble (same encoding as
             the chat composer's giphy picker). */
          onPickGiphy={(g) =>
            onSendLocalMessage(
              `[giphy:${g.id}|${g.url}|${g.aspectRatio.toFixed(3)}]`,
            )
          }
        />
      </div>
    </>
  );
}

// Round send button · UNIVERSAL THEME CONTROLS RULE (sealed 2026-10-06).
// Sits OUTSIDE the input pill. Colour comes from the active
// ThemePackage's resolved primary via engine.controlsTreatment() ·
// Ocean renders ocean blue, Café renders espresso, future worlds auto-
// inherit. The sealed 2026-10-05 "SEND_GREEN everywhere" rule is
// EXPLICITLY SUPERSEDED by this rule · universal recognisability now
// comes from (a) the button's fixed outside-right position, (b) its
// solid filled treatment, and (c) its theme sendGlyph.
function ComposerSendButton({
  engine,
  disabled,
  onSend,
}: {
  engine: ResolvedEngine;
  disabled: boolean;
  onSend: () => void;
}): React.JSX.Element {
  const composer = engine.composerTreatment();
  const controls = engine.controlsTreatment();
  return (
    <button
      type="button"
      aria-label="Send message"
      data-nex-se-composer-send
      onClick={() => {
        if (!disabled) onSend();
      }}
      disabled={disabled}
      style={controls.sendButton(disabled)}
    >
      {composer.sendGlyph}
    </button>
  );
}

function PlusIcon(): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function AttachIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.5 11.5 12 21a5 5 0 0 1-7-7l9.5-9.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L16 7" />
    </svg>
  );
}

function CameraIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8h3l2-2.5h8L18 8h3v12H3V8z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function StandardHeader({
  peer,
  engine,
  shopOpen,
  onToggleShop,
}: {
  peer: StandardExperienceFixturePeer;
  engine: ResolvedEngine;
  shopOpen: boolean;
  onToggleShop: () => void;
}): React.JSX.Element {
  // Master layout rule 2026-10-14 · identity row delegates to the
  // shared ChatIdentityHeader primitive so Standard Experience worlds
  // render the exact same 56×56 avatar + 26px name + 13px subtitle as
  // Joker chat. Right-cluster (Home/Cart/Shop) stays as the Standard
  // Experience's own 3-button action set alongside the primitive.
  const isOnline = peer.isOnline !== false;
  /* Owner directive 2026-10-18 · header avatar tap opens the peer's
     profile · preview routes to /profile/me (no real peer handle
     exists for a theme preview) and threads the theme accent via
     ?themeAccent so the profile page can tint its chrome to match
     when its own theme-color support lands. */
  const avatarHref = `/nex-native/profile/me?themeAccent=${encodeURIComponent(engine.package.colours.primary)}`;
  return (
    <div
      style={{
        position: "relative",
        zIndex: 5,
        padding:
          "calc(env(safe-area-inset-top, 0) + 10px) 14px 8px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <ChatIdentityHeader
        avatarUrl={peer.avatarUrl ?? null}
        displayName={peer.displayName}
        subtitle={peer.tagline}
        presenceKind={isOnline ? "online" : "offline"}
        /* Owner directive 2026-10-18 · preview surfaces tint BOTH
           the solid presence rim AND the heartbeat ring with the
           theme's own accent so the chrome visibly reads as "this
           theme on your chat". The master primitive still defaults
           to green on real chat routes · scope is preview only. */
        avatarRimColor={engine.package.colours.primary}
        heartbeatColor={engine.package.colours.primary}
        /* Owner directive 2026-10-18 · preview surfaces cap name
           to 1 line (ellipsis past ~14 chars · "Crispy Chicken"
           reference). Real chat routes omit this and keep the
           2-line wrap for user-chosen display names. */
        maxNameLines={1}
        /* Owner directive 2026-10-19 · preview name shrinks from 26
           to 20 so overlong theme names (Crispy Chicken, Botanical
           Café, etc.) read cleanly without crowding the absolute
           side-drawer kebab at right:12. Real chat routes omit this
           and keep the sealed 26px. */
        nameFontSize={20}
        avatarHref={avatarHref}
        /* Owner directive 2026-10-19 · reserve enough right-padding
           inside the identity column to prevent the ellipsised name
           from visually running under the absolute kebab (36px btn +
           12px frame margin at right:12 → ~48px slot). Previous
           value 0 allowed the clamp to touch the cluster's left
           edge · at frame widths where the Cart+Shop cluster
           compressed, the kebab's slot could overlap the name
           baseline. 56 keeps the title column safely clear. */
        rightReserveWidth={56}
      />
      <StandardHeaderActions
        engine={engine}
        shopOpen={shopOpen}
        onToggleShop={onToggleShop}
      />
    </div>
  );
}

// Three circular action buttons docked on the right of the header ·
// universal across every world · theming inherits from the engine so
// Ocean renders teal-rimmed buttons, Midnight renders magenta-rimmed
// buttons, French renders rose-wood-rimmed buttons, etc. No world-
// specific branches.
//
// RULE · every theme design MUST render all three icons (Home, Cart,
// Shop). The Shop icon toggles the slide-up shop sheet below the
// composer · universal behaviour · not per-theme-customisable.
function StandardHeaderActions({
  engine,
  shopOpen,
  onToggleShop,
}: {
  engine: ResolvedEngine;
  shopOpen: boolean;
  onToggleShop: () => void;
}): React.JSX.Element {
  // Universal Theme Controls Rule · sealed 2026-10-06 · header R1
  // buttons draw from engine.controlsTreatment() so they stay solid
  // and visible on every wallpaper regardless of world.
  const controls = engine.controlsTreatment();
  const baseBtn = controls.headerButton;
  const shopActiveBtn = controls.headerButtonActive;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        aria-label="Home"
        data-nex-se-header-action="home"
        style={baseBtn}
      >
        <HomeIcon />
      </button>
      <button
        type="button"
        aria-label="Cart"
        data-nex-se-header-action="cart"
        style={baseBtn}
      >
        <CartIcon />
      </button>
      <button
        type="button"
        aria-label={shopOpen ? "Close shop" : "Open shop"}
        aria-pressed={shopOpen}
        data-nex-se-header-action="shop"
        data-nex-se-shop-toggle={shopOpen ? "open" : "closed"}
        onClick={onToggleShop}
        style={shopOpen ? shopActiveBtn : baseBtn}
      >
        <ShopIcon />
      </button>
    </div>
  );
}

// Peer avatar · UNIVERSAL RULE across every theme ·
//   - Green rim ALWAYS (not theme-tinted · green is the universal
//     presence colour).
//   - When isOnline === true, a pulsing outer ring (ping) animates
//     outward infinitely so you can see the person is live.
// Fixture defaults isOnline → true in the preview.
const ONLINE_GREEN = "#22C55E";
const ONLINE_PING_KEYFRAMES = `
@keyframes nex-se-online-ping {
  0%   { transform: scale(1);   opacity: 0.75; }
  100% { transform: scale(1.9); opacity: 0;    }
}
`;

function PeerAvatarWithPresence({
  peer,
  engine,
}: {
  peer: StandardExperienceFixturePeer;
  engine: ResolvedEngine;
}): React.JSX.Element {
  const colours = engine.colours;
  const isOnline = peer.isOnline !== false;
  // R12 entry point 2 (sealed 2026-10-05) · tapping the peer avatar
  // opens their status viewer. In production this will route to the
  // viewer scoped to this peer; in preview it opens the dev viewer
  // tinted to the current engine's theme.
  const viewerHref = `/nex-native/dev/status-viewer-v1?theme=${encodeURIComponent(engine.package.identity.id)}`;
  return (
    <a
      href={viewerHref}
      aria-label={`Open ${peer.displayName}'s status`}
      data-nex-se-peer-avatar
      style={{
        position: "relative",
        width: 36,
        height: 36,
        flexShrink: 0,
        display: "block",
        textDecoration: "none",
      }}
    >
      <style>{ONLINE_PING_KEYFRAMES}</style>
      {isOnline && (
        <span
          aria-hidden
          data-nex-se-online-ping
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `2px solid ${ONLINE_GREEN}`,
            animation: "nex-se-online-ping 1.8s ease-out infinite",
            pointerEvents: "none",
          }}
        />
      )}
      <div
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: peer.avatarUrl
            ? `center/cover url(${peer.avatarUrl})`
            : `linear-gradient(135deg, ${colours.primary}, ${colours.secondary})`,
          border: `2px solid ${ONLINE_GREEN}`,
          boxShadow: isOnline ? `0 0 0 1px rgba(34,197,94,0.3)` : undefined,
        }}
      />
    </a>
  );
}

// Centered floating menu triggered by the composer-footer "+" button ·
// UNIVERSAL RULE across every theme. Contents (per founder-direction
// 2026-10-05):
//   - Contacts  → add a contact to the chat
//   - Product   → add / edit / delete / turn-off product
//   - Animation → open the full theme animation gallery
// Backdrop click dismisses. Theming inherits from the engine so each
// world's menu reads as part of its visual identity.
function FloatingPlusMenu({
  engine,
  open,
  onClose,
}: {
  engine: ResolvedEngine;
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const c = engine.colours;
  const option: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    padding: "12px 8px",
    width: "100%",
    minWidth: 0,
    borderRadius: 16,
    border: `1px solid ${c.primary}66`,
    background: `${c.primary}1a`,
    color: c.highlight,
    cursor: "pointer",
    textAlign: "center",
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 600,
    transition: "background 160ms ease-out, transform 160ms ease-out",
  };
  const iconCircle: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})`,
    color: c.highlight,
    boxShadow: `0 4px 12px ${c.primary}55`,
  };
  return (
    <div
      aria-hidden={!open}
      data-nex-se-plus-menu={open ? "open" : "closed"}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: open ? "auto" : "none",
        opacity: open ? 1 : 0,
        transition: "opacity 200ms ease-out",
      }}
    >
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />
      <div
        role="dialog"
        aria-label="Chat actions"
        style={{
          position: "relative",
          padding: 20,
          borderRadius: 24,
          background: `linear-gradient(180deg, ${c.deep}e6, ${c.deep}f5)`,
          border: `1px solid ${c.primary}99`,
          boxShadow: `0 20px 50px rgba(0,0,0,0.55), 0 0 0 1px ${c.primary}22`,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          minWidth: 340,
          maxWidth: "92%",
          transform: `scale(${open ? 1 : 0.9})`,
          transition:
            "transform 240ms cubic-bezier(0.2, 0.9, 0.3, 1.1), opacity 220ms ease-out",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: c.highlight,
            letterSpacing: "0.02em",
            textAlign: "center",
          }}
        >
          Add to this chat
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
            justifyItems: "center",
          }}
        >
          <a
            href="/nex-native/friends"
            data-nex-se-plus-action="contacts"
            aria-label="Add contact to chat"
            style={{ ...option, textDecoration: "none" }}
          >
            <span aria-hidden style={iconCircle}>
              <ContactsIcon />
            </span>
            <span>Contacts</span>
          </a>
          <a
            href="/nex-native/manage/products"
            data-nex-se-plus-action="product"
            aria-label="Add, edit, delete or turn off a product"
            style={{ ...option, textDecoration: "none" }}
          >
            <span aria-hidden style={iconCircle}>
              <ProductIcon />
            </span>
            <span>Product</span>
          </a>
          <a
            href={`/nex-native/themes/${engine.package.identity.id}/motion`}
            data-nex-se-plus-action="animation"
            aria-label="Open all theme animations"
            style={{ ...option, textDecoration: "none" }}
          >
            <span aria-hidden style={iconCircle}>
              <AnimationIcon />
            </span>
            <span>Animation</span>
          </a>
          <a
            href="/nex-native/settings"
            data-nex-se-plus-action="settings"
            aria-label="Open settings page"
            style={{ ...option, textDecoration: "none" }}
          >
            <span aria-hidden style={iconCircle}>
              <SettingsIcon />
            </span>
            <span>Settings</span>
          </a>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            alignSelf: "center",
            marginTop: 2,
            padding: "6px 14px",
            borderRadius: 999,
            border: `1px solid ${c.highlight}33`,
            background: "transparent",
            color: c.highlight,
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ContactsIcon(): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M15 14c3 0 6 1.5 6 5" />
    </svg>
  );
}

function ProductIcon(): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7.5 12 3l9 4.5v9L12 21 3 16.5v-9z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </svg>
  );
}

function AnimationIcon(): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2 l1.6 4.4 L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6z" />
      <path d="M18 15l0.8 2.2L21 18l-2.2 0.8L18 21l-0.8-2.2L15 18l2.2-0.8z" />
      <path d="M6 15l0.6 1.8L8 17.4l-1.4 0.6L6 19.8l-0.6-1.8L4 17.4l1.4-0.6z" />
    </svg>
  );
}

function SettingsIcon(): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .4 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.4 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .4-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.4-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.4H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.4 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </svg>
  );
}

// Floating lower-right 3-dots · UNIVERSAL RULE sealed 2026-10-05 ·
// tap to reveal Call / Video Call / Mic icons sliding in from the
// right. The + button now lives at the right of the composer footer
// (see ComposerPlusButton below) · it is NOT stacked here.
function FloatingCallActions({
  engine,
  open,
  onToggle,
  onFilesPicked,
}: {
  engine: ResolvedEngine;
  open: boolean;
  onToggle: () => void;
  /** Owner directive 2026-10-19 · camera + file-attach actions moved
   *  from the composer input footer into this 3-dot menu. Each
   *  button triggers a hidden <input type="file"> · the Camera one
   *  carries `capture="environment"` so mobile browsers open the
   *  rear phone camera, the File-Attach one accepts any mime type
   *  and multiple files. Both route picked files back through this
   *  callback so the parent can stage them as composer chips. */
  onFilesPicked: (files: FileList) => void;
}): React.JSX.Element {
  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  // Owner directive 2026-10-20 · the Call button opens the sealed
  // Calls hub (/nex-native/calls) so the user picks voice / video +
  // peer there · the hub routes voice/video via the sealed
  // ContactPickerModal → chat/peer/{id}?start_call=voice|video path
  // (real PeerCall engine). The Mic button stays unwired · it is a
  // voice-note affordance semantically distinct from a call.
  const router = useRouter();
  const openCallsHub = React.useCallback(() => {
    onToggle();
    router.push("/nex-native/calls");
  }, [onToggle, router]);
  // Universal Theme Controls Rule · sealed 2026-10-06 · lower-right
  // 3-dots stack uses the same solid-themed treatment as the header
  // R1 buttons so the chrome is visually coherent across every
  // world. 40×40 instead of 32×32 so the floating group has enough
  // tap-target weight without changing size.
  const controls = engine.controlsTreatment();
  const c = controls.colors;
  const circle: React.CSSProperties = {
    ...controls.headerButton,
    width: 40,
    height: 40,
    boxShadow: `0 6px 16px ${c.deep}66, 0 0 0 1px ${c.primary}55`,
  };
  // Three action buttons slide in from the right (toward the left of
  // the 3-dots trigger).
  const actionWrap: React.CSSProperties = {
    display: "flex",
    gap: 8,
    alignItems: "center",
    opacity: open ? 1 : 0,
    transform: `translateX(${open ? 0 : 20}px)`,
    transition:
      "opacity 220ms ease-out, transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
    pointerEvents: open ? "auto" : "none",
  };
  return (
    <div
      data-nex-se-call-actions={open ? "open" : "closed"}
      style={{
        /* Owner directive 2026-10-18 (further refined) · the 3-dot
           sits DIRECTLY above the + button on the same vertical
           line. The + button sits inside the composer row with
           padding-right: 10 · its right edge is at `right: 10` from
           the parent · so the 3-dot at `right: 10` lines up X-for-X.
           bottom: 72 lifts the circle one button-height + gap above
           the composer. */
        position: "absolute",
        right: 10,
        bottom: "calc(env(safe-area-inset-bottom, 0) + 72px)",
        zIndex: 9,
        display: "flex",
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
      }}
    >
      <div style={actionWrap}>
        {/* Owner directive 2026-10-19 · Status + Video retired · new
            Camera + File-Attach actions take their slots. Order
            left-to-right: Camera · File · Mic · Call. */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(ev) => {
            const files = ev.target.files;
            if (files && files.length > 0) onFilesPicked(files);
            /* Reset so selecting the same file twice fires change
               again · HTMLInputElement caches the last value. */
            ev.currentTarget.value = "";
          }}
          data-nex-se-call-action-input="camera"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          multiple
          hidden
          onChange={(ev) => {
            const files = ev.target.files;
            if (files && files.length > 0) onFilesPicked(files);
            ev.currentTarget.value = "";
          }}
          data-nex-se-call-action-input="file"
        />
        <button
          type="button"
          aria-label="Take photo with camera"
          data-nex-se-call-action="camera"
          onClick={() => cameraInputRef.current?.click()}
          style={circle}
        >
          <CameraCaptureIcon />
        </button>
        <button
          type="button"
          aria-label="Attach file from device"
          data-nex-se-call-action="file"
          onClick={() => fileInputRef.current?.click()}
          style={circle}
        >
          <FileAttachIcon />
        </button>
        <button
          type="button"
          aria-label="Mic"
          data-nex-se-call-action="mic"
          style={circle}
        >
          <MicIcon />
        </button>
        <button
          type="button"
          aria-label="Open Calls hub"
          data-nex-se-call-action="call"
          data-nex-se-call-action-wired="true"
          onClick={openCallsHub}
          style={circle}
        >
          <CallIcon />
        </button>
      </div>
      <button
        type="button"
        aria-label={open ? "Close actions" : "Open actions"}
        aria-pressed={open}
        onClick={onToggle}
        data-nex-se-call-actions-toggle={open ? "open" : "closed"}
        style={{
          ...circle,
          // Open state uses the universal solid-primary active
          // treatment with auto-contrast icon colour · sealed
          // 2026-10-06 · the icon colour comes from headerButtonActive
          // so a very light primary gets dark glyph automatically.
          background: open ? controls.headerButtonActive.background : circle.background,
          color: open ? controls.headerButtonActive.color : circle.color,
          border: open ? controls.headerButtonActive.border : circle.border,
          transition: "background 180ms ease-out, border 180ms ease-out, color 180ms ease-out",
        }}
      >
        <DotsVerticalIcon />
      </button>
    </div>
  );
}

// Composer-footer + button · sealed 2026-10-05 revision · sits on the
// right side of the footer, outside the input, next to the send glyph.
// Opens the centered + menu with the four sealed actions.
function ComposerPlusButton({
  engine,
  plusOpen,
  onTogglePlus,
}: {
  engine: ResolvedEngine;
  plusOpen: boolean;
  onTogglePlus: () => void;
}): React.JSX.Element {
  // Universal Theme Controls Rule · sealed 2026-10-06 · the + button
  // is a UNIVERSAL NEX semantic (near-black background on every
  // world · theme accent border/glow for integration). Same
  // philosophy as the universal gold NEW badge: "add to this chat"
  // must be instantly recognisable regardless of host theme.
  const controls = engine.controlsTreatment();
  return (
    <button
      type="button"
      aria-label={plusOpen ? "Close menu" : "Add to this chat"}
      aria-pressed={plusOpen}
      onClick={onTogglePlus}
      data-nex-se-composer-action="plus"
      data-nex-se-plus-toggle={plusOpen ? "open" : "closed"}
      style={plusOpen ? controls.plusButtonActive : controls.plusButton}
    >
      <PlusIcon />
    </button>
  );
}

function DotsVerticalIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="12" cy="5" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="12" cy="19" r="1.9" />
    </svg>
  );
}

function CallIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6A2 2 0 0 1 22 16.9z" />
    </svg>
  );
}

/* StatusIcon + VideoCallIcon retired 2026-10-19 · owner directive ·
   "remove the video icon and status button" from the lower-right
   3-dot menu · the two actions are replaced by Camera + File-Attach
   (CameraCaptureIcon + FileAttachIcon below). */

function CameraCaptureIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 8h3l1.6-2.2h6.8L17 8h3v12H4V8z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}

function FileAttachIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.5 11.5 12 21a5 5 0 0 1-7-7l9.5-9.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L16 7" />
    </svg>
  );
}

function MicIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function HomeIcon(): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

function CartIcon(): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H6" />
    </svg>
  );
}

function ShopIcon(): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8l1.5-4h15L21 8" />
      <path d="M3 8v2a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V8" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}
