"use client";

// src/app/nex-native/live-commerce/welcome/_welcome-client.tsx
//
// NEX Live · Welcome page body. Owner directive 2026-10-24 (compact
// rewrite):
//   "we need to shorten this to screen with out scrolling and have
//    link the user can read for live posting online nex and
//    supended accounts we can at any time with out notice . make
//    sure nex is protected at all times and information is totally
//    what they post their responcibility"
//
// Design:
//   · One-screen fit · the whole experience is visible without
//     scrolling on a standard phone viewport (~820-915px tall).
//   · Full-bleed streamer background image · stretches to fit both
//     dimensions (owner directive · no crop, no letterbox).
//   · Compact rules row: 5 one-line titles with icons (no body text
//     inline) · body copy lives on the linked guidelines page.
//   · Short NEX-protection summary + link to full guidelines so the
//     owner-posting-is-your-responsibility + suspension-at-any-time
//     language is one tap away.
//   · Agreement checkbox + "Let's Go LIVE!" CTA + honest concept-
//     preview disclaimer.
//
// Owner-sealed copy (verbatim):
//   · Title, sub-tagline, 5 rule titles, closing kindness line,
//     checkbox copy, CTA label, concept-preview disclaimer.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markLiveWelcomeAccepted } from "@/lib/nex-native/live-broadcast/live-welcome-acceptance";
import { ControlDrawer } from "@/components/nex-native/control-drawer/control-drawer-client";

const NEX = {
  text: "#F2F5F8",
  textDim: "#C8D4E8",
  cyan: "#00AFFF",
  red: "#FF3355",
  orange: "#FF7200",
  gold: "#FFC24B",
} as const;

const GUIDELINES_HREF = "/nex-native/live-commerce/guidelines";

/** Owner-authored 2026-10-24 · the 5 titles stay verbatim. Rendered
 *  as a plain bulleted list (owner directive 2026-10-24 · "remove
 *  icons add bullet points"). */
const RULES: ReadonlyArray<string> = [
  "Be kind, be yourself",
  "Keep your private life private",
  "Help everyone feel welcome",
  "Share honestly",
  "You're in control",
];

export interface WelcomeClientProps {
  readonly returnTo: string;
}

