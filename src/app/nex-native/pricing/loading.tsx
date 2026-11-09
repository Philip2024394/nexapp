// src/app/nex-native/pricing/loading.tsx · R32 · marketing surface ·
// first impression for buyers landing on /pricing · no white flash
// between tap and the price-table render.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function PricingLoading() {
  return <NexLoadingSkeleton label="NEX Pricing" rows={4} />;
}
