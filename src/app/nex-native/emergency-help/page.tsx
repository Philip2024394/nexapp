// src/app/nex-native/emergency-help/page.tsx
//
// NEX Emergency Help · "Do you need help?" confirmation surface.
// Sealed 2026-10-10.
//
// Thin server shell that mounts the client-side
// `EmergencyConfirmationScreen` and wires the shared server actions
// from `_actions.ts`. The 2-tap discipline, geolocation handling, and
// category selection all live inside the client component.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { EmergencyConfirmationScreen } from "@/components/nex-native/emergency/EmergencyConfirmationScreen";
import { isEmergencyLiveMode } from "@/lib/nex-native/emergency/feature-flag";
import {
  createDraftServerAction,
  activateServerAction,
  createPendingServerAction,
  confirmPendingServerAction,
  revokePendingServerAction,
  updateLocationServerAction,
} from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EmergencyHelpConfirmationPage(): Promise<React.JSX.Element> {
  // Owner directive 2026-10-25 · "dev pass for the emercey flow pages
  // and see" · dev-only bypass matching the sealed go-live pattern.
  // In NODE_ENV !== "production" a guest visitor can preview the
  // countdown surface end-to-end without signing in. In production
  // the sealed 2026-10-10 redirect is preserved.
  const session = await resolveNexAppSessionFromContext();
  if (!session && process.env.NODE_ENV === "production") {
    redirect("/nex-native/sign-in");
  }

  // Owner directive 2026-10-20 · the server resolves live-mode and
  // passes an explicit `simulated` prop so UI state honestly tracks
  // the service-layer gate. `isEmergencyLiveMode()` reads
  // `NEX_EMERGENCY_LIVE_MODE` and defaults FALSE · in that state the
  // UI renders the sealed SIMULATED badge on every state and the
  // service layer short-circuits writes. If the flag ever flips TRUE
  // at the environment layer, `simulated` becomes false here and the
  // UI stops rendering the badge · the two stay coherent via one
  // prop. Independent of this correction, no real alerts can ship
  // without the Phase 2 delivery pipeline (unrelated workstream).
  const simulated = !isEmergencyLiveMode();

  return (
    <EmergencyConfirmationScreen
      simulated={simulated}
      services={{
        createDraft: createDraftServerAction,
        activate: activateServerAction,
        createPending: createPendingServerAction,
        confirmPending: confirmPendingServerAction,
        revokePending: revokePendingServerAction,
        updateLocation: updateLocationServerAction,
      }}
    />
  );
}
