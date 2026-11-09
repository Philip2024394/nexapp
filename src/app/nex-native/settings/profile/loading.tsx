// src/app/nex-native/settings/profile/loading.tsx
// Owner-authorised 2026-11-09 · fills white-screen gap on the profile
// surface · high traffic post-signup and from every drawer "My profile"
// row across all three NEX deployments.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function Loading() {
  return <NexLoadingSkeleton label="Loading profile" rows={5} />;
}
