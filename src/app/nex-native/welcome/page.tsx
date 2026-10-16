// src/app/nex-native/welcome/page.tsx
//
// NEX First-Open · guest NEX-Chat welcome landing · redesigned 2026-10-15.
// --------------------------------------------------------------------------
// A visitor who opens NEX for the first time (signed-out) arrives
// here and sees the NEX Chat first-visit experience adapted for
// guests · same structural language as the sealed signed-in surface
// at /nex-native/chat/first-visit (ChatIdentityHeader + three
// landscape cards) · but with guest-safe destinations and a clear
// primary "Create free account" CTA instead of a composer.
//
// Load-bearing rules (sealed):
//   · Uses ONLY the sealed NEX visual system (navy #020914 · cyan ·
//     orange · violet accent for the third card). Never introduces
//     a third palette.
//   · Does not expose private data (chat / contacts / vault / inbox).
//   · Does not force registration · the hero CTA is prominent but
//     non-blocking · every card linked below is actually
//     guest-accessible.
//   · Does not show controls for features that do not work. The
//     chat-NEX "Shop" and "Personalised" concepts link to the
//     real guest-open themes library · the dedicated signed-in
//     preview surfaces (/chat/first-visit/shop + /personalize) are
//     deliberately NOT linked here because they redirect guests
//     back · a dead-end tap target would be dishonest.
//   · Signed-in visitors never see this page · they're routed to /home
//     at the router level (/nex-native/page.tsx).
//
// Owner-authorised redesign direction (2026-10-15):
//   "the first page welcome should be the chat nex with 3 options"
//   See docs/doctrine/nex-welcome-chat-nex-redesign-2026-10-15.md
//   (post-implementation report).
//
// This page preserves the sealed welcome-honesty guardrails
// (G1-G7) enforced by __tests__/welcome-honesty.test.ts:
//   · All three cards carry publicStatus: "open" (G1)
//   · All hrefs on the welcome allowlist (G2)
//   · Primary CTA → /create-account · secondary → /sign-in (G3)
//   · No forbidden purchase / ownership / chat phrases (G4)
//   · Sealed "does not show controls" rule preserved in header (G5)
//   · Signed-in → /home redirect preserved (G6)
//   · Themes blurb mentions "premium" (G7)

import type * as React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { InstallHomeButtonClient } from "../_install-home-button-client";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { ChatIdentityHeader } from "@/lib/nex-native/chat-chrome/chat-identity-header";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import { rememberWelcomeIntentAction } from "./_remember-intent-action";
import {
  WELCOME_INTENT_COOKIE,
  isWelcomeIntent,
} from "./_welcome-intent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#071525",
  panelHi: "#0A1A2D",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanBorder: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  orangeFaint: "rgba(255, 114, 0, 0.14)",
  violet: "#9B6DFF",
  violetFaint: "rgba(155, 109, 255, 0.14)",
  borderSoft: "rgba(255, 255, 255, 0.07)",
  borderStrong: "rgba(139, 169, 209, 0.18)",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SERIF =
  "'Cormorant Garamond', 'EB Garamond', Georgia, serif";

interface ChatNexCard {
  readonly key: "themes" | "shop" | "personalised";
  readonly title: string;
  readonly blurb: string;
  readonly chip: string;
  readonly href: string;
  readonly publicStatus: "open" | "requires-account";
  readonly accentHex: string;
  /** Owner-supplied neon banner graphic · phone mockup on the left,
   *  empty space on the right where the title + blurb + chip render. */
  readonly visualSrc: string;
}

