"use client";
// Owner-authorised 2026-11-08 (round 6) · Phase 1 remediation · Priority 1.
// Community scope reports as 'infra' until Priority-2 migration 304
// expands the nex_incident.scope CHECK enum to include 'community'.
import { SegmentErrorBoundary } from "@/components/nex-native/section-boundary/SegmentErrorBoundary";

export default function CommunitySegmentError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <SegmentErrorBoundary section="infra" label="Community" error={error} reset={reset} />
  );
}
