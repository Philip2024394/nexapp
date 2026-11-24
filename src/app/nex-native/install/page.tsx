// src/app/nex-native/install/page.tsx
//
// NEX-022 · Install NEX destination · owner-sealed 2026-11-24
// (Option A · decision B2). This is the permanent target of the
// side-drawer "Install NEX" row so a user who dismissed the inline
// install card (Maybe Later) always has a reachable way to install.
//
// The page renders a static server shell for SEO / no-JS parity and
// hands platform detection to the client component. Platform-aware
// behaviour is sealed in the owner directive:
//
//   · Android / Chromium — capture `beforeinstallprompt`, offer a
//     real Install button that triggers the native prompt only after
//     the user presses it. Honour `appinstalled` to hide the offer.
//   · iOS / iPadOS Safari — `beforeinstallprompt` never fires. Show
//     honest instructions: Share → Add to Home Screen → Add.
//   · Desktop (Chrome / Edge with install capability) — offer the
//     native install prompt or honest dismissal.
//   · Already-installed PWA — show an "Already installed" confirm.
//   · Other browsers — show an honest fallback that does NOT claim
//     NEX can be installed when the browser does not support it.
//
// Full-viewport contract (NEX-021 § 11A) — the outermost `<main>` is
// position:fixed · inset:0 · overflow hidden, matching the splash
// reference. Honours `viewport-fit: cover` already in layout.tsx.
//
// No location permission is requested here (NEX-023 rule).
// No notifications are requested here (separate concern).

import { NexInstallClient } from "./_install-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function InstallNexPage(): React.JSX.Element {
  return (
    <main
      aria-label="Install NEX"
      style={{
        position: "fixed",
        inset: 0,
        margin: 0,
        padding: 0,
        background: "#061021",
        color: "#E6EEFB",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <NexInstallClient />
    </main>
  );
}
