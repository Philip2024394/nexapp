"use client";

// src/app/nex-native/themes/[id]/_viewer.tsx
//
// Bridge 97g · Client viewer for the dynamic theme preview.
// -------------------------------------------------------------------
// Mounts PortraitBloomShell (or the resolved chrome per layout_style
// once Phase 3 lands) with mock messages so the theme's accent,
// wallpaper, animation overlay, and bubble preset all render live.
//
// Every server-side action is a no-op stub — this page is view-only.
// A pill banner in the corner reminds the visitor it's preview mode.

import * as React from "react";
import Link from "next/link";
import {
  PortraitBloomShell,
  type PortraitBloomMessage,
} from "@/app/nex-native/chat/_portrait-bloom-shell";
import type { NexChatThemeLayoutStyle } from "@/lib/nex-native/chat-theme-service";
import {
  JokerMotionOverlay,
  type JokerMotionVariant,
} from "./_joker-motion";
import { JokerController } from "./_joker-controller";
import { getThemeAssets } from "@/lib/nex-native/theme-assets";
import { UniversalComposerFooter } from "../../chat-standard/_universal-composer-footer";
import { PlanetFlyThroughOverlay } from "@/lib/nex-native/planet-fly-through-client";
import type { BuiltInThemeEmoji } from "@/lib/nex-native/theme-asset-fallback";
import { TrustScan } from "@/app/nex-native/_trust-scan/TrustScan";
import { mockTrustScanProvider } from "@/app/nex-native/_trust-scan/trust-scan-mock-provider";
import { NEX_TRUST_SCAN_SKIN } from "@/app/nex-native/_trust-scan/trust-scan-skin";

interface ThemeViewerClientProps {
  themeId: string;
  themeName: string;
  /** Subline rendered under the theme name in the preview header.
   *  Sourced from `nex_chat_theme.tagline` (per-theme copy). Null
   *  hides the subline rather than showing a placeholder. Owner
   *  directive 2026-10-18 · retired the hardcoded "Photographer". */
  subtitle: string | null;
  accent: string;
  bubbleRim: string;
  composerRim: string;
  wallpaperUrl: string | null;
  wallpaperConfig:
    | {
        moonGlow?: { x: string; y: string; size: number; color?: string };
        particleDrift?: { color: string; count?: number; direction?: "up"; size?: number; speedSeconds?: number };
        sparkle?: { color: string; count?: number; size?: number; twinkleSeconds?: number };
        bubbleStyle?: { preset: "classic" | "pill" | "square" | "outlined" | "gradient" };
      }
    | null;
  layoutStyle: NexChatThemeLayoutStyle;
  /** Bridge 97g · sample-message timestamps computed on the server
   *  so SSR + client hydration see identical strings. Fixes a
   *  hydration mismatch caused by Date.now() drift. */
  sentAts: {
    m1: string;
    m2: string;
    m3: string;
    m4: string;
    m5: string;
    readEarly: string;
    readMid: string;
    readLate: string;
  };
  /** ?mode=menu flips the shop slider into venue mode · cutlery icon
   *  in the header + "Menu" eyebrow inside the modal. */
  isVenueMode: boolean;
  /** ?shop_setup=1 renders the first-time 3-button chooser (Sell
   *  Products / Sell Food / Affiliate) in the shop slider instead of
   *  the product grid. Preview-only trigger · the real flow decides
   *  this based on whether the current user has a configured shop. */
  showShopSetupChooser?: boolean;
  /** Bridge ThemeEmoji-B · this theme's emoji set from
   *  nex_theme_emoji. Threaded through PortraitBloomShell into
   *  PeerComposer's EmojiModal so the picker shows image tiles when
   *  the theme has a custom set. */
  themeEmojis?: { slug: string; imageUrl: string; label: string }[];
  /** Bridge ThemeSticker · sealed 2026-10-01 · this theme's sticker
   *  set from nex_theme_sticker (Migration 118). Threaded through
   *  PortraitBloomShell into PeerComposer's EmojiModal so the Stickers
   *  tab appears when the theme has a sticker set. */
  themeStickers?: {
    slug: string;
    imageUrl: string;
    label: string;
    stickerType: "static" | "animated";
    aspectRatio: number;
  }[];
  /** Joker motion prototype · sealed 2026-10-01 · when set, a full-
   *  screen pointer-events:none overlay renders above the wallpaper
   *  with the chosen effect (rain · sparks · bat · cards · lightning
   *  · bubbles · confetti · smoke · embers · glitch). Null hides it. */
  motionVariant?: JokerMotionVariant | null;
}

