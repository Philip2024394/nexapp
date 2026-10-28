// src/app/nex-native/emergency-help/alert/[incidentId]/page.tsx
//
// NEX Emergency Help · recipient-side Alert Screen.
// Owner directive 2026-10-25 · "NEX EMERGENCY / HELP NEEDED / A NEX
// member has activated Emergency Help / member name + NEX ID / last
// recorded location / date and time / 3 round response buttons · they
// must select one to close it".
//
// Server shell forwards the incident id. The real-data flow (load
// incident + requester name + location + timestamp) requires migration
// 224 to be applied. In dev-mock (NODE_ENV !== production, no session)
// the client renders placeholder data so the UI can be reviewed
// end-to-end without the migration.
//
// Honest status:
//   · This screen is reachable only by direct URL today. No push /
//     SMS / Realtime notification routes a recipient here yet.
//   · The 3 response buttons call acceptIncidentAction /
//     declineIncidentAction · in dev-mock they return ok without a
//     real DB write.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { AlertRecipientClient } from "./_alert-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "NEX Emergency · Help Needed",
  description:
    "A NEX member has activated Emergency Help. Choose how you can respond.",
};

export default async function AlertRecipientPage({
  params,
}: {
  readonly params: Promise<{ readonly incidentId: string }>;
}): Promise<React.JSX.Element> {
  // Owner directive 2026-10-25 · dev-pass matching the sealed pattern ·
  // guests can preview the alert screen in dev. Production keeps the
  // sign-in redirect sealed.
  const session = await resolveNexAppSessionFromContext();
  if (!session && process.env.NODE_ENV === "production") {
    redirect("/nex-native/sign-in");
  }

  const { incidentId } = await params;
  return <AlertRecipientClient incidentId={incidentId} />;
}
