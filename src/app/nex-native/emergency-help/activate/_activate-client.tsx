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

interface Step {
  readonly n: 1 | 2 | 3 | 4;
  readonly title: string;
  readonly body: string;
}

/** Owner-authored 2026-10-24 · verbatim. */
const STEPS: ReadonlyArray<Step> = [
  {
    n: 1,
    title: "Press Emergency",
    body:
      "A dedicated emergency screen opens with a countdown and a Cancel button.",
  },
  {
    n: 2,
    title: "Your alert shares essential details",
    body:
      "If the alert is sent, NEX shares your NEX name and ID, the time and date, and your available location with the appropriate recipients.",
  },
  {
    n: 3,
    title: "People can coordinate help",
    body:
      "Trusted contacts and eligible nearby NEX members can receive the alert and, where supported, join a temporary response group.",
  },
  {
    n: 4,
    title: "Everyone plays a part",
    body:
      "Respect privacy, share helpful information and never put yourself or others in danger. NEX does not replace emergency services.",
  },
];

export interface ActivateClientProps {
  readonly returnTo: string;
}

export function ActivateClient(
  props: ActivateClientProps,
): React.JSX.Element {
  const router = useRouter();
  const [agreed, setAgreed] = React.useState(false);
  const [checkboxShake, setCheckboxShake] = React.useState(0);

  const handleActivate = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (!agreed) {
        setCheckboxShake((v) => v + 1);
        return;
      }
      const safeReturnTo =
        props.returnTo.startsWith("/") && !props.returnTo.startsWith("//")
          ? props.returnTo
          : "/nex-native/emergency-help";
      markEmergencyActivated();
      router.push(safeReturnTo);
    },
    [agreed, props.returnTo, router],
  );

  return (
    <div
      data-nex-emergency-activate-page
      style={{
        position: "relative",
        minHeight: "100vh",
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
            NEX Emergency Help · first-time setup
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

        <p
          style={{
            margin: 0,
            fontSize: 13.5,
            lineHeight: 1.5,
            color: NEX.text,
            opacity: 0.95,
          }}
        >
          NEX Emergency Help is designed to help you reach trusted contacts
          and nearby NEX members when you need urgent assistance.
        </p>

        {/* How it works */}
        <div
          data-nex-emergency-activate-steps
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.cyan,
            }}
          >
            How it works
          </div>
          {STEPS.map((s) => (
            <div
              key={s.n}
              data-nex-emergency-activate-step={s.n}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: NEX.surface,
                border: `1px solid ${NEX.border}`,
              }}
            >
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: NEX.cyan,
                  color: "#031018",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {s.n}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 800,
                    marginBottom: 2,
                  }}
                >
                  {s.title}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.45,
                    color: NEX.textDim,
                  }}
                >
                  {s.body}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Explicit disclosure · recipients + location + guarantee boundary */}
        <div
          data-nex-emergency-activate-disclosure
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(255, 51, 85, 0.08)",
            border: "1px solid rgba(255, 51, 85, 0.35)",
            fontSize: 12.5,
            lineHeight: 1.5,
            color: NEX.text,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#FF6B81",
              marginBottom: 6,
            }}
          >
            Before you activate
          </div>
          <div style={{ marginBottom: 6 }}>
            <strong>Who may receive the alert:</strong> your chosen trusted
            contacts, plus eligible nearby NEX members who have opted in to
            help as responders.
          </div>
          <div style={{ marginBottom: 6 }}>
            <strong>What location is shared:</strong> the location captured
            when you press Emergency, labelled by accuracy (precise,
            approximate, or unavailable). You can cancel before the alert is
            sent.
          </div>
          <div>
            <strong>NEX cannot guarantee a response.</strong> Nearby members
            may not receive or act on an alert. NEX does not replace
            emergency services — if you are in immediate danger, contact
            local emergency services first.
          </div>
        </div>

        {/* Device-local prototype honesty */}
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.4,
            color: NEX.textDim,
            fontStyle: "italic",
          }}
        >
          Prototype: this consent is remembered on this device only. Signing
          out, clearing data, or using another device will show this page
          again.
        </div>

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
            onClick={handleActivate}
            disabled={!agreed}
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
              cursor: agreed ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              transition: "background 180ms, color 180ms, transform 100ms",
            }}
          >
            Activate Emergency Help
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              fontSize: 12,
            }}
          >
            <Link
              href="/nex-native/emergency-help/activate"
              data-nex-emergency-activate-review-link
              style={{
                color: NEX.cyan,
                textDecoration: "underline",
                fontWeight: 700,
              }}
            >
              Review emergency settings
            </Link>
            <Link
              href="/"
              data-nex-emergency-activate-not-now
              style={{
                color: NEX.textDim,
                textDecoration: "none",
              }}
            >
              Not now
            </Link>
          </div>

          <div
            data-nex-emergency-activate-concept-disclaimer
            style={{
              fontSize: 10.5,
              lineHeight: 1.4,
              color: NEX.textDim,
              textAlign: "center",
              opacity: 0.9,
            }}
          >
            Illustrative design only. This button does not activate the real
            NEX feature. Real alert delivery remains disabled while NEX
            Emergency Help is in prototype.
          </div>
        </div>
      </div>
    </div>
  );
}
