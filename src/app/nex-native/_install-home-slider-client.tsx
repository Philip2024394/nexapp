"use client";

// src/app/nex-native/_install-home-slider-client.tsx
//
// NEX · discreet footer slider: "Add NEX to your home screen".
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Shown immediately after successful account creation on the sealed
// Bridge 42 landing (`/create-account/welcome`), and (future) after
// a genuine paid Bisnis membership upgrade. Never shown to guests.
//
// Browser-detection mirrors the sealed `_install-home-button-client`:
//
//   · Chromium (Chrome / Edge / Android Chromium) · we capture the
//     non-standard `beforeinstallprompt` event, defer it, and fire
//     the real browser install prompt when the user taps Install.
//   · iOS Safari · `beforeinstallprompt` never fires. We detect iOS
//     Safari and expand a short honest hint explaining the Share →
//     Add to Home Screen path (iOS does not allow programmatic PWA
//     installs). No fake install success claim.
//   · Already-installed PWA · `display-mode: standalone` is active ·
//     the slider renders nothing (no duplicate CTA, no annoyance).
//   · Unsupported browsers · slider renders nothing (silent).
//
// Dismissal is persistent via the sealed `nex_install_home_dismissed`
// cookie (365-day max-age). The parent server component reads that
// cookie before mounting us · so once dismissed we don't render at
// all on the next visit.

import * as React from "react";
import { dismissInstallHomeSliderAction } from "./_install-home-slider-dismiss-action";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type SliderState =
  | { kind: "hidden" }
  | { kind: "chromium"; deferred: BeforeInstallPromptEvent }
  | { kind: "ios" }
  | { kind: "installed" };

const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.42)",
  orange: "#FF7200",
  barBg: "rgba(2, 9, 20, 0.86)",
  borderSoft: "rgba(255, 255, 255, 0.08)",
};

export function InstallHomeSliderClient(): React.JSX.Element | null {
  const [state, setState] = React.useState<SliderState>({ kind: "hidden" });
  const [showIosHint, setShowIosHint] = React.useState(false);
  // Local optimistic hide · toggled when the user taps the × so the
  // slider disappears instantly before the server round-trips the
  // dismissal cookie. The cookie makes it permanent · this just
  // prevents an awkward delay.
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // Already-installed detection · when the current session runs as
    // the installed PWA we hide the slider entirely.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setState({ kind: "installed" });
      return;
    }

    // iOS Safari detection · the only browser that doesn't fire
    // `beforeinstallprompt`. User-agent sniffing is fragile but it's
    // the sealed path the sibling button already uses.
    const ua = navigator.userAgent || "";
    const isIos = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    const isSafari =
      /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    if (isIos && isSafari) {
      setState({ kind: "ios" });
      return;
    }

    // Chromium / Edge / Android Chromium · capture the deferred
    // install event the browser fires when it decides the user is
    // engaged enough to prompt. We only enter this state once we
    // actually receive the event · browsers that never fire it
    // leave the slider hidden.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setState({
        kind: "chromium",
        deferred: e as BeforeInstallPromptEvent,
      });
    };
    window.addEventListener(
      "beforeinstallprompt",
      onBeforeInstall as EventListener,
    );
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        onBeforeInstall as EventListener,
      );
    };
  }, []);

  async function onInstallClick() {
    if (state.kind === "chromium") {
      try {
        await state.deferred.prompt();
        const choice = await state.deferred.userChoice;
        if (choice.outcome === "accepted") {
          setState({ kind: "installed" });
        } else {
          // User dismissed the native prompt · the deferred event
          // is now consumed and the browser decides when (or if)
          // to offer again. Keep the slider in hidden state so we
          // don't show a stale CTA.
          setState({ kind: "hidden" });
        }
      } catch {
        // Prompt failed · silently hide this attempt.
        setState({ kind: "hidden" });
      }
      return;
    }
    if (state.kind === "ios") {
      setShowIosHint((v) => !v);
    }
  }

  if (dismissed) return null;
  if (state.kind === "hidden" || state.kind === "installed") return null;

  const isIosState = state.kind === "ios";

  return (
    <aside
      data-nex-install-home-slider
      data-nex-install-home-state={state.kind}
      aria-label="Add NEX to your home screen"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 0,
        width: "100%",
        maxWidth: 420,
        zIndex: 420,
        padding: "10px 14px calc(env(safe-area-inset-bottom, 0px) + 10px)",
        background: NEX.barBg,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderTop: `1px solid ${NEX.borderSoft}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* NEX emblem · owner-approved brand mark */}
        <div
          aria-hidden
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${NEX.cyan} 0%, #0066B3 100%)`,
            display: "grid",
            placeItems: "center",
            color: "#0a0608",
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: "0.04em",
            boxShadow: `0 6px 16px -4px ${NEX.cyan}80`,
          }}
        >
          NEX
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: NEX.text,
              letterSpacing: "-0.005em",
            }}
          >
            Add NEX to your home screen
          </div>
          <div
            style={{
              marginTop: 1,
              fontSize: 11,
              color: NEX.textDim,
              lineHeight: 1.3,
            }}
          >
            {isIosState
              ? "Tap for Safari instructions"
              : "One tap · one-time setup"}
          </div>
        </div>
        <button
          type="button"
          onClick={onInstallClick}
          data-nex-install-home-install
          style={{
            flexShrink: 0,
            padding: "8px 14px",
            borderRadius: 999,
            background: NEX.orange,
            color: "#0a0608",
            border: "none",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: `0 8px 18px -8px ${NEX.orange}80`,
          }}
        >
          Install
        </button>
        <form
          action={dismissInstallHomeSliderAction}
          onSubmit={() => setDismissed(true)}
          style={{ margin: 0, padding: 0, flexShrink: 0 }}
        >
          <button
            type="submit"
            data-nex-install-home-dismiss
            aria-label="Dismiss install prompt"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 999,
              background: "transparent",
              border: `1px solid ${NEX.borderSoft}`,
              color: NEX.textMute,
              fontSize: 14,
              lineHeight: 1,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ×
          </button>
        </form>
      </div>

      {isIosState && showIosHint && (
        <div
          data-nex-install-home-ios-hint
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(0, 175, 255, 0.08)",
            border: `1px solid ${NEX.cyanSoft}`,
            fontSize: 12,
            lineHeight: 1.45,
            color: NEX.textDim,
          }}
        >
          <strong style={{ color: NEX.text }}>iOS Safari:</strong>
          {" "}tap the Share icon{" "}
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              padding: "0 4px",
              color: NEX.cyan,
              fontWeight: 700,
            }}
          >
            ⬆
          </span>
          {" "}then <strong style={{ color: NEX.text }}>Add to Home Screen</strong>.
          NEX will open like any installed app.
        </div>
      )}
    </aside>
  );
}
