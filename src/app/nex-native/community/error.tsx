"use client";
// Owner-authorised 2026-11-08 (round 6+8) · segment error boundary.
// Priority 2 migration 304 added 'community' to the DB scope CHECK ·
// section reports now carry the true scope.
import { SegmentErrorBoundary } from "@/components/nex-native/section-boundary/SegmentErrorBoundary";

export default function CommunitySegmentError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
  return (
    <SegmentErrorBoundary section="community" label="Community" error={error} reset={reset} />
  );
}
