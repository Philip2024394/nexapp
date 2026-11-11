// src/lib/nex-native/navigation/prefetch-full.ts
//
// Phase A (persistent-shell performance) · owner-sealed 2026-11-11.
// -----------------------------------------------------------------
// Thin wrapper around `router.prefetch(path, { kind: "full" })`.
//
// Why `kind: "full"`?
//
//   Every /nex-native/* page has `export const dynamic =
//   "force-dynamic"` so Next.js's AUTO prefetch (the default)
//   only fetches a partial stub. That means subsequent
//   `router.push` still has to fetch the full RSC payload on
//   commit · hover prefetch + click still costs one network
//   request.
//
//   `kind: "full"` makes the prefetch fetch the complete RSC
//   payload, so when the user clicks the warmed router cache
//   serves the navigation with zero additional fetches.
//
// Why a wrapper?
//
//   Next.js's `PrefetchOptions.kind` field is typed as a string
//   enum (`PrefetchKind`) that lives at a deep internal path and
//   is not re-exported from `next/navigation`. Rather than import
//   through that path, we isolate the cast here so the call sites
//   stay clean.

import type { useRouter } from "next/navigation";

type RouterInstance = ReturnType<typeof useRouter>;
type PrefetchOpts = Parameters<RouterInstance["prefetch"]>[1];

export function prefetchFull(router: RouterInstance, path: string): void {
  // `kind: "full"` is a Next.js-recognised string enum value.
  // Cast through unknown to bypass the enum-nominal-typing without
  // taking a hard dependency on a deep internal import.
  const options = { kind: "full" } as unknown as PrefetchOpts;
  router.prefetch(path, options);
}
