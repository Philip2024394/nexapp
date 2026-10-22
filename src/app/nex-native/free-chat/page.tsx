// src/app/nex-native/free-chat/page.tsx
//
// NEX · Free Chat · standalone minimal chat preview.
// Owner-authorised 2026-10-21 (iteration 30 · rebuild).
// -----------------------------------------------------------------------------
// Replaces the previous /themes/nex-bubbles destination for the Free
// NEX Chat welcome card. Prior iterations tried to hide the sealed
// StandardExperience's business widgets (shop sheet · plus menu ·
// Sell/Earn categories) via CSS display:none scoping · the owner
// chose to rebuild from scratch instead so the free chat surface
// doesn't inherit any sealed Chat Master Layout chrome it doesn't
// need.
//
// Scope (explicit):
//   · Guest-safe · no session required.
//   · Shows a NEX-branded identity header (ping badge · wordmark).
//   · Renders a seeded chat with 2-3 sample bubbles so the user
//     sees what a NEX chat looks like.
//   · Composer: text input + emoji glyph + send button.
//     NO + menu / shop toggle / sell/earn categories / add-to-chat
//     drawer options.
//   · Guest-only "Create free NEX" footer CTA.
//   · Signed-in users see the same chat without the CTA.
//
// Not touched here:
//   · Sealed ChatIdentityHeader / ChatComposerPill primitives · the
//     Chat Master Layout memo forbids forking. We don't reuse them
//     either on this surface because the sealed primitives drag in
//     chat-chrome features we don't need. The next audit decision is
//     whether this standalone page should be migrated to the sealed
//     primitives for a real chat later · for now it stays simple.
//   · /themes/nex-bubbles · still works for direct links / theme
//     previews · just not from the welcome card.
//   · Database · zero reads / writes.

