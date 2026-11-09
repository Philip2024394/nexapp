// src/app/nex-native/community/notices/[id]/loading.tsx · R32c ·
// community notice detail · 5 awaits for notice + zone + author
// profile. Dynamic segment needs its own skeleton (parent /community
// loading does not inherit through the [id] boundary).

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function CommunityNoticeLoading() {
  return <NexLoadingSkeleton label="Notice" rows={4} />;
}
