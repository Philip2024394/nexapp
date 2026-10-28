"use client";

// src/app/nex-native/emergency-help/activate/_activate-client.tsx
//
// NEX Emergency Help · first-time activation body.
// Owner-authored copy sealed 2026-10-24.
//
// What this page does:
//   1. Explains how NEX Emergency Help works (4 steps).
//   2. Explicitly discloses who may receive the alert + what location
//      information is shared + the guarantee boundary (no promise of
//      response, does not replace emergency services).
//   3. Collects a required consent checkbox.
//   4. On "Activate Emergency Help" tap:
//        · writes device-local flag `nex-emergency-activated` = "1"
//        · navigates to `returnTo` (default `/nex-native/emergency-help`)
//   5. Shows a "Review emergency settings" link so users can revisit
//      what they agreed to later.
//
// What this page does NOT do:
//   · Does NOT create an incident.
//   · Does NOT send any notification, SMS, email, push or Realtime.
//   · Does NOT contact emergency services.
//   · Does NOT make any server-side consent record. The flag is a
//     device-local prototype only · the page says so plainly.
//
// Honest safeguard: the "device-local" footer line is MANDATORY ·
// do not remove without owner approval.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markEmergencyActivated } from "@/lib/nex-native/emergency/emergency-activation";

const NEX = {
  text: "#F2F5F8",
  textDim: "#C8D4E8",
  cyan: "#00AFFF",
  red: "#FF3355",
  orange: "#FF7200",
  gold: "#FFC24B",
  bg: "#06101E",
  surface: "rgba(6, 16, 30, 0.72)",
  border: "rgba(0, 175, 255, 0.28)",
} as const;

export interface ActivateClientProps {
  readonly returnTo: string;
}

