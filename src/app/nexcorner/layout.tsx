// src/app/nexcorner/layout.tsx
//
// NEX prelaunch · Nexcorner landing standalone layout.
// Authored 2026-11-18.
//
// Deliberately NOT /nex-native/layout.tsx chrome:
//   · No i18n provider (prelaunch copy is English-only pending launch)
//   · No session resolution (landing is anonymous · founders use the
//     NEX_PRELAUNCH_FOUNDER_UIDS allowlist via an existing authenticated
//     route after signing in through the normal /nex-native/sign-in path)
//   · No incoming-call / vault / push-subscribe hubs
//   · No ControlDrawer / portal target — the landing has one CTA, no drawer
//
// Metadata is set here (not in individual pages) because /nexcorner is a
// single-page surface today; downstream /nexcorner/* pages (e.g. a future
// /nexcorner/launch/thank-you) inherit this metadata unless they override.
//
// Keep this file I/O-free so it is safe under Edge and Node alike, and
// cheap to render on the prelaunch public surface.

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./_nexcorner.css";

export const metadata: Metadata = {
  title: "Nexcorner — launching soon",
  description:
    "Nexcorner is launching soon. Enter your email to be notified when it opens.",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/nexcorner",
  },
  openGraph: {
    title: "Nexcorner — launching soon",
    description:
      "Nexcorner is launching soon. Enter your email to be notified when it opens.",
    type: "website",
    url: "/nexcorner",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#FBF5E9",
};

export default function NexcornerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