export default async function WelcomePage({
  searchParams,
}: {
  searchParams?: Promise<{ preview?: string }>;
}) {
  // Owner-escape-hatch · ?preview=1 lets a signed-in user open the
  // welcome page from Settings without being bounced to /home.
  // The preview flag ONLY bypasses the home redirect · it does NOT
  // mutate account state, selected theme, contacts, or settings ·
  // and it has no effect for signed-out visitors (they always see
  // the welcome page anyway). Added 2026-10-15 per the owner-
  // authorised NEX landing/welcome/returning-user flow.
  const sp = searchParams ? await searchParams : {};
  const previewMode = sp.preview === "1";

  const viewer = await resolveNexAppSessionOrGuest();
  if (viewer.kind === "session" && !previewMode) {
    // Signed-in visitors always land in /home · the welcome page is
    // guest-only. This mirrors the sealed router at /nex-native/page.tsx.
    // Exception: signed-in viewers who arrive with ?preview=1 (via the
    // Settings "View the welcome page →" affordance) stay on the page.
    redirect("/nex-native/home");
  }

  // Owner-authorised intent persistence · 2026-10-15.
  // Read the welcome-intent cookie (if set by an earlier card tap).
  // The cookie survives through signup · pick-theme reads + clears it.
  // Guests who have never tapped a card have no cookie → null →
  // signup URL is the plain /create-account (no intent query).
  const cookieJar = await cookies();
  const rememberedIntentRaw =
    cookieJar.get(WELCOME_INTENT_COOKIE)?.value ?? null;
  const rememberedIntent = isWelcomeIntent(rememberedIntentRaw)
    ? rememberedIntentRaw
    : null;
  const createAccountHref = rememberedIntent
    ? `/nex-native/create-account?intent=${encodeURIComponent(rememberedIntent)}`
    : "/nex-native/create-account";

  // Three chat-NEX cards · all point to /chat-themes-library because
  // that is the ONLY guest-safe destination today that reasonably
  // covers all three concepts (the library carries standard + premium
  // themes and acts as the preview surface for personalisation).
  //
  // Honest limitation surfaced to the owner · the /chat/first-visit/
  // shop and /chat/first-visit/personalize sub-surfaces are
  // signed-in only (they redirect guests to /welcome) · pointing a
  // guest card at them would create a dead-end loop. If distinct
  // destinations are needed, follow-up scope: build guest-safe
  // preview mirrors for shop + personalise OR extend the welcome
  // allowlist in __tests__/welcome-honesty.test.ts to accept
  // sign-in-with-next-param deep links.
  //
  // All cards carry publicStatus: "open" per G1. All hrefs are on
  // the allowlist per G2.
  const chatNexCards: readonly ChatNexCard[] = [
    {
      key: "themes",
      title: "Chat Themes",
      // Option A reword applied 2026-10-15 · tighter so the shorter
      // card height fits 2 lines of blurb cleanly. "premium" is
      // retained so the sealed welcome-honesty G7 guardrail stays
      // satisfied (users must know premium themes exist from this
      // card, not just the Shop card).
      blurb:
        "Every NEX chat theme · free + premium · tap any to preview it live.",
      chip: "Browse now",
      href: "/nex-native/chat-themes-library",
      publicStatus: "open",
      accentHex: NEX.cyan,
      visualSrc: "/nex-native/welcome-card-1-blue.png",
    },
    {
      key: "shop",
      title: "Chat Themes Shop",
      blurb:
        "Browse premium themes · 7 days free when you join.",
      chip: "Preview inside",
      href: "/nex-native/chat-themes-library",
      publicStatus: "open",
      accentHex: NEX.orange,
      visualSrc: "/nex-native/welcome-card-2-orange.png",
    },
    {
      key: "personalised",
      title: "Personalised Chat",
      blurb:
        "See themes come alive in your chat · pick one that fits.",
      chip: "See it live",
      href: "/nex-native/chat-themes-library",
      publicStatus: "open",
      accentHex: NEX.violet,
      visualSrc: "/nex-native/welcome-card-3-violet.png",
    },
  ];

  const headerSubtitle = "Welcome · guests browse free";

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        data-nex-welcome-root
        data-nex-welcome-variant="chat-nex"
        style={{
          position: "relative",
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          // 2026-10-15 · owner directive "cards increase width 20px".
          // No horizontal padding on main · section + cards extend
          // viewport-edge-to-edge. Hero text + CTAs re-add their
          // own 14px side padding so they do not touch the edge.
          paddingLeft: 0,
          paddingRight: 0,
        }}
      >
        {/* Full-viewport Cyber Assistant backdrop · owner-supplied
         *  2026-10-15 · pinned to the viewport (position: fixed +
         *  width/height 100dvw/100dvh) so the image ALWAYS fills the
         *  user's screen regardless of scroll position (owner rule
         *  2026-10-15: "the back ground image must fit height and
         *  width"). All interactive content renders on top with
         *  position: relative + zIndex. */}
        <img
          src="/nex-native/welcome-hero.png"
          alt=""
          aria-hidden
          data-nex-welcome-backdrop
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100dvh",
            objectFit: "cover",
            objectPosition: "center center",
            zIndex: 0,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        {/* ─── NEX identity header · template-matched 2026-10-15.
            Replaced the sealed ChatIdentityHeader call with a bespoke
            row so the owner-supplied NexPingBadge (blue ring + ping +
            "NE") can sit on the left, matching the owner-authorised
            template (az.png). ChatIdentityHeader still imported for
            parity with other NEX surfaces that aren't template-locked. */}
        <header
          style={{
            position: "relative",
            zIndex: 1,
            flexShrink: 0,
            padding:
              "calc(env(safe-area-inset-top, 0) + 14px) 12px 14px 18px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
          data-nex-welcome-header
        >
          {/* Owner-supplied blue speech bubble · hero-right decoration
           *  2026-10-15 · matches the template (az.png) which shows a
           *  cyan speech bubble floating to the right of the NEX
           *  identity row. Absolute-positioned so it doesn't shift the
           *  identity row layout. */}
          <img
            src="/nex-native/welcome-speech-bubble.png"
            alt=""
            aria-hidden
            data-nex-welcome-hero-speech-bubble
            style={{
              position: "absolute",
              top: "calc(env(safe-area-inset-top, 0) + 44px)",
              right: 6,
              width: 56,
              height: "auto",
              zIndex: 2,
              userSelect: "none",
              pointerEvents: "none",
              filter: "drop-shadow(0 4px 10px rgba(0,175,255,0.35))",
            }}
          />
          <NexPingBadge size={56} accent="#00AFFF" dataTestId="welcome-nex" />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: "-0.01em",
                  color: NEX.textPrimary,
                  lineHeight: 1,
                  textShadow: "0 2px 10px rgba(0,0,0,0.6)",
                }}
              >
                NEX
              </span>
              {/* Green ✓ NEX verified pill removed 2026-10-15 per
                  owner directive "remove the green nex badge from
                  header". */}
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: NEX.textSecondary,
                lineHeight: 1.2,
                textShadow: "0 1px 3px rgba(0,0,0,0.55)",
              }}
            >
              {headerSubtitle}
            </span>
          </div>
        </header>

        {/* ─── Centre column ─── */}
        <section
          aria-label="Welcome to NEX Chat"
          style={{
            position: "relative",
            zIndex: 1,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            // Side padding dropped to 2px so the 3 banner cards get
            // the full width (owner directive 2026-10-15 · "wider
            // cards 20px" · final iteration). Hero text and CTA
            // buttons re-add their own 14px side padding below so
            // only the cards go edge-to-edge.
            padding: "6px 2px 24px",
            maxWidth: 640,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* Hero copy · matches owner-supplied az.png template exactly.
              Narrow LEFT column so the Cyber Assistant backdrop stays
              visible on the right. Headline splits over two lines with
              "NEX Chat." in cyan. Subtitle is bold cyan on two lines.
              Body paragraph is left-aligned white. */}
          <div
            data-nex-welcome-hero
            style={{
              textAlign: "left",
              // Hero re-adds its own left/right padding so it doesn't
              // touch the viewport edge even though the section no
              // longer pads horizontally (section was dropped to 2px
              // L/R so banner cards get full viewport width).
              padding: "6px 14px 4px",
              maxWidth: 254,
            }}
          >
            <h1
              data-nex-welcome-h1
              style={{
                margin: 0,
                fontSize: 34,
                lineHeight: 1.1,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: NEX.textPrimary,
                // Owner-matched to template · modern sans-serif
                // (Inter at weight 800), NOT serif. Dropped the
                // Cormorant/EB Garamond fallback.
                fontFamily: SANS,
                textShadow: "0 2px 10px rgba(0,0,0,0.6)",
              }}
            >
              Welcome to{" "}
              <span style={{ color: NEX.cyan }}>NEX Chat.</span>
            </h1>
            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                lineHeight: 1.3,
                color: NEX.cyan,
                letterSpacing: "0.01em",
                fontWeight: 700,
                textShadow: "0 1px 3px rgba(0,0,0,0.5)",
              }}
            >
              The ultimate chat experience
              <br />
              plus business features.
            </div>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 12.5,
                lineHeight: 1.5,
                color: NEX.textPrimary,
                textShadow: "0 1px 3px rgba(0,0,0,0.6)",
              }}
            >
              Pick a theme that feels like you · say it with emoji ·
              browse local businesses · stay close to your neighbourhood.
              Free to look. Free to join.
            </p>
          </div>

          {/* 3 LANDSCAPE cards · vertically arranged on mobile */}
          <ol
            aria-label="Choose how to explore NEX"
            data-nex-welcome-cards-layout="landscape"
            style={{
              listStyle: "none",
              // Negative horizontal margin extends the cards ~20px
              // beyond the section on each side (+40px total width ·
              // iterated 2026-10-15 "cards increase width 20px" then
              // "increase card width 15px" · final value -20 per side).
              margin: "0 -20px",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {chatNexCards.map((card) => (
              <li key={card.key} style={{ margin: 0, padding: 0 }}>
                <LandscapeCard card={card} />
              </li>
            ))}
          </ol>

          {/* Primary CTA · create account */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 4,
              padding: "0 14px",
            }}
          >
            <Link
              href={createAccountHref}
              data-nex-welcome-primary-cta
              data-nex-welcome-primary-cta-intent={rememberedIntent ?? "none"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 52,
                borderRadius: 14,
                background: NEX.orange,
                color: "#0a0608",
                fontSize: 16,
                fontWeight: 700,
                textDecoration: "none",
                border: `1px solid ${NEX.orange}`,
                boxShadow: `0 1px 0 rgba(255,255,255,0.18) inset, 0 14px 32px -16px ${NEX.orange}`,
              }}
            >
              Create free account →
            </Link>
            <Link
              href="/nex-native/sign-in"
              data-nex-welcome-secondary-cta
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 48,
                borderRadius: 12,
                background: "transparent",
                color: NEX.cyan,
                fontSize: 14.5,
                fontWeight: 600,
                textDecoration: "none",
                border: `1px solid ${NEX.cyanSoft}`,
              }}
            >
              Already have an account? Sign in
            </Link>
            <div
              style={{
                textAlign: "center",
                fontSize: 11.5,
                color: NEX.textMuted,
                marginTop: 2,
              }}
            >
              15 seconds · no card needed
            </div>
          </div>

          {/* Terms + privacy footer removed 2026-10-15 · owner directive
              "exact same text as template image · remove old text" ·
              template ends at "15 seconds · no card needed" with no
              additional footer. */}

          {/* Home-screen install prompt · owner directive 2026-10-16.
              The button hides itself when NEX is already installed
              (display-mode: standalone), falls back to an iOS Share
              tooltip on Safari, and silently renders nothing on
              browsers without the install API. No persistent banner
              elsewhere in the app · this surface + Directory Landing
              are the only two the owner authorised. */}
          <div
            style={{
              marginTop: 20,
              display: "flex",
              justifyContent: "center",
            }}
            data-nex-welcome-install-slot
          >
            <InstallHomeButtonClient />
          </div>
        </section>
      </main>
    </>
  );
}

