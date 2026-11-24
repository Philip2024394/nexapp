"use client";

// src/app/nex-native/install/_install-client.tsx
//
// NEX-022 · install destination client · owner-sealed 2026-11-24.
// Platform-aware install UI reached from the permanent side-drawer
// row (decision B2). Rules sealed in the owner directive:
//
//   · Never claim installed when the OS/browser has not confirmed.
//   · Never offer a button that cannot perform its advertised action.
//   · Never trigger the native `beforeinstallprompt` prompt without
//     a user action (owner directive · W3C guidance).
//   · Honour `appinstalled` to transition to "Already installed".
//   · Hide the install affordance when `display-mode: standalone`.
//
// This component is deliberately simple. It inspects the environment
// on mount, chooses a path, and renders one of five honest states:
//   · chromium  · deferred prompt captured, offer an Install button
//   · ios       · guide the user through Share → Add to Home Screen
//   · desktop   · same `beforeinstallprompt` path as chromium
//   · installed · the viewer is already running NEX as a PWA
//   · unsupported · browser cannot install · honest fallback copy
//
// Linked rules:
//   · 2026-11-24 NEX-021 full-viewport layout (inherited from parent)
//   · 2026-11-24 NEX-023 location timing (unrelated · no permission ask here)

import * as React from "react";
import Link from "next/link";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallState =
  | { kind: "detecting" }
  | { kind: "chromium"; deferred: BeforeInstallPromptEvent }
  | { kind: "ios" }
  // Mobile (Android / other mobile Chromium) where `beforeinstallprompt`
  // has NOT fired within the detection window. Chrome on Android always
  // offers an install path via the three-dot browser menu even when the
  // installability heuristics have not emitted the deferred event, so
  // collapsing this case into "unsupported" would mis-report the real
  // affordance. Sealed install rule 2026-11-24 requires platform-aware,
  // honest instructions · the Android menu path is the honest fallback.
  | { kind: "android-fallback" }
  | { kind: "desktop"; deferred: BeforeInstallPromptEvent | null }
  | { kind: "installed" }
  | { kind: "unsupported" };

function detectIsIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIosDevice = /iPad|iPhone|iPod/.test(ua);
  const isIpad13 =
    (navigator.platform === "MacIntel" &&
      (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints != null &&
      ((navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1)) ||
    false;
  return isIosDevice || isIpad13;
}

function detectIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (window.matchMedia?.("(display-mode: standalone)")?.matches ?? false) ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function detectIsMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/.test(navigator.userAgent || "");
}

