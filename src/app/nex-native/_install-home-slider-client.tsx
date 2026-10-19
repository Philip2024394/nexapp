"use client";

// src/app/nex-native/_install-home-slider-client.tsx
//
// NEX · post-signup "Add NEX to your home screen" slider.
// Owner-authorised 2026-10-18 (iteration).
//
// Shape change (2026-10-19): the earlier discreet bottom bar has
// been rebuilt as a RIGHT-sliding card container with:
//   · NEX header (ping-badge-style emblem + "NEX" wordmark + close)
//   · Inner thin-line divider
//   · "Add NEX to your home screen" title + "One tap · one-time
//     setup" subtitle
//   · 📱 install visual (image-button)
//   · Primary [Install] button · fires the native prompt (Chromium)
//     or expands iOS Safari instructions
//   · Secondary [Continue to NEX →] CTA that routes directly to the
//     sealed PWA start_url (/nex-native/contacts) so the user lands
//     exactly where their home-screen icon will take them in future
//
// Still gated by the sealed `nex_install_home_dismissed` cookie ·
// still never shown to guests · the sealed PWA manifest start_url
// = /nex-native/contacts means home-screen launches already route
// there (per the badge-sync-contract test).
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
  cyanBright: "#5CC9FF",
  cyanSoft: "rgba(0, 175, 255, 0.42)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  orange: "#FF7200",
  orangeInk: "#1A1300",
  panel: "#071525",
  panelBg: "rgba(3, 16, 29, 0.98)",
  panelBorder: "rgba(0, 175, 255, 0.28)",
  divider: "rgba(0, 175, 255, 0.18)",
  backdrop: "rgba(0, 0, 0, 0.55)",
  borderSoft: "rgba(255, 255, 255, 0.08)",
};

/** Sealed PWA manifest start_url · the home-screen icon launches
 *  here. The slider's secondary CTA routes to the same place so
 *  the viewer previews what their post-install experience will be. */
const CONTINUE_HREF = "/nex-native/contacts";

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
    <>
      {/* Backdrop · click outside the card dismisses the slider ·
          same persistence as the × button (365-day cookie). */}
      <div
        aria-hidden
        data-nex-install-home-slider-backdrop
        onClick={() => setDismissed(true)}
        style={{
          position: "fixed",
          inset: 0,
          background: NEX.backdrop,
          zIndex: 419,
          cursor: "pointer",
          animation: "nexInstallFadeIn 220ms ease-out",
        }}
      />
      <aside
        data-nex-install-home-slider
        data-nex-install-home-state={state.kind}
        aria-label="Add NEX to your home screen"
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "92%",
          maxWidth: 380,
          zIndex: 420,
          background: NEX.panelBg,
          borderLeft: `1px solid ${NEX.panelBorder}`,
          boxShadow: "0 0 48px rgba(0, 0, 0, 0.6)",
          display: "flex",
          flexDirection: "column",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 14px) 16px calc(env(safe-area-inset-bottom, 0px) + 16px)",
          overflowY: "auto",
          animation: "nexInstallSlideIn 320ms ease-out",
        }}
      >
        <style>{`
          @keyframes nexInstallSlideIn {
            from { transform: translateX(100%); }
            to   { transform: translateX(0); }
          }
          @keyframes nexInstallFadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>

        {/* Header row · NEX emblem + wordmark + close */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${NEX.cyanBright} 0%, ${NEX.cyan} 55%, #0066B3 100%)`,
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
          <span
            style={{
              flex: 1,
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: "-0.01em",
              color: NEX.text,
            }}
          >
            NEX
          </span>
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
                width: 30,
                height: 30,
                borderRadius: 999,
                background: NEX.cyan,
                color: "#0a0608",
                border: "none",
                fontSize: 18,
                fontWeight: 800,
                lineHeight: 1,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: `0 6px 14px -6px ${NEX.cyan}`,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              ×
            </button>
          </form>
        </div>

        {/* Inner thin-line divider · owner directive explicit. */}
        <div
          aria-hidden
          style={{
            marginTop: 14,
            marginBottom: 18,
            height: 1,
            background: NEX.divider,
          }}
        />

        {/* Title + subtitle */}
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            color: NEX.text,
          }}
        >
          Add NEX to your home screen
        </h2>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 13,
            lineHeight: 1.5,
            color: NEX.textDim,
          }}
        >
          {isIosState
            ? "iOS Safari · tap below for the quick Add-to-Home-Screen steps."
            : "One tap · one-time setup. Opens like a native app · faster, full-screen, works even when your browser is closed."}
        </p>

        {/* Image button · install visual · owner directive "image
            button". Tapping also triggers the install flow so the
            visual is the primary tap target, not decoration. */}
        <button
          type="button"
          onClick={onInstallClick}
          aria-label="Install NEX to your home screen"
          data-nex-install-home-image-button
          style={{
            marginTop: 20,
            padding: "22px 16px",
            borderRadius: 16,
            background: NEX.cyanFaint,
            border: `1px solid ${NEX.panelBorder}`,
            color: NEX.cyan,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            cursor: "pointer",
            fontFamily: "inherit",
            width: "100%",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <span style={{ fontSize: 56, lineHeight: 1 }} aria-hidden>
            📱
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            Tap to install
          </span>
        </button>

        {/* Primary install button · solid NEX orange */}
        <button
          type="button"
          onClick={onInstallClick}
          data-nex-install-home-install
          style={{
            marginTop: 14,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 48,
            padding: "0 20px",
            borderRadius: 12,
            background: NEX.orange,
            color: NEX.orangeInk,
            border: "none",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: `0 10px 24px -10px ${NEX.orange}`,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Install NEX
        </button>

        {/* Secondary CTA · "Continue to NEX →" routes to the sealed
            PWA start_url (/nex-native/contacts) so the viewer lands
            exactly where their home-screen icon will land them. */}
        <a
          href={CONTINUE_HREF}
          data-nex-install-home-continue
          style={{
            marginTop: 10,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 44,
            padding: "0 20px",
            borderRadius: 12,
            background: "transparent",
            color: NEX.cyan,
            border: `1px solid ${NEX.panelBorder}`,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Continue to NEX →
        </a>

        {/* iOS Safari expanded instructions · conditional. */}
        {isIosState && showIosHint ? (
          <div
            data-nex-install-home-ios-hint
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(0, 175, 255, 0.08)",
              border: `1px solid ${NEX.cyanSoft}`,
              fontSize: 12,
              lineHeight: 1.5,
              color: NEX.textDim,
            }}
          >
            <strong style={{ color: NEX.text }}>iOS Safari:</strong>{" "}
            tap the Share icon{" "}
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
            </span>{" "}
            then{" "}
            <strong style={{ color: NEX.text }}>Add to Home Screen</strong>.
            NEX will open like any installed app.
          </div>
        ) : null}
      </aside>
    </>
  );
}
