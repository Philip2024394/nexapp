// src/app/nex-native/cart/loading.tsx
// Owner-authorised 2026-11-09 · closes audit-reported white-screen gap
// on the buyer checkout path.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function Loading() {
  return <NexLoadingSkeleton label="Loading cart" rows={4} />;
}
