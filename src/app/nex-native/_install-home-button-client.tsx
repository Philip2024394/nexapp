"use client";

// src/app/nex-native/_install-home-button-client.tsx
//
// NEX Home-Screen Install button · owner directive 2026-10-16.
// --------------------------------------------------------------------
// Prominent install CTA for the Welcome and Directory-Landing surfaces.
// Features:
//
//   · Chrome / Edge / Android Chromium → captures `beforeinstallprompt`,
//     renders the futuristic cyan NEX emblem as a tappable button, and
//     fires the browser's native install flow on click.
//   · iOS Safari → `beforeinstallprompt` never fires. We detect iOS
//     Safari and render the same button; tapping it reveals a short
//     honest tooltip explaining the Share → "Add to Home Screen" path
//     (the only way iOS allows PWA installs).
//   · Already-installed PWA → `display-mode: standalone` is active ·
//     the whole button renders nothing (no duplicate CTAs).
//   · Unsupported browsers → nothing renders (silent).
//
// Honesty rules enforced:
//   · No fake install success · we only report "installed" when the
//     real browser prompt returns `outcome === "accepted"`.
//   · No persistent banner across the app · this button is scoped to
//     the two owner-approved surfaces (Welcome + Directory Landing).
//   · iOS tooltip is pure guidance · no attempt to spoof the native
//     Share sheet (iOS doesn't permit programmatic triggering).
//   · Respects the user's dismissal · once the browser's install
//     prompt resolves (accepted or dismissed), the deferred event is
//     consumed and the button hides until the browser offers it again.
//
// Does NOT · change the PWA manifest, request notification permission,
// touch session state, or render on any surface other than where it's
// explicitly imported.

import * as React from "react";
import Image from "next/image";

// Chrome's non-standard BeforeInstallPromptEvent interface.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const EMBLEM_SRC = "/nex-brand/install-emblem.png";

export interface InstallHomeButtonClientProps {
  /** Short caption rendered beneath the emblem. Defaults to
   *  "Add NEX to your home screen". Keep concise · owner-approved
   *  copy for the Welcome + Directory-Landing surfaces. */
  readonly caption?: string;
  /** Optional size override · default 72 px matches the NEX ping-badge
   *  dimension used elsewhere. */
  readonly size?: number;
}

type ButtonState =
  | { kind: "hidden" }
  | { kind: "chromium"; deferred: BeforeInstallPromptEvent }
  | { kind: "ios" }
  | { kind: "installed" };

export function InstallHomeButtonClient({
  caption = "Add NEX to your home screen",
  size = 72,
}: InstallHomeButtonClientProps) {
  const [state, setState] = React.useState<ButtonState>({ kind: "hidden" });
  const [showIosHint, setShowIosHint] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // Already-installed detection · when the current session is
    // running as the installed PWA the button is a no-op.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      // iOS Safari exposes a non-standard flag on `navigator`.
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setState({ kind: "installed" });
      return;
    }

    // iOS Safari detection · UA + Apple vendor + absence of
    // `beforeinstallprompt`. Not perfect but sufficient to decide
    // whether to show the Share → Add to Home Screen hint.
    const ua = navigator.userAgent || "";
    const isIos = /iPad|iPhone|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);

    const onBeforeInstall = (e: Event): void => {
      e.preventDefault();
      setState({ kind: "chromium", deferred: e as BeforeInstallPromptEvent });
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // If the install prompt event never fires but we're on iOS Safari,
    // fall back to the iOS hint path after a short window (gives
    // Chromium browsers time to fire the beforeinstallprompt event).
    const iosTimer = isIos
      ? window.setTimeout(() => {
          setState((prev) => (prev.kind === "hidden" ? { kind: "ios" } : prev));
        }, 1500)
      : null;

    // When the browser finishes installing, hide the button.
    const onAppInstalled = (): void => {
      setState({ kind: "installed" });
    };
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, []);

  const handleChromiumClick = React.useCallback(async () => {
    if (state.kind !== "chromium") return;
    try {
      await state.deferred.prompt();
      const choice = await state.deferred.userChoice;
      if (choice.outcome === "accepted") {
        setState({ kind: "installed" });
      } else {
        // Browser consumed the deferred event · hide until it offers
        // again. Honest · no second-chance trick.
        setState({ kind: "hidden" });
      }
    } catch {
      setState({ kind: "hidden" });
    }
  }, [state]);

  if (state.kind === "hidden" || state.kind === "installed") return null;

  const sharedStyle: React.CSSProperties = {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    background: "rgba(2,9,20,0.6)",
    border: "1px solid rgba(0,175,255,0.3)",
    borderRadius: 16,
    cursor: "pointer",
    color: "#F2F5F8",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    boxShadow: "0 0 24px rgba(0,175,255,0.18)",
    textDecoration: "none",
    outline: "none",
  };
  const captionStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.2,
    color: "#B5C3D6",
    textAlign: "center",
    maxWidth: size * 2.4,
    lineHeight: 1.3,
  };

  if (state.kind === "chromium") {
    return (
      <button
        type="button"
        onClick={handleChromiumClick}
        aria-label="Install NEX on your home screen"
        data-nex-install-home-button="chromium"
        style={sharedStyle}
      >
        <Image
          src={EMBLEM_SRC}
          alt=""
          width={size}
          height={size}
          priority={false}
        />
        <span style={captionStyle}>{caption}</span>
      </button>
    );
  }

  // iOS path · tapping toggles a short tooltip rather than firing a
  // prompt (iOS Safari doesn't expose a programmatic install flow).
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setShowIosHint((v) => !v)}
        aria-label="Install NEX on your iPhone home screen"
        aria-expanded={showIosHint}
        data-nex-install-home-button="ios"
        style={sharedStyle}
      >
        <Image
          src={EMBLEM_SRC}
          alt=""
          width={size}
          height={size}
          priority={false}
        />
        <span style={captionStyle}>{caption}</span>
      </button>
      {showIosHint ? (
        <div
          role="tooltip"
          data-nex-install-home-ios-hint
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: 10,
            padding: "10px 14px",
            background: "#0A1526",
            border: "1px solid rgba(0,175,255,0.35)",
            borderRadius: 12,
            fontSize: 12,
            color: "#F2F5F8",
            width: "min(260px, 85vw)",
            lineHeight: 1.4,
            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
            zIndex: 10,
          }}
        >
          <strong style={{ color: "#00AFFF" }}>iPhone install</strong>
          <br />
          Tap the <strong>Share</strong> icon in Safari, then{" "}
          <strong>Add to Home Screen</strong>. iOS doesn't support an
          automatic install prompt, so this is the only path.
        </div>
      ) : null}
    </div>
  );
}
