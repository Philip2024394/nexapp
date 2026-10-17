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
import Link from "next/link";
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
  tagline: "You are a guest · create an account to chat",
  avatarUrl: null as string | null,
  isOnline: true,
};

const SEED_MESSAGES: StandardExperienceSeedMessage[] = [
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

export function StandardExperienceLiveClient({
  pkg,
}: {
  pkg: ThemePackage;
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
  const peer = isNexBrandTheme
    ? NEX_GUEST_PEER
    : {
        accountId: `theme-${pkg.identity.id}`,
        displayName: pkg.identity.name,
        tagline: pkg.identity.tagline?.trim() || null,
        avatarUrl: null as string | null,
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
      />
      <Link
        href="/nex-native/chat-themes-library"
        data-nex-theme-preview-back
        aria-label="Back to themes"
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0) + 10px)",
          left: 10,
          zIndex: 150,
          width: 36,
          height: 36,
          borderRadius: 999,
          background: "rgba(0,0,0,0.55)",
          color: "#F4F7FC",
          border: "1px solid rgba(255,255,255,0.22)",
          display: "grid",
          placeItems: "center",
          fontSize: 18,
          textDecoration: "none",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 4px 14px -4px rgba(0,0,0,0.6)",
        }}
      >
        <span aria-hidden>←</span>
      </Link>
    </div>
  );
}
