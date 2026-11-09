// src/app/nex-native/orders/[orderId]/loading.tsx · R32b · order
// detail page · 6 awaits for order + events + business + product. Buyer
// taps an order from their history · expects to see it immediately.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function OrderDetailLoading() {
  return <NexLoadingSkeleton label="Order" rows={4} />;
}
