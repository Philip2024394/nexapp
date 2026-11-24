// src/app/nex-native/page.tsx
//
// NEX splash page · owner-authorised 2026-11-08 · 2026-11-23 G-2 ·
// 2026-11-23 SOS decision screen (12-directive brief).
//
// Display name is "NEX splash page" per owner 2026-11-23. Route path
// stays /nex-native · every internal link already depends on it.
//
// Two branches, resolved server-side:
//
//   · SOS-ACTIVE (viewer is signed in AND has ≥1 enabled trusted
//     contact per `getContactsSetupStatusAction`) → render the
//     decision screen (see _splash-decision-screen.tsx). NO meta
//     refresh, NO 5-second timer. The user MUST deliberately choose
//     Enter NEX or SOS. Enter NEX is a real anchor to the G-2
//     destination; SOS is a hair-trigger anchor to
//     /nex-native/emergency-help.
//
//   · OTHERWISE → the existing branded auto-divert splash. Three-
//     way G-2 destination resolver:
//       · signed-in            → /nex-native/contacts
//       · signed-out + known   → /nex-native/sign-in         (State D/E)
//       · signed-out + new     → /nex-native/free-chat?show-themes=1 (State A)
//
// G-2 (NEX blueprint § 10 · 2026-11-23). Known-device cookie is set
// by middleware on every successful auth refresh and carries no
// identity information. Three-way branch below reads it.
//
// For the OTHERWISE branch: session is resolved server-side so the
// destination is known before the first paint · the client-side
// timer in _splash-client.tsx then calls router.replace(). A
// <meta http-equiv="refresh"> tag covers the no-JS case with the
// identical interval.
//
// Prior behaviour (for reference):
//   · 2026-10-11 · signed-out → /nex-native/welcome
//   · 2026-10-18 · signed-out → /nex-native/create-account (gate-first)
//   · 2026-10-22 final · signed-out → /nex-native/create-account
//   · 2026-11-02 · signed-out → country-scoped
//   · 2026-11-03 · Ireland signed-out → /free-chat?show-themes=1 (sign-up at entry)
//   · 2026-11-04 · Ireland signed-out → /ireland-entry (hero landing)
//   · 2026-11-08 · ANY signed-out → 3-sec splash → /free-chat?show-themes=1
//                  ANY signed-in  → 3-sec splash → /contacts
//   · 2026-11-23 G-2 · signed-out split into "known device → sign-in"
//                      vs "unknown device → theme picker"
//
// Design intent · the splash gives every user the same branded first
// moment regardless of where they end up. Lightweight · no network
// activity after the PNG is served from /public.

import { cookies as nextCookies } from "next/headers";
import Image from "next/image";
// 2026-11-20 · dev-impersonation parity backfill. The 2026-11-13
// URGENT directive requires BOTH the pages AND the server actions
// that gate on a NEX session to honour `resolveSessionWithDevOverride`,
// otherwise `NEX_DEV_IMPERSONATE_HANDLE=nex-99901` cannot complete
// the splash → `/contacts` route decision. Aliased to the legacy name
// so the existing call-site below stays unchanged.
import { resolveSessionWithDevOverride as resolveNexAppSessionFromContext } from "@/lib/nex-native/app/dev-impersonation";
import {
  KNOWN_DEVICE_COOKIE,
  isKnownDeviceCookieValue,
} from "@/lib/nex-native/app/known-device-cookie";
// 2026-11-23 · SOS decision-screen branch. `getContactsSetupStatusAction`
// is the authoritative source for whether the viewer has configured
// Emergency Help with ≥1 enabled recipient. See owner's 12-directive
// brief (sealed memory) · directive #8 requires a real persisted-config
// check, not a cookie or browser flag.
import { getContactsSetupStatusAction } from "@/lib/nex-native/emergency/actions";
import SplashClient from "./_splash-client";
import { SplashDecisionScreen } from "./_splash-decision-screen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEST_SIGNED_IN = "/nex-native/contacts";
const DEST_SIGNED_OUT_KNOWN_DEVICE = "/nex-native/sign-in";
const DEST_SIGNED_OUT_NEW_DEVICE = "/nex-native/free-chat?show-themes=1";
// Owner directive 2026-11-09 · splash auto-divert tightened from 3s
// to 2s. Activated-emergency users have this cancelled client-side
// (see _splash-client.tsx which removes the meta refresh on mount).
//
// Owner directive 2026-11-11 (later) · bumped from 2s to 5s alongside
// the new NEX Chat & Shop App Poster artwork · owner wants the branded
// first moment to breathe before the auto-divert.
const SPLASH_SECONDS = 5;

export default async function Page(): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  // G-2 (NEX blueprint § 10 · 2026-11-23) · three-way branch. The
  // known-device cookie is set by middleware after every successful
  // auth refresh and never cleared (owner rule: a signed-out returning
  // user must land on sign-in, not the theme picker).
  const cookieStore = await nextCookies();
  const knownDevice = isKnownDeviceCookieValue(
    cookieStore.get(KNOWN_DEVICE_COOKIE)?.value ?? null,
  );
  const destination = session
    ? DEST_SIGNED_IN
    : knownDevice
      ? DEST_SIGNED_OUT_KNOWN_DEVICE
      : DEST_SIGNED_OUT_NEW_DEVICE;

  // 2026-11-23 · SOS decision-screen gate (owner 12-directive brief).
  //
  // The setup-status action is actor-gated (returns `not_authenticated`
  // for guests). A signed-out viewer by definition has no SOS
  // configuration on this account, so the decision screen never
  // renders for them · the branded auto-divert splash stays.
  //
  // For signed-in viewers, `enabledContacts >= 1` is the authoritative
  // "SOS active" condition. If the action fails for any reason, we
  // fail CLOSED (treat as not-active) so a service hiccup can never
  // *add* a decision screen to a user who hasn't opted in.
  let sosActive = false;
  if (session) {
    const statusResult = await getContactsSetupStatusAction();
    if (statusResult.ok) {
      sosActive = statusResult.value.enabledContacts >= 1;
    }
  }

  if (sosActive) {
    // No meta refresh · no auto-divert · no client timer. The user
    // must deliberately choose. See _splash-decision-screen.tsx for
    // the rendered interaction.
    return <SplashDecisionScreen destination={destination} />;
  }

  return (
    <>
      {/* No-JS fallback · identical interval to the client timer. */}
      <meta
        httpEquiv="refresh"
        content={`${SPLASH_SECONDS};url=${destination}`}
      />
      <main
        aria-label="NEX · loading"
        style={{
          position: "fixed",
          inset: 0,
          margin: 0,
          padding: 0,
          background: "#061021",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          zIndex: 1000,
        }}
      >
        {/* Full-bleed on mobile · letterboxed centred on desktop ·
             object-fit contain preserves the illustrated phone frame
             baked into the artwork. */}
        <Image
          src="/nex-splash.png"
          alt="NEX · your world, one app"
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "contain", objectPosition: "center" }}
        />
        <SplashClient destination={destination} />
      </main>
    </>
  );
}
