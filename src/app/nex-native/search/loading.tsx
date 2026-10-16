// src/app/nex-native/search/loading.tsx · instant-paint boundary for
// the search surface.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function SearchLoading() {
  return <NexLoadingSkeleton label="Search" rows={3} />;
}
