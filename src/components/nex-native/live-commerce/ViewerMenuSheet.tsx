"use client";

// src/components/nex-native/live-commerce/ViewerMenuSheet.tsx
//
// NEX Live · right-side slide-in drawer opened from the viewer header
// ⋮ 3-dot. Mirrors the shape of the main app ControlDrawer so the
// behaviour feels native across NEX, but stays self-contained for the
// public uploaded-video viewer (no session required).
// -----------------------------------------------------------------------------
// Owner directive 2026-10-24 · "3 dots in live header should open the
// main app sider from right side".
//
// Content rows (initial · can grow):
//   · Home · routes to /nex-native/home
//   · Back to Live feed · routes to /nex-native/live-commerce/feed
//   · Share this video
//   · Help & feedback · /nex-native/settings/help (public per sealed convention)
//   · Report
//   · Sign in · when not signed in · placeholder href
//
// Doctrine honoured:
//   · Public viewer · no session is assumed · drawer never claims
//     identity.
//   · Reuses the sealed ControlDrawer's "slide from right" convention
//     without importing it (that component owns its own trigger +
//     requires session shape · we need a public, externally-triggered
//     slide-in).

import * as React from "react";

const NEX = {
  bgDrawer: "#0A1424",
  bgOuter: "rgba(2, 9, 20, 0.72)",
  text: "#F2F5F8",
  textDim: "#8BA9D1",
  cyan: "#00AFFF",
  red: "#FF3355",
  navy: "#1A2642",
  border: "rgba(255,255,255,0.1)",
  rowBg: "rgba(255,255,255,0.04)",
} as const;

export interface ViewerMenuSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onBackToFeed?: () => void;
  readonly onShare?: () => void;
  readonly onReport?: () => void;
}

export function ViewerMenuSheet(
  props: ViewerMenuSheetProps,
): React.JSX.Element | null {
  if (!props.open) return null;

  const Row = ({
    glyph,
    label,
    subtitle,
    onClick,
    href,
    accent,
    testid,
  }: {
    glyph: string;
    label: string;
    subtitle?: string;
    onClick?: () => void;
    href?: string;
    accent?: string;
    testid: string;
  }): React.JSX.Element => {
    const content = (
      <>
        <span
          aria-hidden
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: NEX.navy,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {glyph}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: NEX.text }}>
            {label}
          </div>
          {subtitle && (
            <div style={{ fontSize: 11, color: NEX.textDim, marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
      </>
    );
    const common = {
      display: "flex" as const,
      alignItems: "center" as const,
      gap: 12,
      padding: "12px 14px",
      background: NEX.rowBg,
      border: `1px solid ${NEX.border}`,
      borderLeft: `3px solid ${accent ?? NEX.textDim}`,
      borderRadius: 12,
      color: NEX.text,
      cursor: "pointer",
      textAlign: "left" as const,
      minHeight: 56,
      textDecoration: "none",
      fontFamily: "inherit",
    };
    if (href) {
      return (
        <a
          data-nex-viewer-menu-row={testid}
          href={href}
          onClick={() => props.onClose()}
          style={common}
        >
          {content}
        </a>
      );
    }
    return (
      <button
        type="button"
        data-nex-viewer-menu-row={testid}
        onClick={() => {
          onClick?.();
          props.onClose();
        }}
        style={common}
      >
        {content}
      </button>
    );
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        data-nex-viewer-menu-scrim
        onClick={props.onClose}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          // The drawer occupies min(78vw, 320px) on the right. Carve
          // the scrim to the UNCOVERED portion so taps on the scrim
          // never land on a drawer row underneath (visual + hit-test
          // alignment).
          right: "min(78vw, 320px)",
          background: NEX.bgOuter,
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          border: "none",
          padding: 0,
          cursor: "pointer",
          zIndex: 10,
        }}
      />
      <aside
        role="dialog"
        aria-label="NEX menu"
        data-nex-viewer-menu
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(78vw, 320px)",
          background: NEX.bgDrawer,
          borderLeft: `1px solid ${NEX.border}`,
          boxShadow: "-18px 0 42px -14px rgba(0,0,0,0.6)",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 16px) 14px calc(env(safe-area-inset-bottom, 0px) + 18px)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 11,
          animation: "nexViewerMenuSlideRight 220ms ease-out",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          overflowY: "auto",
        }}
      >
        <style>{`
          @keyframes nexViewerMenuSlideRight {
            from { transform: translateX(100%); opacity: 0.6; }
            to   { transform: translateX(0);    opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            [data-nex-viewer-menu] { animation: none !important; }
          }
        `}</style>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 900,
              color: NEX.text,
              letterSpacing: "0.02em",
            }}
          >
            NEX
          </div>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: NEX.textDim,
              fontSize: 18,
              cursor: "pointer",
              padding: 4,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <Row
          glyph="🏠"
          label="Home"
          href="/nex-native/home"
          accent={NEX.cyan}
          testid="home"
        />
        {/* Owner directive 2026-10-24 · "remove the back button from
            side drawer". The "Back to Live feed" row is retired · the
            Home row above routes to /home which is the preferred
            escape. */}
        {props.onShare && (
          <Row
            glyph="⤴"
            label="Share this video"
            onClick={props.onShare}
            accent={NEX.cyan}
            testid="share"
          />
        )}
        <Row
          glyph="?"
          label="Help & feedback"
          href="/nex-native/settings/help"
          accent={NEX.textDim}
          testid="help"
        />
        {props.onReport && (
          <Row
            glyph="⚑"
            label="Report"
            onClick={props.onReport}
            accent={NEX.red}
            testid="report"
          />
        )}
        <Row
          glyph="⇥"
          label="Sign in"
          subtitle="Access all NEX features"
          href="/nex-native/sign-in"
          accent={NEX.cyan}
          testid="sign-in"
        />
      </aside>
    </>
  );
}
