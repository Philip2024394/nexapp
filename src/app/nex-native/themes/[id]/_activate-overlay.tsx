// src/app/nex-native/themes/[id]/_activate-overlay.tsx
//
// NEX Theme Viewer · slim top-anchored preview bar · 2026-10-11.
// --------------------------------------------------------------
// Replaces the earlier tall bottom-anchored card that overlapped
// the composer footer on `/themes/[id]`. The new treatment is a
// thin top bar (~56px) that stays out of the chat chrome:
//
//   [ ← ] · PREVIEW · <Theme Name> · [ Use this theme → ]
//
// · Left tap  → return to /chat-themes-library (safe local path)
// · Right tap → session: posts updateChatThemeAction with
//               next=/home · guest: opens the pick-theme account
//               wall.
// · The bar does NOT render over the composer / shop footer at the
//   bottom of the viewer. It sits above the top of the viewport,
//   honouring safe-area-inset-top so iOS notches don't hide it.
//
// Rationale: the earlier bottom overlay carried three stacked CTAs
// (Use / View / Return) + a label block, which the founder
// explicitly flagged as "blocking footer area on themes and looks
// shit ui". This slim bar surfaces the single primary action with
// one-tap close (back arrow) and leaves the "view all themes"
// affordance to the NEX Space landing's own CTAs.

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
      role="group"
      aria-label={`Preview controls for ${themeName}`}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        top: 0,
        zIndex: 100,
        padding: "calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 44,
          padding: "0 6px 0 4px",
          margin: "0 auto",
          maxWidth: 440,
          borderRadius: 999,
          background: "rgba(2, 9, 20, 0.72)",
          border: `1px solid ${rim}66`,
          boxShadow:
            `0 12px 28px -14px rgba(0,0,0,0.6), 0 0 24px -14px ${accent}`,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          pointerEvents: "auto",
        }}
      >
        <Link
          href="/nex-native/chat-themes-library"
          data-nex-theme-return
          aria-label="Return to theme library"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "transparent",
            color: NEX.textMuted,
            fontSize: 16,
            textDecoration: "none",
            flex: "none",
          }}
        >
          ←
        </Link>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            lineHeight: 1.1,
          }}
        >
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: accent,
            }}
          >
            Preview
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: NEX.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {themeName}
          </span>
        </div>

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
            <input type="hidden" name="next" value="/nex-native/home" />
            <button
              type="submit"
              data-nex-theme-activate-cta
              style={primaryPillStyle()}
            >
              This theme →
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function primaryPillStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 36,
    padding: "0 14px",
    borderRadius: 999,
    background: NEX.orange,
    color: "#0a0608",
    fontSize: 12.5,
    fontWeight: 700,
    border: `1px solid ${NEX.orange}`,
    cursor: "pointer",
    boxShadow: `0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 14px -8px ${NEX.orange}`,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    flex: "none",
  };
}
