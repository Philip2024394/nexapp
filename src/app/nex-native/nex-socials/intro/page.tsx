// src/app/nex-native/nex-socials/intro/page.tsx
//
// NEX Socials · intro / "coming soon" landing · owner-authorised 2026-10-15.
// -----------------------------------------------------------------------------
// Shown to authenticated users who tap "NEX Socials" from Settings. Owner-
// directed on 2026-10-15: primary CTA button text is "Coming Soon" ·
// Socials is not yet available to end users. The sealed chooser at
// `/nex-native/nex-socials` is NOT linked from here · it stays reachable
// at its URL for internal testing and existing deep links.
//
// Layout mirrors owner-supplied template az3.png:
//   · brand header     · ping badge + NEX wordmark + "Socials that bring
//                        you closer." tagline
//   · hero backdrop    · existing socials-landing-background.png
//                        (approved earlier; 3-character cyber-city scene)
//   · headline         · "Meet Your" + "NEX SOCIALS" (cyan)
//   · subtitle         · "New business. New friends. New relationships."
//   · body             · "Discover your people, build meaningful
//                        connections, and open doors to new opportunities."
//   · capability tiles · 4 cards (Business · Friends · Dating · Community)
//                        with intro-capability-icons.png as the icon strip
//                        · az3 labels used literally since the button
//                        does NOT route to the chooser · the lens-token
//                        chooser remains untouched
//   · phone fan        · intro-phone-fan.png preview
//   · primary CTA      · orange pill-shape "Coming Soon" · aria-disabled
//                        · clickable area returns nothing · no router.push
//   · sign-in link     · deliberately OMITTED · this page is reached
//                        from Settings (user is already authenticated);
//                        a "Sign in" link here would be confusing
//
// All imagery is owner-supplied PNG assets. Code references them via
// `src`; no character art is drawn in code.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import { NEX } from "../../vault/home/_palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const CAPABILITIES: ReadonlyArray<{
  title: string;
  subtitle: string;
  accent: string;
}> = [
  { title: "Business", subtitle: "Grow your network", accent: "#00AFFF" },
  { title: "Friends", subtitle: "Meet your people", accent: "#B47CFF" },
  { title: "Dating", subtitle: "Find real chemistry", accent: "#FF7200" },
  { title: "Community", subtitle: "Belong together", accent: "#4ADE80" },
];

