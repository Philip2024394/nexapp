// src/app/nex-native/profile/me/loading.tsx
//
// Route-level Suspense boundary for /nex-native/profile/me.
// Owner-authorised 2026-11-09 · fills a white-screen gap caught in the
// drawer audit. Uses the sealed NexLoadingSkeleton primitive · no new
// visual design · matches every other route's loading shell.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function Loading() {
  return <NexLoadingSkeleton label="Loading profile" rows={5} />;
}
