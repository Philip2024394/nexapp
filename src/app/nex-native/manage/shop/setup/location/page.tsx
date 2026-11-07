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
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";
import {
  resolveDefaultOperatingCountry,
  narrowCountryCode,
} from "@/lib/nex-native/country-catalogue";
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

  // Pre-fill rank (owner-sealed 2026-11-07):
  //   1 · existing shop operating_country_code (owner's prior save)
  //   2 · owner account profile country_code
  //   3 · owner account phone_country_code → ISO2
  //   4 · NEX_APP_COUNTRY env
  //   5 · null · dropdown defaults to "Select country"
  const profile = await getProfileByAccountId(session.account.id);
  const envCountry =
    process.env.NEX_APP_COUNTRY ??
    process.env.NEXT_PUBLIC_NEX_APP_COUNTRY ??
    null;
  const existingOperatingCountry =
    narrowCountryCode((existing as { operating_country_code?: string | null }).operating_country_code ?? null) ??
    null;
  const resolvedDefaultCountry =
    existingOperatingCountry ??
    resolveDefaultOperatingCountry({
      profileCountryCode: profile?.country_code ?? null,
      phoneCountryCode: session.account.phone_country_code ?? null,
      envCountry,
    });

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
          initialCountryCode={resolvedDefaultCountry}
          accountProfileCountryCode={narrowCountryCode(profile?.country_code ?? null)}
        />
      </main>
    </>
  );
}