// Mock catalogue for the preview shop slider · 3 products + 2 menu
// items. Both kinds always appear in the array; PortraitBloomShell's
// ShopGridModal renders them uniformly, only the header icon +
// eyebrow copy toggle based on isVenue.
// Shop name + shop_display_name are filled from the current theme name
// at render time so the slider always reads as the business viewing it.
const MOCK_PREVIEW_SHOP_PRODUCTS = {
  products: [
    {
      id: "preview-p1",
      kind: "product" as const,
      name: "Golden Hour Print · A3",
      description: "Signed archival print from the pier series. Cotton rag, matte.",
      price_pence: 42500000,
      currency: "IDR",
      image_url: null,
      tags: ["print", "photography", "limited"],
      stock_status: "in_stock",
    },
    {
      id: "preview-p2",
      kind: "product" as const,
      name: "Studio Session · 2hr",
      description: "Portrait session with light retouching. Digital + 6 prints included.",
      price_pence: 185000000,
      currency: "IDR",
      image_url: null,
      tags: ["service", "portrait"],
      stock_status: "in_stock",
    },
    {
      id: "preview-p3",
      kind: "product" as const,
      name: "Handmade Photo Book",
      description: "60-page linen-bound book of the sunset pier series. Limited to 20.",
      price_pence: 67500000,
      currency: "IDR",
      image_url: null,
      tags: ["book", "limited"],
      stock_status: "low_stock",
    },
    {
      id: "preview-m1",
      kind: "menu_item" as const,
      name: "Oat Latte",
      description: "Slow-poured. Cinnamon dusted on request.",
      price_pence: 3500000,
      currency: "IDR",
      image_url: null,
      tags: ["drink", "coffee"],
      stock_status: "in_stock",
    },
    {
      id: "preview-m2",
      kind: "menu_item" as const,
      name: "Nasi Goreng Spesial",
      description: "House recipe with fried egg + kerupuk. Vegetarian option.",
      price_pence: 4500000,
      currency: "IDR",
      image_url: null,
      tags: ["food", "signature"],
      stock_status: "in_stock",
    },
  ],
  context: {
    shop_id: "preview-shop",
    shop_slug: null,
    shop_owner_account_id: "preview-owner",
  },
};

// Owner directive 2026-10-18 · retired. The Maria Santos portrait is
// no longer used as the preview peer avatar · each theme now shows a
// cropped section of its own wallpaper (or the sealed initials
// gradient when wallpaperUrl is null). Constant removed to keep the
// file honest about current behaviour.