export function WelcomeClient(
  props: WelcomeClientProps,
): React.JSX.Element {
  const router = useRouter();
  const [agreed, setAgreed] = React.useState(false);
  const [checkboxShake, setCheckboxShake] = React.useState(0);

  const handleCta = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!agreed) {
        e.preventDefault();
        setCheckboxShake((v) => v + 1);
        return;
      }
      // Owner directive 2026-10-28 (revised · "remove this page from
      // before enter broadcaster room") · the agreement CTA now
      // routes directly to /enter-broadcast-room. The splash moved
      // from pre-entry doorway to post-tap transition inside the
      // broadcast room itself.
      const safeReturnTo =
        props.returnTo.startsWith("/") && !props.returnTo.startsWith("//")
          ? props.returnTo
          : "/nex-native/live-commerce/enter-broadcast-room";
      e.preventDefault();
      markLiveWelcomeAccepted();
      router.push(safeReturnTo);
    },
    [agreed, props.returnTo, router],
  );

  return (
    <div
      data-nex-live-welcome-page
      style={{
        position: "relative",
        // Fit the sealed phone frame exactly · the parent
        // `.nex-native-frame` is `min(780px, 100dvh - 32px)` on desktop
        // and `100dvh` on mobile. Using `100vh` here overflows that
        // frame (desktop viewport > 780px, mobile 100vh > 100dvh when
        // the browser chrome is visible) and caused scrolling.
        height: "100%",
        width: "100%",
        overflow: "hidden",
        // Owner directive 2026-10-24 · "back ground image must fit
        // height and width" · stretch to edges in both dimensions.
        backgroundImage: "url(/nex-live/welcome-gate-background.png)",
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Dark gradient overlay for legibility · stronger at top + bottom. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(6, 16, 30, 0.76) 0%, rgba(6, 16, 30, 0.5) 32%, rgba(6, 16, 30, 0.55) 60%, rgba(6, 16, 30, 0.9) 92%, rgba(6, 16, 30, 0.98) 100%)",
          pointerEvents: "none",
        }}
      />

      <style>{`
        @keyframes nexLiveWelcomeCtaPulse {
          0%, 100% { box-shadow: 0 10px 24px -8px rgba(255, 51, 85, 0.55); }
          50%      { box-shadow: 0 10px 32px -4px rgba(255, 51, 85, 0.9); }
        }
        @keyframes nexLiveWelcomeCheckboxShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-live-welcome-page] * { animation: none !important; }
        }
      `}</style>

      {/* Content column · fills height · sections flex-distribute. */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          maxWidth: 440,
          margin: "0 auto",
          // Owner directive 2026-10-24 · "little more space at header
          // and layout of the page" · increased top/side padding and
          // the inter-section gap so the whole surface breathes more.
          padding:
            "max(28px, calc(env(safe-area-inset-top, 0px) + 20px)) 20px calc(env(safe-area-inset-bottom, 0px) + 18px)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          boxSizing: "border-box",
        }}
      >
        {/* Title band · owner directive 2026-10-24 · 3-dot drawer
            trigger pinned to the right of the title row. The
            ControlDrawer renders its own vertical ⋮ button + sliding
            panel · we just reserve the space and let it mount. */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 4,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
            <h1
              id="nex-live-welcome-title"
              data-nex-live-welcome-title
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 900,
                lineHeight: 1.15,
                letterSpacing: "-0.01em",
                color: "#FFFFFF",
                textShadow:
                  "0 2px 10px rgba(0, 0, 0, 0.75), 0 1px 2px rgba(0, 0, 0, 0.85)",
              }}
            >
              Welcome to NEX LIVE! <span aria-hidden>🎉</span>
            </h1>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: NEX.gold,
                letterSpacing: "0.02em",
                textShadow: "0 1px 3px rgba(0, 0, 0, 0.85)",
              }}
            >
              Lets Make live Great
            </div>
          </div>
          <div
            data-nex-live-welcome-drawer-slot
            style={{ flexShrink: 0, marginTop: 2 }}
          >
            {/* Anonymous session · the welcome page runs before auth
                is required. The drawer still renders its guest state
                (Sign in to NEX bar + locked rows + the Live/Vault/
                Socials quick-access buttons). */}
            <ControlDrawer session={null} />
          </div>
        </div>

        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: NEX.cyan,
            textShadow: "0 1px 3px rgba(0, 0, 0, 0.75)",
          }}
        >
          Let&apos;s make LIVE great for everyone
        </div>

        {/* Owner directive 2026-10-24 · "remove icons add bullet
            points" · plain bulleted list, no emoji glyphs. */}
        <ul
          data-nex-live-welcome-rules
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {RULES.map((title) => (
            <li
              key={title}
              data-nex-live-welcome-rule
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(6, 16, 30, 0.6)",
                border: "1px solid rgba(0, 175, 255, 0.28)",
                fontSize: 13.5,
                fontWeight: 700,
                color: NEX.text,
              }}
            >
              <span
                aria-hidden
                style={{
                  fontSize: 18,
                  lineHeight: 1,
                  color: NEX.cyan,
                  flexShrink: 0,
                }}
              >
                •
              </span>
              <span>{title}</span>
            </li>
          ))}
        </ul>

        {/* Owner directive 2026-10-24 · protection sentence replaced
            by a single link to the full guidelines page. The policy
            language (suspension at any time · your responsibility ·
            local laws) all lives on `/nex-native/live-commerce/
            guidelines` and reads one tap away. */}
        <Link
          href={GUIDELINES_HREF}
          data-nex-live-welcome-guidelines-link
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(0, 175, 255, 0.14)",
            border: "1px solid rgba(0, 175, 255, 0.5)",
            color: NEX.cyan,
            fontSize: 13,
            fontWeight: 800,
            textDecoration: "none",
            textAlign: "center",
            textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Guidelines When Live On NEX <span aria-hidden>→</span>
        </Link>

        {/* Footer · checkbox + CTA, pinned to the bottom via margin-top:auto */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: 10,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <label
            key={checkboxShake}
            data-nex-live-welcome-agree-row
            data-nex-live-welcome-agreed={agreed ? "true" : "false"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 12,
              lineHeight: 1.3,
              color: NEX.text,
              cursor: "pointer",
              userSelect: "none",
              padding: "8px 10px",
              borderRadius: 10,
              background: agreed
                ? "rgba(0, 175, 255, 0.18)"
                : "rgba(6, 16, 30, 0.7)",
              border: agreed
                ? "1px solid rgba(0, 175, 255, 0.65)"
                : "1px solid rgba(255, 255, 255, 0.14)",
              transition: "background 160ms, border-color 160ms",
              animation:
                checkboxShake > 0
                  ? "nexLiveWelcomeCheckboxShake 360ms ease-in-out"
                  : undefined,
            }}
          >
            <input
              type="checkbox"
              data-nex-live-welcome-agree
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{
                width: 18,
                height: 18,
                accentColor: NEX.cyan,
                cursor: "pointer",
                flexShrink: 0,
              }}
            />
            <span>
              I&apos;ll do my part to keep NEX LIVE friendly, respectful and
              safe.
            </span>
          </label>

          <a
            href={props.returnTo}
            data-nex-live-welcome-cta
            data-nex-live-welcome-cta-enabled={agreed ? "true" : "false"}
            aria-disabled={!agreed}
            onClick={handleCta}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              minHeight: 52,
              padding: "0 20px",
              borderRadius: 14,
              background: agreed
                ? `linear-gradient(135deg, ${NEX.red} 0%, ${NEX.orange} 100%)`
                : "rgba(255, 255, 255, 0.12)",
              color: agreed ? "#FFFFFF" : "rgba(255, 255, 255, 0.5)",
              fontSize: 15,
              fontWeight: 900,
              letterSpacing: "0.04em",
              textDecoration: "none",
              textAlign: "center",
              textShadow: agreed ? "0 1px 3px rgba(0, 0, 0, 0.4)" : "none",
              boxShadow: agreed
                ? "0 10px 24px -8px rgba(255, 51, 85, 0.55)"
                : "none",
              animation: agreed
                ? "nexLiveWelcomeCtaPulse 1800ms ease-in-out infinite"
                : undefined,
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              cursor: agreed ? "pointer" : "not-allowed",
              transition: "background 180ms, color 180ms",
            }}
          >
            <span aria-hidden style={{ fontSize: 18 }}>▶</span>
            <span>Let&apos;s Go LIVE!</span>
          </a>

        </div>
      </div>
    </div>
  );
}