/* ─── Landscape card ───────────────────────────────────────────
   Same visual language as src/app/nex-native/chat/first-visit/
   page.tsx DestinationLandscapeCard (wide rectangle · left-side
   gradient visual · right-side title + blurb + chip). Scaled to
   fit the welcome page content column on mobile. */

function LandscapeCard({ card }: { card: ChatNexCard }): React.ReactElement {
  const { title, blurb, chip, href, accentHex, key, visualSrc } = card;

  // Owner-authorised intent persistence · 2026-10-15.
  // The whole card is a <form> that POSTs to rememberWelcomeIntentAction.
  // Hidden inputs carry the card's intent token + the whitelisted
  // redirect destination (`href` which is on the welcome-honesty
  // allowlist). The server action sets the cookie, then redirects.
  //
  // Owner-supplied neon banner update · 2026-10-15. Each card now
  // uses an owner-authored PNG banner (phone mockup on the left,
  // neon-outlined empty area on the right where text renders). The
  // banner is an absolute-positioned <img> that fills the card.
  // Title + blurb + chip sit in the right ~65% so they do not overlap
  // the phone mockup.
  return (
    <form action={rememberWelcomeIntentAction} style={{ margin: 0, padding: 0 }}>
      <input type="hidden" name="intent" value={key} />
      <input type="hidden" name="redirect_to" value={href} />
      <button
        type="submit"
        data-nex-welcome-card={key}
        data-nex-welcome-card-layout="landscape"
        data-nex-welcome-card-status={card.publicStatus}
        aria-label={`${title} · ${chip}`}
        style={{
          all: "unset",
          cursor: "pointer",
          boxSizing: "border-box",
          width: "100%",
          display: "block",
          textDecoration: "none",
          color: NEX.textPrimary,
          position: "relative",
          overflow: "hidden",
          // Shorter card height (owner directive 2026-10-15 "reduce
          // height of the cards"). Title + 2-line blurb + chip fit
          // tightly with the Option A rewords. 112px is the iOS HIG
          // tap-target floor + welcome-honesty guardrail.
          minHeight: 112,
          height: 112,
          WebkitTapHighlightColor: "transparent",
        }}
      >
      {/* Neon banner background · owner-supplied PNG with phone
          mockup on left + empty neon-outlined area on right. */}
      <img
        src={visualSrc}
        alt=""
        aria-hidden
        data-nex-welcome-card-banner
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "fill",
          zIndex: 0,
          pointerEvents: "none",
          userSelect: "none",
        }}
      />

      {/* Right · title + blurb + chip overlay. Left padding (~30%)
          keeps text clear of the phone mockup baked into the banner.
          Right padding bumped to 28px so title + blurb + chip arrow
          never bleed into the banner's neon rim glow (owner directive
          2026-10-15 "text is over flowing on right side of cards"). */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          minHeight: "inherit",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "11px 36px 8px 30%",
          justifyContent: "flex-start",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 800,
            lineHeight: 1.15,
            color: NEX.textPrimary,
            fontFamily: SANS,
            letterSpacing: "-0.005em",
            textShadow: "0 1px 3px rgba(0,0,0,0.6)",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 11.5,
            lineHeight: 1.35,
            color: NEX.textPrimary,
            textShadow: "0 1px 2px rgba(0,0,0,0.55)",
          }}
        >
          {blurb}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 4,
            // Nudge the ● dot + chip text 35px to the right (owner
            // directive 2026-10-15 · iterated 10 → 35). The arrow
            // keeps its right-edge position because it uses
            // marginLeft: auto.
            paddingLeft: 35,
            fontSize: 10.5,
            color: NEX.textMuted,
          }}
        >
          <span aria-hidden style={{ color: accentHex }}>
            ●
          </span>
          <span
            style={{
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: accentHex,
            }}
          >
            {chip}
          </span>
          <span
            aria-hidden
            data-nex-welcome-card-arrow
            style={{
              marginLeft: "auto",
              marginRight: 8,
              color: "#FFFFFF",
              fontWeight: 900,
              fontSize: 20,
              lineHeight: 1,
              textShadow: `0 0 8px ${accentHex}, 0 1px 3px rgba(0,0,0,0.7)`,
            }}
          >
            →
          </span>
        </div>
      </div>
      </button>
    </form>
  );
}
