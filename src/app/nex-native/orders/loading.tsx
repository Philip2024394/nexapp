// src/app/nex-native/orders/loading.tsx · R32 · instant-paint for
// the buyer order history list.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function OrdersLoading() {
  return <NexLoadingSkeleton label="Orders" rows={4} />;
}
