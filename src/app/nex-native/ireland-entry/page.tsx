// src/app/nex-native/ireland-entry/page.tsx
//
// NEX Ireland · entry landing. Owner directive 2026-11-04 later-same-day.
// --------------------------------------------------------
// First page every Ireland visitor sees. No sign-up form on this
// surface · just the Ireland hero image + an orange "Enter Ireland"
// button at the footer. The button routes to /free-chat which is
// where first-time users pick their chat theme + create their
// account.
//
// Layout invariants (owner-reported 2026-11-04 later-same-day):
//   · NO scrolling · page is locked to a single viewport
//   · Image fully visible · uses objectFit: cover with center
//     position so mobile portrait fills cleanly; the orange
//     button at the bottom is always on top of the image
//   · Button must be present at the bottom · absolutely positioned
//     so it's never hidden by flex-layout quirks
//
// Session behaviour:
//   · No session (guest · first visit)      → render hero + Enter button
//   · Session exists (returning signed-in)  → redirect to /contacts

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORANGE = "#FF7200";
const DARK_BG = "#0A1428";

export default async function IrelandEntryPage() {
  const session = await resolveNexAppSessionFromContext();
  if (session) {
    redirect("/nex-native/contacts");
  }

  return (
    <>
      {/* Hard-lock scrolling at the document level · the <main> below is
          also overflow:hidden but html/body need this too to prevent the
          body from scrolling the viewport on iOS Safari. */}
      <style>{`
        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
          overscroll-behavior: none;
          background: ${DARK_BG};
        }
        /* Owner directive 2026-11-04 later-same-day · "enter ireland
           button little glow heartbeat" · gentle 1800ms box-shadow
           pulse on the orange CTA · blur + spread intensifies at the
           middle of the cycle so the button looks like it's breathing. */
        @keyframes nex-enter-ireland-heartbeat {
          0%, 100% {
            box-shadow:
              0 6px 18px rgba(255, 114, 0, 0.42),
              0 2px 6px rgba(0, 0, 0, 0.4);
          }
          50% {
            box-shadow:
              0 6px 26px rgba(255, 114, 0, 0.78),
              0 0 40px rgba(255, 114, 0, 0.32),
              0 2px 6px rgba(0, 0, 0, 0.4);
          }
        }
        [data-nex-ireland-entry-cta] {
          animation: nex-enter-ireland-heartbeat 1800ms ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-ireland-entry-cta] { animation: none; }
        }
      `}</style>

      <main
        data-nex-ireland-entry
        style={{
          position: "relative",
          width: "100%",
          height: "100dvh",
          overflow: "hidden",
          background: DARK_BG,
          color: "#fff",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* Full-viewport hero image · owner directive 2026-11-04 later-
            same-day · "remove the screen scrolling from landing page
            image full height". Image renders at the FULL viewport
            height with aspect ratio preserved · centred horizontally.
            On viewports wider than the image's 9:16 aspect, the image
            is narrower than the viewport and the dark bg shows at the
            sides. On narrow viewports the image may extend past the
            viewport width · the main's `overflow: hidden` crops it. */}
        <img
          src="/nex-brand/ireland-entry-hero.png"
          alt="NEX Ireland · Chat · Connect · Explore"
          data-nex-ireland-entry-hero
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            height: "100%",
            width: "auto",
            maxWidth: "none",
            zIndex: 0,
            pointerEvents: "none",
            userSelect: "none",
            display: "block",
          }}
        />

        {/* Footer button · owner directive 2026-11-04 later-same-day
            "footer button move up and reduce size center page width" ·
            compact pill centred on page · positioned a percentage from
            the bottom (not flush with the edge) so the hero artwork's
            feature-tile row stays visible above it. */}
        <div
          data-nex-ireland-entry-footer
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 6vh)",
            display: "flex",
            justifyContent: "center",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <Link
            href="/nex-native/free-chat?show-themes=1"
            data-nex-ireland-entry-cta
            aria-label="Enter Ireland · continue to NEX"
            style={{
              display: "inline-block",
              width: "auto",
              padding: "12px 28px",
              borderRadius: 999,
              background: ORANGE,
              color: "#FFFFFF",
              textAlign: "center",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 900,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              boxShadow: `0 6px 18px ${ORANGE}66, 0 2px 6px rgba(0,0,0,0.4)`,
              pointerEvents: "auto",
            }}
          >
            Enter Ireland →
          </Link>
        </div>
      </main>
    </>
  );
}
