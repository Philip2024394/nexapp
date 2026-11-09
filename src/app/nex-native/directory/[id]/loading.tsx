// src/app/nex-native/directory/[id]/loading.tsx · R32b · directory
// detail page · 11 awaits for business + evidence + reviews. Critical
// for the "tap directory tile" UX · user expects instant acknowledgement.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function DirectoryDetailLoading() {
  return <NexLoadingSkeleton label="Directory" rows={5} />;
}
