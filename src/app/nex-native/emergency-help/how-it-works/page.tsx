// src/app/nex-native/emergency-help/how-it-works/page.tsx
//
// NEX Emergency Help · "How it works" surface. Linked from the
// activation page in place of the one-line disclaimer "NEX cannot
// guarantee a response · In an emergency, contact local emergency
// services" so the full policy copy, the step-by-step walkthrough
// and the honest claims boundary all live one tap away.
//
// Owner-authored 2026-10-25. Server component · no interactivity.
// No DB write · no server action · no notification wiring.

import Link from "next/link";

export const metadata = {
  title: "How NEX Emergency Help works",
  description:
    "A step-by-step overview of NEX Emergency Help, who may receive an alert, what information is shared, and the honest limits of the service.",
};

const NEX = {
  bg: "#06101E",
  surface: "#0E1A2E",
  text: "#F2F5F8",
  textDim: "#C8D4E8",
  cyan: "#00AFFF",
  gold: "#FFC24B",
  red: "#FF3355",
  border: "rgba(0, 175, 255, 0.28)",
} as const;

interface Step {
  readonly n: 1 | 2 | 3 | 4;
  readonly title: string;
  readonly body: string;
}

const STEPS: ReadonlyArray<Step> = [
  {
    n: 1,
    title: "Press Emergency",
    body:
      "A dedicated emergency screen opens with a countdown and a Cancel button so an accidental tap can be stopped safely.",
  },
  {
    n: 2,
    title: "Essential details are shared",
    body:
      "If the alert is sent, NEX shares your display name and NEX ID, the time and date, and your available location with the appropriate recipients.",
  },
  {
    n: 3,
    title: "People can coordinate help",
    body:
      "Your chosen trusted contacts and eligible nearby NEX members can receive the alert and, where supported, join a temporary response group.",
  },
  {
    n: 4,
    title: "You stay in control",
    body:
      "Respect privacy, share helpful information, and never put yourself or others in danger. You can stop your broadcast, block or report someone, or take a break at any time.",
  },
];

export default function EmergencyHowItWorksPage(): React.JSX.Element {
  return (
    <div
      style={{
        minHeight: "100%",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding:
          "max(24px, env(safe-area-inset-top, 0px)) 20px calc(env(safe-area-inset-bottom, 0px) + 32px)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <nav style={{ marginBottom: 14 }}>
          <Link
            href="/nex-native/emergency-help/activate"
            data-nex-emergency-how-it-works-back
            style={{
              color: NEX.cyan,
              fontSize: 13,
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            ← Back
          </Link>
        </nav>

        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: NEX.red,
            marginBottom: 6,
          }}
        >
          NEX Emergency Help
        </div>
        <h1
          style={{
            margin: "0 0 6px",
            fontSize: 26,
            fontWeight: 900,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
          }}
        >
          How NEX Emergency works
        </h1>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: NEX.gold,
            marginBottom: 22,
            letterSpacing: "0.02em",
          }}
        >
          A clear overview of what happens, who sees what, and what NEX
          can and cannot promise.
        </div>

        {/* 4-step walkthrough */}
        <section style={{ marginBottom: 24 }}>
          <h2
            style={{
              margin: "0 0 10px",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.cyan,
            }}
          >
            Step by step
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {STEPS.map((s) => (
              <div
                key={s.n}
                data-nex-emergency-how-it-works-step={s.n}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: NEX.surface,
                  border: `1px solid ${NEX.border}`,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: NEX.cyan,
                    color: "#031018",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 13,
                    fontWeight: 900,
                  }}
                >
                  {s.n}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      marginBottom: 3,
                    }}
                  >
                    {s.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      color: NEX.textDim,
                    }}
                  >
                    {s.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Who may receive · what is shared · guarantee boundary */}
        <section
          data-nex-emergency-how-it-works-disclosure
          style={{
            marginBottom: 24,
            padding: "14px 16px",
            borderRadius: 12,
            background: "rgba(255, 51, 85, 0.08)",
            border: "1px solid rgba(255, 51, 85, 0.35)",
          }}
        >
          <h2
            style={{
              margin: "0 0 10px",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#FF6B81",
            }}
          >
            Before you activate
          </h2>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 13.5,
              lineHeight: 1.5,
              color: NEX.text,
            }}
          >
            <li>
              <strong>Who may receive the alert.</strong> Your chosen
              trusted contacts, plus eligible nearby NEX members who have
              opted in to help as responders.
            </li>
            <li>
              <strong>What location is shared.</strong> The location
              captured when you press Emergency, labelled by accuracy
              (precise, approximate, or unavailable). You can cancel
              before the alert is sent.
            </li>
            <li>
              <strong>NEX cannot guarantee a response.</strong> Nearby
              members may not receive or act on an alert. NEX does not
              replace emergency services. If you are in immediate
              danger, contact your local emergency number first.
            </li>
          </ul>
        </section>

        {/* Account & NEX's rights · summary with link to full guidelines */}
        <section
          style={{
            marginBottom: 24,
            padding: "14px 16px",
            borderRadius: 12,
            background: NEX.surface,
            border: `1px solid ${NEX.border}`,
          }}
        >
          <h2
            style={{
              margin: "0 0 10px",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.cyan,
            }}
          >
            Your account &amp; NEX&apos;s rights
          </h2>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 13.5,
              lineHeight: 1.5,
              color: NEX.text,
            }}
          >
            <li>
              What you post on NEX Emergency is your responsibility.
            </li>
            <li>
              NEX may suspend accounts at any time, without notice, if
              content or behaviour threatens the safety of the community.
            </li>
            <li>
              Local laws apply. You are responsible for ensuring your
              broadcast does not break the law in your location or the
              locations of your viewers.
            </li>
          </ul>
        </section>

        <div
          style={{
            fontSize: 11.5,
            lineHeight: 1.45,
            color: NEX.textDim,
            textAlign: "center",
            opacity: 0.9,
          }}
        >
          Draft overview · pending final policy review. The CTA on the
          activation page is a concept preview and does not start a live
          broadcast.
        </div>
      </div>
    </div>
  );
}