import type * as React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { devPreviewOn } from "@/lib/nex-native/app/dev-preview";
import { isAdminSession } from "@/lib/nex-native/app/admin";
import { effectiveTier } from "@/lib/nex-native/account-service";
import {
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";
import { FreeChatComposerClient } from "./_composer-client";
import { FreeChatCallCenterDrawerClient } from "./_call-center-drawer-client";
import { FreeChatCanvasClient, type SeedMessage } from "./_canvas-client";
import {
  freeChatBackgroundCss,
  resolveFreeChatWallpaperUrl,
  type OutgoingDeliveryStatus,
} from "./_types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#071525",
  panelSoft: "rgba(7, 21, 37, 0.84)",
  border: "rgba(0, 175, 255, 0.18)",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanBubble: "rgba(0, 175, 255, 0.12)",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  orange: "#FF7200",
  // Owner directive 2026-10-21 (iteration 47 · V15 adoption) · self
  // bubble now uses the Charcoal glass variant from the prototypes:
  // dark charcoal 35% fill + bright white 65% 1px rim. Reads as a
  // weighty, confident bubble that still frosts the wallpaper behind.
  // Peer bubbles keep their existing cyan-glass + cyan-rim treatment ·
  // so the distinction stays legible: peer reads cyan-dominant, self
  // reads charcoal-with-bright-rim.
  selfGrayGlass: "rgba(55, 65, 81, 0.35)",
  selfCyanHairline: "rgba(255, 255, 255, 0.65)",
  orangeInk: "#1A0808",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// `OutgoingDeliveryStatus` + `SeedMessage` moved to `_types.ts` and
// `_canvas-client.tsx` respectively (iteration 53) so the client
// canvas can own bubble rendering while the server page stays a thin
// shell that resolves session + cookies.

const SEED_MESSAGES: readonly SeedMessage[] = [
  {
    id: "s1",
    fromPeer: true,
    text:
      "Welcome to NEX Chat 🌎\nwhere the world is at your finger tips.\n\nTo get started, choose a chat theme and wait for your friend's reaction.",
    time: "15:03",
    senderName: "Nex",
  },
];

export default async function FreeChatPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  // Owner directive 2026-10-22 (afternoon) · hard rule from the sealed
  // mapping tree · /free-chat is the GUEST surface. Signed-in users
  // never see the picker or the "NEX - Guest" header here · they
  // belong on /nex-native/contacts (post-auth landing). Bouncing them
  // out at the page boundary prevents the "my name shows but theme
  // picker is forced" contradiction when a residual Supabase refresh
  // token auto-resolves a session that the viewer didn't explicitly
  // sign into in this browser tab.
  //
  // DEV ESCAPE HATCH · ?preview=1 on localhost bypasses the bounce so
  // the owner can inspect this page while signed in. Production
  // ignores the param. See src/lib/nex-native/app/dev-preview.ts.
  const sp = (await searchParams) ?? {};
  const signedInSession = await resolveNexAppSessionFromContext().catch(
    () => null,
  );
  if (signedInSession && !devPreviewOn(sp) && !isAdminSession(signedInSession)) {
    redirect("/nex-native/contacts");
  }

  const viewer = await resolveNexAppSessionOrGuest();
  const isGuest = viewer.kind !== "session";

  // Owner directive 2026-10-21 (iteration 58) · `?show-themes=1` on the
  // URL forces the first-visit theme row + Keep/View action bar to
  // render regardless of the dismiss cookie · useful when the owner
  // previously committed and now wants to see the picker again without
  // clearing cookies manually in DevTools.
  const forceShowThemes = sp["show-themes"] === "1";

  // Resolve ControlDrawer session · null for guests · drawer shows a
  // Sign-In prompt when no session (same pattern as the welcome page).
  //
  // Owner directive 2026-10-22 (afternoon) · when the viewer is a
  // real NEX account their display_name + nex_handle (nex-NNNNNN)
  // flow through both the chat header AND the drawer identity bar
  // in sync. Guests see the "NEX" / "NEX - Guest" brand strings in
  // both places (see headerDisplayName / headerSubtitle below).
  let drawerSession: ControlDrawerSession | null = null;
  let headerDisplayName = "NEX";
  let headerSubtitle = "NEX - Guest";
  try {
    const sess = await resolveNexAppSessionFromContext();
    if (sess) {
      drawerSession = {
        displayName: sess.account.display_name,
        nexHandle: sess.account.nex_handle,
        isBisnis: effectiveTier(sess.account) === "bisnis",
      };
      headerDisplayName = sess.account.display_name;
      headerSubtitle = sess.account.nex_handle
        ? sess.account.nex_handle.replace(/^nex-/i, "NEX-")
        : "NEX - Guest";
    }
  } catch {
    // guest · drawerSession stays null · header strings keep defaults
  }

  // Owner directive 2026-10-21 (iteration 53) · read the first-visit
  // theme row cookies server-side so returning visitors see no flash
  // of the row. Both cookies are JS-writable (set from the client when
  // the user picks a theme or taps View all) · reading them here on
  // every request avoids the hydration-mismatch risk of defaulting to
  // "show" on the server and "hidden" on the client.
  const cookieJar = await cookies();
  // Owner directive 2026-10-21 (iteration 61) · when the owner opens
  // the picker via `?show-themes=1`, the chat background must start
  // as the standard NEX navy regardless of any previously-saved
  // wallpaper · so the picker tiles show against the plain default
  // and the chosen theme only paints once the user taps a tile.
  // Clearing both server-side cookies here achieves that cleanly ·
  // the client canvas still owns the applied-wallpaper state and
  // writes new cookies when the user engages a tile.
  const initialThemeId = forceShowThemes
    ? null
    : (cookieJar.get("nex-free-chat-wallpaper")?.value ?? null);
  const initialRowDismissed =
    !forceShowThemes &&
    cookieJar.get("nex-free-chat-row-dismissed")?.value === "1";
  // Owner directive 2026-10-21 (iteration 54) · resolve the wallpaper
  // URL server-side so the <main> background can be painted BEFORE
  // hydration · no flash of navy on return visitors who had previously
  // picked a wallpaper.
  const initialWallpaperUrl = resolveFreeChatWallpaperUrl(initialThemeId);

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        data-nex-free-chat-root
        style={{
          position: "absolute",
          // Owner directive 2026-10-21 (iteration 35) · prior iteration
          // used `minHeight: 100dvh` which forced the main to be at
          // least viewport-tall · taller than the phone frame on
          // desktop (frame is clamped to 909px per nex-native.css:183),
          // which caused the free chat to overflow the frame and
          // scroll instead of fitting.
          //
          // Fix: `position: absolute; inset: 0` makes the main fill
          // the nearest positioned ancestor (which is `.nex-native-
          // frame` · `position: relative`) EXACTLY. On desktop that's
          // the 420×909 bezel. On mobile the frame IS the viewport,
          // so the result is identical to full-screen. No overflow,
          // no scroll on the main itself · only the inner chat canvas
          // scrolls bubble-by-bubble.
          inset: 0,
          // Owner directive 2026-10-21 (iteration 54) · wallpaper
          // paints the ENTIRE phone frame (header + canvas + composer).
          // Server resolves the URL from the cookie so the first paint
          // is correct · client takes over post-hydration (see
          // `_canvas-client.tsx` useEffect).
          background: freeChatBackgroundCss(initialWallpaperUrl, NEX.bg),
          color: NEX.text,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ── Identity header · NEX ping + wordmark + 3 drawer triggers ──
            Owner directive 2026-10-21 (iteration 32) · panel background +
            backdrop blur + bottom border removed · header now sits
            directly on the chat background. Three chromeless icon
            buttons added on the right for side-drawer triggers
            (handlers wired as placeholders · tell me what each should
            open and I'll bind them). */}
        <header
          data-nex-free-chat-header
          style={{
            padding:
              "calc(env(safe-area-inset-top, 0px) + 20px) 12px 14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          {/* Owner directive 2026-10-21 (iteration 75) · wrapped so the
              client setup container can inject a round avatar overlay
              on top of the sealed NEX ping badge when the user uploads
              a profile image. position: relative gives the overlay its
              coordinate space. */}
          <div
            data-nex-free-chat-header-avatar-slot
            style={{ position: "relative", width: 48, height: 48, flexShrink: 0 }}
          >
            <NexPingBadge size={48} accent={NEX.cyan} dataTestId="free-chat-nex" />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 0,
              flex: 1,
            }}
          >
            {/* Owner directive 2026-10-21 (iteration 71→72) · wordmark
                sized to WhatsApp header convention (17px / 600 weight).
                Overflow uses clip (not ellipsis) · owner doesn't want
                the "…" character. Chat name maxLength=20 + available
                width ~260px at 17px semi-bold means 20 typical chars
                comfortably fits, so clipping is a safety net only. */}
            <span
              data-nex-free-chat-header-wordmark
              style={{
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: "-0.005em",
                color: NEX.text,
                lineHeight: 1.1,
                textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                overflow: "hidden",
                whiteSpace: "nowrap",
                display: "block",
              }}
            >
              {headerDisplayName}
            </span>
            <span
              data-nex-free-chat-header-subtitle
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: NEX.textDim,
                lineHeight: 1.2,
                textShadow: "0 1px 2px rgba(0,0,0,0.45)",
                overflow: "hidden",
                whiteSpace: "nowrap",
                display: "block",
              }}
            >
              {headerSubtitle}
            </span>
          </div>
          {/* Right-side header cluster · owner directive 2026-10-21
              (iteration 33) · retired the generic 3rd icon · now only
              Search + 3-dots menu.
                · Search → routes to NEX Directory landing (matches
                  the welcome page's magnifying-glass pattern).
                · 3-dots → mounts the sealed ControlDrawer so the free
                  chat uses the SAME menu primitive every other NEX
                  surface uses (Sign-In prompt for guests). */}
          <nav
            data-nex-free-chat-header-drawers
            aria-label="Chat header actions"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              flexShrink: 0,
            }}
          >
            <Link
              href="/nex-native/directory/landing"
              aria-label="NEX Directory · shops · services · food · trades"
              data-nex-free-chat-header-search
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                color: NEX.cyan,
                textDecoration: "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <SearchIcon />
            </Link>
            <div style={{ display: "inline-flex" }}>
              <ControlDrawer session={drawerSession} />
            </div>
          </nav>
        </header>

        {/* ── Chat canvas · bubbles + first-visit theme row ──
            Owner directive 2026-10-21 (iteration 53) · bubble rendering
            + wallpaper state + first-visit row extracted to the client
            canvas. Server passes seed messages + the two cookies so no
            flash-of-row on returning visitors. */}
        <FreeChatCanvasClient
          seedMessages={SEED_MESSAGES}
          initialThemeId={initialThemeId}
          initialRowDismissed={initialRowDismissed}
        />

        {/* ── Composer · text + emoji glyph + send ── */}
        <FreeChatComposerClient
          isGuest={isGuest}
          initialThemeId={initialThemeId}
        />

        {/* ── Call-Center floating 3-dots trigger + left-slide panel ──
            Owner directive 2026-10-21 (iteration 38) · bottom-right
            floating action button, opens a left-sliding Call Center
            panel with voice/video/dial-pad/recent/contacts rows. All
            visual placeholders · no call-engine wiring. */}
        <FreeChatCallCenterDrawerClient />

        {/* ── Guest-only sticky "Create free NEX" CTA · retired
            2026-10-22 (afternoon) · owner directive · the create-
            account URL is now the signed-out root destination, so
            the sticky CTA on /free-chat is redundant. Any guest
            that reaches /free-chat (e.g. by direct URL in a share
            link) can still open the side drawer and tap "Sign in
            to NEX" there. The isGuest flag is now unused on this
            page but kept resolved above in case a later surface
            needs it. */}
      </main>
    </>
  );
}

// ─── Header icons · owner directive 2026-10-21 (iteration 33) ·
//     Settings + Menu icons retired · 3-dots is now the sealed
//     ControlDrawer · Search routes to NEX Directory via a Link.

function SearchIcon(): React.ReactElement {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx={11} cy={11} r={7} />
      <line x1={21} y1={21} x2={16.65} y2={16.65} />
    </svg>
  );
}


// `DeliveryDot` + `DELIVERY_DOT` moved to `_canvas-client.tsx` with
// the bubble rendering (iteration 53).
