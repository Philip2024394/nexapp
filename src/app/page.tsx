// src/app/page.tsx
//
// NEX root entry · session-aware · owner-approved 2026-10-17.
// --------------------------------------------------------------------
//   · signed-in  → /nex-native/home (preserves authenticated routing;
//                  unchanged from previous behaviour)
//   · signed-out → /nex-native/create-account (owner directive
//                  2026-10-18 · fresh visitors land directly on the
//                  signup surface · /welcome becomes the celebratory
//                  POST-signup landing, no longer the first-visit
//                  page)
//
// Prior history:
//   · pre-2026-10-16 · unconditional redirect to /nex-native/home ·
//     anon users cascaded through /sign-in with no first-visit page
//   · 2026-10-16 · signed-out routed to /nex-native/directory/landing
//     (sealed as the public first-visit destination)
//   · 2026-10-17 · owner directive · signed-out routes to
//     /nex-native/welcome · the "no account" first-visit experience
//   · 2026-10-18 · owner directive · signed-out routes to
//     /nex-native/create-account · the signup surface IS the first-
//     visit page; /welcome is reserved for post-signup orientation
//     and carries the install-home-screen slider

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function RootPage(): Promise<never> {
  const session = await resolveNexAppSessionFromContext().catch(() => null);
  if (session) {
    redirect("/nex-native/home");
  }
  redirect("/nex-native/create-account");
}
