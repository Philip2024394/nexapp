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
import { IncomingGroupCallHub } from "./_incoming-group-call-hub";
import { PushSubscribeHub } from "./_push-subscribe-hub";
import { AppBadgeSyncClient } from "./_app-badge-sync-client";
// Owner-authored 2026-11-05 · global action-toast surface.
import { ActionToastHost } from "@/components/nex-native/ui/action-toast";
// Owner-authored 2026-11-05 later-same-day iter 12 · Discovery row in
// the ControlDrawer dispatches `nex-discovery-overlay-open` · this host
// listens globally and mounts the sealed 6-tile SearchOverlay.
import { DiscoveryOverlayHost } from "@/components/nex-native/chat-chrome/discovery-overlay-host";
// Owner-authored 2026-11-05 iter 27 · commit 1 of the visitor identity
// model · every first-time /nex-native visitor gets a provisional
// nex_account + signed nex_session cookie minted on mount. Fire-and-
// forget · idempotent per session · zero visible UI.
import { VisitorSessionBootstrap } from "@/components/nex-native/visitor-session/visitor-session-bootstrap";
// Owner-authored 2026-11-05 iter 27 · commit 4 · global popup that
// fires when a visitor taps an interact button (comment / like /
// follow / etc.). Listens for `nex-visitor-interact-required` window
// events dispatched by useVisitorInteractGate(). Zero DOM until
// fired.
import { VisitorInteractPopup } from "@/components/nex-native/visitor-session/visitor-interact-popup";
import { DevImpersonationBanner } from "./_dev-impersonation-banner";
// Owner directive 2026-11-10 (chat-speed P3) · global slide-in nav
// transitions. Client component · intercepts internal <a> clicks and
// wraps router.push() in document.startViewTransition() so every
// /nex-native/* navigation animates (outgoing slides left, incoming
// slides in from right). Falls back silently where the View
// Transitions API isn't available.
import { NexNavigationTransitions } from "./_navigation-transitions-client";
// Owner-sealed 2026-11-11 · Phase A (persistent-shell performance).
// Mounts in the persistent shell so it fires once per session. Warms
// a small allowlisted set of public destinations on idle via
// `router.prefetch` · populates the Next.js router cache so taps on
// those destinations commit without a cold RSC round-trip. Private
// routes are never prefetched · see public-route-allowlist.ts.
import { PublicRoutePrefetcher } from "./_public-route-prefetcher";
// Owner-authorised 2026-10-31 · NEX World Engine · Stage 5A.
// Server-resolves the active world + emits CSS vars scoped to
// .nex-native-stage. Preview cookie takes precedence for owner only.
import {
  WorldStylesheet,
  resolveWorldForLayout,
  getWorldDesktopBackdrop,
} from "./_world-stylesheet";
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

import { nexSiteUrl } from "@/lib/nex-native/seo/site-url-resolver";

// Owner directive 2026-11-11 (SEO B1) · metadataBase resolves from
// NEX_PUBLIC_SITE_URL_IE / _WW with dev fallback. canonical defaults
// to the root nex-native path · child routes override via their own
// alternates.canonical when relevant. In production, a missing env
// var throws at build time (sealed safeguard) rather than silently
// emitting a localhost URL.
const SEO_BASE_URL = nexSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(SEO_BASE_URL),
  alternates: {
    canonical: "/nex-native",
  },
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

  // Owner-authorised 2026-10-31 · NEX World Engine · Stage 5A.
  // Server-resolve the world ONCE here · we read the meta.id for the
  // data attribute · the <WorldStylesheet /> component below reads
  // its own copy (idempotent · same request = same answer) and emits
  // the <style> block. Scoped to .nex-native-stage · never leaks to
  // non-NEX route trees.
  const activeWorld = await resolveWorldForLayout();
  // Owner-authorised 2026-10-31 (country-preview round) · preload the
  // country-specific desktop backdrop. Rendering a <link rel="preload">
  // element inside a server component · Next.js hoists resource hints
  // into <head> automatically. Minimises the window during which the
  // viewport paints the solid base colour while the ~2.6 MB PNG is
  // still downloading.
  const activeBackdropUrl = getWorldDesktopBackdrop(activeWorld.meta.id);

  return (
    <I18nProvider initialLang={initialLang}>
      {/* Preload the country backdrop. See activeBackdropUrl above. */}
      <link rel="preload" as="image" href={activeBackdropUrl} />
      {/* Owner directive 2026-11-12 · DevImpersonationBanner (the
          blue "Impersonating nex-99901" strip at the top) is no
          longer mounted · the strip was visually intrusive even in
          dev. The banner component + env-var check stay on disk in
          case a future diagnostic needs it, but the surface is off. */}
      {/* Owner-authorised 2026-10-31 · World Engine CSS vars. */}
      <WorldStylesheet />
      {/* Owner directive 2026-11-10 (chat-speed P3) · slide-in navigation.
          See _navigation-transitions-client.tsx. Zero DOM · purely a
          document-level click interceptor. */}
      <NexNavigationTransitions />
      {/* Owner-sealed 2026-11-11 · Phase A · idle-time prefetch of
          allowlisted public destinations. Zero DOM · see
          _public-route-prefetcher.tsx. */}
      <PublicRoutePrefetcher />
      <div
        className="nex-native-stage"
        data-nex-world={activeWorld.meta.id}
      >
        <div className="nex-native-frame">
          {/* Owner-authored 2026-11-05 · global action-toast host.
              Catches `nex-action-toast` window events dispatched by
              `showActionToast()` from anywhere in the app · renders a
              fixed-top black-glass pill for 2 s. One mount per surface
              is sufficient · zero caller wiring. */}
          <ActionToastHost />
          {/* Owner-authored 2026-11-05 later-same-day iter 12 · global
              Discovery overlay listener · opens the sealed SearchOverlay
              (6 round Live-feed tiles) when the drawer's Discovery row
              dispatches `nex-discovery-overlay-open`. Mounts no DOM
              until the event fires · zero runtime cost. */}
          <DiscoveryOverlayHost />
          {/* Owner-authored 2026-11-05 iter 27 · visitor-identity
              bootstrap. Fires once per session · mints provisional
              nex_account + nex_session cookie on first visit · no-ops
              for returning visitors. Zero visible UI. */}
          <VisitorSessionBootstrap />
          {/* Owner-authored 2026-11-05 iter 27 · commit 4 · global
              visitor-interact popup · fires when any client interact
              button uses useVisitorInteractGate() and the viewer is
              a visitor. Routes "Create account" to /create-account?
              claim=<provisional_id> for commit 5's atomic claim. */}
          <VisitorInteractPopup />
          {/* Owner directive 2026-11-11 · phone-frame scoped view
              transitions. Previously `view-transition-name` sat on
              `.nex-native-frame` itself, which made the whole frame
              (bezel + content) slide on route change. Owner wants
              the PHONE to stay static and only the SCREEN CONTENT to
              slide. Moved the name onto this inner wrapper so the
              frame chrome holds still while just the children swap. */}
          <div data-nex-page-slide-root>{children}</div>
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
              {/* Owner-authorised 2026-11-08 (round 27) · group-call
                  incoming hub · polls /api/nex-native/calls/incoming-
                  group every 15s. Sits alongside the sealed 1:1 hub
                  · different data-source (DB polls not Realtime) so
                  there is no overlap. */}
              <IncomingGroupCallHub />
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
