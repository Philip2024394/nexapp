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
//
// Shared-header exception (sealed 2026-10-17 · drawer unified later same day):
// -------------------------------------------
// Welcome deliberately does NOT mount the shared `NexPageHeader`
// from `src/app/nex-native/_page-header.tsx`. Welcome has its own
// bespoke, taller header that renders:
//   · a large `NexPingBadge size={56}` as the hero identity (left),
//   · the owner-supplied cyan speech-bubble decoration (right-top),
//   · the shared `ControlDrawer` three-dots button (right · for both
//     signed-in and guest visitors · guests see a sign-in prompt).
//
// Owner directive 2026-10-17 (later): the bespoke
// `WelcomeHeaderDrawerButtonClient` is retired and the file deleted ·
// Welcome now mounts the SAME `ControlDrawer` used on
// `/nex-native/directory/landing`, giving every NEX surface a single
// drawer. Welcome keeps its hero-styled header shell; only the drawer
// trigger has been swapped out. If a future change migrates Welcome
// to the shared `NexPageHeader`, remove the bespoke ping badge AND
// this ControlDrawer mount first to avoid double-rendering · see
// `_page-header.tsx` + the sibling drawer client component
// `_page-header-drawer-button-client.tsx`.

import type * as React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
// Owner directive 2026-10-18 · InstallHomeButtonClient import
// retired from the Welcome page (the install prompt now lives on
// the sealed post-signup landing as a discreet footer slider,
// never on guest-visible surfaces). Directory Landing retains its
// own import.
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { ChatIdentityHeader } from "@/lib/nex-native/chat-chrome/chat-identity-header";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import { rememberWelcomeIntentAction } from "./_remember-intent-action";
// Owner directive 2026-10-17 · the bespoke Welcome drawer is retired ·
// Welcome now mounts the SAME ControlDrawer used on
// /nex-native/directory/landing · one drawer across the app.
import {
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { effectiveTier } from "@/lib/nex-native/account-service";
import {
  WELCOME_INTENT_COOKIE,
  isWelcomeIntent,
} from "./_welcome-intent";
// Owner directive 2026-10-18 · /welcome is the new post-signup
// orientation landing (previously /create-account/welcome). The
// install-home-screen slider moves here from the retired Bridge-42
// page. The slider is gated on signed-in viewers · fresh guests who
// somehow reach this page (Settings "View the welcome page", direct
// URL) still never see the install prompt, matching the earlier
// owner directive "never show it to guests".
import { InstallHomeSliderClient } from "../_install-home-slider-client";
import { isInstallHomeSliderDismissed } from "@/lib/nex-native/install-home-slider-cookie";

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

export default async function WelcomePage() {
  // 2026-10-17 · owner-authorised change: Welcome is now the signed-in
  // landing after sign-in (previously signed-in users bounced to /home).
  // The entry router at /nex-native/page.tsx still sends direct
  // signed-in entries to /home (unchanged · narrow scope). This change
  // only affects post-sign-in landing via signInAction and the
  // Settings "View the welcome page →" affordance.
  const viewer = await resolveNexAppSessionOrGuest();
  const isSignedIn = viewer.kind === "session";

  // Owner directive 2026-10-18 · /welcome is now the post-signup
  // orientation landing. The install-home-screen slider is mounted
  // at the bottom of the page, gated on both signed-in state AND
  // the 365-day dismissal cookie.
  const sliderDismissed = await isInstallHomeSliderDismissed();

  // Owner directive 2026-10-17 · ControlDrawer session resolution ·
  // mirrors the sealed /directory/landing pattern. Null session →
  // drawer renders a Sign-In prompt. Welcome is a guest-safe
  // surface so a session failure must never block first paint.
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
    // guest · keep drawerSession = null
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
      // Owner-authorised 2026-10-18 (D4) · the old "7 days free when
      // you join" implied the themes trial starts automatically at
      // signup. In reality the trial is an explicit, one-shot,
      // lifetime-per-account action gated by `startThemesTrial`
      // (Bridge 56g, src/lib/nex-native/account-service.ts:353) ·
      // during the 7-day window `effectiveTier` returns "bisnis" so
      // the trial grants the Bisnis-tier premium-theme feature set.
      // Signup, tapping this card, and selecting the Shop intent do
      // NOT start, reserve, or consume trial time. New copy
      // describes the trial truthfully: optional, 7 days, Bisnis
      // tier, one per account.
      blurb:
        "Browse premium themes · optional 7-day free Bisnis trial · one per account.",
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
      {/* Owner directive 2026-10-17 · "app-size on desktop" ·
          satisfied by the global `nex-native-frame` phone-column
          CSS at src/app/nex-native/nex-native.css:177 (420 × 909
          clamp on viewport ≥ 500px · full-width on mobile). This
          page relies on that inherited frame · it does NOT add its
          own app-size wrapper (would double-nest). The one visual
          correction kept from the same directive is scoping the
          Earth backdrop to `main` instead of `100vw / 100dvh` so
          the hero no longer spills past the phone bezel on desktop
          (position:fixed children escape the frame · per the
          nex-native.css comment at line 148). */}
      <main
        data-nex-welcome-root
        data-nex-welcome-variant="chat-nex"
        style={{
          position: "relative",
          // Owner directive 2026-10-18 · welcome page MUST fit one
          // viewport · no scroll. Was `minHeight: 100dvh` which let
          // content grow and scroll · now `height: 100dvh` with
          // `overflow: hidden` guarantees one-screen fit. The three
          // intent cards + hero + sign-in redistribute via flex
          // below.
          height: "100dvh",
          maxHeight: "100dvh",
          width: "100%",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          // 2026-10-15 · owner directive "cards increase width 20px".
          // No horizontal padding on main · section + cards extend
          // viewport-edge-to-edge. Hero text + CTAs re-add their
          // own 14px side padding so they do not touch the edge.
          paddingLeft: 0,
          paddingRight: 0,
        }}
      >
        {/* Owner directive 2026-10-17 · backdrop scoped to `main`
            (position: absolute · 100% × 100% of parent) so on desktop
            the image stays INSIDE the global phone frame bezel. On
            mobile the frame is 100% wide so the backdrop still spans
            the full screen. */}
        <img
          src="/nex-native/welcome-hero.png"
          alt=""
          aria-hidden
          data-nex-welcome-backdrop
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
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
            // Owner directive 2026-10-18 · bump the top padding so
            // the NexPingBadge + NEX title clear the phone earpiece
            // / notch / dynamic island on real devices. The sealed
            // `env(safe-area-inset-top)` already covers Apple
            // notches, but older Androids and non-safe-area browsers
            // need a hard-coded floor. 32px top padding gives
            // enough earpiece clearance without pushing the hero
            // too far down (owner follow-up 2026-10-18 · "move up
            // the header little" from the earlier 56px floor).
            padding:
              "calc(env(safe-area-inset-top, 0) + 32px) 12px 14px 18px",
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
              // Match the header's new 32px top offset so the speech
              // bubble floats next to the identity row, not above it.
              top: "calc(env(safe-area-inset-top, 0) + 62px)",
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
              flex: 1,
            }}
          >
            {/* Owner directive 2026-10-18 (iteration) · drawer trigger
                now sits INSIDE the same inline row as the "NEX" word,
                so the 3-dots are literally on the NEX-text baseline
                rather than center-aligned to the taller ping badge. */}
            <div
              data-nex-welcome-header-drawer-slot
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                position: "relative",
                zIndex: 3,
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
              <div style={{ marginLeft: "auto", display: "inline-flex" }}>
                <ControlDrawer session={drawerSession} />
              </div>
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
            // Owner directive 2026-10-18 · tightened vertical rhythm
            // so the page fits a single phone viewport with no scroll
            // (gap 16→8, bottom padding 24→10).
            gap: 8,
            // Side padding dropped to 2px so the 3 banner cards get
            // the full width (owner directive 2026-10-15 · "wider
            // cards 20px" · final iteration). Hero text and CTA
            // buttons re-add their own 14px side padding below so
            // only the cards go edge-to-edge.
            padding: "2px 2px 10px",
            maxWidth: 640,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
            // Hidden overflow at the section level too so no stray
            // scroll affordance appears on sub-700px viewports.
            overflow: "hidden",
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
              // Owner directive 2026-10-18 · hero top padding
              // tightened 6→2 so the headline sits closer to the
              // identity row and the whole page fits one viewport.
              padding: "2px 14px 2px",
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
            {/* Owner directive 2026-10-18 · retired the "Pick a
                theme that feels like you · say it with emoji ·
                browse local businesses · stay close to your
                neighbourhood. Free to look. Free to join." sub-copy ·
                the headline above is enough identity on this hero. */}
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
              // Owner directive 2026-10-18 · gap 12→8 so three cards
              // + hero + sign-in fit a single phone viewport.
              // flex-shrink:0 keeps each card at its natural height
              // (112px tap-target floor) so the sign-in link below
              // never gets pushed out of the viewport.
              gap: 8,
              flexShrink: 0,
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
            {isSignedIn ? (
              <Link
                href="/nex-native/home"
                data-nex-welcome-primary-cta
                data-nex-welcome-primary-cta-shape="signed-in"
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
                Continue to NEX →
              </Link>
            ) : (
              <>
                {/* Owner directive 2026-10-18 · "Create free account"
                    primary CTA retired · the three intent cards above
                    (Chat Themes · Chat Themes Shop · Personalised
                    Chat) are the sole entry points. Tapping any card
                    takes guests through the sealed account-wall at
                    the right moment · signup happens naturally when
                    the user commits to a theme or cover. The sign-in
                    link stays for returning users with an existing
                    account. */}
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
              </>
            )}
          </div>

          {/* Terms + privacy footer removed 2026-10-15 · owner directive
              "exact same text as template image · remove old text" ·
              template ends at "15 seconds · no card needed" with no
              additional footer. */}

          {/* Owner directive 2026-10-18 · home-screen install prompt
              retired from the Welcome page. Guests browsing the
              welcome landing haven't committed to NEX yet · inviting
              them to install the PWA at that moment is premature.
              Owner directive 2026-10-18 · /welcome is now the POST-
              signup landing (reached from pick-theme / pick-cover),
              so a discreet install-home-screen slider is mounted
              below `</main>` · gated on signed-in viewers so any
              remaining guest paths still never see it. */}
        </section>
      </main>
      {/* Install-home-screen slider · signed-in viewers only ·
          dismissal persists via the sealed 365-day cookie. The
          /welcome page is reachable by guests through the sealed
          Settings "View the welcome page" affordance; guests must
          not see the install CTA (owner directive from the earlier
          install-slider build). */}
      {isSignedIn && !sliderDismissed ? <InstallHomeSliderClient /> : null}
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
