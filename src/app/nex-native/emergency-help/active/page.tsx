// src/app/nex-native/emergency-help/active/page.tsx
//
// NEX Emergency Help · active-incident view · sealed 2026-10-10.
// ---------------------------------------------------------------
// Server shell that mounts the client-side `ActiveIncidentView`.
// The view polls the server every 15s for responder status · a
// realtime subscription is intentionally deferred to the shared
// NEX-wide realtime phase (see MEMORY note "NEX-wide inbound-message
// realtime + message push notifications PARKED").

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { ActiveIncidentView } from "@/components/nex-native/emergency/ActiveIncidentView";
import { isEmergencyLiveMode } from "@/lib/nex-native/emergency/feature-flag";
import {
  loadActiveIncidentServerAction,
  cancelServerAction,
} from "../_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ActiveIncidentPage(): Promise<React.JSX.Element> {
  // Owner directive 2026-10-25 · "dev pass for the emercey flow pages" ·
  // dev-only bypass matching the sealed go-live pattern. Production
  // keeps the sign-in redirect sealed.
  const session = await resolveNexAppSessionFromContext();
  if (!session && process.env.NODE_ENV === "production") {
    redirect("/nex-native/sign-in");
  }

  // Owner directive 2026-10-20 · see /emergency-help/page.tsx for the
  // shared doctrine · the server resolves live-mode and passes
  // `simulated` so UI state tracks the server's actual mode.
  const simulated = !isEmergencyLiveMode();

  return (
    <ActiveIncidentView
      simulated={simulated}
      services={{
        load: loadActiveIncidentServerAction,
        cancel: cancelServerAction,
      }}
    />
  );
}