export default function ThemeViewerClient(
  props: ThemeViewerClientProps,
): React.JSX.Element {
  // All timestamps come from the SERVER props · no Date.now() here,
  // no hydration mismatch. Bridge 97g.
  const s = props.sentAts;
  // Scan game dismissal · once the user clicks Dismiss on the Trust
  // Scan, both the scan AND the glitch overlay (scan sweep + reveal
  // image) stop rendering so the chat returns to its pre-scan state.
  const [scanGameCleared, setScanGameCleared] = React.useState(false);
  // Independent trigger for Trust Scan opened from the 3-dots action
  // card (not via the glitch motion variant). Lets the user preview
  // the scan without reloading with ?motion=glitch.
  const [trustScanOpenRequest, setTrustScanOpenRequest] =
    React.useState(false);

  // Bridge Reactions-Order · sealed 2026-10-01 · preview now uses
  // useState so the founder can tap reaction tiles in the picker and
  // see the big-newest + small-older stack update live · no DB write.
  const [messages, setMessages] = React.useState<PortraitBloomMessage[]>(
    () => [
      {
        id: "sample-3",
        body: "Sending the top 10 now.\nRoll #2 is my favourite.",
        sent_at: s.m3,
        read_at: s.readMid,
        mine: false,
      },
      {
        id: "sample-4",
        body: "The one with the golden hour light?\nLegendary.",
        sent_at: s.m4,
        read_at: s.readLate,
        mine: true,
      },
      {
        id: "sample-5",
        body: "Grab you a coffee on the way?",
        sent_at: s.m5,
        read_at: null,
        mine: false,
      },
    ],
  );

  // Preview mode: composer + upload etc. are still no-ops · nothing
  // writes to the DB. But the reaction toggle IS wired to local state
  // so the founder can validate the big-newest + small-older behaviour
  // end-to-end from the picker.
  const noopAction = async () => {
    /* preview only · no writes */
  };

  // Bridge ThemeSticker · sealed 2026-10-01 · preview-mode sticker
  // send. Matches the live contract: client posts ONLY the slug, the
  // "server" (here · the mirror of the real server action) resolves
  // the authoritative sticker record from props.themeStickers (which
  // was itself DB-sourced server-side in page.tsx). Mirrors how the
  // real sendPeerStickerAction looks up nex_theme_sticker · keeps the
  // preview and production paths behaving identically.
  const previewSendSticker = React.useCallback(
    async (formData: FormData) => {
      const slug = String(formData.get("theme_sticker_slug") ?? "").trim();
      if (!slug) return;
      if (!/^[a-z0-9][a-z0-9_-]{0,60}$/.test(slug)) return;
      const sticker = (props.themeStickers ?? []).find((s) => s.slug === slug);
      if (!sticker) return;
      if (sticker.stickerType !== "static") return;
      setMessages((prev) => [
        ...prev,
        {
          id: `preview-sticker-${Date.now()}`,
          body: "",
          sent_at: new Date().toISOString(),
          read_at: null,
          mine: true,
          attachment_url: sticker.imageUrl,
          attachment_type: "sticker",
          attachment_sticker: {
            theme_id: props.themeId,
            slug: sticker.slug,
            label: sticker.label,
            sticker_type: sticker.stickerType,
            aspect_ratio: sticker.aspectRatio,
          },
        },
      ]);
    },
    [props.themeId, props.themeStickers],
  );

  // Sealed 2026-10-11 · UniversalComposerFooter's Send button fires
  // this · body + optional staged emoji land in the preview message
  // list exactly like the sealed sticker send. Emoji becomes an
  // attachment_type="theme-emoji" message · body (if any) is text
  // sent on the SAME message · the shell's bubble renderer paints
  // both text + 56px emoji together.
  const previewSendMessage = React.useCallback(
    (payload: { body: string; emoji: BuiltInThemeEmoji | null }) => {
      const trimmed = payload.body.trim();
      const emoji = payload.emoji;
      if (!trimmed && !emoji) return;
      const now = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        emoji
          ? {
              id: `preview-emoji-${Date.now()}`,
              body: trimmed,
              sent_at: now,
              read_at: null,
              mine: true,
              attachment_url: emoji.image_url,
              attachment_type: "theme-emoji",
              attachment_theme_emoji: {
                theme_id: props.themeId,
                slug: emoji.slug,
                label: emoji.label,
              },
            }
          : {
              id: `preview-msg-${Date.now()}`,
              body: trimmed,
              sent_at: now,
              read_at: null,
              mine: true,
            },
      ]);
    },
    [props.themeId],
  );

  // Client-side simulation of toggleMessageReaction · mirrors the
  // server semantics: 0→1 append to reactions_order, N→0 remove from
  // reactions_order · other transitions leave the order alone.
  const previewToggleReaction = React.useCallback(
    async (formData: FormData) => {
      const messageId = String(formData.get("message_id") ?? "").trim();
      const emoji = String(formData.get("emoji") ?? "");
      if (!messageId || !emoji) return;
      const selfId = "preview-self";
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const reactions = { ...(m.reactions ?? {}) };
          const order = [...(m.reactions_order ?? Object.keys(reactions))];
          const prevList = reactions[emoji] ?? [];
          const prevLen = prevList.length;
          const idx = prevList.indexOf(selfId);
          const nextList =
            idx >= 0
              ? prevList.filter((id) => id !== selfId)
              : [...prevList, selfId];
          if (nextList.length === 0) {
            delete reactions[emoji];
          } else {
            reactions[emoji] = nextList;
          }
          let nextOrder = order;
          if (prevLen === 0 && nextList.length > 0) {
            nextOrder = order.filter((e) => e !== emoji).concat(emoji);
          } else if (prevLen > 0 && nextList.length === 0) {
            nextOrder = order.filter((e) => e !== emoji);
          }
          return { ...m, reactions, reactions_order: nextOrder };
        }),
      );
    },
    [],
  );

  // Bubbles is the world-class chrome and works with every theme's
  // wallpaperConfig (halo · drift · sparkle · bubbleStyle). Terminal
  // + other non-bubbles layouts have their own sealed preview page
  // for now · Phase 3 lifts them into runtime chromes.
  const effectiveLayout = props.layoutStyle === "bubbles" ? "bubbles" : "bubbles";

  // 2026-10-15 · owner-authorised flag for the two free NEX themes.
  // Any theme whose name starts with "NEX " (NEX Original · NEX Blue
  // Centre · future NEX-brand themes) opts in to:
  //   · PortraitBloomShell `useNexPingBadge` (shared ping identity)
  //   · PlanetFlyThroughOverlay (ambient planets drifting across the
  //     viewport · pure CSS gradient circles · zero runtime cost after
  //     mount · respects prefers-reduced-motion)
  const isNexBrandTheme = (props.themeName || "")
    .trim()
    .toUpperCase()
    .startsWith("NEX ");

  return (
    <>
      {/* Founder direction 2026-10-01 · the "← Gallery", "Preview ·
          <theme>" and "Shop / Menu mode" pill cluster that used to
          live at the top-left has been removed on every theme so the
          preview reads as an untouched chat window. Header buttons
          are now identical to the real peer-chat header · same
          right-cluster (Home / Shop / Menu / Cart) on every theme.
          To flip the shop slider between Shop and Menu presentation
          use ?mode=menu on the URL · no on-screen toggle. */}

      {isNexBrandTheme && <PlanetFlyThroughOverlay />}

      <PortraitBloomShell
        scope="theme-preview"
        /* Founder direction 2026-10-01 · the peer display name is the
           theme's name (Joker · Pink Dream · Night Sky · …).
           Owner directive 2026-10-18 · retired the "Maria" fallback
           and the hardcoded "Photographer" subtitle · the preview
           reads as the Theme, not a fictional persona. Subtitle is
           per-theme (nex_chat_theme.tagline) and may be null · the
           primitive hides the row rather than printing a placeholder. */
        displayName={props.themeName}
        subtitle={props.subtitle}
        /* 2026-10-15 · NEX-brand theme previews swap the Maria portrait
           for the shared NEX ping badge (blue ring + ping + "NE") so
           the preview matches landing + welcome brand identity. */
        useNexPingBadge={isNexBrandTheme}
        /* Owner directive 2026-10-18 · the theme profile avatar
           renders a cropped section of the theme's own wallpaper
           so the circle visibly reads as "this theme". Null falls
           back to the sealed initials gradient (ChatIdentityHeader
           handles the fallback internally) · the retired Maria
           portrait is no longer used anywhere in the preview. */
        portraitUrl={props.wallpaperUrl}
        presenceKind="online"
        presenceLabel="OPEN · here now"
        rippleColor={props.accent}
        bubbleRimColor={props.bubbleRim}
        composerRimColor={props.composerRim}
        wallpaperUrl={props.wallpaperUrl}
        wallpaperConfig={props.wallpaperConfig}
        layoutStyle={effectiveLayout}
        backHref="/nex-native/themes/gallery"
        messages={messages}
        composerAction={noopAction}
        composerPlaceholder="Preview mode · sending disabled"
        contacts={[]}
        pendingInvites={[]}
        selfAccountId="preview-self"
        /* Bridge 97h · mock shop so the header shop icon appears
           and the slider (products + menu items) opens with the
           theme's colours applied. Cart-order + inquiry actions
           are noop stubs so nothing writes to the DB. */
        peerShop={{
          name: props.themeName,
          href: null,
          products: MOCK_PREVIEW_SHOP_PRODUCTS.products,
          context: {
            ...MOCK_PREVIEW_SHOP_PRODUCTS.context,
            shop_display_name: props.themeName,
          },
          isVenue: props.isVenueMode,
        }}
        sendCartOrderAction={noopAction}
        productInquiryAction={noopAction}
        uploadAction={noopAction}
        toggleReactionAction={previewToggleReaction}
        themeEmojis={props.themeEmojis}
        themeStickers={props.themeStickers}
        sendStickerAction={previewSendSticker}
        /* Per-theme send button · the Joker theme (theme-0) overrides
           the default orange disc with the Batman roundel. Other themes
           fall through to the default rendering. */
        themeSendButtonUrl={
          props.themeId === "theme-0"
            ? "/nex-themes/joker-send-button.png"
            : null
        }
        /* Bridge 97h · force Cart button visible in previews even
           while NEX_COMMERCE_ENABLED is false during the Indonesia
           launch. Preview shows the full [Home] [Shop] [Cart]
           cluster · Founder ask: "same buttons as dream theme". */
        forceShowCart
        /* Shop-type chooser · when ?shop_setup=1 is on the URL the
           slider opens in first-time setup mode (3 buttons: Sell
           Products / Sell Food / Affiliate). Preview only. */
        showShopSetupChooser={props.showShopSetupChooser}
        onSelectShopType={(type) => {
          // Preview handler · the real path routes to the Profession
          // picker (Migrations 113-115) for products/food, or the
          // affiliate waitlist for affiliate. Here just log so the
          // founder can confirm the tap wiring works end-to-end.
          // eslint-disable-next-line no-console
          console.log("[preview] shop-type selected:", type);
        }}
        /* Per-theme shop backdrop · resolved via theme-assets.ts
           (same helper the real peer-chat page uses). Joker gets the
           alley wallpaper; themes without a slot fall through to the
           modal's default gradient. */
        shopBackgroundImageUrl={getThemeAssets(props.themeId).shopBackgroundUrl}
      />
      {/* Joker motion prototype overlay · query-string driven via
          ?motion=<variant> · see _joker-motion.tsx for the ten
          sealed variants + the motion-picture animation standards.
          `scanGameCleared` suppresses the glitch overlay once the
          user has dismissed the stats card, so the chat returns to
          its untouched wallpaper state. */}
      <JokerMotionOverlay
        variant={
          scanGameCleared && props.motionVariant === "glitch"
            ? null
            : props.motionVariant ?? null
        }
      />
      {/* Joker-theme animation controller · 3-dots floating trigger +
          full-screen panel of toggles. Only mounted for theme-0 so
          other themes stay quiet. */}
      {props.themeId === "theme-0" && (
        <JokerController
          onOpenTrustScan={() => setTrustScanOpenRequest(true)}
        />
      )}
      {/* NEX Trust Scan · NEX product with ONE visual identity across
          every chat theme (Joker, Night Sky, Pink Dream, future).
          Theme-neutral by sealed doctrine · opened via ?motion=glitch
          during Phase 1 preview, future trigger is a universal Scan
          button in the chat header. Dismiss stops the glitch overlay
          too so the chat returns to its pre-scan state. See
          `_trust-scan/trust-scan-types.ts` for the typed data contract
          and `nex_trust_scan_doctrine_2026_10_01.md` in memory for
          the sealed design. */}
      {((props.motionVariant === "glitch" && !scanGameCleared) ||
        trustScanOpenRequest) && (
        <TrustScan
          scannedAccountId="preview-peer"
          viewerAccountId="preview-self"
          skin={NEX_TRUST_SCAN_SKIN}
          provider={mockTrustScanProvider}
          onDismiss={() => {
            setScanGameCleared(true);
            setTrustScanOpenRequest(false);
          }}
        />
      )}
      {/* Sealed 2026-10-11 · UniversalComposerFooter mounted HERE
          (was in page.tsx as a sibling · the shared `setMessages`
          state is in this client scope, so hoisting the composer
          into the viewer gives it a working onSendMessage → chat
          wire). Picked emoji + typed text post into the preview
          message list immediately and render in the shell. */}
      <UniversalComposerFooter
        accent={props.accent}
        themeId={props.themeId}
        onSendMessage={previewSendMessage}
      />
    </>
  );
}
