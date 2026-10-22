// src/app/nex-native/page.tsx
//
// NEX first-entry router · updated 2026-10-22 (picker-first flow).
//   · signed-in  → /nex-native/contacts (owner directive 2026-10-22
//                  afternoon · signed-in app lands on contacts, not
//                  the three-doorway hub)
//   · signed-out → /nex-native/free-chat?show-themes=1 (owner directive
//                  2026-10-22 · guests-with-no-account see the 5-theme
//                  picker + chat FIRST · signup triggers only when they
//                  try a gated action)
//
// Prior behaviour history:
//   · 2026-10-11 · signed-out → /nex-native/welcome
//   · 2026-10-18 · signed-out → /nex-native/create-account (gate-first)
//   · 2026-10-22 · signed-out → /nex-native/free-chat?show-themes=1
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
    redirect("/nex-native/contacts");
  }
  redirect("/nex-native/free-chat?show-themes=1");
}
