// src/components/nex-native/auth-gate/nex-auth-gate.tsx
//
// NEX Auth Gate · page-level sign-in requirement.
// -----------------------------------------------
// Owner-sealed 2026-11-21 standard for any nex-native feature that
// MUST NOT render for signed-out users:
//
//   1 · Page-level gate · feature UI never mounts for guests.
//   2 · Slide-down notification banner with shade + blur backdrop.
//   3 · Primary "Sign in" CTA carries ?next=<returnTo> so the user
//       lands back on the same surface after auth.
//   4 · Secondary "Close" CTA sends them back (router.back()) because
//       the feature stays gated · dismissing does NOT unlock it.
//   5 · Behind the shaded+blurred layer · nothing is visible beyond
//       the sealed phone-frame base colour (owner-sealed option (i)
//       2026-11-21). No ghost tiles · no masked content · no leaks.
//
// This component auto-resolves the session via the sealed
// resolveSessionWithDevOverride helper · dev impersonation and real
// cookie sessions both resolve correctly without caller plumbing.
//
// Usage ·
//   <NexAuthGate featureName="Call Centre" returnTo="/nex-native/call-centre">
//     <main>…gated feature UI…</main>
//   </NexAuthGate>

import * as React from "react";

import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";

import { NexAuthGateBanner } from "./_nex-auth-gate-banner-client";

export interface NexAuthGateProps {
  /** Human-readable feature name · interpolated into the banner copy:
   *  "You must be signed in to use <featureName> features." */
  readonly featureName: string;
  /** Local path the sign-in flow returns to on success. Must be an
   *  in-app /nex-native/* path · the caller is responsible for passing
   *  a valid one · the sign-in page validates via its own safeNext(). */
  readonly returnTo: string;
  /** Gated feature UI · only mounted for signed-in viewers. */
  readonly children: React.ReactNode;
}

export async function NexAuthGate({
  featureName,
  returnTo,
  children,
}: NexAuthGateProps): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (session) {
    return <>{children}</>;
  }
  return <NexAuthGateBanner featureName={featureName} returnTo={returnTo} />;
}
