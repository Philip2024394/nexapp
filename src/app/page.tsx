// src/app/page.tsx
//
// NEX root entry · session-aware · owner-approved 2026-10-16.
// --------------------------------------------------------------------
//   · signed-in  → /nex-native/home (preserves authenticated routing;
//                  unchanged from previous behaviour)
//   · signed-out → /nex-native/directory/landing (new public first-
//                  visit destination · the Directory landing is now
//                  the canonical public entry page per owner directive)
//
// Previous behaviour unconditionally pushed every visitor to
// /nex-native/home, which then cascaded (anon → /sign-in). That meant
// a brand-new anonymous visitor typing the bare URL never saw the
// public Directory landing. The owner's canonical URL map now treats
// /nex-native/directory/landing as the public entry.
//
// Scope · this file is the ONLY place changed for the root pivot ·
// /nex-native/page.tsx (the segment router) keeps its sealed
// anon→/welcome · signed-in→/home behaviour so the Welcome →
// Create-account chain is untouched.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function RootPage(): Promise<never> {
  const session = await resolveNexAppSessionFromContext().catch(() => null);
  if (session) {
    redirect("/nex-native/home");
  }
  redirect("/nex-native/directory/landing");
}
