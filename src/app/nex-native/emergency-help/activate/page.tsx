// src/app/nex-native/emergency-help/activate/page.tsx
//
// NEX Emergency Help · first-time activation (consent gate).
// Owner-authorised Phase 0 · 2026-10-24.
//
// Server shell · forwards the optional ?returnTo so the client can
// route the user back to the destination they tried to reach
// (default `/nex-native/emergency-help`) once they accept the
// activation terms.
//
// IMPORTANT · activation is CONSENT, not an emergency alert. This
// page never creates an incident or sends a notification. The real
// countdown/alert surface is `/nex-native/emergency-help` and still
// requires sign-in + its own per-tap confirmation discipline.

import { ActivateClient } from "./_activate-client";

export const metadata = {
  title: "Activate NEX Emergency Help",
  description:
    "First-time setup for NEX Emergency Help. Review how it works and give consent before the Emergency button becomes active.",
};

export default async function EmergencyActivatePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly returnTo?: string }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const returnTo = params.returnTo ?? "/nex-native/emergency-help";
  return <ActivateClient returnTo={returnTo} />;
}
