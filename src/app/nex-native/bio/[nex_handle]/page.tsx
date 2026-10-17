// src/app/nex-native/bio/[nex_handle]/page.tsx
//
// Owner directive 2026-10-17 · retired · thin redirect to the sealed
// canonical profile at /nex-native/profile/[nex_handle].
// -------------------------------------------------------------------
// The sealed /bio/[nex_handle] route (shipped in commit f38cbd5 on
// 2026-10-17) has been superseded within the same day by the newly
// sealed canonical profile at /nex-native/profile/[handle]. Owner
// directive · one profile UI across the app · the bio-link concept
// now folds into that single surface (public profile + Safe Trade
// container + businesses · same contents, one URL pattern).
//
// Query strings are preserved on the redirect. The canonical page's
// own privacy chain (is_discoverable + profile_visibility + 404 for
// enumeration) is unchanged · redirecting adds no privacy leak.

import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ nex_handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RetiredBioLinkRedirect({
  params,
  searchParams,
}: PageProps): Promise<never> {
  const { nex_handle } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v)) for (const vv of v) qs.append(k, vv);
  }
  const suffix = qs.toString();
  const base = `/nex-native/profile/${(nex_handle ?? "").toLowerCase()}`;
  redirect(suffix ? `${base}?${suffix}` : base);
}
