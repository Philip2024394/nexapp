// src/app/nex-native/page.tsx
//
// NEX first-entry router · updated 2026-11-02 (country-scoped Ireland home).
//   · signed-in                                → /nex-native/contacts
//   · signed-out · NEX_APP_IDENTITY=ireland    → /nex-native/free-chat?show-themes=1
//   · signed-out · any other identity          → /nex-native/create-account
//
// Scoping · per sealed Global Development Scope Rule 2026-11-01, country
// behaviour is parameterised by NEX_APP_IDENTITY, NOT a code fork. The
// Ireland branch is read from the env var set on the nex-ireland-preview
// Vercel project. Worldwide (nexapp) + Indonesia (nex-indonesia-preview)
// retain the prior 2026-10-22 final behaviour (signed-out → create-account).
//
// Prior behaviour history (all worlds · pre-country-scoping):
//   · 2026-10-11 · signed-out → /nex-native/welcome
//   · 2026-10-18 · signed-out → /nex-native/create-account (gate-first)
//   · 2026-10-22 · signed-out → /nex-native/free-chat?show-themes=1 (reverted same day)
//   · 2026-10-22 final · signed-out → /nex-native/create-account
//   · 2026-11-02 · signed-out → country-scoped (see decision table above)
//
// The sign-in gate lives at /nex-native/sign-in. The free-chat page
// enforces its own sealed guest-only guard (2026-10-22 afternoon seal)
// so Ireland signed-in users are still bounced OUT of free-chat to
// contacts · the country-scoped change here only affects where SIGNED-
// OUT visitors land, not the sealed signed-in flows.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page() {
  const session = await resolveNexAppSessionFromContext();
  if (session) {
    redirect("/nex-native/contacts");
  }
  // Country-scoped signed-out landing · Ireland sees the free-chat theme
  // picker as its guest home; other worlds keep the sealed create-account
  // landing. Read directly from the server-side env var set per Vercel
  // project · fast, no DB call on the entry router.
  const identity = (process.env.NEX_APP_IDENTITY ?? "").trim().toLowerCase();
  if (identity === "ireland") {
    redirect("/nex-native/free-chat?show-themes=1");
  }
  redirect("/nex-native/create-account");
}
