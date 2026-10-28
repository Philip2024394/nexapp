// src/app/nex-native/emergency-help/what-to-do/page.tsx
//
// NEX Emergency Help · "What To Do" guide for responders who tapped
// "I will help". Owner directive 2026-10-25 · same Crimson Beacon
// background as the Alert Screen + Group page so it reads as part of
// the same emergency surface family.
//
// Server component · no interactivity in the prototype · pure content
// page with a back link to the group. The real build will tailor the
// guidance per incident category (medical, lost, accident, etc.)
// once incident classification lands.

import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "How To Help · NEX Emergency",
  description:
    "Guidance for responders who have joined a NEX Emergency Help group.",
};

const NEX = {
  bg: "#060108",
  surface: "rgba(10, 2, 8, 0.78)",
  text: "#F2F5F8",
  textDim: "#C8D4E8",
  textMuted: "#8EA0B8",
  red: "#FF3355",
  cyan: "#00AFFF",
  gold: "#FFC24B",
  green: "#2BD47F",
  border: "rgba(255, 51, 85, 0.42)",
} as const;

// Owner directive 2026-10-25 · world-class pass · each step is an
// icon-forward tile with a verb-first one-line body. Reads at a
// glance under stress; the long-form detail belongs in training, not
// on the stress-decision surface.
interface Step {
  readonly n: 1 | 2 | 3;
  readonly title: string;
  readonly body: string;
  readonly accent: string;
  readonly icon: "phone" | "shield" | "message";
}

const STEPS: ReadonlyArray<Step> = [
  {
    n: 1,
    title: "Call Services First",
    body:
      "Call your local emergency service. Nothing else before this.",
    accent: NEX.cyan,
    icon: "phone",
  },
  {
    n: 2,
    title: "Confirm In Group",
    body: "Say services are on the way so no one double-dials.",
    accent: NEX.cyan,
    icon: "shield",
  },
  {
    n: 3,
    title: "Keep Group Informed",
    body: "Post any updates that might be of help to other group members.",
    accent: NEX.cyan,
    icon: "message",
  },
];

// Owner directive 2026-10-25 · tap-to-reveal detail. Headlines read
// at a glance, the "why" is one tap away. Native <details><summary>
// is zero-JS and keyboard-accessible.
interface KnownPersonRule {
  readonly title: string;
  readonly body: string;
}

const KNOWN_PERSON_RULES: ReadonlyArray<KnownPersonRule> = [
  {
    title: "Call police anyway",
    body:
      "Familiarity never replaces the professional response. Make the call before you move.",
  },
  {
    title: "Never assume medical",
    body:
      "A seemingly medical crisis can mask an assault, coercion, or abduction. Assume other-person involvement.",
  },
  {
    title: "Never travel alone",
    body:
      "Bring a trusted companion, or wait for the police to arrive first. One helper walking in alone can turn a rescue into a second emergency.",
  },
];

