"use client";
// src/app/nex-native/orders/error.tsx · R32 · buyer order-history
// surface · covers /orders and /orders/[orderId] via segment
// inheritance. Supabase failures or missing-order lookups surface
// as a recoverable error card, not a raw stack trace.

import { SegmentErrorBoundary } from "@/components/nex-native/section-boundary/SegmentErrorBoundary";

export default function OrdersError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <SegmentErrorBoundary section="shops" label="Orders" error={error} reset={reset} />
  );
}
