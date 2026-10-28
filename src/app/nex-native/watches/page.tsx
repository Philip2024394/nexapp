// src/app/nex-native/watches/page.tsx
//
// NEX Watches v1 · public watches entry point · RSC + client search.
// ----------------------------------------------------------------------------
// Hydrates with the initial tile list via `listPublicDirectoryTiles`.
// A client-side search box calls `searchWatchListingsAction` to swap
// in filtered tiles (real tsvector @@ websearch_to_tsquery via
// Migration 230).

import * as React from "react";
import { listPublicDirectoryTiles } from "@/lib/nex-native/watches/watch-listing-service";
import { WatchesBrowser } from "./_watches-browser";

export const dynamic = "force-dynamic";

export default async function WatchesIndexPage(): Promise<React.JSX.Element> {
  const initialTiles = await listPublicDirectoryTiles({ limit: 30, offset: 0 });
  return <WatchesBrowser initialTiles={initialTiles} />;
}
