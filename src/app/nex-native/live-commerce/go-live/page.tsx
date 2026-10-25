// src/app/nex-native/live-commerce/go-live/page.tsx
//
// Owner directive 2026-10-22 · NEX Live Commerce broadcaster entry.
// Device-local broadcast · zero NEX server media cost · streams via
// WebRTC mesh from owner's browser to viewers directly. Session id
// is client-generated · signalling via Supabase Realtime (existing
// paid primitive). No new DB schema.
//
// This is a server component shell · client logic lives in
// _broadcaster-client.tsx. The sealed GO_LIVE action flag in
// creator-actions.ts remains NOT_YET_AVAILABLE · this route is a
// parallel entry point for the device-local pilot.
//
// Identity-sealing 2026-10-22 · the broadcaster id is now the
// signed-in NEX account id · guests are redirected to /sign-in with
// a return URL. No more `prototype-broadcaster` literal.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import { GoLiveClient, type RealLiveCatalogEntry } from "./_go-live-client";

export const metadata = {
  title: "NEX · Nex Live",
  description: "Broadcast live from your device to your customers.",
};

/* Owner directive 2026-10-24 · "dev pass for status and go live" ·
   dev-only bypass. In NODE_ENV !== "production" a guest visitor is
   NOT redirected to sign-in · the GoLiveClient receives a nil UUID
   as the broadcaster id so the surface renders end-to-end for dev
   testing. In production builds the sealed 2026-10-22 identity-
   sealing redirect is preserved · guests still land on /sign-in. */
const DEV_FALLBACK_BROADCASTER_ID = "00000000-0000-0000-0000-000000000000";

async function resolveBroadcasterIdOrRedirect(
  pathname: string,
): Promise<string> {
  const session = await resolveNexAppSessionFromContext();
  if (session) return session.account.id;
  if (process.env.NODE_ENV !== "production") {
    return DEV_FALLBACK_BROADCASTER_ID;
  }
  redirect(`/nex-native/sign-in?next=${encodeURIComponent(pathname)}`);
}

export default async function GoLivePage(): Promise<React.JSX.Element> {
  const selfAccountId = await resolveBroadcasterIdOrRedirect(
    "/nex-native/live-commerce/go-live",
  );

  /* Phase 2 · G2 · real-catalog integration. Replace the sealed
     CRISPY_CHICKEN_MOCK with the broadcaster's own nex_product rows.
     The broadcaster's first owned business supplies the catalog
     (matches createLivePostAction convention at _actions.ts:5692-5696).
     Guest / free-tier broadcasters (no owned business) see an empty
     catalog · the product-picker simply has no items to pick. */
  let realCatalog: readonly RealLiveCatalogEntry[] = [];
  let businessDisplayName: string | null = null;
  try {
    const businesses = await businessService.listBusinessesByOwner(
      selfAccountId,
    );
    const business = businesses[0];
    if (business) {
      businessDisplayName = business.display_name;
      const products = await productService.listProductsByBusiness(
        business.id,
      );
      realCatalog = products.map<RealLiveCatalogEntry>((p) => ({
        id: p.id,
        name: p.name,
        price_pence: p.price_pence,
        currency: p.currency,
        image_url: p.image_url ?? null,
      }));
    }
  } catch {
    // Fail-open · broadcaster can still start a session without a
    // product catalog (e.g. temporary DB hiccup); the picker shows
    // an empty state. Matches the fail-open-per-metric posture in
    // seller-insight-service.ts (Slice 1E).
  }

  return (
    <GoLiveClient
      selfAccountId={selfAccountId}
      realCatalog={realCatalog}
      businessDisplayName={businessDisplayName}
    />
  );
}
