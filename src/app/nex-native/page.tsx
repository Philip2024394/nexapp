// src/app/nex-native/page.tsx
//
// NEX first-entry router · updated 2026-11-04 (Ireland hero entry landing).
//   · signed-in                                → /nex-native/contacts
//   · signed-out · NEX_APP_IDENTITY=ireland    → /nex-native/ireland-entry
//   · signed-out · any other identity          → /nex-native/sign-in
//
// Scoping · per sealed Global Development Scope Rule 2026-11-01, country
// behaviour is parameterised by NEX_APP_IDENTITY, NOT a code fork. The
// Ireland branch is read from the env var set on the nex-ireland-preview
// Vercel project.
//
// Prior behaviour history (for reference):
//   · 2026-10-11 · signed-out → /nex-native/welcome
//   · 2026-10-18 · signed-out → /nex-native/create-account (gate-first)
//   · 2026-10-22 final · signed-out → /nex-native/create-account
//   · 2026-11-02 · signed-out → country-scoped
//   · 2026-11-03 · Ireland signed-out → /free-chat?show-themes=1 (sign-up at entry)
//   · 2026-11-04 · Ireland signed-out → /ireland-entry (NEW · hero landing,
//                 no sign-up at entry · tapping "Enter Ireland" leads to
//                 /free-chat for theme + account creation)
//
// Also 2026-11-04 · the sealed /create-account route was retired (moved
// to Windows Recycle Bin by owner directive); non-Ireland signed-out
// visitors now route to /sign-in to avoid landing on a 404.
//
// The free-chat page enforces its own sealed guest-only guard so
// signed-in Ireland users are still bounced OUT of free-chat to
// contacts if they ever reach it directly.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page() {
  const session = await resolveNexAppSessionFromContext();

  // Signed-in: straight to chat contacts.
  if (session) {
    redirect("/nex-native/contacts");
  }

  // Signed-out: Owner directive 2026-11-04 · the sealed product
  // direction (2026-11-03) is Ireland-only. Every signed-out visitor
  // lands on the /ireland-entry hero page with the orange "Enter
  // Ireland" button. No sign-up on the entry itself · tapping the
  // button leads to /free-chat where the guest-only theme picker +
  // account creation flow lives.
  //
  // The NEX_APP_IDENTITY env check was removed because:
  //   · the world resolver always returns Ireland (sealed 2026-11-03)
  //   · the previous non-Ireland branch pointed at /create-account
  //     which was retired 2026-11-04
  //   · dev-hq / dev-indonesia identities are preview testing only ·
  //     they share the same Ireland-only product surfaces
  //
  // If a future non-Ireland product variant is authorised, add the
  // identity branch back here with the specific redirect target.
  redirect("/nex-native/ireland-entry");
}
