// src/app/nex-native/page.tsx
//
// NEX first-entry splash · owner-authorised 2026-11-08.
//   · Shows /public/nex-splash.png full-bleed for 3 seconds
//   · signed-in         → /nex-native/contacts
//   · signed-out        → /nex-native/free-chat?show-themes=1 (theme picker)
//
// Session is resolved server-side so the destination is known before
// the first paint · the client-side 3-second timer in _splash-client.tsx
// then calls router.replace(). A <meta http-equiv="refresh"> tag covers
// the no-JS case with the identical interval.
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
//
// Design intent · the splash gives every user the same branded first
// moment regardless of where they end up. Lightweight · no network
// activity after the PNG is served from /public.

import Image from "next/image";
// 2026-11-20 · dev-impersonation parity backfill. The 2026-11-13
// URGENT directive requires BOTH the pages AND the server actions
// that gate on a NEX session to honour `resolveSessionWithDevOverride`,
// otherwise `NEX_DEV_IMPERSONATE_HANDLE=nex-99901` cannot complete
// the splash → `/contacts` route decision. Aliased to the legacy name
// so the existing call-site at line 46 stays unchanged.
import { resolveSessionWithDevOverride as resolveNexAppSessionFromContext } from "@/lib/nex-native/app/dev-impersonation";
import SplashClient from "./_splash-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEST_SIGNED_IN = "/nex-native/contacts";
const DEST_SIGNED_OUT = "/nex-native/free-chat?show-themes=1";
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
  const destination = session ? DEST_SIGNED_IN : DEST_SIGNED_OUT;

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
