"use client";

// src/app/nex-native/themes/[id]/_preview-action-bar.tsx
//
// NEX · S6 · discreet theme-preview action bar.
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Replaces the retired `ThemeActivateOverlay` without reversing the
// sealed 2026-10-11 "overlay too intrusive" decision. The old overlay
// was a CENTRED MODAL that forced engagement before the user could
// finish previewing · users rejected it.
//
// This component is NOT a modal:
//   · Thin bottom-anchored bar · outside the live chat chrome
//   · Persistent affordance · never blocks the preview
//   · Backdrop blur + translucent navy so the live preview stays
//     visible through the bar
//   · Two chip-style controls: `[← Back to themes]` + `[Use this
//     theme →]`
//
// Guest flow (owner-approved Option A, Q4):
//   · The Use button is wrapped in the sealed `RequireAccount`
//     primitive · intent = "pick-theme", payload = themeId.
//   · Signed-in users: form submits to `updateChatThemeAction` with
//     an intent-aware `next` destination (shop → cover-themes-
//     library, else → chat/preview).
//   · Guests: the sealed account-wall intercepts the click · the
//     wall-copy for "pick-theme" is the sealed primitive the retired
//     overlay already used. After signup, `post-signup-apply`
//     applies the chosen theme and redirects to the same `next`.

import * as React from "react";
import Link from "next/link";
import { RequireAccount } from "@/components/nex-native/account-wall/RequireAccount";
import { updateChatThemeAction } from "../../_actions";

const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  orange: "#FF7200",
  barBg: "rgba(2, 9, 20, 0.78)",
  borderSoft: "rgba(255, 255, 255, 0.08)",
};

export interface ThemePreviewActionBarProps {
  readonly themeId: string;
  readonly themeName: string;
  /** The owner-sealed decision tree:
   *    "shop"        → next = /nex-native/cover-themes-library
   *    everything else (themes · personalised · null · tampered)
   *                  → next = /nex-native/chat/preview
   *  Resolved server-side and passed in as a prop so this client
   *  component never re-reads the intent cookie. */
  readonly useThemeNextHref: string;
  /** Needed for the sealed account-wall intercept · caller passes
   *  the server-resolved guest flag so the wall only mounts for
   *  actual guests. */
  readonly isGuest: boolean;
  /** Theme accent so the primary CTA tints with the previewed
   *  theme · reads as part of the live surface, not foreign chrome. */
  readonly accentHex?: string | null;
}

export function ThemePreviewActionBar(
  props: ThemePreviewActionBarProps,
): React.JSX.Element {
  const accent = props.accentHex ?? NEX.orange;

  return (
    <nav
      aria-label={`${props.themeName} preview actions`}
      data-nex-theme-action-bar
      data-nex-theme-action-bar-id={props.themeId}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 400,
        padding:
          "12px 14px calc(env(safe-area-inset-bottom, 0px) + 12px)",
        background: NEX.barBg,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderTop: `1px solid ${NEX.borderSoft}`,
        // Owner directive 2026-10-18 · two long buttons stacked
        // vertically · Back on top, Use below (owner-approved order).
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <Link
        href="/nex-native/chat-themes-library"
        data-nex-theme-action-bar-back
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          padding: "12px 16px",
          borderRadius: 12,
          background: "rgba(255, 255, 255, 0.04)",
          border: `1px solid ${NEX.borderSoft}`,
          color: NEX.textDim,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.03em",
          textDecoration: "none",
          boxSizing: "border-box",
        }}
      >
        ← Back to themes
      </Link>

      <RequireAccount
        isGuest={props.isGuest}
        action="pick-theme"
        nextUrl={props.useThemeNextHref}
        payload={props.themeId}
        onCloseHref={`/nex-native/themes/${encodeURIComponent(
          props.themeId,
        )}`}
      >
        <form
          action={updateChatThemeAction}
          data-nex-theme-action-bar-use-form
          style={{ margin: 0, padding: 0, width: "100%" }}
        >
          <input type="hidden" name="chat_theme" value={props.themeId} />
          <input
            type="hidden"
            name="next"
            value={props.useThemeNextHref}
          />
          <button
            type="submit"
            data-nex-theme-action-bar-use
            aria-label={`Use ${props.themeName}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              padding: "12px 16px",
              borderRadius: 12,
              background: accent,
              color: "#0B0F1A",
              border: "none",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
              boxSizing: "border-box",
              boxShadow: `0 10px 24px -8px ${accent}80`,
            }}
          >
            Use this theme →
          </button>
        </form>
      </RequireAccount>
    </nav>
  );
}
