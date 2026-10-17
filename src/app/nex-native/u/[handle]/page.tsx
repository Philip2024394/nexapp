// src/app/nex-native/u/[handle]/page.tsx
//
// Owner directive 2026-10-17 · retired · thin redirect to the sealed
// canonical profile at /nex-native/profile/[handle].
// -------------------------------------------------------------------
// The previous Phase 3A public profile (sealed 2026-10-04 · 21 KB)
// has been superseded. The canonical NEX user profile now lives at
// /nex-native/profile/[handle] and consolidates:
//   · This Phase 3A /u/{handle} route
//   · The sealed /bio/{nex_handle} route (committed in f38cbd5)
//   · The /settings/profile owner-edit page
//
// This file stays on disk as a 307 redirect so:
//   · External shareable URLs (QR codes, offline DMs, bookmarks)
//     keep working with zero user-visible breakage
//   · ~20 internal callers across friend-service, QR share, chat
//     composer, contacts list, friend-request flows need no
//     synchronous update (they can migrate opportunistically)
//
// Query strings are preserved on the redirect. The canonical page's
// own privacy chain (is_discoverable + profile_visibility + 404 for
// enumeration) is unchanged · redirecting adds no privacy leak.

import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RetiredPublicProfileRedirect({
  params,
  searchParams,
}: PageProps): Promise<never> {
  const { handle } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v)) for (const vv of v) qs.append(k, vv);
  }
  const suffix = qs.toString();
  const base = `/nex-native/profile/${(handle ?? "").toLowerCase()}`;
  redirect(suffix ? `${base}?${suffix}` : base);
}
