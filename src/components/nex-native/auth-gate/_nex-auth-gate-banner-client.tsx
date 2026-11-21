"use client";

// src/components/nex-native/auth-gate/_nex-auth-gate-banner-client.tsx
//
// NEX Auth Gate · signed-out banner · client surface.
// ---------------------------------------------------
// Owner-sealed 2026-11-21 · the signed-out view for any nex-native
// feature wrapped in <NexAuthGate>.
//
//   · Fills the viewport with the sealed phone-frame base colour
//     (--nex-world-drawer-bg) · nothing from the gated feature is
//     mounted, per owner-sealed option (i).
//   · A shade + blur overlay covers the full frame so the banner is
//     unmissable and taps on anything beneath are blocked.
//   · A rounded card slides DOWN from the top of the frame on mount ·
//     respects prefers-reduced-motion by skipping the slide and just
//     fading in.
//   · Container holds BOTH the primary "Sign in" CTA and the
//     secondary "Close" CTA · dismissing (Close) routes back via
//     router.back() because the feature stays gated.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface NexAuthGateBannerProps {
  readonly featureName: string;
  readonly returnTo: string;
}

export function NexAuthGateBanner({
  featureName,
  returnTo,
}: NexAuthGateBannerProps): React.JSX.Element {
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // Give the browser one frame to paint the pre-slide position so
    // the transition actually plays from -120% → 0 instead of starting
    // mid-flight on slow connections.
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const signInHref = `/nex-native/sign-in?next=${encodeURIComponent(returnTo)}`;

  const onClose = React.useCallback(() => {
    router.back();
  }, [router]);

  return (
    <div
      data-nex-auth-gate
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--nex-world-drawer-bg, #0A1526)",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        zIndex: 100,
      }}
    >
      {/* Shade + blur backdrop · covers the full frame · the gated
          feature is NOT mounted behind it, per sealed option (i). */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.45)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      {/* Owner directive 2026-11-21 (iter 12) · banner centered on the
          phone-frame (vertical + horizontal). Still slides DOWN from
          above the viewport on mount · ends at the centre. Only the
          transform animates · top/left stay fixed so the browser GPU-
          accelerates the slide. */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="nex-auth-gate-title"
        aria-describedby="nex-auth-gate-body"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          // Owner directive 2026-11-21 (iter 13) · banner too wide ·
          // narrowed from 360 → 300 so the card reads as a focused
          // notification, not a page panel. Width still respects the
          // phone-frame side gutters via calc(100% - 48px).
          width: "calc(100% - 48px)",
          maxWidth: 300,
          transform: mounted
            ? "translate(-50%, -50%)"
            : "translate(-50%, calc(-50% - 60vh))",
          opacity: mounted ? 1 : 0,
          transition:
            "transform 420ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 240ms ease-out",
          // Owner directive 2026-11-21 (iter 13) · banner card uses
          // the sealed app cream (--nex-world-cream · #FAF8F4), not
          // the tile-only #EAE6DD. Keeps the signed-out banner
          // visually consistent with every other cream NEX surface
          // (shop setup · cart · orders · [businessSlug] · tier).
          background: "var(--nex-world-cream, #FAF8F4)",
          borderRadius: 20,
          padding: "18px 18px 16px",
          boxShadow:
            "0 30px 80px rgba(0, 0, 0, 0.55), 0 4px 12px rgba(0, 0, 0, 0.28)",
          border: "1px solid rgba(26, 26, 26, 0.08)",
        }}
      >
        <style>{`
          /* Owner directive 2026-11-21 (iter 12) · heartbeat glow on
             the Sign in CTA · 2.4s human-tempo cycle · pulses the halo
             only so button text stays 100% readable. */
          @keyframes nex-auth-gate-pulse {
            0%, 100% {
              box-shadow:
                0 4px 14px color-mix(in srgb, var(--nex-kp-accent, #FF7200) 30%, transparent),
                0 0 0 0 color-mix(in srgb, var(--nex-kp-accent, #FF7200) 0%, transparent);
            }
            50% {
              box-shadow:
                0 6px 18px color-mix(in srgb, var(--nex-kp-accent, #FF7200) 50%, transparent),
                0 0 26px 6px color-mix(in srgb, var(--nex-kp-accent, #FF7200) 42%, transparent);
            }
          }
          [data-nex-auth-gate-primary] {
            animation: nex-auth-gate-pulse 2.4s ease-in-out infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            [data-nex-auth-gate] > [role="alertdialog"] {
              transition: opacity 180ms ease-out !important;
              transform: translate(-50%, -50%) !important;
            }
            [data-nex-auth-gate-primary] {
              animation: none !important;
              box-shadow:
                0 6px 18px color-mix(in srgb, var(--nex-kp-accent, #FF7200) 45%, transparent),
                0 0 24px 4px color-mix(in srgb, var(--nex-kp-accent, #FF7200) 35%, transparent) !important;
            }
          }
        `}</style>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background:
                "linear-gradient(140deg, var(--nex-kp-accent, #FF7200), color-mix(in srgb, var(--nex-kp-accent, #FF7200) 65%, #000))",
              color: "#FFFFFF",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              boxShadow:
                "0 6px 16px color-mix(in srgb, var(--nex-kp-accent, #FF7200) 40%, transparent)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z"
                fill="currentColor"
              />
            </svg>
          </div>
          <div
            id="nex-auth-gate-title"
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "#1A1A1A",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}
          >
            Sign in required
          </div>
        </div>

        <div
          id="nex-auth-gate-body"
          style={{
            fontSize: 13,
            color: "#4A4A4A",
            lineHeight: 1.45,
            marginBottom: 14,
          }}
        >
          You must be signed in to use {featureName} features.
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
          }}
        >
          <Link
            href={signInHref}
            data-nex-auth-gate-primary
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              padding: "10px 12px",
              borderRadius: 12,
              background: "var(--nex-kp-accent, #FF7200)",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 700,
              textAlign: "center",
              textDecoration: "none",
              whiteSpace: "nowrap",
              boxShadow:
                "0 4px 14px color-mix(in srgb, var(--nex-kp-accent, #FF7200) 35%, transparent)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            Sign in
          </Link>
          {/* Owner directive 2026-11-21 (iter 13) · Close was getting
              clipped on the narrower container because flex:1 on Sign
              in squeezed it. flexShrink:0 + whiteSpace:nowrap pins
              Close at its intrinsic width so the label always reads
              in full. */}
          <button
            type="button"
            onClick={onClose}
            data-nex-auth-gate-close
            style={{
              flexShrink: 0,
              minHeight: 44,
              padding: "10px 14px",
              borderRadius: 12,
              background: "transparent",
              border: "1.5px solid rgba(26, 26, 26, 0.18)",
              color: "#1A1A1A",
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
