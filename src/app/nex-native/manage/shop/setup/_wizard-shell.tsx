"use client";

// src/app/nex-native/manage/shop/setup/_wizard-shell.tsx
//
// Shop Setup wizard · shared chrome (progress bar · header · body ·
// footer with back / skip / next). Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Each step page server-renders a title + content and wraps them in
// this shell. The shell owns:
//   · Back link to the previous step (or "Get Started" for step 1).
//   · Progress indicator "Step N of 8" + visual bar.
//   · Content slot (step body renders here).
//   · Footer with primary action (Save & continue) + optional Skip.
//
// Styling is phone-frame-scoped and tracks the sealed Ireland world
// palette (gold + emerald tokens from nex-native.css).

import * as React from "react";
import Link from "next/link";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "rgba(5, 15, 28, 0.72)";
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";

export const WIZARD_STEPS: ReadonlyArray<{ slug: string; title: string }> = [
  { slug: "identity", title: "Shop identity" },
  { slug: "location", title: "Location" },
  { slug: "category", title: "Category" },
  { slug: "hours", title: "Opening hours" },
  { slug: "story", title: "Your story" },
  { slug: "policies", title: "Policies" },
  { slug: "contact", title: "Contact" },
  { slug: "template", title: "Pick template" },
];

export interface WizardShellProps {
  readonly stepNumber: number;
  readonly stepTitle: string;
  readonly stepLead?: string;
  readonly backHref: string;
  readonly skipHref?: string;
  readonly children: React.ReactNode;
}

export function WizardShell({
  stepNumber,
  stepTitle,
  stepLead,
  backHref,
  skipHref,
  children,
}: WizardShellProps): React.JSX.Element {
  const totalSteps = WIZARD_STEPS.length;
  const progressPct = Math.round((stepNumber / totalSteps) * 100);
  return (
    <div
      data-nex-shop-setup-shell
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minHeight: 0,
      }}
    >
      {/* Top row · back link + step count. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Link
          href={backHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            fontSize: 11,
            fontWeight: 700,
            color: GOLD,
            textDecoration: "none",
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
          }}
        >
          ← Back
        </Link>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: INK_MUTED,
          }}
        >
          Step {stepNumber} of {totalSteps}
        </span>
      </div>

      {/* Progress bar · subtle gold fill to the current step. */}
      <div
        aria-hidden
        style={{
          width: "100%",
          height: 6,
          background: "rgba(198, 161, 91, 0.12)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progressPct}%`,
            height: "100%",
            background: GOLD,
            transition: "width 220ms ease",
          }}
        />
      </div>

      {/* Step title + optional lead paragraph. */}
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          paddingBottom: 6,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: GOLD,
          }}
        >
          {WIZARD_STEPS[stepNumber - 1]?.title ?? "Setup"}
        </span>
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 900,
            color: CREAM,
            letterSpacing: "-0.015em",
          }}
        >
          {stepTitle}
        </h1>
        {stepLead ? (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: INK_DIM,
              lineHeight: 1.5,
            }}
          >
            {stepLead}
          </p>
        ) : null}
      </header>

      {/* Step body · scrolls naturally when content exceeds the phone
          height so the footer stays reachable below. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {children}
      </div>

      {/* Optional skip row · owners who want to come back later. */}
      {skipHref ? (
        <div style={{ textAlign: "center" }}>
          <Link
            href={skipHref}
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: INK_MUTED,
              textDecoration: "underline",
            }}
          >
            Skip, I&rsquo;ll add this later
          </Link>
        </div>
      ) : null}
    </div>
  );
}

// ─── Shared input / button primitives used by step clients ───────────

export const FIELD_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "rgba(5, 15, 28, 0.9)",
  color: INK,
  border: `1px solid ${BORDER_HI}`,
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

export const PRIMARY_CTA_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "14px 24px",
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#1A120A",
  background: GOLD,
  textDecoration: "none",
  border: "none",
  borderRadius: 999,
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow: "0 10px 24px rgba(198,161,91,0.22)",
};

export const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: GOLD,
  marginBottom: 6,
};

export const HINT_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 10.5,
  color: INK_MUTED,
  marginTop: 4,
  lineHeight: 1.4,
};

export const ERROR_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "#FF6B6B",
  marginTop: 4,
};

export const SURFACE_CARD_STYLE: React.CSSProperties = {
  padding: "14px 14px 16px",
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
};
