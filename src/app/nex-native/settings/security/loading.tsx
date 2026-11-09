// src/app/nex-native/settings/security/loading.tsx
// Owner-authorised 2026-11-09 · fills white-screen gap on the security
// admin surface · sensitive routes must not feel frozen.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function Loading() {
  return <NexLoadingSkeleton label="Loading security" rows={4} />;
}
