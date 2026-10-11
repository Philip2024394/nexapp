// src/app/nex-native/welcome/page.tsx
//
// NEX First-Open · guest welcome landing · Phase 1 of first-time experience.
// --------------------------------------------------------------------------
// Replaces the previous "force redirect to /create-account" behaviour.
// A visitor who opens NEX for the first time arrives here and sees:
//
//   1. The NEX wordmark + a 1-line benefit headline
//   2. A LIVE theme preview card painted from the real theme registry
//      (one tap → /chat-themes-library, which is already guest-open)
//   3. Primary "Create free account" + secondary "Sign in" CTAs
//   4. A compact 3-card "What's inside" row (Themes · Business pages ·
//      Community) · each tile deep-links into the real public surface
//
// Load-bearing rules:
//   · Uses ONLY the sealed NEX visual system (navy #020914 · cyan ·
//     orange). Never introduces a third palette.
//   · Does not expose private data (chat / contacts / vault / inbox).
//   · Does not force registration · the hero CTA is prominent but
//     non-blocking · every surface linked below is actually
//     guest-accessible.
//   · Does not show controls for features that do not work. The
//     "Business pages" and "Community" tiles link to pages we have
//     NOT YET opened to guests · so until Phase 2/3 land, those tiles
//     are marked "Join to explore" rather than claiming to open.
//   · Signed-in visitors never see this page · they're routed to /home
//     at the router level (/nex-native/page.tsx).
//
// Phase-progress tracking · as more public surfaces open, flip the
// `publicStatus` flag on the matching tile from "requires-account" to
// "open" and the tile becomes a direct link.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { listLiveWorldsAsBrowserRows } from "../chat-themes-library/_live-worlds-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#071525",
  panelHi: "#0A1A2D",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  orangeFaint: "rgba(255, 114, 0, 0.14)",
  borderSoft: "rgba(255, 255, 255, 0.07)",
};

interface InsideCard {
  href: string;
  icon: string;
  title: string;
  blurb: string;
  publicStatus: "open" | "requires-account";
}

