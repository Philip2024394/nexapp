// src/app/nex-native/themes/[id]/_guest-signup-banner.tsx
//
// NEX Theme Preview · guest signup banner.
// Owner-authorised 2026-10-19.
// -----------------------------------------------------------------------------
// Shown ONLY to guest viewers (session === null) on the live-world
// theme preview surfaces. The welcome page's new "Continue NEX
// Free" primary CTA routes guests here · the banner is the next
// step in the flow:
//
//   Guest welcome → "Continue NEX Free" → theme preview chat UI →
//   this banner → "Create free account" → signup form
//
// Signed-in users NEVER see this banner (they already have an
// account) · the parent gates its mount by `isGuest`.
//
// Shape: translucent floating container pinned near the top of the
// chat preview with an inner thin-line separator between the title
// line and the CTA. Click-anywhere-on-card routes to the sealed
// /create-account page.
//
// Pure Server Component · no interactivity beyond the <Link>.

import Link from "next/link";
import type { CSSProperties } from "react";

const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.42)",
  cyanFaint: "rgba(0, 175, 255, 0.18)",
  panelBg: "rgba(3, 16, 29, 0.92)",
  panelBorder: "rgba(0, 175, 255, 0.45)",
  divider: "rgba(0, 175, 255, 0.28)",
  orange: "#FF7200",
  orangeInk: "#1A1300",
};

export function GuestSignupBanner({
  signupHref = "/nex-native/create-account",
}: {
  readonly signupHref?: string;
}) {
  return (
    <aside
      aria-label="Create account to activate NEX Chat"
      data-nex-theme-guest-banner
      style={containerStyle}
    >
      <div style={titleRowStyle}>
        <span style={pingDotStyle} aria-hidden />
        <span style={titleStyle}>
          Create Account to activate your free NEX Chat
        </span>
      </div>
      <div style={dividerStyle} aria-hidden />
      <p style={bodyStyle}>
        You're previewing the real chat experience. Create a free
        account to start chatting with friends, pick a theme, and
        make it yours.
      </p>
      <Link
        href={signupHref}
        data-nex-theme-guest-banner-cta
        style={ctaStyle}
      >
        Create free account →
      </Link>
    </aside>
  );
}

const containerStyle: CSSProperties = {
  position: "fixed",
  top: "calc(env(safe-area-inset-top, 0px) + 70px)",
  left: "50%",
  transform: "translateX(-50%)",
  width: "92%",
  maxWidth: 380,
  zIndex: 90,
  padding: "12px 14px 14px",
  background: NEX.panelBg,
  border: `1px solid ${NEX.panelBorder}`,
  borderRadius: 14,
  boxShadow: "0 16px 36px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 175, 255, 0.15)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const titleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const pingDotStyle: CSSProperties = {
  display: "inline-block",
  width: 8,
  height: 8,
  borderRadius: 999,
  background: NEX.orange,
  boxShadow: `0 0 8px ${NEX.orange}`,
  flexShrink: 0,
};

const titleStyle: CSSProperties = {
  flex: 1,
  color: NEX.text,
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: "-0.005em",
  lineHeight: 1.3,
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: NEX.divider,
};

const bodyStyle: CSSProperties = {
  margin: 0,
  color: NEX.textDim,
  fontSize: 11.5,
  lineHeight: 1.45,
};

const ctaStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  marginTop: 2,
  minHeight: 36,
  padding: "0 14px",
  borderRadius: 10,
  background: NEX.orange,
  color: NEX.orangeInk,
  border: "none",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  textDecoration: "none",
  boxShadow: `0 8px 18px -8px ${NEX.orange}`,
};
