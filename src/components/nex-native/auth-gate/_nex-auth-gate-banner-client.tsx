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

      {/* Banner slides down from the top of the frame. */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="nex-auth-gate-title"
        aria-describedby="nex-auth-gate-body"
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 20px)",
          left: 16,
          right: 16,
          maxWidth: 420,
          margin: "0 auto",
          transform: mounted ? "translateY(0)" : "translateY(-120%)",
          opacity: mounted ? 1 : 0,
          transition:
            "transform 320ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 240ms ease-out",
          background: "#EAE6DD",
          borderRadius: 20,
          padding: "18px 18px 16px",
          boxShadow:
            "0 24px 60px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.25)",
          border: "1px solid rgba(26, 26, 26, 0.08)",
        }}
      >
        <style>{`
          @media (prefers-reduced-motion: reduce) {
            [data-nex-auth-gate] > [role="alertdialog"] {
              transition: opacity 180ms ease-out !important;
              transform: translateY(0) !important;
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
              minHeight: 44,
              padding: "10px 14px",
              borderRadius: 12,
              background: "var(--nex-kp-accent, #FF7200)",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 700,
              textAlign: "center",
              textDecoration: "none",
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
          <button
            type="button"
            onClick={onClose}
            data-nex-auth-gate-close
            style={{
              minHeight: 44,
              padding: "10px 16px",
              borderRadius: 12,
              background: "transparent",
              border: "1.5px solid rgba(26, 26, 26, 0.18)",
              color: "#1A1A1A",
              fontSize: 14,
              fontWeight: 600,
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
