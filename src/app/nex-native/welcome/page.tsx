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
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { ChatIdentityHeader } from "@/lib/nex-native/chat-chrome/chat-identity-header";
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
      blurb:
        "Every NEX chat theme · including premium showcases · open any one to see it live.",
      chip: "Browse now",
      href: "/nex-native/chat-themes-library",
      publicStatus: "open",
      accentHex: NEX.cyan,
    },
    {
      key: "shop",
      title: "Chat Themes Shop",
      blurb:
        "Preview the premium theme catalogue · try any premium theme free for 7 days when you join.",
      chip: "Preview inside",
      href: "/nex-native/chat-themes-library",
      publicStatus: "open",
      accentHex: NEX.orange,
    },
    {
      key: "personalised",
      title: "Personalised Chat",
      blurb:
        "See how different NEX themes paint your chat · pick a theme that feels like you.",
      chip: "See it live",
      href: "/nex-native/chat-themes-library",
      publicStatus: "open",
      accentHex: NEX.violet,
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
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ─── NEX identity header (sealed primitive · same as /chat/first-visit) ─── */}
        <header
          style={{
            position: "relative",
            flexShrink: 0,
            padding:
              "calc(env(safe-area-inset-top, 0) + 14px) 12px 14px 20px",
            textShadow: "0 2px 20px rgba(0,0,0,0.75)",
          }}
          data-nex-welcome-header
        >
          <ChatIdentityHeader
            avatarUrl={null}
            displayName="NEX"
            subtitle={headerSubtitle}
            presenceKind="online"
            rightReserveWidth={0}
            isOfficial
          />
        </header>

        {/* ─── Centre column ─── */}
        <section
          aria-label="Welcome to NEX Chat"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            padding: "6px 16px 24px",
            maxWidth: 640,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* Hero copy · owner-approved exciting explanation */}
          <div
            data-nex-welcome-hero
            style={{
              textAlign: "center",
              padding: "6px 4px 4px",
            }}
          >
            <h1
              data-nex-welcome-h1
              style={{
                margin: 0,
                fontSize: 26,
                lineHeight: 1.18,
                fontWeight: 700,
                letterSpacing: "-0.015em",
                color: NEX.textPrimary,
                fontFamily: SERIF,
              }}
            >
              Welcome to NEX Chat.
            </h1>
            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                lineHeight: 1.45,
                color: NEX.cyan,
                letterSpacing: "0.02em",
                fontWeight: 600,
              }}
            >
              The ultimate chat experience · plus business features.
            </div>
            <p
              style={{
                margin: "10px 2px 0",
                fontSize: 13,
                lineHeight: 1.6,
                color: NEX.textSecondary,
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
              margin: 0,
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

          <footer
            style={{
              marginTop: 8,
              fontSize: 11,
              color: NEX.textMuted,
              textAlign: "center",
              lineHeight: 1.5,
              padding: "0 10px",
            }}
          >
            By creating an account you accept the{" "}
            <Link
              href="/nex-native/about/terms"
              style={{ color: NEX.textSecondary, textDecoration: "underline" }}
            >
              NEX terms
            </Link>{" "}
            and{" "}
            <Link
              href="/nex-native/about/terms"
              style={{ color: NEX.textSecondary, textDecoration: "underline" }}
            >
              privacy notice
            </Link>
            .
          </footer>
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
  const { title, blurb, chip, href, accentHex, key } = card;

  // Owner-authorised intent persistence · 2026-10-15.
  // The whole card is a <form> that POSTs to rememberWelcomeIntentAction.
  // Hidden inputs carry the card's intent token + the whitelisted
  // redirect destination (`href` which is on the welcome-honesty
  // allowlist). The server action sets the cookie, then redirects.
  // Visual language is byte-identical to the original <Link>-based
  // card · we just swap the outer element from <Link> to <button>
  // wrapped in a <form> so the submit visually looks the same but
  // can carry server-side state. `all: unset` resets the button's
  // default UA styles so our inline styles paint untouched.
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
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          gap: 12,
          padding: 12,
          background: NEX.panel,
          border: `1px solid ${NEX.borderStrong}`,
          borderRadius: 14,
          textDecoration: "none",
          color: NEX.textPrimary,
          position: "relative",
          overflow: "hidden",
          minHeight: 112,
          WebkitTapHighlightColor: "transparent",
        }}
      >
      {/* Accent band · thin left stripe matches the card accent */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: 3,
          background: `linear-gradient(180deg, ${accentHex} 0%, transparent 100%)`,
        }}
      />

      {/* Left · landscape gradient visual */}
      <div
        aria-hidden
        data-nex-welcome-card-visual
        style={{
          flexShrink: 0,
          width: 112,
          height: 84,
          alignSelf: "center",
          borderRadius: 10,
          background: `linear-gradient(135deg, ${accentHex}44 0%, ${accentHex}11 60%, transparent 100%)`,
          border: `1px solid ${accentHex}44`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 16,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%, ${accentHex}, ${accentHex}66 70%, transparent 100%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 12,
            right: 14,
            width: 50,
            height: 10,
            borderRadius: 999,
            background: `${accentHex}66`,
            opacity: 0.85,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 22,
            right: 48,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: `${accentHex}aa`,
          }}
        />
      </div>

      {/* Right · title + blurb + chip */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          paddingRight: 2,
          paddingLeft: 2,
          justifyContent: "center",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 700,
            lineHeight: 1.2,
            color: NEX.textPrimary,
            fontFamily: SERIF,
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            lineHeight: 1.45,
            color: NEX.textSecondary,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {blurb}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 2,
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
            style={{
              marginLeft: "auto",
              color: accentHex,
              fontWeight: 700,
              fontSize: 15,
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
