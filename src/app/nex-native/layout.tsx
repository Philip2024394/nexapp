// src/app/nex-native/layout.tsx
//
// Bridge 64 · NEX-native metadata override · sealed 2026-09-29.
// -------------------------------------------------------------
// Root layout (/d/trades/src/app/layout.tsx) brands the site as
// "Thenetworkers" · that's correct for the legacy Xrated / trades
// surfaces but wrong for /nex-native. This segment layout re-writes
// metadata so:
//
//   · Browser tab title / OS window title reads "NEX"
//   · Apple / Android add-to-home-screen installs a proper NEX PWA
//     (own name, own icon, own start URL, own theme color)
//   · Description matches the chat + themes value prop
//   · manifest ref points at /nex.webmanifest (dedicated NEX web
//     app manifest with start_url = /nex-native/home)
//   · iOS status bar goes translucent black so the chat surface
//     paints edge-to-edge under the notch
//
// Applies to ALL routes under /nex-native · does NOT touch the
// other apps at /trade-off, /admin, /nexapp etc.

import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
// Phase B.7 · NEX Universal Language Foundation · the sealed
// I18nProvider is now mounted on EVERY nex-native route so
// consumers can rely on `useT` / `useLang` without each surface
// re-wiring the pipe. The initial locale is resolved server-side
// (session → Accept-Language → DEFAULT_LANG=`"id"`) so the first
// paint is deterministic and no hydration flash occurs.
import { I18nProvider } from "@/lib/nex/i18n/I18nProvider";
import { resolveServerLocale } from "@/lib/nex/i18n/server";
import { IncomingCallHub } from "./_incoming-call-hub";
import { PushSubscribeHub } from "./_push-subscribe-hub";
import { AppBadgeSyncClient } from "./_app-badge-sync-client";
import { SwCacheRegister } from "./_sw-cache-register";
// Owner directive 2026-10-18 · preload the Cover Themes Library +
// each per-layout preview on idle so the library opens instantly
// no matter which nex-native page the user enters from.
import { PrefetchCoverThemes } from "./cover-themes-library/_prefetch-cover-themes";
// NEX surface stylesheet · imported here (not only inside _shell) so
// every /nex-native/* route receives the shared tokens and the global
// scrollbar-hide rule, including pages that don't mount the client
// shell (e.g. /nex-native/search).
import "./nex-native.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#020914",
};

export const metadata: Metadata = {
  title: {
    default: "NEX · Chat that's yours",
    template: "%s · NEX",
  },
  description:
    "NEX is a chat app with beautiful themes · every friend sees your look · premium themes free for 7 days · Indonesia-first pricing.",
  applicationName: "NEX",
  manifest: "/nex.webmanifest",
  appleWebApp: {
    capable: true,
    title: "NEX",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    // 2026-10-15 · generated from the sealed NEX wordmark at
    // /brand/nex-logo.png · wordmark + ® on white, matches brand
    // palette (black letters + orange X slash on light surfaces).
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon-32.png",
  },
  openGraph: {
    type: "website",
    siteName: "NEX",
    title: "NEX · Chat that's yours",
    description:
      "Beautiful chat themes · your look, every conversation · Bisnis Rp 39k/mo · free 7-day trial.",
    locale: "id_ID",
  },
  twitter: {
    card: "summary_large_image",
    title: "NEX · Chat that's yours",
    description:
      "Beautiful chat themes · your look, every conversation · Bisnis Rp 39k/mo · free 7-day trial.",
  },
};

export default async function NexNativeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Bridge 86 · resolve the session server-side so the global
  // incoming-call hub knows which inbox channel to subscribe to.
  // Non-blocking · unauthenticated visitors get a null session and
  // the hub is skipped. Session lookup is a cookie read + one small
  // supabase.auth.getUser() · cached at request scope.
  let selfAccountId: string | null = null;
  let selfDisplayName: string | null = null;
  let accountLocale: string | null = null;
  try {
    const session = await resolveNexAppSessionFromContext();
    if (session) {
      selfAccountId = session.account.id;
      selfDisplayName = session.account.display_name;
      // Phase B.7 · pick up the sealed `nex_account.locale`
      // preference (migration 071) so the provider's initialLang
      // honours the signed-in user's choice from the first paint.
      // Unauthenticated visitors fall through · the resolver's
      // Accept-Language + DEFAULT_LANG precedence covers them.
      accountLocale = (session.account.locale as string | null) ?? null;
    }
  } catch { /* unauthenticated · hub stays disabled */ }

  // Phase B.7 · Universal language foundation.
  //   initialLang = resolveServerLocale({
  //     urlParam?        · NOT read here (per-route only · the
  //                        provider's useEffect re-resolves on the
  //                        client once window.location is available)
  //     accountLocale    · from the sealed session
  //     acceptLanguage   · from the incoming request header
  //   })
  // The resolver's fallback is DEFAULT_LANG (`"id"`) so client and
  // server converge on the same first-paint language.
  const headerBag = await headers();
  const initialLang = resolveServerLocale({
    accountLocale,
    acceptLanguage: headerBag.get("accept-language"),
  });

  // Bridge 89b · VAPID public key is safe to expose (that's its
  // purpose · clients need it to subscribe). Reads from env at
  // request time so a key rotation doesn't require a rebuild.
  const vapidPublicKey =
    process.env.NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY ?? null;

  return (
    <I18nProvider initialLang={initialLang}>
      <div className="nex-native-stage">
        <div className="nex-native-frame">
          {children}
          {/* Owner directive 2026-10-16 · the IncomingCallHub +
              PushSubscribeHub are mounted INSIDE the frame (not as
              layout-root siblings) so their position-absolute children
              anchor to the phone frame on desktop. The hub itself
              uses position: absolute · see _incoming-call-hub.tsx. */}
          {selfAccountId && selfDisplayName && (
            <>
              <IncomingCallHub
                selfAccountId={selfAccountId}
                selfDisplayName={selfDisplayName}
              />
              <PushSubscribeHub vapidPublicKey={vapidPublicKey} />
              {/* Owner directive 2026-10-16 · home-screen app badge sync.
                  Mounted only for signed-in viewers (anonymous has no
                  messages). Feature-detects navigator.setAppBadge and
                  silently degrades on platforms without the Badging
                  API (iOS Safari, Firefox). */}
              <AppBadgeSyncClient />
            </>
          )}
        </div>
      </div>
      {/* Caching SW · runs for signed-in AND signed-out visitors so
          returning sign-in / create-account pages are instant too.
          Lives outside the frame · no visual surface. */}
      <SwCacheRegister />
      {/* Owner directive 2026-10-18 · preload the Cover Themes Library
          + each per-layout preview on idle so the library opens
          instantly regardless of which page the user enters from.
          Fires once per browser session on requestIdleCallback. */}
      <PrefetchCoverThemes />
    </I18nProvider>
  );
}
