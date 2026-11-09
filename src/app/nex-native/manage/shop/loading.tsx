// src/app/nex-native/manage/shop/loading.tsx
// Owner-authorised 2026-11-09 · fills white-screen gap on the seller
// admin entry surface.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function Loading() {
  return <NexLoadingSkeleton label="Loading your shop" rows={5} />;
}
