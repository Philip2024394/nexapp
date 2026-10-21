"use client";

// src/app/nex-native/themes/[id]/_standard-experience-live-client.tsx
//
// Live-chat surface for Standard-Experience-backed themes.
//
// Mounts the full Standard Experience chrome (header icons + bubbles
// + composer + shop sheet + call actions + + menu + ambient layer)
// for the given world, filling the viewport so the user sees exactly
// what they will see as the live chat.
//
// Rule (sealed 2026-10-05): visiting `/nex-native/themes/<world-id>`
// where `world-id` is a Standard-Experience world opens the live chat
// with that theme applied. Current scope: Botanical / Midnight /
// French (and Ocean / Coffee which share the same engine).
//
// No DB writes · peer and products are fixture data for the preview.
// Real session wiring is Phase 2A.1 work.

import * as React from "react";
import { createEngine } from "../../chat-standard/_engine/theme-engine";
import type { ThemePackage } from "../../chat-standard/_engine/types";
import {
  StandardExperience,
  type StandardExperienceSeedMessage,
} from "../../chat-standard/_standard-experience";
import { NexPlanetApproachClient } from "@/lib/nex-native/nex-planet-approach-client";
import { MarkSelectedThemeClient } from "./_mark-selected-theme-client";

// Owner directive 2026-10-18 · removed the Maria Santos / Footwear
// Designer · Lisbon fixture persona · a theme preview should read as
// "this is what the theme looks like", not as a stolen peek at a
// fictional person's chat. The identity now comes from the theme
// itself (name + tagline from the sealed ThemeIdentity).
//
// NEX_GUEST_PEER stays · it is a guest-onboarding affordance, not
// a persona · NEX-brand previews (NEX Original · NEX Blue Centre ·
// future "NEX "-prefixed themes) show this instead so the viewer
// sees the brand identity + "create an account" prompt until signed
// in. Owner directive 2026-10-15, preserved.
const NEX_GUEST_PEER = {
  accountId: "fx-nex-brand",
  displayName: "NEX",
  tagline: "Welcome Guest",
  avatarUrl: null as string | null,
  isOnline: true,
};

const SEED_MESSAGES: StandardExperienceSeedMessage[] = [
  /* Owner directive 2026-10-18 · "chat theme chat must be able
     scrolling up or down". Expanded the preset conversation so the
     message column overflows the chat area · the sealed overflow-y
     auto on [data-nex-se-messages] then enables scroll. Previous
     4-message seed exactly filled the clientHeight · no overflow ·
     no scroll possible. */
  {
    id: "s1",
    mine: false,
    body: "hey! just finished the sketches for the new sandal line 🌊",
  },
  { id: "s2", mine: true, body: "ooh — show me!" },
  { id: "s3", mine: false, body: "sending samples now, tell me what you think" },
  {
    id: "s4",
    mine: true,
    body: "love the colour palette — very underwater",
  },
  { id: "s5", mine: false, body: "the shell mule turned out exactly how I pictured it 🐚" },
  { id: "s6", mine: true, body: "that pearl inlay is magic" },
  { id: "s7", mine: false, body: "working on a limited pearl diver next · 20 pairs only" },
  { id: "s8", mine: true, body: "put me down for a size 7!" },
  { id: "s9", mine: false, body: "noted ✍️ · launch is next Tuesday" },
  { id: "s10", mine: true, body: "cant wait" },
  { id: "s11", mine: false, body: "also · the reef walker neoprene arrived · it's PERFECT" },
  { id: "s12", mine: true, body: "colour tests at the weekend?" },
  { id: "s13", mine: false, body: "yes please · bring the mood board 📒" },
  { id: "s14", mine: true, body: "i'll grab coffees on the way" },
  { id: "s15", mine: false, body: "ok see you Saturday 🌊" },
];

const PRODUCTS = [
  {
    id: "p1",
    name: "Driftwood Sandal",
    tagline: "Hand-cut leather · ocean-ready",
    price: "€89",
    imageUrl: null,
  },
  {
    id: "p2",
    name: "Shell Mule",
    tagline: "Mother-of-pearl inlay",
    price: "€120",
    imageUrl: null,
  },
  {
    id: "p3",
    name: "Reef Walker",
    tagline: "Quick-dry neoprene",
    price: "€65",
    imageUrl: null,
  },
  {
    id: "p4",
    name: "Pearl Diver",
    tagline: "Minimalist leather slip-on",
    price: "€105",
    imageUrl: null,
  },
];

export interface StandardExperienceLiveThemeEmoji {
  slug: string;
  imageUrl: string;
  label: string;
}
export interface StandardExperienceLiveThemeSticker {
  slug: string;
  imageUrl: string;
  label: string;
  stickerType: string;
  aspectRatio: number;
}

