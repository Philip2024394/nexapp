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
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { effectiveTier } from "@/lib/nex-native/account-service";
import {
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";
import { FreeChatComposerClient } from "./_composer-client";
import { FreeChatCallCenterDrawerClient } from "./_call-center-drawer-client";

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

/** Owner directive 2026-10-21 (iteration 37) · outgoing bubble
 *  delivery indicator REPLACED tick checkmarks with a single
 *  colour-coded DOT:
 *    delivered · orange dot · reached the recipient's device, not read yet
 *    read      · green dot  · recipient opened the chat
 *  Simpler semantics · no sent/delivered/viewed trichotomy ·
 *  colour alone communicates state. Peer bubbles never render a dot
 *  (dots only confirm YOUR sends). */
type OutgoingDeliveryStatus = "delivered" | "read";

interface SeedMessage {
  readonly id: string;
  readonly text: string;
  readonly fromPeer: boolean;
  readonly time: string;
  /** Owner directive 2026-10-21 (iteration 46) · peer bubbles now
   *  render the sender name at the top-right of the bubble, followed
   *  by the time. Only meaningful when fromPeer === true · self
   *  bubbles never show a sender name (it's always "you"). */
  readonly senderName?: string;
  /** Only meaningful when fromPeer === false. */
  readonly deliveryStatus?: OutgoingDeliveryStatus;
}

const SEED_MESSAGES: readonly SeedMessage[] = [
  {
    id: "s1",
    fromPeer: true,
    text: "Welcome to NEX · the chat that's yours",
    time: "15:03",
    senderName: "Nex",
  },
  {
    id: "s2",
    fromPeer: true,
    text: "Pick a theme, invite your friends, make it feel like home.",
    time: "15:03",
    senderName: "Nex",
  },
  {
    id: "s3",
    fromPeer: false,
    text: "Looks clean.",
    time: "15:04",
    deliveryStatus: "read",
  },
];

export default async function FreeChatPage(): Promise<React.ReactElement> {
  const viewer = await resolveNexAppSessionOrGuest();
  const isGuest = viewer.kind !== "session";

  // Resolve ControlDrawer session · null for guests · drawer shows a
  // Sign-In prompt when no session (same pattern as the welcome page).
  let drawerSession: ControlDrawerSession | null = null;
  try {
    const sess = await resolveNexAppSessionFromContext();
    if (sess) {
      drawerSession = {
        displayName: sess.account.display_name,
        nexHandle: sess.account.nex_handle,
        isBisnis: effectiveTier(sess.account) === "bisnis",
      };
    }
  } catch {
    // guest · drawerSession stays null
  }

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
          background: NEX.bg,
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
          <NexPingBadge size={48} accent={NEX.cyan} dataTestId="free-chat-nex" />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 0,
              flex: 1,
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: "-0.01em",
                color: NEX.text,
                lineHeight: 1,
                textShadow: "0 1px 3px rgba(0,0,0,0.5)",
              }}
            >
              NEX
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: NEX.textDim,
                lineHeight: 1.2,
                textShadow: "0 1px 2px rgba(0,0,0,0.45)",
              }}
            >
              {isGuest ? "Welcome · you're previewing NEX" : "Your free NEX chat"}
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

        {/* ── Chat canvas · bubbles ── */}
        <section
          data-nex-free-chat-canvas
          aria-label="Chat messages"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "20px 14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {SEED_MESSAGES.map((m) => {
            // Owner directive 2026-10-21 (iteration 44) · self bubble
            // now matches the peer bubble's glass + rim aesthetic:
            //   peer · cyan glass bg + cyan rim + white text
            //   self · orange glass bg + orange rim + white text
            // Text colour on the self bubble shifts from dark-ink to
            // NEX.text so it reads cleanly against the translucent
            // fill. Meta row colour also shifts to a muted light tone
            // for the same reason.
            const metaColor = m.fromPeer
              ? NEX.textMute
              : "rgba(242, 245, 248, 0.72)";
            return (
              <article
                key={m.id}
                data-nex-free-chat-bubble={m.id}
                data-nex-free-chat-bubble-from={m.fromPeer ? "peer" : "self"}
                data-nex-free-chat-bubble-delivery={m.deliveryStatus ?? undefined}
                style={{
                  maxWidth: "80%",
                  alignSelf: m.fromPeer ? "flex-start" : "flex-end",
                  padding: "8px 14px 10px",
                  borderRadius: 18,
                  borderBottomLeftRadius: m.fromPeer ? 6 : 18,
                  borderBottomRightRadius: m.fromPeer ? 18 : 6,
                  background: m.fromPeer ? NEX.cyanBubble : NEX.selfGrayGlass,
                  color: NEX.text,
                  border: `1px solid ${m.fromPeer ? NEX.cyanSoft : NEX.selfCyanHairline}`,
                  // Glass pass · backdrop-filter blurs whatever sits
                  // behind the bubble (chat wallpaper / other bubbles)
                  // so the transparent fill reads as frosted glass
                  // rather than a flat tint. WebkitBackdropFilter kept
                  // for Safari parity.
                  backdropFilter: "blur(10px) saturate(140%)",
                  WebkitBackdropFilter: "blur(10px) saturate(140%)",
                  fontSize: 14,
                  lineHeight: 1.4,
                  boxShadow: "0 6px 14px -8px rgba(0,0,0,0.6)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {/* Meta row · top-right of the bubble.
                    Owner directive 2026-10-21 (iteration 37) · tick
                    checkmarks replaced with a colour-coded DOT:
                      orange = delivered-not-read, green = read.
                    Owner directive 2026-10-21 (iteration 46) · peer
                    bubbles now render the sender name (e.g. "Nex")
                    BEFORE the time so the viewer sees who's talking
                    without scanning up. Rendered slightly brighter +
                    bolder than the time so the hierarchy reads
                    name > time at a glance. Self bubbles stay
                    name-less (sender is always "you"). */}
                <div
                  data-nex-free-chat-bubble-meta
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 6,
                    alignSelf: "flex-end",
                    fontSize: 10,
                    color: metaColor,
                    lineHeight: 1,
                  }}
                >
                  {m.fromPeer && m.senderName && (
                    <span
                      data-nex-free-chat-bubble-sender
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: NEX.cyan,
                        letterSpacing: 0.2,
                      }}
                    >
                      {m.senderName}
                    </span>
                  )}
                  <span>{m.time}</span>
                  {!m.fromPeer && m.deliveryStatus && (
                    <DeliveryDot status={m.deliveryStatus} />
                  )}
                </div>
                <div>{m.text}</div>
              </article>
            );
          })}
        </section>

        {/* ── Composer · text + emoji glyph + send ── */}
        <FreeChatComposerClient isGuest={isGuest} />

        {/* ── Call-Center floating 3-dots trigger + left-slide panel ──
            Owner directive 2026-10-21 (iteration 38) · bottom-right
            floating action button, opens a left-sliding Call Center
            panel with voice/video/dial-pad/recent/contacts rows. All
            visual placeholders · no call-engine wiring. */}
        <FreeChatCallCenterDrawerClient />

        {/* ── Guest-only sticky CTA ──
            Owner directive 2026-10-21 (iteration 32 follow-up) ·
            footer container (border + panel background) removed · CTA
            now sits directly on the chat background. */}
        {isGuest && (
          <aside
            data-nex-free-chat-guest-cta
            style={{
              padding:
                "10px 14px calc(env(safe-area-inset-bottom, 0px) + 12px)",
              flexShrink: 0,
            }}
          >
            <Link
              href="/nex-native/create-account"
              data-nex-free-chat-guest-cta-link
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                minHeight: 44,
                padding: "0 14px",
                borderRadius: 12,
                background: NEX.orange,
                color: NEX.orangeInk,
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                textDecoration: "none",
                boxShadow: `0 10px 24px -12px ${NEX.orange}`,
              }}
            >
              Create free NEX
            </Link>
          </aside>
        )}
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

// ─── Bubble delivery-dot indicator ────────────────────────────────
//
// Owner directive 2026-10-21 (iteration 37) · retired WhatsApp-style
// tick checkmarks in favour of a single colour-coded dot:
//   delivered · orange (#FF7200) · reached recipient, not read yet
//   read      · green  (#16D66B) · recipient opened the chat
//
// Rendered as a filled SVG circle · stays visually tight next to the
// timestamp in the bubble's top-right meta row.

const DELIVERY_DOT = {
  delivered: "#FF7200",
  read: "#16D66B",
} as const;

function DeliveryDot({
  status,
}: {
  status: "delivered" | "read";
}): React.ReactElement {
  const fill = DELIVERY_DOT[status];
  return (
    <svg
      width={9}
      height={9}
      viewBox="0 0 9 9"
      aria-label={`Message ${status}`}
      data-nex-free-chat-bubble-delivery-dot={status}
    >
      <circle
        cx={4.5}
        cy={4.5}
        r={4}
        fill={fill}
      />
    </svg>
  );
}
