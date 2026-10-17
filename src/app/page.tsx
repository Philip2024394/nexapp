// src/app/page.tsx
//
// NEX root entry · session-aware · owner-approved 2026-10-17.
// --------------------------------------------------------------------
//   · signed-in  → /nex-native/home (preserves authenticated routing;
//                  unchanged from previous behaviour)
//   · signed-out → /nex-native/welcome (owner directive 2026-10-17 ·
//                  Welcome is the first-visit page for every visitor
//                  without a NEX account · supersedes the earlier
//                  2026-10-16 Directory-landing-as-public-entry rule)
//
// Prior history:
//   · pre-2026-10-16 · unconditional redirect to /nex-native/home ·
//     anon users cascaded through /sign-in with no first-visit page
//   · 2026-10-16 · signed-out routed to /nex-native/directory/landing
//     (sealed as the public first-visit destination)
//   · 2026-10-17 · owner directive · signed-out routes to
//     /nex-native/welcome · the "no account" first-visit experience ·
//     the Directory landing continues to exist as the canonical NEX
//     Directory entry but is no longer the root-URL destination

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function RootPage(): Promise<never> {
  const session = await resolveNexAppSessionFromContext().catch(() => null);
  if (session) {
    redirect("/nex-native/home");
  }
  redirect("/nex-native/welcome");
}
