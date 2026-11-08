"use client";
// Owner-authorised 2026-11-08 (round 6) · Phase 1 remediation · Priority 1.
import { SegmentErrorBoundary } from "@/components/nex-native/section-boundary/SegmentErrorBoundary";

export default function CartSegmentError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <SegmentErrorBoundary section="shops" label="Cart" error={error} reset={reset} />
  );
}
