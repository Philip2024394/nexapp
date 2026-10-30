// src/app/nex-native/live-commerce/enter-broadcast-room/page.tsx
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
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import { getAccountById } from "@/lib/nex-native/account-service";
import { resolveLiveEligibility } from "@/lib/nex-native/live-broadcast/live-eligibility";
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
  // Owner directive 2026-10-26 · dev persona impersonation.
  const session = await resolveSessionWithDevOverride();
  if (session) return session.account.id;
  if (process.env.NODE_ENV !== "production") {
    return DEV_FALLBACK_BROADCASTER_ID;
  }
  redirect(`/nex-native/sign-in?next=${encodeURIComponent(pathname)}`);
}

export default async function GoLivePage(): Promise<React.JSX.Element> {
  const selfAccountId = await resolveBroadcasterIdOrRedirect(
    "/nex-native/live-commerce/enter-broadcast-room",
  );

  /* Owner directive 2026-10-27 (R9 · Live-eligibility contract) ·
     Public Live broadcasting is a Shop membership benefit.
     Enforce at the SERVER SHELL layer so an ineligible account
     cannot even render the surface. Dev impersonation uses the
     persona's REAL seeded tier (no production bypass) · the
     seeded Hendra row carries `tier=bisnis` which passes the gate,
     a seeded `tier=gratis` persona correctly hits the upsell.
     The DEV_FALLBACK_BROADCASTER_ID branch (nil UUID) resolves
     to a NON-existent account and therefore is NOT eligible ·
     the dev route redirects to packages exactly as a real free
     user would, surfacing the gate end-to-end. */
  const account =
    selfAccountId === DEV_FALLBACK_BROADCASTER_ID
      ? null
      : await getAccountById(selfAccountId).catch(() => null);
  const eligibility = resolveLiveEligibility(account);
  if (!eligibility.ok) {
    /* Owner directive 2026-10-28 · dev-only bypass. Non-production
       builds skip the sealed R9 upsell redirect so unauthenticated
       testers can walk the Welcome → first-visit splash → control
       panel chain end-to-end without a Shop-tier seed. In production
       the sealed R9 contract still fires. */
    if (process.env.NODE_ENV === "production") {
      const returnTo = encodeURIComponent("/nex-native/live-commerce/welcome");
      redirect(
        `/nex-native/packages?upsell=live&reason=${eligibility.reason}&returnTo=${returnTo}`,
      );
    }
    console.warn(
      `[dev] /go-live bypassing live-eligibility · reason=${eligibility.reason}`,
    );
  }

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

  /* Owner directive 2026-10-28 · "why his profile image is not
     displaying in the profile image container · confirm connected
     with hendra account · avatar not displaying" · the DB column
     `nex_account.avatar_url` is declared in the TypeScript type
     (src/lib/nex-native/types.ts:311) but DOES NOT EXIST on the
     actual Supabase schema (verified 2026-10-28 against prod
     `ijvqdvsvwtwxzcqmoqit`). For seeded mock personas
     (is_mock_persona=true · Hendra, Siti, etc.) avatars live in the
     sealed `nex-mock-personas` public bucket keyed by lowercase
     first-name-of-display_name (same convention used by
     NexLiveFirstVisitSplash::avatarUrlForHandle). Resolve that URL
     here when the account is a mock persona · null for everyone
     else so the chip's gradient-initial fallback renders honestly.
     Non-mock production users need a separate avatar-source
     decision (not in scope for this edit). */
  const supabasePublicUrl = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? "";
  const selfAvatarUrl: string | null = (() => {
    if (!account) return null;
    if (!supabasePublicUrl) return null;
    // Honest runtime check · `is_mock_persona` exists on the DB
    // schema but is NOT yet declared on the `NexAccountRow`
    // TypeScript type · cast through unknown for a narrow probe.
    const isMockPersona = (account as unknown as { is_mock_persona?: boolean | null }).is_mock_persona === true;
    if (!isMockPersona) return null;
    const firstName = account.display_name?.trim().split(/\s+/)[0] ?? "";
    if (!firstName) return null;
    const handle = firstName.toLowerCase();
    return `${supabasePublicUrl}/storage/v1/object/public/nex-mock-personas/${handle}.png`;
  })();

  /* Owner directive 2026-10-28 · "we have seeded 20 mock profiles
     with names pick 3 names and activate · i need to see hendra
     select a profile and set the jail active button so the video
     for the jail will playing for that user profile with timer
     started". Dev-only · when the broadcaster is a seeded mock
     persona AND NODE_ENV !== "production", inject 3 named mock
     viewers into the presence roster so the Jail picker lists
     them with real avatars. The sealed Realtime jail-channel
     still fires on confirm · the broadcaster-side 10-minute
     countdown confirmation overlay (see _go-live-client.tsx
     `jailedUser` state) renders on Hendra's screen. UUIDs are
     the real seeded Supabase account ids so if we ever bring
     these personas on-stream as actual mesh members the IDs
     align. */
  const isMockBroadcaster = (account as unknown as { is_mock_persona?: boolean | null })?.is_mock_persona === true;
  const devMockViewers =
    process.env.NODE_ENV !== "production" && isMockBroadcaster
      ? ([
          {
            accountId: "fa5c711e-3d49-469a-8f78-54eae8961de0",
            displayName: "Siti Rahayu",
            avatarUrl: supabasePublicUrl
              ? `${supabasePublicUrl}/storage/v1/object/public/nex-mock-personas/siti.png`
              : null,
          },
          {
            accountId: "68c11fd4-f7ba-40ca-89ed-2c53ae1dd6af",
            displayName: "Bayu Santoso",
            avatarUrl: supabasePublicUrl
              ? `${supabasePublicUrl}/storage/v1/object/public/nex-mock-personas/bayu.png`
              : null,
          },
          {
            accountId: "56fb888b-93d1-4dc4-8c26-52577ef94c65",
            displayName: "Melati Kusuma",
            avatarUrl: supabasePublicUrl
              ? `${supabasePublicUrl}/storage/v1/object/public/nex-mock-personas/melati.png`
              : null,
          },
        ] as const)
      : null;

  /* Owner directive 2026-10-29 (Options C + D · host identity display) ·
     forward the broadcaster's personal display_name so the idle
     header chip + live-state identity caption render it without
     being confused with businessDisplayName. Null when the account
     could not be resolved (dev-fallback nil UUID branch). */
  const selfDisplayName: string | null = account?.display_name ?? null;

  /* Owner-authorised 2026-10-29 (NEX Music · Live overlay) · fetch
     the broadcaster's shared_live tracks so the Music right-rail
     button can open a picker + overlay. Fail-open: an empty library
     renders a Music button that shows the "no shared tracks yet"
     empty state · it never prevents Go-Live. */
  let musicLibrary: readonly import("@/lib/nex-native/music/types").NexMusicTrackRow[] = [];
  if (selfAccountId !== DEV_FALLBACK_BROADCASTER_ID) {
    try {
      const { listTracksByOwner } = await import(
        "@/lib/nex-native/music/music-repository"
      );
      const all = await listTracksByOwner(selfAccountId);
      musicLibrary = all.filter((t) => t.visibility === "shared_live");
    } catch {
      musicLibrary = [];
    }
  }

  return (
    <GoLiveClient
      selfAccountId={selfAccountId}
      realCatalog={realCatalog}
      businessDisplayName={businessDisplayName}
      selfAvatarUrl={selfAvatarUrl}
      selfDisplayName={selfDisplayName}
      devMockViewers={devMockViewers}
      musicLibrary={musicLibrary}
    />
  );
}

/* Note: the autoPlayMusic query param is read client-side (via
   next/navigation `useSearchParams`) inside GoLiveClient to avoid
   RSC-vs-dynamic rendering friction. The server shell above stays
   static-friendly. */
