// src/app/page.tsx
//
// NEX root entry · session-aware · owner-approved 2026-10-22.
// --------------------------------------------------------------------
//   · signed-in  → /nex-native/contacts (owner directive 2026-10-22
//                  (afternoon) · signed-in app opens straight on the
//                  contacts page · survives app close/reopen · only an
//                  explicit log-out invalidates the session cookie)
//   · signed-out → /nex-native/free-chat?show-themes=1 (owner
//                  directive 2026-10-22 · guests-with-no-account land
//                  on the 5-theme free-chat picker FIRST · signup is
//                  only triggered when they try a gated action)
//
// Prior history:
//   · pre-2026-10-16 · unconditional redirect to /nex-native/home ·
//     anon users cascaded through /sign-in with no first-visit page
//   · 2026-10-16 · signed-out → /nex-native/directory/landing
//   · 2026-10-17 · signed-out → /nex-native/welcome
//   · 2026-10-18 · signed-out → /nex-native/create-account (gate-first)
//   · 2026-10-22 · signed-out → /nex-native/free-chat?show-themes=1
//     (picker-first · aligns with the fresh-signup landing so signed-
//     in / signed-up / anon all converge on the same chat surface)

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function RootPage(): Promise<never> {
  const session = await resolveNexAppSessionFromContext().catch(() => null);
  if (session) {
    redirect("/nex-native/contacts");
  }
  redirect("/nex-native/free-chat?show-themes=1");
}
