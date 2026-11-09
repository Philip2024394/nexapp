// src/app/nex-native/community/select/loading.tsx · R32 · entry
// surface for picking a community zone · instant paint prevents
// white flash before the zone list resolves.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function CommunitySelectLoading() {
  return <NexLoadingSkeleton label="Community" rows={4} />;
}