export default async function NexSocialsIntroPage() {
  const session = await resolveNexAppSessionFromContext();
  // Owner directive 2026-10-25 · sealed dev-pass pattern · a guest in
  // dev clicking the drawer `Socials` button lands here and sees the
  // "Coming Soon" intro cold; production still redirects to sign-in.
  if (!session && process.env.NODE_ENV === "production") {
    redirect("/nex-native/sign-in?next=/nex-native/nex-socials/intro");
  }

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        [data-nex-socials-intro-root],
        [data-nex-socials-intro-root] * { box-sizing: border-box; }
        [data-nex-socials-intro-root] a:focus-visible,
        [data-nex-socials-intro-root] button:focus-visible {
          outline: 2px solid ${NEX.secure};
          outline-offset: 2px;
        }
      `}</style>
      <main
        id="main"
        data-nex-socials-intro-root
        style={{
          position: "relative",
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily: SANS,
          overflowX: "hidden",
        }}
      >
        {/* Full-viewport hero backdrop · reused "Earth Selfie in a Cyber
            City" asset already approved for Socials. Scrolls with the
            page as a single unit (not fixed) · same pattern the Vault
            intro landing adopted after owner directive. */}
        <img
          src="/nex-socials/socials-landing-background.png"
          alt=""
          aria-hidden
          data-nex-socials-intro-backdrop
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100dvh",
            objectFit: "cover",
            objectPosition: "center top",
            zIndex: 0,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        <div
          aria-hidden
          data-nex-socials-intro-scrim
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100dvh",
            background:
              "linear-gradient(180deg, rgba(2,9,20,0.08) 0%, rgba(2,9,20,0.32) 30%, rgba(2,9,20,0.78) 65%, rgba(2,9,20,0.94) 100%)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: 420,
            margin: "0 auto",
            padding:
              "calc(env(safe-area-inset-top, 0px) + 14px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)",
          }}
        >
          {/* ── Brand header · ping badge + wordmark + Home icon ──
                 Owner-directed 2026-10-15 · Home icon on the RIGHT of
                 the header (not an arrow on the left). Destination is
                 the Settings landing (where the user came from); the
                 home-glyph visual mirrors the sealed VaultShellHeader
                 convention so the exit affordance reads as a
                 recognisable "home" control. ── */}
          <header
            data-nex-socials-intro-brand
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <NexPingBadge
              size={56}
              accent={NEX.secure}
              dataTestId="socials-intro-nex"
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                marginTop: 10,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  letterSpacing: "-0.01em",
                  color: NEX.textPrimary,
                  lineHeight: 1,
                  textShadow: "0 2px 10px rgba(0,0,0,0.6)",
                }}
              >
                NEX
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: NEX.textPrimary,
                  textShadow: "0 1px 3px rgba(0,0,0,0.55)",
                }}
              >
                Socials that bring
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: NEX.secure,
                  textShadow: "0 1px 3px rgba(0,0,0,0.55)",
                }}
              >
                you closer.
              </span>
            </div>
            <Link
              href="/nex-native/settings"
              aria-label="Back to Settings"
              title="Back to Settings"
              data-nex-socials-intro-back
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                marginTop: 8,
                marginLeft: "auto",
                borderRadius: 999,
                background: "rgba(2, 9, 20, 0.55)",
                border: `1px solid ${NEX.secureStrong}`,
                color: NEX.textPrimary,
                textDecoration: "none",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                flexShrink: 0,
              }}
            >
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
                <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
              </svg>
            </Link>
          </header>

          {/* ── Hero · spacer pushes headline below the character scene
                 so the three people in the backdrop stay visible in
                 the top portion of the viewport. ── */}
          <section data-nex-socials-intro-hero style={{ marginBottom: 20 }}>
            <div
              aria-hidden
              data-nex-socials-intro-hero-spacer
              style={{ height: "min(32vh, 260px)" }}
            />
            <h1
              style={{
                margin: "0 0 6px",
                fontSize: 32,
                fontWeight: 800,
                lineHeight: 1.08,
                letterSpacing: "-0.015em",
                color: NEX.textPrimary,
                textShadow: "0 2px 10px rgba(0,0,0,0.5)",
              }}
            >
              <span style={{ display: "block", fontSize: 24, fontWeight: 700 }}>
                Meet Your
              </span>
              <span
                style={{
                  display: "block",
                  color: NEX.secure,
                  fontSize: 34,
                  fontWeight: 900,
                  letterSpacing: "0.01em",
                }}
              >
                NEX SOCIALS
              </span>
            </h1>
            <p
              style={{
                margin: "10px 0 10px",
                fontSize: 15,
                fontWeight: 600,
                color: NEX.textPrimary,
                lineHeight: 1.4,
                textShadow: "0 1px 3px rgba(0,0,0,0.55)",
              }}
            >
              New business. New friends. New relationships.
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.55,
                color: NEX.textSecondary,
                textShadow: "0 1px 3px rgba(0,0,0,0.5)",
              }}
            >
              Discover your people, build meaningful connections, and open
              doors to new opportunities.
            </p>
          </section>

          {/* ── Capability tiles · 4 columns with the owner-supplied
                 icon strip. Labels use the az3 template verbatim since
                 the primary CTA is "Coming Soon" (not a route) and the
                 sealed chooser is not linked from this page. ── */}
          <section
            data-nex-socials-intro-capabilities
            style={{ marginBottom: 24 }}
          >
            <img
              src="/nex-socials/intro-capability-icons.png"
              alt="Business, Friends, Dating, Community"
              width={420}
              height={140}
              loading="lazy"
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                marginTop: 6,
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 6,
              }}
            >
              {CAPABILITIES.map((c) => (
                <div
                  key={c.title}
                  data-nex-socials-intro-capability={c.title.toLowerCase()}
                  style={{
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: c.accent,
                      lineHeight: 1.2,
                    }}
                  >
                    {c.title}
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      lineHeight: 1.3,
                      color: NEX.textSecondary,
                    }}
                  >
                    {c.subtitle}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Phone fan preview · owner-supplied 5-phone mockup. ── */}
          <section
            data-nex-socials-intro-preview
            style={{ marginBottom: 24, width: "100%" }}
          >
            <img
              src="/nex-socials/intro-phone-fan.png"
              alt="NEX Socials app preview · For You, Friends, Business, Community feed · Find Friends list · chat with Alex Carter"
              width={420}
              height={218}
              loading="lazy"
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                userSelect: "none",
                pointerEvents: "none",
                filter: "drop-shadow(0 20px 36px rgba(0, 175, 255, 0.22))",
              }}
            />
          </section>

          {/* ── Primary CTA · "Coming Soon" per owner directive 2026-
                 10-15. Rendered as an aria-disabled button so screen
                 readers announce the inactive state honestly. Does
                 NOT navigate · the sealed chooser is deliberately not
                 linked here. ── */}
          <button
            type="button"
            disabled
            aria-disabled="true"
            data-nex-socials-intro-primary-cta="coming-soon"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: "16px 22px",
              borderRadius: 999,
              background: NEX.accent,
              color: "#1A1300",
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              border: "none",
              cursor: "not-allowed",
              opacity: 0.72,
              boxShadow:
                "0 10px 24px rgba(255,114,0,0.22), inset 0 1px 0 rgba(255,255,255,0.3)",
              fontFamily: "inherit",
            }}
          >
            Coming Soon
          </button>
          <p
            style={{
              margin: "10px 0 0",
              textAlign: "center",
              fontSize: 11.5,
              color: NEX.textMuted,
              letterSpacing: "0.04em",
            }}
          >
            NEX Socials is almost here.
          </p>
        </div>
      </main>
    </>
  );
}