export default async function WhatToDoPage(): Promise<React.JSX.Element> {
  // Owner directive 2026-10-25 · dev pass pattern · guest viewer can
  // preview in dev; production keeps the sealed sign-in redirect.
  const session = await resolveNexAppSessionFromContext();
  if (!session && process.env.NODE_ENV === "production") {
    redirect("/nex-native/sign-in");
  }

  return (
    <main
      data-nex-emergency-what-to-do
      style={{
        minHeight: "100%",
        backgroundColor: NEX.bg,
        // Same Crimson Beacon background family as the Alert Screen
        // and Group page.
        backgroundImage:
          "linear-gradient(180deg, rgba(6, 2, 8, 0.78) 0%, rgba(6, 2, 8, 0.5) 32%, rgba(6, 2, 8, 0.58) 60%, rgba(6, 2, 8, 0.88) 100%), url(/nex-emergency/countdown-background.png)",
        backgroundSize: "100% 100%, cover",
        backgroundPosition: "center, center",
        backgroundRepeat: "no-repeat, no-repeat",
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding:
          "max(20px, env(safe-area-inset-top, 0px)) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Header · title only · owner directive 2026-10-25 removed the
          back arrow and enlarged the NEX EMERGENCY title from an
          11px eyebrow to a 22px hero header. The user exits via the
          Close button at the foot. */}
      <div
        style={{
          textAlign: "center",
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: NEX.red,
          textShadow: "0 2px 14px rgba(255, 51, 85, 0.55)",
          lineHeight: 1.1,
        }}
      >
        Emergency
      </div>

      {/* Hero · owner directive 2026-10-25 · the situation is unknown,
          treat it as both medical and dangerous until proven otherwise. */}
      <div style={{ marginTop: 4 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            color: "#FFFFFF",
            textShadow: "0 2px 14px rgba(255, 51, 85, 0.55)",
          }}
        >
          How To Help
        </h1>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: NEX.textDim,
            marginTop: 6,
          }}
        >
          Unknown emergency. Could be medical. Could be dangerous. You
          may not know the person. Stay safe. Do these three.
        </div>
      </div>

      {/* Owner directive 2026-10-25 · icon-forward tiles · world-class
          world-class pass. 48px icon badge left · 2-5 word bold title ·
          one-line verb-first body. Scannable under stress. */}
      <ol
        data-nex-emergency-how-to-help-steps
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {STEPS.map((s) => (
          <li
            key={s.n}
            data-nex-emergency-how-to-help-step={s.n}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 16px",
              borderRadius: 14,
              background: NEX.surface,
              border: `1px solid ${s.accent}3A`,
              borderLeft: `3px solid ${s.accent}`,
            }}
          >
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: `${s.accent}1A`,
                border: `1px solid ${s.accent}55`,
                color: s.accent,
                display: "grid",
                placeItems: "center",
              }}
            >
              {s.icon === "phone" ? <PhoneIcon /> : s.icon === "shield" ? <ShieldCheckIcon /> : <MessageIcon />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  marginBottom: 2,
                  color: "#FFFFFF",
                  lineHeight: 1.15,
                }}
              >
                {s.title}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  lineHeight: 1.4,
                  color: NEX.textDim,
                }}
              >
                {s.body}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* Known-person section · tap-to-reveal detail. Native
          <details><summary> is zero-JS + keyboard-accessible. */}
      <section
        data-nex-emergency-how-to-help-known-person
        style={{
          marginTop: 4,
          padding: "14px 16px",
          borderRadius: 14,
          background: "rgba(255, 51, 85, 0.08)",
          border: `1px solid ${NEX.border}`,
        }}
      >
        <h2
          style={{
            margin: "0 0 4px",
            fontSize: 15,
            fontWeight: 900,
            lineHeight: 1.15,
            color: "#FFFFFF",
            textShadow: "0 1px 6px rgba(255, 51, 85, 0.4)",
          }}
        >
          If you know the person
        </h2>
        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.4,
            color: NEX.textDim,
            marginBottom: 10,
          }}
        >
          Knowing them does not lower the stakes.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {KNOWN_PERSON_RULES.map((r) => (
            <details
              key={r.title}
              data-nex-emergency-how-to-help-rule={r.title}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#FFFFFF",
                  listStyle: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: NEX.red,
                    boxShadow: "0 0 6px rgba(255, 51, 85, 0.7)",
                    flexShrink: 0,
                  }}
                />
                {r.title}
                <span
                  aria-hidden
                  style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    color: NEX.textMuted,
                  }}
                >
                  Why?
                </span>
              </summary>
              <div
                style={{
                  marginTop: 6,
                  paddingLeft: 14,
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  color: NEX.textDim,
                }}
              >
                {r.body}
              </div>
            </details>
          ))}
        </div>
      </section>

      <Link
        href="/nex-native/emergency-help/group/11111111-1111-4111-8111-111111111111?action=help"
        data-testid="nex-emergency-how-to-help-close"
        style={{
          // Owner directive 2026-10-25 · inner colour matches the step
          // card surface above · same NEX.surface fill + same accent-
          // stripe shape so the Close button reads as a sibling card.
          marginTop: "auto",
          display: "block",
          width: "100%",
          padding: "14px 16px",
          borderRadius: 14,
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "0.04em",
          color: "#FFFFFF",
          background: NEX.surface,
          border: `1px solid ${NEX.cyan}3A`,
          borderLeft: `3px solid ${NEX.cyan}`,
          borderRight: `3px solid ${NEX.cyan}`,
          textAlign: "center",
          textDecoration: "none",
          boxSizing: "border-box",
        }}
      >
        Close
      </Link>
    </main>
  );
}

function PhoneIcon(): React.JSX.Element {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c.9.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

function ShieldCheckIcon(): React.JSX.Element {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2 L4 5 v6 c0 5 3.5 9.5 8 11 c4.5-1.5 8-6 8-11 V5 l-8-3z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function MessageIcon(): React.JSX.Element {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
