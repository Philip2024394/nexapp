// src/app/nex-native/page.tsx
//
// NEX first-entry router · updated 2026-10-11 (first-time experience).
//   · signed-in  → /nex-native/home (three-doorway hub)
//   · signed-out → /nex-native/welcome (guest first-open experience)
//
// Previous behaviour force-redirected signed-out visitors into
// /create-account. The founder-authorised first-time experience lets
// guests browse approved public surfaces first and only prompts for
// an account when they want to activate something.
//
// The sign-in gate lives at /nex-native/sign-in. The welcome page
// links back to it for returning users and primary-CTAs to
// /create-account for new signups.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page() {
  const session = await resolveNexAppSessionFromContext();
  if (session) {
    redirect("/nex-native/home");
  }
  redirect("/nex-native/welcome");
}