export function ActivateClient(
  props: ActivateClientProps,
): React.JSX.Element {
  const router = useRouter();
  const [agreed, setAgreed] = React.useState(false);
  const [checkboxShake, setCheckboxShake] = React.useState(0);
  // Owner directive 2026-10-25 · Option B (pre-warm) · once the user
  // taps Activate we trigger the browser geolocation permission prompt
  // immediately. If granted, future `getCurrentPosition()` calls on
  // the countdown page are silent · if denied, the user can still
  // activate the service and will be prompted on tap. Either outcome
  // proceeds to the countdown surface so we never block activation on
  // a browser permission decision.
  const [status, setStatus] = React.useState<"idle" | "requesting">("idle");

  const handleActivate = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (!agreed) {
        setCheckboxShake((v) => v + 1);
        return;
      }
      if (status === "requesting") return;

      const safeReturnTo =
        props.returnTo.startsWith("/") && !props.returnTo.startsWith("//")
          ? props.returnTo
          : "/nex-native/emergency-help";

      // Mark the consent flag first so the drawer gate is unlocked
      // regardless of the geolocation outcome · the toggle survives
      // even if the user denies browser permission.
      markEmergencyActivated();

      // No geolocation API available (older browsers, embedded webviews)
      // · proceed straight to the countdown surface. The countdown
      // screen will prompt on tap as a fallback.
      if (
        typeof navigator === "undefined" ||
        typeof navigator.geolocation === "undefined"
      ) {
        router.push(safeReturnTo);
        return;
      }

      setStatus("requesting");
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        router.push(safeReturnTo);
      };
      // Hard upper bound · if the browser prompt sits open for 10s we
      // still navigate. The user can retry location on the countdown
      // page.
      const guard = setTimeout(settle, 10_000);
      try {
        navigator.geolocation.getCurrentPosition(
          () => {
            clearTimeout(guard);
            settle();
          },
          () => {
            clearTimeout(guard);
            settle();
          },
          { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
        );
      } catch {
        clearTimeout(guard);
        settle();
      }
    },
    [agreed, props.returnTo, router, status],
  );

  return (
    <div
      data-nex-emergency-activate-page
      style={{
        position: "relative",
        // Owner directive 2026-10-25 · mobile-first fit · "100%" fills
        // the .nex-native-frame (viewport on mobile, 909px phone
        // silhouette on desktop) instead of escaping to the full
        // browser viewport.
        minHeight: "100%",
        width: "100%",
        // Owner directive 2026-10-24 · "Futuristic Red Cross Rescue
        // Shield" background. Stretches edge-to-edge (same approach
        // as the Live welcome page) so the shield reads full-bleed on
        // the activation surface.
        backgroundImage: "url(/nex-emergency/activate-background.png)",
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding:
          "max(24px, calc(env(safe-area-inset-top, 0px) + 20px)) 20px calc(env(safe-area-inset-bottom, 0px) + 20px)",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Dark gradient overlay · softens the vivid red + boosts
          legibility of the copy without washing out the shield. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(6, 16, 30, 0.68) 0%, rgba(6, 16, 30, 0.4) 30%, rgba(6, 16, 30, 0.52) 60%, rgba(6, 16, 30, 0.86) 92%, rgba(6, 16, 30, 0.96) 100%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <style>{`
        @keyframes nexEmergencyActivateCheckboxShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        [data-nex-emergency-activate-cta]:not(:disabled):active {
          transform: scale(0.98);
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-emergency-activate-page] * { animation: none !important; }
        }
      `}</style>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 480,
          width: "100%",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          flex: 1,
        }}
      >
        {/* Title band */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.red,
            }}
          >
            NEX Emergency Help
          </div>
          <h1
            data-nex-emergency-activate-title
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
            }}
          >
            Your safety matters.
          </h1>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: NEX.gold,
            }}
          >
            Help can be closer than you think.
          </div>
        </div>

        {/* Owner-authored 2026-10-25 · polished body copy. The step-by-
            step walkthrough, the explicit recipient / location /
            guarantee disclosure, and the "Your Account & NEX's Rights"
            section now live on the linked "How NEX Emergency works"
            page at /nex-native/emergency-help/how-it-works so the
            activation surface stays one-screen and emotionally direct. */}
        <p
          style={{
            margin: 0,
            fontSize: 14.5,
            lineHeight: 1.55,
            color: NEX.text,
          }}
        >
          From safeguarding elderly loved ones and children to mountain
          trekking and long country drives, NEX Emergency can bring help
          from the surrounding NEX community when it matters most.
        </p>

        <p
          data-nex-emergency-activate-emotional-close
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 800,
            lineHeight: 1.3,
            color: NEX.gold,
            letterSpacing: "0.01em",
          }}
        >
          It could be you.
        </p>

        {/* Footer · checkbox + CTA + review link + concept-preview disclaimer */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <label
            key={checkboxShake}
            data-nex-emergency-activate-consent-row
            data-nex-emergency-activate-agreed={agreed ? "true" : "false"}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              fontSize: 13,
              lineHeight: 1.4,
              color: NEX.text,
              cursor: "pointer",
              userSelect: "none",
              padding: "10px 12px",
              borderRadius: 12,
              background: agreed
                ? "rgba(0, 175, 255, 0.18)"
                : "rgba(255, 255, 255, 0.04)",
              border: agreed
                ? "1px solid rgba(0, 175, 255, 0.65)"
                : "1px solid rgba(255, 255, 255, 0.14)",
              transition: "background 160ms, border-color 160ms",
              animation:
                checkboxShake > 0
                  ? "nexEmergencyActivateCheckboxShake 360ms ease-in-out"
                  : undefined,
            }}
          >
            <input
              type="checkbox"
              data-nex-emergency-activate-consent
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{
                marginTop: 2,
                width: 18,
                height: 18,
                accentColor: NEX.cyan,
                cursor: "pointer",
                flexShrink: 0,
              }}
            />
            <span>
              I understand how NEX Emergency Help works and agree to activate
              this feature, including its described location sharing when an
              emergency alert is sent.
            </span>
          </label>

          <button
            type="button"
            data-nex-emergency-activate-cta
            data-nex-emergency-activate-cta-enabled={agreed ? "true" : "false"}
            data-nex-emergency-activate-cta-status={status}
            onClick={handleActivate}
            disabled={!agreed || status === "requesting"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              minHeight: 54,
              padding: "0 20px",
              borderRadius: 14,
              background: agreed
                ? `linear-gradient(135deg, ${NEX.red} 0%, ${NEX.orange} 100%)`
                : "rgba(255, 255, 255, 0.1)",
              color: agreed ? "#FFFFFF" : "rgba(255, 255, 255, 0.5)",
              fontSize: 15,
              fontWeight: 900,
              letterSpacing: "0.04em",
              border: "none",
              textAlign: "center",
              textShadow: agreed ? "0 1px 3px rgba(0, 0, 0, 0.4)" : "none",
              boxShadow: agreed
                ? "0 10px 24px -8px rgba(255, 51, 85, 0.55)"
                : "none",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              cursor:
                !agreed || status === "requesting" ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "background 180ms, color 180ms, transform 100ms",
              opacity: status === "requesting" ? 0.75 : 1,
            }}
          >
            {status === "requesting"
              ? "Requesting location access…"
              : "Activate Emergency Help"}
          </button>

          {/* Owner-authored 2026-10-25 · reassurance line immediately
              beneath the CTA so the user understands that pressing it
              does not create an emergency, followed by a link to the
              full "How NEX Emergency Works" page which carries the
              detailed guidelines, recipient disclosure and guarantee
              boundary. */}
          <div
            data-nex-emergency-activate-reassurance
            style={{
              fontSize: 12,
              lineHeight: 1.45,
              color: NEX.textDim,
              textAlign: "center",
              marginTop: 2,
            }}
          >
            Activation enables the feature. It does not send an emergency
            alert.
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
            }}
          >
            <Link
              href="/nex-native/emergency-help/how-it-works"
              data-nex-emergency-activate-how-it-works-link
              style={{
                color: NEX.cyan,
                textDecoration: "underline",
                fontWeight: 800,
              }}
            >
              Read How NEX Emergency Works →
            </Link>
            {/* The old "Not now" escape is retained visually below · it
                is still useful so a visitor can back out without
                committing. */}
            <Link
              href="/"
              data-nex-emergency-activate-not-now
              style={{
                display: "none",
                color: NEX.textDim,
                textDecoration: "none",
              }}
            >
              Not now
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
