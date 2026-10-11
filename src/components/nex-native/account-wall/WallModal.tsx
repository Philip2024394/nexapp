// src/components/nex-native/account-wall/WallModal.tsx
//
// NEX Account Wall · modal UI · Phase 0.
// --------------------------------------
// Server component. Renders a premium centred modal with:
//   · headline (action-specific · from WALL_COPY)
//   · 1-line explainer
//   · 2-3 benefit lines
//   · "Create free account" primary button → setPendingAndSignUpAction
//   · "Already have one? Sign in" link → setPendingAndSignInAction
//   · optional dismiss link → dismissAccountWallAction + onCloseHref
//
// Uses the sealed NEX visual system (navy #020914 · cyan #00AFFF · orange
// #FF7200 · subtle glass panels). Mobile-first · tappable targets 44px+.
//
// This component is rendered BY the client-side <RequireAccount> shell.
// It must be a Client Component because React Server Components cannot
// be imported + rendered directly inside Client Components. The server
// actions it binds to (setPendingAndSignUpAction, …) are imported as
// function references · that works from both server and client contexts.

"use client";

import * as React from "react";
import {
  setPendingAndSignUpAction,
  setPendingAndSignInAction,
  dismissAccountWallAction,
} from "@/lib/nex-native/account-wall/server-actions";
import {
  getAccountWallCopy,
  type AccountWallActionId,
} from "@/lib/nex-native/account-wall/wall-copy";

const NEX = {
  bg: "#020914",
  overlay: "rgba(2, 9, 20, 0.78)",
  panel: "#071525",
  panelHi: "#0A1A2D",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  orangeFaint: "rgba(255, 114, 0, 0.14)",
  borderSoft: "rgba(255, 255, 255, 0.07)",
};

export interface WallModalProps {
  action: AccountWallActionId;
  /** Absolute local path to return to after signup/sign-in. Validated
   *  server-side when the form submits. */
  nextUrl: string;
  /** Optional payload the destination replay code can use (e.g. a
   *  themeId for pick-theme). Length-capped server-side at 200 chars. */
  payload?: string | null;
  /** Local path to navigate to if the visitor dismisses the modal.
   *  Usually the same page they're on. */
  onCloseHref: string;
}

export function WallModal({
  action,
  nextUrl,
  payload,
  onCloseHref,
}: WallModalProps): React.JSX.Element {
  const copy = getAccountWallCopy(action);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-wall-headline"
      data-nex-account-wall={action}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: NEX.overlay,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          borderRadius: 20,
          background: `linear-gradient(180deg, ${NEX.panelHi} 0%, ${NEX.panel} 100%)`,
          border: `1px solid ${NEX.cyanSoft}`,
          boxShadow:
            "0 24px 60px -20px rgba(0,0,0,0.65), 0 0 60px -24px rgba(0,175,255,0.35)",
          padding: "26px 24px 22px",
          overflow: "hidden",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(0,175,255,0.12), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              background: NEX.orangeFaint,
              color: NEX.orange,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              border: `1px solid ${NEX.orange}44`,
              marginBottom: 14,
            }}
          >
            <span aria-hidden>✦</span>
            NEX
          </div>

          <h2
            id="nex-wall-headline"
            style={{
              margin: "0 0 10px",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              lineHeight: 1.2,
              color: NEX.textPrimary,
            }}
          >
            {copy.headline}
          </h2>

          <p
            style={{
              margin: "0 0 18px",
              fontSize: 14,
              lineHeight: 1.5,
              color: NEX.textSecondary,
            }}
          >
            {copy.explainer}
          </p>

          <ul
            style={{
              listStyle: "none",
              margin: "0 0 22px",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {copy.benefits.map((benefit, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  fontSize: 13.5,
                  color: NEX.textSecondary,
                  lineHeight: 1.45,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flex: "none",
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: NEX.cyanFaint,
                    border: `1px solid ${NEX.cyan}66`,
                    color: NEX.cyan,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    marginTop: 1,
                  }}
                >
                  ✓
                </span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <form action={setPendingAndSignUpAction}>
            <input type="hidden" name="action" value={action} />
            <input type="hidden" name="nextUrl" value={nextUrl} />
            {payload != null && (
              <input type="hidden" name="payload" value={payload} />
            )}
            <button
              type="submit"
              data-nex-account-wall-primary
              style={{
                width: "100%",
                minHeight: 48,
                padding: "0 20px",
                borderRadius: 12,
                background: NEX.orange,
                color: "#0a0608",
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "0.005em",
                border: `1px solid ${NEX.orange}`,
                boxShadow: `0 1px 0 rgba(255,255,255,0.18) inset, 0 10px 24px -14px ${NEX.orange}`,
                cursor: "pointer",
              }}
            >
              {copy.primaryCta} →
            </button>
          </form>

          <form
            action={setPendingAndSignInAction}
            style={{ marginTop: 10 }}
          >
            <input type="hidden" name="action" value={action} />
            <input type="hidden" name="nextUrl" value={nextUrl} />
            {payload != null && (
              <input type="hidden" name="payload" value={payload} />
            )}
            <button
              type="submit"
              data-nex-account-wall-secondary
              style={{
                width: "100%",
                minHeight: 44,
                padding: "0 16px",
                borderRadius: 10,
                background: "transparent",
                color: NEX.cyan,
                fontSize: 13.5,
                fontWeight: 600,
                border: `1px solid ${NEX.cyanSoft}`,
                cursor: "pointer",
              }}
            >
              {copy.secondaryCta}
            </button>
          </form>

          {copy.dismissLabel && (
            <form
              action={dismissAccountWallAction}
              style={{ marginTop: 14, textAlign: "center" }}
            >
              <input type="hidden" name="returnTo" value={onCloseHref} />
              <button
                type="submit"
                data-nex-account-wall-dismiss
                style={{
                  background: "transparent",
                  color: NEX.textMuted,
                  fontSize: 12.5,
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: "6px 10px",
                }}
              >
                {copy.dismissLabel}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
