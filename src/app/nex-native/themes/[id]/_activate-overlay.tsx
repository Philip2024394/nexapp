// src/app/nex-native/themes/[id]/_activate-overlay.tsx
//
// NEX Theme Viewer · centred square popup · 2026-10-11.
// -----------------------------------------------------
// Founder-sealed redesign · the slim top bar is replaced with a
// true viewport-centred popup card that reads vertically:
//
//     [ × ]
//     PREVIEW
//     <Theme Name>
//     [ This theme → ]
//
// · Backdrop · soft dim behind the card so the chat preview stays
//   visible (reduced-opacity navy veil).
// · Card · ~220×220 square · navy glass surface · theme-accent rim.
// · Close × · top-right corner · returns to /chat-themes-library.
// · Primary CTA · session: posts updateChatThemeAction with
//                 next=/home · guest: opens the pick-theme account
//                 wall.
// · The backdrop itself is NOT clickable-to-close · we don't want
//   the viewer accidentally bouncing to the library before they
//   see the preview. The explicit × is the only exit.

import * as React from "react";
import Link from "next/link";
import { RequireAccount } from "@/components/nex-native/account-wall/RequireAccount";
import { updateChatThemeAction } from "../../_actions";

const NEX = {
  textPrimary: "#F2F5F8",
  textMuted: "#B5C3D6",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
};

export interface ThemeActivateOverlayProps {
  themeId: string;
  themeName: string;
  isGuest: boolean;
  accentHex?: string | null;
  bubbleRimHex?: string | null;
}

export function ThemeActivateOverlay({
  themeId,
  themeName,
  isGuest,
  accentHex,
  bubbleRimHex,
}: ThemeActivateOverlayProps): React.JSX.Element {
  const nextUrl = `/nex-native/themes/${encodeURIComponent(themeId)}`;
  const accent = accentHex ?? NEX.cyan;
  const rim = bubbleRimHex ?? accent;

  return (
    <div
      data-nex-theme-activate-bar
      data-nex-theme-id={themeId}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview controls for ${themeName}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "max(env(safe-area-inset-top, 0px), 12px) 12px max(env(safe-area-inset-bottom, 0px), 12px)",
        background: "rgba(2, 9, 20, 0.42)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(240px, 72vw)",
          aspectRatio: "1 / 1",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "20px 18px",
          borderRadius: 20,
          background: "rgba(2, 9, 20, 0.86)",
          border: `1px solid ${rim}66`,
          boxShadow:
            `0 20px 48px -20px rgba(0,0,0,0.72), 0 0 36px -16px ${accent}`,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          pointerEvents: "auto",
        }}
      >
        <Link
          href="/nex-native/chat-themes-library"
          data-nex-theme-return
          aria-label="Close preview"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 999,
            background: "rgba(255,255,255,0.06)",
            color: NEX.textMuted,
            fontSize: 15,
            lineHeight: 1,
            textDecoration: "none",
          }}
        >
          ×
        </Link>

        <span
          style={{
            fontSize: 9.5,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: accent,
          }}
        >
          Preview
        </span>
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: NEX.textPrimary,
            textAlign: "center",
            lineHeight: 1.2,
            maxWidth: "100%",
            overflowWrap: "break-word",
          }}
        >
          {themeName}
        </span>

        {isGuest ? (
          <RequireAccount
            isGuest
            action="pick-theme"
            nextUrl="/nex-native/post-signup-apply"
            payload={themeId}
            onCloseHref={nextUrl}
          >
            <button
              type="button"
              data-nex-theme-activate-cta
              style={primaryPillStyle()}
            >
              This theme →
            </button>
          </RequireAccount>
        ) : (
          <form action={updateChatThemeAction}>
            <input type="hidden" name="chat_theme" value={themeId} />
            {/* After apply, land on the LIVE chat of the newly applied
                theme · `/chat/preview` redirects to `/themes/<viewer
                chat_theme>` which paints the full StandardExperience
                live chat for that id. Was `/home` · founder flipped
                2026-10-11 ("should open the chat theme live"). */}
            <input type="hidden" name="next" value="/nex-native/chat/preview" />
            <button
              type="submit"
              data-nex-theme-activate-cta
              style={primaryPillStyle()}
            >
              This theme →
            </button>
          </form>
        )}

        <Link
          href="/nex-native/chat-themes-library"
          data-nex-theme-back
          style={backLinkStyle()}
        >
          ← Back to themes
        </Link>
      </div>
    </div>
  );
}

function backLinkStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    padding: "4px 10px",
    borderRadius: 999,
    background: "transparent",
    color: NEX.textMuted,
    fontSize: 11,
    fontWeight: 600,
    textDecoration: "none",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  };
}

function primaryPillStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 38,
    padding: "0 18px",
    marginTop: 4,
    borderRadius: 999,
    background: NEX.orange,
    color: "#0a0608",
    fontSize: 13,
    fontWeight: 700,
    border: `1px solid ${NEX.orange}`,
    cursor: "pointer",
    boxShadow: `0 1px 0 rgba(255,255,255,0.18) inset, 0 8px 18px -8px ${NEX.orange}`,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    flex: "none",
  };
}
