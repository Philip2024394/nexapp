// src/app/nex-native/home/loading.tsx · instant-paint boundary for
// the Home hub.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function HomeLoading() {
  return <NexLoadingSkeleton label="NEX" rows={5} />;
}
