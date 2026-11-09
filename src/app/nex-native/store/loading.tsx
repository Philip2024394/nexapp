// src/app/nex-native/store/loading.tsx
//
// Route-level Suspense boundary for /nex-native/store (NEX Store).
// Owner-authorised 2026-11-09 · fills a white-screen gap caught in the
// drawer audit. Uses the sealed NexLoadingSkeleton primitive.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function Loading() {
  return <NexLoadingSkeleton label="Loading store" rows={4} />;
}