export function StandardExperienceLiveClient({
  pkg,
  viewerNexHandle,
  themeEmojis,
  themeStickers,
  userIntroOverlay = null,
  initialShopOpen = false,
}: {
  pkg: ThemePackage;
  /** Owner directive 2026-10-19 · when the viewer is signed in, the
   *  header subtitle shows the viewer's own NEX handle (e.g. "234234")
   *  instead of the theme's tagline. Guests pass null and fall back
   *  to the sealed guest/theme-tagline behaviour. */
  viewerNexHandle?: string | null;
  /** Owner directive 2026-10-19 · DB-backed (or filesystem-fallback)
   *  theme emoji rows resolved server-side in page.tsx. When non-
   *  empty, the composer's emoji picker renders these image-based
   *  tiles in place of the hardcoded Unicode base set. */
  themeEmojis?: readonly StandardExperienceLiveThemeEmoji[];
  /** Same model as themeEmojis for stickers. */
  themeStickers?: readonly StandardExperienceLiveThemeSticker[];
  /** Owner directive 2026-10-20 · the signed-in viewer's own saved
   *  intro settings · forwarded to StandardExperience →
   *  StandardIntroOverlay so the viewer's personal title + typography
   *  renders on top of the theme intro video. Null (or omitted) for
   *  guest viewers · the overlay then plays the theme intro
   *  unmodified. */
  userIntroOverlay?:
    | import("@/lib/nex-native/intro-settings-service").IntroSettings
    | null;
  /** Owner directive 2026-10-20 · auto-opens the sealed shop-chooser
   *  sheet when the viewer lands with ?shop=open · completes the
   *  Bisnis setup flow (chat theme → shop cover → chat theme live
   *  with the 5-tile category chooser visible). */
  initialShopOpen?: boolean;
}): React.JSX.Element {
  const engine = React.useMemo(() => createEngine(pkg), [pkg]);
  const [localMessages, setLocalMessages] = React.useState<
    StandardExperienceSeedMessage[]
  >([]);

  // 2026-10-15 · owner directive · NEX-brand theme previews (NEX
  // Original · NEX Blue Centre · any future "NEX "-prefixed theme)
  // present NEX itself as the chat peer until the user creates an
  // account. For every other theme the identity now derives from
  // the theme itself (owner directive 2026-10-18 · Maria Santos
  // fixture retired). `pkg.identity.name` is the theme name, and
  // `pkg.identity.tagline` is the theme-authored subline · each
  // package controls its own copy, so Ocean reads as "Ocean" +
  // Ocean's tagline, Hammerex reads as "Hammerex Industrial" +
  // its tagline, etc.
  const isNexBrandTheme = pkg.identity.name
    .trim()
    .toUpperCase()
    .startsWith("NEX ");
  // Owner directive 2026-10-19 · signed-in viewers see their own
  // NEX handle below the theme name in the preview header, prefixed
  // with a single capital "NEX - " (owner directive · "there is only
  // 1 NEX"). Account handles persisted as `nex-10842` get the
  // lowercase `nex-` prefix stripped so the final line reads
  // "NEX - 10842" and not the duplicated "NEX - nex-10842". Guests
  // keep the sealed brand-guest copy for NEX-brand previews and fall
  // back to the theme's own tagline for every other theme.
  const previewSubtitle: string | null = (() => {
    const raw = viewerNexHandle?.trim() ?? "";
    if (raw.length === 0) {
      return pkg.identity.tagline?.trim() || null;
    }
    const stripped = raw.replace(/^nex[-_]?/i, "");
    return `NEX - ${stripped}`;
  })();
  const peer = isNexBrandTheme
    ? NEX_GUEST_PEER
    : {
        accountId: `theme-${pkg.identity.id}`,
        displayName: pkg.identity.name,
        tagline: previewSubtitle,
        /* Owner directive 2026-10-18 · the theme profile avatar
           renders a cropped section of the theme's wallpaper so the
           circle visibly reads as "this theme". Falls back to null
           (initials gradient) for packages that ship wallpaperUrl =
           null (atmospheric themes · botanical/coffee/french/midnight
           cafés). */
        avatarUrl: (pkg.wallpaperUrl ?? null) as string | null,
        isOnline: true,
      };

  const handleSend = React.useCallback((body: string) => {
    setLocalMessages((prev) => [
      ...prev,
      { id: `l-${Date.now()}-${prev.length}`, mine: true, body },
    ]);
  }, []);

  // The live-chat surface is a true full-viewport mount · no phone-
  // frame border, no header strip, no chip row. The Standard
  // Experience owns the entire viewport so what the user sees IS the
  // live theme.
  //
  // Back-nav button (sealed 2026-10-11) · a single 36px circular
  // back arrow pinned top-left of the viewport, above the sealed
  // StandardHeader's R1 cluster z-index. Replaces the removed
  // `ThemeActivateOverlay` without re-introducing its square popup
  // or multi-button layout · users told us the overlay was too
  // intrusive · a single discreet back arrow is the minimum
  // navigation affordance that keeps the live chat preview
  // escapable without the browser back button.
  return (
    <div
      data-nex-standard-experience-live
      data-nex-personal-chat-preview={isNexBrandTheme ? "true" : undefined}
      style={{
        /* Owner directive 2026-10-18 · "iPhone frame on desktop keeping
           screen size max size" · dropped `position: fixed` escape so
           the preview respects the surrounding `.nex-native-frame`
           (420×909 on desktop · full-viewport on mobile). Previous
           full-viewport mount escaped the frame on desktop and made
           the preview look like a different product. */
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#000",
      }}
    >
      {/* Owner directive 2026-10-21 (iteration 29) · for NEX-brand
          personal-chat themes (nex-bubbles · the single free chat),
          hide the business/shop widgets that the sealed
          StandardExperience renders by default:
            · the shop toggle button (Sell on NEX / Earn with NEX
              bottom sheet trigger)
            · the shop sheet itself (even translated off-screen it
              can be interacted with via a11y tree)
            · the + button that opens the plus menu (Add to this chat)
            · the plus menu panel (Contacts · Product · Animation ·
              Settings · Cancel)
          Keep: composer input, emoji picker, send button, chat bubbles,
          header, preview action bar (Back / Use). The sealed
          StandardExperience is NOT forked · we scope `display: none`
          to data-nex-personal-chat-preview so only this surface is
          affected · every other theme preview + real chat continues
          to render the full chrome. */}
      {isNexBrandTheme && (
        <style>{`
          [data-nex-personal-chat-preview="true"] [data-nex-se-shop-toggle],
          [data-nex-personal-chat-preview="true"] [data-nex-se-shop-sheet],
          [data-nex-personal-chat-preview="true"] [data-nex-se-plus-menu],
          [data-nex-personal-chat-preview="true"] button[aria-label="Add to this chat"],
          [data-nex-personal-chat-preview="true"] button[aria-label="Close menu"] {
            display: none !important;
          }
        `}</style>
      )}
      {/* NEX planet-approach control + animation · 3-dots trigger in
          the bottom-right opens a vertical panel with one button that
          plays the "planet approaching the camera and flying by"
          animation. Mounted only on NEX-brand theme previews
          (owner directive 2026-10-15). */}
      {isNexBrandTheme && <NexPlanetApproachClient />}

      {/* 2026-10-15 · owner-authorised · remember which free NEX
          theme the guest previewed so `createNexAccountAction` can
          redirect them straight back to it after signup. Fire-and-
          forget cookie beacon · no visual UI · harmless when the
          viewer is already authenticated. */}
      {isNexBrandTheme && <MarkSelectedThemeClient themeId={pkg.identity.id} />}

      <StandardExperience
        engine={engine}
        peer={peer}
        seedMessages={SEED_MESSAGES}
        products={PRODUCTS}
        onSendLocalMessage={handleSend}
        localMessages={localMessages}
        wallpaperFallback="theme-gradient"
        themeEmojis={themeEmojis}
        themeStickers={themeStickers}
        /* Owner directive 2026-10-20 · theme-preview surface replays
           the intro every visit · auditioning themes requires seeing
           the intro each time · twice-then-skip is correct for real
           chat sessions, wrong for preview. */
        alwaysPlayIntro
        /* Owner directive 2026-10-20 · personal title overlay · the
           signed-in viewer's own saved intro renders on top of the
           theme intro video so "View Theme" matches the real visitor
           experience. Null when the viewer is a guest. */
        userIntroOverlay={userIntroOverlay}
        /* Owner directive 2026-10-20 · Bisnis setup flow lands here
           with ?shop=open · auto-opens the 5-tile category chooser. */
        initialShopOpen={initialShopOpen}
      />
      {/* Owner directive 2026-10-19 · "remove the back button from
          header" · the sealed 2026-10-11 back-arrow at top-left is
          retired · navigation out of the preview is now handled by
          the Home icon in the side drawer (routes to the contacts
          page) + the sealed ThemePreviewActionBar's "← Back to
          themes" link at the bottom + the browser back button. */}
    </div>
  );
}