export function NexInstallClient(): React.JSX.Element {
  const [state, setState] = React.useState<InstallState>({ kind: "detecting" });
  const [feedback, setFeedback] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    if (detectIsStandalone()) {
      setState({ kind: "installed" });
      return;
    }

    const isIos = detectIsIos();
    const isMobile = detectIsMobile();

    // iOS Safari never fires beforeinstallprompt. Short-circuit to
    // honest Share → Add to Home Screen instructions.
    if (isIos) {
      setState({ kind: "ios" });
      // Still listen for appinstalled on the off chance a wrapper fires it.
      const onInstalled = () => setState({ kind: "installed" });
      window.addEventListener("appinstalled", onInstalled);
      return () => {
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const deferred = e as BeforeInstallPromptEvent;
      setState({
        kind: isMobile ? "chromium" : "desktop",
        deferred,
      });
    };
    const onInstalled = () => setState({ kind: "installed" });

    window.addEventListener(
      "beforeinstallprompt",
      onBeforeInstallPrompt as EventListener,
    );
    window.addEventListener("appinstalled", onInstalled);

    // If neither event has fired after 1.2s we treat this as
    // "cannot install right now" rather than pretending a button
    // will work. Desktop with install capability still gets the
    // deferred event, so the fallback kicks in only when the
    // browser truly has no install path.
    const timer = window.setTimeout(() => {
      setState((current) =>
        current.kind === "detecting"
          ? isMobile
            ? { kind: "android-fallback" }
            : { kind: "desktop", deferred: null }
          : current,
      );
    }, 1200);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        onBeforeInstallPrompt as EventListener,
      );
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  const handleInstall = React.useCallback(async () => {
    if (state.kind !== "chromium" && state.kind !== "desktop") return;
    const deferred = state.deferred;
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setState({ kind: "installed" });
      } else {
        setFeedback("Install cancelled. You can try again anytime.");
      }
    } catch {
      setFeedback("Install prompt could not be shown. Try again from the browser menu.");
    }
  }, [state]);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "max(24px, env(safe-area-inset-top)) 20px 32px",
        overflowY: "auto",
      }}
    >
      <header style={{ width: "100%", maxWidth: 560, marginBottom: 20 }}>
        <Link
          href="/nex-native/contacts"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "#9BC1FF",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          ← Back
        </Link>
        <h1 style={{ margin: "14px 0 6px", fontSize: 28, lineHeight: 1.15 }}>
          Install NEX
        </h1>
        <p style={{ margin: 0, color: "#A4B4CF", fontSize: 15, lineHeight: 1.45 }}>
          Add NEX to your home screen for a cleaner, app-like experience with
          quick access whenever you need it.
        </p>
      </header>

      <section
        style={{
          width: "100%",
          maxWidth: 560,
          background: "rgba(16, 28, 52, 0.75)",
          border: "1px solid rgba(155, 193, 255, 0.18)",
          borderRadius: 16,
          padding: 20,
        }}
        aria-live="polite"
      >
        {state.kind === "detecting" ? (
          <p style={{ margin: 0, color: "#A4B4CF" }}>Checking your device…</p>
        ) : null}

        {state.kind === "installed" ? (
          <>
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>NEX is installed</h2>
            <p style={{ margin: 0, color: "#A4B4CF", lineHeight: 1.5 }}>
              You are already running NEX from your home screen. No extra steps
              needed.
            </p>
          </>
        ) : null}

        {state.kind === "chromium" ? (
          <>
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Install on this device</h2>
            <p style={{ margin: "0 0 16px", color: "#A4B4CF", lineHeight: 1.5 }}>
              Your browser can install NEX as a standalone app. Tap the button
              to confirm with the system dialog.
            </p>
            <button
              type="button"
              onClick={handleInstall}
              style={{
                padding: "12px 20px",
                borderRadius: 999,
                border: "none",
                background: "#4CA3FF",
                color: "#061021",
                fontWeight: 600,
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              Install NEX
            </button>
          </>
        ) : null}

        {state.kind === "desktop" ? (
          <>
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Install on this computer</h2>
            {state.deferred ? (
              <>
                <p style={{ margin: "0 0 16px", color: "#A4B4CF", lineHeight: 1.5 }}>
                  Your browser supports installing NEX as a desktop app. Tap
                  Install to confirm with the system dialog.
                </p>
                <button
                  type="button"
                  onClick={handleInstall}
                  style={{
                    padding: "12px 20px",
                    borderRadius: 999,
                    border: "none",
                    background: "#4CA3FF",
                    color: "#061021",
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                >
                  Install NEX
                </button>
              </>
            ) : (
              <p style={{ margin: 0, color: "#A4B4CF", lineHeight: 1.5 }}>
                Your browser may still allow installing NEX from its address
                bar menu (look for an install icon on the right of the URL
                bar, or open the browser menu and choose &ldquo;Install
                NEX&rdquo;). If no install option appears, this browser does
                not currently support PWA installation.
              </p>
            )}
          </>
        ) : null}

        {state.kind === "android-fallback" ? (
          <>
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Install on Android</h2>
            <p
              style={{
                margin: "0 0 16px",
                color: "#A4B4CF",
                lineHeight: 1.5,
              }}
            >
              Your Android browser can add NEX to your home screen from its
              menu. Open the browser menu (three dots, top-right) and tap
              {" "}
              <strong>Install app</strong> or{" "}
              <strong>Add to Home screen</strong> to pin NEX.
            </p>
            <p
              style={{
                margin: 0,
                color: "#A4B4CF",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              If an install icon appears in the address bar, you can tap
              that instead. If no install option appears, this browser does
              not currently support PWA installation.
            </p>
          </>
        ) : null}

        {state.kind === "ios" ? (
          <>
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Install on iPhone or iPad</h2>
            <ol
              style={{
                margin: "0 0 0 20px",
                padding: 0,
                color: "#D4DEF2",
                lineHeight: 1.6,
              }}
            >
              <li>Tap the Share icon in Safari (the square with an arrow pointing up).</li>
              <li>Scroll and tap <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong> in the top-right to confirm.</li>
            </ol>
            <p
              style={{
                margin: "16px 0 0",
                color: "#A4B4CF",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              iOS does not allow apps to trigger this prompt automatically, so
              these steps are the only way to add NEX to your home screen.
            </p>
          </>
        ) : null}

        {state.kind === "unsupported" ? (
          <>
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Install not available here</h2>
            <p style={{ margin: 0, color: "#A4B4CF", lineHeight: 1.5 }}>
              This browser does not currently support installing NEX to your
              home screen. You can still use NEX in your browser as normal, or
              try opening this page in Chrome, Edge, or Safari.
            </p>
          </>
        ) : null}

        {feedback ? (
          <p
            style={{
              marginTop: 14,
              color: "#FFC58B",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {feedback}
          </p>
        ) : null}
      </section>
    </div>
  );
}
