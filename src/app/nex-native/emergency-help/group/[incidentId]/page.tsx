// src/app/nex-native/emergency-help/group/[incidentId]/page.tsx
//
// NEX Emergency Help · temporary responder group opened when a nearby
// NEX member taps "I will help" on an alert.
//
// Owner-authored 2026-10-25 (verbatim intent):
//   "i will help button opens the group and the persons nex id contact
//    card will apear with message this nex member has joined the group
//    to help with this emergency. Group Has Been Activated For This
//    Emergency expires 23.59min (telling the user group has been
//    activated they should see in top of their contacts list and in 24
//    hours it will expire) but hq nex has all reference saved for 30
//    days."
//
// Design rules (sealed by this build):
//   · Group is pinned to the top of each helper's Contacts list for
//     the lifetime of the incident.
//   · User-facing lifetime: 24 hours from activation. Live countdown.
//   · HQ NEX retains the group record for 30 days for safety review +
//     abuse checks (honest footnote at the foot of the page).
//   · Flagger identity (if any) + member identities stay private to
//     the group. Nothing in this page leaks a helper's identity to
//     the public.
//   · All messages shown here are system-generated in the prototype ·
//     no real-time wiring, no composer, no persistence.
//
// Dev-pass pattern · guest viewer can preview in dev; production
// keeps the sealed sign-in redirect.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { EmergencyGroupClient } from "./_group-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EmergencyGroupPage(props: {
  params: Promise<{ incidentId: string }>;
}): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session && process.env.NODE_ENV === "production") {
    redirect("/nex-native/sign-in");
  }
  const { incidentId } = await props.params;
  return <EmergencyGroupClient incidentId={incidentId} />;
}