export default async function WelcomePage() {
  const viewer = await resolveNexAppSessionOrGuest();
  if (viewer.kind === "session") {
    // Signed-in visitors always land in /home · the welcome page is
    // guest-only. This mirrors the sealed router at /nex-native/page.tsx.
    redirect("/nex-native/home");
  }

  // Real theme row for the hero preview · we pick nex-bubbles because
  // it IS the NEX brand identity (cyan + navy + glass bubbles). The
  // welcome page is NEX's first visual handshake · showing a food
  // theme as the hero would under-sell the brand. If the row is
  // missing (shouldn't happen), fall back to the first registered
  // live-world.
  const liveRows = listLiveWorldsAsBrowserRows();
  const heroTheme =
    liveRows.find((r) => r.id === "nex-bubbles") ?? liveRows[0] ?? null;

  const insideCards: InsideCard[] = [
    {
      href: "/nex-native/chat-themes-library",
      icon: "🎨",
      title: "Themes",
      blurb:
        "Explore every chat theme · open any one to see it live.",
      publicStatus: "open",
    },
    {
      href: "/nex-native/discover",
      icon: "🛍",
      title: "Local businesses",
      blurb: "Discover shops and services around you.",
      publicStatus: "open",
    },
    {
      href: "/nex-native/community/feed",
      icon: "🏘",
      title: "Community",
      blurb: "Local alerts · lost & found · neighbour updates.",
      publicStatus: "open",
    },
  ];

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        @keyframes nex-welcome-glow {
          0%, 100% { box-shadow: 0 24px 60px -24px rgba(0,0,0,0.6), 0 0 0 0 rgba(0,175,255,0); }
          50%      { box-shadow: 0 24px 60px -24px rgba(0,0,0,0.6), 0 0 50px -20px rgba(0,175,255,0.6); }
        }
      `}</style>
      <main
        data-nex-welcome-root
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "calc(env(safe-area-inset-top, 0px) + 24px) 20px 48px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(60% 40% at 50% 0%, rgba(0,175,255,0.09), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            maxWidth: 520,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 32,
          }}
        >
          {/* ─── Hero ─── */}
          <section
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              textAlign: "center",
            }}
          >
            <div
              aria-hidden
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 999,
                background: NEX.orangeFaint,
                color: NEX.orange,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                border: `1px solid ${NEX.orange}44`,
              }}
            >
              ✦ NEX
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 34,
                fontWeight: 800,
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
              }}
            >
              Chat that feels like
              <br />
              yours.
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                color: NEX.textSecondary,
                lineHeight: 1.55,
                maxWidth: 380,
              }}
            >
              Pick a theme · meet local businesses · stay close to your
              neighbourhood. Free to look. Free to join.
            </p>
          </section>

          {/* ─── Live theme preview card ─── */}
          {heroTheme && (
            <Link
              href="/nex-native/chat-themes-library"
              data-nex-welcome-theme-preview
              style={{
                position: "relative",
                display: "block",
                borderRadius: 24,
                overflow: "hidden",
                textDecoration: "none",
                color: NEX.textPrimary,
                aspectRatio: "4 / 3",
                background: heroTheme.hero_image_url
                  ? `url("${encodeURI(heroTheme.hero_image_url)}") center/cover, ${heroTheme.accent_hex}`
                  : `linear-gradient(165deg, ${heroTheme.accent_hex} 0%, ${heroTheme.bubble_rim_hex ?? heroTheme.accent_hex} 55%, ${heroTheme.composer_rim_hex ?? heroTheme.accent_hex} 100%)`,
                border: `1px solid ${NEX.cyanSoft}`,
                animation: "nex-welcome-glow 4s ease-in-out infinite",
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(2,9,20,0) 40%, rgba(2,9,20,0.85) 100%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: "auto 18px 18px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: NEX.cyan,
                    fontWeight: 700,
                  }}
                >
                  Live theme
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: NEX.textPrimary,
                  }}
                >
                  {heroTheme.name}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: NEX.textSecondary,
                    lineHeight: 1.4,
                  }}
                >
                  Tap to see every theme →
                </div>
              </div>
            </Link>
          )}

          {/* ─── Primary CTAs ─── */}
          <section
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <Link
              href="/nex-native/create-account"
              data-nex-welcome-primary-cta
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
          </section>

          {/* ─── "What's inside" ─── */}
          <section
            aria-label="What's inside NEX"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 10.5,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: NEX.textMuted,
              }}
            >
              <span style={{ flex: 1, height: 1, background: `${NEX.textMuted}22` }} />
              <span>What's inside</span>
              <span style={{ flex: 1, height: 1, background: `${NEX.textMuted}22` }} />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 10,
              }}
            >
              {insideCards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  data-nex-welcome-inside-card={card.publicStatus}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: "16px 14px",
                    borderRadius: 14,
                    background: NEX.panel,
                    border: `1px solid ${NEX.borderSoft}`,
                    textDecoration: "none",
                    color: NEX.textPrimary,
                    minHeight: 128,
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: NEX.cyanFaint,
                      color: NEX.cyan,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 20,
                      border: `1px solid ${NEX.cyan}33`,
                    }}
                  >
                    {card.icon}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {card.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: NEX.textMuted,
                      lineHeight: 1.4,
                      flex: 1,
                    }}
                  >
                    {card.blurb}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color:
                        card.publicStatus === "open"
                          ? NEX.cyan
                          : NEX.textMuted,
                      fontWeight: 700,
                    }}
                  >
                    {card.publicStatus === "open" ? "Open now" : "Join to explore"}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <footer
            style={{
              marginTop: 8,
              fontSize: 11,
              color: NEX.textMuted,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            By creating an account you accept the{" "}
            <Link
              href="/nex-native/about/terms"
              style={{ color: NEX.textSecondary, textDecoration: "underline" }}
            >
              NEX terms
            </Link>
            .
          </footer>
        </div>
      </main>
    </>
  );
}
