// src/app/nex-native/create-account/welcome/page.tsx
//
// Legacy Bridge-42 Add-to-Home-Screen landing · retired 2026-10-18.
// -----------------------------------------------------------------------------
// Owner directive 2026-10-18 · the post-signup celebratory landing
// moved from here to the top-level /nex-native/welcome page, which
// now owns the install-home-screen slider and the intent-card
// orientation layout.
//
// This file is intentionally preserved as a thin permanent redirect
// so any sealed bookmark, deep link, test URL, or external share
// that still points at /nex-native/create-account/welcome lands on
// the correct new destination.
//
// Prior history:
//   · 2026-09-28 (Bridge 42) · created as the sealed add-to-home
//     landing immediately after createNexAccountAction completes.
//   · 2026-10-18 · redirect-only · see /welcome/page.tsx for the
//     real content, including the InstallHomeSliderClient mount.

import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LegacyCreateAccountWelcomeRedirect(): Promise<never> {
  redirect("/nex-native/welcome");
}
