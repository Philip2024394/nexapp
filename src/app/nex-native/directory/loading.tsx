// src/app/nex-native/directory/loading.tsx
//
// Owner directive 2026-10-16 · instant-paint boundary for the hot
// Directory routes. Covers:
//   · /nex-native/directory              (landing results feed)
//   · /nex-native/directory/[id]         (slug interception + detail)
//
// Without this file Next 15 paints NOTHING between the click and the
// server's SSR response, which combined with `force-dynamic` + the
// Supabase session resolver makes every tap feel frozen. The skeleton
// paints in under 50 ms so clicks feel responsive even when the
// server round-trip is slow.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function DirectoryLoading() {
  return <NexLoadingSkeleton label="NEX Directory" rows={6} />;
}
