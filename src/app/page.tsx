// src/app/page.tsx
//
// NEX root entry · session-aware · owner-approved 2026-11-04.
// --------------------------------------------------------------------
//   · signed-in                                → /nex-native/contacts
//   · signed-out                               → /nex-native (delegated
//                  to /nex-native/page.tsx which does identity-aware
//                  routing · Ireland → /ireland-entry hero · others →
//                  /sign-in)
//
// Prior history:
//   · 2026-10-17 · signed-out → /nex-native/welcome
//   · 2026-10-18 · signed-out → /nex-native/create-account (gate-first)
//   · 2026-10-22 · signed-out → /nex-native/create-account (sealed)
//   · 2026-11-04 · signed-out → /nex-native (delegate to identity-aware
//                  nested entry · Ireland shows hero landing with
//                  orange "Enter Ireland" button · owner directive
//                  "nex ireland has no sign up at entry")
//
// The sealed /nex-native/create-account route was retired to the
// Recycle Bin by owner directive 2026-11-04; the root no longer
// references it directly.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function RootPage(): Promise<never> {
  const session = await resolveNexAppSessionFromContext().catch(() => null);
  if (session) {
    redirect("/nex-native/contacts");
  }
  // Delegate to the identity-aware nested entry so Ireland vs other
  // identities route correctly from a single source of truth.
  redirect("/nex-native");
}
