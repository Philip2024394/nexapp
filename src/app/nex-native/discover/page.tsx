// src/app/nex-native/discover/page.tsx
//
// Owner-authorised 2026-10-17 · canonical NEX Directory doctrine.
// -----------------------------------------------------------------------
// `/nex-native/discover` was a competing business-discovery grid with
// its own category pills, filter state, and listing cards. The owner
// has sealed `/nex-native/directory/landing` as the single canonical
// NEX Directory entry point. This page becomes a thin server-side
// redirect so every caller (self-referential pagination + the
// Welcome intent-allowlist entry) continues to work via one HTTP hop.
//
// `?q=` and `?category=` handling:
//   · Bare /discover         → /directory/landing (hero)
//   · /discover?category=X   → /directory?category=X (results surface
//     accepts ?category= per sealed root routing)
//   · /discover?q=X          → /directory/landing (query dropped ·
//     canonical doesn't yet support ?q= · tracked as retirement
//     blocker · see docs/doctrine/nex-canonical-directory-2026-10-17.md)
//
// Pure redirect · zero rendering · zero session resolve. The
// destination handles its own auth and content.

import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; category?: string }>;
}

export default async function DiscoverRedirect({ searchParams }: PageProps): Promise<never> {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category.trim() : "";
  if (category.length > 0) {
    redirect(`/nex-native/directory?category=${encodeURIComponent(category)}`);
  }
  // `?q=` on the retired /discover surface is dropped. The canonical
  // /directory/landing doesn't yet support search-text filtering.
  // Users land on the landing hero and can re-navigate from there.
  redirect("/nex-native/directory/landing");
}
