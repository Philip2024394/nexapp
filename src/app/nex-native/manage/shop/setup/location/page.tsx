// src/app/nex-native/manage/shop/setup/location/page.tsx
//
// Shop Setup · Step 2 · Location (address + city).
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Server shell · reads any existing business row so the form pre-
// fills on return visits. Delegates render to _client.tsx.
// Enforces the business-row precondition: if the owner somehow lands
// here without completing Step 1, bounce them back to /identity.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { LocationStepClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ShopSetupLocationPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/shop/setup/location");
  }
  const businesses = await listBusinessesByOwner(session.account.id);
  const existing = businesses[0];
  if (!existing) {
    // No business row yet · owner skipped Step 1 somehow. Send them
    // back · the identity action auto-provisions on save.
    redirect("/nex-native/manage/shop/setup/identity");
  }

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-shop-setup-location
        style={{
          position: "absolute",
          inset: 0,
          background: NEX_BG,
          color: NEX_TEXT,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 18px) 20px calc(env(safe-area-inset-bottom, 0px) + 18px)",
          boxSizing: "border-box",
        }}
      >
        <LocationStepClient
          initialAddress={existing.address ?? ""}
          initialCity={existing.city ?? ""}
        />
      </main>
    </>
  );
}
