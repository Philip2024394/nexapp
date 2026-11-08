"use client";
// Owner-authorised 2026-11-08 (round 6) · Phase 1 remediation · Priority 1.
// Covers the public shop surface /nex-native/<slug>. A render fault
// here must not take down the chat or directory surfaces.
import { SegmentErrorBoundary } from "@/components/nex-native/section-boundary/SegmentErrorBoundary";

export default function PublicShopSegmentError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <SegmentErrorBoundary section="shops" label="This shop" error={error} reset={reset} />
  );
}
