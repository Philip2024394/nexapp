// src/app/page.tsx
//
// NEX root entry · session-aware · owner-approved 2026-10-22 (final).
// --------------------------------------------------------------------
//   · signed-in  → /nex-native/contacts (session cookie survives app
//                  close/reopen · only explicit log-out invalidates)
//   · signed-out → /nex-native/create-account (owner directive
//                  2026-10-22 afternoon · the landing page for every
//                  account-less visitor is the email+password form.
//                  On submit, fresh signups divert to the free-chat
//                  5-theme picker · see _actions.ts post-signup redirect)
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
  redirect("/nex-native/create-account");
}
