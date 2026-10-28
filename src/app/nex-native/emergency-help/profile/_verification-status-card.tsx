"use client";

// src/app/nex-native/emergency-help/profile/_verification-status-card.tsx
//
// Owner-authorised 2026-10-25 (Decision #1 · UI shell only).
//
// Honest-claim guard · READ BEFORE EDITING:
//   This component accepts five state values so the visual DESIGN of
//   every state is reviewable (not_started, in_progress,
//   pending_review, verified, rejected). At runtime today, the live
//   /nex-native/emergency-help/profile surface mounts this component
//   with state="not_started" ONLY. No transition out of not_started
//   will happen in production until a real backend supplies the
//   state — Decisions #2-#8 in the identity-profile audit remain
//   unapproved.
//
//   Do NOT drive this component from a mock timer, a success callback
//   on save, or any other local flag. The states exist for inspection
//   only until the backend lands.
//
// Design: horizontal card with left status icon, right-stacked title
// + helper line. Rim colour + background tint shift with state so a
// glance tells the user where they are.

import * as React from "react";
import { NEX } from "./_profile-primitives";

export type VerificationState =
  | "not_started"
  | "in_progress"
  | "pending_review"
  | "verified"
  | "rejected";

interface StateConfig {
  readonly title: string;
  readonly body: string;
  readonly accent: string;
  readonly rimColor: string;
  readonly rimBg: string;
  readonly icon: React.ReactNode;
}

const CFG: Record<VerificationState, StateConfig> = {
  not_started: {
    title: "Not started",
    body: "Complete the sections below to request identity verification.",
    accent: NEX.textDim,
    rimColor: NEX.inputBorder,
    rimBg: "rgba(255, 255, 255, 0.03)",
    icon: <OutlineCircleIcon />,
  },
  in_progress: {
    title: "In progress",
    body: "Keep filling in your details. Nothing has been submitted yet.",
    accent: NEX.cyan,
    rimColor: NEX.cyan,
    rimBg: "rgba(0, 175, 255, 0.08)",
    icon: <HourglassIcon />,
  },
  pending_review: {
    title: "Pending review",
    body: "Verification is in progress. This can take a few minutes.",
    accent: NEX.gold,
    rimColor: NEX.gold,
    rimBg: "rgba(255, 194, 75, 0.1)",
    icon: <ClockIcon />,
  },
  verified: {
    title: "Verified",
    body: "Your identity is confirmed and ready for emergency responders.",
    accent: NEX.green,
    rimColor: NEX.green,
    rimBg: "rgba(43, 212, 127, 0.1)",
    icon: <CheckCircleIcon />,
  },
  rejected: {
    title: "Verification failed",
    body: "Please review the issue below and submit a new attempt.",
    accent: NEX.red,
    rimColor: NEX.red,
    rimBg: "rgba(255, 51, 85, 0.1)",
    icon: <XCircleIcon />,
  },
};

export function VerificationStatusCard({
  state,
}: {
  readonly state: VerificationState;
}): React.JSX.Element {
  const cfg = CFG[state];
  return (
    <div
      data-nex-emergency-profile-verification-status={state}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 14,
        background: cfg.rimBg,
        border: `1px solid ${cfg.rimColor}`,
        marginBottom: 18,
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.06)",
          border: `1.5px solid ${cfg.rimColor}`,
          display: "grid",
          placeItems: "center",
          color: cfg.accent,
        }}
      >
        {cfg.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: cfg.accent,
            lineHeight: 1.2,
          }}
        >
          Verification status
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "#FFFFFF",
            lineHeight: 1.2,
            marginTop: 2,
          }}
        >
          {cfg.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: NEX.textDim,
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          {cfg.body}
        </div>
      </div>
    </div>
  );
}

// ─── Icons · 20px, stroked, inherit currentColor ────────────────────

function OutlineCircleIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function HourglassIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2h12" />
      <path d="M6 22h12" />
      <path d="M6 2v4a6 6 0 0 0 12 0V2" />
      <path d="M18 22v-4a6 6 0 0 0-12 0v4" />
    </svg>
  );
}

function ClockIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function CheckCircleIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function XCircleIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  );
}
