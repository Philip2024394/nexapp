// src/app/nex-native/page.tsx
//
// NEX first-entry router · updated 2026-10-18 (first-time experience).
//   · signed-in  → /nex-native/home (three-doorway hub)
//   · signed-out → /nex-native/create-account (signup form IS the
//                  first-visit page · /welcome is the celebratory
//                  POST-signup landing with the install-home-screen
//                  slider)
//
// Prior behaviour history:
//   · 2026-10-11 · signed-out routed to /nex-native/welcome · guests
//     browsed approved public surfaces first before signing up.
//   · 2026-10-18 · owner directive flipped the policy · fresh visitors
//     land on /create-account directly. /welcome becomes the post-
//     signup orientation page.
//
// The sign-in gate lives at /nex-native/sign-in. The create-account
// page links to it for returning users via "Already have an account?
// Sign in". The welcome page's signed-in branch still handles any
// user who reaches it directly after signing in.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page() {
  const session = await resolveNexAppSessionFromContext();
  if (session) {
    redirect("/nex-native/home");
  }
  redirect("/nex-native/create-account");
}
